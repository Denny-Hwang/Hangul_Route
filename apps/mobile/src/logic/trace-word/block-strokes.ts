import { decomposeSyllable, MEDIAL_RR } from '@hangul-route/content-schema';
import type { JamoStrokePoint } from '../../content/jamo-strokes';

/**
 * Trace a Word (F-CURR-001 §3.7 item 3, §9 assumption 3; wireframe minigame/trace-word.md):
 * the jamo skeletons of `content/jamo-strokes.ts` are drawn for a letter alone on a 200 x 200
 * canvas. `placeBlockStrokes` puts each letter of a syllable block into its zone of the block
 * (the `SyllableBlock` arrangement): an initial beside or above the vowel, a final in its own
 * lower band. A compound vowel (ㅘ, ㅐ, ㅢ ...) and a double consonant (ㄲ, ㄳ ...) are drawn
 * from the letters the stroke data holds, each part in its own sub-zone. Pure.
 */

/** The canvas is 200 x 200, like the skeletons. */
export const BLOCK_VIEWBOX = 200;

export interface BlockRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the vowel sits: beside the initial (ㅏ ㅣ), under it (ㅗ ㅡ), or both (ㅘ ㅢ). */
export type BlockShape = 'beside' | 'under' | 'mixed';
export type BlockRole = 'initial' | 'vowel' | 'final';

export interface PlacedLetter {
  role: BlockRole;
  /** The letter as a compatibility jamo: 'ㅎ', 'ㅘ', 'ㄲ'. */
  char: string;
  /** The stroke-data jamo it is drawn from, in writing order (ㅘ: ㅗ then ㅏ). */
  jamoIds: string[];
  /** One zone per part, in the same order. */
  zones: BlockRect[];
  /** The placed strokes of every part, in writing order. */
  strokes: JamoStrokePoint[][];
}

export interface PlacedBlock {
  syllable: string;
  shape: BlockShape;
  hasFinal: boolean;
  /** Initial, vowel, then the final when there is one: the writing order. */
  letters: PlacedLetter[];
  /** Every letter's strokes, in writing order: the scoring target of the block. */
  strokes: JamoStrokePoint[][];
}

export type StrokeLookup = (jamoId: string) => JamoStrokePoint[][] | undefined;

/** Consonant letters by romanized name, as the stroke data ids them (`jamo:<name>`). */
const CONSONANT_ID: Readonly<Record<string, string>> = {
  ㄱ: 'giyeok',
  ㄴ: 'nieun',
  ㄷ: 'digeut',
  ㄹ: 'rieul',
  ㅁ: 'mieum',
  ㅂ: 'bieup',
  ㅅ: 'siot',
  ㅇ: 'ieung',
  ㅈ: 'jieut',
  ㅊ: 'chieut',
  ㅋ: 'kieuk',
  ㅌ: 'tieut',
  ㅍ: 'pieup',
  ㅎ: 'hieut',
};

/** Tense initials and double finals: written as two plain consonants side by side. */
const DOUBLE_CONSONANT: Readonly<Record<string, readonly [string, string]>> = {
  ㄲ: ['ㄱ', 'ㄱ'],
  ㄸ: ['ㄷ', 'ㄷ'],
  ㅃ: ['ㅂ', 'ㅂ'],
  ㅆ: ['ㅅ', 'ㅅ'],
  ㅉ: ['ㅈ', 'ㅈ'],
  ㄳ: ['ㄱ', 'ㅅ'],
  ㄵ: ['ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㅎ'],
  ㄺ: ['ㄹ', 'ㄱ'],
  ㄻ: ['ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'],
  ㄾ: ['ㄹ', 'ㅌ'],
  ㄿ: ['ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅅ'],
};

/** The 21 vowels by `MEDIAL_RR` index, as compatibility jamo. */
const MEDIAL_CHARS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];

/** The ten simple vowels the stroke data holds (`jamo:<romanization>`). */
const SIMPLE_VOWELS = new Set(['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ']);
const VERTICAL_VOWELS = new Set(['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅣ']);

/**
 * How each vowel is written. `under`: the horizontal part, under the initial; `beside`: the
 * vertical parts, at the right, left to right. A simple vowel has one of the two.
 */
const VOWEL_PARTS: Readonly<Record<string, { under: readonly string[]; beside: readonly string[] }>> = {
  ㅐ: { under: [], beside: ['ㅏ', 'ㅣ'] },
  ㅒ: { under: [], beside: ['ㅑ', 'ㅣ'] },
  ㅔ: { under: [], beside: ['ㅓ', 'ㅣ'] },
  ㅖ: { under: [], beside: ['ㅕ', 'ㅣ'] },
  ㅘ: { under: ['ㅗ'], beside: ['ㅏ'] },
  ㅙ: { under: ['ㅗ'], beside: ['ㅏ', 'ㅣ'] },
  ㅚ: { under: ['ㅗ'], beside: ['ㅣ'] },
  ㅝ: { under: ['ㅜ'], beside: ['ㅓ'] },
  ㅞ: { under: ['ㅜ'], beside: ['ㅓ', 'ㅣ'] },
  ㅟ: { under: ['ㅜ'], beside: ['ㅣ'] },
  ㅢ: { under: ['ㅡ'], beside: ['ㅣ'] },
};

function vowelParts(vowel: string): { under: readonly string[]; beside: readonly string[] } {
  const compound = VOWEL_PARTS[vowel];
  if (compound) return compound;
  return VERTICAL_VOWELS.has(vowel) ? { under: [], beside: [vowel] } : { under: [vowel], beside: [] };
}

const vowelId = (vowel: string): string => `jamo:${MEDIAL_RR[MEDIAL_CHARS.indexOf(vowel)]}`;

/**
 * The block zones, in the 200 viewBox (first proposal: the D-3 mock; tuned on the Stage 7
 * syllables against the system Korean font, F-CURR-001 §9 assumption 3). `under` holds the
 * horizontal vowel part, `beside` the vertical one.
 */
export interface BlockZones {
  initial: BlockRect;
  under?: BlockRect;
  beside?: BlockRect;
  final?: BlockRect;
}

const r = (x: number, y: number, width: number, height: number): BlockRect => ({ x, y, width, height });

export const BLOCK_ZONES: Readonly<Record<`${BlockShape}-${'open' | 'final'}`, BlockZones>> = {
  'beside-open': { initial: r(18, 34, 84, 132), beside: r(108, 14, 74, 172) },
  'under-open': { initial: r(42, 14, 116, 94), under: r(18, 118, 164, 52) },
  'mixed-open': { initial: r(18, 16, 104, 86), under: r(18, 110, 120, 60), beside: r(146, 12, 40, 176) },
  'beside-final': { initial: r(18, 14, 84, 98), beside: r(108, 8, 74, 118), final: r(40, 132, 120, 58) },
  'under-final': { initial: r(46, 8, 108, 62), under: r(18, 74, 164, 46), final: r(46, 128, 108, 62) },
  'mixed-final': { initial: r(18, 8, 104, 62), under: r(18, 76, 120, 44), beside: r(146, 6, 40, 120), final: r(40, 132, 120, 58) },
};

/** Gap between the two halves of a double consonant, and between two vertical vowel parts. */
export const PART_GAP = 6;
/**
 * A letter may stretch to its zone, but never more than this much further in one direction
 * than the other, so a narrow initial reads as the letter, not a smear.
 */
export const MAX_STRETCH = 1.6;
/** A skeleton side shorter than this (ㅣ is 0 wide, ㅡ 0 tall) takes the other side's scale. */
const FLAT = 1;

/**
 * Split a zone into columns `PART_GAP` apart, each as wide as its weight's share
 * (equal weights by default: the two halves of ㄲ or ㄳ).
 */
export function columns(zone: BlockRect, weights: readonly number[]): BlockRect[] {
  if (weights.length <= 1) return [zone];
  const total = weights.reduce((sum, w) => sum + w, 0);
  const free = zone.width - PART_GAP * (weights.length - 1);
  let x = zone.x;
  return weights.map((w) => {
    const width = (free * w) / total;
    const column = r(x, zone.y, width, zone.height);
    x += width + PART_GAP;
    return column;
  });
}

/** A vowel's ㅣ stroke needs little room; the part with a tick (ㅏ in ㅐ) takes the rest. */
export const STEM_WEIGHT = 0.35;
/**
 * A vowel with two vertical parts (ㅐ ㅔ ㅙ ㅞ) takes this much more width from the initial
 * (and from the horizontal part), so its tick still shows.
 */
export const PAIR_WIDEN = 16;

function widenForPair(zones: BlockZones): BlockZones {
  const narrow = (z: BlockRect): BlockRect => r(z.x, z.y, z.width - PAIR_WIDEN, z.height);
  const beside = zones.beside!;
  return {
    ...zones,
    initial: narrow(zones.initial),
    ...(zones.under ? { under: narrow(zones.under) } : {}),
    beside: r(beside.x - PAIR_WIDEN, beside.y, beside.width + PAIR_WIDEN, beside.height),
  };
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsOf(strokes: JamoStrokePoint[][]): Box {
  const points = strokes.flat();
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Fit one skeleton into a zone: scale each axis to the zone (an axis the letter has no
 * extent on takes the other's scale), keep the two scales within `MAX_STRETCH` of each
 * other, and centre the result in the zone.
 */
export function fitStrokes(strokes: JamoStrokePoint[][], zone: BlockRect): JamoStrokePoint[][] {
  const b = boundsOf(strokes);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  let sx = w < FLAT ? Number.POSITIVE_INFINITY : zone.width / w;
  let sy = h < FLAT ? Number.POSITIVE_INFINITY : zone.height / h;
  if (!Number.isFinite(sx)) sx = sy;
  if (!Number.isFinite(sy)) sy = sx;
  if (sy > sx * MAX_STRETCH) sy = sx * MAX_STRETCH;
  if (sx > sy * MAX_STRETCH) sx = sy * MAX_STRETCH;
  const ox = zone.x + (zone.width - w * sx) / 2;
  const oy = zone.y + (zone.height - h * sy) / 2;
  return strokes.map((stroke) => stroke.map((p) => ({ x: round1(ox + (p.x - b.minX) * sx), y: round1(oy + (p.y - b.minY) * sy) })));
}

/** A consonant's stroke-data id: a final uses its `-batchim` skeleton when there is one. */
function consonantStrokes(char: string, final: boolean, lookup: StrokeLookup): { id: string; strokes: JamoStrokePoint[][] } | null {
  const name = CONSONANT_ID[char];
  if (name === undefined) return null;
  const finalId = `jamo:${name}-batchim`;
  const own = final ? lookup(finalId) : undefined;
  if (own) return { id: finalId, strokes: own };
  const id = `jamo:${name}`;
  const strokes = lookup(id);
  return strokes ? { id, strokes } : null;
}

function placeConsonant(char: string, role: 'initial' | 'final', zone: BlockRect, lookup: StrokeLookup): PlacedLetter | null {
  const parts = DOUBLE_CONSONANT[char] ?? [char];
  const zones = columns(zone, parts.map(() => 1));
  const jamoIds: string[] = [];
  const strokes: JamoStrokePoint[][] = [];
  for (const [i, part] of parts.entries()) {
    const found = consonantStrokes(part, role === 'final', lookup);
    if (!found) return null;
    jamoIds.push(found.id);
    strokes.push(...fitStrokes(found.strokes, zones[i]!));
  }
  return { role, char, jamoIds, zones, strokes };
}

function placeVowel(char: string, zones: BlockZones, lookup: StrokeLookup): PlacedLetter | null {
  const { under, beside } = vowelParts(char);
  const placed: Array<{ part: string; zone: BlockRect }> = [];
  if (under.length > 0 && zones.under) placed.push({ part: under[0]!, zone: zones.under });
  if (beside.length > 0 && zones.beside) {
    const weights = beside.map((part) => (part === 'ㅣ' && beside.length > 1 ? STEM_WEIGHT : 1 - STEM_WEIGHT));
    columns(zones.beside, weights).forEach((zone, i) => placed.push({ part: beside[i]!, zone }));
  }
  const jamoIds: string[] = [];
  const strokes: JamoStrokePoint[][] = [];
  for (const { part, zone } of placed) {
    const id = vowelId(part);
    const own = SIMPLE_VOWELS.has(part) ? lookup(id) : undefined;
    if (!own) return null;
    jamoIds.push(id);
    strokes.push(...fitStrokes(own, zone));
  }
  return { role: 'vowel', char, jamoIds, zones: placed.map((p) => p.zone), strokes };
}

/** The block shape of a vowel. */
export function shapeOf(vowel: string): BlockShape {
  const { under, beside } = vowelParts(vowel);
  if (under.length > 0 && beside.length > 0) return 'mixed';
  return beside.length > 0 ? 'beside' : 'under';
}

/**
 * Every letter of one syllable block placed in its zone, in writing order; `null` when
 * `syllable` is not one Hangul block or the stroke data cannot draw one of its letters
 * (the round builder then drops the word: never a canvas with a missing letter).
 */
export function placeBlockStrokes(syllable: string, lookup: StrokeLookup): PlacedBlock | null {
  const parts = decomposeSyllable(syllable);
  if (parts === null) return null;
  const vowel = MEDIAL_CHARS[parts.medial]!;
  const shape = shapeOf(vowel);
  const hasFinal = parts.final !== '';
  const base = BLOCK_ZONES[`${shape}-${hasFinal ? 'final' : 'open'}`];
  const zones = vowelParts(vowel).beside.length > 1 ? widenForPair(base) : base;
  const letters: PlacedLetter[] = [];
  const initial = placeConsonant(parts.initial, 'initial', zones.initial, lookup);
  const medial = placeVowel(vowel, zones, lookup);
  if (!initial || !medial) return null;
  letters.push(initial, medial);
  if (hasFinal) {
    const final = placeConsonant(parts.final, 'final', zones.final!, lookup);
    if (!final) return null;
    letters.push(final);
  }
  return { syllable, shape, hasFinal, letters, strokes: letters.flatMap((l) => l.strokes) };
}

/** Every block of a word placed, or `null` when any block cannot be drawn. */
export function placeWordStrokes(word: string, lookup: StrokeLookup): PlacedBlock[] | null {
  const blocks: PlacedBlock[] = [];
  for (const syllable of word) {
    const placed = placeBlockStrokes(syllable, lookup);
    if (!placed) return null;
    blocks.push(placed);
  }
  return blocks.length > 0 ? blocks : null;
}
