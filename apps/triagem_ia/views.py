from django.conf import settings
from django.shortcuts import redirect
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.logger import LoggerEngine
from apps.core.permissions import HasFunctionPermission
from apps.vagas import services as vagas_services
from apps.vagas.models import Vaga
from apps.vagas.repositories.vaga_repository import VagaRepository
from utils.utils import capture_company_id

from . import crypto, oauth_google, services
from .models import CaixaEntradaEmail, CandidatoTriagemIA, ProviderCaixaEntrada
from .repositories.caixa_entrada_repository import CaixaEntradaRepository
from .repositories.triagem_ia_repository import TriagemIaRepository
from .serializers import (
    CaixaEntradaEmailSerializer,
    CandidatoTriagemIASerializer,
    TriagemIaDecidirSerializer,
    TriagemIaRotearSerializer,
)

log = LoggerEngine(__name__)

TOP_DESTAQUE = 10


class TriagemIaViewSet(viewsets.ViewSet):
    """RH-only. ``list`` exige ``?vaga_id=`` ou ``?nao_roteado=true``; os 10
    melhores scores da lista vêm com ``destaque=true``."""

    permission_classes = [IsAuthenticated, HasFunctionPermission]
    permission_path = "triagem_ia"
    permission_action_map = {
        "list": "triagem_ia.view",
        "config": "triagem_ia.view",
        "decidir": "triagem_ia.decidir",
        "rotear": "triagem_ia.decidir",
    }

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.repo = TriagemIaRepository()

    def _get_or_404(self, pk, company_id):
        try:
            return self.repo.get_by_id(pk, company_id)
        except CandidatoTriagemIA.DoesNotExist:
            raise NotFound("Item da Triagem por IA não encontrado.")

    def list(self, request):
        company_id = capture_company_id(request)
        vaga_id = request.query_params.get("vaga_id")
        nao_roteado = request.query_params.get("nao_roteado") == "true"

        if nao_roteado:
            qs = self.repo.list_nao_roteados(company_id)
        elif vaga_id:
            qs = self.repo.list_by_vaga(company_id, vaga_id)
        else:
            return Response(
                {"detail": "Informe `vaga_id` ou `nao_roteado=true`."}, status=400
            )

        itens = list(qs)
        pontuados = [t for t in itens if t.score is not None]
        top_ids = {t.id for t in pontuados[:TOP_DESTAQUE]}
        serializer = CandidatoTriagemIASerializer(itens, many=True, context={"top_ids": top_ids})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="decidir")
    def decidir(self, request, pk=None):
        company_id = capture_company_id(request)
        triagem = self._get_or_404(pk, company_id)
        serializer = TriagemIaDecidirSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        candidato = services.decidir(
            triagem,
            serializer.validated_data["acao"],
            request.user,
            serializer.validated_data.get("motivo", ""),
        )
        return Response({"candidato_id": str(candidato.id), "vaga_id": str(candidato.vaga_id)})

    @action(detail=True, methods=["post"], url_path="rotear")
    def rotear(self, request, pk=None):
        company_id = capture_company_id(request)
        triagem = self._get_or_404(pk, company_id)
        serializer = TriagemIaRotearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            vaga = VagaRepository().get_by_id(serializer.validated_data["vaga_id"], company_id)
        except Vaga.DoesNotExist:
            raise NotFound("Vaga não encontrada.")
        triagem = services.rotear(triagem, vaga)
        return Response(CandidatoTriagemIASerializer(triagem).data)

    @action(detail=False, methods=["get"], url_path="config")
    def config(self, request):
        company_id = capture_company_id(request)
        caixa_ativa = next(
            (c for c in CaixaEntradaRepository().list_by_company(company_id) if c.ativo), None
        )
        vaga_id = request.query_params.get("vaga_id")
        codigo_email = None
        if vaga_id:
            try:
                vaga = VagaRepository().get_by_id(vaga_id, company_id)
            except Vaga.DoesNotExist:
                raise NotFound("Vaga não encontrada.")
            codigo_email = vagas_services.garantir_codigo_email(vaga)
        return Response(
            {
                "caixa_configurada": caixa_ativa is not None,
                "caixa_usuario": caixa_ativa.usuario if caixa_ativa else "",
                "vaga_codigo_email": codigo_email,
            }
        )


class CaixaEntradaEmailView(APIView):
    """Config (RH-only) das caixas de e-mail da empresa — a empresa pode ter
    várias, todas monitoradas juntas. GET lista, POST adiciona uma nova
    caixa IMAP manual (a conexão Google tem seu próprio caminho, via OAuth
    abaixo)."""

    permission_classes = [IsAuthenticated]

    def _garantir_rh(self, request):
        user = request.user
        if not (user.is_superuser or user.role == User.Role.RH):
            raise PermissionDenied("Apenas RH pode configurar caixas de e-mail.")

    def get(self, request):
        self._garantir_rh(request)
        company_id = capture_company_id(request)
        caixas = CaixaEntradaRepository().list_by_company(company_id)
        return Response(CaixaEntradaEmailSerializer(caixas, many=True).data)

    def post(self, request):
        self._garantir_rh(request)
        company_id = capture_company_id(request)
        serializer = CaixaEntradaEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = dict(serializer.validated_data)
        senha = dados.pop("senha", None)
        if not senha:
            raise ValidationError({"senha": "Obrigatória pra conectar uma nova caixa IMAP."})
        dados["senha_cifrada"] = crypto.cifrar(senha)
        dados["provider"] = ProviderCaixaEntrada.IMAP
        caixa = CaixaEntradaRepository().create(company_id, dados)
        return Response(CaixaEntradaEmailSerializer(caixa).data, status=201)


class CaixaEntradaEmailDetailView(APIView):
    """RH-only. PATCH edita uma caixa existente (ex: ativar/desativar, ou
    trocar a senha de uma caixa IMAP); DELETE desconecta e remove."""

    permission_classes = [IsAuthenticated]

    def _garantir_rh(self, request):
        user = request.user
        if not (user.is_superuser or user.role == User.Role.RH):
            raise PermissionDenied("Apenas RH pode configurar caixas de e-mail.")

    def _get_or_404(self, pk, company_id):
        try:
            return CaixaEntradaRepository().get_by_id(pk, company_id)
        except CaixaEntradaEmail.DoesNotExist:
            raise NotFound("Caixa de e-mail não encontrada.")

    def patch(self, request, pk):
        self._garantir_rh(request)
        company_id = capture_company_id(request)
        caixa = self._get_or_404(pk, company_id)
        serializer = CaixaEntradaEmailSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        dados = dict(serializer.validated_data)
        senha = dados.pop("senha", None)
        if senha:
            dados["senha_cifrada"] = crypto.cifrar(senha)
        caixa = CaixaEntradaRepository().update(caixa, dados)
        return Response(CaixaEntradaEmailSerializer(caixa).data)

    def delete(self, request, pk):
        self._garantir_rh(request)
        company_id = capture_company_id(request)
        caixa = self._get_or_404(pk, company_id)
        CaixaEntradaRepository().delete(caixa)
        return Response(status=204)


class GoogleOAuthAuthorizeView(APIView):
    """RH clica "Conectar com Google" — devolve a URL de consentimento pro
    frontend navegar (não dá pra redirecionar direto daqui porque essa
    chamada é autenticada via JWT, e o Google não entende esse header)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not (user.is_superuser or user.role == User.Role.RH):
            raise PermissionDenied("Apenas RH pode conectar a caixa de e-mail.")
        company_id = capture_company_id(request)
        try:
            url = oauth_google.montar_url_autorizacao(company_id, str(user.id))
        except oauth_google.GoogleOAuthNaoConfiguradoError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response({"authorize_url": url})


class GoogleOAuthCallbackView(APIView):
    """O Google chama essa URL depois do consentimento — sem header de
    autenticação (é o navegador do usuário sendo redirecionado pelo Google,
    não uma chamada autenticada do frontend), por isso ``AllowAny`` e a
    identidade vem do ``state`` assinado."""

    permission_classes = [AllowAny]

    def get(self, request):
        erro = request.query_params.get("error")
        if erro:
            return redirect(f"{settings.TRIAGEM_IA_FRONTEND_URL}?google=erro")

        code = request.query_params.get("code")
        state = request.query_params.get("state")
        if not code or not state:
            return redirect(f"{settings.TRIAGEM_IA_FRONTEND_URL}?google=erro")

        try:
            company_id, _user_id = oauth_google.ler_state(state)
            tokens = oauth_google.trocar_code_por_tokens(code)
            refresh_token = tokens.get("refresh_token")
            if not refresh_token:
                # Sem `prompt=consent` isso pode faltar numa reconexão — não
                # temos o que fazer sem ele (não dá pra renovar o acesso).
                raise oauth_google.GoogleOAuthError("Google não devolveu refresh_token.")
            email_conta = oauth_google.buscar_email_da_conta(tokens["access_token"])

            dados = {
                "provider": ProviderCaixaEntrada.GOOGLE,
                "usuario": email_conta,
                "google_refresh_token_cifrado": crypto.cifrar(refresh_token),
                "ativo": True,
                "ultimo_erro": "",
            }
            repo = CaixaEntradaRepository()
            caixa_existente = repo.find_google(company_id, email_conta)
            if caixa_existente:
                repo.update(caixa_existente, dados)
            else:
                repo.create(company_id, dados)
        except Exception as exc:
            log.error("falha ao conectar Google na Triagem por IA", erro=str(exc))
            return redirect(f"{settings.TRIAGEM_IA_FRONTEND_URL}?google=erro")

        return redirect(f"{settings.TRIAGEM_IA_FRONTEND_URL}?google=conectado")
