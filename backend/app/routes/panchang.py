from fastapi import APIRouter, HTTPException, Query, status

from ..deps import panchang_service
from ..schemas import PanchangData

router = APIRouter(prefix="/panchang", tags=["panchang"])


@router.get("/daily", response_model=PanchangData)
async def daily_panchang(
    date: str = Query(..., description="YYYY-MM-DD"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz: str = Query(..., description="IANA timezone, e.g. Asia/Kolkata"),
    locale: str | None = Query(None),
    locationName: str | None = Query(None, description="Optional resolved location name"),
):
    try:
        return await panchang_service.get_daily_panchangam(
            date_str=date, lat=lat, lon=lon, tz=tz, locale=locale, location_name=locationName
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Panchangam failed: {exc}")


@router.get("/locate")
async def locate_timezone(
    place: str | None = Query(None, description="City/State/Country"),
    lat: float | None = Query(None),
    lon: float | None = Query(None),
):
    data = None
    if place:
        data = await panchang_service.resolve_place_with_ai(place)
    elif lat is not None and lon is not None:
        data = await panchang_service.resolve_place_from_coords(lat, lon)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not resolve location")
    return data
