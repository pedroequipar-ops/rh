// Package waclient encapsula a conexão com o WhatsApp via whatsmeow: sessão
// persistida no Postgres (mesmo container/banco do Django), pareamento por
// QR code (ver pairWithQRCode), e envio de mensagem de texto simples.
// Mensagens recebidas são repassadas via callback (onInboundMessage), com
// telefone e texto -- usado tanto pra confirmar o número quanto pro fluxo
// de favoritar remetente (ver apps/users/services.py::handle_whatsapp_inbound_text).
package waclient

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/mdp/qrterminal/v3"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

// brazilCountryCode é prefixado em números que vêm sem código de país -- o
// User.phone do Django guarda só "DDD + número" (ex: 98988255192, 11
// dígitos), formato brasileiro sem o 55 na frente. O WhatsApp exige o
// número completo com código de país pra resolver o contato.
const brazilCountryCode = "55"

// Tentativas de resolver o telefone real (PN) a partir do identificador LID
// que o WhatsApp às vezes manda no lugar do número -- ver resolvePhoneForLID.
const lidResolveAttempts = 4

// var (não const) pra os testes conseguirem encurtar sem esperar de verdade.
var lidResolveDelay = 1500 * time.Millisecond

// globalSendDelayMin/Max definem o intervalo (aleatório, não fixo) entre
// QUAISQUER dois envios do bot, mesmo pra destinatários diferentes -- o
// recipientThrottle de notifyconsumer só cobre repetição pro MESMO número;
// alternar rápido entre destinatários diferentes (ex: setor novo gerando
// vários emails de remetentes/destinatários distintos em sequência) é o
// mesmo padrão de rajada que já derrubou a sessão na prática (erro 463 +
// logout, ver comentário em notifyconsumer/consumer.go). O intervalo é
// sorteado a cada envio (não um valor fixo) pra não ter um ritmo
// perfeitamente regular, que por si só também é um sinal de automação.
// Fica aqui dentro de SendText (não em cada consumer) porque notifyconsumer
// e replyconsumer compartilham a mesma sessão do WhatsApp -- só um throttle
// no ponto comum garante o intervalo entre os dois fluxos ao mesmo tempo,
// não só dentro de cada um.
// var (não const) pra os testes conseguirem encurtar sem esperar de verdade.
var (
	globalSendDelayMin = 4 * time.Second
	globalSendDelayMax = 8 * time.Second
)

// randomSendDelay sorteia um intervalo em [globalSendDelayMin,
// globalSendDelayMax). Se o máximo não for maior que o mínimo (ex: testes
// que igualam os dois pra ter um valor fixo e previsível), devolve o
// mínimo direto em vez de chamar rand.Int63n(0), que teria pânico.
func randomSendDelay() time.Duration {
	span := globalSendDelayMax - globalSendDelayMin
	if span <= 0 {
		return globalSendDelayMin
	}
	return globalSendDelayMin + time.Duration(rand.Int63n(int64(span)))
}

type Client struct {
	wa        *whatsmeow.Client
	container *sqlstore.Container
	pacer     *sendPacer
	loggedOut chan struct{}
}

// LoggedOut é fechado quando o servidor derruba a sessão em tempo de
// execução (evento *events.LoggedOut, ver handleInboundEvent) -- quem chama
// (main.go) usa isso pra parar os consumidores e voltar a chamar Connect,
// que detecta a sessão morta e entra em loop de repareamento sozinho (ver
// pairWithQRCode), sem precisar reiniciar o processo.
func (c *Client) LoggedOut() <-chan struct{} {
	return c.loggedOut
}

// sendPacer implementa o intervalo (aleatório, ver globalSendDelayMin/Max)
// entre dois envios, independente de destinatário.
type sendPacer struct {
	mu   sync.Mutex
	last time.Time
}

func newSendPacer() *sendPacer {
	return &sendPacer{}
}

// waitTurn bloqueia até um intervalo sorteado (ver randomSendDelay) ter
// passado desde o último envio (de qualquer destinatário). Retorna false se
// o contexto foi cancelado antes disso -- nesse caso não marca "enviado
// agora", já que o envio não vai acontecer.
func (p *sendPacer) waitTurn(ctx context.Context) bool {
	select {
	case <-ctx.Done():
		return false
	default:
	}

	p.mu.Lock()
	last := p.last
	p.mu.Unlock()

	if remaining := randomSendDelay() - time.Since(last); remaining > 0 {
		select {
		case <-ctx.Done():
			return false
		case <-time.After(remaining):
		}
	}

	p.mu.Lock()
	p.last = time.Now()
	p.mu.Unlock()
	return true
}

// Connect abre (ou cria) o dispositivo pareado no Postgres e conecta no
// WhatsApp. Se não houver sessão pareada (primeira vez, ou sessão anterior
// derrubada pelo servidor -- ver LoggedOut), entra em loop de repareamento
// por QR code (pairWithQRCode): imprime o QR em ASCII no log do serviço
// (`docker service logs -f`), escaneável direto de lá. Bloqueia até a
// conexão (ou o repareamento) ser concluído.
//
// onInboundMessage é chamado (número no formato DDD+número, sem código de
// país, + texto da mensagem) toda vez que uma mensagem de verdade chega de
// um contato -- usado tanto pra confirmar o número quanto pra detectar o
// fluxo de favoritar remetente.
//
// O segundo valor de retorno indica se essa conexão exigiu repareamento
// agora (sessão nova ou recém-derrubada) -- quem chama usa isso pra dar uma
// carência antes de começar a mandar aviso de verdade (ver main.go).
func Connect(ctx context.Context, postgresDSN string, onInboundMessage func(phone, text string)) (*Client, bool, error) {
	dbLog := waLog.Stdout("Database", "INFO", true)
	container, err := sqlstore.New(ctx, "pgx", postgresDSN, dbLog)
	if err != nil {
		return nil, false, fmt.Errorf("abrir sqlstore: %w", err)
	}

	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("carregar device: %w", err)
	}

	loggedOutCh := make(chan struct{})
	var loggedOutOnce sync.Once
	onLoggedOut := func() { loggedOutOnce.Do(func() { close(loggedOutCh) }) }

	clientLog := waLog.Stdout("Client", "INFO", true)
	waClient := whatsmeow.NewClient(device, clientLog)
	waClient.AddEventHandler(func(evt interface{}) {
		handleInboundEvent(ctx, waClient, evt, onInboundMessage, onLoggedOut)
	})

	freshPairing := waClient.Store.ID == nil
	if freshPairing {
		if err := pairWithQRCode(ctx, waClient); err != nil {
			return nil, false, err
		}
	} else if err := waClient.Connect(); err != nil {
		return nil, false, fmt.Errorf("conectar: %w", err)
	}

	return &Client{wa: waClient, container: container, pacer: newSendPacer(), loggedOut: loggedOutCh}, freshPairing, nil
}

// pairWithQRCode pareia mostrando um QR code em ASCII no log do serviço --
// escaneável direto de `docker service logs -f checkmail_whatsapp-bot`, sem
// precisar de tela nem senha nenhuma. Fica em loop até dar certo ou o
// contexto ser cancelado: se a janela de QR fechar sem ninguém escanear (ou
// se Connect/GetQRChannel falhar), espera um tempo que dobra a cada falha
// (backoff, ver pairErrorBackoffMin/Max) e tenta de novo -- é esse loop que
// permite o bot voltar sozinho depois que humano reativa o número no
// celular, sem precisar reiniciar nada na VPS.
func pairWithQRCode(ctx context.Context, waClient *whatsmeow.Client) error {
	backoff := pairErrorBackoffMin
	for {
		qrChan, err := waClient.GetQRChannel(ctx)
		if err != nil {
			log.Printf("falha ao abrir canal de QR (tentando de novo em %s): %v", backoff, err)
			if !sleepOrDone(ctx, backoff) {
				return ctx.Err()
			}
			backoff = nextBackoff(backoff)
			continue
		}
		if err := waClient.Connect(); err != nil {
			log.Printf("falha ao conectar pro repareamento (tentando de novo em %s): %v", backoff, err)
			if !sleepOrDone(ctx, backoff) {
				return ctx.Err()
			}
			backoff = nextBackoff(backoff)
			continue
		}

		paired := false
		for evt := range qrChan {
			switch evt.Event {
			case whatsmeow.QRChannelEventCode:
				log.Println("QR code pra repareamento -- escaneie com WhatsApp > Aparelhos conectados > Conectar um aparelho (expira rápido):")
				qrterminal.GenerateWithConfig(evt.Code, qrterminal.Config{
					Level:     qrterminal.L,
					Writer:    os.Stdout,
					BlackChar: qrterminal.BLACK,
					WhiteChar: qrterminal.WHITE,
					QuietZone: 2,
				})
			case whatsmeow.QRChannelSuccess.Event:
				log.Println("Pareado com sucesso.")
				paired = true
			default:
				log.Printf("Evento de pareamento: %s", evt.Event)
			}
		}

		if paired {
			return nil
		}

		waClient.Disconnect()
		log.Printf("pareamento por QR não concluído -- tentando de novo em %s", backoff)
		if !sleepOrDone(ctx, backoff) {
			return ctx.Err()
		}
		backoff = nextBackoff(backoff)
	}
}

// pairErrorBackoffMin/Max limitam a espera entre tentativas de repareamento
// (ver pairWithQRCode) -- dobra a cada falha/janela expirada, começando em
// 1min e nunca passando de 10min. São `var` (não `const`) pra dar pra
// encurtar nos testes.
var (
	pairErrorBackoffMin = 1 * time.Minute
	pairErrorBackoffMax = 10 * time.Minute
)

// nextBackoff dobra a espera anterior, sem passar de pairErrorBackoffMax.
func nextBackoff(d time.Duration) time.Duration {
	d *= 2
	if d > pairErrorBackoffMax {
		return pairErrorBackoffMax
	}
	return d
}

// sleepOrDone bloqueia por d ou até o contexto ser cancelado -- o que vier
// primeiro. Retorna false se foi o contexto (quem chama deve desistir sem
// tratar como "esperou o tempo todo").
func sleepOrDone(ctx context.Context, d time.Duration) bool {
	select {
	case <-ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}

// extractText pega o texto de uma mensagem recebida -- a maioria chega como
// Conversation (texto simples), mas mensagem com preview de link ou citação
// chega como ExtendedTextMessage; sem checar os dois, um email mandado com
// preview de link ativo (comum em teclado de celular) passaria batido pelo
// fluxo de favoritar remetente.
func extractText(msg *waE2E.Message) string {
	if msg == nil {
		return ""
	}
	if text := msg.GetConversation(); text != "" {
		return text
	}
	return msg.GetExtendedTextMessage().GetText()
}

// handleInboundEvent loga toda mensagem recebida e, pra mensagem de verdade
// de um contato (não grupo, não eco do próprio bot), chama onInboundMessage
// com o número em formato PN (não o LID) e o texto da mensagem.
//
// Trata dois tipos de evento: *events.Message (decifrada com sucesso) e
// *events.UndecryptableMessage (chegou mas o cliente não conseguiu ler o
// conteúdo -- comum logo após um pareamento novo, enquanto as chaves de
// sessão ainda sincronizam). Nesse segundo caso não tem como saber o texto
// (por definição não decifrou), mas ainda conta como confirmação de número.
//
// Quando o WhatsApp manda o remetente como LID em vez do número de
// telefone (info.SenderAlt vazio), a resolução LID -> PN roda em goroutine
// com retentativas (resolvePhoneForLID) -- ver comentário lá pro motivo.
//
// onLoggedOut é chamado quando o servidor derruba a sessão em tempo de
// execução (evento *events.LoggedOut, visto na prática como "Got 403:
// primary device was logged out"). Sem tratar esse evento, o bot ficava
// horas tentando mandar mensagem numa sessão morta, falhando em silêncio
// ("websocket not connected" a cada tentativa) sem avisar ninguém --
// onLoggedOut fecha o canal Client.LoggedOut(), que main.go usa pra parar
// os consumidores e chamar Connect de novo, entrando no loop de
// repareamento automático (ver pairWithQRCode).
func handleInboundEvent(ctx context.Context, waClient *whatsmeow.Client, evt interface{}, onInboundMessage func(phone, text string), onLoggedOut func()) {
	var info types.MessageInfo
	var text string
	switch e := evt.(type) {
	case *events.LoggedOut:
		log.Printf("sessão do WhatsApp desconectada pelo servidor (%+v) -- entrando em repareamento automático", e)
		if onLoggedOut != nil {
			onLoggedOut()
		}
		return
	case *events.Message:
		info = e.Info
		text = extractText(e.Message)
		fmt.Printf("Mensagem recebida de %s: %q\n", info.Sender.User, text)
	case *events.UndecryptableMessage:
		info = e.Info
		fmt.Printf("Mensagem recebida de %s (não decifrável, tipo %q -- conta como confirmação mesmo assim)\n", info.Sender.User, e.UnavailableType)
	default:
		return
	}
	if info.IsFromMe || info.IsGroup {
		return
	}

	if onInboundMessage == nil {
		return
	}

	if senderPN := info.SenderAlt.User; senderPN != "" {
		onInboundMessage(denormalizePhone(senderPN), text)
		return
	}
	if waClient == nil {
		return
	}

	sender := info.Sender
	go func() {
		phone, ok := resolvePhoneForLID(ctx, waClient.Store.LIDs, sender)
		if !ok {
			fmt.Printf("não consegui resolver o telefone do LID %s a tempo -- confirmação perdida (peça pra mandar outra mensagem)\n", sender.User)
			return
		}
		onInboundMessage(phone, text)
	}()
}

// resolvePhoneForLID tenta GetPNForLID algumas vezes com espera entre
// tentativas -- o mapeamento LID -> PN às vezes só fica disponível alguns
// segundos depois do evento de mensagem chegar (sincroniza via um evento
// separado do WhatsApp, não junto com a mensagem em si). Sem isso, a
// primeira mensagem de um contato novo podia perder a confirmação pra
// sempre e silenciosamente, já que SenderAlt também vem vazio nesse caso.
func resolvePhoneForLID(ctx context.Context, lids store.LIDStore, sender types.JID) (string, bool) {
	for attempt := 0; attempt < lidResolveAttempts; attempt++ {
		if pnJID, err := lids.GetPNForLID(ctx, sender); err == nil && !pnJID.IsEmpty() {
			return denormalizePhone(pnJID.User), true
		}
		if attempt == lidResolveAttempts-1 {
			break
		}
		select {
		case <-ctx.Done():
			return "", false
		case <-time.After(lidResolveDelay):
		}
	}
	return "", false
}

// SendText manda uma mensagem de texto simples pro número informado.
// Resolve o contato via IsOnWhatsApp antes de mandar -- é essa consulta
// (usync) que popula o cache de LID corretamente; sem ela, o SendMessage
// às vezes falha com "no LID found" mesmo pra número real e ativo, porque
// a resolução embutida nele é mais simples e não é suficiente sozinha.
func (c *Client) SendText(ctx context.Context, phone string, text string) error {
	if !c.pacer.waitTurn(ctx) {
		return ctx.Err()
	}

	normalized := normalizePhone(phone)

	results, err := c.wa.IsOnWhatsApp(ctx, []string{normalized})
	if err != nil {
		return fmt.Errorf("verificar número no whatsapp: %w", err)
	}
	if len(results) == 0 || !results[0].IsIn {
		return fmt.Errorf("número %s não tem WhatsApp ativo", normalized)
	}
	target := results[0].JID

	simulateHumanTyping(ctx, c.wa, target, text)

	message := &waE2E.Message{Conversation: proto.String(text)}
	_, err = c.wa.SendMessage(ctx, target, message)
	return err
}

// simulateHumanTyping marca presença "online" + "digitando..." nessa
// conversa por um instante antes de mandar de verdade -- tenta parecer
// menos "silêncio total, manda instantâneo" (padrão que bate direto com
// bot) e mais uso normal do app (abre, digita, manda). NÃO é garantia
// nenhuma contra bloqueio -- o WhatsApp não documenta o que pesa na
// detecção de automação, isso só reduz o "cheiro de bot". Por isso os
// erros aqui só são logados, nunca interrompem o envio de verdade: a
// mensagem em si importa mais que a encenação em volta dela.
func simulateHumanTyping(ctx context.Context, wa *whatsmeow.Client, target types.JID, text string) {
	if err := wa.SendPresence(ctx, types.PresenceAvailable); err != nil {
		log.Printf("falha ao marcar presença online (não impede o envio): %v", err)
	}
	if err := wa.SendChatPresence(ctx, target, types.ChatPresenceComposing, types.ChatPresenceMediaText); err != nil {
		log.Printf("falha ao marcar 'digitando' (não impede o envio): %v", err)
	}

	select {
	case <-time.After(typingDuration(text)):
	case <-ctx.Done():
	}
}

// typingCharsPerSecond estima a velocidade de digitação num celular (~14
// caracteres/segundo é rápido, mas plausível) só pra variar a duração do
// "digitando..." com o tamanho da mensagem, em vez de uma pausa sempre
// igual (que por si só seria mais um sinal de automação).
const typingCharsPerSecond = 14

const (
	typingDurationMin = 1500 * time.Millisecond
	typingDurationMax = 5 * time.Second
)

// typingDuration limita o resultado entre typingDurationMin e
// typingDurationMax -- mensagem curta digitada em bem menos de 1.5s, ou
// mensagem longa "digitada" por mais de 5s, destoam de uso humano normal
// tanto quanto não simular nada.
func typingDuration(text string) time.Duration {
	d := time.Duration(len(text)) * time.Second / typingCharsPerSecond
	if d < typingDurationMin {
		return typingDurationMin
	}
	if d > typingDurationMax {
		return typingDurationMax
	}
	return d
}

// normalizePhone garante o código de país (55) na frente -- números
// brasileiros com DDD têm 10 ou 11 dígitos (fixo ou celular); com o 55 na
// frente passam a ter 12 ou 13. Números que já vierem com 55 (12+ dígitos
// começando com "55") ficam como estão.
func normalizePhone(phone string) string {
	digits := strings.TrimSpace(phone)
	if len(digits) <= 11 {
		return brazilCountryCode + digits
	}
	return digits
}

// denormalizePhone é o inverso de normalizePhone -- tira o "55" da frente
// pra bater com o formato que User.phone guarda no Django (DDD+número,
// sem código de país).
func denormalizePhone(phone string) string {
	digits := strings.TrimSpace(phone)
	if strings.HasPrefix(digits, brazilCountryCode) && len(digits) > 11 {
		return digits[len(brazilCountryCode):]
	}
	return digits
}

// Close derruba a conexão com o WhatsApp e fecha o pool de conexões com o
// Postgres do sqlstore -- sem fechar o container aqui, cada ciclo de
// repareamento (ver main.go, LoggedOut) abriria um pool novo sem nunca
// liberar o anterior.
func (c *Client) Close() {
	c.wa.Disconnect()
	if c.container != nil {
		_ = c.container.Close()
	}
}