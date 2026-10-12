import type { Episode, QuestProgress, RouteCatalog, StageDef, StageKey, ThemeDef, ThemeKey } from '@hangul-route/content-schema';
import { episodeFor } from '../content/episodes';
import { isEpisodeComplete, stageAvailability, type StageAvailability } from './journey';
import { cellModel, isPlayable, type CellModel } from './journey-cells';
import { cellLook, type JourneyMarks } from './placement/cell-look';
import type { StoryIndexEntry } from './story/story-index';

/**
 * The Journey grid as plain data (wireframe journey/grid; F-BROWSE-001 BR-5b). `JourneyGrid` draws it
 * for the learner Journey and for All lessons. What a learner has done arrives through `marksOf`; with
 * no marks every cell is drawn as a learner with nothing done sees it (no tint, no outline, no pin).
 *
 * F-ENT-003's closed cell (its lock glyph and "opens with the full route" label, E3-4/E3-5) joins
 * `JourneyCellState` when that glyph ships; until then no closed cell can exist.
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
  /** What the cell holds and its heritage stories (F-STORY-005 §3.5): its look and its label. */
  model: CellModel;
}

export interface JourneyStageView {
  stage: StageKey;
  availability: StageAvailability;
  cells: JourneyCellView[];
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
  return stages.map((stage) => ({
    stage: stage.key,
    availability: stageAvailability(stage.key, i.gridEpisodes),
    cells: themes.map((theme) => journeyCell({ ...cell, stage: stage.key, theme: theme.key })),
  }));
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
