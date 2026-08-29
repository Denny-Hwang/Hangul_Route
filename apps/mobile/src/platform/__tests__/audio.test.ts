import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn(),
}));

import * as Speech from 'expo-speech';
import { isMuted, playJamoSound, setMuted, speak, stop } from '../audio';

type SpeakOpts = { language?: string; rate?: number; onDone?: () => void };

describe('platform/audio (TTS wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMuted(false);
  });

  it('speak stops previous speech and speaks Korean with kid-calibrated defaults', () => {
    speak('가');
    expect(Speech.stop).toHaveBeenCalledTimes(1);
    const [text, opts] = vi.mocked(Speech.speak).mock.calls[0] as [string, SpeakOpts];
    expect(text).toBe('가');
    expect(opts.language).toBe('ko-KR');
    expect(opts.rate).toBeLessThan(1); // slower than adult speech
  });

  it('while muted, speak does not call TTS but still fires onDone', () => {
    setMuted(true);
    const onDone = vi.fn();
    speak('나', { onDone });
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('setMuted(true) stops in-flight speech; isMuted reflects state', () => {
    expect(isMuted()).toBe(false);
    setMuted(true);
    expect(Speech.stop).toHaveBeenCalled();
    expect(isMuted()).toBe(true);
  });

  it('stop delegates to the TTS engine', () => {
    stop();
    expect(Speech.stop).toHaveBeenCalledTimes(1);
  });

  it('playJamoSound resolves when TTS reports done', async () => {
    vi.mocked(Speech.speak).mockImplementation((_t, opts) => {
      (opts as SpeakOpts | undefined)?.onDone?.();
    });
    await expect(playJamoSound('ㄱ')).resolves.toBeUndefined();
  });
});
