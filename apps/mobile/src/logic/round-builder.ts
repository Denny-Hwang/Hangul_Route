import type { Jamo } from '@hangul-route/content-schema';
import { jamoAll, jamoConsonants, jamoVowels } from '../content/jamo';

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

function shuffle<T>(arr: readonly T[], seed?: number): T[] {
  const a = [...arr];
  let s = seed ?? Date.now();
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Build a Match Sound minigame: N rounds, each with `tileCount` distinct jamo.
 * Distractors drawn from the same scope. No duplicates within a round (F-001 §3.5).
 */
export function buildMatchSoundRounds(opts: {
  scopeJamoIds: string[];
  rounds: number;
  tileCount?: number;
  seed?: number;
}): MatchSoundRound[] {
  const tileCount = opts.tileCount ?? 4;
  const pool = jamoAll.filter((j) => opts.scopeJamoIds.includes(j.id));
  if (pool.length < tileCount) {
    throw new Error(`Not enough jamo in scope (${pool.length}) for ${tileCount} tiles`);
  }

  const out: MatchSoundRound[] = [];
  let seed = opts.seed ?? Date.now();
  const prompts = shuffle(pool, seed).slice(0, opts.rounds);

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
 * Build a Build-a-Letter minigame: assemble a Korean syllable from 2-3 jamo.
 * Simple syllables only (initial + medial vowel ± final).
 */
export function buildBuildLetterRounds(opts: {
  syllables: Array<{ ko: string; romanization: string; jamoChars: string[] }>;
  seed?: number;
}): BuildLetterRound[] {
  const seed = opts.seed ?? Date.now();
  return opts.syllables.map((s, i) => {
    const components: string[] = [];
    for (const ch of s.jamoChars) {
      const found = jamoAll.find((j) => j.char === ch);
      if (found) components.push(found.id);
    }
    // Add 2 distractor jamo of the same kind family
    const targetKind = jamoAll.find((j) => j.id === components[0])?.kind ?? 'consonant';
    const distractorPool =
      targetKind === 'vowel'
        ? jamoConsonants.map((j) => j.id)
        : jamoVowels.map((j) => j.id);
    const distractors = shuffle(
      distractorPool.filter((id) => !components.includes(id)),
      seed + i,
    ).slice(0, 2);
    const tileJamoIds = shuffle([...components, ...distractors], seed + i + 100);
    return {
      targetSyllable: s.ko,
      romanization: s.romanization,
      componentJamoIds: components,
      tileJamoIds,
    };
  });
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
