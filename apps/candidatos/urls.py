from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CandidatoViewSet

router = DefaultRouter()
router.register("candidatos", CandidatoViewSet, basename="candidato")

urlpatterns = [
    path("", include(router.urls)),
]
