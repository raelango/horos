from fastapi import APIRouter

from ..schemas import TranslationRequest, TranslationResponse
from ..deps import translation_service

router = APIRouter(prefix="/ui", tags=["translations"])


@router.post("/translations", response_model=TranslationResponse)
async def translate(payload: TranslationRequest):
    return await translation_service.resolve_translations(payload.keys, payload.language)
