import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AXE_EXCLUDE,
  AXE_SCREENS,
  AXE_TAGS,
  SETTLE_MAX_RUNS,
  changedRules,
  compareBaseline,
  countsSignature,
  describeNodes,
  ruleCounts,
  settledScan,
  verdict,
  versionMismatch,
  type AxeBaseline,
  type AxeBaselineEntry,
  type AxeViolationLike,
  type RuleCounts,
} from '../../../e2e/web/axe-audit';

/**
 * AMENDMENTS-A11Y-CI row AC-1, section 3.5: the axe ratchet on the learner PWA. `e2e/web/axe-smoke.spec.ts` scans five
 * screens and compares each rule's node count with `e2e/web/fixtures/axe-baseline.json`. These tests pin the
 * comparison (new and more fail everywhere; fewer and gone fail locally and warn on CI, OD-AC9), the settle loop, the
 * version pin and the file's ceiling, without a browser.
 */
const ROOT = join(__dirname, '..', '..', '..');
const baseline = JSON.parse(readFileSync(join(ROOT, 'e2e', 'web', 'fixtures', 'axe-baseline.json'), 'utf8')) as AxeBaseline;

const entry = (rule: string, nodes: number): AxeBaselineEntry => ({ rule, nodes, impact: 'moderate', expectedFix: 'none' });

describe('ruleCounts', () => {
  it('adds up the nodes of each rule', () => {
    const v = (id: string, n: number): AxeViolationLike => ({ id, nodes: Array.from({ length: n }, () => ({ target: ['#a'], html: '<i/>' })) });
    expect(ruleCounts([v('region', 3), v('button-name', 1), v('region', 2)])).toEqual({ region: 5, 'button-name': 1 });
    expect(ruleCounts([])).toEqual({});
  });
});

describe('compareBaseline', () => {
  const entries = [entry('region', 3), entry('color-contrast', 2)];

  it('is empty when the counts equal the entries', () => {
    expect(compareBaseline({ region: 3, 'color-contrast': 2 }, entries)).toEqual({ added: [], more: [], fewer: [], gone: [] });
  });

  it('reports a rule with no entry as added', () => {
    expect(compareBaseline({ region: 3, 'color-contrast': 2, 'button-name': 1 }, entries).added).toEqual([{ rule: 'button-name', was: 0, now: 1 }]);
  });

  it('reports a count above its entry as more', () => {
    expect(compareBaseline({ region: 4, 'color-contrast': 2 }, entries).more).toEqual([{ rule: 'region', was: 3, now: 4 }]);
  });

  it('reports a count below its entry as fewer', () => {
    expect(compareBaseline({ region: 2, 'color-contrast': 2 }, entries).fewer).toEqual([{ rule: 'region', was: 3, now: 2 }]);
  });

  it('reports an entry whose rule has no violations as gone', () => {
    expect(compareBaseline({ region: 3 }, entries).gone).toEqual([{ rule: 'color-contrast', was: 2, now: 0 }]);
    expect(compareBaseline({ region: 3, 'color-contrast': 0 }, entries).gone).toEqual([{ rule: 'color-contrast', was: 2, now: 0 }]);
  });

  it('sorts every list by rule so the message is stable', () => {
    const d = compareBaseline({ z: 1, a: 1 }, []);
    expect(d.added.map((c) => c.rule)).toEqual(['a', 'z']);
  });

  it('lets a fix and a new violation of the same rule cancel out (the file stores counts, not nodes)', () => {
    expect(compareBaseline({ region: 3 }, [entry('region', 3)])).toEqual({ added: [], more: [], fewer: [], gone: [] });
  });
});

describe('verdict (OD-AC9, WO-shaped)', () => {
  const diff = {
    added: [{ rule: 'button-name', was: 0, now: 1 }],
    more: [{ rule: 'region', was: 3, now: 4 }],
    fewer: [{ rule: 'color-contrast', was: 2, now: 1 }],
    gone: [{ rule: 'heading-order', was: 1, now: 0 }],
  };

  it('fails new and more everywhere', () => {
    for (const onCi of [false, true]) {
      const { failures } = verdict('home', diff, onCi);
      expect(failures.some((f) => f.includes('"button-name"'))).toBe(true);
      expect(failures.some((f) => f.includes('"region"') && f.includes('4') && f.includes('3'))).toBe(true);
    }
  });

  it('fails fewer and gone locally, naming the line to lower or remove', () => {
    const { failures, warnings } = verdict('home', diff, false);
    expect(failures).toContain('home: lower "color-contrast" from 2 to 1 in e2e/web/fixtures/axe-baseline.json');
    expect(failures).toContain('home: remove the "heading-order" line (was 1) from e2e/web/fixtures/axe-baseline.json');
    expect(warnings).toEqual([]);
  });

  it('only warns for fewer and gone on CI', () => {
    const { failures, warnings } = verdict('home', diff, true);
    expect(failures.some((f) => f.includes('color-contrast') || f.includes('heading-order'))).toBe(false);
    expect(warnings).toEqual([
      'home: lower "color-contrast" from 2 to 1 in e2e/web/fixtures/axe-baseline.json',
      'home: remove the "heading-order" line (was 1) from e2e/web/fixtures/axe-baseline.json',
    ]);
  });

  it('passes an unchanged screen both ways', () => {
    const none = { added: [], more: [], fewer: [], gone: [] };
    expect(verdict('home', none, false)).toEqual({ failures: [], warnings: [] });
    expect(verdict('home', none, true)).toEqual({ failures: [], warnings: [] });
  });
});

describe('versionMismatch', () => {
  it('passes the version the baseline was measured with and names any other', () => {
    expect(versionMismatch(baseline.axeCore, baseline)).toBeNull();
    expect(versionMismatch('4.15.0', { axeCore: '4.14.1' })).toMatch(/4\.15\.0 ran, but the baseline was measured with 4\.14\.1/);
  });
});

describe('settledScan', () => {
  const scan = (maps: RuleCounts[]) => {
    let i = 0;
    return async () => ({ counts: maps[Math.min(i++, maps.length - 1)] ?? {}, read: i });
  };
  const noWait = async () => undefined;

  it('stops on two equal maps and returns the second read', async () => {
    const out = await settledScan(scan([{ a: 1 }, { a: 1 }, { a: 9 }]), noWait);
    expect(out).toEqual({ counts: { a: 1 }, read: 2 });
  });

  it('always reads at least twice, even when the first read finds nothing', async () => {
    expect((await settledScan(scan([{}]), noWait)).read).toBe(2);
  });

  it('keeps reading while the map changes, then settles', async () => {
    const out = await settledScan(scan([{ a: 3 }, { a: 2 }, { a: 1 }, { a: 1 }]), noWait);
    expect(out.read).toBe(4);
  });

  it('waits between reads, not after the last one', async () => {
    const waits: number[] = [];
    await expect(settledScan(scan([{ a: 1 }, { a: 2 }, { a: 3 }]), async (ms) => void waits.push(ms), 3, 300)).rejects.toThrow('never settled in 3 reads');
    expect(waits).toEqual([300, 300]);
  });

  it('throws after the most reads when the map never repeats', async () => {
    let reads = 0;
    const changing = async () => ({ counts: { a: ++reads } as RuleCounts });
    await expect(settledScan(changing, noWait)).rejects.toThrow(`never settled in ${SETTLE_MAX_RUNS} reads`);
    expect(reads).toBe(SETTLE_MAX_RUNS);
    expect(SETTLE_MAX_RUNS).toBe(5);
  });

  it('compares maps by content, not by key order', () => {
    expect(countsSignature({ a: 1, b: 2 })).toBe(countsSignature({ b: 2, a: 1 }));
    expect(countsSignature({ a: 1 })).not.toBe(countsSignature({ a: 2 }));
  });
});

describe('describeNodes', () => {
  const violations: AxeViolationLike[] = [
    { id: 'region', impact: 'moderate', nodes: [{ target: ['.css-a', '.css-b'], html: `<div>${'x'.repeat(300)}</div>`, failureSummary: 'Fix any of\n  the following' }] },
    { id: 'other', impact: 'minor', nodes: [{ target: ['#z'], html: '<b/>' }] },
  ];

  it('prints the selector, 200 characters of html and the summary for the named rules only', () => {
    const text = describeNodes(violations, new Set(['region']));
    expect(text).toContain('region (moderate), 1 node(s):');
    expect(text).toContain('.css-a .css-b');
    expect(text).toContain(`<div>${'x'.repeat(195)}`);
    expect(text).not.toContain('x'.repeat(196));
    expect(text).toContain('Fix any of the following');
    expect(text).not.toContain('other');
  });

  it('names the rules of every list of a diff', () => {
    const d = { added: [{ rule: 'a', was: 0, now: 1 }], more: [], fewer: [{ rule: 'b', was: 2, now: 1 }], gone: [{ rule: 'c', was: 1, now: 0 }] };
    expect([...changedRules(d)].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('the baseline file', () => {
  it('lists exactly the screens the smoke scans, in order', () => {
    expect(Object.keys(baseline.screens)).toEqual([...AXE_SCREENS]);
  });

  it('records the rule sets the scan runs and the overlay layer it leaves out', () => {
    expect(baseline.tags).toEqual([...AXE_TAGS]);
    expect(AXE_TAGS).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']);
    expect(AXE_EXCLUDE).toEqual(['[data-testid="pwa-banners"]', '[data-testid="install-guide"]', '[data-testid="portrait-guard"]']);
  });

  it('pins the axe-core version the counts were measured with', () => {
    expect(baseline.axeCore).toBe('4.14.1');
  });

  it('gives every line a rule, a positive node count, an impact and an expected fix, once per screen', () => {
    for (const [screen, lines] of Object.entries(baseline.screens)) {
      const rules = lines.map((l) => l.rule);
      expect(new Set(rules).size, `${screen} lists a rule twice`).toBe(rules.length);
      for (const l of lines) {
        expect(l.nodes, `${screen} ${l.rule}`).toBeGreaterThan(0);
        expect(Number.isInteger(l.nodes)).toBe(true);
        expect(l.expectedFix.length, `${screen} ${l.rule} names its expected fix or "none"`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * The ceiling (section 3.3's rule for every ratchet): the file as merged by AC-1. A key the map lacks, or a count
   * above its entry, fails; so raising a line is a visible edit of this test that review must justify. Lowering a
   * count or removing a line needs no edit here.
   */
  const CEILING: Record<string, Record<string, number>> = {
    home: { region: 8 },
    discover: { region: 11 },
    'match-sound-round-1': { 'label-content-name-mismatch': 4, region: 3 },
    'culture-quiz-correct': { 'label-content-name-mismatch': 1, region: 4 },
    'pin-entry': { 'aria-prohibited-attr': 1, region: 3 },
  };

  it('never gains a line or raises a count above the ceiling map', () => {
    for (const [screen, lines] of Object.entries(baseline.screens)) {
      const ceiling = CEILING[screen] ?? {};
      for (const l of lines) {
        expect(ceiling[l.rule], `${screen}: "${l.rule}" is not in the ceiling map; the baseline never gains a line`).toBeDefined();
        expect(l.nodes, `${screen}: "${l.rule}" is above the ceiling`).toBeLessThanOrEqual(ceiling[l.rule] ?? 0);
      }
    }
    expect(Object.keys(CEILING)).toEqual(Object.keys(baseline.screens));
  });
});
