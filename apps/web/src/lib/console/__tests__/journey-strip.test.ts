import { describe, expect, it } from 'vitest';
import * as stripModule from '../journey-strip';
import { journeyStrip, JOURNEY_STATES, readJourney } from '../journey-strip';

/**
 * F-ROUTE-001 R-9a (section 3.12, wireframe console/roster "Journey strip"): the roster card's
 * journey strip from the tolerant `summary.journey`. Seven drawn segments with a word each,
 * "On Stage N" and one line per stage; class and family spaces only. Counts only: `total` is
 * never shown, nothing is averaged, ranked or sorted, and entries a newer build sends are ignored.
 */

type Entry = { stage: string; state: string; done: number; known: number; total: number };

const STAGES = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];

/** Appendix C (frozen 8-quest bundle): letters q1..q3 and life q1 done, no placement. */
const appendixC = (over: Partial<Record<string, Partial<Entry>>> = {}, here: string | null = 'stage1') => ({
  v: 1 as const,
  here,
  stages: STAGES.map((stage): Entry => {
    const base: Record<string, Entry> = {
      stage1: { stage, state: 'open', done: 4, known: 0, total: 8 },
      stage2: { stage, state: 'open', done: 0, known: 0, total: 2 },
      stage4: { stage, state: 'open', done: 0, known: 0, total: 1 },
    };
    return { ...(base[stage] ?? { stage, state: 'later', done: 0, known: 0, total: 0 }), ...over[stage] };
  }),
});

describe('journeyStrip: where it shows', () => {
  it('shows on class and family roster cards', () => {
    expect(journeyStrip('class', appendixC())).not.toBeNull();
    expect(journeyStrip('family', appendixC())).not.toBeNull();
  });

  it('never on a school space (it renders the admin view before any roster)', () => {
    expect(journeyStrip('school', appendixC())).toBeNull();
  });

  it('draws nothing when the journey is absent or malformed: absent is not "no progress"', () => {
    for (const bad of [undefined, null, 'x', 3, [], {}, { v: 2, here: 'stage1', stages: [] }, { v: 1, here: 'stage1' }, { v: 1, here: 'stage1', stages: 'x' }]) {
      expect(journeyStrip('class', bad)).toBeNull();
    }
  });

  it('draws nothing when no entry is readable', () => {
    expect(journeyStrip('class', { v: 1, here: 'stage1', stages: [{ stage: 'stage9', state: 'open', done: 0, known: 0, total: 0 }] })).toBeNull();
  });
});

describe('journeyStrip: segments (shape + word)', () => {
  it('seven segments in stage order, each with its state and a "Stage N: word" text', () => {
    const strip = journeyStrip('class', appendixC());
    expect(strip?.segments.map((s) => [s.stage, s.order, s.state, s.here])).toEqual([
      ['stage1', 1, 'open', true],
      ['stage2', 2, 'open', false],
      ['stage3', 3, 'later', false],
      ['stage4', 4, 'open', false],
      ['stage5', 5, 'later', false],
      ['stage6', 6, 'later', false],
      ['stage7', 7, 'later', false],
    ]);
    expect(strip?.segments.map((s) => s.text)).toEqual([
      'Stage 1: Open',
      'Stage 2: Open',
      'Stage 3: Coming later',
      'Stage 4: Open',
      'Stage 5: Coming later',
      'Stage 6: Coming later',
      'Stage 7: Coming later',
    ]);
  });

  it('names every state the summary may carry', () => {
    expect([...JOURNEY_STATES]).toEqual(['complete', 'known', 'explored', 'open', 'later']);
    const strip = journeyStrip('family', appendixC({ stage1: { state: 'complete' }, stage2: { state: 'explored' }, stage3: { state: 'known' } }));
    expect(strip?.segments.slice(0, 3).map((s) => s.text)).toEqual(['Stage 1: Complete', 'Stage 2: Explored', 'Stage 3: Known from the level check']);
  });

  it('sorts entries into stage order and keeps the first of a repeated stage', () => {
    const j = appendixC();
    const shuffled = { ...j, stages: [...j.stages].reverse().concat([{ stage: 'stage1', state: 'complete', done: 99, known: 0, total: 8 }]) };
    const strip = journeyStrip('class', shuffled);
    expect(strip?.segments.map((s) => s.stage)).toEqual(STAGES);
    expect(strip?.segments[0]?.state).toBe('open');
  });
});

describe('journeyStrip: unknown entries from a newer build are ignored (section 3.17)', () => {
  it('drops an unknown stage key, an unknown state and unreadable counts', () => {
    const j = appendixC();
    const strip = journeyStrip('class', {
      ...j,
      stages: [
        ...j.stages.filter((s) => s.stage !== 'stage2' && s.stage !== 'stage3' && s.stage !== 'stage4'),
        { stage: 'stage8', state: 'open', done: 1, known: 0, total: 1 },
        { stage: 'stage2', state: 'mastered', done: 1, known: 0, total: 2 },
        { stage: 'stage3', state: 'open', done: -1, known: 0, total: 2 },
        { stage: 'stage4', state: 'open', done: 1.5, known: 0, total: 2 },
        null,
        'stage5',
      ],
    });
    expect(strip?.segments.map((s) => s.stage)).toEqual(['stage1', 'stage5', 'stage6', 'stage7']);
  });

  it('a here that is not a known stage gives no "On Stage" line, the rest still shows', () => {
    const strip = journeyStrip('class', appendixC({}, 'stage9'));
    expect(strip?.onStage).toBeNull();
    expect(strip?.segments.every((s) => !s.here)).toBe(true);
    expect(strip?.segments).toHaveLength(7);
  });

  it('a null here gives no "On Stage" line', () => {
    expect(journeyStrip('class', appendixC({}, null))?.onStage).toBeNull();
  });
});

describe('journeyStrip: "On Stage N" and the stage lines', () => {
  it('Appendix C: "On Stage 1" and "4 quests done"; Stage 3 and Stages 5 to 7 read coming later', () => {
    const strip = journeyStrip('class', appendixC());
    expect(strip?.title).toBe('Learning Route');
    expect(strip?.onStage).toBe('On Stage 1');
    expect(strip?.details).toBe('Stage by stage');
    expect(strip?.lines).toEqual([
      'Stage 1: 4 quests done',
      'Stage 2: 0 quests done',
      'Stage 3: Coming later',
      'Stage 4: 0 quests done',
      'Stages 5 to 7: Coming later',
    ]);
  });

  it('wireframe I: placed into Stage 2, the known part only when greater than zero', () => {
    const strip = journeyStrip('class', appendixC({ stage1: { state: 'known', done: 0, known: 8 }, stage2: { done: 1 } }, 'stage2'));
    expect(strip?.onStage).toBe('On Stage 2');
    expect(strip?.lines.slice(0, 2)).toEqual(['Stage 1: 8 known from the level check, 0 quests done', 'Stage 2: 1 quest done']);
  });

  it('a later stage with done quests (a tier change) keeps its own line', () => {
    const strip = journeyStrip('class', appendixC({ stage5: { done: 2 } }));
    expect(strip?.lines.slice(-2)).toEqual(['Stage 5: 2 quests done', 'Stages 6 to 7: Coming later']);
  });

  it('later stages merge only when consecutive', () => {
    const j = appendixC();
    const gap = { ...j, stages: j.stages.filter((s) => s.stage !== 'stage6') };
    expect(journeyStrip('class', gap)?.lines.slice(-2)).toEqual(['Stage 5: Coming later', 'Stage 7: Coming later']);
  });

  it('never shows total, a ratio, a percent or an average', () => {
    const strip = journeyStrip('class', appendixC({ stage1: { done: 3, known: 2, total: 15 } }));
    const text = [strip?.title, strip?.onStage, strip?.details, ...(strip?.lines ?? []), ...(strip?.segments.map((s) => s.text) ?? [])].join(' | ');
    expect(text).not.toContain('15');
    expect(text).not.toMatch(/\d+ ?\/ ?\d+/);
    expect(text).not.toContain('%');
    expect(text.toLowerCase()).not.toMatch(/average|behind|ahead|rank/);
  });
});

describe('journeyStrip: hard rules', () => {
  it('exports no aggregate, sort or filter: one strip per learner from that learner only', () => {
    // `readJourney` reads one learner's journey; the Learning Route stage list (LR-7) shares it.
    expect(Object.keys(stripModule).sort()).toEqual(['JOURNEY_STATES', 'journeyStrip', 'readJourney']);
  });
});

describe('readJourney: the tolerant reader the strip and the Learning Route stage list share (LR-7)', () => {
  it('reads the entries in stage order with their counts, leaves total behind and points at the here entry', () => {
    const read = readJourney(appendixC({ stage1: { done: 2, known: 4 } }, 'stage2'));
    expect(read?.entries.map((e) => e.stage)).toEqual(STAGES);
    expect(read?.entries[0]).toEqual({ stage: 'stage1', order: 1, state: 'open', done: 2, known: 4 });
    expect(read?.here).toBe(read?.entries[1]);
    expect(JSON.stringify(read)).not.toContain('total');
  });

  it('gives no here entry when here names no readable stage, and null when nothing is readable', () => {
    expect(readJourney(appendixC({}, 'stage9'))?.here).toBeNull();
    expect(readJourney(appendixC({}, null))?.here).toBeNull();
    for (const journey of [undefined, null, 'journey', { v: 2, here: 'stage1', stages: [] }, { v: 1, here: 'stage1', stages: 'x' }, { v: 1, here: 'stage1', stages: [{ stage: 'stage9', state: 'open', done: 1, known: 0 }] }]) {
      expect(readJourney(journey)).toBeNull();
    }
  });
});
