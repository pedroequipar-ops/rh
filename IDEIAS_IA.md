# Ideias de IA para o sistema RH

Lista de recursos de IA propostos pro sistema, com o que já foi implementado e o que segue como ideia — pra continuar de onde parou em qualquer máquina, mesmo sem o histórico de conversa.

## Implementadas

1. **Triagem de currículos por e-mail** (`apps/triagem_ia/`) — bot lê caixa de e-mail (IMAP manual ou Gmail via "Conectar com Google", OAuth), extrai currículo (PDF/.docx), pontua contra a vaga certa via Groq. RH decide por item: trazer pro funil, banco de talentos ou descartar. Empresa pode conectar quantas caixas quiser ao mesmo tempo, todas lidas e roteadas juntas (sem separar por vaga/setor). Config em **Configurações → Triagem por IA**.
   - Pendente: UI pra resolver e-mail "não roteado" (endpoint `/rotear/` já existe, falta tela).
   - Descartado por enquanto: tela própria de Banco de Talentos (candidato lá cai misturado na listagem geral) — Pedro pediu pra não mexer nisso por ora.

11. **Busca de candidatos em linguagem natural** (`apps/candidatos/services.py::buscar_candidatos_com_ia`) — RH digita frase livre (ex.: "quem sabe excel avançado e já passou da triagem"), a IA traduz num filtro estruturado (etapa do funil, tags, palavras-chave no perfil) e aplica sobre os candidatos. Disponível em **Configurações → Candidatos cadastrados** e na Listagem do Setor.
   - Importante pra testar: os candidatos do banco de **dev/seed** têm perfil placeholder ("Formação de exemplo para dados de teste") — busca por skill real (ex. "Excel", "React") não vai achar nada até existir currículo de verdade analisado pela IA. Buscar por "experiência de exemplo" no dev prova que a busca funciona.

## Ainda só ideia (Pedro curtiu, não escolheu qual seguir)

- **2. Resposta automática a candidato descartado** — gerar e-mail de feedback usando o `motivo_reprovacao` já registrado no descarte.
- **6. Alerta de vaga em risco em linguagem natural** — hoje `alertar_prazos_vagas` é regra fixa (cron); a ideia é a IA redigir o alerta cruzando prazo/tempo parado/volume de candidatos.
- **14. Tag automática de candidato/vaga** — IA sugere tag pronta (ex.: "sênior", "remoto", "urgente") a partir do perfil extraído; ainda sem desenho técnico.

## Descartadas / não mencionadas de novo

Da primeira leva: assistente de redação de vaga, perguntas de entrevista sob medida, resumo de histórico do candidato, chat de dúvidas pro setor.

- **8. Detecção de duplicidade de candidato** — implementada e removida de novo: CPF é campo opcional no cadastro e a IA nunca extrai CPF de currículo (não aparece no documento), então checagem por CPF nunca dispara na prática. Sem outro identificador confiável pra dedupe, a ideia não se sustenta.
Da segunda leva: convite de entrevista automático, recomendação de banco de talentos pra vaga nova, checagem de viés na descrição, resumo de entrevista gravada, previsão de prazo de preenchimento, pergunta em linguagem natural sobre o painel.
