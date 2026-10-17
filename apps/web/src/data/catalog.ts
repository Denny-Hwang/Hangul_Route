import { CATALOG, cellIsReady, storyIsReady, type Catalog, type CatalogCell, type CatalogQuest, type PlanItem } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';
import { CATALOGUE_TITLES } from './catalogue-titles.generated';

/**
 * The console's view of the shared catalogue (F-PLAN-002 section 3.2): the plan builder,
 * the curriculum wizard and the readout read titles and quest lists from
 * `@hangul-route/content-schema`'s `CATALOG`, the same data the generator and the app use,
 * guarded by `apps/mobile/src/content/__tests__/catalog-parity.test.ts`. This adapter
 * replaces the hand-kept Stage 1 mirror (`stage1-catalog.ts`) and keeps its helper names.
 * Titles are content (F-I18N-001 section 3.6): `catalogTitle` draws them in the console's UI
 * language from the generated `CATALOGUE_TITLES` (content/i18n overlays, built by
 * `scripts/build-lecture-catalogue.mjs`), falling back to CATALOG's English (owner report
 * 2026-10-16: the plan builder, the curriculum, the readout, the lecture page and the reports
 * showed English titles in the es and ko console). The words around them come from the locale.
 * Learner devices resolve ids against their own bundle, so an id unknown to an older app is
 * reported there as "not ready".
 */

export type ItemCategory = 'lesson' | 'story' | 'coming-soon' | 'unknown';

type ItemKind = PlanItem['kind'];

const indexes = new WeakMap<Catalog, { quests: Map<string, CatalogQuest>; cells: Map<string, CatalogCell> }>();

function indexOf(source: Catalog): { quests: Map<string, CatalogQuest>; cells: Map<string, CatalogCell> } {
  let index = indexes.get(source);
  if (!index) {
    index = { quests: new Map(source.quests.map((q) => [q.id, q])), cells: new Map(source.cells.map((c) => [c.episodeId, c])) };
    indexes.set(source, index);
  }
  return index;
}

/** CATALOG's English title of a content id: an episode, a quest, a story, or a word topic (`topic:<key>` or `vocab-topic:<key>`). */
function englishTitle(id: string, source: Catalog): string | null {
  const index = indexOf(source);
  if (id.startsWith('quest:')) return index.quests.get(id)?.title ?? null;
  if (id.startsWith('episode:')) return index.cells.get(id)?.title ?? null;
  if (id.startsWith('story:')) return source.stories.find((s) => s.id === id)?.title ?? null;
  const key = id.startsWith('vocab-topic:') ? id.slice('vocab-topic:'.length) : id.startsWith('topic:') ? id.slice('topic:'.length) : null;
  return key === null ? null : (source.topics.find((t) => t.key === key)?.title ?? null);
}

/** The overlay key of an id: the deck and the overlays name a topic `vocab-topic:<key>`, CATALOG names it `topic:<key>`. */
const overlayId = (id: string): string => (id.startsWith('topic:') ? `vocab-topic:${id.slice('topic:'.length)}` : id);

/**
 * A content title in `locale` and whether it fell back: the overlay title in es and ko, else
 * CATALOG's English (`fallback: true` in a non-English locale, the marker tests read), else
 * the id itself (`fallback: true`).
 */
export function catalogTitleEntry(id: string, locale: UiLocale, source: Catalog = CATALOG): { title: string; fallback: boolean } {
  const english = englishTitle(id, source);
  const local = locale === 'en' ? undefined : CATALOGUE_TITLES[locale]?.[overlayId(id)];
  if (local !== undefined && english !== null) return { title: local, fallback: false };
  return { title: english ?? id, fallback: english === null || locale !== 'en' };
}

/** A content title in the console's UI language, falling back to English, then to the id (owner report 2026-10-16). */
export function catalogTitle(id: string, locale: UiLocale = DEFAULT_LOCALE, source: Catalog = CATALOG): string {
  return catalogTitleEntry(id, locale, source).title;
}

/** The title of a plan item (a quest, a story's listen quest or an episode) in `locale`; the id itself when unknown. */
export function itemTitle(kind: ItemKind, id: string, source: Catalog = CATALOG, locale: UiLocale = DEFAULT_LOCALE): string {
  const index = indexOf(source);
  const known = kind === 'quest' ? index.quests.has(id) : index.cells.has(id);
  return known ? catalogTitle(id, locale, source) : id;
}

/** What a plan item is: a lesson, a heritage story, an episode that is not released yet, or an id this build does not know. */
export function itemCategory(kind: ItemKind, id: string, source: Catalog = CATALOG): ItemCategory {
  const index = indexOf(source);
  if (kind === 'quest') {
    const quest = index.quests.get(id);
    return quest === undefined ? 'unknown' : quest.kind === 'story' ? 'story' : 'lesson';
  }
  const cell = index.cells.get(id);
  return cell === undefined ? 'unknown' : cellIsReady(cell) ? 'lesson' : 'coming-soon';
}

/** A readable label for a plan item in `locale`: "Meet the Letters (3 quests)", "Word Builder (coming soon)"; unknown ids fall back to the id. */
export function catalogLabel(kind: ItemKind, id: string, locale: UiLocale = DEFAULT_LOCALE, source: Catalog = CATALOG): string {
  if (kind === 'quest') return itemTitle('quest', id, source, locale);
  const cell = indexOf(source).cells.get(id);
  if (!cell) return id;
  const words = getMessages(locale).console;
  const title = catalogTitle(id, locale, source);
  return cellIsReady(cell) ? words.plan.catalog.episodeLabel(title, cell.questIds.length) : words.curriculum.catalog.comingSoon(title);
}

/**
 * Whether the plan builder may add this quest from an address (F-REPORT-001 RP-10, `&add=<questId>`): a lesson quest
 * of a released episode, or the listen quest of a signed story. An unknown id, an episode id and a closed quest (its
 * episode not released, its story not signed) are refused, so a link never puts in a plan what a learner cannot open.
 */
export function plannableQuest(id: string, source: Catalog = CATALOG): boolean {
  const quest = indexOf(source).quests.get(id);
  if (quest === undefined) return false;
  if (quest.kind === 'story') return source.stories.some((story) => story.questId === id && storyIsReady(story));
  const cell = indexOf(source).cells.get(quest.episodeId);
  return cell !== undefined && cellIsReady(cell);
}

