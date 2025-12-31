# Technical Requirements Document (TRD)
## Astrology Guidance Platform
**Version:** 1.0 (Enterprise Draft)  
**Date:** December 31, 2025

---

## 1. Purpose
This Technical Requirements Document (TRD) defines the technical architecture, non-functional requirements, security requirements, data model implementation requirements, and operational constraints necessary for engineering to implement the Astrology Guidance Platform as described in the Master PRD.

---

## 2. System Architecture Overview
### 2.1 High-Level Architecture
The System SHALL be composed of the following major components:
1. **Frontend Web Application** (React, TypeScript)
2. **Backend API Service** (Python, FastAPI)
3. **LLM Layer** (OpenAI API)
4. **Data Store** (SharePoint Online lists and libraries)
5. **Identity & OTP Services** (email via Microsoft Graph; SMS provider)
6. **Observability** (Azure Monitor + Application Insights)

### 2.2 Primary Architectural Principles
- **Cache-first**: Always attempt SharePoint cache retrieval before OpenAI calls.
- **API-only data access**: SharePoint is never accessed directly by the client.
- **Governed AI**: Prompt templates, versions, guardrails, and translation locking are first-class assets.
- **Extensibility**: Categories, languages, and methodologies are configuration-driven.

---

## 3. Technology Stack (Final)
### 3.1 Frontend
- React (TypeScript)
- Mobile-first responsive design
- i18n resolution via backend translation APIs (no static i18n bundles)

### 3.2 Backend
- Python 3.11+
- FastAPI (async-first)
- uvicorn / gunicorn deployment in Azure App Service
- Type hints required, linting and formatting enforced

### 3.3 LLM
- OpenAI API (Responses / Chat Completions as appropriate)
- Model selection abstracted behind configuration
- Rate limiting and retry policies applied

### 3.4 Data Store
- SharePoint Online lists (system of record)
- Access via Microsoft Graph REST

---

## 4. Backend Service Requirements
### 4.1 Service Boundaries (Modules)
The backend SHALL be structured with clear boundaries:
- **Auth Service**: OTP generation, delivery, verification, session handling
- **Preference Service**: cookie/profile preference resolution
- **Guidance Service**: cache-key creation, SharePoint cache read/write, LLM orchestration
- **Translation Service**: UI translation memory lookup, AI fallback, locking enforcement
- **Prompt Governance Service**: prompt registry, version selection, golden samples (if implemented in backend)
- **Audit Service**: structured audit event logging

### 4.2 API Contracts (Minimum Endpoints)
1. `POST /auth/request-otp`
2. `POST /auth/verify-otp`
3. `GET /preferences/effective`
4. `POST /profile` (create/update)
5. `GET /guidance` (period, methodology, language, sign, bundle)
6. `GET /ui/translations` (list of keys + language)

All endpoints SHALL return stable error formats and correlation IDs.

### 4.3 Async and I/O Rules
- All outbound calls (Graph, OpenAI, SMS) SHALL be async.
- No blocking I/O SHALL exist in request paths.
- Explicit timeouts SHALL be applied to all external calls.

---

## 5. Authentication & Session Requirements
### 5.1 Passwordless OTP
- Identifier: email or phone
- OTP: 6-digit numeric
- Validity: 5–10 minutes (configurable)
- OTP stored hashed only (not plaintext)

### 5.2 Enumeration Protection
- OTP request responses SHALL be indistinguishable regardless of account existence.
- Standard message: “If the identifier exists, an OTP has been sent.”

### 5.3 Rate Limiting
- Per-identifier OTP generation rate limits
- Per-IP rate limits
- Verification attempt limits per OTP
- Temporary lockouts for abuse patterns

### 5.4 Sessions
- Secure HTTP-only cookies (or equivalent) required
- Session expiration:
  - inactivity timeout
  - absolute timeout
- Logout invalidates session

---

## 6. Guidance Generation Requirements
### 6.1 Cache Key Construction
Cache key MUST include:
- Methodology
- Language
- Sign
- PeriodType
- StartDate/EndDate
- BundleKey
- PromptVersion
- IsPersonalized
- ProfileHash (for personalized)

Cache keys SHALL be deterministic, stable, and versioned.

### 6.2 Validation Rules
- Past periods SHALL be rejected
- Period defaults to Today when omitted
- Personalized yearly guidance SHALL be blocked
- Category bundle limits enforced

### 6.3 Output Format
- Guidance generation SHALL return strict JSON conforming to schema
- Categories SHALL be short, readable, and bounded by word count
- Tone MUST align with governance rules

---

## 7. Translation Requirements
### 7.1 UI Translation
- All UI labels resolved by translation key
- Lookup in SharePoint translation memory first
- AI fallback only on missing translation
- Persist AI translation back to SharePoint

### 7.2 Locked Translation Keys
- Legal/disclaimer keys SHALL be locked
- AI translation SHALL never overwrite locked keys
- Updates require explicit review workflow

---

## 8. Prompt Governance & AI Controls
### 8.1 Prompt Registry
- Prompt templates and versions SHALL be stored in SharePoint
- Prompts SHALL be selected by:
  - PromptKey
  - Methodology
  - PeriodType
  - Language strategy

### 8.2 Guardrails (Mandatory)
- No deterministic predictions
- No medical/legal/financial advice
- No fear-based language
- No exact clock times

### 8.3 Prompt Drift Prevention
- Golden sample dataset maintained
- Similarity checks to detect repetition and drift
- Quarterly review cadence
- Rollback capability

---

## 9. SharePoint Data Architecture Requirements
### 9.1 Core Lists (Implementation)
The System SHALL implement the SharePoint lists defined in the Master PRD and data model.

Minimum lists:
- UserProfiles
- UserPreferences
- HoroscopeCategories
- CategoryBundles
- HoroscopeHeaders
- HoroscopeEntries
- UiTranslations
- PromptRegistry
- AuditEvents

### 9.2 Indexing and Query Constraints
- Lists SHALL be indexed on the most queried columns:
  - Methodology, Language, Sign, PeriodType, StartDate
  - UserId for personalized
- Queries SHALL be optimized to avoid list threshold issues.

### 9.3 Data Retention
- Guidance content retention rules defined in PRD
- Archive policy for old generic guidance (recommended)

---

## 10. Observability & Operations
### 10.1 Logging
The System SHALL log:
- Correlation ID per request
- Authentication events (success/failure)
- Rate limit events
- Cache hits/misses
- OpenAI calls (model, tokens, latency)
- Prompt version used

### 10.2 Monitoring
- Alerts for:
  - elevated OTP failures
  - abnormal OTP request volume
  - OpenAI error spikes
  - SharePoint latency spikes
  - cache miss rate spikes

### 10.3 Deployment
- CI/CD pipeline required
- Separate environments: Dev/Test/Prod
- Secrets in Key Vault (OpenAI keys, Graph secrets)

---

## 11. Security Requirements
### 11.1 Data Minimization
- No OTPs stored in SharePoint
- No full phone/email stored in general profile lists unless required
- Location stored at city/state/country granularity

### 11.2 Transport & Storage
- TLS required for all traffic
- Secrets never stored in SharePoint

### 11.3 Abuse Prevention
- Rate limiting
- Lockouts
- Monitoring and alerting

---

## 12. Non-Functional Requirements
### 12.1 Performance
- P95 backend response:
  - Cache hit: < 500ms
  - Cache miss: < 5 seconds

### 12.2 Availability
- 99.5% uptime target for MVP

### 12.3 Accessibility
- WCAG AA baseline
- Readability requirements for Tamil/Hindi UI

---

## 13. Technical Acceptance Criteria
1. Cache-first logic is enforced for all guidance requests.
2. Past period requests are rejected.
3. OTP enumeration protection is verified.
4. Locked translations cannot be overwritten by AI.
5. Prompt version is recorded for every generated guidance item.
6. OpenAI usage is logged with token counts and latency.

---

## 14. Appendix
### 14.1 Example Error Envelope
```json
{
  "correlationId": "...",
  "errorCode": "INVALID_PERIOD",
  "message": "Guidance is available only for future dates.",
  "details": {}
}
```

### 14.2 Example Guidance Response Envelope
```json
{
  "correlationId": "...",
  "context": {
    "methodology": "tamil",
    "language": "ta",
    "sign": "ARIES",
    "periodType": "DAY",
    "startDate": "2025-12-31",
    "endDate": "2025-12-31",
    "isPersonalized": false
  },
  "categories": [
    {
      "categoryKey": "summary",
      "text": "..."
    }
  ]
}
```

