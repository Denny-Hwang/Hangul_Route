import { z } from 'zod';
import type { ThemeKey } from './schemas/heritage-card';

/** Shared by lint, mobile and web (F-STORY-005 §3.2). */
export const PillarTagSchema = z.string().regex(/^[A-E][1-9]$/); // 'A1' .. 'E9'; must exist in PILLAR_TAGS (lint)
export type PillarTagId = z.infer<typeof PillarTagSchema>;

export const CompanionIdSchema = z.enum(['hoya']); // 'hoya' only until F-STORY-005 §3.7 unlocks more
export type CompanionId = z.infer<typeof CompanionIdSchema>;

export const CatalogueFieldsSchema = z.object({
  pillarTags: z.array(PillarTagSchema).max(3).default([]), // first = primary; no duplicates
  companionId: CompanionIdSchema.default('hoya'),
});
export type CatalogueFields = z.infer<typeof CatalogueFieldsSchema>;

export type Pillar = 'A' | 'B' | 'C' | 'D' | 'E';

/** One blueprint 04 sub-theme. Romanization is generated (F-CNT-002), never typed. */
export interface PillarTag {
  id: string;
  pillar: Pillar;
  ko: string;
  en: string;
}

/**
 * Pillar registry (F-STORY-005 §3.8): blueprint 04 §2.3's 23 sub-themes
 * (`docs/blueprints/04-main-content-outline.md:175-211`, Korean verbatim) plus
 * the proposed D5 (owner to confirm). One list for the importer, lint, app and
 * console. Tags are catalogue metadata: never shown to learners, never a grid axis.
 */
export const PILLAR_TAGS: readonly PillarTag[] = Object.freeze([
  { id: 'A1', pillar: 'A', ko: '훈민정음', en: 'The creation of Hangul' },
  { id: 'A2', pillar: 'A', ko: '팔만대장경', en: 'The Tripitaka Koreana woodblocks' },
  { id: 'A3', pillar: 'A', ko: '조선왕조실록', en: 'The Annals of the Joseon Dynasty' },
  { id: 'A4', pillar: 'A', ko: '승정원일기', en: 'The Diaries of the Royal Secretariat' },
  { id: 'A5', pillar: 'A', ko: '직지심체요절', en: 'Jikji and metal movable type' },
  { id: 'B1', pillar: 'B', ko: '김홍도의 시장', en: 'Market life in the paintings of Kim Hongdo' },
  { id: 'B2', pillar: 'B', ko: '신윤복의 도시', en: 'Town life in the paintings of Sin Yunbok' },
  { id: 'B3', pillar: 'B', ko: '농촌의 사계절', en: 'Four seasons in a farming village' },
  { id: 'B4', pillar: 'B', ko: '한복과 옷차림', en: 'Hanbok and clothing' },
  { id: 'B5', pillar: 'B', ko: '명절과 세시풍속', en: 'Holidays and seasonal customs' },
  { id: 'C1', pillar: 'C', ko: '종묘제례', en: 'The Jongmyo royal ancestral rite' },
  { id: 'C2', pillar: 'C', ko: '궁궐의 하루', en: 'A day at the royal palace' },
  { id: 'C3', pillar: 'C', ko: '판소리 마당', en: 'Pansori storytelling' },
  { id: 'C4', pillar: 'C', ko: '무형문화재', en: 'Intangible cultural heritage' },
  { id: 'D1', pillar: 'D', ko: '한옥마을', en: 'Hanok villages' },
  { id: 'D2', pillar: 'D', ko: '산과 강', en: 'Mountains and rivers' },
  { id: 'D3', pillar: 'D', ko: '사찰과 서원', en: 'Buddhist temples and Confucian academies' },
  { id: 'D4', pillar: 'D', ko: '정원과 정자', en: 'Gardens and pavilions' },
  { id: 'D5', pillar: 'D', ko: '옛이야기', en: 'Traditional tales' },
  { id: 'E1', pillar: 'E', ko: '한지와 붓', en: 'Hanji paper and brushes' },
  { id: 'E2', pillar: 'E', ko: '도자기 만들기', en: 'Making pottery' },
  { id: 'E3', pillar: 'E', ko: '측우기와 자격루', en: 'The rain gauge and the self-striking water clock' },
  { id: 'E4', pillar: 'E', ko: '동의보감', en: 'Donguibogam (Principles and Practice of Eastern Medicine)' },
  { id: 'E5', pillar: 'E', ko: '천문과 우주', en: 'Astronomy and the sky' },
] satisfies PillarTag[]);

const PILLAR_TAG_IDS: ReadonlySet<string> = new Set(PILLAR_TAGS.map((t) => t.id));

/** Registry membership (the regex alone admits 'A9'). */
export const isPillarTag = (id: string): boolean => PILLAR_TAG_IDS.has(id);

/** A suggestion for authors only: an episode's grid theme is its own field (a Dano story is B5 but `rites`). */
export const PILLAR_HOME_THEME = { A: 'letters', B: 'life', C: 'rites', D: 'nature', E: 'crafts' } as const satisfies Record<
  Pillar,
  ThemeKey
>;

/**
 * The two tag rules shared by the episode refinement and the story lint:
 * every tag is in `PILLAR_TAGS`, none is listed twice. Index = position in the list.
 */
export function pillarTagProblems(
  tags: readonly string[],
): Array<{ index: number; rule: 'pillar-tag-unknown' | 'pillar-tag-duplicate'; tag: string }> {
  const seen = new Set<string>();
  const problems: Array<{ index: number; rule: 'pillar-tag-unknown' | 'pillar-tag-duplicate'; tag: string }> = [];
  tags.forEach((tag, index) => {
    if (seen.has(tag)) problems.push({ index, rule: 'pillar-tag-duplicate', tag });
    else if (!isPillarTag(tag)) problems.push({ index, rule: 'pillar-tag-unknown', tag });
    seen.add(tag);
  });
  return problems;
}
