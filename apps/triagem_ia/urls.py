from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CaixaEntradaEmailDetailView,
    CaixaEntradaEmailView,
    GoogleOAuthAuthorizeView,
    GoogleOAuthCallbackView,
    TriagemIaViewSet,
    TriagemIaWebhookView,
)

router = DefaultRouter()
router.register("triagem-ia", TriagemIaViewSet, basename="triagem-ia")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "triagem-ia-caixa-entrada/",
        CaixaEntradaEmailView.as_view(),
        name="triagem-ia-caixa-entrada",
    ),
    path(
        "triagem-ia-caixa-entrada/<uuid:pk>/",
        CaixaEntradaEmailDetailView.as_view(),
        name="triagem-ia-caixa-entrada-detail",
    ),
    path(
        "triagem-ia-google/authorize/",
        GoogleOAuthAuthorizeView.as_view(),
        name="triagem-ia-google-authorize",
    ),
    path(
        "triagem-ia-google/callback/",
        GoogleOAuthCallbackView.as_view(),
        name="triagem-ia-google-callback",
    ),
    path(
        "triagem-ia-webhook/curriculo/",
        TriagemIaWebhookView.as_view(),
        name="triagem-ia-webhook-curriculo",
    ),
]
