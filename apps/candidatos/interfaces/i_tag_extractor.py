from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class TagsSugeridasDTO:
    tags: list = field(default_factory=list)
    interpretacao: str = ""


class ITagExtractor(ABC):
    @abstractmethod
    def sugerir(self, perfil: dict, tags_existentes: list) -> TagsSugeridasDTO: ...
