import { CATALOG, type Catalog, type CurriculumMeta, type PlanItem } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { ADD_PARAM, addFrom, draftForAdd, withQuest } from '../plan-add';

/** F-REPORT-001 RP-10: the plan builder's `&add=<questId>` (the learner report's **Add to a plan**). */

const params = (query: string) => new URLSearchParams(query);

describe('addFrom', () => {
  it('reads the add parameter', () => {
    expect(ADD_PARAM).toBe('add');
    expect(addFrom(params('id=space%3Ac&add=quest%3Astage1-life-q2'))).toEqual({ requested: true, questId: 'quest:stage1-life-q2' });
    expect(addFrom(params('id=space%3Ac&add=%20quest%3Astage1-life-q2%20'))).toEqual({ requested: true, questId: 'quest:stage1-life-q2' });
  });

  it('asks for nothing without the parameter or without params', () => {
    expect(addFrom(params('id=space%3Ac'))).toEqual({ requested: false, questId: null });
    expect(addFrom(null)).toEqual({ requested: false, questId: null });
  });

  it('adds nothing for an empty, unknown or closed quest, but says one was asked for (the address is cleaned)', () => {
    expect(addFrom(params('id=space%3Ac&add='))).toEqual({ requested: true, questId: null });
    expect(addFrom(params('id=space%3Ac&add=quest%3Anope'))).toEqual({ requested: true, questId: null });
    expect(addFrom(params('id=space%3Ac&add=episode%3Astage1-life'))).toEqual({ requested: true, questId: null });
    const closed: Catalog = { ...CATALOG, cells: CATALOG.cells.map((c) => (c.episodeId === 'episode:stage1-life' ? { ...c, status: 'preview' } : c)) };
    expect(addFrom(params('add=quest%3Astage1-life-q2'), closed)).toEqual({ requested: true, questId: null });
    const draftStory = CATALOG.stories.find((s) => s.status === 'draft');
    if (draftStory) expect(addFrom(params(`add=${encodeURIComponent(draftStory.questId)}`))).toEqual({ requested: true, questId: null });
  });

  it('takes the first value when the parameter repeats', () => {
    expect(addFrom(params('add=quest%3Astage1-life-q2&add=quest%3Astage1-life-q3'))).toEqual({ requested: true, questId: 'quest:stage1-life-q2' });
  });
});

describe('withQuest', () => {
  const items: PlanItem[] = [{ kind: 'episode', id: 'episode:stage1-letters' }, { kind: 'quest', id: 'quest:stage1-life-q1', targetDate: '2026-10-20' }];

  it('appends the quest as the last item', () => {
    expect(withQuest(items, 'quest:stage1-life-q2')).toEqual([...items, { kind: 'quest', id: 'quest:stage1-life-q2' }]);
  });

  it('keeps the items (the same array) when the quest is already there: a duplicate add adds nothing', () => {
    expect(withQuest(items, 'quest:stage1-life-q1')).toBe(items);
    const once = withQuest([], 'quest:stage1-life-q2');
    expect(withQuest(once, 'quest:stage1-life-q2')).toBe(once);
    expect(once).toEqual([{ kind: 'quest', id: 'quest:stage1-life-q2' }]);
  });

  it('does not treat an episode with the same id as the quest', () => {
    expect(withQuest([{ kind: 'episode', id: 'x' }], 'x')).toEqual([{ kind: 'episode', id: 'x' }, { kind: 'quest', id: 'x' }]);
  });
});

describe('draftForAdd', () => {
  const plan = (over: Partial<{ id: string; title: string; items: PlanItem[]; targetLearnerIds: string[] | null; publishedAt: string | null; meta: CurriculumMeta | null }> = {}) => ({
    id: 'plan:1',
    title: 'Week 3',
    items: [{ kind: 'quest', id: 'quest:stage1-life-q1' }] as PlanItem[],
    targetLearnerIds: ['profile:mina'],
    publishedAt: null,
    meta: null,
    ...over,
  });

  it('starts a new, untitled draft for everyone with only the quest when no plan is open', () => {
    expect(draftForAdd(null, 'quest:stage1-life-q2')).toEqual({ draft: { title: '', items: [{ kind: 'quest', id: 'quest:stage1-life-q2' }], targets: null, meta: null }, added: true });
  });

  it('adds the quest to the open classic draft, keeping its id, title and learners', () => {
    expect(draftForAdd(plan(), 'quest:stage1-life-q2')).toEqual({
      draft: { id: 'plan:1', title: 'Week 3', items: [{ kind: 'quest', id: 'quest:stage1-life-q1' }, { kind: 'quest', id: 'quest:stage1-life-q2' }], targets: ['profile:mina'], meta: null },
      added: true,
    });
  });

  it('leaves the open draft as it is when it already holds the quest (a duplicate add)', () => {
    const current = plan();
    const out = draftForAdd(current, 'quest:stage1-life-q1');
    expect(out.added).toBe(false);
    expect(out.draft.items).toBe(current.items);
    expect(out.draft.id).toBe('plan:1');
  });

  it('never changes a published plan: a new draft holds the quest', () => {
    expect(draftForAdd(plan({ publishedAt: '2026-10-01T00:00:00.000Z' }), 'quest:stage1-life-q1')).toEqual({
      draft: { title: '', items: [{ kind: 'quest', id: 'quest:stage1-life-q1' }], targets: null, meta: null },
      added: true,
    });
  });

  it('never adds to a route draft (its items sit in weeks): a new draft holds the quest', () => {
    const meta = { weeks: [] } as unknown as CurriculumMeta;
    expect(draftForAdd(plan({ meta }), 'quest:stage1-life-q2').draft).toEqual({ title: '', items: [{ kind: 'quest', id: 'quest:stage1-life-q2' }], targets: null, meta: null });
  });

  it('reads a plan without meta as a classic plan', () => {
    const classic = { id: 'plan:2', title: 'Old', items: [] as PlanItem[], targetLearnerIds: null, publishedAt: null };
    expect(draftForAdd(classic, 'quest:stage1-life-q2').draft).toEqual({ id: 'plan:2', title: 'Old', items: [{ kind: 'quest', id: 'quest:stage1-life-q2' }], targets: null, meta: null });
  });
});
