import { describe, expect, it } from 'vitest';
import { GENERATOR_VERSION, generateCurriculum, toMeta, toPlanItems, type CurriculumDraft, type CurriculumParamsInput } from '..';
// Installs the blended path into generateCurriculum (the `blend-generator` subpath, row BL-2).
import { BLEND_GENERATOR_VERSION } from '../curriculum/generate-blend';
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

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND section 6.5 (row BL-2): the blended path on the same frozen catalogue. 26 weeks,
 * start Brand new, `reviewEvery` 4, practice 3 x 10 minutes. C and D: class on Tuesday 30 minutes, start on a Monday;
 * E: class on Thursday 45 minutes, start on a Wednesday (the route starts on Thursday). Section 6.5's table is
 * generated from these. Rows: [week, lectureDate (null for a practice-only item), targetDate, item].
 */
type BlendRow = [week: number, lectureDate: string | null, targetDate: string, id: string];
type WeekRow = [week: number, kind: CurriculumDraft['weeks'][number]['kind'], festival: string | null, extras: string[]];

const short = (id: string): string =>
  id.replace('quest:stage1-', 'q:').replace(/^quest:story-(.*)-listen$/, 's:$1').replace('episode:', 'ep:').replace('quest:', 'qq:');
const blendRows = (draft: CurriculumDraft): BlendRow[] =>
  draft.items.map((item) => [item.week, item.lectureDate ?? null, item.targetDate ?? '', short(item.id)]);
const weekRows = (draft: CurriculumDraft): WeekRow[] =>
  draft.weeks.map((w) => [w.index, w.kind, w.focus.festival, w.extras.map((e) => (e.kind === 'vocab' ? e.topicId : e.kind))]);

const blended = (blend: NonNullable<CurriculumParamsInput['blend']>, startDate = '2026-11-02'): CurriculumParamsInput => ({
  audience: 'class',
  level: { stage: 'stage1', band: 0 },
  startDate,
  weeks: 26,
  sessionsPerWeek: 4,
  minutesPerSession: 10,
  goals: { focus: 'balanced', motivation: 'heritage' },
  unlockedStages: ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'],
  reviewEvery: 4,
  blend,
});

describe('golden C: practise what class taught (overlap), class Tuesday 30 minutes, practice 3 x 10', () => {
  const draft = generateCurriculum(blended({ mode: 'overlap', lecture: { days: ['tue'], minutes: 30 }, personal: { perWeek: 3, minutes: 10 } }), CATALOG_2026_10);

  it('is a version 2 plan that an older reader sees as 4 sessions a week of 10 minutes', () => {
    expect(draft.generatorVersion).toBe(BLEND_GENERATOR_VERSION);
    expect(draft.params.sessionsPerWeek).toBe(4);
    expect(draft.params.sessionDays).toEqual(['sun', 'tue', 'wed', 'fri']);
    expect(draft.params.minutesPerSession).toBe(10);
  });

  it('lays out the weeks', () => {
    expect(weekRows(draft)).toEqual([
      [1, 'learn', null, []], [2, 'learn', null, []], [3, 'learn', null, []], [4, 'review', null, []],
      [5, 'culture', null, []], [6, 'learn', null, ['hangul-check']], [7, 'learn', null, []], [8, 'review', null, []],
      [9, 'learn', null, ['topic:food']], [10, 'culture', null, []], [11, 'learn', null, []], [12, 'review', null, []],
      [13, 'learn', null, []], [14, 'culture', 'seollal', []], [15, 'learn', null, []], [16, 'review', null, []],
      [17, 'learn', null, ['topic:animals']], [18, 'learn', null, []], [19, 'learn', null, []], [20, 'review', null, []],
      [21, 'learn', null, []], [22, 'learn', null, ['topic:colors']], [23, 'learn', null, []], [24, 'learn', null, ['topic:numbers']],
      [25, 'learn', null, ['topic:family']], [26, 'learn', null, ['topic:school']],
    ]);
  });

  it('lays out every item with its class day and practice day', () => {
    expect(blendRows(draft)).toEqual([
      [1, '2026-11-03', '2026-11-04', 'q:letters-q1'],
      [1, '2026-11-03', '2026-11-06', 'q:letters-q2'],
      [1, '2026-11-03', '2026-11-08', 'q:letters-q3'],
      [2, '2026-11-10', '2026-11-11', 'q:life-q1'],
      [2, '2026-11-10', '2026-11-11', 'q:rites-q1'],
      [2, '2026-11-10', '2026-11-13', 'q:life-q2'],
      [2, '2026-11-10', '2026-11-15', 'q:life-q3'],
      [3, '2026-11-17', '2026-11-18', 'q:rites-q2'],
      [3, '2026-11-17', '2026-11-20', 'q:rites-q3'],
      [3, '2026-11-17', '2026-11-22', 'q:nature-q1'],
      [5, '2026-12-01', '2026-12-02', 's:kim-hongdo-genre-paintings'],
      [5, '2026-12-01', '2026-12-02', 'q:crafts-q1'],
      [5, '2026-12-01', '2026-12-04', 'q:nature-q2'],
      [5, '2026-12-01', '2026-12-06', 'q:nature-q3'],
      [6, '2026-12-08', '2026-12-09', 'q:crafts-q2'],
      [6, '2026-12-08', '2026-12-11', 'q:crafts-q3'],
      [6, '2026-12-08', '2026-12-13', 'qq:stage2-life-q1'],
      [7, '2026-12-15', '2026-12-16', 'qq:stage2-nature-q1'],
      [7, '2026-12-15', '2026-12-18', 'qq:stage4-rites-q1'],
      [7, '2026-12-15', '2026-12-20', 's:sejong-new-letters'],
      [9, '2026-12-29', '2026-12-30', 's:shapes-of-hangeul'],
      [9, '2026-12-29', '2027-01-01', 's:hangeul-day'],
      [9, '2026-12-29', '2027-01-03', 's:tripitaka-koreana'],
      [10, '2027-01-05', '2027-01-06', 's:sillok-royal-historians'],
      [10, '2027-01-05', '2027-01-08', 's:chuseok-ganggangsullae'],
      [10, '2027-01-05', '2027-01-10', 's:sun-and-moon'],
      [11, '2027-01-12', '2027-01-13', 's:cheugugi-rain-gauge'],
      [11, '2027-01-12', '2027-01-15', 's:gimjang-arirang'],
      [11, '2027-01-12', '2027-01-17', 's:sillok-mountain-archives'],
      [13, '2027-01-26', '2027-01-27', 's:jikji-metal-type'],
      [13, '2027-01-26', '2027-01-29', 's:dano-ssireum'],
      [13, '2027-01-26', '2027-01-31', 's:angbuilgu-sundial'],
      [14, '2027-02-02', '2027-02-03', 's:seollal-new-year'],
      [14, '2027-02-02', '2027-02-05', 's:janggyeong-panjeon'],
      [14, '2027-02-02', '2027-02-07', 's:jagyeongnu-water-clock'],
      [15, '2027-02-09', '2027-02-10', 's:pansori-tales'],
      [15, '2027-02-09', '2027-02-12', 's:donguibogam'],
      [15, '2027-02-09', '2027-02-14', 's:seungjeongwon-ilgi-every-day'],
      [17, '2027-02-23', '2027-02-24', 's:nanjung-ilgi'],
      [17, '2027-02-23', '2027-02-24', 's:joseon-records-today'],
      [17, '2027-02-23', '2027-02-26', 's:ilseongnok-daily-reflection'],
      [17, '2027-02-23', '2027-02-28', 's:uigwe-royal-birthday'],
      [18, '2027-03-02', '2027-03-03', 'ep:stage2-letters'],
      [19, '2027-03-09', '2027-03-10', 'ep:stage2-rites'],
      [21, '2027-03-23', '2027-03-24', 'ep:stage2-crafts'],
      [22, '2027-03-30', '2027-03-31', 'ep:stage3-life'],
      [23, '2027-04-06', '2027-04-07', 'ep:stage3-letters'],
    ]);
  });

  it('has the stats, the warnings and the Refresh days', () => {
    expect(draft.stats).toEqual({
      sessions: 104,
      readyItems: 42,
      lessons: 18,
      stories: 24,
      comingSoonItems: 5,
      openSessions: 3,
      minutesPlanned: 191,
      minutesAvailable: 1560,
      reviewWeeks: 5,
      breakWeeks: 0,
      cultureWeeks: 3,
      vocabWeeks: 6,
      endsAtStage: 'stage4',
      byTrack: {
        lecture: { sessions: 26, items: 47, minutesPlanned: 362 },
        personal: { sessions: 78, items: 47, refreshDays: 70, minutesPlanned: 241 },
      },
      sessionsPerTeachingWeek: 4,
      sessionsPerCalendarWeek: 4,
    });
    expect(draft.warnings).toEqual([{ code: 'coming-soon-included', week: 18, count: 5 }, { code: 'content-runs-out', week: 24 }]);
    expect(draft.refresh).toHaveLength(70);
    expect(draft.refresh?.[0]).toEqual({ date: '2026-11-04', cellIds: ['episode:stage1-letters'] });
    expect(toMeta(draft).refresh).toEqual(draft.refresh);
  });
});

describe('golden D: class and practice cover different lessons (split), same rhythm', () => {
  const draft = generateCurriculum(blended({ mode: 'split', lecture: { days: ['tue'], minutes: 30 }, personal: { perWeek: 3, minutes: 10 } }), CATALOG_2026_10);

  it('is a version 2 plan that an older reader sees as 4 sessions a week of 10 minutes', () => {
    expect(draft.generatorVersion).toBe(BLEND_GENERATOR_VERSION);
    expect(draft.params.sessionsPerWeek).toBe(4);
    expect(draft.params.sessionDays).toEqual(['sun', 'tue', 'wed', 'fri']);
    expect(draft.params.minutesPerSession).toBe(10);
  });

  it('lays out the weeks', () => {
    expect(weekRows(draft)).toEqual([
      [1, 'learn', null, []], [2, 'learn', null, []], [3, 'learn', null, ['hangul-check']], [4, 'review', null, []],
      [5, 'culture', null, []], [6, 'learn', null, []], [7, 'learn', null, ['topic:food']], [8, 'review', null, []],
      [9, 'learn', null, []], [10, 'culture', null, []], [11, 'learn', null, []], [12, 'review', null, []],
      [13, 'learn', null, []], [14, 'culture', 'seollal', []], [15, 'learn', null, ['topic:animals']], [16, 'review', null, []],
      [17, 'learn', null, []], [18, 'learn', null, []], [19, 'learn', null, []], [20, 'learn', null, ['topic:colors']],
      [21, 'learn', null, ['topic:numbers']], [22, 'learn', null, ['topic:family']], [23, 'learn', null, ['topic:school']], [24, 'learn', null, ['topic:body']],
      [25, 'learn', null, ['topic:nature']], [26, 'learn', null, ['topic:travel']],
    ]);
  });

  it('lays out every item with its class day and practice day', () => {
    expect(blendRows(draft)).toEqual([
      [1, '2026-11-03', '2026-11-04', 'q:letters-q1'],
      [1, null, '2026-11-04', 'q:letters-q3'],
      [1, '2026-11-03', '2026-11-06', 'q:life-q1'],
      [1, null, '2026-11-06', 'q:life-q2'],
      [1, '2026-11-03', '2026-11-08', 'q:letters-q2'],
      [1, null, '2026-11-08', 'q:life-q3'],
      [2, '2026-11-10', '2026-11-11', 'q:rites-q1'],
      [2, null, '2026-11-11', 'q:rites-q3'],
      [2, '2026-11-10', '2026-11-13', 'q:nature-q1'],
      [2, null, '2026-11-13', 'q:nature-q2'],
      [2, '2026-11-10', '2026-11-15', 'q:rites-q2'],
      [2, null, '2026-11-15', 'q:nature-q3'],
      [3, '2026-11-17', '2026-11-18', 'q:crafts-q1'],
      [3, '2026-11-17', '2026-11-18', 'q:crafts-q3'],
      [3, '2026-11-17', '2026-11-20', 'qq:stage2-life-q1'],
      [3, '2026-11-17', '2026-11-22', 'q:crafts-q2'],
      [5, '2026-12-01', '2026-12-02', 's:kim-hongdo-genre-paintings'],
      [5, '2026-12-01', '2026-12-04', 'qq:stage2-nature-q1'],
      [5, '2026-12-01', '2026-12-06', 'qq:stage4-rites-q1'],
      [6, '2026-12-08', '2026-12-09', 's:sejong-new-letters'],
      [6, '2026-12-08', '2026-12-11', 's:shapes-of-hangeul'],
      [6, '2026-12-08', '2026-12-13', 's:hangeul-day'],
      [7, '2026-12-15', '2026-12-16', 's:tripitaka-koreana'],
      [7, '2026-12-15', '2026-12-18', 's:sillok-royal-historians'],
      [7, '2026-12-15', '2026-12-20', 's:chuseok-ganggangsullae'],
      [9, '2026-12-29', '2026-12-30', 's:sun-and-moon'],
      [9, '2026-12-29', '2027-01-01', 's:cheugugi-rain-gauge'],
      [9, '2026-12-29', '2027-01-03', 's:gimjang-arirang'],
      [10, '2027-01-05', '2027-01-06', 's:sillok-mountain-archives'],
      [10, '2027-01-05', '2027-01-08', 's:jikji-metal-type'],
      [10, '2027-01-05', '2027-01-10', 's:dano-ssireum'],
      [11, '2027-01-12', '2027-01-13', 's:angbuilgu-sundial'],
      [11, '2027-01-12', '2027-01-15', 's:janggyeong-panjeon'],
      [11, '2027-01-12', '2027-01-17', 's:jagyeongnu-water-clock'],
      [13, '2027-01-26', '2027-01-27', 's:pansori-tales'],
      [13, '2027-01-26', '2027-01-29', 's:donguibogam'],
      [13, '2027-01-26', '2027-01-31', 's:seungjeongwon-ilgi-every-day'],
      [14, '2027-02-02', '2027-02-03', 's:seollal-new-year'],
      [14, '2027-02-02', '2027-02-03', 's:uigwe-royal-birthday'],
      [14, '2027-02-02', '2027-02-05', 's:nanjung-ilgi'],
      [14, '2027-02-02', '2027-02-07', 's:ilseongnok-daily-reflection'],
      [15, '2027-02-09', '2027-02-10', 's:joseon-records-today'],
      [15, '2027-02-09', '2027-02-12', 'ep:stage2-letters'],
      [17, '2027-02-23', '2027-02-24', 'ep:stage2-rites'],
      [18, '2027-03-02', '2027-03-03', 'ep:stage2-crafts'],
      [19, '2027-03-09', '2027-03-10', 'ep:stage3-life'],
      [20, '2027-03-16', '2027-03-17', 'ep:stage3-letters'],
    ]);
  });

  it('has the stats, the warnings and the Refresh days', () => {
    expect(draft.stats).toEqual({
      sessions: 104,
      readyItems: 42,
      lessons: 18,
      stories: 24,
      comingSoonItems: 5,
      openSessions: 6,
      minutesPlanned: 191,
      minutesAvailable: 1560,
      reviewWeeks: 4,
      breakWeeks: 0,
      cultureWeeks: 3,
      vocabWeeks: 9,
      endsAtStage: 'stage4',
      byTrack: {
        lecture: { sessions: 26, items: 41, minutesPlanned: 323 },
        personal: { sessions: 78, items: 47, refreshDays: 65, minutesPlanned: 241 },
      },
      sessionsPerTeachingWeek: 4,
      sessionsPerCalendarWeek: 4,
    });
    expect(draft.warnings).toEqual([{ code: 'coming-soon-included', week: 15, count: 5 }, { code: 'content-runs-out', week: 21 }]);
    expect(draft.refresh).toHaveLength(65);
    expect(draft.refresh?.[0]).toEqual({ date: '2026-11-20', cellIds: ['episode:stage1-rites', 'episode:stage1-nature', 'episode:stage1-crafts', 'episode:stage2-life'] });
    expect(toMeta(draft).refresh).toEqual(draft.refresh);
  });
});

describe('golden E: a Wednesday start, class Thursday 45 minutes, practice Fri, Sun and Tue (overlap)', () => {
  const draft = generateCurriculum(blended({ mode: 'overlap', lecture: { days: ['thu'], minutes: 45 }, personal: { perWeek: 3, minutes: 10 } }, '2026-11-04'), CATALOG_2026_10);

  it('is a version 2 plan that an older reader sees as 4 sessions a week of 10 minutes', () => {
    expect(draft.generatorVersion).toBe(BLEND_GENERATOR_VERSION);
    expect(draft.params.sessionsPerWeek).toBe(4);
    expect(draft.params.sessionDays).toEqual(['sun', 'tue', 'thu', 'fri']);
    expect(draft.params.minutesPerSession).toBe(10);
  });

  it('lays out the weeks', () => {
    expect(weekRows(draft)).toEqual([
      [1, 'learn', null, []], [2, 'learn', null, []], [3, 'learn', null, ['hangul-check']], [4, 'review', null, []],
      [5, 'culture', null, []], [6, 'learn', null, []], [7, 'learn', null, ['topic:food']], [8, 'review', null, []],
      [9, 'learn', null, []], [10, 'culture', null, []], [11, 'learn', null, []], [12, 'review', null, []],
      [13, 'learn', null, []], [14, 'culture', 'seollal', []], [15, 'learn', null, ['topic:animals']], [16, 'review', null, []],
      [17, 'learn', null, ['topic:colors']], [18, 'learn', null, ['topic:numbers']], [19, 'learn', null, ['topic:family']], [20, 'learn', null, ['topic:school']],
      [21, 'learn', null, ['topic:body']], [22, 'learn', null, ['topic:nature']], [23, 'learn', null, ['topic:travel']], [24, 'learn', null, ['topic:sports']],
      [25, 'learn', null, ['topic:k-culture']], [26, 'learn', null, ['topic:science']],
    ]);
  });

  it('lays out every item with its class day and practice day', () => {
    expect(blendRows(draft)).toEqual([
      [1, '2026-11-05', '2026-11-06', 'q:letters-q1'],
      [1, '2026-11-05', '2026-11-06', 'q:life-q1'],
      [1, '2026-11-05', '2026-11-08', 'q:letters-q2'],
      [1, '2026-11-05', '2026-11-08', 'q:life-q2'],
      [1, '2026-11-05', '2026-11-10', 'q:letters-q3'],
      [1, '2026-11-05', '2026-11-10', 'q:life-q3'],
      [2, '2026-11-12', '2026-11-13', 'q:rites-q1'],
      [2, '2026-11-12', '2026-11-13', 'q:nature-q1'],
      [2, '2026-11-12', '2026-11-15', 'q:rites-q2'],
      [2, '2026-11-12', '2026-11-15', 'q:nature-q2'],
      [2, '2026-11-12', '2026-11-17', 'q:rites-q3'],
      [2, '2026-11-12', '2026-11-17', 'q:nature-q3'],
      [3, '2026-11-19', '2026-11-20', 'q:crafts-q1'],
      [3, '2026-11-19', '2026-11-20', 'qq:stage2-life-q1'],
      [3, '2026-11-19', '2026-11-22', 'q:crafts-q2'],
      [3, '2026-11-19', '2026-11-24', 'q:crafts-q3'],
      [5, '2026-12-03', '2026-12-04', 's:kim-hongdo-genre-paintings'],
      [5, '2026-12-03', '2026-12-04', 's:sejong-new-letters'],
      [5, '2026-12-03', '2026-12-06', 'qq:stage2-nature-q1'],
      [5, '2026-12-03', '2026-12-06', 's:shapes-of-hangeul'],
      [5, '2026-12-03', '2026-12-08', 'qq:stage4-rites-q1'],
      [5, '2026-12-03', '2026-12-08', 's:hangeul-day'],
      [6, '2026-12-10', '2026-12-11', 's:tripitaka-koreana'],
      [6, '2026-12-10', '2026-12-11', 's:sun-and-moon'],
      [6, '2026-12-10', '2026-12-13', 's:sillok-royal-historians'],
      [6, '2026-12-10', '2026-12-13', 's:cheugugi-rain-gauge'],
      [6, '2026-12-10', '2026-12-15', 's:chuseok-ganggangsullae'],
      [7, '2026-12-17', '2026-12-18', 's:gimjang-arirang'],
      [7, '2026-12-17', '2026-12-18', 's:dano-ssireum'],
      [7, '2026-12-17', '2026-12-20', 's:sillok-mountain-archives'],
      [7, '2026-12-17', '2026-12-20', 's:angbuilgu-sundial'],
      [7, '2026-12-17', '2026-12-22', 's:jikji-metal-type'],
      [9, '2026-12-31', '2027-01-01', 's:janggyeong-panjeon'],
      [9, '2026-12-31', '2027-01-01', 's:donguibogam'],
      [9, '2026-12-31', '2027-01-03', 's:jagyeongnu-water-clock'],
      [9, '2026-12-31', '2027-01-03', 's:seungjeongwon-ilgi-every-day'],
      [9, '2026-12-31', '2027-01-05', 's:pansori-tales'],
      [10, '2027-01-07', '2027-01-08', 's:nanjung-ilgi'],
      [10, '2027-01-07', '2027-01-08', 's:joseon-records-today'],
      [10, '2027-01-07', '2027-01-10', 's:ilseongnok-daily-reflection'],
      [10, '2027-01-07', '2027-01-10', 'ep:stage2-letters'],
      [10, '2027-01-07', '2027-01-12', 's:uigwe-royal-birthday'],
      [11, '2027-01-14', '2027-01-15', 'ep:stage2-rites'],
      [11, '2027-01-14', '2027-01-17', 'ep:stage2-crafts'],
      [13, '2027-01-28', '2027-01-29', 'ep:stage3-life'],
      [13, '2027-01-28', '2027-01-31', 'ep:stage3-letters'],
      [14, '2027-02-04', '2027-02-05', 's:seollal-new-year'],
    ]);
  });

  it('has the stats, the warnings and the Refresh days', () => {
    expect(draft.stats).toEqual({
      sessions: 104,
      readyItems: 42,
      lessons: 18,
      stories: 24,
      comingSoonItems: 5,
      openSessions: 11,
      minutesPlanned: 191,
      minutesAvailable: 1950,
      reviewWeeks: 4,
      breakWeeks: 0,
      cultureWeeks: 3,
      vocabWeeks: 12,
      endsAtStage: 'stage4',
      byTrack: {
        lecture: { sessions: 26, items: 47, minutesPlanned: 362 },
        personal: { sessions: 78, items: 47, refreshDays: 56, minutesPlanned: 241 },
      },
      sessionsPerTeachingWeek: 4,
      sessionsPerCalendarWeek: 4,
    });
    expect(draft.warnings).toEqual([{ code: 'coming-soon-included', week: 10, count: 5 }, { code: 'content-runs-out', week: 15 }]);
    expect(draft.refresh).toHaveLength(56);
    expect(draft.refresh?.[0]).toEqual({ date: '2026-11-22', cellIds: ['episode:stage1-rites', 'episode:stage1-nature', 'episode:stage1-crafts', 'episode:stage2-life'] });
    expect(toMeta(draft).refresh).toEqual(draft.refresh);
  });
});

describe('goldens A and B stay single-cadence plans (BL-OD-9)', () => {
  it('keeps generator version 1, no class day, no Refresh and no blended stats', () => {
    const a = generateCurriculum(
      {
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
      },
      CATALOG_2026_10,
    );
    expect(GENERATOR_VERSION).toBe(1);
    expect(a.generatorVersion).toBe(1);
    expect('refresh' in a).toBe(false);
    expect(Object.keys(a.stats)).not.toContain('byTrack');
    expect(a.items.every((item) => !('lectureDate' in item))).toBe(true);
    expect(Object.keys(toMeta(a))).toEqual(['kind', 'generatorVersion', 'catalogVersion', 'params', 'weeks', 'horizonDays', 'repacedAt']);
  });
});
