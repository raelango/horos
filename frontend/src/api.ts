import {
  GuidanceResponse,
  Language,
  Methodology,
  PreferenceSnapshot,
  TranslationResponse,
  ZodiacSignResponse
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE || "http://localhost:7500";

export async function fetchGuidance(params: {
  language: Language;
  methodology: Methodology;
  sign: string;
  periodType: string;
  startDate?: string;
  personalized?: boolean;
}): Promise<GuidanceResponse> {
  const query = new URLSearchParams({
    language: params.language,
    methodology: params.methodology,
    sign: params.sign,
    periodType: params.periodType
  });
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.personalized) query.set("personalized", "true");

  const res = await fetch(`${BASE_URL}/guidance?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch guidance: ${res.status}`);
  return res.json();
}

export async function fetchTranslations(keys: string[], language: Language): Promise<TranslationResponse> {
  const res = await fetch(`${BASE_URL}/ui/translations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys, language })
  });
  if (!res.ok) throw new Error(`Failed to fetch translations: ${res.status}`);
  return res.json();
}

export async function fetchZodiacSigns(methodology: Methodology): Promise<ZodiacSignResponse> {
  const res = await fetch(`${BASE_URL}/zodiac/signs?methodology=${methodology}`);
  if (!res.ok) throw new Error(`Failed to fetch zodiac signs: ${res.status}`);
  return res.json();
}

export async function fetchGuidanceBatch(params: {
  language: Language;
  methodology: Methodology;
  periodType: string;
}): Promise<any> {
  const query = new URLSearchParams({
    language: params.language,
    methodology: params.methodology,
    periodType: params.periodType
  });
  const res = await fetch(`${BASE_URL}/guidance/all?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch batch guidance: ${res.status}`);
  return res.json();
}

export async function fetchPanchangam(params: {
  date: string;
  lat: number;
  lon: number;
  tz: string;
  locale?: string;
  locationName?: string;
}) {
  const query = new URLSearchParams({
    date: params.date,
    lat: String(params.lat),
    lon: String(params.lon),
    tz: params.tz
  });
  if (params.locale) query.set("locale", params.locale);
  if (params.locationName) query.set("locationName", params.locationName);
  const res = await fetch(`${BASE_URL}/panchang/daily?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch panchangam: ${res.status}`);
  return res.json();
}

export async function locatePanchangPlace(query: { place?: string; lat?: number; lon?: number }) {
  const qs = new URLSearchParams();
  if (query.place) qs.set("place", query.place);
  if (query.lat !== undefined && query.lon !== undefined) {
    qs.set("lat", String(query.lat));
    qs.set("lon", String(query.lon));
  }
  const res = await fetch(`${BASE_URL}/panchang/locate?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to resolve place: ${res.status}`);
  return res.json();
}
