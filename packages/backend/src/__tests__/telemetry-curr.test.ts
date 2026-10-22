import { CURR_TELEMETRY_EVENT_NAMES, TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { recordServerEvent } from '../lib/server-events';
import { store } from '../store';

/**
 * POST /api/telemetry for the F-CURR-002 names (section 11.3, TELEMETRY-NAMES-2 section R, row
 * CM-3; Worker first, so this ships before any app sends them). A payload is stored only when it
 * parses against its strict schema (ids, codes, counts and buckets only); otherwise the event is
 * still accepted and stored without it, as a non-object payload is today. `profileId` stays in
 * the envelope, except for the account-level, Worker-side and lecture names. `space.goal.*` is
 * server-only: a client POST is refused with 422 and only `recordServerEvent` stores it.
 */
type Stored = { name: string; profileId?: string; payload?: Record<string, unknown> };
const NOW = new Date('2026-10-21T12:00:00.000Z');

async function post(body: unknown) {
  const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as { ok: boolean; data?: { event: Stored } } };
}

beforeEach(() => {
  store.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const PER_PROFILE: Array<[string, Record<string, unknown>]> = [
  [
    'memory.daily',
    {
      hist: [{ kind: 'lex', rung: 'read', lag: '4-7', right: 3, wrong: 1 }],
      lapses: 0,
      items: 4,
      newHeld: 2,
      minutes: 9,
      durableWeekBucket: '1-4',
      dueVolumeBucket: '10-19',
      arms: {},
    },
  ],
  [
    'memory.daily',
    { hist: [], lapses: 0, items: 0, newHeld: 0, minutes: 0, durableWeekBucket: '0', dueVolumeBucket: '0' },
  ],
  ['items.seeded', { countBucket: '500-999', spreadDaysBucket: '31+' }],
  ['mastery.level_up', { cellId: 'episode:stage2-nature', level: 1 }],
  ['stage.card_opened', { stage: 'stage2' }],
  ['testout.finished', { cellId: 'episode:stage3-crafts', passed: false, items: 8, firstTryCorrect: 5 }],
  ['quest.adapt', { questId: 'quest:stage3-life-q2', dir: 'scaffold' }],
  ['goal.set', { daily: 3, weeklyDays: 3 }],
  ['goal.met', { points: 4, target: 3 }],
  ['week.goal_met', { days: 3, target: 3 }],
  ['decode.sprint.finished', { rateBucket: '30-39', probeRateBucket: '20-29', sprintIndexBucket: '1' }],
  ['stamp.earned', { stampId: 'stamp:first-cell' }],
  ['weekly_quest.complete', { questKind: 'finish-stories' }],
  ['pack.opened', { packId: 'pack:numbers-time' }],
  ['pack.level_complete', { packId: 'pack:numbers-time', stage: 'stage2' }],
  ['exp.exposure', { experimentId: 'E2', arm: 'a' }],
];
const SERVER_ONLY = ['space.goal.set', 'space.goal.met'] as const;
const NO_PROFILE: Array<[string, Record<string, unknown>]> = [
  ['family.goal_met', { weekTarget: 60 }],
  ['lecture.game.finished', { preset: 'yut-race', rounds: 10, teams: 2 }],
];

describe('POST /api/telemetry, F-CURR-002 section 11.3 names (CM-3, Worker first)', () => {
  it('lists all nineteen names on the shared list the Worker accepts', () => {
    for (const name of CURR_TELEMETRY_EVENT_NAMES) expect(TELEMETRY_EVENT_NAMES, name).toContain(name);
    expect(new Set([...PER_PROFILE, ...NO_PROFILE].map(([n]) => n)).size + SERVER_ONLY.length).toBe(CURR_TELEMETRY_EVENT_NAMES.length);
  });

  it('accepts each per-profile name and stores its payload as sent, with the profile id in the envelope', async () => {
    for (const [name, payload] of PER_PROFILE) {
      const r = await post({ name, profileId: 'profile:suni', payload });
      expect(r.status, name).toBe(201);
    }
    expect(store.events.map((e) => [e.name, e.profileId, e.payload])).toEqual(PER_PROFILE.map(([n, p]) => [n, 'profile:suni', p]));
  });

  it('never stores a profile id on family.goal_met or lecture.game.finished', async () => {
    for (const [name, payload] of NO_PROFILE) expect((await post({ name, profileId: 'profile:suni', payload })).status, name).toBe(201);
    expect(store.events.map((e) => [e.name, e.profileId, e.payload])).toEqual(NO_PROFILE.map(([n, p]) => [n, undefined, p]));
  });

  it('refuses a client-sent space.goal.set or space.goal.met with 422 and stores nothing', async () => {
    for (const name of SERVER_ONLY) {
      const r = await post({ name, profileId: 'profile:suni', payload: { metric: 'stories', target: 20 } });
      expect(r.status, name).toBe(422);
      expect(r.body.ok).toBe(false);
    }
    expect(store.events).toHaveLength(0);
  });

  it('drops a payload that carries an extra key, a profile id or free text, and keeps the event', async () => {
    const smuggled: Array<[string, Record<string, unknown>]> = [
      ['goal.met', { points: 4, target: 3, profileId: 'profile:suni' }],
      ['stamp.earned', { stampId: 'Great job, Suni!' }],
      ['weekly_quest.complete', { questKind: 'finish-stories', text: 'my own sentence' }],
      ['memory.daily', { ...(PER_PROFILE[0]?.[1] ?? {}), hist: [{ kind: 'lex', rung: 'read', lag: '4-7', right: 1, wrong: 0, itemId: 'lex:sagwa' }] }],
      ['lecture.game.finished', { preset: 'team-relay', rounds: 3, teams: 2, deckTitle: 'Class 3B' }],
    ];
    for (const [name, payload] of smuggled) {
      const r = await post({ name, profileId: 'profile:suni', payload });
      expect(r.status, name).toBe(201);
      expect(r.body.data?.event.payload, name).toBeUndefined();
    }
    expect(store.events.every((e) => e.payload === undefined)).toBe(true);
  });

  it('accepts a section R name with no payload at all', async () => {
    const r = await post({ name: 'mastery.level_up', profileId: 'profile:suni' });
    expect(r.status).toBe(201);
    expect(r.body.data?.event).toMatchObject({ name: 'mastery.level_up', profileId: 'profile:suni' });
    expect(r.body.data?.event.payload).toBeUndefined();
  });

  it("stores week.goal_met with a weekly plan's days a week as its target (CM-17, F-PLAN-002 paces 2 and 4)", async () => {
    for (const target of [2, 4]) {
      const r = await post({ name: 'week.goal_met', profileId: 'profile:suni', payload: { days: target, target } });
      expect(r.status).toBe(201);
      expect(r.body.data?.event.payload).toEqual({ days: target, target });
    }
  });

  it('records space.goal.* on the Worker side with its metric and target, no profile id, and the same strict filter', () => {
    expect(recordServerEvent('space.goal.set', { metric: 'stories', target: 20 })).toMatchObject({ name: 'space.goal.set', payload: { metric: 'stories', target: 20 } });
    expect(recordServerEvent('space.goal.met', { metric: 'quests', target: 12 })).toMatchObject({ name: 'space.goal.met', payload: { metric: 'quests', target: 12 } });
    expect(recordServerEvent('space.goal.met', { metric: 'stories', target: 20, spaceId: 'space:class-a' })).toMatchObject({ name: 'space.goal.met', payload: undefined });
    expect(store.events.every((e) => e.profileId === undefined)).toBe(true);
  });
});

describe('POST /api/telemetry, session.end with the three optional CM-3 fields', () => {
  const older = { durationSeconds: 420, streakDays: 3 };

  it('stores an older client payload unchanged', async () => {
    const r = await post({ name: 'session.end', profileId: 'profile:suni', payload: older });
    expect(r.status).toBe(201);
    expect(r.body.data?.event).toMatchObject({ profileId: 'profile:suni', payload: older });
  });

  it('stores the new fields when they have their documented values', async () => {
    const payload = { ...older, questLeft: 1, leftAtKind: 'realia-read', afterWrongStreak: 2 };
    const r = await post({ name: 'session.end', profileId: 'profile:suni', payload });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.payload).toEqual(payload);
    expect((await post({ name: 'session.end', payload: { ...older, questLeft: 0, afterWrongStreak: 0 } })).body.data?.event.payload).toEqual({ ...older, questLeft: 0, afterWrongStreak: 0 });
  });

  it('drops a new field off its codes and keeps the rest of the payload', async () => {
    const r = await post({ name: 'session.end', profileId: 'profile:suni', payload: { ...older, questLeft: 'yes', leftAtKind: 'Suni', afterWrongStreak: 5 } });
    expect(r.status).toBe(201);
    expect(r.body.data?.event).toMatchObject({ profileId: 'profile:suni', payload: older });
    expect(r.body.data?.event.payload).toEqual(older);
    const partial = await post({ name: 'session.end', payload: { ...older, questLeft: 1, leftAtKind: 'free text' } });
    expect(partial.body.data?.event.payload).toEqual({ ...older, questLeft: 1 });
  });

  it('keeps a session.end key that is not a CM-3 field, as before CM-3 (lenient on purpose)', async () => {
    const payload = { ...older, someLegacyKey: 'x', questLeft: 1 };
    const r = await post({ name: 'session.end', profileId: 'profile:suni', payload });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.payload).toEqual(payload);
  });

  it('still drops a non-object session.end payload instead of rejecting the event', async () => {
    expect((await post({ name: 'session.end', payload: 'nope' })).body.data?.event.payload).toBeUndefined();
    expect((await post({ name: 'session.end' })).status).toBe(201);
  });
});
