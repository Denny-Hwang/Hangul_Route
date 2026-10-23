import type { ProgressSnapshot, ReviewEntry, StageKey, UiLocale } from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import type { MemoryFile } from '../memory/memory-file';
import { stampOf, type MemoryAnswer } from '../memory/memory-runtime';
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
 *   latch a result while no memory state moved (stage-check.md States). It is read when the session starts and again
 *   when it finishes, with the stage's access (`stageOpen`, F-ENT-003): a switch turned off or a plan that lapsed
 *   meanwhile writes nothing (the Cell Check's rule, row CM-21).
 * - **Stamps**: the entry and the latch carry the guarded stamp of the memory store (`stampOf`, row CM-12's
 *   wrong-clock cap), never a device clock far ahead.
 * - **One entry per stage** (`stage-check:<stage>`): a retake merges into it (the best stars, then the earliest copy),
 *   so `reviews[]` never grows with retakes.
 * - **Offer**: whether a stage has 10 playable rounds is read once per learner, stage, day and sound setting, and the
 *   store is read once for all the stages asked together, so a Journey with six finished stages reads it once.
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
  /** `game.type-hangul-hear` for the profile: the produce rung may be Dictation (row CM-31). Absent: off. */
  dictation?(profileId: string): boolean;
  hydrate(profileId: string): Promise<void>;
  snapshot(profileId: string): ProgressSnapshot | undefined;
  recordReview(profileId: string, entry: ReviewEntry): void;
  recordAnswers(profileId: string, answers: readonly MemoryAnswer[]): Promise<void>;
  /** Every quest of the stage open to the learner now (F-ENT-003): read again when the check finishes. */
  stageOpen(profileId: string, stage: StageKey): boolean;
  /** The server time of the learner's last snapshot sync, or null (the stamp cap). */
  serverTime(profileId: string): string | null;
  /** Latches `stageCheckAt` for the stage on the hydrated snapshot (earliest wins), saved and synced. */
  latch(profileId: string, stage: StageKey, at: string): void;
  track(event: TelemetryEvent): void;
  overlays(locale: 'es' | 'ko'): Readonly<Record<string, Readonly<Record<string, string>>>>;
  ensureCell(cell: string): Promise<void>;
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
  /** The result; null, with nothing written, when the switch went off or the stage closed (F-ENT-003) while it played. */
  finishSession(
    world: StageCheckWorld,
    plan: PlannedStageCheck,
    answers: ReadonlyMap<number, RoundAnswer>,
    recorded: readonly Promise<void>[],
    now?: Date,
  ): Promise<StageCheckFinished | null>;
  gradeTyped(target: string, typed: string): TypedGrade;
}

export function createStageCheckApi(deps: StageCheckDeps): StageCheckApi {
  /** The offer per learner, stage, day and sound setting, and the in-flight store read per learner and day. */
  const offers = new Map<string, boolean>();
  const worlds = new Map<string, Promise<StageCheckWorldRead>>();

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
        index: surfaceIndex(index, { dictation: deps.dictation?.(profileId) === true }),
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
      if (profileId === null || !deps.on(profileId)) return false;
      const day = localDay(new Date());
      const key = `${profileId}|${stage}|${day}|${String(deps.voice())}|${String(deps.dictation?.(profileId) === true)}`;
      const known = offers.get(key);
      if (known !== undefined) return known;
      // One store read for every stage asked together (the Journey's headers mount at once).
      const worldKey = `${profileId}|${day}`;
      let read = worlds.get(worldKey);
      if (read === undefined) {
        read = readWorld(profileId);
        worlds.set(worldKey, read);
        void read.then((r) => (r.kind === 'ready' ? undefined : worlds.delete(worldKey)));
      }
      const r = await read;
      if (r.kind !== 'ready') return false;
      const { ctx } = r.world;
      // The English plan says whether 10 rounds can play (a missing meaning in es or ko only changes which ones).
      const yes = planStageCheck({ ...ctx, voice: deps.voice() }, stage, deps.cells(stage), { gloss: glossFrom(undefined), seed: ctx.seed ?? '' }) !== null;
      offers.set(key, yes);
      return yes;
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
      const { profileId } = world;
      await Promise.all(recorded);
      // The switch and the stage's access, read again: either gone meanwhile writes nothing.
      if (!deps.on(profileId) || !deps.stageOpen(profileId, plan.stage)) return null;
      const result = stageCheckResult(plan.rounds, answers);
      const file = await deps.file(profileId);
      const at = stampOf(file ?? { rows: {} }, now, deps.serverTime(profileId));
      deps.recordReview(profileId, stageCheckEntry({ stage: plan.stage, result, at }));
      if (result.passed) deps.latch(profileId, plan.stage, at);
      deps.track(stageCheckCompleteEvent(profileId, plan.stage, result.stars));
      return { stars: result.stars, passed: result.passed, missed: result.missedItemIds.length > 0 };
    },

    gradeTyped,
  };
}
