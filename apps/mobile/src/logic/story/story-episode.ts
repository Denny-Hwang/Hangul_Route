import type { Episode, HeritageCard, ProgressSnapshot, SceneArt, ThemeKey } from '@hangul-route/content-schema';
import { romanizationShown, type Messages, type RomanizationMode } from '@hangul-route/i18n';
import type { PlaySpec } from '../audio/controller';
import type { BookmarkFile } from './bookmarks';
import { notesForStory, type FoundNote } from './culture-notes';
import type { OpenStoryMode } from './open-story';
import { recapWords, type RecapWord } from './recap';
import { storyCoverArt } from './scene-view';
import type { StoryShelfCopy } from './shelf-copy';
import type { StoryIndexEntry } from './story-index';
import { storyStatus, type StoryStatus } from './story-status';

/**
 * The story variant of the episode page (F-STORY-004 §3.6; wireframe
 * design/wireframes/episode/detail-story.md E, brief
 * design/brief/screens/25-story-episode-detail.md). One view model serves a
 * shelf episode (one story) and a book episode (several stories, F-STORY-005).
 * Pure: `StoryEpisodeDetail` paints what this returns and runs each action
 * through `planOpenStory`. Only one button on the page is large: the first
 * row that is new or in progress; everything else is secondary or ghost.
 */

/** `playPrompt` surface id of the page's word speakers (telemetry). */
export const STORY_EPISODE_AUDIO_SOURCE = 'story-episode';

type EpisodeLike = Pick<Episode, 'id' | 'status' | 'questIds'> & { format?: Episode['format'] };

/**
 * The index entries of a story episode page, one per quest in the episode's
 * quest order, or null when the page is not the story variant: not a story
 * episode, a preview (the coming-soon card stays), or a quest whose story is
 * not in the index (missing from the bundle, or unreviewed in production):
 * the existing quest list renders then.
 */
export function storyEpisodeEntries(episode: EpisodeLike, index: readonly StoryIndexEntry[]): StoryIndexEntry[] | null {
  if (episode.format !== 'story' || episode.status === 'preview' || episode.questIds.length === 0) return null;
  const entries: StoryIndexEntry[] = [];
  for (const questId of episode.questIds) {
    const entry = index.find((e) => e.questId === questId && e.episodeId === episode.id);
    if (!entry) return null;
    entries.push(entry);
  }
  return entries;
}

export type TaleActionTone = 'primary' | 'secondary' | 'ghost';

export interface TaleRowAction {
  /** Passed to `planOpenStory` (`source: 'episode'`). */
  mode: OpenStoryMode;
  label: string;
  tone: TaleActionTone;
  /** `hero` only for the page's one primary button. */
  size: 'hero' | 'md';
  /** The button read out with its story: "Start: <title>". */
  accessibilityLabel: string;
}

export interface TaleRowView {
  entry: StoryIndexEntry;
  status: StoryStatus;
  titleEn: string;
  ko: string;
  romanization: string;
  theme: ThemeKey;
  /** The cover scene's art for the thumbnail; null draws the theme tint with the Korean title. */
  cover: SceneArt | null;
  /** Always words (colour is never the only cue). */
  stateLine: string;
  /** 0 draws no `StarRow` (D3). */
  stars: 0 | 1 | 2 | 3;
  /** The main action first. */
  actions: TaleRowAction[];
}

export interface StoryEpisodeView {
  placement: 'shelf' | 'book';
  /** Category (Story Time / Culture) or, for a book, the stage title; the theme; "N min". No stage pill on a shelf story. */
  pills: [string, string, string];
  /** A shelf page uses its story's title; a book its episode title (no Korean line). */
  title: { en: string; ko: string | null; romanization: string | null };
  rows: TaleRowView[];
  /** The one story of a single-story page (words, culture notes, Sources); null for a book. */
  storyId: string | null;
  /** "Words in this story" (single-story pages only): the recap words of the story's level. */
  words: RecapWord[];
  /** "Culture notes: N found", or null when none of this story's notes is found (and on a book). */
  notesLine: string | null;
}

export interface StoryEpisodeViewInput {
  episode: Pick<Episode, 'titleEn'>;
  /** From `storyEpisodeEntries`, with each story localised by the caller. */
  entries: readonly StoryIndexEntry[];
  snapshot: Pick<ProgressSnapshot, 'quests'> | undefined;
  bookmarks: BookmarkFile;
  /** `foundNotes(...)` of the learner. */
  notes: readonly FoundNote[];
  copy: StoryShelfCopy;
  /** The episode's stage title in the UI language (a book's first pill). */
  stageTitle: string;
  themeTitle: string;
}

function rowActions(status: StoryStatus, isPrimary: boolean, title: string, copy: StoryShelfCopy): TaleRowAction[] {
  const action = (mode: OpenStoryMode, label: string, tone: TaleActionTone, size: 'hero' | 'md' = 'md'): TaleRowAction => ({
    mode,
    label,
    tone,
    size,
    accessibilityLabel: copy.episode.rowLabel(label, title),
  });
  const main = (mode: OpenStoryMode, label: string): TaleRowAction =>
    isPrimary ? action(mode, label, 'primary', 'hero') : action(mode, label, 'secondary');
  switch (status.state) {
    case 'finished':
      // Play again is scored like any quest replay; Read it again is the unscored reader.
      return [action('play-again', copy.playAgain.cta, 'secondary'), action('read-again', copy.readAgain.cta, 'ghost')];
    case 'in-progress':
      return [main('continue', copy.keepReading.cta), action('restart', copy.startOver.cta, 'ghost')];
    case 'new':
      return [main('start', copy.start.cta)];
  }
}

function stateLineOf(status: StoryStatus, copy: StoryShelfCopy): string {
  if (status.state === 'finished') return copy.state.finished;
  return status.state === 'in-progress' ? copy.state.inProgress : copy.state.new;
}

export function storyEpisodeView(input: StoryEpisodeViewInput): StoryEpisodeView {
  const { entries, snapshot, bookmarks, notes, copy } = input;
  let primaryTaken = false;
  const rows = entries.map((entry): TaleRowView => {
    const status = storyStatus(entry, snapshot, bookmarks);
    const isPrimary = !primaryTaken && status.state !== 'finished';
    if (isPrimary) primaryTaken = true;
    const title = entry.story.title;
    return {
      entry,
      status,
      titleEn: title.en,
      ko: title.ko,
      romanization: title.romanization,
      theme: entry.theme,
      cover: storyCoverArt(entry.story),
      stateLine: stateLineOf(status, copy),
      stars: status.state === 'finished' ? status.stars : 0,
      actions: rowActions(status, isPrimary, title.en, copy),
    };
  });

  const single = entries.length === 1 && entries[0]?.placement === 'shelf' ? entries[0] : undefined;
  const minutes = entries.reduce((sum, e) => sum + e.minutes, 0);
  const group = single?.category ? copy.sections[single.category] : input.stageTitle;
  const found = single ? notesForStory(notes, single.storyId).length : 0;
  return {
    placement: single ? 'shelf' : 'book',
    pills: [group, input.themeTitle, copy.episode.minutes.pill(minutes)],
    title: single
      ? { en: single.story.title.en, ko: single.story.title.ko, romanization: single.story.title.romanization }
      : { en: input.episode.titleEn, ko: null, romanization: null },
    rows,
    storyId: single?.storyId ?? null,
    words: single ? recapWords(single.story, single.level) : [],
    notesLine: found > 0 ? copy.episode.cultureNotes(found) : null,
  };
}

export type KoreanItemLabel = Messages['a11y']['koreanItem'];

export interface EpisodeWordChip {
  id: string;
  ko: string;
  /** '' draws no romanization line (hidden until the word is heard, D2). */
  romanization: string;
  gloss: string;
  hearLabel: string;
  /** Always says the romanization: a screen reader cannot "peek". */
  accessibilityLabel: string;
}

/** One "Words in this story" chip: Korean, romanization (D2), the gloss and its speaker's name. */
export function episodeWordChip(
  word: RecapWord,
  ctx: { romanizationMode: RomanizationMode; revealed: ReadonlySet<string> },
  copy: StoryShelfCopy,
  koreanItem: KoreanItemLabel,
): EpisodeWordChip {
  const shown = romanizationShown(ctx.romanizationMode, ctx.revealed.has(word.id));
  return {
    id: word.id,
    ko: word.ko,
    romanization: shown ? word.romanization : '',
    gloss: word.en,
    hearLabel: copy.episode.hearWord(word.romanization),
    accessibilityLabel: koreanItem({ ko: word.ko, romanization: word.romanization, gloss: word.en }),
  };
}

/** What a word chip's speaker plays: the word's clip when it has one, else Korean speech (its `spokenKo` when authored). */
export function episodeWordSpeech(word: RecapWord): PlaySpec {
  const spec: PlaySpec = { text: word.spokenKo ?? word.ko, language: 'ko-KR', kind: 'word', source: STORY_EPISODE_AUDIO_SOURCE };
  if (word.audioRef) spec.audioRef = word.audioRef;
  return spec;
}

export type EpisodeRewardCard =
  | { cardId: string; earned: true; card: HeritageCard }
  | { cardId: string; earned: false; rarity: HeritageCard['rarity'] };

/**
 * "Cards in this episode": an earned card carries the card (art, title,
 * Korean); one not earned yet only its rarity, for the silhouette's border, so
 * nothing about it is given away. Ids the bundle does not have are skipped.
 */
export function episodeRewardCards(
  cardIds: readonly string[],
  unlocked: ReadonlySet<string>,
  lookup: (id: string) => HeritageCard | undefined,
): EpisodeRewardCard[] {
  return cardIds.flatMap((cardId): EpisodeRewardCard[] => {
    const card = lookup(cardId);
    if (!card) return [];
    return [unlocked.has(cardId) ? { cardId, earned: true, card } : { cardId, earned: false, rarity: card.rarity }];
  });
}
