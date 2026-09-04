# RH — Kanban de Vagas

Sistema interno de recrutamento: kanban de vagas por etapa do processo seletivo, cadastro de candidatos com extração automática de currículo por IA, e chat em tempo real entre o setor solicitante e o RH.

Arquitetura segue [`PADRAO_ARQUITETURA.md`](./PADRAO_ARQUITETURA.md). Plano de implementação original em `.claude/plans/` (histórico da sessão que gerou o projeto).

## Stack

- **Backend**: Django 5 + DRF, Channels (WebSocket), PostgreSQL, Redis, RabbitMQ, MinIO, JWT (simplejwt)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS, `@dnd-kit` para o kanban
- **IA**: extração de currículo via Groq (`openai/gpt-oss-120b`), atrás da interface `ICurriculoExtractor` — trocável por env var

## Rodando localmente

```bash
docker compose up -d postgres redis rabbitmq minio minio-init
cp .env.example .env   # ajuste GROQ_API_KEY se quiser testar a extração de currículo de verdade

python -m venv .venv
.venv/Scripts/pip install -r requirements/development.txt   # (.venv/bin/pip no Linux/Mac)

python manage.py migrate
python manage.py seed_etapas
python manage.py seed_demo_data

python manage.py runserver   # backend em http://localhost:8000 (Daphne/ASGI)
```

Em outro terminal:

```bash
cd frontend
npm install
npm run dev   # frontend em http://localhost:5173
```

Ou tudo via Docker (inclusive frontend):

```bash
docker compose up -d
```

## Usuários de demonstração (`seed_demo_data`)

| Usuário     | Senha          | Papel   | Setor       |
|-------------|----------------|---------|-------------|
| `rh`        | `rh12345`      | RH      | —           |
| `financeiro`| `financeiro123`| SETOR   | Financeiro  |
| `comercial` | `comercial123` | SETOR   | Comercial   |

## URLs úteis

- Frontend: http://localhost:5173
- API docs (RapiDoc): http://localhost:8000/docs/
- MinIO console: http://localhost:9001 (`minioadmin` / `minioadmin`)
- RabbitMQ management: http://localhost:15672 (`guest` / `guest`)

## Testes

```bash
python -m pytest
black . && flake8 && isort .
```

```bash
cd frontend
npx tsc --noEmit
npm run build
```
