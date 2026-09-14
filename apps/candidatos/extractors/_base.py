from django.conf import settings
from openai import OpenAI


class _BaseGroqExtractor:
    """Configuração de cliente compartilhada por todo extractor que fala com
    a Groq (compatível OpenAI). Ver ``groq_extractor.py``/``groq_triagem_extractor.py``."""

    def __init__(self):
        self.client = OpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
        self.model = settings.GROQ_MODEL
