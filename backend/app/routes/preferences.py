from fastapi import APIRouter

from ..schemas import PreferenceSnapshot, PreferencesResponse
router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("/effective", response_model=PreferencesResponse)
async def get_effective_preferences(
    language: str = "en",
    methodology: str = "tamil",
    sign: str | None = None,
):
    preferences = PreferenceSnapshot(language=language, methodology=methodology, sign=sign)
    return PreferencesResponse(correlationId="preferences:static", preferences=preferences)
