import type { Overlays, RuntimeVocabItem, VocabTopic } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { createVocabCatalog } from '../../vocab/catalog';
import { lectureVocabTopics, lectureVocabTopicsFrom } from '../sources/vocab';

/**
 * The vocabulary topic adapter (F-TCH-004 §3.3 rule 4, §8; PR 12): the presenter's only
 * view of `content/vocab/*.json` (F-VOC-001). A `ready` or `shipped` topic expands; a
 * `draft` or `preview` one is not ready; an unknown id is undefined. A word's `card:`
 * picture becomes its card, a `word:` picture its WordArt key (README D9).
 */

const food = VOCAB_TOPICS.find((t) => t.key === 'food')!;

const topic = (over: Partial<VocabTopic>): VocabTopic => ({ ...food, ...over });
const item = (over: Partial<RuntimeVocabItem> & { id: string }): RuntimeVocabItem => ({
  ...VOCAB_ITEMS.find((i) => i.id === 'vocab:sagwa-apple')!,
  ...over,
});

describe('lectureVocabTopics (F-TCH-004 PR 12)', () => {
  it('gives every shipped ready topic with all of its words, in the catalogue order', () => {
    const catalog = createVocabCatalog(VOCAB_TOPICS, VOCAB_ITEMS);
    const source = lectureVocabTopics('en');
    const ready = VOCAB_TOPICS.filter((t) => t.status === 'ready' || t.status === 'shipped');
    expect(ready.length).toBeGreaterThan(0);
    for (const t of ready) {
      const got = source.vocabTopic(t.id);
      if (got === undefined || got === 'not-ready') throw new Error(`${t.id} did not expand`);
      expect(got.title).toBe(t.titleEn);
      expect(got.words.map((w) => w.id)).toEqual(catalog.topicItems(t.key).map((i) => i.id));
      for (const w of got.words) {
        expect(w.ko.length).toBeGreaterThan(0);
        expect(w.romanization.length).toBeGreaterThan(0);
        expect(w.gloss.length).toBeGreaterThan(0);
      }
    }
  });

  it('reads the Food topic: title, Hoya line, word, romanization, gloss and its picture', () => {
    const got = lectureVocabTopics('en').vocabTopic('vocab-topic:food');
    if (got === undefined || got === 'not-ready') throw new Error('food did not expand');
    expect(got.title).toBe('Food');
    expect(got.hoyaLine).toBe(food.hoyaIntroEn);
    expect(got.words.find((w) => w.id === 'vocab:sagwa-apple')).toEqual({
      id: 'vocab:sagwa-apple',
      ko: '사과',
      romanization: 'sagwa',
      gloss: 'apple',
      wordArt: 'food-apple',
    });
    expect(got.words.find((w) => w.id === 'vocab:gimchi')).toEqual({
      id: 'vocab:gimchi',
      ko: '김치',
      romanization: 'gimchi',
      gloss: 'kimchi',
      cardId: 'card:kimchi',
    });
  });

  it('follows the presenter language for the title, the Hoya line and the glosses; Korean never changes', () => {
    const en = lectureVocabTopics('en').vocabTopic('vocab-topic:food');
    const es = lectureVocabTopics('es').vocabTopic('vocab-topic:food');
    if (en === undefined || en === 'not-ready' || es === undefined || es === 'not-ready') throw new Error('food did not expand');
    expect(es.title).toBe('Comida');
    expect(es.hoyaLine).not.toBe(en.hoyaLine);
    const apple = es.words.find((w) => w.id === 'vocab:sagwa-apple')!;
    expect(apple.gloss).toBe('manzana');
    expect(es.words.map((w) => [w.ko, w.romanization])).toEqual(en.words.map((w) => [w.ko, w.romanization]));
  });

  it('takes overlays for the topic text and falls back to English field by field', () => {
    const overlays: Overlays = { es: { 'vocab-topic:food': { title: 'Comidas' } }, ko: {} };
    const got = lectureVocabTopicsFrom([food], VOCAB_ITEMS, 'es', overlays).vocabTopic('vocab-topic:food');
    if (got === undefined || got === 'not-ready') throw new Error('food did not expand');
    expect(got.title).toBe('Comidas');
    expect(got.hoyaLine).toBe(food.hoyaIntroEn);
  });

  it('a draft or preview topic is not ready; an unknown id is undefined', () => {
    const source = lectureVocabTopicsFrom(
      [topic({ id: 'vocab-topic:draft', key: 'animals', status: 'draft' }), topic({ id: 'vocab-topic:preview', key: 'body', status: 'preview' })],
      VOCAB_ITEMS,
      'en',
    );
    expect(source.vocabTopic('vocab-topic:draft')).toBe('not-ready');
    expect(source.vocabTopic('vocab-topic:preview')).toBe('not-ready');
    expect(source.vocabTopic('vocab-topic:nope')).toBeUndefined();
    expect(source.vocabTopic('vocab-topic:food')).toBeUndefined();
  });

  it('a shipped topic expands; a topic without a Hoya line has none; a swatch picture is left out', () => {
    const shipped = topic({ status: 'shipped', hoyaIntroEn: undefined });
    const items = [
      item({ id: 'vocab:one', visual: 'word:food-apple' }),
      item({ id: 'vocab:two', visual: 'card:rice' }),
      item({ id: 'vocab:three', visual: 'swatch:theme.life' }),
    ];
    const got = lectureVocabTopicsFrom([shipped], items, 'en').vocabTopic('vocab-topic:food');
    if (got === undefined || got === 'not-ready') throw new Error('food did not expand');
    expect('hoyaLine' in got).toBe(false);
    expect(got.words.map((w) => [w.id, w.wordArt, w.cardId])).toEqual([
      ['vocab:one', 'food-apple', undefined],
      ['vocab:two', undefined, 'card:rice'],
      ['vocab:three', undefined, undefined],
    ]);
  });
});
