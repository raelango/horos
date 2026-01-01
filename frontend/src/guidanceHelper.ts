import { Language, ZodiacSign } from "./types";

type LanguageName = "English" | "Tamil" | "Hindi";

const LANG_MAP: Record<Language, LanguageName> = {
  en: "English",
  ta: "Tamil",
  hi: "Hindi"
};

function normalize(str: string): string {
  return str.trim().toLowerCase();
}

function pickPredictionText(predictions: any[] | undefined): string | null {
  if (!predictions || !Array.isArray(predictions)) return null;
  // Prefer category "General", otherwise first available.
  const general = predictions.find(
    (p: any) => typeof p?.category === "string" && normalize(p.category) === "general"
  );
  const pick = general || predictions[0];
  if (!pick) return null;
  return pick.summary || pick.prediction || null;
}

function extractTextFromPrediction(pred: any): string | null {
  // v2 schema: either predictions[] or timeFrames[].predictions[]
  const direct = pickPredictionText(pred.predictions);
  if (direct) return direct;
  const frames = Array.isArray(pred.timeFrames) ? pred.timeFrames : [];
  for (const frame of frames) {
    const txt = pickPredictionText(frame.predictions);
    if (txt) return txt;
  }
  return null;
}

export interface ParsedGuidanceMap {
  [signCode: string]: string;
}

export interface SignCategory {
  category: string;
  text: string;
}

export interface SignTimeBlock {
  label?: string;
  basis?: string;
  categories: SignCategory[];
}

export function parseGuidanceRaw(
  raw: any,
  language: Language,
  signs: ZodiacSign[]
): ParsedGuidanceMap {
  const targetLang = LANG_MAP[language];
  if (!raw || typeof raw !== "object") return {};
  const blocks = Array.isArray(raw.languageBlocks) ? raw.languageBlocks : [];
  const block = blocks.find((b) => b?.language === targetLang);
  if (!block) return {};
  const preds = Array.isArray(block.zodiacPredictions) ? block.zodiacPredictions : [];

  const signMap: ParsedGuidanceMap = {};

  for (const pred of preds) {
    const name = typeof pred?.zodiacSign === "string" ? pred.zodiacSign : "";
    if (!name) continue;
    const text = extractTextFromPrediction(pred) || "No guidance returned.";

    // Map the methodology-specific sign name back to our sign code if possible.
    const match = signs.find((s) => {
      const candidates = [
        s.code,
        s.displayName,
        s.english,
        s.tamil,
        s.hindi
      ].filter(Boolean).map((v) => normalize(String(v)));
      return candidates.includes(normalize(name));
    });

    const code = match ? match.code : name;
    signMap[code] = text;
  }

  return signMap;
}

export function getSignBlocks(
  raw: any,
  language: Language,
  signs: ZodiacSign[],
  signCode: string
): SignTimeBlock[] {
  const targetLang = LANG_MAP[language];
  if (!raw || typeof raw !== "object") return [];
  const blocks = Array.isArray(raw.languageBlocks) ? raw.languageBlocks : [];
  const block = blocks.find((b) => b?.language === targetLang);
  if (!block) return [];
  const preds = Array.isArray(block.zodiacPredictions) ? block.zodiacPredictions : [];

  const match = signs.find((s) => s.code === signCode);
  const candidates = match
    ? [match.code, match.displayName, match.english, match.tamil, match.hindi]
        .filter(Boolean)
        .map((v) => normalize(String(v)))
    : [normalize(signCode)];

  const pred = preds.find((p) => candidates.includes(normalize(String(p?.zodiacSign || ""))));
  if (!pred) return [];

  const timeBlocks: SignTimeBlock[] = [];

  const pushBlock = (label: string | undefined, basis: string | undefined, items: any[]) => {
    const cats: SignCategory[] = [];
    for (const item of items) {
      if (!item) continue;
      const category = typeof item.category === "string" ? item.category : "General";
      const text = item.summary || item.prediction || "";
      if (text) cats.push({ category, text });
    }
    if (cats.length) timeBlocks.push({ label, basis, categories: cats });
  };

  if (Array.isArray(pred.timeFrames) && pred.timeFrames.length > 0) {
    for (const frame of pred.timeFrames) {
      if (!Array.isArray(frame?.predictions)) continue;
      const label =
        frame?.startDate && frame?.endDate
          ? `${frame.startDate} - ${frame.endDate}`
          : frame?.startDate || frame?.endDate || undefined;
      const basis = typeof frame?.basis === "string" ? frame.basis : undefined;
      pushBlock(label, basis, frame.predictions);
    }
  } else if (Array.isArray(pred.predictions)) {
    pushBlock(undefined, undefined, pred.predictions);
  }

  return timeBlocks;
}
