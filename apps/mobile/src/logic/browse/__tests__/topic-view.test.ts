import { describe, expect, it } from 'vitest';
import { itemFacts, type TopicFacts } from '../facts';
import { TOPIC_HEAR_SOURCE, topicHearShown, topicHearSpec } from '../topic-view';
import { fixtureBundle } from './browse-fixture';

/**
 * F-BROWSE-001 BR-9 (sections 4.2, 4.6 and 4.7; mock design/screens/browse/topic.md):
 * the word topic page. Until F-VOC-003's flashcards come to All lessons (its C-5),
 * the word list with its audio is the topic's preview, so a closed topic keeps
 * every word and drops only the Hear buttons (design decision 23).
 */
const bundle = fixtureBundle();

describe('topicHearShown (section 4.2, design decision 23)', () => {
  it('an open topic has Hear buttons; a closed one keeps its words and drops them', () => {
    expect(topicHearShown('open')).toBe(true);
    expect(topicHearShown('closed')).toBe(false);
  });

  it('a page with no pass to say otherwise never hides the audio (the Access screen covers it)', () => {
    expect(topicHearShown('later')).toBe(true);
    expect(topicHearShown('access')).toBe(true);
  });
});

describe('topicHearSpec (section 4.7: audio through playPrompt)', () => {
  it('plays the word as a word, through the learner audio, with its recording when it has one', () => {
    expect(topicHearSpec({ speech: { text: 'sagwa-spoken', audioRef: 'audio/vocab/food-apple.mp3' } })).toEqual({
      text: 'sagwa-spoken',
      audioRef: 'audio/vocab/food-apple.mp3',
      kind: 'word',
      source: TOPIC_HEAR_SOURCE,
    });
  });

  it('with no recording the device voice says it (the playPrompt fallback): no audioRef key at all', () => {
    const food = itemFacts({ kind: 'vocab-topic', id: 'vocab-topic:food' }, bundle) as TopicFacts;
    const [first] = food.words;
    if (!first) throw new Error('the food topic has words');
    const spec = topicHearSpec(first);
    expect(spec).toEqual({ text: first.ko, kind: 'word', source: TOPIC_HEAR_SOURCE });
    expect('audioRef' in spec).toBe(false);
  });

  it('names its surface for the audio telemetry, never a person', () => {
    expect(TOPIC_HEAR_SOURCE).toBe('browse-topic');
  });
});
