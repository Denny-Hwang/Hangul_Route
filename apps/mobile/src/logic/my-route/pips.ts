import { ThemeKeySchema, type Episode, type StageKey, type ThemeDef } from '@hangul-route/content-schema';
import { playableEpisodes } from '../next-quest';
import type { RouteEntry } from './order';
import type { CellRow, CellState, Pip, PipState } from './types';

/**
 * Pips and cell rows (F-ROUTE-001 section 3.4): one pip per grid quest of each
 * playable cell, one `later` pip per cell that is not playable. Pips are a
 * collection of drawn shapes, never a bar: a row shows what exists.
 *
 * `pipStateOf` is the one "placed out / known" predicate (section 6.3);
 * F-PLC-001 P-7's `logic/placement/cell-look.ts` imports it.
 */

export interface PipFacts {
  /** The quest has `completedAt`, at any star count. */
  done: boolean;
  /** Placed out by the level check (after any grown-up override). */
  placedOut: boolean;
  /** The quest sits in a latched stage, so it joined after the stage was completed. */
  joinedAfterLatch: boolean;
  /** Playable and entitled. */
  offerable: boolean;
}

/** Precedence: done > known > new > open > later. */
export function pipStateOf(facts: PipFacts): PipState {
  if (facts.done) return 'done';
  if (facts.placedOut) return 'known';
  if (facts.joinedAfterLatch) return 'new';
  if (facts.offerable) return 'open';
  return 'later';
}

export interface PipContext {
  order: readonly RouteEntry[];
  done: ReadonlySet<string>;
  placedOut: ReadonlySet<string>;
  latched: ReadonlySet<StageKey>;
  isEntitled: (stage: StageKey) => boolean;
  cursorId: string | null;
}

const questPip = (entry: RouteEntry, ctx: PipContext): Pip => ({
  key: entry.questId,
  kind: 'quest',
  questId: entry.questId,
  episodeId: entry.episodeId,
  state: pipStateOf({
    done: ctx.done.has(entry.questId),
    placedOut: ctx.placedOut.has(entry.questId),
    joinedAfterLatch: ctx.latched.has(entry.stage),
    offerable: ctx.isEntitled(entry.stage),
  }),
  isCursor: entry.questId === ctx.cursorId,
  isStart: false,
});

const cellPip = (key: string, episodeId: string | undefined): Pip => ({
  key,
  kind: 'cell',
  ...(episodeId === undefined ? {} : { episodeId }),
  state: 'later',
  isCursor: false,
  isStart: false,
});

function cellStateOf(pips: readonly Pip[]): CellState {
  const quests = pips.filter((p) => p.kind === 'quest');
  if (quests.length === 0) return 'later';
  const count = (state: PipState) => quests.filter((p) => p.state === state).length;
  const done = count('done');
  const known = count('known');
  if (done === quests.length) return 'complete';
  if (known > 0 && done + known === quests.length) return 'known';
  if (done > 0) return 'partial';
  if (count('later') === quests.length) return 'later';
  return 'open';
}

/** The five cell rows of a stage, in theme order. `gridEpisodes` must already be grid-only. */
export function cellRowsOf(
  stage: StageKey,
  gridEpisodes: readonly Episode[],
  themes: readonly Pick<ThemeDef, 'key' | 'titleEn'>[],
  ctx: PipContext,
): CellRow[] {
  return ThemeKeySchema.options.map((theme) => {
    const inCell = gridEpisodes.filter((e) => e.stage === stage && e.theme === theme);
    const playable = new Set(playableEpisodes(inCell).map((e) => e.id));
    const first = inCell.find((e) => playable.has(e.id)) ?? inCell[0];
    const entries = ctx.order.filter((e) => e.stage === stage && e.theme === theme && playable.has(e.episodeId));
    const pips =
      playable.size > 0
        ? entries.map((entry) => questPip(entry, ctx))
        : [cellPip(first?.id ?? `cell:${stage}-${theme}`, first?.id)];
    return {
      stage,
      theme,
      episodeId: first?.id ?? null,
      title: first?.titleEn ?? themes.find((t) => t.key === theme)?.titleEn ?? theme,
      pips,
      done: pips.filter((p) => p.state === 'done').length,
      state: cellStateOf(pips),
    };
  });
}

/**
 * The stage row's two groups: earned and open quest pips in route order, then
 * the `later` cell pips; and the `new` pips, drawn after a gap so the earned
 * group never looks emptier.
 */
export function splitStagePips(cells: readonly CellRow[]): { pips: Pip[]; newPips: Pip[] } {
  const all = cells.flatMap((c) => c.pips);
  return {
    pips: [...all.filter((p) => p.kind === 'quest' && p.state !== 'new'), ...all.filter((p) => p.kind === 'cell')],
    newPips: all.filter((p) => p.state === 'new'),
  };
}
