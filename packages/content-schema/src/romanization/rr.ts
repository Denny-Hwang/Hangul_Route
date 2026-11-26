/**
 * Revised Romanization (NIKL, 2000) converter: a TypeScript port of the audit's
 * rule-based reference converter (F-CNT-002 §3.2). Pronunciation-based, pure,
 * dependency-free and Hermes-safe (no Unicode property escapes, no look-behind).
 *
 * Applied within a word: liaison, ㅎ aspiration/deletion, coda neutralisation,
 * palatalisation (ㄷ/ㅌ + 이), nasalisation, liquid assimilation, ㄹ -> ㄴ after
 * a non-ㄹ final. Tensification is NOT marked (RR does not mark it).
 *
 * Deviation from the audit's rr.py (owner-requested): a simple stop final before an
 * initial ㅎ keeps the ㅎ (noun convention) instead of aspirating, see applyBoundaryRules.
 *
 * Also applied (AMENDMENTS-ROMANIZER-GAPS RG-1): a verb-stem ㄺ before ㄱ is heard [ㄹ]
 * (읽고 ilgo; the ㄺ nouns 닭 탉 흙 칡 삵 슭 keep [ㄱ]), the finals of 밟- and 넓죽- / 넓둥- /
 * 넓적- are heard [ㅂ], and a simple stop before the suffix 히 / 혀 / 혔 / 힌 / 힐 aspirates
 * (좁히다 jopida, 잡혀 japyeo).
 *
 * Known limits (deliberately not implemented; `detectGaps` in gaps.ts names them and the checker
 * demands an entry in ROMANIZATION_EXCEPTIONS): ㄴ-insertion in compounds (꽃잎 RR kkonnip,
 * here kkochip; 솔잎 RR sollip, here sorip), 사이시옷 before 이 (깻잎), the juncture before a
 * content morpheme (맛없어요, 첫인상), a predicate's ㅎ after a stop before a 하다 form
 * (못해요 RR motaeyo, here mothaeyo; the noun 북한산 keeps its ㅎ; `predicateH` reads the
 * predicate), word-internal compound boundaries and Sino-Korean exceptions; see
 * AMENDMENTS-ROMANIZER-GAPS. Cross-word sandhi is not applied either (RR does not mark it).
 */
import { HADA_BLOCKS } from './gaps';
import {
  INITIAL_JAMO,
  INITIAL_RR,
  MEDIAL_I,
  MEDIAL_RR,
  decomposeSyllable,
  type SyllableParts,
} from './hangul';

/** Compound finals as [kept as final, moved to the next syllable]; ㄲ and ㅆ move whole. */
const SPLIT: Readonly<Record<string, readonly [string, string]>> = {
  'ㄳ': ['ㄱ', 'ㅅ'],
  'ㄵ': ['ㄴ', 'ㅈ'],
  'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'],
  'ㄻ': ['ㄹ', 'ㅁ'],
  'ㄼ': ['ㄹ', 'ㅂ'],
  'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'],
  'ㄿ': ['ㄹ', 'ㅍ'],
  'ㅀ': ['ㄹ', 'ㅎ'],
  'ㅄ': ['ㅂ', 'ㅅ'],
  'ㄲ': ['', 'ㄲ'],
  'ㅆ': ['', 'ㅆ'],
};

type Coda = 'K' | 'N' | 'T' | 'L' | 'M' | 'P' | 'NG' | '';

/** Neutralised (unreleased) value of every final. */
const NEUTRAL: Readonly<Record<string, Coda>> = {
  'ㄱ': 'K', 'ㄲ': 'K', 'ㅋ': 'K', 'ㄳ': 'K', 'ㄺ': 'K',
  'ㄴ': 'N', 'ㄵ': 'N', 'ㄶ': 'N',
  'ㄷ': 'T', 'ㅅ': 'T', 'ㅆ': 'T', 'ㅈ': 'T', 'ㅊ': 'T', 'ㅌ': 'T', 'ㅎ': 'T',
  'ㄹ': 'L', 'ㄼ': 'L', 'ㄽ': 'L', 'ㄾ': 'L', 'ㅀ': 'L',
  'ㅁ': 'M', 'ㄻ': 'M',
  'ㅂ': 'P', 'ㅍ': 'P', 'ㅄ': 'P', 'ㄿ': 'P',
  'ㅇ': 'NG',
  '': '',
};

/** Plain stops aspirated by a preceding ㅎ final. */
const ASPIRATED_BY_H: Readonly<Record<string, string>> = { 'ㄱ': 'ㅋ', 'ㄷ': 'ㅌ', 'ㅈ': 'ㅊ', 'ㅂ': 'ㅍ' };
/** A stop final followed by ㅎ: the ㅎ becomes this aspirated consonant. */
const ASPIRATED_BY_CODA: Readonly<Record<string, string>> = { K: 'ㅋ', T: 'ㅌ', P: 'ㅍ' };
/** Nasalisation of a stop final before ㄴ/ㅁ. */
const NASALISED: Readonly<Record<string, Coda>> = { K: 'NG', T: 'N', P: 'M' };
const CODA_RR: Readonly<Record<Coda, string>> = {
  K: 'k', T: 't', P: 'p', L: 'l', M: 'm', N: 'n', NG: 'ng', '': '',
};

/** ㄺ-final noun syllables: they keep [ㄱ] before ㄱ (닭고기 dakgogi), unlike a verb stem (읽고 ilgo). */
const RIEUL_GIYEOK_NOUNS: ReadonlySet<string> = new Set(['닭', '탉', '흙', '칡', '삵', '슭']);
/** The suffix blocks (히 혀 혔 힌 힐) whose ㅎ joins a preceding simple stop (SP 제12항 붙임 1, 제17항 붙임). */
const SUFFIX_HI: ReadonlySet<string> = new Set(['히', '혀', '혔', '힌', '힐']);
/** 넓 is heard [ㅂ] directly before these blocks (SP 제10항 다만: 넓죽하다, 넓둥글다; 해설: 넓적하다). */
const NEOP_P_BEFORE: ReadonlySet<string> = new Set(['죽', '둥', '적']);
/** A simple stop final followed by the suffix 히: the ㅎ merges into this aspirated consonant. */
const ASPIRATED_BEFORE_SUFFIX_HI: Readonly<Record<string, string>> = {
  'ㄱ': 'ㅋ', 'ㄲ': 'ㅋ', 'ㅋ': 'ㅋ',
  'ㅂ': 'ㅍ', 'ㅍ': 'ㅍ',
  'ㄷ': 'ㅊ',
  'ㅅ': 'ㅌ', 'ㅆ': 'ㅌ', 'ㅌ': 'ㅌ',
  'ㅈ': 'ㅊ', 'ㅊ': 'ㅊ',
};

/** Options of the converter (AMENDMENTS-ROMANIZER-GAPS §3.5 item 5). */
export interface RomanizeOptions {
  /**
   * Read a word with a 하다 form (하 한 할 함 합 해 했 after its first block) as a predicate: every
   * simple stop before a ㅎ aspirates (못해요 motaeyo, 축하해요 chukahaeyo; RR 제3장 제1항 4), where
   * the default keeps the noun's ㅎ (북한산 bukhansan). A reviewed entry names which reading a word has.
   */
  predicateH?: boolean;
}

/** Apply ㅎ, liaison and palatalisation rules between neighbouring blocks, left to right. */
function applyBoundaryRules(word: string, blocks: SyllableParts[], predicate: boolean): void {
  for (let i = 0; i < blocks.length - 1; i++) {
    const cur = blocks[i] as SyllableParts;
    const next = blocks[i + 1] as SyllableParts;
    let coda = cur.final;

    if (coda === 'ㅎ' || coda === 'ㄶ' || coda === 'ㅀ') {
      const rest = coda === 'ㅎ' ? '' : (SPLIT[coda] as readonly [string, string])[0];
      const aspirated = ASPIRATED_BY_H[next.initial];
      if (aspirated !== undefined) {
        next.initial = aspirated;
        cur.final = rest;
        continue;
      }
      if (next.initial === 'ㅇ') cur.final = rest;
      else if (next.initial === 'ㄴ') cur.final = rest === '' ? 'ㄴ' : rest;
      coda = cur.final;
    }

    // A simple stop before the suffix 히 / 혀 / 혔 / 힌 / 힐 aspirates (좁히다 jopida, 잡혀 japyeo).
    const suffixAspirate = ASPIRATED_BEFORE_SUFFIX_HI[coda];
    if (suffixAspirate !== undefined && SUFFIX_HI.has(word.charAt(i + 1))) {
      next.initial = suffixAspirate;
      cur.final = '';
      continue;
    }

    // Noun convention (NIKL RR, special provisions): after a simple stop final the ㅎ is
    // kept (금속활자 geumsokhwalja, 집현전 jiphyeonjeon, 입학 iphak). Compound finals
    // (읽- 앉- 밟-) only occur in verb and adjective stems, which do aspirate.
    const pair = SPLIT[coda];
    const keepsH =
      !predicate &&
      (pair === undefined || pair[0] === '') &&
      coda !== 'ㅎ' &&
      ASPIRATED_BY_CODA[NEUTRAL[coda] as string] !== undefined;
    if (next.initial === 'ㅎ' && !keepsH) {
      const base = pair !== undefined && pair[0] !== '' ? pair[1] : coda;
      const kept = pair === undefined ? '' : pair[0];
      if (base === 'ㅈ' && pair !== undefined) {
        next.initial = 'ㅊ';
        cur.final = kept;
        continue;
      }
      const aspirated = ASPIRATED_BY_CODA[NEUTRAL[base] as string];
      if (aspirated !== undefined) {
        next.initial = aspirated;
        cur.final = kept;
        continue;
      }
    }

    if (next.initial === 'ㅇ' && coda !== '' && coda !== 'ㅇ') {
      if (pair !== undefined) {
        cur.final = pair[0];
        next.initial = pair[1];
      } else {
        cur.final = '';
        next.initial = coda;
      }
      if (next.medial === MEDIAL_I && (next.initial === 'ㄷ' || next.initial === 'ㅌ')) {
        next.initial = next.initial === 'ㄷ' ? 'ㅈ' : 'ㅊ';
      }
    }
  }
}

/**
 * One romanized piece per syllable block, pronunciation-based.
 * Returns null if the word has any character that is not a Hangul syllable block.
 */
export function romanizeSyllables(word: string, options: RomanizeOptions = {}): string[] | null {
  const blocks: SyllableParts[] = [];
  for (let i = 0; i < word.length; i++) {
    const parts = decomposeSyllable(word.charAt(i));
    if (parts === null) return null;
    blocks.push(parts);
  }

  const predicate = options.predicateH === true && [...word].some((ch, i) => i > 0 && HADA_BLOCKS.includes(ch));
  applyBoundaryRules(word, blocks, predicate);

  const codas: Coda[] = blocks.map((b) => NEUTRAL[b.final] as Coda);
  for (let i = 0; i < blocks.length - 1; i++) {
    const block = word.charAt(i);
    const final = (blocks[i] as SyllableParts).final;
    // ㄺ before ㄱ in a verb stem is heard [ㄹ] (SP 제11항 다만); the ㄺ nouns keep [ㄱ].
    if (final === 'ㄺ' && (blocks[i + 1] as SyllableParts).initial === 'ㄱ' && !RIEUL_GIYEOK_NOUNS.has(block)) {
      codas[i] = 'L';
    }
    // 밟- before a consonant, and 넓 before 죽 / 둥 / 적, are heard [ㅂ] (SP 제10항 다만).
    if (final === 'ㄼ' && (block === '밟' || (block === '넓' && NEOP_P_BEFORE.has(word.charAt(i + 1))))) {
      codas[i] = 'P';
    }
  }
  const initials: string[] = blocks.map((b) => b.initial);

  for (let i = 0; i < blocks.length - 1; i++) {
    let coda = codas[i] as Coda;
    let nextInitial = initials[i + 1] as string;
    if (nextInitial === 'ㄹ' && (coda === 'M' || coda === 'NG' || coda === 'K' || coda === 'P' || coda === 'T')) {
      initials[i + 1] = 'ㄴ';
    }
    nextInitial = initials[i + 1] as string;
    if (nextInitial === 'ㄴ' || nextInitial === 'ㅁ') {
      codas[i] = NASALISED[coda] ?? coda;
    }
    coda = codas[i] as Coda;
    if (coda === 'N' && nextInitial === 'ㄹ') codas[i] = 'L';
    else if (coda === 'L' && nextInitial === 'ㄴ') initials[i + 1] = 'ㄹ';
  }

  return blocks.map((block, i) => {
    const initial = initials[i] as string;
    const afterL = i > 0 && codas[i - 1] === 'L';
    const onset = initial === 'ㄹ' && afterL ? 'l' : (INITIAL_RR[INITIAL_JAMO.indexOf(initial)] as string);
    return onset + (MEDIAL_RR[block.medial] as string) + CODA_RR[codas[i] as Coda];
  });
}

/** romanizeSyllables(word) joined, or null. */
export function romanizeWord(word: string, options: RomanizeOptions = {}): string | null {
  const pieces = romanizeSyllables(word, options);
  return pieces === null ? null : pieces.join('');
}

/** Characters removed from a token before it is romanized (hyphens, sentence punctuation, quotes). */
const STRIPPED = /[-!?.,~·…"'“”‘’]/g;

/**
 * Words split on whitespace; ASCII hyphens, . , ! ? ~ · … quotes and apostrophes stripped.
 * Tokens that still hold a non-syllable character are kept as written, in both
 * `text` and `unknown`.
 */
export function romanize(text: string, options: RomanizeOptions = {}): { text: string; unknown: string[] } {
  const words: string[] = [];
  const unknown: string[] = [];
  for (const token of text.split(/\s+/)) {
    const core = token.replace(STRIPPED, '');
    if (core === '') continue;
    const rr = romanizeWord(core, options);
    if (rr === null) {
      unknown.push(token);
      words.push(token);
    } else {
      words.push(rr);
    }
  }
  return { text: words.join(' '), unknown };
}

/** The tokens `romanize()` reads: split on whitespace, marks stripped, empty ones dropped. */
export function koTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map((token) => token.replace(STRIPPED, ''))
    .filter((core) => core !== '');
}

/** 'han-geul-lal' for teaching UI; null when not all syllable blocks. Computed, never stored. */
export function syllableSplit(word: string): string | null {
  const pieces = romanizeSyllables(word);
  return pieces === null ? null : pieces.join('-');
}
