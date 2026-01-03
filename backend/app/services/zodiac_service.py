from typing import List

from ..schemas import ZodiacSign
from .sharepoint_client import SharePointClientStub


class ZodiacService:
    def __init__(self, sharepoint: SharePointClientStub):
        self.sharepoint = sharepoint

    async def list_signs(self, methodology: str) -> List[ZodiacSign]:
        records = await self.sharepoint.get_zodiac_signs(methodology)
        return [
            ZodiacSign(
                code=rec.get("code"),
                displayName=rec.get("displayName"),
                english=rec.get("english"),
                tamil=rec.get("tamil"),
                hindi=rec.get("hindi"),
                methodology=methodology,
                sequence=rec.get("sequence"),
            )
            for rec in records
        ]
