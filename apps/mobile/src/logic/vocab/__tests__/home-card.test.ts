import { describe, expect, it } from 'vitest';
import { homeVocabNudge, topicRefIndex } from '../home-card';
import { progress, state, topic, word } from './fixtures';

/** The Home card's inputs (F-VOC-005 section 3.7, PR P-3): which topic opens a word, and the gated nudge. */

const NOW = new Date(2026, 9, 20, 15, 0, 0); // 2026-10-20, local time
const TODAY = '2026-10-20';

const food = topic('food', { order: 1 });
const animals = topic('animals', { order: 2 });
const colors = topic('colors', { order: 3 });

const apple = word('sagwa-apple', { topics: ['food'] });
const rice = word('bap-rice', { topics: ['food'] });
const dog = word('gae-dog', { topics: ['animals'] });
// Filed under animals first, also listed in food.
const fish = word('mulgogi-fish', { topics: ['animals', 'food'] });
const red = word('ppalgang-red', { topics: ['colors'] });
const ALL = [apple, rice, dog, fish, red];
const wordsOf = (key: string) => ALL.filter((w) => (w.topics as readonly string[]).includes(key));

describe('topicRefIndex', () => {
  it('maps each word to the topic that opens it, with its picker order', () => {
    const topicOf = topicRefIndex([food, animals, colors], wordsOf);
    expect(topicOf(apple.id)).toEqual({ key: 'food', order: 1 });
    expect(topicOf(dog.id)).toEqual({ key: 'animals', order: 2 });
    expect(topicOf(red.id)).toEqual({ key: 'colors', order: 3 });
  });

  it('prefers the primary topic of a word listed in two topics', () => {
    expect(topicRefIndex([food, animals], wordsOf)(fish.id)).toEqual({ key: 'animals', order: 2 });
  });

  it('falls back to another shown topic when the primary one is not shown or not open', () => {
    expect(topicRefIndex([food, colors], wordsOf)(fish.id)).toEqual({ key: 'food', order: 1 });
    expect(topicRefIndex([food, animals], wordsOf, (key) => key !== 'animals')(fish.id)).toEqual({ key: 'food', order: 1 });
  });

  it('is undefined for a word no shown, open topic holds (a hidden or locked topic, an unknown id)', () => {
    const topicOf = topicRefIndex([food, animals], wordsOf, (key) => key !== 'animals');
    expect(topicOf(dog.id)).toBeUndefined();
    expect(topicOf(red.id)).toBeUndefined();
    expect(topicOf('vocab:from-a-newer-app')).toBeUndefined();
  });
});

describe('homeVocabNudge', () => {
  const topicOf = topicRefIndex([food, animals, colors], wordsOf);
  const due = (slug: string) => state(slug, { due: TODAY });
  const snapshot = { vocab: progress([due('sagwa-apple'), due('bap-rice'), due('gae-dog')]) };

  it('is the nudge for the local day when Words is on', () => {
    expect(homeVocabNudge({ enabled: true, snapshot, topicOf, now: NOW })).toEqual({ topicKey: 'food', due: 3 });
  });

  it('is null with the flag off, whatever is due (Home unchanged)', () => {
    expect(homeVocabNudge({ enabled: false, snapshot, topicOf, now: NOW })).toBeNull();
  });

  it('is null without a snapshot, without a slice, or under three due words', () => {
    expect(homeVocabNudge({ enabled: true, snapshot: undefined, topicOf, now: NOW })).toBeNull();
    expect(homeVocabNudge({ enabled: true, snapshot: {}, topicOf, now: NOW })).toBeNull();
    const two = { vocab: progress([due('sagwa-apple'), due('bap-rice'), state('gae-dog', { due: '2026-10-21' })]) };
    expect(homeVocabNudge({ enabled: true, snapshot: two, topicOf, now: NOW })).toBeNull();
  });
});

describe('homeVocabNudge and the time zone (two day bases, section 3.7 and P5)', () => {
  // The due count follows the learner's local day (P5, the day the schedule writes `due` in), while
  // Home pins the plan by its UTC day key. These pin that split, away from UTC on both sides.
  const topicOf = topicRefIndex([food, animals, colors], wordsOf);
  const dueOn = (day: string) => ({ vocab: progress([state('sagwa-apple', { due: day }), state('bap-rice', { due: day }), state('gae-dog', { due: day })]) });

  function inZone<T>(tz: string, run: () => T): T {
    const before = process.env.TZ;
    process.env.TZ = tz;
    try {
      return run();
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  }

  it('west of UTC: an evening after the UTC rollover still counts by the local day', () => {
    // 2026-10-21T03:00Z is 20:00 on 2026-10-20 in Los Angeles: the plan's UTC day is the 21st.
    const now = new Date('2026-10-21T03:00:00.000Z');
    inZone('America/Los_Angeles', () => {
      expect(homeVocabNudge({ enabled: true, snapshot: dueOn('2026-10-21'), topicOf, now })).toBeNull();
      expect(homeVocabNudge({ enabled: true, snapshot: dueOn('2026-10-20'), topicOf, now })).toEqual({ topicKey: 'food', due: 3 });
    });
  });

  it('east of UTC: a morning before the UTC rollover already counts the new local day', () => {
    // 2026-10-20T20:00Z is 05:00 on 2026-10-21 in Seoul: the plan's UTC day is still the 20th.
    const now = new Date('2026-10-20T20:00:00.000Z');
    inZone('Asia/Seoul', () => {
      expect(homeVocabNudge({ enabled: true, snapshot: dueOn('2026-10-21'), topicOf, now })).toEqual({ topicKey: 'food', due: 3 });
    });
  });
});
