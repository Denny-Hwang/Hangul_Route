import { describe, expect, it, vi } from 'vitest';
import type { PlayResult, PlaySpec } from '../../audio/controller';
import { createAudioRunner } from '../audio-runner';

const en = (text: string): PlaySpec => ({ text, language: 'en-US', kind: 'narration', source: 'story-reader' });
const ko = (text: string): PlaySpec => ({ text, language: 'ko-KR', kind: 'word', source: 'story-reader' });

/** A fake `playPrompt` whose every call waits until the test settles it. */
function fakePlayer() {
  const calls: Array<{ spec: PlaySpec; settle: (r: PlayResult) => void; fail: (e: unknown) => void }> = [];
  const playPrompt = vi.fn(
    (spec: PlaySpec) =>
      new Promise<PlayResult>((resolve, reject) => {
        calls.push({ spec, settle: resolve, fail: reject });
      }),
  );
  return { calls, playPrompt };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

describe('createAudioRunner (F-STORY-002 §3.2)', () => {
  it('plays the steps in order, one at a time, and reports played', async () => {
    const { calls, playPrompt } = fakePlayer();
    const onStatus = vi.fn();
    const runner = createAudioRunner({ playPrompt, onStatus });
    const done = runner.play([en('Long ago, King '), ko('세종'), en(' wanted it.')]);
    expect(runner.isPlaying()).toBe(true);
    await flush();
    expect(calls.map((c) => c.spec.text)).toEqual(['Long ago, King ']);
    calls[0]!.settle('played');
    await flush();
    expect(calls.map((c) => c.spec.text)).toEqual(['Long ago, King ', '세종']);
    calls[1]!.settle('played');
    await flush();
    calls[2]!.settle('played');
    await expect(done).resolves.toBe('played');
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith({ status: 'played' });
    expect(runner.isPlaying()).toBe(false);
  });

  it('muted or unavailable on a Korean step ends the chain; the English that follows is skipped too', async () => {
    for (const result of ['muted', 'unavailable'] as const) {
      const { calls, playPrompt } = fakePlayer();
      const onStatus = vi.fn();
      const runner = createAudioRunner({ playPrompt, onStatus });
      const done = runner.play([en('A '), ko('한글'), en(' B'), ko('한글날')]);
      await flush();
      calls[0]!.settle('played');
      await flush();
      calls[1]!.settle(result);
      await expect(done).resolves.toBe(result);
      expect(calls).toHaveLength(2);
      expect(onStatus).toHaveBeenCalledWith({ status: result });
      expect(runner.isPlaying()).toBe(false);
    }
  });

  it('a muted English step ends the chain as well (sound is off for everything)', async () => {
    const { calls, playPrompt } = fakePlayer();
    const runner = createAudioRunner({ playPrompt });
    const done = runner.play([en('A'), ko('한글')]);
    await flush();
    calls[0]!.settle('muted');
    await expect(done).resolves.toBe('muted');
    expect(calls).toHaveLength(1);
  });

  it('stop() ends the chain even when the superseded prompt resolves played, and cuts the voice', async () => {
    const { calls, playPrompt } = fakePlayer();
    const onStatus = vi.fn();
    const stopVoice = vi.fn();
    const runner = createAudioRunner({ playPrompt, onStatus, stop: stopVoice });
    const done = runner.play([en('A'), ko('한글')]);
    await flush();
    runner.stop();
    expect(stopVoice).toHaveBeenCalledTimes(1);
    expect(runner.isPlaying()).toBe(false);
    calls[0]!.settle('played');
    await expect(done).resolves.toBe('superseded');
    expect(calls).toHaveLength(1);
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('a newer play() ends the old chain; only the newer one reports', async () => {
    const { calls, playPrompt } = fakePlayer();
    const onStatus = vi.fn();
    const runner = createAudioRunner({ playPrompt, onStatus });
    const first = runner.play([en('old 1'), en('old 2')]);
    await flush();
    const second = runner.play([ko('새')]);
    await flush();
    calls[0]!.settle('played'); // F-AUDIO-004 resolves the superseded prompt as played
    await expect(first).resolves.toBe('superseded');
    expect(calls.map((c) => c.spec.text)).toEqual(['old 1', '새']);
    expect(runner.isPlaying()).toBe(true);
    calls[1]!.settle('played');
    await expect(second).resolves.toBe('played');
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(runner.isPlaying()).toBe(false);
  });

  it('a prompt that throws is reported as unavailable and never escapes', async () => {
    const { calls, playPrompt } = fakePlayer();
    const onStatus = vi.fn();
    const runner = createAudioRunner({ playPrompt, onStatus });
    const done = runner.play([ko('한글'), en('B')]);
    await flush();
    calls[0]!.fail(new Error('engine gone'));
    await expect(done).resolves.toBe('unavailable');
    expect(calls).toHaveLength(1);
    expect(onStatus).toHaveBeenCalledWith({ status: 'unavailable' });
  });

  it('a throw from a superseded prompt stays silent', async () => {
    const { calls, playPrompt } = fakePlayer();
    const onStatus = vi.fn();
    const runner = createAudioRunner({ playPrompt, onStatus });
    const done = runner.play([ko('한글')]);
    await flush();
    runner.stop();
    calls[0]!.fail(new Error('cancelled'));
    await expect(done).resolves.toBe('superseded');
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('an empty plan plays nothing and reports nothing; stop() with nothing playing is harmless', async () => {
    const { playPrompt } = fakePlayer();
    const onStatus = vi.fn();
    const runner = createAudioRunner({ playPrompt, onStatus });
    await expect(runner.play([])).resolves.toBe('played');
    expect(playPrompt).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalled();
    expect(runner.isPlaying()).toBe(false);
    expect(() => runner.stop()).not.toThrow();
  });
});
