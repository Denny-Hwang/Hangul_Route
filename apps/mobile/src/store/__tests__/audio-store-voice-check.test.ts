import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({ readJson: vi.fn(async () => null), writeJson: vi.fn(async () => undefined) }));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));

/**
 * The voice check's answer hold (`voiceCheckPending`, AMENDMENTS-TOUCH: nothing moves under a finger): open from the
 * platform's first unknown report until it knows, or `VOICE_CHECK_HOLD_MAX_MS`; once closed, never again. A fresh store
 * module per case, as the hold opens once per app run.
 */
type Store = typeof import('../audio-store');
const UNKNOWN = { tts: { state: 'unknown' as const }, clips: false, unlocked: false };
const NONE = { tts: { state: 'none' as const, reason: 'no_korean_voice' as const }, clips: false, unlocked: false };
const READY = { tts: { state: 'ready' as const, voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'enhanced' as const }, clips: false, unlocked: true };

let store: Store;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  store = await import('../audio-store');
});

afterEach(() => {
  vi.useRealTimers();
});

const pending = (): boolean => store.useAudioStore.getState().voiceCheckPending;

describe('voiceCheckPending', () => {
  it('starts closed (no platform has reported: a screen test, a store with no engine yet)', () => {
    expect(pending()).toBe(false);
  });

  it('opens on the first unknown report, stays open while unknown, and closes when the check knows', () => {
    store.useAudioStore.getState().setCapability(UNKNOWN);
    expect(pending()).toBe(true);
    store.useAudioStore.getState().setCapability({ ...UNKNOWN, unlocked: true });
    expect(pending()).toBe(true);
    store.useAudioStore.getState().setCapability(NONE);
    expect(pending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a ready voice closes it too', () => {
    store.useAudioStore.getState().setCapability(UNKNOWN);
    store.useAudioStore.getState().setCapability(READY);
    expect(pending()).toBe(false);
  });

  it('an engine that never answers: the cap closes it at VOICE_CHECK_HOLD_MAX_MS, and a later unknown report does not reopen it', () => {
    store.useAudioStore.getState().setCapability(UNKNOWN);
    vi.advanceTimersByTime(store.VOICE_CHECK_HOLD_MAX_MS - 1);
    expect(pending()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(pending()).toBe(false);
    store.useAudioStore.getState().setCapability({ ...UNKNOWN, unlocked: true });
    expect(pending()).toBe(false);
  });

  it('opens once per app run: unknown after a known report does not reopen it', () => {
    store.useAudioStore.getState().setCapability(UNKNOWN);
    store.useAudioStore.getState().setCapability(NONE);
    store.useAudioStore.getState().setCapability(UNKNOWN);
    expect(pending()).toBe(false);
  });

  it('endVoiceCheckHold closes it for good and clears the cap', () => {
    store.useAudioStore.getState().setCapability(UNKNOWN);
    store.endVoiceCheckHold();
    expect(pending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    store.useAudioStore.getState().setCapability(UNKNOWN);
    expect(pending()).toBe(false);
  });

  it('endVoiceCheckHold before any report: the first unknown report does not open it', () => {
    store.endVoiceCheckHold();
    store.useAudioStore.getState().setCapability(UNKNOWN);
    expect(pending()).toBe(false);
  });
});
