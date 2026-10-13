import { describe, expect, it } from 'vitest';
import { questsAll } from '../../content';
import {
  backToOpenLessons,
  episodeAccessView,
  playerGuard,
  PREVIEW_FROM,
  previewFromOf,
  previewOpenedEvent,
  startedFromEpisode,
  taughtLetters,
} from '../episode-access';
import type { PlanView, RouteNext } from '../route-next';

const plan = (questIds: string[]): PlanView => ({
  leadingSourceId: 'route:self',
  leadingKind: 'self',
  inPlanQuestIds: new Set(questIds),
  inPlanEpisodeIds: new Set(['episode:stage1-life']),
});
const NO_PLAN: PlanView = { leadingSourceId: null, leadingKind: null, inPlanQuestIds: new Set(), inPlanEpisodeIds: new Set() };
const next = (questId: string, episodeId = 'episode:stage1-life'): RouteNext => ({
  kind: 'quest',
  questId,
  episodeId,
  stage: 'stage1',
  source: 'self',
  sourceId: 'route:self',
});

describe('episodeAccessView (F-ENT-003 section 3.7, wireframe episode/detail-access-preview)', () => {
  const ids = ['q1', 'q2', 'q3'];

  it('A. subscriber with a plan: Play again on a played quest, Next and In your plan tags, an off-plan row with no tag', () => {
    const view = episodeAccessView({
      questIds: ids,
      starsOf: (id) => (id === 'q1' ? 2 : 0),
      isQuestOpen: () => true,
      next: next('q2'),
      plan: plan(['q2']),
    });
    expect(view.preview).toBe(false);
    expect(view.rows).toEqual([
      { questId: 'q1', action: 'replay', next: false, inPlan: false },
      { questId: 'q2', action: 'start', next: true, inPlan: true },
      { questId: 'q3', action: 'start', next: false, inPlan: false },
    ]);
  });

  it("A'. no plan: only the Next tag", () => {
    const view = episodeAccessView({ questIds: ids, starsOf: () => 0, isQuestOpen: () => true, next: next('q1'), plan: NO_PLAN });
    expect(view.rows.map((r) => [r.next, r.inPlan])).toEqual([
      [true, false],
      [false, false],
      [false, false],
    ]);
  });

  it('B. preview: a closed row shows Not open yet in place of Start, a kept row keeps Play again', () => {
    const view = episodeAccessView({
      questIds: ['a', 'b'],
      starsOf: (id) => (id === 'b' ? 2 : 0),
      isQuestOpen: (id) => id === 'b',
      next: { kind: 'free-end', placedOut: false },
      plan: NO_PLAN,
    });
    expect(view.preview).toBe(true);
    expect(view.rows).toEqual([
      { questId: 'a', action: 'closed', next: false, inPlan: false },
      { questId: 'b', action: 'replay', next: false, inPlan: false },
    ]);
  });

  it("B'. every quest kept: no caption and no preview card (it is an open lesson)", () => {
    const view = episodeAccessView({ questIds: ['a'], starsOf: () => 1, isQuestOpen: () => true, next: { kind: 'rest' }, plan: NO_PLAN });
    expect(view.preview).toBe(false);
    expect(view.rows[0]?.action).toBe('replay');
  });

  it('a closed row is never Next or In your plan, whatever the inputs say', () => {
    const view = episodeAccessView({ questIds: ['a'], starsOf: () => 0, isQuestOpen: () => false, next: next('a'), plan: plan(['a']) });
    expect(view.rows[0]).toEqual({ questId: 'a', action: 'closed', next: false, inPlan: false });
  });

  it('error state: no next and no plan (unreadable) leaves every Start live and no tag', () => {
    const view = episodeAccessView({ questIds: ids, starsOf: () => 0, isQuestOpen: () => true, next: null, plan: null });
    expect(view.preview).toBe(false);
    expect(view.rows.every((r) => r.action === 'start' && !r.next && !r.inPlan)).toBe(true);
  });
});

describe('backToOpenLessons', () => {
  it("goes to the one next's lesson page", () => {
    expect(backToOpenLessons(next('quest:stage1-life-q2'), 'food')).toEqual({ kind: 'episode', episodeId: 'episode:stage1-life' });
  });

  it('at free-end: the first free word topic, or the Library when none is playable', () => {
    expect(backToOpenLessons({ kind: 'free-end', placedOut: false }, 'food')).toEqual({ kind: 'topic', topicKey: 'food' });
    expect(backToOpenLessons({ kind: 'free-end', placedOut: true }, null)).toEqual({ kind: 'library' });
  });

  it('at rest or with no next: the Journey', () => {
    expect(backToOpenLessons({ kind: 'rest' }, 'food')).toEqual({ kind: 'journey' });
    expect(backToOpenLessons(null, 'food')).toEqual({ kind: 'journey' });
  });
});

describe('previewOpenedEvent and previewFromOf', () => {
  it('sends stable codes only: stage, theme and where the page was opened from', () => {
    expect(previewOpenedEvent('p1', 'stage2', 'life', 'journey')).toEqual({
      name: 'access.preview_opened',
      profileId: 'p1',
      payload: { stage: 'stage2', theme: 'life', from: 'journey' },
    });
    expect(previewOpenedEvent(undefined, 'stage4', 'rites', 'player')).toEqual({
      name: 'access.preview_opened',
      payload: { stage: 'stage4', theme: 'rites', from: 'player' },
    });
  });

  it('reads a known surface and falls back to the Journey for anything else', () => {
    for (const from of PREVIEW_FROM) expect(previewFromOf(from)).toBe(from);
    expect(previewFromOf(undefined)).toBe('journey');
  });
});

describe('startedFromEpisode', () => {
  it('names route.next_started { surface: episode } only for the one next', () => {
    expect(startedFromEpisode('p1', next('q2'), 'q2')).toEqual({
      name: 'route.next_started',
      profileId: 'p1',
      payload: { source: 'self', surface: 'episode' },
    });
    expect(startedFromEpisode('p1', next('q2'), 'q3')).toBeNull();
    expect(startedFromEpisode('p1', { kind: 'rest' }, 'q3')).toBeNull();
    expect(startedFromEpisode(undefined, next('q2'), 'q2')).toBeNull();
    expect(startedFromEpisode('p1', null, 'q2')).toBeNull();
  });
});

describe('playerGuard (section 3.6, guard at the point of play)', () => {
  it('replaces the player with the lesson page in preview when the quest is closed', () => {
    expect(playerGuard(() => false, 'quest:stage2-life-q1', 'episode:stage2-life')).toEqual({
      episodeId: 'episode:stage2-life',
      from: 'player',
    });
  });

  it('lets an open quest play', () => {
    expect(playerGuard(() => true, 'quest:stage1-letters-q1', 'episode:stage1-letters')).toBeNull();
  });
});

describe('taughtLetters (the preview shows what a closed quest teaches)', () => {
  it('lists the letters a quest introduces, each with its romanization, once', () => {
    const quest = questsAll.find((q) => q.id === 'quest:stage1-letters-q1');
    expect(quest).toBeDefined();
    const letters = taughtLetters(quest!);
    expect(letters.length).toBeGreaterThan(0);
    for (const l of letters) expect(l.romanization.length).toBeGreaterThan(0);
    expect(new Set(letters.map((l) => l.ko)).size).toBe(letters.length);
  });

  it('is empty for a quest that teaches no letter (a Stage 2 taste)', () => {
    const quest = questsAll.find((q) => q.id === 'quest:stage2-life-q1');
    expect(quest).toBeDefined();
    expect(taughtLetters(quest!)).toEqual([]);
  });
});
