import type { Episode, ProgressSnapshot, Quest, Story } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { questsAll } from '../../../content/quests';
import { storiesAll } from '../../../content/stories';
import { scanLearnerCopy } from '../banned-text';
import { emptyBookmarks, type BookmarkFile } from '../../story/bookmarks';
import { defaultStoryIndex, type StoryIndexEntry } from '../../story/story-index';
import {
  bookEpisode,
  bookmarks,
  questId,
  shelfEpisode,
  shelfIndex,
  story,
  storyQuest,
} from '../../story/__tests__/shelf-fixture';
import {
  buildTodaysMission,
  missionCardText,
  missionCopy,
  planHomeStoryOpen,
  storyCardOpenMode,
  storyCardShownEvent,
  type BuildMissionInput,
  type MissionCard,
  type MissionPlan,
} from '../mission-builder';

/**
 * The Home "Story time" card (F-STORY-004 §3.7, PR 4.4a): the slot chain
 * with stories, the `explore` fallback, pinning, the collected look and the
 * decision that a shelf quest is never a replay card.
 */

const learner = getMessages('en').learner;
const TODAY = '2026-05-20';
const YESTERDAY = '2026-05-19';
const LONG_AGO = '2026-04-01';

function quest(id: string, titleEn: string): Quest {
  return {
    id,
    titleEn,
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Hi' },
      { id: 's2', kind: 'practice', titleEn: 'Try' },
    ],
  };
}

function gridEpisode(id: string, questIds: string[]): Episode {
  return {
    id,
    stage: 'stage1',
    theme: 'letters',
    order: 1,
    titleEn: `Episode ${id}`,
    hoyaIntroEn: 'Hello!',
    questIds,
    rewardCardIds: [],
    estimatedMinutes: 10,
    status: 'shipped',
  };
}

/** A story quest as a full `Quest` (the builder takes full quests). */
function fullStoryQuest(slug: string, level: 'listen' | 'read-along' = 'listen'): Quest {
  return { ...storyQuest(slug, level), titleEn: `Quest ${slug} ${level}`, estimatedMinutes: 5 };
}

// Story Time: tiger (1), sun (2). Culture: seollal (1).
const tiger = story('tiger', { shelf: { category: 'story-time', order: 1 } });
const sun = story('sun', { shelf: { category: 'story-time', order: 2 } });
const seollal = story('seollal', { shelf: { category: 'culture', order: 1 } });
const STORIES: Story[] = [seollal, sun, tiger];
const SLUGS = ['tiger', 'sun', 'seollal'];

const GRID_QUESTS = [quest('quest:a', 'Meet g, n, d'), quest('quest:b', 'Meet m, b, s'), quest('quest:c', 'Meet vowels')];
const GRID_EPISODES = [gridEpisode('episode:one', ['quest:a', 'quest:b']), gridEpisode('episode:two', ['quest:c'])];
const SHELF_EPISODES = STORIES.map((s) => shelfEpisode(s));
const SHELF_QUESTS = SLUGS.map((slug) => fullStoryQuest(slug));

const INDEX = shelfIndex(STORIES);

function done(id: string, day: string, accuracy: number, episodeId = 'episode:one'): ProgressSnapshot['quests'][number] {
  return {
    questId: id,
    episodeId,
    startedAt: `${day}T09:00:00.000Z`,
    completedAt: `${day}T09:10:00.000Z`,
    stars: accuracy >= 1 ? 3 : 2,
    attempts: 1,
    accuracy,
  };
}

function snapshot(quests: ProgressSnapshot['quests'] = []): ProgressSnapshot {
  return {
    profileId: 'profile:kid1',
    updatedAt: `${TODAY}T09:00:00.000Z`,
    episodes: [],
    quests,
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 1,
  };
}

interface StoryWorld {
  entries?: readonly StoryIndexEntry[];
  bookmarks?: BookmarkFile;
  isLocked?: (entry: StoryIndexEntry) => boolean;
  fits?: (entry: StoryIndexEntry) => boolean;
}

function build(overrides: Partial<BuildMissionInput> = {}, world: StoryWorld = {}): MissionPlan {
  return buildTodaysMission({
    profileId: 'profile:kid1',
    snapshot: snapshot(),
    quests: [...GRID_QUESTS, ...SHELF_QUESTS],
    episodes: [...GRID_EPISODES, ...SHELF_EPISODES],
    today: TODAY,
    stories: {
      entries: world.entries ?? INDEX,
      bookmarks: world.bookmarks ?? emptyBookmarks(),
      isLocked: world.isLocked ?? (() => false),
      fits: world.fits,
    },
    ...overrides,
  });
}

const allShelfFinished = (day = LONG_AGO): ProgressSnapshot['quests'] =>
  // Distinct finish times: tiger first, then sun, then seollal.
  SLUGS.map((slug, i) => ({ ...done(questId(slug), day, 1, `episode:shelf-${slug}`), completedAt: `${day}T0${i + 1}:00:00.000Z` }));

describe('day one with stories (F-STORY-004 §3.14 #1)', () => {
  it('shows a `next` story, the first Journey quest and a second, different story', () => {
    const plan = build();
    expect(plan.cards.map((c) => c.kind)).toEqual(['story', 'new', 'story']);
    expect(plan.cards[0]).toMatchObject({
      slot: 1,
      kind: 'story',
      subtitle: 'story',
      titleEn: tiger.title.en,
      storyId: 'story:tiger',
      storyReason: 'next',
      storyMode: 'play',
      questId: questId('tiger'),
      episodeId: 'episode:shelf-tiger',
      collected: false,
    });
    expect(plan.cards[1]).toMatchObject({ slot: 2, kind: 'new', questId: 'quest:a' });
    expect(plan.cards[2]).toMatchObject({ slot: 3, kind: 'story', storyId: 'story:sun', storyReason: 'next' });
  });

  it('the old "Story time" mislabel on a plain episode is gone', () => {
    for (const card of build().cards) {
      if (card.kind === 'story') expect(card.storyId).toBeDefined();
      expect(card.episodeId).not.toBe('episode:two');
    }
  });

  it('Story Time comes before Culture; Culture follows once Story Time is finished', () => {
    const plan = build({
      snapshot: snapshot([done(questId('tiger'), LONG_AGO, 1, 'episode:shelf-tiger'), done(questId('sun'), LONG_AGO, 1, 'episode:shelf-sun')]),
    });
    expect(plan.cards[0]).toMatchObject({ storyId: 'story:seollal', storyReason: 'next' });
  });
});

describe('story fit orders the `next` story cards (F-STORY-005 §3.4 rule 2)', () => {
  it('fitting stories come first; the rest keep their shelf order and none is dropped', () => {
    // Only Sun fits: it moves ahead of Tiger in slot 1, and Tiger still takes slot 3.
    const plan = build({}, { fits: (e) => e.storyId === 'story:sun' });
    expect(plan.cards[0]).toMatchObject({ storyId: 'story:sun', storyReason: 'next' });
    expect(plan.cards[2]).toMatchObject({ storyId: 'story:tiger', storyReason: 'next' });
  });

  it('without `fits` the shelf order is unchanged', () => {
    expect(build({}, { fits: undefined }).cards[0]).toMatchObject({ storyId: 'story:tiger' });
  });
});

describe('slot ① chain: continue → replay → next → again → explore', () => {
  it('an unfinished story (bookmark at its level) beats a replay', () => {
    const plan = build(
      { snapshot: snapshot([done('quest:a', YESTERDAY, 0.5)]) },
      { bookmarks: bookmarks({ 'story:sun': { sceneIndex: 3 } }) },
    );
    expect(plan.cards[0]).toMatchObject({ kind: 'story', storyId: 'story:sun', storyReason: 'continue', storyMode: 'play' });
    // Slot ③ asks for `next` first: the first unfinished story not on the plan.
    expect(plan.cards[2]).toMatchObject({ kind: 'story', storyId: 'story:tiger', storyReason: 'next' });
  });

  it('a bookmark at another level is not a `continue`', () => {
    const plan = build({}, { bookmarks: bookmarks({ 'story:sun': { level: 'read-along' } }) });
    expect(plan.cards[0]).toMatchObject({ storyId: 'story:tiger', storyReason: 'next' });
  });

  it('a replay beats `next` when nothing is in progress', () => {
    const plan = build({ snapshot: snapshot([done('quest:a', YESTERDAY, 0.5)]) });
    expect(plan.cards[0]).toMatchObject({ kind: 'replay', questId: 'quest:a' });
    expect(plan.cards[2]).toMatchObject({ kind: 'story', storyId: 'story:tiger', storyReason: 'next' });
  });

  it('with every story finished and no replay, slot ① reads a finished story again (unscored)', () => {
    const plan = build({ snapshot: snapshot(allShelfFinished()) });
    expect(plan.cards[0]).toMatchObject({ kind: 'story', storyId: 'story:tiger', storyReason: 'again', storyMode: 'replay' });
    expect(plan.cards[2]).toMatchObject({ kind: 'story', storyId: 'story:sun', storyReason: 'again', storyMode: 'replay' });
  });

  it('falls back to the explore card when every story is locked', () => {
    const plan = build({}, { isLocked: () => true });
    expect(plan.cards[0]).toMatchObject({ kind: 'explore', subtitle: 'explore', episodeId: 'episode:one', titleEn: 'Episode episode:one' });
    expect(plan.cards[2]).toMatchObject({ kind: 'explore', episodeId: 'episode:two' });
  });

  it('falls back to the explore card when the index is empty (no reviewed story bundled)', () => {
    const plan = build({}, { entries: [] });
    expect(plan.cards.map((c) => c.kind)).toEqual(['explore', 'new', 'explore']);
  });

  it('without `stories` the builder offers no story card at all', () => {
    const plan = build({ stories: undefined });
    expect(plan.cards.map((c) => c.kind)).toEqual(['explore', 'new', 'explore']);
  });

  it('never picks a locked story', () => {
    const plan = build({}, { isLocked: (e) => e.storyId === 'story:tiger' });
    expect(plan.cards[0]?.storyId).toBe('story:sun');
    expect(plan.cards[2]?.storyId).toBe('story:seollal');
  });

  it('never picks a story whose quest is closed (F-ENT-003 section 3.6); omitted, nothing changes', () => {
    const plan = build({ isQuestOpen: (id) => id !== questId('tiger') });
    expect(plan.cards[0]?.storyId).toBe('story:sun');
    expect(plan.cards[2]?.storyId).toBe('story:seollal');
    expect(build({ isQuestOpen: undefined })).toEqual(build());
  });

  it('a closed story falls back down the chain to the explore card', () => {
    const plan = build({ isQuestOpen: (id) => !id.startsWith('quest:story-') });
    expect(plan.cards.map((c) => c.kind)).toEqual(['explore', 'new', 'explore']);
  });
});

describe('slot ③ chain: next → replay → again → explore', () => {
  it('a second replay comes before `again` once every story is finished', () => {
    const plan = build({
      snapshot: snapshot([...allShelfFinished(), done('quest:a', YESTERDAY, 0.3), done('quest:b', YESTERDAY, 0.5)]),
    });
    expect(plan.cards[0]).toMatchObject({ kind: 'replay', questId: 'quest:a' });
    expect(plan.cards[2]).toMatchObject({ kind: 'replay', questId: 'quest:b' });
  });

  it('`again` once the stories are finished and only one replay exists', () => {
    const plan = build({ snapshot: snapshot([...allShelfFinished(), done('quest:a', YESTERDAY, 0.3)]) });
    expect(plan.cards[0]).toMatchObject({ kind: 'replay', questId: 'quest:a' });
    expect(plan.cards[2]).toMatchObject({ kind: 'story', storyId: 'story:tiger', storyReason: 'again', storyMode: 'replay' });
  });

  it('never `continue` in slot ③: a second bookmarked story is offered as `next`', () => {
    const plan = build(
      {},
      { bookmarks: bookmarks({ 'story:sun': { updatedAt: '2026-05-19T10:00:00.000Z' }, 'story:seollal': { updatedAt: '2026-05-18T10:00:00.000Z' } }) },
    );
    expect(plan.cards[0]).toMatchObject({ storyId: 'story:sun', storyReason: 'continue' });
    expect(plan.cards[2]).toMatchObject({ storyId: 'story:tiger', storyReason: 'next' });
  });

  it('the daily test still owns slot ③ when it is available', () => {
    const plan = build({ capabilities: { dailyTestAvailable: true } });
    expect(plan.cards.map((c) => c.kind)).toEqual(['story', 'new', 'daily-test']);
  });

  it('two story cards never show the same story', () => {
    const one = build({ snapshot: snapshot([done(questId('tiger'), LONG_AGO, 1, 'episode:shelf-tiger')]) });
    const ids = one.cards.filter((c) => c.kind === 'story').map((c) => c.storyId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('a shelf quest is never a replay card (decision recorded in F-STORY-004 §3.7)', () => {
  it('a shelf story finished yesterday below full accuracy is not offered as a scored replay', () => {
    const plan = build({ snapshot: snapshot([done(questId('tiger'), YESTERDAY, 0.4, 'episode:shelf-tiger')]) });
    for (const card of plan.cards) expect(card.kind === 'replay' && card.questId === questId('tiger')).toBe(false);
    // The next unfinished story leads instead.
    expect(plan.cards[0]).toMatchObject({ kind: 'story', storyId: 'story:sun', storyReason: 'next' });
  });

  it('it comes back only as an unscored `again` card once nothing else is left', () => {
    const plan = build(
      { snapshot: snapshot([done(questId('tiger'), YESTERDAY, 0.4, 'episode:shelf-tiger')]) },
      { entries: shelfIndex([tiger]) },
    );
    expect(plan.cards[0]).toMatchObject({ kind: 'story', storyId: 'story:tiger', storyReason: 'again', storyMode: 'replay' });
  });

  it('without a story index a shelf quest is still never a replay card', () => {
    const plan = build({ stories: undefined, snapshot: snapshot([done(questId('tiger'), YESTERDAY, 0.4, 'episode:shelf-tiger')]) });
    expect(plan.cards.some((c) => c.kind === 'replay')).toBe(false);
  });

  it('a book (grid) story quest stays a replay, and its story is not offered again on the same plan', () => {
    const book = bookEpisode('episode:stage5-letters', [questId('tiger', 'read-along'), questId('sun', 'read-along')]);
    const entries = shelfIndex(STORIES, { episodes: [book], quests: [storyQuest('tiger', 'read-along'), storyQuest('sun', 'read-along')] });
    const plan = build(
      {
        quests: [...GRID_QUESTS, ...SHELF_QUESTS, fullStoryQuest('tiger', 'read-along'), fullStoryQuest('sun', 'read-along')],
        episodes: [...GRID_EPISODES, ...SHELF_EPISODES, book],
        snapshot: snapshot([done(questId('tiger', 'read-along'), YESTERDAY, 0.5, book.id)]),
      },
      { entries },
    );
    expect(plan.cards[0]).toMatchObject({ kind: 'replay', questId: questId('tiger', 'read-along') });
    expect(plan.cards[2]).toMatchObject({ kind: 'story', storyId: 'story:sun', storyReason: 'next' });
  });
});

describe('the Journey card and a book story never collide', () => {
  it('a `next` book story skips the quest slot ② already holds', () => {
    const book = bookEpisode('episode:stage5-letters', [questId('tiger', 'read-along'), questId('sun', 'read-along')]);
    const entries = shelfIndex(STORIES, { episodes: [book], quests: [storyQuest('tiger', 'read-along'), storyQuest('sun', 'read-along')] });
    const plan = build(
      {
        quests: [...GRID_QUESTS, ...SHELF_QUESTS, fullStoryQuest('tiger', 'read-along'), fullStoryQuest('sun', 'read-along')],
        episodes: [...GRID_EPISODES, ...SHELF_EPISODES, book],
        snapshot: snapshot([...allShelfFinished(), ...GRID_QUESTS.map((q) => done(q.id, LONG_AGO, 1))]),
      },
      { entries },
    );
    // Every grid quest of Stage 1 is done: the cursor is the first book quest.
    expect(plan.cards[1]).toMatchObject({ kind: 'new', questId: questId('tiger', 'read-along') });
    expect(plan.cards[0]).toMatchObject({ kind: 'story', questId: questId('sun', 'read-along'), storyReason: 'next' });
    // Slot ② holds the tiger story, so slot ③ does not read it again either.
    expect(plan.cards[2]).toMatchObject({ kind: 'story', storyId: 'story:seollal', storyReason: 'again' });
  });

  it('a book story on the Journey card keeps its shelf entry off slots ① and ③', () => {
    const book = bookEpisode('episode:stage5-letters', [questId('tiger', 'read-along'), questId('sun', 'read-along')]);
    const entries = shelfIndex(STORIES, { episodes: [book], quests: [storyQuest('tiger', 'read-along'), storyQuest('sun', 'read-along')] });
    const plan = build(
      {
        quests: [...GRID_QUESTS, ...SHELF_QUESTS, fullStoryQuest('tiger', 'read-along'), fullStoryQuest('sun', 'read-along')],
        episodes: [...GRID_EPISODES, ...SHELF_EPISODES, book],
        snapshot: snapshot(GRID_QUESTS.map((q) => done(q.id, LONG_AGO, 1))),
      },
      { entries },
    );
    expect(plan.cards[1]).toMatchObject({ kind: 'new', questId: questId('tiger', 'read-along') });
    expect(plan.cards[0]).toMatchObject({ kind: 'story', storyId: 'story:sun', questId: questId('sun'), storyReason: 'next' });
    expect(plan.cards[2]).toMatchObject({ kind: 'story', storyId: 'story:seollal', storyReason: 'next' });
    expect(plan.cards.filter((c) => c.storyId === 'story:tiger')).toEqual([]);
  });

  it("the explore card may still name slot ②'s episode, so the row keeps three cards", () => {
    const plan = build({}, { entries: [] });
    expect(plan.cards[1]).toMatchObject({ kind: 'new', episodeId: 'episode:one' });
    expect(plan.cards[0]).toMatchObject({ kind: 'explore', episodeId: 'episode:one' });
    expect(plan.cards[2]).toMatchObject({ kind: 'explore', episodeId: 'episode:two' });
  });
});

describe('collected look and pinning (§3.2, §3.7)', () => {
  it('a `next` card flips to collected when its quest completes today; the target does not move', () => {
    const first = build();
    const after = build({ snapshot: snapshot([done(questId('tiger'), TODAY, 1, 'episode:shelf-tiger')]), pinned: first });
    expect(after.cards.map((c) => c.storyId ?? c.questId)).toEqual(first.cards.map((c) => c.storyId ?? c.questId));
    expect(after.cards[0]).toMatchObject({ storyId: 'story:tiger', collected: true });
  });

  it('an `again` card is never collected, even when its story is finished today', () => {
    const today = snapshot([done(questId('tiger'), TODAY, 1, 'episode:shelf-tiger')]);
    const plan = build({ snapshot: today }, { entries: shelfIndex([tiger]) });
    expect(plan.cards[0]).toMatchObject({ storyId: 'story:tiger', storyReason: 'again', collected: false });
    const pinned = build({ snapshot: today, pinned: plan }, { entries: shelfIndex([tiger]) });
    expect(pinned.cards[0]?.collected).toBe(false);
  });

  it('the reason line refreshes from the bookmark: a `next` card becomes "Keep reading"', () => {
    const first = build();
    const after = build({ pinned: first }, { bookmarks: bookmarks({ 'story:tiger': { sceneIndex: 2 } }) });
    expect(after.cards[0]).toMatchObject({ storyId: 'story:tiger', storyReason: 'continue' });
    expect(missionCardText(after.cards[0]!, learner).subtitle).toBe('Keep reading');
    // The other story card has no bookmark and keeps its reason.
    expect(after.cards[2]).toMatchObject({ storyId: 'story:sun', storyReason: 'next' });
  });

  it('a finished story does not refresh to "Keep reading" from a stale bookmark', () => {
    const first = build();
    const after = build(
      { pinned: first, snapshot: snapshot([done(questId('tiger'), TODAY, 1, 'episode:shelf-tiger')]) },
      { bookmarks: bookmarks({ 'story:tiger': { sceneIndex: 2 } }) },
    );
    expect(after.cards[0]).toMatchObject({ storyReason: 'next', collected: true });
  });

  it('a pinned "Keep reading" card finished today reads "A short story", like a collected `next` card', () => {
    const first = build({}, { bookmarks: bookmarks({ 'story:sun': { sceneIndex: 3 } }) });
    expect(first.cards[0]).toMatchObject({ storyId: 'story:sun', storyReason: 'continue' });
    const after = build(
      { pinned: first, snapshot: snapshot([done(questId('sun'), TODAY, 1, 'episode:shelf-sun')]) },
      { bookmarks: bookmarks({ 'story:sun': { sceneIndex: 3 } }) },
    );
    expect(after.cards[0]).toMatchObject({ storyId: 'story:sun', storyReason: 'next', collected: true });
    expect(missionCardText(after.cards[0]!, learner).subtitle).toBe('A short story');
  });

  it('a pinned "Keep reading" card whose bookmark is gone reads "A short story" again', () => {
    const first = build({}, { bookmarks: bookmarks({ 'story:sun': { sceneIndex: 3 } }) });
    expect(build({ pinned: first }).cards[0]).toMatchObject({ storyId: 'story:sun', storyReason: 'next' });
  });

  it('a pinned `again` card keeps its reason', () => {
    const first = build({ snapshot: snapshot(allShelfFinished()) });
    const after = build({ pinned: first, snapshot: snapshot(allShelfFinished()) }, { bookmarks: bookmarks({ 'story:tiger': {} }) });
    expect(after.cards[0]).toMatchObject({ storyId: 'story:tiger', storyReason: 'again' });
  });

  it('a pinned story card whose story left the index keeps its reason', () => {
    const first = build();
    const after = build({ pinned: first }, { entries: [], bookmarks: bookmarks({ 'story:tiger': {} }) });
    expect(after.cards[0]).toMatchObject({ storyId: 'story:tiger', storyReason: 'next' });
  });

  it('a pinned story card keeps its reason when the rebuild has no story world', () => {
    const first = build();
    expect(build({ pinned: first, stories: undefined }).cards[0]).toMatchObject({ storyId: 'story:tiger', storyReason: 'next' });
  });

  it('a pinned plan built without stories is reused as is', () => {
    const first = build({ stories: undefined });
    expect(build({ stories: undefined, pinned: first }).cards).toEqual(first.cards);
  });
});

describe('card words (dictionary, F-I18N-001 §3.4 rule 3)', () => {
  const base: MissionCard = { slot: 1, kind: 'story', titleEn: 'The Tiger', subtitle: 'story', collected: false, storyId: 'story:tiger' };

  it('story subtitles follow the reason; explore says "Take a look"', () => {
    expect(missionCardText({ ...base, storyReason: 'continue' }, learner)).toEqual({ title: 'The Tiger', subtitle: 'Keep reading' });
    expect(missionCardText({ ...base, storyReason: 'next' }, learner).subtitle).toBe('A short story');
    expect(missionCardText({ ...base, storyReason: 'again' }, learner).subtitle).toBe('Read it again');
    expect(missionCardText({ ...base, kind: 'explore', subtitle: 'explore' }, learner).subtitle).toBe('Take a look');
  });

  it('a story card without a reason falls back to the generic "Story time" words', () => {
    expect(missionCardText(base, learner).subtitle).toBe('Story time');
  });

  it('no banned word in any plan with stories', () => {
    const plans = [
      build(),
      build({}, { bookmarks: bookmarks({ 'story:sun': {} }) }),
      build({ snapshot: snapshot(allShelfFinished()) }),
      build({}, { isLocked: () => true }),
    ];
    for (const plan of plans) expect(scanLearnerCopy(missionCopy(plan, learner))).toEqual([]);
  });
});

describe('storyCardShownEvent (home.story_card.shown, §3.11)', () => {
  it('reports the first story card of the plan with its reason', () => {
    expect(storyCardShownEvent(build({}, { bookmarks: bookmarks({ 'story:sun': {} }) }))).toEqual({
      name: 'home.story_card.shown',
      payload: { storyId: 'story:sun', reason: 'continue' },
    });
  });

  it('is null for a plan without a story card', () => {
    expect(storyCardShownEvent(build({ stories: undefined }))).toBeNull();
  });

  it('skips a story card that carries no story or reason', () => {
    const plan = build();
    const bare: MissionPlan = { ...plan, cards: plan.cards.map((c) => ({ ...c, storyReason: undefined })) };
    expect(storyCardShownEvent(bare)).toBeNull();
  });
});

describe('production gate: the shipped bundle (D14, F-STORY-004 §6 "ships dark")', () => {
  const reviewed = (s: Story): boolean =>
    s.state === 'ready' && s.review.language === 'native-reviewed' && s.review.culture === 'culture-reviewed';

  it('Home offers only reviewed stories, and none while every bundled story is still a draft', () => {
    const plan = buildTodaysMission({
      profileId: 'profile:kid1',
      snapshot: snapshot(),
      quests: questsAll,
      episodes: episodesAll,
      today: TODAY,
      stories: { entries: defaultStoryIndex(), bookmarks: emptyBookmarks(), isLocked: () => false },
    });
    const offered = plan.cards.filter((c) => c.kind === 'story').map((c) => storiesAll.find((s) => s.id === c.storyId));
    for (const s of offered) expect(s && reviewed(s)).toBe(true);
    if (!storiesAll.some(reviewed)) {
      expect(defaultStoryIndex()).toEqual([]);
      expect(plan.cards[0]?.kind).toBe('explore');
    }
  });
});

describe('storyCardOpenMode (how a tapped story card opens, §3.7)', () => {
  const card = (patch: Partial<MissionCard>): MissionCard => ({
    slot: 1,
    kind: 'story',
    titleEn: 'The Tiger',
    subtitle: 'story',
    collected: false,
    storyId: 'story:tiger',
    storyReason: 'next',
    storyMode: 'play',
    ...patch,
  });

  it('`again` opens the unscored reader, whatever the status', () => {
    expect(storyCardOpenMode(card({ storyReason: 'again', storyMode: 'replay' }), { state: 'finished' })).toBe('read-again');
    expect(storyCardOpenMode(card({ storyReason: 'again', storyMode: 'replay' }), { state: 'new' })).toBe('read-again');
  });

  it('a collected `next` card plays again (scored), like any collected quest card', () => {
    expect(storyCardOpenMode(card({ collected: true }), { state: 'finished' })).toBe('play-again');
  });

  it('a story with a bookmark at its level continues; otherwise it starts', () => {
    expect(storyCardOpenMode(card({ storyReason: 'continue' }), { state: 'in-progress' })).toBe('continue');
    expect(storyCardOpenMode(card({}), { state: 'new' })).toBe('start');
  });
});

describe('the story card with the shared cursor context (F-ROUTE-001 R-4a)', () => {
  it('a pinned plan re-pins a placed-out New card and still refreshes the story card\'s reason', () => {
    const first = build();
    expect(first.cards[1]).toMatchObject({ kind: 'new', questId: 'quest:a' });
    expect(first.cards[0]).toMatchObject({ storyId: 'story:tiger', storyReason: 'next' });
    const after = build(
      { pinned: first, skipQuestIds: new Set(['quest:a']) },
      { bookmarks: bookmarks({ 'story:tiger': { sceneIndex: 2 } }) },
    );
    expect(after.cards[1]).toMatchObject({ slot: 2, kind: 'new', subtitle: 'new', questId: 'quest:b' });
    expect(after.cards[0]).toMatchObject({ storyId: 'story:tiger', storyReason: 'continue', collected: false });
    expect(after.cards[2]).toMatchObject({ storyId: 'story:sun', storyReason: 'next' });
  });

  it('isEntitled narrows the Journey card while the story cards stay', () => {
    const stage2: Episode = { ...gridEpisode('episode:s2', ['quest:z']), stage: 'stage2' };
    const plan = build({
      quests: [quest('quest:z', 'Stage 2 quest'), ...GRID_QUESTS, ...SHELF_QUESTS],
      episodes: [stage2, ...GRID_EPISODES, ...SHELF_EPISODES],
      isEntitled: (stage) => stage === 'stage1',
    });
    expect(plan.cards.map((c) => c.kind)).toEqual(['story', 'new', 'story']);
    expect(plan.cards[1]).toMatchObject({ questId: 'quest:a' });
  });
});

describe('planHomeStoryOpen (a tapped Home story card, §3.2, §3.7)', () => {
  const world = { entries: INDEX, snapshot: snapshot(), bookmarks: emptyBookmarks() };

  it('a `next` card starts the scored quest and reports `story.opened` from home', () => {
    const card = build().cards[0]!;
    expect(planHomeStoryOpen({ card, ...world })).toEqual({
      route: 'QuestPlayer',
      params: { questId: questId('tiger'), episodeId: 'episode:shelf-tiger' },
      clearBookmark: false,
      event: { name: 'story.opened', payload: { storyId: 'story:tiger', source: 'home', mode: 'start' } },
    });
  });

  it('an `again` card opens the unscored reader', () => {
    const finished = snapshot(allShelfFinished());
    const card = build({ snapshot: finished }).cards[0]!;
    expect(planHomeStoryOpen({ card, ...world, snapshot: finished })).toMatchObject({
      route: 'StoryReader',
      params: { storyId: 'story:tiger', level: 'listen', mode: 'replay' },
      event: { payload: { mode: 'read-again' } },
    });
  });

  it('a collected card plays again (scored)', () => {
    const today = snapshot([done(questId('tiger'), TODAY, 1, 'episode:shelf-tiger')]);
    const card = build({ snapshot: today, pinned: build() }).cards[0]!;
    expect(planHomeStoryOpen({ card, ...world, snapshot: today })).toMatchObject({
      route: 'QuestPlayer',
      event: { payload: { mode: 'play-again' } },
    });
  });

  it('"Keep reading" resumes the quest at the bookmark and reports a `continue` (PR 4.4b resume)', () => {
    const marks = bookmarks({ 'story:sun': { sceneIndex: 3 } });
    const card = build({}, { bookmarks: marks }).cards[0]!;
    expect(card.storyReason).toBe('continue');
    const plan = planHomeStoryOpen({ card, ...world, bookmarks: marks });
    expect(plan).toEqual({
      route: 'QuestPlayer',
      params: { questId: questId('sun'), episodeId: 'episode:shelf-sun', resume: true },
      clearBookmark: false,
      event: { name: 'story.opened', payload: { storyId: 'story:sun', source: 'home', mode: 'continue' } },
    });
  });

  it('a pinned "Keep reading" card whose bookmark is gone opens as a plain start', () => {
    const marks = bookmarks({ 'story:sun': { sceneIndex: 3 } });
    const card = build({}, { bookmarks: marks }).cards[0]!;
    expect(card.storyReason).toBe('continue');
    expect(planHomeStoryOpen({ card, ...world })).toMatchObject({
      route: 'QuestPlayer',
      params: { questId: questId('sun'), episodeId: 'episode:shelf-sun' },
      event: { payload: { mode: 'start' } },
    });
    expect(planHomeStoryOpen({ card, ...world })?.params).not.toHaveProperty('resume');
  });

  it('is null for a card that is not a story in the index', () => {
    const plan = build({}, { entries: [] });
    expect(planHomeStoryOpen({ card: plan.cards[1]!, ...world })).toBeNull();
    const story = build().cards[0]!;
    expect(planHomeStoryOpen({ card: story, ...world, entries: [] })).toBeNull();
    expect(planHomeStoryOpen({ card: { ...story, questId: undefined }, ...world })).toBeNull();
  });
});
