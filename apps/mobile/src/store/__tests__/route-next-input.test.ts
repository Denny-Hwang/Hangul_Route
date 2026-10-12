import type { InboxPlan, ProgressSnapshot } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

import { episodesAll, questsAll } from '../../content';
import { routeNext } from '../../logic/route-next';
import { usePlanStore } from '../plan-store';
import { useProgressStore } from '../progress-store';
import { routeNextInputFor } from '../route-next-input';
import { useTierStore } from '../tier-store';

const now = new Date('2026-10-12T12:00:00.000Z');
const L = 'profile:kid';
const first = questsAll[0]!.id;
const second = questsAll[1]!.id;
const episodeOf = (questId: string): string => episodesAll.find((e) => e.questIds.includes(questId))!.id;

const snapshot = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  profileId: L,
  updatedAt: 't',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
  ...over,
});

beforeEach(() => {
  mem.clear();
  useProgressStore.setState({ byProfile: {} });
  usePlanStore.setState({ byLearner: {}, notReady: {} });
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
});

describe('routeNextInputFor (F-ENT-003 E3-4): the stores read the same way on every screen', () => {
  it('with nothing stored: an empty snapshot, no plan, the default route from the first quest', () => {
    const input = routeNextInputFor(L, now);
    expect(input.profileId).toBe(L);
    expect(input.today).toBe('2026-10-12');
    expect(input.sources).toEqual([]);
    expect(input.snapshot.quests).toEqual([]);
    expect(input.gating).toEqual({ active: false, tier: 'free' });
    expect(routeNext(input)).toMatchObject({ kind: 'quest', questId: first, source: 'cursor' });
  });

  it('reads the snapshot and the cached plans of that learner', () => {
    const plan: InboxPlan = {
      id: 'plan:cls',
      spaceId: 'space:c',
      spaceKind: 'class',
      spaceName: 'Class',
      title: 'Week',
      items: [{ kind: 'quest', id: second }],
      publishedAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    useProgressStore.setState({
      byProfile: {
        [L]: snapshot({
          homework: [
            { id: `plan:cls#${second}`, profileId: L, questId: second, episodeId: episodeOf(second), assignedBy: 'teacher', assignedAt: '2026-10-01T00:00:00.000Z', targetDate: '2026-10-15' },
          ],
        }),
      },
    });
    usePlanStore.setState({ byLearner: { [L]: [plan] }, notReady: {} });
    const input = routeNextInputFor(L, now);
    expect(input.sources.map((s) => s.id)).toEqual(['plan:cls']);
    expect(routeNext(input)).toMatchObject({ questId: second, source: 'class', sourceId: 'plan:cls' });
  });
});
