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
}

export interface ZodiacSignResponse {
  correlationId: string;
  signs: ZodiacSign[];
}
