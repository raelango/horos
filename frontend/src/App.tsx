import { useEffect, useRef, useState } from "react";
import { fetchGuidanceBatch, fetchZodiacSigns, fetchPanchangam, locatePanchangPlace } from "./api";
import { parseGuidanceRaw, ParsedGuidanceMap, getSignBlocks, SignTimeBlock } from "./guidanceHelper";
import { Language, Methodology, ParsedGuidanceItem, ZodiacSign, PanchangData } from "./types";

const languageOptions: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ta", label: "Tamil" },
  { code: "hi", label: "Hindi" }
];

const copy: Record<
  Language,
  {
    guidanceHeading: string;
    guidanceEyebrow: string;
    panchangHeading: string;
    panchangEyebrow: string;
    astrologyModel: string;
    dateRange: string;
    hiddenNone: string;
    hiddenTitle: string;
    unhideAll: string;
    heroEyebrow: string;
    heroTitle: string;
    heroBody: (m: string, p: string) => string;
    chipMethod: (m: string) => string;
    chipPeriod: (p: string) => string;
    chipLang: (l: string) => string;
    loadPanchang: string;
    astronomy: string;
    sunrise: string;
    sunset: string;
    nextSunrise: string;
    angas: string;
    vara: string;
    tithi: string;
    nakshatra: string;
    yoga: string;
    karana: string;
    auspicious: string;
    avoid: string;
    brahma: string;
    abhijit: string;
    rahu: string;
    yama: string;
    gulikai: string;
    dur: string;
    varjyam: string;
    locationLabel: (lat: number, lon: number) => string;
  }
> = {
  en: {
    guidanceHeading: "Sign-specific guidance",
    guidanceEyebrow: "Zodiac journeys",
    panchangHeading: "Daily Panchangam",
    panchangEyebrow: "Sunrise to sunrise",
    astrologyModel: "Astrology Model",
    dateRange: "Date Range",
    hiddenNone: "No signs hidden.",
    hiddenTitle: "Hidden signs",
    unhideAll: "Unhide all",
    heroEyebrow: "Personalized cosmic clarity",
    heroTitle: "Astrological Guidance, Made Personal",
    heroBody: (m, p) =>
      `Refined ${m} astrology that stays warm, trustworthy, and tailored for the moments that matter. Tune your view for ${p} and stay aligned with every sign.`,
    chipMethod: (m) => `${m} astrology`,
    chipPeriod: (p) => p,
    chipLang: (l) => `${l} delivery`,
    loadPanchang: "Load Panchangam",
    astronomy: "Astronomy",
    sunrise: "Sunrise",
    sunset: "Sunset",
    nextSunrise: "Next Sunrise",
    angas: "Panchanga Angas",
    vara: "Vara",
    tithi: "Tithi",
    nakshatra: "Nakshatra",
    yoga: "Yoga",
    karana: "Karana",
    auspicious: "Auspicious",
    avoid: "Avoid",
    brahma: "Brahma Muhurta",
    abhijit: "Abhijit Muhurta",
    rahu: "Rahu Kalam",
    yama: "Yamagandam",
    gulikai: "Gulikai",
    dur: "Dur Muhurtam",
    varjyam: "Varjyam",
    locationLabel: (lat, lon) => `Lat ${lat}, Lon ${lon}`
  },
  ta: {
    guidanceHeading: "ராசி வழிகாட்டி",
    guidanceEyebrow: "ராசி பயணங்கள்",
    panchangHeading: "நாள் பஞ்சாங்கம்",
    panchangEyebrow: "சூரிய உதயம் முதல்",
    astrologyModel: "ஜோதிடம் முறை",
    dateRange: "கால வரம்பு",
    hiddenNone: "மறைந்த ராசிகள் இல்லை.",
    hiddenTitle: "மறைத்த ராசிகள்",
    unhideAll: "அனைத்தையும் காட்டவும்",
    heroEyebrow: "தனிப்பயன் ஜோதிட வழிகாட்டி",
    heroTitle: "தனிப்பட்ட ஜோதிட வழிகாட்டல்",
    heroBody: (m, p) =>
      `${m} ஜோதிடம் நம்பிக்கையுடன், நெருக்கமான வடிவத்தில். ${p}க்கான பார்வையை அமைத்து ஒவ்வொரு ராசியுடனும் இணைந்து இருங்கள்.`,
    chipMethod: (m) => `${m} ஜோதிடம்`,
    chipPeriod: (p) => p,
    chipLang: (l) => `${l} வழங்கல்`,
    loadPanchang: "பஞ்சாங்கம் ஏற்று",
    astronomy: "வானியல்",
    sunrise: "சூரிய உதயம்",
    sunset: "சூரிய அஸ்தமனம்",
    nextSunrise: "அடுத்த உதயம்",
    angas: "பஞ்சாங்க அங்கங்கள்",
    vara: "வாரா",
    tithi: "திதி",
    nakshatra: "நட்சத்திரம்",
    yoga: "யோகம்",
    karana: "கரணம்",
    auspicious: "சுபம்",
    avoid: "விலக்கு",
    brahma: "பிரம்ம முகூர்த்தம்",
    abhijit: "அபிஜித் முகூர்த்தம்",
    rahu: "ராகு காலம்",
    yama: "யமகண்டம்",
    gulikai: "குளிகை",
    dur: "துர்முஹூர்த்தம்",
    varjyam: "வர்ஜ்யம்",
    locationLabel: (lat, lon) => `அட்ச. ${lat}, தொகை ${lon}`
  },
  hi: {
    guidanceHeading: "राशि मार्गदर्शन",
    guidanceEyebrow: "राशि यात्राएँ",
    panchangHeading: "दैनिक पंचांग",
    panchangEyebrow: "सूर्योदय से सूर्योदय",
    astrologyModel: "ज्योतिष विधि",
    dateRange: "तिथि सीमा",
    hiddenNone: "कोई राशि छुपी नहीं है.",
    hiddenTitle: "छुपी राशियाँ",
    unhideAll: "सभी दिखाएँ",
    heroEyebrow: "व्यक्तिगत ज्योतिष स्पष्टता",
    heroTitle: "व्यक्तिगत ज्योतिष मार्गदर्शन",
    heroBody: (m, p) =>
      `${m} ज्योतिष को भरोसेमंद और गर्मजोशी के साथ प्रस्तुत किया गया है। ${p} के लिए अपना दृश्य सेट करें और हर राशि से जुड़े रहें।`,
    chipMethod: (m) => `${m} ज्योतिष`,
    chipPeriod: (p) => p,
    chipLang: (l) => `${l} में`,
    loadPanchang: "पंचांग लोड करें",
    astronomy: "खगोल",
    sunrise: "सूर्योदय",
    sunset: "सूर्यास्त",
    nextSunrise: "अगला सूर्योदय",
    angas: "पंचांग अंग",
    vara: "वार",
    tithi: "तिथि",
    nakshatra: "नक्षत्र",
    yoga: "योग",
    karana: "करण",
    auspicious: "शुभ",
    avoid: "वर्जित",
    brahma: "ब्रह्म मुहूर्त",
    abhijit: "अभिजीत मुहूर्त",
    rahu: "राहु काल",
    yama: "यमगंड",
    gulikai: "गुलिक काल",
    dur: "दुर्मुहूर्त",
    varjyam: "वर्ज्य",
    locationLabel: (lat, lon) => `अक्षांश ${lat}, देशांतर ${lon}`
  }
};

const methodologies: Methodology[] = ["tamil", "vedic", "western"];

const periods = ["today", "tomorrow", "this week", "next week", "this month", "next month", "this quarter", "next quarter"];

const timezoneOptions = [
  "Asia/Kolkata",
  "Asia/Chennai",
  "Asia/Kathmandu",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "UTC"
];

type Prefs = {
  language: Language;
  methodology: Methodology;
  periodType: string;
  hiddenSigns?: string[];
  activeTab?: "guidance" | "panchangam";
};

type GeoSuggestion = {
  id: number;
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

const PREF_COOKIE = "horosPrefs";

function readPrefsFromCookie(): Prefs | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${PREF_COOKIE}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split("=", 2)[1])) as Prefs;
  } catch {
    return null;
  }
}

function writePrefsToCookie(prefs: Prefs) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 180; // 180 days
  document.cookie = `${PREF_COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; max-age=${maxAge}; path=/`;
}

export default function App() {
  const normalize = (v: string) => v.trim().toLowerCase();
  const heroBanner = "/images/brand/AstroZone_Banner_1920x700.jpg";
  const isValidTz = (tz?: string) => {
    if (!tz) return false;
    try {
      Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  };

  const fmtTime = (iso: string, tz?: string) => {
    const safeTz = isValidTz(tz) ? tz : undefined;
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: safeTz });
  };

  const formatPlaceLabel = (place: Partial<GeoSuggestion>) =>
    [place.name, place.admin1, place.country].filter(Boolean).join(", ");
  const formatCoordLabel = (lat: number, lon: number) => `Lat ${lat}, Lon ${lon}`;

  const savedPrefs = readPrefsFromCookie();
  const [language, setLanguage] = useState<Language>(savedPrefs?.language ?? "en");
  const [methodology, setMethodology] = useState<Methodology>(savedPrefs?.methodology ?? "tamil");
  const [periodType, setPeriodType] = useState<string>(savedPrefs?.periodType ?? "today");
  const [hiddenSigns, setHiddenSigns] = useState<Set<string>>(new Set(savedPrefs?.hiddenSigns ?? []));
  const [rawGuidance, setRawGuidance] = useState<any | null>(null);
  const [guidanceBatch, setGuidanceBatch] = useState<ParsedGuidanceItem[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, SignTimeBlock[]>>({});
  const [loading, setLoading] = useState(false);
  const [signsLoading, setSignsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signs, setSigns] = useState<ZodiacSign[]>([]);
  const [visibleLanguages, setVisibleLanguages] = useState<Language[]>(["en", "ta", "hi"]);
  const [showHiddenManager, setShowHiddenManager] = useState(false);
  const [activeTab, setActiveTab] = useState<"guidance" | "panchangam">(savedPrefs?.activeTab ?? "guidance");
  const [panchang, setPanchang] = useState<PanchangData | null>(null);
  const [panchangLoading, setPanchangLoading] = useState(false);
  const [panchangError, setPanchangError] = useState<string | null>(null);
  const [panchangDate, setPanchangDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [panchangLat, setPanchangLat] = useState(0);
  const [panchangLon, setPanchangLon] = useState(0);
  const [panchangTz, setPanchangTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata");
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [lastGuidanceToken, setLastGuidanceToken] = useState<string | null>(null);
  const [placeResults, setPlaceResults] = useState<GeoSuggestion[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState<string | null>(null);
  const [lastPanchangKey, setLastPanchangKey] = useState<string | null>(null);
  const initialGeoAttempted = useRef(false);
  const [geoPending, setGeoPending] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      if (typeof (input as any).showPicker === "function") {
        (input as any).showPicker();
        return;
      }
    } catch (err) {
      // ignore, fall back to click
    }
    input.focus();
    input.click();
  };
  const formatTzOffset = (tz?: string) => {
    if (!tz) return "";
    if (!isValidTz(tz)) return "";
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "short"
      }).formatToParts(new Date());
      const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
      return tzName.replace("GMT", "UTC");
    } catch {
      return "";
    }
  };

  const resolveReverseGeocode = async (
    lat: number,
    lon: number,
    fallbackTz?: string
  ): Promise<{ label?: string; tz?: string } | undefined> => {
    try {
      const res = await locatePanchangPlace({ lat, lon });
      if (res && res.name) setLocationLabel(res.name);
      if (res?.tz && isValidTz(res.tz)) setPanchangTz(res.tz);
      return { label: res?.name, tz: res?.tz };
    } catch {
      if (fallbackTz && isValidTz(fallbackTz)) setPanchangTz(fallbackTz);
      return undefined;
    }
  };

  const ensureLabelFromCoords = async (lat: number, lon: number, tz?: string) => {
    if (lat === 0 && lon === 0) {
      setLocationLabel("No City Selected");
      return undefined;
    }
    const info = await resolveReverseGeocode(lat, lon, tz);
    if (info?.tz && isValidTz(info.tz)) {
      setPanchangTz(info.tz);
    }
    if (info?.label) {
      setLocationLabel(info.label);
      return info.label;
    }
    setGeoStatus(null);
    return undefined;
  };

  const detectLocation = (autoLoad = false) => {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation not supported.");
      return;
    }
    setGeoPending(true);
    setGeoStatus("Detecting location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(3));
        const lon = parseFloat(pos.coords.longitude.toFixed(3));
        const tzGuess = Intl.DateTimeFormat().resolvedOptions().timeZone || panchangTz;
        setPanchangLat(lat);
        setPanchangLon(lon);
        setPanchangTz(tzGuess);
        setLocationLabel("Resolving City Name");
        const info = await resolveReverseGeocode(lat, lon, tzGuess);
        const label = info?.label || "";
        const tz = info?.tz || tzGuess;
        if (label) setLocationLabel(label);
        setGeoPending(false);
        setGeoStatus(null);
        if (autoLoad) {
          loadPanchang({ lat, lon, tz }, label);
        }
      },
      () => {
        setGeoStatus("Could not access location. Using defaults.");
        setGeoPending(false);
      },
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    const q = placeQuery.trim();
    if (q.length < 3) {
      setPlaceResults([]);
      setPlaceSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPlaceSearching(true);
      setPlaceSearchError(null);
      try {
        const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
        url.searchParams.set("name", q);
        url.searchParams.set("count", "6");
        url.searchParams.set("language", "en");
        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
        const data = await res.json();
        const mapped: GeoSuggestion[] = (Array.isArray(data.results) ? data.results : []).map((r: any, idx: number) => ({
          id: r.id ?? idx,
          name: r.name,
          country: r.country,
          admin1: r.admin1,
          latitude: r.latitude,
          longitude: r.longitude,
          timezone: r.timezone
        }));
        setPlaceResults(mapped);
      } catch (err) {
        if (controller.signal.aborted) return;
        setPlaceResults([]);
        setPlaceSearchError("Unable to fetch places. Try again.");
      } finally {
        if (!controller.signal.aborted) {
          setPlaceSearching(false);
        }
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [placeQuery]);

  useEffect(() => {
    if (activeTab !== "panchangam") return;
    const currentKey = `${panchangDate}|${panchangLat}|${panchangLon}|${panchangTz}`;
    if (panchangLoading) return;
    if (lastPanchangKey === currentKey && (panchang || panchangError)) return;
    if (geoPending) return;
    loadPanchang();
  }, [
    activeTab,
    panchangDate,
    panchangLat,
    panchangLon,
    panchangTz,
    panchang,
    panchangError,
    lastPanchangKey,
    panchangLoading,
    geoPending
  ]);

  useEffect(() => {
    if (initialGeoAttempted.current) return;
    initialGeoAttempted.current = true;
    detectLocation(true);
  }, []);
  const t = <K extends keyof (typeof copy)["en"]>(key: K, ...rest: any[]) => {
    const langCopy = copy[language] || copy.en;
    const val = langCopy[key] as any;
    if (typeof val === "function") return val(...rest);
    return val;
  };

  function getSignLabel(z: ZodiacSign): string {
    if (language === "ta" && z.tamil) return z.tamil;
    if (language === "hi" && z.hindi) return z.hindi;
    return z.english || z.displayName || z.code;
  }

  useEffect(() => {
    let active = true;
    async function loadSigns() {
      setSignsLoading(true);
      try {
        const res = await fetchZodiacSigns(methodology);
        if (!active) return;
        setSigns(res.signs);
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load zodiac signs");
      } finally {
        if (active) setSignsLoading(false);
      }
    }
    loadSigns();
    return () => {
      active = false;
    };
  }, [methodology]);

  useEffect(() => {
    let allowed: Language[] = ["en", "ta", "hi"];
    if (methodology === "tamil") {
      allowed = ["en", "ta"];
    } else if (methodology === "western") {
      allowed = ["en"];
    } else if (methodology === "vedic") {
      allowed = ["en", "hi"];
    }
    setVisibleLanguages(allowed);
    if (!allowed.includes(language)) {
      setLanguage(allowed[0]);
    }
  }, [methodology, language]);

  useEffect(() => {
    writePrefsToCookie({
      language,
      methodology,
      periodType,
      hiddenSigns: Array.from(hiddenSigns),
      activeTab
    });
  }, [language, methodology, periodType, hiddenSigns, activeTab]);

  const findSignMeta = (signCode: string): ZodiacSign | undefined => {
    const signMetaStrict = signs.find(
      (s) => s.code === signCode && s.methodology && normalize(s.methodology) === normalize(methodology)
    );
    if (signMetaStrict) return signMetaStrict;
    return signs.find(
      (s) =>
        s.methodology &&
        normalize(s.methodology) === normalize(methodology) &&
        [s.code, s.displayName, s.english, s.tamil, s.hindi]
          .filter(Boolean)
          .map((v) => normalize(String(v!)))
          .includes(normalize(signCode))
    );
  };

  const getSequenceForSign = (signCode: string): number | null => {
    const meta = findSignMeta(signCode);
    if (meta && typeof meta.sequence === "number") return meta.sequence;
    return null;
  };

  const hideSign = (signCode: string) => {
    setHiddenSigns((prev) => {
      const next = new Set(prev);
      next.add(signCode);
      return next;
    });
  };

  const unhideSign = (signCode: string) => {
    setHiddenSigns((prev) => {
      const next = new Set(prev);
      next.delete(signCode);
      return next;
    });
  };

  const unhideAll = () => setHiddenSigns(new Set());

  const loadPanchang = async (override?: { date?: string; lat?: number; lon?: number; tz?: string }, label?: string) => {
    const targetLat = override?.lat ?? panchangLat;
    const targetLon = override?.lon ?? panchangLon;
    if (targetLat === 0 && targetLon === 0) {
      setPanchang(null);
      setPanchangError("No City Selected");
      return;
    }
    setPanchangLoading(true);
    setPanchangError(null);
    const key = `${override?.date || panchangDate}|${targetLat}|${targetLon}|${
      override?.tz || panchangTz
    }`;
    setLastPanchangKey(key);
    if (label) {
      setLocationLabel(label);
    }
    try {
      const data = await fetchPanchangam({
        date: override?.date || panchangDate,
        lat: targetLat,
        lon: targetLon,
        tz: override?.tz || panchangTz,
        locationName: label || locationLabel || undefined
      });
      setPanchang(data);
      if (!label && data.meta?.location?.name) {
        setLocationLabel(data.meta.location.name);
      } else if (!label && data.meta?.location) {
        const updated = await ensureLabelFromCoords(data.meta.location.lat, data.meta.location.lon, data.meta.timezone);
        if (!updated) {
          setLocationLabel(formatCoordLabel(data.meta.location.lat, data.meta.location.lon));
        }
      }
      if (data.meta?.timezone && isValidTz(data.meta.timezone)) {
        setPanchangTz(data.meta.timezone);
      }
    } catch (err) {
      setPanchangError(err instanceof Error ? err.message : "Failed to load panchangam");
    } finally {
      setPanchangLoading(false);
    }
  };

  const handlePlaceSelect = (place: GeoSuggestion) => {
    const label = formatPlaceLabel(place) || place.name || "Selected location";
    const tz = isValidTz(place.timezone) ? place.timezone : panchangTz;
    setPanchangLat(place.latitude);
    setPanchangLon(place.longitude);
    if (tz) setPanchangTz(tz);
    setLocationLabel(label);
    setPlaceQuery(label);
    setShowLocationEditor(false);
    setGeoStatus(null);
    loadPanchang({ lat: place.latitude, lon: place.longitude, tz: tz || panchangTz }, label);
  };

  async function handleLoad() {
    setLoading(true);
    setError(null);
    try {
      const batchRaw = await fetchGuidanceBatch({ language, methodology, periodType });
      const parsedMap: ParsedGuidanceMap = parseGuidanceRaw(batchRaw, language, signs);
      const parsedItems: ParsedGuidanceItem[] = Object.entries(parsedMap).map(([code, text]) => ({
        sign: code,
        text
      }));
      setRawGuidance(batchRaw);
      setGuidanceBatch(parsedItems);
      setLastGuidanceToken(`${methodology}|${periodType}|${language}`);

      if (expanded.size > 0) {
        const nextDetails: Record<string, SignTimeBlock[]> = { ...details };
        expanded.forEach((signCode) => {
          nextDetails[signCode] = getSignBlocks(batchRaw, language, signs, signCode);
        });
        setDetails(nextDetails);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Fetch guidance when Guidance tab is active and period/method/language changed or first load.
  useEffect(() => {
    if (activeTab !== "guidance") return;
    if (signsLoading) return;
    if (signs.length === 0) return;
    const token = `${methodology}|${periodType}|${language}`;
    if (guidanceBatch && lastGuidanceToken === token) return;
    handleLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, methodology, periodType, language, signsLoading, signs.length]);

  // Re-parse when language changes so UI updates without re-calling backend.
  useEffect(() => {
    if (!rawGuidance) return;
    const parsedMap: ParsedGuidanceMap = parseGuidanceRaw(rawGuidance, language, signs);
    const parsedItems: ParsedGuidanceItem[] = Object.entries(parsedMap).map(([code, text]) => ({
      sign: code,
      text
    }));
    setGuidanceBatch(parsedItems);
    if (expanded.size > 0) {
      const nextDetails: Record<string, SignTimeBlock[]> = { ...details };
      expanded.forEach((signCode) => {
        nextDetails[signCode] = getSignBlocks(rawGuidance, language, signs, signCode);
      });
      setDetails(nextDetails);
    }
  }, [language, rawGuidance, signs, expanded, details]);

  const languageLabel = languageOptions.find((l) => l.code === language)?.label ?? language;
  const hasGuidance = Array.isArray(guidanceBatch) && guidanceBatch.length > 0;

  return (
    <div className="layout">
      <header className="header">
        <div className="brand">
          <img className="brand-icon" src="/images/brand/AstroZone_icon_64x64.png" alt="AstroZone.in" />
          <div>
            <div className="brand-name">AstroZone.in</div>
            <div className="brand-subtitle">Premium astrology guidance</div>
          </div>
        </div>
        <div className="header-right">
          <div className="header-tagline">Astrological Guidance, Made Personal</div>
          <nav className="language-switcher" aria-label="Language selection">
            {languageOptions
              .filter((lang) => visibleLanguages.includes(lang.code))
              .map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`lang-button ${language === lang.code ? "active" : ""}`}
                  onClick={() => setLanguage(lang.code)}
                >
                  {lang.label}
                </button>
              ))}
          </nav>
        </div>
      </header>

      <main className="app">
        {loading && (
          <div className="loading-overlay" role="status" aria-live="polite">
            <div className="loader" aria-hidden="true" />
            <div className="loading-text">Fetching guidance...</div>
          </div>
        )}

        {activeTab === "panchangam" && panchangLoading && (
          <div className="loading-overlay" role="status" aria-live="polite">
            <div className="loader" aria-hidden="true" />
            <div className="loading-text">Fetching panchangam...</div>
          </div>
        )}

        <div className="tabs">
          <button
            type="button"
            className={`tab ${activeTab === "guidance" ? "active" : ""}`}
            onClick={() => setActiveTab("guidance")}
          >
            {t("guidanceHeading")}
          </button>
          <button
            type="button"
            className={`tab ${activeTab === "panchangam" ? "active" : ""}`}
            onClick={() => setActiveTab("panchangam")}
          >
            {t("panchangHeading")}
          </button>
        </div>

        {activeTab === "guidance" && (
          <div className="guidance-block">
            <div className="pref-strip">
              <div className="pref-item">
                <label className="pref-label">{t("astrologyModel")}</label>
                <select
                  className="pref-select"
                  value={methodology}
                  onChange={(e) => setMethodology(e.target.value as Methodology)}
                  disabled={loading || signsLoading}
                >
                  {methodologies.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pref-item pref-right">
                <label className="pref-label">{t("dateRange")}</label>
                <select
                  className="pref-select"
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value)}
                  disabled={loading || signsLoading}
                >
                  {periods.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("guidanceEyebrow")}</p>
                <h2>{t("guidanceHeading")}</h2>
              </div>
              <div className="heading-actions">
                <button
                  type="button"
                  className="gear-button"
                  aria-label="Manage hidden signs"
                  onClick={() => setShowHiddenManager((v) => !v)}
                >
                  <span aria-hidden="true" />
                </button>
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}

            {showHiddenManager && (
              <div className="hidden-panel">
                  <div className="hidden-panel-row">
                  <div className="hidden-panel-title">{t("hiddenTitle")}</div>
                  <button type="button" className="unhide-all" onClick={unhideAll}>
                    {t("unhideAll")}
                  </button>
                </div>
                {hiddenSigns.size === 0 && <div className="hidden-empty">{t("hiddenNone")}</div>}
                {hiddenSigns.size > 0 && (
                  <div className="hidden-list">
                    {Array.from(hiddenSigns)
                      .map((code) => ({ code, meta: findSignMeta(code) }))
                      .map(({ code, meta }) => {
                        const label = meta ? getSignLabel(meta) : code;
                        return (
                          <button key={code} type="button" className="hidden-chip" onClick={() => unhideSign(code)}>
                            {label}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {!hasGuidance && (
              <div className="guidance-grid">
                <div className="card">
                  <div className="card-head">
                    <h4 className="sign-title">Loading guidance</h4>
                  </div>
                  <p className="error-text" style={{ margin: 0 }}>
                    {loading || signsLoading
                      ? "Fetching the latest guidance for your preferences..."
                      : "Tap refresh if guidance does not appear automatically."}
                  </p>
                  <div className="card-actions">
                    <button className="more-button" type="button" onClick={handleLoad} disabled={loading || signsLoading}>
                      Refresh
                    </button>
                  </div>
                </div>
              </div>
            )}

            {hasGuidance && (
              <div className="guidance-grid">
                {(guidanceBatch ?? [])
                  .filter((item) => !hiddenSigns.has(item.sign))
                  .sort((a, b) => {
                    const seqA = getSequenceForSign(a.sign);
                    const seqB = getSequenceForSign(b.sign);
                    if (seqA !== null && seqB !== null && seqA !== seqB) return seqA - seqB;
                    if (seqA !== null && seqB === null) return -1;
                    if (seqA === null && seqB !== null) return 1;
                    return a.sign.localeCompare(b.sign);
                  })
                  .map((item) => {
                    const signMeta = findSignMeta(item.sign);
                    const label = signMeta ? getSignLabel(signMeta) : item.sign;
                    const imageName = signMeta?.english || signMeta?.displayName || item.sign;
                    const isOpen = expanded.has(item.sign);
                    const blocks =
                      isOpen && rawGuidance
                        ? details[item.sign] || getSignBlocks(rawGuidance, language, signs, item.sign)
                        : [];
                    const shortBlocks =
                      !isOpen && rawGuidance ? getSignBlocks(rawGuidance, language, signs, item.sign) : [];
                    const shortGeneral = shortBlocks
                      .map((b) => {
                        const general =
                          b.categories.find((c) => normalize(c.category) === "general") || b.categories[0];
                        if (!general) return null;
                        const labelPrefix = b.label ? `<strong>${b.label}</strong>: ` : "";
                        return `${labelPrefix}${general.text}`;
                      })
                      .filter(Boolean)
                      .join("<br/>");

                    return (
                      <div className="card" key={item.sign}>
                        <div className="card-head">
                          <img className="sign-image" src={`/images/${methodology}/${imageName}.jpg`} alt={label} />
                          <h4 className="sign-title">{label}</h4>
                          <button
                            type="button"
                            className="hide-button"
                            aria-label={`Hide ${label}`}
                            onClick={() => hideSign(item.sign)}
                          >
                            <span aria-hidden="true" />
                          </button>
                        </div>
                        <p
                          style={{ margin: 0, minHeight: 70 }}
                          dangerouslySetInnerHTML={{ __html: shortGeneral || item.text }}
                        />
                        <div className="card-foot">
                          {isOpen && (
                            <div className="detail-block">
                              {blocks.length === 0 && (
                                <div className="detail-item">
                                  <div className="detail-title">General</div>
                                  <p className="detail-text">{item.text}</p>
                                </div>
                              )}
                              {blocks.map((block, idx) => (
                                <div key={idx} className="detail-item timeframe-item">
                                  <div className="timeframe-header">
                                    {block.label && <div className="detail-title">{block.label}</div>}
                                    {block.basis && <div className="detail-basis">{block.basis}</div>}
                                  </div>
                                  <div className="timeframe-categories">
                                    {block.categories.map((c) => (
                                      <div key={c.category} className="timeframe-category">
                                        <div className="detail-title">{c.category}</div>
                                        <p className="detail-text">{c.text}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="card-actions">
                            <button
                              className="more-button"
                              type="button"
                              aria-label={isOpen ? "Collapse details" : "Expand details"}
                              onClick={() => {
                                setExpanded((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.sign)) {
                                    next.delete(item.sign);
                                  } else {
                                    next.add(item.sign);
                                  }
                                  return next;
                                });
                                if (!expanded.has(item.sign) && rawGuidance) {
                                  const cats = getSignBlocks(rawGuidance, language, signs, item.sign);
                                  setDetails((d) => ({ ...d, [item.sign]: cats }));
                                }
                              }}
                            >
                              <span aria-hidden="true" className={`icon ${isOpen ? "icon-up" : "icon-down"}`} />
                              <span className="sr-only">{isOpen ? "Less" : "More"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {activeTab === "panchangam" && (
          <div className="panchangam">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("panchangEyebrow")}</p>
                <h2>{t("panchangHeading")}</h2>
              </div>
            </div>

            <div className="panch-top">
              <div className="date-controls">
                <button
                  type="button"
                  className="icon-button ghost"
                  onClick={() =>
                    setPanchangDate((d) => {
                      const next = new Date(d);
                      next.setDate(next.getDate() - 1);
                      const iso = next.toISOString().slice(0, 10);
                      loadPanchang({ date: iso });
                      return iso;
                    })
                  }
                  aria-label="Previous day"
                >
                  <span aria-hidden="true" className="icon icon-left" />
                  <span className="sr-only">Previous day</span>
                </button>
                <div
                  className="date-display"
                  role="button"
                  tabIndex={0}
                  onClick={openDatePicker}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDatePicker();
                    }
                  }}
                >
                  {panchangDate}
                </div>
                <input
                  ref={dateInputRef}
                  type="date"
                  style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0 }}
                  value={panchangDate}
                  onChange={(e) => {
                    setPanchangDate(e.target.value);
                    loadPanchang({ date: e.target.value });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setShowLocationEditor(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className="icon-button ghost"
                  onClick={() =>
                    setPanchangDate((d) => {
                      const next = new Date(d);
                      next.setDate(next.getDate() + 1);
                      const iso = next.toISOString().slice(0, 10);
                      loadPanchang({ date: iso });
                      return iso;
                    })
                  }
                  aria-label="Next day"
                >
                  <span aria-hidden="true" className="icon icon-right" />
                  <span className="sr-only">Next day</span>
                </button>
              </div>
              <div
                className="panch-meta clickable"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setPlaceQuery("");
                  setShowLocationEditor(true);
                  setTimeout(() => {
                    const input = document.getElementById("location-input");
                    input?.focus();
                  }, 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setPlaceQuery("");
                    setShowLocationEditor(true);
                    setTimeout(() => {
                      const input = document.getElementById("location-input");
                      input?.focus();
                    }, 0);
                  }
                }}
              >
                  <span>
                    {(() => {
                    const tzDisplay = isValidTz(panchangTz)
                      ? panchangTz
                      : isValidTz(panchang?.meta.timezone)
                      ? panchang?.meta.timezone
                      : "";
                    const label =
                      locationLabel ||
                      panchang?.meta.location.name ||
                      (panchangLat === 0 && panchangLon === 0
                        ? "No City Selected"
                        : panchang?.meta.location
                        ? formatCoordLabel(panchang.meta.location.lat, panchang.meta.location.lon)
                        : "");
                    return [label, tzDisplay ? `(${tzDisplay})` : ""].filter(Boolean).join(" ");
                  })()}
                  </span>
                </div>
              </div>

                {showLocationEditor && (
                    <div className="location-modal" role="dialog" aria-label="Select location">
                    <div className="location-editor" style={{ maxWidth: 560 }}>
                    <div className="location-grid">
                      <label className="field full">
                        <span className="field-label">City / State / Country</span>
                        <input
                          id="location-input"
                          type="text"
                          value={placeQuery}
                          onChange={(e) => setPlaceQuery(e.target.value)}
                          placeholder="e.g., Boston, MA, USA or Chennai, India"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && placeResults.length > 0) {
                              e.preventDefault();
                              handlePlaceSelect(placeResults[0]);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setShowLocationEditor(false);
                            }
                          }}
                        />
                      </label>
                      <div className="field full" style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="icon-button ghost"
                          style={{ padding: "8px", minWidth: 36, minHeight: 36, width: 36, height: 36 }}
                          onClick={() => {
                            detectLocation(true);
                            setShowLocationEditor(false);
                          }}
                          aria-label="Detect via browser"
                        >
                          <span aria-hidden="true" className="icon icon-target" />
                          <span className="sr-only">Detect via browser</span>
                        </button>
                      </div>
                    </div>
                    {placeSearching && <p className="error-text">Searching places...</p>}
                    {placeSearchError && <p className="error-text">{placeSearchError}</p>}
                {placeResults.length > 0 && (
                  <div className="hidden-list">
                    {placeResults.map((p) => {
                      const label = formatPlaceLabel(p);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="hidden-chip"
                          onClick={() => handlePlaceSelect(p)}
                        >
                          {label || p.name}
                          {p.timezone ? ` (${p.timezone})` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
                  </div>
                </div>
              )}

                {panchangError && <p className="error-text">{panchangError}</p>}
                {geoStatus && <p className="error-text">{geoStatus}</p>}

                {panchang && (
                  <div className="panch-grid">
                    {(() => {
                      const tzDisplay = isValidTz(panchang.meta.timezone)
                        ? panchang.meta.timezone
                        : isValidTz(panchangTz)
                        ? panchangTz
                        : undefined;
                      return (
                        <>
                          <div className="card">
                            <div className="card-head panch-head">
                              <h4 className="sign-title">{t("astronomy")}</h4>
                            </div>
                            <div className="panch-row">
                              <div>{t("sunrise")}</div>
                              <div className="panch-value">{fmtTime(panchang.astronomy.sunrise, tzDisplay)}</div>
                            </div>
                            <div className="panch-row">
                              <div>{t("sunset")}</div>
                              <div className="panch-value">{fmtTime(panchang.astronomy.sunset, tzDisplay)}</div>
                            </div>
                            <div className="panch-row">
                              <div>{t("nextSunrise")}</div>
                              <div className="panch-value">{fmtTime(panchang.astronomy.nextSunrise, tzDisplay)}</div>
                            </div>
                          </div>

                          <div className="card">
                            <div className="card-head panch-head">
                              <h4 className="sign-title">{t("angas")}</h4>
                            </div>
                            <div className="panch-row">
                              <div>{t("vara")}</div>
                              <div className="panch-value">{panchang.panchang.vara.name}</div>
                            </div>
                            <div className="panch-row">
                              <div>{t("tithi")}</div>
                              <div className="panch-value">{panchang.panchang.tithi.map((t) => t.name).join(", ")}</div>
                            </div>
                            <div className="panch-row">
                              <div>{t("nakshatra")}</div>
                              <div className="panch-value">
                                {panchang.panchang.nakshatra.map((t) => t.name).join(", ")}
                              </div>
                            </div>
                            <div className="panch-row">
                              <div>{t("yoga")}</div>
                              <div className="panch-value">{panchang.panchang.yoga.map((t) => t.name).join(", ")}</div>
                            </div>
                            <div className="panch-row">
                              <div>{t("karana")}</div>
                              <div className="panch-value">{panchang.panchang.karana.map((t) => t.name).join(", ")}</div>
                            </div>
                          </div>

                          <div className="card">
                            <div className="card-head panch-head">
                              <h4 className="sign-title">{t("auspicious")}</h4>
                            </div>
                            <div className="panch-row">
                              <div>{t("brahma")}</div>
                              <div className="panch-value">
                                {panchang.timings.brahmaMuhurta
                                  .map((t) => `${fmtTime(t.start, tzDisplay)} - ${fmtTime(t.end, tzDisplay)}`)
                                  .join(", ")}
                              </div>
                            </div>
                            <div className="panch-row">
                              <div>{t("abhijit")}</div>
                              <div className="panch-value">
                                {panchang.timings.abhijitMuhurta
                                  .map((t) => `${fmtTime(t.start, tzDisplay)} - ${fmtTime(t.end, tzDisplay)}`)
                                  .join(", ")}
                              </div>
                            </div>
                          </div>

                          <div className="card">
                            <div className="card-head panch-head">
                              <h4 className="sign-title">{t("avoid")}</h4>
                            </div>
                            <div className="panch-row">
                              <div>{t("rahu")}</div>
                              <div className="panch-value">
                                {panchang.timings.rahuKalam
                                  .map((t) => `${fmtTime(t.start, tzDisplay)} - ${fmtTime(t.end, tzDisplay)}`)
                                  .join(", ")}
                              </div>
                            </div>
                            <div className="panch-row">
                              <div>{t("yama")}</div>
                              <div className="panch-value">
                                {panchang.timings.yamagandam
                                  .map((t) => `${fmtTime(t.start, tzDisplay)} - ${fmtTime(t.end, tzDisplay)}`)
                                  .join(", ")}
                              </div>
                            </div>
                            <div className="panch-row">
                              <div>{t("gulikai")}</div>
                              <div className="panch-value">
                                {panchang.timings.gulikai
                                  .map((t) => `${fmtTime(t.start, tzDisplay)} - ${fmtTime(t.end, tzDisplay)}`)
                                  .join(", ")}
                              </div>
                            </div>
                            <div className="panch-row">
                              <div>{t("dur")}</div>
                              <div className="panch-value">
                                {panchang.timings.durmuhurtam
                                  .map((t) => `${fmtTime(t.start, tzDisplay)} - ${fmtTime(t.end, tzDisplay)}`)
                                  .join(", ")}
                              </div>
                            </div>
                            <div className="panch-row">
                              <div>{t("varjyam")}</div>
                              <div className="panch-value">
                                {panchang.timings.varjyam
                                  .map(
                                    (t) =>
                                      `${fmtTime(t.start, tzDisplay)} - ${fmtTime(t.end, tzDisplay)}${
                                        t.nakshatra ? ` (${t.nakshatra})` : ""
                                      }`
                                  )
                                  .join(", ")}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
      </main>

      <footer className="footer">
        <span>© 2026 AstroZone.in. All rights reserved.</span>
      </footer>
    </div>
  );
}
