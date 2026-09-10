import csv

from django.http import StreamingHttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.utils import capture_company_id

from . import services
from .serializers import RelatorioSerializer


class Echo:
    """Objeto "arquivo" que só devolve o que escreveram nele — usado pelo
    `csv.writer` pra virar gerador (streaming) em vez de montar tudo em memória."""

    def write(self, value):
        return value


class RelatorioView(APIView):
    """POST /v1/relatorios/ — monta um relatório (linhas de vaga/candidato,
    filtrado e opcionalmente agrupado) e devolve como CSV (streaming) ou JSON.
    `?preview=1` devolve só as 20 primeiras linhas em JSON, pro builder no front."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        company_id = capture_company_id(request)
        ser = RelatorioSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        dados = ser.validated_data
        entidade = dados["entidade"]

        qs = services.montar_queryset(entidade, company_id, dados["filtros"], dados["periodo"])
        qs = services.aplicar_escopo_setor(entidade, qs, request.user)

        preview = request.query_params.get("preview") == "1"

        if dados["modo"] == "agrupado":
            grupos = services.agrupar(entidade, dados["agrupamento"], qs)
            label_grupo = services.CAMPOS_PERMITIDOS[entidade][dados["agrupamento"]]["label"]
            if preview or dados["formato"] == "json":
                linhas = grupos[:20] if preview else grupos
                return Response([{"grupo": g, "total": t} for g, t in linhas])
            return self._csv_response([label_grupo, "Total"], grupos, entidade)

        campos = dados["campos"]
        labels = [services.CAMPOS_PERMITIDOS[entidade][c]["label"] for c in campos]

        if preview:
            linhas = services.gerar_linhas(entidade, campos, qs[:20])
            return Response([dict(zip(campos, linha)) for linha in linhas])

        if dados["formato"] == "json":
            linhas = services.gerar_linhas(entidade, campos, qs)
            return Response([dict(zip(campos, linha)) for linha in linhas])

        linhas = services.gerar_linhas(entidade, campos, qs)
        return self._csv_response(labels, linhas, entidade)

    def _csv_response(self, header, linhas, nome_arquivo):
        writer = csv.writer(Echo(), delimiter=";")

        def gerador():
            yield "﻿"
            yield writer.writerow(header)
            for linha in linhas:
                yield writer.writerow(linha)

        response = StreamingHttpResponse(gerador(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{nome_arquivo}.csv"'
        return response
