import asyncio
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import httpx

from ..config import settings


def _hash_profile(profile: dict) -> str:
  serialized = json.dumps(profile, sort_keys=True)
  return hashlib.sha256(serialized.encode()).hexdigest()


@dataclass
class CachedGuidance:
  cache_key: str
  payload: dict
  created_at: datetime
  expires_at: datetime

  def is_valid(self) -> bool:
    return datetime.utcnow() < self.expires_at


class SharePointClientStub:
  """
  Placeholder SharePoint client.

  Replace with Microsoft Graph interactions:
  - List: GuidanceCache, UiTranslations, UserProfiles, PromptRegistry, ZodiacSigns
  - Auth handled via app registration / client credentials
  """

  def __init__(self):
    self._guidance_cache: Dict[str, CachedGuidance] = {}
    self._translations: Dict[Tuple[str, str], dict] = {}
    self._profiles: Dict[str, dict] = {}
    self._graph_enabled = settings.sharepoint_mode.lower() == "graph"
    self._tenant_id = settings.sharepoint_tenant_id
    self._client_id = settings.sharepoint_client_id
    self._client_secret = settings.sharepoint_client_secret
    self._site_id = settings.sharepoint_site_id
    self._zodiac_list_id = settings.sharepoint_zodiac_list_id
    self._prompt_list_id = settings.sharepoint_prompt_list_id
    self._cache_list_id = settings.sharepoint_cache_list_id
    self._tz_alias_list_id = settings.sharepoint_timezone_alias_list_id
    self._graph_token: Optional[Tuple[str, datetime]] = None
    self._tz_aliases: Dict[str, str] = {
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
    self._tz_alias_records: List[dict] = []
    base_signs = [
      {"code": "ARIES", "displayName": "Aries", "english": "Aries", "sequence": 1},
      {"code": "TAURUS", "displayName": "Taurus", "english": "Taurus", "sequence": 2},
      {"code": "GEMINI", "displayName": "Gemini", "english": "Gemini", "sequence": 3},
      {"code": "CANCER", "displayName": "Cancer", "english": "Cancer", "sequence": 4},
      {"code": "LEO", "displayName": "Leo", "english": "Leo", "sequence": 5},
      {"code": "VIRGO", "displayName": "Virgo", "english": "Virgo", "sequence": 6},
      {"code": "LIBRA", "displayName": "Libra", "english": "Libra", "sequence": 7},
      {"code": "SCORPIO", "displayName": "Scorpio", "english": "Scorpio", "sequence": 8},
      {"code": "SAGITTARIUS", "displayName": "Sagittarius", "english": "Sagittarius", "sequence": 9},
      {"code": "CAPRICORN", "displayName": "Capricorn", "english": "Capricorn", "sequence": 10},
      {"code": "AQUARIUS", "displayName": "Aquarius", "english": "Aquarius", "sequence": 11},
      {"code": "PISCES", "displayName": "Pisces", "english": "Pisces", "sequence": 12},
    ]
    # Placeholder SharePoint "ZodiacSigns" list keyed by methodology
    self._zodiac_signs: Dict[str, List[dict]] = {
      "tamil": base_signs,
      "vedic": base_signs,
      "western": base_signs,
    }

  async def get_cached_guidance(self, cache_key: str) -> Optional[dict]:
    record = self._guidance_cache.get(cache_key)
    if record and record.is_valid():
      return record.payload
    return None

  async def put_cached_guidance(self, cache_key: str, payload: dict, ttl_seconds: int) -> None:
    self._guidance_cache[cache_key] = CachedGuidance(
      cache_key=cache_key,
      payload=payload,
      created_at=datetime.utcnow(),
      expires_at=datetime.utcnow() + timedelta(seconds=ttl_seconds),
    )

  async def get_translations(self, keys: List[str], language: str) -> Dict[str, dict]:
    return {k: self._translations[(k, language)] for k in keys if (k, language) in self._translations}

  async def upsert_translation(self, key: str, language: str, value: str, status: str = "Draft") -> dict:
    data = {"key": key, "language": language, "value": value, "status": status, "lastTranslatedBy": "AI"}
    self._translations[(key, language)] = data
    return data

  async def upsert_profile(self, identifier: str, profile: dict) -> dict:
    self._profiles[identifier] = profile
    return profile

  async def get_profile(self, identifier: str) -> Optional[dict]:
    return self._profiles.get(identifier)

  async def get_or_create_prompt_version(self, methodology: str, period_type: str, language: str) -> str:
    # Placeholder: in SharePoint this would look up PromptRegistry
    return f"{methodology}:{period_type}:{language}:v1"

  async def compute_profile_hash(self, profile: dict) -> str:
    return _hash_profile(profile or {})

  async def audit(self, event_type: str, metadata: dict) -> None:
    # TODO: Persist to SharePoint AuditEvents list
    await asyncio.sleep(0)

  async def get_zodiac_signs(self, methodology: str) -> List[dict]:
    """
    Fetch zodiac signs for a methodology. If SHAREPOINT_MODE=graph, require Graph config
    and surface errors so callers can respond appropriately.
    """
    if self._graph_enabled:
      if not self._graph_configured():
        raise RuntimeError("SharePoint Graph not configured; check tenant/client/site/list IDs.")
      records = await self._get_zodiac_signs_graph(methodology)
      if records:
        return records
      raise RuntimeError("SharePoint returned no zodiac signs for the requested methodology.")

    key = methodology.lower()
    signs = self._zodiac_signs.get(key, self._zodiac_signs.get("western", []))
    return sorted(signs, key=lambda s: s.get("sequence", 0))

  async def get_timezone_alias(self, key: str) -> Optional[str]:
    normalized = key.strip().lower()
    if self._graph_enabled:
      try:
        alias = await self._get_timezone_alias_graph(normalized)
        if alias:
          return alias
      except Exception:
        pass
    return self._tz_aliases.get(normalized)

  async def upsert_timezone_alias(self, key: str, timezone: str) -> None:
    normalized = key.strip().lower()
    self._tz_aliases[normalized] = timezone
    if self._graph_enabled:
      try:
        await self._upsert_timezone_alias_graph(normalized, timezone)
      except Exception:
        return

  async def get_timezone_alias_record(self, key: str) -> Optional[dict]:
    normalized = key.strip().lower()
    if self._graph_enabled:
      try:
        return await self._get_timezone_alias_record_graph(normalized)
      except Exception:
        pass
    tz = self._tz_aliases.get(normalized)
    if tz:
      return {"title": key, "timezone": tz, "lat": None, "long": None}
    return None

  async def get_timezone_alias_record_by_coords(self, lat: str, lon: str) -> Optional[dict]:
    lat_key = lat.strip()
    lon_key = lon.strip()
    if self._graph_enabled:
      try:
        return await self._get_timezone_alias_record_by_coords_graph(lat_key, lon_key)
      except Exception:
        pass
    for rec in self._tz_alias_records:
      if rec.get("lat") == lat_key and rec.get("long") == lon_key:
        return rec
    return None

  async def upsert_timezone_alias_record(self, key: str, timezone: str, lat: Optional[str], lon: Optional[str]) -> None:
    normalized = key.strip().lower()
    self._tz_aliases[normalized] = timezone
    if lat is not None and lon is not None:
      self._tz_alias_records.append({"title": key, "timezone": timezone, "lat": lat, "long": lon})
    if self._graph_enabled:
      try:
        await self._upsert_timezone_alias_record_graph(normalized, timezone, lat, lon)
      except Exception:
        return

  def _graph_configured(self) -> bool:
    return all(
      [
        self._tenant_id,
        self._client_id,
        self._client_secret,
        self._site_id,
        self._zodiac_list_id,
        self._prompt_list_id,
        self._cache_list_id,
      ]
    )

  async def _get_graph_token(self) -> Optional[str]:
    now = datetime.utcnow()
    if self._graph_token and self._graph_token[1] > now + timedelta(seconds=30):
      return self._graph_token[0]
    token_url = f"https://login.microsoftonline.com/{self._tenant_id}/oauth2/v2.0/token"
    data = {
      "client_id": self._client_id,
      "client_secret": self._client_secret,
      "grant_type": "client_credentials",
      "scope": "https://graph.microsoft.com/.default",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
      resp = await client.post(token_url, data=data)
      resp.raise_for_status()
      payload = resp.json()
      access_token = payload["access_token"]
      expires_in = int(payload.get("expires_in", 3600))
      self._graph_token = (access_token, now + timedelta(seconds=expires_in))
      return access_token

  async def _graph_get(self, url: str, params: Optional[dict] = None) -> dict:
    token = await self._get_graph_token()
    headers = {"Authorization": f"Bearer {token}"}
    # HonorNonIndexedQueriesWarningMayFailRandomly allows filtering on non-indexed columns (Methodology)
    headers["Prefer"] = "HonorNonIndexedQueriesWarningMayFailRandomly"
    async with httpx.AsyncClient(timeout=10.0) as client:
      resp = await client.get(url, headers=headers, params=params)
      resp.raise_for_status()
      return resp.json()

  async def _graph_post_item(self, url: str, fields: dict) -> dict:
    token = await self._get_graph_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=10.0) as client:
      resp = await client.post(url, headers=headers, json={"fields": fields})
      resp.raise_for_status()
      return resp.json()

  async def _get_timezone_alias_graph(self, key: str) -> Optional[str]:
    if not self._tz_alias_list_id:
      return None
    base_url = f"https://graph.microsoft.com/v1.0/sites/{self._site_id}/lists/{self._tz_alias_list_id}/items"
    params = {
      "$top": 1,
      "$expand": "fields($select=Title,TimeZone)",
      "$filter": f"fields/Title eq '{key}'",
    }
    data = await self._graph_get(base_url, params=params)
    items = data.get("value", [])
    if not items:
      return None
    fields = items[0].get("fields", {})
    return fields.get("TimeZone")

  async def _get_timezone_alias_record_graph(self, key: str) -> Optional[dict]:
    if not self._tz_alias_list_id:
      return None
    base_url = f"https://graph.microsoft.com/v1.0/sites/{self._site_id}/lists/{self._tz_alias_list_id}/items"
    params = {
      "$top": 1,
      "$expand": "fields($select=Title,TimeZone,lat,long)",
      "$filter": f"fields/Title eq '{key}'",
    }
    data = await self._graph_get(base_url, params=params)
    items = data.get("value", [])
    if not items:
      return None
    fields = items[0].get("fields", {})
    return {"title": fields.get("Title"), "timezone": fields.get("TimeZone"), "lat": fields.get("lat"), "long": fields.get("long")}

  async def _get_timezone_alias_record_by_coords_graph(self, lat: str, lon: str) -> Optional[dict]:
    if not self._tz_alias_list_id:
      return None
    base_url = f"https://graph.microsoft.com/v1.0/sites/{self._site_id}/lists/{self._tz_alias_list_id}/items"
    params = {
      "$top": 1,
      "$expand": "fields($select=Title,TimeZone,lat,long)",
      "$filter": f"fields/lat eq '{lat}' and fields/long eq '{lon}'",
    }
    data = await self._graph_get(base_url, params=params)
    items = data.get("value", [])
    if not items:
      return None
    fields = items[0].get("fields", {})
    return {"title": fields.get("Title"), "timezone": fields.get("TimeZone"), "lat": fields.get("lat"), "long": fields.get("long")}

  async def _upsert_timezone_alias_graph(self, key: str, timezone: str) -> None:
    if not self._tz_alias_list_id:
      return
    existing = await self._get_timezone_alias_graph(key)
    if existing:
      return
    base_url = f"https://graph.microsoft.com/v1.0/sites/{self._site_id}/lists/{self._tz_alias_list_id}/items"
    await self._graph_post_item(base_url, {"Title": key, "TimeZone": timezone})

  async def _upsert_timezone_alias_record_graph(self, key: str, timezone: str, lat: Optional[str], lon: Optional[str]) -> None:
    if not self._tz_alias_list_id:
      return
    base_url = f"https://graph.microsoft.com/v1.0/sites/{self._site_id}/lists/{self._tz_alias_list_id}/items"
    await self._graph_post_item(base_url, {"Title": key, "TimeZone": timezone, "lat": lat, "long": lon})

  async def _get_zodiac_signs_graph(self, methodology: str) -> List[dict]:
    base_url = f"https://graph.microsoft.com/v1.0/sites/{self._site_id}/lists/{self._zodiac_list_id}/items"
    params = {
      "$top": 200,
      "$expand": "fields($select=Title,English,Tamil,Hindi,Sequence,Methodology)",
      "$filter": f"fields/Methodology eq '{methodology}'",
      "$orderby": "fields/Sequence asc",
    }
    try:
      data = await self._graph_get(base_url, params=params)
    except httpx.HTTPStatusError as exc:
      detail = exc.response.text
      raise RuntimeError(f"Graph returned {exc.response.status_code}: {detail}") from exc
    except httpx.RequestError as exc:
      raise RuntimeError(f"Graph request failed: {exc}") from exc
    items = data.get("value", [])
    records: List[dict] = []
    for item in items:
      fields = item.get("fields", {})
      code = fields.get("Title")
      method = fields.get("Methodology") or methodology
      english = fields.get("English")
      tamil = fields.get("Tamil")
      hindi = fields.get("Hindi")
      sequence = fields.get("Sequence")
      display = code
      if code:
        records.append(
          {
            "code": code,
            "displayName": display,
            "english": english,
            "tamil": tamil,
            "hindi": hindi,
            "methodology": method,
            "sequence": sequence,
          }
        )
    return records

  async def get_prompt_template(self, methodology: str) -> Optional[dict]:
    """
    Fetch the active prompt template for the given methodology.
    """
    if self._graph_enabled:
      if not self._graph_configured():
        raise RuntimeError("SharePoint Graph not configured; check tenant/client/site/list IDs.")
      return await self._get_prompt_template_graph(methodology)

    # Stub prompt
    return {
      "title": "Generic Astrology Assistant",
      "version": 1,
      "methodology": methodology,
      "text": "You are an astrology assistant. Provide general guidance for the requested sign.",
      "active": True,
    }

  async def _get_prompt_template_graph(self, methodology: str) -> Optional[dict]:
    base_url = f"https://graph.microsoft.com/v1.0/sites/{self._site_id}/lists/{self._prompt_list_id}/items"
    params = {
      "$top": 1,
      "$expand": "fields($select=Title,PromptVersion,PromptId,PromptText,Active,Methodology)",
      "$filter": f"fields/Title eq 'Generic Astrology Assistant' and fields/Methodology eq '{methodology}' and fields/Active eq 1",
    }
    try:
      data = await self._graph_get(base_url, params=params)
    except httpx.HTTPStatusError as exc:
      detail = exc.response.text
      raise RuntimeError(f"Graph returned {exc.response.status_code}: {detail}") from exc
    except httpx.RequestError as exc:
      raise RuntimeError(f"Graph request failed: {exc}") from exc

    items = data.get("value", [])
    if not items:
      return None
    fields = items[0].get("fields", {})
    return {
      "title": fields.get("Title"),
      "version": fields.get("PromptVersion"),
      "promptId": fields.get("PromptId"),
      "text": fields.get("PromptText"),
      "active": fields.get("Active"),
      "methodology": fields.get("Methodology"),
    }

  async def get_cached_guidance_batch(
    self, methodology: str, title: str, start_date: str, end_date: str, zodiac_signs: str
  ) -> Optional[dict]:
    if not self._graph_enabled:
      return None
    base_url = f"https://graph.microsoft.com/v1.0/sites/{self._site_id}/lists/{self._cache_list_id}/items"
    params = {
      "$top": 1,
      "$expand": "fields($select=Title,HoroscopeMethod,StartDate,EndDate,Output,ZodiacSigns)",
      "$filter": (
        f"fields/HoroscopeMethod eq '{methodology}' "
        f"and fields/StartDate eq '{start_date}' and fields/EndDate eq '{end_date}' "
        f"and fields/ZodiacSigns eq '{zodiac_signs}'"
      ),
    }
    try:
      data = await self._graph_get(base_url, params=params)
    except Exception:
      return None
    items = data.get("value", [])
    if not items:
      return None
    fields = items[0].get("fields", {})
    output = fields.get("Output")
    if not output:
      return None
    try:
      return json.loads(output)
    except Exception:
      return None

  async def put_cached_guidance_batch(
    self, methodology: str, title: str, start_date: str, end_date: str, zodiac_signs: str, payload: dict
  ) -> None:
    if not self._graph_enabled:
      return
    base_url = f"https://graph.microsoft.com/v1.0/sites/{self._site_id}/lists/{self._cache_list_id}/items"
    fields = {
      "Title": title,
      "HoroscopeMethod": methodology,
      "StartDate": start_date,
      "EndDate": end_date,
      "ZodiacSigns": zodiac_signs,
      "Output": json.dumps(payload),
    }
    try:
      await self._graph_post_item(base_url, fields)
    except Exception:
      return
