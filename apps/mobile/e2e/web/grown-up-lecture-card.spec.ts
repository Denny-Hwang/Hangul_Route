import type { Locator, Page } from '@playwright/test';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, openGrownUpZone, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * AMENDMENTS-LECTURE-V2 row LV-6 (section 3 E5, sections 7, 8 and 10; design/screens/lecture-entry/learner-card.md):
 * the Lecture mode card in the learner app's grown-up area, and the dashboard heading that ran 3 px past 320 at
 * 200 % text (LV-0b `learner-card.md`, now `overflow-wrap: anywhere`).
 *
 * What CI checks: the release build, where `flags.lectureModeEnabled` is on by default since LV-7, so the dashboard
 * draws the card, and the dashboard has no sideways scroll at 320 px, at 320 px with 200 % text (a 160 px layout:
 * React Native Web sets text in px, so 200 % browser zoom of 320 px is this window, WCAG 1.4.10) and at the Largest
 * text size. The kill switch (LV-D1) runs on a build with the switch off, where the dashboard draws no card:
 *
 *   EXPO_PUBLIC_LECTURE_MODE=off pnpm --filter @hangul-route/mobile build:web
 *   E2E_LECTURE_MODE=0 pnpm --filter @hangul-route/mobile exec playwright test grown-up-lecture-card
 */

/** On unless the run says the build has the kill switch off (`E2E_LECTURE_MODE=0`): the launch default since LV-7. */
const ON = process.env.E2E_LECTURE_MODE !== '0';
const en = getMessages('en');
const NAME = 'Mina Ruiz';

/** The page title of the grown-up area (role queries skip the screens kept under it in the stack). */
const dashboardHeading = (page: Page): Locator => page.getByRole('heading', { name: en.caregiver.audience.family.zoneLabel, level: 1 });

/** A family device with one learner, unlocked into the grown-up area (the dashboard). */
async function dashboard(page: Page, opts: { largest?: boolean } = {}): Promise<void> {
  await onboardChild(page, { name: NAME, startJourney: false });
  if (opts.largest) await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  await openGrownUpZone(page, NAME);
  await unlockWithPin(page);
  await expect(dashboardHeading(page)).toBeVisible();
}

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // The heading breaks inside a word when one word is wider than the line ("Dashboard" ran 3 px past, LV-0b).
  expect(await dashboardHeading(page).evaluate((el) => getComputedStyle(el).overflowWrap)).toBe('anywhere');
  const box = await dashboardHeading(page).boundingBox();
  if (box === null) throw new Error('the dashboard heading is not drawn');
  const width = await page.evaluate(() => window.innerWidth);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
}

for (const vp of [
  { name: '320 px', width: 320, height: 568, largest: false },
  { name: '320 px at 200 % text (a 160 px layout)', width: 160, height: 284, largest: false },
  { name: '320 px at the Largest text size', width: 320, height: 568, largest: true },
] as const) {
  test(`${vp.name}: the dashboard heading wraps and nothing scrolls sideways${ON ? ', with the card' : ''}`, async ({ page }) => {
    // Onboarding is set up at 320; the dashboard is then drawn at the width under test (live, as a zoom is).
    await page.setViewportSize({ width: 320, height: 568 });
    await dashboard(page, { largest: vp.largest });
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await expect(dashboardHeading(page)).toBeVisible();
    await expectNoSidewaysScroll(page);
    if (ON) {
      await expect(page.getByTestId('dashboard-lecture')).toBeVisible();
      await expect(page.getByRole('button', { name: en.caregiver.lecture.next(NAME) })).toBeVisible();
    } else {
      // The kill switch off: no card and no disabled control (section 3, LV-D1).
      await expect(page.getByTestId('dashboard-lecture')).toHaveCount(0);
      await expect(page.getByText(en.caregiver.lecture.title, { exact: true })).toHaveCount(0);
    }
    if (vp.width === 160) await shot(page, `lv6-dashboard-320-text200${ON ? '-card' : ''}`);
  });
}

test.describe('the card, on the release build (the launch default since LV-7)', () => {
  test.skip(!ON, 'this build has the lecture mode kill switch off (E2E_LECTURE_MODE=0)');

  for (const vp of [
    { width: 320, height: 568 },
    { width: 1280, height: 800 },
  ] as const) {
    test(`${vp.width}: the card after the grown-up home card, its row and Open lecture mode, targets at least touchTarget.min`, async ({ page }) => {
      await page.setViewportSize(vp);
      await dashboard(page);
      const card = page.getByTestId('dashboard-lecture');
      await expect(card.getByRole('heading', { name: en.caregiver.lecture.title })).toBeVisible();
      await expect(card.getByText(en.caregiver.lecture.body)).toBeVisible();
      for (const name of [en.caregiver.lecture.next(NAME), en.caregiver.lecture.open.cta]) {
        const box = await card.getByRole('button', { name }).boundingBox();
        expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(touchTarget.min);
      }
      // After the grown-up home card (when it is drawn) and before the learner cards; Open lecture mode at the card's end.
      const cardBox = await card.boundingBox();
      const home = page.getByTestId('dashboard-grown-up-home');
      if ((await home.count()) > 0) expect((await home.boundingBox())?.y ?? 0).toBeLessThan(cardBox?.y ?? 0);
      const open = await card.getByRole('button', { name: en.caregiver.lecture.open.cta }).boundingBox();
      if (cardBox === null || open === null) throw new Error('the card is not drawn');
      expect(cardBox.x + cardBox.width - (open.x + open.width)).toBeLessThanOrEqual(open.x - cardBox.x);
      await expectNoSidewaysScroll(page);
      await card.scrollIntoViewIfNeeded();
      await shot(page, `lv6-dashboard-card-${vp.width}`);
    });
  }

  test('Next lesson opens the presenter in a new tab with a deck that holds no name and no profile id', async ({ page, context }) => {
    await dashboard(page);
    const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
    const id = profiles?.[0]?.id;
    if (!id) throw new Error('no profile stored');
    const [tab] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: en.caregiver.lecture.next(NAME) }).click()]);
    await tab.waitForLoadState();
    const url = new URL(tab.url());
    expect(url.pathname).toBe('/present');
    expect(url.hash.startsWith('#d=')).toBe(true);
    expect(url.search).toBe('');
    const decoded = decodeURIComponent(tab.url());
    for (const piece of [NAME, 'Mina', 'Ruiz', id]) expect(decoded, piece).not.toContain(piece);
    // The presenter boots the deck; its title is the preset name, never the learner's.
    await expect(tab.getByText(/Next lesson|Hangul week 1/).first()).toBeVisible();
    expect(await tab.title()).not.toContain('Mina');
    expect(await tab.evaluate(() => window.opener)).toBeNull();
    // The dashboard stays where it was.
    await expect(page.getByTestId('dashboard-lecture')).toBeVisible();
  });

  test('Open lecture mode opens the presenter home in a new tab, nothing handed over', async ({ page, context }) => {
    await dashboard(page);
    const [tab] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: en.caregiver.lecture.open.cta }).click()]);
    await tab.waitForLoadState();
    const url = new URL(tab.url());
    expect(url.pathname).toBe('/present');
    expect(url.hash).toBe('');
    expect(url.search).toBe('');
  });
});
