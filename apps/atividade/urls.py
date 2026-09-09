from django.urls import path

from .views import AtividadeFeedView, ComentarioCreateView

urlpatterns = [
    path("atividade/", AtividadeFeedView.as_view(), name="atividade-feed"),
    path("atividade/comentarios/", ComentarioCreateView.as_view(), name="atividade-comentario-criar"),
]
