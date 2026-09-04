# Padrão de Arquitetura — Novos Microserviços

> Este documento define as decisões arquiteturais obrigatórias para qualquer novo microserviço criado no ecossistema. Independente do domínio de negócio, todo novo serviço segue este padrão.

---

## 1. Stack obrigatório

| Camada | Tecnologia | Por quê |
|---|---|---|
| Framework | Django 5 + Django REST Framework | Padrão do ecossistema; ORM maduro, RBAC plugável |
| Runtime | Python 3.12 | Padrão do ecossistema |
| Servidor | ASGI via Daphne (prod) / `runserver` (dev) | Suporte a WebSocket e HTTP/2 |
| Banco | PostgreSQL | Único banco relacional aprovado |
| Cache | Redis via `django-redis` | Sessões e cache de permissões |
| Filas | RabbitMQ via `pika` | Comunicação assíncrona entre serviços |
| Storage | MinIO (S3-compatible) | Storage interno; nunca expor bucket público |
| Auth | JWT via `djangorestframework-simplejwt` | `access` 5h · `refresh` 1d |
| Docs | `drf-spectacular` (RapiDoc em `/docs/`) | Documentação automática OpenAPI |
| Testes | `pytest` + `pytest-django` + `factory-boy` | Sem `unittest` direto |
| Lint | `black` + `flake8` + `isort` | Rodar no pre-commit e CI |

**Nenhuma dessas escolhas é negociável por projeto.** Variações tecnológicas criam custo de manutenção e impedem reuso de código entre serviços.

---

## 2. Estrutura de diretórios

```
nome-do-servico/
├── config/                   # Configuração Django
│   ├── settings/
│   │   ├── base.py           # Configurações compartilhadas
│   │   ├── development.py    # Overrides para dev
│   │   └── production.py    # Overrides para prod
│   ├── urls.py
│   └── asgi.py
│
├── apps/                     # Aplicações de domínio
│   ├── core/                 # NUNCA modificar — base do ecossistema
│   │   ├── models.py         # TimeStampedModel
│   │   ├── managers.py       # ActiveObjects, AllObjects
│   │   ├── pagination.py     # StandardPagination
│   │   └── permissions.py    # HasFunctionPermission
│   └── <dominio>/            # Um diretório por domínio de negócio
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── urls.py
│       ├── filters.py
│       └── tests/
│           ├── factories.py
│           └── test_views.py
│
├── utils/
│   ├── utils.py              # capture_company_id, helpers globais
│   ├── storage.py            # MinioStorage
│   └── queue.py              # QueueEngine (RabbitMQ)
│
├── templates/                # HTML (email, PDF)
├── logs/                     # Logs rotativos (gitignore)
├── manifests/                # Kubernetes
│   ├── dev/
│   ├── hml/
│   └── prod/
├── requirements/
│   ├── base.txt
│   ├── development.txt
│   └── production.txt
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── manage.py
```

**Regra:** um domínio de negócio = um app em `apps/`. Nunca colocar lógica de dois domínios no mesmo app. Nunca colocar lógica de negócio em `utils/`.

---

## 3. Model base — TimeStampedModel

**Todo model de domínio herda de `TimeStampedModel`.** Nunca herdar de `models.Model` diretamente.

```python
# apps/core/models.py
class TimeStampedModel(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    active     = models.BooleanField(default=True)

    objects    = ActiveObjects()   # filtra active=True automaticamente
    allobjects = AllObjects()      # sem filtro — use apenas para admin/auditoria

    class Meta:
        abstract = True
```

### Soft delete — regra absoluta

```python
# PROIBIDO em qualquer circunstância
instancia.delete()

# OBRIGATÓRIO
instancia.active = False
instancia.save(update_fields=["active", "updated_at"])
```

Registros nunca são fisicamente deletados. Isso garante rastreabilidade e permite desfazer operações.

---

## 4. Multi-tenancy — escopo por empresa

Todo serviço é multi-tenant. Cada requisição carrega o header `X-Company-ID`. Todo queryset de domínio é escopado por `company_id`. Sem exceção.

```python
# utils/utils.py
def capture_company_id(request) -> str:
    company_id = request.headers.get("X-Company-ID")
    if not company_id:
        raise ValidationError({"X-Company-ID": "Header obrigatório."})
    return company_id
```

```python
# views.py — padrão obrigatório em todo list/retrieve
def get_queryset(self):
    company_id = capture_company_id(self.request)
    return MeuModel.objects.filter(company_id=company_id)
```

**Nunca** retorne dados sem filtrar por `company_id`. Um vazamento de dados entre empresas é uma falha crítica de segurança.

---

## 5. Autenticação — JWT

```
POST /v1/auth/token/         → { access, refresh }
POST /v1/auth/token/refresh/ → { access }
POST /v1/auth/token/verify/  → 200 / 401
```

```python
# config/settings/base.py
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=5),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}
```

---

## 6. RBAC — permissões por função

Cada ViewSet declara quais permissões exige. O sistema verifica a hierarquia `Positions → PositionFunction` e armazena o resultado em cache Redis.

```python
class PedidoViewSet(viewsets.ModelViewSet):
    permission_classes     = [IsAuthenticated, HasFunctionPermission]
    permission_path        = "pedidos"          # slug do módulo (kebab-case)
    permission_action_map  = {
        "list":    "pedidos.view",
        "create":  "pedidos.create",
        "update":  "pedidos.edit",
        "destroy": "pedidos.delete",
    }
```

`is_superuser=True` bypassa todas as verificações.

---

## 7. ViewSets — convenções REST

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from utils.utils import capture_company_id

class PedidoViewSet(viewsets.ModelViewSet):
    serializer_class   = PedidoSerializer
    permission_classes = [IsAuthenticated, HasFunctionPermission]
    permission_path    = "pedidos"
    filterset_class    = PedidoFilter       # django-filter
    search_fields      = ["numero", "cliente__nome"]
    ordering_fields    = ["created_at", "status"]
    ordering           = ["-created_at"]

    def get_queryset(self):
        company_id = capture_company_id(self.request)
        return Pedido.objects.filter(company_id=company_id).select_related("cliente")

    def perform_create(self, serializer):
        company_id = capture_company_id(self.request)
        serializer.save(company_id=company_id, created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="cancelar")
    def cancelar(self, request, pk=None):
        pedido = self.get_object()
        pedido.active = False
        pedido.save(update_fields=["active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
```

**Convenções de rota:**
- Prefixo sempre `/v1/`
- Slug no plural: `/v1/pedidos/`, `/v1/clientes/`
- Ações customizadas em kebab-case: `/v1/pedidos/{id}/cancelar/`

---

## 8. Padrão Interface → Repository → View

Use este padrão em qualquer app com lógica de negócio complexa ou que precise ser testado de forma isolada. É obrigatório nos apps `documents` e apps de integração com sistemas externos.

```python
# apps/pedidos/interfaces/i_pedido_repository.py
from abc import ABC, abstractmethod

class IPedidoRepository(ABC):
    @abstractmethod
    def get_by_id(self, pedido_id: str, company_id: str): ...

    @abstractmethod
    def list_by_company(self, company_id: str, filters: dict): ...

    @abstractmethod
    def create(self, data: dict) -> "Pedido": ...
```

```python
# apps/pedidos/repositories/pedido_repository.py
from ..interfaces.i_pedido_repository import IPedidoRepository
from ..models import Pedido

class PedidoRepository(IPedidoRepository):
    def get_by_id(self, pedido_id, company_id):
        return Pedido.objects.get(id=pedido_id, company_id=company_id)

    def list_by_company(self, company_id, filters=None):
        qs = Pedido.objects.filter(company_id=company_id)
        if filters:
            qs = qs.filter(**filters)
        return qs

    def create(self, data):
        return Pedido.objects.create(**data)
```

```python
# apps/pedidos/views.py — view consome repository, nunca ORM direto
class PedidoViewSet(viewsets.ViewSet):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.repo = PedidoRepository()

    def list(self, request):
        company_id = capture_company_id(request)
        pedidos = self.repo.list_by_company(company_id)
        return Response(PedidoSerializer(pedidos, many=True).data)
```

**Benefício direto:** nos testes você substitui `PedidoRepository` por um mock sem tocar no banco.

---

## 9. Filas assíncronas — RabbitMQ

Para qualquer operação que não precisa ser síncrona (email, notificação, integração externa), publique numa fila. Nunca bloqueie a thread da requisição com I/O pesado.

```python
# utils/queue.py
from config.settings import base as settings
import pika, json, time

class QueueEngine:
    MAX_RETRIES = 3

    def publish(self, queue: str, payload: dict):
        for attempt in range(self.MAX_RETRIES):
            try:
                conn = pika.BlockingConnection(
                    pika.URLParameters(settings.RABBITMQ_URL)
                )
                ch = conn.channel()
                ch.queue_declare(queue=queue, durable=True)
                ch.basic_publish(
                    exchange="",
                    routing_key=queue,
                    body=json.dumps(payload),
                    properties=pika.BasicProperties(delivery_mode=2),
                )
                conn.close()
                return
            except Exception:
                if attempt == self.MAX_RETRIES - 1:
                    raise
                time.sleep(2 ** attempt)   # backoff exponencial: 1s, 2s, 4s
```

```python
# Uso dentro de uma view ou signal
from utils.queue import QueueEngine

QueueEngine().publish(
    queue="mail_queue",
    payload={
        "to": user.email,
        "template": "pedido_confirmado",
        "context": {"numero": pedido.numero},
    }
)
```

**Filas padrão do ecossistema:**

| Fila | Propósito |
|---|---|
| `mail_queue` | Disparo de email via Resend |
| `notifications` | Push realtime → Socket.IO → frontend |
| `whatsapp.commands` | Mensagens WhatsApp via whatsmeow-worker |

Novos serviços podem criar filas próprias com nome no padrão `<servico>.<dominio>` (ex: `faturamento.cobrancas`).

---

## 10. Storage — MinIO

```python
# utils/storage.py
import boto3
from botocore.config import Config
from django.conf import settings

class MinioStorage:
    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_ENDPOINT,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(signature_version="s3v4"),
        )

    def upload_file(self, bucket: str, key: str, file_obj, content_type: str) -> str:
        self.client.upload_fileobj(
            file_obj, bucket, key,
            ExtraArgs={"ContentType": content_type},
        )
        return key

    def presigned_url(self, bucket: str, key: str, expires: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expires,
        )
```

**Regras de storage:**
- Nunca gere URLs públicas permanentes
- Use presigned URLs com TTL máximo de 24h
- Nomeie buckets em `snake_case` por domínio: `pedidos_anexos`, `documentos_pdf`
- Upload pesado sempre em thread separada ou via app `attachments` — nunca síncrono na view

---

## 11. Logs

```python
# apps/core/logger.py
import logging
from django.conf import settings

class LoggerEngine:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)

    def info(self, msg: str, **ctx):
        self.logger.info(msg, extra=ctx)

    def error(self, msg: str, **ctx):
        self.logger.error(msg, extra=ctx, exc_info=True)
```

```python
# Uso dentro de qualquer app
from apps.core.logger import LoggerEngine

log = LoggerEngine(__name__)
log.info("pedido criado", pedido_id=str(pedido.id), company_id=str(company_id))
```

Logs rotativos diários configurados em `settings/base.py` via `LOGGING`. Nunca usar `print()` em código de produção.

---

## 12. Testes

**Stack obrigatório:** `pytest` + `pytest-django` + `factory-boy`. Nenhum teste usa `unittest.TestCase` puro.

```python
# apps/pedidos/tests/factories.py
import factory
from factory.django import DjangoModelFactory
from apps.pedidos.models import Pedido

class PedidoFactory(DjangoModelFactory):
    class Meta:
        model = Pedido

    company    = factory.SubFactory("apps.organizations.tests.factories.CompanyFactory")
    numero     = factory.Sequence(lambda n: f"PED-{n:04d}")
    status     = "PENDENTE"
```

```python
# apps/pedidos/tests/test_views.py
import pytest
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_criar_pedido(user_factory, company_factory):
    company = company_factory()
    user    = user_factory(company=company)

    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.post("/v1/pedidos/", {"numero": "PED-0001", "status": "PENDENTE"})

    assert response.status_code == 201
    assert response.data["numero"] == "PED-0001"


@pytest.mark.django_db
def test_nao_retorna_pedido_de_outra_empresa(pedido_factory, user_factory, company_factory):
    outra_empresa = company_factory()
    pedido_factory(company=outra_empresa)

    minha_empresa = company_factory()
    user = user_factory(company=minha_empresa)

    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(minha_empresa.id))

    response = client.get("/v1/pedidos/")
    assert response.data["count"] == 0   # isolamento multi-tenant garantido
```

**Cobertura mínima exigida:**
- Happy path de cada endpoint (201, 200, 204)
- Isolamento multi-tenant (dados de outra empresa não aparecem)
- Permissão negada (403 quando sem a função RBAC)

---

## 13. Deploy e CI/CD

| Branch | Ambiente | Namespace K8s |
|---|---|---|
| `dev` | desenvolvimento | `dev` |
| `hml` | homologação | `hml` |
| `main` | produção | `prod` |

Pipeline GitHub Actions: build Docker → push registry → apply manifests K8s.

Cada serviço tem seus próprios manifests em `manifests/dev/`, `manifests/hml/`, `manifests/prod/`.

---

## 14. Checklist de novo projeto

- [ ] Repositório criado com a estrutura de diretórios deste padrão
- [ ] `apps/core/` copiado do template — nunca reescrito do zero
- [ ] `TimeStampedModel` como base de todos os models
- [ ] Multi-tenancy via `X-Company-ID` em todos os querysets
- [ ] RBAC declarado em todo ViewSet
- [ ] Soft delete em vez de `.delete()`
- [ ] Upload de arquivos assíncrono (nunca bloqueia a view)
- [ ] Filas RabbitMQ para side-effects (email, notificação, integração)
- [ ] `.env.example` atualizado com todas as variáveis necessárias
- [ ] Testes cobrindo isolamento multi-tenant
- [ ] `drf-spectacular` configurado com RapiDoc em `/docs/`
- [ ] Lint passando: `black . && flake8 && isort .`
- [ ] Manifests K8s para os três ambientes (dev / hml / prod)
