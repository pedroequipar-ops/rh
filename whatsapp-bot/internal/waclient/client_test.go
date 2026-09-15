package waclient

import (
	"context"
	"strings"
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

func TestNormalizePhone(t *testing.T) {
	cases := []struct {
		name  string
		phone string
		want  string
	}{
		{"DDD + numero sem codigo do pais", "98988255192", "5598988255192"},
		{"fixo sem codigo do pais", "9832221100", "559832221100"},
		{"ja tem codigo do pais", "5598988255192", "5598988255192"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizePhone(tc.phone)
			if got != tc.want {
				t.Errorf("normalizePhone(%q) = %q, want %q", tc.phone, got, tc.want)
			}
		})
	}
}

func TestDenormalizePhone(t *testing.T) {
	cases := []struct {
		name  string
		phone string
		want  string
	}{
		{"com codigo do pais, celular", "5598988255192", "98988255192"},
		{"com codigo do pais, fixo", "559832221100", "9832221100"},
		{"sem codigo do pais (ja veio curto)", "98988255192", "98988255192"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := denormalizePhone(tc.phone)
			if got != tc.want {
				t.Errorf("denormalizePhone(%q) = %q, want %q", tc.phone, got, tc.want)
			}
		})
	}
}

func TestHandleInboundEventIgnoresNonMessageEvents(t *testing.T) {
	called := false
	handleInboundEvent(context.Background(), nil, "not a message event", func(phone, text string) { called = true }, nil)
	if called {
		t.Error("onInboundMessage não deveria ser chamado pra evento que não é mensagem")
	}
}

func TestNextBackoffDoublesUntilMax(t *testing.T) {
	origMin, origMax := pairErrorBackoffMin, pairErrorBackoffMax
	pairErrorBackoffMin, pairErrorBackoffMax = time.Second, 8*time.Second
	t.Cleanup(func() { pairErrorBackoffMin, pairErrorBackoffMax = origMin, origMax })

	cases := []struct {
		in   time.Duration
		want time.Duration
	}{
		{1 * time.Second, 2 * time.Second},
		{2 * time.Second, 4 * time.Second},
		{4 * time.Second, 8 * time.Second},
		{8 * time.Second, 8 * time.Second},  // já no teto, não passa
		{7 * time.Second, 8 * time.Second},  // dobraria pra 14s, mas trava no teto
	}
	for _, tc := range cases {
		if got := nextBackoff(tc.in); got != tc.want {
			t.Errorf("nextBackoff(%s) = %s, esperava %s", tc.in, got, tc.want)
		}
	}
}

func TestTypingDurationStaysWithinBounds(t *testing.T) {
	cases := []struct {
		name string
		text string
	}{
		{"vazio", ""},
		{"curto", "oi"},
		{"medio", "Chegou email importante de fulano@exemplo.com"},
		{"longo", strings.Repeat("mensagem bem longa de verdade ", 20)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := typingDuration(tc.text)
			if got < typingDurationMin || got > typingDurationMax {
				t.Errorf("typingDuration(%d chars) = %s, esperava entre %s e %s", len(tc.text), got, typingDurationMin, typingDurationMax)
			}
		})
	}
}

func TestTypingDurationGrowsWithTextLength(t *testing.T) {
	short := typingDuration("oi")
	long := typingDuration(strings.Repeat("a", 60))

	if long <= short {
		t.Errorf("esperava texto mais longo gerar digitação mais demorada: curto=%s longo=%s", short, long)
	}
}

func TestHandleInboundEventCallsOnLoggedOutForLoggedOutEvent(t *testing.T) {
	inboundCalled := false
	loggedOutCalled := false

	handleInboundEvent(
		context.Background(), nil, &events.LoggedOut{},
		func(phone, text string) { inboundCalled = true },
		func() { loggedOutCalled = true },
	)

	if !loggedOutCalled {
		t.Error("onLoggedOut deveria ser chamado pro evento *events.LoggedOut")
	}
	if inboundCalled {
		t.Error("onInboundMessage não deveria ser chamado pro evento *events.LoggedOut")
	}
}

type fakeLIDStore struct {
	responses []types.JID
	calls     int
}

func (f *fakeLIDStore) PutManyLIDMappings(ctx context.Context, mappings []store.LIDMapping) error {
	return nil
}

func (f *fakeLIDStore) PutLIDMapping(ctx context.Context, lid, jid types.JID) error {
	return nil
}

func (f *fakeLIDStore) GetPNForLID(ctx context.Context, lid types.JID) (types.JID, error) {
	idx := f.calls
	f.calls++
	if idx >= len(f.responses) {
		return types.JID{}, nil
	}
	return f.responses[idx], nil
}

func (f *fakeLIDStore) GetLIDForPN(ctx context.Context, pn types.JID) (types.JID, error) {
	return types.JID{}, nil
}

func (f *fakeLIDStore) GetManyLIDsForPNs(ctx context.Context, pns []types.JID) (map[types.JID]types.JID, error) {
	return nil, nil
}

func withShortLIDRetryDelay(t *testing.T) {
	t.Helper()
	orig := lidResolveDelay
	lidResolveDelay = time.Millisecond
	t.Cleanup(func() { lidResolveDelay = orig })
}

func TestResolvePhoneForLIDSucceedsOnFirstAttempt(t *testing.T) {
	withShortLIDRetryDelay(t)
	lids := &fakeLIDStore{responses: []types.JID{{User: "5598988255192", Server: types.DefaultUserServer}}}

	phone, ok := resolvePhoneForLID(context.Background(), lids, types.JID{User: "123456"})

	if !ok {
		t.Fatal("esperava resolver com sucesso")
	}
	if phone != "98988255192" {
		t.Errorf("telefone = %q, esperava %q", phone, "98988255192")
	}
	if lids.calls != 1 {
		t.Errorf("esperava 1 tentativa, teve %d", lids.calls)
	}
}

func TestResolvePhoneForLIDRetriesUntilResolved(t *testing.T) {
	withShortLIDRetryDelay(t)
	lids := &fakeLIDStore{responses: []types.JID{{}, {}, {User: "5598988255192", Server: types.DefaultUserServer}}}

	phone, ok := resolvePhoneForLID(context.Background(), lids, types.JID{User: "123456"})

	if !ok {
		t.Fatal("esperava resolver com sucesso apos retentativas")
	}
	if phone != "98988255192" {
		t.Errorf("telefone = %q, esperava %q", phone, "98988255192")
	}
	if lids.calls != 3 {
		t.Errorf("esperava 3 tentativas, teve %d", lids.calls)
	}
}

func TestResolvePhoneForLIDGivesUpAfterMaxAttempts(t *testing.T) {
	withShortLIDRetryDelay(t)
	lids := &fakeLIDStore{}

	_, ok := resolvePhoneForLID(context.Background(), lids, types.JID{User: "123456"})

	if ok {
		t.Fatal("nao deveria resolver -- LID nunca respondeu com um PN valido")
	}
	if lids.calls != lidResolveAttempts {
		t.Errorf("esperava %d tentativas, teve %d", lidResolveAttempts, lids.calls)
	}
}

func TestResolvePhoneForLIDStopsOnContextCancel(t *testing.T) {
	lidResolveDelayOrig := lidResolveDelay
	lidResolveDelay = time.Hour
	t.Cleanup(func() { lidResolveDelay = lidResolveDelayOrig })
	lids := &fakeLIDStore{}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, ok := resolvePhoneForLID(ctx, lids, types.JID{User: "123456"})

	if ok {
		t.Fatal("nao deveria resolver com contexto ja cancelado")
	}
	if lids.calls != 1 {
		t.Errorf("esperava parar apos a 1a tentativa com contexto cancelado, teve %d chamadas", lids.calls)
	}
}

func TestHandleInboundEventForwardsPhoneAndText(t *testing.T) {
	var gotPhone, gotText string
	called := false

	evt := &events.Message{
		Info: types.MessageInfo{
			MessageSource: types.MessageSource{
				Sender:    types.JID{User: "123456", Server: types.DefaultUserServer},
				SenderAlt: types.JID{User: "5598988255192", Server: types.DefaultUserServer},
			},
		},
		Message: &waE2E.Message{Conversation: proto.String("contato@exemplo.com")},
	}

	handleInboundEvent(context.Background(), nil, evt, func(phone, text string) {
		called = true
		gotPhone = phone
		gotText = text
	}, nil)

	if !called {
		t.Fatal("esperava que onInboundMessage fosse chamado")
	}
	if gotPhone != "98988255192" {
		t.Errorf("phone = %q, esperava %q", gotPhone, "98988255192")
	}
	if gotText != "contato@exemplo.com" {
		t.Errorf("text = %q, esperava %q", gotText, "contato@exemplo.com")
	}
}

// withFixedGlobalSendDelay iguala min e max pra randomSendDelay() virar um
// valor fixo e previsível nos testes (ver randomSendDelay: span <= 0 pula o
// sorteio e devolve o mínimo direto).
func withFixedGlobalSendDelay(t *testing.T, d time.Duration) {
	t.Helper()
	origMin, origMax := globalSendDelayMin, globalSendDelayMax
	globalSendDelayMin, globalSendDelayMax = d, d
	t.Cleanup(func() { globalSendDelayMin, globalSendDelayMax = origMin, origMax })
}

func TestSendPacerDelaysSecondCallEvenForDifferentRecipient(t *testing.T) {
	withFixedGlobalSendDelay(t, 50*time.Millisecond)
	pacer := newSendPacer()

	if !pacer.waitTurn(context.Background()) {
		t.Fatal("primeira chamada nao deveria falhar")
	}
	start := time.Now()
	if !pacer.waitTurn(context.Background()) {
		t.Fatal("segunda chamada nao deveria falhar")
	}
	elapsed := time.Since(start)

	if elapsed < globalSendDelayMin {
		t.Fatalf("segunda chamada deveria esperar pelo menos %s, esperou %s", globalSendDelayMin, elapsed)
	}
}

func TestRandomSendDelayStaysWithinBounds(t *testing.T) {
	origMin, origMax := globalSendDelayMin, globalSendDelayMax
	globalSendDelayMin, globalSendDelayMax = 4*time.Second, 8*time.Second
	t.Cleanup(func() { globalSendDelayMin, globalSendDelayMax = origMin, origMax })

	for i := 0; i < 50; i++ {
		got := randomSendDelay()
		if got < globalSendDelayMin || got >= globalSendDelayMax {
			t.Fatalf("randomSendDelay() = %s, esperava estar em [%s, %s)", got, globalSendDelayMin, globalSendDelayMax)
		}
	}
}

func TestSendPacerStopsOnContextCancel(t *testing.T) {
	withFixedGlobalSendDelay(t, time.Hour)
	pacer := newSendPacer()
	pacer.waitTurn(context.Background())

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if pacer.waitTurn(ctx) {
		t.Fatal("nao deveria conseguir a vez com contexto ja cancelado")
	}
}

func TestHandleInboundEventIgnoresGroupMessages(t *testing.T) {
	called := false
	evt := &events.Message{
		Info: types.MessageInfo{
			MessageSource: types.MessageSource{
				Sender:    types.JID{User: "123456", Server: types.DefaultUserServer},
				SenderAlt: types.JID{User: "5598988255192", Server: types.DefaultUserServer},
				IsGroup:   true,
			},
		},
		Message: &waE2E.Message{Conversation: proto.String("contato@exemplo.com")},
	}

	handleInboundEvent(context.Background(), nil, evt, func(phone, text string) { called = true }, nil)

	if called {
		t.Error("onInboundMessage não deveria ser chamado pra mensagem de grupo")
	}
}
