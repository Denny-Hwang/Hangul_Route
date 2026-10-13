import { CATALOG, PACES, generateCurriculum, type HomeworkAssignment, type SelfRoute } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  AUTO_REPACE_OLDEST_DAYS,
  AUTO_REPACE_PENDING,
  CHECK_IN_WEEK,
  applyCheckIn,
  autoRepaceDue,
  checkInFits,
  checkInOffer,
  pendingPastOf,
  repaceSelfRoute,
  repacedEvent,
  retainedOfferStep,
  type RetainedOffer,
} from '../repace';
import { selfRouteOf } from '../self-route';

const START = '2026-09-07'; // a Monday; week 5 starts 2026-10-05
function routeAt(sessionsPerWeek: number, weeks = 12): SelfRoute {
  const draft = generateCurriculum(
    { audience: 'self', level: { stage: 'stage1', band: 0 }, startDate: START, weeks, sessionsPerWeek, minutesPerSession: 15, unlockedStages: ['stage1'] },
    CATALOG,
  );
  return selfRouteOf(draft, 'route:r-0001', `${START}T08:00:00.000Z`);
}
/** `applyCheckIn` for a plan it fits; a null answer fails the test. */
function applied(...args: Parameters<typeof applyCheckIn>): SelfRoute {
  const next = applyCheckIn(...args);
  if (next === null) throw new Error('the check-in did not fit');
  return next;
}
const hw = (route: SelfRoute, questId: string, targetDate: string, completedAt?: string): HomeworkAssignment => ({
  id: `${route.id}#${questId}`,
  profileId: 'p',
  questId,
  episodeId: 'episode:stage1-letters',
  assignedBy: 'system',
  assignedAt: `${START}T08:00:00.000Z`,
  targetDate,
  ...(completedAt === undefined ? {} : { completedAt }),
});

describe('automatic re-pace (section 3.7)', () => {
  const route = routeAt(3);
  const today = '2026-09-20';

  it('counts pending past-dated items of this plan only', () => {
    const list = [hw(route, 'q1', '2026-09-14'), hw(route, 'q2', '2026-09-20'), hw(route, 'q3', '2026-09-15', 'done'), { ...hw(route, 'q4', '2026-09-14'), id: 'plan:x#q4' }];
    expect(pendingPastOf(route, list, today).map((h) => h.questId)).toEqual(['q1']);
  });

  it('runs with three pending past items, or the oldest a week old', () => {
    const three = [hw(route, 'q1', '2026-09-17'), hw(route, 'q2', '2026-09-18'), hw(route, 'q3', '2026-09-19')];
    expect(autoRepaceDue({ route, homework: three, today, sessionOpen: false })).toBe(true);
    expect(autoRepaceDue({ route, homework: three.slice(0, AUTO_REPACE_PENDING - 1), today, sessionOpen: false })).toBe(false);
    const old = [hw(route, 'q1', '2026-09-13')];
    expect(AUTO_REPACE_OLDEST_DAYS).toBe(7);
    expect(autoRepaceDue({ route, homework: old, today, sessionOpen: false })).toBe(true);
    expect(autoRepaceDue({ route, homework: [hw(route, 'q1', '2026-09-14'), hw(route, 'q2', '2026-09-16')], today, sessionOpen: false })).toBe(false);
    expect(autoRepaceDue({ route, homework: [], today, sessionOpen: false })).toBe(false);
  });

  it('never once the plan\'s last week is over: nothing is left to move along', () => {
    const short = routeAt(3, 4); // weeks 1 to 4: 2026-09-07 to 2026-10-04
    const waiting = [hw(short, 'q1', '2026-09-29'), hw(short, 'q2', '2026-09-30'), hw(short, 'q3', '2026-10-01')];
    expect(autoRepaceDue({ route: short, homework: waiting, today: '2026-10-04', sessionOpen: false })).toBe(true);
    expect(autoRepaceDue({ route: short, homework: waiting, today: '2026-10-05', sessionOpen: false })).toBe(false);
    expect(autoRepaceDue({ route: short, homework: waiting, today: '2026-11-20', sessionOpen: false })).toBe(false);
  });

  it('never with no plan, a stopped plan, an open session, or a second time the same day', () => {
    const three = [hw(route, 'q1', '2026-09-17'), hw(route, 'q2', '2026-09-18'), hw(route, 'q3', '2026-09-19')];
    expect(autoRepaceDue({ route: null, homework: three, today, sessionOpen: false })).toBe(false);
    expect(autoRepaceDue({ route: { ...route, archivedAt: 'x' }, homework: three, today, sessionOpen: false })).toBe(false);
    expect(autoRepaceDue({ route, homework: three, today, sessionOpen: true })).toBe(false);
    const repacedToday = { ...route, meta: { ...route.meta, repacedAt: `${today}T06:00:00.000Z` } };
    expect(autoRepaceDue({ route: repacedToday, homework: three, today, sessionOpen: false })).toBe(false);
    const repacedBefore = { ...route, meta: { ...route.meta, repacedAt: '2026-09-19T06:00:00.000Z' } };
    expect(autoRepaceDue({ route: repacedBefore, homework: three, today, sessionOpen: false })).toBe(true);
  });

  it('re-paces with requeue: same id and start, past finished items stay, unfinished ones come back from today', () => {
    const first = route.items[0]!;
    const next = repaceSelfRoute(route, [first.id], today, CATALOG, `${today}T09:00:00.000Z`);
    expect(next).toMatchObject({ id: route.id, createdAt: route.createdAt, archivedAt: null, updatedAt: `${today}T09:00:00.000Z` });
    expect(next.meta.repacedAt).toBe(`${today}T09:00:00.000Z`);
    expect(next.meta.weeks[0]?.startDate).toBe(START);
    expect(next.items.find((i) => i.id === first.id)?.targetDate).toBe(first.targetDate);
    const unfinished = route.items[1]!;
    expect((next.items.find((i) => i.id === unfinished.id)?.targetDate ?? '') >= today).toBe(true);
    expect(next.meta.params).not.toHaveProperty('completedQuestIds');
  });

  it('route.repaced carries the mode and the count', () => {
    expect(repacedEvent('p', 'auto', 4)).toEqual({ name: 'route.repaced', profileId: 'p', payload: { mode: 'auto', pending: 4 } });
  });
});

describe('the Hoya check-in (FP-B14, OD-13)', () => {
  const week5 = '2026-10-06';
  const sessionsBefore = (route: SelfRoute): string[] =>
    route.items.filter((i) => i.kind === 'quest' && (i.targetDate ?? '') < '2026-10-05').map((i) => i.id);

  it('opens in week 5 only, once per plan', () => {
    const route = routeAt(3);
    const done = sessionsBefore(route);
    expect(CHECK_IN_WEEK).toBe(5);
    expect(checkInOffer({ route, completedQuestIds: done, today: week5, answeredFor: undefined })).toEqual({ kind: 'faster', pace: 'brisk' });
    expect(checkInOffer({ route, completedQuestIds: done, today: '2026-10-04', answeredFor: undefined })).toBeNull();
    expect(checkInOffer({ route, completedQuestIds: done, today: '2026-10-12', answeredFor: undefined })).toBeNull();
    expect(checkInOffer({ route, completedQuestIds: done, today: week5, answeredFor: route.id })).toBeNull();
    expect(checkInOffer({ route: null, completedQuestIds: done, today: week5, answeredFor: undefined })).toBeNull();
    expect(checkInOffer({ route: { ...route, archivedAt: 'x' }, completedQuestIds: done, today: week5, answeredFor: undefined })).toBeNull();
  });

  it('fewer than half finished offers a lighter week (Gentle); between half and all, nothing', () => {
    const route = routeAt(3);
    const all = sessionsBefore(route);
    expect(checkInOffer({ route, completedQuestIds: all.slice(0, 2), today: week5, answeredFor: undefined })).toEqual({ kind: 'lighter', pace: 'gentle' });
    expect(checkInOffer({ route, completedQuestIds: all.slice(0, Math.ceil(all.length / 2)), today: week5, answeredFor: undefined })).toBeNull();
  });

  it('no lighter offer below Gentle and no faster offer past Brisk; a plan off the chips gets none', () => {
    const gentle = routeAt(2);
    expect(checkInOffer({ route: gentle, completedQuestIds: [], today: week5, answeredFor: undefined })).toBeNull();
    expect(checkInOffer({ route: gentle, completedQuestIds: sessionsBefore(gentle), today: week5, answeredFor: undefined })).toEqual({ kind: 'faster', pace: 'steady' });
    const brisk = routeAt(4);
    expect(checkInOffer({ route: brisk, completedQuestIds: sessionsBefore(brisk), today: week5, answeredFor: undefined })).toBeNull();
    const five = routeAt(5);
    expect(checkInOffer({ route: five, completedQuestIds: [], today: week5, answeredFor: undefined })).toBeNull();
  });

  it('a plan without a week 5, or with no session in weeks 1 to 4, gets none', () => {
    const short = routeAt(3, 4);
    expect(checkInOffer({ route: short, completedQuestIds: [], today: week5, answeredFor: undefined })).toBeNull();
    const route = routeAt(3);
    const empty = { ...route, items: route.items.filter((i) => (i.targetDate ?? '') >= '2026-10-05') };
    expect(checkInOffer({ route: empty, completedQuestIds: [], today: week5, answeredFor: undefined })).toBeNull();
  });

  it('after a re-pace moved unfinished items forward, the weeks before it still count their sessions', () => {
    const route = routeAt(3);
    // Nothing done by the third week: Hoya moved the plan along; weeks 1 and 2 now hold no items.
    const moved = repaceSelfRoute(route, [], '2026-09-23', CATALOG, '2026-09-23T06:00:00.000Z');
    expect(moved.items.filter((i) => (i.targetDate ?? '') < '2026-09-21')).toHaveLength(0);
    expect(checkInOffer({ route: moved, completedQuestIds: [], today: week5, answeredFor: undefined })).toEqual({ kind: 'lighter', pace: 'gentle' });
    // Finishing only what was laid out after the re-pace is not every session of weeks 1 to 4.
    const after = moved.items.filter((i) => i.kind === 'quest' && (i.targetDate ?? '') < '2026-10-05').map((i) => i.id);
    expect(after.length).toBeGreaterThan(0);
    expect(checkInOffer({ route: moved, completedQuestIds: after, today: week5, answeredFor: undefined })?.kind).not.toBe('faster');
  });

  it('a moved-out culture week counts its sessions; a week that held no lesson or story does not', () => {
    const route = routeAt(3);
    const weeks = route.meta.weeks.map((w) =>
      w.index === 1
        ? { ...w, kind: 'culture' as const, focus: { ...w.focus, episodeId: null, storyIds: ['quest:story'] } }
        : w.index === 2
          ? { ...w, focus: { ...w.focus, episodeId: null, storyIds: [] } }
          : w,
    );
    const shaped = { ...route, meta: { ...route.meta, weeks, repacedAt: '2026-10-05T06:00:00.000Z' }, items: route.items.filter((i) => (i.targetDate ?? '') >= '2026-09-21') };
    // Week 1 counts 3 (moved out), week 2 counts its items (none now), weeks 3 and 4 count theirs; all of those done is not every session.
    const doneLater = shaped.items.filter((i) => i.kind === 'quest' && (i.targetDate ?? '') < '2026-10-05').map((i) => i.id);
    expect(checkInOffer({ route: shaped, completedQuestIds: doneLater, today: week5, answeredFor: undefined })).toBeNull();
  });

  it('a lighter pace adds the weeks the plan needs, so yes never drops a lesson off the tail', () => {
    const route = routeAt(4, 12);
    const future = route.items.filter((i) => (i.targetDate ?? '') >= week5).map((i) => i.id);
    const next = applied(route, { kind: 'lighter', pace: 'gentle' }, [], week5, CATALOG, `${week5}T09:00:00.000Z`);
    expect(next.meta.params.weeks).toBeGreaterThan(12);
    expect(next.meta.weeks.length).toBe(next.meta.params.weeks);
    const kept = new Set(next.items.map((i) => i.id));
    for (const id of future) expect(kept.has(id), id).toBe(true);
    // A faster pace has room already: the length stays.
    expect(applied(routeAt(3, 12), { kind: 'faster', pace: 'brisk' }, [], week5, CATALOG, `${week5}T09:00:00.000Z`).meta.params.weeks).toBe(12);
  });

  it('never grows a plan past what a plan can hold, and never drops a lesson there: that check-in is not offered', () => {
    const full = routeAt(4, 52);
    const lighter = { kind: 'lighter', pace: 'gentle' } as const;
    // A 52-week plan whose lessons all wait in its last four weeks: Gentle has 8 sessions there and no week can be added.
    const lastWeeks = full.meta.weeks[48]?.startDate ?? '';
    const crowded: SelfRoute = { ...full, items: full.items.map((i) => ({ ...i, targetDate: lastWeeks })) };
    expect(applyCheckIn(crowded, lighter, [], lastWeeks, CATALOG, `${lastWeeks}T09:00:00.000Z`)).toBeNull();
    expect(checkInFits(crowded, lighter, [], lastWeeks, CATALOG)).toBe(false);
    expect(applied(full, lighter, [], week5, CATALOG, `${week5}T09:00:00.000Z`).meta.params.weeks).toBe(52);
    // A plan with room left fits.
    expect(checkInFits(routeAt(4, 12), lighter, [], week5, CATALOG)).toBe(true);
    expect(checkInFits(routeAt(3, 12), { kind: 'faster', pace: 'brisk' }, [], week5, CATALOG)).toBe(true);
  });

  it('yes lays the plan\'s own future items on the new pace from today; past items stay', () => {
    const route = routeAt(3);
    const done = sessionsBefore(route).slice(0, 2);
    const next = applied(route, { kind: 'lighter', pace: 'gentle' }, done, week5, CATALOG, `${week5}T09:00:00.000Z`);
    expect(next.id).toBe(route.id);
    expect(next.meta.params.sessionsPerWeek).toBe(PACES.gentle);
    // Chosen weekdays are spread again for the new number of sessions (section 3.7).
    expect(next.meta.params.sessionDays).toBeUndefined();
    expect(next.meta.repacedAt).toBe(`${week5}T09:00:00.000Z`);
    const past = route.items.filter((i) => (i.targetDate ?? '') < week5);
    for (const item of past) expect(next.items.find((i) => i.id === item.id && i.targetDate === item.targetDate)).toBeDefined();
    const nextWeek = next.items.filter((i) => (i.targetDate ?? '') >= '2026-10-12' && (i.targetDate ?? '') < '2026-10-19');
    expect(nextWeek.length).toBeLessThanOrEqual(PACES.gentle);
  });
});

describe('retainedOfferStep: the check-in a screen keeps showing, per learner and plan', () => {
  const lighter = { kind: 'lighter', pace: 'gentle' } as const;
  const faster = { kind: 'faster', pace: 'brisk' } as const;
  const start: RetainedOffer = { key: 'profile:a|route:1', shown: null, closed: false };

  it('keeps the first offer it saw and lets it go only on close', () => {
    const shown = retainedOfferStep(start, lighter, 'profile:a|route:1');
    expect(shown).toEqual({ key: 'profile:a|route:1', shown: lighter, closed: false });
    // Answered: the computed offer turns null, the card stays to say what changed.
    expect(retainedOfferStep(shown, null, 'profile:a|route:1')).toBe(shown);
    const closed = { ...shown, shown: null, closed: true };
    expect(retainedOfferStep(closed, lighter, 'profile:a|route:1')).toBe(closed);
    expect(retainedOfferStep(closed, null, 'profile:a|route:1')).toEqual({ key: 'profile:a|route:1', shown: null, closed: false });
  });

  it('another learner or another plan drops the kept offer and takes the new one as it is', () => {
    const shown = retainedOfferStep(start, lighter, 'profile:a|route:1');
    expect(retainedOfferStep(shown, null, 'profile:b|route:2')).toEqual({ key: 'profile:b|route:2', shown: null, closed: false });
    expect(retainedOfferStep(shown, faster, 'profile:b|route:2')).toEqual({ key: 'profile:b|route:2', shown: faster, closed: false });
    expect(retainedOfferStep({ ...shown, shown: null, closed: true }, faster, 'profile:a|route:9')).toEqual({ key: 'profile:a|route:9', shown: faster, closed: false });
  });
});
