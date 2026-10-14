import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MinigameKindSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { PLAYABLE_KINDS } from '../minigame-renderers';

const screen = readFileSync(join(__dirname, '../../screens/minigames/MinigameScreen.tsx'), 'utf8');

describe('PLAYABLE_KINDS (F-CURR-001 §3.11)', () => {
  it('matches the game arms of the MinigameScreen switch (voice-echo is flag-gated, not listed)', () => {
    const arms = [...screen.matchAll(/case '([a-z-]+)':/g)].map((m) => m[1]);
    expect(arms.length).toBeGreaterThan(0);
    expect([...PLAYABLE_KINDS].sort()).toEqual(arms.filter((k) => k !== 'voice-echo').sort());
  });

  it('holds only kinds of MinigameKindSchema', () => {
    for (const kind of PLAYABLE_KINDS) expect(MinigameKindSchema.options).toContain(kind);
  });
});
