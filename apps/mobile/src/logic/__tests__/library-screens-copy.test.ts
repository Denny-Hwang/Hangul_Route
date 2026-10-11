import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-STORY-006 PR 6.1 — interim Library/CardDetail fixes. The screens are React
 * Native components with no renderer harness yet, so these guards read the
 * source: no emoji may be rendered (D7) and the explainer must say only what
 * is true today (the tiger is a first-launch card; nothing completes a stage).
 */
const LIBRARY_DIR = resolve(__dirname, '../../screens/library');
const read = (file: string): string => readFileSync(resolve(LIBRARY_DIR, file), 'utf8');

describe('Library screens (F-STORY-006 PR 6.1)', () => {
  it('CardDetailScreen renders no emoji', () => {
    expect(read('CardDetailScreen.tsx')).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('LibraryScreen renders no emoji', () => {
    expect(read('LibraryScreen.tsx')).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('CardDetailScreen shows the fact next to a sparkle Icon instead of an emoji', () => {
    const src = read('CardDetailScreen.tsx');
    expect(src.match(/<Icon name="sparkle"/g)?.length).toBe(2);
  });

  it('the Library explainer no longer promises a stage-completion card', () => {
    const src = read('LibraryScreen.tsx');
    expect(src).toContain('Finish quests to unlock cards.');
    expect(src).not.toMatch(/whole stage/i);
    expect(src).not.toMatch(/Legendary cards appear/i);
  });
});
