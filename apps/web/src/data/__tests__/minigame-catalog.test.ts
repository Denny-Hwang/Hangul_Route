import { describe, expect, it } from 'vitest';
import { minigameCatalog, type MinigameFamily } from '../minigame-catalog';

const VALID_FAMILIES: readonly MinigameFamily[] = ['recognition', 'production', 'application', 'review'];

describe('minigameCatalog', () => {
  it('lists exactly 9 mini-games (matches MVP Stage 1 build)', () => {
    expect(minigameCatalog.length).toBe(9);
  });

  it('every minigame kind is unique', () => {
    const kinds = minigameCatalog.map((m) => m.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('every minigame has a valid family and non-empty copy', () => {
    for (const game of minigameCatalog) {
      expect(VALID_FAMILIES).toContain(game.family);
      expect(game.title.length).toBeGreaterThan(0);
      expect(game.blurb.length).toBeGreaterThan(0);
    }
  });

  it('voice-echo ships as beta (STT accuracy in 5–11 yo is unverified)', () => {
    const voice = minigameCatalog.find((m) => m.kind === 'voice-echo');
    expect(voice?.status).toBe('beta');
  });

  it('only voice-echo is beta — everything else is shipped', () => {
    const shipped = minigameCatalog.filter((m) => m.status === 'shipped');
    const beta = minigameCatalog.filter((m) => m.status === 'beta');
    expect(shipped.length).toBe(8);
    expect(beta.length).toBe(1);
  });
});
