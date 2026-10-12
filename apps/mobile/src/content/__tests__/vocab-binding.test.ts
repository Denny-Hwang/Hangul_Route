import { describe, expect, it } from 'vitest';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../__generated__/vocab';
import { topicItems, visibleItems, vocabItem, vocabTopic, vocabTopics } from '../vocab';

describe('content/vocab.ts binding', () => {
  it('resolves generated items by id', () => {
    expect(vocabItem('vocab:sagwa-apple')?.ko).toBe('사과');
  });

  it('serves every generated Food item through topicItems', () => {
    const food = VOCAB_ITEMS.filter((i) => i.topics.includes('food'));
    expect(topicItems('food')).toHaveLength(food.length);
  });

  it('keeps draft topics out of the picker list (showDrafts is off)', () => {
    expect(vocabTopics.every((t) => t.status !== 'draft')).toBe(true);
    for (const t of VOCAB_TOPICS.filter((x) => x.status === 'draft')) {
      expect(vocabTopics.map((v) => v.key)).not.toContain(t.key);
    }
  });

  it('lists all twelve reviewed topics (status ready, V-7) in topic order', () => {
    expect(VOCAB_TOPICS.every((t) => t.status === 'ready')).toBe(true);
    expect(vocabTopics.map((t) => t.key)).toEqual([
      'food',
      'animals',
      'colors',
      'numbers',
      'family',
      'school',
      'body',
      'nature',
      'travel',
      'sports',
      'k-culture',
      'science',
    ]);
  });

  it('serves only words of the listed topics through visibleItems, now every launch word', () => {
    const listed = new Set<string>(vocabTopics.map((t) => t.key));
    expect(visibleItems.every((i) => listed.has(i.topics[0]!))).toBe(true);
    expect(visibleItems).toHaveLength(VOCAB_ITEMS.length);
    expect(visibleItems.map((i) => i.id)).toContain('vocab:gong-ball');
  });

  it('still looks a topic up by key', () => {
    expect(vocabTopic('food')?.id).toBe('vocab-topic:food');
  });
});
