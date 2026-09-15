# Deploy — sistema RH

Backend (Django/daphne + worker de e-mail) + frontend (nginx, serve o build e
faz proxy de `/v1/`, `/ws/` e `/docs/` pro backend) numa VPS dedicada, só pra
este sistema — Docker Swarm de um nó só, Caddy fazendo TLS automático
(Let's Encrypt).

Pendência conhecida antes de ir pra produção com dados reais: ver seção 6
(MinIO e URLs de currículo).

## 1. Preparar a VPS

Numa VPS nova (Ubuntu/Debian), com Docker instalado:

```bash
docker swarm init
```

Isso liga o modo swarm nesse único nó — não precisa de mais nenhum nó pra
`docker stack deploy` funcionar (`replicas`, `restart_policy`, `configs` etc.
já funcionam num swarm de 1 nó).

## 2. Domínio

Crie um registro DNS tipo **A** apontando pro IP público da VPS (ex.:
`rh.seudominio.com.br` → IP da VPS) antes do primeiro deploy — o Caddy só
emite certificado se o domínio já resolver pro IP certo. Confirme com
`dig +short rh.seudominio.com.br` antes de seguir.

## 3. `.env` de produção

Copie `.env.example` pra `.env` no diretório do repositório clonado na VPS
(nunca commitado) e preencha:

- `DJANGO_SECRET_KEY` — gerar novo, só pra produção
  (`python -c "import secrets; print(secrets.token_urlsafe(50))"`).
- `DJANGO_ALLOWED_HOSTS=rh.seudominio.com.br`
- `POSTGRES_PASSWORD` — senha forte, diferente da de dev.
- `RABBITMQ_USER` / `RABBITMQ_PASSWORD` — não usar `guest`/`guest` (a imagem
  oficial do RabbitMQ não restringe o `guest` a localhost).
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` — trocar os defaults
  (`minioadmin`/`minioadmin`).
- `TRIAGEM_IA_ENCRYPTION_KEY` — gerar uma nova só pra produção (comando
  comentado no `.env.example`); nunca reaproveitar a de dev, ela
  descriptografa os tokens OAuth salvos no banco.
- `GOOGLE_OAUTH_REDIRECT_URI=https://rh.seudominio.com.br/v1/triagem-ia-google/callback/`
  — precisa estar cadastrada de novo no Google Cloud Console (tela de
  credenciais OAuth), senão o "Conectar com Google" falha com redirect_uri
  não autorizado.
- `TRIAGEM_IA_FRONTEND_URL=https://rh.seudominio.com.br/config/triagem-ia`
- `TRIAGEM_IA_WEBHOOK_TOKEN` / `TRIAGEM_IA_WEBHOOK_COMPANY_ID` — só se for
  usar o webhook do checkmail em produção (ver `checkmail-integracao` nas
  notas do projeto); em branco, o endpoint responde 503 em vez de aceitar
  sem autenticação.
- `GROQ_API_KEY` — já deve ter da IA de triagem/busca.
- Adicione ao `.env` (não está em `.env.example` porque só é usada por este
  arquivo, não pelo Django): `RH_DOMAIN=rh.seudominio.com.br`.

Esse arquivo tem `DJANGO_SECRET_KEY`, senhas e chaves de API em texto puro:

```bash
chmod 600 .env
chmod 750 .   # a pasta do projeto clonado, não só o arquivo
```

## 4. Build e deploy

```bash
git clone <url-do-repo> rh && cd rh
# (ou: cd rh && git pull, em deploys seguintes)

docker build -t rh-backend:latest --build-arg REQUIREMENTS_FILE=requirements/production.txt .
docker build -t rh-frontend:latest ./frontend

docker stack ls   # confirme que "rh" não existe ainda

set -a; . ./.env; set +a
```

Dry-run antes de publicar de verdade (a saída traz segredo em texto puro —
só olha na tela e fecha, não cola em lugar nenhum):

```bash
docker stack config -c docker-stack.yml | head -40
```

Se as variáveis aparecerem preenchidas (não `""`), está certo. Publicar:

```bash
docker stack deploy -c docker-stack.yml rh
```

Migração de banco e `collectstatic` rodam sozinhos (`docker/entrypoint-web.sh`,
chamado pelo serviço `backend`) toda vez que o container sobe.

### Verificar

```bash
docker service ls | grep rh
docker service ps rh_backend --no-trunc
docker service logs -f rh_backend
```

Depois que o certificado emitir (segundos a minutos):

```bash
curl -I https://rh.seudominio.com.br/docs/
```

### Deploys seguintes

```bash
git pull
docker build -t rh-backend:latest --build-arg REQUIREMENTS_FILE=requirements/production.txt .
docker build -t rh-frontend:latest ./frontend
set -a; . ./.env; set +a
docker stack deploy -c docker-stack.yml rh
```

Se só o código mudou e nenhuma variável/config do stack mudou, o Swarm pode
não recriar o serviço com a imagem nova sozinho — force:

```bash
docker service update --force rh_backend
docker service update --force rh_frontend
docker service update --force rh_triagem-ia-worker
```

## 5. Checklist de primeira publicação

- [ ] `docker swarm init` rodado na VPS
- [ ] `rh.seudominio.com.br` resolvendo pro IP da VPS
- [ ] `.env` preenchido, com `chmod 600 .env` / `chmod 750 .`
- [ ] Redirect URI do Google OAuth atualizado no console
- [ ] Build das duas imagens sem erro
- [ ] `docker stack config` mostra as variáveis preenchidas antes de publicar
- [ ] `docker stack deploy` rodado, `docker service ls` mostra tudo `1/1`
- [ ] Certificado emitiu (`curl -I` sem erro de TLS)
- [ ] Login funciona ponta a ponta
- [ ] Ver seção 6 (MinIO) antes de aceitar upload de currículo real

## 6. Pendência: MinIO e URLs de currículo (resolver antes de dados reais)

O serviço `minio` nesta stack fica só na rede interna (`internal`), sem porta
publicada. Isso é um problema: `utils/storage.py` usa **o mesmo endpoint**
(`MINIO_ENDPOINT`) tanto pra fazer upload quanto pra gerar as URLs
pré-assinadas de download/upload direto do navegador
(`presigned_url`/`presigned_put_url`). Se `MINIO_ENDPOINT` apontar pro
hostname interno do Docker (`http://minio:9000`), o link gerado não abre no
navegador de quem está fora da VPS — só funciona dentro da rede da stack.

Existe até um `MINIO_PUBLIC_ENDPOINT` já definido em
`config/settings/base.py`, mas **não é usado em nenhum lugar do código
ainda** — foi previsto e nunca ligado.

Duas formas de resolver, nenhuma delas eu apliquei sozinho porque mexe em
código de app, não só em deploy:

1. **Expor o MinIO publicamente** (ex.: subdomínio `files.seudominio.com.br`
   roteado pelo Caddy até `minio:9000`) e apontar `MINIO_ENDPOINT` pra essa
   URL pública — simples, mas todo tráfego de upload/download passa pela
   internet mesmo quando é o próprio backend fazendo upload.
2. **Corrigir em código**: `MinioStorage` passa a usar dois boto3 clients —
   um com `MINIO_ENDPOINT` (interno, rápido) pra `upload_file`/`get_object`/
   `head_object`, e outro com `MINIO_PUBLIC_ENDPOINT` só pra
   `presigned_url`/`presigned_put_url`. É a solução limpa, mas é mudança de
   código — Pedro decide quando entra na fila.

Até isso ser decidido, **não** aceite currículo real em produção — os links
de download não vão abrir fora da VPS.

## 7. Backup

Não existe backup configurado ainda. Antes de aceitar dados reais, criar
rotina de `pg_dump` do Postgres (o bucket do MinIO também precisa de backup
separado — `mc mirror`, por exemplo) e agendar via `crontab` na VPS. Posso
escrever esse script quando você pedir.
