from ..interfaces.i_caixa_entrada_repository import ICaixaEntradaRepository
from ..models import CaixaEntradaEmail, ProviderCaixaEntrada


class CaixaEntradaRepository(ICaixaEntradaRepository):
    def list_by_company(self, company_id):
        return CaixaEntradaEmail.objects.filter(company_id=company_id).order_by("-created_at")

    def get_by_id(self, pk, company_id):
        return CaixaEntradaEmail.objects.get(pk=pk, company_id=company_id)

    def list_ativas(self):
        return CaixaEntradaEmail.objects.filter(ativo=True)

    def create(self, company_id, data: dict):
        return CaixaEntradaEmail.objects.create(company_id=company_id, **data)

    def update(self, caixa, data: dict):
        for campo, valor in data.items():
            setattr(caixa, campo, valor)
        caixa.save()
        return caixa

    def delete(self, caixa):
        caixa.delete()

    def find_google(self, company_id, usuario):
        return CaixaEntradaEmail.objects.filter(
            company_id=company_id, provider=ProviderCaixaEntrada.GOOGLE, usuario=usuario
        ).first()
