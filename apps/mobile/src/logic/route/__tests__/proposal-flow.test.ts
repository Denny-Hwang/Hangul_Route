import {
  CATALOG,
  PACES,
  generateCurriculum,
  proposeRoute,
  type DurationOption,
  type PlacementResult,
  type RouteProposal,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  PICK_DAYS_AHEAD,
  PLAN_PROMPT_HIDE_DAYS,
  choiceChanged,
  createdEvent,
  daysReady,
  defaultDaysFor,
  firstWeekRows,
  initialChoice,
  moreLessonsComing,
  newestResultAt,
  paramsOfChoice,
  planPromptEligible,
  planPromptHidden,
  previewLineOf,
  profileRowOpens,
  proposalInputOf,
  proposalSkippedEvent,
  proposedEvent,
  safePropose,
  startDaysOf,
  startPickOf,
  toggleDay,
  weeksOfChoice,
  withPace,
  type PlanChoice,
  type PlanPromptInput,
} from '../proposal-flow';

const NOW = Date.parse('2026-10-12T09:00:00.000Z');
const DAY = 86_400_000;
const TODAY = '2026-10-12';

const prompt = (over: Partial<PlanPromptInput> = {}): PlanPromptInput => ({
  enabled: true,
  learnerType: 'self',
  hasPlan: false,
  questsDone: 1,
  newestResultAt: undefined,
  dismissedAt: undefined,
  nowMs: NOW,
  ...over,
});

function result(over: Partial<PlacementResult> = {}): PlacementResult {
  return {
    id: 'placement:a',
    completedAt: '2026-10-10T09:00:00.000Z',
    mode: 'standard',
    bankVersion: 1,
    testLocale: 'en',
    source: 'home',
    level: { stage: 'stage1', band: 0 },
    oralStage: null,
    strands: {},
    priorityTokens: [],
    placedOutQuestIds: [],
    startQuestId: 'quest:stage1-letters-q1',
    responses: [],
    ...over,
  } as unknown as PlacementResult;
}

const freshProposal = (): RouteProposal =>
  safePropose(
    proposalInputOf({ placements: undefined, completedQuestIds: [], ageGroup: '8-9', unlockedStages: ['stage1'], today: TODAY }),
  ) as RouteProposal;

describe('the Home plan prompt (F-PLC-001 AM-6, OD-16)', () => {
  it('shows for a self profile with no plan after one finished quest', () => {
    expect(planPromptEligible(prompt())).toBe(true);
  });

  it('shows after a placement result with no finished quest', () => {
    expect(planPromptEligible(prompt({ questsDone: 0, newestResultAt: '2026-10-11T00:00:00.000Z' }))).toBe(true);
  });

  it('waits for a finished quest or a result', () => {
    expect(planPromptEligible(prompt({ questsDone: 0 }))).toBe(false);
  });

  it('stays hidden with the flag off, for a child profile, or when a plan exists', () => {
    expect(planPromptEligible(prompt({ enabled: false }))).toBe(false);
    expect(planPromptEligible(prompt({ learnerType: 'child' }))).toBe(false);
    expect(planPromptEligible(prompt({ hasPlan: true }))).toBe(false);
  });

  it('hides for 14 days after Not now, then comes back', () => {
    const dismissedAt = new Date(NOW - 3 * DAY).toISOString();
    expect(planPromptEligible(prompt({ dismissedAt }))).toBe(false);
    const old = new Date(NOW - PLAN_PROMPT_HIDE_DAYS * DAY).toISOString();
    expect(planPromptEligible(prompt({ dismissedAt: old }))).toBe(true);
  });

  it('comes back at once with a placement result newer than the dismissal', () => {
    const dismissedAt = new Date(NOW - 3 * DAY).toISOString();
    expect(planPromptHidden(dismissedAt, new Date(NOW - 4 * DAY).toISOString(), NOW)).toBe(true);
    expect(planPromptHidden(dismissedAt, new Date(NOW - DAY).toISOString(), NOW)).toBe(false);
  });

  it('reads an empty or unreadable dismissal as not dismissed', () => {
    expect(planPromptHidden(undefined, undefined, NOW)).toBe(false);
    expect(planPromptHidden('', undefined, NOW)).toBe(false);
    expect(planPromptHidden('not a date', undefined, NOW)).toBe(false);
  });

  it('names the newest result time, or undefined without one', () => {
    expect(newestResultAt(undefined)).toBeUndefined();
    expect(newestResultAt([])).toBeUndefined();
    const times = [result({ completedAt: '2026-10-01T00:00:00.000Z' }), result({ id: 'placement:b', completedAt: '2026-10-09T00:00:00.000Z' })];
    expect(newestResultAt(times)).toBe('2026-10-09T00:00:00.000Z');
  });
});

describe('the Profile row (F-PLAN-002 section 3.9)', () => {
  it('opens the proposal directly for a self profile, even on a gated device', () => {
    expect(profileRowOpens({ learnerType: 'self', opensDirectly: false })).toBe('proposal');
  });

  it('asks a child profile for the grown-up gate only when the gate is needed', () => {
    expect(profileRowOpens({ learnerType: 'child', opensDirectly: false })).toBe('gate');
    expect(profileRowOpens({ learnerType: 'child', opensDirectly: true })).toBe('proposal');
  });
});

describe('the proposal input (section 3.1a, F-PLC-001 AM-4)', () => {
  it('without a level check: no seed, the D1 level, the tier and the real completions', () => {
    const input = proposalInputOf({
      placements: undefined,
      completedQuestIds: ['quest:stage1-letters-q1'],
      ageGroup: '5-7',
      unlockedStages: ['stage1'],
      today: TODAY,
    });
    expect(input).toMatchObject({ audience: 'self', seed: null, levelOrder: 0, unlockedStages: ['stage1'], today: TODAY, completedQuestIds: ['quest:stage1-letters-q1'] });
    expect(input.catalog).toBe(CATALOG);
    expect(input.pace).toBeUndefined();
    expect(input.startDate).toBeUndefined();
  });

  it('with a level check: the effective route with the completions, plus a chosen pace and start day', () => {
    const input = proposalInputOf({
      placements: [result({ level: { stage: 'stage1', band: 2 } })],
      completedQuestIds: [],
      ageGroup: '8-9',
      unlockedStages: ['stage1'],
      today: TODAY,
      pace: 'brisk',
      startDate: '2026-10-13',
    });
    expect(input.seed?.level).toEqual({ stage: 'stage1', band: 2 });
    expect(input).toMatchObject({ pace: 'brisk', startDate: '2026-10-13' });
  });

  it('reads a stage the tier lacks as not entitled', () => {
    const input = proposalInputOf({
      placements: [result({ level: { stage: 'stage2', band: 0 } })],
      completedQuestIds: [],
      ageGroup: '8-9',
      unlockedStages: ['stage1'],
      today: TODAY,
    });
    expect(input.seed?.needsStage).toBe('stage2');
  });

  it('safePropose returns the proposal, and null when the input breaks a cap', () => {
    expect(freshProposal().kind).toBe('new');
    const tooMany = proposalInputOf({
      placements: undefined,
      completedQuestIds: Array.from({ length: 401 }, (_, i) => `quest:x${i}`),
      ageGroup: '8-9',
      unlockedStages: ['stage1'],
      today: TODAY,
    });
    expect(safePropose(tooMany)).toBeNull();
  });
});

describe('the learner choice', () => {
  it('starts from the proposal: its pace, the suggested length, its start day, the spread days and its minutes', () => {
    const proposal = freshProposal();
    const choice = initialChoice(proposal);
    expect(choice).toEqual({
      pace: proposal.pace,
      length: proposal.defaultId,
      customWeeks: proposal.options.find((o) => o.id === proposal.defaultId)?.weeks,
      startDate: TODAY,
      days: null,
      minutes: proposal.params.minutesPerSession,
    });
    expect(choiceChanged(choice, choice)).toBe(false);
  });

  it('falls back to Steady when a proposal has no chip', () => {
    expect(initialChoice({ ...freshProposal(), pace: null }).pace).toBe('steady');
  });

  it('weeks: a preset or the custom count', () => {
    const choice = initialChoice(freshProposal());
    expect(weeksOfChoice({ ...choice, length: '12-week' })).toBe(12);
    expect(weeksOfChoice({ ...choice, length: '6-month' })).toBe(26);
    expect(weeksOfChoice({ ...choice, length: 'custom', customWeeks: 9 })).toBe(9);
  });

  it('the spread days of a pace from the start day (the generator\'s own days)', () => {
    expect(defaultDaysFor('2026-10-12', 'steady')).toEqual(['mon', 'wed', 'sat']);
    expect(defaultDaysFor('2026-10-12', 'gentle')).toEqual(['mon', 'fri']);
    const proposal = freshProposal();
    const draft = generateCurriculum(paramsOfChoice(proposal, { ...initialChoice(proposal), pace: 'brisk' }), CATALOG);
    const generated = firstWeekRows(draft).map((row) => new Date(`${row.date}T00:00:00Z`).getUTCDay());
    expect(defaultDaysFor(TODAY, 'brisk').map((d) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(d))).toEqual(generated);
  });

  it('toggles days from the spread days and keeps the week order', () => {
    const choice = initialChoice(freshProposal());
    const off = toggleDay({ ...choice, pace: 'steady', startDate: '2026-10-12' }, 'wed');
    expect(off.days).toEqual(['mon', 'sat']);
    expect(daysReady(off)).toBe(false);
    const on = toggleDay(off, 'tue');
    expect(on.days).toEqual(['mon', 'tue', 'sat']);
    expect(daysReady(on)).toBe(true);
    expect(daysReady({ ...on, days: null })).toBe(true);
  });

  it('a new pace resets the chosen days', () => {
    const choice: PlanChoice = { ...initialChoice(freshProposal()), days: ['mon', 'tue', 'sat'] };
    expect(withPace(choice, 'brisk')).toEqual({ ...choice, pace: 'brisk', days: null });
  });

  it('the params of a choice: the proposal with the length, start, pace, days and minutes picked', () => {
    const proposal = freshProposal();
    const choice: PlanChoice = { pace: 'brisk', length: 'custom', customWeeks: 6, startDate: '2026-10-14', days: ['mon', 'tue', 'thu', 'sat'], minutes: 20 };
    const params = paramsOfChoice(proposal, choice);
    expect(params).toMatchObject({ weeks: 6, startDate: '2026-10-14', sessionsPerWeek: PACES.brisk, minutesPerSession: 20, sessionDays: ['mon', 'tue', 'thu', 'sat'] });
    expect(paramsOfChoice(proposal, { ...choice, days: null }).sessionDays).toBeUndefined();
    expect(paramsOfChoice(proposal, { ...choice, days: null }).level).toEqual(proposal.params.level);
  });

  it('counts any change from the proposal as changed', () => {
    const base = initialChoice(freshProposal());
    expect(choiceChanged(base, { ...base, pace: 'brisk' })).toBe(true);
    expect(choiceChanged(base, { ...base, length: '6-month' })).toBe(true);
    expect(choiceChanged(base, { ...base, startDate: '2026-10-13' })).toBe(true);
    expect(choiceChanged(base, { ...base, minutes: 30 })).toBe(true);
    expect(choiceChanged(base, { ...base, days: defaultDaysFor(base.startDate, base.pace) })).toBe(false);
    expect(choiceChanged(base, { ...base, days: ['sun'] })).toBe(true);
    const custom = { ...base, length: 'custom' as const, customWeeks: weeksOfChoice(base) };
    expect(choiceChanged(base, custom)).toBe(false);
  });
});

describe('start days (AMENDMENTS section 1.4, OD-15)', () => {
  it('today, tomorrow, and the days after them to pick from', () => {
    const days = startDaysOf(TODAY);
    expect(days.today).toBe(TODAY);
    expect(days.tomorrow).toBe('2026-10-13');
    expect(days.later).toHaveLength(PICK_DAYS_AHEAD);
    expect(days.later[0]).toBe('2026-10-14');
  });

  it('which chip a start day belongs to', () => {
    expect(startPickOf(TODAY, TODAY)).toBe('today');
    expect(startPickOf('2026-10-13', TODAY)).toBe('tomorrow');
    expect(startPickOf('2026-10-20', TODAY)).toBe('pick');
  });
});

describe('the cards and the first week', () => {
  const option = (over: Partial<DurationOption>): DurationOption => ({
    id: '4-week',
    weeks: 4,
    stats: { lessons: 5, stories: 0, comingSoonItems: 0, openSessions: 0, endsAtStage: 'stage1' },
    lastLessonWeek: 3,
    lastContentWeek: 3,
    preview: 'lessons-then-free-practice',
    warnings: [],
    ...over,
  });

  it('words each preview code with its numbers, never a finish the card does not reach', () => {
    expect(previewLineOf(option({ preview: 'lessons-and-stories', lastLessonWeek: 7, stats: { lessons: 5, stories: 3, comingSoonItems: 0, openSessions: 0, endsAtStage: 'stage1' } }))).toEqual({ code: 'lessons-and-stories', stage: 1, week: 7 });
    expect(previewLineOf(option({ preview: 'lessons-cut-short', lastLessonWeek: 9 }))).toEqual({ code: 'lessons-cut-short', weeks: 4 });
    expect(previewLineOf(option({}))).toEqual({ code: 'lessons-then-free-practice', weeks: 3 });
    expect(previewLineOf(option({ lastContentWeek: 4 }))).toEqual({ code: 'lessons-fill', weeks: 4 });
    expect(previewLineOf(option({ preview: 'stories-and-words', stats: { lessons: 0, stories: 4, comingSoonItems: 0, openSessions: 0, endsAtStage: 'stage2' } }))).toEqual({ code: 'stories-and-words', stories: 4 });
  });

  it('says "More lessons are coming" for locked and unreleased parts, never the warning itself', () => {
    expect(moreLessonsComing(option({ warnings: ['premium-needed'] }))).toBe(true);
    expect(moreLessonsComing(option({ warnings: ['coming-soon-included'] }))).toBe(true);
    expect(moreLessonsComing(option({ warnings: ['content-runs-out'] }))).toBe(false);
  });

  it('the first week of a draft in date order', () => {
    const proposal = freshProposal();
    const draft = generateCurriculum(paramsOfChoice(proposal, initialChoice(proposal)), CATALOG);
    const rows = firstWeekRows(draft);
    expect(rows.length).toBe(PACES[proposal.pace ?? 'steady']);
    expect(rows.every((row) => row.date >= TODAY && row.date < '2026-10-19')).toBe(true);
    expect([...rows].sort((a, b) => a.date.localeCompare(b.date))).toEqual(rows);
    expect(rows[0]).toEqual({ date: TODAY, kind: 'quest', id: expect.stringMatching(/^quest:/) });
  });
});

describe('telemetry (section 3.11, FP-B7): codes and counts only', () => {
  it('route.proposed with the pace, or without it off the chips', () => {
    const proposal = freshProposal();
    const event = proposedEvent('profile:a', 'home', proposal);
    expect(event).toEqual({
      name: 'route.proposed',
      profileId: 'profile:a',
      payload: { source: 'home', kind: 'new', defaultWeeks: proposal.options.find((o) => o.id === proposal.defaultId)?.weeks, pace: proposal.pace },
    });
    expect(proposedEvent('profile:a', 'profile', { ...proposal, pace: null }).payload).not.toHaveProperty('pace');
  });

  it('route.proposed reads an update as an update', () => {
    expect(proposedEvent('profile:a', 'placement', { ...freshProposal(), kind: 'update' }).payload.kind).toBe('update');
  });

  it('route.proposal_skipped with the source only', () => {
    expect(proposalSkippedEvent('profile:a', 'profile')).toEqual({ name: 'route.proposal_skipped', profileId: 'profile:a', payload: { source: 'profile' } });
  });

  it('route.created with the plan shape, where it came from and whether the learner changed it', () => {
    const proposal = freshProposal();
    const draft = generateCurriculum(paramsOfChoice(proposal, initialChoice(proposal)), CATALOG);
    expect(createdEvent('profile:a', draft, 'proposal', false)).toEqual({
      name: 'route.created',
      profileId: 'profile:a',
      payload: {
        audience: 'self',
        weeks: draft.params.weeks,
        sessionsPerWeek: draft.params.sessionsPerWeek,
        focus: draft.params.goals.focus,
        startStage: 'stage1',
        from: 'proposal',
        changed: false,
      },
    });
    const days = generateCurriculum({ ...draft.params, sessionDays: ['mon', 'tue'] }, CATALOG);
    expect(createdEvent('profile:a', days, 'proposal', true).payload).toMatchObject({ sessionsPerWeek: 2, changed: true });
  });

  it('agrees with proposeRoute itself (the same function the console calls)', () => {
    const input = proposalInputOf({ placements: undefined, completedQuestIds: [], ageGroup: '8-9', unlockedStages: ['stage1'], today: TODAY });
    expect(safePropose(input)).toEqual(proposeRoute(input));
  });
});
