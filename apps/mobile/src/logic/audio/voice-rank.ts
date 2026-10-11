import type { SpeechLang } from '@hangul-route/content-schema';

/**
 * Voice choice (F-AUDIO-004 §3.4, AD5). Pure: ranked, filtered, deterministic.
 *
 * A voice that fails an eligibility rule is excluded, never demoted: an
 * English voice must not read Hangul, and Apple's novelty ko_KR voices must
 * not be picked just because they come first in the list.
 *
 * Hermes constraints: no `\p{}` classes and no look-behind. `\b` does not work
 * next to Hangul in a non-unicode regex (Hangul is a non-word character), so
 * the name patterns use explicit ASCII-word boundaries instead.
 */
export interface VoiceCandidate {
  /** iOS identifier / Android name / web voiceURI (web: name when voiceURI is empty). */
  id: string;
  name: string;
  /** Raw tag from the engine; normalised by `normLang()`. */
  lang: string;
  /** Web `localService`; iOS true; Android false when the name contains "network"; null = unknown. */
  local: boolean | null;
  isDefault: boolean;
  quality: 'premium' | 'enhanced' | 'standard';
}

export type VoiceQuality = VoiceCandidate['quality'];

/** Apple's novelty ko_KR voices (`say -v '?'`), hard-excluded for Korean. */
export const KO_EXCLUDED_NAMES: readonly string[] = [
  'Eddy',
  'Flo',
  'Grandma',
  'Grandpa',
  'Reed',
  'Rocko',
  'Sandy',
  'Shelley',
];

const EXCLUDED_LOWER: ReadonlySet<string> = new Set(KO_EXCLUDED_NAMES.map((n) => n.toLowerCase()));

/** 'ko_KR' -> 'ko-kr'; trims and lower-cases. */
export function normLang(raw: string): string {
  return raw.trim().toLowerCase().replace(/_/g, '-');
}

interface ChainEntry {
  /** Normalised tag. */
  tag: string;
  /** true = the bare language or any tag starting with `tag` + "-". */
  prefix: boolean;
  /** Score bonus: the exact tag gets the spec's +5, later tags a little less. */
  bonus: number;
}

/** Preference chain per wanted language, best first (§3.4 eligibility 1). */
const CHAINS: Readonly<Record<SpeechLang, readonly ChainEntry[]>> = {
  'ko-KR': [
    { tag: 'ko-kr', prefix: false, bonus: 5 },
    { tag: 'ko', prefix: true, bonus: 0 },
  ],
  'en-US': [
    { tag: 'en-us', prefix: false, bonus: 5 },
    { tag: 'en', prefix: true, bonus: 0 },
  ],
  'es-US': [
    { tag: 'es-us', prefix: false, bonus: 5 },
    { tag: 'es-mx', prefix: false, bonus: 4 },
    { tag: 'es-419', prefix: false, bonus: 3 },
    { tag: 'es', prefix: true, bonus: 0 },
  ],
};

/** The first chain entry this tag matches, or null when the language is not eligible. */
function matchChain(lang: string, want: SpeechLang): ChainEntry | null {
  const norm = normLang(lang);
  for (const entry of CHAINS[want]) {
    if (entry.prefix ? norm === entry.tag || norm.startsWith(`${entry.tag}-`) : norm === entry.tag) return entry;
  }
  return null;
}

/** The first ASCII word of a voice name, lower-cased ("Eddy (한국어(한국))" gives "eddy"). */
function leadingWord(name: string): string {
  return name.trim().replace(/[^A-Za-z0-9_][\s\S]*$/, '').toLowerCase();
}

const YUNA_EN = /(^|[^A-Za-z0-9_])yuna($|[^A-Za-z0-9_])/i;
const GOOGLE_KO = /Google\s*한국/;
const MICROSOFT_KO = /Microsoft\b.*\b(SunHi|InJoon|Heami)\b/i;

function isKnownGoodKorean(name: string): boolean {
  return YUNA_EN.test(name) || name.includes('유나') || GOOGLE_KO.test(name) || MICROSOFT_KO.test(name);
}

const QUALITY_RANK: Readonly<Record<VoiceQuality, number>> = { standard: 0, enhanced: 1, premium: 2 };

/**
 * Quality from the engine field where it exists, from the name otherwise
 * ("(Premium)", "(Enhanced)", and the Korean localisations). iOS reports
 * Premium as Default (`SpeechModule.swift:62`), so the name can only upgrade.
 */
export function effectiveQuality(voice: VoiceCandidate): VoiceQuality {
  let fromName: VoiceQuality = 'standard';
  if (/premium/i.test(voice.name) || voice.name.includes('프리미엄')) fromName = 'premium';
  else if (/enhanced/i.test(voice.name) || voice.name.includes('향상됨')) fromName = 'enhanced';
  return QUALITY_RANK[fromName] > QUALITY_RANK[voice.quality] ? fromName : voice.quality;
}

/** The non-language eligibility rules (§3.4 rules 2 and 3). */
function allowed(voice: VoiceCandidate, want: SpeechLang, ctx: { online: boolean }): boolean {
  if (want === 'ko-KR' && EXCLUDED_LOWER.has(leadingWord(voice.name))) return false;
  if (!ctx.online && voice.local === false) return false;
  return true;
}

function score(voice: VoiceCandidate, want: SpeechLang, languageBonus: number): number {
  let s = languageBonus;
  if (want === 'ko-KR' && isKnownGoodKorean(voice.name)) s += 100;
  const quality = effectiveQuality(voice);
  if (quality === 'premium') s += 40;
  else if (quality === 'enhanced') s += 30;
  if (voice.isDefault) s += 20;
  if (voice.local === true) s += 15;
  return s;
}

/** Best first, excluded voices removed. Ties break by `id` ascending. */
export function rankVoices(
  all: readonly VoiceCandidate[],
  want: SpeechLang,
  ctx: { online: boolean },
): VoiceCandidate[] {
  const scored: Array<{ voice: VoiceCandidate; s: number }> = [];
  for (const voice of all) {
    const entry = matchChain(voice.lang, want);
    if (entry === null || !allowed(voice, want, ctx)) continue;
    scored.push({ voice, s: score(voice, want, entry.bonus) });
  }
  scored.sort((a, b) => b.s - a.s || (a.voice.id < b.voice.id ? -1 : a.voice.id > b.voice.id ? 1 : 0));
  return scored.map((entry) => entry.voice);
}

export function pickVoice(
  all: readonly VoiceCandidate[],
  want: SpeechLang,
  ctx: { online: boolean },
): VoiceCandidate | null {
  return rankVoices(all, want, ctx)[0] ?? null;
}
