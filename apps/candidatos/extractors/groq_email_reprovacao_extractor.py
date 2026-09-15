import json

from apps.core.logger import LoggerEngine

from ..interfaces.i_email_reprovacao_extractor import EmailReprovacaoDTO, IEmailReprovacaoExtractor
from ._base import _BaseGroqExtractor

log = LoggerEngine(__name__)

SYSTEM_PROMPT = (
    "Você redige um rascunho de e-mail de feedback pra um candidato que foi "
    "descartado de um processo seletivo. Vai receber o nome do candidato, o "
    "título da vaga e o motivo do descarte (uso interno do RH). Responda "
    "SOMENTE com um JSON válido no formato: "
    '{"assunto": str, "corpo": str, "interpretacao": str}. '
    "assunto: curto, cita a vaga. "
    "corpo: texto simples (sem HTML), profissional e empático, em português, "
    "agradece o interesse e o tempo investido, informa que o processo seguiu "
    "com outro perfil, adapta o motivo interno numa linguagem construtiva e "
    "respeitosa (sem citar detalhes negativos crus), deseja sucesso, assina "
    "genericamente como 'Equipe de Recrutamento' (sem nome de empresa, o RH "
    "ajusta antes de enviar). Nunca invente informação que não foi dada. "
    "interpretacao: uma frase curta explicando o foco do e-mail, pra mostrar pro RH."
)


class GroqEmailReprovacaoExtractor(_BaseGroqExtractor, IEmailReprovacaoExtractor):
    def redigir(self, candidato: dict, motivo: str) -> EmailReprovacaoDTO:
        user_content = json.dumps(
            {"candidato": candidato, "motivo_interno": motivo}, ensure_ascii=False
        )

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        data = json.loads(raw)

        return EmailReprovacaoDTO(
            assunto=data.get("assunto") or "",
            corpo=data.get("corpo") or "",
            interpretacao=data.get("interpretacao") or "",
        )
