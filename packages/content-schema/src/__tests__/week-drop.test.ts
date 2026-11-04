import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { weekdayOf } from '../curriculum/dates';
import { REVIEW_SNAPSHOT_FILE, REVIEW_STAGE1_FILE, lintCurriculum } from '../lesson-lint';
import { weekOccurrences } from '../review-items/extract';
import { buildReviewItems, vocabIndex, EMPTY_SNAPSHOT } from '../review-items/stable-ids';
import { ReviewItemSchema, TEACHING_CELL_RE, decodeReviewItems, encodeReviewItems } from '../review-items/review-item';
import { weekSourcesOfTree } from '../review-items/sources';
import { SOLAR_TERMS, WEEK_DROP_FILE_RE, WEEK_HOLIDAYS, WEEK_TOPICS, WeekDropSchema, weekMondayOf } from '../week-drops/week-drop';
import { REPO_ROOT } from './helpers/romanization-registry';

/**
 * "This week in Korea" (F-CURR-002 §5.7, row CM-48): the drop schema, the ISO week key, the drops as a review-item
 * source, the §9.3 lint rules on the drops, and the repository's own 13 drops.
 */

const source = (over: Record<string, unknown> = {}) => ({
  title: '2026년 달력자료: 24절기',
  publisher: 'Korea Astronomy and Space Science Institute (한국천문연구원)',
  url: 'https://astro.kasi.re.kr/kor/life/post/calendarData?year=2026',
  accessed: '2026-10-30',
  quoteOrLocator: '"입동 11월 7일 18시 52분"',
  ...over,
});
const drop = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'week:2026-11-02',
  weekOf: '2026-11-02',
  status: 'ready',
  kind: 'solar-term',
  topic: 'ipdong',
  day: '2026-11-07',
  stage: 2,
  minutes: 2,
  titleEn: 'Winter Begins',
  noteEn: '{ko:입동} falls on 7 November.',
  items: [
    { id: 'ipdong', ko: '입동', romanization: 'ipdong', en: 'Start of Winter, a solar term' },
    { id: 'gyeoul', ko: '겨울', romanization: 'gyeoul', en: 'winter' },
    { id: 'mu', ko: '무', romanization: 'mu', en: 'radish' },
  ],
  sources: [source()],
  review: { reviewedBy: 'MAR', reviewedAt: '2026-10-30', passes: 3, notes: ['three passes'] },
  ...over,
});
const messages = (body: unknown): string[] => {
  const r = WeekDropSchema.safeParse(body);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('WeekDropSchema', () => {
  it('accepts a ready drop keyed by its Monday', () => {
    expect(messages(drop())).toEqual([]);
  });

  it('refuses an id that is not its week, a week that is not a Monday and a day far from the week', () => {
    expect(messages(drop({ id: 'week:2026-11-09' }))).toEqual(['id: the id of the week of 2026-11-02 is week:2026-11-02']);
    expect(messages(drop({ id: 'week:2026-11-03', weekOf: '2026-11-03' }))).toEqual(['weekOf: a drop is keyed by the Monday of its ISO week']);
    expect(messages(drop({ day: '2026-12-01' }))).toEqual(['day: the day a drop is about lies within 14 days of its week']);
    expect(messages(drop({ weekOf: '2026-02-30' }))[0]).toMatch(/^weekOf: a calendar date/);
  });

  it('holds the kind to the topic: a term, a §5.7 holiday, or the 24 terms as a whole', () => {
    expect(messages(drop({ kind: 'holiday', topic: 'ipdong' }))).toEqual(['topic: a holiday drop names one of the §5.7 holidays']);
    expect(messages(drop({ topic: 'seollal' }))).toEqual(['topic: a solar-term drop names one of the 24 solar terms']);
    expect(messages(drop({ topic: 'jeolgi' }))).toEqual([
      'topic: the 24 solar terms as a whole (jeolgi) are the solar-terms kind, and only they',
      'topic: a solar-term drop names one of the 24 solar terms',
    ]);
    expect(messages(drop({ kind: 'solar-terms', topic: 'jeolgi' }))).toEqual([]);
    expect(messages(drop({ kind: 'holiday', topic: 'dongji' }))).toEqual([]);
    expect(messages(drop({ topic: 'halloween' }))).toEqual(['topic: a solar term, a §5.7 holiday or jeolgi', 'topic: a solar-term drop names one of the 24 solar terms']);
  });

  it('lists each item once, between 3 and 6, and a ready drop records 3 MAR passes', () => {
    const items = drop().items as unknown[];
    expect(messages(drop({ items: [...items, { ...(items[0] as object), id: 'other' }] }))).toEqual(['items.3: an item is listed once (ko:입동)']);
    expect(messages(drop({ items: items.slice(0, 2) }))[0]).toMatch(/^items: Array must contain at least 3/);
    expect(messages(drop({ review: { reviewedBy: 'MAR', reviewedAt: '2026-10-30', passes: 2, notes: [] } }))).toEqual(['review.passes: a ready drop records at least 3 MAR passes (§9.2)']);
    expect(messages(drop({ status: 'draft', review: { reviewedBy: 'MAR', reviewedAt: '2026-10-30', passes: 0, notes: [] } }))).toEqual([]);
  });

  it('names the 24 solar terms and the seven holidays of §5.7 as topics', () => {
    expect(SOLAR_TERMS).toHaveLength(24);
    expect(WEEK_HOLIDAYS).toEqual(['seollal', 'daeboreum', 'dano', 'chilseok', 'chuseok', 'hangeul-day', 'dongji']);
    expect(WEEK_TOPICS).toHaveLength(24 + 6 + 1);
  });
});

describe('weekMondayOf: the ISO week on the local day, Monday to Sunday (as steadyWeeks)', () => {
  it('keys every day of a week by its Monday, across a month, a year and a 53-week year', () => {
    for (const day of ['2026-10-26', '2026-10-28', '2026-11-01']) expect(weekMondayOf(day)).toBe('2026-10-26');
    expect(weekMondayOf('2026-11-02')).toBe('2026-11-02');
    expect(weekMondayOf('2027-01-03')).toBe('2026-12-28');
    expect(weekMondayOf('2027-01-04')).toBe('2027-01-04');
    expect(weekMondayOf('2024-03-01')).toBe('2024-02-26');
  });
});

describe('the drops as a review-item source (row CM-48)', () => {
  const tree = new Map<string, unknown>([
    ['content/weekly/2026-11-02.json', drop()],
    ['content/weekly/2026-11-09.json', drop({ id: 'week:2026-11-09', weekOf: '2026-11-09', status: 'draft' })],
    ['content/notes.json', {}],
  ]);

  it('reads only the ready drops of content/weekly', () => {
    expect(weekSourcesOfTree(tree).map((w) => w.file)).toEqual(['content/weekly/2026-11-02.json']);
  });

  it("gives each item one Discover occurrence of the drop's cell, glossed at its overlay field", () => {
    const occ = weekOccurrences({ file: 'content/weekly/2026-11-02.json', body: drop() }, []);
    expect(occ.map((o) => [o.kind, o.ko, o.cell, o.home, o.stage, o.source, o.glossKey])).toEqual([
      ['lex', '입동', 'week:2026-11-02', 'week', 2, 'discover', 'week:2026-11-02#items.ipdong.gloss'],
      ['lex', '겨울', 'week:2026-11-02', 'week', 2, 'discover', 'week:2026-11-02#items.gyeoul.gloss'],
      ['lex', '무', 'week:2026-11-02', 'week', 2, 'discover', 'week:2026-11-02#items.mu.gloss'],
    ]);
    expect(weekOccurrences({ file: 'x', body: null }, [])).toEqual([]);
    expect(weekOccurrences({ file: 'x', body: { id: 'week:2026-11-02', items: [{ ko: '무', romanization: 'mu', en: 'radish' }] } }, [])[0]?.stage).toBe(2);
  });

  it('ranks a drop after the route: an item a lesson teaches keeps its home, stage and gloss, and gains the drop as a cell', () => {
    const lesson = { kind: 'lex' as const, ko: '무', romanization: 'mu', en: 'radish', glossKey: 'quest:stage4-life-q1#x', cell: 'episode:stage4-life', home: 'life' as const, stage: 4, volume: 1, source: 'discover' as const, at: 'lesson' };
    const week = weekOccurrences({ file: 'content/weekly/2026-11-02.json', body: drop() }, []);
    const built = buildReviewItems([...week, lesson], EMPTY_SNAPSHOT, vocabIndex([], []), []);
    const mu = built.items.find((i) => i.ko === '무');
    expect(mu).toMatchObject({ home: 'life', stage: 4, glossKey: 'quest:stage4-life-q1#x', cells: ['episode:stage4-life', 'week:2026-11-02'] });
    const ipdong = built.items.find((i) => i.ko === '입동');
    expect(ipdong).toMatchObject({ home: 'week', stage: 2, cells: ['week:2026-11-02'] });
    for (const item of built.items) expect(ReviewItemSchema.safeParse(item).success, item.id).toBe(true);
    // The chunk keeps a week cell as it is (no `episode:` prefix to add back).
    const { tables, rows } = encodeReviewItems(built.items);
    expect(decodeReviewItems({ REVIEW_ITEM_TABLES: tables, REVIEW_ITEM_ROWS: rows }).map((i) => i.cells)).toEqual(built.items.map((i) => i.cells));
    expect(TEACHING_CELL_RE.test('week:2026-11-02')).toBe(true);
    expect(TEACHING_CELL_RE.test('week:soon')).toBe(false);
  });
});

describe('the §9.3 rules on the drops (row CM-48)', () => {
  const lint = (files: Record<string, unknown>) =>
    lintCurriculum(new Map(Object.entries(files)))
      .filter((f) => f.file.startsWith('content/weekly/'))
      .map((f) => [f.severity, f.rule, f.path, f.message]);

  it('finds nothing in a sound drop', () => {
    expect(lint({ 'content/weekly/2026-11-02.json': drop() })).toEqual([]);
  });

  it('reports a file that is not a drop, and one named for another week, as lesson-schema errors', () => {
    expect(lint({ 'content/weekly/2026-11-02.json': { id: 'x' } })[0]?.slice(0, 2)).toEqual(['error', 'lesson-schema']);
    expect(lint({ 'content/weekly/2026-11-09.json': drop() })).toEqual([['error', 'lesson-schema', 'weekOf', 'the drop of the week of 2026-11-02 is content/weekly/2026-11-02.json']]);
  });

  it('caps the new items at 8 (lesson-new-load), counting what the route and earlier drops taught', () => {
    const words = ['가', '나', '다', '라', '마', '바', '사', '아', '자'];
    const many = { items: words.map((ko, i) => ({ id: `w${i}`, ko, romanization: 'x', en: 'x' })) };
    expect(lint({ 'content/weekly/2026-11-02.json': many }).filter((r) => r[1] === 'lesson-new-load')).toEqual([['error', 'lesson-new-load', 'items', `9 items are new (at most 8): ${words.join(', ')}`]]);
    const later = drop({ id: 'week:2026-11-09', weekOf: '2026-11-09', day: '2026-11-07', items: drop().items });
    const stage1 = { schemaVersion: 1, symbols: [{ id: 'jamo:a', char: 'ㅏ', kind: 'vowel', romanization: 'a' }], occurrences: [] };
    const rows = lint({ 'content/weekly/2026-11-02.json': drop(), 'content/weekly/2026-11-09.json': later, [REVIEW_STAGE1_FILE]: stage1, 'x.json': 1 });
    expect(rows).toEqual([]);
  });

  it('needs an allowlisted source named as of its access date (culture-source)', () => {
    expect(lint({ 'content/weekly/2026-11-02.json': drop({ sources: [source({ publisher: 'A blog', url: 'https://example.com/a' })] }) })).toEqual([
      ['error', 'culture-source', 'sources', 'no source is from the F-CURR-002 §6.6 allowlist of public institutions, on a host the institution runs'],
    ]);
    const renamed = source({ publisher: 'Cultural Heritage Administration', url: 'https://www.khs.go.kr/a', accessed: '2026-10-30' });
    expect(lint({ 'content/weekly/2026-11-02.json': drop({ sources: [source(), renamed] }) })).toEqual([
      ['error', 'culture-source', 'sources[1].publisher', 'on 2026-10-30 the institution was called the Korea Heritage Service (국가유산청)'],
    ]);
  });

  it('names the older institution for a source read before its rename, and reads a body with no items as no load', () => {
    const early = source({ publisher: 'Korea Heritage Service', url: 'https://www.khs.go.kr/a', accessed: '2024-01-10' });
    expect(lint({ 'content/weekly/2026-11-02.json': drop({ sources: [source(), early] }) })).toEqual([
      ['error', 'culture-source', 'sources[1].publisher', 'on 2024-01-10 the institution was called the Cultural Heritage Administration (문화재청)'],
    ]);
    expect(lint({ 'content/weekly/2026-11-02.json': [] }).map((r) => [r[1], r[2]])).toEqual([['lesson-schema', '(root)']]);
    expect(lint({ 'content/weekly/2026-11-02.json': { items: [{}, 'x'] } }).filter((r) => r[1] === 'lesson-new-load')).toEqual([]);
  });

  it('never lets two items of a drop sound alike (dictation-unambiguous)', () => {
    const items = [...(drop().items as object[]), { id: 'nat', ko: '낫', romanization: 'nat', en: 'sickle' }, { id: 'nat2', ko: '낮', romanization: 'nat', en: 'daytime' }];
    expect(lint({ 'content/weekly/2026-11-02.json': drop({ items }) })).toEqual([['error', 'dictation-unambiguous', 'items[4]', '낮 is said like 낫: a heard round could not ask them apart']]);
  });

  it('holds the learner copy to review-copy, and leaves the sources and review record alone', () => {
    const rows = lint({ 'content/weekly/2026-11-02.json': drop({ titleEn: 'Winter 🙂', review: { reviewedBy: 'MAR', reviewedAt: '2026-10-30', passes: 3, notes: ['50% checked 🙂'] } }) });
    expect(rows.map((r) => [r[1], r[2]])).toEqual([['review-copy', 'titleEn']]);
  });

  it('runs items-stable-id over the drops, as errors of the drop that teaches a new item', () => {
    const snapshot = { schemaVersion: 1, ids: {}, alias: {}, retired: [] };
    const stage1 = { schemaVersion: 1, symbols: [{ id: 'jamo:a', char: 'ㅏ', kind: 'vowel', romanization: 'a' }], occurrences: [] };
    const rows = lint({ 'content/weekly/2026-11-02.json': drop(), [REVIEW_SNAPSHOT_FILE]: snapshot, [REVIEW_STAGE1_FILE]: stage1 });
    expect(rows.map((r) => [r[0], r[1], r[2]])).toEqual([
      ['error', 'items-stable-id', 'items[0]'],
      ['error', 'items-stable-id', 'items[1]'],
      ['error', 'items-stable-id', 'items[2]'],
    ]);
  });
});

describe("the repository's drops (the first 13, from 2026-10-30)", () => {
  const dir = join(REPO_ROOT, 'content', 'weekly');
  const files = readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
  const drops = files.map((n) => WeekDropSchema.parse(JSON.parse(readFileSync(join(dir, n), 'utf8'))));

  it('ships 13 ready drops, one a week, Monday to Sunday, from the week of 26 October 2026 to the week of 18 January 2027', () => {
    expect(files).toHaveLength(13);
    for (const name of files) expect(WEEK_DROP_FILE_RE.test(`content/weekly/${name}`), name).toBe(true);
    expect(drops.every((d) => d.status === 'ready')).toBe(true);
    expect(drops.map((d) => d.weekOf)[0]).toBe('2026-10-26');
    drops.forEach((d, i) => {
      expect(weekdayOf(d.weekOf), d.id).toBe('mon');
      if (i > 0) expect(weekMondayOf(d.weekOf) > (drops[i - 1] as { weekOf: string }).weekOf, d.id).toBe(true);
    });
    expect(drops.map((d) => d.weekOf).at(-1)).toBe('2027-01-18');
  });

  it('dates each term by the KASI tables (the day it names is in its source quotes)', () => {
    const KASI = new Map([
      ['sanggang', '2026-10-23'],
      ['ipdong', '2026-11-07'],
      ['soseol', '2026-11-22'],
      ['daeseol', '2026-12-07'],
      ['dongji', '2026-12-22'],
      ['sohan', '2027-01-05'],
      ['daehan', '2027-01-20'],
    ]);
    for (const d of drops) {
      if (KASI.has(d.topic)) expect(d.day, d.id).toBe(KASI.get(d.topic));
      expect(d.sources.some((s) => s.url.includes('kasi.re.kr') || s.url.includes('nfm.go.kr') || s.url.includes('unesco.org')), d.id).toBe(true);
    }
  });

  it('gives each drop about 5 items and 2 minutes, with three recorded MAR passes', () => {
    for (const d of drops) {
      expect(d.items.length, d.id).toBe(5);
      expect(d.minutes).toBe(2);
      expect(d.review.passes).toBeGreaterThanOrEqual(3);
      expect(d.review.reviewedBy).toBe('MAR');
    }
  });
});
