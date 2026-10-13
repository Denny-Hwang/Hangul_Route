import { describe, expect, it } from 'vitest';
import { GROWTH_BOX, growthChart } from '../report-growth';

/** F-REPORT-001 RP-7b: the All-time growth line's drawing (design `learner-report.md`, "All time: the growth block"). */

const rows = [
  { m: '2026-08', label: 'August 2026', quests: 1, cards: 1 },
  { m: '2026-09', label: 'September 2026', quests: 3, cards: 3 },
  { m: '2026-10', label: 'October 2026', quests: 7, cards: 5 },
];

describe('growthChart: two cumulative lines in a 300 x 150 box', () => {
  it('puts one point per month at the centre of equal columns, so the HTML month labels sit under them', () => {
    const chart = growthChart(rows);
    expect(chart.quests.map((p) => p.x)).toEqual([50, 150, 250]);
    expect(chart.cards.map((p) => p.x)).toEqual([50, 150, 250]);
    expect(GROWTH_BOX).toEqual({ width: 300, height: 150 });
  });

  it('scales both lines to the larger latest value: the top one reaches the top padding, zero sits on the bottom', () => {
    const chart = growthChart(rows);
    const top = chart.quests[2]?.y ?? NaN;
    expect(top).toBe(chart.top);
    expect(chart.cards[2]?.y).toBeGreaterThan(top);
    const zero = growthChart([{ quests: 0, cards: 0 }]);
    expect(zero.quests[0]?.y).toBe(zero.bottom);
  });

  it('a line only rises: y never grows from one month to the next (OD-10)', () => {
    const chart = growthChart(rows);
    for (const line of [chart.quests, chart.cards]) {
      for (let i = 1; i < line.length; i += 1) expect(line[i]?.y).toBeLessThanOrEqual(line[i - 1]?.y ?? Infinity);
    }
  });

  it('draws recessive grid lines between top and bottom, and an SVG points string per line', () => {
    const chart = growthChart(rows);
    expect(chart.grid.length).toBeGreaterThanOrEqual(2);
    expect(chart.grid[0]).toBe(chart.top);
    expect(chart.grid[chart.grid.length - 1]).toBe(chart.bottom);
    expect(chart.questsPoints).toBe(chart.quests.map((p) => `${p.x},${p.y}`).join(' '));
  });

  it('a single month is one centred point; no months draw nothing', () => {
    expect(growthChart(rows.slice(2)).quests).toEqual([{ x: 150, y: expect.any(Number) }]);
    expect(growthChart([]).quests).toEqual([]);
    expect(growthChart([]).questsPoints).toBe('');
  });
});
