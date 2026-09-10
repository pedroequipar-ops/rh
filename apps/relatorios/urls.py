from django.urls import path

from .views import RelatorioView

urlpatterns = [
    path("relatorios/", RelatorioView.as_view(), name="relatorio"),
]
