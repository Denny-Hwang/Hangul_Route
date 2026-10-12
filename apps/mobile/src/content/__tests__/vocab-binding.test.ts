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

  it('lists the four reviewed free topics (status ready) in order', () => {
    expect(vocabTopics.map((t) => t.key)).toEqual(['food', 'animals', 'colors', 'numbers']);
  });

  it('keeps draft words out of visibleItems: only words of the listed topics', () => {
    const listed = new Set<string>(vocabTopics.map((t) => t.key));
    expect(visibleItems.length).toBeGreaterThan(0);
    expect(visibleItems.every((i) => listed.has(i.topics[0]!))).toBe(true);
    expect(visibleItems.map((i) => i.id)).not.toContain('vocab:gong-ball');
  });

  it('still looks a topic up by key', () => {
    expect(vocabTopic('food')?.id).toBe('vocab-topic:food');
  });
});
