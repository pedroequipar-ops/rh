import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User


@pytest.mark.django_db
def test_login_retorna_tokens(company_factory, user_factory):
    company = company_factory()
    user_factory(company=company, username="rh1", password="senha12345", role=User.Role.RH)

    client = APIClient()
    response = client.post("/v1/auth/token/", {"username": "rh1", "password": "senha12345"})

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_me_reflete_role_e_setor(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    user = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.get("/v1/auth/me/")

    assert response.status_code == 200
    assert response.data["role"] == "SETOR"
    assert response.data["setor"]["id"] == str(setor.id)
    assert response.data["company_id"] == str(company.id)
