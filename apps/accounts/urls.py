from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from .views import AlterarSenhaView, MeView, SetorViewSet, UserViewSet

router = DefaultRouter()
router.register("setores", SetorViewSet, basename="setor")
router.register("usuarios", UserViewSet, basename="usuario")

urlpatterns = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("auth/me/", MeView.as_view(), name="auth_me"),
    path("auth/senha/", AlterarSenhaView.as_view(), name="auth_senha"),
    path("", include(router.urls)),
]
