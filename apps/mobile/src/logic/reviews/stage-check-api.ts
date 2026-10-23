import type { ProgressSnapshot, ReviewEntry, StageKey, UiLocale } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { MemoryFile } from '../memory/memory-file';
import type { MemoryAnswer } from '../memory/memory-runtime';
import { localDay, vocabOf } from '../vocab/progress';
import { checkAnswers } from './cell-check';
import type { RoundAnswer } from './daily-review';
import { engineStates, gradeTyped, type EngineContext, type SourceVisibility, type TypedGrade } from './engine';
import { glossFrom, surfaceIndex } from './review-rounds';
import type { ReviewItemIndex } from './review-items-store';
import {
  planStageCheck,
  stageCheckCompleteEvent,
  stageCheckEntry,
  stageCheckItemIds,
  stageCheckResult,
  stageCheckStartEvent,
  type PlannedStageCheck,
} from './stage-check';

/**
 * The Stage Check's side of the stores (F-CURR-002 row CM-22), in the memory chunk beside `cellCheckApi()` and the
 * review engine, so no scheduler module is shared by two chunks. The screen's chunk reaches it through the boot
 * module's `memoryChunk()`.
 *
 * - **Gate**: `stageChecks` and `memoryRecord` for a learner profile (`on`): with answers not recorded a check could
 *   latch a result while no memory state moved (stage-check.md States).
 * - Each round's first answer is recorded as it is given (`recordAnswers`, the spacing rule), so a stopped check keeps
 *   them; the `reviews[]` entry and, at 3 stars, `stageCheckAt` are written only when it is finished.
 * - `review.start` is sent when the learner starts the first part (D's Let's go), `review.complete` at the end.
 */

export interface StageCheckDeps {
  file(profileId: string): Promise<MemoryFile | null>;
  ensureSeeded(profileId: string): Promise<void>;
  items(): Promise<ReviewItemIndex>;
  /** `stageChecks` and `memoryRecord` for the profile (a learner, not a grown-up persona). */
  on(profileId: string): boolean;
  /** The stage's grid cells, theme order. */
  cells(stage: StageKey): readonly string[];
  visibility(profileId: string): SourceVisibility;
  voice(): boolean;
  hydrate(profileId: string): Promise<void>;
  snapshot(profileId: string): ProgressSnapshot | undefined;
  recordReview(profileId: string, entry: ReviewEntry): void;
  recordAnswers(profileId: string, answers: readonly MemoryAnswer[]): Promise<void>;
  /** Latches `stageCheckAt` for the stage on the hydrated snapshot (earliest wins), saved and synced. */
  latch(profileId: string, stage: StageKey, at: string): void;
  track(event: TelemetryEvent): void;
  overlays(locale: 'es' | 'ko'): Readonly<Record<string, Readonly<Record<string, string>>>>;
  ensureCell(cell: string): Promise<void>;
  random(): number;
}

export interface StageCheckWorld {
  profileId: string;
  ctx: EngineContext;
}

export type StageCheckWorldRead = { kind: 'off' } | { kind: 'unreadable' } | { kind: 'ready'; world: StageCheckWorld };

export interface StageCheckFinished {
  stars: 1 | 2 | 3;
  passed: boolean;
  /** A round was not right on the first try: Hoya brings those back in the reviews. */
  missed: boolean;
}

export interface StageCheckApi {
  readWorld(profileId: string | null, now?: Date): Promise<StageCheckWorldRead>;
  /** Whether the stage has a Stage Check to offer (10 or more playable rounds); false while off or unreadable. */
  offerable(profileId: string | null, stage: StageKey): Promise<boolean>;
  startSession(world: StageCheckWorld, stage: StageKey, locale: UiLocale): Promise<PlannedStageCheck | null>;
  /** The learner starts the first part: `review.start`. */
  begin(world: StageCheckWorld, plan: PlannedStageCheck, hideRomanization: boolean): void;
  /** Records a round's first answer now (the spacing rule). */
  recordRound(world: StageCheckWorld, plan: PlannedStageCheck, index: number, answer: RoundAnswer): Promise<void>;
  finishSession(
    world: StageCheckWorld,
    plan: PlannedStageCheck,
    answers: ReadonlyMap<number, RoundAnswer>,
    recorded: readonly Promise<void>[],
    now?: Date,
  ): Promise<StageCheckFinished>;
  gradeTyped(target: string, typed: string): TypedGrade;
}

export function createStageCheckApi(deps: StageCheckDeps): StageCheckApi {
  async function readWorld(profileId: string | null, now: Date = new Date()): Promise<StageCheckWorldRead> {
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
  const planItems = (plan: PlannedStageCheck): string[] =>
    plan.rounds.flatMap((r) => [r.question.itemId, ...(r.type === 'pick' ? r.options.map((o) => o.id) : [])]);

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

    async offerable(profileId, stage) {
      const read = await readWorld(profileId);
      if (read.kind !== 'ready') return false;
      const { ctx } = read.world;
      // The English plan says whether 10 rounds can play (a missing meaning in es or ko only changes which ones).
      return planStageCheck(ctx, stage, deps.cells(stage), { gloss: glossFrom(undefined), seed: ctx.seed ?? '' }) !== null;
    },

    async startSession(world, stage, locale) {
      const { ctx } = world;
      const cells = deps.cells(stage);
      const seed = `${ctx.seed ?? ''}|${stage}`;
      let plan = planStageCheck(ctx, stage, cells, { gloss: glossFrom(undefined), seed });
      if (plan !== null && locale !== 'en') {
        // As the Cell Check: the meanings come from the lesson chunks, and a meaning still missing is never shown in
        // English. The stage's items' chunks load first and an item none of whose chunks loads (offline, not cached)
        // is left out; then the chunks of the options beside each answer, and the plan is built again.
        const tried = new Map<string, boolean>();
        const ids = stageCheckItemIds(ctx.index, cells).flat();
        await loadCells(ids, ctx, tried);
        const out = new Set(unloadable(ids, ctx, tried));
        const gloss = (): ReturnType<typeof glossFrom> => glossFrom(deps.overlays(locale));
        plan = planStageCheck(ctx, stage, cells, { gloss: gloss(), seed }, out);
        if (plan !== null && (await loadCells(planItems(plan), ctx, tried))) plan = planStageCheck(ctx, stage, cells, { gloss: gloss(), seed }, out);
      }
      return plan;
    },

    begin(world, plan, hideRomanization) {
      deps.track(stageCheckStartEvent(world.profileId, plan.stage, hideRomanization));
    },

    recordRound(world, plan, index, answer) {
      const round = plan.rounds[index];
      if (round === undefined) return Promise.resolve();
      return deps.recordAnswers(world.profileId, checkAnswers([round], new Map([[0, answer]])));
    },

    async finishSession(world, plan, answers, recorded, now = new Date()) {
      const { profileId, ctx } = world;
      await Promise.all(recorded);
      const result = stageCheckResult(plan.rounds, answers);
      deps.recordReview(profileId, stageCheckEntry({ stage: plan.stage, result, day: ctx.today, now, nonce: Math.floor(deps.random() * 0x7fffffff).toString(36) }));
      if (result.passed) deps.latch(profileId, plan.stage, now.toISOString());
      deps.track(stageCheckCompleteEvent(profileId, plan.stage, result.stars));
      return { stars: result.stars, passed: result.passed, missed: result.missedItemIds.length > 0 };
    },

    gradeTyped,
  };
}
