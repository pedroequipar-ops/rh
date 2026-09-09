from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CompanyConfigView,
    EtapaKanbanViewSet,
    VagaNotificacaoListView,
    VagaNotificacaoMarcarLidasView,
    VagaViewSet,
)

router = DefaultRouter()
router.register("etapas-kanban", EtapaKanbanViewSet, basename="etapa-kanban")
router.register("vagas", VagaViewSet, basename="vaga")

urlpatterns = [
    path("", include(router.urls)),
    path("company/config/", CompanyConfigView.as_view(), name="company-config"),
    path(
        "vagas-notificacoes/",
        VagaNotificacaoListView.as_view(),
        name="vaga-notificacoes",
    ),
    path(
        "vagas-notificacoes/marcar-lidas/",
        VagaNotificacaoMarcarLidasView.as_view(),
        name="vaga-notificacoes-marcar-lidas",
    ),
]
