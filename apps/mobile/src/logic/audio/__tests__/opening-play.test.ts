import { describe, expect, it } from 'vitest';
import { playsOnOpen } from '../opening-play';

describe('playsOnOpen: a screen says its prompt by itself only when something could sound', () => {
  const ready = { state: 'ready' as const, voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'enhanced' as const };
  const none = { state: 'none' as const, reason: 'no_korean_voice' as const };

  it('plays with a Korean voice, or while the voice list is not known yet', () => {
    expect(playsOnOpen(false, ready, false)).toBe(true);
    expect(playsOnOpen(false, { state: 'unknown' }, false)).toBe(true);
  });

  it('waits for a tap while sound is off, and when there is no voice and no recording', () => {
    expect(playsOnOpen(true, ready, true)).toBe(false);
    expect(playsOnOpen(false, none, false)).toBe(false);
  });

  it('a bundled recording plays with no Korean voice', () => {
    expect(playsOnOpen(false, none, true)).toBe(true);
  });
});
