import { AudioSourceSummaryPayloadSchema, isTelemetryEventName } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import app from '../index';
import { keptEventFields, recordServerEvent } from '../lib/server-events';
import { store } from '../store';

/**
 * POST /api/telemetry for `audio.source_summary` (AMENDMENTS-AUDIO-CLIPS AC-B9; Worker first, so this ships before
 * the app sends it): four counts and the app version, kept only when the payload parses against its strict schema,
 * and never a profile id, so no event links a device's audio to a learner.
 */
type Stored = { name: string; profileId?: string; payload?: Record<string, unknown> };

async function post(body: unknown) {
  const res = await app.request('/api/telemetry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as { ok: boolean; data?: { event: Stored } } };
}

const SUMMARY = { clip: 2, say: 9, tts: 5, text: 1, appVersion: '1.0.0' };

beforeEach(() => store.reset());

describe('POST /api/telemetry: audio.source_summary (AC-B9)', () => {
  it('is on the shared list and accepted', async () => {
    expect(isTelemetryEventName('audio.source_summary')).toBe(true);
    const r = await post({ name: 'audio.source_summary', payload: SUMMARY });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.payload).toEqual(SUMMARY);
    expect(AudioSourceSummaryPayloadSchema.parse(r.body.data?.event.payload)).toEqual(SUMMARY);
  });

  it('never stores the profile id the envelope carries', async () => {
    const r = await post({ name: 'audio.source_summary', profileId: 'profile_1', payload: SUMMARY });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.profileId).toBeUndefined();
    expect(store.events.at(-1)?.profileId).toBeUndefined();
  });

  it.each([
    ['an extra key (a text)', { ...SUMMARY, sample: '가' }],
    ['an extra key (a ref)', { ...SUMMARY, ref: 'audio/say/0123456789abcdef.mp3' }],
    ['an extra key (a url)', { ...SUMMARY, url: 'https://app.hangulroute.com/' }],
    ['a fractional count', { ...SUMMARY, say: 1.5 }],
    ['a negative count', { ...SUMMARY, tts: -1 }],
    ['a missing count', { clip: 1, say: 1, tts: 1, appVersion: '1.0.0' }],
    ['a free-text version', { ...SUMMARY, appVersion: 'build by Alice' }],
  ])('keeps the event but drops a payload with %s', async (_label, payload) => {
    const r = await post({ name: 'audio.source_summary', profileId: 'profile_1', payload });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.payload).toBeUndefined();
    expect(r.body.data?.event.profileId).toBeUndefined();
  });

  it('a non-object payload is dropped too', () => {
    expect(keptEventFields('audio.source_summary', undefined, 'p1')).toEqual({ profileId: undefined, payload: undefined });
  });

  it('the Worker path keeps the same fields', () => {
    expect(recordServerEvent('audio.source_summary', { ...SUMMARY, extra: 1 })?.payload).toBeUndefined();
    expect(recordServerEvent('audio.source_summary', SUMMARY)?.payload).toEqual(SUMMARY);
  });

  it('the other audio names keep their payload and profile id as before', () => {
    const payload = { kind: 'clip', reason: 'decode', code: 'none', source: 'discover' };
    expect(keptEventFields('audio.playback_failed', payload, 'p1')).toEqual({ profileId: 'p1', payload });
  });
});

/**
 * `audio.fallback_shown` (AMENDMENTS-AUDIO-CANT-HEAR CH-4, OD-CH2 (b); Worker first): only `{ source, reason }` is
 * kept and never a profile id, so a count of "the learner could not hear" cannot be linked to a child's profile.
 */
describe('POST /api/telemetry: audio.fallback_shown (CH-4)', () => {
  it.each(['muted', 'no_voice', 'error', 'blocked', 'asked'])('stores reason %s from a child profile without the profile id', async (reason) => {
    const r = await post({ name: 'audio.fallback_shown', profileId: 'child_profile_1', payload: { source: 'match-sound', reason } });
    expect(r.status).toBe(201);
    expect(r.body.data?.event.profileId).toBeUndefined();
    expect(r.body.data?.event.payload).toEqual({ source: 'match-sound', reason });
    expect(store.events.at(-1)?.profileId).toBeUndefined();
    expect(store.events.at(-1)?.payload).toEqual({ source: 'match-sound', reason });
  });

  it('keeps only source and reason: an extra key (a profile id, a name, a text) is dropped', () => {
    const kept = keptEventFields('audio.fallback_shown', { source: 'discover', reason: 'asked', profileId: 'p1', name: 'Alice', text: '가' }, 'p1');
    expect(kept).toEqual({ profileId: undefined, payload: { source: 'discover', reason: 'asked' } });
  });

  it.each([
    ['an unknown reason', { source: 'discover', reason: 'deaf' }, { source: 'discover' }],
    ['a free-text source', { source: 'Alice reads 가', reason: 'asked' }, { reason: 'asked' }],
    ['an over-long source', { source: 'a'.repeat(41), reason: 'asked' }, { reason: 'asked' }],
    ['a non-string source', { source: 7, reason: 'asked' }, { reason: 'asked' }],
  ])('drops a field that does not fit: %s', (_label, payload, expected) => {
    expect(keptEventFields('audio.fallback_shown', payload, 'p1')).toEqual({ profileId: undefined, payload: expected });
  });

  it('a missing or empty payload keeps no payload and no profile id', () => {
    expect(keptEventFields('audio.fallback_shown', undefined, 'p1')).toEqual({ profileId: undefined, payload: undefined });
    expect(keptEventFields('audio.fallback_shown', { nothing: 1 }, 'p1')).toEqual({ profileId: undefined, payload: undefined });
  });

  it('every source the app sends today fits', () => {
    for (const source of ['match-sound', 'discover', 'listen-pick', 'story-check', 'vocab-card', 'vocab-speed', 'type-hangul-hear', 'presenter', 'quest-review']) {
      expect(keptEventFields('audio.fallback_shown', { source, reason: 'muted' }, 'p1').payload).toEqual({ source, reason: 'muted' });
    }
  });
});
