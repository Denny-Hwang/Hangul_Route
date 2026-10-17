import { CATALOG, chooserGroups, type ChooserGroup, type ChooserRow, type LectureBlock, type PlanItem } from '@hangul-route/content-schema';
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
  outlineSelection,
  planMinutes,
  planSelection,
  rowDetail,
  visibleCount,
} from '../lesson-picker';

/**
 * The console side of the grouped lesson picker (owner report 2026-10-16 item 5, AMENDMENTS-LECTURE-V2 row LV-3):
 * the groups per use and language, the labels, where the picker opens, the room a press needs, and how a press
 * lands in a plan's items or a lecture outline (in place, other items untouched).
 */
const w = getMessages('en').console.chooser;
const plan = consoleChooserGroups('en', 'plan');
const lecture = consoleChooserGroups('en', 'lecture');
const planKeys = chooserKeys(plan);
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
    expect(rowDetail(row(lecture, 'vocab-topic:food'), w)).toBe('about 5 min');
    const withLetters = chooserGroups({ catalog: CATALOG, title: (id) => id, letters: { consonants: ['jamo:g'], vowels: [], titles: { consonants: 'C', vowels: 'V' } } });
    expect(rowDetail(row(withLetters, 'letters:consonants'), w)).toBe('');
  });

  it('visibleCount counts every row and every lesson', () => {
    expect(visibleCount([group(plan, 'stage1')])).toBe(5 + 15);
    expect(visibleCount([])).toBe(0);
  });
});

describe('initialGroup', () => {
  it('opens on the group of the first chosen row or lesson, else the first group', () => {
    expect(initialGroup(plan, [])).toBe('stage1');
    expect(initialGroup(plan, ['quest:gone', 'episode:stage3-life'])).toBe('stage3');
    expect(initialGroup(plan, ['quest:stage6-life-q2'])).toBe('stage6');
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
    const whole = applyToPlan(items, planKeys, ['episode:stage2-life', 'quest:stage3-life-q1']);
    expect(whole).toEqual([
      { kind: 'quest', id: 'quest:story-hangeul-day-listen', targetDate: '2026-10-19' },
      { kind: 'episode', id: 'episode:stage2-life' },
      { kind: 'quest', id: 'quest:stage3-life-q1' },
    ]);
    expect(applyToPlan(items, planKeys, ['quest:stage2-life-q1', 'quest:nope'])).toEqual(items);
  });

  it('planMinutes sums the catalogue minutes (an unknown id counts 0)', () => {
    const cell = CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-life')!;
    const quest = CATALOG.quests.find((q) => q.id === 'quest:stage3-life-q1')!;
    expect(planMinutes([{ kind: 'episode', id: cell.episodeId }, { kind: 'quest', id: quest.id }, { kind: 'quest', id: 'quest:nope' }])).toBe(cell.minutes + quest.minutes);
    expect(planMinutes([])).toBe(0);
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
