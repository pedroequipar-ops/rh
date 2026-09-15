from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class EmailReprovacaoDTO:
    assunto: str = ""
    corpo: str = ""
    interpretacao: str = ""


class IEmailReprovacaoExtractor(ABC):
    @abstractmethod
    def redigir(self, candidato: dict, motivo: str) -> EmailReprovacaoDTO: ...
