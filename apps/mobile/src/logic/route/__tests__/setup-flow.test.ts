import { CATALOG, CurriculumParamsSchema, PACES, generateCurriculum, toMeta } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { initialChoice, proposalInputOf, safePropose, type PlanChoice } from '../proposal-flow';
import {
  MAX_THEMES,
  SETUP_STEPS,
  STARTING_LEVELS,
  STARTING_POINT_IDS,
  THEMES,
  routesAfterStart,
  setupBasisOf,
  setupFromChoice,
  setupFromStored,
  setupParams,
  startingPointOf,
  stepReady,
  toggleTheme,
  tooManyItems,
  type SetupContext,
  type SetupState,
} from '../setup-flow';
import { selfRouteOf } from '../self-route';

const TODAY = '2026-10-12';
const proposal = safePropose(proposalInputOf({ placements: undefined, completedQuestIds: [], ageGroup: '8-9', unlockedStages: ['stage1'], today: TODAY }))!;
const ctx: SetupContext = { completedQuestIds: ['quest:stage1-letters-q1'], unlockedStages: ['stage1'], level: null };
const state = (over: Partial<SetupState> = {}): SetupState => ({ ...setupFromChoice(initialChoice(proposal), proposal.params), ...over });

describe('setup steps (F-PLAN-002 section 3.9, wireframe G1)', () => {
  it('four steps in the wireframe order', () => {
    expect(SETUP_STEPS).toEqual(['start', 'time', 'length', 'likes']);
  });

  it('six starting cards with the console wizard levels', () => {
    expect(STARTING_POINT_IDS).toHaveLength(6);
    expect(STARTING_LEVELS['brand-new']).toEqual({ stage: 'stage1', band: 0 });
    expect(STARTING_LEVELS['first-sentences']).toEqual({ stage: 'stage3', band: 0 });
  });

  it('the card nearest to a level; no level check reads as Brand new', () => {
    expect(startingPointOf(null)).toBe('brand-new');
    expect(startingPointOf(undefined)).toBe('brand-new');
    expect(startingPointOf({ stage: 'stage1', band: 2 })).toBe('all-letters');
    expect(startingPointOf({ stage: 'stage1', band: 3 })).toBe('reads-words');
    expect(startingPointOf({ stage: 'stage2', band: 1 })).toBe('first-words');
    expect(startingPointOf({ stage: 'stage4', band: 0 })).toBe('first-sentences');
  });

  it('prefilled from the proposal: its choice, start and goals', () => {
    const choice: PlanChoice = { ...initialChoice(proposal), pace: 'brisk' };
    const params = { ...proposal.params, goals: { focus: 'culture' as const, themes: ['rites' as const] } };
    expect(setupFromChoice(choice, params)).toEqual({ ...choice, start: 'brand-new', focus: 'culture', themes: ['rites'] });
    expect(setupFromChoice(choice, proposal.params).themes).toEqual([]);
  });

  it('prefilled from a stored plan from today: rhythm, length, minutes, days and goals', () => {
    const draft = generateCurriculum(
      {
        audience: 'self',
        level: { stage: 'stage1', band: 1 },
        startDate: '2026-09-01',
        weeks: 12,
        sessionsPerWeek: 2,
        sessionDays: ['tue', 'thu'],
        minutesPerSession: 20,
        goals: { focus: 'words', themes: ['nature'] },
        unlockedStages: ['stage1'],
      },
      CATALOG,
    );
    const stored = toMeta(draft).params;
    expect(setupFromStored(stored, TODAY)).toEqual({
      pace: 'gentle',
      length: '12-week',
      customWeeks: 12,
      startDate: TODAY,
      days: ['tue', 'thu'],
      minutes: 20,
      start: 'some-letters',
      focus: 'words',
      themes: ['nature'],
    });
    const odd = setupFromStored({ ...stored, weeks: 9, sessionsPerWeek: 5, sessionDays: undefined, minutesPerSession: 25 as 15, goals: { focus: 'balanced' } }, TODAY);
    expect(odd).toMatchObject({ pace: 'steady', length: 'custom', customWeeks: 9, days: null, minutes: 15, themes: [] });
    const mismatch = setupFromStored({ ...stored, sessionsPerWeek: 3, sessionDays: ['mon', 'wed', 'fri', 'sat', 'sun'] }, TODAY);
    expect(mismatch.days).toBeNull();
  });

  it('only the time step can wait: for as many days as the pace', () => {
    const s = state({ pace: 'steady', days: ['mon'] });
    expect(stepReady('time', s)).toBe(false);
    expect(stepReady('time', { ...s, days: ['mon', 'wed', 'fri'] })).toBe(true);
    expect(stepReady('start', s)).toBe(true);
    expect(stepReady('length', s)).toBe(true);
    expect(stepReady('likes', s)).toBe(true);
  });

  it('themes in the order tapped, at most five, a second tap takes one out', () => {
    let s = state();
    s = toggleTheme(s, 'nature');
    s = toggleTheme(s, 'life');
    expect(s.themes).toEqual(['nature', 'life']);
    expect(toggleTheme(s, 'nature').themes).toEqual(['life']);
    for (const theme of THEMES) if (!s.themes.includes(theme)) s = toggleTheme(s, theme);
    expect(s.themes).toHaveLength(MAX_THEMES);
    // The cap holds even for a list that is already full (five entries, one repeated, from an older copy).
    const full = state({ themes: ['life', 'rites', 'nature', 'crafts', 'life'] });
    expect(toggleTheme(full, 'letters')).toBe(full);
  });

  it('the params of the answers parse and carry every answer', () => {
    const s = state({ start: 'all-letters', pace: 'gentle', length: 'custom', customWeeks: 7, days: ['mon', 'thu'], minutes: 10, focus: 'reading', themes: ['crafts'] });
    const params = CurriculumParamsSchema.parse(setupParams({ ...ctx, motivation: 'heritage' }, s));
    expect(params).toMatchObject({
      audience: 'self',
      level: { stage: 'stage1', band: 2 },
      completedQuestIds: ['quest:stage1-letters-q1'],
      weeks: 7,
      sessionsPerWeek: PACES.gentle,
      sessionDays: ['mon', 'thu'],
      minutesPerSession: 10,
      goals: { focus: 'reading', themes: ['crafts'], motivation: 'heritage' },
      unlockedStages: ['stage1'],
    });
    expect(params.placedOutQuestIds).toBeUndefined();
    const plain = setupParams(ctx, state({ days: null, themes: [] }));
    expect(plain.sessionDays).toBeUndefined();
    expect(plain.goals).toEqual({ focus: state().focus });
  });

  it('the level check\'s own card keeps its exact level and placed-out set; another card plans from its level', () => {
    const checked: SetupContext = { ...ctx, level: { stage: 'stage2', band: 1 }, placedOutQuestIds: ['quest:a'] };
    expect(setupParams(checked, state({ start: 'first-words' }))).toMatchObject({ level: { stage: 'stage2', band: 1 }, placedOutQuestIds: ['quest:a'] });
    const other = setupParams(checked, state({ start: 'brand-new' }));
    expect(other.level).toEqual({ stage: 'stage1', band: 0 });
    expect(other.placedOutQuestIds).toBeUndefined();
    expect(setupParams({ ...ctx, level: { stage: 'stage1', band: 0 } }, state({ start: 'brand-new' })).placedOutQuestIds).toBeUndefined();
  });
});

describe('what the set-up steps start from (section 3.9: the proposal or the plan in force)', () => {
  const stored = selfRouteOf(
    generateCurriculum(
      {
        audience: 'self',
        level: { stage: 'stage2', band: 1 },
        placedOutQuestIds: ['quest:stage1-letters-q1'],
        startDate: '2026-09-01',
        weeks: 26,
        sessionsPerWeek: 4,
        minutesPerSession: 10,
        goals: { focus: 'culture', motivation: 'kculture' },
        unlockedStages: ['stage1'],
      },
      CATALOG,
    ),
    'route:r-0001',
    '2026-09-01T08:00:00.000Z',
  );

  it('the plan in force wins: its level, placed-out set and motivation, with today\'s tier and completions', () => {
    const basis = setupBasisOf({ active: stored, proposal, completedQuestIds: ['quest:x'], unlockedStages: ['stage1', 'stage2'], today: TODAY });
    expect(basis?.ctx).toEqual({
      completedQuestIds: ['quest:x'],
      unlockedStages: ['stage1', 'stage2'],
      level: { stage: 'stage2', band: 1 },
      placedOutQuestIds: ['quest:stage1-letters-q1'],
      motivation: 'kculture',
    });
    expect(basis?.state).toMatchObject({ pace: 'brisk', length: '6-month', minutes: 10, start: 'first-words', focus: 'culture', startDate: TODAY });
  });

  it('without a plan: the proposal\'s params, and the choice made on it when one is passed', () => {
    const basis = setupBasisOf({ active: null, proposal, completedQuestIds: [], unlockedStages: ['stage1'], today: TODAY });
    expect(basis?.ctx).toEqual({ completedQuestIds: [], unlockedStages: ['stage1'], level: proposal.params.level });
    expect(basis?.state).toEqual(setupFromChoice(initialChoice(proposal), proposal.params));
    const choice: PlanChoice = { ...initialChoice(proposal), pace: 'gentle', minutes: 5 };
    expect(setupBasisOf({ active: null, proposal, choice, completedQuestIds: [], unlockedStages: ['stage1'], today: TODAY })?.state).toMatchObject({ pace: 'gentle', minutes: 5 });
    const placed = { ...proposal, params: { ...proposal.params, placedOutQuestIds: ['quest:a'], goals: { focus: 'balanced' as const, motivation: 'heritage' as const } } };
    expect(setupBasisOf({ active: null, proposal: placed, completedQuestIds: [], unlockedStages: ['stage1'], today: TODAY })?.ctx).toMatchObject({ placedOutQuestIds: ['quest:a'], motivation: 'heritage' });
  });

  it('nothing to start from: null', () => {
    expect(setupBasisOf({ active: null, proposal: null, completedQuestIds: [], unlockedStages: ['stage1'], today: TODAY })).toBeNull();
  });

  it('more items than a plan holds stops the length step (section 3.11)', () => {
    expect(tooManyItems(state({ pace: 'brisk', length: '6-month' }))).toBe(false);
    expect(tooManyItems(state({ pace: 'brisk', length: 'custom', customWeeks: 52 }))).toBe(false);
    expect(tooManyItems({ ...state({ length: 'custom', customWeeks: 52 }), days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri'] })).toBe(true);
    expect(stepReady('length', { ...state({ length: 'custom', customWeeks: 52 }), days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri'] })).toBe(false);
  });
});

describe('leaving the plan screens after Start this plan', () => {
  it('drops the proposal, set-up and preview screens and ends on the overview', () => {
    const routes = [{ name: 'Main' }, { name: 'Profile' }, { name: 'RouteProposal' }, { name: 'RouteSetup' }, { name: 'RoutePreview' }];
    expect(routesAfterStart(routes, { name: 'RouteOverview' })).toEqual([{ name: 'Main' }, { name: 'Profile' }, { name: 'RouteOverview' }]);
    expect(routesAfterStart([{ name: 'Main' }, { name: 'RouteOverview' }, { name: 'RouteSetup' }, { name: 'RoutePreview' }], { name: 'RouteOverview' })).toEqual([
      { name: 'Main' },
      { name: 'RouteOverview' },
    ]);
  });
});
