import { APP_ROUTES, type BrowsePass } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  BROWSE_LESSON_ROUTES,
  closeAction,
  entryStack,
  navigationCheck,
  openedEvent,
  readBootFragment,
  type BrowseRouteName,
} from '../boot';
import type { ResolvedPass } from '../pass';

/** F-BROWSE-001 BR-6 (sections 4.1, 4.3, 4.4, 9): what the browse root does with its address, its pass and its first event. */
const T0 = Date.parse('2026-10-12T09:00:00.000Z');
const MIN = 60_000;
const ALL_ROUTES: ReadonlySet<BrowseRouteName> = new Set<BrowseRouteName>(['BrowseHome', 'BrowseEpisode', 'BrowseItem', 'CardDetail', 'BrowseAccess']);
const BR6_ROUTES: ReadonlySet<BrowseRouteName> = new Set<BrowseRouteName>(['BrowseHome', 'BrowseAccess']);

const active = (over: Partial<Extract<ResolvedPass, { status: 'active' }>> = {}): ResolvedPass => ({
  status: 'active',
  scope: 'full',
  from: 'account',
  fallback: false,
  removeSession: false,
  removeKept: false,
  ...over,
});
const none: ResolvedPass = { status: 'none', reason: 'none', expiredSource: null, removeSession: false, removeKept: false };
const gatePass = (over: Partial<BrowsePass> = {}): BrowsePass => ({ v: 1, scope: 'full', source: 'gate', issuedAt: T0, seen: T0, ...over });
const accountPass = (over: Partial<BrowsePass> = {}): BrowsePass => ({ v: 1, scope: 'sampler', source: 'account', issuedAt: T0, seen: T0, ...over });

describe('readBootFragment', () => {
  it('reads the target and the source of a valid fragment, with or without the #', () => {
    expect(readBootFragment('#t=quest:stage1-letters-q1&s=report')).toEqual({ target: { kind: 'quest', id: 'quest:stage1-letters-q1' }, source: 'report' });
    expect(readBootFragment('s=gate')).toEqual({ target: null, source: 'gate' });
    expect(readBootFragment('#t=char:%E3%84%B4&s=roster')).toEqual({ target: { kind: 'char', char: 'ㄴ' }, source: 'roster' });
  });

  it('an empty or bad fragment opens home as a direct visit (nothing else is logged)', () => {
    for (const raw of ['', '#', '#t=quest:&s=report', '#t=nope:1&s=nav', '#s=email', '#t=stage:stage1', `#s=nav&t=${'x'.repeat(300)}`, '#accountId=1&s=nav']) {
      expect(readBootFragment(raw), raw).toEqual({ target: null, source: 'direct' });
    }
  });
});

describe('openedEvent', () => {
  it('names the source, the scope, where the pass came from and whether the app works offline; never a person', () => {
    expect(openedEvent({ source: 'gate', pass: active({ from: 'gate', scope: 'sampler' }), offlineReady: true })).toEqual({
      name: 'browse.opened',
      payload: { source: 'gate', scope: 'sampler', passFrom: 'gate', offlineReady: true },
    });
    expect(openedEvent({ source: 'direct', pass: active({ from: 'kept' }), offlineReady: false })).toEqual({
      name: 'browse.opened',
      payload: { source: 'direct', scope: 'full', passFrom: 'kept', offlineReady: false },
    });
    const event = openedEvent({ source: 'report', pass: none, offlineReady: true });
    expect(event).toEqual({ name: 'browse.opened', payload: { source: 'report', scope: 'none', passFrom: 'none', offlineReady: true } });
    expect(event).not.toHaveProperty('profileId');
  });
});

describe('entryStack', () => {
  it('home: the section, the stage row and the note travel as params; null is the default section', () => {
    expect(entryStack({ screen: 'home', section: null }, ALL_ROUTES)).toEqual([{ name: 'BrowseHome', params: {} }]);
    expect(entryStack({ screen: 'home', section: 'journey', stage: 'stage2' }, ALL_ROUTES)).toEqual([{ name: 'BrowseHome', params: { section: 'journey', stage: 'stage2' } }]);
    expect(entryStack({ screen: 'home', section: null, note: 'not-in-version' }, ALL_ROUTES)).toEqual([{ name: 'BrowseHome', params: { note: 'not-in-version' } }]);
    expect(entryStack({ screen: 'home', section: 'journey', stage: 'stage1', note: 'letter-across-stage1' }, ALL_ROUTES)).toEqual([
      { name: 'BrowseHome', params: { section: 'journey', stage: 'stage1', note: 'letter-across-stage1' } },
    ]);
  });

  it('a page opens over home, so its back goes home; a card opens over the Library', () => {
    expect(entryStack({ screen: 'episode', episodeId: 'episode:stage1-letters' }, ALL_ROUTES)).toEqual([
      { name: 'BrowseHome', params: {} },
      { name: 'BrowseEpisode', params: { episodeId: 'episode:stage1-letters' } },
    ]);
    expect(entryStack({ screen: 'item', kind: 'quest', id: 'quest:stage1-letters-q2', focusJamoId: 'jamo:nieun' }, ALL_ROUTES)).toEqual([
      { name: 'BrowseHome', params: {} },
      { name: 'BrowseItem', params: { kind: 'quest', id: 'quest:stage1-letters-q2', focusJamoId: 'jamo:nieun' } },
    ]);
    expect(entryStack({ screen: 'item', kind: 'story', id: 'story:sun-and-moon' }, ALL_ROUTES)).toEqual([
      { name: 'BrowseHome', params: {} },
      { name: 'BrowseItem', params: { kind: 'story', id: 'story:sun-and-moon' } },
    ]);
    expect(entryStack({ screen: 'card', cardId: 'card:hangul' }, ALL_ROUTES)).toEqual([
      { name: 'BrowseHome', params: { section: 'library' } },
      { name: 'CardDetail', params: { cardId: 'card:hangul' } },
    ]);
  });

  it('the Access screen stands alone: no lesson, title or card under it', () => {
    expect(entryStack({ screen: 'access', reason: 'expired', source: 'gate' }, ALL_ROUTES)).toEqual([{ name: 'BrowseAccess', params: { reason: 'expired', source: 'gate' } }]);
  });

  it('a screen this build does not register yet lands on home, never on a missing route', () => {
    expect(entryStack({ screen: 'item', kind: 'quest', id: 'quest:stage1-letters-q2' }, BR6_ROUTES)).toEqual([{ name: 'BrowseHome', params: {} }]);
    expect(entryStack({ screen: 'episode', episodeId: 'episode:stage1-letters' }, BR6_ROUTES)).toEqual([{ name: 'BrowseHome', params: {} }]);
    expect(entryStack({ screen: 'card', cardId: 'card:hangul' }, BR6_ROUTES)).toEqual([{ name: 'BrowseHome', params: { section: 'library' } }]);
    expect(entryStack({ screen: 'home', section: 'journey', stage: 'stage1' }, BR6_ROUTES)).toEqual([{ name: 'BrowseHome', params: { section: 'journey', stage: 'stage1' } }]);
  });
});

describe('navigationCheck', () => {
  it('an active session pass gets a fresh seen at most once a minute', () => {
    expect(navigationCheck({ resolved: active({ from: 'gate' }), session: gatePass(), now: T0 + 30_000, from: 'BrowseHome', to: 'BrowseHome' })).toEqual({ write: null, expired: false });
    expect(navigationCheck({ resolved: active({ from: 'gate' }), session: gatePass(), now: T0 + MIN, from: 'BrowseHome', to: 'BrowseItem' })).toEqual({
      write: gatePass({ seen: T0 + MIN }),
      expired: false,
    });
    expect(navigationCheck({ resolved: active(), session: accountPass(), now: T0 + 2 * MIN, from: null, to: 'BrowseHome' })).toEqual({
      write: accountPass({ seen: T0 + 2 * MIN }),
      expired: false,
    });
  });

  it('a pass that ran out sends the next navigation to the Access screen', () => {
    expect(navigationCheck({ resolved: active({ from: 'gate' }), session: gatePass(), now: T0 + 15 * MIN, from: 'BrowseHome', to: 'BrowseItem' })).toEqual({ write: null, expired: true });
    expect(navigationCheck({ resolved: active(), session: accountPass(), now: T0 + 12 * 60 * MIN, from: 'BrowseItem', to: 'BrowseHome' })).toEqual({ write: null, expired: true });
  });

  it('a lesson that started before the pass ran out continues to its end; the end screen is the last step', () => {
    const late = { resolved: active({ from: 'gate' }), session: gatePass(), now: T0 + 16 * MIN };
    expect(navigationCheck({ ...late, from: 'PreviewQuest', to: 'Minigame' })).toEqual({ write: null, expired: false });
    expect(navigationCheck({ ...late, from: 'Minigame', to: 'PreviewQuest' })).toEqual({ write: null, expired: false });
    expect(navigationCheck({ ...late, from: 'StoryReader', to: 'StorySources' })).toEqual({ write: null, expired: false });
    expect(navigationCheck({ ...late, from: 'PreviewQuest', to: 'PreviewEnd' })).toEqual({ write: null, expired: false });
    // After the end screen, and when a new lesson starts, the pass decides again.
    expect(navigationCheck({ ...late, from: 'PreviewEnd', to: 'PreviewQuest' })).toEqual({ write: null, expired: true });
    expect(navigationCheck({ ...late, from: 'PreviewEnd', to: 'BrowseItem' })).toEqual({ write: null, expired: true });
    expect(navigationCheck({ ...late, from: 'BrowseItem', to: 'PreviewQuest' })).toEqual({ write: null, expired: true });
    expect(BROWSE_LESSON_ROUTES).toEqual(['PreviewQuest', 'Minigame', 'StoryReader', 'StorySources', 'PreviewEnd']);
  });

  it('a kept pass holds for the tab; no pass, nothing to check', () => {
    expect(navigationCheck({ resolved: active({ from: 'kept' }), session: null, now: T0 + 30 * 24 * 60 * MIN, from: 'BrowseHome', to: 'BrowseItem' })).toEqual({ write: null, expired: false });
    expect(navigationCheck({ resolved: none, session: null, now: T0, from: null, to: 'BrowseAccess' })).toEqual({ write: null, expired: false });
    // A kept pass that took over from an expired session pass never reads that session pass again.
    expect(navigationCheck({ resolved: active({ from: 'kept' }), session: gatePass(), now: T0 + 20 * MIN, from: 'BrowseHome', to: 'BrowseItem' })).toEqual({ write: null, expired: false });
  });
});

describe('closeAction', () => {
  it('goes back when the tab came from a page of this origin', () => {
    for (const from of ['account', 'gate', 'kept'] as const) {
      expect(closeAction({ sameOriginReferrer: true, from, lastPersona: null })).toEqual({ kind: 'back' });
    }
  });

  it('an account pass with no referrer goes to the persona home, else to sign-in', () => {
    expect(closeAction({ sameOriginReferrer: false, from: 'account', lastPersona: 'parent' })).toEqual({ kind: 'assign', url: APP_ROUTES.parentHome });
    expect(closeAction({ sameOriginReferrer: false, from: 'account', lastPersona: 'teacher' })).toEqual({ kind: 'assign', url: APP_ROUTES.teacherHome });
    expect(closeAction({ sameOriginReferrer: false, from: 'account', lastPersona: null })).toEqual({ kind: 'assign', url: APP_ROUTES.signIn });
  });

  it('a gate or kept pass with no referrer goes to the learner app, never to an account page', () => {
    expect(closeAction({ sameOriginReferrer: false, from: 'gate', lastPersona: 'parent' })).toEqual({ kind: 'assign', url: '/' });
    expect(closeAction({ sameOriginReferrer: false, from: 'kept', lastPersona: 'teacher' })).toEqual({ kind: 'assign', url: '/' });
  });
});
