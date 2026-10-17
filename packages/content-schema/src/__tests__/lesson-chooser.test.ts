import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  LECTURE_MAX_BLOCKS,
  LETTER_SET_KEYS,
  StageKeySchema,
  applyChooserSelection,
  chooserGroups,
  groupOfKey,
  jamoSetBlocks,
  lessonChosen,
  normalizeSearch,
  presetMinutesOf,
  pruneSelection,
  rowState,
  searchChooser,
  selectionBlocks,
  selectionEntries,
  selectionFits,
  selectionMinutes,
  selectionOf,
  toggleLesson,
  toggleRow,
  type Catalog,
  type ChooserEpisodeRow,
  type ChooserGroup,
  type ChooserOptions,
  type ChooserRow,
} from '../index';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * The grouped lesson chooser (owner report 2026-10-16 item 5, AMENDMENTS-LECTURE-V2 row
 * LV-3): groups and counts over the real `CATALOG`, all seven stages with the stories and
 * topics, search in English, Spanish and Korean titles, in Hangul and in romanization, and
 * the selection rules (whole episode, single lessons, letter sets, the 30-block cap).
 */

type Locale = 'en' | 'es' | 'ko';

/** English titles from the catalogue, by the ids the chooser asks for (topics as `vocab-topic:<key>`). */
function englishTitles(catalog: Catalog): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of catalog.cells) map.set(c.episodeId, c.title);
  for (const q of catalog.quests) map.set(q.id, q.title);
  for (const s of catalog.stories) map.set(s.id, s.title);
  for (const t of catalog.topics) map.set(`vocab-topic:${t.key}`, t.title);
  return map;
}

/** The shipped overlay titles of one locale (`content/i18n/<locale>/*.json`, field `title`). */
function overlayTitles(locale: 'es' | 'ko'): Map<string, string> {
  const dir = join(REPO_ROOT, 'content', 'i18n', locale);
  const map = new Map<string, string>();
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const file = JSON.parse(readFileSync(join(dir, name), 'utf8')) as { entries: Record<string, Record<string, unknown>> };
    for (const [id, entry] of Object.entries(file.entries)) if (typeof entry.title === 'string') map.set(id, entry.title);
  }
  return map;
}

const EN = englishTitles(CATALOG);
const OVERLAY: Record<'es' | 'ko', Map<string, string>> = { es: overlayTitles('es'), ko: overlayTitles('ko') };
const titleIn = (locale: Locale) => (id: string): string => (locale === 'en' ? undefined : OVERLAY[locale].get(id)) ?? EN.get(id) ?? id;
const koTitle = (id: string): string | null => OVERLAY.ko.get(id) ?? null;

const CONSONANTS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'].map((_, i) => `jamo:c${i + 1}`);
const VOWELS = Array.from({ length: 10 }, (_, i) => `jamo:v${i + 1}`);
const STORY_IDS = CATALOG.stories.map((s) => s.id);
const TOPIC_IDS = CATALOG.topics.map((t) => `vocab-topic:${t.key}`);

function options(locale: Locale, extra: Partial<ChooserOptions> = {}): ChooserOptions {
  return {
    catalog: CATALOG,
    title: titleIn(locale),
    koTitle,
    letters: {
      consonants: CONSONANTS,
      vowels: VOWELS,
      titles: { consonants: 'All consonants (14)', vowels: 'All vowels (10)' },
      chars: { consonants: ['ㄱ', 'ㄴ'], vowels: ['ㅏ'] },
    },
    stories: STORY_IDS,
    topics: TOPIC_IDS,
    ...extra,
  };
}

const groupsIn = (locale: Locale, extra: Partial<ChooserOptions> = {}): ChooserGroup[] => chooserGroups(options(locale, extra));
const group = (groups: readonly ChooserGroup[], id: string): ChooserGroup => {
  const found = groups.find((g) => g.id === id);
  if (!found) throw new Error(`no group ${id}`);
  return found;
};
const episode = (groups: readonly ChooserGroup[], key: string): ChooserEpisodeRow => {
  for (const g of groups) for (const r of g.rows) if (r.kind === 'episode' && r.key === key) return r;
  throw new Error(`no episode ${key}`);
};
const rowKeys = (g: ChooserGroup): string[] => g.rows.map((r) => r.key);
const keysOf = (groups: readonly ChooserGroup[]): string[] =>
  groups.flatMap((g) => g.rows.flatMap((r: ChooserRow) => [r.key, ...(r.kind === 'episode' ? r.lessons.map((l) => l.key) : [])]));

describe('chooserGroups: the groups over CATALOG', () => {
  const groups = groupsIn('en');

  it('lists Stage 1 to 7, then Stories, then Word topics', () => {
    expect(groups.map((g) => g.id)).toEqual([...StageKeySchema.options, 'stories', 'topics']);
    expect(groups.map((g) => g.stage)).toEqual([1, 2, 3, 4, 5, 6, 7, null, null]);
  });

  it('each stage holds its ready cells in theme order, each with its lessons in cell order', () => {
    for (const stage of StageKeySchema.options) {
      const cells = CATALOG.cells.filter((c) => c.stage === stage);
      const g = group(groups, stage);
      const episodes = g.rows.filter((r): r is ChooserEpisodeRow => r.kind === 'episode');
      expect(episodes.map((r) => r.key)).toEqual(['letters', 'life', 'rites', 'nature', 'crafts'].map((t) => `episode:${stage}-${t}`));
      for (const row of episodes) {
        const cell = cells.find((c) => c.episodeId === row.key)!;
        expect(row.lessons.map((l) => l.key)).toEqual(cell.questIds);
        expect(row.minutes).toBe(cell.minutes);
        expect(row.lessons.length).toBeGreaterThanOrEqual(2);
        expect(row.lessons.length).toBeLessThanOrEqual(6);
      }
      // The label counts the stage's lessons ("Stage n · k lessons").
      expect(g.count).toBe(cells.reduce((n, c) => n + c.questIds.length, 0));
    }
  });

  it('pins the counts of the shipped catalogue', () => {
    expect(groups.map((g) => g.count)).toEqual([15, 18, 15, 15, 14, 15, 15, 24, 12]);
    expect(episode(groups, 'episode:stage2-letters').lessons).toHaveLength(6);
    expect(keysOf(groups)).toHaveLength(35 + 107 + 2 + 24 + 12);
  });

  it('Stage 1 also holds the two letter sets, after its episodes', () => {
    const rows = group(groups, 'stage1').rows;
    expect(rows.slice(-2).map((r) => [r.kind, r.key, r.title])).toEqual([
      ['letters', LETTER_SET_KEYS.consonants, 'All consonants (14)'],
      ['letters', LETTER_SET_KEYS.vowels, 'All vowels (10)'],
    ]);
    for (const stage of StageKeySchema.options.slice(1)) expect(group(groups, stage).rows.every((r) => r.kind === 'episode')).toBe(true);
  });

  it('draws a letter set only when the surface offers its letters, and no letter rows without them', () => {
    const noVowels = groupsIn('en', { letters: { consonants: CONSONANTS, vowels: [], titles: { consonants: 'C', vowels: 'V' } } });
    expect(group(noVowels, 'stage1').rows.filter((r) => r.kind === 'letters').map((r) => r.key)).toEqual([LETTER_SET_KEYS.consonants]);
    const none = groupsIn('en', { letters: null });
    expect(group(none, 'stage1').rows.some((r) => r.kind === 'letters')).toBe(false);
  });

  it('Stories: the given ready stories in catalogue order; Word topics: the given topics in their order', () => {
    expect(rowKeys(group(groups, 'stories'))).toEqual([...CATALOG.stories].sort((a, b) => a.order - b.order).map((s) => s.id));
    expect(rowKeys(group(groups, 'topics'))).toEqual([...CATALOG.topics].sort((a, b) => a.order - b.order).map((t) => `vocab-topic:${t.key}`));
    const topic = group(groups, 'topics').rows[0]!;
    expect(topic.kind === 'topic' && topic.minutes).toBe(CATALOG.topics.find((t) => `vocab-topic:${t.key}` === topic.key)!.minutes);
    const some = groupsIn('en', { stories: [STORY_IDS[3]!, 'story:not-in-the-catalogue', STORY_IDS[0]!], topics: [TOPIC_IDS[2]!] });
    expect(rowKeys(group(some, 'stories'))).toEqual([STORY_IDS[0], STORY_IDS[3]]);
    expect(rowKeys(group(some, 'topics'))).toEqual([TOPIC_IDS[2]]);
  });

  it('a draft story is never offered', () => {
    const draft: Catalog = { ...CATALOG, stories: CATALOG.stories.map((s, i) => (i === 0 ? { ...s, status: 'draft' } : s)) };
    const rows = group(chooserGroups({ ...options('en'), catalog: draft }), 'stories').rows;
    expect(rows.map((r) => r.key)).not.toContain(CATALOG.stories[0]!.id);
    expect(rows).toHaveLength(CATALOG.stories.length - 1);
  });

  it('no Stories or Word topics group without ids (the plan builder)', () => {
    expect(groupsIn('en', { stories: null, topics: undefined }).map((g) => g.id)).toEqual([...StageKeySchema.options]);
    expect(groupsIn('en', { stories: [], topics: [] }).map((g) => g.id)).toEqual([...StageKeySchema.options]);
  });

  it('stages narrows the stage groups; a stage with no ready cell is not drawn', () => {
    expect(groupsIn('en', { stages: ['stage2', 'stage1'], stories: null, topics: null }).map((g) => g.id)).toEqual(['stage1', 'stage2']);
    const closed: Catalog = { ...CATALOG, cells: CATALOG.cells.map((c) => (c.stage === 'stage3' ? { ...c, status: 'preview' } : c)) };
    expect(chooserGroups({ ...options('en'), catalog: closed }).map((g) => g.id)).not.toContain('stage3');
  });

  it('a cell with no known lesson is not drawn, and an unknown quest id is skipped', () => {
    const odd: Catalog = {
      ...CATALOG,
      cells: CATALOG.cells.map((c) =>
        c.episodeId === 'episode:stage4-life' ? { ...c, questIds: ['quest:nowhere'] } : c.episodeId === 'episode:stage4-rites' ? { ...c, questIds: ['quest:nowhere', ...c.questIds] } : c,
      ),
    };
    const g = group(chooserGroups({ ...options('en'), catalog: odd }), 'stage4');
    expect(rowKeys(g)).not.toContain('episode:stage4-life');
    expect(episode([g], 'episode:stage4-rites').lessons.map((l) => l.key)).toEqual(CATALOG.cells.find((c) => c.episodeId === 'episode:stage4-rites')!.questIds);
  });

  it('every title comes from the caller in the UI language', () => {
    const ko = groupsIn('ko');
    expect(episode(ko, 'episode:stage1-letters').title).toBe('글자 만나기');
    expect(episode(ko, 'episode:stage1-letters').lessons[0]!.title).toBe(OVERLAY.ko.get('quest:stage1-letters-q1'));
    expect(group(ko, 'stories').rows.find((r) => r.key === 'story:hangeul-day')!.title).toBe('즐거운 한글날!');
    const es = groupsIn('es');
    expect(episode(es, 'episode:stage1-letters').title).toBe(OVERLAY.es.get('episode:stage1-letters'));
    expect(episode(groups, 'episode:stage1-letters').title).toBe('Meet the Letters');
  });
});

describe('searchChooser', () => {
  const en = groupsIn('en');
  const visible = (groups: readonly ChooserGroup[]): string[] => keysOf(groups);

  it('an empty or blank query changes nothing', () => {
    expect(searchChooser(en, '')).toEqual(en);
    expect(searchChooser(en, '  · ')).toEqual(en);
  });

  it('finds an English title, case and spacing ignored; a matching episode keeps all its lessons', () => {
    const hit = searchChooser(en, '  TIGERS,   mountains ');
    expect(hit.map((g) => g.id)).toEqual(['stage1']);
    const row = episode(hit, 'episode:stage1-nature');
    expect(row.lessons).toHaveLength(3);
    expect(hit[0]!.count).toBe(3);
  });

  it('every word must match (AND), each anywhere in the text', () => {
    expect(visible(searchChooser(en, 'mountains tigers'))).toContain('episode:stage1-nature');
    expect(searchChooser(en, 'tigers kimchi-never-here')).toEqual([]);
  });

  it('a lesson match keeps only the matching lessons of its episode, and the count follows', () => {
    const lesson = CATALOG.quests.find((q) => q.id === 'quest:stage2-letters-q4')!;
    const hit = searchChooser(en, lesson.title);
    const row = episode(hit, 'episode:stage2-letters');
    expect(row.lessons.map((l) => l.key)).toContain(lesson.id);
    expect(row.lessons.length).toBeLessThan(6);
    expect(group(hit, 'stage2').count).toBe(row.lessons.length);
  });

  it('finds a Spanish title with or without its accents', () => {
    const es = groupsIn('es');
    const title = OVERLAY.es.get('episode:stage1-rites')!;
    expect(title).toMatch(/[áéíóúñ]/i);
    const plain = title.replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
    for (const q of [title, plain, title.toUpperCase()]) expect(visible(searchChooser(es, q)), q).toContain('episode:stage1-rites');
  });

  it('finds a Korean title in the Korean UI, and the Korean title (Hangul) in any UI', () => {
    for (const locale of ['ko', 'en', 'es'] as const) {
      const hit = searchChooser(groupsIn(locale), '한글날');
      expect(visible(hit), locale).toContain('story:hangeul-day');
    }
    expect(visible(searchChooser(groupsIn('ko'), '글자 만나기'))).toContain('episode:stage1-letters');
  });

  it('finds the romanization of the Korean title', () => {
    // 즐거운 한글날! -> jeulgeoun hangeullal
    expect(visible(searchChooser(en, 'hangeullal'))).toContain('story:hangeul-day');
    // 호랑이, 산, 달 -> horangi san dal
    expect(visible(searchChooser(groupsIn('es'), 'horangi'))).toContain('episode:stage1-nature');
  });

  it('finds the lessons that teach a letter, and the letter sets by their letters', () => {
    const hit = searchChooser(en, 'ㄱ');
    const taught = CATALOG.quests.filter((q) => q.teaches.some((t) => t.split('/')[0] === 'ㄱ')).map((q) => q.id);
    expect(taught.length).toBeGreaterThan(0);
    for (const id of taught) expect(visible(hit)).toContain(id);
    expect(visible(hit)).toContain(LETTER_SET_KEYS.consonants);
    expect(visible(hit)).not.toContain(LETTER_SET_KEYS.vowels);
  });

  it('search narrows the list', () => {
    expect(visible(searchChooser(en, 'story')).length).toBeLessThan(visible(en).length);
    expect(searchChooser(en, 'zzzz-no-such-lesson')).toEqual([]);
  });

  it('works without Korean titles (titles only)', () => {
    const plain = chooserGroups({ ...options('en'), koTitle: undefined });
    expect(visible(searchChooser(plain, 'hangeullal'))).toEqual([]);
    expect(visible(searchChooser(plain, 'happy hangul day'))).toContain('story:hangeul-day');
  });
});

describe('normalizeSearch', () => {
  it('lower-cases, folds accents, turns punctuation into one space and keeps Hangul', () => {
    expect(normalizeSearch('  Lección: Ñandú,  ÁRBOL!  ')).toBe('leccion nandu arbol');
    expect(normalizeSearch('호랑이, 산, 달')).toBe('호랑이 산 달');
    expect(normalizeSearch('Yut, Kites & Paper')).toBe('yut kites paper');
    expect(normalizeSearch('a, eo, g, n')).toBe('a eo g n');
  });
});

describe('the selection', () => {
  const groups = groupsIn('en');
  const letters = episode(groups, 'episode:stage1-letters');
  const [q1, q2, q3] = letters.lessons.map((l) => l.key) as [string, string, string];
  const story = group(groups, 'stories').rows[0]!;
  const consonants = group(groups, 'stage1').rows.find((r) => r.key === LETTER_SET_KEYS.consonants)!;

  it('rowState: all for the whole episode or every lesson, some for a few, none otherwise', () => {
    expect(rowState([], letters)).toBe('none');
    expect(rowState([letters.key], letters)).toBe('all');
    expect(rowState([q2], letters)).toBe('some');
    expect(rowState([q1, q2, q3], letters)).toBe('all');
    expect(rowState([story.key], story)).toBe('all');
    expect(rowState([q1], story)).toBe('none');
  });

  it('toggleRow chooses the whole episode in place of its chosen lessons, at the first one\'s place', () => {
    expect(toggleRow([], letters)).toEqual([letters.key]);
    expect(toggleRow([story.key, q2, 'x', q1], letters)).toEqual([story.key, letters.key, 'x']);
    expect(toggleRow([letters.key, story.key], letters)).toEqual([story.key]);
    expect(toggleRow([q1, q2, q3, story.key], letters)).toEqual([story.key]);
    expect(toggleRow([], story)).toEqual([story.key]);
    expect(toggleRow([story.key], story)).toEqual([]);
  });

  it('toggleLesson: unticking one lesson of a whole episode keeps the others in cell order, at its place', () => {
    expect(toggleLesson([story.key, letters.key, 'x'], letters, q2)).toEqual([story.key, q1, q3, 'x']);
    expect(toggleLesson([], letters, q2)).toEqual([q2]);
    expect(toggleLesson([q2], letters, q1)).toEqual([q2, q1]);
    expect(toggleLesson([q2, q1], letters, q2)).toEqual([q1]);
    // A lesson already chosen on its own beside the whole episode is not doubled.
    expect(toggleLesson([q3, letters.key], letters, q1)).toEqual([q3, q2]);
  });

  it('lessonChosen: on its own or through its episode', () => {
    expect(lessonChosen([letters.key], letters, q1)).toBe(true);
    expect(lessonChosen([q1], letters, q1)).toBe(true);
    expect(lessonChosen([q2], letters, q1)).toBe(false);
  });

  it('entries, blocks and minutes follow the chosen order; unknown keys drop out', () => {
    const selection = [story.key, 'quest:gone', q2, consonants.key, letters.key];
    expect(selectionEntries(selection, groups).map((e) => e.key)).toEqual([story.key, q2, consonants.key, letters.key]);
    expect(pruneSelection(selection, groups)).toEqual([story.key, q2, consonants.key, letters.key]);
    const blocks = selectionBlocks(selection, groups);
    expect(blocks).toEqual([
      { kind: 'story', storyId: story.key, checks: true },
      { kind: 'quest', id: q2 },
      { kind: 'jamo-set', jamoIds: CONSONANTS.slice(0, 7) },
      { kind: 'jamo-set', jamoIds: CONSONANTS.slice(7) },
      { kind: 'episode', id: letters.key },
    ]);
    expect(selectionMinutes(selection, groups, CATALOG)).toBe(presetMinutesOf(blocks, CATALOG));
    const topic = group(groups, 'topics').rows[0]!;
    expect(selectionBlocks([topic.key], groups)).toEqual([{ kind: 'vocab', topicId: topic.key }]);
    expect(selectionEntries([letters.key], groups)[0]!.title).toBe('Meet the Letters');
  });

  it('selectionFits holds a deck to 30 blocks, a letter set counting two', () => {
    const stage2 = group(groups, 'stage2').rows.flatMap((r) => (r.kind === 'episode' ? r.lessons.map((l) => l.key) : []));
    const stage3 = group(groups, 'stage3').rows.flatMap((r) => (r.kind === 'episode' ? r.lessons.map((l) => l.key) : []));
    const thirty = [...stage2, ...stage3].slice(0, LECTURE_MAX_BLOCKS);
    expect(selectionFits(thirty, groups)).toBe(true);
    expect(selectionFits([...thirty.slice(1), consonants.key], groups)).toBe(false);
    expect(selectionFits([consonants.key], groups, 1)).toBe(false);
  });

  it('groupOfKey names the group of a row or a lesson', () => {
    expect(groupOfKey(groups, letters.key)).toBe('stage1');
    expect(groupOfKey(groups, 'quest:stage7-life-q2')).toBe('stage7');
    expect(groupOfKey(groups, story.key)).toBe('stories');
    expect(groupOfKey(groups, 'quest:gone')).toBeNull();
  });
});

describe('jamoSetBlocks', () => {
  it('splits letters into the fewest even sets of at most 12', () => {
    expect(jamoSetBlocks([])).toEqual([]);
    expect(jamoSetBlocks(VOWELS)).toEqual([{ kind: 'jamo-set', jamoIds: VOWELS }]);
    const thirteen = [...VOWELS, 'jamo:x1', 'jamo:x2', 'jamo:x3'];
    expect(jamoSetBlocks(thirteen).map((b) => (b.kind === 'jamo-set' ? b.jamoIds.length : 0))).toEqual([7, 6]);
  });
});

describe('applyChooserSelection: a selection inside a plan or an outline', () => {
  type Item = { key: string | null; note?: string };
  const keyOf = (i: Item): string | null => i.key;
  const make = (key: string): Item[] => (key === 'unknown' ? [] : [{ key }]);
  const groups = groupsIn('en');
  const letters = episode(groups, 'episode:stage1-letters');
  const [q1, q2, q3] = letters.lessons.map((l) => l.key) as [string, string, string];
  const quiz: Item = { key: null, note: 'quiz' };

  it('selectionOf: the chooser keys in order, first occurrence kept', () => {
    expect(selectionOf<Item>([{ key: q2 }, quiz, { key: q1 }, { key: q2 }], keyOf)).toEqual([q2, q1]);
  });

  it('keeps other items and kept things in place (with their own fields); a new thing goes at the end', () => {
    const items: Item[] = [{ key: q1, note: 'Monday' }, quiz, { key: 'story:a' }];
    const next = toggleLesson(selectionOf(items, keyOf), letters, q2);
    expect(applyChooserSelection(items, keyOf, next, make)).toEqual([{ key: q1, note: 'Monday' }, quiz, { key: 'story:a' }, { key: q2 }]);
  });

  it('a whole episode takes the place of the first of its lessons', () => {
    const items: Item[] = [{ key: 'story:a' }, { key: q2 }, quiz, { key: q1 }];
    const next = toggleRow(selectionOf(items, keyOf), letters);
    expect(applyChooserSelection(items, keyOf, next, make)).toEqual([{ key: 'story:a' }, { key: letters.key }, quiz]);
  });

  it('unticking a lesson of a whole episode puts the other lessons at its place', () => {
    const items: Item[] = [quiz, { key: letters.key, note: 'Tue' }, { key: 'story:a' }];
    const next = toggleLesson(selectionOf(items, keyOf), letters, q2);
    expect(applyChooserSelection(items, keyOf, next, make)).toEqual([quiz, { key: q1 }, { key: q3 }, { key: 'story:a' }]);
  });

  it('removes what is no longer chosen, a second copy too; a second copy of a kept thing stays', () => {
    const items: Item[] = [{ key: q1 }, quiz, { key: q1 }, { key: q2 }, { key: q2, note: 'again' }];
    expect(applyChooserSelection(items, keyOf, [q2], make)).toEqual([quiz, { key: q2 }, { key: q2, note: 'again' }]);
  });

  it('a key with nothing to make adds nothing; a reordered selection rebuilds the out-of-order keys at the end', () => {
    expect(applyChooserSelection<Item>([quiz], keyOf, ['unknown', q1], make)).toEqual([quiz, { key: q1 }]);
    const items: Item[] = [{ key: q1, note: 'a' }, { key: q2, note: 'b' }];
    expect(applyChooserSelection(items, keyOf, [q2, q1, 'unknown'], make)).toEqual([{ key: q2, note: 'b' }, { key: q1 }]);
    expect(applyChooserSelection(items, keyOf, [q2, q1, q1], make)).toEqual([{ key: q2, note: 'b' }, { key: q1 }]);
  });
});
