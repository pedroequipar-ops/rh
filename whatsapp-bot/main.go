// Comando whatsapp-bot: ponte entre o RabbitMQ (onde o Django publica avisos
// de chat/atividade) e o WhatsApp (via whatsmeow). Manda aviso pro
// responsável já confirmado, e publica de volta pro Django quando um número
// novo manda mensagem pela primeira vez (confirmação do telefone).
package main

import (
	"context"
	"database/sql"
	"log"
	"os/signal"
	"syscall"
	"time"

	"github.com/DesenvolvimentoEquipar/rh/whatsapp-bot/internal/config"
	"github.com/DesenvolvimentoEquipar/rh/whatsapp-bot/internal/confirmpublisher"
	"github.com/DesenvolvimentoEquipar/rh/whatsapp-bot/internal/notifyconsumer"
	"github.com/DesenvolvimentoEquipar/rh/whatsapp-bot/internal/pairingstate"
	"github.com/DesenvolvimentoEquipar/rh/whatsapp-bot/internal/waclient"
)

// pairingWarmup é quanto tempo o bot espera depois de um repareamento novo
// (primeira vez, ou depois de um bloqueio/logout — ver waclient.Connect)
// antes de começar a consumir a fila de avisos e mandar mensagem de
// verdade. Sessão recém-pareada mandando rajada na hora é exatamente o
// padrão que derruba a sessão (bloqueio + logout) — essa carência dá tempo
// da conexão se estabilizar antes de qualquer envio.
//
// O instante do pareamento é persistido (ver pairingstate) porque o fluxo
// normal de operação reinicia o processo logo depois de parear — sem
// persistir, esse processo novo nunca saberia que acabou de parear e
// puraria a carência.
const pairingWarmup = 5 * time.Minute

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()

	onInboundMessage := func(phone, text string) {
		if err := confirmpublisher.Publish(ctx, cfg.RabbitMQURL, cfg.ConfirmQueue, phone, text); err != nil {
			log.Printf("falha ao publicar confirmação de %s: %v", phone, err)
		}
	}

	// Loop externo: cada volta é um ciclo "conectar (ou reparear) + consumir
	// fila até a sessão cair". Quando o WhatsApp derruba a sessão em tempo de
	// execução, runConsumer retorna loggedOut=true em vez do processo
	// morrer — volta pro topo do loop, que chama Connect de novo e entra
	// sozinho no repareamento automático por QR code. Não precisa reiniciar
	// o container na mão: só acompanhar `docker service logs -f rh_whatsapp-bot`
	// e escanear o QR de novo quando o número for reativado no celular.
	for ctx.Err() == nil {
		client, freshPairing, err := waclient.Connect(ctx, cfg.PostgresDSN, onInboundMessage)
		if err != nil {
			log.Fatalf("falha ao conectar no whatsapp: %v", err)
		}

		if err := waitOutPairingWarmup(ctx, cfg.PostgresDSN, freshPairing); err != nil {
			log.Fatalf("falha ao verificar carência de pareamento: %v", err)
		}

		loggedOut := runConsumer(ctx, cfg, client)
		client.Close()

		if loggedOut && ctx.Err() == nil {
			log.Printf("sessão caiu — reconectando e repareando automaticamente")
		}
	}
}

// runConsumer sobe o consumidor de avisos e bloqueia até o contexto raiz ser
// cancelado, ele encerrar com erro, ou a sessão do WhatsApp cair em tempo de
// execução (client.LoggedOut(), retorna loggedOut=true pro chamador tentar
// reparear em vez de matar o processo).
func runConsumer(ctx context.Context, cfg config.Config, client *waclient.Client) (loggedOut bool) {
	cycleCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	errCh := make(chan error, 1)
	go func() { errCh <- notifyconsumer.Run(cycleCtx, cfg.RabbitMQURL, cfg.NotifyQueue, client) }()

	select {
	case <-ctx.Done():
	case <-client.LoggedOut():
		loggedOut = true
	case err := <-errCh:
		if err != nil {
			log.Fatalf("consumidor encerrou com erro: %v", err)
		}
	}

	cancel()
	<-errCh
	return loggedOut
}

// waitOutPairingWarmup bloqueia até a carência pós-pareamento acabar, se
// ainda estiver dentro dela. freshPairing indica que o QR foi escaneado
// agora mesmo nesse processo — nesse caso grava o instante antes de tudo.
func waitOutPairingWarmup(ctx context.Context, postgresDSN string, freshPairing bool) error {
	db, err := sql.Open("pgx", postgresDSN)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := pairingstate.EnsureTable(ctx, db); err != nil {
		return err
	}

	if freshPairing {
		if err := pairingstate.RecordNow(ctx, db); err != nil {
			return err
		}
	}

	age, found, err := pairingstate.TimeSince(ctx, db)
	if err != nil {
		return err
	}
	if !found || age >= pairingWarmup {
		return nil
	}

	remaining := pairingWarmup - age
	log.Printf("pareamento recente (%s atrás) — aguardando mais %s antes de começar a mandar avisos", age.Round(time.Second), remaining.Round(time.Second))
	select {
	case <-ctx.Done():
	case <-time.After(remaining):
		log.Printf("carência concluída — começando a consumir a fila de avisos")
	}
	return nil
}
