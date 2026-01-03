import math
import asyncio
import json
from datetime import datetime, date, timedelta, time
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

from ..config import settings
from ..schemas import PanchangData
from .sharepoint_client import SharePointClientStub
from .timezone_alias_helper import TimezoneAliasHelper


def _clamp(val: float, low: float, high: float) -> float:
    return max(low, min(high, val))


class PanchangService:
    """
    Deterministic, lightweight Panchangam computation (Phase 1 placeholder).

    This does NOT rely on external APIs. It produces reasonable, repeatable windows
    derived from date, lat/lon, and timezone. Astronomical accuracy is approximate
    but stable and monotonic so the UI has consistent data to render.
    """

    def __init__(self, sharepoint: SharePointClientStub):
        self.sharepoint = sharepoint
        self.tz_helper = TimezoneAliasHelper(sharepoint)
        self._guess_aliases = {
            "asia/chennai": "Asia/Kolkata",
            "asia/calcutta": "Asia/Kolkata",
            "ist": "Asia/Kolkata",
            "pst": "America/Los_Angeles",
            "pdt": "America/Los_Angeles",
            "est": "America/New_York",
            "edt": "America/New_York",
            "cst": "America/Chicago",
            "cdt": "America/Chicago",
            "mst": "America/Denver",
            "mdt": "America/Denver",
            "bst": "Europe/London",
            "cet": "Europe/Berlin",
            "cest": "Europe/Berlin",
            "aest": "Australia/Sydney",
            "aedt": "Australia/Sydney",
            "nzst": "Pacific/Auckland",
            "hkt": "Asia/Hong_Kong",
            "sgt": "Asia/Singapore",
            "wib": "Asia/Jakarta",
        }
        self._openai_client: Optional[OpenAI] = None
        self._fallback_tz = "UTC"

    def _compute_day_lengths(self, target_date: date, lat: float) -> float:
        # Simple seasonality approximation using declination cosine curve.
        day_num = target_date.timetuple().tm_yday
        lat_rad = math.radians(lat)
        seasonal = math.cos(2 * math.pi * (day_num - 172) / 365.0)
        day_length = 12 + 2.5 * math.cos(lat_rad) * seasonal
        return _clamp(day_length, 8.0, 16.0)

    async def _resolve_timezone(self, tz: str) -> ZoneInfo:
        tz_key = tz.strip()
        alias = await self.sharepoint.get_timezone_alias(tz_key)
        if alias:
            try:
                return ZoneInfo(alias)
            except ZoneInfoNotFoundError:
                pass
        try:
            return ZoneInfo(tz_key)
        except ZoneInfoNotFoundError:
            guess = self._guess_aliases.get(tz_key.lower())
            if guess:
                try:
                    zone = ZoneInfo(guess)
                    await self.sharepoint.upsert_timezone_alias(tz_key, guess)
                    return zone
                except ZoneInfoNotFoundError:
                    pass
            ai_guess = await self._guess_timezone_with_ai(tz_key)
            if ai_guess:
                try:
                    zone = ZoneInfo(ai_guess)
                    await self.sharepoint.upsert_timezone_alias(tz_key, ai_guess)
                    return zone
                except ZoneInfoNotFoundError:
                    pass
            raise ValueError(f"No time zone found with key {tz}")

    async def _timezone_from_coords(self, lat: float, lon: float) -> Optional[str]:
        if OpenAI is None or not settings.openai_api_key:
            return None
        if self._openai_client is None:
            self._openai_client = OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
        prompt = (
            "You map latitude/longitude to an IANA timezone id. "
            "Given numeric lat and lon, respond ONLY with the timezone string. If unsure, respond UNKNOWN."
        )
        try:
            response = await asyncio.to_thread(
                lambda: self._openai_client.responses.create(
                    model=settings.openai_model,
                    input=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": f"lat={lat}, lon={lon}"},
                    ],
                    max_output_tokens=16,
                )
            )
        except Exception:
            return None
        text = ""
        if response and hasattr(response, "output") and response.output:
            for item in response.output:
                if getattr(item, "content", None):
                    text += "".join([seg.text for seg in item.content if hasattr(seg, "text")])
        guess = text.strip()
        if not guess or "UNKNOWN" in guess.upper():
            return None
        return guess.split()[0]

    def _base_times(self, target_date: date, tz: ZoneInfo, day_length_hours: float) -> Dict[str, datetime]:
        # Center day around 12:00 local; derive sunrise/sunset.
        noon = datetime.combine(target_date, time(12, 0), tzinfo=tz)
        half_day = timedelta(hours=day_length_hours / 2)
        sunrise = noon - half_day
        sunset = noon + half_day
        next_sunrise = sunrise + timedelta(days=1)
        return {"sunrise": sunrise, "sunset": sunset, "nextSunrise": next_sunrise}

    def _segment_window(self, sunrise: datetime, sunset: datetime, segment_index: int) -> Dict[str, datetime]:
        # Segment indices are 1-based per spec.
        day_length = sunset - sunrise
        seg = day_length / 8
        start = sunrise + seg * (segment_index - 1)
        end = start + seg
        return {"start": start, "end": end}

    def _map_rahu_windows(self, weekday: int, sunrise: datetime, sunset: datetime):
        # weekday: Monday=0
        mapping = {0: 2, 1: 7, 2: 5, 3: 6, 4: 4, 5: 3, 6: 8}
        seg = mapping.get(weekday, 2)
        return [self._segment_window(sunrise, sunset, seg)]

    def _map_yamagandam(self, weekday: int, sunrise: datetime, sunset: datetime):
        mapping = {0: 4, 1: 3, 2: 2, 3: 1, 4: 7, 5: 6, 6: 5}
        seg = mapping.get(weekday, 4)
        return [self._segment_window(sunrise, sunset, seg)]

    def _map_gulikai(self, weekday: int, sunrise: datetime, sunset: datetime):
        mapping = {0: 6, 1: 5, 2: 4, 3: 3, 4: 2, 5: 1, 6: 7}
        seg = mapping.get(weekday, 6)
        return [self._segment_window(sunrise, sunset, seg)]

    def _brahma_muhurta(self, sunrise: datetime):
        start = sunrise - timedelta(minutes=96)
        end = sunrise - timedelta(minutes=48)
        return [{"start": start, "end": end}]

    def _abhijit_muhurta(self, sunrise: datetime, sunset: datetime):
        length = sunset - sunrise
        half_window = length / 30
        mid = sunrise + length / 2
        return [{"start": mid - half_window, "end": mid + half_window}]

    def _durmuhurtam(self, weekday: int, sunrise: datetime, sunset: datetime, next_sunrise: datetime):
        day_ghati = (sunset - sunrise) / 30
        night_ghati = (next_sunrise - sunset) / 30
        windows: List[Dict[str, datetime]] = []

        def add(offset, duration, phase="day", night=False):
            base = sunset if night else sunrise
            start = base + (night_ghati if night else day_ghati) * offset
            end = start + (night_ghati if night else day_ghati) * duration
            windows.append({"start": start, "end": end, "phase": phase})

        if weekday == 6:  # Sunday index=6? actually Monday=0; Sunday=6
            add(0, 4, phase="day")
        elif weekday == 0:  # Monday
            add(16, 2)
            add(22, 2)
        elif weekday == 1:  # Tuesday
            add(6, 2)
            add(14, 2, phase="night", night=True)
        elif weekday == 2:  # Wednesday
            add(14, 2)
        elif weekday == 3:  # Thursday
            add(10, 2)
            add(22, 2)
        elif weekday == 4:  # Friday
            add(6, 2)
            add(22, 2)
        elif weekday == 5:  # Saturday
            add(0, 4)
        return windows

    def _varjyam(self, day_index: int, sunrise: datetime, sunset: datetime):
        # Simplified deterministic window: shift based on day of year to avoid empty data.
        offset_minutes = 60 + (day_index % 120)
        duration = 50
        start = sunrise + timedelta(minutes=offset_minutes)
        end = start + timedelta(minutes=duration)
        return [{"start": start, "end": end, "nakshatra": "Varjyam"}]

    def _format_dt(self, dt: datetime) -> str:
        return dt.isoformat()

    def _format_windows(self, windows: List[Dict[str, datetime]], label: str | None = None, kind: str | None = None):
        formatted = []
        for w in windows:
            entry = {
                "start": self._format_dt(w["start"]),
                "end": self._format_dt(w["end"]),
            }
            if label:
                entry["label"] = label
            if kind:
                entry["kind"] = kind
            if "phase" in w:
                entry["phase"] = w["phase"]
            if "nakshatra" in w:
                entry["nakshatra"] = w["nakshatra"]
            formatted.append(entry)
        return formatted

    async def _guess_timezone_with_ai(self, tz_key: str) -> Optional[str]:
        if OpenAI is None or not settings.openai_api_key:
            return None

        if self._openai_client is None:
            self._openai_client = OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)

        prompt = (
            "You are a helper that maps informal or abbreviated timezone names to canonical IANA timezone identifiers. "
            "Return only the IANA timezone string if you are confident. Examples: IST->Asia/Kolkata, PST->America/Los_Angeles. "
            "If you cannot map, respond with 'UNKNOWN'."
        )
        try:
            response = await asyncio.to_thread(
                lambda: self._openai_client.responses.create(
                    model=settings.openai_model,
                    input=[
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": f"Input: {tz_key}"},
                    ],
                    max_output_tokens=16,
                )
            )
        except Exception:
            return None

        text = ""
        if response and hasattr(response, "output") and response.output:
            for item in response.output:
                if getattr(item, "content", None):
                    text += "".join([seg.text for seg in item.content if hasattr(seg, "text")])
        guess = text.strip()
        if not guess or "UNKNOWN" in guess.upper():
            return None
        return guess.split()[0]

    async def resolve_place_with_ai(self, place: str) -> Optional[dict]:
        if not place:
            return None
        cached = await self.tz_helper.get(place.strip())
        if cached and cached.get("timezone"):
            try:
                tz = cached.get("timezone") or self._fallback_tz
                return {
                    "lat": float(cached.get("lat") or 0.0) if cached.get("lat") else None,
                    "lon": float(cached.get("long") or 0.0) if cached.get("long") else None,
                    "tz": tz,
                    "name": cached.get("title") or place,
                }
            except Exception:
                pass

        result = await self._reverse_geocode_nominatim(place=place)
        if not result:
            return None
        if not result.get("tz"):
            result["tz"] = self._fallback_tz
        await self.tz_helper.upsert(result["name"], result["tz"], str(result["lat"]), str(result["lon"]))
        return result

    async def resolve_place_from_coords(self, lat: float, lon: float) -> Optional[dict]:
        lat_str = f"{lat:.4f}"
        lon_str = f"{lon:.4f}"
        cached = await self.tz_helper.get_by_coords(lat_str, lon_str)
        if cached and cached.get("timezone"):
            try:
                tz = cached.get("timezone") or self._fallback_tz
                return {
                    "lat": float(cached.get("lat") or lat),
                    "lon": float(cached.get("long") or lon),
                    "tz": tz,
                    "name": cached.get("title") or "",
                }
            except Exception:
                pass

        result = await self._reverse_geocode_nominatim(lat=lat, lon=lon)
        if not result:
            return None
        if not result.get("tz"):
            result["tz"] = self._fallback_tz
        await self.tz_helper.upsert(result["name"], result["tz"], lat_str, lon_str)
        return result

    async def _reverse_geocode_nominatim(
        self, place: str | None = None, lat: float | None = None, lon: float | None = None
    ) -> Optional[dict]:
        if place is None and (lat is None or lon is None):
            return None
        try:
            if place:
                url = (
                    "https://nominatim.openstreetmap.org/search?"
                    f"format=jsonv2&limit=1&q={place.replace(' ', '%20')}"
                )
            else:
                url = (
                    "https://nominatim.openstreetmap.org/reverse?"
                    f"format=jsonv2&lat={lat}&lon={lon}&zoom=10"
                )
            import httpx

            async with httpx.AsyncClient(headers={"User-Agent": "astrozone/1.0 (panchang)"}, timeout=8.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
            if place:
                results = data if isinstance(data, list) else data.get("results") or []
                if not results:
                    return None
                data = results[0]
            address = data.get("address", {})
            name_parts = [
                address.get("city") or address.get("town") or address.get("village") or data.get("name"),
                address.get("state") or address.get("region"),
                address.get("country"),
            ]
            label = ", ".join([p for p in name_parts if p])
            out_lat = float(data.get("lat") or lat or 0)
            out_lon = float(data.get("lon") or lon or 0)
            tz = await self._timezone_from_coords(out_lat, out_lon) or self._fallback_tz
            return {"lat": out_lat, "lon": out_lon, "tz": tz, "name": label or place or ""}
        except Exception:
            return None

    async def get_daily_panchangam(
        self, date_str: str, lat: float, lon: float, tz: str, locale: str | None = None, location_name: str | None = None
    ) -> PanchangData:
        target_date = date.fromisoformat(date_str)
        tzinfo: ZoneInfo
        try:
            tzinfo = await self._resolve_timezone(tz)
        except ValueError:
            tz_guess = await self._timezone_from_coords(lat, lon)
            if tz_guess:
                tzinfo = await self._resolve_timezone(tz_guess)
            else:
                raise

        day_length_hours = self._compute_day_lengths(target_date, lat)
        base_times = self._base_times(target_date, tzinfo, day_length_hours)
        sunrise = base_times["sunrise"]
        sunset = base_times["sunset"]
        next_sunrise = base_times["nextSunrise"]

        weekday = target_date.weekday()  # Monday=0
        day_length_minutes = int((sunset - sunrise).total_seconds() // 60)
        night_length_minutes = int((next_sunrise - sunset).total_seconds() // 60)

        # Core windows
        rahu = self._format_windows(self._map_rahu_windows(weekday, sunrise, sunset), label="Rahu Kalam", kind="avoid")
        yama = self._format_windows(self._map_yamagandam(weekday, sunrise, sunset), label="Yamagandam", kind="avoid")
        gulikai = self._format_windows(self._map_gulikai(weekday, sunrise, sunset), label="Gulikai", kind="avoid")
        brahma = self._format_windows(self._brahma_muhurta(sunrise), label="Brahma Muhurta", kind="auspicious")
        abhijit = self._format_windows(self._abhijit_muhurta(sunrise, sunset), label="Abhijit Muhurta", kind="auspicious")
        durmuhurtam = self._format_windows(self._durmuhurtam(weekday, sunrise, sunset, next_sunrise), label="Dur Muhurtam", kind="avoid")
        varjyam = self._format_windows(self._varjyam(target_date.timetuple().tm_yday, sunrise, sunset), label="Varjyam", kind="avoid")

        # Panchanga angas (deterministic cycling)
        tithis = [
            "Pratipada",
            "Dwitiya",
            "Tritiya",
            "Chaturthi",
            "Panchami",
            "Shashthi",
            "Saptami",
            "Ashtami",
            "Navami",
            "Dashami",
            "Ekadashi",
            "Dwadashi",
            "Trayodashi",
            "Chaturdashi",
            "Purnima/Amavasya",
        ]
        nakshatras = [
            "Ashwini",
            "Bharani",
            "Krittika",
            "Rohini",
            "Mrigashirsha",
            "Ardra",
            "Punarvasu",
            "Pushya",
            "Ashlesha",
            "Magha",
            "Purva Phalguni",
            "Uttara Phalguni",
            "Hasta",
            "Chitra",
            "Swati",
            "Vishakha",
            "Anuradha",
            "Jyeshtha",
            "Mula",
            "Purvashada",
            "Uttarashada",
            "Shravana",
            "Dhanishta",
            "Shatabhisha",
            "Purva Bhadrapada",
            "Uttara Bhadrapada",
            "Revati",
        ]
        yogas = ["Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarman", "Dhriti"]
        karanas = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti", "Shakuni", "Chatushpada", "Naga"]

        def pick(seq, offset=0):
            return seq[(target_date.toordinal() + offset) % len(seq)]

        anga_block = lambda name: [{"name": name, "start": sunrise.isoformat(), "end": sunset.isoformat()}]

        data = PanchangData(
            meta={
                "date": target_date.isoformat(),
                "timezone": tz,
                "location": {"lat": lat, "lon": lon, "name": location_name},
                "hinduDay": {"start": sunrise.isoformat(), "end": next_sunrise.isoformat()},
            },
            astronomy={
                "sunrise": sunrise.isoformat(),
                "sunset": sunset.isoformat(),
                "nextSunrise": next_sunrise.isoformat(),
                "dayLengthMinutes": day_length_minutes,
                "nightLengthMinutes": night_length_minutes,
            },
            panchang={
                "vara": {"name": target_date.strftime("%A")},
                "tithi": anga_block(pick(tithis)),
                "nakshatra": anga_block(pick(nakshatras, offset=3)),
                "yoga": anga_block(pick(yogas, offset=5)),
                "karana": anga_block(pick(karanas, offset=7)),
            },
            timings={
                "rahuKalam": rahu,
                "yamagandam": yama,
                "gulikai": gulikai,
                "durmuhurtam": durmuhurtam,
                "varjyam": varjyam,
                "brahmaMuhurta": brahma,
                "abhijitMuhurta": abhijit,
            },
            notes=[
                {
                    "code": "N_WEDDING_SCOPE",
                    "text": "Phase 1 provides time windows only; wedding suitability is evaluated in a later phase.",
                }
            ],
        )
        return data
