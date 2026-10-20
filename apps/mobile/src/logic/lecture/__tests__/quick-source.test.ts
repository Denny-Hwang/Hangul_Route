import { CATALOG, cellIsReady, storyIsReady, type ChooserEpisodeRow, type ChooserGroup } from '@hangul-route/content-schema';
import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { describe, expect, it } from 'vitest';
import { episodeById, jamoConsonants, jamoVowels, questById } from '../../../content';
import { localizeEpisode, localizeQuest } from '../../content-locale';
import { lectureBundle } from '../content';
import { expandDeck } from '../deck-builder';
import { buildQuickDeck, pressLesson, pressRow, rowCheck } from '../quick-lesson';
import { blockMinutesOn, presenterChooserGroups } from '../quick-source';

/**
 * The bundle behind the presenter's Customize (AMENDMENTS-LECTURE-V2 section 18.3, row LV-3): the
 * shared grouped chooser over `CATALOG` with Stage 1 to 7, the stories and word topics the
 * presenter can show (PR 11 and PR 12 adapters), the letter sets, and every title in the presenter
 * language through the content overlays.
 */

const labels = { consonants: 'Consonants', vowels: 'Vowels' };
const groups = presenterChooserGroups('en', labels);
const rows = groups.flatMap((g) => g.rows);
const episodes = rows.filter((r): r is ChooserEpisodeRow => r.kind === 'episode');

describe('presenterChooserGroups: what Customize offers', () => {
  it('has Stage 1 to 7 (each only with a ready cell), then Stories, then Word topics', () => {
    const readyStages = [...new Set(CATALOG.cells.filter(cellIsReady).map((c) => c.stage))];
    expect(groups.map((g) => g.id)).toEqual([...readyStages, 'stories', 'topics']);
    expect(groups.filter((g) => g.stage !== null).map((g) => g.stage)).toEqual(readyStages.map((s) => Number(s.slice(-1))));
  });

  it('lists every ready cell as an episode row the bundle can expand, with its lessons in cell order', () => {
    expect(episodes.map((e) => e.key).sort()).toEqual(CATALOG.cells.filter(cellIsReady).map((c) => c.episodeId).sort());
    for (const row of episodes) {
      expect(episodeById(row.key), row.key).toBeDefined();
      expect(row.lessons.map((l) => l.key)).toEqual(CATALOG.cells.find((c) => c.episodeId === row.key)!.questIds);
      expect(row.minutes).toBe(CATALOG.cells.find((c) => c.episodeId === row.key)!.minutes);
    }
    // At most five rows a stage (one per theme), Word Builder with six lessons.
    for (const group of groups.filter((g) => g.stage !== null)) expect(group.rows.filter((r) => r.kind === 'episode').length).toBeLessThanOrEqual(5);
    expect(episodes.find((e) => e.key === 'episode:stage2-letters')!.lessons).toHaveLength(6);
  });

  it('adds the 14 consonants and 10 vowels to Stage 1 (the Letters tab draws them)', () => {
    const sets = rows.filter((r) => r.kind === 'letters');
    expect(sets.map((r) => r.key)).toEqual(['letters:consonants', 'letters:vowels']);
    expect(sets.map((r) => (r.kind === 'letters' ? r.jamoIds : []))).toEqual([jamoConsonants.map((j) => j.id), jamoVowels.map((j) => j.id)]);
    expect(groups[0]!.rows.slice(-2).map((r) => r.title)).toEqual(['Consonants', 'Vowels']);
  });

  it('adds the stories the presenter can show (ready, through the Library gate), in catalogue order', () => {
    const stories = groups.find((g) => g.id === 'stories')!.rows;
    const ready = CATALOG.stories.filter(storyIsReady).sort((a, b) => a.order - b.order);
    const bundle = lectureBundle('en');
    expect(stories.length).toBeGreaterThan(8);
    expect(stories.map((s) => s.key)).toEqual(ready.filter((s) => typeof bundle.story?.(s.id) === 'object').map((s) => s.id));
    for (const story of stories) expect(typeof bundle.story?.(story.key), story.key).toBe('object');
  });

  it('adds the word topics the presenter can show, each with the minutes the start screen will say', () => {
    const topics = groups.find((g) => g.id === 'topics')!.rows;
    const bundle = lectureBundle('en');
    expect(topics.length).toBeGreaterThan(8);
    for (const topic of topics) {
      expect(topic.key).toMatch(/^vocab-topic:/);
      const shown = bundle.vocabTopic?.(topic.key);
      expect(typeof shown, topic.key).toBe('object');
      expect(topic.kind === 'topic' ? topic.minutes : -1).toBe(blockMinutesOn(bundle, { kind: 'vocab', topicId: topic.key }));
      expect(topic.kind === 'topic' ? topic.minutes : 0).toBeGreaterThan(0);
    }
  });

  it('every row and lesson expands to slides, and the whole of one stage builds a valid deck', () => {
    const bundle = lectureBundle('en');
    for (const row of rows) {
      const deck = buildQuickDeck([row.key], groups, { now: new Date('2026-10-17T00:00:00Z'), rng: () => 0.3, fallbackTitle: 'Your lesson' });
      expect(deck, row.key).not.toBeNull();
      const expanded = expandDeck(deck!, bundle, { canPlayKorean: true });
      expect(expanded.slides.length, row.key).toBeGreaterThan(1);
      expect(expanded.skipped.filter((s) => s.reason === 'unknown-id' || s.reason === 'not-ready'), row.key).toEqual([]);
    }
  });
});

describe('titles in the presenter language (F-I18N-001 section 3.6)', () => {
  const titleOf = (gs: readonly ChooserGroup[], key: string): string => {
    for (const row of gs.flatMap((g) => g.rows)) {
      if (row.key === key) return row.title;
      if (row.kind === 'episode') {
        const lesson = row.lessons.find((l) => l.key === key);
        if (lesson) return lesson.title;
      }
    }
    return '';
  };

  it('English titles are the bundle\'s and the catalogue\'s', () => {
    expect(titleOf(groups, 'episode:stage1-letters')).toBe('Meet the Letters');
    expect(titleOf(groups, 'quest:stage1-letters-q1')).toBe(questById('quest:stage1-letters-q1')!.titleEn);
    expect(titleOf(groups, 'story:hangeul-day')).toBe(CATALOG.stories.find((s) => s.id === 'story:hangeul-day')!.title);
    expect(titleOf(groups, 'vocab-topic:food')).toBe(CATALOG.topics.find((t) => t.key === 'food')!.title);
  });

  it('es and ko follow the overlays: episodes, lessons, stories and word topics', () => {
    for (const locale of ['es', 'ko'] as const) {
      const local = presenterChooserGroups(locale, labels);
      expect(local.map((g) => g.id)).toEqual(groups.map((g) => g.id));
      expect(titleOf(local, 'episode:stage1-letters')).toBe(localizeEpisode(episodeById('episode:stage1-letters')!, locale).titleEn);
      expect(titleOf(local, 'quest:stage2-life-q1')).toBe(localizeQuest(questById('quest:stage2-life-q1')!, locale).titleEn);
      const story = (OVERLAYS[locale]['story:hangeul-day'] as { title?: string } | undefined)?.title;
      expect(story).toBeTruthy();
      expect(titleOf(local, 'story:hangeul-day')).toBe(story);
      const topic = (OVERLAYS[locale]['vocab-topic:food'] as { title?: string } | undefined)?.title;
      expect(topic).toBeTruthy();
      expect(titleOf(local, 'vocab-topic:food')).toBe(topic);
      // Most titles are translated (a few lesson titles may still fall back to English).
      const translated = local.flatMap((g) => g.rows).filter((r) => r.title !== titleOf(groups, r.key)).length;
      expect(translated / local.flatMap((g) => g.rows).length).toBeGreaterThan(0.8);
    }
  });
});

describe('the presenter\'s tri-state presses on the real groups', () => {
  it('Word Builder whole is one block; two of its lessons make it mixed, and the row then merges them', () => {
    const wb = episodes.find((e) => e.key === 'episode:stage2-letters')!;
    let chosen = pressLesson([], wb, wb.lessons[1]!.key, groups)!;
    chosen = pressLesson(chosen, wb, wb.lessons[4]!.key, groups)!;
    expect(rowCheck(chosen, wb)).toBe('mixed');
    chosen = pressRow(chosen, wb, groups)!;
    expect(chosen).toEqual(['episode:stage2-letters']);
  });
});
