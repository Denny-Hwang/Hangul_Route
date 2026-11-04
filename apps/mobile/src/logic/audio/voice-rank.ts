import type { SpeechLang } from '@hangul-route/content-schema';

/**
 * Voice choice (F-AUDIO-004 §3.4, AD5). Pure: ranked, filtered, deterministic.
 *
 * A voice that fails an eligibility rule is excluded, never demoted: an
 * English voice must not read Hangul, and Apple's novelty voices must not be
 * picked in any language just because they come first in the list (NB-2: an
 * English story narration was read by "Albert" or Eloquence "Eddy" on devices
 * whose system language is Korean, where no English voice is flagged default).
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

/**
 * Apple's novelty and legacy MacinTalk voices (`say -v '?'`, every language they ship in), hard-excluded for every
 * language (AMENDMENTS-AUDIO-CLIPS AC-B12). Holds every `KO_EXCLUDED_NAMES` entry.
 */
export const NOVELTY_VOICE_NAMES: readonly string[] = [
  ...KO_EXCLUDED_NAMES,
  'Albert',
  'Bad News',
  'Bahh',
  'Bells',
  'Boing',
  'Bubbles',
  'Cellos',
  'Deranged',
  'Fred',
  'Good News',
  'Hysterical',
  'Jester',
  'Junior',
  'Kathy',
  'Organ',
  'Pipe Organ',
  'Princess',
  'Ralph',
  'Superstar',
  'Trinoids',
  'Whisper',
  'Wobble',
  'Zarvox',
];

const NOVELTY_LOWER: readonly string[] = NOVELTY_VOICE_NAMES.map((n) => n.toLowerCase());

/** Apple's Eloquence engine (Eddy, Flo, Reed ... in every language): its voice ids carry this segment. */
const ELOQUENCE_ID = /(^|[.:/])eloquence([.:/]|$)/i;

/**
 * A novelty voice: the name starts with a listed name as whole ASCII words ("Bad News (English (US))"), or the id
 * names Apple's Eloquence engine (Safari and iOS report `com.apple.eloquence.<lang>.<Name>`).
 */
export function isNoveltyVoice(voice: Pick<VoiceCandidate, 'id' | 'name'>): boolean {
  if (ELOQUENCE_ID.test(voice.id)) return true;
  const name = voice.name.trim().toLowerCase();
  return NOVELTY_LOWER.some((n) => name.startsWith(n) && !/[a-z0-9_]/.test(name.charAt(n.length)));
}

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

/** A whole ASCII word in a voice name (Hangul is a non-word character to a non-unicode regex). */
const word = (alternatives: string): RegExp => new RegExp(`(^|[^A-Za-z0-9_])(${alternatives})($|[^A-Za-z0-9_])`, 'i');

/**
 * A Google TTS voice on native Android, where the name is the id (`en-us-x-sfg-local`, `ko-kr-x-ism-network`). Only
 * the female variants are listed: Android flags no default, so without them the id tie-break could pick a male one.
 */
const ANDROID_ID = (tag: string, variants: string): RegExp => new RegExp(`^${tag}-x-(${variants})(-local|-network)?$`, 'i');

/**
 * Known-good voices per language, best tier first (AC-B12). Korean prefers a natural female voice, the voice family
 * of the generated clips; a known male Korean voice ranks below every known female one but above any unknown voice.
 */
const KNOWN_GOOD: Readonly<Record<SpeechLang, readonly { bonus: number; test: (name: string) => boolean }[]>> = {
  'ko-KR': [
    {
      bonus: 200,
      test: (n) =>
        word('Yuna|Sora|Suhyun').test(n) ||
        /유나|소라|수현/.test(n) ||
        /Google\s*한국/.test(n) ||
        ANDROID_ID('ko-kr', 'ism|kob').test(n) ||
        /Microsoft\b.*\b(SunHi|Heami|SeoHyeon|JiMin|SoonBok|YuJin)\b/i.test(n),
    },
    { bonus: 100, test: (n) => word('Minsu|Jian').test(n) || /민수|지안/.test(n) || /Microsoft\b.*\b(InJoon|BongJin|GookMin|Hyunsu)\b/i.test(n) },
  ],
  'en-US': [
    {
      bonus: 100,
      test: (n) =>
        word('Samantha|Ava|Allison|Susan|Zoe|Nicky|Joelle').test(n) ||
        /Google US English/i.test(n) ||
        ANDROID_ID('en-us', 'sfg|tpf|tpc|iob|iog').test(n) ||
        /Microsoft\b.*\b(Aria|Jenny|Ava|Emma|Michelle|Zira)\b/i.test(n),
    },
  ],
  'es-US': [
    {
      bonus: 100,
      test: (n) =>
        word('Paulina|M[oó]nica|Marisol|Ang[eé]lica').test(n) ||
        /Google espa[nñ]ol/i.test(n) ||
        ANDROID_ID('es-us', 'sfb').test(n) ||
        /Microsoft\b.*\b(Paloma|Dalia|Sabina|Helena|Elvira)\b/i.test(n),
    },
  ],
};

function knownGoodBonus(name: string, want: SpeechLang): number {
  for (const tier of KNOWN_GOOD[want]) if (tier.test(name)) return tier.bonus;
  return 0;
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
function allowed(voice: VoiceCandidate, ctx: { online: boolean }): boolean {
  if (isNoveltyVoice(voice)) return false;
  if (!ctx.online && voice.local === false) return false;
  return true;
}

function score(voice: VoiceCandidate, want: SpeechLang, languageBonus: number): number {
  let s = languageBonus;
  s += knownGoodBonus(voice.name, want);
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
    if (entry === null || !allowed(voice, ctx)) continue;
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
