import { CATALOG, questsPlacedOutAtLevel, routeCatalogOf, type Catalog, type CatalogCell, type CatalogQuest, type PlacementSummary } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { RosterLearner, RosterSummary } from '../api';
import {
  SUGGEST_PARAM,
  placementBandLabel,
  startingSpotChanged,
  startingSpotLine,
  suggestFrom,
  suggestStartHref,
  suggestedStart,
  suggestedStartQuestId,
  suggestionFor,
} from '../placement';

const en = getMessages('en');
const band = en.learner.placement.band;
const words = en.console.placement;

const placement = (over: Partial<PlacementSummary> = {}): PlacementSummary => ({
  takenAt: '2026-10-09T15:00:00.000Z',
  level: { stage: 'stage1', band: 1 },
  oralStage: null,
  strands: {
    'hangul-recognition': 'secure',
    'sound-letter': 'secure',
    'syllable-reading': 'getting-there',
    vocabulary: 'not-tested',
    sentences: 'not-tested',
  },
  beyondContent: false,
  overridden: false,
  ...over,
});

const summary = (p: PlacementSummary | undefined): Pick<RosterSummary, 'placement'> => (p ? { placement: p } : {});

const learner = (over: Partial<RosterLearner> = {}): RosterLearner => ({
  id: 'learner:sam',
  displayName: 'Sam',
  ageGroup: '8-9',
  avatar: 'tiger',
  joinedAt: '2026-10-01T00:00:00.000Z',
  lastActiveAt: '2026-10-10T00:00:00.000Z',
  summary: null,
  lastSyncedAt: null,
  ...over,
});

const withPlacement = (p: PlacementSummary | undefined, over: Partial<RosterLearner> = {}): RosterLearner =>
  learner({ summary: { ...(p ? { placement: p } : {}) } as RosterSummary, ...over });

describe('placementBandLabel (the learner band words, F-PLC-001 section 3.6)', () => {
  it('maps every reachable level onto its band label', () => {
    expect(placementBandLabel({ stage: 'stage1', band: 0 })).toBe(band.beginning);
    expect(placementBandLabel({ stage: 'stage1', band: 1 })).toBe(band.lettersAndSounds);
    expect(placementBandLabel({ stage: 'stage1', band: 2 })).toBe(band.everyLetter);
    expect(placementBandLabel({ stage: 'stage1', band: 3 })).toBe(band.readingWords);
    expect(placementBandLabel({ stage: 'stage2', band: 0 })).toBe(band.firstWords);
    expect(placementBandLabel({ stage: 'stage3', band: 0 })).toBe(band.firstSentences);
  });

  it('draws nothing for a level this build does not know (the roster is not validated at runtime)', () => {
    expect(placementBandLabel({ stage: 'stage4', band: 0 })).toBeNull();
    expect(placementBandLabel({ stage: 'stage1', band: 4 } as never)).toBeNull();
    expect(placementBandLabel({ stage: 'stage9', band: 0 } as never)).toBeNull();
    expect(placementBandLabel(null as never)).toBeNull();
  });

  it('reads the words from the locale (pseudo-locale brackets them)', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    try {
      expect(placementBandLabel({ stage: 'stage1', band: 1 }, 'en-XA' as never)).toMatch(/^\[/);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('startingSpotLine (roster line, section 3.9)', () => {
  it('words stage, band and the day of the check, as in the spec example', () => {
    expect(startingSpotLine(summary(placement()))).toBe('Starting spot: Stage 1 · Letters and sounds · Oct 9');
    expect(startingSpotLine(summary(placement({ level: { stage: 'stage2', band: 0 }, takenAt: '2026-10-11T08:00:00.000Z' })))).toBe(
      'Starting spot: Stage 2 · First words · Oct 11',
    );
    expect(startingSpotLine(summary(placement({ level: { stage: 'stage3', band: 0 } })))).toBe('Starting spot: Stage 3 · First sentences · Oct 9');
  });

  it('draws no line without a summary, without a placement, or with an unreadable one', () => {
    expect(startingSpotLine(null)).toBeNull();
    expect(startingSpotLine(undefined)).toBeNull();
    expect(startingSpotLine(summary(undefined))).toBeNull();
    expect(startingSpotLine(summary(placement({ level: { stage: 'stage5', band: 0 } })))).toBeNull();
    expect(startingSpotLine(summary(placement({ takenAt: 'not a date' })))).toBeNull();
  });

  it('carries no number other than the stage and the date, and no ranking words', () => {
    const line = startingSpotLine(summary(placement())) as string;
    expect(line).not.toMatch(/%|\/|rank|average|behind/i);
  });
});

describe('startingSpotChanged (the quiet override note)', () => {
  it('shows only when a grown-up changed the start', () => {
    expect(startingSpotChanged(summary(placement({ overridden: true })))).toBe(words.overridden);
    expect(startingSpotChanged(summary(placement()))).toBeNull();
    expect(startingSpotChanged(summary(undefined))).toBeNull();
    expect(startingSpotChanged(null)).toBeNull();
  });

  it('follows the starting-spot line: no line, no note', () => {
    expect(startingSpotChanged(summary(placement({ overridden: true, level: { stage: 'stage6', band: 0 } })))).toBeNull();
  });
});

// A small catalogue: two Stage 1 cells, one Stage 2 cell; the route order is stage, then theme.
const cell = (over: Partial<CatalogCell>): CatalogCell => ({ stage: 'stage1', theme: 'letters', episodeId: 'e', title: 'T', status: 'ready', minutes: 10, questIds: [], ...over });
const quest = (over: Partial<CatalogQuest>): CatalogQuest => ({ id: 'q', episodeId: 'e', stage: 'stage1', theme: 'letters', title: 'Q', minutes: 5, teaches: [], kind: 'lesson', ...over });
const catalogOf = (cells: CatalogCell[], quests: CatalogQuest[]): Catalog => ({ version: 1, cells, quests, stories: [], topics: [] });

const FIXTURE = catalogOf(
  [
    cell({ episodeId: 'ep:s1-letters', questIds: ['q:a', 'q:b'] }),
    cell({ episodeId: 'ep:s1-life', theme: 'life', questIds: ['q:c'] }),
    cell({ episodeId: 'ep:s2-letters', stage: 'stage2', questIds: ['q:d'] }),
  ],
  [
    quest({ id: 'q:d', episodeId: 'ep:s2-letters', stage: 'stage2' }),
    quest({ id: 'q:a', episodeId: 'ep:s1-letters', teaches: ['ㄱ', 'ㅏ'] }),
    quest({ id: 'q:b', episodeId: 'ep:s1-letters', teaches: ['ㅓ'] }),
    quest({ id: 'q:c', episodeId: 'ep:s1-life', theme: 'life' }),
  ],
);

describe('suggestedStartQuestId (the coarse start the builder pre-fills)', () => {
  it('without a level, the first playable grid quest of the route', () => {
    expect(suggestedStartQuestId(null, FIXTURE)).toBe('q:a');
  });

  it('with a level, the first playable grid quest the level does not place out', () => {
    expect(suggestedStartQuestId({ stage: 'stage1', band: 0 }, FIXTURE)).toBe('q:a');
    expect(suggestedStartQuestId({ stage: 'stage2', band: 0 }, FIXTURE)).toBe('q:d');
  });

  it('skips quests whose cell is not ready and story quests', () => {
    const notReady = catalogOf(
      [cell({ episodeId: 'ep:s1-letters', status: 'draft', questIds: ['q:a'] }), cell({ episodeId: 'ep:s1-life', theme: 'life', questIds: ['q:c'] })],
      [quest({ id: 'q:a', episodeId: 'ep:s1-letters' }), quest({ id: 'q:c', episodeId: 'ep:s1-life', theme: 'life' })],
    );
    expect(suggestedStartQuestId(null, notReady)).toBe('q:c');
    const storyOnly = catalogOf([], [quest({ id: 'q:story', kind: 'story' })]);
    expect(suggestedStartQuestId(null, storyOnly)).toBeNull();
  });

  it('beyond the content, the last playable grid quest (the builder still opens with one item)', () => {
    expect(suggestedStartQuestId({ stage: 'stage3', band: 0 }, FIXTURE)).toBe('q:d');
  });

  it('on the shipped catalogue, agrees with the shared coarse mapping', () => {
    const route = routeCatalogOf(CATALOG);
    for (const level of [
      { stage: 'stage1', band: 0 },
      { stage: 'stage1', band: 1 },
      { stage: 'stage1', band: 2 },
      { stage: 'stage1', band: 3 },
    ] as const) {
      const id = suggestedStartQuestId(level);
      expect(id).not.toBeNull();
      expect(questsPlacedOutAtLevel(level, route)).not.toContain(id);
      const q = route.quests.find((r) => r.id === id);
      expect(q?.grid && q.playable).toBe(true);
    }
    expect(suggestedStartQuestId({ stage: 'stage1', band: 0 })).toBe(route.quests.find((q) => q.grid && q.playable)?.id);
  });
});

describe('suggestedStart (the advisory plan prefill, decision P6)', () => {
  it('is one quest item with the note, for this learner only, titled for them', () => {
    const draft = suggestedStart(withPlacement(placement({ level: { stage: 'stage2', band: 0 } })), 'en', FIXTURE);
    expect(draft).toEqual({ title: 'Next step for Sam', items: [{ kind: 'quest', id: 'q:d', note: 'Try this next' }], targets: ['learner:sam'] });
  });

  it('works without a check result or a summary (first quest of the route)', () => {
    expect(suggestedStart(learner(), 'en', FIXTURE).items).toEqual([{ kind: 'quest', id: 'q:a', note: words.suggestNote }]);
    expect(suggestedStart(withPlacement(undefined), 'en', FIXTURE).items[0]?.id).toBe('q:a');
  });

  it('opens with no item when the catalogue has no playable quest', () => {
    expect(suggestedStart(learner(), 'en', catalogOf([], [])).items).toEqual([]);
  });

  it('keeps the title within the plan limit of 60, never splitting a character', () => {
    const long = suggestedStart(learner({ displayName: `${'A'.repeat(55)}😀😀` }), 'en', FIXTURE).title;
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).toBe(`Next step for ${'A'.repeat(46)}`);
    const emoji = suggestedStart(learner({ displayName: `${'A'.repeat(44)}😀😀` }), 'en', FIXTURE).title;
    expect(emoji.length).toBeLessThanOrEqual(60);
    expect(emoji).toBe(`Next step for ${'A'.repeat(44)}😀`);
    const split = suggestedStart(learner({ displayName: `${'A'.repeat(45)}😀` }), 'en', FIXTURE).title;
    expect(split).toBe(`Next step for ${'A'.repeat(45)}`);
  });

  it('trims the name', () => {
    expect(suggestedStart(learner({ displayName: '  Sam ' }), 'en', FIXTURE).title).toBe('Next step for Sam');
  });
});

describe('suggestionFor (the builder reads ?suggest=)', () => {
  const roster = [learner({ id: 'learner:a', displayName: 'Ana' }), withPlacement(placement(), { id: 'learner:sam' })];

  it('finds the learner on the roster and returns the draft and the notice', () => {
    const found = suggestionFor(roster, 'learner:sam', 'en', FIXTURE);
    expect(found?.draft.targets).toEqual(['learner:sam']);
    expect(found?.notice).toBe(words.suggestFor('Sam'));
  });

  it('is null without an id or for a learner not on this roster', () => {
    expect(suggestionFor(roster, null)).toBeNull();
    expect(suggestionFor(roster, '')).toBeNull();
    expect(suggestionFor(roster, 'learner:gone')).toBeNull();
  });
});

describe('suggest links', () => {
  it('opens the existing plan builder with the learner id, and reads it back', () => {
    const href = suggestStartHref('space:c 1', 'learner:s&m');
    expect(href).toBe('/teach/space/plan?id=space%3Ac%201&suggest=learner%3As%26m');
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get(SUGGEST_PARAM)).toBe('learner:s&m');
    expect(suggestFrom(params)).toBe('learner:s&m');
    expect(suggestFrom(new URLSearchParams('id=x&suggest=%20'))).toBeNull();
    expect(suggestFrom(new URLSearchParams('id=x'))).toBeNull();
    expect(suggestFrom(null)).toBeNull();
  });
});
