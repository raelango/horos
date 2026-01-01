from fastapi import APIRouter

from ..schemas import PreferenceSnapshot, Profile, ProfileResponse
from ..deps import sharepoint_client

router = APIRouter(prefix="/profile", tags=["profile"])


@router.post("", response_model=ProfileResponse)
async def upsert_profile(profile: Profile):
    identifier = profile.email or profile.phone or "anonymous"
    stored = await sharepoint_client.upsert_profile(identifier, profile.model_dump())
    await sharepoint_client.audit("profile_upsert", {"identifier": identifier, "profile": stored})
    return ProfileResponse(correlationId=f"profile:{identifier}", profile=Profile(**stored))
