import type { DiscoverItem, Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';

/** Shared builders for the Stage 1 logic tests (test-only). */

export function jamoItem(jamoId: string): DiscoverItem {
  return {
    type: 'jamo',
    jamoId,
    example: { ko: '가', romanization: 'ga', en: 'ga' },
  };
}

export function wordItem(): DiscoverItem {
  return { type: 'word', word: { ko: '차', romanization: 'cha', en: 'tea' } };
}

/** A six-step quest whose Discover step teaches `taught` (two per page). */
export function discoverQuest(id: string, taught: string[], extra: Partial<Quest> = {}): Quest {
  const pages: Array<{ items: DiscoverItem[] }> = [];
  for (let i = 0; i < taught.length; i += 2) {
    pages.push({ items: taught.slice(i, i + 2).map(jamoItem) });
  }
  if (pages.length === 0) pages.push({ items: [wordItem()] });
  return {
    id,
    titleEn: `Title ${id}`,
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Hi' },
      { id: 's2', kind: 'discover', titleEn: 'Learn', discover: { pages } },
      { id: 's3', kind: 'practice', titleEn: 'Play', minigameKind: 'match-sound', minigameRef: `minigame:${id}-play` },
      { id: 's6', kind: 'reward', titleEn: 'Yay' },
    ],
    ...extra,
  };
}

export function plainQuest(id: string): Quest {
  return {
    id,
    titleEn: `Title ${id}`,
    estimatedMinutes: 4,
    steps: [
      { id: 's1', kind: 'intro', titleEn: 'Hi' },
      { id: 's2', kind: 'practice', titleEn: 'Play' },
      { id: 's3', kind: 'reward', titleEn: 'Yay' },
    ],
  };
}

export function episodeOf(
  id: string,
  questIds: string[],
  overrides: Partial<Episode> = {},
): Episode {
  return {
    id,
    stage: 'stage1',
    theme: 'letters',
    order: 1,
    titleEn: `Episode ${id}`,
    hoyaIntroEn: 'Hello!',
    questIds,
    rewardCardIds: [],
    estimatedMinutes: 10,
    status: 'shipped',
    ...overrides,
  };
}

export function snapshotWith(
  done: Array<{ questId: string; episodeId: string; stars?: 0 | 1 | 2 | 3 }>,
  inProgress: Array<{ questId: string; episodeId: string }> = [],
): ProgressSnapshot {
  return {
    profileId: 'profile:p1',
    updatedAt: '2026-10-10T09:00:00.000Z',
    episodes: [],
    quests: [
      ...done.map((d) => ({
        questId: d.questId,
        episodeId: d.episodeId,
        startedAt: '2026-10-10T08:00:00.000Z',
        completedAt: '2026-10-10T08:05:00.000Z',
        stars: d.stars ?? 3,
        attempts: 1,
        accuracy: 1,
      })),
      ...inProgress.map((d) => ({
        questId: d.questId,
        episodeId: d.episodeId,
        startedAt: '2026-10-10T08:00:00.000Z',
        stars: 0 as const,
        attempts: 1,
        accuracy: 0,
      })),
    ],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 1,
  };
}
