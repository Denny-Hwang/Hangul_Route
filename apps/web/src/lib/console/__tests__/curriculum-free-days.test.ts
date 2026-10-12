import { CATALOG, LENGTH_PRESETS, StageKeySchema, generateCurriculum, type Catalog, type CurriculumDraft, type CurriculumItem } from '@hangul-route/content-schema';
import { findBannedWord, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { itemCategory } from '@/data/catalog';
import { defaultsFor, freeDaysView, lastLessonWeek, toParams, warningText, type WizardState } from '../curriculum';

/**
 * F-ENT-003 section 3.9.3 (E3-9; wireframe console/curriculum-free-days): for an unlicensed
 * space with the console's free-plan switch on, the wizard's left-out warning names the
 * product by space kind and the last week that holds a lesson, and a plan that runs longer
 * than its lessons says so, with a shorter length preset when one holds every lesson. The
 * generator is not touched (OD-1): an unlicensed space already plans Stage 1 only.
 */
const TODAY = '2026-10-18'; // a Sunday
const ALL = [...StageKeySchema.options];
const FREE = ['stage1'] as const;
const m = getMessages('en').console;

const stateFor = (audience: 'class' | 'family', patch: Partial<WizardState> = {}): WizardState => ({ ...defaultsFor(audience, [], TODAY), ...patch });

function draftOf(state: WizardState, unlocked: readonly (typeof ALL)[number][] = FREE, source: Catalog = CATALOG): CurriculumDraft {
  const params = toParams(state, unlocked);
  if (!params) throw new Error('params');
  return generateCurriculum(params, source);
}

const lessonIds = (items: readonly CurriculumItem[]): string[] => items.filter((i) => i.kind === 'quest' && itemCategory(i.kind, i.id) === 'lesson').map((i) => i.id);

describe('lastLessonWeek: the last week of a draft that holds a lesson', () => {
  it('is the week of the last scheduled lesson quest; stories and coming-soon episodes do not count', () => {
    const draft = draftOf(stateFor('class', { length: '12-week' }));
    const weeks = draft.items.filter((i) => i.kind === 'quest' && itemCategory(i.kind, i.id) === 'lesson').map((i) => i.week);
    expect(lastLessonWeek(draft.items)).toBe(Math.max(...weeks));
    // The coming-soon episodes of later stages sit after the last lesson: they never extend it.
    expect(draft.items.some((i) => i.kind === 'episode' && i.week > Math.max(...weeks))).toBe(true);
  });

  it('is null when the draft holds no lesson', () => {
    expect(lastLessonWeek([])).toBeNull();
    const story: CurriculumItem = { kind: 'quest', id: CATALOG.quests.find((q) => q.kind === 'story')?.id ?? 'quest:story', week: 3 };
    const comingSoon: CurriculumItem = { kind: 'episode', id: 'episode:stage3-letters', week: 4 };
    expect(lastLessonWeek([story, comingSoon])).toBeNull();
    // An unlicensed space whose starting point is past Stage 1 has nothing open to schedule.
    expect(lastLessonWeek(draftOf(stateFor('class', { length: '12-week', start: 'first-words' })).items)).toBeNull();
  });

  it('reads the catalogue it is given', () => {
    const noLessons: Catalog = { ...CATALOG, quests: CATALOG.quests.filter((q) => q.kind !== 'lesson') };
    const items = draftOf(stateFor('class', { length: '4-week' })).items;
    expect(lastLessonWeek(items)).not.toBeNull();
    expect(lastLessonWeek(items, noLessons)).toBeNull();
  });
});

describe('freeDaysView: only for an unlicensed space with the switch on', () => {
  it('is null with the switch off (the wizard keeps its wording) and for a covered space', () => {
    const state = stateFor('class', { length: '12-week' });
    expect(freeDaysView(draftOf(state), FREE, false)).toBeNull();
    expect(freeDaysView(draftOf(state, ALL), ALL, true)).toBeNull();
    expect(freeDaysView(draftOf(state, ALL), ALL, false)).toBeNull();
  });

  it('names the space kind for the product, from the draft', () => {
    expect(freeDaysView(draftOf(stateFor('class', { length: '12-week' })), FREE, true)?.kind).toBe('class');
    expect(freeDaysView(draftOf(stateFor('family', { length: '12-week' })), FREE, true)?.kind).toBe('family');
  });

  it('a free class at 2 sessions a week for 12 weeks: lessons end early and no shorter preset holds them all (section 3.17)', () => {
    const draft = draftOf(stateFor('class', { length: '12-week' }));
    const view = freeDaysView(draft, FREE, true);
    expect(view).toEqual({ kind: 'class', lastWeek: lastLessonWeek(draft.items), short: true, shorter: null });
    // 4 weeks at 2 sessions hold fewer lessons than the free plan has.
    const fourWeeks = draftOf(stateFor('class', { length: '4-week' }));
    expect(lessonIds(fourWeeks.items).length).toBeLessThan(lessonIds(draft.items).length);
  });

  it('a free family at 3 sessions a week for 12 weeks: 4 weeks hold every lesson, so it is offered', () => {
    const state = stateFor('family', { length: '12-week' });
    const draft = draftOf(state);
    const view = freeDaysView(draft, FREE, true);
    expect(view?.short).toBe(true);
    expect(view?.shorter).toEqual({ length: '4-week', weeks: 4 });
    // What the page re-runs with that preset really holds every lesson of the long plan.
    const rerun = draftOf({ ...state, length: '4-week' });
    expect(new Set(lessonIds(rerun.items))).toEqual(new Set(lessonIds(draft.items)));
  });

  it('offers the shortest preset that holds every lesson, never a longer one or the same length', () => {
    expect(freeDaysView(draftOf(stateFor('family', { length: '6-month' })), FREE, true)?.shorter).toEqual({ length: '4-week', weeks: 4 });
    expect(freeDaysView(draftOf(stateFor('family', { length: 'custom', customWeeks: 10 })), FREE, true)?.shorter).toEqual({ length: '4-week', weeks: 4 });
    // 12 weeks hold the class's lessons when 4 weeks do not.
    expect(freeDaysView(draftOf(stateFor('class', { length: '6-month' })), FREE, true)?.shorter).toEqual({ length: '12-week', weeks: LENGTH_PRESETS['12-week'].weeks });
  });

  it('has no short-plan line when the lessons reach the last week', () => {
    const view = freeDaysView(draftOf(stateFor('family', { length: '4-week' })), FREE, true);
    expect(view).toMatchObject({ kind: 'family', short: false, shorter: null });
    expect(view?.lastWeek).toBe(4);
    const tiny = freeDaysView(draftOf(stateFor('family', { length: 'custom', customWeeks: 3 })), FREE, true);
    expect(tiny).toMatchObject({ lastWeek: 3, short: false, shorter: null });
  });

  it('keeps the warning without a short-plan line when nothing open is scheduled', () => {
    const view = freeDaysView(draftOf(stateFor('class', { length: '12-week', start: 'first-words' })), FREE, true);
    expect(view).toEqual({ kind: 'class', lastWeek: null, short: false, shorter: null });
  });

  it('never changes the generator input (OD-1: no openQuestIds)', () => {
    const state = stateFor('family', { length: '12-week' });
    const params = toParams(state, FREE);
    expect(params).not.toHaveProperty('openQuestIds');
    const draft = draftOf(state);
    const before = JSON.stringify(draft);
    freeDaysView(draft, FREE, true);
    expect(JSON.stringify(draft)).toBe(before);
  });
});

describe('the left-out warning with the switch on (section 3.9.3)', () => {
  const free = m.curriculum.freeDays;

  it('names the product by space kind and the weeks that hold lessons', () => {
    const warning = { code: 'premium-needed', count: 3 } as const;
    expect(warningText(warning, 'en', { kind: 'class', lastWeek: 7 })).toBe(
      'The free plan covers Stage 1 (lessons in weeks 1 to 7). 3 more lessons open with a Group License. They are left out of this plan.',
    );
    expect(warningText(warning, 'en', { kind: 'family', lastWeek: 5 })).toBe(
      'The free plan covers Stage 1 (lessons in weeks 1 to 5). 3 more lessons open with the Family Plan. They are left out of this plan.',
    );
    expect(warningText({ code: 'premium-needed', count: 1 }, 'en', { kind: 'family', lastWeek: 1 })).toBe(
      'The free plan covers Stage 1 (lessons in week 1). 1 more lesson opens with the Family Plan. It is left out of this plan.',
    );
    expect(warningText(warning, 'en', { kind: 'class', lastWeek: 7 })).toBe(free.warning(7, 3, m.access.product.class));
  });

  it('still states the left-out count when nothing open is scheduled', () => {
    expect(warningText({ code: 'premium-needed', count: 14 }, 'en', { kind: 'class', lastWeek: null })).toBe(
      'The free plan covers Stage 1. 14 more lessons open with a Group License. They are left out of this plan.',
    );
    expect(warningText({ code: 'premium-needed' }, 'en', { kind: 'family', lastWeek: null })).toBe(free.warningNoLessons(0, m.access.product.family));
  });

  it('keeps the existing wording with the switch off, and leaves every other warning as it was', () => {
    expect(warningText({ code: 'premium-needed', count: 3 }, 'en')).toBe(m.curriculum.preview.warnings.premium(3));
    expect(warningText({ code: 'premium-needed', count: 3 }, 'en', null)).toBe(m.curriculum.preview.warnings.premium(3));
    const context = { kind: 'class', lastWeek: 7 } as const;
    expect(warningText({ code: 'content-runs-out', week: 11 }, 'en', context)).toBe(m.curriculum.preview.warnings.contentRunsOut(11));
    expect(warningText({ code: 'coming-soon-included', week: 7, count: 5 }, 'en', context)).toBe(m.curriculum.preview.warnings.comingSoon(5));
    expect(warningText({ code: 'fewer-sessions-than-units', count: 3 }, 'en', context)).toBe(m.curriculum.preview.warnings.didNotFit(3));
  });

  it('section 3.17: a free class previews a 12-week plan at 2 sessions a week on today\'s catalogue', () => {
    const draft = draftOf(stateFor('class', { length: '12-week' }));
    const view = freeDaysView(draft, FREE, true);
    if (!view) throw new Error('view');
    const texts = draft.warnings.filter((w) => w.code === 'premium-needed').map((w) => warningText(w, 'en', view));
    // Today: 11 Stage 1 lessons end in week 7; stage2-life, stage2-nature and stage4-rites are left out.
    // When Stage 1 grows (F-QUEST-002 Q-8) these figures move: check F-ENT-003 section 3.17.
    expect(texts).toEqual(['The free plan covers Stage 1 (lessons in weeks 1 to 7). 3 more lessons open with a Group License. They are left out of this plan.']);
    expect(free.shortPlan(view.lastWeek ?? 0)).toBe('This plan has lessons until week 7. After that it has stories and practice.');
    expect(view.shorter).toBeNull();
  });

  it('keeps every free-plan text calm: no banned word, no price, no "day", no Premium', () => {
    const texts = [
      warningText({ code: 'premium-needed', count: 3 }, 'en', { kind: 'class', lastWeek: 7 }),
      warningText({ code: 'premium-needed', count: 1 }, 'en', { kind: 'family', lastWeek: null }),
      free.shortPlan(7),
      free.useWeeks.cta(4),
      m.access.openBilling.cta,
    ];
    for (const text of texts) {
      expect(findBannedWord(text, 'en', 'learner'), text).toBeNull();
      expect(findBannedWord(text, 'en', 'caregiver'), text).toBeNull();
      expect(text).not.toMatch(/\bdays?\b|premium|trial|expire|\$|€|£|price/i);
    }
  });
});
