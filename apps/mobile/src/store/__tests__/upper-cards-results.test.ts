import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  removeKey: vi.fn(async () => undefined),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: vi.fn(() => () => undefined), isAppVisible: () => true }));
vi.mock('../../platform/sync-api', () => ({ apiBaseUrl: () => null }));

import { episodesAll } from '../../content/episodes';
import { questsAll } from '../../content/quests';
import { applyQuestResult, type QuestResultOutcome } from '../../logic/results-award';
import { useProfileStore } from '../profile-store';
import { resetRemoteConfigForTests, useRemoteConfigStore } from '../remote-config-store';
import { awardWorldOf, useProgressStore } from '../progress-store';
import { wireUpperCards } from '../upper-cards-wiring';

/**
 * The live Results path of the upper-cell card (F-CURR-002 §7.2 and §12.2, row CM-23): the last quest of a cell brings
 * its card on Results while `upperCards` is on for the learner, dated by the cell's first finishes, and brings none
 * while it is off. Wired the way ResultsScreen and App wire it (`world: awardWorldOf(...)`, `wireUpperCards()`).
 */
const ID = 'p1';
const CREATED = '2026-09-01T08:00:00.000Z';
const LETTERS = episodesAll.find((e) => e.id === 'episode:stage2-letters')!;
const flags = (pct: number) => ({ v: 1 as const, fetchedAt: Date.now(), maxAgeS: 300, flags: { upperCards: { on: true, pct } } });

function visit(questId: string): QuestResultOutcome {
  const s = useProgressStore.getState();
  const quest = questsAll.find((q) => q.id === questId);
  return applyQuestResult(
    { profileId: ID, profileCreatedAt: CREATED, questId, episodeId: LETTERS.id, rewardCardId: quest?.rewardCardId, stars: 2, correct: 2, total: 3, retries: 0 },
    {
      world: awardWorldOf(ID, useProgressStore.getState().byProfile[ID]?.cards),
      isHydrated: (id) => useProgressStore.getState().hydratedFor.has(id),
      snapshot: (id) => useProgressStore.getState().byProfile[id],
      recordQuestComplete: s.recordQuestComplete,
      unlockCards: s.unlockCards,
      recordCatchUp: s.recordCatchUp,
      track: vi.fn(),
    },
  );
}

/** Every quest of Word Builder in order; the outcome of the last. */
function finishCell(): QuestResultOutcome {
  let last: QuestResultOutcome | null = null;
  for (const q of LETTERS.questIds) last = visit(q);
  return last!;
}

const held = (): string[] => (useProgressStore.getState().byProfile[ID]?.cards ?? []).map((c) => c.cardId);

let unwire: () => void = () => undefined;
afterEach(() => unwire());

beforeEach(() => {
  resetRemoteConfigForTests();
  unwire = wireUpperCards();
  useProfileStore.setState({
    profiles: [{ id: ID, displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: CREATED }],
    activeId: ID,
    hydrated: true,
  });
  useProgressStore.setState({ byProfile: {}, hydratedFor: new Set([ID]), pendingFor: new Set(), catchUp: {}, catchUpFound: {} });
  useProgressStore.getState().ensure(ID);
});

describe('Results: the upper-cell card of the cell just finished (row CM-23)', () => {
  it('upperCards on: the last quest of Word Builder shows Song on Results, dated by the cell’s first finishes', () => {
    useRemoteConfigStore.setState({ cache: flags(100), hydrated: true });
    const last = finishCell();
    expect(last.episodeCompleted).toBe(LETTERS.id);
    expect(last.extras.map((e) => e.cardId)).toContain('card:norae');
    expect(last.extras.find((e) => e.cardId === 'card:norae')?.source).toBe('episode');
    const snap = useProgressStore.getState().byProfile[ID]!;
    const firsts = LETTERS.questIds.map((q) => snap.questDoneAt?.[q]).filter((t): t is string => t !== undefined);
    const latestFirst = firsts.sort().at(-1);
    expect(snap.cards.find((c) => c.cardId === 'card:norae')?.unlockedAt).toBe(latestFirst);
  });

  it('upperCards off (built-in pct 0): the same finish shows no upper-cell card and holds none', () => {
    useRemoteConfigStore.setState({ cache: flags(0), hydrated: true });
    const last = finishCell();
    expect(last.episodeCompleted).toBe(LETTERS.id);
    expect(last.extras.map((e) => e.cardId)).not.toContain('card:norae');
    expect(held()).not.toContain('card:norae');
  });

  it('a cold start (no copy read yet) reads off: no card', () => {
    const last = finishCell();
    expect(last.extras.map((e) => e.cardId)).not.toContain('card:norae');
  });
});
