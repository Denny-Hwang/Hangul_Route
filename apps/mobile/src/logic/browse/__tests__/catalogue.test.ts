import type { Episode } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { flags } from '../../../config/flags';
import { localizeStage } from '../../content-locale';
import { NO_CELL_MARKS } from '../../journey-grid';
import type { StageRowView } from '../../my-route/view';
import { playableEpisodes } from '../../next-quest';
import { LIBRARY_SECTIONS, visibleSections } from '../../story/library-sections';
import { isOpenableEpisode, type BrowseBundle } from '../bundle';
import { browseJourneyRows, browseLibrary, browseRouteTrail, browseSections, defaultBrowseSection, stageOneLiners, type BrowseLibraryGroup } from '../catalogue';
import { episodeOutline } from '../facts';
import { CULTURE_ID, DRAFT_ID, TALE_ID, fixtureBundle, fixtureStories } from './browse-fixture';

/**
 * F-BROWSE-001 §4.5 (BR-4): the catalogue around the lessons, in the
 * learner's own shapes and order, in the browse state: nothing done, no
 * marks, closed only for a sampler pass with the switch on.
 */
const bundle = fixtureBundle();
const EN = getMessages('en');

describe('browseSections', () => {
  it('Route · Journey · Library in the learner order, Route only with the learner Route tab', () => {
    expect(browseSections(true)).toEqual(['route', 'journey', 'library']);
    expect(defaultBrowseSection(true)).toBe('route');
    expect(browseSections(false)).toEqual(['journey', 'library']);
    expect(defaultBrowseSection(false)).toBe('journey');
  });
});

describe('browseJourneyRows', () => {
  const rows = browseJourneyRows({ bundle, scope: 'full', gatingEnabled: false });
  const cellOf = (r: ReturnType<typeof browseJourneyRows>, key: string) => r.flatMap((x) => x.cells).find((c) => c.key === key);

  it('seven stage rows of five cells, in stage and theme order, with no learner marks', () => {
    expect(rows.map((r) => r.stage)).toEqual(bundle.stages.map((s) => s.key));
    for (const row of rows) {
      expect(row.cells.map((c) => c.theme)).toEqual(bundle.themes.map((t) => t.key));
      for (const cell of row.cells) expect(cell.marks).toEqual(NO_CELL_MARKS);
    }
  });

  it('every shipped grid episode is reachable through an open cell; placeholders are later', () => {
    const open = rows.flatMap((r) => r.cells.filter((c) => c.state === 'open').map((c) => c.episodeId));
    expect(new Set(open)).toEqual(new Set(playableEpisodes(bundle.episodes).map((e) => e.id)));
    const later = rows.flatMap((r) => r.cells.filter((c) => c.state === 'later'));
    expect(later.length).toBeGreaterThan(0);
    for (const cell of later) {
      const episode = bundle.episodes.find((e) => e.id === cell.episodeId);
      expect(episode === undefined || episode.status === 'preview', cell.key).toBe(true);
    }
  });

  it('sampler with the switch off and full draw the same grid', () => {
    expect(browseJourneyRows({ bundle, scope: 'sampler', gatingEnabled: false })).toEqual(rows);
  });

  it('a closed episode is drawn closed only for a sampler pass with the switch on', () => {
    const life = bundle.episodes.find((e) => e.id === 'episode:stage1-life')?.questIds ?? [];
    const lettersOnly = (questId: string): boolean => !life.includes(questId);
    const sampler = browseJourneyRows({ bundle, scope: 'sampler', gatingEnabled: true, freeQuestOpen: lettersOnly });
    expect(cellOf(sampler, 'stage1-life')?.state).toBe('closed');
    expect(cellOf(sampler, 'stage1-letters')?.state).toBe('open');
    const placeholder = rows.flatMap((r) => r.cells).find((c) => c.state === 'later');
    expect(cellOf(sampler, placeholder?.key ?? '')?.state).toBe('later');
    expect(cellOf(browseJourneyRows({ bundle, scope: 'full', gatingEnabled: true, freeQuestOpen: lettersOnly }), 'stage1-life')?.state).toBe('open');
    expect(cellOf(browseJourneyRows({ bundle, scope: 'sampler', gatingEnabled: false, freeQuestOpen: lettersOnly }), 'stage1-life')?.state).toBe('open');
    // the learner rule by default: a free learner's lessons are all of Stage 1 (F-ENT-003 OD-1)
    const learner = browseJourneyRows({ bundle, scope: 'sampler', gatingEnabled: true });
    const open = rows.flatMap((r) => r.cells).filter((c) => c.state === 'open');
    expect(open.some((c) => c.stage !== 'stage1')).toBe(true);
    for (const cell of open) expect(cellOf(learner, cell.key)?.state, cell.key).toBe(cell.stage === 'stage1' ? 'open' : 'closed');
  });

  it('an openable episode with no quest left in this bundle is drawn later, as its outline reads "Coming later"', () => {
    const first = rows.flatMap((r) => r.cells).find((c) => c.state === 'open');
    const episode = bundle.episodes.find((e) => e.id === first?.episodeId) as Episode;
    const emptied: BrowseBundle = { ...bundle, quests: bundle.quests.filter((q) => !episode.questIds.includes(q.id)) };
    expect(isOpenableEpisode(episode)).toBe(true);
    expect(episodeOutline(episode.id, emptied)?.comingLater).toBe(true);
    for (const scope of ['full', 'sampler'] as const) {
      for (const gatingEnabled of [false, true]) {
        // one pane: a later cell does nothing, exactly as the learner Journey's
        expect(cellOf(browseJourneyRows({ bundle: emptied, scope, gatingEnabled }), first?.key ?? ''), `${scope} ${gatingEnabled}`).toMatchObject({ state: 'later', disabled: true });
      }
    }
    // two panes: it can be selected, and its page says "Coming later"
    expect(cellOf(browseJourneyRows({ bundle: emptied, scope: 'full', gatingEnabled: false, paneMode: true }), first?.key ?? '')).toMatchObject({ state: 'later', disabled: false });
  });

  it('two panes: a selected cell and selectable later cells, as the learner Journey does', () => {
    const panes = browseJourneyRows({ bundle, scope: 'full', gatingEnabled: false, paneMode: true, selectedId: 'episode:stage1-letters' });
    const cells = panes.flatMap((r) => r.cells);
    expect(cells.find((c) => c.key === 'stage1-letters')?.selected).toBe(true);
    expect(cells.filter((c) => c.selected)).toHaveLength(1);
    expect(cells.some((c) => c.state === 'later' && !c.disabled)).toBe(true);
  });
});

describe('browseRouteTrail', () => {
  it('the learner trail with no progress: every stage, one-liners, no here tag, no fill', () => {
    const rows = browseRouteTrail({ bundle, messages: EN, locale: 'en' });
    const covered = rows.flatMap((r) => (r.kind === 'stage' ? [r.order] : r.details.map((d) => d.order)));
    expect(covered).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const stagesShown = rows.filter((r): r is StageRowView => r.kind === 'stage');
    expect(stagesShown.length).toBeGreaterThan(0);
    for (const row of stagesShown) {
      expect(row.tags).toEqual([]);
      expect(row.fill).toBeNull();
      expect(row.captions).toEqual([bundle.stages.find((s) => s.key === row.stage)?.oneLinerEn]);
      for (const cell of row.cells) expect(cell.pips.every((p) => p.state !== 'done' && !p.isCursor && !p.isStart)).toBe(true);
    }
  });

  it('one-liners follow the UI language', () => {
    const rows = browseRouteTrail({ bundle, messages: getMessages('es'), locale: 'es' });
    const first = rows.find((r): r is StageRowView => r.kind === 'stage') as StageRowView;
    const stage = bundle.stages.find((s) => s.key === first.stage);
    expect(first.captions).toEqual([stage ? localizeStage(stage, 'es').oneLinerEn : undefined]);
  });
});

describe('stageOneLiners', () => {
  it('the seven stages in order with their one-liners, in the UI language', () => {
    const lines = stageOneLiners(bundle, 'en');
    expect(lines.map((l) => l.stage)).toEqual(bundle.stages.map((s) => s.key));
    expect(lines[0]).toEqual({ stage: bundle.stages[0]?.key, order: 1, title: bundle.stages[0]?.titleEn, oneLiner: bundle.stages[0]?.oneLinerEn });
    const es = stageOneLiners(bundle, 'es');
    expect(es[0]?.oneLiner).toBe(localizeStage(bundle.stages[0] as (typeof bundle.stages)[number], 'es').oneLinerEn);
  });
});

describe('browseLibrary', () => {
  const library = browseLibrary(bundle);
  type GroupOf<S> = S extends 'cards'
    ? Extract<BrowseLibraryGroup, { cards: unknown }>
    : S extends 'words'
      ? Extract<BrowseLibraryGroup, { rows: unknown }>
      : Extract<BrowseLibraryGroup, { entries: unknown }>;
  const group = <S extends BrowseLibraryGroup['section']>(groups: BrowseLibraryGroup[], section: S) => groups.find((g) => g.section === section) as GroupOf<S> | undefined;

  it('groups in the learner Library registry order: Cards, Story Time, Culture, then Words in the slot F-VOC-003 registers', () => {
    expect(library.map((g) => g.section)).toEqual(['cards', 'story-time', 'culture', 'words']);
    // the learner tab order, Words standing in for the reserved `theme-packs` ("Words") slot
    const learnerOrder = LIBRARY_SECTIONS.map((s) => (s.id === 'theme-packs' ? 'words' : s.id));
    const sections = library.map((g) => g.section as string);
    expect(sections).toEqual(learnerOrder.filter((id) => sections.includes(id)));
    // every story group is one the learner Library offers for the same index
    const learner = visibleSections({ entries: bundle.storyIndex });
    for (const section of sections.filter((s) => s === 'story-time' || s === 'culture')) expect(learner).toContain(section);
  });

  it('story groups: the shelf entries of the reviewed index, in shelf order', () => {
    expect(group(library, 'story-time')?.entries.map((e) => e.storyId)).toEqual([TALE_ID]);
    expect(group(library, 'culture')?.entries.map((e) => e.storyId)).toEqual([CULTURE_ID]);
    const stories = library.flatMap((g) => (g.section === 'story-time' || g.section === 'culture' ? g.entries : []));
    expect(stories.some((e) => e.storyId === DRAFT_ID)).toBe(false);
  });

  it('the review gate holds even when the dev widening flag is on', () => {
    const before = flags.showUnreviewedStories;
    flags.showUnreviewedStories = true;
    try {
      expect(fixtureBundle().storyIndex.some((e) => e.storyId === DRAFT_ID)).toBe(false);
    } finally {
      flags.showUnreviewedStories = before;
    }
    expect(fixtureStories().map((s) => s.id)).toContain(DRAFT_ID);
  });

  it('a group with nothing in this build is left out, as the learner Library leaves out its tab; Cards always stays', () => {
    const onlyTale = fixtureBundle({ stories: fixtureStories().slice(0, 1) });
    expect(browseLibrary(onlyTale).map((g) => g.section)).toEqual(['cards', 'story-time', 'words']);
    const bare = fixtureBundle({ stories: [], vocabTopics: [] });
    expect(browseLibrary(bare).map((g) => g.section)).toEqual(['cards']);
  });

  it("a Culture tab that only holds a learner's found notes is not a group: notes are learner state", () => {
    const onlyTale = fixtureBundle({ stories: fixtureStories().slice(0, 1) });
    expect(onlyTale.storyIndex.some((e) => e.story.cultureNotes.length > 0)).toBe(true);
    expect(visibleSections({ entries: onlyTale.storyIndex })).toContain('culture');
    expect(group(browseLibrary(onlyTale), 'culture')).toBeUndefined();
  });

  it('words: one row per topic in topic order, with its word count and three sample words', () => {
    const rows = group(library, 'words')?.rows ?? [];
    expect(rows.map((w) => w.topic.id)).toEqual(bundle.vocabTopics.map((t) => t.id));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const items = bundle.topicItems(row.topic.key);
      expect(row.count).toBe(items.length);
      expect(row.samples).toEqual(items.slice(0, 3));
      for (const word of row.samples) {
        expect(word.romanization.length).toBeGreaterThan(0);
        expect(word.glosses.en.length).toBeGreaterThan(0);
      }
    }
  });

  it('cards: every heritage card, face up', () => {
    expect(group(library, 'cards')?.cards.map((c) => c.id)).toEqual(bundle.cards.map((c) => c.id));
  });
});
