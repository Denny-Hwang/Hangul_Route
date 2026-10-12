import { describe, expect, it } from 'vitest';
import { emptyBookmarks } from '../bookmarks';
import { nextStoryAfter, pickedForYou, pickStoryForHome, storyLockFor, type StoryPickInput } from '../story-pick';
import { bookEpisode, bookmarks, questId, shelfIndex, snapshot, story, storyQuest } from './shelf-fixture';

// Story Time: tiger (1), sun (2), fox (3). Culture: seollal (1), chuseok (2).
const tiger = story('tiger', { shelf: { category: 'story-time', order: 1 } });
const sun = story('sun', { shelf: { category: 'story-time', order: 2 } });
const fox = story('fox', { shelf: { category: 'story-time', order: 3 } });
const seollal = story('seollal', { shelf: { category: 'culture', order: 1 } });
const chuseok = story('chuseok', { shelf: { category: 'culture', order: 2 } });
const ALL = [chuseok, fox, seollal, sun, tiger]; // bundle order is not shelf order

const index = shelfIndex(ALL, {
  episodes: [bookEpisode('episode:stage5-letters', [questId('tiger', 'read-along'), questId('sun', 'read-along'), questId('fox', 'read-along')])],
  quests: [storyQuest('tiger', 'read-along'), storyQuest('sun', 'read-along'), storyQuest('fox', 'read-along')],
});

const SHELF_QUESTS = ALL.map((s) => questId(s.id.replace('story:', '')));
const at = (day: number): string => `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;
const finishedShelf = (except: string[] = []) =>
  SHELF_QUESTS.filter((q) => !except.includes(q)).map((q, i) => ({ questId: q, completedAt: at(i + 1) }));

function input(patch: Partial<StoryPickInput> = {}): StoryPickInput {
  return { entries: index, snapshot: snapshot([]), bookmarks: emptyBookmarks(), isLocked: () => false, ...patch };
}

describe('pickStoryForHome', () => {
  it('day one: the first Story Time story, as a `next` play card', () => {
    const pick = pickStoryForHome(input());
    expect(pick).toMatchObject({ reason: 'next', mode: 'play', entry: { storyId: 'story:tiger', placement: 'shelf' } });
    expect(pick?.bookmark).toBeUndefined();
  });

  it('continue beats next, with the bookmark', () => {
    const file = bookmarks({ 'story:fox': { sceneIndex: 3 } });
    const pick = pickStoryForHome(input({ bookmarks: file }));
    expect(pick).toEqual({ entry: expect.objectContaining({ storyId: 'story:fox' }), reason: 'continue', mode: 'play', bookmark: file.byStory['story:fox'] });
  });

  it('continue: the most recent bookmark wins; ties go by shelf order', () => {
    const recent = bookmarks({ 'story:sun': { updatedAt: at(2) }, 'story:chuseok': { updatedAt: at(5) } });
    expect(pickStoryForHome(input({ bookmarks: recent }))?.entry.storyId).toBe('story:chuseok');
    const tie = bookmarks({ 'story:chuseok': { updatedAt: at(5) }, 'story:sun': { updatedAt: at(5) } });
    expect(pickStoryForHome(input({ bookmarks: tie }))?.entry.storyId).toBe('story:sun');
  });

  it('continue: newest first whatever order the bookmarks were saved in', () => {
    const file = bookmarks({
      'story:tiger': { updatedAt: at(3) },
      'story:chuseok': { updatedAt: at(9) },
      'story:fox': { updatedAt: at(1) },
      'story:sun': { updatedAt: at(5) },
    });
    expect(pickStoryForHome(input({ bookmarks: file }))?.entry.storyId).toBe('story:chuseok');
  });

  it('works without a progress snapshot (nothing finished yet)', () => {
    expect(pickStoryForHome(input({ snapshot: undefined }))?.entry.storyId).toBe('story:tiger');
  });

  it('continue ignores a bookmark of another level and one whose quest is finished', () => {
    const file = bookmarks({ 'story:fox': { level: 'read' }, 'story:sun': {} });
    const done = snapshot([{ questId: questId('sun'), completedAt: at(1) }]);
    const pick = pickStoryForHome(input({ bookmarks: file, snapshot: done }));
    expect(pick).toMatchObject({ reason: 'next', entry: { storyId: 'story:tiger' } });
  });

  it('a read-along bookmark continues the book entry of that level', () => {
    const file = bookmarks({ 'story:sun': { level: 'read-along' } });
    expect(pickStoryForHome(input({ bookmarks: file }))).toMatchObject({
      reason: 'continue',
      entry: { storyId: 'story:sun', placement: 'grid', level: 'read-along' },
    });
  });

  it('next walks Story Time before Culture, then order, skipping finished stories', () => {
    const done = snapshot(finishedShelf([questId('seollal'), questId('chuseok')]));
    expect(pickStoryForHome(input({ snapshot: done }))?.entry.storyId).toBe('story:seollal');
  });

  it('next reaches the grid only once every shelf story is finished, in book order', () => {
    const done = snapshot(finishedShelf());
    expect(pickStoryForHome(input({ snapshot: done }))).toMatchObject({
      reason: 'next',
      mode: 'play',
      entry: { storyId: 'story:tiger', placement: 'grid' },
    });
  });

  it('again: once everything is finished, the oldest finish as an unscored replay', () => {
    const grid = ['tiger', 'sun', 'fox'].map((s, i) => ({ questId: questId(s, 'read-along'), completedAt: at(20 + i) }));
    const done = snapshot([...finishedShelf(), ...grid]);
    // finishedShelf completes chuseok first (day 1).
    expect(pickStoryForHome(input({ snapshot: done }))).toMatchObject({
      reason: 'again',
      mode: 'replay',
      entry: { storyId: 'story:chuseok' },
    });
  });

  it('again: the oldest finish whatever the progress order', () => {
    const days = [7, 2, 9, 4, 6];
    const all = index.map((e, i) => ({ questId: e.questId, completedAt: at(days[i % days.length] as number) }));
    // index order: chuseok, fox, seollal, sun, tiger (shelf), then tiger, sun, fox (book)
    expect(pickStoryForHome(input({ snapshot: snapshot(all) }))).toMatchObject({ reason: 'again', entry: { storyId: 'story:fox', placement: 'shelf' } });
  });

  it('again: equal finish times go by shelf order', () => {
    const all = index.map((e) => ({ questId: e.questId, completedAt: at(3) }));
    expect(pickStoryForHome(input({ snapshot: snapshot(all) }))?.entry.storyId).toBe('story:tiger');
  });

  it('exclusions: story ids and quest ids (the cards already on the plan)', () => {
    expect(pickStoryForHome(input({ excludeStoryIds: ['story:tiger'] }))?.entry.storyId).toBe('story:sun');
    expect(pickStoryForHome(input({ excludeQuestIds: [questId('tiger')] }))?.entry.storyId).toBe('story:sun');
  });

  it('exclusions also apply to continue and again', () => {
    const file = bookmarks({ 'story:fox': {} });
    expect(pickStoryForHome(input({ bookmarks: file, excludeStoryIds: ['story:fox'] }))?.reason).toBe('next');
    const all = index.map((e, i) => ({ questId: e.questId, completedAt: at(i + 1) }));
    const first = pickStoryForHome(input({ snapshot: snapshot(all) }));
    const second = pickStoryForHome(input({ snapshot: snapshot(all), excludeStoryIds: [first?.entry.storyId ?? ''] }));
    expect(second?.reason).toBe('again');
    expect(second?.entry.storyId).not.toBe(first?.entry.storyId);
  });

  it('never picks a locked story', () => {
    const locked = (e: { storyId: string }) => e.storyId !== 'story:seollal';
    expect(pickStoryForHome(input({ isLocked: locked }))?.entry.storyId).toBe('story:seollal');
    const file = bookmarks({ 'story:fox': {} });
    expect(pickStoryForHome(input({ bookmarks: file, isLocked: (e) => e.storyId === 'story:fox' }))?.reason).toBe('next');
  });

  it('the lock is per entry: a book quest in a stage the learner may not open is never offered', () => {
    // The caller's stage gate (isStageEntitled) says no to the Stage 5 book; the shelf stays open.
    const stageLocked = (e: { placement: string; stage: string }) => e.placement === 'grid' && e.stage === 'stage5';
    expect(index.filter((e) => e.placement === 'grid').every((e) => e.stage === 'stage5')).toBe(true);
    // Every shelf story finished: `next` would reach the book, so it falls through to `again` on the shelf.
    const done = snapshot(finishedShelf());
    expect(pickStoryForHome(input({ snapshot: done, isLocked: stageLocked }))).toMatchObject({
      reason: 'again',
      entry: { placement: 'shelf' },
    });
    // A read-along bookmark does not continue into the locked book; the story's shelf entry is still offered.
    const file = bookmarks({ 'story:sun': { level: 'read-along' } });
    expect(pickStoryForHome(input({ bookmarks: file, isLocked: stageLocked }))).toMatchObject({
      reason: 'next',
      entry: { storyId: 'story:tiger', placement: 'shelf' },
    });
    // Everything finished but the book: nothing from the book is replayed or offered.
    const grid = ['tiger', 'sun', 'fox'].map((s, i) => ({ questId: questId(s, 'read-along'), completedAt: at(i + 1) }));
    const again = pickStoryForHome(input({ snapshot: snapshot([...finishedShelf(), ...grid]), isLocked: stageLocked }));
    expect(again?.entry.placement).toBe('shelf');
    expect(nextStoryAfter(questId('tiger', 'read-along'), input({ isLocked: stageLocked }))).toBeNull();
    expect(pickedForYou({ ...input({ snapshot: done, isLocked: stageLocked }), category: 'story-time' })?.entry.placement).toBe('shelf');
  });

  it('reasons limits the chain: slot ③ asks for `next` only, then `again` only', () => {
    // Two bookmarks and unfinished shelf stories: the full chain says continue.
    const file = bookmarks({ 'story:fox': { updatedAt: at(2) }, 'story:chuseok': { updatedAt: at(3) } });
    expect(pickStoryForHome(input({ bookmarks: file }))?.reason).toBe('continue');
    expect(pickStoryForHome(input({ bookmarks: file, reasons: ['next'] }))).toMatchObject({
      reason: 'next',
      entry: { storyId: 'story:tiger' },
    });
    // `next` only: null once nothing is unfinished; `again` only: the oldest finish, never a fresh story.
    const all = index.map((e, i) => ({ questId: e.questId, completedAt: at(i + 1) }));
    expect(pickStoryForHome(input({ snapshot: snapshot(all), reasons: ['next'] }))).toBeNull();
    expect(pickStoryForHome(input({ reasons: ['again'] }))).toBeNull();
    expect(pickStoryForHome(input({ snapshot: snapshot(finishedShelf()), reasons: ['again'] }))).toMatchObject({
      reason: 'again',
      entry: { storyId: 'story:chuseok' },
    });
    expect(pickStoryForHome(input({ bookmarks: file, reasons: [] }))).toBeNull();
  });

  it('compares times as instants: an offset time and a Z time order by the moment they name', () => {
    // 11:00+02:00 is 09:00Z, older than 10:00Z, so it is the newer bookmark that loses.
    const file = bookmarks({
      'story:sun': { updatedAt: '2026-10-05T10:00:00Z' },
      'story:chuseok': { updatedAt: '2026-10-05T11:00:00+02:00' },
    });
    expect(pickStoryForHome(input({ bookmarks: file }))?.entry.storyId).toBe('story:sun');
    const done = snapshot(
      index.map((e) => ({
        questId: e.questId,
        completedAt: e.storyId === 'story:fox' && e.placement === 'shelf' ? '2026-10-01T11:00:00+02:00' : '2026-10-01T10:00:00.000Z',
      })),
    );
    expect(pickStoryForHome(input({ snapshot: done }))).toMatchObject({ reason: 'again', entry: { storyId: 'story:fox' } });
  });

  it('returns null when nothing applies', () => {
    expect(pickStoryForHome(input({ entries: [] }))).toBeNull();
    expect(pickStoryForHome(input({ isLocked: () => true }))).toBeNull();
  });

  it('fits (F-STORY-005 StoryFit) only orders: fitting stories first, the rest after, none removed', () => {
    const fits = (e: { storyId: string }) => e.storyId === 'story:fox' || e.storyId === 'story:seollal';
    expect(pickStoryForHome(input({ fits }))?.entry.storyId).toBe('story:fox');
    const done = snapshot([{ questId: questId('fox'), completedAt: at(1) }, { questId: questId('seollal'), completedAt: at(1) }]);
    expect(pickStoryForHome(input({ fits, snapshot: done }))?.entry.storyId).toBe('story:tiger');
  });
});

describe('pickedForYou', () => {
  it('stays inside the category: next, continue, again', () => {
    expect(pickedForYou({ ...input(), category: 'culture' })).toMatchObject({ reason: 'next', entry: { storyId: 'story:seollal' } });
    const file = bookmarks({ 'story:chuseok': {}, 'story:fox': { updatedAt: at(30) } });
    expect(pickedForYou({ ...input({ bookmarks: file }), category: 'culture' })).toMatchObject({
      reason: 'continue',
      entry: { storyId: 'story:chuseok' },
    });
    const done = snapshot(finishedShelf());
    expect(pickedForYou({ ...input({ snapshot: done }), category: 'story-time' })).toMatchObject({
      reason: 'again',
      mode: 'replay',
      entry: { storyId: 'story:fox', placement: 'shelf' },
    });
  });

  it('is null for an empty or fully locked category', () => {
    expect(pickedForYou({ ...input({ entries: index.filter((e) => e.category !== 'culture') }), category: 'culture' })).toBeNull();
    expect(pickedForYou({ ...input({ isLocked: () => true }), category: 'story-time' })).toBeNull();
  });
});

describe('nextStoryAfter', () => {
  it('within a shelf category: the next unfinished story in shelf order', () => {
    expect(nextStoryAfter(questId('tiger'), input())?.storyId).toBe('story:sun');
  });

  it('wraps to the start of the category', () => {
    expect(nextStoryAfter(questId('fox'), input())?.storyId).toBe('story:tiger');
    expect(nextStoryAfter(questId('chuseok'), input())?.storyId).toBe('story:seollal');
  });

  it('skips finished and locked stories', () => {
    const done = snapshot([{ questId: questId('sun'), completedAt: at(1) }]);
    expect(nextStoryAfter(questId('tiger'), input({ snapshot: done }))?.storyId).toBe('story:fox');
    expect(nextStoryAfter(questId('tiger'), input({ isLocked: (e) => e.storyId === 'story:sun' }))?.storyId).toBe('story:fox');
  });

  it('within a book: the next story quest of the same episode', () => {
    expect(nextStoryAfter(questId('tiger', 'read-along'), input())).toMatchObject({ storyId: 'story:sun', placement: 'grid' });
    expect(nextStoryAfter(questId('fox', 'read-along'), input())).toMatchObject({ storyId: 'story:tiger', placement: 'grid' });
  });

  it('none: everything else in the group finished, a single-story group, or an unknown quest', () => {
    const done = snapshot([{ questId: questId('seollal'), completedAt: at(1) }]);
    expect(nextStoryAfter(questId('chuseok'), input({ snapshot: done }))).toBeNull();
    expect(nextStoryAfter(questId('seollal'), input({ entries: index.filter((e) => e.storyId === 'story:seollal') }))).toBeNull();
    expect(nextStoryAfter('quest:nope', input())).toBeNull();
  });
});

describe('storyLockFor (the Home and shelf `isLocked`, F-STORY-004 §3.9)', () => {
  const registry = { stages: new Set(['stage1']), vocabTopics: new Set<string>(), samplerStories: new Set(['story:tiger']), freeQuests: new Set<string>(), gridLessons: new Set<string>() };
  const shelf = (slug: string) => index.find((e) => e.placement === 'shelf' && e.storyId === `story:${slug}`)!;
  const book = (slug: string) => index.find((e) => e.placement === 'grid' && e.storyId === `story:${slug}`)!;
  const stage5 = bookEpisode('episode:stage5-letters', [], { status: 'shipped' });

  it('gating off: no shelf story is locked, whatever the tier', () => {
    for (const tier of ['free', 'premium'] as const) {
      const locked = storyLockFor({ tier, gatingEnabled: false, episodes: [stage5], registry });
      expect(index.filter((e) => e.placement === 'shelf').some(locked)).toBe(false);
    }
  });

  it('gating on: a free learner keeps the sampler and is locked out of the rest; premium opens all', () => {
    const free = storyLockFor({ tier: 'free', gatingEnabled: true, episodes: [stage5], registry });
    expect(free(shelf('tiger'))).toBe(false);
    expect(free(shelf('sun'))).toBe(true);
    const premium = storyLockFor({ tier: 'premium', gatingEnabled: true, episodes: [stage5], registry });
    expect(premium(shelf('sun'))).toBe(false);
  });

  it('a book (grid) story follows the Journey stage gate, which is not behind the flag', () => {
    expect(storyLockFor({ tier: 'free', gatingEnabled: false, episodes: [stage5], registry })(book('tiger'))).toBe(true);
    expect(storyLockFor({ tier: 'premium', gatingEnabled: false, episodes: [stage5], registry })(book('tiger'))).toBe(false);
  });

  it('a book story in a stage that is still "soon" (no shipped cell) is locked even for premium', () => {
    const readyOnly = bookEpisode('episode:stage5-letters', [], { status: 'ready' });
    expect(storyLockFor({ tier: 'premium', gatingEnabled: false, episodes: [readyOnly], registry })(book('tiger'))).toBe(true);
  });

  it('shelf episodes never count toward a stage\'s availability', () => {
    const shelfOnly = { ...stage5, placement: 'shelf' as const };
    expect(storyLockFor({ tier: 'premium', gatingEnabled: false, episodes: [shelfOnly], registry })(book('tiger'))).toBe(true);
  });

  it('defaults to the bundle registry', () => {
    expect(storyLockFor({ tier: 'free', gatingEnabled: false, episodes: [stage5] })(shelf('sun'))).toBe(false);
  });
});
