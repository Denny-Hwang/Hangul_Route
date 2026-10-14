import type { Jamo } from '@hangul-route/content-schema';
import { jamoAll, jamoBatchim, jamoConsonants, jamoVowels } from '../content/jamo';
import { shuffle } from './shuffle';

export interface MatchSoundRound {
  promptJamo: Jamo;
  tiles: Jamo[];
}

export interface BuildLetterRound {
  targetSyllable: string;
  romanization: string;
  componentJamoIds: string[];
  tileJamoIds: string[];
}

/**
 * Prompt order for `rounds` rounds over `pool`. Every symbol is asked once
 * before any repeats; a longer game cycles through fresh shuffles and never
 * asks the same prompt twice in a row (F-QUEST-002 §3.4). Every `focusIds`
 * entry is asked at least once.
 */
function pickPrompts(pool: readonly Jamo[], rounds: number, focusIds: readonly string[], seed: number): Jamo[] {
  if (focusIds.length > rounds) {
    throw new Error(`Cannot ask ${focusIds.length} focus jamo in ${rounds} rounds`);
  }
  for (const id of focusIds) {
    if (!pool.some((j) => j.id === id)) throw new Error(`Focus jamo ${id} is not in scope`);
  }

  const prompts: Jamo[] = [];
  for (let cycle = 0; prompts.length < rounds; cycle++) {
    const pass = shuffle(pool, seed + cycle * 7919);
    const last = prompts[prompts.length - 1];
    if (last && pass[0]!.id === last.id) [pass[0], pass[1]] = [pass[1]!, pass[0]!];
    prompts.push(...pass);
  }
  const picked = prompts.slice(0, rounds);

  // A short game may cut the first pass before some focus symbol: swap those
  // in for non-focus prompts, keeping every prompt distinct.
  const missing = focusIds.filter((id) => !picked.some((j) => j.id === id));
  for (const id of missing) {
    const at = picked.findIndex((j) => !focusIds.includes(j.id));
    picked[at] = pool.find((j) => j.id === id)!;
  }
  return picked;
}

/**
 * The letters a Match Sound round may ask by ear: Stage 1's 30. Word Builder's letters
 * (F-CURR-001 section 3.3) are never asked by sound: ㅐ / ㅔ and ㅚ / ㅙ / ㅞ sound alike
 * for most speakers today, and its final letters are said as sounds Stage 1 already has.
 */
export const SOUND_QUIZ_JAMO_IDS: ReadonlySet<string> = new Set(jamoAll.map((j) => j.id));

/**
 * Build a Match Sound minigame: N rounds, each with `tileCount` distinct jamo.
 * Distractors drawn from the same scope. No duplicates within a round (F-001 §3.5).
 * `rounds` above the pool size cycle the prompts; `focusJamoIds` are always asked.
 */
export function buildMatchSoundRounds(opts: {
  scopeJamoIds: string[];
  rounds: number;
  tileCount?: number;
  focusJamoIds?: string[];
  seed?: number;
}): MatchSoundRound[] {
  const tileCount = opts.tileCount ?? 4;
  const pool = jamoAll.filter((j) => opts.scopeJamoIds.includes(j.id));
  if (pool.length < tileCount) {
    throw new Error(`Not enough jamo in scope (${pool.length}) for ${tileCount} tiles`);
  }

  const out: MatchSoundRound[] = [];
  let seed = opts.seed ?? Date.now();
  const prompts = pickPrompts(pool, opts.rounds, opts.focusJamoIds ?? [], seed);

  for (const prompt of prompts) {
    seed = seed + 1;
    const distractors = shuffle(
      pool.filter((j) => j.id !== prompt.id),
      seed,
    ).slice(0, tileCount - 1);
    const tiles = shuffle([prompt, ...distractors], seed + 1);
    out.push({ promptJamo: prompt, tiles });
  }
  return out;
}

/**
 * Build a Build-a-Letter minigame: assemble a Korean syllable from 2-3 jamo
 * (initial + medial vowel, plus a batchim for a closed syllable).
 *
 * `jamoIds`, when present, are the components in reading order and replace the
 * character lookup, so a final consonant is its `jamo:*-batchim` tile rather
 * than the initial with the same glyph (F-QUEST-002 §3.7). A syllable that
 * repeats a jamo id throws: tiles and slots are keyed by id.
 */
export function buildBuildLetterRounds(opts: {
  syllables: Array<{ ko: string; romanization: string; jamoChars: string[]; jamoIds?: string[] }>;
  seed?: number;
}): BuildLetterRound[] {
  const seed = opts.seed ?? Date.now();
  return opts.syllables.map((s, i) => {
    const components = resolveComponents(s);
    const hasFinal = components.length === 3 && jamoAll.find((j) => j.id === components[2])?.kind === 'batchim';
    const chars = components.map((id) => jamoAll.find((j) => j.id === id)!.char);
    // A distractor never shares a glyph with a target tile (initial ㄹ next to a final ㄹ).
    const lookAlike = (j: Jamo): boolean => chars.includes(j.char);

    let distractors: string[];
    if (hasFinal) {
      // 3-part: 1 initial consonant + 1 other batchim.
      const consonant = shuffle(
        jamoConsonants.filter((j) => !components.includes(j.id) && !lookAlike(j)),
        seed + i,
      )[0]!;
      const batchim = shuffle(
        jamoBatchim.filter((j) => !components.includes(j.id) && !lookAlike(j)),
        seed + i + 50,
      )[0]!;
      distractors = [consonant.id, batchim.id];
    } else {
      // 2 distractor jamo of the other kind family
      const targetKind = jamoAll.find((j) => j.id === components[0])?.kind ?? 'consonant';
      const distractorPool =
        targetKind === 'vowel' ? jamoConsonants.map((j) => j.id) : jamoVowels.map((j) => j.id);
      distractors = shuffle(
        distractorPool.filter((id) => !components.includes(id)),
        seed + i,
      ).slice(0, 2);
    }
    const tileJamoIds = shuffle([...components, ...distractors], seed + i + 100);
    return {
      targetSyllable: s.ko,
      romanization: s.romanization,
      componentJamoIds: components,
      tileJamoIds,
    };
  });
}

function resolveComponents(s: { ko: string; jamoChars: string[]; jamoIds?: string[] }): string[] {
  let components: string[];
  if (s.jamoIds) {
    for (const id of s.jamoIds) {
      if (!jamoAll.some((j) => j.id === id)) throw new Error(`Syllable ${s.ko} uses unknown jamo ${id}`);
    }
    components = [...s.jamoIds];
  } else {
    components = [];
    for (const ch of s.jamoChars) {
      const found = jamoAll.find((j) => j.char === ch);
      if (found) components.push(found.id);
    }
  }
  if (new Set(components).size !== components.length) {
    throw new Error(`Syllable ${s.ko} repeats a jamo id`);
  }
  return components;
}

export interface CardMatchPair {
  ko: string;
  en: string;
  romanization?: string;
}

export interface CardMatchRound {
  pairs: CardMatchPair[];
}

export function buildCardMatchRound(pairs: CardMatchPair[]): CardMatchRound {
  return { pairs };
}

export interface TraceStrokeRound {
  jamo: Jamo;
}

export function buildTraceStrokeRounds(opts: {
  scopeJamoIds: string[];
  rounds: number;
  seed?: number;
}): TraceStrokeRound[] {
  const pool = jamoAll.filter((j) => opts.scopeJamoIds.includes(j.id));
  return shuffle(pool, opts.seed)
    .slice(0, opts.rounds)
    .map((jamo) => ({ jamo }));
}

export interface OddOneOutRound {
  tiles: Jamo[];
  oddJamo: Jamo;
}

/**
 * Build an Odd-One-Out minigame: each round has 3 jamo of the majority kind
 * plus 1 of the other kind (the odd one). Scope must contain >=3 of one kind
 * and >=1 of the other.
 */
export function buildOddOneOutRounds(opts: {
  scopeJamoIds: string[];
  rounds: number;
  seed?: number;
}): OddOneOutRound[] {
  const pool = jamoAll.filter((j) => opts.scopeJamoIds.includes(j.id));
  const consonants = pool.filter((j) => j.kind === 'consonant');
  const vowels = pool.filter((j) => j.kind === 'vowel');

  const majorityKind: Jamo['kind'] = consonants.length >= 3 ? 'consonant' : 'vowel';
  const majors = majorityKind === 'consonant' ? consonants : vowels;
  const minors = majorityKind === 'consonant' ? vowels : consonants;
  if (majors.length < 3 || minors.length < 1) {
    throw new Error('Odd-one-out needs >=3 of one kind and >=1 of the other in scope');
  }

  const out: OddOneOutRound[] = [];
  let seed = opts.seed ?? Date.now();
  for (let r = 0; r < opts.rounds; r++) {
    seed += 1;
    const three = shuffle(majors, seed).slice(0, 3);
    const odd = shuffle(minors, seed + r + 1)[0]!;
    const tiles = shuffle([...three, odd], seed + r + 100);
    out.push({ tiles, oddJamo: odd });
  }
  return out;
}

export interface CultureQuizOption {
  en: string;
  isAnswer: boolean;
}

export interface CultureQuizRound {
  promptKo: string;
  promptRomanization?: string;
  options: CultureQuizOption[];
}

/**
 * Build a Culture Quiz minigame: show a Korean culture word, pick its English
 * meaning from 4 options (1 answer + 3 distractors). Reuses card pairs.
 */
export function buildCultureQuizRounds(opts: {
  cardPairs: CardMatchPair[];
  rounds: number;
  optionCount?: number;
  seed?: number;
}): CultureQuizRound[] {
  const optionCount = opts.optionCount ?? 4;
  if (opts.cardPairs.length < optionCount) {
    throw new Error(`Culture quiz needs >=${optionCount} card pairs`);
  }

  const out: CultureQuizRound[] = [];
  let seed = opts.seed ?? Date.now();
  const prompts = shuffle(opts.cardPairs, seed).slice(0, opts.rounds);

  for (const prompt of prompts) {
    seed += 1;
    const distractors = shuffle(
      opts.cardPairs.filter((p) => p.en !== prompt.en),
      seed,
    ).slice(0, optionCount - 1);
    const options: CultureQuizOption[] = shuffle(
      [{ en: prompt.en, isAnswer: true }, ...distractors.map((d) => ({ en: d.en, isAnswer: false }))],
      seed + 1,
    );
    out.push({ promptKo: prompt.ko, promptRomanization: prompt.romanization, options });
  }
  return out;
}
