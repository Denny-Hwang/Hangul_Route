import type { HeritageCard, RuntimeVocabItem, StageKey, UiLocale, VocabTopic } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { gridEpisodes } from '../../content/episodes';
import { localizeStage, localizeTheme } from '../content-locale';
import { journeyGridRows, type JourneyCellView, type JourneyStageView } from '../journey-grid';
import { catalogueTrail } from '../my-route/catalogue-trail';
import type { TrailRowView } from '../my-route/view';
import { appRouteCatalog } from '../placement/route-skip';
import { LIBRARY_SECTIONS, type LibrarySectionId } from '../story/library-sections';
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
  /** Test seam for the sampler lesson rule (default: F-ENT-003's `browseQuestOpen`, `access.ts`). */
  freeQuestOpen?: FreeQuestOpen;
  /** Two panes (F-LAYOUT-001 section 3.7), as the learner Journey. */
  paneMode?: boolean;
  selectedId?: string | null;
}

/**
 * The learner Journey grid with no learner marks. An open cell follows its
 * episode's access: `closed` when the pass cannot open it, `later` when the
 * episode has no quest left in this bundle (the outline reads "Coming later"
 * too), drawn as the learner Journey draws a later cell.
 */
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
      if (access === 'closed') return { ...cell, state: 'closed' as const };
      // One pane: a later cell does nothing; two panes: it is selectable (the learner rule, `journeyCell`).
      if (access === 'later') return { ...cell, state: 'later' as const, disabled: !(i.paneMode ?? false) };
      return cell;
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

export interface BrowseWordRow {
  topic: VocabTopic;
  count: number;
  /** The first three words, shown with romanization and gloss. */
  samples: RuntimeVocabItem[];
}

/** One Library group: the learner section it stands in for, and what it lists. */
export type BrowseLibraryGroup =
  | { section: 'cards'; cards: HeritageCard[] }
  | { section: ShelfCategory; entries: StoryIndexEntry[] }
  | { section: 'words'; rows: BrowseWordRow[] };

/** A learner Library section as All lessons shows it, or `null` when this bundle has nothing for it. */
function groupFor(section: LibrarySectionId, bundle: BrowseBundle): BrowseLibraryGroup | null {
  switch (section) {
    case 'cards':
      return { section, cards: [...bundle.cards] };
    case 'story-time':
    case 'culture': {
      const entries = shelfEntries(bundle.storyIndex, section);
      return entries.length > 0 ? { section, entries } : null;
    }
    case 'theme-packs': {
      // The slot F-VOC-003 registers as "Words" (its T1).
      const rows = bundle.vocabTopics.map((topic) => {
        const items = bundle.topicItems(topic.key);
        return { topic, count: items.length, samples: items.slice(0, 3) };
      });
      return rows.length > 0 ? { section: 'words', rows } : null;
    }
  }
}

/**
 * The Library groups in the learner Library's own order (the
 * `LIBRARY_SECTIONS` registry): Cards (every card, face up), Story Time and
 * Culture (the shelf entries of the reviewed index, in shelf order), then
 * Words (one row per topic) in the slot F-VOC-003 registers. A group with
 * nothing in this build is left out, as the learner Library leaves out its
 * tab; Cards always stays. The learner Culture tab can also hold only a
 * learner's found culture notes: that is learner state, so it is not a group
 * here.
 */
export function browseLibrary(bundle: BrowseBundle): BrowseLibraryGroup[] {
  return LIBRARY_SECTIONS.flatMap((s) => {
    const group = groupFor(s.id, bundle);
    return group ? [group] : [];
  });
}
