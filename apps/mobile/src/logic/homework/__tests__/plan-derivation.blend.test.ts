import type { Episode, HomeworkAssignment, InboxPlan, PlanItem, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { planDaysInForce } from '../../goals/plan-days';
import { layerOf, leadingBlended } from '../../route/layer';
import { planProgressOf } from '../../sync/summarize';
import {
  classScheduledQuestIds,
  deriveAssignments,
  hiddenHomeworkOf,
  nothingHidden,
  restingSourceIds,
  selfRouteResting,
  sourcesOf,
  visibleHomework,
  type DeriveInput,
} from '../plan-derivation';
import { blendedMeta, curriculumMeta, selfRoute } from './curriculum-fixture';

/**
 * AMENDMENTS-ROUTE-CLASS-BLEND sections 8, 9.4 and 12.2 (row BL-6): `fromClass`, the dedupe against class plans in
 * every layer, the own plan's rest and resume, and the reconcile cases (move, join mid-term, leave, two classes).
 * 2026-09-21 is a Monday; the blended class meets on Tuesdays from 2026-09-22 to the end of its cycle on 2026-10-19.
 */
const quest = (id: string): Quest => ({ id, titleEn: id, estimatedMinutes: 4, steps: [
  { id: 's1', kind: 'intro', titleEn: 'a', durationSeconds: 5 },
  { id: 's2', kind: 'present', titleEn: 'b', durationSeconds: 5 },
  { id: 's3', kind: 'reward', titleEn: 'c', durationSeconds: 5 },
] as Quest['steps'] });
const episodes: Episode[] = [
  { id: 'episode:s1', stage: 'stage1', theme: 'letters', order: 1, titleEn: 'E1', hoyaIntroEn: 'hi', questIds: ['quest:a', 'quest:b'], rewardCardIds: [], estimatedMinutes: 10, status: 'shipped' },
  { id: 'episode:s3', stage: 'stage1', theme: 'life', order: 3, titleEn: 'E3', hoyaIntroEn: 'hi', questIds: ['quest:d', 'quest:e'], rewardCardIds: [], estimatedMinutes: 10, status: 'shipped' },
];
const quests = ['quest:a', 'quest:b', 'quest:d', 'quest:e'].map(quest);
const snap = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({ profileId: 'profile:a', updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over });
const TODAY = '2026-09-23';
const base = { profileId: 'profile:a', quests, episodes, unlockedStages: ['stage1'], learnerName: 'Suni' };

/** A blended class plan: practice items with the class day that taught them. */
const blended = (over: Partial<InboxPlan> = {}): InboxPlan => ({
  id: 'plan:blend',
  spaceId: 'space:c',
  spaceKind: 'class',
  spaceName: 'A',
  title: 'Term',
  items: [
    { kind: 'quest', id: 'quest:a', targetDate: '2026-09-23', lectureDate: '2026-09-22', week: 1 },
    { kind: 'quest', id: 'quest:b', targetDate: '2026-09-25', lectureDate: '2026-09-22', week: 1 },
  ],
  publishedAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  meta: blendedMeta(),
  ...over,
});
/** A class plan with no practice days (the Class only layer). */
const classOnly = (over: Partial<InboxPlan> = {}): InboxPlan =>
  blended({ id: 'plan:class', items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-24', week: 1 }], meta: curriculumMeta(), ...over });
const family = (items: PlanItem[]): InboxPlan =>
  blended({ id: 'plan:family', spaceId: 'space:f', spaceKind: 'family', items, meta: curriculumMeta() });

const derive = (plans: InboxPlan[], snapshot: ProgressSnapshot, today = TODAY, over: Partial<DeriveInput> = {}) =>
  deriveAssignments({
    ...base,
    today,
    sources: sourcesOf(plans, snapshot.selfRoute, today),
    resting: restingSourceIds(plans, snapshot.selfRoute, today),
    snapshot,
    ...over,
  });
const ids = (homework: readonly HomeworkAssignment[]): string[] => homework.map((h) => h.id).sort();
const done = (questId: string) => ({ questId, episodeId: 'episode:s1', startedAt: 't', completedAt: '2026-09-22T10:00:00.000Z', stars: 3 as const, attempts: 1, accuracy: 1 });

describe('fromClass (section 9.4)', () => {
  it('an item with a lectureDate derives with fromClass; one without carries no key', () => {
    const plan = blended({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23', lectureDate: '2026-09-22' }, { kind: 'quest', id: 'quest:d', targetDate: '2026-09-24' }] });
    const result = derive([plan], snap());
    const byId = new Map(result.homework.map((h) => [h.id, h]));
    expect(byId.get('plan:blend#quest:a')).toMatchObject({ fromClass: true, assignedBy: 'teacher', targetDate: '2026-09-23' });
    expect(byId.get('plan:blend#quest:d')).not.toHaveProperty('fromClass');
  });

  it('follows the plan when a re-laid item gains or loses its lectureDate', () => {
    const first = derive([blended()], snap()).homework;
    const relaid = blended({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }, { kind: 'quest', id: 'quest:b', targetDate: '2026-09-25', lectureDate: '2026-09-22' }] });
    const lost = derive([relaid], snap({ homework: first }));
    expect(lost.changed).toBe(true);
    expect(lost.homework.find((h) => h.questId === 'quest:a')).not.toHaveProperty('fromClass');
    expect(lost.homework.find((h) => h.questId === 'quest:b')).toMatchObject({ fromClass: true });
    const back = derive([blended()], snap({ homework: lost.homework }));
    expect(back.homework.find((h) => h.questId === 'quest:a')).toMatchObject({ fromClass: true });
    // The same plan again changes nothing.
    expect(derive([blended()], snap({ homework: back.homework })).changed).toBe(false);
  });

  it('a finished assignment is never relabelled', () => {
    const finished: HomeworkAssignment = { id: 'plan:blend#quest:a', profileId: 'profile:a', questId: 'quest:a', episodeId: 'episode:s1', assignedBy: 'teacher', assignedAt: 't', targetDate: '2026-09-23', completedAt: 'x' };
    const result = derive([blended()], snap({ homework: [finished] }));
    expect(result.homework.find((h) => h.id === finished.id)).toEqual(finished);
  });
});

describe('the dedupe against class plans, in every layer (section 8)', () => {
  it('Class only: an own or family pending item whose quest the class curriculum schedules is skipped', () => {
    const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }, { kind: 'quest', id: 'quest:b', targetDate: '2026-09-23' }] });
    const plans = [classOnly(), family([{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }, { kind: 'quest', id: 'quest:d', targetDate: '2026-09-23' }])];
    expect(layerOf(sourcesOf(plans, null), TODAY)).toBe('class-only');
    const result = derive(plans, snap({ selfRoute: route }));
    expect(ids(result.homework)).toEqual(['plan:class#quest:a', 'plan:family#quest:d', 'route:mine#quest:b']);
    // A skipped item is not "not ready": the learner can open it, it is on the class plan.
    expect(result.notReady).toEqual({});
  });

  it('counts every quest the class curriculum schedules, past the horizon and through an episode item', () => {
    const plan = classOnly({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-10-15' }, { kind: 'episode', id: 'episode:s3', targetDate: '2026-10-16' }] });
    const sources = sourcesOf([plan], null);
    expect([...classScheduledQuestIds(sources, TODAY, episodes)].sort()).toEqual(['quest:a', 'quest:d', 'quest:e']);
    const route = selfRoute({ items: ['quest:a', 'quest:b', 'quest:d'].map((id) => ({ kind: 'quest' as const, id, targetDate: '2026-09-24' })) });
    expect(ids(derive([plan], snap({ selfRoute: route })).homework)).toEqual(['route:mine#quest:b']);
  });

  it('a classic class plan, an ended curriculum or a family plan never hide anything', () => {
    const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }] });
    expect(ids(derive([classOnly({ meta: null })], snap({ selfRoute: route })).homework)).toEqual(['plan:class#quest:a', 'route:mine#quest:a']);
    expect(classScheduledQuestIds(sourcesOf([classOnly()], null), '2026-10-30', episodes).size).toBe(0);
    const fam = family([{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }]);
    expect(ids(derive([fam], snap({ selfRoute: route })).homework)).toEqual(['plan:family#quest:a', 'route:mine#quest:a']);
  });

  it('a school curriculum hides them too', () => {
    const school = classOnly({ id: 'plan:school', spaceKind: 'school' });
    const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }] });
    expect(ids(derive([school], snap({ selfRoute: route })).homework)).toEqual(['plan:school#quest:a']);
  });

  it('the hidden item comes back when the class plan drops the quest; finished ones stay as they are', () => {
    const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }, { kind: 'quest', id: 'quest:b', targetDate: '2026-09-23' }] });
    const before = derive([], snap({ selfRoute: route })).homework;
    expect(ids(before)).toEqual(['route:mine#quest:a', 'route:mine#quest:b']);
    const finishedB = before.map((h) => (h.questId === 'quest:b' ? { ...h, completedAt: 'x' } : h));
    const classPlans = [classOnly({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-24' }, { kind: 'quest', id: 'quest:b', targetDate: '2026-09-24' }] })];
    const withClass = derive(classPlans, snap({ selfRoute: route, homework: finishedB }));
    // Hidden, never deleted: the pending own item stays in the snapshot exactly as it was.
    expect(ids(withClass.homework)).toEqual(['plan:class#quest:a', 'plan:class#quest:b', 'route:mine#quest:a', 'route:mine#quest:b']);
    expect(withClass.removed).toBe(0);
    expect(withClass.homework.find((h) => h.id === 'route:mine#quest:a')).toEqual(before.find((h) => h.id === 'route:mine#quest:a'));
    expect(withClass.homework.find((h) => h.id === 'route:mine#quest:b')?.completedAt).toBe('x');
    // Home, Homework and routeNext leave it out; the finished one still shows.
    const hidden = hiddenHomeworkOf(classPlans, route, TODAY, episodes);
    expect(ids(visibleHomework(withClass.homework, hidden))).toEqual(['plan:class#quest:a', 'plan:class#quest:b', 'route:mine#quest:b']);
    // The own plan still holds the item; it derives again when the class plan drops the quest.
    expect(route.items.map((i) => i.id)).toEqual(['quest:a', 'quest:b']);
    const dropped = derive([classOnly({ items: [{ kind: 'quest', id: 'quest:b', targetDate: '2026-09-24' }] })], snap({ selfRoute: route, homework: withClass.homework }));
    expect(ids(dropped.homework)).toEqual(['plan:class#quest:b', 'route:mine#quest:a', 'route:mine#quest:b']);
  });

  it('a family plan\'s pending item is kept while hidden, so its progress total in the summary does not shrink', () => {
    const fam = family([{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }, { kind: 'quest', id: 'quest:d', targetDate: '2026-09-23' }]);
    const first = derive([fam], snap()).homework;
    expect(planProgressOf(snap({ homework: first }))['plan:family']).toEqual({ done: 0, total: 2, notReady: 0 });
    const plans = [classOnly(), fam];
    const later = derive(plans, snap({ homework: first }));
    expect(later.removed).toBe(0);
    expect(planProgressOf(snap({ homework: later.homework }))['plan:family']).toEqual({ done: 0, total: 2, notReady: 0 });
    // The class item shows; only own and family plans yield.
    expect(ids(visibleHomework(later.homework, hiddenHomeworkOf(plans, null, TODAY, episodes)))).toEqual(['plan:class#quest:a', 'plan:family#quest:d']);
    expect(derive(plans, snap({ homework: later.homework })).changed).toBe(false);
  });

  it('a hidden pending item whose source left the inbox is removed as before', () => {
    const fam = family([{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }]);
    const first = derive([fam], snap()).homework;
    const left = derive([classOnly()], snap({ homework: first }));
    expect(ids(left.homework)).toEqual(['plan:class#quest:a']);
    expect(left.removed).toBe(1);
  });

  it('nothing is hidden with no class curriculum in force', () => {
    const fam = family([{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }]);
    const hidden = hiddenHomeworkOf([fam], null, TODAY, episodes);
    expect(nothingHidden(hidden)).toBe(true);
    expect(nothingHidden(hiddenHomeworkOf([classOnly(), fam], null, TODAY, episodes))).toBe(false);
  });

  it('Class with practice: a family plan keeps running (BL-OD-6) with the dedupe', () => {
    const plans = [blended(), family([{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-23' }, { kind: 'quest', id: 'quest:d', targetDate: '2026-09-23' }])];
    expect(layerOf(sourcesOf(plans, null), TODAY)).toBe('class-with-practice');
    expect(ids(derive(plans, snap()).homework)).toEqual(['plan:blend#quest:a', 'plan:blend#quest:b', 'plan:family#quest:d']);
  });
});

describe('the own weekly plan rests and resumes (section 8, BL-OD-5)', () => {
  const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:d', targetDate: '2026-09-21' }, { kind: 'quest', id: 'quest:e', targetDate: '2026-09-24' }] });
  const own = derive([], snap({ selfRoute: route }), '2026-09-21').homework;

  it('rests only while a class plan with practice days is in force; a pure check of the plans', () => {
    expect(selfRouteResting([blended()], route, TODAY)).toBe(true);
    expect(selfRouteResting([classOnly()], route, TODAY)).toBe(false);
    expect(selfRouteResting([blended()], route, '2026-09-21')).toBe(false);
    expect(selfRouteResting([blended()], route, '2026-10-20')).toBe(false);
    expect(selfRouteResting([blended()], { ...route, archivedAt: 'x' }, TODAY)).toBe(false);
    expect(selfRouteResting([blended()], null, TODAY)).toBe(false);
    expect(sourcesOf([blended()], route, TODAY).map((s) => s.id)).toEqual(['plan:blend']);
    // Without a day (pre-BL-6 callers and tests) the self-route is a source as before.
    expect(sourcesOf([blended()], route).map((s) => s.id)).toEqual(['plan:blend', 'route:mine']);
    expect(restingSourceIds([blended()], route, TODAY)).toEqual(['route:mine']);
    expect(restingSourceIds([classOnly()], route, TODAY)).toEqual([]);
  });

  it('while resting, its pending items stay in the snapshot untouched (not removed, never re-dated) and nothing new derives', () => {
    const moved = { ...route, items: [{ kind: 'quest' as const, id: 'quest:d', targetDate: '2026-09-25' }, { kind: 'quest' as const, id: 'quest:e', targetDate: '2026-09-23' }] };
    const result = derive([blended()], snap({ selfRoute: moved, homework: own }));
    const kept = result.homework.filter((h) => h.id.startsWith('route:'));
    expect(kept).toEqual(own);
    expect(result.removed).toBe(0);
    expect(result.redated).toBe(0);
    expect(ids(result.homework)).toEqual(['plan:blend#quest:a', 'plan:blend#quest:b', 'route:mine#quest:d', 'route:mine#quest:e']);
  });

  it('Home and Homework do not show them; finished ones and every other assignment show', () => {
    const finished = own.map((h) => (h.questId === 'quest:e' ? { ...h, completedAt: 'x' } : h));
    const all = derive([blended()], snap({ selfRoute: route, homework: [...finished, { id: 'hw:parent-1', profileId: 'profile:a', questId: 'quest:b', episodeId: 'episode:s1', assignedBy: 'parent', assignedAt: 't', targetDate: TODAY }] })).homework;
    const shown = visibleHomework(all, restingSourceIds([blended()], route, TODAY));
    expect(ids(shown)).toEqual(['hw:parent-1', 'plan:blend#quest:a', 'plan:blend#quest:b', 'route:mine#quest:e']);
    expect(visibleHomework(all, [])).toEqual(all);
  });

  it('when the class plan ends, the next derivation includes the own plan again with its items', () => {
    const resting = derive([blended()], snap({ selfRoute: route, homework: own })).homework;
    const after = derive([blended()], snap({ selfRoute: route, homework: resting }), '2026-10-20');
    expect(sourcesOf([blended()], route, '2026-10-20').map((s) => s.id)).toEqual(['plan:blend', 'route:mine']);
    expect(after.homework.filter((h) => h.id.startsWith('route:'))).toEqual(own);
    expect(visibleHomework(after.homework, restingSourceIds([blended()], route, '2026-10-20'))).toEqual(after.homework);
  });

  it('when the learner leaves the class, the class items go and the own plan is back', () => {
    const resting = derive([blended()], snap({ selfRoute: route, homework: own })).homework;
    const left = derive([], snap({ selfRoute: route, homework: resting }));
    expect(ids(left.homework)).toEqual(['route:mine#quest:d', 'route:mine#quest:e']);
    expect(left.removed).toBe(2);
    expect(layerOf(sourcesOf([], route, TODAY), TODAY)).toBe('solo');
  });
});

describe('reconcile cases (section 12.2)', () => {
  it('a move between classes (F-SPACE-002): the old plan leaves, its pending items drop, finished stay; the new derives from today', () => {
    const first = derive([blended()], snap()).homework.map((h) => (h.questId === 'quest:a' ? { ...h, completedAt: '2026-09-23T10:00:00.000Z' } : h));
    const next = blended({ id: 'plan:new', spaceId: 'space:new', publishedAt: '2026-09-23T00:00:00.000Z', items: [
      { kind: 'quest', id: 'quest:a', targetDate: '2026-09-24', lectureDate: '2026-09-23' },
      { kind: 'quest', id: 'quest:d', targetDate: '2026-09-24', lectureDate: '2026-09-23' },
    ] });
    const moved = derive([next], snap({ homework: first, quests: [done('quest:a')] }));
    expect(ids(moved.homework)).toEqual(['plan:blend#quest:a', 'plan:new#quest:a', 'plan:new#quest:d']);
    // A lesson finished before the move shows done on the new plan; nothing reads as missed.
    expect(moved.homework.find((h) => h.id === 'plan:new#quest:a')?.completedAt).toBe('2026-09-22T10:00:00.000Z');
    expect(moved.removed).toBe(1);
    // Practice days the learner had moved for the old plan are discarded with it.
    const practiceDays = [{ planId: 'plan:blend', days: ['mon', 'wed', 'thu', 'fri', 'sat'] as const, updatedAt: '2026-09-22T00:00:00.000Z' }].map((e) => ({ ...e, days: [...e.days] }));
    expect(planDaysInForce(sourcesOf([next], null, TODAY), TODAY, practiceDays)).toBe(4);
  });

  it('joining mid-term derives the earlier practice items too, with fromClass', () => {
    const plan = blended({ items: [
      { kind: 'quest', id: 'quest:a', targetDate: '2026-09-23', lectureDate: '2026-09-22' },
      { kind: 'quest', id: 'quest:b', targetDate: '2026-10-07', lectureDate: '2026-10-06' },
    ] });
    const joined = derive([plan], snap(), '2026-10-08');
    expect(joined.homework.map((h) => [h.id, h.targetDate, h.fromClass])).toEqual([
      ['plan:blend#quest:a', '2026-09-23', true],
      ['plan:blend#quest:b', '2026-10-07', true],
    ]);
  });

  it('two blended classes: both derive, the newest leads, the own plan rests, the weekly goal counts the union of days', () => {
    const older = blended({ id: 'plan:one', meta: blendedMeta({ practiceDays: ['wed', 'fri', 'sun'] }) });
    const newer = blended({
      id: 'plan:two',
      spaceId: 'space:two',
      publishedAt: '2026-09-21T00:00:00.000Z',
      items: [{ kind: 'quest', id: 'quest:d', targetDate: '2026-09-25', lectureDate: '2026-09-24' }],
      meta: blendedMeta({ lectureDays: ['thu'], practiceDays: ['fri', 'sun', 'tue'] }),
    });
    const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:e', targetDate: '2026-09-23' }] });
    const result = derive([older, newer], snap({ selfRoute: route }));
    expect(ids(result.homework)).toEqual(['plan:one#quest:a', 'plan:one#quest:b', 'plan:two#quest:d']);
    // The Thursday class starts on 2026-09-24: until then the Tuesday class leads alone.
    expect(leadingBlended(sourcesOf([older, newer], route, TODAY), TODAY)?.id).toBe('plan:one');
    const day = '2026-09-25';
    const sources = sourcesOf([older, newer], route, day);
    expect(sources.map((s) => s.id)).toEqual(['plan:one', 'plan:two']);
    expect(leadingBlended(sources, day)?.id).toBe('plan:two');
    // Tue, Wed, Fri, Sun and Thu.
    expect(planDaysInForce(sources, day)).toBe(5);
  });
});
