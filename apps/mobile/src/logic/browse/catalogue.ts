import type { HeritageCard, RuntimeVocabItem, StageKey, UiLocale, VocabTopic } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { gridEpisodes } from '../../content/episodes';
import { localizeStage, localizeTheme } from '../content-locale';
import { journeyGridRows, type JourneyCellView, type JourneyStageView } from '../journey-grid';
import { catalogueTrail } from '../my-route/catalogue-trail';
import type { TrailRowView } from '../my-route/view';
import { appRouteCatalog } from '../placement/route-skip';
import { LIBRARY_SECTIONS } from '../story/library-sections';
import { shelfEntries, type ShelfCategory, type StoryIndexEntry } from '../story/story-index';
import { itemAccess, type FreeQuestOpen } from './access';
import type { BrowseBundle } from './bundle';

/**
 * The All lessons home (F-BROWSE-001 section 4.5) as plain data: the
 * learner's own Learning Route trail, Journey grid and Library groups, in the
 * learner's order and in the browse state. Nothing done, no stars, no Next
 * marker, no "In your plan"; closed only for a sampler pass with the switch
 * on (section 4.2). Pure: the bundle comes in, nothing is read from a store.
 */

export type BrowseSection = 'route' | 'journey' | 'library';

/** The learner's order; Route only while the learner Route tab is on (`flags.myRouteEnabled`). */
export function browseSections(myRouteEnabled: boolean): BrowseSection[] {
  return myRouteEnabled ? ['route', 'journey', 'library'] : ['journey', 'library'];
}

export function defaultBrowseSection(myRouteEnabled: boolean): BrowseSection {
  return browseSections(myRouteEnabled)[0] as BrowseSection;
}

export type BrowseCellState = 'open' | 'closed' | 'later';

export type BrowseCellView = Omit<JourneyCellView, 'state'> & { state: BrowseCellState };

export type BrowseStageView = Omit<JourneyStageView, 'cells'> & { cells: BrowseCellView[] };

export interface BrowseJourneyInput {
  bundle: BrowseBundle;
  scope: 'full' | 'sampler';
  gatingEnabled: boolean;
  /** Test seam for the sampler quest rule (default: the learner's, `access.ts`). */
  freeQuestOpen?: FreeQuestOpen;
  /** Two panes (F-LAYOUT-001 section 3.7), as the learner Journey. */
  paneMode?: boolean;
  selectedId?: string | null;
}

/** The learner Journey grid with no learner marks; an open cell whose episode the pass cannot open is `closed`. */
export function browseJourneyRows(i: BrowseJourneyInput): BrowseStageView[] {
  const rows = journeyGridRows({
    stages: i.bundle.stages,
    themes: i.bundle.themes,
    gridEpisodes: gridEpisodes(i.bundle.episodes),
    paneMode: i.paneMode ?? false,
    selectedId: i.selectedId ?? null,
  });
  return rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell) => {
      if (cell.state === 'later' || cell.episodeId === null) return cell;
      const access = itemAccess({ kind: 'episode', id: cell.episodeId }, i.scope, i.gatingEnabled, {
        bundle: i.bundle,
        ...(i.freeQuestOpen ? { freeQuestOpen: i.freeQuestOpen } : {}),
      });
      return access === 'closed' ? { ...cell, state: 'closed' as const } : cell;
    }),
  }));
}

/** The Learning Route trail in its no-progress state (the learner's `TrailRow` rows), in the UI language. */
export function browseRouteTrail(i: { bundle: BrowseBundle; messages: Messages; locale: UiLocale }): TrailRowView[] {
  return catalogueTrail({
    episodes: i.bundle.episodes,
    quests: i.bundle.quests,
    catalog: appRouteCatalog(i.bundle.quests, i.bundle.episodes),
    stages: i.bundle.stages.map((s) => localizeStage(s, i.locale)),
    themes: i.bundle.themes.map((t) => localizeTheme(t, i.locale)),
    messages: i.messages,
  });
}

export interface StageOneLiner {
  stage: StageKey;
  order: number;
  title: string;
  oneLiner: string;
}

/** The collapsed "7 stages" line's expansion (Journey section without the Route section). */
export function stageOneLiners(bundle: Pick<BrowseBundle, 'stages'>, locale: UiLocale): StageOneLiner[] {
  return bundle.stages.map((s) => {
    const local = localizeStage(s, locale);
    return { stage: s.key, order: s.order, title: local.titleEn, oneLiner: local.oneLinerEn };
  });
}

export interface BrowseStoryGroup {
  section: ShelfCategory;
  entries: StoryIndexEntry[];
}

export interface BrowseWordRow {
  topic: VocabTopic;
  count: number;
  /** The first three words, shown with romanization and gloss. */
  samples: RuntimeVocabItem[];
}

export interface BrowseLibrary {
  stories: BrowseStoryGroup[];
  words: BrowseWordRow[];
  cards: HeritageCard[];
}

const STORY_SECTIONS: readonly ShelfCategory[] = LIBRARY_SECTIONS.flatMap((s) => (s.id === 'story-time' || s.id === 'culture' ? [s.id] : []));

/**
 * The Library groups: Stories (shelf entries of the reviewed index, grouped
 * and ordered as the learner Library's sections), Words (one row per topic),
 * Cards (every card, face up). An empty story group is left out; the screen
 * shows "Coming later" for an empty group.
 */
export function browseLibrary(bundle: BrowseBundle): BrowseLibrary {
  return {
    stories: STORY_SECTIONS.map((section) => ({ section, entries: shelfEntries(bundle.storyIndex, section) })).filter((g) => g.entries.length > 0),
    words: bundle.vocabTopics.map((topic) => {
      const items = bundle.topicItems(topic.key);
      return { topic, count: items.length, samples: items.slice(0, 3) };
    }),
    cards: [...bundle.cards],
  };
}
