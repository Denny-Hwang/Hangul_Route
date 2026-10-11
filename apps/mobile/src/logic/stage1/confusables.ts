import { findJamo, jamoAll } from '../../content/jamo';

/**
 * Shapes and sounds learners actually mix up (F-QUEST-002 §3.9). Each key has
 * three same-kind distractors; the order is the order options are taken in.
 * Keyed by character because the table is reviewed by native speakers; the
 * helpers below speak jamo ids like the rest of the app. The six batchim have
 * no list: their Check and Hangul Check items differ only in the final.
 */
export const CONFUSABLES: Readonly<Record<string, readonly [string, string, string]>> = {
  ㄱ: ['ㅋ', 'ㄴ', 'ㄷ'],
  ㄴ: ['ㄱ', 'ㄷ', 'ㄹ'],
  ㄷ: ['ㅌ', 'ㄹ', 'ㄴ'],
  ㄹ: ['ㄷ', 'ㄴ', 'ㅁ'],
  ㅁ: ['ㅂ', 'ㅇ', 'ㄴ'],
  ㅂ: ['ㅍ', 'ㅁ', 'ㅅ'],
  ㅅ: ['ㅈ', 'ㅊ', 'ㅇ'],
  ㅇ: ['ㅎ', 'ㅁ', 'ㅅ'],
  ㅈ: ['ㅊ', 'ㅅ', 'ㄱ'],
  ㅊ: ['ㅈ', 'ㅅ', 'ㅎ'],
  ㅋ: ['ㄱ', 'ㅌ', 'ㅍ'],
  ㅌ: ['ㄷ', 'ㅋ', 'ㅍ'],
  ㅍ: ['ㅂ', 'ㅋ', 'ㅌ'],
  ㅎ: ['ㅇ', 'ㅊ', 'ㅅ'],
  ㅏ: ['ㅓ', 'ㅑ', 'ㅣ'],
  ㅑ: ['ㅏ', 'ㅕ', 'ㅛ'],
  ㅓ: ['ㅏ', 'ㅕ', 'ㅗ'],
  ㅕ: ['ㅓ', 'ㅑ', 'ㅠ'],
  ㅗ: ['ㅜ', 'ㅓ', 'ㅛ'],
  ㅛ: ['ㅗ', 'ㅠ', 'ㅑ'],
  ㅜ: ['ㅗ', 'ㅡ', 'ㅠ'],
  ㅠ: ['ㅜ', 'ㅛ', 'ㅕ'],
  ㅡ: ['ㅜ', 'ㅣ', 'ㅓ'],
  ㅣ: ['ㅡ', 'ㅏ', 'ㅓ'],
};

/** Distractor jamo ids of a consonant or vowel, in table order. */
export function confusablesOf(jamoId: string): string[] {
  const jamo = findJamo(jamoId);
  if (!jamo || jamo.kind === 'batchim') return [];
  return CONFUSABLES[jamo.char]!.map((ch) => jamoAll.find((j) => j.char === ch && j.kind === jamo.kind)!.id);
}

/**
 * Options for a Check round (§3.3): the target first, then its confusables
 * that are already taught, then the other taught symbols of the same kind in
 * jamo order. Callers shuffle. Needs at least two options.
 */
export function checkOptionIds(
  targetId: string,
  taughtIds: readonly string[],
  opts: { size?: number } = {},
): string[] {
  const size = opts.size ?? 4;
  const target = findJamo(targetId);
  if (!target || target.kind === 'batchim') {
    throw new Error(`No confusable list for ${targetId}`);
  }
  const taught = new Set(taughtIds);
  taught.delete(targetId);
  const confusable = confusablesOf(targetId).filter((id) => taught.has(id));
  const padding = jamoAll
    .filter((j) => j.kind === target.kind && taught.has(j.id) && !confusable.includes(j.id))
    .map((j) => j.id);
  const options = [targetId, ...confusable, ...padding].slice(0, size);
  if (options.length < 2) {
    throw new Error(`Need at least two options for ${targetId}; only ${options.length} taught`);
  }
  return options;
}
