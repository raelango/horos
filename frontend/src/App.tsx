import { useEffect, useRef, useState } from "react";
import { fetchGuidanceBatch, fetchZodiacSigns, fetchPanchangam, locatePanchangPlace, fetchHoroscope } from "./api";
import { parseGuidanceRaw, ParsedGuidanceMap, getSignBlocks, SignTimeBlock } from "./guidanceHelper";
import { Language, Methodology, ParsedGuidanceItem, ZodiacSign, PanchangData } from "./types";
import { copy } from "./i18n";

const languageOptions: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ta", label: "Tamil" },
  { code: "hi", label: "Hindi" }
];

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
  activeTab?: "guidance" | "panchangam" | "horoscope";
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
  const [horoscopePlaceQuery, setHoroscopePlaceQuery] = useState("");
  const [locationLabel, setLocationLabel] = useState<string>("");
  const [lastGuidanceToken, setLastGuidanceToken] = useState<string | null>(null);
  const [placeResults, setPlaceResults] = useState<GeoSuggestion[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState<string | null>(null);
  const [horoscopeResults, setHoroscopeResults] = useState<GeoSuggestion[]>([]);
  const [horoscopeSearching, setHoroscopeSearching] = useState(false);
  const [horoscopeSearchError, setHoroscopeSearchError] = useState<string | null>(null);
  const [lastPanchangKey, setLastPanchangKey] = useState<string | null>(null);
  const initialGeoAttempted = useRef(false);
  const [geoPending, setGeoPending] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<"guidance" | "panchangam" | "horoscope">(savedPrefs?.activeTab ?? "guidance");
const [horoscopeDate, setHoroscopeDate] = useState(() => new Date().toISOString().slice(0, 10));
const [horoscopeTime, setHoroscopeTime] = useState("12:00");
const [horoscopeLat, setHoroscopeLat] = useState(0);
const [horoscopeLon, setHoroscopeLon] = useState(0);
const [horoscopeLabel, setHoroscopeLabel] = useState("No City Selected");
const [horoscopeTz, setHoroscopeTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata");
const [horoscopeSummary, setHoroscopeSummary] = useState<string | null>(null);
const [rasiChart, setRasiChart] = useState<{ label: string; bodies: string }[][] | null>(null);
const [navamsaChart, setNavamsaChart] = useState<{ label: string; bodies: string }[][] | null>(null);
const [horoscopeError, setHoroscopeError] = useState<string | null>(null);
const [planetPositions, setPlanetPositions] = useState<any[]>([]);
const [birthDetails, setBirthDetails] = useState<{ label: string; value: string }[]>([]);
const [horoscopeLoading, setHoroscopeLoading] = useState(false);
const [horoscopeMeta, setHoroscopeMeta] = useState<any | null>(null);
const [mahadasas, setMahadasas] = useState<
  { name: string; start: string; end: string; bhuktis: { name: string; start: string; end: string }[]; open?: boolean }[]
>([]);
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
        const res = await locatePanchangPlace({ place: q });
        const mapped: GeoSuggestion[] = res?.results
          ? res.results
              .filter((r: any) => r && r.lat && r.lon)
              .map((r: any, idx: number) => ({
                id: r.id ?? idx,
                name: r.name,
                country: r.country,
                admin1: r.admin1,
                latitude: parseFloat(r.lat),
                longitude: parseFloat(r.lon),
                timezone: r.tz
              }))
          : res?.lat && res?.lon
          ? [
              {
                id: 1,
                name: res.name,
                country: res.country,
                admin1: res.admin1,
                latitude: parseFloat(res.lat),
                longitude: parseFloat(res.lon),
                timezone: res.tz
              }
            ]
          : [];
        setPlaceResults(mapped);
      } catch (err) {
        if (controller.signal.aborted) return;
        setPlaceResults([]);
        setPlaceSearchError(copy[language]?.placesError ?? copy.en.placesError);
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
    const q = horoscopePlaceQuery.trim();
    if (q.length < 3) {
      setHoroscopeResults([]);
      setHoroscopeSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setHoroscopeSearching(true);
      setHoroscopeSearchError(null);
      try {
        const res = await locatePanchangPlace({ place: q });
        const mapped: GeoSuggestion[] = res?.results
          ? res.results
              .filter((r: any) => r && r.lat && r.lon)
              .map((r: any, idx: number) => ({
                id: r.id ?? idx,
                name: r.name,
                country: r.country,
                admin1: r.admin1,
                latitude: parseFloat(r.lat),
                longitude: parseFloat(r.lon),
                timezone: r.tz
              }))
          : res?.lat && res?.lon
          ? [
              {
                id: 1,
                name: res.name,
                country: res.country,
                admin1: res.admin1,
                latitude: parseFloat(res.lat),
                longitude: parseFloat(res.lon),
                timezone: res.tz
              }
            ]
          : [];
        setHoroscopeResults(mapped);
      } catch {
        if (controller.signal.aborted) return;
        setHoroscopeResults([]);
        setHoroscopeSearchError(copy[language]?.placesError ?? copy.en.placesError);
      } finally {
        if (!controller.signal.aborted) {
          setHoroscopeSearching(false);
        }
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [horoscopePlaceQuery]);

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

  const handleHoroscopeSelect = (place: GeoSuggestion) => {
    const label = formatPlaceLabel(place) || place.name || "Selected location";
    setHoroscopeLat(place.latitude);
    setHoroscopeLon(place.longitude);
    setHoroscopeLabel(label);
    setHoroscopePlaceQuery(label);
    setHoroscopeResults([]);
    setHoroscopeSearchError(null);
    setHoroscopeSearching(false);
    if (isValidTz(place.timezone)) {
      setHoroscopeTz(place.timezone as string);
    }
  };

  const generateHoroscope = async () => {
    setHoroscopeError(null);
    setHoroscopeSummary(null);
    setRasiChart(null);
    setNavamsaChart(null);
    setPlanetPositions([]);
    setBirthDetails([]);
    setHoroscopeMeta(null);
    if (horoscopeLat === 0 && horoscopeLon === 0) {
      setHoroscopeError(t("horoscopeMissingLocation"));
      return;
    }
    setHoroscopeLoading(true);
    try {
      const resp = await fetchHoroscope({
        date: horoscopeDate,
        time: horoscopeTime,
        lat: horoscopeLat,
        lon: horoscopeLon,
        tz: horoscopeTz,
        placeName: horoscopeLabel,
        language
      });
      setHoroscopeSummary(resp.summary || null);
      setRasiChart(resp.rasiChart || null);
      setNavamsaChart(resp.navamsaChart || null);
      setPlanetPositions(resp.planetPositions || []);
      setBirthDetails(resp.birthDetails || []);
      setHoroscopeMeta(resp.meta || null);
      if (resp.mahadasas) {
        const today = new Date().toISOString().slice(0, 10);
        const mapped = resp.mahadasas.map((d: any) => {
          const isToday =
            d.start &&
            d.end &&
            today >= String(d.start) &&
            today <= String(d.end);
          return { ...d, open: Boolean(isToday) };
        });
        setMahadasas(mapped);
      } else {
        setMahadasas([
          {
            name: "Rahu",
            start: "2020-01-01",
            end: "2038-12-31",
            open: false,
            bhuktis: [
              { name: "Rahu / Rahu", start: "2020-01-01", end: "2022-06-30" },
              { name: "Rahu / Jupiter", start: "2022-07-01", end: "2024-12-31" },
              { name: "Rahu / Saturn", start: "2025-01-01", end: "2027-06-30" },
              { name: "Rahu / Mercury", start: "2027-07-01", end: "2029-12-31" },
            ],
          },
          {
            name: "Jupiter",
            start: "2039-01-01",
            end: "2055-12-31",
            open: false,
            bhuktis: [
              { name: "Jupiter / Jupiter", start: "2039-01-01", end: "2040-12-31" },
              { name: "Jupiter / Saturn", start: "2041-01-01", end: "2043-12-31" },
            ],
          },
        ]);
      }
    } catch (err) {
      setHoroscopeError(err instanceof Error ? err.message : "Failed to generate horoscope");
    } finally {
      setHoroscopeLoading(false);
    }
  };
  const t = (key: string, ...rest: any[]) => {
    const langCopy = copy[language] || copy.en || {};
    const fallback = copy.en || {};
    const val = (langCopy[key] ?? fallback[key]) as any;
    if (typeof val === "function") return val(...rest);
    return val;
  };

  const renderSouthIndianChart = (chart: { label: string; bodies: string }[][], key: string) => {
    const normalize = (value: string) => (value || "").trim().toLowerCase();
    const labelMap = new Map<string, { raw: string; bodies: string }>();
    chart.flat().forEach((c) => {
      const label = c.label || "";
      labelMap.set(normalize(label), { raw: label, bodies: c.bodies || "" });
    });

    const aliases: Record<string, string[]> = {
      Meena: ["Meena", "Meenam", "Pisces", "?????", "???"],
      Mesha: ["Mesha", "Mesham", "Aries", "?????", "???"],
      Vrishabha: ["Vrishabha", "Rishabha", "Rishabam", "Taurus", "??????", "????"],
      Mithuna: ["Mithuna", "Mithunam", "Gemini", "???????", "?????"],
      Karka: ["Karka", "Karkata", "Cancer", "?????", "???", "????"],
      Simha: ["Simha", "Simmam", "Leo", "???????", "????"],
      Kanya: ["Kanya", "Kanni", "Virgo", "?????", "?????"],
      Tula: ["Tula", "Thula", "Libra", "??????", "????"],
      Vrishchika: ["Vrishchika", "Vrichika", "Scorpio", "???????????", "???????"],
      Dhanu: ["Dhanu", "Dhanus", "Sagittarius", "?????", "???"],
      Makara: ["Makara", "Makaram", "Capricorn", "?????", "???"],
      Kumbha: ["Kumbha", "Kumbam", "Aquarius", "???????", "?????"]
    };

    const findCell = (keyName: string) => {
      const aliasList = aliases[keyName] || [keyName];
      for (const alias of aliasList) {
        const match = labelMap.get(normalize(alias));
        if (match) return { label: match.raw || alias, bodies: match.bodies };
      }
      for (const entry of labelMap.entries()) {
        const norm = entry[0];
        const data = entry[1];
        if (aliasList.some((alias) => norm.includes(normalize(alias)))) {
          return { label: data.raw || aliasList[0], bodies: data.bodies };
        }
      }
      return { label: aliasList[0], bodies: "" };
    };

    const cells: ({ label: string; bodies: string } | null)[] = Array(16).fill(null);
    // Meena fixed in top-left, clockwise around the frame
    const positions: Array<[number, keyof typeof aliases]> = [
      [0, "Meena"],
      [1, "Mesha"],
      [2, "Vrishabha"],
      [3, "Mithuna"],
      [7, "Karka"],
      [11, "Simha"],
      [15, "Kanya"],
      [14, "Tula"],
      [13, "Vrishchika"],
      [12, "Dhanu"],
      [8, "Makara"],
      [4, "Kumbha"]
    ];

    positions.forEach(([idx, sign]) => {
      const cellData = findCell(sign);
      cells[idx] = { label: cellData.label, bodies: cellData.bodies };
    });

    return (
      <div style={{ overflowX: "auto", width: "100%" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(70px, 1fr))",
            gap: "6px",
            minWidth: 300,
            width: "100%",
            maxWidth: "100%"
          }}
        >
          {cells.map((cell, idx) => {
            if (!cell) {
              return <div key={`${key}-${idx}`} className="detail-item" style={{ minHeight: 40, opacity: 0.15 }} />;
            }
            const rawBodies = cell.bodies || "";
            const fixedBodies = language === "ta" ? rawBodies.replace(/சன/g, "சனி") : rawBodies;
            const bodiesLower = fixedBodies.toLowerCase();
            const isAsc = bodiesLower.includes("asc") || bodiesLower.includes("lagna");
            return (
              <div
                key={`${key}-${idx}`}
                className="detail-item"
                style={{
                  minHeight: 80,
                  borderWidth: 2,
                  borderColor: isAsc ? "rgba(212, 175, 55, 0.85)" : undefined,
                  boxShadow: isAsc ? "0 0 0 1px rgba(212,175,55,0.35)" : undefined,
                  wordBreak: "break-word"
                }}
              >
                <div className="detail-title">{cell.label}</div>
                <p className="detail-text" style={{ fontWeight: isAsc ? 700 : 400 }}>{fixedBodies}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const formatDasaDate = (iso?: string) => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const locale = language === "ta" ? "ta-IN" : language === "hi" ? "hi-IN" : "en-US";
    return date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
  };
  const todayIso = new Date().toISOString().slice(0, 10);

  const toggleMahadasa = (index: number) => {
    setMahadasas((prev) => prev.map((d, i) => (i === index ? { ...d, open: !d.open } : d)));
  };
  const localizeText = (value: string) => {
    if (!value) return value;
    return language === "ta" ? value.replace(/சன/g, "சனி") : value;
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
        <div className="header-right" style={{ gap: 16, display: "flex", alignItems: "center" }}>
          <nav className="tabs menu" aria-label="Main menu">
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
            <button
              type="button"
              className={`tab ${activeTab === "horoscope" ? "active" : ""}`}
              onClick={() => setActiveTab("horoscope")}
            >
              {t("horoscope")}
            </button>
          </nav>
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
            {placeSearching && <p className="error-text">{copy[language]?.searchingPlaces ?? copy.en.searchingPlaces}</p>}
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

      {activeTab === "horoscope" && (
        <main className="app">
          <div className="guidance-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{t("horoscopeEyebrow")}</p>
                <h2>{t("horoscopeHeading")}</h2>
              </div>
            </div>

            <div className="pref-strip">
              <div className="pref-item">
                <label className="pref-label">{t("horoscopeBirthDate")}</label>
                <input
                  type="date"
                  className="pref-select"
                  value={horoscopeDate}
                  onChange={(e) => setHoroscopeDate(e.target.value)}
                />
              </div>
              <div className="pref-item">
                <label className="pref-label">{t("horoscopeBirthTime")}</label>
                <input
                  type="time"
                  className="pref-select"
                  value={horoscopeTime}
                  onChange={(e) => setHoroscopeTime(e.target.value)}
                />
              </div>
              <div className="pref-item pref-right" style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <label className="pref-label">{t("horoscopeLocation")}</label>
                <input
                  type="text"
                  className="pref-select"
                  style={{ flex: 1 }}
                  value={horoscopePlaceQuery}
                  placeholder="City / State / Country"
                  onChange={(e) => setHoroscopePlaceQuery(e.target.value)}
                />
                <button
                  className="load-panchang"
                  type="button"
                  onClick={generateHoroscope}
                  disabled={horoscopeLoading}
                  style={{ whiteSpace: "nowrap", minHeight: 44 }}
                >
                  {horoscopeLoading ? t("generatingHoroscope") : t("horoscopeGenerate")}
                </button>
              </div>
            </div>

            {horoscopeSearching && <p className="error-text">{copy[language]?.searchingPlaces ?? copy.en.searchingPlaces}</p>}
            {horoscopeSearchError && <p className="error-text">{horoscopeSearchError}</p>}
            {horoscopeError && <p className="error-text">{horoscopeError}</p>}
            {horoscopeResults.length > 0 && (
              <div className="hidden-list">
                {horoscopeResults.map((p) => {
                  const label = formatPlaceLabel(p);
                  return (
                    <button key={p.id} type="button" className="hidden-chip" onClick={() => handleHoroscopeSelect(p)}>
                      {label || p.name}
                      {p.timezone ? ` (${p.timezone})` : ""}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="guidance-grid" style={{ gridTemplateColumns: "1fr" }}>
              {horoscopeSummary && (
                <>
                  <div className="card">
                    <div className="card-head">
                      <h4 className="sign-title">{t("birthChartTitle")}</h4>
                    </div>
                    <p className="detail-text">{t("birthChartDescription")}</p>
                    <p className="detail-text">{horoscopeSummary}</p>
                    {horoscopeMeta && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginTop: 12 }}>
                        <div className="detail-item">
                          <div className="detail-title">{t("chartInfoMethod")}</div>
                          <p className="detail-text">
                            {[horoscopeMeta.method, horoscopeMeta.ayanamsa || "Lahiri", horoscopeMeta.houseSystem || "Whole Sign"]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                        </div>
                        <div className="detail-item">
                          <div className="detail-title">{t("chartInfoCoords")}</div>
                          <p className="detail-text">
                            Lat {horoscopeMeta.lat}, Lon {horoscopeMeta.lon} ({horoscopeMeta.tz})
                          </p>
                        </div>
                        {horoscopeMeta.placeName && (
                          <div className="detail-item">
                            <div className="detail-title">{t("chartInfoPlace")}</div>
                            <p className="detail-text">{horoscopeMeta.placeName}</p>
                          </div>
                        )}
                        <div className="detail-item">
                          <div className="detail-title">{t("chartInfoAsc")}</div>
                          <p className="detail-text">{horoscopeMeta.ascendant || ""}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {rasiChart && (
                    <div className="card">
                      <div className="card-head">
                        <h4 className="sign-title">{t("horoscopeRasi")}</h4>
                      </div>
                      {renderSouthIndianChart(rasiChart, "rasi")}
                    </div>
                  )}

                  {navamsaChart && (
                    <div className="card">
                      <div className="card-head">
                        <h4 className="sign-title">{t("horoscopeNavamsa")}</h4>
                      </div>
                      {renderSouthIndianChart(navamsaChart, "navamsa")}
                    </div>
                  )}                  {mahadasas.length > 0 && (
                    <div className="card">
                      <div className="card-head">
                        <h4 className="sign-title">{t("mahadasaTitle")}</h4>
                      </div>
                      <div className="detail-block">
                        {mahadasas.map((dasa, idx) => (
                          <div key={`${dasa.name}-${idx}`} className="detail-item">
                            <div className="hidden-panel-row">
                              <div>
                                <div className="detail-title">{dasa.name}</div>
                                <div className="panch-meta">
                                  <span>{t("starts")}: {formatDasaDate(dasa.start)}</span>
                                  <span>{t("ends")}: {formatDasaDate(dasa.end)}</span>
                                </div>
                              </div>
                              <button className="more-button" type="button" onClick={() => toggleMahadasa(idx)} aria-label={dasa.open ? t("hide") : t("show")}>
                                <span aria-hidden="true" className={`icon ${dasa.open ? "icon-up" : "icon-down"}`} />
                              </button>
                            </div>
                            {dasa.open && dasa.bhuktis?.length > 0 && (
                              <div className="detail-block" style={{ marginTop: 8, marginLeft: 12 }}>
                                {dasa.bhuktis.map((b, bi) => (
                                  <div
                                    key={`${dasa.name}-${bi}`}
                                    className="detail-item"
                                    style={{
                                      background: "rgba(242,232,213,0.03)",
                                      borderColor:
                                        todayIso >= String(b.start) && todayIso <= String(b.end)
                                          ? "rgba(212,175,55,0.8)"
                                          : undefined,
                                      boxShadow:
                                        todayIso >= String(b.start) && todayIso <= String(b.end)
                                          ? "0 0 0 1px rgba(212,175,55,0.35)"
                                          : undefined
                                    }}
                                  >
                                    <div className="detail-title">{t("bukthi")}: {b.name}</div>
                                    <div className="panch-meta">
                                      <span>{t("starts")}: {formatDasaDate(b.start)}</span>
                                      <span>{t("ends")}: {formatDasaDate(b.end)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {planetPositions.length > 0 && (
                    <div className="card">
                      <div className="card-head">
                        <h4 className="sign-title">{t("planetPositionsTitle")}</h4>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                          <thead>
                            <tr>
                              {["Planets", "Positions", "Degrees", "Rasi", "Rasi Lord", "Nakshatra", "Nakshatra Lord"].map((h) => (
                                <th
                                  key={h}
                                  style={{
                                    textAlign: "left",
                                    padding: "8px 6px",
                                    borderBottom: "1px solid rgba(212, 175, 55, 0.24)",
                                    color: "var(--star-glow)"
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {planetPositions.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: "1px solid rgba(212, 175, 55, 0.1)" }}>
                                <td style={{ padding: "8px 6px", fontWeight: 700 }}>{row.planet}</td>
                                <td style={{ padding: "8px 6px" }}>{localizeText(row.position)}</td>
                                <td style={{ padding: "8px 6px" }}>{localizeText(row.degree)}</td>
                                <td style={{ padding: "8px 6px" }}>{localizeText(row.rasi)}</td>
                                <td style={{ padding: "8px 6px" }}>{localizeText(row.rasiLord)}</td>
                                <td style={{ padding: "8px 6px" }}>{localizeText(row.nakshatra)}</td>
                                <td style={{ padding: "8px 6px" }}>{localizeText(row.nakshatraLord)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {birthDetails.length > 0 && (
                    <div className="card">
                      <div className="card-head">
                        <h4 className="sign-title">{t("birthDetailsTitle")}</h4>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                        {birthDetails.map((item, idx) => (
                          <div key={idx} className="detail-item">
                            <div className="detail-title">{item.label}</div>
                            <p className="detail-text">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      )}

      <footer className="footer">
        <span>© 2026 AstroZone.in. All rights reserved.</span>
      </footer>
    </div>
  );
}










