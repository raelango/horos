from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Query

from ..schemas import GuidanceBatchResponse, GuidanceResponse, PreferenceSnapshot, Profile
from ..deps import guidance_service

router = APIRouter(prefix="/guidance", tags=["guidance"])


@router.get("", response_model=GuidanceResponse)
async def get_guidance(
    language: str = "en",
    methodology: str = "tamil",
    sign: str = Query(..., description="Zodiac sign code, e.g., ARIES"),
    periodType: str = Query("day", description="day|week|month|year|tomorrow|today"),
    startDate: Optional[date] = None,
    endDate: Optional[date] = None,
    categoryBundle: Optional[str] = None,
    personalized: bool = False,
):
    start = startDate or date.today()
    if periodType.lower() == "tomorrow":
        start = date.today() + timedelta(days=1)
    finish = endDate or start

    preferences = PreferenceSnapshot(language=language, methodology=methodology, sign=sign)

    profile = None
    if personalized:
        # In MVP, caller must supply profile in a real implementation. Here we use a stub.
        profile = Profile(preferredLanguage=language, preferredMethodology=methodology, preferredSign=sign)

    response = await guidance_service.get_guidance(
        preferences=preferences,
        sign=sign,
        period_type=periodType,
        start_date=start,
        end_date=finish,
        category_bundle=categoryBundle,
        personalized=personalized,
        profile=profile,
    )
    return response


@router.get("/all")
async def get_guidance_all(
    language: str = "en",
    methodology: str = "tamil",
    periodType: str = Query("day", description="day|week|month|year|tomorrow|today"),
):
    return await guidance_service.get_guidance_for_all(methodology=methodology, language=language, period_type=periodType)
