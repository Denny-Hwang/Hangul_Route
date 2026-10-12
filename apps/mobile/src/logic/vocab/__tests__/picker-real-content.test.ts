import { describe, expect, it } from 'vitest';
import { visibleItems, vocabTopics } from '../../../content/vocab';
import { canDrawPicture } from '../../__tests__/drawn-pictures';
import { wordsOfTopic } from '../topic-view';
import { visibleTopics } from '../topics';

/**
 * F-VOC-003 T8 on the real bundle and the real art (F-VOC-001 V-7): a topic
 * that is `ready` but whose art is not drawn yet never reaches the picker. The
 * picker is `pickerTopics()` of `screens/vocab/topic-data.ts`, which wires
 * exactly these parts with the release flags (no drafts, no previews). The
 * assertions hold before and after each word-art batch lands.
 */
const wordsOf = (key: string) => wordsOfTopic(visibleItems, key);
const picker = visibleTopics(vocabTopics, wordsOf, canDrawPicture, { drafts: false, preview: false });
const listed = picker.map((t) => t.key);

describe('the Words picker on the real bundle (T8)', () => {
  it('lists every word of every listed topic with a drawn picture, never a text tile', () => {
    expect(listed.length).toBeGreaterThan(0);
    for (const topic of picker) {
      const words = wordsOf(topic.key);
      expect(words.length, topic.key).toBeGreaterThan(0);
      for (const word of words) expect(canDrawPicture(word.visual), `${topic.key} ${word.id} ${word.visual}`).toBe(true);
    }
  });

  it('leaves out each ready topic with a word whose picture is not drawn yet', () => {
    for (const topic of vocabTopics.filter((t) => t.status === 'ready' || t.status === 'shipped')) {
      const undrawn = wordsOf(topic.key).filter((w) => !canDrawPicture(w.visual));
      expect(listed.includes(topic.key), `${topic.key}: ${undrawn.map((w) => w.visual).join(', ')}`).toBe(undrawn.length === 0);
    }
  });

  it('lists the eight topics whose art is merged (W-1 to W-5), in topic order', () => {
    const drawn = ['food', 'animals', 'colors', 'numbers', 'family', 'school', 'body', 'nature'];
    for (const key of drawn) expect(listed, key).toContain(key);
    expect([...picker].sort((a, b) => a.order - b.order).map((t) => t.key)).toEqual(listed);
  });

  it('never lists a draft or preview topic in a release build', () => {
    for (const topic of picker) expect(['ready', 'shipped'], topic.key).toContain(topic.status);
  });
});
