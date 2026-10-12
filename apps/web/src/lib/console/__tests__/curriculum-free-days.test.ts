import { CATALOG, LENGTH_PRESETS, StageKeySchema, generateCurriculum, type Catalog, type CurriculumDraft, type CurriculumItem, type Entitlement, type LengthPresetId } from '@hangul-route/content-schema';
import { findBannedWord, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { itemCategory } from '@/data/catalog';
// The frozen October 2026 catalogue (Stage 1 complete, every story ready): pinned figures stay true while the live catalogue grows.
import { CATALOG_2026_10 } from '@hangul-route/content-schema/testing/catalog-2026-10';
import { defaultsFor, freeDaysView, leftOutNeutral, lessonWeeks, spaceCoverage, toParams, warningText, type WizardState } from '../curriculum';

/**
 * F-ENT-003 section 3.9.3 (E3-9; wireframe console/curriculum-free-days): for a space this viewer
 * knows is uncovered, with the console's free-plan switch on, the wizard's left-out warning names
 * the product by space kind and the weeks that hold lessons, and a plan that runs longer than its
 * lessons says so, with a shorter length preset when one holds every lesson. The generator is not
 * touched (OD-1): an unlicensed space already plans Stage 1 only.
 */
const TODAY = '2026-10-18'; // a Sunday
const ALL = [...StageKeySchema.options];
const FREE = ['stage1'] as const;
const FROZEN = CATALOG_2026_10;
const m = getMessages('en').console;

const stateFor = (audience: 'class' | 'family', patch: Partial<WizardState> = {}): WizardState => ({ ...defaultsFor(audience, [], TODAY), ...patch });

function draftOf(state: WizardState, source: Catalog = CATALOG, unlocked: readonly (typeof ALL)[number][] = FREE): CurriculumDraft {
  const params = toParams(state, unlocked);
  if (!params) throw new Error('params');
  return generateCurriculum(params, source);
}

const lessonIds = (items: readonly CurriculumItem[], source: Catalog): string[] => items.filter((i) => i.kind === 'quest' && itemCategory(i.kind, i.id, source) === 'lesson').map((i) => i.id);
const view = (draft: CurriculumDraft, source: Catalog = CATALOG) => freeDaysView(draft, 'uncovered', true, source);

describe('lessonWeeks: the weeks of a draft that hold a lesson', () => {
  it('spans the first to the last scheduled lesson quest; stories and coming-soon episodes do not count', () => {
    const draft = draftOf(stateFor('class', { length: '12-week' }));
    const weeks = draft.items.filter((i) => i.kind === 'quest' && itemCategory(i.kind, i.id) === 'lesson').map((i) => i.week);
    expect(lessonWeeks(draft.items)).toEqual({ first: Math.min(...weeks), last: Math.max(...weeks) });
  });

  it('is null when the draft holds no lesson', () => {
    expect(lessonWeeks([])).toBeNull();
    const story: CurriculumItem = { kind: 'quest', id: CATALOG.quests.find((q) => q.kind === 'story')?.id ?? 'quest:story', week: 3 };
    const comingSoon: CurriculumItem = { kind: 'episode', id: 'episode:stage3-letters', week: 4 };
    expect(lessonWeeks([story, comingSoon])).toBeNull();
    // An unlicensed space whose starting point is past Stage 1 has nothing open to schedule.
    expect(lessonWeeks(draftOf(stateFor('class', { length: '12-week', start: 'first-words' })).items)).toBeNull();
  });

  it('starts after week 1 when days off open the plan', () => {
    const draft = draftOf(stateFor('family', { length: '12-week', daysOff: [{ from: '2026-10-18', to: '2026-11-07' }] }), FROZEN);
    expect(lessonWeeks(draft.items, FROZEN)).toEqual({ first: 4, last: 10 });
  });
});

describe('spaceCoverage: only an owner who can see every entitlement that could cover the space hears "uncovered"', () => {
  const ent = (subjectId: string, patch: Partial<Entitlement> = {}): Entitlement => ({
    id: 'ent:a',
    subjectKind: 'space',
    subjectId,
    planKey: 'group_license',
    status: 'active',
    provider: 'stripe',
    providerRef: null,
    customerRef: null,
    seats: null,
    expiresAt: '2027-10-01T00:00:00.000Z',
    promoCode: null,
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...patch,
  });
  const now = new Date('2026-10-18T12:00:00Z');
  const member = (id: string, role: 'owner' | 'teacher' | 'caregiver') => ({ space: { id }, role });
  const own = { id: 'space:c', parentSpaceId: null };
  const inSchool = { id: 'space:c', parentSpaceId: 'space:school' };

  it('is covered when an active entitlement of the space or its school is visible, whoever looks', () => {
    expect(spaceCoverage([ent('space:c')], [member('space:c', 'teacher')], own, now)).toBe('covered');
    expect(spaceCoverage([ent('space:school')], null, inSchool, now)).toBe('covered');
  });

  it('is uncovered for the owner of a space with no school, or of a class whose school they own too', () => {
    expect(spaceCoverage([], [member('space:c', 'owner')], own, now)).toBe('uncovered');
    expect(spaceCoverage([ent('space:c', { status: 'expired' })], [member('space:c', 'owner')], own, now)).toBe('uncovered');
    expect(spaceCoverage([], [member('space:c', 'owner'), member('space:school', 'owner')], inSchool, now)).toBe('uncovered');
  });

  it('is unknown for a co-teacher or a co-caregiver, a class in a school someone else owns, or a failed read', () => {
    expect(spaceCoverage([], [member('space:c', 'teacher')], own, now)).toBe('unknown');
    expect(spaceCoverage([], [member('space:c', 'caregiver')], own, now)).toBe('unknown');
    expect(spaceCoverage([], [member('space:c', 'owner')], inSchool, now)).toBe('unknown');
    expect(spaceCoverage([], [member('space:c', 'owner'), member('space:school', 'teacher')], inSchool, now)).toBe('unknown');
    expect(spaceCoverage(null, [member('space:c', 'owner')], own, now)).toBe('unknown');
    expect(spaceCoverage([], null, own, now)).toBe('unknown');
    expect(spaceCoverage([], [member('space:other', 'owner')], own, now)).toBe('unknown');
  });
});

describe('freeDaysView: only with the switch on, for a space the viewer knows is uncovered', () => {
  it('is null with the switch off and for a covered or unknown space (the wizard keeps its wording)', () => {
    const draft = draftOf(stateFor('class', { length: '12-week' }));
    expect(freeDaysView(draft, 'uncovered', false)).toBeNull();
    expect(freeDaysView(draft, 'covered', true)).toBeNull();
    expect(freeDaysView(draft, 'unknown', true)).toBeNull();
    expect(freeDaysView(draft, 'uncovered', true)).not.toBeNull();
  });

  it('names the space kind for the product, from the draft', () => {
    expect(view(draftOf(stateFor('class', { length: '12-week' })))?.kind).toBe('class');
    expect(view(draftOf(stateFor('family', { length: '12-week' })))?.kind).toBe('family');
  });

  it('a free class at 2 sessions a week for 12 weeks: lessons end in week 11, stories follow, no shorter preset holds them all', () => {
    const draft = draftOf(stateFor('class', { length: '12-week' }), FROZEN);
    expect(view(draft, FROZEN)).toMatchObject({ kind: 'class', firstWeek: 1, lastWeek: 11, short: true, storiesAfter: true, shorter: null });
    expect(lessonIds(draftOf(stateFor('class', { length: '4-week' }), FROZEN).items, FROZEN).length).toBeLessThan(lessonIds(draft.items, FROZEN).length);
  });

  it('offers the shortest preset shorter than the plan that holds every lesson', () => {
    const state = stateFor('class', { length: '6-month' });
    const draft = draftOf(state, FROZEN);
    expect(view(draft, FROZEN)?.shorter).toEqual({ length: '12-week', weeks: LENGTH_PRESETS['12-week'].weeks });
    // What the page re-runs with that preset really holds every lesson of the long plan.
    expect(new Set(lessonIds(draftOf({ ...state, length: '12-week' }, FROZEN).items, FROZEN))).toEqual(new Set(lessonIds(draft.items, FROZEN)));
    expect(view(draftOf(stateFor('family', { length: '6-month' }), FROZEN), FROZEN)?.shorter).toEqual({ length: '12-week', weeks: 12 });
    // 4 weeks at 3 sessions hold fewer than the 15 free lessons, and 12 weeks is not shorter than 10.
    expect(view(draftOf(stateFor('family', { length: 'custom', customWeeks: 10 }), FROZEN), FROZEN)?.shorter).toBeNull();
  });

  it('on the live catalogue, a suggested preset always holds every lesson and a missing one never could', () => {
    for (const audience of ['class', 'family'] as const) {
      for (const length of ['12-week', '6-month'] as const) {
        const state = stateFor(audience, { length });
        const draft = draftOf(state);
        const result = view(draft);
        const lessons = new Set(lessonIds(draft.items, CATALOG));
        const holds = (preset: LengthPresetId): boolean => lessonIds(draftOf({ ...state, length: preset }).items, CATALOG).length >= lessons.size;
        const shorter = (['4-week', '12-week'] as const).filter((p) => LENGTH_PRESETS[p].weeks < LENGTH_PRESETS[length].weeks);
        if (result?.shorter) {
          expect(new Set(lessonIds(draftOf({ ...state, length: result.shorter.length }).items, CATALOG)), `${audience} ${length}`).toEqual(lessons);
          expect(shorter.find(holds)).toBe(result.shorter.length);
        } else expect(shorter.some(holds), `${audience} ${length}`).toBe(false);
      }
    }
  });

  it('has no short-plan line when the lessons reach the last week', () => {
    expect(view(draftOf(stateFor('family', { length: '4-week' }), FROZEN), FROZEN)).toMatchObject({ kind: 'family', lastWeek: 4, short: false, storiesAfter: false, shorter: null });
    expect(view(draftOf(stateFor('family', { length: 'custom', customWeeks: 3 })))).toMatchObject({ lastWeek: 3, short: false, shorter: null });
  });

  it('tells stories from practice after the last lesson week', () => {
    for (const source of [CATALOG, FROZEN]) {
      const draft = draftOf(stateFor('class', { length: '12-week' }), source);
      const result = view(draft, source);
      const last = result?.lastWeek ?? 0;
      expect(result?.storiesAfter).toBe(draft.items.some((i) => i.week > last && itemCategory(i.kind, i.id, source) === 'story'));
    }
    const noStories: Catalog = { ...FROZEN, stories: [], quests: FROZEN.quests.filter((q) => q.kind !== 'story') };
    expect(view(draftOf(stateFor('class', { length: '12-week' }), noStories), noStories)).toMatchObject({ short: true, storiesAfter: false });
  });

  it('keeps the warning without a short-plan line when nothing open is scheduled', () => {
    expect(view(draftOf(stateFor('class', { length: '12-week', start: 'first-words' })))).toMatchObject({
      kind: 'class',
      firstWeek: null,
      lastWeek: null,
      short: false,
      storiesAfter: false,
      shorter: null,
      soonAfter: false,
    });
  });

  it('never changes the generator input (OD-1: no openQuestIds)', () => {
    const state = stateFor('family', { length: '12-week' });
    expect(toParams(state, FREE)).not.toHaveProperty('openQuestIds');
    const draft = draftOf(state);
    const before = JSON.stringify(draft);
    view(draft);
    expect(JSON.stringify(draft)).toBe(before);
  });
});

describe('coming-soon episodes past Stage 1 with the switch on (review 2026-10-12)', () => {
  const soonStage = (source: Catalog, id: string): string | undefined => source.cells.find((cell) => cell.episodeId === id)?.stage;
  const soon = (draft: CurriculumDraft, source: Catalog) => draft.items.filter((i) => itemCategory(i.kind, i.id, source) === 'coming-soon');

  it('counts the coming-soon episodes of the draft whose cell is past Stage 1', () => {
    for (const source of [CATALOG, FROZEN]) {
      for (const audience of ['class', 'family'] as const) {
        const draft = draftOf(stateFor(audience, { length: '6-month' }), source);
        const closed = soon(draft, source).filter((i) => soonStage(source, i.id) !== 'stage1').length;
        expect(view(draft, source)?.comingSoonClosed, `${audience}`).toBe(closed);
      }
    }
    // The frozen catalogue has coming-soon cells only past Stage 1: every placeholder the 6-month plan holds is one.
    const draft = draftOf(stateFor('class', { length: '6-month' }), FROZEN);
    expect(soon(draft, FROZEN).length).toBeGreaterThan(0);
    expect(view(draft, FROZEN)?.comingSoonClosed).toBe(soon(draft, FROZEN).length);
  });

  it('a Stage 1 coming-soon episode is not closed', () => {
    const stage1Soon: Catalog = { ...FROZEN, cells: FROZEN.cells.map((cell) => (cell.stage === 'stage1' && cell.theme === 'letters' ? { ...cell, status: 'draft' as const } : cell)) };
    const id = stage1Soon.cells.find((cell) => cell.stage === 'stage1' && cell.theme === 'letters')?.episodeId ?? '';
    const draft = { ...draftOf(stateFor('class', { length: '6-month' }), FROZEN) };
    const withStage1 = { ...draft, items: [...draft.items, { kind: 'episode' as const, id, week: 2 }] };
    const closedBefore = view(draft, stage1Soon)?.comingSoonClosed ?? 0;
    expect(view(withStage1, stage1Soon)?.comingSoonClosed).toBe(closedBefore);
  });

  it('says they open with the product once released, not on their dates; Stage 1-only coming-soon keeps the old line', () => {
    const warning = { code: 'coming-soon-included', week: 7, count: 5 } as const;
    expect(warningText(warning, 'en', { kind: 'class', firstWeek: 1, lastWeek: 7, comingSoonClosed: 5 })).toBe(
      '5 episodes are not released yet. They are past Stage 1 and open with a Group License once they are released.',
    );
    expect(warningText(warning, 'en', { kind: 'family', firstWeek: 1, lastWeek: 7, comingSoonClosed: 2 })).toBe(
      '5 episodes are not released yet. 2 of them are past Stage 1 and open with the Family Plan once released. The others start on their dates once they are released.',
    );
    expect(warningText({ code: 'coming-soon-included', week: 3, count: 1 }, 'en', { kind: 'family', firstWeek: 1, lastWeek: 7, comingSoonClosed: 1 })).toBe(
      '1 episode is not released yet. It is past Stage 1 and opens with the Family Plan once it is released.',
    );
    expect(warningText(warning, 'en', { kind: 'class', firstWeek: 1, lastWeek: 7, comingSoonClosed: 0 })).toBe(m.curriculum.preview.warnings.comingSoon(5));
    expect(warningText(warning, 'en')).toBe(m.curriculum.preview.warnings.comingSoon(5));
  });

  it('the short-plan view says when coming-soon episodes sit after the last lesson week', () => {
    for (const source of [CATALOG, FROZEN]) {
      const draft = draftOf(stateFor('class', { length: '6-month' }), source);
      const result = view(draft, source);
      const last = result?.lastWeek ?? 0;
      expect(result?.soonAfter).toBe(Boolean(result?.short) && draft.items.some((i) => i.week > last && itemCategory(i.kind, i.id, source) === 'coming-soon'));
    }
    const off = draftOf(stateFor('class', { length: '6-month', includeComingSoon: false }), FROZEN);
    expect(view(off, FROZEN)).toMatchObject({ comingSoonClosed: 0, soonAfter: false });
  });
});

describe('leftOutNeutral: the switch is on and this viewer cannot tell the coverage', () => {
  it('is on only with the switch on and a coverage that is not "uncovered"', () => {
    expect(leftOutNeutral('unknown', true)).toBe(true);
    expect(leftOutNeutral('covered', true)).toBe(true);
    expect(leftOutNeutral('uncovered', true)).toBe(false);
    for (const coverage of ['unknown', 'covered', 'uncovered'] as const) expect(leftOutNeutral(coverage, false)).toBe(false);
  });

  it('names both products and never Premium; the switch-off wording is unchanged', () => {
    expect(warningText({ code: 'premium-needed', count: 3 }, 'en', null, true)).toBe(
      '3 more lessons open with the Family Plan or a Group License. They are left out of this plan.',
    );
    expect(warningText({ code: 'premium-needed', count: 1 }, 'en', null, true)).toBe('1 more lesson opens with the Family Plan or a Group License. It is left out of this plan.');
    expect(warningText({ code: 'premium-needed', count: 3 }, 'en', null, false)).toBe(m.curriculum.preview.warnings.premium(3));
    expect(warningText({ code: 'coming-soon-included', week: 7, count: 5 }, 'en', null, true)).toBe(m.curriculum.preview.warnings.comingSoon(5));
  });
});

describe('the left-out warning with the switch on (section 3.9.3)', () => {
  const free = m.curriculum.freeDays;

  it('names the product by space kind and the weeks that hold lessons', () => {
    const warning = { code: 'premium-needed', count: 3 } as const;
    expect(warningText(warning, 'en', { kind: 'class', firstWeek: 1, lastWeek: 7 })).toBe(
      'The free plan covers Stage 1 (lessons in weeks 1 to 7). 3 more lessons open with a Group License. They are left out of this plan.',
    );
    expect(warningText(warning, 'en', { kind: 'family', firstWeek: 4, lastWeek: 10 })).toBe(
      'The free plan covers Stage 1 (lessons in weeks 4 to 10). 3 more lessons open with the Family Plan. They are left out of this plan.',
    );
    expect(warningText({ code: 'premium-needed', count: 1 }, 'en', { kind: 'family', firstWeek: 1, lastWeek: 1 })).toBe(
      'The free plan covers Stage 1 (lessons in week 1). 1 more lesson opens with the Family Plan. It is left out of this plan.',
    );
    expect(warningText(warning, 'en', { kind: 'class', firstWeek: 2, lastWeek: 7 })).toBe(free.warning(2, 7, 3, m.access.product.class));
  });

  it('still states the left-out count when nothing open is scheduled', () => {
    expect(warningText({ code: 'premium-needed', count: 14 }, 'en', { kind: 'class', firstWeek: null, lastWeek: null })).toBe(
      'The free plan covers Stage 1. 14 more lessons open with a Group License. They are left out of this plan.',
    );
    expect(warningText({ code: 'premium-needed' }, 'en', { kind: 'family', firstWeek: null, lastWeek: null })).toBe(free.warningNoLessons(0, m.access.product.family));
  });

  it('keeps the existing wording with the switch off, and leaves every other warning as it was', () => {
    expect(warningText({ code: 'premium-needed', count: 3 }, 'en')).toBe(m.curriculum.preview.warnings.premium(3));
    expect(warningText({ code: 'premium-needed', count: 3 }, 'en', null)).toBe(m.curriculum.preview.warnings.premium(3));
    const context = { kind: 'class', firstWeek: 1, lastWeek: 7 } as const;
    expect(warningText({ code: 'content-runs-out', week: 11 }, 'en', context)).toBe(m.curriculum.preview.warnings.contentRunsOut(11));
    expect(warningText({ code: 'coming-soon-included', week: 7, count: 5 }, 'en', context)).toBe(m.curriculum.preview.warnings.comingSoon(5));
    expect(warningText({ code: 'fewer-sessions-than-units', count: 3 }, 'en', context)).toBe(m.curriculum.preview.warnings.didNotFit(3));
  });

  it('section 3.17: a free class previews a 12-week plan at 2 sessions a week (frozen catalogue, Stage 1 complete)', () => {
    const draft = draftOf(stateFor('class', { length: '12-week' }), FROZEN);
    const result = view(draft, FROZEN);
    if (!result) throw new Error('view');
    expect(draft.warnings.filter((w) => w.code === 'premium-needed').map((w) => warningText(w, 'en', result))).toEqual([
      'The free plan covers Stage 1 (lessons in weeks 1 to 11). 3 more lessons open with a Group License. They are left out of this plan.',
    ]);
    expect(free.shortPlan(result.lastWeek ?? 0)).toBe('This plan has lessons until week 11. After that it has stories and practice.');
    expect(result.shorter).toBeNull();
  });

  it('keeps every free-plan text calm: no banned word, no price, no "day", no Premium', () => {
    const texts = [
      warningText({ code: 'premium-needed', count: 3 }, 'en', { kind: 'class', firstWeek: 1, lastWeek: 7 }),
      warningText({ code: 'premium-needed', count: 1 }, 'en', { kind: 'family', firstWeek: null, lastWeek: null }),
      free.shortPlan(7),
      free.shortPlanPractice(7),
      free.useWeeks.cta(4),
      free.shortPlanSoon,
      free.warningNeutral(3),
      free.comingSoon(5, 2, m.access.product.class),
      m.access.openBilling.cta,
    ];
    for (const text of texts) {
      expect(findBannedWord(text, 'en', 'learner'), text).toBeNull();
      expect(findBannedWord(text, 'en', 'caregiver'), text).toBeNull();
      expect(text).not.toMatch(/\bdays?\b|premium|trial|expire|\$|€|£|price/i);
    }
  });
});
