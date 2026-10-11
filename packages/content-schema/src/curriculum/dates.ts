import type { PlanItem } from '../schemas/plan';

/**
 * Pure date helpers shared by the console plan builder and the curriculum
 * generator (F-PLAN-001 §3.5, F-PLAN-002 §3.3). All arithmetic is on UTC
 * `YYYY-MM-DD` date keys, so results do not depend on the host time zone.
 */
const DAY_MS = 86_400_000;

export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return dateKey(new Date(Date.UTC(y, m - 1, d) + days * DAY_MS));
}

/**
 * Even spacing from `start` at `perWeek` items a week, never two on the
 * same day (F-HW-001 §3.4: one explicit item per day per source).
 */
export function spreadDates(start: string, perWeek: number, count: number): string[] {
  const step = 7 / Math.max(1, Math.min(7, perWeek));
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    let next = addDays(start, Math.round(i * step));
    const prev = out[out.length - 1];
    if (prev && next <= prev) next = addDays(prev, 1);
    out.push(next);
  }
  return out;
}

export interface SpacedItems {
  items: PlanItem[];
  moved: number;
}

/** Later items that collide on a date slide to the next free day, in list order. */
export function oneExplicitPerDay(items: readonly PlanItem[]): SpacedItems {
  const used = new Set<string>();
  let moved = 0;
  const out = items.map((item) => {
    if (!item.targetDate) return item;
    let date = item.targetDate;
    while (used.has(date)) date = addDays(date, 1);
    used.add(date);
    if (date !== item.targetDate) moved += 1;
    return date === item.targetDate ? item : { ...item, targetDate: date };
  });
  return { items: out, moved };
}
