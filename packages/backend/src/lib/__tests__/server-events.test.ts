import { LECTURE_DECODE_FAILURES, LECTURE_PRESETS, REPORT_TELEMETRY_PAYLOAD, type TelemetryEventName } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../store';
import { MAX_EVENTS, appendEvent, keptEventFields, recordServerEvent } from '../server-events';

/**
 * The Worker's own telemetry (F-REPORT-001 section 3.13): the console has no
 * telemetry client, so the report routes record `report.viewed` themselves,
 * into the same capped in-memory log as POST /api/telemetry and through the
 * same codes-only filter (section 3.10).
 */
const NOW = new Date('2026-10-11T12:00:00.000Z');

beforeEach(() => {
  store.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('recordServerEvent', () => {
  it('appends a report.viewed event with codes only, stamped with the server time', () => {
    const event = recordServerEvent('report.viewed', { scope: 'learner', space: 'family', period: 'week' });
    expect(event).toMatchObject({ name: 'report.viewed', payload: { scope: 'learner', space: 'family', period: 'week' }, at: NOW.toISOString(), receivedAt: NOW.toISOString() });
    expect(event?.id).toMatch(/^event:/);
    expect(event?.profileId).toBeUndefined();
    expect(store.events).toEqual([event]);
  });

  it('applies the report.* filter: identifiers, names and values off the enum never reach the log', () => {
    const event = recordServerEvent('report.viewed', {
      scope: 'class',
      space: 'class',
      period: 'year',
      spaceId: 'space:class-a',
      learnerId: 'profile:suni',
      profileId: 'profile:suni',
      name: 'Suni',
    });
    expect(event?.payload).toEqual({ scope: 'class', space: 'class' });
    expect(Object.keys(event ?? {})).not.toContain('profileId');
    expect(recordServerEvent('report.viewed', { scope: 'space:class-a' })?.payload).toBeUndefined();
    expect(recordServerEvent('report.viewed')?.payload).toBeUndefined();
  });

  it('accepts every documented code', () => {
    for (const scope of REPORT_TELEMETRY_PAYLOAD.scope) {
      for (const space of REPORT_TELEMETRY_PAYLOAD.space) {
        for (const period of REPORT_TELEMETRY_PAYLOAD.period) {
          expect(recordServerEvent('report.viewed', { scope, space, period })?.payload).toEqual({ scope, space, period });
        }
      }
    }
  });

  it('applies the other codes-only filters too, and keeps an ordinary payload as given', () => {
    expect(recordServerEvent('space.transfer.completed', { initiator: 'learner_side', spaceId: 'space:a' })?.payload).toEqual({ initiator: 'learner_side' });
    expect(recordServerEvent('shell.path_bounced', { prefix: 'teach', next: '/teach/space?id=space:a' })?.payload).toEqual({ prefix: 'teach' });
    expect(recordServerEvent('route_map.viewed', { from: 'home' })?.payload).toEqual({ from: 'home' });
  });

  it('validates the name against the shared list and records nothing for an unknown one', () => {
    expect(recordServerEvent('report.opened' as TelemetryEventName, { scope: 'learner' })).toBeNull();
    expect(recordServerEvent('' as TelemetryEventName)).toBeNull();
    expect(store.events).toHaveLength(0);
  });

  it('shares the 10k cap with POST /api/telemetry', () => {
    store.events = Array.from({ length: MAX_EVENTS }, (_, i) => ({ id: `event:${i}`, name: 'session.start', at: NOW.toISOString() }));
    recordServerEvent('report.viewed', { scope: 'learner', space: 'class', period: 'day' });
    expect(MAX_EVENTS).toBe(10_000);
    expect(store.events).toHaveLength(MAX_EVENTS);
    expect(store.events[0]?.id).toBe('event:1');
    expect(store.events.at(-1)?.name).toBe('report.viewed');
  });
});

describe('keptEventFields (the codes-only filter shared with POST /api/telemetry)', () => {
  it('keeps the profile id and payload of an ordinary event', () => {
    expect(keptEventFields('quest.complete', { questId: 'quest:x' }, 'profile:a')).toEqual({ profileId: 'profile:a', payload: { questId: 'quest:x' } });
  });

  it('drops a non-string profile id', () => {
    expect(keptEventFields('quest.complete', undefined, 7)).toEqual({ profileId: undefined, payload: undefined });
  });

  it('never keeps a profile id on a codes-only event, and keeps only its codes', () => {
    expect(keptEventFields('report.viewed', { scope: 'learner', other: 'x' }, 'profile:a')).toEqual({ profileId: undefined, payload: { scope: 'learner' } });
    expect(keptEventFields('shell.unlisted' as TelemetryEventName, { prefix: 'teach' }, 'profile:a')).toEqual({ profileId: undefined, payload: undefined });
  });

  it('never keeps a profile id on a notes event, and keeps only its documented fields (F-FEEDBACK-001 section 10)', () => {
    const opened = { presetId: 'next_try_this', fromRole: 'teacher', hasText: true, hasSuggest: true, suggestOpen: false };
    expect(keptEventFields('notes.note_opened', opened, 'profile:a')).toEqual({ profileId: undefined, payload: opened });
    expect(keptEventFields('notes.note_opened', { unread: 1 }, 'profile:a')).toEqual({ profileId: undefined, payload: undefined });
    expect(keptEventFields('notes.report_sent', undefined, 'profile:a')).toEqual({ profileId: undefined, payload: undefined });
  });

  it('drops note text, ids, labels and a profile id placed inside a notes payload', () => {
    const smuggled = {
      profileId: 'profile:a',
      noteId: 'note:0b7c2f9e-1d2a',
      batchId: 'batch:1',
      spaceId: 'space:class-a',
      accountId: 'acct:1',
      label: 'mom',
      text: 'See you at 3 at the park',
      name: 'Suni',
    };
    expect(keptEventFields('notes.note_opened', { ...smuggled, presetId: 'effort_proud', fromRole: 'family' }, 'profile:a')).toEqual({
      profileId: undefined,
      payload: { presetId: 'effort_proud', fromRole: 'family' },
    });
    expect(keptEventFields('notes.card_shown', { ...smuggled, unread: 2 }, undefined)).toEqual({ profileId: undefined, payload: { unread: 2 } });
    expect(keptEventFields('notes.prefs_changed', smuggled, undefined)).toEqual({ profileId: undefined, payload: undefined });
  });

  it('keeps each notes field only in its documented shape', () => {
    // codes from the shared lists only
    expect(keptEventFields('notes.note_opened', { presetId: 'effort_brand_new', fromRole: 'school' }, undefined).payload).toBeUndefined();
    expect(keptEventFields('notes.reaction_picked', { reaction: 'wow', fromRole: 'family', changed: 'yes' }, undefined).payload).toEqual({ fromRole: 'family' });
    expect(keptEventFields('notes.reaction_picked', { reaction: 'did_it', fromRole: 'teacher', changed: true }, undefined).payload).toEqual({
      reaction: 'did_it',
      fromRole: 'teacher',
      changed: true,
    });
    expect(keptEventFields('notes.suggest_started', { fromRole: 'teacher', questId: 'quest:x' }, undefined).payload).toEqual({ fromRole: 'teacher' });
    expect(keptEventFields('notes.report_sent', { reason: 'unsafe', via: 'grown_up_zone' }, undefined).payload).toEqual({ reason: 'unsafe', via: 'grown_up_zone' });
    expect(keptEventFields('notes.report_sent', { reason: 'mean', via: 'console' }, undefined).payload).toBeUndefined();
    expect(keptEventFields('notes.prefs_changed', { classes: 'presets' }, undefined).payload).toEqual({ classes: 'presets' });
    expect(keptEventFields('notes.prefs_changed', { classes: 'quiet' }, undefined).payload).toBeUndefined();
    // counts are whole numbers 0-30 (the inbox holds at most 30 notes, section 6.8 rule 7)
    expect(keptEventFields('notes.list_viewed', { notes: 30, unread: 0 }, undefined).payload).toEqual({ notes: 30, unread: 0 });
    expect(keptEventFields('notes.list_viewed', { notes: 31, unread: -1 }, undefined).payload).toBeUndefined();
    expect(keptEventFields('notes.card_shown', { unread: 1.5 }, undefined).payload).toBeUndefined();
    expect(keptEventFields('notes.card_shown', { unread: '2' }, undefined).payload).toBeUndefined();
    // a notes name without rules keeps nothing
    expect(keptEventFields('notes.unlisted' as TelemetryEventName, { unread: 1 }, 'profile:a')).toEqual({ profileId: undefined, payload: undefined });
  });
});

describe('billing events (F-BILL-002 section 10: recorded by the Worker only, codes only)', () => {
  it('records the three webhook names with their codes and no profile id', () => {
    expect(recordServerEvent('billing.checkout_completed', { planKey: 'family_lifetime', mode: 'test', duplicate: false })?.payload).toEqual({ planKey: 'family_lifetime', mode: 'test', duplicate: false });
    expect(recordServerEvent('billing.payment_failed', { planKey: 'group_license', mode: 'live' })?.payload).toEqual({ planKey: 'group_license', mode: 'live' });
    expect(recordServerEvent('billing.refund_recorded', { planKey: 'family_lifetime', full: true, mode: 'test' })?.payload).toEqual({ planKey: 'family_lifetime', full: true, mode: 'test' });
    expect(store.events.every((e) => e.profileId === undefined)).toBe(true);
  });

  it('drops ids, amounts, currencies, codes, URLs and values off the lists, whatever a caller passes', () => {
    const smuggled = {
      accountId: 'acct:1',
      spaceId: 'space:fam',
      learnerId: 'profile:suni',
      profileId: 'profile:suni',
      amountCents: 1530,
      currency: 'usd',
      promoCode: 'HOYA20',
      url: 'https://pay.stripe.com/receipts/x',
      invoice: 'in_1',
    };
    expect(keptEventFields('billing.checkout_completed', { ...smuggled, planKey: 'group_license', mode: 'test', duplicate: true }, 'profile:a')).toEqual({
      profileId: undefined,
      payload: { planKey: 'group_license', mode: 'test', duplicate: true },
    });
    expect(keptEventFields('billing.payment_failed', { planKey: 'gold', mode: 'prod', duplicate: true }, undefined).payload).toBeUndefined();
    expect(keptEventFields('billing.refund_recorded', { planKey: 'school_seat', full: 'yes', mode: 'none' }, undefined).payload).toEqual({ planKey: 'school_seat', mode: 'none' });
    // `duplicate` belongs to the completion only, `full` to the refund only.
    expect(keptEventFields('billing.payment_failed', { planKey: 'family_lifetime', mode: 'test', full: true, duplicate: false }, undefined).payload).toEqual({ planKey: 'family_lifetime', mode: 'test' });
    expect(keptEventFields('billing.unlisted' as TelemetryEventName, { planKey: 'family_lifetime' }, 'profile:a')).toEqual({ profileId: undefined, payload: undefined });
  });
});

describe('checkout and portal billing events (F-BILL-002 B-5, section 10)', () => {
  it('keeps planKey, mode, the promo flag and the refusal reason, and nothing else', () => {
    const smuggled = { spaceId: 'space:fam', accountId: 'acct:1', promoCode: 'HOYA20', url: 'https://checkout.stripe.com/c/1', amountCents: 1530 };
    expect(keptEventFields('billing.checkout_started', { ...smuggled, planKey: 'family_lifetime', mode: 'test', promo: true }, 'profile:a')).toEqual({
      profileId: undefined,
      payload: { planKey: 'family_lifetime', mode: 'test', promo: true },
    });
    for (const reason of ['reverify_required', 'already_active', 'live_not_enabled', 'not_configured']) {
      expect(keptEventFields('billing.checkout_refused', { ...smuggled, planKey: 'group_license', reason }, undefined).payload).toEqual({ planKey: 'group_license', reason });
    }
    expect(keptEventFields('billing.checkout_refused', { planKey: 'group_license', reason: 'forbidden', mode: 'test' }, undefined).payload).toEqual({ planKey: 'group_license' });
    expect(keptEventFields('billing.portal_opened', { ...smuggled, planKey: 'group_license', mode: 'live', promo: true }, undefined).payload).toEqual({ planKey: 'group_license', mode: 'live' });
    expect(keptEventFields('billing.checkout_started', { planKey: 'family_lifetime', mode: 'test', promo: 'HOYA20' }, undefined).payload).toEqual({ planKey: 'family_lifetime', mode: 'test' });
  });
});

describe('billing home events (F-BILL-002 B-4, section 10)', () => {
  it('keeps the counts and the mode only', () => {
    const smuggled = { spaceId: 'space:fam', accountId: 'acct:1', names: ['Kim family'] };
    expect(keptEventFields('billing.summary_viewed', { ...smuggled, cards: 3, payerCards: 1, mode: 'test' }, 'profile:a')).toEqual({ profileId: undefined, payload: { cards: 3, payerCards: 1, mode: 'test' } });
    expect(keptEventFields('billing.receipts_viewed', { ...smuggled, rows: 50 }, undefined).payload).toEqual({ rows: 50 });
    for (const bad of [-1, 1.5, '3', Number.NaN, null]) expect(keptEventFields('billing.receipts_viewed', { rows: bad }, undefined).payload).toBeUndefined();
  });
});

describe('lecture events (AMENDMENTS-LECTURE-V2 section 11: codes and bounded counts only, no profile id)', () => {
  // What the shipped presenter sends (apps/mobile/src/logic/lecture/shell.ts startPayload / completePayload,
  // tools.ts TOOL_NAMES, PresenterApp.tsx lecture.deck_rejected), plus the LV-3 `preset` source.
  const start = { source: 'console', blocks: 4, slides: 61, skipped: 2, picker: 'numbers', romanization: 'always', voice: 'ready', offlineReady: true };

  it('every key the shipped client sends survives, for every documented value', () => {
    expect(keptEventFields('lecture.start', start, 'profile:a')).toEqual({ profileId: undefined, payload: start });
    for (const source of ['console', 'quick', 'recent']) expect(keptEventFields('lecture.start', { ...start, source }, undefined).payload).toEqual({ ...start, source });
    for (const picker of ['none', 'names', 'initials', 'numbers']) expect(keptEventFields('lecture.start', { ...start, picker }, undefined).payload?.picker).toBe(picker);
    for (const voice of ['ready', 'none', 'unknown']) expect(keptEventFields('lecture.start', { ...start, voice }, undefined).payload?.voice).toBe(voice);
    expect(keptEventFields('lecture.start', { ...start, romanization: 'tap', offlineReady: false }, undefined).payload).toEqual({ ...start, romanization: 'tap', offlineReady: false });
    for (const preset of LECTURE_PRESETS) {
      expect(keptEventFields('lecture.start', { ...start, source: 'preset', preset }, undefined).payload).toEqual({ ...start, source: 'preset', preset });
    }
    const complete = { slidesShown: 40, minutes: 22, reveals: 130 };
    expect(keptEventFields('lecture.complete', complete, 'profile:a')).toEqual({ profileId: undefined, payload: complete });
    for (const tool of ['timer', 'picker', 'blank', 'pause', 'grid', 'fullscreen']) {
      expect(keptEventFields('lecture.tool_used', { tool }, undefined).payload).toEqual({ tool });
    }
    for (const reason of LECTURE_DECODE_FAILURES) expect(keptEventFields('lecture.deck_rejected', { reason }, undefined).payload).toEqual({ reason });
  });

  it('the bounds: 0 to 30 blocks, 0 to 10000 slides and skips, 600 minutes, 100000 reveals, whole numbers only', () => {
    const edge = { ...start, blocks: 30, slides: 10_000, skipped: 10_000 };
    expect(keptEventFields('lecture.start', edge, undefined).payload).toEqual(edge);
    expect(keptEventFields('lecture.start', { ...start, blocks: 0, slides: 0, skipped: 0 }, undefined).payload).toMatchObject({ blocks: 0, slides: 0, skipped: 0 });
    expect(keptEventFields('lecture.complete', { slidesShown: 10_000, minutes: 600, reveals: 100_000 }, undefined).payload).toEqual({
      slidesShown: 10_000,
      minutes: 600,
      reveals: 100_000,
    });
    for (const bad of [-1, 2.5, '4', Number.NaN, Number.POSITIVE_INFINITY, null, true]) {
      expect(keptEventFields('lecture.start', { ...start, blocks: bad }, undefined).payload).not.toHaveProperty('blocks');
      expect(keptEventFields('lecture.complete', { slidesShown: bad, minutes: 1, reveals: 1 }, undefined).payload).toEqual({ minutes: 1, reveals: 1 });
    }
    // One past each bound is dropped.
    expect(keptEventFields('lecture.start', { ...start, blocks: 31, slides: 10_001, skipped: 10_001 }, undefined).payload).toEqual({
      source: 'console',
      picker: 'numbers',
      romanization: 'always',
      voice: 'ready',
      offlineReady: true,
    });
    expect(keptEventFields('lecture.complete', { slidesShown: 10_001, minutes: 601, reveals: 100_001 }, undefined).payload).toBeUndefined();
    expect(keptEventFields('lecture.complete', { slidesShown: 1, minutes: 601, reveals: 100_001 }, undefined).payload).toEqual({ slidesShown: 1 });
  });

  it('preset is kept only with source preset', () => {
    expect(keptEventFields('lecture.start', { ...start, source: 'preset', preset: 'warm-up' }, undefined).payload).toEqual({ ...start, source: 'preset', preset: 'warm-up' });
    for (const source of ['console', 'quick', 'recent', 'plan', undefined]) {
      expect(keptEventFields('lecture.start', { ...start, source, preset: 'warm-up' }, undefined).payload).not.toHaveProperty('preset');
    }
    expect(keptEventFields('lecture.start', { preset: 'warm-up' }, undefined).payload).toBeUndefined();
  });

  it('drops an extra key (a name, a deck title or id), the profile id, and codes off their lists', () => {
    const smuggled = { name: 'Minho', title: 'Week 3 with Minho', deckId: 'lecture:abc123', labels: ['Minho', 'Sora'], profileId: 'profile:a' };
    expect(keptEventFields('lecture.start', { ...start, ...smuggled }, 'profile:a')).toEqual({ profileId: undefined, payload: start });
    expect(keptEventFields('lecture.complete', { slidesShown: 3, ...smuggled }, 'profile:a')).toEqual({ profileId: undefined, payload: { slidesShown: 3 } });
    expect(keptEventFields('lecture.tool_used', { tool: 'Minho', ...smuggled }, undefined).payload).toBeUndefined();
    expect(keptEventFields('lecture.deck_rejected', { reason: 'Minho' }, undefined).payload).toBeUndefined();
    const off = keptEventFields('lecture.start', { ...start, source: 'plan', preset: 'everything', picker: 'Minho', romanization: 'never', voice: 'loud', offlineReady: 'yes' }, undefined);
    expect(off.payload).toEqual({ blocks: 4, slides: 61, skipped: 2 });
    expect(keptEventFields('lecture.start', undefined, 'profile:a')).toEqual({ profileId: undefined, payload: undefined });
    expect(JSON.stringify(keptEventFields('lecture.start', { ...start, ...smuggled }, 'profile:a'))).not.toContain('Minho');
  });
});

describe('[SA] seat and rename events (AMENDMENTS-SEATS-ADMINS section 8: codes only, no profile id)', () => {
  it('space.seat_refused keeps kind, reason and path from their lists only', () => {
    expect(keptEventFields('space.seat_refused', { kind: 'family', reason: 'cap_family', path: 'join', spaceId: 'space:x', name: 'Kim family' }, 'profile:a')).toEqual({ profileId: undefined, payload: { kind: 'family', reason: 'cap_family', path: 'join' } });
    expect(keptEventFields('space.seat_refused', { kind: 'school', reason: 'cap_teacher', path: 'space:x' }, undefined)).toEqual({ profileId: undefined, payload: undefined });
    for (const reason of ['cap_class', 'cap_school', 'cap_learner']) expect(keptEventFields('space.seat_refused', { kind: 'class', reason, path: 'move' }, undefined).payload).toEqual({ kind: 'class', reason, path: 'move' });
  });

  it('space.renamed keeps kind and role only, never the name', () => {
    const event = recordServerEvent('space.renamed', { kind: 'school', role: 'admin', name: 'Maple School', spaceId: 'space:x', accountId: 'dean' });
    expect(event?.payload).toEqual({ kind: 'school', role: 'admin' });
    expect(JSON.stringify(store.events)).not.toMatch(/Maple|space:x|dean/);
    expect(keptEventFields('space.renamed', { kind: 'class', role: 'caregiver' }, undefined).payload).toEqual({ kind: 'class' });
  });
});

describe('appendEvent', () => {
  it('pushes and trims from the front once past the cap', () => {
    store.events = Array.from({ length: MAX_EVENTS }, (_, i) => ({ id: `event:${i}`, name: 'session.start', at: NOW.toISOString() }));
    const event = { id: 'event:new', name: 'session.end', at: NOW.toISOString() };
    expect(appendEvent(event)).toBe(event);
    expect(store.events).toHaveLength(MAX_EVENTS);
    expect(store.events[0]?.id).toBe('event:1');
  });
});
