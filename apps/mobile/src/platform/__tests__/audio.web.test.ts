import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isMuted, pickVoice, playJamoSound, setMuted, speak, stop } from '../audio.web';

class FakeUtterance {
  lang = '';
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
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
});
