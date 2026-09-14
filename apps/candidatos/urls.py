from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CandidatoNotificacaoListView,
    CandidatoNotificacaoMarcarLidasView,
    CandidatoNotificacaoMarcarUmaView,
    CandidatoViewSet,
)

router = DefaultRouter()
router.register("candidatos", CandidatoViewSet, basename="candidato")

urlpatterns = [
    path("", include(router.urls)),
    path(
        "candidatos-notificacoes/",
        CandidatoNotificacaoListView.as_view(),
        name="candidato-notificacoes",
    ),
    path(
        "candidatos-notificacoes/marcar-lidas/",
        CandidatoNotificacaoMarcarLidasView.as_view(),
        name="candidato-notificacoes-marcar-lidas",
    ),
    path(
        "candidatos-notificacoes/<uuid:pk>/marcar/",
        CandidatoNotificacaoMarcarUmaView.as_view(),
        name="candidato-notificacoes-marcar-uma",
    ),
]
