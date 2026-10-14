import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StoryIndexEntry } from '../../story/story-index';
import { questId, story } from '../../story/__tests__/shelf-fixture';
import { homeCardLock, isHomeCardLocked, type HomeCardAccessInput } from '../home-card-access';
import type { MissionCard } from '../mission-builder';

/**
 * The tap-time access check for Home cards (F-STORY-004 PR 4.8e): a pinned
 * card whose quest closed, or whose story locked, after the pin goes to the
 * grown-up gate instead of the quest player or the reader.
 */

const TIGER_QUEST = questId('tiger');
const tiger: StoryIndexEntry = {
  storyId: 'story:tiger',
  story: story('tiger'),
  questId: TIGER_QUEST,
  episodeId: 'episode:shelf-tiger',
  level: 'listen',
  placement: 'shelf',
  stage: 'stage1',
  category: null,
  order: 1,
  minutes: 5,
  theme: 'letters',
};

function card(patch: Partial<MissionCard>): MissionCard {
  return { slot: 1, kind: 'replay', titleEn: 'A quest', subtitle: 'replay', collected: false, ...patch };
}

const storyCard = card({ kind: 'story', questId: TIGER_QUEST, episodeId: 'episode:shelf-tiger', storyId: 'story:tiger', storyReason: 'next', storyMode: 'play' });
const questCard = card({ slot: 2, kind: 'new', subtitle: 'new', questId: 'quest:s1-e2-q1', episodeId: 'episode:s1-e2' });

const allOpen = (): boolean => true;
const noneLocked = (): boolean => false;

function input(patch: Partial<HomeCardAccessInput>): HomeCardAccessInput {
  return { card: questCard, entries: [tiger], isQuestOpen: allOpen, isStoryLocked: noneLocked, opensDirectly: false, ...patch };
}

const PIN_GATE = { route: 'PinEntry', params: { next: 'Paywall', from: 'home' } } as const;
const PAYWALL = { route: 'Paywall', params: { from: 'home' } } as const;

describe('homeCardLock (F-STORY-004 PR 4.8e)', () => {
  it('an open quest card and an open story card open as before (gating off: nothing is closed)', () => {
    expect(homeCardLock(input({}))).toBeNull();
    expect(homeCardLock(input({ card: storyCard }))).toBeNull();
  });

  it('a quest card whose quest closed after the pin goes to PIN entry, then the Plan screen', () => {
    const closed = (id: string): boolean => id !== questCard.questId;
    expect(homeCardLock(input({ isQuestOpen: closed }))).toEqual({ gate: PIN_GATE, storyId: null });
  });

  it('a self-only device with no PIN goes straight to the Plan screen', () => {
    expect(homeCardLock(input({ isQuestOpen: () => false, opensDirectly: true }))).toEqual({ gate: PAYWALL, storyId: null });
  });

  it('a story card whose story locked after the pin goes to the gate and names the story', () => {
    const locked = (entry: StoryIndexEntry): boolean => entry.storyId === 'story:tiger';
    expect(homeCardLock(input({ card: storyCard, isStoryLocked: locked }))).toEqual({ gate: PIN_GATE, storyId: 'story:tiger' });
  });

  it('a story card in the index follows the story lock alone, as the Library tile and the mission builder do', () => {
    // `storyLockFor` already asks `isQuestOpen` for a grid book; a shelf story's quest is never a lesson.
    expect(homeCardLock(input({ card: storyCard, isQuestOpen: () => false }))).toBeNull();
    expect(homeCardLock(input({ card: storyCard, isQuestOpen: () => false, isStoryLocked: () => true }))).toEqual({ gate: PIN_GATE, storyId: 'story:tiger' });
  });

  it('a story card with no quest opens nothing through the quest player, so it is not gated', () => {
    expect(homeCardLock(input({ card: { ...storyCard, questId: undefined }, isQuestOpen: () => false, isStoryLocked: () => true }))).toBeNull();
  });

  it('a "Read it again" card of a locked story never opens the reader', () => {
    const again = { ...storyCard, storyReason: 'again' as const, storyMode: 'replay' as const };
    expect(homeCardLock(input({ card: again, isStoryLocked: () => true, opensDirectly: true }))).toEqual({ gate: PAYWALL, storyId: 'story:tiger' });
  });

  it('a story card whose entry left the index falls back to its quest, as Home opens it', () => {
    expect(homeCardLock(input({ card: storyCard, entries: [], isStoryLocked: () => true }))).toBeNull();
    expect(homeCardLock(input({ card: storyCard, entries: [], isQuestOpen: () => false }))).toEqual({ gate: PIN_GATE, storyId: null });
  });

  it('a collected card whose quest closed is locked as well (a tap would play it again)', () => {
    expect(homeCardLock(input({ card: { ...questCard, collected: true }, isQuestOpen: () => false }))).not.toBeNull();
  });

  it('cards that open no quest player or reader are never gated here', () => {
    const closed = (): boolean => false;
    const locked = (): boolean => true;
    const explore = card({ slot: 3, kind: 'explore', subtitle: 'explore', episodeId: 'episode:s1-e3' });
    const topic = card({ slot: 3, kind: 'practice', subtitle: 'practice', topicKey: 'food', practiceKind: 'topic' });
    const dailyTest = card({ slot: 3, kind: 'daily-test', titleEn: null, subtitle: 'dailyTest' });
    const freeEnd = card({ slot: 2, kind: 'free-end', subtitle: 'freeEnd' });
    for (const c of [explore, topic, dailyTest, freeEnd]) {
      expect(homeCardLock(input({ card: c, isQuestOpen: closed, isStoryLocked: locked }))).toBeNull();
    }
  });

  it('a quest card missing its episode opens nothing, so it is not gated', () => {
    expect(homeCardLock(input({ card: { ...questCard, episodeId: undefined }, isQuestOpen: () => false }))).toBeNull();
  });
});

describe('isHomeCardLocked (F-STORY-004 PR 4.8f: the locked look of a pinned card)', () => {
  const look = (patch: Partial<HomeCardAccessInput>): boolean => {
    const { opensDirectly: _gate, ...rest } = input(patch);
    return isHomeCardLocked(rest);
  };

  it('is false for open cards (gating off: nothing is closed, so Home looks as before)', () => {
    expect(look({})).toBe(false);
    expect(look({ card: storyCard })).toBe(false);
  });

  it('is true exactly when a tap would take the locked path', () => {
    expect(look({ isQuestOpen: () => false })).toBe(true);
    expect(look({ card: storyCard, isStoryLocked: () => true })).toBe(true);
    expect(look({ card: storyCard, entries: [], isQuestOpen: () => false })).toBe(true);
    expect(look({ card: { ...questCard, collected: true }, isQuestOpen: () => false })).toBe(true);
  });

  it('follows the story lock alone for a story card in the index, as the tap does', () => {
    expect(look({ card: storyCard, isQuestOpen: () => false })).toBe(false);
  });

  it('never marks a card that opens no quest player or reader', () => {
    const explore = card({ slot: 3, kind: 'explore', subtitle: 'explore', episodeId: 'episode:s1-e3' });
    const topic = card({ slot: 3, kind: 'practice', subtitle: 'practice', topicKey: 'food', practiceKind: 'topic' });
    const dailyTest = card({ slot: 3, kind: 'daily-test', titleEn: null, subtitle: 'dailyTest' });
    for (const c of [explore, topic, dailyTest]) {
      expect(look({ card: c, isQuestOpen: () => false, isStoryLocked: () => true })).toBe(false);
    }
  });

  it('agrees with homeCardLock for every case, whichever way the gate opens', () => {
    const cases: Partial<HomeCardAccessInput>[] = [
      {},
      { isQuestOpen: () => false },
      { card: storyCard },
      { card: storyCard, isStoryLocked: () => true },
      { card: storyCard, entries: [] },
      { card: storyCard, entries: [], isQuestOpen: () => false },
    ];
    for (const c of cases) {
      for (const opensDirectly of [false, true]) {
        expect(look(c)).toBe(homeCardLock(input({ ...c, opensDirectly })) !== null);
      }
    }
  });
});

describe('Home wires the tap-time check (source guard: the mobile lane does not render screens)', () => {
  const src = readFileSync(join(__dirname, '..', '..', '..', 'screens', 'home', 'HomeScreen.tsx'), 'utf8');
  const start = src.indexOf('const openCard = ');
  const openCard = start < 0 ? '' : src.slice(start);

  it('checks access before any other open, so a locked card never reaches QuestPlayer or StoryReader', () => {
    const lockAt = openCard.indexOf('openLocked(card)');
    expect(lockAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(openCard.indexOf('openStory(card)'));
    expect(lockAt).toBeLessThan(openCard.indexOf("'QuestPlayer'"));
  });

  it('judges with the same story lock the mission was built with', () => {
    expect(src).toContain('homeCardLock(');
    expect(src).toMatch(/isStoryLocked\b[\s\S]*isLocked: isStoryLocked/);
  });
});

describe('Home draws a pinned card that became locked (source guard, PR 4.8f)', () => {
  const src = readFileSync(join(__dirname, '..', '..', '..', 'screens', 'home', 'HomeScreen.tsx'), 'utf8');
  const tileStart = src.indexOf('function MissionTile(');
  const tile = tileStart < 0 ? '' : src.slice(tileStart, src.indexOf('\nfunction ', tileStart + 1));

  it('derives the locked look with the same inputs as the tap', () => {
    expect(src).toMatch(/locked=\{isHomeCardLocked\(\{ card, entries: storyIndex, isQuestOpen: questOpen, isStoryLocked \}\)\}/);
  });

  it('shows the Not open yet word with the dotted ring, never a lock glyph or the word locked', () => {
    expect(tile).toMatch(/\{locked \? \(\s*<View[^>]*>\s*<TagMark kind="notOpen"/);
    expect(tile).toMatch(/m\.learner\.access\.notOpen/);
    expect(tile).not.toMatch(/name=["']lock["']/);
  });

  it('says it in the label and gives the ask as the hint', () => {
    expect(tile).toMatch(/m\.learner\.home\.lockedCard\.a11y\(/);
    expect(tile).toMatch(/accessibilityHint=\{locked \? askHint : undefined\}/);
    expect(src).toMatch(/askHint=\{ask\.label\}/);
  });
});
