AstroZone — Daily Panchāṅgam (Phase 1) — Engineering Implementation Specification

1. Purpose

AstroZone SHALL provide a Daily Panchāṅgam experience that is computed deterministically from date/time and user location (lat/lon/timezone) and rendered in a mobile-first UI.

Phase 1 SHALL deliver:

Core Panchāṅgam elements (Tithi, Nakshatra, Yoga, Karana, Vara)

Sunrise/Sunset and key day/night duration metadata

Standard inauspicious time windows (Rahu Kalam, Yamagandam, Gulikai)

Muhūrta windows of the day (Brahma Muhūrta, Abhijit Muhūrta) and key “avoid” windows (Dur Muhūrtam, Varjyam/Nakshatra Thyajyam)

2. Scope

2.1 In Scope (Phase 1)

The system SHALL compute and return (for a given date + location):

Astronomical anchors

Local sunrise, sunset

Next sunrise (for sunrise-to-sunrise Panchāṅgam day boundary)

Day length and night length

Panchāṅga Angas (for the sunrise-to-next-sunrise Hindu day)

Tithi (start/end times if changes occur within the Hindu day)

Nakshatra (start/end times if changes occur)

Yoga (start/end times if changes occur)

Karana (start/end times if changes occur)

Vara (weekday) per sunrise

Kāla windows (inauspicious)

Rahu Kalam

Yamagandam

Gulikai Kalam

Muhūrta windows (Phase 1 subset)

Brahma Muhūrta

Abhijit Muhūrta

Dur Muhūrtam (avoid)

Varjyam / Nakshatra Thyajyam (avoid)

Display-level guidance (Phase 1)

The UI SHALL label each window as Auspicious, Avoid, or Neutral.

The UI SHALL NOT claim “today is auspicious for weddings” as a definitive verdict in Phase 1.

Phase 1 SHALL provide time windows only.

Wedding suitability requires additional Muhūrta selection logic (Phase 2) such as Lagna, tara-bala, chandra-bala, doshas, regional rules, and event-specific constraints.

2.2 Out of Scope (Phase 1)

A definitive “wedding day suitability score” or “recommended wedding muhurat” (Phase 2)

Event-specific Muhūrta engines (marriage, grihapravesh, vehicle purchase, etc.)

Personalized muhurat (based on user birth chart) (Phase 3)

3. User Experience Requirements

3.1 Primary UX

User selects (or auto-detects) Location and Timezone.

User chooses a date (default: today).

System displays:

Sunrise, Sunset

Panchāṅga Angas in a clean card layout

“Today’s Timings” grouped into:

Auspicious windows (Brahma, Abhijit)

Avoid windows (Varjyam, Dur Muhūrtam, Rahu, Yamagandam, Gulikai)

3.2 UX Guardrails

If any window crosses midnight, UI SHALL show the correct date label.

All times SHALL be displayed in the user’s timezone.

If location/timezone is missing, system SHALL request it; it SHALL NOT guess.

4. Inputs and Data Contracts

4.1 Inputs

date: YYYY-MM-DD (Gregorian)

latitude: float

longitude: float

timezone: IANA zone name (e.g., "America/New_York")

locale: optional (for language rendering; Phase 1 can be English-only if needed)

4.2 Output Precision

Times SHALL be computed to minute precision (HH:mm) for UI.

Internally, calculations SHOULD be performed at higher precision (seconds) to avoid boundary errors.

5. Computation Model (No OpenAI)

Phase 1 SHALL be implemented without OpenAI.

5.1 Astronomical Computation

The service SHALL compute Sun/Moon longitudes and rise/set times via deterministic astronomy methods (e.g., ephemeris-based computations).

5.2 Hindu Day Boundary

A Panchāṅgam “day” SHALL be treated as sunrise-to-next-sunrise at the given location.

Vara (weekday) SHALL correspond to the weekday at sunrise.

6. Algorithms (Phase 1)

6.1 Rahu Kalam / Yamagandam / Gulikai

Daytime duration D = (sunset - sunrise)

Divide D into 8 equal segments.

Segment index depends on weekday.

Start/end = sunrise + segmentStartIndex*(D/8) to sunrise + segmentEndIndex*(D/8)

Weekday segment mapping (1-based segments):

Rahu Kalam: Sun=8, Mon=2, Tue=7, Wed=5, Thu=6, Fri=4, Sat=3

Yamagandam: Sun=5, Mon=4, Tue=3, Wed=2, Thu=1, Fri=7, Sat=6

Gulikai: Sun=7, Mon=6, Tue=5, Wed=4, Thu=3, Fri=2, Sat=1

6.2 Brahma Muhūrta (Auspicious)

Brahma Muhūrta SHALL be computed relative to sunrise.

Start = sunrise - 96 minutes

End = sunrise - 48 minutes

6.3 Abhijit Muhūrta (Auspicious; informational)

Compute Local Noon:

LNT = sunrise + (sunset - sunrise)/2

Abhijit duration scales with day length:

HalfWindow = (sunset - sunrise)/30

Start = LNT - HalfWindow

End = LNT + HalfWindow

Phase 1 SHALL mark Abhijit as “Auspicious (General)” and SHALL add a note that event-specific exceptions (e.g., marriage) are not evaluated in Phase 1.

6.4 Dur Muhūrtam (Avoid)

Dur Muhūrtam SHALL be computed from sunrise/sunset and weekday, using proportional Ghati scaling.

Definitions:

Day Ghati = (sunset - sunrise) / 30

Night Ghati = (nextSunrise - sunset) / 30

Dur Muhūrtam windows by weekday (offsets are in Ghatis; duration is in Ghatis):

Sunday: 1 window

Start = sunrise + 26 * DayGhati

Duration = 2 * DayGhati

Monday: 2 windows

Window 1: sunrise + 16 * DayGhati, duration 2 * DayGhati

Window 2: sunrise + 22 * DayGhati, duration 2 * DayGhati

Tuesday: 2 windows

Window 1 (day): sunrise + 6 * DayGhati, duration 2 * DayGhati

Window 2 (night): sunset + 14 * NightGhati, duration 2 * NightGhati

Wednesday: 1 window

Start = sunrise + 14 * DayGhati, duration 2 * DayGhati

Thursday: 2 windows

Window 1: sunrise + 10 * DayGhati, duration 2 * DayGhati

Window 2: sunrise + 22 * DayGhati, duration 2 * DayGhati

Friday: 2 windows

Window 1: sunrise + 6 * DayGhati, duration 2 * DayGhati

Window 2: sunrise + 22 * DayGhati, duration 2 * DayGhati

Saturday: 1 window

Start = sunrise + 0 * DayGhati

Duration = 4 * DayGhati

The service SHALL return Dur Muhūrtam windows clipped to the sunrise-to-next-sunrise boundary.

6.5 Varjyam / Nakshatra Thyajyam (Avoid)

Phase 1 SHALL compute Varjyam windows using the Nakshatra Thyajyam Table (Tamil tradition).

Implementation approach (deterministic and accurate):

Compute Moon’s sidereal longitude continuously.

Identify Nakshatra segments (13°20′ each) that occur between sunrise and next sunrise.

For each Nakshatra segment, map to its Varjyam longitude sub-range using a fixed configuration table:

(NakshatraName, ZodiacSign, BeginDegreeInSign, EndDegreeInSign)

For each segment, solve for the time interval when MoonLongitude(t) is within [Begin, End] via binary search/root-finding.

Return each interval found. There MAY be 0, 1, or 2 Varjyam windows in a Hindu day.

Config Table Requirements:

The Varjyam table SHALL be stored as a versioned JSON resource in the codebase.

The table MUST include all 27 Nakshatras.

Operational Note:

If engineering prefers a simplified approximation initially, it MAY compute Varjyam as a fixed Ghati range relative to sunrise using the “Tyajya Ghatis” mapping; however, Phase 1 target SHOULD be the longitude-based computation above to avoid location/season drift.

7. API Design

7.1 Endpoint

GET /api/panchang/daily?date=YYYY-MM-DD&lat=..&lon=..&tz=..&locale=..

7.2 Response Shape (Phase 1)

{
  "meta": {
    "date": "2026-01-02",
    "timezone": "America/New_York",
    "location": {"lat": 42.36, "lon": -71.06},
    "hinduDay": {"start": "2026-01-02T07:13:00-05:00", "end": "2026-01-03T07:13:00-05:00"}
  },
  "astronomy": {
    "sunrise": "...",
    "sunset": "...",
    "nextSunrise": "...",
    "dayLengthMinutes":  ...,
    "nightLengthMinutes": ...
  },
  "panchang": {
    "vara": {"name": "Friday"},
    "tithi": [{"name": "...", "start": "...", "end": "..."}],
    "nakshatra": [{"name": "...", "start": "...", "end": "..."}],
    "yoga": [{"name": "...", "start": "...", "end": "..."}],
    "karana": [{"name": "...", "start": "...", "end": "..."}]
  },
  "timings": {
    "rahuKalam": [{"start": "...", "end": "..."}],
    "yamagandam": [{"start": "...", "end": "..."}],
    "gulikai": [{"start": "...", "end": "..."}],
    "durmuhurtam": [{"start": "...", "end": "...", "phase": "day|night"}],
    "varjyam": [{"start": "...", "end": "...", "nakshatra": "..."}],
    "brahmaMuhurta": [{"start": "...", "end": "..."}],
    "abhijitMuhurta": [{"start": "...", "end": "..."}]
  },
  "notes": [
    {"code": "N_WEDDING_SCOPE", "text": "Phase 1 provides time windows only; wedding suitability is evaluated in Phase 2."}
  ]
}

7.3 Error Handling

Missing required parameters → 400 with machine-readable error codes.

Invalid timezone → 400.

Out-of-range lat/lon → 400.

Internal ephemeris errors → 500 with correlation ID.

8. Caching and Performance

The service SHOULD cache results per (date, latRounded, lonRounded, tz) for 24 hours.

Suggested rounding: 2 decimal places (~1.1 km latitude resolution).

P95 response time target: < 500ms for cached responses; < 2s uncached.

9. Observability

Structured logs MUST include: date, tz, lat/lon (rounded), requestId, computeTimeMs, cacheHit.

Metrics SHOULD include: request counts, cache hit ratio, compute latency distribution, error rate.

10. Test Plan

10.1 Unit Tests

Segment mapping tests for Rahu/Yama/Gulikai.

Brahma and Abhijit formula tests.

Durmuhurtam weekday table tests.

Varjyam table integrity: all 27 nakshatras present; degree ranges valid and ordered.

10.2 Regression Tests (Golden Files)

Select 20 locations globally and 20 dates (across seasons).

Compare output to pre-approved golden JSON snapshots.

10.3 Boundary Tests

High latitudes where sunrise/sunset may be extreme.

DST transitions.

Windows crossing midnight.

11. Acceptance Criteria (Phase 1)

API returns correct JSON schema and all required fields.

UI renders a Daily Panchāṅgam page with:

Panchāṅga Angas

Sunrise/Sunset

Timings grouped into Auspicious vs Avoid

Durmuhurtam and Varjyam can return multiple windows.

No OpenAI dependency.

12. Phase 2 Preview (Not Implemented)

Phase 2 MAY add:

Wedding suitability evaluation and recommended wedding windows

Event-specific Muhūrta engines

Regional customization (Tamil vs North Indian conventions)

Personalized muhurta based on birth details

