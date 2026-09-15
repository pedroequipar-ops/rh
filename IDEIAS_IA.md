# Ideias de IA para o sistema RH

Lista de recursos de IA propostos pro sistema, com o que já foi implementado e o que segue como ideia — pra continuar de onde parou em qualquer máquina, mesmo sem o histórico de conversa.

## Implementadas

1. **Triagem de currículos por e-mail** (`apps/triagem_ia/`) — bot lê caixa de e-mail (IMAP manual ou Gmail via "Conectar com Google", OAuth), extrai currículo (PDF/.docx), pontua contra a vaga certa via Groq. RH decide por item: trazer pro funil, banco de talentos ou descartar. Empresa pode conectar quantas caixas quiser ao mesmo tempo, todas lidas e roteadas juntas (sem separar por vaga/setor). Config em **Configurações → Triagem por IA**, que agora também mostra um card "E-mails não roteados" (aparece só quando há algum) pra escolher a vaga manualmente e disparar a pontuação da IA.
   - Descartado por enquanto: tela própria de Banco de Talentos (candidato lá cai misturado na listagem geral) — Pedro pediu pra não mexer nisso por ora.
   - **Problema real achado em 2026-09-15**: a caixa Gmail conectada pra testar o OAuth era o Gmail **pessoal** do Pedro — o worker (`ingerir_emails_triagem`, roda a cada 120s) ingere literalmente todo e-mail que chega nela, sem filtro. 116 de 117 linhas da tabela viraram lixo (notificação do GitHub, Vercel, alerta do Google etc.), todas em "não roteado" com status `ERRO`. Solução escolhida: item 1b abaixo (webhook), não mexer no filtro de ingestão por e-mail em si.

1b. **Webhook pra receber currículo de sistema externo** (`POST /v1/triagem-ia-webhook/curriculo/`, `apps/triagem_ia/services.py::processar_curriculo_webhook`) — implementado 2026-09-15 como substituto de conectar uma caixa de e-mail real. Pensado pro **checkmail** (sistema separado do Pedro, fora deste repo, que já filtra e-mail "importante" e manda pro WhatsApp): quando checkmail decidir que um e-mail é currículo de verdade, ele chama esse endpoint com o arquivo (multipart) em vez do RH precisar ler a caixa toda. Autenticação por token fixo (`TRIAGEM_IA_WEBHOOK_TOKEN` + `TRIAGEM_IA_WEBHOOK_COMPANY_ID` no `.env`, ainda em branco — só uma empresa usa isso, sem multi-tenant). Dali pra frente é o mesmo pipeline de sempre: tag `[VAGA:codigo]` no campo `assunto` roteia automático, senão cai em "não roteado". Idempotente por `message_id` (ou hash do arquivo, se não vier `message_id`) — reenvio não duplica. 7 teste em `apps/triagem_ia/tests/test_webhook.py`.
   - **Pendente, do lado deste repo**: nada — endpoint pronto e testado, só falta configurar o token real quando for ligar o checkmail de verdade.
   - **Pendente, fora deste repo (no checkmail)**: Pedro ainda não descreveu a etapa final de "filtra se é candidato ou não com base no requisito da vaga, mostra os 10 melhores, dá pra descartar os outros" — pode já ser só descrição do que a Triagem por IA deste repo já faz (pontuação + destaque top 10 + decidir), não necessariamente algo novo a construir no checkmail. Não presumir nada até ele detalhar.
   - **Ação recomendada, ainda não feita**: desconectar a caixa Gmail pessoal (`pedro.equipar@gmail.com`) da Triagem por IA quando o webhook do checkmail estiver de pé, e limpar as 116 linhas de lixo do banco de dev.

11. **Busca de candidatos em linguagem natural** (`apps/candidatos/services.py::buscar_candidatos_com_ia`) — RH digita frase livre (ex.: "quem sabe excel avançado e já passou da triagem"), a IA traduz num filtro estruturado (etapa do funil, tags, palavras-chave no perfil) e aplica sobre os candidatos. Disponível em **Configurações → Candidatos cadastrados** e na Listagem do Setor.
   - Importante pra testar: os candidatos do banco de **dev/seed** têm perfil placeholder ("Formação de exemplo para dados de teste") — busca por skill real (ex. "Excel", "React") não vai achar nada até existir currículo de verdade analisado pela IA. Buscar por "experiência de exemplo" no dev prova que a busca funciona.

2. **Resposta automática a candidato descartado** (`apps/candidatos/services.py::gerar_email_reprovacao`, endpoint `POST /candidatos/{id}/gerar-email-reprovacao/`) — gera rascunho de e-mail de feedback usando o `motivo_reprovacao` já registrado no descarte. UI: `EmailReprovacaoPanel.tsx` no `CandidatoDetailPanel`.

6. **Alerta de vaga em risco em linguagem natural** (`apps/vagas/services.py::_redigir_alerta_risco`) — `alertar_vagas_com_prazo_estourado` (cron) agora tenta a IA redigir cruzando dias de atraso, tempo parado no status atual e volume de candidatos; qualquer falha da IA cai pra mensagem fixa de sempre (cron roda sem humano, não pode deixar de notificar).

14. **Tag automática de candidato/vaga** (`apps/candidatos/services.py::sugerir_tags_candidato`, `apps/vagas/services.py::sugerir_tags_vaga`, endpoints `sugerir-tags`) — IA sugere tag a partir do perfil extraído (candidato) ou descrição (vaga). UI: `TagSuggestions.tsx` no `CandidatoDetailPanel` e `VagaDetailPanel`.

## Descartadas / não mencionadas de novo

Da primeira leva: assistente de redação de vaga, perguntas de entrevista sob medida, resumo de histórico do candidato, chat de dúvidas pro setor.

- **8. Detecção de duplicidade de candidato** — implementada e removida de novo: CPF é campo opcional no cadastro e a IA nunca extrai CPF de currículo (não aparece no documento), então checagem por CPF nunca dispara na prática. Sem outro identificador confiável pra dedupe, a ideia não se sustenta.
Da segunda leva: convite de entrevista automático, recomendação de banco de talentos pra vaga nova, checagem de viés na descrição, resumo de entrevista gravada, previsão de prazo de preenchimento, pergunta em linguagem natural sobre o painel.
