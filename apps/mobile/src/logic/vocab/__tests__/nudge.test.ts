import type { VocabItemState, VocabProgress } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { NUDGE_MIN_DUE, vocabNudge, type NudgeTopicRef } from '../nudge';

const TODAY = '2026-10-20';

function st(id: string, due: string | null = TODAY): VocabItemState {
  return {
    id,
    first: '2026-09-01',
    seen: 1,
    right: 1,
    bestBox: 2,
    last: '2026-10-01',
    box: 2,
    due,
    at: '2026-10-01T10:00:00.000Z',
  };
}
const slice = (items: VocabItemState[]): VocabProgress => ({ v: 1, items, topics: [] });

const TOPICS: Record<string, NudgeTopicRef> = {
  food: { key: 'food', order: 1 },
  animals: { key: 'animals', order: 2 },
  colors: { key: 'colors', order: 3 },
};
const WORD_TOPIC: Record<string, string> = {
  'vocab:sagwa-apple': 'food',
  'vocab:bap-rice': 'food',
  'vocab:mul-water': 'food',
  'vocab:gae-dog': 'animals',
  'vocab:goyangi-cat': 'animals',
  'vocab:so-cow': 'animals',
  'vocab:ppalgang-red': 'colors',
};
const topicOf = (id: string): NudgeTopicRef | undefined => {
  const key = WORD_TOPIC[id];
  return key === undefined ? undefined : TOPICS[key];
};

describe('vocabNudge (F-VOC-005 section 3.7)', () => {
  it('needs at least 3 due words', () => {
    expect(NUDGE_MIN_DUE).toBe(3);
    expect(vocabNudge(slice([st('vocab:sagwa-apple'), st('vocab:gae-dog')]), topicOf, TODAY)).toBeNull();
    expect(vocabNudge(slice([st('vocab:sagwa-apple'), st('vocab:gae-dog'), st('vocab:bap-rice')]), topicOf, TODAY)).toEqual({
      topicKey: 'food',
      due: 3,
    });
  });

  it('counts only due words: not yet due and unscheduled words do not count', () => {
    const v = slice([
      st('vocab:sagwa-apple'),
      st('vocab:bap-rice', '2026-10-21'),
      st('vocab:mul-water', null),
      st('vocab:gae-dog', '2026-10-01'),
    ]);
    expect(vocabNudge(v, topicOf, TODAY)).toBeNull();
  });

  it('picks the topic with the most due words and reports the due count across all topics', () => {
    const v = slice([
      st('vocab:sagwa-apple'),
      st('vocab:gae-dog'),
      st('vocab:goyangi-cat'),
      st('vocab:so-cow'),
      st('vocab:ppalgang-red'),
    ]);
    expect(vocabNudge(v, topicOf, TODAY)).toEqual({ topicKey: 'animals', due: 5 });
  });

  it('breaks a tie by topic order, whatever the slice order', () => {
    const v = slice([
      st('vocab:gae-dog'),
      st('vocab:goyangi-cat'),
      st('vocab:ppalgang-red'),
      st('vocab:sagwa-apple'),
      st('vocab:bap-rice'),
    ]);
    expect(vocabNudge(v, topicOf, TODAY)).toEqual({ topicKey: 'food', due: 5 });
    const reversed: Record<string, NudgeTopicRef> = { ...TOPICS, food: { key: 'food', order: 9 } };
    expect(vocabNudge(v, (id) => (WORD_TOPIC[id] ? reversed[WORD_TOPIC[id]!] : undefined), TODAY)).toEqual({
      topicKey: 'animals',
      due: 5,
    });
  });

  it('breaks a tie of equal order by topic key', () => {
    const same = (id: string): NudgeTopicRef | undefined => {
      const key = WORD_TOPIC[id];
      return key === undefined ? undefined : { key, order: 1 };
    };
    const v = slice([st('vocab:gae-dog'), st('vocab:goyangi-cat'), st('vocab:sagwa-apple'), st('vocab:bap-rice')]);
    expect(vocabNudge(v, same, TODAY)).toEqual({ topicKey: 'animals', due: 4 });
  });

  it('ignores words whose topic cannot be opened (unknown or hidden)', () => {
    const v = slice([st('vocab:sagwa-apple'), st('vocab:bap-rice'), st('vocab:unknown-word'), st('vocab:another-word')]);
    expect(vocabNudge(v, topicOf, TODAY)).toBeNull();
  });

  it('returns only a topic key and a count: nothing about how long words have waited', () => {
    const recent = slice([st('vocab:sagwa-apple'), st('vocab:bap-rice'), st('vocab:mul-water')]);
    const long = slice([
      st('vocab:sagwa-apple', '2026-09-01'),
      st('vocab:bap-rice', '2026-08-01'),
      st('vocab:mul-water', '2025-10-20'),
    ]);
    const a = vocabNudge(recent, topicOf, TODAY);
    expect(a).not.toBeNull();
    expect(Object.keys(a!).sort()).toEqual(['due', 'topicKey']);
    expect(vocabNudge(long, topicOf, TODAY)).toEqual(a);
  });

  it('returns null for an empty slice', () => {
    expect(vocabNudge(slice([]), topicOf, TODAY)).toBeNull();
  });
});
