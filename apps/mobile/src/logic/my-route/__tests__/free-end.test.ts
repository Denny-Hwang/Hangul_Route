import { describe, expect, it } from 'vitest';
import { FREE_VOCAB_TOPIC_IDS } from '../../content-access';
import { vocabTopics } from '../../../content/vocab';
import { practiceTopicOf } from '../free-end';

/**
 * The free-end hero's Practice words button (Learning Route amendment section 4.5, LR-5b): the first
 * free word topic this build lists, in the build's own topic order; none, and the hero offers Open
 * Library instead.
 */
describe('practiceTopicOf', () => {
  it('is the first listed topic that stays free, in the listed order', () => {
    expect(practiceTopicOf(['travel', 'animals', 'food'])).toBe('animals');
    expect(practiceTopicOf(['food', 'animals'])).toBe('food');
  });

  it('is null when no listed topic stays free, or nothing is listed', () => {
    expect(practiceTopicOf(['travel', 'school'])).toBeNull();
    expect(practiceTopicOf([])).toBeNull();
  });

  it('this build lists at least one free topic, so the hero says Practice words today', () => {
    const keys = vocabTopics.map((t) => t.key);
    const topic = practiceTopicOf(keys);
    expect(topic).not.toBeNull();
    expect(FREE_VOCAB_TOPIC_IDS).toContain(topic);
    expect(keys.find((k) => FREE_VOCAB_TOPIC_IDS.includes(k))).toBe(topic);
  });
});
