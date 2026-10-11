import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isMuted, pickVoice, playJamoSound, playPrompt, setMuted, speak, stop } from '../audio.web';

class FakeUtterance {
  lang = '';
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

function makeSynth(voices: Array<{ lang: string; name: string }> = []) {
  const spoken: FakeUtterance[] = [];
  return {
    spoken,
    api: {
      speak: vi.fn((u: FakeUtterance) => {
        spoken.push(u);
        u.onend?.();
      }),
      cancel: vi.fn(),
      getVoices: vi.fn(() => voices),
    },
  };
}

describe('platform/audio.web (speechSynthesis)', () => {
  beforeEach(() => {
    setMuted(false);
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('speaks Korean with the matching voice and calls onDone once', () => {
    const s = makeSynth([
      { lang: 'en-US', name: 'Sam' },
      { lang: 'ko-KR', name: 'Yuna' },
    ]);
    vi.stubGlobal('speechSynthesis', s.api);
    const onDone = vi.fn();
    speak('ㄱ', { onDone });
    expect(s.api.cancel).toHaveBeenCalled();
    expect(s.spoken[0]?.lang).toBe('ko-KR');
    expect((s.spoken[0]?.voice as { name: string }).name).toBe('Yuna');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('resolves immediately when muted or when no synthesis exists', async () => {
    const onDone = vi.fn();
    setMuted(true);
    expect(isMuted()).toBe(true);
    speak('ㄴ', { onDone });
    expect(onDone).toHaveBeenCalledTimes(1);
    setMuted(false);
    await expect(playJamoSound('ㄷ')).resolves.toBeUndefined();
  });

  it('pickVoice falls back to a language-prefix match, else null', () => {
    const voices = [{ lang: 'ko_KR', name: 'A' }, { lang: 'en-GB', name: 'B' }] as unknown as SpeechSynthesisVoice[];
    expect(pickVoice(voices, 'ko-KR')?.name).toBe('A');
    expect(pickVoice(voices, 'ja-JP')).toBeNull();
  });

  it('stop cancels current speech', () => {
    const s = makeSynth();
    vi.stubGlobal('speechSynthesis', s.api);
    stop();
    expect(s.api.cancel).toHaveBeenCalled();
  });

  it('routes a synthesis error to onError when given, ignoring cancel / interrupt events', () => {
    const s = makeSynth();
    s.api.speak.mockImplementation((u: FakeUtterance) => {
      u.onerror?.({ error: 'interrupted' });
      u.onerror?.({ error: 'canceled' });
      u.onerror?.({ error: 'synthesis-failed' });
    });
    vi.stubGlobal('speechSynthesis', s.api);
    const onDone = vi.fn();
    const onError = vi.fn();
    speak('가', { onDone, onError });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a real synthesis error through onError', () => {
    const s = makeSynth();
    s.api.speak.mockImplementation((u: FakeUtterance) => u.onerror?.({ error: 'synthesis-failed' }));
    vi.stubGlobal('speechSynthesis', s.api);
    const onDone = vi.fn();
    const onError = vi.fn();
    speak('가', { onDone, onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('still routes a synthesis error to onDone when the caller gave no onError', () => {
    const s = makeSynth();
    s.api.speak.mockImplementation((u: FakeUtterance) => u.onerror?.({ error: 'synthesis-failed' }));
    vi.stubGlobal('speechSynthesis', s.api);
    const onDone = vi.fn();
    speak('가', { onDone });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('platform/audio.web playPrompt (F-QUEST-002 §3.12)', () => {
  beforeEach(() => {
    setMuted(false);
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('resolves played after the utterance ends', async () => {
    const s = makeSynth([{ lang: 'ko-KR', name: 'Yuna' }]);
    vi.stubGlobal('speechSynthesis', s.api);
    await expect(playPrompt({ text: '가' })).resolves.toBe('played');
    expect(s.spoken[0]?.lang).toBe('ko-KR');
  });

  it('resolves muted without speaking while muted', async () => {
    const s = makeSynth([{ lang: 'ko-KR', name: 'Yuna' }]);
    vi.stubGlobal('speechSynthesis', s.api);
    setMuted(true);
    await expect(playPrompt({ text: '가' })).resolves.toBe('muted');
    expect(s.api.speak).not.toHaveBeenCalled();
  });

  it('resolves unavailable when the browser has no speech synthesis', async () => {
    await expect(playPrompt({ text: '가' })).resolves.toBe('unavailable');
    vi.stubGlobal('speechSynthesis', makeSynth().api);
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    await expect(playPrompt({ text: '가' })).resolves.toBe('unavailable');
  });

  it('resolves unavailable when voices are listed but none speaks the language', async () => {
    const s = makeSynth([{ lang: 'en-US', name: 'Sam' }]);
    vi.stubGlobal('speechSynthesis', s.api);
    await expect(playPrompt({ text: '가' })).resolves.toBe('unavailable');
    expect(s.api.speak).not.toHaveBeenCalled();
  });

  it('tries to speak when the voice list has not loaded yet', async () => {
    const s = makeSynth([]);
    vi.stubGlobal('speechSynthesis', s.api);
    await expect(playPrompt({ text: '가' })).resolves.toBe('played');
  });

  it('resolves unavailable when synthesis fails', async () => {
    const s = makeSynth([{ lang: 'ko-KR', name: 'Yuna' }]);
    s.api.speak.mockImplementation((u: FakeUtterance) => u.onerror?.({ error: 'synthesis-failed' }));
    vi.stubGlobal('speechSynthesis', s.api);
    await expect(playPrompt({ text: '가' })).resolves.toBe('unavailable');
  });

  it('speaks the requested language', async () => {
    const s = makeSynth([{ lang: 'en-US', name: 'Sam' }]);
    vi.stubGlobal('speechSynthesis', s.api);
    await expect(playPrompt({ text: 'sun', language: 'en-US' })).resolves.toBe('played');
    expect(s.spoken[0]?.lang).toBe('en-US');
  });
});
