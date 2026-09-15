// Package pairingstate guarda, no Postgres, o instante do último pareamento
// por QR code — o whatsmeow não expõe isso (whatsmeow_device não tem coluna
// de data). Sem isso, a carência pós-pareamento em main.go só valeria
// dentro do mesmo processo: como o fluxo normal de operação é parear
// interativo (docker compose up) e depois subir em background (docker
// compose up -d), o processo que realmente consome a fila de avisos é
// sempre um processo novo, que nunca "viu" o pareamento acontecer — sem
// persistir o instante, a carência seria pulada em todo restart.
package pairingstate

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// EnsureTable cria a tabela se não existir — sem migration framework aqui
// (o próprio whatsmeow também gerencia o schema dele assim, via sqlstore).
func EnsureTable(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS whatsapp_bot_pairing_state (
			id SMALLINT PRIMARY KEY DEFAULT 1,
			paired_at TIMESTAMPTZ NOT NULL,
			CHECK (id = 1)
		)
	`)
	if err != nil {
		return fmt.Errorf("criar tabela whatsapp_bot_pairing_state: %w", err)
	}
	return nil
}

// RecordNow grava o instante atual como o do pareamento mais recente —
// linha única (id fixo em 1), sempre sobrescrita.
func RecordNow(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO whatsapp_bot_pairing_state (id, paired_at) VALUES (1, now())
		ON CONFLICT (id) DO UPDATE SET paired_at = EXCLUDED.paired_at
	`)
	if err != nil {
		return fmt.Errorf("gravar instante de pareamento: %w", err)
	}
	return nil
}

// TimeSince retorna há quanto tempo foi o último pareamento registrado.
// found=false quando não há registro nenhum ainda (deploy anterior a essa
// tabela existir, ou nunca pareou por QR nesse banco) — nesse caso quem
// chama deve tratar como "não recente" (sem carência), já que não há como
// saber se a sessão é antiga e estável.
func TimeSince(ctx context.Context, db *sql.DB) (age time.Duration, found bool, err error) {
	var pairedAt time.Time
	err = db.QueryRowContext(ctx, `SELECT paired_at FROM whatsapp_bot_pairing_state WHERE id = 1`).Scan(&pairedAt)
	if err == sql.ErrNoRows {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, fmt.Errorf("ler instante de pareamento: %w", err)
	}
	return time.Since(pairedAt), true, nil
}
