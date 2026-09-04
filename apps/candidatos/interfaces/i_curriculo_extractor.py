from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class CandidatoExtraidoDTO:
    nome: str = ""
    email: str = ""
    telefone: str = ""
    cpf: str = ""
    linkedin_url: str = ""
    vaga_sugerida_id: Optional[str] = None
    justificativa: str = ""
    resumo_perfil: str = ""


class ICurriculoExtractor(ABC):
    @abstractmethod
    def extrair(self, texto_curriculo: str, vagas_abertas: list) -> CandidatoExtraidoDTO: ...
