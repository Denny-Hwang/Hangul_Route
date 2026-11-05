import { CATALOG, addDays, weekdayOf, type Catalog, type PlanItem, type Weekday } from '@hangul-route/content-schema';
import { placePractice, type PlaceItem } from '@hangul-route/content-schema/blend';
import type { DeriveSource } from '../homework/plan-derivation';

/**
 * The device half of `placePractice` (AMENDMENTS-ROUTE-CLASS-BLEND section 9.4, row BL-8): one blended class plan
 * re-dated to the learner's own practice days, from the day they took effect on (`placementFrom`), on the device
 * only. Item minutes and cells come from the shipped catalogue (a lesson quest's cell is its episode; an episode item
 * is its own cell). Only the practice-days chunk imports this module, so the `blend` subpath stays out of the start
 * bundle.
 */

type Placeable = PlanItem & PlaceItem;

function placeableOf(item: PlanItem, catalog: Catalog): Placeable {
  if (item.kind === 'episode') {
    const cell = catalog.cells.find((c) => c.episodeId === item.id);
    return { ...item, minutes: cell?.minutes ?? 0, cellId: item.id };
  }
  const quest = catalog.quests.find((q) => q.id === item.id);
  return { ...item, minutes: quest?.minutes ?? 0, ...(quest === undefined ? {} : { cellId: quest.episodeId }) };
}

/** The plan item back, with only its date changed. */
function backToItem(placed: Placeable, item: PlanItem): PlanItem {
  return placed.targetDate === item.targetDate || placed.targetDate === undefined ? item : { ...item, targetDate: placed.targetDate };
}

/** The route's last day (section 6.3): the first class day on or after the start, plus `weeks` whole weeks, less a day. */
function routeEnd(startDate: string, weeks: number, classDays: readonly Weekday[]): string {
  let first = startDate;
  for (let i = 0; i < 7 && !classDays.includes(weekdayOf(first)); i += 1) first = addDays(first, 1);
  return addDays(first, 7 * weeks - 1);
}

export function placeSourceForLearner(source: DeriveSource, days: readonly Weekday[], from: string, catalog: Catalog = CATALOG): DeriveSource {
  const meta = source.meta;
  const blend = meta?.params.blend;
  if (meta === null || meta === undefined || blend === undefined) return source;
  const { params } = meta;
  const lastItem = source.items.reduce((top, item) => (item.targetDate !== undefined && item.targetDate > top ? item.targetDate : top), '');
  const end = routeEnd(params.startDate, params.weeks, blend.lecture.days);
  const placed = placePractice(
    source.items.map((item) => placeableOf(item, catalog)),
    meta.refresh ?? [],
    days,
    {
      classDays: blend.lecture.days,
      budget: blend.personal.minutes,
      from,
      endDate: lastItem > end ? lastItem : end,
      isDayOff: (date) => params.daysOff.some((range) => range.from <= date && date <= range.to),
    },
  );
  const items = source.items.map((item, i) => backToItem(placed.items[i] as Placeable, item));
  const hadRefresh = meta.refresh !== undefined;
  return { ...source, items, meta: { ...meta, ...(hadRefresh || placed.refresh.length > 0 ? { refresh: placed.refresh } : {}) } };
}
