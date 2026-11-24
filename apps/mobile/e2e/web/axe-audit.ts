/**
 * The axe ratchet on the learner PWA (AMENDMENTS-A11Y-CI row AC-1, sections 3.4 and 3.5). Pure helpers shared by
 * `axe-smoke.spec.ts` and their unit test (`src/config/__tests__/axe-baseline.test.ts`); no Playwright or axe import,
 * so vitest can load this file.
 *
 * `fixtures/axe-baseline.json` holds today's violations as a node count per screen and rule. The smoke compares what
 * a scan finds with it (OD-AC9, WO-shaped):
 *
 * - **new** (a rule with no entry) and **more** (a count above its entry) fail everywhere;
 * - **fewer** (a count below its entry) and **gone** (an entry whose rule has no violations) fail when the spec runs
 *   locally and print a `::warning::` on CI, so an improvement never turns `main` red but is not forgotten either.
 *
 * The file only shrinks. A PR that lowers a count or clears a rule edits the file in the same PR; nobody adds a line
 * or raises a count without a test edit (`axe-baseline.test.ts` pins the file's ceiling).
 */

/** The screens the smoke scans, in the order the baseline lists them (section 3.4). */
export const AXE_SCREENS = ['home', 'discover', 'match-sound-round-1', 'culture-quiz-correct', 'pin-entry'] as const;
export type AxeScreen = (typeof AXE_SCREENS)[number];

/** The rule sets the scan runs (section 3.4): WCAG 2.0 to 2.2 A and AA, plus best practice. No experimental rules. */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] as const;

/**
 * Left out of every scan: the PWA overlay layer. It appears on its own schedule (service-worker update, install
 * prompt, phone landscape), the same containers `measureTargets` skips (`target-audit.ts`).
 */
export const AXE_EXCLUDE = ['[data-testid="pwa-banners"]', '[data-testid="install-guide"]', '[data-testid="portrait-guard"]'] as const;

/** The pause between two reads of the settle loop, and the most reads it takes. */
export const SETTLE_GAP_MS = 300;
export const SETTLE_MAX_RUNS = 5;

/** One rule's line in the baseline. `expectedFix` names the work-order row expected to remove it, or `"none"`. */
export interface AxeBaselineEntry {
  rule: string;
  nodes: number;
  impact: string | null;
  expectedFix: string;
}

export interface AxeBaseline {
  /** Why the file exists and how to change it (kept in the JSON for whoever opens it). */
  note: string;
  /** The axe-core version the counts were measured with; the smoke fails when the engine differs. */
  axeCore: string;
  tags: string[];
  screens: Record<string, AxeBaselineEntry[]>;
}

/** The part of an axe result this file reads (structural, so the real `AxeResults` fits). */
export interface AxeViolationLike {
  id: string;
  impact?: string | null;
  nodes: ReadonlyArray<{ target: ReadonlyArray<unknown>; html: string; failureSummary?: string }>;
}

/** Rule id to the number of nodes that fail it. */
export type RuleCounts = Record<string, number>;

export function ruleCounts(violations: readonly AxeViolationLike[]): RuleCounts {
  const counts: RuleCounts = {};
  for (const v of violations) counts[v.id] = (counts[v.id] ?? 0) + v.nodes.length;
  return counts;
}

/** A stable string of a count map: the settle loop's "same as last time". */
export function countsSignature(counts: RuleCounts): string {
  return JSON.stringify(Object.keys(counts).sort().map((rule) => [rule, counts[rule]]));
}

/**
 * Scans until two reads in a row give the same rule to node-count map and returns the second one (the
 * `settledOffenders` pattern of `target-size.spec.ts`): entrance animations and late layout do not decide the result.
 * At least two reads are always taken. Throws when `maxRuns` reads never agree.
 */
export async function settledScan<T extends { counts: RuleCounts }>(
  scan: () => Promise<T>,
  wait: (ms: number) => Promise<void>,
  maxRuns: number = SETTLE_MAX_RUNS,
  gapMs: number = SETTLE_GAP_MS,
): Promise<T> {
  let last: string | null = null;
  for (let i = 0; i < maxRuns; i += 1) {
    const read = await scan();
    const now = countsSignature(read.counts);
    if (last !== null && now === last) return read;
    last = now;
    if (i < maxRuns - 1) await wait(gapMs);
  }
  throw new Error(`the axe result never settled in ${maxRuns} reads`);
}

export interface RuleChange {
  rule: string;
  /** The baseline's count (0 for a new rule). */
  was: number;
  /** The scan's count (0 for a rule that is gone). */
  now: number;
}

export interface BaselineDiff {
  /** A rule with violations and no entry. */
  added: RuleChange[];
  /** A count above its entry. */
  more: RuleChange[];
  /** A count below its entry, still above 0. */
  fewer: RuleChange[];
  /** An entry whose rule has no violations. */
  gone: RuleChange[];
}

const byRule = (a: RuleChange, b: RuleChange): number => (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0);

/** Compares one screen's counts with its baseline entries. Every list is sorted by rule. */
export function compareBaseline(found: RuleCounts, entries: readonly AxeBaselineEntry[]): BaselineDiff {
  const was = new Map(entries.map((e) => [e.rule, e.nodes] as const));
  const diff: BaselineDiff = { added: [], more: [], fewer: [], gone: [] };
  for (const [rule, now] of Object.entries(found)) {
    if (now <= 0) continue;
    const before = was.get(rule);
    if (before === undefined) diff.added.push({ rule, was: 0, now });
    else if (now > before) diff.more.push({ rule, was: before, now });
    else if (now < before) diff.fewer.push({ rule, was: before, now });
  }
  for (const [rule, before] of was) if ((found[rule] ?? 0) <= 0) diff.gone.push({ rule, was: before, now: 0 });
  for (const list of Object.values(diff)) list.sort(byRule);
  return diff;
}

export interface Verdict {
  /** Lines that fail the test. */
  failures: string[];
  /** Lines that only warn (CI, fewer and gone). */
  warnings: string[];
}

/**
 * OD-AC9 (WO-shaped): new and more always fail; fewer and gone fail locally and warn on CI. Each line names the
 * screen, the rule and the edit that settles it.
 */
export function verdict(screen: string, diff: BaselineDiff, onCi: boolean, file: string = 'e2e/web/fixtures/axe-baseline.json'): Verdict {
  const failures: string[] = [];
  const warnings: string[] = [];
  for (const c of diff.added) failures.push(`${screen}: new axe rule "${c.rule}" on ${c.now} node(s); fix it (the baseline never gains a line)`);
  for (const c of diff.more) failures.push(`${screen}: "${c.rule}" is on ${c.now} node(s), more than the baseline's ${c.was}; fix the new ones`);
  const improved: string[] = [];
  for (const c of diff.fewer) improved.push(`${screen}: lower "${c.rule}" from ${c.was} to ${c.now} in ${file}`);
  for (const c of diff.gone) improved.push(`${screen}: remove the "${c.rule}" line (was ${c.was}) from ${file}`);
  (onCi ? warnings : failures).push(...improved);
  return { failures, warnings };
}

/** The axe version check: the baseline is only comparable to the engine that measured it. */
export function versionMismatch(actual: string, baseline: Pick<AxeBaseline, 'axeCore'>): string | null {
  return actual === baseline.axeCore
    ? null
    : `axe-core ${actual} ran, but the baseline was measured with ${baseline.axeCore}; an axe-core update is a deliberate PR that re-measures the baseline`;
}

/**
 * What a failure message prints for the rules that changed: each failing node's selector, the first 200 characters of
 * its HTML and axe's own summary. The baseline stores only counts, so a fix and a new violation of the same rule on
 * one screen cancel out; this is where a reviewer sees which nodes they are.
 */
export function describeNodes(violations: readonly AxeViolationLike[], rules: ReadonlySet<string>): string {
  const lines: string[] = [];
  for (const v of violations) {
    if (!rules.has(v.id)) continue;
    lines.push(`${v.id} (${v.impact ?? 'no impact'}), ${v.nodes.length} node(s):`);
    for (const n of v.nodes) {
      lines.push(`  ${n.target.map(String).join(' ')}`);
      lines.push(`    ${n.html.slice(0, 200)}`);
      if (n.failureSummary) lines.push(`    ${n.failureSummary.replace(/\s+/g, ' ').trim()}`);
    }
  }
  return lines.join('\n');
}

/** The rules a diff names (every list), for `describeNodes`. */
export function changedRules(diff: BaselineDiff): Set<string> {
  return new Set([...diff.added, ...diff.more, ...diff.fewer, ...diff.gone].map((c) => c.rule));
}
