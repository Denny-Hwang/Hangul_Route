import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADVANCE_MAX_MS, ANSWER_SOUND_MAX_MS } from '../reply-advance';
import { SCREEN_SETTLE_MS } from '../settle';
import { SENTENCE_SOUND_MAX_MS, createSoundPacing, soundCapMs } from '../sound-pacing';

/** [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3 and QS-4: a game screen's two waits for its sounds. */

const deferred = (): { promise: Promise<string>; end: () => void; fail: () => void } => {
  let end: () => void = () => undefined;
  let fail: () => void = () => undefined;
  const promise = new Promise<string>((resolve, reject) => {
    end = () => resolve('played');
    fail = () => reject(new Error('engine'));
  });
  return { promise, end, fail };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('sound pacing: the caps', () => {
  it('a sentence gets the long cap, anything else 2500 ms', () => {
    expect(SENTENCE_SOUND_MAX_MS).toBe(ADVANCE_MAX_MS);
    expect(soundCapMs('sentence')).toBe(6000);
    expect(soundCapMs('narration')).toBe(6000);
    expect(soundCapMs('word')).toBe(ANSWER_SOUND_MAX_MS);
    expect(soundCapMs('sound')).toBe(2500);
    expect(soundCapMs(undefined)).toBe(2500);
  });
});

describe('sound pacing: after an answer (QS-4)', () => {
  it('with nothing sounding it is the game\'s own delay, as before', () => {
    const pacing = createSoundPacing();
    const run = vi.fn();
    pacing.after(700, run);
    vi.advanceTimersByTime(699);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('holds the advance until the answer\'s sound ends', async () => {
    const pacing = createSoundPacing();
    const sound = deferred();
    const run = vi.fn();
    expect(pacing.track(sound.promise)).toBe(sound.promise);
    pacing.after(700, run);
    await vi.advanceTimersByTimeAsync(1800);
    expect(run).not.toHaveBeenCalled();
    sound.end();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a sound that already ended does not add to the delay', async () => {
    const pacing = createSoundPacing();
    const run = vi.fn();
    pacing.track(Promise.resolve('played'));
    pacing.after(700, run);
    await vi.advanceTimersByTimeAsync(699);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a sound that fails releases the advance like one that ends', async () => {
    const pacing = createSoundPacing();
    const sound = deferred();
    const run = vi.fn();
    pacing.track(sound.promise);
    pacing.after(700, run);
    await vi.advanceTimersByTimeAsync(900);
    sound.fail();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('releases at the cap (2500 ms from the answer) when the sound does not end', async () => {
    const pacing = createSoundPacing();
    const run = vi.fn();
    pacing.track(new Promise<void>(() => undefined));
    pacing.after(700, run);
    await vi.advanceTimersByTimeAsync(ANSWER_SOUND_MAX_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a sentence waits up to the long cap', async () => {
    const pacing = createSoundPacing();
    const run = vi.fn();
    pacing.track(new Promise<void>(() => undefined));
    pacing.after(700, run, SENTENCE_SOUND_MAX_MS);
    await vi.advanceTimersByTimeAsync(SENTENCE_SOUND_MAX_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('the sound started after the wait was asked for (the same answer) is the one waited for', async () => {
    const pacing = createSoundPacing();
    const sound = deferred();
    const run = vi.fn();
    pacing.after(700, run);
    pacing.track(sound.promise);
    await vi.advanceTimersByTimeAsync(1200);
    expect(run).not.toHaveBeenCalled();
    sound.end();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a sound started during the wait (a speaker tapped again) is waited for too, inside the same cap', async () => {
    const pacing = createSoundPacing();
    const first = deferred();
    const second = deferred();
    const run = vi.fn();
    pacing.track(first.promise);
    pacing.after(700, run);
    await vi.advanceTimersByTimeAsync(1000);
    pacing.track(second.promise);
    first.end(); // superseded
    await vi.advanceTimersByTimeAsync(100);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(ANSWER_SOUND_MAX_MS - 1100);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a cancelled wait never runs, whatever the sound does', async () => {
    const pacing = createSoundPacing();
    const sound = deferred();
    const run = vi.fn();
    pacing.track(sound.promise);
    const cancel = pacing.after(700, run);
    await vi.advanceTimersByTimeAsync(900);
    cancel();
    sound.end();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a zero least wait (reduced motion) still waits for the sound', async () => {
    const pacing = createSoundPacing();
    const sound = deferred();
    const run = vi.fn();
    pacing.track(sound.promise);
    pacing.after(0, run);
    await vi.advanceTimersByTimeAsync(500);
    expect(run).not.toHaveBeenCalled();
    sound.end();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a cap no longer than the least wait is the least wait alone', async () => {
    const pacing = createSoundPacing();
    const run = vi.fn();
    pacing.track(new Promise<void>(() => undefined));
    pacing.after(1000, run, 800);
    await vi.advanceTimersByTimeAsync(999);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('something that is not a promise (nothing was played) clears what is waited for', async () => {
    const pacing = createSoundPacing();
    const run = vi.fn();
    pacing.track(new Promise<void>(() => undefined));
    expect(pacing.track(undefined)).toBeUndefined();
    pacing.after(700, run);
    await vi.advanceTimersByTimeAsync(700);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('dispose drops every pending wait', async () => {
    const pacing = createSoundPacing();
    const run = vi.fn();
    pacing.track(new Promise<void>(() => undefined));
    pacing.after(700, run);
    pacing.after(900, run);
    await vi.advanceTimersByTimeAsync(800);
    pacing.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('sound pacing: the screen\'s own first sound (QS-3)', () => {
  it('waits 350 ms for the screen', () => {
    const pacing = createSoundPacing();
    const play = vi.fn();
    pacing.opening(play);
    vi.advanceTimersByTime(SCREEN_SETTLE_MS - 1);
    expect(play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('a sound started first (a tap on the speaker) drops it: nothing is said twice', () => {
    const pacing = createSoundPacing();
    const play = vi.fn();
    pacing.opening(play);
    vi.advanceTimersByTime(100);
    pacing.track(Promise.resolve('played'));
    vi.advanceTimersByTime(10_000);
    expect(play).not.toHaveBeenCalled();
  });

  it('the opening sound itself may be tracked when it plays', () => {
    const pacing = createSoundPacing();
    const play = vi.fn(() => void pacing.track(Promise.resolve('played')));
    pacing.opening(play);
    vi.advanceTimersByTime(SCREEN_SETTLE_MS);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('cancelOpening and dispose drop it; a new opening replaces one still waiting', () => {
    const pacing = createSoundPacing();
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    pacing.opening(a);
    pacing.cancelOpening();
    pacing.cancelOpening();
    pacing.opening(b);
    pacing.opening(c);
    vi.advanceTimersByTime(SCREEN_SETTLE_MS);
    expect([a.mock.calls.length, b.mock.calls.length, c.mock.calls.length]).toEqual([0, 0, 1]);
    pacing.opening(a);
    pacing.dispose();
    vi.advanceTimersByTime(10_000);
    expect(a).not.toHaveBeenCalled();
  });
});
