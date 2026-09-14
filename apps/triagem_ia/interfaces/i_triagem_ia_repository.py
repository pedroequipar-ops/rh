from abc import ABC, abstractmethod


class ITriagemIaRepository(ABC):
    @abstractmethod
    def get_by_id(self, triagem_id: str, company_id: str): ...

    @abstractmethod
    def list_by_vaga(self, company_id: str, vaga_id: str): ...

    @abstractmethod
    def list_nao_roteados(self, company_id: str): ...

    @abstractmethod
    def existe_message_id(self, company_id: str, message_id: str) -> bool: ...

    @abstractmethod
    def create(self, data: dict): ...

    @abstractmethod
    def update(self, triagem, data: dict): ...
