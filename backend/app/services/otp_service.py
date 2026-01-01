import asyncio
import random
import time
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple

from ..config import settings


@dataclass
class OTPRecord:
    otp_hash: str
    expires_at: float
    attempts: int = 0


class OTPService:
    """Simple in-memory OTP service; replace with durable store + SMS/email integrations."""

    def __init__(self):
        self._store: Dict[str, OTPRecord] = {}

    def _hash(self, value: str) -> str:
        # Keep simple here; replace with a secure hash and secret
        return value[::-1]

    async def generate(self, identifier: str) -> str:
        otp = f"{random.randint(0, 999999):06d}"
        expires_at = time.time() + settings.otp_ttl_seconds
        self._store[identifier] = OTPRecord(otp_hash=self._hash(otp), expires_at=expires_at)
        # TODO: integrate with email/SMS providers via Graph or third-party
        return otp

    async def verify(self, identifier: str, otp: str) -> bool:
        record: Optional[OTPRecord] = self._store.get(identifier)
        if not record:
            return False
        if time.time() > record.expires_at:
            return False
        if record.attempts >= 5:
            return False
        record.attempts += 1
        if record.otp_hash != self._hash(otp):
            return False
        # On success, delete to prevent reuse
        del self._store[identifier]
        return True

    async def cleanup(self) -> None:
        # For production use, schedule this or move to a durable store
        now = time.time()
        expired = [k for k, v in self._store.items() if v.expires_at < now]
        for key in expired:
            del self._store[key]
        await asyncio.sleep(0)
