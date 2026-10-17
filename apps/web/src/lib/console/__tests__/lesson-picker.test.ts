import {
  CATALOG,
  CURRICULUM_MAX_ITEMS,
  PLAN_MAX_ITEMS,
  StageKeySchema,
  chooserGroups,
  lessonParents,
  searchChooser,
  toggleLesson,
  toggleRow,
  type ChooserEpisodeRow,
  type ChooserGroup,
  type ChooserRow,
  type CurriculumMeta,
  type LectureBlock,
  type PlanItem,
} from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { LECTURE_STORIES, LECTURE_VOCAB_TOPICS } from '@/data/lecture-catalogue.generated';
import {
  addsItems,
  applyToOutline,
  applyToPlan,
  blockKey,
  chooserKeys,
  consoleChooserGroups,
  groupChip,
  groupHeading,
  initialGroup,
  lessonsPastStages,
  outlineSelection,
  planBarLine,
  planMinutes,
  planRoom,
  planSelection,
  planStages,
  planStagesNotice,
  rowDetail,
  visibleCount,
  withLectureTopicMinutes,
} from '../lesson-picker';
import { blockMinutes, vocabMinutes } from '../lecture';
import { ROUTES } from '../routing';

/**
 * The console side of the grouped lesson picker (owner report 2026-10-16 item 5, AMENDMENTS-LECTURE-V2 row LV-3):
 * the groups per use and language, the labels, where the picker opens, the room a press needs, and how a press
 * lands in a plan's items or a lecture outline (in place, other items untouched).
 */
const w = getMessages('en').console.chooser;
const plan = consoleChooserGroups('en', 'plan');
const lecture = consoleChooserGroups('en', 'lecture');
const planKeys = chooserKeys(plan);
const planParents = lessonParents(plan);
const lectureKeys = chooserKeys(lecture);
const group = (groups: readonly ChooserGroup[], id: string): ChooserGroup => groups.find((g) => g.id === id)!;
const row = (groups: readonly ChooserGroup[], key: string): ChooserRow => groups.flatMap((g) => g.rows).find((r) => r.key === key)!;

describe('consoleChooserGroups', () => {
  it('the plan builder lists every ready stage, episodes and lessons only', () => {
    expect(plan.map((g) => g.id)).toEqual(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']);
    expect(plan.every((g) => g.rows.every((r) => r.kind === 'episode'))).toBe(true);
    expect(planKeys.size).toBe(35 + 107);
  });

  it('the lecture catalogue adds the listed stories and topics', () => {
    expect(lecture.map((g) => g.id).slice(-2)).toEqual(['stories', 'topics']);
    expect(group(lecture, 'stories').rows.map((r) => r.key).sort()).toEqual(LECTURE_STORIES.map((s) => s.id).sort());
    expect(group(lecture, 'topics').rows.map((r) => r.key).sort()).toEqual(LECTURE_VOCAB_TOPICS.map((t) => t.id).sort());
  });

  it('stages narrows the plan builder to the stages the space opens', () => {
    expect(consoleChooserGroups('en', 'plan', ['stage1']).map((g) => g.id)).toEqual(['stage1']);
    expect(consoleChooserGroups('en', 'plan', planStages(null)).map((g) => g.id)).toEqual(['stage1']);
    expect(consoleChooserGroups('en', 'plan', planStages([...StageKeySchema.options])).map((g) => g.id)).toEqual(plan.map((g) => g.id));
  });

  it('titles every row in the console language and searches the Korean title in any', () => {
    expect(row(consoleChooserGroups('ko', 'plan'), 'episode:stage1-life').title).toBe('한국의 식탁에서');
    expect(row(consoleChooserGroups('es', 'lecture'), 'story:hangeul-day').title).toBe('¡Feliz Día del Hangul!');
    expect(row(plan, 'episode:stage1-life').search).toContain('한국의 식탁에서');
  });
});

describe('labels', () => {
  it('groupHeading and groupChip for a stage, the stories and the topics', () => {
    expect(groupHeading(group(lecture, 'stage2'), w)).toBe('Stage 2 · 18 lessons');
    expect(groupHeading(group(lecture, 'stories'), w)).toBe(`Stories · ${LECTURE_STORIES.length} stories`);
    expect(groupHeading(group(lecture, 'topics'), w)).toBe(`Word topics · ${LECTURE_VOCAB_TOPICS.length} topics`);
    expect([groupChip(group(lecture, 'stage7'), w), groupChip(group(lecture, 'stories'), w), groupChip(group(lecture, 'topics'), w)]).toEqual(['Stage 7', 'Stories', 'Word topics']);
  });

  it('rowDetail for an episode, a story, a topic and a letter set (the console draws none)', () => {
    expect(rowDetail(row(plan, 'episode:stage1-letters'), w)).toBe('3 lessons · about 15 min');
    expect(rowDetail(row(lecture, 'story:hangeul-day'), w)).toBe(`about ${CATALOG.stories.find((s) => s.id === 'story:hangeul-day')!.minutes} min`);
    // A word topic says what the outline counts for it (rule 12 as amended, LV-M1): 12 words = 6 + 5 quiz questions.
    expect(rowDetail(row(lecture, 'vocab-topic:food'), w)).toBe('about 11 min');
    const withLetters = chooserGroups({ catalog: CATALOG, title: (id) => id, letters: { consonants: ['jamo:g'], vowels: [], titles: { consonants: 'C', vowels: 'V' } } });
    expect(rowDetail(row(withLetters, 'letters:consonants'), w)).toBe('');
  });

  it('a lecture word topic row has the minutes the outline gives its block; other rows keep the catalogue minutes', () => {
    const minutesOf = (r: ChooserRow): number | null => ('minutes' in r ? r.minutes : null);
    for (const t of LECTURE_VOCAB_TOPICS) {
      expect(minutesOf(row(lecture, t.id)), t.id).toBe(vocabMinutes(t.id));
      expect(minutesOf(row(lecture, t.id)), t.id).toBe(blockMinutes({ kind: 'vocab', topicId: t.id }));
    }
    const story = row(lecture, 'story:hangeul-day');
    expect(minutesOf(story)).toBe(CATALOG.stories.find((s) => s.id === 'story:hangeul-day')!.minutes);
    expect(minutesOf(row(lecture, 'episode:stage1-letters'))).toBe(minutesOf(row(plan, 'episode:stage1-letters')));
    // A topic the lecture mirror does not know keeps its catalogue minutes; a row of another kind is left as it is.
    const odd: ChooserGroup = { ...group(lecture, 'topics'), rows: [{ kind: 'topic', key: 'vocab-topic:none', title: 'None', minutes: 5, search: '' }, story] };
    expect(withLectureTopicMinutes(odd).rows.map(minutesOf)).toEqual([5, minutesOf(story)]);
    const stage = group(lecture, 'stage1');
    expect(withLectureTopicMinutes(stage)).toBe(stage);
  });

  it('visibleCount counts every row and every lesson shown', () => {
    expect(visibleCount([group(plan, 'stage1')])).toBe(5 + 15);
    expect(visibleCount([group(lecture, 'stories')])).toBe(LECTURE_STORIES.length);
    expect(visibleCount([])).toBe(0);
    const title = CATALOG.quests.find((q) => q.id === 'quest:stage2-letters-q4')!.title;
    const hit = searchChooser(plan, title);
    const shown = (hit[0]!.rows[0] as ChooserEpisodeRow).shown?.length ?? 0;
    expect(shown).toBeGreaterThan(0);
    expect(visibleCount(hit)).toBe(hit.reduce((n, g) => n + g.rows.reduce((m, r) => m + 1 + (r.kind === 'episode' ? (r.shown?.length ?? r.lessons.length) : 0), 0), 0));
  });
});

describe('initialGroup', () => {
  it('opens on the group of the first chosen row or lesson, else the first group', () => {
    expect(initialGroup(plan, [])).toBe('stage1');
    expect(initialGroup(plan, ['quest:gone', 'episode:stage3-life'])).toBe('stage3');
    expect(initialGroup(plan, ['quest:stage6-life-q2'])).toBe('stage6');
    // The first chosen item in the plan's order, not the lowest stage.
    expect(initialGroup(plan, ['quest:stage4-life-q1', 'episode:stage1-letters'])).toBe('stage4');
    expect(initialGroup(lecture, ['story:hangeul-day'])).toBe('stories');
    expect(initialGroup([], [])).toBeNull();
  });
});

describe('addsItems: the room a press needs (one item per key on the console)', () => {
  const letters = row(plan, 'episode:stage1-letters');
  const story = row(lecture, 'story:hangeul-day');
  it('a row: one to add, minus the lessons it replaces; a chosen row removes', () => {
    expect(addsItems([], letters)).toBe(1);
    expect(addsItems(['quest:stage1-letters-q1', 'quest:stage1-letters-q2'], letters)).toBe(-1);
    expect(addsItems(['episode:stage1-letters'], letters)).toBe(-1);
    expect(addsItems([], story)).toBe(1);
    expect(addsItems([story.key], story)).toBe(-1);
  });

  it('a lesson: one to add, minus one to remove; inside a whole episode, the other lessons replace it', () => {
    expect(addsItems([], letters, 'quest:stage1-letters-q1')).toBe(1);
    expect(addsItems(['quest:stage1-letters-q1'], letters, 'quest:stage1-letters-q1')).toBe(-1);
    expect(addsItems(['episode:stage1-letters'], letters, 'quest:stage1-letters-q1')).toBe(1);
    expect(addsItems(['episode:stage2-letters'], row(plan, 'episode:stage2-letters'), 'quest:stage2-letters-q1')).toBe(4);
    expect(addsItems(['episode:stage1-letters', 'quest:stage1-letters-q2'], letters, 'quest:stage1-letters-q1')).toBe(0);
    // An older plan with the episode and the same lesson: the press removes both and adds the two others.
    expect(addsItems(['episode:stage1-letters', 'quest:stage1-letters-q1'], letters, 'quest:stage1-letters-q1')).toBe(0);
  });

  it('with merge: false, a partly chosen row adds its missing lessons', () => {
    expect(addsItems(['quest:stage1-letters-q1'], letters, undefined, { merge: false })).toBe(2);
    expect(addsItems([], letters, undefined, { merge: false })).toBe(1);
    expect(addsItems(['quest:stage1-letters-q1'], story, undefined, { merge: false })).toBe(1);
  });

  it('is the selection length after the press minus before, for every row and lesson of every group', () => {
    const selection = ['episode:stage1-letters', 'quest:stage2-life-q1', 'quest:stage3-life-q2', 'quest:stage3-life-q1'];
    for (const g of plan) {
      for (const r of g.rows) {
        expect(addsItems(selection, r)).toBe(toggleRow(selection, r).length - selection.length);
        if (r.kind !== 'episode') continue;
        for (const l of r.lessons) expect(addsItems(selection, r, l.key)).toBe(toggleLesson(selection, r, l.key).length - selection.length);
      }
    }
  });
});

describe('the plan builder', () => {
  const items: PlanItem[] = [
    { kind: 'quest', id: 'quest:story-hangeul-day-listen', targetDate: '2026-10-19' },
    { kind: 'quest', id: 'quest:stage2-life-q1', note: 'Bring a lunch box' },
  ];

  it('a plan as a selection leaves out what the picker does not list', () => {
    expect(planSelection(items, planKeys)).toEqual(['quest:stage2-life-q1']);
  });

  it('a press changes the plan in place; a story quest from a route keeps its date', () => {
    const whole = applyToPlan(items, planKeys, ['episode:stage2-life', 'quest:stage3-life-q1'], planParents);
    expect(whole).toEqual([
      { kind: 'quest', id: 'quest:story-hangeul-day-listen', targetDate: '2026-10-19' },
      // The whole episode stands in for its lesson and keeps the lesson's note.
      { kind: 'episode', id: 'episode:stage2-life', note: 'Bring a lunch box' },
      { kind: 'quest', id: 'quest:stage3-life-q1' },
    ]);
    expect(applyToPlan(items, planKeys, ['quest:stage2-life-q1', 'quest:nope'], planParents)).toEqual(items);
    // A new whole episode stands in for nothing: one plain item at the end.
    expect(applyToPlan(items, planKeys, ['quest:stage2-life-q1', 'episode:stage4-life'], planParents)).toEqual([...items, { kind: 'episode', id: 'episode:stage4-life' }]);
  });

  describe('dates, weeks and notes survive a press (a route draft)', () => {
    const letters = row(plan, 'episode:stage1-letters') as ChooserEpisodeRow;
    const [q1, q2, q3] = letters.lessons.map((l) => l.key) as [string, string, string];
    const press = (list: readonly PlanItem[], update: (s: string[]) => string[]): PlanItem[] => applyToPlan(list, planKeys, update(planSelection(list, planKeys)), planParents);

    it('unticking one lesson of a dated, noted whole episode keeps its week, date and note on each other lesson', () => {
      const route: PlanItem[] = [{ kind: 'episode', id: letters.key, week: 2, targetDate: '2026-10-20', note: 'Bring a lunch box' }, { kind: 'quest', id: 'quest:stage1-life-q1', week: 3, targetDate: '2026-10-27' }];
      expect(press(route, (s) => toggleLesson(s, letters, q2))).toEqual([
        { kind: 'quest', id: q1, week: 2, targetDate: '2026-10-20', note: 'Bring a lunch box' },
        { kind: 'quest', id: q3, week: 2, targetDate: '2026-10-20', note: 'Bring a lunch box' },
        { kind: 'quest', id: 'quest:stage1-life-q1', week: 3, targetDate: '2026-10-27' },
      ]);
    });

    it('ticking a partly chosen episode (merge: false) keeps the dated lessons and schedules the missing ones in their week', () => {
      const route: PlanItem[] = [
        { kind: 'quest', id: q1, week: 1, targetDate: '2026-10-13', note: 'Monday' },
        { kind: 'quest', id: q2, week: 1, targetDate: '2026-10-15' },
        { kind: 'quest', id: 'quest:stage1-life-q1', week: 2, targetDate: '2026-10-20' },
      ];
      expect(press(route, (s) => toggleRow(s, letters, { merge: false }))).toEqual([
        { kind: 'quest', id: q1, week: 1, targetDate: '2026-10-13', note: 'Monday' },
        { kind: 'quest', id: q2, week: 1, targetDate: '2026-10-15' },
        { kind: 'quest', id: q3, week: 1, targetDate: '2026-10-15' },
        { kind: 'quest', id: 'quest:stage1-life-q1', week: 2, targetDate: '2026-10-20' },
      ]);
    });

    it('a lesson added beside a route lesson of its episode takes that week; on a classic plan it comes undated', () => {
      const route: PlanItem[] = [{ kind: 'quest', id: q1, week: 4, targetDate: '2026-11-03' }];
      expect(press(route, (s) => toggleLesson(s, letters, q3))).toEqual([...route, { kind: 'quest', id: q3, week: 4, targetDate: '2026-11-03' }]);
      const classic: PlanItem[] = [{ kind: 'quest', id: q1, targetDate: '2026-11-03' }];
      expect(press(classic, (s) => toggleLesson(s, letters, q3))).toEqual([...classic, { kind: 'quest', id: q3 }]);
    });

    it('two dated week-1 lessons and the whole-episode merge (a deck path) keep the first one\'s week, date and note', () => {
      const route: PlanItem[] = [
        { kind: 'quest', id: q1, week: 1, targetDate: '2026-10-13', note: 'first' },
        { kind: 'quest', id: q2, week: 1, targetDate: '2026-10-15' },
      ];
      expect(press(route, (s) => toggleRow(s, letters))).toEqual([{ kind: 'episode', id: letters.key, week: 1, targetDate: '2026-10-13', note: 'first' }]);
    });

    it('an older plan with the episode and one of its lessons: one press unticks that lesson and keeps the episode schedule on the others', () => {
      const legacy: PlanItem[] = [{ kind: 'episode', id: letters.key, targetDate: '2026-10-20' }, { kind: 'quest', id: q1, note: 'again' }];
      expect(press(legacy, (s) => toggleLesson(s, letters, q1))).toEqual([
        { kind: 'quest', id: q2, targetDate: '2026-10-20' },
        { kind: 'quest', id: q3, targetDate: '2026-10-20' },
      ]);
    });
  });

  it('planRoom: a route holds CURRICULUM_MAX_ITEMS, a classic plan PLAN_MAX_ITEMS', () => {
    const three: PlanItem[] = [{ kind: 'quest', id: 'a' }, { kind: 'quest', id: 'b' }, { kind: 'quest', id: 'c' }];
    const meta = { weeks: [] } as unknown as CurriculumMeta;
    expect(planRoom(three, meta)).toBe(CURRICULUM_MAX_ITEMS - 3);
    expect(planRoom(three, null)).toBe(PLAN_MAX_ITEMS - 3);
    expect(planRoom([], null)).toBe(PLAN_MAX_ITEMS);
  });

  it('planBarLine: the count and the catalogue minutes, in the console language', () => {
    const two: PlanItem[] = [{ kind: 'episode', id: 'episode:stage1-letters' }, { kind: 'quest', id: 'quest:stage2-life-q1' }];
    const minutes = planMinutes(two);
    expect(planBarLine(two, w)).toBe(w.chosen(2, minutes));
    expect(planBarLine(two, w)).toMatch(/^2 chosen/);
    expect(planBarLine([], getMessages('ko').console.chooser)).toBe(getMessages('ko').console.chooser.chosen(0, 0));
  });

  it('planMinutes sums the catalogue minutes (an unknown id counts 0)', () => {
    const cell = CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-life')!;
    const quest = CATALOG.quests.find((q) => q.id === 'quest:stage3-life-q1')!;
    expect(planMinutes([{ kind: 'episode', id: cell.episodeId }, { kind: 'quest', id: quest.id }, { kind: 'quest', id: 'quest:nope' }])).toBe(cell.minutes + quest.minutes);
    expect(planMinutes([])).toBe(0);
  });
});

describe('the stages the plan builder lists and its line (AMENDMENTS-LESSON-CHOOSER section 4)', () => {
  const all = [...StageKeySchema.options];
  const past = lessonsPastStages(['stage1']);

  it('planStages: Stage 1 until the entitlement list is read, else the unlocked stages in order', () => {
    expect(planStages(null)).toEqual(['stage1']);
    expect(planStages(['stage3', 'stage1'])).toEqual(['stage1', 'stage3']);
    expect(planStages(all)).toEqual(all);
  });

  it('lessonsPastStages counts the ready lessons of the stages left out', () => {
    // The lesson counts of the stage groups the picker would draw for Stages 2 to 7 (92 in the shipped catalogue).
    expect(past).toBe(plan.filter((g) => g.id !== 'stage1').reduce((n, g) => n + g.count, 0));
    expect(past).toBe(92);
    expect(lessonsPastStages([])).toBe(107);
    expect(lessonsPastStages(all)).toBe(0);
  });

  it('no line before the list is read or when every stage is listed', () => {
    expect(planStagesNotice({ unlocked: null, gating: true, coverage: 'uncovered', kind: 'class' }, 'en')).toBeNull();
    expect(planStagesNotice({ unlocked: all, gating: true, coverage: 'covered', kind: 'class' }, 'en')).toBeNull();
    expect(planStagesNotice({ unlocked: all, gating: false, coverage: 'unknown', kind: 'family' }, 'en')).toBeNull();
  });

  it('switch on, the owner of an uncovered space: the free plan, the product by kind and Open billing', () => {
    const c = getMessages('en').console;
    expect(planStagesNotice({ unlocked: ['stage1'], gating: true, coverage: 'uncovered', kind: 'class' }, 'en')).toEqual({
      text: c.curriculum.freeDays.warningNoLessons(past, 'a Group License'),
      link: { label: 'Open billing', href: ROUTES.billing },
    });
    const family = planStagesNotice({ unlocked: ['stage1'], gating: true, coverage: 'uncovered', kind: 'family' }, 'ko');
    expect(family?.text).toBe(getMessages('ko').console.curriculum.freeDays.warningNoLessons(past, getMessages('ko').console.access.product.family));
  });

  it('switch on, coverage unknown: the neutral product words and no link', () => {
    expect(planStagesNotice({ unlocked: ['stage1'], gating: true, coverage: 'unknown', kind: 'class' }, 'es')).toEqual({ text: getMessages('es').console.curriculum.freeDays.warningNeutral(past), link: null });
  });

  it("switch off: the wizard's line, See plans for a class only; never a price", () => {
    const c = getMessages('en').console.curriculum.preview.warnings;
    expect(planStagesNotice({ unlocked: ['stage1'], gating: false, coverage: 'unknown', kind: 'class' }, 'en')).toEqual({ text: c.premium(past), link: { label: c.seePlans.cta, href: ROUTES.billing } });
    expect(planStagesNotice({ unlocked: ['stage1'], gating: false, coverage: 'unknown', kind: 'family' }, 'en')?.link).toBeNull();
    expect(planStagesNotice({ unlocked: ['stage1'], gating: false, coverage: 'unknown', kind: null }, 'en')?.link).not.toBeNull();
    for (const locale of ['en', 'es', 'ko'] as const) {
      for (const gating of [true, false]) {
        for (const coverage of ['uncovered', 'unknown'] as const) {
          expect(planStagesNotice({ unlocked: ['stage1'], gating, coverage, kind: 'class' }, locale)?.text).not.toMatch(/[$€₩]|\d+[.,]\d{2}/);
        }
      }
    }
  });
});

describe('the lecture outline', () => {
  const outline: LectureBlock[] = [
    { kind: 'quest', id: 'quest:stage1-letters-q1' },
    { kind: 'quiz', from: 'previous', rounds: 5 },
    { kind: 'jamo-set', jamoIds: ['jamo:g'] },
    { kind: 'story', storyId: 'story:hangeul-day', checks: false },
    { kind: 'vocab', topicId: 'vocab-topic:food' },
    { kind: 'episode', id: 'episode:nope' },
  ];

  it('blockKey names the catalogue blocks only', () => {
    expect(outline.map((b) => blockKey(b, lectureKeys))).toEqual(['quest:stage1-letters-q1', null, null, 'story:hangeul-day', 'vocab-topic:food', null]);
    expect(outlineSelection(outline, lectureKeys)).toEqual(['quest:stage1-letters-q1', 'story:hangeul-day', 'vocab-topic:food']);
  });

  it('a press changes the outline in place: the quiz, the letters and the story\'s own settings stay', () => {
    const next = applyToOutline(outline, lecture, lectureKeys, ['episode:stage1-letters', 'story:hangeul-day', 'vocab-topic:food', 'quest:stage4-life-q1']);
    expect(next).toEqual([
      { kind: 'episode', id: 'episode:stage1-letters' },
      { kind: 'quiz', from: 'previous', rounds: 5 },
      { kind: 'jamo-set', jamoIds: ['jamo:g'] },
      { kind: 'story', storyId: 'story:hangeul-day', checks: false },
      { kind: 'vocab', topicId: 'vocab-topic:food' },
      { kind: 'episode', id: 'episode:nope' },
      { kind: 'quest', id: 'quest:stage4-life-q1' },
    ]);
  });
});
