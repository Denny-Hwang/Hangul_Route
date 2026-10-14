import type { Episode, Overlays, Quest } from '@hangul-route/content-schema';
import type { MinigameScope } from '../minigame-config';

/**
 * The upper-stage lesson cells at runtime (F-CURR-001 §3.10, §3.12): the headers
 * come with the start bundle, each stage's scopes come from its own module the
 * first time a scope of that stage is asked for. Pure over an injected loader, so
 * the lazy path is testable without Metro (`content/lessons.ts` binds the real one).
 */

export const LESSON_STAGE_NUMBERS = [2, 3, 4, 6, 7] as const;
export type LessonStage = (typeof LESSON_STAGE_NUMBERS)[number];

export interface StageModule {
  LESSON_SCOPES: Readonly<Record<string, MinigameScope>>;
  LESSON_SCOPE_OVERLAYS: Overlays;
}

/** `minigame:s<n>-<theme>-q<k>-<step>` -> n, for the stages that hold lesson cells. */
const SCOPE_REF = /^minigame:s([2-467])-(?:letters|life|rites|nature|crafts)-q[1-9]-[a-z0-9-]+$/;

export function lessonStageOfRef(ref: string): LessonStage | undefined {
  const match = SCOPE_REF.exec(ref);
  return match === null ? undefined : (Number(match[1]) as LessonStage);
}

/** Two overlay tables as one; `extra` wins on an entity both name (they never share ids). Returns `base` itself when `extra` is empty. */
export function mergeOverlays(base: Overlays, extra: Overlays): Overlays {
  if (Object.keys(extra.es).length === 0 && Object.keys(extra.ko).length === 0) return base;
  return { es: { ...base.es, ...extra.es }, ko: { ...base.ko, ...extra.ko } };
}

export interface LessonLookup {
  /** The scope of a lesson minigame ref, loading its stage module on first use; undefined for any other ref. */
  scopeFor: (ref: string) => MinigameScope | undefined;
  /** `base` plus the glosses of the stage module that holds `ref` (loads it); `base` for any other ref. */
  scopeOverlaysFor: (ref: string, base: Overlays) => Overlays;
}

/**
 * `shipped` is the set of stages with at least one ready cell (from the index):
 * a ref of any other stage never loads a module. Each module is loaded once.
 */
export function lessonLookup(load: (stage: LessonStage) => StageModule, shipped: ReadonlySet<LessonStage>): LessonLookup {
  const loaded = new Map<LessonStage, StageModule>();
  const moduleOf = (ref: string): StageModule | undefined => {
    const stage = lessonStageOfRef(ref);
    if (stage === undefined || !shipped.has(stage)) return undefined;
    let mod = loaded.get(stage);
    if (mod === undefined) {
      mod = load(stage);
      loaded.set(stage, mod);
    }
    return mod;
  };
  return {
    scopeFor: (ref) => moduleOf(ref)?.LESSON_SCOPES[ref],
    scopeOverlaysFor: (ref, base) => {
      const mod = moduleOf(ref);
      return mod === undefined ? base : mergeOverlays(base, mod.LESSON_SCOPE_OVERLAYS);
    },
  };
}

/** The stages that hold a shipped lesson episode. */
export function shippedLessonStages(episodes: readonly Pick<Episode, 'stage'>[]): Set<LessonStage> {
  const stages = new Set<LessonStage>();
  for (const e of episodes) {
    const n = Number(e.stage.slice('stage'.length));
    if ((LESSON_STAGE_NUMBERS as readonly number[]).includes(n)) stages.add(n as LessonStage);
  }
  return stages;
}

const STAGE_RANK = (q: Quest, stageOf: ReadonlyMap<string, string>): number => Number((stageOf.get(q.id) ?? 'stage9').slice(5));

/**
 * The lesson quest list in cursor order (the cursor offers quests in list order):
 * the hand-written quests up to Stage 4 and the lesson quests of Stages 2-4 by stage,
 * then the stories and books, then the lesson quests of Stages 6-7. Within a stage
 * the hand-written quests keep their place and the lesson quests follow in index order.
 */
export function questsInCursorOrder(i: {
  early: readonly Quest[];
  lessons: readonly Quest[];
  middle: readonly Quest[];
  episodes: readonly Pick<Episode, 'stage' | 'questIds'>[];
}): Quest[] {
  const stageOf = new Map<string, string>();
  for (const e of i.episodes) for (const id of e.questIds) stageOf.set(id, e.stage);
  const tagged = [...i.early, ...i.lessons].map((q, index) => ({ q, index, rank: STAGE_RANK(q, stageOf) }));
  const upTo4 = tagged.filter((t) => t.rank <= 4).sort((a, b) => a.rank - b.rank || a.index - b.index);
  const late = tagged.filter((t) => t.rank > 4).sort((a, b) => a.rank - b.rank || a.index - b.index);
  return [...upTo4.map((t) => t.q), ...i.middle, ...late.map((t) => t.q)];
}
