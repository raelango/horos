from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class CorrelatedResponse(BaseModel):
    correlationId: str


class OTPRequest(BaseModel):
    identifier: str = Field(..., description="Email or phone number")
    channel: str = Field(..., pattern="^(email|phone)$")


class OTPVerifyRequest(BaseModel):
    identifier: str
    otp: str = Field(..., min_length=6, max_length=6)


class OTPResponse(CorrelatedResponse):
    message: str


class PreferenceSnapshot(BaseModel):
    language: str = "en"
    methodology: str = "tamil"
    sign: Optional[str] = None


class PreferencesResponse(CorrelatedResponse):
    preferences: PreferenceSnapshot


class Profile(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    name: Optional[str] = None
    dob: Optional[date] = None
    tob: Optional[str] = None
    pob: Optional[str] = None
    occupation: Optional[str] = None
    location: Optional[str] = None
    preferredLanguage: Optional[str] = None
    preferredMethodology: Optional[str] = None
    preferredSign: Optional[str] = None
    consentBirthDataUse: bool = False


class ProfileResponse(CorrelatedResponse):
    profile: Profile


class GuidanceContext(BaseModel):
    methodology: str
    language: str
    sign: str
    periodType: str
    startDate: date
    endDate: date
    isPersonalized: bool = False
    categoryBundle: Optional[str] = None
    promptVersion: Optional[str] = None


class GuidanceCategory(BaseModel):
    categoryKey: str
    text: str


class GuidanceResponse(CorrelatedResponse):
    context: GuidanceContext
    categories: List[GuidanceCategory]


class GuidanceGeneralItem(BaseModel):
    sign: str
    methodology: str
    language: str
    periodType: str
    text: str


class GuidanceBatchResponse(CorrelatedResponse):
    items: List[GuidanceGeneralItem]


class TranslationRequest(BaseModel):
    keys: List[str]
    language: str


class TranslationItem(BaseModel):
    key: str
    value: str
    status: str = "Draft"
    lastTranslatedBy: str = "AI"


class TranslationResponse(CorrelatedResponse):
    translations: List[TranslationItem]
    generated: List[str] = []
    cached: List[str] = []

class ZodiacSign(BaseModel):
    code: str
    displayName: str
    english: str | None = None
    tamil: str | None = None
    hindi: str | None = None
    methodology: str
    sequence: int | None = None


class ZodiacSignListResponse(CorrelatedResponse):
    signs: List[ZodiacSign]


class PanchangWindow(BaseModel):
    start: str
    end: str
    label: str | None = None
    phase: str | None = None
    nakshatra: str | None = None
    kind: str | None = None  # auspicious | avoid | neutral


class PanchangAnga(BaseModel):
    name: str
    start: str | None = None
    end: str | None = None


class PanchangMeta(BaseModel):
    date: str
    timezone: str
    location: dict
    hinduDay: dict


class PanchangAstronomy(BaseModel):
    sunrise: str
    sunset: str
    nextSunrise: str
    dayLengthMinutes: int
    nightLengthMinutes: int


class PanchangData(BaseModel):
    meta: PanchangMeta
    astronomy: PanchangAstronomy
    panchang: dict
    timings: dict
    notes: List[dict] = []


class ErrorEnvelope(BaseModel):
    correlationId: str
    errorCode: str
    message: str
    details: dict = {}


class AuditEvent(BaseModel):
    type: str
    timestamp: datetime
    metadata: dict
