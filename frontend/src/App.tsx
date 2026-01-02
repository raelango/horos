import { useEffect, useState } from "react";
import { fetchGuidanceBatch, fetchZodiacSigns } from "./api";
import { parseGuidanceRaw, ParsedGuidanceMap, getSignBlocks, SignTimeBlock } from "./guidanceHelper";
import { Language, Methodology, ParsedGuidanceItem, ZodiacSign } from "./types";

const languageOptions: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ta", label: "Tamil" },
  { code: "hi", label: "Hindi" }
];

const methodologies: Methodology[] = ["tamil", "vedic", "western"];

const periods = ["today", "tomorrow", "this week", "next week", "this month", "next month", "this quarter", "next quarter"];

type Prefs = { language: Language; methodology: Methodology; periodType: string };

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

  const savedPrefs = readPrefsFromCookie();
  const [language, setLanguage] = useState<Language>(savedPrefs?.language ?? "en");
  const [methodology, setMethodology] = useState<Methodology>(savedPrefs?.methodology ?? "tamil");
  const [periodType, setPeriodType] = useState<string>(savedPrefs?.periodType ?? "today");
  const [rawGuidance, setRawGuidance] = useState<any | null>(null);
  const [guidanceBatch, setGuidanceBatch] = useState<ParsedGuidanceItem[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, SignTimeBlock[]>>({});
  const [loading, setLoading] = useState(false);
  const [signsLoading, setSignsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signs, setSigns] = useState<ZodiacSign[]>([]);
  const [visibleLanguages, setVisibleLanguages] = useState<Language[]>(["en", "ta", "hi"]);

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
    writePrefsToCookie({ language, methodology, periodType });
  }, [language, methodology, periodType]);

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

  // Auto-fetch on initial load and whenever methodology or period changes (after signs are ready).
  useEffect(() => {
    if (signsLoading) return;
    if (signs.length === 0) return;
    handleLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodology, periodType, signsLoading, signs.length]);

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

        <section className="pref-strip">
          <div className="pref-item">
            <label className="pref-label">Astrology Model</label>
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
            <label className="pref-label">Date Range</label>
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
        </section>

        <section
          className="hero"
          style={{
            backgroundImage: `linear-gradient(120deg, rgba(11, 20, 55, 0.92), rgba(19, 28, 75, 0.82)), url(${heroBanner})`
          }}
        >
          <div className="hero-copy">
            <p className="eyebrow">Personalized cosmic clarity</p>
            <h1>Astrological Guidance, Made Personal</h1>
            <p className="hero-lede">
              Refined {methodology} astrology that stays warm, trustworthy, and tailored for the moments that matter. Tune
              your view for {periodType} and stay aligned with every sign.
            </p>
            <div className="pill-row">
              <span className="pill">{methodology} astrology</span>
              <span className="pill">{periodType}</span>
              <span className="pill">{languageLabel} delivery</span>
            </div>
          </div>
        </section>

        {error && !guidanceBatch && <p className="error-text">{error}</p>}

        {guidanceBatch && (
          <div className="guidance-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Zodiac journeys</p>
                <h2>Sign-specific guidance</h2>
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}

            <div className="guidance-grid">
              {guidanceBatch
                .sort((a, b) => a.sign.localeCompare(b.sign))
                .map((item) => {
                  const signMetaStrict = signs.find(
                    (s) => s.code === item.sign && s.methodology && normalize(s.methodology) === normalize(methodology)
                  );
                  const signMetaLoose =
                    signMetaStrict ||
                    signs.find(
                      (s) =>
                        s.methodology &&
                        normalize(s.methodology) === normalize(methodology) &&
                        [s.code, s.displayName, s.english, s.tamil, s.hindi]
                          .filter(Boolean)
                          .map((v) => normalize(String(v!)))
                          .includes(normalize(item.sign))
                    );
                  const signMeta = signMetaLoose || signMetaStrict;
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
                      const general = b.categories.find((c) => normalize(c.category) === "general") || b.categories[0];
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
                            {isOpen ? "Less" : "More"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <span>© 2026 AstroZone.in. All rights reserved.</span>
      </footer>
    </div>
  );
}
