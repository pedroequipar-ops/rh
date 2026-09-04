import io

from django.conf import settings
from django.utils.module_loading import import_string
from pypdf import PdfReader

from apps.core.logger import LoggerEngine
from apps.vagas.repositories.vaga_repository import VagaRepository
from utils.storage import MinioStorage

from .interfaces.i_curriculo_extractor import CandidatoExtraidoDTO

log = LoggerEngine(__name__)


def can_access_candidato(user, candidato) -> bool:
    if user.is_superuser or user.role == "RH":
        return True
    if user.role == "SETOR":
        return str(candidato.vaga.setor_id) == str(user.setor_id)
    return False


def _extrair_texto_pdf(conteudo: bytes) -> str:
    reader = PdfReader(io.BytesIO(conteudo))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


class CurriculoExtractionError(Exception):
    pass


def extrair_dados_candidato(curriculo_key: str, company_id: str) -> CandidatoExtraidoDTO:
    try:
        conteudo = MinioStorage().get_object(
            settings.MINIO_BUCKET_CANDIDATOS_CURRICULOS, curriculo_key
        )
        texto = _extrair_texto_pdf(conteudo)

        vagas_abertas = VagaRepository().list_by_company(company_id)
        vagas_payload = [
            {
                "id": vaga.id,
                "titulo": vaga.titulo,
                "descricao": vaga.descricao,
                "requisitos": vaga.requisitos,
                "setor": vaga.setor.nome,
            }
            for vaga in vagas_abertas
        ]

        extractor_class = import_string(settings.CURRICULO_EXTRACTOR_CLASS)
        extractor = extractor_class()
        return extractor.extrair(texto, vagas_payload)
    except Exception as exc:
        log.error(
            "falha ao analisar currículo com IA",
            curriculo_key=curriculo_key,
            erro=str(exc),
        )
        raise CurriculoExtractionError(str(exc)) from exc
