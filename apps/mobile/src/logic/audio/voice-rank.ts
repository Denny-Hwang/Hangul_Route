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

/**
 * Preference chain per wanted language, normalised, best first. An entry
 * ending in "-" means "the bare language, or any tag starting with it".
 */
const CHAINS: Readonly<Record<SpeechLang, readonly string[]>> = {
  'ko-KR': ['ko-kr', 'ko-'],
  'en-US': ['en-us', 'en-'],
  'es-US': ['es-us', 'es-mx', 'es-419', 'es-'],
};

/** Score bonus by position in the chain: the exact tag gets the spec's +5, later tags a little less. */
const CHAIN_BONUS: readonly number[] = [5, 4, 3, 0];

/** Index into the chain this tag matches, or -1 when the language is not eligible. */
function chainIndex(lang: string, want: SpeechLang): number {
  const norm = normLang(lang);
  const chain = CHAINS[want];
  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i] as string;
    if (entry.endsWith('-')) {
      if (norm === entry.slice(0, -1) || norm.startsWith(entry)) return i;
    } else if (norm === entry) {
      return i;
    }
  }
  return -1;
}

function leadingWord(name: string): string {
  const first = name.trim().split(/[^A-Za-z0-9_]/)[0];
  return (first ?? '').toLowerCase();
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

function eligible(voice: VoiceCandidate, want: SpeechLang, ctx: { online: boolean }): boolean {
  if (chainIndex(voice.lang, want) < 0) return false;
  if (want === 'ko-KR' && EXCLUDED_LOWER.has(leadingWord(voice.name))) return false;
  if (!ctx.online && voice.local === false) return false;
  return true;
}

function score(voice: VoiceCandidate, want: SpeechLang): number {
  let s = 0;
  if (want === 'ko-KR' && isKnownGoodKorean(voice.name)) s += 100;
  const quality = effectiveQuality(voice);
  if (quality === 'premium') s += 40;
  else if (quality === 'enhanced') s += 30;
  if (voice.isDefault) s += 20;
  if (voice.local === true) s += 15;
  s += CHAIN_BONUS[chainIndex(voice.lang, want)] ?? 0;
  return s;
}

/** Best first, excluded voices removed. Ties break by `id` ascending. */
export function rankVoices(
  all: readonly VoiceCandidate[],
  want: SpeechLang,
  ctx: { online: boolean },
): VoiceCandidate[] {
  return all
    .filter((voice) => eligible(voice, want, ctx))
    .map((voice) => ({ voice, s: score(voice, want) }))
    .sort((a, b) => b.s - a.s || (a.voice.id < b.voice.id ? -1 : a.voice.id > b.voice.id ? 1 : 0))
    .map((entry) => entry.voice);
}

export function pickVoice(
  all: readonly VoiceCandidate[],
  want: SpeechLang,
  ctx: { online: boolean },
): VoiceCandidate | null {
  return rankVoices(all, want, ctx)[0] ?? null;
}
