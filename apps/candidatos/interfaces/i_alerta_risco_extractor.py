from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class AlertaRiscoDTO:
    mensagem: str = ""


class IAlertaRiscoExtractor(ABC):
    @abstractmethod
    def redigir(self, contexto: dict) -> AlertaRiscoDTO: ...
