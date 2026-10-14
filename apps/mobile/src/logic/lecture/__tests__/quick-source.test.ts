import { describe, expect, it } from 'vitest';
import { episodeById, jamoConsonants, jamoVowels, questById } from '../../../content';
import { expandDeck } from '../deck-builder';
import { lectureBundle } from '../content';
import { buildQuickDeck, quickGroups } from '../quick-lesson';
import { quickSource } from '../quick-source';

const labels = { consonants: 'Consonants', vowels: 'Vowels' };

describe('quickSource: the bundle behind Quick lesson (F-TCH-004 §3.12)', () => {
  const source = quickSource('en');

  it('lists only shipped grid episodes that hold lessons, with their minutes', () => {
    expect(source.episodes.length).toBeGreaterThan(0);
    for (const e of source.episodes) {
      const episode = episodeById(e.id)!;
      expect(episode.status).toBe('shipped');
      expect(episode.placement).not.toBe('shelf');
      expect(e.questIds.length).toBeGreaterThan(0);
      expect(e.minutes).toBe(episode.estimatedMinutes);
    }
    expect(source.episodes[0]).toMatchObject({ id: 'episode:stage1-letters', title: 'Meet the Letters' });
  });

  it('has a lesson for every quest an episode lists', () => {
    for (const e of source.episodes) {
      for (const id of e.questIds) {
        const lesson = source.quests.find((q) => q.id === id);
        expect(lesson?.title).toBe(questById(id)!.titleEn);
      }
    }
  });

  it('offers the 14 consonants and 10 vowels, and no stories or topics before their adapters', () => {
    expect(source.consonants).toEqual(jamoConsonants.map((j) => j.id));
    expect(source.vowels).toEqual(jamoVowels.map((j) => j.id));
    expect(source.topics).toBeUndefined();
    expect(source.stories).toBeUndefined();
  });

  it('localises titles to the presenter language', () => {
    const es = quickSource('es');
    expect(es.episodes.map((e) => e.id)).toEqual(source.episodes.map((e) => e.id));
  });

  it('every item expands to at least one slide and the full selection is a valid deck', () => {
    const items = quickGroups(source, labels).flatMap((g) => g.items);
    for (const item of items) {
      const deck = buildQuickDeck([item.key], items, { now: new Date('2026-10-13T00:00:00Z'), rng: () => 0.3, fallbackTitle: 'Quick lesson' });
      expect(deck, item.key).not.toBeNull();
      const expanded = expandDeck(deck!, lectureBundle('en'), { canPlayKorean: true });
      expect(expanded.slides.length, item.key).toBeGreaterThan(1);
    }
  });
});
