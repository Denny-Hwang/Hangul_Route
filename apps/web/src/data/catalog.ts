import { CATALOG, ThemeKeySchema, cellIsReady, type Catalog, type CatalogCell, type CatalogQuest, type PlanItem, type StageKey } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * The console's view of the shared catalogue (F-PLAN-002 section 3.2): the plan builder,
 * the curriculum wizard and the readout read titles and quest lists from
 * `@hangul-route/content-schema`'s `CATALOG`, the same data the generator and the app use,
 * guarded by `apps/mobile/src/content/__tests__/catalog-parity.test.ts`. This adapter
 * replaces the hand-kept Stage 1 mirror (`stage1-catalog.ts`) and keeps its helper names.
 * Titles are content (F-I18N-001 section 3.6); the words around them come from the locale.
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

/** The plain title of a plan item (a quest, a story's listen quest or an episode); the id itself when unknown. */
export function itemTitle(kind: ItemKind, id: string, source: Catalog = CATALOG): string {
  const index = indexOf(source);
  return (kind === 'quest' ? index.quests.get(id)?.title : index.cells.get(id)?.title) ?? id;
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
export function catalogLabel(kind: ItemKind, id: string, locale: UiLocale = DEFAULT_LOCALE): string {
  if (kind === 'quest') return itemTitle('quest', id);
  const cell = indexOf(CATALOG).cells.get(id);
  if (!cell) return id;
  const words = getMessages(locale).console;
  return cellIsReady(cell) ? words.plan.catalog.episodeLabel(cell.title, cell.questIds.length) : words.curriculum.catalog.comingSoon(cell.title);
}

/** The quests of an episode, in the cell's own order (empty for an episode that is not released yet). */
export function questsOf(episodeId: string): CatalogQuest[] {
  const index = indexOf(CATALOG);
  return (index.cells.get(episodeId)?.questIds ?? []).map((id) => index.quests.get(id)).filter((q): q is CatalogQuest => q !== undefined);
}

/** The ready episodes of one stage in grid (theme) order: the plan builder's catalogue panel (Stage 1 by default, as before). */
export function builderEpisodes(stage: StageKey = 'stage1'): CatalogCell[] {
  const rank = (cell: CatalogCell): number => ThemeKeySchema.options.indexOf(cell.theme);
  return CATALOG.cells.filter((cell) => cell.stage === stage && cellIsReady(cell)).sort((a, b) => rank(a) - rank(b));
}
