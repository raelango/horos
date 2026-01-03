from .services.guidance_service import GuidanceService
from .services.otp_service import OTPService
from .services.sharepoint_client import SharePointClientStub
from .services.panchang_service import PanchangService
from .services.translation_service import TranslationService
from .services.zodiac_service import ZodiacService

sharepoint_client = SharePointClientStub()
otp_service = OTPService()
guidance_service = GuidanceService(sharepoint_client)
translation_service = TranslationService(sharepoint_client)
zodiac_service = ZodiacService(sharepoint_client)
panchang_service = PanchangService(sharepoint_client)
