import { getMessages, pseudoLocalize } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { LIBRARY_SECTIONS } from '../library-sections';
import { sectionTitle, shelfCopy, type StoryShelfCopy } from '../shelf-copy';

const COPY: StoryShelfCopy = shelfCopy(getMessages('en'));

/** Every string the copy can render, calling each function message with sample arguments. */
function allStrings(copy: StoryShelfCopy): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') out.push(node);
    else if (typeof node === 'function') {
      for (const args of [[0, 0, 0], [1, 1, 1], [5, 'New', 5], ['Seollal', 'Finished', 1], ['Seollal', 'Cultural Heritage Administration']]) {
        const text = (node as (...a: unknown[]) => unknown)(...args);
        if (typeof text === 'string') out.push(text);
      }
    } else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(copy);
  return out;
}

describe('learner.storyShelf (shelf copy)', () => {
  const strings = allStrings(COPY);

  it('has strings to scan', () => {
    expect(strings.length).toBeGreaterThan(30);
  });

  it('passes the anti-shame banned-word scan (F-HW-001 §3.3)', () => {
    expect(scanLearnerCopy(strings)).toEqual([]);
  });

  it('never says Premium, never a fraction or percent, never an age (D1, D3, D5)', () => {
    for (const s of strings) {
      expect(s, s).not.toMatch(/premium/i);
      expect(s, s).not.toMatch(/\d+\s*(\/|of)\s*\d+|%/);
      expect(s, s).not.toMatch(/\bages?\b|\bkids?\b|\byears? old\b/i);
    }
  });

  it('has no Hangul, emoji or HTML entities in rendered text', () => {
    for (const s of strings) {
      expect(s, s).not.toMatch(/[ㄱ-㆏가-힣]/);
      expect(s, s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s, s).not.toMatch(/&[a-z]+;/);
      expect(s.trim(), s).toBe(s);
      expect(s.length, s).toBeGreaterThan(0);
    }
  });

  it('uses the spec wording for the key moments', () => {
    expect(COPY.pickedForYou).toBe('Picked for you');
    expect([COPY.start.cta, COPY.keepReading.cta, COPY.readAgain.cta]).toEqual(['Start', 'Keep reading', 'Read it again']);
    expect([COPY.state.new, COPY.state.inProgress, COPY.state.finished]).toEqual(['New', 'Keep reading', 'Finished']);
    expect(COPY.home.subtitle).toEqual({ continue: 'Keep reading', next: 'A short story', again: 'Read it again' });
    expect(COPY.home.explore).toBe('Take a look');
    expect(COPY.cultureNotes.grownUps).toBe('For grown-ups: where this comes from');
  });

  it('counts and durations are whole sentences, with plurals', () => {
    expect(COPY.minutes.pill(4)).toBe('about 4 min');
    expect(COPY.cultureNotes.found.pill(3)).toBe('3 found');
    expect(COPY.episode.cultureNotes(1)).toBe('Culture notes: 1 found');
    expect(COPY.tileLabel('The Sun and the Moon', COPY.state.new, 4)).toBe('The Sun and the Moon. New. About 4 minutes.');
    expect(COPY.tileLabel('The Sun and the Moon', COPY.state.finished, 1)).toBe('The Sun and the Moon. Finished. About 1 minute.');
    expect(COPY.cultureNotes.source('Hangul Day', 'UNESCO')).toBe('Hangul Day, UNESCO');
  });

  it('has a title for every Library section', () => {
    for (const section of LIBRARY_SECTIONS) expect(sectionTitle(section.id, COPY).length).toBeGreaterThan(0);
    expect(sectionTitle('story-time', COPY)).toBe('Story Time');
    expect(sectionTitle('cards', COPY)).toBe('Cards');
  });

  it('follows the selected locale (pseudo-localised dictionary)', () => {
    const pseudo = shelfCopy(pseudoLocalize(getMessages('en')));
    expect(pseudo.pickedForYou).not.toBe(COPY.pickedForYou);
    expect(sectionTitle('culture', pseudo)).not.toBe('Culture');
  });
});
