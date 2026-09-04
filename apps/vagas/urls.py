from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import EtapaKanbanViewSet, VagaViewSet

router = DefaultRouter()
router.register("etapas-kanban", EtapaKanbanViewSet, basename="etapa-kanban")
router.register("vagas", VagaViewSet, basename="vaga")

urlpatterns = [
    path("", include(router.urls)),
]
