import type { Page } from '@playwright/test';
import { availableLocales, getMessages, type UiLocale } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, seedStored } from './helpers';
import { shot } from './shots';

/**
 * The Route tab (AMENDMENTS-ROUTE-LEARNING-ROUTE LR-4, section 5.1 and 5.2;
 * design/screens/learning-route/tab-bar.md, mock/tab-bar.html and
 * mock/route-tab.html). The tab lives behind `flags.myRouteEnabled` (off), so
 * a default build checks that the bar is the three tabs of today, and a build
 * made with the flag on checks the four-tab bar:
 *
 *   EXPO_PUBLIC_MY_ROUTE_ENABLED=true pnpm --filter @hangul-route/mobile build:web
 *   E2E_MY_ROUTE=1 pnpm --filter @hangul-route/mobile exec playwright test route-tab
 *
 * The label fit runs per UI locale the build ships (`availableLocales`; add
 * `EXPO_PUBLIC_SHOW_ALL_LOCALES=1` to the build and `E2E_ALL_LOCALES=1` to the
 * run for the hidden ones). R-10 keeps the flag flip and LR-10 the route card.
 */

const ROUTE_TAB = process.env.E2E_MY_ROUTE === '1';
const LOCALES: UiLocale[] = availableLocales(process.env.E2E_ALL_LOCALES === '1');
const en = getMessages('en');

const tabLinks = (page: Page) => page.getByRole('tablist').getByRole('link');

/** Each tab's label text, and whether it fits its item: not cut, not wider than the item. */
function labelFit(page: Page): Promise<Array<{ text: string; fits: boolean; inItem: boolean }>> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="tablist"] a')].map((item) => {
      const leaves = [...item.querySelectorAll('div, span')].filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '');
      const label = leaves[leaves.length - 1] as HTMLElement | undefined;
      if (label === undefined) return { text: '', fits: false, inItem: false };
      const box = label.getBoundingClientRect();
      const itemBox = item.getBoundingClientRect();
      return {
        text: label.textContent ?? '',
        fits: label.scrollWidth <= label.clientWidth,
        inItem: box.left >= itemBox.left - 0.5 && box.right <= itemBox.right + 0.5,
      };
    }),
  );
}

const noSideScroll = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

async function learnerOnHome(page: Page): Promise<void> {
  // onboardChild answers the sideways guard of a phone held sideways once; the answer is kept.
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await closeInstallGuide(page);
}

test.describe('flag off: the bar is the three tabs of today', () => {
  test.skip(ROUTE_TAB, 'a build made with EXPO_PUBLIC_MY_ROUTE_ENABLED=true has the four-tab bar');
  test.use({ viewport: { width: 320, height: 568 } });

  test('Today, Journey, Library and no Route tab', async ({ page }) => {
    await learnerOnHome(page);
    await expect(tabLinks(page)).toHaveCount(3);
    await expect(page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab })).toHaveCount(0);
    expect((await labelFit(page)).map((l) => l.text)).toEqual([en.a11y.tabs.home, en.a11y.tabs.journey, en.a11y.tabs.library]);
  });
});

test.describe('flag on: the Route tab (LR-4)', () => {
  test.skip(!ROUTE_TAB, 'needs a build made with EXPO_PUBLIC_MY_ROUTE_ENABLED=true (E2E_MY_ROUTE=1)');

  for (const locale of LOCALES) {
    test(`320 x 568, ${locale}: Today, Route, Journey, Library; each label fits its item; Route is announced as Learning Route`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await learnerOnHome(page);
      if (locale !== 'en') await seedStored(page, 'device:settings', { uiLocale: locale });
      const m = getMessages(locale);
      await expect(tabLinks(page)).toHaveCount(4);
      const labels = await labelFit(page);
      expect(labels.map((l) => l.text)).toEqual([m.a11y.tabs.home, m.a11y.tabs.route, m.a11y.tabs.journey, m.a11y.tabs.library]);
      for (const label of labels) {
        expect(label.fits, `${label.text} is cut off`).toBe(true);
        expect(label.inItem, `${label.text} is wider than its item`).toBe(true);
      }
      await expect(tabLinks(page).nth(1)).toHaveAccessibleName(m.a11y.myRoute.tab);
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `route-tab-bar-320-${locale}`);
    });
  }

  test('the tab is a root page: the name and the purpose line, no back button', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await learnerOnHome(page);
    await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
    const screen = page.getByTestId('my-route-screen');
    await expect(screen).toBeVisible();
    await expect(screen.getByText(en.learner.myRoute.title, { exact: true })).toBeVisible();
    await expect(screen.getByText(en.learner.myRoute.purpose, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: en.a11y.goBack, exact: true })).toHaveCount(0);
    await expect(page.getByTestId('my-route-trail')).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, 'route-tab-320');
  });

  test("the active learner's entries open the tab: the Journey header link and the Home strip", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await learnerOnHome(page);
    const purpose = page.getByText(en.learner.myRoute.purpose, { exact: true });

    await page.getByRole('tablist').getByRole('link', { name: en.a11y.tabs.journey }).click();
    await expect(page.getByText(en.learner.journey.intro, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: en.learner.myRoute.open.cta, exact: true }).click();
    await expect(purpose).toBeVisible();
    await expect(page.getByRole('button', { name: en.a11y.goBack, exact: true })).toHaveCount(0);

    await page.getByRole('tablist').getByRole('link', { name: en.a11y.tabs.home }).click();
    await page.getByTestId('home-route-strip').click();
    await expect(purpose).toBeVisible();
    await expect(page.getByRole('button', { name: en.a11y.goBack, exact: true })).toHaveCount(0);
  });

  for (const size of [
    { width: 375, height: 667 },
    { width: 844, height: 390 },
    { width: 1180, height: 820 },
  ]) {
    test(`${size.width} x ${size.height}: four tabs, every label in its item, no side scroll`, async ({ page }) => {
      await page.setViewportSize(size);
      await learnerOnHome(page);
      await expect(tabLinks(page)).toHaveCount(4);
      for (const label of await labelFit(page)) {
        expect(label.fits, label.text).toBe(true);
        expect(label.inItem, label.text).toBe(true);
      }
      await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
      await expect(page.getByText(en.learner.myRoute.purpose, { exact: true })).toBeVisible();
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `route-tab-${size.width}`);
    });
  }
});
