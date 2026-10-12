import type { Episode, PlacementResult, Quest } from '@hangul-route/content-schema';
import { isStageEntitled, type Tier } from './entitlement';
import { placedOutSkipSet } from './placement/route-skip';

/**
 * What the one cursor (`nextQuestAfter`, `logic/next-quest.ts`) is told on
 * every surface that shows it (F-ROUTE-001 R-4a, section 3.5, decision M4):
 * Home's "New" card, the Results "Next up" teaser and My route build it here,
 * so they offer the same stages and skip the same placed-out quests, and can
 * never point a learner at two different next quests.
 */

/**
 * Which stages the cursor may land on (owner decision OD-4).
 * - `shipped`: every shipped stage is playable, whatever the tier. This is the
 *   default and today's behaviour on Home and the Journey (the Stage 2 and 4
 *   tastes stay on the cursor; payments are not live).
 * - `tier`: only the stages the learner's tier includes (the OD-4
 *   alternative; My route then reads such a stage as "Not open yet").
 */
export type CursorStageRule = 'shipped' | 'tier';

/**
 * OD-4 default. Switching it changes Home, Results and My route together (Home
 * and Results both re-render on a tier change). One limit stays: Home's plan
 * is pinned for the day (F-HW-001 section 3.2), so under `'tier'` a tier that
 * changes mid-day moves Home's "New" card only the next day; a switch to
 * `'tier'` should also re-pin card (2) when the tier changes.
 */
export const CURSOR_STAGE_RULE: CursorStageRule = 'shipped';

/** The stage predicate the cursor is given, for a learner's tier under a rule. */
export function cursorEntitlement(tier: Tier, rule: CursorStageRule = CURSOR_STAGE_RULE): (stageKey: string) => boolean {
  if (rule === 'tier') return (stageKey) => isStageEntitled(stageKey, tier);
  return () => true;
}

export interface CursorContext {
  /** Passed as `NextQuestInput.isEntitled`. */
  isEntitled: (stageKey: string) => boolean;
  /** Passed as `NextQuestInput.skipQuestIds`; undefined without a stored level-check result. */
  skipQuestIds: ReadonlySet<string> | undefined;
  /** Passed as `NextQuestInput.isQuestOpen` (F-ENT-003 section 3.5); undefined when the caller gave none (every quest open). */
  isQuestOpen?: (questId: string) => boolean;
}

export interface CursorContextInput {
  tier: Tier;
  placements: readonly PlacementResult[] | undefined;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  /** Tests only; the app always uses `CURSOR_STAGE_RULE`. */
  rule?: CursorStageRule;
  /**
   * May the learner start this quest: `useQuestAccess()` on a screen,
   * `questOpenFor(learnerId, now)` elsewhere (F-ENT-003 section 3.4). Omitted
   * means every quest is open, today's cursor.
   */
  isQuestOpen?: (questId: string) => boolean;
}

export function cursorContext(input: CursorContextInput): CursorContext {
  return {
    isEntitled: cursorEntitlement(input.tier, input.rule),
    skipQuestIds: placedOutSkipSet(input.placements, input.quests, input.episodes),
    ...(input.isQuestOpen ? { isQuestOpen: input.isQuestOpen } : {}),
  };
}
