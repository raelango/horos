import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Any, Dict, List, Tuple

from .sharepoint_client import SharePointClientStub

try:
    import swisseph as swe  # type: ignore
except Exception:  # pragma: no cover
    swe = None


class HoroscopeService:
    """
    Horoscope generator using Swiss Ephemeris (sidereal, Lahiri ayanamsa).

    House system: Whole Sign houses (common for South Indian/Tamil style).
    """

    def __init__(self, sharepoint: SharePointClientStub):
        self.sharepoint = sharepoint
        self.rasi_names = [
            "Mesha",
            "Vrishabha",
            "Mithuna",
            "Karka",
            "Simha",
            "Kanya",
            "Tula",
            "Vrishchika",
            "Dhanu",
            "Makara",
            "Kumbha",
            "Meena",
        ]
        self.nakshatra_names = [
            "Ashwini",
            "Bharani",
            "Krithika",
            "Rohini",
            "Mrigashira",
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
            "Jyeshta",
            "Moola",
            "Purva Ashadha",
            "Uttara Ashadha",
            "Shravana",
            "Dhanishta",
            "Shatabhisha",
            "Purva Bhadrapada",
            "Uttara Bhadrapada",
            "Revati",
        ]
        # Lord sequence per dasha order for nakshatra
        self.nakshatra_lords = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
        self.rasi_lords = {
            "Mesha": "Mars",
            "Vrishabha": "Venus",
            "Mithuna": "Mercury",
            "Karka": "Moon",
            "Simha": "Sun",
            "Kanya": "Mercury",
            "Tula": "Venus",
            "Vrishchika": "Mars",
            "Dhanu": "Jupiter",
            "Makara": "Saturn",
            "Kumbha": "Saturn",
            "Meena": "Jupiter",
        }

    def _require_ephemeris(self):
        if swe is None:
            raise ValueError("Swiss Ephemeris (pyswisseph) not installed in container.")

    def _parse_datetime(self, date_str: str, time_str: str, tz: str) -> Tuple[datetime, float]:
        try:
            hh, mm, *rest = time_str.split(":")
            ss = int(rest[0]) if rest else 0
            local_dt = datetime(
                int(date_str.split("-")[0]),
                int(date_str.split("-")[1]),
                int(date_str.split("-")[2]),
                int(hh),
                int(mm),
                ss,
                tzinfo=ZoneInfo(tz),
            )
        except ZoneInfoNotFoundError as exc:
            raise ValueError(f"Invalid timezone: {tz}") from exc
        dt_utc = local_dt.astimezone(ZoneInfo("UTC"))
        hour_decimal = dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600
        return dt_utc, hour_decimal

    def _nakshatra(self, lon: float) -> Tuple[str, str, int]:
        span = 360 / 27
        idx = int(lon // span) % 27
        pada = int((lon % span) // (span / 4)) + 1
        lord_idx = idx // 3  # each lord rules 3 nakshatras
        lord = self.nakshatra_lords[lord_idx % len(self.nakshatra_lords)]
        return self.nakshatra_names[idx], lord, pada

    def _rasi_label(self, idx: int, lang: str, short: bool = False) -> str:
        base_en = self.rasi_names[idx]
        if lang == "ta":
            tamil = [
                "மேஷம்",
                "ரிஷபம்",
                "மிதுனம்",
                "கடகம்",
                "சிம்மம்",
                "கன்னி",
                "துலாம்",
                "விருச்சிகம்",
                "தனுசு",
                "மகரம்",
                "கும்பம்",
                "மீனம்",
            ]
            abbr = ["மே", "ரி", "மி", "க", "சி", "கந்", "து", "வி", "த", "ம", "கு", "மீ"]
            return abbr[idx] if short else tamil[idx]
        if lang == "hi":
            hindi = [
                "मेष",
                "वृषभ",
                "मिथुन",
                "कर्क",
                "सिंह",
                "कन्या",
                "तुला",
                "वृश्चिक",
                "धनु",
                "मकर",
                "कुंभ",
                "मीन",
            ]
            abbr = ["मे", "वृ", "मि", "क", "सिं", "कन", "तु", "वृश", "ध", "मक", "कुं", "मीन"]
            return abbr[idx] if short else hindi[idx]
        # English
        abbr_en = ["Ar", "Ta", "Ge", "Ca", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"]
        return abbr_en[idx] if short else base_en

    def _planet_label(self, name: str, lang: str) -> str:
        if lang == "ta":
            mapping = {
                "Sun": "சூ",
                "Moon": "சந்",
                "Mercury": "பு",
                "Venus": "வி",
                "Mars": "செ",
                "Jupiter": "கு",
                "Saturn": "சன",
                "Rahu": "ரா",
                "Ketu": "கே",
                "Ascendant": "லக",
            }
            return mapping.get(name, name[:3])
        if lang == "hi":
            mapping = {
                "Sun": "सू",
                "Moon": "चं",
                "Mercury": "बु",
                "Venus": "शु",
                "Mars": "मं",
                "Jupiter": "गु",
                "Saturn": "श",
                "Rahu": "रा",
                "Ketu": "के",
                "Ascendant": "लग",
            }
            return mapping.get(name, name[:3])
        abbr = {
            "Sun": "Su",
            "Moon": "Mo",
            "Mercury": "Me",
            "Venus": "Ve",
            "Mars": "Ma",
            "Jupiter": "Ju",
            "Saturn": "Sa",
            "Rahu": "Ra",
            "Ketu": "Ke",
            "Ascendant": "Asc",
        }
        return abbr.get(name, name[:3])

    def _navamsa_rasi(self, lon: float, rasi_index: int) -> int:
        # Navamsa rules by modality
        modalities = ["movable", "fixed", "dual", "movable", "fixed", "dual", "movable", "fixed", "dual", "movable", "fixed", "dual"]
        modality = modalities[rasi_index]
        start_sign = {"movable": 0, "fixed": 4, "dual": 8}[modality]
        part = int((lon % 30) // (30 / 9))
        return (start_sign + part) % 12

    def _format_deg(self, lon: float) -> str:
        deg = int(lon)
        minutes_full = (lon - deg) * 60
        minutes = int(minutes_full)
        seconds = int((minutes_full - minutes) * 60)
        return f"{deg}° {minutes:02d}' {seconds:02d}″"

    async def generate(
        self, *, date: str, time: str, lat: float, lon: float, tz: str, place_name: str | None = None, language: str = "en"
    ) -> Dict[str, Any]:
        supported_langs = {"en", "ta", "hi"}
        lang = (language or "en").lower()
        if lang not in supported_langs:
            raise ValueError(f"Unsupported language: {language}")
        self._require_ephemeris()
        swe.set_sid_mode(swe.SIDM_LAHIRI)

        dt_utc, hour_decimal = self._parse_datetime(date, time, tz)
        jd = swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour_decimal)

        # Ascendant via whole-sign houses
        house_cusps, ascmc = swe.houses_ex(jd, lat, lon, b"W")
        asc_lon = ascmc[0]

        planets = {
            "Sun": swe.SUN,
            "Moon": swe.MOON,
            "Mercury": swe.MERCURY,
            "Venus": swe.VENUS,
            "Mars": swe.MARS,
            "Jupiter": swe.JUPITER,
            "Saturn": swe.SATURN,
            "Rahu": swe.MEAN_NODE,
            "Ketu": swe.MEAN_NODE,
        }

        def _calc_lon(body: int) -> float:
            res = swe.calc_ut(jd, body, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)
            if isinstance(res, tuple) and len(res) == 2 and isinstance(res[0], (list, tuple)):
                return float(res[0][0])
            if isinstance(res, (list, tuple)) and len(res) >= 1:
                return float(res[0])
            raise ValueError("Swiss ephemeris calculation failed.")

        placements: List[Dict[str, Any]] = []
        moon_lord = None
        moon_lon = None
        moon_pada = None
        for name, code in planets.items():
            if name == "Ketu":
                # Ketu is 180 deg apart from Rahu (Mean Node)
                base = next((p for p in placements if p["planet"] == "Rahu"), None)
                if not base:
                    lon_sid = _calc_lon(code)
                else:
                    lon_sid = (base["lon"] + 180) % 360
            else:
                lon_sid = _calc_lon(code)
                if name == "Moon":
                    moon_lon = lon_sid
            rasi_idx = int(lon_sid // 30)
            rasi_name_en = self.rasi_names[rasi_idx]
            rasi_name = self._rasi_label(rasi_idx, lang, short=False)
            nak_name, nak_lord, _ = self._nakshatra(lon_sid)
            if name == "Moon":
                moon_lord = nak_lord
            planet_label = self._planet_label(name, lang)
            placements.append(
                {
                    "planet": planet_label,
                    "lon": lon_sid,
                    "position": self._format_deg(lon_sid),
                    "degree": self._format_deg(lon_sid % 30),
                    "rasi": rasi_name,
                    "rasi_en": rasi_name_en,
                    "rasiLord": self.rasi_lords.get(rasi_name_en, ""),
                    "nakshatra": nak_name,
                    "nakshatraLord": nak_lord,
                    "rawPlanet": name,
                    "pada": moon_pada if name == "Moon" else None,
                }
            )

        asc_rasi_idx = int(asc_lon // 30)
        asc_rasi_name_en = self.rasi_names[asc_rasi_idx]
        asc_rasi_name = self._rasi_label(asc_rasi_idx, lang, short=False)
        placements.append(
            {
                "planet": self._planet_label("Ascendant", lang),
                "lon": asc_lon,
                "position": self._format_deg(asc_lon),
                "degree": self._format_deg(asc_lon % 30),
                "rasi": asc_rasi_name,
                "rasi_en": asc_rasi_name_en,
                "rasiLord": self.rasi_lords.get(asc_rasi_name_en, ""),
                "nakshatra": self._nakshatra(asc_lon)[0],
                "nakshatraLord": self._nakshatra(asc_lon)[1],
            }
        )

        # Build rasi and navamsa charts (simple sign buckets)
        def build_chart(entries: List[Dict[str, Any]], mapper):
            buckets: List[List[str]] = [[] for _ in range(12)]
            for item in entries:
                idx = mapper(item)
                buckets[idx].append(item["planet"])
            chart_rows: List[List[Dict[str, str]]] = []
            for i in range(0, 12, 4):
                row = []
                for sign_idx in range(i, i + 4):
                    row.append({"label": self.rasi_names[sign_idx], "bodies": ", ".join(buckets[sign_idx])})
                chart_rows.append(row)
            return chart_rows

        rasi_chart = build_chart(
            placements,
            lambda p: int(p["lon"] // 30),
        )

        navamsa_entries = []
        for p in placements:
            nav_idx = self._navamsa_rasi(p["lon"], int(p["lon"] // 30))
            navamsa_entries.append({**p, "navamsa_index": nav_idx})
        navamsa_chart = build_chart(navamsa_entries, lambda p: p["navamsa_index"])

        summary_label = place_name or f"Lat {lat}, Lon {lon}"
        if lang == "ta":
            summary = f"{date} {time} @ {summary_label} ({tz}) - ஜாதகம் உருவாக்கப்பட்டது"
        elif lang == "hi":
            summary = f"{date} {time} @ {summary_label} ({tz}) - कुंडली तैयार की गई"
        else:
            summary = f"Horoscope generated for {date} {time} @ {summary_label} ({tz}) [{lang}]"

        weekday_map = {
            "en": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            "ta": ["திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி", "ஞாயிறு"],
            "hi": ["सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार"],
        }
        local_dt = dt_utc.astimezone(ZoneInfo(tz))
        weekday_name = weekday_map.get(lang, weekday_map["en"])[local_dt.weekday()]

        label_map = {
            "Ascendant": {"en": "Ascendant", "ta": "லக்கணம்", "hi": "लग्न"},
            "Ascendant Lord": {"en": "Ascendant Lord", "ta": "லக்கண அதிபதி", "hi": "लग्नेश"},
            "Nakshatra": {"en": "Nakshatra", "ta": "நட்சத்திரம்", "hi": "नक्षत्र"},
            "Nakshatra Lord": {"en": "Nakshatra Lord", "ta": "நட்சத்திர அதிபதி", "hi": "नक्षत्र स्वामी"},
            "Weekday": {"en": "Weekday", "ta": "கிழமை", "hi": "वार"},
            "Rasi": {"en": "Rasi", "ta": "ராசி", "hi": "राशि"},
            "Rasi Lord": {"en": "Rasi Lord", "ta": "ராசி அதிபதி", "hi": "राशि स्वामी"},
        }

        def lbl(key: str) -> str:
            return label_map.get(key, {}).get(lang, key)

        birth_details: List[Dict[str, str]] = []

        birth_details.append({"label": lbl("Ascendant"), "value": asc_rasi_name})
        birth_details.append({"label": lbl("Ascendant Lord"), "value": self._planet_label(self.rasi_lords.get(asc_rasi_name_en, ""), lang)})
        birth_details.append({"label": lbl("Weekday"), "value": weekday_name})

        moon_entry = next((p for p in placements if p.get("rawPlanet") == "Moon"), None)
        if moon_entry:
            moon_nak = moon_entry.get("nakshatra")
            moon_pada_val = moon_entry.get("pada")
            moon_nak_label = f"{moon_nak} {moon_pada_val} Pada" if moon_nak and moon_pada_val else moon_nak
            if moon_nak_label:
                birth_details.append({"label": lbl("Nakshatra"), "value": moon_nak_label})
            if moon_entry.get("nakshatraLord"):
                birth_details.append({"label": lbl("Nakshatra Lord"), "value": self._planet_label(moon_entry["nakshatraLord"], lang)})

        birth_details.append({"label": lbl("Rasi"), "value": asc_rasi_name})
        birth_details.append({"label": lbl("Rasi Lord"), "value": self._planet_label(self.rasi_lords.get(asc_rasi_name_en, ""), lang)})

        def _build_mahadasa_plan() -> List[Dict[str, Any]]:
            """Simple Vimshottari schedule using Moon nakshatra lord (localized labels)."""
            order = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
            years = {"Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7, "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17}
            if moon_lord not in order or moon_lon is None:
                return []

            def label(name: str) -> str:
                return self._planet_label(name, lang)

            span_deg = 360 / 27
            frac_used = (moon_lon % span_deg) / span_deg
            frac_remaining = 1 - frac_used
            start_idx = order.index(moon_lord)
            cursor = dt_utc
            schedule: List[Dict[str, Any]] = []
            for i in range(len(order)):
                lord = order[(start_idx + i) % len(order)]
                full_days = years[lord] * 365.25
                days = full_days * (frac_remaining if i == 0 else 1)
                end_dt = cursor + timedelta(days=days)
                bhuktis: List[Dict[str, Any]] = []
                bhukti_cursor = cursor
                for j in range(len(order)):
                    sub_lord = order[j]
                    sub_days = days * (years[sub_lord] / 120.0)
                    sub_end = bhukti_cursor + timedelta(days=sub_days)
                    bhuktis.append(
                        {
                            "name": f"{label(lord)} / {label(sub_lord)}",
                            "start": bhukti_cursor.date().isoformat(),
                            "end": sub_end.date().isoformat(),
                        }
                    )
                    bhukti_cursor = sub_end
                schedule.append(
                    {
                        "name": label(lord),
                        "start": bhuktis[0]["start"],
                        "end": end_dt.date().isoformat(),
                        "bhuktis": bhuktis,
                    }
                )
                cursor = end_dt
                frac_remaining = 1  # only first mahadasa is partial
            return schedule

        return {
            "correlationId": str(uuid.uuid4()),
            "summary": summary,
            "rasiChart": rasi_chart,
            "navamsaChart": navamsa_chart,
            "planetPositions": [
                {
                    "planet": p["planet"],
                    "position": p["position"],
                    "degree": p["degree"],
                    "rasi": p["rasi"],
                    "rasiLord": p["rasiLord"],
                    "nakshatra": p["nakshatra"],
                    "nakshatraLord": p["nakshatraLord"],
                }
                for p in placements
            ],
            "birthDetails": birth_details,
            "meta": {
                "methodology": "tamil",
                "ayanamsa": "Lahiri",
                "houseSystem": "Whole Sign",
                "tz": tz,
                "lat": lat,
                "lon": lon,
                "placeName": place_name or "",
                "ascendant": asc_rasi_name,
                "ascendant_en": asc_rasi_name_en,
                "language": lang,
            },
            "mahadasas": _build_mahadasa_plan(),
        }



