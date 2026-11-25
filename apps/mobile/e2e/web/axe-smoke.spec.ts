import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { ElementHandle, Page } from '@playwright/test';
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
import { expect, test } from './fixtures';
import { journeyCellName, onboardChild, openGrownUpZone, passDiscover } from './helpers';

/**
 * The axe smoke on the learner PWA (AMENDMENTS-A11Y-CI row AC-1, WO-08). Five screens of a fresh learner on the
 * release build are scanned with axe-core (WCAG 2.0 to 2.2 A and AA plus best practice) and compared with
 * `fixtures/axe-baseline.json`, a node count per screen and rule (section 3.5):
 *
 * - a rule with no entry, or a count above its entry, fails everywhere;
 * - a count below its entry, or an entry with no violations left, fails locally and prints a `::warning::` on CI
 *   (OD-AC9, WO-shaped), so `main` never turns red for an improvement. The PR that makes it shrinks the file.
 *
 * It runs in the `main` shards by itself (the release-build list). It is an alarm: the deploy is not gated by it.
 * Run it locally against a release build:
 *   pnpm --filter @hangul-route/mobile build:web
 *   pnpm --filter @hangul-route/mobile exec playwright test axe-smoke.spec
 * Set `AXE_PRINT=1` to print every screen's measured counts (how the baseline is recorded).
 */
const baseline = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'axe-baseline.json'), 'utf8')) as AxeBaseline;
const ON_CI = Boolean(process.env.CI);
const PRINT = process.env.AXE_PRINT === '1';
const RELEASE_BUILD = process.env.STORY_FIXTURES !== '1' && process.env.STORY_FIXTURES_GATED !== '1' && process.env.E2E_ROUTE !== '1';

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
async function auditScreen(page: Page, screen: AxeScreen): Promise<void> {
  const found = await settledScan(() => scanOnce(page), (ms) => page.waitForTimeout(ms));
  if (PRINT) console.log(`AXE ${screen} ${JSON.stringify(found.counts)}`);
  expect(versionMismatch(found.version, baseline), 'axe-core version').toBeNull();
  const entries = baseline.screens[screen];
  expect(entries, `${screen} has a baseline entry list`).toBeDefined();
  const diff = compareBaseline(found.counts, entries ?? []);
  const { failures, warnings } = verdict(screen, diff, ON_CI);
  for (const w of warnings) console.log(`::warning title=axe baseline::${w}`);
  const nodes = describeNodes(found.violations, changedRules(diff));
  const where = `scanned ${page.url()}. If the counts look foreign, another checkout's server may be on port 4173 (the config reuses it): lsof -nP -iTCP:4173 -sTCP:LISTEN`;
  expect(failures, `${failures.join('\n')}${nodes ? `\n${nodes}` : ''}${failures.length > 0 ? `\n${where}` : ''}`).toEqual([]);
}

/**
 * The Culture Quiz moves on 1000 ms after a right answer (`afterSound(..., { minMs: 1000 })`: the result floor
 * `RESULT_MARK_MIN_MS`, F-A11Y-001 OD-AF2 (b), CultureQuizGame), which is shorter than a settled scan. `page.clock`
 * cannot hold it: a paused clock hangs axe-core, which runs on the page's timers, and a stepped one still lets the
 * 1000 ms through now and then. So the page's own `setTimeout` is wrapped once, before the first script runs: while
 * `window.__axeHold` is set, a 1000 ms timer is never scheduled. Every other delay runs as usual, and the flag is off
 * until the spec turns it on, just before the tap.
 */
async function installAdvanceHold(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as Window & { __axeHold?: boolean };
    const real = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) =>
      w.__axeHold && delay === 1000 ? 0 : real(handler, delay, ...args)) as typeof window.setTimeout;
  });
}

test.describe('axe smoke on the learner PWA (AMENDMENTS-A11Y-CI AC-1)', () => {
  test.skip(!RELEASE_BUILD, 'the baseline is measured on the release build');

  test('home: a fresh learner on Home', async ({ page }) => {
    await onboardChild(page, { name: 'Dani', startJourney: false });
    await page.goto('/');
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    await expect(page.getByText('Today with Hoya')).toBeVisible();
    await auditScreen(page, 'home');
  });

  test('discover: Stage 1 quest 1, page 1 of Look and learn', async ({ page }) => {
    await onboardChild(page, { name: 'Dami' });
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Page 1 of \d+$/).first()).toBeVisible();
    await auditScreen(page, 'discover');
  });

  test('match-sound-round-1: Match Sound, round 1', async ({ page }) => {
    await onboardChild(page, { name: 'Dami' });
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByText('1 / 6')).toBeVisible();
    // The four letter tiles take a moment to lay out (their glyphs have no box for the first half second), and a
    // scan before that reads a half-built board: wait until each glyph has a box.
    await expect(page.getByText(/^[ㄱ-ㅣ]$/).filter({ visible: true })).toHaveCount(4);
    await auditScreen(page, 'match-sound-round-1');
  });

  test('culture-quiz-correct: the Culture Quiz right after a correct answer', async ({ page }) => {
    await installAdvanceHold(page);
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    const guide = page.getByTestId('install-guide');
    await page.waitForTimeout(800);
    if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByRole('button', { name: journeyCellName(1, 'Food & Daily Life') }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).nth(2).click();
    const anyway = page.getByRole('button', { name: 'Play anyway' });
    await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await anyway.isVisible()) await anyway.click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByTestId('culture-quiz-hear')).toBeVisible();
    await expect(page.getByText('1 / 4', { exact: true })).toBeVisible();

    // The Korean word above the Hear button, and the English option that is its answer
    // (`minigame:s1-life-q3-apply`, logic/minigame-config.ts).
    const english: Record<string, string> = { 토마토: 'Tomato', 코코아: 'Cocoa', 쿠키: 'Cookie', 토스트: 'Toast', 김밥: 'Kimbap' };
    const prompt = await page.getByRole('heading').filter({ hasText: new RegExp(`^(${Object.keys(english).join('|')})$`) }).first().innerText();
    const answer = english[prompt.trim()];
    expect(answer, `the quiz word ${prompt} is one of the five`).toBeDefined();

    await page.evaluate(() => {
      (window as Window & { __axeHold?: boolean }).__axeHold = true;
    });
    // The option buttons by their visible English word. F-A11Y-001 AF-1 renames them ("Right answer: Tomato"), so the
    // names allow its prefix and suffix, and the tapped option is held as an element handle, not looked up again.
    const names = Object.values(english).join('|');
    const options = page.getByRole('button', { name: new RegExp(`^(Right answer: )?(${names})(, correct)?$`) });
    const tapped = await page.getByRole('button', { name: new RegExp(`^(Right answer: )?${answer}(, correct)?$`) }).elementHandle();
    const untouched = await options.filter({ hasNotText: answer! }).first().elementHandle();
    expect(tapped, `the option ${answer}`).not.toBeNull();
    expect(untouched, 'an option that is not the answer').not.toBeNull();
    const fill = (b: ElementHandle<Element>): Promise<string> => b.evaluate((el) => [el, ...Array.from(el.querySelectorAll('*'))].map((e) => getComputedStyle(e).backgroundColor).filter((c) => c !== 'rgba(0, 0, 0, 0)').join(' '));
    const before = await fill(tapped!);
    await tapped!.click();
    // The answered state: still round 1 of 4, and the tapped option shows its success fill (not the colour it had).
    await expect(page.getByText('1 / 4', { exact: true })).toBeVisible();
    await expect.poll(() => fill(tapped!)).not.toBe(before);
    expect(await fill(tapped!)).not.toBe(await fill(untouched!));
    await auditScreen(page, 'culture-quiz-correct');
    // Still the answered round: the quiz has not moved on while it was scanned.
    await expect(page.getByText('1 / 4', { exact: true })).toBeVisible();
  });

  test('pin-entry: the PIN screen of the Grown-up area', async ({ page }) => {
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await openGrownUpZone(page, 'Dami');
    await auditScreen(page, 'pin-entry');
  });
});
