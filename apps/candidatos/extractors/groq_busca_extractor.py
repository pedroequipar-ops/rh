import json

from apps.core.logger import LoggerEngine

from ..interfaces.i_busca_ia_extractor import FiltroBuscaIADTO, IBuscaCandidatosExtractor
from ._base import _BaseGroqExtractor

log = LoggerEngine(__name__)

SYSTEM_PROMPT = (
    "Você traduz uma busca em linguagem natural do RH sobre candidatos em um filtro "
    "estruturado. Vai receber a frase, a lista de etapas do funil da empresa (com "
    "ordem — quanto maior, mais avançado) e a lista de tags existentes. "
    "Responda SOMENTE com um JSON válido no formato: "
    '{"etapa_ids": [str], "etapa_ordem_min": int ou null, "vaga_titulo_contains": str, '
    '"tags": [str], "palavras_chave": [str], "interpretacao": str}. '
    "etapa_ids: use quando a frase citar uma etapa específica pelo nome (ex: \"na "
    "Entrevista\") — IDs exatos da lista de etapas recebida. "
    "etapa_ordem_min: use quando a frase for relativa ao progresso no funil (ex: \"já "
    "passou da triagem\", \"avançados\", \"a partir da entrevista\") — a ordem mínima "
    "que o candidato precisa ter alcançado. \"já passou de X\" / \"depois de X\' "
    "(exclusivo) é a ordem de X mais 1; \"a partir de X\" / \"desde X\" (inclusivo) é a "
    "ordem de X. null se a frase não falar de progresso no funil. "
    "vaga_titulo_contains: trecho do título da vaga, só se a frase citar uma vaga/cargo "
    "específico. "
    "tags: nomes de tags EXATOS da lista recebida que combinem com o que a frase pede. "
    "palavras_chave: termos livres (habilidade, formação, certificação, ferramenta, "
    "cargo anterior etc.) que devem aparecer no perfil do candidato — cada termo é "
    "obrigatório (E lógico entre eles), então quebre em termos curtos e específicos. "
    "interpretacao: uma frase curta e natural explicando o que você entendeu, pra "
    "mostrar pro RH (ex.: 'Habilidade contém \"excel avançado\" e já passou da "
    "etapa Triagem'). "
    "Listas vazias/null quando a frase não pedir aquele critério."
)


class GroqBuscaCandidatosExtractor(_BaseGroqExtractor, IBuscaCandidatosExtractor):
    def interpretar(self, frase: str, etapas: list, tags: list) -> FiltroBuscaIADTO:
        user_content = json.dumps(
            {
                "frase": frase,
                "etapas": [
                    {
                        "id": str(etapa["id"]),
                        "nome": etapa["nome"],
                        "ordem": etapa["ordem"],
                        "is_saida_negativa": etapa["is_saida_negativa"],
                    }
                    for etapa in etapas
                ],
                "tags": list(tags),
            },
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

        return FiltroBuscaIADTO(
            etapa_ids=data.get("etapa_ids") or [],
            etapa_ordem_min=data.get("etapa_ordem_min"),
            vaga_titulo_contains=data.get("vaga_titulo_contains") or "",
            tags=data.get("tags") or [],
            palavras_chave=data.get("palavras_chave") or [],
            interpretacao=data.get("interpretacao") or "",
        )
