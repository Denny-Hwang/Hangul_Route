import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import {
  AXE_EXCLUDE,
  AXE_TAGS,
  changedRules,
  compareBaseline,
  describeNodes,
  ruleCounts,
  settledScan,
  verdict,
  versionMismatch,
  type AxeBaseline,
  type AxeScreen,
  type AxeViolationLike,
  type RuleCounts,
} from './axe-audit';

/**
 * The scan both axe specs share (AMENDMENTS-A11Y-CI row AC-2): `axe-site.spec.ts` (the site's home and the console
 * sign-in) and `axe-console.spec.ts` (the teacher class page). The pure comparison is `axe-audit.ts`; this file holds
 * the part that needs a browser. It reads `fixtures/axe-baseline.json`, a node count per screen and rule (section 3.5):
 *
 * - a rule with no entry, or a count above its entry, fails everywhere;
 * - a count below its entry, or an entry with no violations left, fails locally and prints a `::warning::` on CI
 *   (OD-AC9, WO-shaped), so no run turns red for an improvement. The PR that makes it shrinks the file.
 *
 * Set `AXE_PRINT=1` to print every screen's measured counts (how the baseline is recorded).
 */
const baseline = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'axe-baseline.json'), 'utf8')) as AxeBaseline;
const ON_CI = Boolean(process.env.CI);
const PRINT = process.env.AXE_PRINT === '1';

interface Scan {
  counts: RuleCounts;
  violations: AxeViolationLike[];
  version: string;
}

async function scanOnce(page: Page): Promise<Scan> {
  const builder = new AxeBuilder({ page }).withTags([...AXE_TAGS]);
  for (const selector of AXE_EXCLUDE) builder.exclude(selector);
  const results = await builder.analyze();
  return { counts: ruleCounts(results.violations), violations: results.violations, version: results.testEngine.version };
}

/** Scans the open screen until two reads agree, then compares it with the screen's baseline entries. */
export async function auditScreen(page: Page, screen: AxeScreen): Promise<void> {
  const found = await settledScan(() => scanOnce(page), (ms) => page.waitForTimeout(ms));
  if (PRINT) console.log(`AXE ${screen} ${JSON.stringify(found.counts)}`);
  expect(versionMismatch(found.version, baseline), 'axe-core version').toBeNull();
  const entries = baseline.screens[screen];
  expect(entries, `${screen} has a baseline entry list`).toBeDefined();
  const diff = compareBaseline(found.counts, entries ?? []);
  const { failures, warnings } = verdict(screen, diff, ON_CI);
  for (const w of warnings) console.log(`::warning title=axe baseline::${w}`);
  const nodes = describeNodes(found.violations, changedRules(diff));
  const where = `scanned ${page.url()}`;
  expect(failures, `${failures.join('\n')}${nodes ? `\n${nodes}` : ''}${failures.length > 0 ? `\n${where}` : ''}`).toEqual([]);
}
