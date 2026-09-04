from abc import ABC, abstractmethod


class IVagaRepository(ABC):
    @abstractmethod
    def get_by_id(self, vaga_id: str, company_id: str): ...

    @abstractmethod
    def list_by_company(self, company_id: str): ...

    @abstractmethod
    def list_by_setor(self, company_id: str, setor_id: str): ...

    @abstractmethod
    def create(self, data: dict): ...

    @abstractmethod
    def update(self, vaga, data: dict): ...
