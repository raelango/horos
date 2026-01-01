# Astrology Guidance Platform (MVP scaffold)

This repository contains a FastAPI backend and React (TypeScript + Vite) frontend scaffold for the astrology guidance platform defined in the BRD/PRD/TRD. SharePoint integration is stubbed behind a client to be wired to Microsoft Graph and OpenAI in future iterations.

## Project Structure
- `backend/`: FastAPI app with OTP/auth, preferences, profile, guidance, and translations endpoints. SharePoint and OpenAI calls are mocked.
- `frontend/`: Vite + React single-page app that calls the backend APIs and renders stubbed guidance.
- `Artifacts/`: BRD/PRD/TRD reference documents.

## Backend (FastAPI, port 7500)
1. Create a virtual environment and install deps:
   ```bash
   cd backend
   python -m venv .venv
   .venv/Scripts/activate  # Windows PowerShell: .venv\\Scripts\\Activate.ps1
   pip install -r requirements.txt
   ```
2. Run locally:
   ```bash
   uvicorn app.main:app --reload --port 7500
   ```
3. Key files:
   - `app/main.py`: FastAPI entrypoint and router wiring.
   - `app/routes/*.py`: API endpoints (OTP, preferences, profile, guidance, translations).
   - `app/services/sharepoint_client.py`: SharePoint stub; replace with Graph calls and list schemas from PRD/TRD.
   - `app/services/guidance_service.py`: Cache-first guidance flow with TTL by period type; replace `_fallback_generate` with OpenAI orchestration.

## Frontend (React + Vite, port 8500)
1. Install deps and run dev server:
   ```bash
   cd frontend
   npm install
   npm run dev -- --port 8500
   ```
   The Vite dev server proxies API calls to `http://localhost:7500`.
2. Key files:
   - `src/App.tsx`: Simple selector UI for language/methodology/sign/period and renders guidance.
   - `src/api.ts`: Fetch helpers targeting backend endpoints.
   - `src/types.ts`: Shared frontend types mirroring backend responses.

## Notes and Next Steps
- Replace `SharePointClientStub` with Microsoft Graph integration (lists: GuidanceCache, UiTranslations, UserProfiles, PromptRegistry, etc.).
- Wire `_fallback_generate` in `guidance_service.py` to OpenAI with governed prompts and cache persistence in SharePoint.
- Implement durable OTP store and delivery via Graph (email) and SMS provider; enforce rate limits and lockouts.
- Harden validation (period boundaries, category bundles, consented personalization) per PRD/TRD acceptance criteria.
- Add automated tests (backend/ frontend) and CI once real integrations are added.

## Docker (ports 7500 API / 8500 SPA)
- Build & run:
  ```bash
  docker-compose up -d
  ```
- Stop:
  ```bash
  docker-compose down
  ```
- Rebuild:
  ```bash
  docker-compose build
  docker-compose up -d
  ```
Convenience scripts are provided: `run.bat`, `stop.bat`, and `rebuild.bat`.
