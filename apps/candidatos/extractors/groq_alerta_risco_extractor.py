import json

from apps.core.logger import LoggerEngine

from ..interfaces.i_alerta_risco_extractor import AlertaRiscoDTO, IAlertaRiscoExtractor
from ._base import _BaseGroqExtractor

log = LoggerEngine(__name__)

SYSTEM_PROMPT = (
    "Você redige um alerta curto pro RH sobre uma vaga em risco (prazo estourado). "
    "Vai receber: título da vaga, status atual, quantos dias o prazo já passou, "
    "quantos dias a vaga está parada nesse status, e quantos candidatos ela tem no "
    "momento. Responda SOMENTE com um JSON válido no formato: "
    '{"mensagem": str}. '
    "mensagem: uma frase curta e direta (1-2 linhas), em português, cruzando esses "
    "sinais pra explicar o risco de forma acionável (ex.: prazo estourado há muito "
    "tempo E poucos candidatos é mais urgente que prazo estourado recente com "
    "volume bom). Sem saudação, sem assinatura, direto ao ponto."
)


class GroqAlertaRiscoExtractor(_BaseGroqExtractor, IAlertaRiscoExtractor):
    def redigir(self, contexto: dict) -> AlertaRiscoDTO:
        user_content = json.dumps(contexto, ensure_ascii=False)

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

        return AlertaRiscoDTO(mensagem=data.get("mensagem") or "")
