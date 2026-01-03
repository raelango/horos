from typing import Optional

from .sharepoint_client import SharePointClientStub


class TimezoneAliasHelper:
    """
    Helper to read/write timezone aliases (Title) with coordinates in SharePoint.
    Uses SharePoint list columns: Title, TimeZone, lat, long.
    """

    def __init__(self, sharepoint: SharePointClientStub):
        self.sharepoint = sharepoint

    async def get(self, title: str) -> Optional[dict]:
        """
        Returns a dict with {title, timezone, lat, long} if found.
        """
        if not title:
            return None
        return await self.sharepoint.get_timezone_alias_record(title)

    async def get_by_coords(self, lat: str, lon: str) -> Optional[dict]:
        """
        Returns a dict with {title, timezone, lat, long} if coordinates match.
        """
        if not lat or not lon:
            return None
        return await self.sharepoint.get_timezone_alias_record_by_coords(lat, lon)

    async def upsert(self, title: str, timezone: str, lat: Optional[str] = None, lon: Optional[str] = None) -> None:
        """
        Upserts a timezone alias record.
        """
        if not title or not timezone:
            return
        await self.sharepoint.upsert_timezone_alias_record(title, timezone, lat, lon)
