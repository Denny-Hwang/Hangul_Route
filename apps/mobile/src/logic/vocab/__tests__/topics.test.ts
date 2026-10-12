import { describe, expect, it } from 'vitest';
import { topicState, visibleTopics } from '../topics';
import { progress, state, topic, topicRow, word } from './fixtures';

const FOOD = topic('food', { order: 1 });
const ANIMALS = topic('animals', { order: 2, status: 'shipped' });
const COLORS = topic('colors', { order: 3, status: 'draft' });
const NUMBERS = topic('numbers', { order: 4, status: 'preview' });

const ITEMS: Record<string, ReturnType<typeof word>[]> = {
  food: [word('a', { visual: 'word:food-a' }), word('b', { visual: 'word:food-b' })],
  animals: [word('c', { visual: 'word:animals-c' }), word('d', { visual: 'card:hangul' })],
  colors: [word('e', { visual: 'word:colors-e' })],
  numbers: [word('f', { visual: 'word:numbers-f' })],
};
const itemsOf = (key: string) => ITEMS[key] ?? [];
const all = () => true;

describe('visibleTopics (F-VOC-003 section 3.2, T8)', () => {
  it('lists ready and shipped topics whose every picture resolves, in topic order', () => {
    expect(visibleTopics([ANIMALS, COLORS, FOOD, NUMBERS], itemsOf, all).map((t) => t.key)).toEqual(['food', 'animals']);
  });

  it('hides a topic when one picture cannot be drawn', () => {
    const canRender = (ref: string) => ref !== 'word:food-b';
    expect(visibleTopics([FOOD, ANIMALS], itemsOf, canRender).map((t) => t.key)).toEqual(['animals']);
  });

  it('asks about every item visual of the topic', () => {
    const asked: string[] = [];
    visibleTopics([ANIMALS], itemsOf, (ref) => {
      asked.push(ref);
      return true;
    });
    expect(asked).toEqual(['word:animals-c', 'card:hangul']);
  });

  it('hides a topic with no words at all', () => {
    expect(visibleTopics([topic('school')], itemsOf, all)).toEqual([]);
  });

  it('shows preview topics only when asked (dev builds), draft topics only with drafts on', () => {
    expect(visibleTopics([COLORS, NUMBERS], itemsOf, all, { preview: true }).map((t) => t.key)).toEqual(['numbers']);
    expect(visibleTopics([COLORS, NUMBERS], itemsOf, all, { drafts: true }).map((t) => t.key)).toEqual(['colors']);
    expect(visibleTopics([NUMBERS, COLORS], itemsOf, all, { preview: true, drafts: true }).map((t) => t.key)).toEqual([
      'colors',
      'numbers',
    ]);
  });

  it('does not reorder the input it was given', () => {
    const input = [ANIMALS, FOOD];
    visibleTopics(input, itemsOf, all);
    expect(input.map((t) => t.key)).toEqual(['animals', 'food']);
  });
});

describe('topicState (F-VOC-003 section 3.2)', () => {
  const ids = ['vocab:a', 'vocab:b', 'vocab:c'];

  it('counts the collected words of the topic and nothing else', () => {
    const p = progress([state('a'), state('z')]);
    expect(topicState('food', ids, p)).toEqual({ total: 3, collected: 1, started: true, complete: false });
  });

  it('is complete when every word is collected', () => {
    const p = progress([state('a'), state('b'), state('c')]);
    expect(topicState('food', ids, p)).toEqual({ total: 3, collected: 3, started: true, complete: true });
  });

  it('is not started with nothing collected and no session; started with a session row only', () => {
    expect(topicState('food', ids, progress())).toEqual({ total: 3, collected: 0, started: false, complete: false });
    expect(topicState('food', ids, progress([], [topicRow('food')])).started).toBe(true);
    expect(topicState('food', ids, progress([], [topicRow('animals')])).started).toBe(false);
  });

  it('counts a repeated id once and an empty topic is never complete', () => {
    expect(topicState('food', ['vocab:a', 'vocab:a'], progress([state('a')]))).toEqual({
      total: 1,
      collected: 1,
      started: true,
      complete: true,
    });
    expect(topicState('food', [], progress()).complete).toBe(false);
  });

  it('returns counts only: no percent or fraction field (D3)', () => {
    expect(Object.keys(topicState('food', ids, progress())).sort()).toEqual(['collected', 'complete', 'started', 'total']);
  });
});
