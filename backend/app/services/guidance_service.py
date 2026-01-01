import calendar
import json
from datetime import date, timedelta
import asyncio
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, status

from ..config import settings
from ..schemas import (
    GuidanceBatchResponse,
    GuidanceCategory,
    GuidanceContext,
    GuidanceGeneralItem,
    GuidanceResponse,
    PreferenceSnapshot,
    Profile,
)
from .sharepoint_client import SharePointClientStub

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


class GuidanceService:
    def __init__(self, sharepoint: SharePointClientStub):
        self.sharepoint = sharepoint
        self._openai_client = None

    async def _build_cache_key(
        self,
        methodology: str,
        language: str,
        sign: str,
        period_type: str,
        start_date: date,
        end_date: date,
        category_bundle: Optional[str],
        personalized: bool,
        profile: Optional[Profile],
    ) -> str:
        profile_hash = (
            await self.sharepoint.compute_profile_hash(profile.model_dump()) if personalized and profile else "anon"
        )
        prompt_version = await self.sharepoint.get_or_create_prompt_version(methodology, period_type, language)
        bundle = category_bundle or "default"
        return ":".join(
            [
                methodology,
                language,
                sign,
                period_type,
                start_date.isoformat(),
                end_date.isoformat(),
                bundle,
                prompt_version,
                "personalized" if personalized else "generic",
                profile_hash,
            ]
        )

    async def _fallback_generate(
        self, context: GuidanceContext, category_bundle: str, profile: Optional[Profile]
    ) -> List[GuidanceCategory]:
        base_text = (
            f"{context.methodology.title()} guidance for {context.sign} from {context.startDate} to {context.endDate}."
        )
        return [
            GuidanceCategory(categoryKey="summary", text=f"{base_text} Focus on balance and planning."),
            GuidanceCategory(
                categoryKey="opportunities", text="Look for collaboration opportunities; share your ideas early."
            ),
            GuidanceCategory(categoryKey="watchouts", text="Avoid overcommitting; pace your commitments."),
        ]

    async def get_guidance(
        self,
        preferences: PreferenceSnapshot,
        sign: str,
        period_type: str,
        start_date: date,
        end_date: date,
        category_bundle: Optional[str],
        personalized: bool,
        profile: Optional[Profile],
    ) -> GuidanceResponse:
        if start_date < date.today():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Past periods are not allowed.")
        if period_type.lower() == "year" and personalized:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Personalized yearly guidance deferred.")

        context = GuidanceContext(
            methodology=preferences.methodology,
            language=preferences.language,
            sign=sign,
            periodType=period_type,
            startDate=start_date,
            endDate=end_date,
            isPersonalized=personalized,
            categoryBundle=category_bundle or "default",
            promptVersion=await self.sharepoint.get_or_create_prompt_version(
                preferences.methodology, period_type, preferences.language
            ),
        )

        cache_key = await self._build_cache_key(
            methodology=context.methodology,
            language=context.language,
            sign=sign,
            period_type=period_type,
            start_date=start_date,
            end_date=end_date,
            category_bundle=category_bundle,
            personalized=personalized,
            profile=profile,
        )

        cached = await self.sharepoint.get_cached_guidance(cache_key)
        if cached:
            categories = [GuidanceCategory(**item) for item in cached["categories"]]
            return GuidanceResponse(correlationId=cached["correlationId"], context=context, categories=categories)

        categories = await self._fallback_generate(context, category_bundle or "default", profile)

        payload = {
            "correlationId": cache_key,
            "categories": [c.model_dump() for c in categories],
        }
        ttl_seconds = self._determine_ttl(period_type)
        await self.sharepoint.put_cached_guidance(cache_key, payload, ttl_seconds=ttl_seconds)
        return GuidanceResponse(correlationId=cache_key, context=context, categories=categories)

    def _determine_ttl(self, period_type: str) -> int:
        period = period_type.lower()
        if period in ("today", "day", "tomorrow"):
            return 60 * 60 * 24
        if period == "week":
            return 60 * 60 * 24 * 7
        if period == "month":
            return 60 * 60 * 24 * 31
        if period == "year":
            return 60 * 60 * 24 * 365
        return 60 * 60 * 24

    def _compute_period_range(self, period_type: str) -> Tuple[date, date]:
        """
        Returns (start_date, end_date) for supported period strings:
        today, tomorrow, this week, next week, this month, next month.
        Defaults to today on unknown input.
        """
        p = (period_type or "today").strip().lower()
        today = date.today()

        if p == "tomorrow":
            start = today + timedelta(days=1)
            end = start
        elif p in ("this week", "week", "current week"):
            start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=6)
        elif p == "next week":
            start = today - timedelta(days=today.weekday()) + timedelta(days=7)
            end = start + timedelta(days=6)
        elif p in ("this month", "month", "current month"):
            start = today.replace(day=1)
            last_day = calendar.monthrange(today.year, today.month)[1]
            end = today.replace(day=last_day)
        elif p == "next month":
            if today.month == 12:
                year = today.year + 1
                month = 1
            else:
                year = today.year
                month = today.month + 1
            start = date(year, month, 1)
            last_day = calendar.monthrange(year, month)[1]
            end = date(year, month, last_day)
        elif p in ("this quarter", "current quarter", "quarter"):
            quarter = (today.month - 1) // 3
            start_month = quarter * 3 + 1
            start = date(today.year, start_month, 1)
            end_month = start_month + 2
            end_day = calendar.monthrange(today.year, end_month)[1]
            end = date(today.year, end_month, end_day)
        elif p == "next quarter":
            quarter = (today.month - 1) // 3 + 1
            year = today.year
            if quarter >= 4:
                quarter = 0
                year += 1
            start_month = quarter * 3 + 1
            start = date(year, start_month, 1)
            end_month = start_month + 2
            end_day = calendar.monthrange(year, end_month)[1]
            end = date(year, end_month, end_day)
        else:
            start = today
            end = today

        return start, end

    async def get_guidance_for_all(self, methodology: str, language: str, period_type: str):
        signs = await self.sharepoint.get_zodiac_signs(methodology)
        if not signs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No zodiac signs available for the specified methodology.",
            )

        prompt = await self.sharepoint.get_prompt_template(methodology)
        if not prompt or not prompt.get("active"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No active prompt found for the requested methodology.",
            )
        prompt_id = prompt.get("promptId")
        prompt_version = prompt.get("version")
        if not prompt_id:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No prompt identifier found for the requested methodology.",
            )

        sign_codes = [s["code"] for s in signs]
        # Always use English names when sending to OpenAI
        sign_prompt_names: List[str] = []
        for s in signs:
            if s.get("english"):
                sign_prompt_names.append(s["english"])
            elif s.get("displayName"):
                sign_prompt_names.append(s["displayName"])
            else:
                sign_prompt_names.append(s["code"])

        start_dt, end_dt = self._compute_period_range(period_type)
        start_date = start_dt.isoformat()
        end_date = end_dt.isoformat()
        # Title is stored but not used for filtering; omit language to avoid cache misses.
        title = period_type
        zodiac_signs = ",".join(sign_prompt_names)

        cached = await self.sharepoint.get_cached_guidance_batch(
            methodology=methodology, title=title, start_date=start_date, end_date=end_date, zodiac_signs=zodiac_signs
        )

        raw_content: Optional[object] = None
        if cached is not None:
            raw_content = cached
            if isinstance(raw_content, str):
                try:
                    raw_content = json.loads(raw_content)
                except Exception:
                    # leave as string if parsing fails
                    pass
        else:
            _, raw_content = await self._invoke_openai_agent_batch(
                sign_codes=sign_codes,
                sign_prompt_names=sign_prompt_names,
                language=language,
                methodology=methodology,
                prompt_id=prompt_id,
                period_type=period_type,
                start_date=start_date,
                end_date=end_date,
            )
            cache_payload = raw_content
            await self.sharepoint.put_cached_guidance_batch(
                methodology=methodology,
                title=title,
                start_date=start_date,
                end_date=end_date,
                zodiac_signs=zodiac_signs,
                payload=cache_payload,
            )
            if isinstance(raw_content, str):
                try:
                    raw_content = json.loads(raw_content)
                except Exception:
                    pass

        if raw_content is None:
            return {"detail": "No guidance returned."}
        return raw_content

    async def _invoke_openai_agent_batch(
        self,
        sign_codes: List[str],
        sign_prompt_names: List[str],
        language: str,
        methodology: str,
        prompt_id: str,
        period_type: str,
        start_date: str,
        end_date: str,
    ) -> Tuple[Dict[str, str], Optional[str]]:
        if OpenAI is None or not settings.openai_api_key:
            base = {
                "en": "General guidance",
                "ta": "General guidance",
                "hi": "General guidance",
            }.get(language, "General guidance")
            summaries = {code: f"{base} for {code} using {methodology}." for code in sign_codes}
            return summaries, None

        if self._openai_client is None:
            self._openai_client = OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)

        user_content = (
            f"HOROSCOPE_METHOD={methodology}. START_DATE={start_date}. END_DATE={end_date}. "
            f"ZODIAC_SIGNS={','.join(sign_prompt_names)}. "
            "Respond with json."
        )

        if not hasattr(self._openai_client, "responses"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="OpenAI client does not support responses API. Please upgrade backend openai package.",
            )

        def call_openai():
            return self._openai_client.responses.create(
                model=settings.openai_model,
                prompt={"id": prompt_id},
                input=[
                    {
                        "role": "user",
                        "content": [{"type": "input_text", "text": user_content}],
                    }
                ],
                text={"format": {"type": "json_object"}},
            )

        attempt = 0
        response = None
        while attempt < 2 and response is None:
            try:
                response = await asyncio.to_thread(call_openai)
            except Exception as exc:
                attempt += 1
                if attempt < 2:
                    await asyncio.sleep(0.5)
                else:
                    req_id = getattr(exc, "request_id", None)
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"OpenAI responses.create failed (req_id={req_id}): {exc}",
                    ) from exc

        content: Optional[str] = None
        try:
            if getattr(response, "output", None):
                first = response.output[0]
                if first and getattr(first, "content", None):
                    inner = first.content[0]
                    if inner and getattr(inner, "text", None):
                        content = inner.text
        except Exception:
            content = None
        if not content:
            try:
                content = str(response)
            except Exception:
                content = ""

        fallback = content or "No guidance returned."
        return {}, fallback
