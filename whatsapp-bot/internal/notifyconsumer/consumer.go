// Package notifyconsumer consome a fila RabbitMQ que
// apps/emails/services.py::notify_whatsapp publica e manda a mensagem de
// WhatsApp correspondente pra cada destinatário.
package notifyconsumer

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

// interRecipientDelay é o intervalo mínimo entre dois envios pro MESMO
// telefone — vale tanto entre destinatários diferentes de um mesmo aviso
// quanto entre avisos de emails diferentes que chegam em sequência (ver
// recipientThrottle). O WhatsApp trata rajadas de mensagens em sequência
// rápida como padrão de spam/automação e pode derrubar a sessão na hora
// (visto na prática: erro 463 + logout após 2 envios em <1s) — sem cobrir
// também o caso "vários emails pro mesmo setor em poucos segundos", o mesmo
// contato podia levar duas mensagens quase juntas mesmo com esse delay,
// porque cada email era um aviso (e portanto um handleDelivery) separado.
//
// sendRetryDelay/maxSendAttempts: erro 463 às vezes é um bloqueio momentâneo
// (rate-overlimit) e não permanente — visto na prática um destinatário falhar
// e o outro (enviado segundos antes) passar. Por isso vale uma segunda
// tentativa depois de esperar mais um pouco, em vez de desistir na primeira.
//
// São `var` (não `const`) pra dar pra encurtar nos testes.
var (
	interRecipientDelay = 20 * time.Second
	sendRetryDelay      = 15 * time.Second
)

const maxSendAttempts = 2

// maxNotifyAge é o quanto um aviso pode esperar na fila antes de ser
// considerado velho demais pra valer a pena mandar. Mensagem publicada e
// nunca consumida (bot ficou desconectado/bloqueado por um tempo) se
// acumula na fila — sem esse corte, na hora que o bot reconecta ele manda
// tudo de uma vez, exatamente a rajada que já derrubou a sessão antes. É
// `var` (não `const`) pra dar pra encurtar nos testes.
var maxNotifyAge = 30 * time.Minute

// Sender é implementado por waclient.Client — interface pequena só com o
// que este pacote precisa, pra ficar testável sem uma conexão real.
type Sender interface {
	SendText(ctx context.Context, phone string, text string) error
}

// recipientThrottle garante interRecipientDelay entre dois envios pro mesmo
// telefone, mesmo quando eles vêm de avisos (emails) diferentes -- cada
// chamada a Run consome uma instância só, compartilhada entre todos os
// handleDelivery daquele processo, então o histórico de "quando mandei pra
// esse número por último" persiste entre emails.
type recipientThrottle struct {
	mu       sync.Mutex
	lastSent map[string]time.Time
}

func newRecipientThrottle() *recipientThrottle {
	return &recipientThrottle{lastSent: map[string]time.Time{}}
}

// waitTurn bloqueia até que interRecipientDelay tenha passado desde o
// último envio (com sucesso ou não) pra esse telefone. Retorna false se o
// contexto foi cancelado antes disso -- nesse caso não marca o telefone como
// "enviado agora", já que o envio não vai acontecer.
func (t *recipientThrottle) waitTurn(ctx context.Context, phone string) bool {
	select {
	case <-ctx.Done():
		return false
	default:
	}

	t.mu.Lock()
	last, seen := t.lastSent[phone]
	t.mu.Unlock()

	if seen {
		if remaining := interRecipientDelay - time.Since(last); remaining > 0 {
			if !sleepOrDone(ctx, remaining) {
				return false
			}
		}
	}

	t.mu.Lock()
	t.lastSent[phone] = time.Now()
	t.mu.Unlock()
	return true
}

// Run conecta no RabbitMQ, declara a fila e consome mensagens até o
// contexto ser cancelado (Ctrl-C / SIGTERM, tratado em main.go). Payload
// malformado é descartado (nack sem requeue) em vez de travar a fila.
func Run(ctx context.Context, rabbitURL, queueName string, sender Sender) error {
	conn, err := amqp.Dial(rabbitURL)
	if err != nil {
		return fmt.Errorf("conectar no rabbitmq: %w", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("abrir canal: %w", err)
	}
	defer ch.Close()

	if err := ch.Qos(1, 0, false); err != nil {
		return fmt.Errorf("configurar qos: %w", err)
	}

	if _, err := ch.QueueDeclare(queueName, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declarar fila: %w", err)
	}

	msgs, err := ch.Consume(queueName, "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("iniciar consumo: %w", err)
	}

	log.Printf("Consumindo fila %q", queueName)
	throttle := newRecipientThrottle()
	for {
		select {
		case <-ctx.Done():
			return nil
		case delivery, ok := <-msgs:
			if !ok {
				return fmt.Errorf("canal de mensagens fechado")
			}
			handleDelivery(ctx, delivery, sender, throttle)
		}
	}
}

func handleDelivery(ctx context.Context, delivery amqp.Delivery, sender Sender, throttle *recipientThrottle) {
	var payload NotifyPayload
	if err := json.Unmarshal(delivery.Body, &payload); err != nil {
		log.Printf("payload invalido, descartando: %v", err)
		_ = delivery.Nack(false, false)
		return
	}

	if age, stale := staleness(payload.CreatedAt); stale {
		log.Printf(
			"aviso descartado por estar velho demais (processed_email_id=%s, %s atrás) — provavelmente acumulou enquanto o bot estava desconectado",
			payload.ProcessedEmailID, age.Round(time.Second),
		)
		_ = delivery.Ack(false)
		return
	}

	sendToRecipients(ctx, sender, FormatMessage(payload), payload.Recipients, payload.ProcessedEmailID, throttle)
	_ = delivery.Ack(false)
}

// staleness calcula há quanto tempo o email foi processado. Se createdAt
// vier vazio ou não der pra interpretar (payload antigo, de antes desse
// campo existir), trata como "não velho" — não vale a pena descartar um
// aviso de verdade só por causa de um payload sem esse dado.
func staleness(createdAt string) (age time.Duration, stale bool) {
	if createdAt == "" {
		return 0, false
	}
	t, err := time.Parse(time.RFC3339Nano, createdAt)
	if err != nil {
		return 0, false
	}
	age = time.Since(t)
	return age, age > maxNotifyAge
}

// sendToRecipients manda a mesma mensagem pra cada destinatário, respeitando
// o intervalo mínimo por telefone (recipientThrottle) antes de cada envio.
// Extraído de handleDelivery pra dar pra testar sem precisar de um
// amqp.Delivery de verdade.
func sendToRecipients(ctx context.Context, sender Sender, text string, recipients []string, processedEmailID string, throttle *recipientThrottle) {
	for _, phone := range recipients {
		if !throttle.waitTurn(ctx, phone) {
			return
		}
		sendWithRetry(ctx, sender, phone, text, processedEmailID)
	}
}

func sendWithRetry(ctx context.Context, sender Sender, phone, text, processedEmailID string) {
	var err error
	for attempt := 1; attempt <= maxSendAttempts; attempt++ {
		err = sender.SendText(ctx, phone, text)
		if err == nil {
			log.Printf("whatsapp enviado pra %s (processed_email_id=%s)", phone, processedEmailID)
			return
		}
		if attempt < maxSendAttempts {
			log.Printf(
				"falha ao mandar whatsapp pra %s (tentativa %d/%d, processed_email_id=%s): %v — tentando de novo em %s",
				phone, attempt, maxSendAttempts, processedEmailID, err, sendRetryDelay,
			)
			if !sleepOrDone(ctx, sendRetryDelay) {
				return
			}
		}
	}
	log.Printf(
		"falha ao mandar whatsapp pra %s (processed_email_id=%s), desistindo depois de %d tentativas: %v",
		phone, processedEmailID, maxSendAttempts, err,
	)
}

func sleepOrDone(ctx context.Context, d time.Duration) bool {
	select {
	case <-ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}