import type { ProgressSnapshot, ReviewEntry, UiLocale } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { MemoryFile } from '../memory/memory-file';
import type { MemoryAnswer } from '../memory/memory-runtime';
import { localDay, vocabOf } from '../vocab/progress';
import {
  cellCheckCompleteEvent,
  cellCheckEntry,
  cellCheckItemIds,
  cellCheckStartEvent,
  checkAnswers,
  checkLatch,
  checkResult,
  planCellCheck,
  testOutFinishedEvent,
  type CheckMode,
  type PlannedCheck,
} from './cell-check';
import type { RoundAnswer } from './daily-review';
import { engineStates, gradeTyped, type EngineContext, type SourceVisibility, type TypedGrade } from './engine';
import { glossFrom, surfaceIndex } from './review-rounds';
import type { ReviewItemIndex } from './review-items-store';

/**
 * The Cell Check's side of the stores (F-CURR-002 row CM-21), in the memory chunk beside `dailyReviewApi()` and the
 * review engine, so no scheduler module is shared by two chunks. The screen's chunk reaches it through the boot
 * module's `memoryChunk()`.
 *
 * - **Gate**: `cellCheck` (which covers the test-out) and `memoryRecord` for a learner profile (`on`): with answers
 *   not recorded a Check could latch a result while no memory state moved.
 * - **A Cell Check** records each round's first answer as it is given (`recordAnswers`, the spacing rule), so a stopped
 *   Check keeps them; it writes the entry and, at 3 stars, `cellCheckAt` only when it is finished.
 * - **A test-out** records nothing until it is finished (a stopped test-out writes nothing: the cell has not been
 *   taught). Then the asked items are placed by their result (`recordTestOut`), a pass latches `testedOut` and the
 *   unasked items are derived from it (`ensureSeeded` lays them).
 */

export interface CellCheckDeps {
  file(profileId: string): Promise<MemoryFile | null>;
  ensureSeeded(profileId: string): Promise<void>;
  items(): Promise<ReviewItemIndex>;
  /** `cellCheck` and `memoryRecord` for the profile (a learner, not a grown-up persona). */
  on(profileId: string): boolean;
  visibility(profileId: string): SourceVisibility;
  voice(): boolean;
  hydrate(profileId: string): Promise<void>;
  snapshot(profileId: string): ProgressSnapshot | undefined;
  recordReview(profileId: string, entry: ReviewEntry): void;
  recordAnswers(profileId: string, answers: readonly MemoryAnswer[]): Promise<void>;
  recordTestOut(profileId: string, answers: readonly MemoryAnswer[], passed: boolean, at: Date): Promise<void>;
  /** Latches `cellCheckAt` or `testedOut` for the cell on the hydrated snapshot (earliest wins), saved and synced. */
  latch(profileId: string, field: 'cellCheckAt' | 'testedOut', cellId: string, at: string): void;
  track(event: TelemetryEvent): void;
  overlays(locale: 'es' | 'ko'): Readonly<Record<string, Readonly<Record<string, string>>>>;
  ensureCell(cell: string): Promise<void>;
  random(): number;
}

export interface CheckWorld {
  profileId: string;
  ctx: EngineContext;
}

export type CheckWorldRead = { kind: 'off' } | { kind: 'unreadable' } | { kind: 'ready'; world: CheckWorld };

export interface CheckFinished {
  stars: 1 | 2 | 3;
  passed: boolean;
}

export interface CellCheckApi {
  readWorld(profileId: string | null, now?: Date): Promise<CheckWorldRead>;
  /** Whether the cell has a Check to offer (5 or more playable rounds); false while off or unreadable. */
  offerable(profileId: string | null, cellId: string): Promise<boolean>;
  startSession(world: CheckWorld, cellId: string, mode: CheckMode, locale: UiLocale): Promise<PlannedCheck | null>;
  /** A Cell Check records a round's first answer now; a test-out holds it until the end. */
  recordRound(world: CheckWorld, plan: PlannedCheck, index: number, answer: RoundAnswer): Promise<void>;
  finishSession(world: CheckWorld, plan: PlannedCheck, answers: ReadonlyMap<number, RoundAnswer>, recorded: readonly Promise<void>[], now?: Date): Promise<CheckFinished>;
  gradeTyped(target: string, typed: string): TypedGrade;
}

export function createCellCheckApi(deps: CellCheckDeps): CellCheckApi {
  async function readWorld(profileId: string | null, now: Date = new Date()): Promise<CheckWorldRead> {
    if (profileId === null || !deps.on(profileId)) return { kind: 'off' };
    try {
      await deps.hydrate(profileId);
      const index = await deps.items();
      await deps.ensureSeeded(profileId);
      const file = await deps.file(profileId);
      if (file === null) return { kind: 'unreadable' };
      const today = localDay(now);
      const snap = deps.snapshot(profileId);
      const ctx: EngineContext = {
        index: surfaceIndex(index),
        states: engineStates(file.rows, snap ? vocabOf(snap) : undefined),
        today,
        voice: deps.voice(),
        seed: `${profileId}|${today}`,
        visibility: deps.visibility(profileId),
      };
      return { kind: 'ready', world: { profileId, ctx } };
    } catch {
      return { kind: 'unreadable' };
    }
  }

  const lessonCells = (ctx: EngineContext, id: string): string[] => (ctx.index.byId.get(id)?.cells ?? []).filter((c) => c.startsWith('episode:'));
  const planItems = (plan: PlannedCheck, options: boolean): string[] =>
    plan.rounds.flatMap((r) => [r.question.itemId, ...(options && r.type === 'pick' ? r.options.map((o) => o.id) : [])]);

  /** Loads the lesson chunks (the es and ko meanings) of these items not tried yet; says whether any was tried now. */
  async function loadCells(ids: readonly string[], ctx: EngineContext, tried: Map<string, boolean>): Promise<boolean> {
    const cells = [...new Set(ids.flatMap((id) => lessonCells(ctx, id)))].filter((c) => !tried.has(c));
    const loaded = await Promise.all(cells.map((cell) => deps.ensureCell(cell).then(() => true, () => false)));
    cells.forEach((cell, i) => tried.set(cell, loaded[i] === true));
    return cells.length > 0;
  }
  const unloadable = (ids: readonly string[], ctx: EngineContext, tried: ReadonlyMap<string, boolean>): string[] =>
    ids.filter((id) => {
      const cells = lessonCells(ctx, id);
      return cells.length > 0 && cells.every((c) => tried.get(c) === false);
    });

  return {
    readWorld,

    async offerable(profileId, cellId) {
      const read = await readWorld(profileId);
      if (read.kind !== 'ready') return false;
      const { ctx } = read.world;
      // The English plan says whether 5 rounds can play (a missing meaning in es or ko only changes which ones).
      return cellCheckItemIds(ctx.index, cellId).length > 0 && planCellCheck(ctx, cellId, 'check', { gloss: glossFrom(undefined), seed: ctx.seed ?? '' }) !== null;
    },

    async startSession(world, cellId, mode, locale) {
      const { ctx, profileId } = world;
      const seed = `${ctx.seed ?? ''}|${cellId}`;
      let plan = planCellCheck(ctx, cellId, mode, { gloss: glossFrom(undefined), seed });
      if (plan !== null && locale !== 'en') {
        // As the Daily Review: the meanings come from the lesson chunks, and a meaning still missing is never shown in
        // English. A Check asks one cell's items, so their chunks load first and an item none of whose chunks loads
        // (offline, not cached) is left out; then the chunks of the options beside each answer, and the plan is built again.
        const tried = new Map<string, boolean>();
        const ids = cellCheckItemIds(ctx.index, cellId);
        await loadCells(ids, ctx, tried);
        const out = new Set(unloadable(ids, ctx, tried));
        const gloss = (): ReturnType<typeof glossFrom> => glossFrom(deps.overlays(locale));
        plan = planCellCheck(ctx, cellId, mode, { gloss: gloss(), seed }, out);
        if (plan !== null && (await loadCells(planItems(plan, true), ctx, tried))) plan = planCellCheck(ctx, cellId, mode, { gloss: gloss(), seed }, out);
      }
      if (plan !== null) deps.track(cellCheckStartEvent(profileId));
      return plan;
    },

    recordRound(world, plan, index, answer) {
      const round = plan.rounds[index];
      if (round === undefined || plan.mode === 'testout') return Promise.resolve();
      return deps.recordAnswers(world.profileId, checkAnswers([round], new Map([[0, answer]])));
    },

    async finishSession(world, plan, answers, recorded, now = new Date()) {
      const { profileId, ctx } = world;
      await Promise.all(recorded);
      const result = checkResult(plan.rounds, answers);
      if (plan.mode === 'testout') await deps.recordTestOut(profileId, checkAnswers(plan.rounds, answers), result.passed, now);
      deps.recordReview(profileId, cellCheckEntry({ cellId: plan.cellId, result, day: ctx.today, now, nonce: Math.floor(deps.random() * 0x7fffffff).toString(36) }));
      const latch = checkLatch(plan.mode, result);
      if (latch !== null) deps.latch(profileId, latch, plan.cellId, now.toISOString());
      // The unasked items of a passed test-out are derived from `testedOut` (laid by the seeding pass).
      if (latch === 'testedOut') await deps.ensureSeeded(profileId).catch(() => undefined);
      deps.track(cellCheckCompleteEvent(profileId, result.stars));
      if (plan.mode === 'testout') {
        const event = testOutFinishedEvent(profileId, plan.cellId, result);
        if (event !== null) deps.track(event);
      }
      return { stars: result.stars, passed: result.passed };
    },

    gradeTyped,
  };
}
