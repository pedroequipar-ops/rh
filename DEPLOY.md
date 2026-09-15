# Deploy — sistema RH

Backend (Django/daphne + worker de e-mail) + frontend (nginx, serve o build e
faz proxy de `/v1/`, `/ws/`, `/docs/` e `/files/` pro backend/MinIO) numa VPS
dedicada, só pra este sistema — Docker Swarm de um nó só, Caddy fazendo TLS
automático (Let's Encrypt).

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
- `MINIO_PUBLIC_ENDPOINT=https://rh.seudominio.com.br/files` — o nginx do
  frontend expõe `/files/` fazendo proxy pro MinIO interno; sem essa
  variável certa, os links de currículo (presigned URL) apontam pro
  hostname interno do Docker e não abrem fora da VPS (ver seção 6).
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
- `FRONTEND_BASE_URL=https://rh.seudominio.com.br` — usado pra montar o link
  "abrir no sistema" nos avisos de WhatsApp (ver seção 8).
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
docker build -t rh-whatsapp-bot:latest ./whatsapp-bot

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
docker build -t rh-whatsapp-bot:latest ./whatsapp-bot
set -a; . ./.env; set +a
docker stack deploy -c docker-stack.yml rh
```

Se só o código mudou e nenhuma variável/config do stack mudou, o Swarm pode
não recriar o serviço com a imagem nova sozinho — force:

```bash
docker service update --force rh_backend
docker service update --force rh_frontend
docker service update --force rh_triagem-ia-worker
docker service update --force rh_whatsapp-confirm-worker
```

Não force `rh_whatsapp-bot` sem necessidade — cada reinício reconecta a
sessão do WhatsApp e, se ela cair, reentra em repareamento por QR code (ver
seção 8). Só force se a imagem do bot mudou de verdade.

## 5. Checklist de primeira publicação

- [ ] `docker swarm init` rodado na VPS
- [ ] `rh.seudominio.com.br` resolvendo pro IP da VPS
- [ ] `.env` preenchido, com `chmod 600 .env` / `chmod 750 .`
- [ ] Redirect URI do Google OAuth atualizado no console
- [ ] Build das três imagens sem erro
- [ ] `docker stack config` mostra as variáveis preenchidas antes de publicar
- [ ] `docker stack deploy` rodado, `docker service ls` mostra tudo `1/1`
- [ ] Certificado emitiu (`curl -I` sem erro de TLS)
- [ ] Login funciona ponta a ponta
- [ ] `MINIO_PUBLIC_ENDPOINT` configurado (seção 6) e upload/download de
      currículo testado de fora da VPS antes de aceitar dados reais
- [ ] WhatsApp pareado por QR code (seção 8) antes de cadastrar telefone de
      responsável de verdade

## 6. MinIO e URLs de currículo

`utils/storage.py` usa dois clients boto3: um com `MINIO_ENDPOINT` (hostname
interno do Docker, `http://minio:9000`) pra `upload_file`/`get_object`/
`head_object` — chamadas feitas pelo próprio backend, dentro da rede da
stack — e outro com `MINIO_PUBLIC_ENDPOINT` só pra
`presigned_url`/`presigned_put_url`, porque esses links são abertos pelo
navegador de quem está fora da VPS.

O nginx do frontend expõe `/files/` fazendo proxy pro serviço `minio`
interno (ver `frontend/nginx.conf` e o alias `rh-minio` no `docker-stack.yml`)
— não precisa de subdomínio nem porta nova publicada. Configure
`MINIO_PUBLIC_ENDPOINT=https://rh.seudominio.com.br/files` no `.env` (seção
3). Se essa variável ficar com o valor default (igual a `MINIO_ENDPOINT`),
os links de currículo não abrem fora da VPS — confira antes de aceitar
upload real.

## 7. Backup

Não existe backup configurado ainda. Antes de aceitar dados reais, criar
rotina de `pg_dump` do Postgres (o bucket do MinIO também precisa de backup
separado — `mc mirror`, por exemplo) e agendar via `crontab` na VPS. Posso
escrever esse script quando você pedir.

## 8. Aviso por WhatsApp (chat + atividade)

Serviço Go `whatsapp-bot` (`whatsmeow`, mesma lib/desenho do bot do
checkmail, sistema separado do Pedro — mas **número novo, sessão
independente**: nenhum dos dois depende do outro). Toda mensagem de chat e
todo evento de atividade (vaga aprovada, candidato mudou de etapa etc.) que
tiver um responsável com telefone confirmado gera um aviso.

### Pareamento (uma vez, ou de novo se a sessão cair)

O bot usa o mesmo Postgres do Django (tabelas `whatsmeow_*`, sem migration
— schema próprio do whatsmeow) pra guardar a sessão pareada. Sem sessão
pareada, ele entra sozinho em loop de QR code:

```bash
docker service logs -f rh_whatsapp-bot
```

Escaneie o QR (WhatsApp > Aparelhos conectados > Conectar um aparelho) com o
número dedicado desse bot — **não** o número pessoal de ninguém, e nem o
mesmo número do bot do checkmail (mesmo sendo tecnicamente possível ter dois
aparelhos conectados numa conta, evita confusão sobre quem mandou o quê).
Depois de parear, o bot fica quieto por 5 minutos antes de começar a mandar
aviso de verdade (carência pós-pareamento, evita rajada logo na sessão nova
— ver comentário em `whatsapp-bot/main.go`). Se a sessão cair depois (número
desconectado no celular, por exemplo), o bot detecta sozinho e volta pro
loop de QR — não precisa reiniciar nada, só acompanhar os logs de novo.

### Confirmação de telefone (obrigatória por número)

Por segurança (evita mandar mensagem não solicitada, risco de a sessão ser
sinalizada como spam), o bot só manda aviso pra telefone que **já mandou
mensagem pra ele antes**. Fluxo pra cada responsável:

1. RH cadastra o telefone da pessoa em **Configurações → Setores** (editar
   usuário → campo WhatsApp).
2. Essa pessoa manda "oi" (ou qualquer texto) pro número do bot pelo
   WhatsApp dela.
3. O bot publica a confirmação numa fila; `rh_whatsapp-confirm-worker`
   drena essa fila a cada 20s e marca `whatsapp_confirmado_em` no usuário.

Sem esse passo 2, o telefone fica cadastrado mas nenhum aviso sai — não é
bug, é a trava de segurança funcionando.
