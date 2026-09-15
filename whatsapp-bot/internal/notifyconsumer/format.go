package notifyconsumer

import "strings"

// NotifyPayload é o formato exato publicado por
// apps/emails/services.py::notify_whatsapp na fila RabbitMQ. Os dois lados
// (Python/Go) precisam concordar nesse shape.
type NotifyPayload struct {
	ProcessedEmailID string   `json:"processed_email_id"`
	Sector           string   `json:"sector"`
	Sender           string   `json:"sender"`
	Recipient        string   `json:"recipient"`
	Title            string   `json:"title"`
	Summary          string   `json:"summary"`
	Link             string   `json:"link"`
	Recipients       []string `json:"recipients"`
	CreatedAt        string   `json:"created_at"`
}

// FormatMessage monta o texto enviado no WhatsApp: setor, remetente e pra
// qual das caixas monitoradas o email chegou (contexto útil quando a
// empresa monitora mais de uma conta), título em negrito, resumo e o link
// pra abrir o email (marcar como spam/mover pra lixeira ficam como botões
// dentro dessa página, não na mensagem — fica só 1 link, não 3).
func FormatMessage(payload NotifyPayload) string {
	var b strings.Builder

	if sector := strings.TrimSpace(payload.Sector); sector != "" {
		b.WriteString("📬 Setor:   ")
		b.WriteString(strings.ToUpper(sector))
		b.WriteString("\n")
	}

	if sender := strings.TrimSpace(payload.Sender); sender != "" {
		b.WriteString("👤 De: ")
		b.WriteString(sender)
		b.WriteString("\n")
	}

	if recipient := strings.TrimSpace(payload.Recipient); recipient != "" {
		b.WriteString("📥 Para: ")
		b.WriteString(recipient)
		b.WriteString("\n")
	}

	if b.Len() > 0 {
		b.WriteString("\n")
	}

	title := strings.TrimSpace(payload.Title)
	if title == "" {
		title = "(sem título)"
	}
	b.WriteString("*")
	b.WriteString(title)
	b.WriteString("*")
	b.WriteString("\n\n")

	summary := strings.TrimSpace(payload.Summary)
	if summary != "" {
		b.WriteString(summary)
		b.WriteString("\n\n")
	}

	link := strings.TrimSpace(payload.Link)
	if link != "" {
		b.WriteString("Abrir email: ")
		b.WriteString(link)
	}

	return strings.TrimRight(b.String(), "\n")
}