from django.db import migrations

_ETAPAS_COM_CADASTRO = {
    "Perfil Comportamental",
    "Prova Prática",
    "Entrevista com Gestor",
    "Contratado",
    "Reprovado/Cancelada",
}


def backfill(apps, schema_editor):
    EtapaKanban = apps.get_model("vagas", "EtapaKanban")
    Vaga = apps.get_model("vagas", "Vaga")

    for etapa in EtapaKanban.objects.all():
        exige = etapa.nome in _ETAPAS_COM_CADASTRO or etapa.ordem >= 2
        if exige != etapa.exige_cadastro_completo:
            etapa.exige_cadastro_completo = exige
            etapa.save(update_fields=["exige_cadastro_completo"])

    for vaga in Vaga.objects.filter(status="EM_TRIAGEM", etapa_atual__isnull=True):
        etapa = (
            EtapaKanban.objects.filter(
                company_id=vaga.company_id,
                is_saida_negativa=False,
                exige_cadastro_completo=False,
            )
            .order_by("ordem")
            .first()
        )
        if etapa is not None:
            vaga.etapa_atual = etapa
            vaga.save(update_fields=["etapa_atual"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("vagas", "0005_etapakanban_exige_cadastro_completo_vaga_etapa_atual_and_more"),
    ]

    operations = [migrations.RunPython(backfill, noop)]
