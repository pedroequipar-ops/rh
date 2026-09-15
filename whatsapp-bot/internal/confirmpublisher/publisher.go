// Package confirmpublisher publica na fila que apps/users avisa quando um
// número manda a primeira mensagem pro bot — é o sinal que libera esse
// telefone pra receber avisos futuros (ver
// apps/emails/services.py::notify_whatsapp e User.whatsapp_confirmed_at).
package confirmpublisher

import (
	"context"
	"encoding/json"
	"fmt"

	amqp "github.com/rabbitmq/amqp091-go"
)

type confirmPayload struct {
	Text  string `json:"text"`
	Phone string `json:"phone"`
}

// Publish abre uma conexão curta, manda o payload e fecha — mesmo padrão do
// QueueEngine.publish no lado Django (não vale manter uma conexão viva só
// pra confirmações esporádicas de número).
func Publish(ctx context.Context, rabbitURL, queueName, phone, text string) error {
	body, err := json.Marshal(confirmPayload{Phone: phone, Text: text})
	if err != nil {
		return fmt.Errorf("serializar payload: %w", err)
	}

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

	if _, err := ch.QueueDeclare(queueName, true, false, false, false, nil); err != nil {
		return fmt.Errorf("declarar fila: %w", err)
	}

	return ch.PublishWithContext(ctx, "", queueName, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	})
}
