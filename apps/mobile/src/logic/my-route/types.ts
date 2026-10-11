import type {
  Episode,
  HeritageCard,
  ProgressSnapshot,
  Quest,
  RouteCatalog,
  RouteSeed,
  StageDef,
  StageKey,
  ThemeDef,
  ThemeKey,
} from '@hangul-route/content-schema';
import type { StageAvailability } from '../journey';

/**
 * The My route view-model types (F-ROUTE-001 section 3.2). Pure data: the
 * screen, the Home strip, the parent dashboard and the sync summary all read
 * one `MyRouteModel` built by `buildMyRoute`.
 */

export type Skill = 'read' | 'listen' | 'write';
export type PipState = 'done' | 'known' | 'open' | 'new' | 'later';

export interface Pip {
  key: string;
  kind: 'quest' | 'cell';
  questId?: string;
  episodeId?: string;
  state: PipState;
  isCursor: boolean;
  isStart: boolean;
}

export type StageState = 'complete' | 'known' | 'explored' | 'open' | 'later';
export type CellState = 'complete' | 'partial' | 'known' | 'open' | 'later';

export interface CellRow {
  stage: StageKey;
  theme: ThemeKey;
  episodeId: string | null;
  title: string;
  pips: Pip[];
  done: number;
  state: CellState;
}

export interface StageRow {
  stage: StageKey;
  order: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  title: string;
  state: StageState;
  availability: StageAvailability;
  latched: boolean;
  here: boolean;
  isStart: boolean;
  /** Earned and open pips, in route order. */
  pips: Pip[];
  /**
   * Quests that joined after the stage was latched (state 'new', or 'known' when
   * a later level check placed one out), drawn as their own group after a gap;
   * empty unless latched.
   */
  newPips: Pip[];
  cells: CellRow[];
  done: number;
  known: number;
  newSinceSeen: number;
  /** Static intent (Appendix A), not a claim that content exists. */
  builds: Skill[];
}

export interface SkillRow {
  skill: Skill;
  marks: 0 | 1 | 2 | 3 | 4 | 5;
  nextReachable: boolean;
  quests: number;
}

export type Hero = 'start' | 'continue' | 'rest' | 'beyond';

export interface MyRouteModel {
  hero: Hero;
  cursor: { questId: string; episodeId: string; stage: StageKey } | null;
  /** Always 7. */
  stages: StageRow[];
  /** 0..6: the index of the highest stage the trail connector fills down to. */
  trailReached: number;
  /** Always 3: read, listen, write. */
  skills: SkillRow[];
  /** Finished quests with a tile-building game (grown-up view only). */
  tiles: number;
  gains: { stars: number; cards: number; storiesRead: number };
  /** The start marker; always null until R-7a. */
  start: { stage: StageKey; questId: string | null } | null;
  /** Stages complete now by the derived rule and not yet in `stageDoneAt`. */
  latchesToWrite: StageKey[];
}

/** The per-device UI record (`route-map-ui:<profileId>`, section 3.10); read and written by R-1b `seen.ts`. */
export interface SeenRecord {
  totals: Partial<Record<StageKey, number>>;
  doneKeys: string[];
  at: string;
}

export interface MyRouteInput {
  snapshot: ProgressSnapshot;
  catalog: RouteCatalog;
  episodes: readonly Episode[];
  quests: readonly Quest[];
  cards: readonly Pick<HeritageCard, 'id' | 'unlockedBy'>[];
  stages: readonly Pick<StageDef, 'key' | 'order' | 'titleEn'>[];
  themes: readonly Pick<ThemeDef, 'key' | 'order' | 'titleEn'>[];
  /** Injected; R-1 and R-3 pass "every shipped stage is playable" until OD-4. */
  isEntitled: (stage: StageKey) => boolean;
  /** `effectiveRoute(placements, catalog, { isEntitled, completedQuestIds: new Set() })`; null until R-7a. */
  route: RouteSeed | null;
  /**
   * The placed-out quests the one cursor skips: `cursorContext(...).skipQuestIds`,
   * the same set Home and Results pass (R-4a, section 3.5). Joined with
   * `route.placedOutQuestIds`; it moves only the cursor (known pips need the
   * route, R-7a).
   */
  skipQuestIds?: ReadonlySet<string>;
  seen?: SeenRecord;
  now: Date;
}
