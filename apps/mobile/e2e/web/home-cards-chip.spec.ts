import type { Page } from '@playwright/test';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf, readStored, seedStoredAll } from './helpers';
import { shot } from './shots';
import { closeInstallGuide, expectTextFits } from './text-fit';
import { expectReachable } from './viewport';

/**
 * Owner request OW-2: "Without going to the Library, tapping the blue Cards chip on Home should go straight to the
 * cards." The chip is one button at least 64 px tall that opens the Library on its Cards section: the All filter, the
 * learner's own cards first, from the top, wherever the Library tab was left. The streak and three-star chips have no
 * screen that shows what they count, so they stay plain pills.
 */

const T = '2026-10-01T09:05:00.000Z';
const HELD = ['card:book', 'card:hanji', 'card:brush'];
/** The three seeded cards and the welcome card every new profile holds. */
const COUNT = `${HELD.length + 1} cards`;

const snapshotWith = (profileId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: T,
  episodes: [],
  quests: [],
  cards: HELD.map((cardId) => ({ cardId, unlockedAt: T, newSinceLastView: false })),
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

const tab = (page: Page, name: string) => page.getByRole('tablist').getByRole('link', { name, exact: true });
const chip = (page: Page) => page.getByTestId('home-cards-chip');

/** A learner on Home holding four cards, as a child's profile (a grown-up's choice for a child) or a self learner's. */
async function learnerAtHome(page: Page, who: 'child' | 'self', settings?: Record<string, unknown>): Promise<void> {
  if (who === 'child') await onboardChild(page, { name: 'Dami', startJourney: false });
  else await onboardSelf(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  await seedStoredAll(page, {
    [`progress:${profileId}`]: snapshotWith(profileId),
    ...(settings ? { 'device:settings': { ...settings, uiLocaleAt: '2026-10-16T09:00:00.000Z' } } : {}),
  });
  await expect(chip(page)).toBeVisible();
  await closeInstallGuide(page);
}

for (const who of ['child', 'self'] as const) {
  test(`${who}: the Cards chip is a 64 px button that opens the Library on the learner's cards`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await learnerAtHome(page, who);

    const button = page.getByRole('button', { name: `${COUNT}. See my cards` });
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();
    await expect(button.getByText(COUNT, { exact: true })).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(64);
    await shot(page, `home-cards-chip-${who}`);

    // The other chips are not controls: the stars chip is plain text, never a button.
    await expect(page.getByRole('button', { name: /three-star/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Streak/ })).toHaveCount(0);

    // Leave the Library on a theme filter and scrolled, as a learner might: the chip still lands on the cards, All filter.
    await tab(page, 'Library').click();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    await page.getByRole('button', { name: 'Letters', exact: true }).click();
    await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.move(160, 300);
    await page.mouse.wheel(0, 900);
    // The page really moved: the filter row is out of view, so the reset below is a reset.
    await expect(page.getByRole('button', { name: 'All', exact: true })).not.toBeInViewport();
    await tab(page, 'Today').click();
    await expect(chip(page)).toBeVisible();

    await button.click();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const yours = page.getByRole('heading', { name: 'Your cards' });
    await expect(yours).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('library-your-cards')).toBeVisible();
    await shot(page, `home-cards-chip-library-${who}`);

    // The link is spent: going Home and tapping again works the same.
    await tab(page, 'Today').click();
    await chip(page).click();
    await expect(page.getByRole('heading', { name: 'Your cards' })).toBeInViewport({ ratio: 1 });
    expect(errors).toEqual([]);
  });
}

test('keyboard: Tab reaches the chip and Enter opens the Library', async ({ page }) => {
  await learnerAtHome(page, 'child');
  // Real Tab presses from the top of the page: the chip is in the tab order.
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < 40 && !(await chip(page).evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab');
  await expect(chip(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Your cards' })).toBeInViewport({ ratio: 1 });
});

for (const [name, width, height] of [
  ['320', 320, 568],
  ['wide', 1024, 768],
] as const) {
  test(`${name} px at the Largest text size: the chip keeps its look, fits its row and stays at least 64 px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await learnerAtHome(page, 'child', { uiLocale: 'en', textSize: 'largest' });
    await chip(page).scrollIntoViewIfNeeded();
    const box = await chip(page).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);
    expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= width).toBe(true);
    // The pill inside keeps its tone and rounded shape: it is the same Pill, not a new button look.
    const pill = chip(page).getByText(COUNT, { exact: true }).locator('xpath=..');
    const style = await pill.evaluate((el) => ({ radius: getComputedStyle(el).borderTopLeftRadius, bg: getComputedStyle(el).backgroundColor }));
    expect(parseFloat(style.radius)).toBeGreaterThan(10);
    expect(style.bg).not.toBe('rgba(0, 0, 0, 0)');
    await expectTextFits(page, `Home chips at ${name} px, Largest`);
    await shot(page, `home-cards-chip-${name}-largest`);
    await chip(page).click();
    // The Library opens at its top; at the Largest size the filter chips fill a 320 px screen, so the learner's cards
    // are a scroll away, and reachable.
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeInViewport();
    await expectReachable(page, page.getByRole('heading', { name: 'Your cards' }));
    await expectTextFits(page, `Library cards at ${name} px, Largest`);
  });
}
