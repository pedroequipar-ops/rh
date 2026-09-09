from django.db import migrations
from django.db.models import Count, Q


def backfill(apps, schema_editor):
    Vaga = apps.get_model("vagas", "Vaga")
    qs = Vaga.objects.annotate(
        _n=Count("candidatos", filter=Q(candidatos__active=True))
    )
    for vaga in qs:
        vaga.solicitada_em = vaga.created_at
        if vaga._n > 0:
            vaga.status = "EM_TRIAGEM"
            vaga.aprovada_em = vaga.created_at
            vaga.publicada_em = vaga.created_at
            vaga.triagem_iniciada_em = vaga.created_at
        else:
            vaga.status = "APROVADA"
            vaga.aprovada_em = vaga.created_at
        vaga.save(
            update_fields=[
                "status",
                "solicitada_em",
                "aprovada_em",
                "publicada_em",
                "triagem_iniciada_em",
            ]
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("vagas", "0003_vaga_aprovada_em_vaga_aprovada_por_vaga_cobrada_em_and_more"),
    ]

    operations = [migrations.RunPython(backfill, noop)]
