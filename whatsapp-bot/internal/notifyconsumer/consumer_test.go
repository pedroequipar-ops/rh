package notifyconsumer

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

type fakeSender struct {
	mu       sync.Mutex
	attempts map[string]int
	failN    map[string]int // número de falhas antes de suceder, por telefone
}

func newFakeSender(failN map[string]int) *fakeSender {
	return &fakeSender{attempts: map[string]int{}, failN: failN}
}

func (f *fakeSender) SendText(_ context.Context, phone, _ string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.attempts[phone]++
	if f.attempts[phone] <= f.failN[phone] {
		return errors.New("server returned error 463")
	}
	return nil
}

func withShortDelays(t *testing.T) {
	t.Helper()
	origInter, origRetry := interRecipientDelay, sendRetryDelay
	interRecipientDelay = time.Millisecond
	sendRetryDelay = time.Millisecond
	t.Cleanup(func() {
		interRecipientDelay = origInter
		sendRetryDelay = origRetry
	})
}

func TestSendToRecipientsRetriesOnceAfterFailure(t *testing.T) {
	withShortDelays(t)
	sender := newFakeSender(map[string]int{"11999990000": 1})

	sendToRecipients(context.Background(), sender, "oi", []string{"11999990000"}, "pe-1", newRecipientThrottle())

	if sender.attempts["11999990000"] != 2 {
		t.Fatalf("esperava 2 tentativas, teve %d", sender.attempts["11999990000"])
	}
}

func TestSendToRecipientsGivesUpAfterMaxAttempts(t *testing.T) {
	withShortDelays(t)
	sender := newFakeSender(map[string]int{"11999990000": 99})

	sendToRecipients(context.Background(), sender, "oi", []string{"11999990000"}, "pe-1", newRecipientThrottle())

	if sender.attempts["11999990000"] != maxSendAttempts {
		t.Fatalf("esperava %d tentativas, teve %d", maxSendAttempts, sender.attempts["11999990000"])
	}
}

func TestSendToRecipientsContinuesAfterOneRecipientFails(t *testing.T) {
	withShortDelays(t)
	sender := newFakeSender(map[string]int{"11999990000": 99, "11988880000": 0})

	sendToRecipients(context.Background(), sender, "oi", []string{"11999990000", "11988880000"}, "pe-1", newRecipientThrottle())

	if sender.attempts["11988880000"] != 1 {
		t.Fatalf("segundo destinatário deveria ter recebido normalmente, teve %d tentativas", sender.attempts["11988880000"])
	}
}

func TestSendToRecipientsStopsOnContextCancel(t *testing.T) {
	withShortDelays(t)
	interRecipientDelay = time.Hour // garante que o cancelamento vence a espera
	sender := newFakeSender(map[string]int{})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	sendToRecipients(ctx, sender, "oi", []string{"11999990000", "11988880000"}, "pe-1", newRecipientThrottle())

	if sender.attempts["11988880000"] != 0 {
		t.Fatalf("não deveria ter tentado o segundo destinatário após cancelamento do contexto")
	}
}

func TestRecipientThrottleDelaysSecondMessageToSamePhone(t *testing.T) {
	withShortDelays(t)
	interRecipientDelay = 50 * time.Millisecond
	sender := newFakeSender(map[string]int{})
	throttle := newRecipientThrottle()

	// Dois avisos (emails) diferentes, mesmo destinatário -- simula duas
	// chamadas a handleDelivery em sequência, como aconteceria com dois
	// emails chegando quase juntos pro mesmo setor.
	sendToRecipients(context.Background(), sender, "oi 1", []string{"11999990000"}, "pe-1", throttle)
	start := time.Now()
	sendToRecipients(context.Background(), sender, "oi 2", []string{"11999990000"}, "pe-2", throttle)
	elapsed := time.Since(start)

	if elapsed < interRecipientDelay {
		t.Fatalf("segundo aviso pro mesmo telefone deveria esperar pelo menos %s, esperou %s", interRecipientDelay, elapsed)
	}
}

func TestRecipientThrottleDoesNotDelayDifferentPhones(t *testing.T) {
	withShortDelays(t)
	interRecipientDelay = time.Hour
	sender := newFakeSender(map[string]int{})
	throttle := newRecipientThrottle()

	sendToRecipients(context.Background(), sender, "oi 1", []string{"11999990000"}, "pe-1", throttle)
	start := time.Now()
	sendToRecipients(context.Background(), sender, "oi 2", []string{"11988880000"}, "pe-2", throttle)
	elapsed := time.Since(start)

	if elapsed >= interRecipientDelay {
		t.Fatalf("telefone diferente não deveria esperar o throttle do outro, esperou %s", elapsed)
	}
}

func TestStalenessEmptyCreatedAtIsNeverStale(t *testing.T) {
	if _, stale := staleness(""); stale {
		t.Fatal("payload sem created_at (formato antigo) não deveria ser descartado")
	}
}

func TestStalenessInvalidCreatedAtIsNeverStale(t *testing.T) {
	if _, stale := staleness("não é uma data"); stale {
		t.Fatal("created_at que não dá pra interpretar não deveria ser descartado")
	}
}

func TestStalenessRecentIsNotStale(t *testing.T) {
	recent := time.Now().Add(-1 * time.Minute).Format(time.RFC3339Nano)
	if _, stale := staleness(recent); stale {
		t.Fatal("email de 1 minuto atrás não deveria ser considerado velho")
	}
}

func TestStalenessOlderThanMaxAgeIsStale(t *testing.T) {
	old := time.Now().Add(-maxNotifyAge - time.Minute).Format(time.RFC3339Nano)
	age, stale := staleness(old)
	if !stale {
		t.Fatal("email mais velho que maxNotifyAge deveria ser descartado")
	}
	if age < maxNotifyAge {
		t.Fatalf("idade calculada (%s) deveria ser >= maxNotifyAge (%s)", age, maxNotifyAge)
	}
}