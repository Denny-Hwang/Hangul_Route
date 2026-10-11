import { describe, expect, it, vi } from 'vitest';
import type { PlayResult, PlaySpec } from '../controller';
import { speakCompat } from '../speak-compat';

const flush = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await Promise.resolve();
};

function run(result: PlayResult, opts: Parameters<typeof speakCompat>[2]) {
  const play = vi.fn(async (_spec: PlaySpec) => result);
  speakCompat(play, '가', opts);
  return play;
}

describe('speakCompat (the old speak(text, opts) callbacks over playPrompt)', () => {
  it('plays the text as a Korean word prompt by default', async () => {
    const play = run('played', {});
    expect(play).toHaveBeenCalledWith({ text: '가', language: 'ko-KR', kind: 'word' });
    await flush();
  });

  it('passes language and kind through', async () => {
    const play = run('played', { language: 'en-US', kind: 'narration' });
    expect(play).toHaveBeenCalledWith({ text: '가', language: 'en-US', kind: 'narration' });
    await flush();
  });

  it('played and muted end in onDone', async () => {
    for (const result of ['played', 'muted'] as const) {
      const onDone = vi.fn();
      const onError = vi.fn();
      run(result, { onDone, onError });
      await flush();
      expect(onDone, result).toHaveBeenCalledTimes(1);
      expect(onError, result).not.toHaveBeenCalled();
    }
  });

  it('unavailable goes to onError when given, else to onDone', async () => {
    const onDone = vi.fn();
    const onError = vi.fn();
    run('unavailable', { onDone, onError });
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    const onDone2 = vi.fn();
    run('unavailable', { onDone: onDone2 });
    await flush();
    expect(onDone2).toHaveBeenCalledTimes(1);
  });

  it('works with no callbacks', async () => {
    run('unavailable', {});
    run('played', {});
    await flush();
  });
});
