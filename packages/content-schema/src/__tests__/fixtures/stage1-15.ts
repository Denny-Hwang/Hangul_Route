import type { RouteCatalog, RouteQuest } from '../../placement/route-seed';
import type { StageKey, ThemeKey } from '../../schemas/heritage-card';

/**
 * Test catalogs for the placement engine (F-PLC-001 P-3). The shipped app has 8
 * Stage 1 quests; F-QUEST-002 grows them to 15. These fixtures stand in for the
 * real bundle until F-QUEST-002 Q-6b lands. `order` is the global position on the route.
 */

const quest = (
  id: string,
  theme: ThemeKey,
  order: number,
  teaches: readonly string[],
  extra: Partial<RouteQuest> = {},
): RouteQuest => ({
  id: `quest:${id}`,
  episodeId: `episode:${id.replace(/-q\d+$/, '')}`,
  stage: 'stage1',
  theme,
  order,
  teaches,
  playable: true,
  grid: true,
  ...extra,
});

/** F-QUEST-002 section 3.6: the 15 Stage 1 quests and what each one teaches. */
export const STAGE1_15_QUESTS: readonly RouteQuest[] = [
  quest('stage1-letters-q1', 'letters', 1, ['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']),
  quest('stage1-letters-q2', 'letters', 2, ['ㅗ', 'ㅜ', 'ㅁ', 'ㅇ']),
  quest('stage1-letters-q3', 'letters', 3, ['ㅡ', 'ㅣ', 'ㄷ', 'ㄹ']),
  quest('stage1-life-q1', 'life', 4, ['ㅈ', 'ㅊ']),
  quest('stage1-life-q2', 'life', 5, ['ㅂ', 'ㅅ']),
  quest('stage1-life-q3', 'life', 6, ['ㅋ', 'ㅌ']),
  quest('stage1-rites-q1', 'rites', 7, ['ㄴ/final', 'ㄹ/final']),
  quest('stage1-rites-q2', 'rites', 8, ['ㅍ', 'ㅑ', 'ㅕ', 'ㅇ/final']),
  quest('stage1-rites-q3', 'rites', 9, ['ㅎ', 'ㅛ', 'ㅠ', 'ㄱ/final']),
  quest('stage1-nature-q1', 'nature', 10, ['ㅁ/final', 'ㅂ/final']),
  quest('stage1-nature-q2', 'nature', 11, []),
  quest('stage1-nature-q3', 'nature', 12, []),
  quest('stage1-crafts-q1', 'crafts', 13, []),
  quest('stage1-crafts-q2', 'crafts', 14, []),
  quest('stage1-crafts-q3', 'crafts', 15, []),
];

export const STAGE1_15: RouteCatalog = { quests: STAGE1_15_QUESTS };

/** Today's bundle: g n d l / m b s ng / six vowels, life x2, rites, nature, crafts. */
export const STAGE1_8: RouteCatalog = {
  quests: [
    quest('stage1-letters-q1', 'letters', 1, ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ']),
    quest('stage1-letters-q2', 'letters', 2, ['ㅁ', 'ㅂ', 'ㅅ', 'ㅇ']),
    quest('stage1-letters-q3', 'letters', 3, ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ']),
    quest('stage1-life-q1', 'life', 4, []),
    quest('stage1-life-q2', 'life', 5, []),
    quest('stage1-rites-q1', 'rites', 6, []),
    quest('stage1-nature-q1', 'nature', 7, []),
    quest('stage1-crafts-q1', 'crafts', 8, []),
  ],
};

const later = (id: string, stage: StageKey, theme: ThemeKey, order: number, extra: Partial<RouteQuest> = {}): RouteQuest => ({
  id: `quest:${id}`,
  episodeId: `episode:${id.replace(/-q\d+$/, '')}`,
  stage,
  theme,
  order,
  teaches: [],
  playable: true,
  grid: true,
  ...extra,
});

/** The 15 plus two Stage 2 quests, one Stage 4 taste quest and one shelf (non-grid) quest. */
export const FULL_ROUTE: RouteCatalog = {
  quests: [
    ...STAGE1_15_QUESTS,
    later('stage2-life-q1', 'stage2', 'life', 16),
    later('stage2-nature-q1', 'stage2', 'nature', 17),
    later('stage4-life-q1', 'stage4', 'life', 18),
    later('shelf-tiger-q1', 'stage2', 'nature', 19, { grid: false }),
  ],
};

export const ids = (quests: readonly RouteQuest[]): string[] => quests.map((q) => q.id);
export const q = (n: number): string => (STAGE1_15_QUESTS[n - 1] as RouteQuest).id;
export const qs = (...ns: number[]): string[] => ns.map(q);
