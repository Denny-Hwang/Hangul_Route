/**
 * The All-time growth line's drawing (F-REPORT-001 RP-7b, section 3.5 item 9; design `design/screens/reports/
 * learner-report.md`, "All time: the growth block"): two cumulative lines, quests and cards, one point per month at the
 * centre of equal columns (so the HTML month labels sit under them), in a fixed `viewBox` that scales to the column.
 * Pure geometry: no words, no colours. A cumulative line only rises (OD-10), so neither line ever drops; there are no
 * y-axis numbers (the legend and the table carry the values).
 */

/** The SVG drawing box (design README, Constants: "Growth chart drawing box 300 x 150"). */
export const GROWTH_BOX = { width: 300, height: 150 } as const;
/** Room above the highest point and below zero, so the 8 px markers are never cut. */
const PAD = 12;
/** Grid lines from the top padding to the zero line. */
const GRID_LINES = 4;

export interface GrowthPoint {
  x: number;
  y: number;
}

export interface GrowthChart {
  quests: GrowthPoint[];
  cards: GrowthPoint[];
  /** `points` attributes of the two polylines. */
  questsPoints: string;
  cardsPoints: string;
  /** The y of each recessive horizontal grid line, top first, the zero line last. */
  grid: number[];
  top: number;
  bottom: number;
}

const round = (value: number): number => Math.round(value * 100) / 100;

export function growthChart(rows: readonly { quests: number; cards: number }[]): GrowthChart {
  const top = PAD;
  const bottom = GROWTH_BOX.height - PAD;
  const max = Math.max(1, ...rows.map((row) => Math.max(row.quests, row.cards)));
  const column = rows.length > 0 ? GROWTH_BOX.width / rows.length : GROWTH_BOX.width;
  const pointOf = (value: number, index: number): GrowthPoint => ({ x: round(column * index + column / 2), y: round(bottom - (Math.max(0, value) / max) * (bottom - top)) });
  const quests = rows.map((row, index) => pointOf(row.quests, index));
  const cards = rows.map((row, index) => pointOf(row.cards, index));
  const pointsOf = (line: GrowthPoint[]): string => line.map((p) => `${p.x},${p.y}`).join(' ');
  const grid = Array.from({ length: GRID_LINES }, (_, index) => round(top + ((bottom - top) * index) / (GRID_LINES - 1)));
  return { quests, cards, questsPoints: pointsOf(quests), cardsPoints: pointsOf(cards), grid, top, bottom };
}

/**
 * The most month labels the axis carries. Up to 24 months fit the chart's equal columns, but at 320 px a label per
 * month would overlap its neighbours, so past this many months only every nth month is labelled (the table names
 * every month with its year).
 */
export const GROWTH_AXIS_LABELS = 6;

/** Which months carry their short label under the chart: all up to the cap, then every nth counted back from the latest. */
export function growthAxisShown(count: number): boolean[] {
  const step = Math.max(1, Math.ceil(count / GROWTH_AXIS_LABELS));
  return Array.from({ length: count }, (_, index) => (count - 1 - index) % step === 0);
}
