import { StageKeySchema, type Episode, type ProgressSnapshot, type StageKey } from '@hangul-route/content-schema';
import { stageAvailability, type StageAvailability } from '../journey';
import { completionState } from '../stage1/completion';
import { cellRowsOf, splitStagePips, type PipContext } from './pips';
import type { MyRouteInput, PipState, Skill, StageRow, StageState } from './types';

/**
 * Stage rows (F-ROUTE-001 section 3.3): seven rows, each with its state, its
 * pips and cells, and the one `here` tag.
 */

/** What each stage builds (Appendix A): static design intent, never a claim that content exists. */
export const STAGE_BUILDS: Readonly<Record<StageKey, readonly Skill[]>> = {
  stage1: ['read', 'listen', 'write'],
  stage2: ['read', 'listen', 'write'],
  stage3: ['read', 'write'],
  stage4: ['listen', 'read'],
  stage5: ['read', 'listen'],
  stage6: ['read', 'write'],
  stage7: ['write'],
};

export interface StageFacts {
  availability: StageAvailability;
  entitled: boolean;
  /** `stageDoneAt[stage]` exists. */
  latched: boolean;
  /** The learner owns a card whose `unlockedBy` is `<stage>-complete`. */
  cardComplete: boolean;
  /** Every playable grid episode of the stage is complete (at least one exists). */
  allPlayableDone: boolean;
  /** The states of the stage's quest pips (cell pips excluded). */
  questPips: readonly PipState[];
}

/**
 * First matching row wins. `known` never awards anything and is never called
 * Complete; a `taste` stage is never complete by the derived rule.
 */
export function stageStateOf(f: StageFacts): StageState {
  if (f.latched || (f.availability === 'open' && f.allPlayableDone) || f.cardComplete) return 'complete';
  const known = f.questPips.filter((p) => p === 'known').length;
  const done = f.questPips.filter((p) => p === 'done').length;
  if (known > 0 && known + done === f.questPips.length) return 'known';
  if (f.availability === 'taste' && f.allPlayableDone) return 'explored';
  if (f.availability === 'soon' || (!f.entitled && done === 0)) return 'later';
  return 'open';
}

/** Exactly one stage: the cursor's; at rest the highest with a done pip; with nothing done the start's, else Stage 1. */
export function hereStageOf(i: {
  cursorStage: StageKey | null;
  highestDoneStage: StageKey | null;
  startStage: StageKey | null;
}): StageKey {
  return i.cursorStage ?? i.highestDoneStage ?? i.startStage ?? 'stage1';
}

/** The derived completion rule the latch writes from: availability `open` and every grid episode complete. */
export function isDerivedComplete(
  stage: StageKey,
  gridEpisodes: readonly Episode[],
  snapshot: Pick<ProgressSnapshot, 'quests'>,
): boolean {
  return stageAvailability(stage, gridEpisodes) === 'open' && completionState(stage, gridEpisodes, snapshot).stageComplete;
}

export interface StageRowsContext {
  gridEpisodes: readonly Episode[];
  pips: PipContext;
  cursorStage: StageKey | null;
  startStage: StageKey | null;
}

const ORDERS = [1, 2, 3, 4, 5, 6, 7] as const;

export function buildStageRows(input: MyRouteInput, ctx: StageRowsContext): StageRow[] {
  const owned = new Set(input.snapshot.cards.map((c) => c.cardId));
  const completeCards = new Set(input.cards.filter((c) => owned.has(c.id)).map((c) => c.unlockedBy));
  const rows = StageKeySchema.options.map((stage, index): StageRow => {
    const availability = stageAvailability(stage, ctx.gridEpisodes);
    const cells = cellRowsOf(stage, ctx.gridEpisodes, input.themes, ctx.pips);
    const latched = ctx.pips.latched.has(stage);
    const { pips, newPips } = splitStagePips(cells, latched);
    const questPips = cells.flatMap((c) => c.pips).filter((p) => p.kind === 'quest');
    const seenTotal = input.seen?.totals[stage];
    return {
      stage,
      order: ORDERS[index] as StageRow['order'],
      title: input.stages.find((s) => s.key === stage)?.titleEn ?? stage,
      state: stageStateOf({
        availability,
        entitled: input.isEntitled(stage),
        latched,
        cardComplete: completeCards.has(`${stage}-complete`),
        allPlayableDone: completionState(stage, ctx.gridEpisodes, input.snapshot).stageComplete,
        questPips: questPips.map((p) => p.state),
      }),
      availability,
      latched,
      here: false,
      isStart: false,
      pips,
      newPips,
      cells,
      done: questPips.filter((p) => p.state === 'done').length,
      known: questPips.filter((p) => p.state === 'known').length,
      newSinceSeen: seenTotal === undefined ? 0 : Math.max(0, questPips.length - seenTotal),
      builds: [...STAGE_BUILDS[stage]],
    };
  });
  const highestDone = [...rows].reverse().find((r) => r.done > 0)?.stage ?? null;
  const here = hereStageOf({ cursorStage: ctx.cursorStage, highestDoneStage: highestDone, startStage: ctx.startStage });
  return rows.map((r) => (r.stage === here ? { ...r, here: true } : r));
}
