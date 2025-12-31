# Product Requirements Document (PRD)
## Astrology Guidance Platform
**Version:** 1.0 (Enterprise Draft)

---

## 1. Purpose
The Astrology Guidance Platform (the “System”) is a multilingual, AI-assisted web application that delivers **forward-looking astrological guidance** for users across **12 zodiac signs** using selectable **horoscope methodologies**. The System supports both **anonymous** and **logged-in** users. Logged-in users can optionally provide birth details for increased personalization and granularity, subject to methodology limitations.

The System SHALL present guidance as **generalized, non-deterministic** content (guidance, suggestions, themes, and cautions) and SHALL avoid presenting outputs as certain “predictions.”

---

## 2. Scope
### 2.1 In Scope (MVP)
- Multilingual UI and content: **English, Tamil, Hindi**.
- Methodologies:
  - **Tamil astrology (default methodology)**
  - **Vedic astrology**
  - **Western astrology**
- Guidance periods (forward-looking only):
  - Today (default)
  - Tomorrow
  - This week
  - User-selected specific **date/week/month/year** (future-only)
- Anonymous users:
  - Choose language
  - Choose methodology
  - Choose default sign
  - Request guidance for a selected period
  - Cookie-based preference persistence (language, methodology, default sign)
- Logged-in users:
  - Authenticate via **OTP** (email or phone number) — **no passwords**
  - Persist preferences in profile (language, methodology, default sign)
  - Optionally provide personal profile fields (name, DOB, TOB, POB, occupation, current location)
  - Receive “more accurate” guidance where birth details enable additional granularity
- SharePoint as system-of-record for:
  - Pre-generated guidance content (cache)
  - User profiles and preferences
  - UI label translations and content translations
  - Prompt templates, guardrails, and governance configuration
- Translation fallback:
  - If a translation is not available in SharePoint, the System SHALL use AI to generate a translation and store it back to SharePoint for future use.

### 2.2 Out of Scope (for now)
- Personalized **yearly** guidance based on full natal chart (explicitly deferred).
- Past period guidance (no backdating).
- Advanced paid-only premium modules (subscriptions) — may be defined later.

---

## 3. Target Users and Personas
### 3.1 Anonymous Visitor
- Low friction, quickly selects language/methodology/sign and reads guidance.

### 3.2 Logged-in User
- Wants consistent defaults, personalized guidance using birth details, and stable UX across sessions.

### 3.3 Admin / Content Steward
- Manages translations, prompt templates, categories, taxonomy, and content governance.

---

## 4. Product Principles
1. **Clarity over mystique:** Guidance must be readable, non-alarming, and practical.
2. **Respect cultural nuance:** Tamil and Vedic outputs must use culturally appropriate terminology.
3. **Safety and trust:** No deterministic claims; no medical/legal/financial directives.
4. **Performance:** Cache-first and reuse content wherever possible.
5. **Extensibility:** Categories, languages, methodologies, and output formats must be configurable.

---

## 5. Functional Requirements

### 5.1 Methodology Selection
- The System SHALL allow users to select one of: Tamil (default), Vedic, Western.
- For anonymous users, the System SHALL store selected methodology in a browser cookie.
- For logged-in users, the System SHALL store methodology as part of the user profile and use it as default on future visits.
- The System SHALL support future addition of methodologies without schema changes that require rework (configuration-driven).

### 5.2 Language Selection (Full Site)
- The System SHALL provide a language selector with: English, Tamil, Hindi.
- The System SHALL localize:
  - Navigation, labels, buttons, field hints
  - Error messages
  - System guidance categories and headings
  - Generated guidance content

### 5.3 Zodiac Sign Selection
- Anonymous users SHALL be able to select a default sign.
- Default sign for anonymous users SHALL be stored in a cookie.
- Logged-in users SHALL have default sign stored in profile.

### 5.4 Period Selection (Forward-Looking Only)
- The period selector SHALL support:
  - Today (default)
  - Tomorrow
  - This week
  - Specific date (future-only)
  - Specific week (future-only)
  - Specific month (future-only)
  - Specific year (non-personal yearly guidance allowed; personalized yearly guidance deferred)
- The period selection SHALL NOT be stored in cookies.
- If a user requests a past period, the System SHALL reject the request and prompt a future valid selection.

### 5.5 Categories (Extensible)
- The System SHALL support a configurable set of guidance categories (example baseline below).
- The System SHALL constrain category selection to avoid fragmentation:
  - Anonymous users: fixed default category set (no custom selection in MVP)
  - Logged-in users: limited selection (e.g., choose up to N categories) and/or select from pre-defined bundles
- Category examples (configurable):
  - Overall / Summary
  - Career & Work
  - Finance
  - Relationships
  - Health & Wellbeing (non-medical)
  - Family
  - Travel
  - Education / Learning
  - Spiritual / Mindfulness

### 5.6 Guidance Generation and Caching (SharePoint)
- The System SHALL attempt to retrieve existing guidance from SharePoint before calling the LLM.
- Cache key SHALL include at minimum:
  - Methodology
  - Language
  - Sign
  - Period type (today/tomorrow/week/month/year/specific)
  - Effective date range
  - Category bundle/version
  - Prompt template version
  - For personalized outputs: a stable “profile hash” (non-reversible) + consent state
- If cached content exists and is valid, the System SHALL return cached content.
- If content is not present, the System SHALL generate using the LLM and store results in SharePoint.
- The System SHALL enforce content expiration rules:
  - Daily guidance expires at end-of-day (user locale)
  - Weekly guidance expires after the week
  - Monthly guidance expires after the month
  - Yearly (non-personal) expires after the year

### 5.7 Authentication (OTP Only)
- The System SHALL support login via:
  - Email + OTP
  - Phone + OTP
- The System SHALL NOT implement passwords.
- OTP requirements:
  - 6-digit numeric
  - Time-limited (e.g., 10 minutes)
  - Rate-limited per IP and per identifier
  - Max attempts per OTP

### 5.8 Logged-In Profile Data (Optional)
- Logged-in users MAY provide:
  - Name
  - Date of birth
  - Time of birth
  - Place of birth (city/state/country; geocoordinates optional)
  - Current occupation (optional)
  - Current location (optional)
  - Preferred methodology
  - Preferred language
- The System SHALL clearly disclose how birth data improves granularity.
- The System SHALL require explicit consent before using birth data in prompt context.

### 5.9 Timing Awareness (Why it Matters)
The System SHALL incorporate timing awareness because:
- Guidance content quality improves when aligned to the user’s **selected period boundary** and **user locale**.
- Tamil/Vedic contexts often interpret results relative to **day/night**, **local sunrise**, and date rollovers.
- For weekly/monthly outputs, correct start/end boundaries reduce ambiguity and repeated “generic” guidance.

MVP timing awareness SHALL include:
- User timezone resolution (from profile or device)
- Correct period boundaries (today/tomorrow/week/month) per timezone
- Future enhancement: sunrise-based day boundary (configurable)

---

## 6. User Experience Requirements

### 6.1 Navigation (Minimum)
- Header: Language selector, Methodology selector, Sign selector, Login/Account
- Period selector always visible on guidance page
- Category navigation: tabs or accordion (mobile-first)

### 6.2 Mobile-First UX
- The System SHALL be optimized for mobile.
- Primary interactions must be achievable in < 3 taps from landing.

### 6.3 UI Content Suggestions (Examples)
- Methodology label:
  - English: “Astrology Model”
  - Tamil: “ஜோதிட முறை”
  - Hindi: “ज्योतिष मॉडल”
- Safety banner:
  - English: “This is guidance meant for reflection and planning. Please make important decisions using professional advice.”
- Past period rejection:
  - English: “Guidance is available only for future dates. Please select today or a future period.”

---

## 7. Content and AI Governance

### 7.1 Prompt Construction (Enterprise Guidance)
The System SHALL generate content via a **prompt governance layer** composed of:
1. **System Prompt (immutable policy):** hard safety and style constraints.
2. **Methodology Prompt:** Tamil/Vedic/Western-specific terminology and structure.
3. **Period Prompt:** daily/weekly/monthly/yearly framing.
4. **Category Prompt:** category output format and boundaries.
5. **Localization Prompt:** language constraints and transliteration rules.
6. **Profile Prompt (optional):** only when consented and logged-in.

#### 7.1.1 Guardrails (Mandatory)
- The model SHALL NOT:
  - claim certainty (“will definitely happen”)
  - provide medical diagnosis, legal advice, or financial directives
  - use fear-inducing language (“danger,” “disaster,” “death,” “you will fail”) except mild caution framed responsibly
  - recommend illegal activity or harmful actions
- The model SHALL:
  - use supportive, calm tone
  - give actionable, low-stakes guidance (“consider,” “it may help,” “focus on”)
  - include optional coping/grounding suggestions
  - avoid personal data echoing (do not repeat full DOB/TOB/POB back to the user)

#### 7.1.2 Tone and Style Requirements
- Tone: culturally respectful, optimistic-realistic, non-alarmist.
- Reading level: general audience.
- Format: short paragraphs, bullets for actions.
- Output structure (recommended):
  - Theme of the period
  - Opportunities
  - Watch-outs
  - Suggested actions
  - Reflection question

#### 7.1.3 Methodology-Specific Rules
- Tamil/Vedic outputs:
  - Prefer culturally consistent terms.
  - If astrological computations are not available (MVP), the model SHALL explicitly treat guidance as generalized.
- Western outputs:
  - Use standard Western sign terminology.

### 7.2 Prompt Versioning and Auditability
- Prompt templates SHALL be versioned in SharePoint.
- Each generated guidance item SHALL store:
  - prompt version
  - methodology
  - period
  - language
  - generation timestamp
  - model name

### 7.3 Moderation and Safety Filters
- The System SHALL run content through:
  - input moderation (user-entered content)
  - output moderation (generated guidance)
- The System SHALL block or soften disallowed outputs.

---

## 8. Data Architecture (SharePoint Lists)

### 8.1 Core Lists
1. **SP_Methodologies**
   - MethodologyId (GUID)
   - Code (TAMIL, VEDIC, WESTERN)
   - DisplayNameKey (translation key)
   - IsDefault (boolean)
   - IsEnabled (boolean)

2. **SP_Languages**
   - LanguageCode (en, ta, hi)
   - DisplayNameKey
   - IsEnabled

3. **SP_ZodiacSigns**
   - SignId
   - Code (ARIES…)
   - DisplayNameKey
   - Order

4. **SP_Categories**
   - CategoryId
   - Code
   - DisplayNameKey
   - IsEnabled
   - DisplayOrder
   - BundleGroup (optional)

5. **SP_UIStrings** (label translations)
   - Key (e.g., ui.nav.home)
   - LanguageCode
   - Value
   - Status (Draft/Approved)
   - LastTranslatedBy (AI/Admin)

6. **SP_ContentTranslations** (content translations)
   - SourceContentId
   - SourceLanguage
   - TargetLanguage
   - TranslatedText
   - Status (Draft/Approved)
   - QualityScore (optional)

7. **SP_PromptTemplates**
   - PromptId
   - Code (SYSTEM_BASE, TAMIL_DAILY, etc.)
   - Version
   - TemplateText
   - IsActive
   - Notes

8. **SP_GuidanceCache**
   - GuidanceId
   - CacheKey
   - MethodologyCode
   - LanguageCode
   - SignCode
   - PeriodType
   - StartDate
   - EndDate
   - CategoryBundle
   - PromptVersion
   - IsPersonalized
   - ProfileHash (if personalized)
   - GuidancePayload (JSON / text)
   - CreatedAt
   - ExpiresAt

9. **SP_Users** (logged-in profile)
   - UserId
   - Email (nullable)
   - Phone (nullable)
   - PreferredLanguage
   - PreferredMethodology
   - PreferredSign
   - Name (optional)
   - DOB (optional)
   - TOB (optional)
   - POB_City/State/Country (optional)
   - CurrentOccupation (optional)
   - CurrentLocation (optional)
   - Consent_BirthDataUse (boolean)
   - CreatedAt / UpdatedAt

10. **SP_AuditEvents**
   - EventId
   - EventType
   - Actor (Anonymous/User/Admin)
   - CorrelationId
   - Timestamp
   - Metadata (JSON)

---

## 9. Core Flows (Verbose)

### 9.1 Anonymous Visitor Flow
1. User lands on Home.
2. System defaults:
   - Language: last cookie value OR English
   - Methodology: last cookie value OR Tamil
   - Sign: last cookie value OR Aries (or none until user picks)
   - Period: Today
3. User can change language/methodology/sign.
4. System stores language/methodology/sign in cookies.
5. User selects period (today/tomorrow/week/future date/week/month/year).
6. System validates period is future-only.
7. System requests guidance:
   - Checks SharePoint cache
   - If found: renders
   - Else: calls LLM, stores output, renders

### 9.2 Login via OTP
1. User clicks Login.
2. User selects Email or Phone.
3. User enters identifier.
4. System triggers OTP send.
5. User enters 6-digit OTP.
6. System validates OTP; on success:
   - Creates/loads user profile
   - Applies stored preferences
   - Presents profile completion option

### 9.3 Logged-In Personalized Guidance Flow
1. Logged-in user visits Guidance page.
2. Defaults loaded from profile: language/methodology/sign.
3. User may update preferences; changes persist to profile.
4. User may optionally enter/confirm birth details.
5. If user consents to use birth data:
   - System uses profile hash in cache key
   - System requests guidance with personalization prompt layer
6. Cache-first retrieval remains mandatory.

### 9.4 Translation Fallback Flow (UI + Content)
1. UI requests a label/content in Language X.
2. System checks SharePoint translation list.
3. If missing:
   - Calls LLM translation prompt
   - Stores translation to SharePoint
   - Returns translated string
4. Admin can later review and “Approve” translations.

---

## 10. Non-Functional Requirements
### 10.1 Security
- OTP rate limits and abuse prevention.
- PII minimization and encryption at rest where possible.
- Avoid storing secrets in SharePoint lists.

### 10.2 Performance
- Cache hit rate target ≥ 70% for anonymous daily guidance.
- P95 response targets (initial):
  - Cache hit: < 500ms (backend)
  - Cache miss: < 5s (including LLM)

### 10.3 Reliability
- Uptime target: 99.5% (MVP).
- Retries and circuit breakers for LLM calls.

### 10.4 Observability
- Correlation IDs across requests.
- Audit events for generation, translation, login attempts, and admin changes.

---

## 11. Technical Overview (for Engineering Alignment)
- Frontend: modern SPA (React recommended) with i18n framework.
- Backend: **Python** API (FastAPI recommended) providing:
  - guidance retrieval/generation
  - translation service
  - OTP flows
  - SharePoint integration via Microsoft Graph
- LLM Layer: **OpenAI (not Azure OpenAI)**.
- Storage: SharePoint lists/document library.

---

## 12. Acceptance Criteria (Representative)
1. Anonymous user can select language/methodology/sign; defaults persist via cookie.
2. Period defaults to today and is not stored.
3. Past period requests are rejected with localized message.
4. Guidance retrieval is cache-first using SharePoint.
5. Missing translations are AI-generated and stored back to SharePoint.
6. Login works via email/phone OTP only; no password flows exist.

---

## 13. Appendices
### Appendix A — Example CacheKey (Illustrative)
`{methodology}:{language}:{sign}:{periodType}:{startDate}:{endDate}:{categoryBundle}:{promptVersion}:{personalizedFlag}:{profileHash}`

### Appendix B — Default Category Bundle (MVP)
- Summary
- Career
- Finance
- Relationships
- Wellbeing

### Appendix C — Glossary
- **Guidance:** Non-deterministic themes and suggestions for reflection and planning.
- **Methodology:** A horoscope system (Tamil/Vedic/Western) used to shape tone/structure.
- **Translation key:** Stable key used to retrieve localized strings.

