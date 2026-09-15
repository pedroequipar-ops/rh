from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(str(BASE_DIR / ".env"))

SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="django-insecure-change-me-in-production-please-32chars",
)

DEBUG = env.bool("DJANGO_DEBUG", default=False)

ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "channels",
    "apps.core",
    "apps.accounts",
    "apps.vagas",
    "apps.candidatos",
    "apps.chat",
    "apps.busca",
    "apps.tags",
    "apps.atividade",
    "apps.dashboard",
    "apps.tarefas",
    "apps.relatorios",
    "apps.triagem_ia",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="rh"),
        "USER": env("POSTGRES_USER", default="rh"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="rh"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")
REDIS_CHANNELS_URL = env("REDIS_CHANNELS_URL", default="redis://localhost:6379/1")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_CHANNELS_URL]},
    }
}

RABBITMQ_URL = env("RABBITMQ_URL", default="amqp://guest:guest@localhost:5672/")

MINIO_ENDPOINT = env("MINIO_ENDPOINT", default="http://localhost:9000")
MINIO_PUBLIC_ENDPOINT = env("MINIO_PUBLIC_ENDPOINT", default=MINIO_ENDPOINT)
MINIO_ACCESS_KEY = env("MINIO_ACCESS_KEY", default="minioadmin")
MINIO_SECRET_KEY = env("MINIO_SECRET_KEY", default="minioadmin")
MINIO_BUCKET_CANDIDATOS_CURRICULOS = env(
    "MINIO_BUCKET_CANDIDATOS_CURRICULOS", default="candidatos-curriculos"
)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=5),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "RH API",
    "DESCRIPTION": "Kanban de vagas, candidatos e chat.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=True)

CURRICULO_EXTRACTOR_CLASS = env(
    "CURRICULO_EXTRACTOR_CLASS",
    default="apps.candidatos.extractors.groq_extractor.GroqCurriculoExtractor",
)
GROQ_API_KEY = env("GROQ_API_KEY", default="")
GROQ_MODEL = env("GROQ_MODEL", default="openai/gpt-oss-120b")

TRIAGEM_IA_EXTRACTOR_CLASS = env(
    "TRIAGEM_IA_EXTRACTOR_CLASS",
    default="apps.candidatos.extractors.groq_triagem_extractor.GroqTriagemIaExtractor",
)

CANDIDATOS_BUSCA_IA_EXTRACTOR_CLASS = env(
    "CANDIDATOS_BUSCA_IA_EXTRACTOR_CLASS",
    default="apps.candidatos.extractors.groq_busca_extractor.GroqBuscaCandidatosExtractor",
)

CANDIDATOS_TAG_EXTRACTOR_CLASS = env(
    "CANDIDATOS_TAG_EXTRACTOR_CLASS",
    default="apps.candidatos.extractors.groq_tag_extractor.GroqTagExtractor",
)
VAGAS_TAG_EXTRACTOR_CLASS = env(
    "VAGAS_TAG_EXTRACTOR_CLASS",
    default="apps.candidatos.extractors.groq_vaga_tag_extractor.GroqVagaTagExtractor",
)
CANDIDATOS_EMAIL_REPROVACAO_EXTRACTOR_CLASS = env(
    "CANDIDATOS_EMAIL_REPROVACAO_EXTRACTOR_CLASS",
    default="apps.candidatos.extractors.groq_email_reprovacao_extractor.GroqEmailReprovacaoExtractor",
)
VAGAS_ALERTA_RISCO_EXTRACTOR_CLASS = env(
    "VAGAS_ALERTA_RISCO_EXTRACTOR_CLASS",
    default="apps.candidatos.extractors.groq_alerta_risco_extractor.GroqAlertaRiscoExtractor",
)
# Chave Fernet dedicada pra cifrar a senha da caixa de e-mail da Triagem por
# IA (apps/triagem_ia/crypto.py) — de propósito, não deriva de SECRET_KEY,
# pra poder ser rotacionada sem mexer na chave de sessão/JWT.
TRIAGEM_IA_ENCRYPTION_KEY = env("TRIAGEM_IA_ENCRYPTION_KEY", default="")

# OAuth "Conectar com Google" (Gmail) pra Triagem por IA — Client ID/Secret
# vêm do Google Cloud Console (Gmail API + tela de consentimento OAuth),
# REDIRECT_URI precisa estar cadastrada lá, idêntica. Em branco = botão
# "Conectar com Google" mostra erro amigável em vez de tentar e quebrar.
GOOGLE_OAUTH_CLIENT_ID = env("GOOGLE_OAUTH_CLIENT_ID", default="")
GOOGLE_OAUTH_CLIENT_SECRET = env("GOOGLE_OAUTH_CLIENT_SECRET", default="")
GOOGLE_OAUTH_REDIRECT_URI = env(
    "GOOGLE_OAUTH_REDIRECT_URI",
    default="http://localhost:8000/v1/triagem-ia-google/callback/",
)
# Pra onde o navegador volta depois do callback do Google.
TRIAGEM_IA_FRONTEND_URL = env(
    "TRIAGEM_IA_FRONTEND_URL", default="http://localhost:5173/config/triagem-ia"
)

# Webhook pra receber currículo de um filtro externo (ex.: o "checkmail" do
# Pedro, que já decide se o e-mail é candidatura de verdade antes de mandar
# pra cá) em vez de conectar uma caixa de e-mail real na Triagem por IA. Só
# uma empresa usa isso por enquanto — token fixo + company id fixo em vez de
# um esquema multi-tenant. Em branco = endpoint responde 503 em vez de
# aceitar sem autenticação.
TRIAGEM_IA_WEBHOOK_TOKEN = env("TRIAGEM_IA_WEBHOOK_TOKEN", default="")
TRIAGEM_IA_WEBHOOK_COMPANY_ID = env("TRIAGEM_IA_WEBHOOK_COMPANY_ID", default="")

# Base do frontend pra montar link "abrir no sistema" nos avisos de
# WhatsApp (ver utils/whatsapp.py).
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="http://localhost:5173")

# Filas RabbitMQ que o serviço Go whatsapp-bot (whatsmeow) consome/publica —
# nome precisa bater com WHATSAPP_NOTIFY_QUEUE/WHATSAPP_CONFIRM_QUEUE do
# lado Go (ver whatsapp-bot/internal/config/config.go). Mesmo desenho do
# email-monitor (sistema separado do Pedro): fila em vez de HTTP porque o
# bot já está com uma conexão WhatsApp aberta o tempo todo, então só falta
# consumir.
QUEUE_WHATSAPP_NOTIFY = env("QUEUE_WHATSAPP_NOTIFY", default="rh.whatsapp_notify")
QUEUE_WHATSAPP_CONFIRM = env("QUEUE_WHATSAPP_CONFIRM", default="rh.whatsapp_confirm")

LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
        "file": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": str(LOGS_DIR / "app.log"),
            "when": "midnight",
            "backupCount": 14,
            "formatter": "default",
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": "INFO",
    },
}
