from fastapi import APIRouter, HTTPException, status

from ..deps import horoscope_service
from ..schemas import HoroscopeRequest, HoroscopeResponse

router = APIRouter(prefix="/horoscope", tags=["horoscope"])


@router.post("/generate", response_model=HoroscopeResponse)
async def generate_horoscope(req: HoroscopeRequest):
    try:
        return await horoscope_service.generate(
            date=req.date, time=req.time, lat=req.lat, lon=req.lon, tz=req.tz, place_name=req.placeName, language=req.language
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Horoscope failed: {exc}")
