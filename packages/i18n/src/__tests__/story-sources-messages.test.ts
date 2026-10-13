import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-STORY-002 PR 2.7: the Sources screen reads the dictionary. The wording is the one PR 2.5
// shipped in `logic/story/story-reader-copy.ts` (moved, unchanged); buttons and pills are keyed
// `cta` / `pill` so the length budgets (F-I18N-001 §3.11) cover them.
const m = getMessages('en');
const s = m.learner.story.sources;
const NO_AGE_OR_FAILURE = /\b(kids?|child(ren)?|ages?|fail\w*|wrong|incorrect|error|mistake|oops)\b|\p{Extended_Pictographic}/iu;
const HANGUL = /[ㄱ-ㆎ가-힣]/;

describe('learner.story.sources (English wording as shipped in PR 2.5)', () => {
  it('names the header, the scope labels and the sections (§3.8)', () => {
    expect(s.title).toBe('Sources');
    expect(s.back).toBe('Back');
    expect(s.traditionalTale.pill).toBe('Traditional tale');
    expect(s.traditionalNote).toBe('One version of a story told in many versions');
    expect(s.clusterChecked).toBe('These checks covered a group of related stories, not this story alone.');
    expect(s.howChecked.cta).toBe('How it was checked');
    expect(s.advisoryHeading).toBe('A gentle note for grown-ups');
    expect(s.corrections).toBe('Corrections');
    expect(s.korean.cta).toBe('Korean');
    expect(s.scope.documented).toBe('What we know');
    expect(s.scope.inTheTale).toBe('What the tale says');
    expect(s.updated.pill).toBe('Updated');
    expect(s.usedInQuestions).toBe('Used in questions and notes');
    expect(s.onTheCard).toBe('On the story card');
    expect(s.highlighted.pill).toBe('Highlighted');
    expect(s.noSources).toBe('No sources are listed for this story.');
  });

  it('keeps the link actions and their outcomes (§3.8, §3.14 #3-4)', () => {
    expect(s.openLink.cta).toBe('Open link');
    expect(s.copyLink.cta).toBe('Copy link');
    expect(s.linkCopied).toBe('Link copied');
    expect(s.copyUnavailable).toBe('Copying is not available here. The link is above.');
    expect(s.openFailed('https://example.org/a')).toBe('Open this link in a browser: https://example.org/a');
    expect(s.needsConnection).toBe('Opening a link needs a connection.');
    expect(s.gateDone).toBe('Grown-up check done. Tap Open link to open it.');
  });

  it('pluralises the checked line and the counts', () => {
    expect(s.checked(1, '2026-10-09', 2)).toBe('Checked in 1 independent pass · last checked 2026-10-09 · story version 2');
    expect(s.checked(3, '2026-10-09', 1)).toBe('Checked in 3 independent passes · last checked 2026-10-09 · story version 1');
    expect(s.counts(12, 31)).toBe('12 facts · 31 sources');
    expect(s.counts(1, 1)).toBe('1 fact · 1 source');
    expect(s.sourcesHeading(1)).toBe('Sources (1)');
  });

  it('keeps the fact-card and source lines', () => {
    expect(s.sceneHeading(3)).toBe('Scene 3');
    expect(s.seeFact('f3')).toBe('See fact f3');
    expect(s.sourceLabel(2, 3, 'Title', 'Publisher')).toBe('Source 2 of 3: Title, Publisher');
    expect(s.accessed('2026-10-09')).toBe('accessed 2026-10-09');
    expect(s.updatedOn.pill('2026-10-09')).toBe('Updated 2026-10-09');
    expect(s.approximation('almost 600 years', '1443 to 2026 is 583 years, so the story rounds it.')).toBe(
      'About “almost 600 years”: 1443 to 2026 is 583 years, so the story rounds it.',
    );
    expect(s.dependsOnToday).toBe('This depends on today’s date.');
  });
});

describe('Sources copy rules (D1, D2, D3)', () => {
  const paths = leafPaths(m).filter((p) => p.startsWith('learner.story.sources.'));
  const rendered = paths.flatMap((path) => {
    const value = lookup(m, path);
    if (typeof value === 'string') return [value];
    const samples = SAMPLES[path];
    expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
    return (samples ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
  });

  it('finds the Sources leaves', () => {
    expect(paths.length).toBeGreaterThan(30);
  });

  it('never names an age, never shames, never shows an emoji', () => {
    for (const text of rendered) expect(text, text).not.toMatch(NO_AGE_OR_FAILURE);
  });

  it('never embeds Korean: titles, claims and quotes come from the story data', () => {
    for (const text of rendered) expect(text, text).not.toMatch(HANGUL);
  });

  it('has no stray whitespace or HTML entities', () => {
    for (const text of rendered) {
      expect(text.trim(), text).toBe(text);
      expect(text, text).not.toMatch(/&[a-z]+;/);
    }
  });
});

describe('every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: has the Sources keys`, () => {
      const messages = getMessages(locale);
      expect(typeof messages.learner.story.sources.openLink.cta).toBe('string');
      expect(typeof messages.learner.story.sources.counts).toBe('function');
    });
  }
});
