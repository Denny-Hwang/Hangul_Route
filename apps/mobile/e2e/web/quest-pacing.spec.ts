import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, passDiscover, readStored, seedStored } from './helpers';

/**
 * F-CURR-002 section 4.6 (row CM-24) on the web PWA, behind `questAdapt` (the remote copy is the stored one: this build
 * has no API). Stage 2 Nature & Animals: quest 1's Pic-Word Practice played right first time makes quest 2's second
 * Discover page compact (both words on one card, each with Hear it); two first-try misses in it play one scaffold
 * round (Listen & Pick, the right card ringed) before Apply. The step counter is the quest's own throughout, nothing
 * is red and nothing mentions speed. Each target is 48 dp or more.
 */

interface Cell {
  quests: Array<{ scopes: Array<{ kind: string; boards?: Array<{ pairs: Array<{ id: string }> }> }> }>;
}
const NATURE = JSON.parse(readFileSync(join(__dirname, '../../../../content/episodes/stage-2/nature.json'), 'utf8')) as Cell;
const BOARDS = (NATURE.quests[0]?.scopes.find((s) => s.kind === 'pic-word-match')?.boards ?? []).map((b) => b.pairs.map((p) => p.id));

async function onboard(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  expect(profiles?.[0]?.id).toBeTruthy();
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { questAdapt: { on: true, pct: 100 } } });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

async function openNature(page: Page): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(2, 'Nature & Animals') }).first().click();
  await expect(page.getByRole('button', { name: 'Start', exact: true }).first()).toBeVisible();
}

async function startQuest(page: Page, nth: number): Promise<void> {
  await page.getByRole('button', { name: 'Start', exact: true }).nth(nth).click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await expect(headerClose(page)).toBeVisible();
}

/** Quest 1's Pic-Word Practice: each board's pairs in order, picture then word; the first `misses` pairs get a wrong word first. */
async function playPractice(page: Page, misses: number): Promise<void> {
  await page.getByRole('button', { name: 'Play minigame' }).click();
  let missed = 0;
  for (const pairs of BOARDS) {
    for (const [i, id] of pairs.entries()) {
      // Each board's first word is not on the board before it, so its click waits for the new board.
      await page.getByTestId(`pic-word-picture-${id}`).click();
      if (missed < misses) {
        // A wrong word first: a first-try miss on this picture's pair, which stays selected for the right word.
        missed += 1;
        await page.getByTestId(`pic-word-word-${pairs[(i + 1) % pairs.length]}`).click();
      }
      await page.getByTestId(`pic-word-word-${id}`).click();
    }
  }
}

async function shots(page: Page, name: string): Promise<void> {
  for (const [label, size] of [
    ['320', { width: 320, height: 720 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    await page.setViewportSize(size);
    await page.screenshot({ path: test.info().outputPath(`${name}-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 393, height: 851 });
}

/** Every button in `scope` is 48 dp or more on each side at 320 px. */
async function targetsAtLeast48(page: Page, scope: ReturnType<Page['getByTestId']>): Promise<void> {
  await page.setViewportSize({ width: 320, height: 720 });
  const buttons = scope.getByRole('button');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const box = await buttons.nth(i).boundingBox();
    expect(box && Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48);
  }
  await page.setViewportSize({ width: 393, height: 851 });
}

test('a strong Practice makes the next quest’s second Discover page compact: both words on one card, each with Hear it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await onboard(page);
  await openNature(page);
  await startQuest(page, 0);
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await playPractice(page, 0);
  // Quest 1 goes on as it was (no scaffold): Apply's card, with the quest's own counter.
  await expect(page.getByText(/^4 \/ 6$/)).toBeVisible();
  await expect(page.getByTestId('listen-pick-hint')).toHaveCount(0);
  // Leave quest 1 (the strong round is kept for this session) and open quest 2.
  await headerClose(page).click();
  await page.getByTestId('confirm-sheet-confirm').click();
  await expect(page.getByRole('button', { name: 'Start', exact: true }).first()).toBeVisible();
  await startQuest(page, 1);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByTestId('discover-compact')).toHaveCount(0);
  await page.getByTestId('discover-continue').click();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  const card = page.getByTestId('discover-compact');
  await expect(card).toBeVisible();
  await expect(card.getByText('Two on one card. Tap Hear it for each.')).toBeVisible();
  await expect(card.getByRole('button', { name: /^Hear it\./ })).toHaveCount(2);
  await expect(page.getByTestId('discover-continue')).toBeEnabled();
  await expect(page.getByText(/^2 \/ 6$/)).toBeVisible();
  await expect(page.getByText(/faster|speed|quick/i)).toHaveCount(0);
  await targetsAtLeast48(page, card);
  await shots(page, 'pacing-compact');
  await page.setViewportSize({ width: 320, height: 720 });
  await card.screenshot({ path: test.info().outputPath('pacing-compact-card-320.png') });
  await page.setViewportSize({ width: 393, height: 851 });
  await page.getByTestId('discover-continue').click();
  await expect(page.getByText(/^3 \/ 6$/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('two first-try misses in Practice play one scaffold round of the same words, the right card ringed, before Apply', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await onboard(page);
  await openNature(page);
  await startQuest(page, 0);
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await playPractice(page, 2);

  // The scaffold round: Listen & Pick with its hint line, one card ringed ("Look here"), the quest's counter hidden.
  await expect(page.getByTestId('listen-pick-hint')).toHaveText('One more, with a hint. Hear it, then tap the highlighted card.');
  const options = page.locator('[data-testid^="listen-pick-option-"]');
  await expect(options.first()).toBeVisible();
  const labels = await options.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label') ?? ''));
  expect(labels.filter((l) => l.startsWith('Look here'))).toHaveLength(1);
  // The last miss (별, star) is the one asked; the first (하늘, sky) is beside it: the Practice's own words.
  expect(labels.find((l) => l.startsWith('Look here'))).toContain('별');
  expect(labels.some((l) => l.includes('하늘'))).toBe(true);
  await expect(page.getByText(/^\d \/ 6$/)).toHaveCount(0);
  await expect(page.getByText(/faster|speed|wrong/i)).toHaveCount(0);
  await targetsAtLeast48(page, page.getByTestId('listen-pick-options'));
  await shots(page, 'pacing-scaffold');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByTestId('listen-pick-options').screenshot({ path: test.info().outputPath('pacing-scaffold-options-320.png') });
  await page.setViewportSize({ width: 393, height: 851 });

  await page.locator('[data-testid^="listen-pick-option-"][aria-label^="Look here"]').click();
  // Then Apply, as always: its card and the quest's own counter.
  await expect(page.getByText(/^4 \/ 6$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play minigame' })).toBeVisible();
  await expect(page.getByTestId('listen-pick-hint')).toHaveCount(0);
  expect(errors).toEqual([]);
});
