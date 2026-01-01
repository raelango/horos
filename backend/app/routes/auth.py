from fastapi import APIRouter

from ..schemas import OTPRequest, OTPResponse, OTPVerifyRequest, PreferenceSnapshot
from ..deps import otp_service, sharepoint_client

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/request-otp", response_model=OTPResponse)
async def request_otp(payload: OTPRequest):
    otp = await otp_service.generate(payload.identifier)
    await sharepoint_client.audit("otp_requested", {"identifier": payload.identifier, "channel": payload.channel})
    # In production do not return the OTP. Here we surface it for local dev/testing.
    return OTPResponse(
        correlationId=f"otp:{payload.identifier}",
        message=f"OTP sent via {payload.channel}. (local dev OTP: {otp})",
    )


@router.post("/verify-otp", response_model=OTPResponse)
async def verify_otp(payload: OTPVerifyRequest):
    is_valid = await otp_service.verify(payload.identifier, payload.otp)
    await sharepoint_client.audit("otp_verified", {"identifier": payload.identifier, "result": is_valid})
    if not is_valid:
        return OTPResponse(
            correlationId=f"otp:{payload.identifier}", message="Invalid or expired OTP. Enumeration-safe response."
        )
    return OTPResponse(correlationId=f"otp:{payload.identifier}", message="If the identifier exists, you are signed in.")
