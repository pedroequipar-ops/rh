import re

from .models import Tag

_CARACTERES_INVALIDOS_RE = re.compile(r"[^a-z0-9\-]+")


def normalizar_nome(nome: str) -> str:
    """'#Possível Pessoa!' -> 'possivel-pessoa' (sem acento seria ideal, mas o
    essencial é minúsculo, sem '#' e espaços trocados por hífen)."""
    nome = nome.strip().lstrip("#").lower()
    nome = re.sub(r"\s+", "-", nome)
    return _CARACTERES_INVALIDOS_RE.sub("", nome)


def get_or_create_tags(company_id, nomes) -> list[Tag]:
    """Recebe nomes livres (com ou sem '#') e devolve as Tag correspondentes,
    criando as que ainda não existem pra essa empresa."""
    tags = []
    vistos = set()
    for nome_bruto in nomes:
        nome = normalizar_nome(str(nome_bruto))
        if not nome or nome in vistos:
            continue
        vistos.add(nome)
        tag, _ = Tag.objects.get_or_create(company_id=company_id, nome=nome)
        tags.append(tag)
    return tags


def registrar_mudanca_tags(user, alvo, antes: set, depois: set):
    """Loga em Atividade quais tags entraram/saíram de `alvo` (Vaga|Candidato)."""
    from apps.atividade import services as atividade_services

    adicionadas = depois - antes
    removidas = antes - depois
    if adicionadas:
        atividade_services.registrar(
            user, "adicionou_tag", alvo, resumo=f"adicionou tag(s): {', '.join(sorted(adicionadas))}"
        )
    if removidas:
        atividade_services.registrar(
            user, "removeu_tag", alvo, resumo=f"removeu tag(s): {', '.join(sorted(removidas))}"
        )
