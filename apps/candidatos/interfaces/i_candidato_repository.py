from abc import ABC, abstractmethod


class ICandidatoRepository(ABC):
    @abstractmethod
    def get_by_id(self, candidato_id: str, company_id: str): ...

    @abstractmethod
    def list_by_company(self, company_id: str): ...

    @abstractmethod
    def list_by_setor(self, company_id: str, setor_id: str): ...

    @abstractmethod
    def create(self, data: dict): ...

    @abstractmethod
    def update(self, candidato, data: dict): ...

    @abstractmethod
    def soft_delete(self, candidato): ...

    @abstractmethod
    def mover_etapa(self, candidato, etapa): ...
