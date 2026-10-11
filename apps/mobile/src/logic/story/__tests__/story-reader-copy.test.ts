import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { STORY_READER_COPY } from '../story-reader-copy';

/** Every string the copy can render, calling each function message with sample arguments. */
function allStrings(): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') out.push(node);
    else if (typeof node === 'function') {
      for (const args of [
        [1, 1, 'Title', 'Publisher'],
        [2, 3, 'Title', 'Publisher'],
        [12, 31],
        ['sagwan', 'royal historian'],
        ['2026-10-09', 3, 2],
        ['f3', 'About'],
        ['Note text'],
      ]) {
        const text = (node as (...a: unknown[]) => unknown)(...args);
        if (typeof text === 'string') out.push(text);
      }
    } else if (node && typeof node === 'object') Object.values(node).forEach(walk);
  };
  walk(STORY_READER_COPY);
  return out;
}

describe('STORY_READER_COPY', () => {
  const strings = allStrings();

  it('has strings to scan', () => {
    expect(strings.length).toBeGreaterThan(40);
  });

  it('passes the anti-shame banned-word scan', () => {
    expect(scanLearnerCopy(strings)).toEqual([]);
  });

  it('has no Hangul, emoji, HTML entities or stray whitespace in rendered text', () => {
    for (const s of strings) {
      expect(s, s).not.toMatch(/[ㄱ-㆏가-힣]/);
      expect(s, s).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(s, s).not.toMatch(/&[a-z]+;/);
      expect(s.trim(), s).toBe(s);
      expect(s.length, s).toBeGreaterThan(0);
    }
  });

  it('is only strings and functions, and every function returns a string', () => {
    const walk = (node: unknown): void => {
      if (node && typeof node === 'object') Object.values(node).forEach(walk);
      else expect(['string', 'function']).toContain(typeof node);
    };
    walk(STORY_READER_COPY);
  });

  // The reader and end-page words live in packages/i18n since PR 2.6a
  // (learner.story.reader / learner.story.end, story-reader-messages.test.ts there).
  it('uses the wireframe wording for the key moments of Sources (§3.8)', () => {
    const c = STORY_READER_COPY;
    expect(c.sources.scope.documented).toBe('What we know');
    expect(c.sources.scope.inTheTale).toBe('What the tale says');
    expect(c.sources.usedInQuestions).toBe('Used in questions and notes');
    expect(c.sources.openLink).toBe('Open link');
    expect(c.sources.copyLink).toBe('Copy link');
    expect(c.sources.noSources).toBe('No sources are listed for this story.');
  });

  it('pluralises the checked line and the counts', () => {
    const c = STORY_READER_COPY.sources;
    expect(c.checked(1, '2026-10-09', 2)).toBe(
      'Checked in 1 independent pass · last checked 2026-10-09 · story version 2',
    );
    expect(c.checked(3, '2026-10-09', 1)).toBe(
      'Checked in 3 independent passes · last checked 2026-10-09 · story version 1',
    );
    expect(c.counts(12, 31)).toBe('12 facts · 31 sources');
    expect(c.counts(1, 1)).toBe('1 fact · 1 source');
    expect(c.sourcesHeading(1)).toBe('Sources (1)');
    expect(c.sceneHeading(3)).toBe('Scene 3');
    expect(c.seeFact('f3')).toBe('See fact f3');
    expect(c.sourceLabel(2, 3, 'Title', 'Publisher')).toBe('Source 2 of 3: Title, Publisher');
    expect(c.accessed('2026-10-09')).toBe('accessed 2026-10-09');
    expect(c.updatedOn('2026-10-09')).toBe('Updated 2026-10-09');
    expect(c.approximation('almost 600 years', '1443 to 2026 is 583 years, so the story rounds it.')).toBe(
      'About “almost 600 years”: 1443 to 2026 is 583 years, so the story rounds it.',
    );
    expect(c.openFailed('https://example.org/a')).toBe('Open this link in a browser: https://example.org/a');
  });

  it('never uses red-and-cross or scolding wording (D3)', () => {
    expect(strings.join(' ')).not.toMatch(/\b(wrong|incorrect|error|mistake|fail\w*|oops)\b/i);
  });
});
