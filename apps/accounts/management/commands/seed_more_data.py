import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import Company, Setor, User
from apps.atividade.models import AlvoTipo
from apps.candidatos.models import Candidato, CandidatoNotificacao
from apps.tags.models import Tag
from apps.tarefas.models import Tarefa
from apps.vagas.models import EtapaKanban, Vaga, VagaHistoricoStatus, VagaNotificacao


class Command(BaseCommand):
    help = "Engorda o banco de dev com mais vagas, candidatos, tarefas, notificacoes e tags."

    def handle(self, *args, **options):
        company = Company.objects.get(nome="Equipar Eventos")
        setores = list(Setor.objects.filter(company=company))
        rh = User.objects.get(company=company, username="rh")
        financeiro = User.objects.get(company=company, username="financeiro")
        comercial = User.objects.get(company=company, username="comercial")
        criadores = [rh, financeiro, comercial]

        etapas = {e.nome: e for e in EtapaKanban.objects.filter(company=company)}
        triagem = etapas["Triagem"]
        etapas_cadastro = [
            etapas["Perfil Comportamental"],
            etapas["Prova Prática"],
            etapas["Entrevista com Gestor"],
            etapas["Contratado"],
            etapas["Lixeira"],
        ]

        now = timezone.now()

        vagas_extra = [
            ("Rascunho", "RASCUNHO", "Auxiliar de Logistica", {}),
            ("Rascunho", "RASCUNHO", "Supervisor de Producao", {}),
            ("Recusada", "RECUSADA", "Gerente de Vendas", {"recusada_em": now - timedelta(days=5), "motivo_recusa": "Orcamento nao aprovado neste trimestre"}),
            ("Solicitada", "SOLICITADA", "Analista Fiscal", {"solicitada_em": now - timedelta(days=2)}),
            ("Aprovada", "APROVADA", "Analista de Marketing Pleno", {"solicitada_em": now - timedelta(days=6), "aprovada_em": now - timedelta(days=4), "aprovada_por": rh}),
            ("Publicada", "PUBLICADA", "Desenvolvedor Backend Pleno", {"solicitada_em": now - timedelta(days=10), "aprovada_em": now - timedelta(days=9), "publicada_em": now - timedelta(days=8), "aprovada_por": rh}),
            ("Publicada", "PUBLICADA", "Tecnico de Som e Iluminacao", {"solicitada_em": now - timedelta(days=7), "aprovada_em": now - timedelta(days=6), "publicada_em": now - timedelta(days=5), "aprovada_por": rh}),
            ("Congelada", "CONGELADA", "Coordenador Financeiro", {"solicitada_em": now - timedelta(days=20), "aprovada_em": now - timedelta(days=18), "publicada_em": now - timedelta(days=17), "aprovada_por": rh}),
            ("Encerrada", "ENCERRADA", "Recepcionista Bilingue", {"solicitada_em": now - timedelta(days=15), "aprovada_em": now - timedelta(days=14), "publicada_em": now - timedelta(days=13), "encerrada_em": now - timedelta(days=2), "aprovada_por": rh}),
            ("Em triagem", "EM_TRIAGEM", "Auxiliar de Montagem de Eventos", {"solicitada_em": now - timedelta(days=9), "aprovada_em": now - timedelta(days=8), "publicada_em": now - timedelta(days=7), "triagem_iniciada_em": now - timedelta(days=3), "aprovada_por": rh, "etapa_atual": triagem, "qtd_pessoas_fase": 8}),
            ("Cancelada", "CANCELADA", "Estagiario de TI", {"solicitada_em": now - timedelta(days=12), "aprovada_em": now - timedelta(days=11), "aprovada_por": rh}),
            ("Preenchida", "PREENCHIDA", "Assistente de Marketing", {"solicitada_em": now - timedelta(days=25), "aprovada_em": now - timedelta(days=23), "publicada_em": now - timedelta(days=22), "fechada_em": now - timedelta(days=1), "aprovada_por": rh}),
        ]

        novas_vagas = []
        for label, status, titulo, campos in vagas_extra:
            setor = random.choice(setores)
            criado_por = random.choice(criadores)
            vaga = Vaga.objects.create(
                company=company,
                titulo=titulo,
                descricao=f"Vaga de demonstracao ({label}) gerada para popular o board.",
                requisitos="Requisitos de exemplo para dados de teste.",
                quantidade_vagas=random.randint(1, 3),
                setor=setor,
                criado_por=criado_por,
                responsavel=rh,
                status=status,
                prioridade=random.choice([1, 2, 2, 3]),
                **campos,
            )
            VagaHistoricoStatus.objects.create(
                company=company,
                vaga=vaga,
                de_status="",
                para_status=status,
                por=criado_por,
                observacao="Criada via seed_more_data",
            )
            novas_vagas.append(vaga)
            self.stdout.write(self.style.SUCCESS(f"Vaga criada: {vaga.titulo} [{status}]"))

        publicadas_e_preenchidas = list(
            Vaga.objects.filter(company=company, status__in=["PUBLICADA", "PREENCHIDA"])
        )
        nomes = [
            "Ana Beatriz Souza", "Bruno Carvalho Lima", "Camila Ferreira", "Diego Martins",
            "Elaine Rodrigues", "Fabio Nogueira", "Gabriela Torres", "Henrique Pires",
            "Isabela Costa", "Joao Vitor Almeida", "Karina Duarte", "Leonardo Bastos",
        ]
        candidatos_criados = 0
        for nome in nomes:
            if not publicadas_e_preenchidas:
                break
            vaga = random.choice(publicadas_e_preenchidas)
            etapa = random.choice(etapas_cadastro)
            slug = nome.lower().replace(" ", ".")
            Candidato.objects.create(
                company=company,
                vaga=vaga,
                etapa_atual=etapa,
                nome=nome,
                email=f"{slug}@exemplo.com",
                telefone="(11) 9" + str(random.randint(1000, 9999)) + "-" + str(random.randint(1000, 9999)),
                perfil_formacao="Formacao de exemplo para dados de teste.",
                perfil_experiencia="Experiencia de exemplo para dados de teste.",
                cadastrado_por=rh,
                responsavel=rh,
            )
            candidatos_criados += 1
        self.stdout.write(self.style.SUCCESS(f"Candidatos criados: {candidatos_criados}"))

        todas_vagas = list(Vaga.objects.filter(company=company))
        todos_candidatos = list(Candidato.objects.filter(company=company))
        tarefas_criadas = 0
        for i in range(6):
            alvo = random.choice(todas_vagas)
            Tarefa.objects.create(
                company=company,
                titulo=f"Follow-up: {alvo.titulo}",
                descricao="Tarefa de exemplo para dados de teste.",
                due_at=now - timedelta(days=random.randint(1, 5)),
                responsavel=random.choice(criadores),
                alvo_tipo=AlvoTipo.VAGA,
                alvo_id=alvo.id,
                criado_por=rh,
            )
            tarefas_criadas += 1
        for i in range(6):
            alvo = random.choice(todas_vagas)
            Tarefa.objects.create(
                company=company,
                titulo=f"Revisar requisitos: {alvo.titulo}",
                descricao="Tarefa de exemplo para dados de teste.",
                due_at=now + timedelta(days=random.randint(1, 10)),
                responsavel=random.choice(criadores),
                alvo_tipo=AlvoTipo.VAGA,
                alvo_id=alvo.id,
                criado_por=rh,
            )
            tarefas_criadas += 1
        if todos_candidatos:
            for i in range(6):
                alvo = random.choice(todos_candidatos)
                done = random.random() < 0.5
                Tarefa.objects.create(
                    company=company,
                    titulo=f"Contatar: {alvo.nome}",
                    descricao="Tarefa de exemplo para dados de teste.",
                    due_at=now + timedelta(days=random.randint(-3, 7)),
                    done_at=now - timedelta(days=1) if done else None,
                    responsavel=random.choice(criadores),
                    alvo_tipo=AlvoTipo.CANDIDATO,
                    alvo_id=alvo.id,
                    criado_por=rh,
                )
                tarefas_criadas += 1
        self.stdout.write(self.style.SUCCESS(f"Tarefas criadas: {tarefas_criadas}"))

        tags_nomes = [("Urgente", "#ef4444"), ("Home Office", "#3b82f6"), ("Bilingue", "#10b981"), ("Senior", "#a855f7")]
        tags = []
        for nome, cor in tags_nomes:
            tag, _ = Tag.objects.get_or_create(company=company, nome=nome, defaults={"cor": cor})
            tags.append(tag)
        for vaga in random.sample(todas_vagas, k=min(6, len(todas_vagas))):
            vaga.tags.add(random.choice(tags))
        for candidato in random.sample(todos_candidatos, k=min(4, len(todos_candidatos))) if todos_candidatos else []:
            candidato.tags.add(random.choice(tags))
        self.stdout.write(self.style.SUCCESS(f"Tags aplicadas."))

        notificacoes_criadas = 0
        for vaga in random.sample(todas_vagas, k=min(5, len(todas_vagas))):
            VagaNotificacao.objects.create(
                company=company,
                destinatario=rh,
                vaga=vaga,
                mensagem=f"Vaga '{vaga.titulo}' precisa de atencao.",
                lida=random.random() < 0.4,
            )
            notificacoes_criadas += 1
        if todos_candidatos:
            for candidato in random.sample(todos_candidatos, k=min(4, len(todos_candidatos))):
                CandidatoNotificacao.objects.create(
                    company=company,
                    destinatario=rh,
                    candidato=candidato,
                    mensagem=f"Candidato '{candidato.nome}' aguardando retorno.",
                    lida=random.random() < 0.4,
                )
                notificacoes_criadas += 1
        self.stdout.write(self.style.SUCCESS(f"Notificacoes criadas: {notificacoes_criadas}"))

        self.stdout.write(self.style.SUCCESS(
            f"Pronto. Total vagas={Vaga.objects.filter(company=company).count()} "
            f"candidatos={Candidato.objects.filter(company=company).count()} "
            f"tarefas={Tarefa.objects.filter(company=company).count()}"
        ))
