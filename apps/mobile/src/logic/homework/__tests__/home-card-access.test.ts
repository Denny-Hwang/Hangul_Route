import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StoryIndexEntry } from '../../story/story-index';
import { questId, story } from '../../story/__tests__/shelf-fixture';
import { homeCardLock, type HomeCardAccessInput } from '../home-card-access';
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

  it('a story card whose quest closed is locked too', () => {
    expect(homeCardLock(input({ card: storyCard, isQuestOpen: () => false }))).toEqual({ gate: PIN_GATE, storyId: 'story:tiger' });
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

describe('Home wires the tap-time check (source guard: the mobile lane does not render screens)', () => {
  const src = readFileSync(join(__dirname, '..', '..', '..', 'screens', 'home', 'HomeScreen.tsx'), 'utf8');
  const openCard = /const openCard = \(card: MissionCard\): void => \{([\s\S]*?)\n {2}\};/.exec(src)?.[1] ?? '';

  it('checks access before any other open, so a locked card never reaches QuestPlayer or StoryReader', () => {
    const lines = openCard.trim().split('\n');
    expect(lines[0]?.trim()).toBe('if (openLocked(card)) return;');
    expect(openCard.indexOf('openLocked(card)')).toBeLessThan(openCard.indexOf('openStory(card)'));
  });

  it('judges with the same quest access and story lock the mission was built with, through the grown-up gate', () => {
    expect(src).toMatch(/homeCardLock\(\{ card, entries: storyIndex, isQuestOpen: questOpen, isStoryLocked, opensDirectly: gateOpensDirectlyNow\(\) \}\)/);
    expect(src).toMatch(/isLocked: isStoryLocked,/);
    expect(src).toMatch(/name: 'story\.locked\.tapped', profileId: profile\?\.id, payload: \{ storyId: lock\.storyId \}/);
  });
});
