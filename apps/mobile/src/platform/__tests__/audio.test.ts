import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn(),
  getAvailableVoicesAsync: vi.fn(),
}));

import * as Speech from 'expo-speech';
import { isMuted, playJamoSound, playPrompt, setMuted, speak, stop } from '../audio';

type SpeakOpts = {
  language?: string;
  rate?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: () => void;
};

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

  it('speak keeps routing an engine error to onDone when the caller gave no onError', () => {
    vi.mocked(Speech.speak).mockReset();
    const onDone = vi.fn();
    speak('다', { onDone });
    const [, opts] = vi.mocked(Speech.speak).mock.calls[0] as [string, SpeakOpts];
    opts.onError?.();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('speak routes an engine error to onError, not onDone, when the caller gave one', () => {
    vi.mocked(Speech.speak).mockReset();
    const onDone = vi.fn();
    const onError = vi.fn();
    speak('다', { onDone, onError });
    const [, opts] = vi.mocked(Speech.speak).mock.calls[0] as [string, SpeakOpts];
    opts.onError?.();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    opts.onStopped?.();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('platform/audio playPrompt (F-QUEST-002 §3.12)', () => {
  const koVoices = [{ language: 'ko-KR' }, { language: 'en-US' }];

  beforeEach(() => {
    vi.clearAllMocks();
    setMuted(false);
    vi.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue(koVoices as never);
    vi.mocked(Speech.speak).mockImplementation((_t, opts) => {
      (opts as SpeakOpts | undefined)?.onDone?.();
    });
  });

  it('resolves played and speaks the given text in Korean', async () => {
    await expect(playPrompt({ text: '가' })).resolves.toBe('played');
    const [text, opts] = vi.mocked(Speech.speak).mock.calls[0] as [string, SpeakOpts];
    expect(text).toBe('가');
    expect(opts.language).toBe('ko-KR');
  });

  it('resolves muted without speaking while muted', async () => {
    setMuted(true);
    await expect(playPrompt({ text: '가' })).resolves.toBe('muted');
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('resolves muted when the sound is turned off while the voices are being checked', async () => {
    vi.mocked(Speech.getAvailableVoicesAsync).mockImplementation(async () => {
      setMuted(true);
      return koVoices as never;
    });
    await expect(playPrompt({ text: '가' })).resolves.toBe('muted');
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('resolves unavailable when the engine reports an error', async () => {
    vi.mocked(Speech.speak).mockImplementation((_t, opts) => {
      (opts as SpeakOpts | undefined)?.onError?.();
    });
    await expect(playPrompt({ text: '가' })).resolves.toBe('unavailable');
  });

  it('resolves unavailable when voices exist but none speaks the language', async () => {
    vi.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([{ language: 'en-US' }] as never);
    await expect(playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('matches voices by language prefix and either separator', async () => {
    vi.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([{ language: 'ko_KR' }] as never);
    await expect(playPrompt({ text: '가', language: 'ko-KR' })).resolves.toBe('played');
  });

  it('checks the voice of the requested language', async () => {
    vi.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([{ language: 'ko-KR' }] as never);
    await expect(playPrompt({ text: 'sun', language: 'en-US' })).resolves.toBe('unavailable');
  });

  it('tries to speak when the voice list is empty or cannot be read', async () => {
    vi.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue([] as never);
    await expect(playPrompt({ text: '가' })).resolves.toBe('played');
    vi.mocked(Speech.getAvailableVoicesAsync).mockRejectedValue(new Error('no engine'));
    await expect(playPrompt({ text: '가' })).resolves.toBe('played');
  });
});
