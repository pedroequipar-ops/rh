package notifyconsumer

import "testing"

func TestFormatMessage(t *testing.T) {
	cases := []struct {
		name    string
		payload NotifyPayload
		want    string
	}{
		{
			name: "setor, remetente, destinatario, titulo, resumo e link",
			payload: NotifyPayload{
				Sector:    "Financeiro",
				Sender:    "cliente@example.com",
				Recipient: "cobranca@empresa.com.br",
				Title:     "Fatura em aberto",
				Summary:   "Cliente tem fatura vencida ha 5 dias.",
				Link:      "https://mail.example.com/msg-1",
			},
			want: "📬 Setor:   FINANCEIRO\n👤 De: cliente@example.com\n📥 Para: cobranca@empresa.com.br\n\n*Fatura em aberto*\n\nCliente tem fatura vencida ha 5 dias.\n\nAbrir email: https://mail.example.com/msg-1",
		},
		{
			name: "sem setor nem remetente",
			payload: NotifyPayload{
				Title: "Fatura em aberto",
				Link:  "https://mail.example.com/msg-1",
			},
			want: "*Fatura em aberto*\n\nAbrir email: https://mail.example.com/msg-1",
		},
		{
			name: "sem resumo",
			payload: NotifyPayload{
				Sector: "Financeiro",
				Title:  "Fatura em aberto",
				Link:   "https://mail.example.com/msg-1",
			},
			want: "📬 Setor:   FINANCEIRO\n\n*Fatura em aberto*\n\nAbrir email: https://mail.example.com/msg-1",
		},
		{
			name: "sem link nem destinatario",
			payload: NotifyPayload{
				Sender:  "cliente@example.com",
				Title:   "Fatura em aberto",
				Summary: "Cliente tem fatura vencida.",
			},
			want: "👤 De: cliente@example.com\n\n*Fatura em aberto*\n\nCliente tem fatura vencida.",
		},
		{
			name:    "titulo vazio cai no fallback",
			payload: NotifyPayload{Summary: "so resumo"},
			want:    "*(sem título)*\n\nso resumo",
		},
		{
			name: "setor em minusculo vira maiusculo",
			payload: NotifyPayload{
				Sector: "todos os setores",
				Title:  "Aviso geral",
			},
			want: "📬 Setor:   TODOS OS SETORES\n\n*Aviso geral*",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := FormatMessage(tc.payload)
			if got != tc.want {
				t.Errorf("FormatMessage() = %q, want %q", got, tc.want)
			}
		})
	}
}