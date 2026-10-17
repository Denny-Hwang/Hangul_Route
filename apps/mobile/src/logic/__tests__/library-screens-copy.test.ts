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
  it('CardDetailScreen and CardDetailView render no emoji', () => {
    expect(read('CardDetailScreen.tsx')).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(read('CardDetailView.tsx')).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('LibraryScreen renders no emoji', () => {
    expect(read('LibraryScreen.tsx')).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('CardDetailView shows the fact next to a sparkle Icon instead of an emoji', () => {
    // The body moved from CardDetailScreen to CardDetailView (F-LAYOUT-001 PR 4).
    const src = read('CardDetailView.tsx');
    expect(src.match(/<Icon name="sparkle"/g)?.length).toBe(2);
  });

  it('the Library explainer says only what a rule of this build can do (F-STORY-006 PR 6.5b)', () => {
    const how = getMessages('en').learner.library.how;
    expect(Object.values(how).filter((v) => typeof v === 'string').join(' ')).not.toMatch(/Legendary cards appear/i);
    const src = read('LibraryScreen.tsx');
    expect(src).toContain('libraryExplainer(');
    expect(src).not.toContain('m.how.body');
  });

  it('the Library header is a plain count with no N/M pill (F-STORY-006 §3.7, decision 3)', () => {
    const src = read('LibraryScreen.tsx');
    expect(src).toContain('m.collected.line(');
    expect(src).not.toContain('m.collected.pill');
    expect(src).not.toContain('heritageCardsAll.length');
  });

  it('the Library lists only obtainable or owned cards; a card to find is a silhouette with its earn hint in its name, and the shelf shows one Next card hint (owner request 2026-10-16, item 8)', () => {
    const src = read('LibraryScreen.tsx');
    expect(src).toContain('obtainableCards(');
    expect(src).toContain('earnHint(');
    expect(src).toContain('a11y.lockedCardHint(');
    expect(src).toContain('libraryShelves(');
    expect(src).toContain('<CardSilhouette');
    expect(src).toContain('m.toFind.next');
    expect(src).not.toContain('name="lock"');
    expect(src).not.toContain('m.locked}');
  });

  it('a card earned since the last visit wears a New pill, cleared when it is opened', () => {
    const library = read('LibraryScreen.tsx');
    expect(library).toContain('newSinceLastView');
    expect(library).toContain('m.new.pill');
    expect(library).toContain('markCardsSeen(');
    expect(read('CardDetailScreen.tsx')).toContain('markCardsSeen(');
  });

  it('a locked card page names its earn hint and says how to earn it on both the stack screen and the pane', () => {
    const view = read('CardDetailView.tsx');
    expect(view).toContain('earnHint(');
    expect(view).toContain('a11y.lockedCardHint(');
    expect(read('CardDetailScreen.tsx')).toContain('showHowToEarn');
  });
});
