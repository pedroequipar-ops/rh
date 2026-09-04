from abc import ABC, abstractmethod


class IEtapaRepository(ABC):
    @abstractmethod
    def get_by_id(self, etapa_id: str, company_id: str): ...

    @abstractmethod
    def list_by_company(self, company_id: str): ...

    @abstractmethod
    def create(self, data: dict): ...

    @abstractmethod
    def update(self, etapa, data: dict): ...

    @abstractmethod
    def soft_delete(self, etapa): ...

    @abstractmethod
    def reordenar(self, company_id: str, ordem: list): ...
