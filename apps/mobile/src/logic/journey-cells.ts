import type { Episode, QuestProgress, StageDef, StageKey, ThemeDef, ThemeKey } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { episodesFor } from '../content/episodes';
import { isCellComplete } from './journey';
import type { JourneyCellMarks } from './journey-grid';
import { entriesForCell, type StoryIndexEntry } from './story/story-index';

/**
 * One Journey cell as the map draws it (F-STORY-005 §3.5, wireframe `journey/grid-with-stories.md` A).
 * Pure. With no reviewed story in the bundle every cell keeps today's kinds (`lesson` or
 * `placeholder`), so the map ships dark.
 *
 *  - `lesson`: a shipped or ready grid episode that is not a story book;
 *  - `book`: a shipped or ready grid episode with `format: 'story'` (a Stage 5 book, F-STORY-005 §3.2);
 *  - `stories-only`: no playable grid episode, and at least one heritage story calls the cell home;
 *  - `placeholder`: neither ("coming soon").
 */
export type CellKind = 'lesson' | 'book' | 'stories-only' | 'placeholder';

export interface CellModel {
  stage: StageKey;
  theme: ThemeKey;
  kind: CellKind;
  /** The lesson or book to open; absent for stories-only and placeholder cells. */
  episodeId?: string;
  /** Every grid episode of the cell is complete; never for a stories-only or placeholder cell. */
  completed: boolean;
  /** Playable shelf stories whose home cell is this cell (the story index's review gate applied). */
  storyCount: number;
  /** For the screen-reader label only; never shown as a fraction. */
  storiesFinished: number;
}

export interface CellModelInput {
  stage: StageKey;
  theme: ThemeKey;
  /** Episodes to find the cell's grid episodes in (shelf episodes are skipped). */
  episodes: readonly Episode[];
  /** The story index (`defaultStoryIndex`); its review gate decides which stories count. */
  storyEntries: readonly StoryIndexEntry[];
  quests: readonly Pick<QuestProgress, 'questId' | 'episodeId' | 'completedAt'>[];
}

function isPlayable(episode: Pick<Episode, 'status'>): boolean {
  return episode.status === 'shipped' || episode.status === 'ready';
}

export function cellModel(i: CellModelInput): CellModel {
  const inCell = episodesFor(i.stage, i.theme, i.episodes);
  const playable = inCell.filter(isPlayable);
  const first = playable[0];
  const stories = entriesForCell(i.storyEntries, i.stage, i.theme);
  const finishedIds = new Set(i.quests.filter((q) => q.completedAt).map((q) => q.questId));
  const storyCount = stories.length;
  const storiesFinished = stories.filter((e) => finishedIds.has(e.questId)).length;
  const base = { stage: i.stage, theme: i.theme, storyCount, storiesFinished };
  if (first) {
    return {
      ...base,
      kind: first.format === 'story' ? 'book' : 'lesson',
      episodeId: first.id,
      completed: isCellComplete(playable, i.quests),
    };
  }
  return { ...base, kind: storyCount > 0 ? 'stories-only' : 'placeholder', completed: false };
}

/** The count mark shows the number up to this, then "5+" (F-STORY-005 §3.6). */
export const COUNT_MARK_MAX = 5;

/** What the cell's count mark shows; null draws no mark. */
export function countMarkOf(storyCount: number): { value: number; more: boolean } | null {
  if (storyCount <= 0) return null;
  return storyCount > COUNT_MARK_MAX ? { value: COUNT_MARK_MAX, more: true } : { value: storyCount, more: false };
}

/**
 * The cell's whole screen-reader sentence (F-STORY-005 §3.12, audit I18N-08: one message, no suffix
 * concatenation): "Stage 2 Words, Food & Daily Life: lesson, 1 heritage story". The stage and theme
 * arrive in the UI locale; the level-check marks (F-PLC-001 section 3.7) end it.
 */
export function cellLabel(
  m: CellModel,
  stage: Pick<StageDef, 'order' | 'titleEn'>,
  theme: Pick<ThemeDef, 'titleEn'>,
  label: Messages['a11y']['journeyCell'],
  marks: Pick<JourneyCellMarks, 'isStart' | 'placedOut'>,
): string {
  return label({
    stage: stage.order,
    stageTitle: stage.titleEn,
    themeTitle: theme.titleEn,
    kind: m.kind,
    complete: m.completed,
    stories: m.storyCount,
    finished: m.storiesFinished,
    start: marks.isStart,
    placedOut: marks.placedOut,
  });
}
