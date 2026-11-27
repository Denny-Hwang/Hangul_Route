import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, passDiscover } from './helpers';

/**
 * [MP] AMENDMENTS-MINIMAL-PAIRS row MP-2b: quest 6 (Picnic Snacks) has a contrast step, "Hear the Puff", after Match Sound.
 * - Release build: no set is approved, so the step is passed by and the quest plays as it did (Match Sound, then
 *   What Does It Mean?).
 * - Fixture build (`pnpm build:web:fixtures`, STORY_FIXTURES=1): two fixture sets are approved over fixture clips, so the step
 *   plays, on clips only: no device voice, a miss shows the compare row ("Listen to both."), a right answer shows the kind lines.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

async function openLifeEpisode(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Food & Daily Life') }).click();
}

/** Starts quest 6 (the third of the episode) and goes through its intro and Discover to Match Sound. */
async function toMatchSound(page: Page): Promise<void> {
  await openLifeEpisode(page);
  await page.getByRole('button', { name: 'Start', exact: true }).nth(2).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await expect(headerClose(page)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await expect(page.getByText('Match the Sound', { exact: true }).first()).toBeVisible();
}

test.describe('[MP] no set approved (the release build)', () => {
  test.skip(FIXTURE_BUILD, 'the release build: the real catalogue holds no approval');

  test('quest 6 goes from Match Sound straight to What Does It Mean?: the contrast step is passed by', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await toMatchSound(page);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByText('What Does It Mean?', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Hear the Puff')).toHaveCount(0);
    // The step still has its place in the count (step 5 / 7), and it was not skipped by the learner: Apply's Skip is the only one left.
    await expect(page.getByText('5 / 7', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('[MP] fixture sets approved (the fixture build)', () => {
  test.skip(!FIXTURE_BUILD, 'the fixture build (pnpm build:web:fixtures, STORY_FIXTURES=1) carries the fixture approvals');

  test('quest 6 plays the contrast step on clips only: a miss shows the compare row, a right answer the kind lines', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await toMatchSound(page);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByText('Hear the Puff', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByTestId('listen-pick-options')).toBeVisible();

    let rounds = 0;
    let misses = 0;
    const applyTitle = page.getByText('What Does It Mean?', { exact: true }).first();
    const roundLabel = async (): Promise<string> => (await page.getByTestId('listen-pick-round').getAttribute('aria-label', { timeout: 1_000 }).catch(() => null)) ?? '';
    // Each round: tap the first option; every answered round shows the options' kind lines, and a miss also the compare row.
    while (rounds < 6 && !(await applyTitle.isVisible())) {
      const before = await roundLabel();
      await page.locator('[data-testid^="listen-pick-option-"]').first().click();
      await expect(page.locator('[data-testid^="contrast-kind-"]').first()).toBeVisible({ timeout: 10_000 });
      rounds += 1;
      if (await page.getByTestId('contrast-compare').isVisible()) {
        misses += 1;
        await expect(page.getByText('Listen to both.').first()).toBeVisible();
      }
      await expect(page.getByText('Soft, starts lower.').first()).toBeVisible();
      await expect(page.getByText('Big puff, starts higher.').first()).toBeVisible();
      const next = page.getByTestId('listen-pick-next');
      if (await next.isVisible().catch(() => false)) await next.click();
      // The round advances by itself after its pause: wait for the next round (its label changes) or the end of the step.
      await expect.poll(async () => (await applyTitle.isVisible()) || (await roundLabel()) !== before, { timeout: 15_000 }).toBe(true);
    }
    expect(rounds).toBeGreaterThanOrEqual(1);
    expect(misses).toBeLessThanOrEqual(rounds);

    // Back on the quest: the apply step, not a skipped step, and the device voice never said a word of Korean.
    await expect(page.getByText('What Does It Mean?', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    const asked = await page.evaluate(() => (window as Window & { __silentSpeech?: string[] }).__silentSpeech ?? []);
    expect(asked.filter((t) => /[가-힣]/.test(t))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Skip for now on the contrast step goes on to What Does It Mean?', async ({ page }) => {
    await toMatchSound(page);
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByText('Hear the Puff', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByText('What Does It Mean?', { exact: true }).first()).toBeVisible();
  });
});
