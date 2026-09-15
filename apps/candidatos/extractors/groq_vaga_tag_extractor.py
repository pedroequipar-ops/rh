import json

from apps.core.logger import LoggerEngine

from ..interfaces.i_tag_extractor import ITagExtractor, TagsSugeridasDTO
from ._base import _BaseGroqExtractor

log = LoggerEngine(__name__)

SYSTEM_PROMPT = (
    "Você sugere tags curtas pra organizar vagas de um sistema de RH, a partir do "
    "título/descrição/requisitos de uma vaga. Vai receber o perfil da vaga e a lista "
    "de tags que a empresa já usa. Responda SOMENTE com um JSON válido no formato: "
    '{"tags": [str], "interpretacao": str}. '
    "PRIORIDADE MÁXIMA: reaproveite uma tag já existente na lista sempre que ela "
    "combinar com a vaga — só invente uma tag nova quando nenhuma existente servir. "
    "Tags curtas (1-2 palavras), minúsculas, sem acento, no padrão da lista recebida "
    "(ex.: 'remoto', 'urgente', 'senior', 'bilingue'). Sugira no máximo 5. "
    "interpretacao: uma frase curta explicando por que essas tags, pra mostrar pro RH. "
    "Lista vazia se nada da vaga sugerir uma tag clara."
)


class GroqVagaTagExtractor(_BaseGroqExtractor, ITagExtractor):
    def sugerir(self, perfil: dict, tags_existentes: list) -> TagsSugeridasDTO:
        user_content = json.dumps(
            {"perfil": perfil, "tags_existentes": list(tags_existentes)},
            ensure_ascii=False,
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

        return TagsSugeridasDTO(
            tags=data.get("tags") or [],
            interpretacao=data.get("interpretacao") or "",
        )
