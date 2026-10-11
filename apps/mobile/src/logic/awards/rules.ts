import type { StageKey } from '@hangul-route/content-schema';
import type { UnlockRule } from './types';

/**
 * The one reader of the `unlockedBy` grammar (F-STORY-006 §3.2), together
 * with `derivedAwards`. The schema rejects anything else, so `unknown` only
 * appears for content that skipped validation; it is never awarded.
 */
const EPISODE = /^episode:[a-z0-9-]+$/;
const STAGE = /^stage([1-7])-complete$/;
const SET = /^set:[a-z0-9-]+$/;

export function parseUnlockedBy(value: string): UnlockRule {
  if (EPISODE.test(value)) return { kind: 'episode', episodeId: value };
  const stage = STAGE.exec(value);
  if (stage) return { kind: 'stage', stage: `stage${stage[1]}` as StageKey };
  if (value === 'first-launch') return { kind: 'welcome' };
  if (SET.test(value)) return { kind: 'set', setId: value };
  return { kind: 'unknown', raw: value };
}
