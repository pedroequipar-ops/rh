from django.db import migrations
from django.utils import timezone


def recebendo_para_publicada(apps, schema_editor):
    Vaga = apps.get_model("vagas", "Vaga")
    now = timezone.now()
    for vaga in Vaga.objects.filter(status="RECEBENDO"):
        vaga.status = "PUBLICADA"
        if vaga.publicada_em is None:
            vaga.publicada_em = now
        vaga.save(update_fields=["status", "publicada_em", "updated_at"])
    Vaga.objects.filter(status_pre_congelamento="RECEBENDO").update(
        status_pre_congelamento="PUBLICADA"
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("vagas", "0007_alter_vaga_status"),
    ]

    operations = [
        migrations.RunPython(recebendo_para_publicada, noop),
    ]
