import { describe, expect, it } from 'vitest';
import { generateCurriculum, toPlanItems, type CurriculumDraft, type CurriculumParamsInput } from '..';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';

/**
 * F-PLAN-002 section 3.4: the two worked examples, item by item, against the
 * frozen October 2026 catalogue. These are authoritative (E-2): a change to the
 * generator that moves one item here is a product change and needs the spec.
 */

const q = (id: string): string => `quest:stage1-${id}`;
const story = (slug: string): string => `quest:story-${slug}-listen`;

type Row = [week: number, kind: CurriculumDraft['weeks'][number]['kind'], items: Array<[date: string, id: string]>];

const expectWeeks = (draft: CurriculumDraft, rows: readonly Row[]): void => {
  expect(draft.weeks.map((w) => [w.index, w.kind])).toEqual(rows.map(([week, kind]) => [week, kind]));
  const byWeek = rows.flatMap(([week, , items]) => items.map(([date, id]) => ({ week, date, id })));
  expect(draft.items.map((item) => ({ week: item.week, date: item.targetDate, id: item.id }))).toEqual(byWeek);
};

describe('golden A: a 12-week class, Pictures first (F-PLAN-002 section 3.4)', () => {
  const params: CurriculumParamsInput = {
    audience: 'class',
    level: { stage: 'stage1', band: 0 },
    startDate: '2026-10-18',
    weeks: 12,
    sessionsPerWeek: 2,
    sessionDays: ['sun', 'wed'],
    minutesPerSession: 10,
    goals: { focus: 'balanced', motivation: 'heritage' },
    daysOff: [{ from: '2026-11-22', to: '2026-11-28' }],
    unlockedStages: ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'],
    reviewEvery: 4,
  };
  const draft = generateCurriculum(params, CATALOG_2026_10);

  it('lays out the twelve weeks and their items', () => {
    expectWeeks(draft, [
      [1, 'learn', [['2026-10-18', q('letters-q1')], ['2026-10-21', q('letters-q2')]]],
      [2, 'learn', [['2026-10-25', q('letters-q3')], ['2026-10-28', q('life-q1')]]],
      [3, 'learn', [['2026-11-01', q('life-q2')], ['2026-11-04', q('life-q3')]]],
      [4, 'review', []],
      [5, 'culture', [['2026-11-15', story('kim-hongdo-genre-paintings')], ['2026-11-18', q('rites-q1')]]],
      [6, 'break', []],
      [7, 'learn', [['2026-11-29', q('rites-q2')], ['2026-12-02', q('rites-q3')]]],
      [8, 'review', []],
      [9, 'learn', [['2026-12-13', q('nature-q1')], ['2026-12-16', q('nature-q2')]]],
      [10, 'learn', [['2026-12-20', q('nature-q3')], ['2026-12-23', q('crafts-q1')]]],
      [11, 'culture', [['2026-12-27', story('sejong-new-letters')], ['2026-12-30', q('crafts-q2')]]],
      [12, 'learn', [['2027-01-03', q('crafts-q3')], ['2027-01-06', 'quest:stage2-life-q1']]],
    ]);
  });

  it('dates every week from the start and names its focus', () => {
    expect(draft.weeks.map((w) => w.startDate)).toEqual([
      '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22',
      '2026-11-29', '2026-12-06', '2026-12-13', '2026-12-20', '2026-12-27', '2027-01-03',
    ]);
    expect(draft.weeks.map((w) => w.focus.episodeId)).toEqual([
      'episode:stage1-letters', 'episode:stage1-letters', 'episode:stage1-life', null,
      'episode:stage1-rites', null, 'episode:stage1-rites', null,
      'episode:stage1-nature', 'episode:stage1-nature', 'episode:stage1-crafts', 'episode:stage1-crafts',
    ]);
    expect(draft.weeks[4]?.focus.storyIds).toEqual(['story:kim-hongdo-genre-paintings']);
    expect(draft.weeks[10]?.focus.storyIds).toEqual(['story:sejong-new-letters']);
    expect(draft.weeks.every((w) => w.focus.festival === null)).toBe(true);
  });

  it('puts the Hangul Check in the week of the last Stage 1 lesson and no word topic', () => {
    expect(draft.weeks.map((w) => w.extras)).toEqual([[], [], [], [], [], [], [], [], [], [], [], [{ kind: 'hangul-check' }]]);
  });

  it('has the stats and the one warning of the spec', () => {
    expect(draft.stats).toEqual({
      sessions: 22,
      readyItems: 18,
      lessons: 16,
      stories: 2,
      comingSoonItems: 0,
      openSessions: 0,
      minutesPlanned: 79,
      minutesAvailable: 220,
      reviewWeeks: 2,
      breakWeeks: 1,
      cultureWeeks: 2,
      vocabWeeks: 0,
      endsAtStage: 'stage2',
    });
    expect(draft.warnings).toEqual([{ code: 'fewer-sessions-than-units', count: 2 }]);
    expect(draft.locked).toEqual([]);
  });

  it('stores the first item exactly as the spec shows it', () => {
    expect(toPlanItems(draft)[0]).toEqual({ kind: 'quest', id: 'quest:stage1-letters-q1', targetDate: '2026-10-18', week: 1 });
  });
});

describe('golden B: a 6-month self-learner, Reads easily (F-PLAN-002 section 3.4)', () => {
  const params: CurriculumParamsInput = {
    audience: 'self',
    level: { stage: 'stage1', band: 3 },
    startDate: '2026-10-12',
    weeks: 26,
    sessionsPerWeek: 3,
    sessionDays: ['mon', 'wed', 'fri'],
    minutesPerSession: 15,
    goals: { focus: 'balanced', motivation: 'kculture' },
    unlockedStages: ['stage1'],
    reviewEvery: 4,
  };
  const draft = generateCurriculum(params, CATALOG_2026_10);
  const ep = (cell: string): string => `episode:${cell}`;

  it('lays out the twenty-six weeks and their items', () => {
    expectWeeks(draft, [
      [1, 'learn', [['2026-10-12', q('nature-q2')], ['2026-10-14', q('nature-q3')], ['2026-10-16', q('crafts-q1')]]],
      [2, 'learn', [['2026-10-19', q('crafts-q2')], ['2026-10-21', q('crafts-q3')], ['2026-10-23', story('chuseok-ganggangsullae')]]],
      [3, 'learn', [['2026-10-26', story('sejong-new-letters')], ['2026-10-28', story('shapes-of-hangeul')], ['2026-10-30', story('hangeul-day')]]],
      [4, 'review', []],
      [5, 'culture', [['2026-11-09', story('tripitaka-koreana')], ['2026-11-11', story('sillok-royal-historians')], ['2026-11-13', story('kim-hongdo-genre-paintings')]]],
      [6, 'learn', [['2026-11-16', story('sun-and-moon')], ['2026-11-18', story('cheugugi-rain-gauge')], ['2026-11-20', story('dano-ssireum')]]],
      [7, 'learn', [['2026-11-23', story('sillok-mountain-archives')], ['2026-11-25', story('jikji-metal-type')], ['2026-11-27', story('gimjang-arirang')]]],
      [8, 'review', []],
      [9, 'learn', [['2026-12-07', story('angbuilgu-sundial')], ['2026-12-09', story('janggyeong-panjeon')], ['2026-12-11', story('jagyeongnu-water-clock')]]],
      [10, 'culture', [['2026-12-14', story('pansori-tales')], ['2026-12-16', story('seungjeongwon-ilgi-every-day')], ['2026-12-18', story('nanjung-ilgi')]]],
      [11, 'learn', [['2026-12-21', story('donguibogam')], ['2026-12-23', story('ilseongnok-daily-reflection')], ['2026-12-25', story('uigwe-royal-birthday')]]],
      [12, 'review', []],
      [13, 'learn', [['2027-01-04', story('joseon-records-today')], ['2027-01-06', ep('stage2-rites')], ['2027-01-08', ep('stage2-letters')]]],
      [14, 'learn', [['2027-01-11', ep('stage2-crafts')], ['2027-01-13', ep('stage3-rites')], ['2027-01-15', ep('stage3-letters')]]],
      [15, 'learn', []],
      [16, 'review', []],
      [17, 'culture', [['2027-02-01', story('seollal-new-year')]]],
      [18, 'learn', []],
      [19, 'learn', []],
      [20, 'review', []],
      [21, 'learn', []],
      [22, 'learn', []],
      [23, 'learn', []],
      [24, 'learn', []],
      [25, 'learn', []],
      [26, 'learn', []],
    ]);
  });

  it('marks the item kinds: stories are quests, coming-soon cells are episodes', () => {
    const kinds = new Map(draft.items.map((item) => [item.id, item.kind]));
    expect(kinds.get(story('seollal-new-year'))).toBe('quest');
    expect(kinds.get(ep('stage2-rites'))).toBe('episode');
  });

  it('reserves the Seollal story for the week of 7 February 2027', () => {
    expect(draft.weeks[16]?.focus).toEqual({ episodeId: null, storyIds: ['story:seollal-new-year'], festival: 'seollal' });
    expect(draft.weeks[4]?.focus.storyIds[0]).toBe('story:tripitaka-koreana');
    expect(draft.weeks[9]?.focus.storyIds[0]).toBe('story:pansori-tales');
  });

  it('gives the Hangul Check in week 2 and the twelve word topics in order', () => {
    const extras = draft.weeks.map((w) => w.extras.map((e) => (e.kind === 'vocab' ? e.topicId : e.kind)));
    expect(extras).toEqual([
      [], ['hangul-check'], [], [], [], ['topic:food'], [], [], [], [], [], [],
      ['topic:animals'], [], ['topic:colors'], [], [], ['topic:numbers'], ['topic:family'], [],
      ['topic:school'], ['topic:body'], ['topic:nature'], ['topic:travel'], ['topic:sports'], ['topic:k-culture'],
    ]);
  });

  it('has the stats, the locked lessons and the warnings of the spec', () => {
    expect(draft.stats).toEqual({
      sessions: 78,
      readyItems: 29,
      lessons: 5,
      stories: 24,
      comingSoonItems: 5,
      openSessions: 29,
      minutesPlanned: 132,
      minutesAvailable: 1170,
      reviewWeeks: 5,
      breakWeeks: 0,
      cultureWeeks: 3,
      vocabWeeks: 11,
      endsAtStage: 'stage1',
    });
    expect(draft.locked).toEqual(['quest:stage2-life-q1', 'quest:stage2-nature-q1', 'quest:stage4-rites-q1']);
    expect(draft.warnings).toEqual([
      { code: 'coming-soon-included', week: 13, count: 5 },
      { code: 'content-runs-out', week: 15 },
      { code: 'premium-needed', count: 3 },
    ]);
  });

  it('notes the coming-soon items when flattened', () => {
    const items = toPlanItems(draft);
    expect(items.filter((item) => item.note !== undefined).map((item) => [item.id, item.note])).toEqual([
      [ep('stage2-rites'), 'Coming soon'],
      [ep('stage2-letters'), 'Coming soon'],
      [ep('stage2-crafts'), 'Coming soon'],
      [ep('stage3-rites'), 'Coming soon'],
      [ep('stage3-letters'), 'Coming soon'],
    ]);
  });
});
