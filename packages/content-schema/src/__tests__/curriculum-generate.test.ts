import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CURRICULUM_MAX_ITEMS,
  CurriculumDraftSchema,
  CurriculumMetaSchema,
  GENERATOR_VERSION,
  StageKeySchema,
  generateCurriculum,
  toMeta,
  toPlanItems,
  weekdayOf,
  type Catalog,
  type CurriculumDraft,
  type CurriculumParamsInput,
  type StageKey,
} from '..';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';

const ALL_STAGES = StageKeySchema.options as StageKey[];
const q = (id: string): string => `quest:stage1-${id}`;
const story = (slug: string): string => `quest:story-${slug}-listen`;
const STAGE1 = [
  'letters-q1', 'letters-q2', 'letters-q3', 'life-q1', 'life-q2', 'life-q3', 'rites-q1', 'rites-q2', 'rites-q3',
  'nature-q1', 'nature-q2', 'nature-q3', 'crafts-q1', 'crafts-q2', 'crafts-q3',
].map(q);

const base: CurriculumParamsInput = {
  audience: 'self',
  level: { stage: 'stage1', band: 0 },
  startDate: '2026-10-12',
  weeks: 4,
  sessionsPerWeek: 3,
  minutesPerSession: 15,
  goals: { focus: 'reading' },
  unlockedStages: ALL_STAGES,
};
const gen = (patch: Partial<CurriculumParamsInput> = {}, catalog: Catalog = CATALOG_2026_10): CurriculumDraft =>
  generateCurriculum({ ...base, ...patch }, catalog);
const ids = (draft: CurriculumDraft): string[] => draft.items.map((item) => item.id);
const kinds = (draft: CurriculumDraft): string[] => draft.weeks.map((week) => week.kind);
const codes = (draft: CurriculumDraft): string[] => draft.warnings.map((warning) => warning.code);
const warning = (draft: CurriculumDraft, code: string) => draft.warnings.find((w) => w.code === code);
const edit = (change: (catalog: Catalog) => void): Catalog => {
  const catalog = structuredClone(CATALOG_2026_10);
  change(catalog);
  return catalog;
};
/** The frozen catalogue with every story still in review: lessons and coming-soon cells only. */
const NO_STORIES = edit((c) => {
  for (const s of c.stories) s.status = 'draft';
});

describe('generateCurriculum: determinism and output', () => {
  it('returns deeply equal drafts for the same input, and only the catalogue version moves with it', () => {
    expect(gen()).toEqual(gen());
    const next = gen({}, { ...CATALOG_2026_10, version: 2 });
    expect(next.catalogVersion).toBe(2);
    expect({ ...next, catalogVersion: 1 }).toEqual(gen());
    expect(gen().generatorVersion).toBe(GENERATOR_VERSION);
  });

  it('produces drafts the schema accepts, with the parsed params', () => {
    const draft = gen({ goals: { focus: 'balanced', motivation: 'heritage' }, weeks: 12 });
    expect(CurriculumDraftSchema.parse(draft)).toEqual(draft);
    expect(draft.params.completedQuestIds).toEqual([]);
    expect(draft.params.includeComingSoon).toBe(true);
  });

  it('throws on params the schema rejects', () => {
    expect(() => gen({ weeks: 0 })).toThrow();
    expect(() => gen({ startDate: '2026-02-30' })).toThrow();
  });
});

describe('step 2: calendar and days off', () => {
  it('spreads sessions like spreadDates when no weekdays are chosen', () => {
    const draft = gen({ weeks: 1, sessionsPerWeek: 3 });
    expect(draft.items.map((item) => item.targetDate)).toEqual(['2026-10-12', '2026-10-14', '2026-10-17']);
    expect(gen({ weeks: 1, sessionsPerWeek: 2 }).items.map((item) => item.targetDate)).toEqual(['2026-10-12', '2026-10-16']);
    expect(gen({ weeks: 1, sessionsPerWeek: 7 }).stats.sessions).toBe(7);
  });

  it('uses the chosen weekdays, whatever the start day, and their count wins', () => {
    const draft = gen({ weeks: 3, sessionsPerWeek: 7, sessionDays: ['sun', 'wed'], startDate: '2026-10-18' });
    expect(draft.stats.sessions).toBe(6);
    for (const item of draft.items) expect(['sun', 'wed']).toContain(weekdayOf(item.targetDate as string));
    const midweek = gen({ weeks: 1, sessionDays: ['mon', 'fri'], startDate: '2026-10-14' });
    expect(midweek.items.map((item) => item.targetDate)).toEqual(['2026-10-16', '2026-10-19']);
  });

  it('removes days off without moving them, and a week left with no session is a break', () => {
    const draft = gen({ weeks: 3, daysOff: [{ from: '2026-10-14', to: '2026-10-14' }, { from: '2026-10-19', to: '2026-10-25' }] });
    expect(kinds(draft)).toEqual(['learn', 'break', 'learn']);
    expect(draft.items.map((item) => [item.targetDate, item.week])).toEqual([
      ['2026-10-12', 1], ['2026-10-17', 1], ['2026-10-26', 3], ['2026-10-28', 3], ['2026-10-31', 3],
    ]);
    expect(draft.items.map((item) => item.id)).toEqual(STAGE1.slice(0, 5));
    expect(draft.stats.sessions).toBe(5);
    expect(draft.stats.breakWeeks).toBe(1);
  });
});

describe('step 3: the done set', () => {
  it('places out by level: band 3 starts at nature-q2', () => {
    const draft = gen({ level: { stage: 'stage1', band: 3 } });
    expect(ids(draft)[0]).toBe(q('nature-q2'));
    for (const id of STAGE1.slice(0, 10)) expect(ids(draft)).not.toContain(id);
  });

  it('adds the exact placed-out set and the completions; only completions count as already done', () => {
    const draft = gen({ placedOutQuestIds: [q('letters-q1')], completedQuestIds: [q('letters-q2'), story('sejong-new-letters')] });
    expect(ids(draft).slice(0, 2)).toEqual([q('letters-q3'), q('life-q1')]);
    expect(ids(draft)).not.toContain(story('sejong-new-letters'));
    expect(warning(draft, 'already-done-skipped')).toEqual({ code: 'already-done-skipped', count: 2 });
    expect(codes(gen({ level: { stage: 'stage1', band: 3 } }))).not.toContain('already-done-skipped');
  });
});

describe('step 4: the lesson queue', () => {
  it('keeps Stage 1 in canonical order whatever the motivation or themes', () => {
    const draft = gen({ weeks: 5, goals: { focus: 'reading', motivation: 'kculture', themes: ['crafts'] } });
    expect(ids(draft)).toEqual(STAGE1);
  });

  it('orders later stages by the motivation theme first, then canonical', () => {
    const start = { level: { stage: 'stage2', band: 0 } as const, weeks: 3 };
    expect(ids(gen({ ...start, goals: { focus: 'reading', motivation: 'heritage' } }, NO_STORIES))).toEqual([
      'quest:stage2-life-q1', 'quest:stage2-nature-q1', 'quest:stage4-rites-q1',
      'episode:stage2-letters', 'episode:stage2-rites', 'episode:stage2-crafts', 'episode:stage3-life', 'episode:stage3-letters',
    ]);
    expect(ids(gen({ ...start, goals: { focus: 'reading', motivation: 'curious' } }, NO_STORIES)).slice(3)).toEqual([
      'episode:stage2-letters', 'episode:stage2-rites', 'episode:stage2-crafts', 'episode:stage3-letters', 'episode:stage3-life',
    ]);
  });

  it('orders by goals.themes first (duplicates once), then canonical', () => {
    const draft = gen({ level: { stage: 'stage2', band: 0 }, weeks: 3, goals: { focus: 'reading', themes: ['nature', 'crafts', 'nature'], motivation: 'heritage' } }, NO_STORIES);
    expect(ids(draft)).toEqual([
      'quest:stage2-nature-q1', 'quest:stage2-life-q1', 'quest:stage4-rites-q1',
      'episode:stage2-crafts', 'episode:stage2-letters', 'episode:stage2-rites', 'episode:stage3-nature', 'episode:stage3-crafts',
    ]);
  });

  it('lists lessons of locked stages and never schedules them', () => {
    const draft = gen({ level: { stage: 'stage2', band: 0 }, weeks: 3, unlockedStages: ['stage1'] });
    expect(draft.locked).toEqual(['quest:stage2-life-q1', 'quest:stage2-nature-q1', 'quest:stage4-rites-q1']);
    for (const id of draft.locked) expect(ids(draft)).not.toContain(id);
    expect(warning(draft, 'premium-needed')).toEqual({ code: 'premium-needed', count: 3 });
  });

  it('stops at endStage and starts at the level stage', () => {
    const draft = gen({ level: { stage: 'stage2', band: 0 }, weeks: 3, endStage: 'stage2', goals: { focus: 'reading', motivation: 'heritage' } }, NO_STORIES);
    expect(ids(draft).filter((id) => id.startsWith('quest:stage'))).toEqual(['quest:stage2-life-q1', 'quest:stage2-nature-q1']);
    expect(ids(draft).filter((id) => id.startsWith('episode:'))).toEqual(['episode:stage2-letters', 'episode:stage2-rites', 'episode:stage2-crafts']);
    const empty = gen({ level: { stage: 'stage3', band: 0 }, endStage: 'stage2', weeks: 1 });
    expect(ids(empty).every((id) => id.startsWith('quest:story-'))).toBe(true);
  });

  it('caps coming-soon items at five, after every lesson and story, and only when asked', () => {
    const draft = gen({ level: { stage: 'stage2', band: 0 }, weeks: 52, sessionsPerWeek: 5, goals: { focus: 'reading' }, culturalAnchors: false });
    const soon = draft.items.filter((item) => item.kind === 'episode');
    expect(soon).toHaveLength(5);
    const firstSoon = draft.items.indexOf(soon[0] as (typeof draft.items)[number]);
    expect(draft.items.slice(firstSoon).every((item) => item.kind === 'episode')).toBe(true);
    expect(draft.items.slice(0, firstSoon).map((item) => item.id)).toContain(story('joseon-records-today'));
    expect(warning(draft, 'coming-soon-included')).toEqual({ code: 'coming-soon-included', week: soon[0]?.week, count: 5 });
    const without = gen({ level: { stage: 'stage2', band: 0 }, weeks: 52, sessionsPerWeek: 5, includeComingSoon: false });
    expect(without.items.some((item) => item.kind === 'episode')).toBe(false);
    expect(without.stats.comingSoonItems).toBe(0);
  });

  it('skips a cell the catalogue does not have', () => {
    const catalog = edit((c) => {
      c.cells = c.cells.filter((cell) => cell.episodeId !== 'episode:stage1-letters');
    });
    expect(ids(gen({ weeks: 1 }, catalog))[0]).toBe(q('life-q1'));
  });
});

describe('step 5: stories, fit, stretch and anchors', () => {
  it('offers only ready stories whose quest is not done, by stage, theme rank and order', () => {
    const catalog = edit((c) => {
      for (const s of c.stories) if (s.id === 'story:sejong-new-letters') s.status = 'draft';
    });
    const draft = gen({ level: { stage: 'stage2', band: 0 }, weeks: 1, sessionsPerWeek: 7, unlockedStages: ['stage1'], goals: { focus: 'reading', motivation: 'heritage' }, culturalAnchors: false }, catalog);
    expect(ids(draft)).toEqual([
      story('kim-hongdo-genre-paintings'), story('shapes-of-hangeul'), story('hangeul-day'), story('tripitaka-koreana'),
      story('sillok-royal-historians'), story('seollal-new-year'), story('chuseok-ganggangsullae'),
    ]);
  });

  it('fills empty slots with stretch stories when nothing fits, and never calls such a week culture', () => {
    const catalog = edit((c) => {
      for (const s of c.stories) s.status = s.recommendedStage >= 3 ? 'ready' : 'draft';
    });
    const draft = gen({ level: { stage: 'stage1', band: 3 }, weeks: 6, unlockedStages: ['stage1'], goals: { focus: 'culture' }, includeComingSoon: false }, catalog);
    expect(ids(draft).slice(5)).toEqual([
      story('seungjeongwon-ilgi-every-day'), story('nanjung-ilgi'), story('donguibogam'),
      story('ilseongnok-daily-reflection'), story('uigwe-royal-birthday'), story('joseon-records-today'),
    ]);
    expect(draft.stats.cultureWeeks).toBe(0);
  });

  it('lets a story fit once a lesson of the stage below it is scheduled', () => {
    const catalog = edit((c) => {
      for (const s of c.stories) s.status = s.id === 'story:seungjeongwon-ilgi-every-day' ? 'ready' : 'draft';
    });
    const draft = gen({ level: { stage: 'stage1', band: 3 }, weeks: 4, sessionsPerWeek: 2, goals: { focus: 'culture', motivation: 'heritage' }, culturalAnchors: false }, catalog);
    // stage2-life-q1 (week 3) lifts `reached` to 2, so the stage 3 story fits and week 4 can be culture.
    expect(kinds(draft)).toEqual(['learn', 'learn', 'learn', 'culture']);
    expect(draft.weeks[3]?.focus.storyIds).toEqual(['story:seungjeongwon-ilgi-every-day']);
  });

  it('reserves an anchor story for the week of its festival and keeps it out of the pool', () => {
    const draft = gen({ startDate: '2026-09-28', weeks: 3, goals: { focus: 'reading' } });
    expect(kinds(draft)).toEqual(['learn', 'culture', 'learn']);
    expect(draft.weeks[1]?.focus).toEqual({ episodeId: 'episode:stage1-life', storyIds: ['story:hangeul-day'], festival: 'hangeul-day' });
    expect(ids(draft).filter((id) => id === story('hangeul-day'))).toHaveLength(1);
    expect(draft.items.find((item) => item.id === story('hangeul-day'))?.targetDate).toBe('2026-10-05');
  });

  it('moves a reservation to the nearest earlier week with sessions', () => {
    const draft = gen({ startDate: '2026-09-28', weeks: 3, daysOff: [{ from: '2026-10-05', to: '2026-10-11' }] });
    expect(kinds(draft)).toEqual(['culture', 'break', 'learn']);
    expect(draft.weeks[0]?.focus.festival).toBe('hangeul-day');
  });

  it('releases an anchor story to the pool when no earlier week has a session', () => {
    const draft = gen({ startDate: '2026-10-05', weeks: 2, sessionsPerWeek: 7, daysOff: [{ from: '2026-10-05', to: '2026-10-11' }], level: { stage: 'stage2', band: 0 }, unlockedStages: ['stage1'], goals: { focus: 'reading', motivation: 'curious' } });
    expect(kinds(draft)).toEqual(['break', 'learn']);
    expect(ids(draft)).toContain(story('hangeul-day'));
    expect(draft.weeks[1]?.focus.festival).toBeNull();
  });

  it('releases a festival outside the plan, and ignores anchors when culturalAnchors is off', () => {
    const outside = gen({ startDate: '2026-10-12', weeks: 2, level: { stage: 'stage2', band: 0 }, unlockedStages: ['stage1'], sessionsPerWeek: 7 });
    expect(outside.weeks.every((week) => week.focus.festival === null)).toBe(true);
    expect(ids(outside)).toContain(story('hangeul-day'));
    const off = gen({ startDate: '2026-09-28', weeks: 3, culturalAnchors: false });
    expect(off.weeks.every((week) => week.focus.festival === null && week.kind !== 'culture')).toBe(true);
  });

  it('uses the Korean lunar dates of the table and no anchor for a year it lacks', () => {
    const seollal2028 = gen({ startDate: '2028-01-24', weeks: 1, level: { stage: 'stage2', band: 0 }, unlockedStages: ['stage1'] });
    expect(seollal2028.weeks[0]?.focus.festival).toBe('seollal');
    const year2031 = gen({ startDate: '2031-01-20', weeks: 4, level: { stage: 'stage2', band: 0 }, unlockedStages: ['stage1'], sessionsPerWeek: 7 });
    expect(year2031.weeks.every((week) => week.focus.festival === null)).toBe(true);
  });

  it('places two festivals of one week first, by date, even beyond the culture-week story count', () => {
    // Chuseok is Tuesday 3 October 2028, Hangeul Day Monday 9 October 2028: one week from the Tuesday.
    const draft = gen({ startDate: '2028-10-03', weeks: 1, sessionsPerWeek: 3 });
    expect(ids(draft)).toEqual([story('chuseok-ganggangsullae'), story('hangeul-day'), q('letters-q1')]);
    expect(draft.weeks[0]?.focus.festival).toBe('chuseok');
    const oneSession = gen({ startDate: '2028-10-03', weeks: 2, sessionsPerWeek: 1 });
    expect(ids(oneSession)).toEqual([story('chuseok-ganggangsullae'), q('letters-q1')]);
  });
});

describe('step 6: week kinds', () => {
  it('defaults reviewEvery to 4 for 12 weeks or more and to 0 below', () => {
    expect(kinds(gen({ weeks: 12 })).filter((kind) => kind === 'review')).toHaveLength(2);
    expect(kinds(gen({ weeks: 11 })).filter((kind) => kind === 'review')).toHaveLength(0);
    expect(kinds(gen({ weeks: 11, reviewEvery: 3 }))).toEqual([
      'learn', 'learn', 'review', 'learn', 'learn', 'review', 'learn', 'learn', 'review', 'learn', 'learn',
    ]);
  });

  it('never makes the last week a review, nor a review without new ready items since the last one', () => {
    expect(kinds(gen({ weeks: 4, reviewEvery: 4 }))[3]).toBe('learn');
    const thin = gen({ level: { stage: 'stage3', band: 0 }, weeks: 12, reviewEvery: 4, includeComingSoon: false, unlockedStages: ['stage1'], sessionsPerWeek: 7 });
    // 21 stories in weeks 1-3, the last 3 in week 5: a review in week 8, none in week 12 (the last week).
    expect(kinds(thin)).toEqual(['learn', 'learn', 'learn', 'review', 'learn', 'learn', 'learn', 'review', 'learn', 'learn', 'learn', 'learn']);
    const nothingNew = gen({ level: { stage: 'stage3', band: 0 }, weeks: 13, reviewEvery: 4, includeComingSoon: false, unlockedStages: ['stage1'], sessionsPerWeek: 7 });
    expect(kinds(nothingNew)[11]).toBe('learn');
  });

  it('lets an anchor week win over a review week', () => {
    // Chuseok 2027 (15 September) is before the start; Hangeul Day falls in week 4.
    const draft = gen({ startDate: '2027-09-18', weeks: 6, reviewEvery: 4 });
    expect(kinds(draft)).toEqual(['learn', 'learn', 'learn', 'culture', 'learn', 'learn']);
    expect(draft.weeks[3]?.focus.festival).toBe('hangeul-day');
  });

  it('follows the culture cadence of the focus', () => {
    const balanced = gen({ weeks: 8, goals: { focus: 'balanced' }, culturalAnchors: false });
    expect(kinds(balanced)).toEqual(['learn', 'learn', 'learn', 'culture', 'learn', 'learn', 'learn', 'culture']);
    const culture = gen({ weeks: 6, goals: { focus: 'culture' }, culturalAnchors: false });
    expect(kinds(culture)).toEqual(['learn', 'learn', 'culture', 'learn', 'learn', 'culture']);
    for (const focus of ['reading', 'words'] as const) {
      expect(gen({ weeks: 8, goals: { focus }, culturalAnchors: false }).stats.cultureWeeks).toBe(0);
    }
  });
});

describe('step 7: filling sessions', () => {
  it('gives a culture week one story below four sessions and two from four', () => {
    const culture = (sessionsPerWeek: number): string[] => {
      const draft = gen({ weeks: 3, sessionsPerWeek, goals: { focus: 'culture' }, culturalAnchors: false });
      return draft.items.filter((item) => item.week === 3).map((item) => item.id);
    };
    expect(culture(1)).toEqual([story('sejong-new-letters')]);
    expect(culture(3).slice(0, 2)).toEqual([story('sejong-new-letters'), q('rites-q1')]);
    expect(culture(4).slice(0, 3)).toEqual([story('sejong-new-letters'), story('shapes-of-hangeul'), q('rites-q3')]);
    expect(culture(7).slice(0, 3)).toEqual([story('sejong-new-letters'), story('shapes-of-hangeul'), STAGE1[14]]);
  });

  it('fills learn weeks lesson first, then stories, then coming-soon items, then nothing', () => {
    const draft = gen({ level: { stage: 'stage1', band: 3 }, unlockedStages: ['stage1'], weeks: 20, sessionsPerWeek: 3, reviewEvery: 0, culturalAnchors: false });
    const order = draft.items.map((item) => (item.kind === 'episode' ? 'soon' : item.id.startsWith('quest:story-') ? 'story' : 'lesson'));
    expect(order).toEqual([...Array(5).fill('lesson'), ...Array(24).fill('story'), ...Array(5).fill('soon')]);
    expect(draft.stats.openSessions).toBe(60 - 34);
    expect(warning(draft, 'content-runs-out')?.week).toBe(12);
  });

  it('holds no items in review and break weeks', () => {
    const draft = gen({ weeks: 12, daysOff: [{ from: '2026-11-02', to: '2026-11-08' }] });
    const empty = draft.weeks.filter((week) => week.kind === 'review' || week.kind === 'break').map((week) => week.index);
    expect(empty).toEqual([4, 8]);
    expect(draft.weeks[3]?.kind).toBe('break');
    for (const index of empty) expect(draft.items.some((item) => item.week === index)).toBe(false);
  });
});

describe('step 8: extras', () => {
  it('offers no word topic while a scheduled-later lesson still teaches symbols', () => {
    const draft = gen({ weeks: 5, sessionsPerWeek: 2, goals: { focus: 'words' } });
    expect(draft.weeks.flatMap((week) => week.extras)).toEqual([]);
  });

  it('starts the topic cadence in the first week topics are allowed, free topics first', () => {
    const catalog = edit((c) => {
      c.topics = c.topics.map((topic) => ({ ...topic, free: topic.key === 'science' || topic.key === 'food' }));
    });
    const draft = gen({ level: { stage: 'stage1', band: 3 }, weeks: 9, goals: { focus: 'words' }, unlockedStages: ['stage1'] }, catalog);
    expect(draft.weeks.map((week) => week.extras)).toEqual([
      [], [{ kind: 'hangul-check' }], [{ kind: 'vocab', topicId: 'topic:food' }], [], [],
      [{ kind: 'vocab', topicId: 'topic:science' }], [], [], [{ kind: 'vocab', topicId: 'topic:animals' }],
    ]);
    expect(draft.stats.vocabWeeks).toBe(3);
  });

  it('gives a free-practice week a topic unless the focus is reading, until topics run out', () => {
    const empty = { level: { stage: 'stage3', band: 0 } as const, includeComingSoon: false, unlockedStages: ['stage1'] as StageKey[], weeks: 20, sessionsPerWeek: 7 };
    const words = gen({ ...empty, goals: { focus: 'culture' } });
    expect(words.stats.vocabWeeks).toBe(12);
    expect(words.weeks.slice(-1)[0]?.extras).toEqual([]);
    expect(gen({ ...empty, goals: { focus: 'reading' } }).stats.vocabWeeks).toBe(0);
  });

  it('closes Stage 1 with the Hangul Check only when every Stage 1 lesson is in the plan', () => {
    const full = gen({ weeks: 5, goals: { focus: 'reading' } });
    expect(full.weeks.map((week) => week.extras)).toEqual([[], [], [], [], [{ kind: 'hangul-check' }]]);
    expect(gen({ weeks: 4 }).weeks.flatMap((week) => week.extras)).toEqual([]);
    const fromStage2 = gen({ level: { stage: 'stage2', band: 0 }, weeks: 5 });
    expect(fromStage2.weeks.flatMap((week) => week.extras).some((extra) => extra.kind === 'hangul-check')).toBe(false);
    const done = gen({ weeks: 2, completedQuestIds: STAGE1 });
    expect(done.weeks.flatMap((week) => week.extras).some((extra) => extra.kind === 'hangul-check')).toBe(false);
  });
});

describe('step 9: stats and warnings', () => {
  it('counts minutes, sessions and the stage the plan ends at', () => {
    const draft = gen({ weeks: 2, minutesPerSession: 10 });
    expect(draft.stats).toMatchObject({ sessions: 6, readyItems: 6, lessons: 6, stories: 0, minutesPlanned: 27, minutesAvailable: 60, endsAtStage: 'stage1', openSessions: 0 });
    expect(gen({ level: { stage: 'stage3', band: 0 }, weeks: 1, unlockedStages: ['stage1'] }).stats.endsAtStage).toBe('stage3');
  });

  it('warns when content runs out, at the first empty session', () => {
    const draft = gen({ level: { stage: 'stage3', band: 0 }, weeks: 6, sessionsPerWeek: 7, includeComingSoon: false, unlockedStages: ['stage1'] });
    expect(warning(draft, 'content-runs-out')).toEqual({ code: 'content-runs-out', week: 4 });
  });

  it('warns about ready lessons that did not fit, not about stories', () => {
    expect(warning(gen({ weeks: 1 }), 'fewer-sessions-than-units')).toEqual({ code: 'fewer-sessions-than-units', count: 15 });
    const stories = gen({ level: { stage: 'stage3', band: 0 }, weeks: 1, unlockedStages: ['stage1'] });
    expect(codes(stories)).not.toContain('fewer-sessions-than-units');
  });

  it('warns about items longer than one and a half sessions', () => {
    const catalog = edit((c) => {
      for (const quest of c.quests) if (quest.id === q('letters-q1')) quest.minutes = 8;
    });
    expect(warning(gen({ weeks: 1, minutesPerSession: 5 }, catalog), 'session-too-short')).toEqual({ code: 'session-too-short', count: 1 });
    expect(codes(gen({ weeks: 1, minutesPerSession: 10 }, catalog))).not.toContain('session-too-short');
  });

  it('orders week-bound warnings by week, then the others in code order', () => {
    const draft = gen({ level: { stage: 'stage2', band: 0 }, weeks: 10, sessionsPerWeek: 7, unlockedStages: ['stage1'], completedQuestIds: [story('sejong-new-letters')] });
    expect(draft.warnings).toEqual([
      { code: 'coming-soon-included', week: 4, count: 5 },
      { code: 'content-runs-out', week: 5 },
      { code: 'premium-needed', count: 3 },
      { code: 'already-done-skipped', count: 1 },
    ]);
  });

  it('never exceeds 260 items', () => {
    const draft = gen({ weeks: 52, sessionsPerWeek: 5, level: { stage: 'stage1', band: 0 } });
    expect(draft.items.length).toBeLessThanOrEqual(CURRICULUM_MAX_ITEMS);
    expect(toPlanItems(draft).length).toBeLessThanOrEqual(CURRICULUM_MAX_ITEMS);
  });
});

describe('toPlanItems and toMeta', () => {
  it('orders by date and notes only coming-soon items', () => {
    const draft = gen({ level: { stage: 'stage3', band: 0 }, weeks: 2, sessionsPerWeek: 7, unlockedStages: ['stage1'] });
    const shuffled = { ...draft, items: [...draft.items].reverse() };
    const items = toPlanItems(shuffled);
    expect(items.map((item) => item.targetDate)).toEqual([...draft.items.map((item) => item.targetDate)]);
    expect(items.filter((item) => item.note !== undefined).every((item) => item.kind === 'episode' && item.note === 'Coming soon')).toBe(true);
    expect(items.filter((item) => item.kind === 'quest').every((item) => item.note === undefined)).toBe(true);
    const undated = toPlanItems({ ...draft, items: [{ kind: 'quest', id: 'quest:x', week: 1 }, ...draft.items.slice(0, 1)] });
    expect(undated[0]?.id).toBe('quest:x');
  });

  it('keeps a note an item already has', () => {
    const draft = gen({ weeks: 1 });
    const noted = { ...draft, items: [{ kind: 'episode' as const, id: 'episode:stage2-letters', targetDate: '2026-10-12', week: 1, note: 'Soon' }] };
    expect(toPlanItems(noted)[0]?.note).toBe('Soon');
  });

  it('stores params without completions, a week horizon and no re-pace yet', () => {
    const draft = gen({ completedQuestIds: [q('letters-q1')], weeks: 12 });
    const meta = toMeta(draft);
    expect(meta).toEqual({
      kind: 'curriculum',
      generatorVersion: GENERATOR_VERSION,
      catalogVersion: CATALOG_2026_10.version,
      params: { ...Object.fromEntries(Object.entries(draft.params).filter(([key]) => key !== 'completedQuestIds')) },
      weeks: draft.weeks,
      horizonDays: 7,
      repacedAt: null,
    });
    expect('completedQuestIds' in meta.params).toBe(false);
    expect(CurriculumMetaSchema.parse(meta)).toEqual(meta);
    expect(JSON.stringify(meta).length).toBeLessThan(12_000);
    meta.weeks[0]?.extras.push({ kind: 'hangul-check' });
    expect(draft.weeks[0]?.extras).toEqual([]);
  });

  it('runs on the shipped catalogue too', () => {
    const draft = generateCurriculum({ ...base, weeks: 4 }, CATALOG);
    expect(draft.items[0]?.id).toBe(q('letters-q1'));
    expect(draft.catalogVersion).toBe(CATALOG.version);
  });
});
