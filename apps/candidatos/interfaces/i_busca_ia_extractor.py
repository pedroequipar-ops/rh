from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FiltroBuscaIADTO:
    etapa_ids: list = field(default_factory=list)
    etapa_ordem_min: Optional[int] = None
    vaga_titulo_contains: str = ""
    tags: list = field(default_factory=list)
    palavras_chave: list = field(default_factory=list)
    interpretacao: str = ""


class IBuscaCandidatosExtractor(ABC):
    @abstractmethod
    def interpretar(self, frase: str, etapas: list, tags: list) -> FiltroBuscaIADTO: ...
