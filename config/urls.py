from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView
from drf_spectacular.views import SpectacularAPIView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("v1/", include("apps.accounts.urls")),
    path("v1/", include("apps.vagas.urls")),
    path("v1/", include("apps.candidatos.urls")),
    path("v1/", include("apps.chat.urls")),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "docs/",
        TemplateView.as_view(template_name="rapidoc.html"),
        name="docs",
    ),
]
