import { describe, expect, it } from 'vitest';
import { HeritageCardSchema } from '../index';

/** F-STORY-006 §3.2: the `unlockedBy` grammar and the optional story-card fields. */
const card = {
  id: 'card:rice',
  titleEn: 'Rice',
  subtitleKo: '밥',
  romanization: 'bap',
  blurbEn: 'A bowl of warm rice.',
  theme: 'life',
  stage: 'stage1',
  rarity: 'common',
  unlockedBy: 'episode:stage1-life',
} as const;

const story = {
  ...card,
  id: 'card:story-sun-and-moon',
  unlockedBy: 'episode:shelf-sun-and-moon',
  storyId: 'story:sun-and-moon',
  factId: 'f5',
  citation: { title: 'Korean Folk Tales', publisher: 'National Folk Museum of Korea', more: 2 },
};

const parses = (value: unknown): boolean => HeritageCardSchema.safeParse(value).success;
const issuePaths = (value: unknown): string[] => {
  const r = HeritageCardSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('HeritageCardSchema.unlockedBy grammar (F-STORY-006 §3.2)', () => {
  it.each([
    'episode:stage1-letters',
    'episode:shelf-sun-and-moon',
    'stage1-complete',
    'stage7-complete',
    'first-launch',
    'set:records-joseon',
  ])('accepts %s', (unlockedBy) => {
    expect(parses({ ...card, unlockedBy })).toBe(true);
  });

  it.each([
    'episod:stage1-letters',
    'episode:',
    'episode:Stage1',
    'stage8-complete',
    'stage0-complete',
    'stage1-completed',
    'first_launch',
    'set:',
    'jamo:giyeok',
    '',
    ' first-launch',
  ])('rejects %j', (unlockedBy) => {
    expect(issuePaths({ ...card, unlockedBy })).toContain('unlockedBy');
  });
});

describe('HeritageCardSchema story-card fields (F-STORY-006 §3.2)', () => {
  it('a card without any of the new fields still parses', () => {
    expect(parses(card)).toBe(true);
  });

  it('a story card with storyId, factId and citation parses; citation.more defaults to 0', () => {
    expect(parses(story)).toBe(true);
    const parsed = HeritageCardSchema.parse({ ...story, citation: { title: 'T', publisher: 'P' } });
    expect(parsed.citation).toEqual({ title: 'T', publisher: 'P', more: 0 });
  });

  it('checks the id grammar of storyId and setId', () => {
    expect(issuePaths({ ...story, storyId: 'sun-and-moon' })).toContain('storyId');
    expect(parses({ ...card, unlockedBy: 'set:seasons-tales', setId: 'set:seasons-tales' })).toBe(true);
    expect(issuePaths({ ...card, setId: 'seasons-tales' })).toContain('setId');
  });

  it('checks the citation fields', () => {
    expect(issuePaths({ ...story, citation: { title: '', publisher: 'P' } })).toContain('citation.title');
    expect(issuePaths({ ...story, citation: { title: 'T', publisher: '' } })).toContain('citation.publisher');
    expect(issuePaths({ ...story, citation: { title: 'T', publisher: 'P', more: -1 } })).toContain('citation.more');
    expect(issuePaths({ ...story, citation: { title: 'T', publisher: 'P', more: 1.5 } })).toContain('citation.more');
  });

  it('factId and citation appear together', () => {
    const { citation: _c, ...noCitation } = story;
    const { factId: _f, ...noFact } = story;
    expect(issuePaths(noCitation)).toContain('citation');
    expect(issuePaths(noFact)).toContain('factId');
  });

  it('factId and citation appear only on a card with storyId', () => {
    const { storyId: _s, ...noStory } = story;
    expect(issuePaths(noStory)).toContain('storyId');
    expect(issuePaths({ ...card, factId: 'f1' })).toContain('storyId');
  });

  it('a story card may carry storyId alone (before its fact is chosen)', () => {
    expect(parses({ ...card, storyId: 'story:sun-and-moon' })).toBe(true);
  });
});
