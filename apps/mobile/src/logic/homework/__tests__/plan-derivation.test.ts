import type { Episode, HomeworkAssignment, InboxPlan, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { deriveAssignments, planAssignmentId, planIdOf, sourceIdOf, sourcesOf, type DeriveInput } from '../plan-derivation';
import { curriculumMeta, selfRoute } from './curriculum-fixture';

const quest = (id: string): Quest => ({ id, titleEn: id, estimatedMinutes: 4, steps: [
  { id: 's1', kind: 'intro', titleEn: 'a', durationSeconds: 5 },
  { id: 's2', kind: 'present', titleEn: 'b', durationSeconds: 5 },
  { id: 's3', kind: 'reward', titleEn: 'c', durationSeconds: 5 },
] as Quest['steps'] });
const episodes: Episode[] = [
  { id: 'episode:s1', stage: 'stage1', theme: 'letters', order: 1, titleEn: 'E1', hoyaIntroEn: 'hi', questIds: ['quest:a', 'quest:b'], rewardCardIds: [], estimatedMinutes: 10, status: 'shipped' },
  { id: 'episode:s2', stage: 'stage2', theme: 'life', order: 2, titleEn: 'E2', hoyaIntroEn: 'hi', questIds: ['quest:c'], rewardCardIds: [], estimatedMinutes: 10, status: 'shipped' },
  { id: 'episode:s3', stage: 'stage1', theme: 'life', order: 3, titleEn: 'E3', hoyaIntroEn: 'hi', questIds: ['quest:d', 'quest:e'], rewardCardIds: [], estimatedMinutes: 10, status: 'shipped' },
];
const quests = [quest('quest:a'), quest('quest:b'), quest('quest:c'), quest('quest:d'), quest('quest:e')];
const snap = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({ profileId: 'profile:a', updatedAt: 't', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over });
const plan = (over: Partial<InboxPlan> = {}): InboxPlan => ({ id: 'plan:w3', spaceId: 'space:c', spaceKind: 'class', spaceName: 'A', title: 'Week 3', items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-28' }], publishedAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z', ...over });
const base = { profileId: 'profile:a', quests, episodes, unlockedStages: ['stage1'], today: '2026-09-21', learnerName: 'Suni' };
const derive = (plans: InboxPlan[], snapshot: ProgressSnapshot, over: Partial<DeriveInput> = {}) =>
  deriveAssignments({ ...base, sources: sourcesOf(plans, snapshot.selfRoute), snapshot, ...over });
const done = (questId: string, completedAt = '2026-09-22T10:00:00.000Z') => ({ questId, episodeId: 'episode:s1', startedAt: 't', completedAt, stars: 3 as const, attempts: 1, accuracy: 1 });

describe('plan derivation (F-PLAN-001 §3.3)', () => {
  it('builds ids that round-trip to the plan', () => {
    expect(planAssignmentId('plan:w3', 'quest:a')).toBe('plan:w3#quest:a');
    expect(planIdOf('plan:w3#quest:a')).toBe('plan:w3');
    expect(planIdOf('hw:parent-1')).toBeNull();
    expect(planIdOf('plan:broken')).toBeNull();
  });

  it('derives quest and episode items, skipping locked ones silently', () => {
    const p = plan({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-28', note: 'x' }, { kind: 'episode', id: 'episode:s1' }, { kind: 'episode', id: 'episode:s2' }, { kind: 'quest', id: 'quest:nope' }] });
    const result = derive([p], snap());
    expect(result.homework.map((h) => h.id)).toEqual(['plan:w3#quest:a', 'plan:w3#quest:b']);
    expect(result.homework[0]).toMatchObject({ assignedBy: 'teacher', assignedAt: '2026-09-20T00:00:00.000Z', targetDate: '2026-09-28', episodeId: 'episode:s1', profileId: 'profile:a' });
    expect(result.homework[1]?.targetDate).toBe('2026-09-21'); // no date on the episode item → today
    expect(result.notReady).toEqual({ 'plan:w3': 2 }); // quest:c is stage 2, quest:nope unknown
    expect(result).toMatchObject({ added: 2, removed: 0, redated: 0, completedNow: 0, changed: true });
  });

  it('counts an episode with no quests as not ready', () => {
    const empty: Episode = { ...episodes[0]!, id: 'episode:empty', questIds: [], status: 'preview' };
    const result = derive([plan({ items: [{ kind: 'episode', id: 'episode:empty' }, { kind: 'episode', id: 'episode:gone' }] })], snap(), { episodes: [...episodes, empty] });
    expect(result.homework).toEqual([]);
    expect(result.notReady).toEqual({ 'plan:w3': 2 });
  });

  it('is idempotent and carries completion from the snapshot', () => {
    const first = derive([plan()], snap());
    const again = derive([plan()], snap({ homework: first.homework }));
    expect(again).toMatchObject({ added: 0, removed: 0, redated: 0, completedNow: 0, changed: false });
    expect(again.homework).toEqual(first.homework);

    const finished = snap({ homework: first.homework, quests: [done('quest:a')] });
    const completed = derive([plan()], finished);
    expect(completed.homework[0]?.completedAt).toBe('2026-09-22T10:00:00.000Z');
    expect(completed).toMatchObject({ completedNow: 1, changed: true });
    // a quest finished before the plan existed is derived as done
    const fresh = derive([plan()], snap({ quests: finished.quests }));
    expect(fresh.homework[0]?.completedAt).toBe('2026-09-22T10:00:00.000Z');
  });

  it('drops pending assignments of plans that left the inbox, keeps history and caregiver homework', () => {
    const first = derive([plan({ items: [{ kind: 'episode', id: 'episode:s1' }] })], snap());
    const withHistory = first.homework.map((h) => (h.questId === 'quest:a' ? { ...h, completedAt: 't' } : h));
    const parent = { id: 'hw:parent-1', profileId: 'profile:a', questId: 'quest:b', episodeId: 'episode:s1', assignedBy: 'parent' as const, assignedAt: 't', targetDate: '2026-09-21' };
    const result = derive([], snap({ homework: [...withHistory, parent] }));
    expect(result.homework.map((h) => h.id)).toEqual(['plan:w3#quest:a', 'hw:parent-1']);
    expect(result).toMatchObject({ removed: 1, changed: true });
  });
});

describe('sources and the assignedBy mapping (F-PLAN-002 section 3.6 rule 4)', () => {
  it('maps class to teacher, family and school to parent, the self-route to system', () => {
    const kinds = [plan({ id: 'plan:c' }), plan({ id: 'plan:f', spaceKind: 'family' }), plan({ id: 'plan:s', spaceKind: 'school' })];
    const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:b', targetDate: '2026-09-22' }] });
    const result = derive(kinds, snap({ selfRoute: route }));
    expect(result.homework.map((h) => [h.id, h.assignedBy])).toEqual([
      ['plan:c#quest:a', 'teacher'],
      ['plan:f#quest:a', 'parent'],
      ['plan:s#quest:a', 'parent'],
      ['route:mine#quest:b', 'system'],
    ]);
    expect(result.homework[3]).toMatchObject({ assignedAt: route.createdAt, targetDate: '2026-09-22' });
  });

  it('self-route ids never match the plan: prefix the summary reads', () => {
    expect(planIdOf('route:mine#quest:b')).toBeNull();
    expect(sourceIdOf('route:mine#quest:b')).toBe('route:mine');
    expect(sourceIdOf('plan:w3#quest:a')).toBe('plan:w3');
    expect(sourceIdOf('hw:parent-1')).toBeNull();
    expect(sourceIdOf('route:broken')).toBeNull();
  });

  it('an archived or missing self-route is not a source', () => {
    expect(sourcesOf([], selfRoute({ archivedAt: '2026-09-21T00:00:00.000Z' }))).toEqual([]);
    expect(sourcesOf([], null)).toEqual([]);
    expect(sourcesOf([], undefined)).toEqual([]);
    expect(sourcesOf([plan()], null).map((s) => [s.id, s.kind, s.assignedAt])).toEqual([['plan:w3', 'class', '2026-09-20T00:00:00.000Z']]);
  });

  it('stopping a route drops its pending items and keeps the finished ones', () => {
    const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-21' }, { kind: 'quest', id: 'quest:b', targetDate: '2026-09-22' }] });
    const first = derive([], snap({ selfRoute: route }));
    const history = first.homework.map((h) => (h.questId === 'quest:a' ? { ...h, completedAt: 't' } : h));
    const stopped = derive([], snap({ homework: history, selfRoute: { ...route, archivedAt: '2026-09-21T09:00:00.000Z' } }));
    expect(stopped.homework.map((h) => h.id)).toEqual(['route:mine#quest:a']);
    expect(stopped).toMatchObject({ removed: 1, changed: true });
  });
});

describe('horizon (F-PLAN-002 section 3.6 rule 1)', () => {
  const twelveWeeks = (startDay: number): InboxPlan['items'] =>
    Array.from({ length: 36 }, (_, i) => ({ kind: 'quest' as const, id: ['quest:a', 'quest:b', 'quest:d'][i % 3]!, targetDate: dayAfter('2026-09-21', startDay + Math.floor(i / 3) * 7 + (i % 3) * 2) }));
  const dayAfter = (key: string, n: number): string => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  it('derives only items dated within horizonDays of today for a curriculum; total grows with time', () => {
    // Distinct quest ids per date so the window is visible in the ids.
    const items = Array.from({ length: 12 }, (_, i) => ({ kind: 'quest' as const, id: ['quest:a', 'quest:b', 'quest:d', 'quest:e'][i % 4]!, targetDate: dayAfter('2026-09-21', i * 3) }));
    const curriculum = plan({ id: 'plan:term', items, meta: curriculumMeta() });
    const day1 = derive([curriculum], snap());
    // horizon 7: dates 09-21, 09-24, 09-27 (09-30 is today + 9)
    expect(day1.homework.map((h) => h.targetDate)).toEqual(['2026-09-21', '2026-09-24', '2026-09-27']);
    expect(day1.notReady).toEqual({});
    const later = derive([curriculum], snap({ homework: day1.homework }), { today: '2026-09-24' });
    expect(later.homework.map((h) => h.targetDate)).toEqual(['2026-09-21', '2026-09-24', '2026-09-27', '2026-09-30']);
    expect(later).toMatchObject({ added: 1, removed: 0 });
  });

  it('includes the day exactly horizonDays ahead, honours a custom horizon, and derives undated items', () => {
    const items = [
      { kind: 'quest' as const, id: 'quest:a', targetDate: '2026-09-28' },
      { kind: 'quest' as const, id: 'quest:b', targetDate: '2026-09-29' },
      { kind: 'quest' as const, id: 'quest:d' },
    ];
    expect(derive([plan({ items, meta: curriculumMeta() })], snap()).homework.map((h) => h.questId)).toEqual(['quest:a', 'quest:d']);
    expect(derive([plan({ items, meta: curriculumMeta({ horizonDays: 1 }) })], snap()).homework.map((h) => h.questId)).toEqual(['quest:d']);
    // A meta stored before horizonDays existed reads the default of 7.
    const { horizonDays: _h, ...legacyMeta } = curriculumMeta();
    expect(derive([plan({ items, meta: legacyMeta as never })], snap()).homework.map((h) => h.questId)).toEqual(['quest:a', 'quest:d']);
  });

  it('a locked item beyond the horizon is not counted as not ready yet', () => {
    const items = [{ kind: 'quest' as const, id: 'quest:c', targetDate: '2026-12-01' }, { kind: 'quest' as const, id: 'quest:c', targetDate: '2026-09-21' }];
    expect(derive([plan({ items, meta: curriculumMeta() })], snap()).notReady).toEqual({ 'plan:w3': 1 });
  });

  it('a classic plan has no horizon', () => {
    const result = derive([plan({ items: twelveWeeks(0).slice(0, 3).map((x, i) => ({ ...x, targetDate: dayAfter('2026-09-21', i * 30) })) })], snap());
    expect(result.homework).toHaveLength(3);
  });

  it('a self-route uses its horizon too', () => {
    const route = selfRoute({ items: [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-21' }, { kind: 'quest', id: 'quest:b', targetDate: '2026-10-21' }] });
    expect(derive([], snap({ selfRoute: route })).homework.map((h) => h.id)).toEqual(['route:mine#quest:a']);
  });

  it('a twelve-week plan at three a week derives only the items dated within seven days on day one (section 3.12)', () => {
    // 36 distinct quests, so first-item-wins dedupe cannot hide a missing horizon.
    const termQuests = Array.from({ length: 36 }, (_, i) => quest(`quest:t${i}`));
    const termEpisode: Episode = { ...episodes[0]!, id: 'episode:term', questIds: termQuests.map((q) => q.id) };
    const items = twelveWeeks(0).map((item, i) => ({ ...item, id: `quest:t${i}` }));
    const result = derive([plan({ id: 'plan:term', items, meta: curriculumMeta() })], snap(), { quests: termQuests, episodes: [termEpisode] });
    expect(result.homework.map((h) => [h.id, h.targetDate])).toEqual([
      ['plan:term#quest:t0', '2026-09-21'],
      ['plan:term#quest:t1', '2026-09-23'],
      ['plan:term#quest:t2', '2026-09-25'],
      ['plan:term#quest:t3', '2026-09-28'],
    ]);
    expect(result.notReady).toEqual({});
    expect(result).toMatchObject({ added: 4, removed: 0, redated: 0 });
  });
});

describe('reconcile (F-PLAN-002 section 3.6 rule 2)', () => {
  const items = (dates: Record<string, string>): InboxPlan['items'] => Object.entries(dates).map(([id, targetDate]) => ({ kind: 'quest' as const, id, targetDate }));

  it('moves a pending assignment to its item new date (re-pace), counting it as redated', () => {
    const first = derive([plan({ items: items({ 'quest:a': '2026-09-21', 'quest:b': '2026-09-23' }) })], snap());
    const repaced = derive([plan({ items: items({ 'quest:a': '2026-09-22', 'quest:b': '2026-09-23' }) })], snap({ homework: first.homework }));
    expect(repaced.homework.map((h) => [h.id, h.targetDate])).toEqual([
      ['plan:w3#quest:a', '2026-09-22'],
      ['plan:w3#quest:b', '2026-09-23'],
    ]);
    expect(repaced).toMatchObject({ redated: 1, added: 0, removed: 0, changed: true });
  });

  it('removes a pending assignment whose item left the plan, left the horizon or became locked', () => {
    const start = items({ 'quest:a': '2026-09-21', 'quest:b': '2026-09-22', 'quest:d': '2026-09-23' });
    const first = derive([plan({ items: start, meta: curriculumMeta() })], snap());
    expect(first.homework).toHaveLength(3);
    const edited = items({ 'quest:b': '2026-10-20', 'quest:d': '2026-09-23' });
    const result = derive([plan({ items: edited, meta: curriculumMeta() })], snap({ homework: first.homework }));
    expect(result.homework.map((h) => h.id)).toEqual(['plan:w3#quest:d']);
    expect(result).toMatchObject({ removed: 2, changed: true });
    const locked = derive([plan({ items: start, meta: curriculumMeta() })], snap({ homework: first.homework }), { unlockedStages: [] });
    expect(locked.homework).toEqual([]);
    expect(locked).toMatchObject({ removed: 3 });
  });

  it('never touches a completed assignment, even when its item moved or left', () => {
    const first = derive([plan({ items: items({ 'quest:a': '2026-09-21' }) })], snap());
    const finished = first.homework.map((h) => ({ ...h, completedAt: '2026-09-21T10:00:00.000Z' }));
    const moved = derive([plan({ items: items({ 'quest:a': '2026-09-25' }) })], snap({ homework: finished }));
    expect(moved.homework).toEqual(finished);
    const gone = derive([plan({ items: items({ 'quest:b': '2026-09-25' }) })], snap({ homework: finished }));
    expect(gone.homework[0]).toEqual(finished[0]);
    expect(gone).toMatchObject({ removed: 0, redated: 0, added: 1 });
  });

  it('keeps an undated item at its first date and leaves other sources alone', () => {
    const parent: HomeworkAssignment = { id: 'hw:parent-1', profileId: 'profile:a', questId: 'quest:b', episodeId: 'episode:s1', assignedBy: 'parent', assignedAt: 't', targetDate: '2026-09-19' };
    const first = derive([plan({ items: [{ kind: 'quest', id: 'quest:a' }] })], snap({ homework: [parent] }));
    const nextDay = derive([plan({ items: [{ kind: 'quest', id: 'quest:a' }] })], snap({ homework: first.homework }), { today: '2026-09-22' });
    expect(nextDay.homework.map((h) => [h.id, h.targetDate])).toEqual([
      ['hw:parent-1', '2026-09-19'],
      ['plan:w3#quest:a', '2026-09-21'],
    ]);
    expect(nextDay.changed).toBe(false);
  });

  it('the first item wins when a quest appears twice in one source', () => {
    const twice: InboxPlan['items'] = [{ kind: 'quest', id: 'quest:a', targetDate: '2026-09-22' }, { kind: 'episode', id: 'episode:s1', targetDate: '2026-09-24' }];
    const first = derive([plan({ items: twice })], snap());
    expect(first.homework.map((h) => [h.id, h.targetDate])).toEqual([
      ['plan:w3#quest:a', '2026-09-22'],
      ['plan:w3#quest:b', '2026-09-24'],
    ]);
    expect(derive([plan({ items: twice })], snap({ homework: first.homework })).changed).toBe(false);
  });

  it('marks a pending assignment done and moves it in the same pass', () => {
    const first = derive([plan({ items: items({ 'quest:a': '2026-09-21' }) })], snap());
    const result = derive([plan({ items: items({ 'quest:a': '2026-09-23' }) })], snap({ homework: first.homework, quests: [done('quest:a')] }));
    expect(result.homework[0]).toMatchObject({ targetDate: '2026-09-23', completedAt: '2026-09-22T10:00:00.000Z' });
    expect(result).toMatchObject({ redated: 1, completedNow: 1, changed: true });
  });
});

describe('quest access (F-ENT-003 section 3.6: a closed item is treated like a stage-locked one)', () => {
  const closed = (...ids: string[]) => {
    const shut = new Set(ids);
    return (questId: string): boolean => !shut.has(questId);
  };
  const dated = (dates: Record<string, string>): InboxPlan['items'] =>
    Object.entries(dates).map(([id, targetDate]) => ({ kind: 'quest' as const, id, targetDate }));

  it('omitted: every item derives as before', () => {
    const p = plan({ items: [{ kind: 'episode', id: 'episode:s1' }, { kind: 'quest', id: 'quest:d' }] });
    expect(derive([p], snap(), { isQuestOpen: undefined })).toEqual(derive([p], snap()));
    expect(derive([p], snap(), { isQuestOpen: () => true })).toEqual(derive([p], snap()));
  });

  it('a closed quest item is not derived and is counted not ready for its source', () => {
    const p = plan({ items: dated({ 'quest:a': '2026-09-22', 'quest:b': '2026-09-23' }) });
    const result = derive([p], snap(), { isQuestOpen: closed('quest:b') });
    expect(result.homework.map((h) => h.id)).toEqual(['plan:w3#quest:a']);
    expect(result.notReady).toEqual({ 'plan:w3': 1 });
    expect(result).toMatchObject({ added: 1, changed: true });
  });

  it('an episode item counts each closed quest once, per source', () => {
    const route = selfRoute({ items: [{ kind: 'episode', id: 'episode:s3' }] });
    const result = derive([plan({ items: [{ kind: 'episode', id: 'episode:s3' }] })], snap({ selfRoute: route }), { isQuestOpen: closed('quest:d', 'quest:e') });
    expect(result.homework).toEqual([]);
    expect(result.notReady).toEqual({ 'plan:w3': 2, 'route:mine': 2 });
  });

  it('closed and stage-locked items add up in one count', () => {
    const p = plan({ items: dated({ 'quest:a': '2026-09-22', 'quest:c': '2026-09-23', 'quest:d': '2026-09-24' }) });
    const result = derive([p], snap(), { isQuestOpen: closed('quest:d') });
    expect(result.homework.map((h) => h.id)).toEqual(['plan:w3#quest:a']);
    expect(result.notReady).toEqual({ 'plan:w3': 2 }); // quest:c stage 2, quest:d closed
  });

  it('reconcile removes a pending assignment whose quest became closed', () => {
    const p = plan({ items: dated({ 'quest:a': '2026-09-22', 'quest:d': '2026-09-23' }) });
    const first = derive([p], snap());
    expect(first.homework).toHaveLength(2);
    const result = derive([p], snap({ homework: first.homework }), { isQuestOpen: closed('quest:d') });
    expect(result.homework.map((h) => h.id)).toEqual(['plan:w3#quest:a']);
    expect(result).toMatchObject({ removed: 1, added: 0, changed: true, notReady: { 'plan:w3': 1 } });
  });

  it('never touches a finished assignment, even when its quest reads closed', () => {
    const p = plan({ items: dated({ 'quest:d': '2026-09-23' }) });
    const finished = derive([p], snap()).homework.map((h) => ({ ...h, completedAt: '2026-09-23T10:00:00.000Z' }));
    const result = derive([p], snap({ homework: finished }), { isQuestOpen: closed('quest:d') });
    expect(result.homework).toEqual(finished);
    expect(result).toMatchObject({ removed: 0, changed: false });
  });

  it('caregiver homework is left as it is', () => {
    const parent: HomeworkAssignment = { id: 'hw:parent-1', profileId: 'profile:a', questId: 'quest:d', episodeId: 'episode:s3', assignedBy: 'parent', assignedAt: 't', targetDate: '2026-09-21' };
    const result = derive([], snap({ homework: [parent] }), { isQuestOpen: closed('quest:d') });
    expect(result.homework).toEqual([parent]);
    expect(result.changed).toBe(false);
  });

  it('the next derivation after the learner gets a plan adds the item back', () => {
    const p = plan({ items: dated({ 'quest:a': '2026-09-22', 'quest:d': '2026-09-23' }) });
    const free = derive([p], snap(), { isQuestOpen: closed('quest:d') });
    const premium = derive([p], snap({ homework: free.homework }), { isQuestOpen: () => true });
    expect(premium.homework.map((h) => h.id)).toEqual(['plan:w3#quest:a', 'plan:w3#quest:d']);
    expect(premium).toMatchObject({ added: 1, removed: 0, notReady: {}, changed: true });
  });

  it('a closed item beyond a curriculum horizon is not counted yet', () => {
    const p = plan({ items: dated({ 'quest:a': '2026-09-22', 'quest:d': '2026-12-01' }), meta: curriculumMeta() });
    const result = derive([p], snap(), { isQuestOpen: closed('quest:d') });
    expect(result.notReady).toEqual({});
  });
});
