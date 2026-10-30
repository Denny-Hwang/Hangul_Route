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
