from abc import ABC, abstractmethod


class ICaixaEntradaRepository(ABC):
    @abstractmethod
    def list_by_company(self, company_id: str): ...

    @abstractmethod
    def get_by_id(self, pk, company_id: str): ...

    @abstractmethod
    def list_ativas(self): ...

    @abstractmethod
    def create(self, company_id: str, data: dict): ...

    @abstractmethod
    def update(self, caixa, data: dict): ...

    @abstractmethod
    def delete(self, caixa): ...

    @abstractmethod
    def find_google(self, company_id: str, usuario: str): ...
