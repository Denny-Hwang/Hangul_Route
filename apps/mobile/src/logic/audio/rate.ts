/**
 * Speech rate and pitch (F-AUDIO-004 §3.3, AD6). Pure.
 *
 * The same number is not the same speed on iOS (JS rate x 0.5), Android and
 * browsers, so every constant sits in one object to be tuned by ear (§8).
 */
export type PromptKind = 'sound' | 'word' | 'sentence' | 'narration';

/** Learner level order from `levelOrder()`: 0 pictures first, 1 some reading, 2 reads easily; null = unknown. */
export type LevelOrder = 0 | 1 | 2 | null;

export const RATE_BASE: Readonly<Record<PromptKind, number>> = {
  sound: 0.75,
  word: 0.85,
  sentence: 0.9,
  narration: 1.0,
};

const LEVEL_FACTOR: Readonly<Record<0 | 1 | 2, number>> = { 0: 0.9, 1: 1.0, 2: 1.05 };
const SLOW_FACTOR = 0.7;
export const RATE_MIN = 0.5;
export const RATE_MAX = 1.1;

export function speechParams(
  kind: PromptKind,
  levelOrder: LevelOrder,
  opts: { slow?: boolean } = {},
): { rate: number; pitch: 1 } {
  const level = levelOrder === null ? 1.0 : LEVEL_FACTOR[levelOrder];
  const raw = RATE_BASE[kind] * level * (opts.slow === true ? SLOW_FACTOR : 1);
  return { rate: Math.min(RATE_MAX, Math.max(RATE_MIN, raw)), pitch: 1 };
}
