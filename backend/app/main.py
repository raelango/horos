from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import auth, guidance, preferences, profile, translations, zodiac, panchang, horoscope


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8500", "http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    correlation_id = request.headers.get("x-correlation-id") or "corr-local"
    response = await call_next(request)
    response.headers["x-correlation-id"] = correlation_id
    return response


@app.get("/healthz")
async def healthcheck():
    return {"status": "ok", "env": settings.environment}


app.include_router(auth.router)
app.include_router(preferences.router)
app.include_router(profile.router)
app.include_router(guidance.router)
app.include_router(translations.router)
app.include_router(zodiac.router)
app.include_router(panchang.router)
app.include_router(horoscope.router)
