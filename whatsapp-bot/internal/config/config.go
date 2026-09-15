// Package config carrega a configuração do serviço a partir de variáveis de
// ambiente — sem framework, no mesmo espírito de os.environ.get() usado no
// lado Django deste sistema.
package config

import "os"

type Config struct {
	// PostgresDSN é o mesmo Postgres que o Django já usa — o whatsmeow cria
	// suas próprias tabelas (prefixo whatsmeow_) nesse banco, sem colidir
	// com as tabelas do Django.
	PostgresDSN string
	// RabbitMQURL segue o mesmo formato de settings.RABBITMQ_URL no Django.
	RabbitMQURL string
	// NotifyQueue é o nome da fila que utils/whatsapp.py::notificar_whatsapp
	// publica — precisa bater com QUEUE_WHATSAPP_NOTIFY no lado Django.
	NotifyQueue string
	// ConfirmQueue é a fila que ESTE serviço publica quando recebe a
	// primeira mensagem de um número novo — precisa bater com
	// QUEUE_WHATSAPP_CONFIRM no lado Django (consumida por
	// consumir_confirmacoes_whatsapp).
	ConfirmQueue string
}

func Load() Config {
	return Config{
		PostgresDSN:  getenv("WHATSAPP_POSTGRES_DSN", "postgres://rh:rh@postgres:5432/rh?sslmode=disable"),
		RabbitMQURL:  getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/%2F"),
		NotifyQueue:  getenv("WHATSAPP_NOTIFY_QUEUE", "rh.whatsapp_notify"),
		ConfirmQueue: getenv("WHATSAPP_CONFIRM_QUEUE", "rh.whatsapp_confirm"),
	}
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
