import type {
  DateKey,
  Episode,
  GoalSource,
  HeritageCard,
  ProgressSnapshot,
  Quest,
  RouteCatalog,
  RouteGoal,
  RouteSeed,
  StageDef,
  StageKey,
  ThemeDef,
  ThemeKey,
} from '@hangul-route/content-schema';
import type { StageAvailability } from '../journey';
import type { NextSource, PlanView, RouteNext } from '../route-next';

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
  /**
   * Why a `later` pip cannot be played (Learning Route amendment section 4.5):
   * `soon` for a cell with no playable content yet ("Coming later"),
   * `notOpen` for a playable quest the learner cannot start yet ("Not open
   * yet"). Both are the same dotted ring; the word tells them apart. Absent on
   * every other state.
   */
  laterReason?: 'soon' | 'notOpen';
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

/** `freeEnd` comes from F-ENT-003's `routeNext` kind `free-end` (Learning Route amendment section 4.4). */
export type Hero = 'start' | 'continue' | 'freeEnd' | 'rest' | 'beyond';

/** The one next quest (F-ENT-003 `RouteNext` kind `quest`), as the page reads it. */
export interface RouteNextQuest {
  questId: string;
  episodeId: string;
  stage: StageKey;
  source: NextSource;
}

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
  /** The start marker (R-7a, section 3.6); null without a stored level-check result. */
  start: { stage: StageKey; questId: string | null } | null;
  /** Stages complete now by the derived rule and not yet in `stageDoneAt`. */
  latchesToWrite: StageKey[];
  /**
   * Where the learner is heading (Learning Route amendment section 4.1):
   * `pickGoal` over the input's sources and this model's own stage rows;
   * null at the end of the open road.
   */
  goal: RouteGoal | null;
  /** The goal stage's pips, the same objects as its trail row (earned group, then the joined group); [] when `goal` is null. */
  goalPips: Pip[];
  /** F-ENT-003's `routeNext` quest (section 4.4); null at `free-end` and `rest`. Its pip carries `isCursor`. */
  next: RouteNextQuest | null;
  /** F-ENT-003's `RouteNext` kind. */
  nextKind: 'quest' | 'free-end' | 'rest';
  /** `[...planView.inPlanEpisodeIds]`: cell rows of these episodes show "In your plan". */
  inPlanEpisodeIds: string[];
}

/** The per-device UI record (`route-map-ui:<profileId>`, section 3.10); read and written by R-1b `seen.ts`. */
export interface SeenRecord {
  totals: Partial<Record<StageKey, number>>;
  doneKeys: string[];
  at: string;
  /**
   * The goals whose first reached moment this device already showed
   * (Learning Route amendment section 4.5), keyed `${from}:${sourceId ?? '-'}:${stage}`.
   * Missing reads as `[]`.
   */
  goalsReached?: string[];
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
  /** `startRouteOf(snapshot.placements, catalog, isEntitled)` (R-7a): the route with no completions; null without a placement. */
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
  /**
   * The goal sources (Learning Route amendment section 4.4): `sourcesOf(inboxPlans,
   * snapshot.selfRoute)` with `meta ?? null`. Absent means none, so the goal is
   * the default rule's (section 4.1 rule 4).
   */
  sources?: readonly GoalSource[];
  /**
   * The plan day the goal is picked on; absent means the UTC day of `now`, the
   * day the plan derivation and `routeGoalSummaryOf` use (LR-OD-12).
   */
  today?: DateKey;
  /**
   * F-ENT-003's one next (`routeNext(input)`), computed by the screen from the
   * same input Home and Results build. Absent (the sync summary, the Home strip
   * until LR-5a) means the catalogue cursor with source `cursor`.
   */
  routeNext?: RouteNext;
  /** F-ENT-003's `planView(input)`; absent means no "In your plan" cells. */
  planView?: PlanView;
  /**
   * F-ENT-003's quest access (`useQuestAccess()` on the screen). A quest that
   * is not open and not done or placed out is a `later` pip with
   * `laterReason: 'notOpen'`. Absent means every quest is open.
   */
  isQuestOpen?: (questId: string) => boolean;
}
