from typing import List

from ..schemas import TranslationItem, TranslationResponse
from .sharepoint_client import SharePointClientStub


class TranslationService:
    def __init__(self, sharepoint: SharePointClientStub):
        self.sharepoint = sharepoint

    async def resolve_translations(self, keys: List[str], language: str) -> TranslationResponse:
        cached = await self.sharepoint.get_translations(keys, language)
        cached_keys = list(cached.keys())

        generated: list = []
        translations: list = []
        for key in keys:
            if key in cached:
                translations.append(TranslationItem(**cached[key]))
                continue
            # Placeholder AI translation; replace with LLM call
            synthetic = f"[{language}] {key.replace('.', ' ').title()}"
            stored = await self.sharepoint.upsert_translation(key, language, synthetic)
            translations.append(TranslationItem(**stored))
            generated.append(key)

        correlation_id = f"translations:{language}:{len(keys)}"
        return TranslationResponse(
            correlationId=correlation_id, translations=translations, generated=generated, cached=cached_keys
        )
