import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { journeyCellName, onboardChild, onboardSelf, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * F-ENT-003 E3-6 (section 3.7, wireframe episode/detail-access-preview, marks
 * design/components/RouteMarkers): the lesson page's Next tag and the preview of a lesson that is
 * not open yet. The release build (switch off) shows the Next tag and every Start; the preview only
 * exists on a web build with the free-plan switch on, so those tests run only against such a build
 * (E2E_CONTENT_GATING=1 with a dist built with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true).
 */
const access = getMessages('en').learner.access;
const tags = getMessages('en').learner.routeNext.tag;
const gated = process.env.E2E_CONTENT_GATING === '1';

const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
  { width: 1180, height: 820 },
] as const;

/** Home, with the install guide out of the way. */
async function home(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

async function openCell(page: Page, stage: number, theme: string): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(stage, theme) }).click();
}

const noSideScroll = (page: Page): Promise<boolean> => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('release build (switch off)', () => {
  test.skip(gated, 'the release build has the switch off');

  test('a new learner: the first Stage 1 quest carries Next; every lesson keeps its Start and no preview card', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await home(page, 'Dami');
    await openCell(page, 1, 'Letters');
    await expect(page.getByTestId('episode-tag-next')).toHaveCount(1);
    await expect(page.getByTestId('episode-tag-next')).toHaveText(tags.next);
    await expect(page.getByTestId('episode-next-marker')).toHaveCount(1);
    // The first row is the one next: its label reads its stars and the tag as a word.
    await expect(page.getByLabel(/0 of 3 stars earned\. Next\.$/)).toHaveCount(1);
    await expect(page.getByTestId('episode-preview-card')).toHaveCount(0);
    await expect(page.getByText(access.notOpen)).toHaveCount(0);

    await home(page, 'Dami');
    await openCell(page, 2, 'Food & Daily Life');
    await expect(page.getByRole('heading', { name: 'Lunch Box Words' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start', exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('episode-preview-card')).toHaveCount(0);
    await expect(page.getByTestId('episode-tag-next')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('free plan switch on (web)', () => {
  test.skip(!gated, 'needs a web build with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true');

  for (const viewport of VIEWPORTS) {
    test(`family device at ${viewport.width}: a Stage 2 lesson is a preview with the ask and Back to open lessons`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.setViewportSize(viewport);
      await onboardChild(page, { name: 'Dami', startJourney: false });
      await home(page, 'Dami');
      await openCell(page, 2, 'Food & Daily Life');
      await expect(page.getByRole('heading', { name: 'Lunch Box Words' })).toBeVisible();
      // The row shows the caption, never a Start button; the cards to earn stay listed.
      await expect(page.getByTestId('episode-quest-not-open').first()).toHaveText(access.notOpen);
      await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
      const card = page.getByTestId('episode-preview-card');
      await expect(card.getByText(access.preview.line)).toBeVisible();
      await expect(card.getByRole('button', { name: access.ask.family })).toBeVisible();
      await expect(card.getByRole('button', { name: access.back.cta })).toBeVisible();
      await expect(page.getByText(/locked|premium|trial|price/i)).toHaveCount(0);
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `episode-preview-${viewport.width}`);

      // Back to open lessons: the one next's lesson page (Stage 1 Letters for a new learner).
      await card.getByRole('button', { name: access.back.cta }).click();
      await expect(page.getByRole('heading', { name: 'Meet the Letters' })).toBeVisible();
      await expect(page.getByTestId('episode-tag-next')).toHaveCount(1);
      expect(errors).toEqual([]);
    });
  }

  test('family device: the ask goes through the PIN screen to the Plan screen', async ({ page }) => {
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await home(page, 'Dami');
    await openCell(page, 2, 'Food & Daily Life');
    await page.getByTestId('episode-preview-ask').click();
    await expect(page.getByRole('heading', { name: 'Grown-up zone' })).toBeVisible();
    await unlockWithPin(page);
    // The Plan screen (F-BILL-002 B-9), attributed to the episode page.
    await expect(page.getByText('Dami is on the free plan.')).toBeVisible();
  });

  test('self-only device with no PIN: See how to open it opens the Plan screen directly', async ({ page }) => {
    await onboardSelf(page, { name: 'Alex', startJourney: false });
    await home(page, 'Alex');
    await openCell(page, 2, 'Food & Daily Life');
    const ask = page.getByTestId('episode-preview-ask');
    await expect(ask).toHaveText(access.ask.self);
    await expect(page.getByText(/grown-up/i)).toHaveCount(0);
    await ask.click();
    // No PIN on a self-only device: the Plan screen opens directly.
    await expect(page.getByText("You're on the free plan.")).toBeVisible();
  });

  test('the Stage 5 book on the free plan is a preview, not the story page with a Start (F-STORY-005 PR 5.6)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await home(page, 'Dami');
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByRole('button', { name: /^Stage 5 Stories, Holidays & Traditions: story book/ }).click();
    await expect(page.getByRole('heading', { name: 'Festival Tales' })).toBeVisible();
    await expect(page.getByTestId('story-episode-title')).toHaveCount(0);
    await expect(page.getByTestId('episode-quest-not-open').first()).toHaveText(access.notOpen);
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('episode-preview-card').getByText(access.preview.line)).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('Stage 1 lessons are never a preview', async ({ page }) => {
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await home(page, 'Dami');
    for (const theme of ['Letters', 'Food & Daily Life']) {
      await home(page, 'Dami');
      await openCell(page, 1, theme);
      await expect(page.getByRole('button', { name: 'Start', exact: true }).first()).toBeVisible();
      await expect(page.getByTestId('episode-preview-card')).toHaveCount(0);
      // The Journey under the page keeps its legend line ("Not open yet"); the page itself has no closed row.
      await expect(page.getByTestId('episode-quest-not-open')).toHaveCount(0);
    }
  });
});
