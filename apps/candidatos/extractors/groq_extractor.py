import json

from django.conf import settings
from openai import OpenAI

from apps.core.logger import LoggerEngine

from ..interfaces.i_curriculo_extractor import CandidatoExtraidoDTO, ICurriculoExtractor

log = LoggerEngine(__name__)

SYSTEM_PROMPT = (
    "Você extrai dados de candidatos a partir do texto de um currículo em PDF e "
    "sugere, entre as vagas abertas fornecidas, a que melhor combina com o perfil. "
    "Responda SOMENTE com um JSON válido no formato: "
    '{"nome": str, "email": str, "telefone": str, "cpf": str, "linkedin_url": str, '
    '"vaga_sugerida_id": str ou null, "justificativa": str, "perfil_formacao": str, '
    '"perfil_experiencia": str, "perfil_habilidades": str, "perfil_certificacoes": str}. '
    "Use string vazia quando um campo não for encontrado no currículo. "
    "Só sugira vaga_sugerida_id se houver correspondência clara com alguma das vagas "
    "informadas; caso contrário, use null. "
    "Nos campos de perfil, seja conciso (poucas frases ou tópicos), sem copiar o "
    "currículo inteiro: "
    "perfil_formacao — formação acadêmica e cursos; "
    "perfil_experiencia — experiências profissionais relevantes; "
    "perfil_habilidades — principais habilidades técnicas e ferramentas; "
    "perfil_certificacoes — certificações obtidas."
)


class GroqCurriculoExtractor(ICurriculoExtractor):
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
        self.model = settings.GROQ_MODEL

    def extrair(self, texto_curriculo: str, vagas_abertas: list) -> CandidatoExtraidoDTO:
        vagas_payload = [
            {
                "id": str(vaga["id"]),
                "titulo": vaga.get("titulo", ""),
                "descricao": vaga.get("descricao", ""),
                "requisitos": vaga.get("requisitos", ""),
                "setor": vaga.get("setor", ""),
            }
            for vaga in vagas_abertas
        ]

        user_content = json.dumps(
            {
                "curriculo": texto_curriculo[:12000],
                "vagas_abertas": vagas_payload,
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

        return CandidatoExtraidoDTO(
            nome=data.get("nome") or "",
            email=data.get("email") or "",
            telefone=data.get("telefone") or "",
            cpf=data.get("cpf") or "",
            linkedin_url=data.get("linkedin_url") or "",
            vaga_sugerida_id=data.get("vaga_sugerida_id") or None,
            justificativa=data.get("justificativa") or "",
            perfil_formacao=data.get("perfil_formacao") or "",
            perfil_experiencia=data.get("perfil_experiencia") or "",
            perfil_habilidades=data.get("perfil_habilidades") or "",
            perfil_certificacoes=data.get("perfil_certificacoes") or "",
        )
