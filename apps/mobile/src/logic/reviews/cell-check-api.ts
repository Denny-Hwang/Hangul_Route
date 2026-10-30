import type { ProgressSnapshot, ReviewEntry, UiLocale } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { MemoryFile } from '../memory/memory-file';
import { stampOf, type MemoryAnswer } from '../memory/memory-runtime';
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
  planStageJump,
  stageJumpItemIds,
  testedOutKeys,
  type TestOutCell,
  testOutAllowed,
  testOutFinishedEvent,
  testOutFits,
  type CheckMode,
  type PlannedCheck,
} from './cell-check';
import type { RoundAnswer } from './daily-review';
import { engineStates, gradeTyped, type EngineContext, type SourceVisibility, type TypedGrade } from './engine';
import { glossFrom, surfaceIndex, type GameFormats } from './review-rounds';
import type { ReviewItemIndex } from './review-items-store';

/**
 * The Cell Check's side of the stores (F-CURR-002 row CM-21), in the memory chunk beside `dailyReviewApi()` and the
 * review engine, so no scheduler module is shared by two chunks. The screen's chunk reaches it through the boot
 * module's `memoryChunk()`.
 *
 * - **Gate**: `cellCheck` (which covers the test-out) and `memoryRecord` for a learner profile (`on`): with answers
 *   not recorded a Check could latch a result while no memory state moved. It is read when the session starts and
 *   again when it finishes: a switch turned off meanwhile writes nothing. A test-out also checks the cell again at both
 *   ends (`testOutCell`: not Stage 1, not started, every quest open under F-ENT-003), so a plan that lapsed while it
 *   played latches nothing, and needs a cell whose topic words are few (`testOutFits`).
 * - **Stamps**: the entry and the latches carry the guarded stamp of the memory store (`stampOf`, row CM-12's
 *   wrong-clock cap), never a device clock far ahead.
 * - **Telemetry**: `review.start` when the learner taps Let's go (`started`), never for an intro left with Maybe later.
 * - **A Cell Check** records each round's first answer as it is given (`recordAnswers`, the spacing rule), so a stopped
 *   Check keeps them; it writes the entry and, at 3 stars, `cellCheckAt` only when it is finished.
 * - **A test-out** records nothing until it is finished (a stopped test-out writes nothing: the cell has not been
 *   taught). Then the asked items are placed by their result (`recordTestOut`), a pass latches `testedOut` and the
 *   unasked items are derived from it (`ensureSeeded` lays them).
 * - **A Stage Jump** (row CM-25) is a test-out over a whole stage: the same rule, one Check over the stage's cells, the
 *   stage and each cell checked at both ends (`jumpAllowed`); a pass latches `testedOut` for each cell and for the stage
 *   key, with the guarded stamp. Its telemetry is `review.start` / `review.complete` of kind
 *   `cell-check` with the stars only (no `testout.finished`: its items and first tries are not split per cell).
 */

export interface CellCheckDeps {
  file(profileId: string): Promise<MemoryFile | null>;
  ensureSeeded(profileId: string): Promise<void>;
  items(): Promise<ReviewItemIndex>;
  /** `cellCheck` and `memoryRecord` for the profile (a learner, not a grown-up persona). */
  on(profileId: string): boolean;
  visibility(profileId: string): SourceVisibility;
  /** Row CM-32: the section 7.1 formats switched on for the profile (`game.syllable-build`); none when absent. */
  games?(profileId: string): GameFormats;
  voice(): boolean;
  /** `game.cloze-pick` for the profile (row CM-30): a sentence's produce rung may be a Cloze Pick round. Absent: off. */
  clozePick?(profileId: string): boolean;
  /** `game.type-hangul-hear` for the profile: the produce rung may be Dictation (row CM-31). Absent: off. */
  dictation?(profileId: string): boolean;
  hydrate(profileId: string): Promise<void>;
  snapshot(profileId: string): ProgressSnapshot | undefined;
  recordReview(profileId: string, entry: ReviewEntry): void;
  recordAnswers(profileId: string, answers: readonly MemoryAnswer[]): Promise<void>;
  recordTestOut(profileId: string, answers: readonly MemoryAnswer[], passed: boolean, at: Date): Promise<void>;
  /** The cell's test-out facts for the learner now (its stage, each quest open, started), or null for an unknown cell. */
  testOutCell(profileId: string, cellId: string): TestOutCell | null;
  /** The server time of the learner's last snapshot sync, or null (the stamp cap). */
  serverTime(profileId: string): string | null;
  /** Latches `cellCheckAt` or `testedOut` for these keys on the hydrated snapshot (earliest wins), saved and synced once. */
  latch(profileId: string, field: 'cellCheckAt' | 'testedOut', keys: readonly string[], at: string): void;
  track(event: TelemetryEvent): void;
  overlays(locale: 'es' | 'ko'): Readonly<Record<string, Readonly<Record<string, string>>>>;
  ensureCell(cell: string): Promise<void>;
}

export interface CheckWorld {
  profileId: string;
  ctx: EngineContext;
}

export type CheckWorldRead = { kind: 'off' } | { kind: 'unreadable' } | { kind: 'ready'; world: CheckWorld };

export interface CellOffers {
  check: boolean;
  testOut: boolean;
}

const NO_OFFERS: CellOffers = { check: false, testOut: false };

export interface CheckFinished {
  stars: 1 | 2 | 3;
  passed: boolean;
}

export interface CellCheckApi {
  readWorld(profileId: string | null, now?: Date): Promise<CheckWorldRead>;
  /**
   * Whether the cell has a Check to offer (5 or more playable rounds) and whether its topic words leave room for Test
   * out; both false while off or unreadable.
   */
  offerable(profileId: string | null, cellId: string): Promise<CellOffers>;
  /** Whether a Stage Jump of these cells can play (10 or more rounds, row CM-25); false while off or unreadable. */
  jumpOfferable(profileId: string | null, stage: string, cells: readonly string[]): Promise<boolean>;
  /**
   * The plan; null when there is none, or for a test-out the cell (for a Stage Jump each cell of the stage) may not take
   * now. `cells`: a Stage Jump's cells (`mode: 'jump'`, `cellId` the stage key); ignored by a cell's own Check.
   */
  startSession(world: CheckWorld, cellId: string, mode: CheckMode, locale: UiLocale, cells?: readonly string[]): Promise<PlannedCheck | null>;
  /** The learner tapped Let's go: `review.start { kind: 'cell-check' }`. */
  started(world: CheckWorld): void;
  /** A Cell Check records a round's first answer now; a test-out holds it until the end. */
  recordRound(world: CheckWorld, plan: PlannedCheck, index: number, answer: RoundAnswer): Promise<void>;
  /** The result; null, with nothing written, when the switch went off or the test-out's cell closed while it played. */
  finishSession(world: CheckWorld, plan: PlannedCheck, answers: ReadonlyMap<number, RoundAnswer>, recorded: readonly Promise<void>[], now?: Date): Promise<CheckFinished | null>;
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
        index: surfaceIndex(index, { clozePick: deps.clozePick?.(profileId) === true, dictation: deps.dictation?.(profileId) === true, games: deps.games?.(profileId) }),
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

  /**
   * Row CM-25: may the stage be jumped now: not jumped yet, and every cell of it may be tested out (not Stage 1, not
   * started, every quest open under F-ENT-003). Read at the start and again before the latch, as a cell's test-out.
   */
  const jumpAllowed = (profileId: string, stage: string, cells: readonly string[]): boolean =>
    cells.length > 0 && deps.snapshot(profileId)?.testedOut?.[stage] === undefined && cells.every((cell) => testOutAllowed(deps.testOutCell(profileId, cell)));

  return {
    readWorld,

    async offerable(profileId, cellId) {
      const read = await readWorld(profileId);
      if (read.kind !== 'ready') return NO_OFFERS;
      const { ctx } = read.world;
      // The English plan says whether 5 rounds can play (a missing meaning in es or ko only changes which ones).
      const check = cellCheckItemIds(ctx.index, cellId).length > 0 && planCellCheck(ctx, cellId, 'check', { gloss: glossFrom(undefined), seed: ctx.seed ?? '' }) !== null;
      return { check, testOut: check && testOutFits(ctx.index, cellId) };
    },

    async jumpOfferable(profileId, stage, cells) {
      const read = await readWorld(profileId);
      if (read.kind !== 'ready') return false;
      const { ctx } = read.world;
      return stageJumpItemIds(ctx.index, cells).length > 0 && planStageJump(ctx, stage, cells, { gloss: glossFrom(undefined), seed: ctx.seed ?? '' }) !== null;
    },

    async startSession(world, cellId, mode, locale, cells = []) {
      const { ctx, profileId } = world;
      if (!deps.on(profileId)) return null;
      if (mode === 'testout' && !(testOutFits(ctx.index, cellId) && testOutAllowed(deps.testOutCell(profileId, cellId)))) return null;
      if (mode === 'jump' && !jumpAllowed(profileId, cellId, cells)) return null;
      const seed = `${ctx.seed ?? ''}|${cellId}`;
      const planOf = (gloss: ReturnType<typeof glossFrom>, out?: ReadonlySet<string>): PlannedCheck | null =>
        mode === 'jump' ? planStageJump(ctx, cellId, cells, { gloss, seed }, out) : planCellCheck(ctx, cellId, mode, { gloss, seed }, out);
      let plan = planOf(glossFrom(undefined));
      if (plan !== null && locale !== 'en') {
        // As the Daily Review: the meanings come from the lesson chunks, and a meaning still missing is never shown in
        // English. A Check asks one cell's items, so their chunks load first and an item none of whose chunks loads
        // (offline, not cached) is left out; then the chunks of the options beside each answer, and the plan is built again.
        const tried = new Map<string, boolean>();
        const ids = mode === 'jump' ? stageJumpItemIds(ctx.index, cells) : cellCheckItemIds(ctx.index, cellId);
        await loadCells(ids, ctx, tried);
        const out = new Set(unloadable(ids, ctx, tried));
        const gloss = (): ReturnType<typeof glossFrom> => glossFrom(deps.overlays(locale));
        plan = planOf(gloss(), out);
        if (plan !== null && (await loadCells(planItems(plan, true), ctx, tried))) plan = planOf(gloss(), out);
      }
      return plan;
    },

    started(world) {
      deps.track(cellCheckStartEvent(world.profileId));
    },

    recordRound(world, plan, index, answer) {
      const round = plan.rounds[index];
      if (round === undefined || plan.mode !== 'check') return Promise.resolve();
      return deps.recordAnswers(world.profileId, checkAnswers([round], new Map([[0, answer]])));
    },

    async finishSession(world, plan, answers, recorded, now = new Date()) {
      const { profileId } = world;
      await Promise.all(recorded);
      // The switch, and for a test-out the cell's access, read again: either gone meanwhile writes nothing.
      if (!deps.on(profileId) || (plan.mode === 'testout' && !testOutAllowed(deps.testOutCell(profileId, plan.cellId)))) return null;
      if (plan.mode === 'jump' && !jumpAllowed(profileId, plan.cellId, plan.cells ?? [])) return null;
      const result = checkResult(plan.rounds, answers);
      const file = await deps.file(profileId);
      const at = stampOf(file ?? { rows: {} }, now, deps.serverTime(profileId));
      if (plan.mode !== 'check') await deps.recordTestOut(profileId, checkAnswers(plan.rounds, answers), result.passed, now);
      deps.recordReview(profileId, cellCheckEntry({ cellId: plan.cellId, result, at }));
      const latch = checkLatch(plan.mode, result);
      // A Stage Jump latches every cell of the stage and the stage key (row CM-25), one write.
      if (latch !== null) deps.latch(profileId, latch, latch === 'testedOut' ? testedOutKeys(plan) : [plan.cellId], at);
      // The unasked items of a passed test-out or jump are derived from `testedOut` (laid by the seeding pass).
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
