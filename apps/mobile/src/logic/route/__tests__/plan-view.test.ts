import { CATALOG, generateCurriculum, type CurriculumDraft } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { vocabTopic } from '../../../content/vocab';
import { PREVIEW_OPEN_WEEKS, draftWeeks, learnerNotices, openableTopicKey, planOverview, previewStats, previewWeeks } from '../plan-view';
import { selfRouteOf } from '../self-route';

const draft = (weeks: number, over: Partial<Parameters<typeof generateCurriculum>[0]> = {}): CurriculumDraft =>
  generateCurriculum(
    { audience: 'self', level: { stage: 'stage1', band: 0 }, startDate: '2026-10-12', weeks, sessionsPerWeek: 3, minutesPerSession: 15, unlockedStages: ['stage1'], ...over },
    CATALOG,
  );

describe('the plan preview (wireframe G2)', () => {
  it('opens the first four weeks with their items by date, and counts the later ones', () => {
    const d = draft(12);
    const { open, later } = previewWeeks(d);
    expect(open).toHaveLength(PREVIEW_OPEN_WEEKS);
    expect(later).toBe(8);
    expect(open[0]).toMatchObject({ index: 1, startDate: '2026-10-12', kind: 'learn' });
    expect(open[0]?.rows.map((r) => r.date)).toEqual(['2026-10-12', '2026-10-14', '2026-10-17']);
    expect(open.every((w) => Array.isArray(w.extras))).toBe(true);
    expect(previewWeeks(draft(2)).later).toBe(0);
    // Opening the later weeks shows every week, the first four the same as before.
    expect(draftWeeks(d)).toHaveLength(12);
    expect(draftWeeks(d).slice(0, PREVIEW_OPEN_WEEKS)).toEqual(open);
  });

  it('keeps a culture week\'s lead story as its quest id, so the label can name the story', () => {
    const d = draft(26, { goals: { focus: 'culture' }, unlockedStages: ['stage1'] });
    const weeks = draftWeeks(d);
    const withStory = weeks.filter((w) => w.storyQuestId !== null);
    expect(withStory.length).toBeGreaterThan(0);
    const storyQuests = new Set(CATALOG.stories.map((s) => s.questId));
    for (const w of withStory) expect(storyQuests.has(w.storyQuestId ?? '')).toBe(true);
    // The lead story of the week is the first of the week's focus stories.
    const meta = d.weeks.find((w) => w.focus.storyIds.length > 0);
    const lead = CATALOG.stories.find((s) => s.id === meta?.focus.storyIds[0]);
    expect(weeks.find((w) => w.index === meta?.index)?.storyQuestId).toBe(lead?.questId);
  });

  it('a culture week whose story is not in this catalogue has no story to name', () => {
    const d = draft(26, { goals: { focus: 'culture' }, unlockedStages: ['stage1'] });
    const at = d.weeks.findIndex((w) => w.focus.storyIds.length > 0);
    const odd = { ...d, weeks: d.weeks.map((w, i) => (i === at ? { ...w, focus: { ...w.focus, storyIds: ['story:not-in-catalog'] } } : w)) };
    expect(draftWeeks(odd)[at]?.storyQuestId).toBeNull();
  });

  it('an optional word topic opens its Words page when it is bundled, and is text otherwise', () => {
    const bundled = (key: string): boolean => vocabTopic(key) !== undefined;
    expect(openableTopicKey('topic:food', bundled)).toBe('food');
    expect(openableTopicKey('topic:not-bundled-here', bundled)).toBeNull();
  });

  it('the stats line: ready items, their minutes and the stage the lessons reach', () => {
    const d = draft(12);
    expect(previewStats(d)).toEqual({ items: d.stats.readyItems, minutes: d.stats.minutesPlanned, stage: 1 });
  });

  it('learner notices: one "more lessons are coming" for locked and unreleased parts, never Premium', () => {
    expect(
      learnerNotices({
        warnings: [
          { code: 'coming-soon-included', week: 13, count: 5 },
          { code: 'content-runs-out', week: 15 },
          { code: 'premium-needed', count: 3 },
          { code: 'fewer-sessions-than-units', count: 2 },
          { code: 'session-too-short', count: 1 },
          { code: 'already-done-skipped', count: 4 },
        ],
      }),
    ).toEqual([
      { code: 'more-coming' },
      { code: 'content-runs-out', week: 15 },
      { code: 'did-not-fit', count: 2 },
      { code: 'too-short', count: 1 },
      { code: 'already-known', count: 4 },
    ]);
    expect(learnerNotices({ warnings: [{ code: 'content-runs-out' }, { code: 'fewer-sessions-than-units' }, { code: 'session-too-short' }, { code: 'already-done-skipped' }] })).toEqual([
      { code: 'content-runs-out', week: 1 },
      { code: 'did-not-fit', count: 1 },
      { code: 'too-short', count: 1 },
      { code: 'already-known', count: 1 },
    ]);
  });
});

describe('the plan overview (wireframe G3)', () => {
  const route = selfRouteOf(draft(4), 'route:a-0001', '2026-10-12T00:00:00.000Z');

  it('upcoming: the first week leads and the plan says when it starts', () => {
    const o = planOverview(route, '2026-10-10');
    expect(o).toMatchObject({ status: 'upcoming', startsOn: '2026-10-12' });
    expect(o.current?.index).toBe(1);
    expect(o.later.map((w) => w.index)).toEqual([2, 3, 4]);
  });

  it('active: the week that holds today, then the later weeks; past weeks are left out', () => {
    const o = planOverview(route, '2026-10-21');
    expect(o.status).toBe('active');
    expect(o.current?.index).toBe(2);
    expect(o.later.map((w) => w.index)).toEqual([3, 4]);
  });

  it('finished after its last day; a plan without weeks reads as finished', () => {
    expect(planOverview(route, '2026-11-09')).toEqual({ status: 'finished', startsOn: '2026-10-12', current: null, later: [] });
    expect(planOverview({ meta: { weeks: [] }, items: [] }, '2026-10-12')).toEqual({ status: 'finished', startsOn: '2026-10-12', current: null, later: [] });
  });

  it('only dated items of the week are rows', () => {
    const o = planOverview({ ...route, items: [...route.items, { kind: 'quest', id: 'quest:undated' }] }, '2026-10-12');
    expect(o.current?.rows.some((r) => r.id === 'quest:undated')).toBe(false);
  });
});
