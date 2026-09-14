from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class CandidatoPontuadoDTO:
    nome: str = ""
    email: str = ""
    telefone: str = ""
    cpf: str = ""
    linkedin_url: str = ""
    score: int = 0
    justificativa: str = ""
    perfil_formacao: str = ""
    perfil_experiencia: str = ""
    perfil_habilidades: str = ""
    perfil_certificacoes: str = ""


class ITriagemIaExtractor(ABC):
    @abstractmethod
    def pontuar(self, texto_curriculo: str, vaga: dict) -> CandidatoPontuadoDTO: ...
