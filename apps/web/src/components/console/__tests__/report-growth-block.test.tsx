import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ReportGrowthView } from '@/lib/console/report-view';
import { ReportGrowthBlock } from '../ReportParts';

/**
 * The All-time growth block's legend (F-REPORT-001 RP-7b; #511/#513/#522 follow-up 3): with chart rows the legend
 * repeats what the chart and table say, so it stays out of the accessibility tree; with no month rows it is the only
 * place the baseline totals appear, so assistive technology reads it.
 */

const growth = (rows: ReportGrowthView['rows'], latest = { quests: 4, cards: 9 }): ReportGrowthView => ({
  since: null,
  quests: 'Quests',
  cards: 'Cards',
  month: 'Month',
  caption: 'Quests and cards over time',
  showTable: 'Show as table',
  hideTable: 'Hide table',
  baseline: latest,
  rows,
  latest,
});

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

function render(view: ReportGrowthView): ReactTestInstance {
  act(() => {
    mounted = create(<ReportGrowthBlock growth={view} />);
  });
  if (!mounted) throw new Error('not mounted');
  return (mounted as ReactTestRenderer).root;
}

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

/** Whether a node or any ancestor hides it from assistive technology. */
function hiddenFromAt(node: ReactTestInstance): boolean {
  for (let at: ReactTestInstance | null = node; at; at = at.parent) {
    if (at.props['aria-hidden'] === true || at.props['aria-hidden'] === 'true' || at.props.hidden === true) return true;
  }
  return false;
}

const legend = (root: ReactTestInstance): ReactTestInstance => {
  const found = root.findAll((node) => node.type === 'ul' && node.props.className === 'hr-report-growth-legend')[0];
  if (!found) throw new Error('no legend');
  return found;
};

describe('ReportGrowthBlock legend', () => {
  it('with no month rows, the baseline totals are in the accessibility tree', () => {
    const root = render(growth([]));
    const node = legend(root);
    expect(hiddenFromAt(node)).toBe(false);
    expect(textOf(node)).toContain('Quests 4');
    expect(textOf(node)).toContain('Cards 9');
  });

  it('with month rows, the legend stays hidden (the chart and table carry the values)', () => {
    const root = render(growth([{ m: '2026-09', label: 'September 2026', short: 'Sep', quests: 4, cards: 9 }]));
    expect(hiddenFromAt(legend(root))).toBe(true);
  });
});
