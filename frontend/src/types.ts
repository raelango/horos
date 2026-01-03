export type Language = "en" | "ta" | "hi";
export type Methodology = "tamil" | "vedic" | "western";

export interface PreferenceSnapshot {
  language: Language;
  methodology: Methodology;
  sign?: string;
}

export interface GuidanceCategory {
  categoryKey: string;
  text: string;
}

export interface GuidanceContext {
  methodology: Methodology;
  language: Language;
  sign: string;
  periodType: string;
  startDate: string;
  endDate: string;
  isPersonalized: boolean;
}

export interface GuidanceResponse {
  correlationId: string;
  context: GuidanceContext;
  categories: GuidanceCategory[];
}

export interface GuidanceGeneralItem {
  sign: string;
  methodology: Methodology;
  language: Language;
  periodType: string;
  text: string;
}

export interface GuidanceBatchResponse {
  correlationId: string;
  items: GuidanceGeneralItem[];
}

export interface ParsedGuidanceItem {
  sign: string;
  text: string;
}

export interface TranslationItem {
  key: string;
  value: string;
  status: string;
  lastTranslatedBy: string;
}

export interface TranslationResponse {
  correlationId: string;
  translations: TranslationItem[];
  generated: string[];
  cached: string[];
}

export interface ZodiacSign {
  code: string;
  displayName: string;
  english?: string | null;
  tamil?: string | null;
  hindi?: string | null;
  methodology: Methodology;
  sequence?: number;
}

export interface ZodiacSignResponse {
  correlationId: string;
  signs: ZodiacSign[];
}

export interface PanchangWindow {
  start: string;
  end: string;
  label?: string | null;
  phase?: string | null;
  nakshatra?: string | null;
  kind?: string | null;
}

export interface PanchangAnga {
  name: string;
  start?: string | null;
  end?: string | null;
}

export interface PanchangData {
  meta: {
    date: string;
    timezone: string;
    location: { lat: number; lon: number; name?: string };
    hinduDay: { start: string; end: string };
  };
  astronomy: {
    sunrise: string;
    sunset: string;
    nextSunrise: string;
    dayLengthMinutes: number;
    nightLengthMinutes: number;
  };
  panchang: {
    vara: { name: string };
    tithi: PanchangAnga[];
    nakshatra: PanchangAnga[];
    yoga: PanchangAnga[];
    karana: PanchangAnga[];
  };
  timings: {
    rahuKalam: PanchangWindow[];
    yamagandam: PanchangWindow[];
    gulikai: PanchangWindow[];
    durmuhurtam: PanchangWindow[];
    varjyam: PanchangWindow[];
    brahmaMuhurta: PanchangWindow[];
    abhijitMuhurta: PanchangWindow[];
  };
  notes: { code: string; text: string }[];
}
