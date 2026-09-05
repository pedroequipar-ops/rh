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


@pytest.mark.django_db
def test_setor_altera_a_propria_senha(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    user = user_factory(
        company=company, role=User.Role.SETOR, setor=setor, password="senha12345"
    )

    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.post(
        "/v1/auth/senha/", {"senha_atual": "senha12345", "senha_nova": "novaSenha123"}
    )

    assert response.status_code == 204
    user.refresh_from_db()
    assert user.check_password("novaSenha123")


@pytest.mark.django_db
def test_alterar_senha_com_senha_atual_errada_falha(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    user = user_factory(
        company=company, role=User.Role.SETOR, setor=setor, password="senha12345"
    )

    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.post(
        "/v1/auth/senha/", {"senha_atual": "errada", "senha_nova": "novaSenha123"}
    )

    assert response.status_code == 400
    user.refresh_from_db()
    assert user.check_password("senha12345")


@pytest.mark.django_db
def test_rh_pode_criar_usuario_de_setor(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)

    client = APIClient()
    client.force_authenticate(user=rh)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.post(
        "/v1/usuarios/",
        {
            "username": "novo.setor",
            "password": "senha12345",
            "email": "novo@example.com",
            "first_name": "Novo",
            "last_name": "Usuario",
            "setor_id": str(setor.id),
        },
    )

    assert response.status_code == 201
    novo = User.objects.get(username="novo.setor")
    assert novo.role == User.Role.SETOR
    assert novo.setor_id == setor.id
    assert novo.company_id == company.id
    assert novo.check_password("senha12345")


@pytest.mark.django_db
def test_setor_nao_pode_criar_usuario(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    usuario_setor = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = APIClient()
    client.force_authenticate(user=usuario_setor)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.post(
        "/v1/usuarios/",
        {
            "username": "outro",
            "password": "senha12345",
            "setor_id": str(setor.id),
        },
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_rh_nao_pode_usar_setor_de_outra_company(company_factory, setor_factory, user_factory):
    company = company_factory()
    outra_company = company_factory()
    setor_de_outra = setor_factory(company=outra_company)
    rh = user_factory(company=company, role=User.Role.RH)

    client = APIClient()
    client.force_authenticate(user=rh)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.post(
        "/v1/usuarios/",
        {
            "username": "novo.invalido",
            "password": "senha12345",
            "setor_id": str(setor_de_outra.id),
        },
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_rh_lista_e_exclui_usuario(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    usuario_setor = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = APIClient()
    client.force_authenticate(user=rh)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    listagem = client.get("/v1/usuarios/")
    assert listagem.status_code == 200
    usernames = [item["username"] for item in listagem.data["results"]]
    assert usuario_setor.username in usernames

    exclusao = client.delete(f"/v1/usuarios/{usuario_setor.id}/")
    assert exclusao.status_code == 204
    usuario_setor.refresh_from_db()
    assert usuario_setor.is_active is False

    listagem_apos = client.get("/v1/usuarios/")
    assert usuario_setor.username not in [item["username"] for item in listagem_apos.data["results"]]


@pytest.mark.django_db
def test_rh_nao_pode_excluir_o_proprio_usuario(company_factory, user_factory):
    company = company_factory()
    rh = user_factory(company=company, role=User.Role.RH)

    client = APIClient()
    client.force_authenticate(user=rh)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.delete(f"/v1/usuarios/{rh.id}/")

    assert response.status_code == 400
    rh.refresh_from_db()
    assert rh.is_active is True


@pytest.mark.django_db
def test_rh_exclui_setor(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)

    client = APIClient()
    client.force_authenticate(user=rh)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.delete(f"/v1/setores/{setor.id}/")

    assert response.status_code == 204
    setor.refresh_from_db()
    assert setor.active is False


@pytest.mark.django_db
def test_rh_edita_nome_do_setor(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company, nome="Antigo")
    rh = user_factory(company=company, role=User.Role.RH)

    client = APIClient()
    client.force_authenticate(user=rh)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.patch(f"/v1/setores/{setor.id}/", {"nome": "Novo Nome"})

    assert response.status_code == 200
    setor.refresh_from_db()
    assert setor.nome == "Novo Nome"


@pytest.mark.django_db
def test_rh_edita_usuario_username_e_setor(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor_antigo = setor_factory(company=company)
    setor_novo = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    usuario = user_factory(company=company, role=User.Role.SETOR, setor=setor_antigo)

    client = APIClient()
    client.force_authenticate(user=rh)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.patch(
        f"/v1/usuarios/{usuario.id}/",
        {"username": "novo.username", "setor_id": str(setor_novo.id)},
    )

    assert response.status_code == 200
    usuario.refresh_from_db()
    assert usuario.username == "novo.username"
    assert usuario.setor_id == setor_novo.id


@pytest.mark.django_db
def test_rh_edita_senha_do_usuario(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    usuario = user_factory(company=company, role=User.Role.SETOR, setor=setor, password="antiga1234")

    client = APIClient()
    client.force_authenticate(user=rh)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.patch(f"/v1/usuarios/{usuario.id}/", {"password": "nova12345"})

    assert response.status_code == 200
    usuario.refresh_from_db()
    assert usuario.check_password("nova12345")


@pytest.mark.django_db
def test_editar_usuario_sem_senha_mantem_senha_atual(
    company_factory, setor_factory, user_factory
):
    company = company_factory()
    setor = setor_factory(company=company)
    rh = user_factory(company=company, role=User.Role.RH)
    usuario = user_factory(company=company, role=User.Role.SETOR, setor=setor, password="antiga1234")

    client = APIClient()
    client.force_authenticate(user=rh)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.patch(f"/v1/usuarios/{usuario.id}/", {"username": "outro.nome"})

    assert response.status_code == 200
    usuario.refresh_from_db()
    assert usuario.check_password("antiga1234")


@pytest.mark.django_db
def test_setor_nao_pode_editar_usuario(company_factory, setor_factory, user_factory):
    company = company_factory()
    setor = setor_factory(company=company)
    setor_user = user_factory(company=company, role=User.Role.SETOR, setor=setor)
    outro_usuario = user_factory(company=company, role=User.Role.SETOR, setor=setor)

    client = APIClient()
    client.force_authenticate(user=setor_user)
    client.credentials(HTTP_X_COMPANY_ID=str(company.id))

    response = client.patch(f"/v1/usuarios/{outro_usuario.id}/", {"username": "hack"})

    assert response.status_code == 403
