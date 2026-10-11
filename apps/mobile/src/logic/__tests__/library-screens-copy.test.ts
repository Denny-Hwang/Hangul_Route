import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';

/**
 * F-STORY-006 PR 6.1 — interim Library/CardDetail fixes. The screens are React
 * Native components with no renderer harness yet, so these guards read the
 * source: no emoji may be rendered (D7) and the explainer must say only what
 * is true today (the tiger is a first-launch card; nothing completes a stage).
 * The explainer text lives in the dictionary since F-I18N-001 PR 6a; the screen
 * must read it from there.
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
    const body = getMessages('en').learner.library.how.body;
    expect(body).toBe('Finish quests to unlock cards.');
    expect(body).not.toMatch(/whole stage/i);
    expect(body).not.toMatch(/Legendary cards appear/i);
    expect(read('LibraryScreen.tsx')).toContain('m.how.body');
  });
});
