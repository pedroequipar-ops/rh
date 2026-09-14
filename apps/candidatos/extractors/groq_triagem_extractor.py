import json

from apps.core.logger import LoggerEngine

from ..interfaces.i_triagem_ia_extractor import CandidatoPontuadoDTO, ITriagemIaExtractor
from ._base import _BaseGroqExtractor

log = LoggerEngine(__name__)

SYSTEM_PROMPT = (
    "Você extrai dados de candidatos a partir do texto de um currículo e avalia o "
    "quanto ele combina com UMA vaga específica (não com uma lista de vagas). "
    "Responda SOMENTE com um JSON válido no formato: "
    '{"nome": str, "email": str, "telefone": str, "cpf": str, "linkedin_url": str, '
    '"score": int de 0 a 100, "justificativa": str, "perfil_formacao": str, '
    '"perfil_experiencia": str, "perfil_habilidades": str, "perfil_certificacoes": str}. '
    "Use string vazia quando um campo não for encontrado no currículo. "
    "O score reflete o quanto o currículo atende à descrição e aos requisitos da "
    "vaga informada (0 = não atende nada, 100 = atende plenamente). "
    "Na justificativa (2 a 4 frases, em português), cite pontos concretos de "
    "aderência e de lacuna em relação à vaga. "
    "Nos campos de perfil, seja conciso (poucas frases ou tópicos), sem copiar o "
    "currículo inteiro: "
    "perfil_formacao — formação acadêmica e cursos; "
    "perfil_experiencia — experiências profissionais relevantes; "
    "perfil_habilidades — principais habilidades técnicas e ferramentas; "
    "perfil_certificacoes — certificações obtidas."
)


class GroqTriagemIaExtractor(_BaseGroqExtractor, ITriagemIaExtractor):
    def pontuar(self, texto_curriculo: str, vaga: dict) -> CandidatoPontuadoDTO:
        user_content = json.dumps(
            {
                "curriculo": texto_curriculo[:12000],
                "vaga": {
                    "titulo": vaga.get("titulo", ""),
                    "descricao": vaga.get("descricao", ""),
                    "requisitos": vaga.get("requisitos", ""),
                },
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

        try:
            score = int(data.get("score") or 0)
        except (TypeError, ValueError):
            score = 0
        score = max(0, min(100, score))

        return CandidatoPontuadoDTO(
            nome=data.get("nome") or "",
            email=data.get("email") or "",
            telefone=data.get("telefone") or "",
            cpf=data.get("cpf") or "",
            linkedin_url=data.get("linkedin_url") or "",
            score=score,
            justificativa=data.get("justificativa") or "",
            perfil_formacao=data.get("perfil_formacao") or "",
            perfil_experiencia=data.get("perfil_experiencia") or "",
            perfil_habilidades=data.get("perfil_habilidades") or "",
            perfil_certificacoes=data.get("perfil_certificacoes") or "",
        )
