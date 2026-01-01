from fastapi import APIRouter, HTTPException, Query, status

from ..deps import zodiac_service
from ..schemas import ZodiacSignListResponse

router = APIRouter(prefix="/zodiac", tags=["zodiac"])


@router.get("/signs", response_model=ZodiacSignListResponse)
async def list_zodiac_signs(methodology: str = Query(..., description="tamil | vedic | western")):
    try:
        signs = await zodiac_service.list_signs(methodology)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch zodiac signs from SharePoint: {exc}",
        )
    correlation_id = f"zodiac:{methodology}:{len(signs)}"
    return ZodiacSignListResponse(correlationId=correlation_id, signs=signs)
