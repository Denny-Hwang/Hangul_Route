import type { Episode, QuestProgress, RouteCatalog, StageDef, StageKey, ThemeDef, ThemeKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { episodeFor, episodesFor } from '../content/episodes';
import { isEpisodeComplete, stageAvailability, type StageAvailability } from './journey';
import { cellModel, isPlayable, type CellModel } from './journey-cells';
import { cellLook, type JourneyMarks } from './placement/cell-look';
import type { StoryIndexEntry } from './story/story-index';

/**
 * The Journey grid as plain data (wireframe journey/grid; F-BROWSE-001 BR-5b). `JourneyGrid` draws it
 * for the learner Journey and for All lessons. What a learner has done arrives through `marksOf`; with
 * no marks every cell is drawn as a learner with nothing done sees it (no tint, no outline, no pin).
 *
 * F-ENT-003's route marks (section 3.7, PR E3-5; design/components/RouteMarkers/spec.md) arrive through
 * `access`: Next, In your plan, and Not open yet for a closed lesson. A closed lesson is a mark from
 * `questAccess`, not a cell state: it keeps its art, its colour and its tap, draws the dotted ring and
 * never a lock glyph, and its label says "not open yet" (no "opens with the full route" wording).
 */

/** `open`: a playable (shipped or ready) episode. `later`: no episode, or a draft or preview one ("coming soon"). */
export type JourneyCellState = 'open' | 'later';

/** One learner's look of a cell: the completed tint, the placed-out outline, the start pin. */
export interface JourneyCellMarks {
  completed: boolean;
  placedOut: boolean;
  isStart: boolean;
}

/** Nothing done: the All lessons grid, and a learner who has not played yet. */
export const NO_CELL_MARKS: JourneyCellMarks = Object.freeze({ completed: false, placedOut: false, isStart: false });

export type JourneyMarksOf = (stage: StageKey, theme: ThemeKey, episode: Episode | undefined) => JourneyCellMarks;

/** One learner's route marks on a cell (F-ENT-003 section 3.7). At most one of the two rings is true. */
export interface JourneyCellAccess {
  /** The cell holds `routeNext`'s quest: the Next triangle. */
  next: boolean;
  /** The cell holds an episode of `planView().inPlanEpisodeIds`: the solid ring. */
  inPlan: boolean;
  /** A playable cell whose every quest is closed for this learner: the dotted ring. Never with Next or In your plan. */
  notOpen: boolean;
}

/** No mark: All lessons, and a learner Journey without access input. */
export const NO_CELL_ACCESS: JourneyCellAccess = Object.freeze({ next: false, inPlan: false, notOpen: false });

/** What the learner Journey knows about the route (built from `routeNext`, `planView` and `useQuestAccess`). */
export interface JourneyAccessInput {
  /** The episode of `routeNext`'s quest; null at `rest` and `free-end`. */
  nextEpisodeId: string | null;
  /** `planView().inPlanEpisodeIds`; empty without a plan (no ring for the default route). */
  inPlanEpisodeIds: ReadonlySet<string>;
  /** May the learner start this quest: closed only for a free learner with the effective switch on. */
  isQuestOpen: (questId: string) => boolean;
}

export interface JourneyCellView {
  key: string;
  stage: StageKey;
  theme: ThemeKey;
  /** The cell's first grid episode (by volume), or null for an empty cell. */
  episodeId: string | null;
  state: JourneyCellState;
  /** Two panes only: this cell's episode is the one the right pane shows. */
  selected: boolean;
  /** Not a working button: an empty cell, or a later cell on one pane; a stories-only cell is always a button. */
  disabled: boolean;
  marks: JourneyCellMarks;
  /** The route marks (F-ENT-003 section 3.7); `NO_CELL_ACCESS` without access input. */
  access: JourneyCellAccess;
  /** What the cell holds and its heritage stories (F-STORY-005 §3.5): its look and its label. */
  model: CellModel;
}

export interface JourneyStageView {
  stage: StageKey;
  availability: StageAvailability;
  cells: JourneyCellView[];
  /**
   * A taste row's note shows (E3-D D11): only on a `taste` row with a playable cell holding a quest the
   * learner may start (open, or kept because it was finished), so it never contradicts the dotted rings.
   */
  tasteNote: boolean;
}

export function journeyCellState(episode: Pick<Episode, 'status'> | undefined): JourneyCellState {
  return episode && isPlayable(episode) ? 'open' : 'later';
}

export interface JourneyCellInput {
  stage: StageKey;
  theme: ThemeKey;
  /** Grid episodes only (`gridEpisodes`): a shelf episode is never a cell. */
  gridEpisodes: readonly Episode[];
  /** Two panes (F-LAYOUT-001 §3.7): a tap selects, and a preview cell can be selected too. */
  paneMode: boolean;
  selectedId: string | null;
  marksOf?: JourneyMarksOf;
  /** The story index (F-STORY-005 §3.6); omitted: no cell has stories (the map as before stories). */
  storyEntries?: readonly StoryIndexEntry[];
  /** The learner's quest progress, for the model's complete look and finished stories; omitted: nothing done. */
  quests?: readonly Pick<QuestProgress, 'questId' | 'episodeId' | 'completedAt'>[];
  /** The route marks' inputs (F-ENT-003 E3-5); omitted: no mark and every quest open. */
  access?: JourneyAccessInput;
}

/** The cell's playable episodes (every volume), the ones its marks read. */
function playableIn(stage: StageKey, theme: ThemeKey, gridEpisodes: readonly Episode[]): Episode[] {
  return episodesFor(stage, theme, gridEpisodes).filter(isPlayable);
}

/** Some quest of these episodes may be started (open or kept). */
function anyOpen(episodes: readonly Episode[], isQuestOpen: (questId: string) => boolean): boolean {
  return episodes.some((e) => e.questIds.some(isQuestOpen));
}

/** Precedence Next > In your plan > Not open yet (section 3.7): a closed cell is never Next or In your plan. */
function cellAccess(playable: readonly Episode[], access: JourneyAccessInput | undefined): JourneyCellAccess {
  if (!access || playable.length === 0) return NO_CELL_ACCESS;
  const next = playable.some((e) => e.id === access.nextEpisodeId);
  // Next and In your plan can share a cell; both are drawn.
  const inPlan = playable.some((e) => access.inPlanEpisodeIds.has(e.id));
  const notOpen = !next && !inPlan && playable.some((e) => e.questIds.length > 0) && !anyOpen(playable, access.isQuestOpen);
  return next || inPlan || notOpen ? { next, inPlan, notOpen } : NO_CELL_ACCESS;
}

export function journeyCell(i: JourneyCellInput): JourneyCellView {
  const episode = episodeFor(i.stage, i.theme, i.gridEpisodes);
  const state = journeyCellState(episode);
  const model = cellModel({
    stage: i.stage,
    theme: i.theme,
    episodes: i.gridEpisodes,
    storyEntries: i.storyEntries ?? [],
    quests: i.quests ?? [],
  });
  // A stories-only cell opens its cell page on one pane and on two (it has no detail view to select).
  const storiesOnly = model.kind === 'stories-only';
  return {
    key: `${i.stage}-${i.theme}`,
    stage: i.stage,
    theme: i.theme,
    episodeId: episode?.id ?? null,
    state,
    selected: i.paneMode && !storiesOnly && !!episode && episode.id === i.selectedId,
    // One pane: a later cell does nothing. Two panes: it is selectable (its page says "coming soon").
    disabled: !storiesOnly && (!episode || (state === 'later' && !i.paneMode)),
    marks: i.marksOf ? i.marksOf(i.stage, i.theme, episode) : NO_CELL_MARKS,
    // A coming-later cell (its first volume a draft or preview) is sunken and empty: no route mark ever (E3-D D5),
    // even when a later volume of it is playable.
    access: storiesOnly || state === 'later' ? NO_CELL_ACCESS : cellAccess(playableIn(i.stage, i.theme, i.gridEpisodes), i.access),
    model,
  };
}

export interface JourneyGridInput extends Omit<JourneyCellInput, 'stage' | 'theme'> {
  stages: readonly Pick<StageDef, 'key'>[];
  themes: readonly Pick<ThemeDef, 'key'>[];
}

/** One row per stage, in stage order; five cells per row, in theme order. */
export function journeyGridRows(i: JourneyGridInput): JourneyStageView[] {
  const { stages, themes, ...cell } = i;
  const isQuestOpen = i.access?.isQuestOpen ?? (() => true);
  return stages.map((stage) => {
    const availability = stageAvailability(stage.key, i.gridEpisodes);
    return {
      stage: stage.key,
      availability,
      cells: themes.map((theme) => journeyCell({ ...cell, stage: stage.key, theme: theme.key })),
      tasteNote: availability === 'taste' && themes.some((theme) => anyOpen(playableIn(stage.key, theme.key, i.gridEpisodes), isQuestOpen)),
    };
  });
}

/** The marks the grid draws now, in legend order (E3-D D4); empty: the legend line draws nothing. */
export function journeyLegend(rows: readonly JourneyStageView[]): Array<keyof JourneyCellAccess> {
  const cells = rows.flatMap((r) => r.cells);
  return (['next', 'inPlan', 'notOpen'] as const).filter((kind) => cells.some((c) => c.access[kind]));
}

/**
 * The cell label with the route words appended (section 3.14, `a11y.access`): "Next", "In your plan", or
 * for a closed cell "{title}: not open yet. Opens the lesson page." with the episode title in the UI locale.
 */
export function withAccessWords(label: string, access: JourneyCellAccess, title: string, words: Messages['a11y']['access']): string {
  const parts = [access.next ? `${words.next}.` : null, access.inPlan ? `${words.inPlan}.` : null, access.notOpen ? words.notOpen(title) : null].filter(
    (p): p is string => p !== null,
  );
  if (parts.length === 0) return label;
  return `${label}${label.endsWith('.') ? '' : '.'} ${parts.join(' ')}`;
}

/**
 * The level-check marks a cell's label reads (section 3.14, labels equal what is shown). A closed cell
 * drops the placed-out sentence, which ends "and it is still open to play", so a screen reader never
 * hears "still open to play" and "not open yet" on one cell; the start pin is always read.
 */
export function labelMarksOf(cell: Pick<JourneyCellView, 'marks' | 'access'>): JourneyCellMarks {
  return cell.access.notOpen && cell.marks.placedOut ? { ...cell.marks, placedOut: false } : cell.marks;
}

export interface LearnerMarksInput {
  /** The learner's quest progress. */
  quests: readonly Pick<QuestProgress, 'questId' | 'episodeId' | 'completedAt'>[];
  /** The level check's marks, or null without a stored result (F-PLC-001 §3.7). */
  marks: JourneyMarks | null;
  catalog: RouteCatalog;
  completedIds: ReadonlySet<string>;
}

/**
 * The learner Journey's marks: complete only when every quest of the episode is done; placed out
 * (wireframe placement I) when every quest is done or placed out and not all done, never on a
 * completed or preview cell; the start pin on the level check's start cell.
 */
export function learnerCellMarks(i: LearnerMarksInput): JourneyMarksOf {
  return (stage, theme, episode) => {
    const completed = !!episode && isEpisodeComplete(episode, i.quests);
    const placedOut =
      !!episode &&
      journeyCellState(episode) === 'open' &&
      !completed &&
      i.marks !== null &&
      cellLook(episode.id, i.catalog, i.marks.placedOut, i.completedIds) === 'placed-out';
    const start = i.marks === null ? null : i.marks.start;
    const isStart = start !== null && start.stage === stage && start.theme === theme;
    return completed || placedOut || isStart ? { completed, placedOut, isStart } : NO_CELL_MARKS;
  };
}
