/**
 * Stage 1 catalog for the plan builder — F-PLAN-001 §3.5.
 * Mirrors `apps/mobile/src/content/{episodes,quests}.ts` (ids and titles
 * only); kept by hand until a shared content loader exists. Learner devices
 * resolve ids against their own bundle, so an id unknown to an older app is
 * simply reported as "not ready".
 */
export type CatalogTheme = 'letters' | 'life' | 'rites' | 'nature' | 'crafts';

export interface CatalogQuest {
  id: string;
  titleEn: string;
  estimatedMinutes: number;
}

export interface CatalogEpisode {
  id: string;
  theme: CatalogTheme;
  order: number;
  titleEn: string;
  questIds: string[];
}

export const stage1Quests: CatalogQuest[] = [
  { id: 'quest:stage1-letters-q1', titleEn: 'Meet g, n, d, l', estimatedMinutes: 4 },
  { id: 'quest:stage1-letters-q2', titleEn: 'Meet m, b, s, ng', estimatedMinutes: 4 },
  { id: 'quest:stage1-letters-q3', titleEn: 'Meet the Vowels', estimatedMinutes: 5 },
  { id: 'quest:stage1-life-q1', titleEn: 'Hello Kimchi & Rice', estimatedMinutes: 5 },
  { id: 'quest:stage1-life-q2', titleEn: 'Family at the Table', estimatedMinutes: 5 },
  { id: 'quest:stage1-rites-q1', titleEn: 'Bow & Eat Tteokguk', estimatedMinutes: 5 },
  { id: 'quest:stage1-nature-q1', titleEn: 'Tiger, Magpie, Moon', estimatedMinutes: 5 },
  { id: 'quest:stage1-crafts-q1', titleEn: 'Yut, Kite, Top', estimatedMinutes: 5 },
];

export const stage1Episodes: CatalogEpisode[] = [
  { id: 'episode:stage1-letters', theme: 'letters', order: 1, titleEn: 'Meet the Letters', questIds: ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3'] },
  { id: 'episode:stage1-life', theme: 'life', order: 2, titleEn: 'Around the Korean Table', questIds: ['quest:stage1-life-q1', 'quest:stage1-life-q2'] },
  { id: 'episode:stage1-rites', theme: 'rites', order: 3, titleEn: 'New Year & Festivals', questIds: ['quest:stage1-rites-q1'] },
  { id: 'episode:stage1-nature', theme: 'nature', order: 4, titleEn: 'Tigers, Mountains, Moon', questIds: ['quest:stage1-nature-q1'] },
  { id: 'episode:stage1-crafts', theme: 'crafts', order: 5, titleEn: 'Yut, Kites & Paper', questIds: ['quest:stage1-crafts-q1'] },
];

const questById = new Map(stage1Quests.map((q) => [q.id, q]));
const episodeById = new Map(stage1Episodes.map((e) => [e.id, e]));

/** A readable label for a plan item; unknown ids fall back to the id itself. */
export function catalogLabel(kind: 'quest' | 'episode', id: string): string {
  if (kind === 'quest') return questById.get(id)?.titleEn ?? id;
  const episode = episodeById.get(id);
  return episode ? `${episode.titleEn} (${episode.questIds.length} quest${episode.questIds.length === 1 ? '' : 's'})` : id;
}

export function questsOf(episodeId: string): CatalogQuest[] {
  return (episodeById.get(episodeId)?.questIds ?? []).map((id) => questById.get(id)).filter((q): q is CatalogQuest => !!q);
}
