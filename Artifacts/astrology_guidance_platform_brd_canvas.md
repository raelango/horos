# Business Requirements Document (BRD)
## Astrology Guidance Platform
**Version:** 1.0 (Enterprise Draft)  
**Date:** December 31, 2025

---

## 1. Executive Summary
The Astrology Guidance Platform (the “Platform”) is a multilingual web product that provides **forward-looking astrological guidance** (not deterministic predictions) for users across **12 zodiac signs** using selectable methodologies: **Tamil astrology (default)**, **Vedic astrology**, and **Western astrology**. The Platform will support both **anonymous** visitors and **logged-in** users authenticated via **passwordless OTP** (email or phone). The Platform will be optimized for users with limited technical sophistication and will deliver content in **English, Tamil, and Hindi**.

The Platform will use **OpenAI** as the language model layer. It will store content, translations, prompt templates, and governance metadata in **SharePoint Online**, accessed via the backend API only.

---

## 2. Business Goals and Objectives
### 2.1 Primary Goals
1. Provide accessible daily guidance that increases user engagement and repeat visits.
2. Serve multilingual users in India and the Tamil diaspora through culturally respectful content.
3. Enable methodology selection to satisfy different user expectations and increase trust.
4. Reduce recurring AI costs through SharePoint-backed caching and reuse.

### 2.2 Secondary Goals
1. Establish an extensible foundation for future categories, languages, premium features, and additional astrology methodologies.
2. Provide a governance framework for prompt control, translation locking, and auditability.

---

## 3. Business Scope
### 3.1 In Scope (MVP)
- Anonymous experience:
  - Select language, methodology, default sign
  - Select guidance period (today default; future-only)
  - Cookie persistence for language/methodology/sign
- Authenticated experience:
  - Passwordless OTP login (email/phone), no passwords
  - Persist language/methodology/sign preferences
  - Optional profile enrichment (DOB/TOB/POB/occupation/location) with consent
  - Personalized guidance where applicable
- Content generation and caching:
  - Cache-first retrieval from SharePoint
  - Generate via OpenAI only on cache miss
  - Store and reuse generated guidance
- Full-site multilingual UI:
  - UI label translation driven from SharePoint
  - AI translation fallback with persistence

### 3.2 Out of Scope (MVP)
- Past period guidance (no backdated content)
- Personalized yearly guidance (explicitly deferred)
- Remedies, rituals, or deterministic outcomes
- Astrology chart computation engines (ephemeris/natal chart)
- Native mobile apps

---

## 4. Stakeholders
### 4.1 Business Stakeholders
- Product Owner / Sponsor
- Marketing & Growth
- Customer Support / Community moderators

### 4.2 Delivery Stakeholders
- Engineering Team (Frontend, Backend)
- Security / Compliance Reviewer
- Operations / DevOps

### 4.3 End Users
- Anonymous users seeking daily/weekly guidance
- Logged-in users seeking more personalized guidance

---

## 5. Business Requirements
### 5.1 Multilingual Experience
- The Platform SHALL offer English, Tamil, and Hindi for the entire website.
- The Platform SHALL provide consistent tone across languages.
- The Platform SHALL store translations in SharePoint and reuse them.

### 5.2 Methodology Choice
- The Platform SHALL provide Tamil, Vedic, and Western models.
- The default SHALL be Tamil.
- Methodology impacts tone, structure, and terminology.

### 5.3 User Trust and Safety
- Content SHALL be guidance-only, forward-looking, non-deterministic.
- The Platform SHALL avoid medical, legal, and financial directives.
- Disclaimers SHALL be visible and localized.

### 5.4 Cost Management
- The Platform SHALL minimize AI calls using caching.
- The Platform SHALL reuse translations via SharePoint-based translation memory.

### 5.5 Extensibility
- The Platform SHALL support future categories and user-selectable bundles without redesign.
- The Platform SHALL support future languages and additional methodologies.

---

## 6. Business Process Flows (High Level)
### 6.1 Anonymous User Flow
1. Visit site → defaults applied (language/methodology/sign from cookie or defaults).
2. Select period (default today).
3. Receive guidance (cache-first, AI on miss).

### 6.2 Logged-in User Flow
1. Login via email/phone OTP.
2. Preferences loaded from profile.
3. Optional profile enrichment and consent.
4. Receive personalized guidance (cache-first).

---

## 7. Success Metrics (KPIs)
### 7.1 Engagement
- DAU/MAU
- Repeat visitor rate
- Average sessions per week

### 7.2 Content Quality / Trust
- User feedback ratings (thumbs up/down)
- Complaint rate for deterministic claims or culturally insensitive phrasing

### 7.3 Operational and Cost Metrics
- Cache hit ratio (daily guidance)
- LLM calls per 1,000 sessions
- Average cost per 1,000 guidance requests

### 7.4 Reliability
- Availability target (MVP): 99.5%
- P95 response time (cache hit): < 500ms backend

---

## 8. Risks and Mitigations
### 8.1 AI Prompt Drift
- Mitigation: prompt versioning, golden-sample regression, quarterly review cadence.

### 8.2 Translation Hallucination / Legal Drift
- Mitigation: locked translations for compliance strings; AI cannot overwrite locked keys.

### 8.3 OTP Abuse / Enumeration
- Mitigation: enumeration-safe responses, rate limiting, lockouts, monitoring alerts.

### 8.4 SharePoint Performance / Limits
- Mitigation: indexing, caching at API layer, archival policy for old content.

---

## 9. Assumptions and Constraints
### 9.1 Assumptions
- Users have internet access and modern mobile browsers.
- SharePoint Online and Microsoft Graph access is available.
- OpenAI API availability and quota are adequate for expected loads.

### 9.2 Constraints
- Forward-looking guidance only.
- No passwords.
- SharePoint as system-of-record for content and translations.

---

## 10. Dependencies
- OpenAI API and billing
- Microsoft 365 tenant, SharePoint site provisioning
- Email delivery via Microsoft Graph
- SMS provider integration

---

## 11. Business Acceptance Criteria
1. Anonymous user can consume guidance in all three languages.
2. Methodology selection persists for anonymous and logged-in users.
3. Logged-in user can login via OTP without passwords.
4. AI calls are avoided on repeat identical requests (cache reuse).
5. Missing translations are auto-generated once and reused.

---

## 12. Appendix
### 12.1 Terminology
- **Guidance:** Non-deterministic themes and suggestions.
- **Methodology:** Tamil/Vedic/Western model shaping structure and tone.
- **Translation memory:** Stored translations reused for UI labels and content.

