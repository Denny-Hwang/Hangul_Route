import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { journeyCellName, keepSidewaysIfAsked, onboardChild, openGrownUpZone, playCheck, readStored, seedStored, waitForSaved } from './helpers';
import { shot, shotsEnabled } from './shots';

/**
 * Tablet / desktop web shell (F-LAYOUT-001 §3.3, PR 2a): the window is the
 * app. `#root` is as wide as the window (the content cap lives inside
 * `Screen`, not on the shell) and the manifest no longer locks portrait.
 * Part 2 (PR 5a, §3.7): the split-pane Journey. A wide, not-short window
 * (>= 900 wide, >= 480 high) shows the grid left and the selected cell's page
 * right; every narrower window navigates on a tap, as before. The portrait
 * guard is a later PR of the spec.
 * PR 2b: the tab row is centred inside `maxWidth.full` and the PWA banners
 * and install guide sit in a centred `maxWidth.reading` column above the tab
 * bar.
 */
const WIDE_VIEWPORTS = [
  { name: 'iPad portrait', width: 768, height: 1024 },
  { name: 'iPad Air landscape / laptop', width: 1180, height: 820 },
] as const;

for (const vp of WIDE_VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('#root is as wide as the window, with no cap and no side borders', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
      const root = await page.evaluate(() => {
        const el = document.getElementById('root');
        if (!el) return null;
        const css = getComputedStyle(el);
        return {
          width: el.getBoundingClientRect().width,
          left: el.getBoundingClientRect().left,
          maxWidth: css.maxWidth,
          borderLeft: css.borderLeftWidth,
          borderRight: css.borderRightWidth,
        };
      });
      expect(root, '#root exists').not.toBeNull();
      expect(root!.width).toBe(vp.width);
      expect(root!.left).toBe(0);
      expect(root!.maxWidth).toBe('none');
      expect(root!.borderLeft).toBe('0px');
      expect(root!.borderRight).toBe('0px');
    });
  });
}

test('the web manifest does not lock the orientation', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as { orientation?: string };
  expect(manifest.orientation).toBe('any');
});

// --- Part 4: Home in two columns (PR 5c, §3.6) ---
// Regular and wide windows: missions left (flex 3), progress / homework / tip / recent stars right (flex 2),
// Hoya x1.2 / x1.4. Phones, short windows and the 200 % zoom proxy: one column, exactly as before.

/** Cold start to Home of a fresh learner. */
async function openHomeColumns(page: Page): Promise<void> {
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await expect(page.getByText('Today with Hoya')).toBeVisible();
}

const greetingHoya = (page: Page) => page.getByLabel('Hoya the tiger, waving', { exact: true }).first();

for (const vp of [
  { name: 'smallest regular (tablet split screen)', width: 600, height: 900, hoya: 86 },
  { name: 'iPad portrait', width: 768, height: 1024, hoya: 86 },
  { name: 'wide, just above the short limit', width: 960, height: 600, hoya: 101 },
  { name: 'iPad Air landscape / laptop', width: 1180, height: 820, hoya: 101 },
] as const) {
  test.describe(`Home at ${vp.name} ${vp.width}x${vp.height}: two columns`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('missions left, progress, homework and the tip right; Hoya scaled', async ({ page }) => {
      await openHomeColumns(page);
      const missions = (await page.getByTestId('home-missions-column').boundingBox())!;
      const side = (await page.getByTestId('home-side-column').boundingBox())!;
      expect(side.x).toBeGreaterThanOrEqual(missions.x + missions.width);
      expect(Math.abs(side.y - missions.y)).toBeLessThan(1);
      expect(missions.width / side.width).toBeCloseTo(1.5, 1);

      const progress = (await page.getByTestId('home-route-strip').boundingBox())!;
      const tip = (await page.getByText(/^Tip — finish today/).boundingBox())!;
      const homework = (await page.getByRole('button', { name: 'Open homework' }).boundingBox())!;
      for (const box of [progress, tip, homework]) expect(box.x).toBeGreaterThanOrEqual(side.x - 1);
      // The three mission cards keep their slot order, one under the other, in the left column.
      const cards = await page.getByTestId('home-missions-column').getByTestId('home-missions').getByRole('button').all();
      expect(cards.length).toBe(3);
      const tops = await Promise.all(cards.map(async (c) => (await c.boundingBox())!.y));
      expect([...tops].sort((a, b) => a - b)).toEqual(tops);

      const hoya = (await greetingHoya(page).boundingBox())!;
      expect(Math.round(hoya.width)).toBe(vp.hoya);
      expect(await overflowsSideways(page)).toBe(false);
    });
  });
}

for (const vp of [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: '200 % zoom proxy of 1180x820', width: 590, height: 410 },
] as const) {
  test.describe(`Home at ${vp.name} ${vp.width}x${vp.height}: one column`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('one column in today\'s order, Hoya at its phone size, no sideways scrolling', async ({ page }) => {
      await openHomeColumns(page);
      await expect(page.getByTestId('home-side-column')).toHaveCount(0);
      const lastMission = (await page.getByTestId('home-missions').getByRole('button').last().boundingBox())!;
      const progress = (await page.getByTestId('home-route-strip').boundingBox())!;
      expect(progress.y).toBeGreaterThan(lastMission.y + lastMission.height);
      expect(Math.round((await greetingHoya(page).boundingBox())!.width)).toBe(72);
      expect(await overflowsSideways(page)).toBe(false);
    });
  });
}

test.describe('Home at 1180x820, then 200 % zoom (590x410) live', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('two columns reflow to one column in the same order, with no sideways scrolling (§5)', async ({ page }) => {
    await openHomeColumns(page);
    await expect(page.getByTestId('home-side-column')).toBeVisible();
    const missionNames = page.getByTestId('home-missions').getByRole('button');
    const before = await missionNames.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(before.length).toBe(3);

    await page.setViewportSize({ width: 590, height: 410 });
    await expect(page.getByTestId('home-side-column')).toHaveCount(0);
    const after = await missionNames.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(after).toEqual(before);
    const lastMission = (await missionNames.last().boundingBox())!;
    const progress = (await page.getByTestId('home-route-strip').boundingBox())!;
    expect(progress.y).toBeGreaterThan(lastMission.y + lastMission.height);
    expect(Math.round((await greetingHoya(page).boundingBox())!.width)).toBe(72);
    expect(await overflowsSideways(page)).toBe(false);
  });
});

// --- Part 2: the split-pane Journey (PR 5a) ---

/**
 * The physical screen a page sees (`screen.width` / `height`). Chromium's mobile emulation reports
 * the viewport there and ignores Playwright's `screen` option, so a zoomed tablet is modelled by
 * overriding the getters before the app loads.
 */
async function emulateScreen(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.addInitScript((s) => {
    Object.defineProperty(Screen.prototype, 'width', { configurable: true, get: () => s.width });
    Object.defineProperty(Screen.prototype, 'height', { configurable: true, get: () => s.height });
  }, size);
}

/** Cold start to Home of a fresh learner, then the Journey tab. */
async function openJourney(page: Page): Promise<void> {
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

const cell = (page: Page, theme: string, stage: number) => page.getByRole('button', { name: journeyCellName(stage, theme) });
const detailPane = (page: Page) => page.getByRole('region', { name: 'Episode details' });
const mapPane = (page: Page) => page.getByRole('region', { name: 'Journey map' });
const tab = (page: Page, name: string) => page.getByRole('tablist').getByRole('link', { name, exact: true });
/** Skips every game of the open quest (however many it has) until "See results" shows; a Check has no Skip, so it is played. */
async function skipToResults(page: Page): Promise<void> {
  const results = page.getByRole('button', { name: 'See results' });
  for (let i = 0; i < 20 && !(await results.isVisible()); i += 1) {
    const skip = page.getByRole('button', { name: 'Skip for now' });
    const cont = page.getByRole('button', { name: 'Continue' });
    const go = page.getByRole('button', { name: 'Go', exact: true });
    await expect(skip.or(cont).or(go).or(results).first()).toBeVisible();
    if (await skip.isVisible()) await skip.click();
    else if (await cont.isVisible()) await cont.click();
    else if (await go.isVisible()) await playCheck(page);
  }
  await results.click();
}
const overflowsSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test.describe('Journey at 1180x820: two panes', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('grid left, the next quest episode right; a tap selects without navigating', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await openJourney(page);

    // Two landmarks side by side, the map narrower than the page.
    await expect(mapPane(page)).toBeVisible();
    await expect(detailPane(page)).toBeVisible();
    const map = (await mapPane(page).boundingBox())!;
    const detail = (await detailPane(page).boundingBox())!;
    expect(map.width).toBeGreaterThanOrEqual(399);
    expect(map.width).toBeLessThanOrEqual(401);
    expect(detail.x).toBeGreaterThanOrEqual(map.x + map.width);
    expect(detail.width).toBeGreaterThan(400);

    // First selection = the episode of the learner's next quest.
    await expect(detailPane(page).getByRole('heading', { name: 'Meet the Letters' })).toBeVisible();
    await expect(cell(page, 'Letters', 1)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, 'Food', 1)).toHaveAttribute('aria-selected', 'false');

    // A tap selects: the right pane changes, the map stays, no navigation.
    const url = page.url();
    await cell(page, 'Food', 1).click();
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await expect(cell(page, 'Food', 1)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, 'Letters', 1)).toHaveAttribute('aria-selected', 'false');
    await expect(mapPane(page)).toBeVisible();
    expect(page.url()).toBe(url);
    expect(await overflowsSideways(page)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('a coming-soon cell shows the coming-soon content in the pane, not a lock or a paywall', async ({ page }) => {
    await openJourney(page);
    // Stage 3 Nature has no lesson and no story yet (Stage 3 Holidays ships Festival Sentences, F-CURR-001 S3-3).
    await cell(page, 'Nature & Animals', 3).click();
    await expect(cell(page, 'Nature & Animals', 3)).toHaveAttribute('aria-selected', 'true');
    await expect(detailPane(page).getByText('Coming soon', { exact: true }).first()).toBeVisible();
    await expect(detailPane(page).getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
    // The stage pill shows the availability word, never a commerce word (F-ROUTE-001 R-J, OD-8).
    await expect(page.getByText('Coming later', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Premium', { exact: false })).toHaveCount(0);
    // A stage header is never a lock or a door to the unlock page, for sighted and screen-reader users alike.
    await expect(mapPane(page).getByRole('button', { name: /locked|unlock/i })).toHaveCount(0);
    await expect(page.getByText('A taste', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Go back', { exact: true })).toHaveCount(0);
  });

  test('Start opens the quest full screen; leaving returns to the Journey pane with the same selection', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await openJourney(page);
    await cell(page, 'Food', 1).click();
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await detailPane(page).getByRole('button', { name: 'Start', exact: true }).first().click();
    // Its first quest builds on an earlier one: the "Start there?" sheet asks once, in the pane.
    await detailPane(page).getByRole('button', { name: 'Play anyway' }).click();

    await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
    await expect(mapPane(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Leave quest' }).click();

    // Two panes: straight back to the Journey (no full-screen episode page), the selection kept.
    await expect(mapPane(page)).toBeVisible();
    await expect(cell(page, 'Food', 1)).toHaveAttribute('aria-selected', 'true');
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await expect(page.getByLabel('Go back', { exact: true })).toHaveCount(0);
  });

  test('leaving a quest started from Home selects its episode in the Journey pane', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await openJourney(page);
    await cell(page, 'Food', 1).click(); // a different selection first
    await tab(page, 'Today').click();
    await page.getByRole('button', { name: /^Meet a, eo, g, n\./ }).click();
    await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
    await page.getByRole('button', { name: 'Leave quest' }).click();

    await expect(mapPane(page)).toBeVisible();
    await expect(cell(page, 'Letters', 1)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, 'Food', 1)).toHaveAttribute('aria-selected', 'false');
    await expect(detailPane(page).getByRole('heading', { name: 'Meet the Letters' })).toBeVisible();
  });

  test('the same episode can be asked for again after the learner selected another one', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await openJourney(page);
    const leaveFromHome = async (): Promise<void> => {
      await tab(page, 'Today').click();
      await page.getByRole('button', { name: /^Meet a, eo, g, n\./ }).click();
      await page.getByRole('button', { name: 'Leave quest' }).click();
      await expect(mapPane(page)).toBeVisible();
    };
    await leaveFromHome();
    await expect(cell(page, 'Letters', 1)).toHaveAttribute('aria-selected', 'true');
    // Another selection, then the same episode asked for again: the param was cleared, so it applies again.
    await cell(page, 'Food', 1).click();
    await expect(cell(page, 'Letters', 1)).toHaveAttribute('aria-selected', 'false');
    await leaveFromHome();
    await expect(cell(page, 'Letters', 1)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, 'Food', 1)).toHaveAttribute('aria-selected', 'false');
    await expect(detailPane(page).getByRole('heading', { name: 'Meet the Letters' })).toBeVisible();
  });

  test('"Episode page" on Results opens the Journey pane with the quest episode selected', async ({ page }) => {
    await openJourney(page);
    await cell(page, 'Food', 1).click();
    await detailPane(page).getByRole('button', { name: 'Start', exact: true }).first().click();
    await detailPane(page).getByRole('button', { name: 'Play anyway' }).click();
    await skipToResults(page);
    // Food & Life quest 1 ends on its Check since F-QUEST-002 Q-6b, so Results shows stars rather than "All done!".
    await expect(page.getByText('Next up')).toBeVisible();

    await page.getByRole('button', { name: 'Episode page' }).click();
    // Finishing a quest resets the stack under Results, so this selection comes from the quest, not from memory.
    await expect(mapPane(page)).toBeVisible();
    await expect(cell(page, 'Food', 1)).toHaveAttribute('aria-selected', 'true');
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await expect(page.getByLabel('Go back', { exact: true })).toHaveCount(0);
  });
});

test.describe('Quest exits at 390x844: one pane, as before', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('leaving a quest opens its full-screen episode page', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await openJourney(page);
    await cell(page, 'Letters', 1).click();
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    await page.getByRole('button', { name: 'Leave quest' }).click();
    // The player replaces itself with the episode page (the one it was started from stays under it).
    await expect(page.getByRole('heading', { name: 'Meet the Letters' }).last()).toBeVisible();
    await expect(page.getByLabel('Go back', { exact: true }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave quest' })).toHaveCount(0);
    await expect(mapPane(page)).toHaveCount(0);
  });
});

test.describe('Journey at 768x1024: one pane, a tap navigates', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('no panes; tapping a cell opens the episode page', async ({ page }) => {
    await openJourney(page);
    await expect(mapPane(page)).toHaveCount(0);
    await expect(detailPane(page)).toHaveCount(0);
    expect(await overflowsSideways(page)).toBe(false);
    await expect(cell(page, 'Letters', 1)).not.toHaveAttribute('aria-selected', /.*/);
    await cell(page, 'Food', 1).click();
    await expect(page.getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await expect(page.getByLabel('Go back', { exact: true })).toBeVisible();
  });

  test('rotating between 768x1024 and 1024x768 keeps the selection and never navigates', async ({ page }) => {
    await openJourney(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(detailPane(page)).toBeVisible();
    await cell(page, 'Food', 1).click();
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(detailPane(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible(); // still the grid, not the episode page

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await expect(cell(page, 'Food', 1)).toHaveAttribute('aria-selected', 'true');
    expect(await overflowsSideways(page)).toBe(false);
  });
});

for (const vp of [
  { name: 'phone portrait', width: 390, height: 844 },
  // An iPad at 200 % page zoom: a phone-sized window on a tablet screen.
  { name: '200 % zoom proxy of 1180x820', width: 590, height: 410, screen: { width: 1180, height: 820 } },
  { name: 'phone landscape', width: 844, height: 390 },
] as const) {
  test.describe(`Journey at ${vp.name} ${vp.width}x${vp.height}: one pane`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test.beforeEach(async ({ page }) => {
      if ('screen' in vp) await emulateScreen(page, vp.screen);
    });

    test('no panes and no sideways scrolling', async ({ page }) => {
      await openJourney(page);
      await expect(detailPane(page)).toHaveCount(0);
      await expect(cell(page, 'Letters', 1)).toBeAttached();
      expect(await overflowsSideways(page)).toBe(false);
    });
  });
}

// --- Part 2b: centred tab bar, banners and install guide (PR 2b) ---

/** `layout.maxWidth` (design-system tokens). */
const MAX_FULL = 1120;
const MAX_READING = 720;

/** Onboard, then open Home the way a returning learner does (second open of the app). */
async function openHome(page: Page): Promise<void> {
  await onboardChild(page, { name: 'Mina' });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.goto('/');
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
}

async function box(page: Page, testId: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await page.getByTestId(testId).boundingBox();
  if (!b) throw new Error(`${testId} has no box`);
  return b;
}

const TAB_BAR_VIEWPORTS = [
  ...WIDE_VIEWPORTS,
  { name: 'desktop', width: 1440, height: 900 },
] as const;

for (const vp of TAB_BAR_VIEWPORTS) {
  test(`tab bar row is centred inside maxWidth.full and its items are >= 64 at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openHome(page);
    const items = page.getByRole('tablist').getByRole('link');
    // Today, Route, Journey, Library (F-ROUTE-001 R-10b: the Route tab is on by default).
    await expect(items).toHaveCount(4);
    const boxes = await Promise.all((await items.all()).map((i) => i.boundingBox()));
    const left = Math.min(...boxes.map((b) => b!.x));
    const right = Math.max(...boxes.map((b) => b!.x + b!.width));
    const margin = Math.max(0, (vp.width - MAX_FULL) / 2);
    expect(left).toBeCloseTo(margin, 0);
    expect(vp.width - right).toBeCloseTo(margin, 0);
    for (const b of boxes) {
      expect(b!.width).toBeGreaterThanOrEqual(64);
      expect(b!.height).toBeGreaterThanOrEqual(64);
    }
  });
}

const BANNER_VIEWPORTS = [
  { width: 1180, height: 820 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 390, height: 844 },
] as const;

for (const vp of BANNER_VIEWPORTS) {
  test(`offline-ready toast is a centred reading column above the tab bar at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openHome(page);
    await page.evaluate(() => window.dispatchEvent(new Event('hr:offline-ready')));
    await expect(page.getByText('All set! You can play without Wi-Fi now.')).toBeVisible();
    const banner = await box(page, 'pwa-banners');
    const tabBar = await page.getByRole('tablist').boundingBox();
    expect(banner.width).toBeLessThanOrEqual(MAX_READING);
    expect(banner.width).toBeLessThan(vp.width);
    expect(Math.abs(banner.x - (vp.width - banner.x - banner.width))).toBeLessThanOrEqual(1);
    expect(banner.y + banner.height, 'toast clears the tab bar').toBeLessThanOrEqual(tabBar!.y);
  });
}

test('install guide sheet is a centred reading column above the tab bar at 1180x820', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await openHome(page);
  await page.reload(); // third cached open
  await expect(page.getByText('Hi, Mina!')).toBeVisible();
  await expect(page.getByTestId('install-guide')).toBeVisible();
  const sheet = await box(page, 'install-guide-column');
  const tabBar = await page.getByRole('tablist').boundingBox();
  expect(sheet.width).toBeLessThanOrEqual(MAX_READING);
  expect(Math.abs(sheet.x - (1180 - sheet.x - sheet.width))).toBeLessThanOrEqual(1);
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(tabBar!.y);
});

// --- Part 3: the Library pane and card columns (PR 5b, §3.6) ---
// Regular windows and the 400 master pane: a 3-column gallery; a wide window shows the selected card's
// page right. Phones and short windows: the 2-column gallery as before.

/** Cold start of a learner who has earned Book, then Paper Folding, then Kimchi (the latest), on the Library tab. */
/** The largest rotateY (degrees) the flip button's face reaches over the next 700 ms. */
function maxRotation(button: Locator): Promise<number> {
  return button.evaluate(
    (el) =>
      new Promise<number>((resolve) => {
        const face = el.firstElementChild as HTMLElement | null;
        const start = performance.now();
        let max = 0;
        const tick = (): void => {
          const m = face ? /rotateY\((-?[\d.]+)deg\)/.exec(face.style.transform) : null;
          if (m) max = Math.max(max, Math.abs(Number(m[1])));
          if (performance.now() - start < 700) requestAnimationFrame(tick);
          else resolve(max);
        };
        tick();
      }),
  );
}

async function openLibrary(page: Page): Promise<void> {
  await onboardChild(page, { name: 'Dani', startJourney: false });
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id ?? '';
  const card = (cardId: string, unlockedAt: string) => ({ cardId, unlockedAt, newSinceLastView: false });
  await seedStored(page, `progress:${id}`, {
    profileId: id,
    updatedAt: '2026-10-10T09:00:00.000Z',
    episodes: [],
    quests: [],
    cards: [
      card('card:book', '2026-10-08T09:00:00.000Z'),
      card('card:kimchi', '2026-10-10T09:00:00.000Z'),
      card('card:origami', '2026-10-09T09:00:00.000Z'),
      // Hoya's welcome card, held by every profile (F-STORY-006 §3.3); earlier, so Kimchi stays the latest.
      card('card:tiger', '2026-10-07T09:00:00.000Z'),
    ],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 1,
  });
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
  await expect(page.getByText('4 cards collected', { exact: true })).toBeVisible();
}

const galleryPane = (page: Page) => page.getByRole('region', { name: 'Card gallery' });
const cardPane = (page: Page) => page.getByRole('region', { name: 'Card details' });
/** Gallery thumbs in content order: the first row is Book, then two locked Letters cards. */
const thumbs = (scope: Page | ReturnType<Page['locator']>) => scope.getByRole('button', { name: /^(Book|Kimchi|Paper Folding|Locked card\. .+)$/ });

/** How many thumbs share the first row (same top edge). */
async function firstRowColumns(scope: Page | ReturnType<Page['locator']>): Promise<number> {
  const boxes = await Promise.all((await thumbs(scope).all()).slice(0, 4).map((t) => t.boundingBox()));
  const top = boxes[0]!.y;
  return boxes.filter((b) => Math.abs(b!.y - top) < 1).length;
}

test.describe('Library at 1180x820: two panes', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('a 3-column gallery left, the latest earned card right; a tap selects without navigating', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await openLibrary(page);

    await expect(galleryPane(page)).toBeVisible();
    await expect(cardPane(page)).toBeVisible();
    const gallery = (await galleryPane(page).boundingBox())!;
    const detail = (await cardPane(page).boundingBox())!;
    expect(gallery.width).toBeGreaterThanOrEqual(399);
    expect(gallery.width).toBeLessThanOrEqual(401);
    expect(detail.x).toBeGreaterThanOrEqual(gallery.x + gallery.width);
    expect(await firstRowColumns(galleryPane(page))).toBe(3);
    // Every thumb clears the touch target floor.
    for (const t of (await thumbs(galleryPane(page)).all()).slice(0, 6)) {
      const b = (await t.boundingBox())!;
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(64);
    }
    // The card art stays inside its thumb (sized from the measured grid, not an assumed 400).
    const bookThumb = (await galleryPane(page).getByRole('button', { name: 'Book', exact: true }).boundingBox())!;
    const bookArt = (await galleryPane(page).getByLabel('Card art for Book').boundingBox())!;
    expect(bookArt.x).toBeGreaterThanOrEqual(bookThumb.x);
    expect(bookArt.x + bookArt.width).toBeLessThanOrEqual(bookThumb.x + bookThumb.width);

    // First selection = the most recently earned card, with its page (no close button) on the right.
    await expect(galleryPane(page).getByRole('button', { name: 'Kimchi', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(galleryPane(page).getByRole('button', { name: 'Book', exact: true })).toHaveAttribute('aria-selected', 'false');
    await expect(cardPane(page).getByRole('heading', { name: 'Kimchi', exact: true })).toBeVisible();
    await expect(cardPane(page).getByRole('button', { name: 'Hear it' })).toBeVisible();

    // A tap selects: the right pane changes, the gallery stays, no navigation.
    const url = page.url();
    await galleryPane(page).getByRole('button', { name: 'Book', exact: true }).click();
    await expect(cardPane(page).getByRole('heading', { name: 'Book', exact: true })).toBeVisible();
    await expect(galleryPane(page).getByRole('button', { name: 'Book', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(galleryPane(page).getByRole('button', { name: 'Kimchi', exact: true })).toHaveAttribute('aria-selected', 'false');
    // The card still flips in the pane.
    await cardPane(page).getByRole('button', { name: 'Tap to flip card to back' }).click();
    await expect(cardPane(page).getByRole('button', { name: 'Tap to flip card to front' })).toBeVisible();
    expect(page.url()).toBe(url);
    expect(await overflowsSideways(page)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('the flip turns once per tap, ignores a second tap mid-turn, and a locked card does not turn (F-VOC-003 C-2)', async ({ page }) => {
    await openLibrary(page);
    await galleryPane(page).getByRole('button', { name: 'Book', exact: true }).click();
    const toBack = cardPane(page).getByRole('button', { name: 'Tap to flip card to back' });
    const toFront = cardPane(page).getByRole('button', { name: 'Tap to flip card to front' });
    await expect(toBack).toBeVisible();
    // Two taps inside the first 200 ms leg: the second is ignored, so the card ends on its back and stays there.
    const turn = maxRotation(toBack);
    const box = (await toBack.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect(await turn).toBeGreaterThan(45);
    await expect(toFront).toBeVisible();
    await page.waitForTimeout(500);
    await expect(toFront).toBeVisible();
    await expect(cardPane(page).getByText('tap to flip back')).toBeVisible();

    // A locked card names itself, with how it is earned, on press and shows no flip hint.
    await thumbs(galleryPane(page)).nth(1).click();
    const locked = cardPane(page).getByRole('button', { name: 'Locked card. Finish the episode: Meet the Letters' });
    await expect(locked).toBeVisible();
    await locked.click({ force: true });
    await page.waitForTimeout(500);
    await expect(locked).toBeVisible();
    await expect(cardPane(page).getByText('tap to flip', { exact: true })).toHaveCount(0);
  });

  test('under reduced motion the card swaps faces at once, with no turn', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLibrary(page);
    await galleryPane(page).getByRole('button', { name: 'Book', exact: true }).click();
    const toBack = cardPane(page).getByRole('button', { name: 'Tap to flip card to back' });
    await expect(toBack).toBeVisible();
    const turn = maxRotation(toBack);
    await toBack.click();
    expect(await turn).toBe(0);
    await expect(cardPane(page).getByRole('button', { name: 'Tap to flip card to front' })).toBeVisible();
  });

  test('a locked card shows where it is earned, with no paywall', async ({ page }) => {
    await openLibrary(page);
    // The second Letters card (Hanji Paper) is the reward of the second Letters quest.
    await thumbs(galleryPane(page)).nth(1).click();
    await expect(thumbs(galleryPane(page)).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(cardPane(page).getByRole('heading', { name: 'Hanji Paper' })).toBeVisible();
    await expect(cardPane(page).getByText('How to earn it')).toBeVisible();
    // Its earn hint (F-STORY-006 §3.7): what to do, never how far along.
    await expect(cardPane(page).getByText('Finish the episode: Meet the Letters')).toBeVisible();
    await expect(cardPane(page).getByText('Premium')).toHaveCount(0);
    await expect(cardPane(page).getByRole('button', { name: 'Hear it' })).toHaveCount(0);
    // A stage card names its stage.
    await thumbs(galleryPane(page)).nth(5).click(); // Hangul Day (stage1-complete)
    await expect(cardPane(page).getByRole('heading', { name: 'Hangul Day' })).toBeVisible();
    await expect(cardPane(page).getByText('Finish every quest in Stage 1')).toBeVisible();
  });

  test('a filter that hides the selected card shows one it keeps; clearing it brings the selection back', async ({ page }) => {
    await openLibrary(page);
    await galleryPane(page).getByRole('button', { name: 'Book', exact: true }).click();
    await galleryPane(page).getByRole('button', { name: 'Food', exact: true }).click();
    // Kimchi is the latest earned card of the Food theme.
    await expect(cardPane(page).getByRole('heading', { name: 'Kimchi', exact: true })).toBeVisible();
    await expect(galleryPane(page).getByRole('button', { name: 'Kimchi', exact: true })).toHaveAttribute('aria-selected', 'true');
    await galleryPane(page).getByRole('button', { name: 'All', exact: true }).click();
    await expect(cardPane(page).getByRole('heading', { name: 'Book', exact: true })).toBeVisible();
    await expect(galleryPane(page).getByRole('button', { name: 'Book', exact: true })).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Library at 768x1024: 3 columns, one pane, a tap navigates', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('no panes; 3 columns; tapping a card opens the card screen', async ({ page }) => {
    await openLibrary(page);
    await expect(galleryPane(page)).toHaveCount(0);
    await expect(cardPane(page)).toHaveCount(0);
    expect(await firstRowColumns(page)).toBe(3);
    await expect(page.getByRole('button', { name: 'Book', exact: true })).not.toHaveAttribute('aria-selected', /.*/);
    expect(await overflowsSideways(page)).toBe(false);
    await page.getByRole('button', { name: 'Book', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Book', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeHidden();
  });

  test('the card screen of a locked card says how to earn it too (F-STORY-006 §3.7, wireframe library/earn-hints F2)', async ({ page }) => {
    await openLibrary(page);
    await thumbs(page).nth(1).click(); // Hanji Paper, locked
    await expect(page.getByRole('heading', { name: 'Hanji Paper' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeHidden();
    await expect(page.getByText('How to earn it')).toBeVisible();
    await expect(page.getByText('Premium')).toHaveCount(0);
  });

  test('rotating between 768x1024 and 1024x768 keeps the selected card and never navigates', async ({ page }) => {
    await openLibrary(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(cardPane(page)).toBeVisible();
    await galleryPane(page).getByRole('button', { name: 'Book', exact: true }).click();
    await expect(cardPane(page).getByRole('heading', { name: 'Book', exact: true })).toBeVisible();

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(cardPane(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(cardPane(page).getByRole('heading', { name: 'Book', exact: true })).toBeVisible();
    await expect(galleryPane(page).getByRole('button', { name: 'Book', exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(await overflowsSideways(page)).toBe(false);
  });
});

for (const vp of [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'phone landscape', width: 844, height: 390 },
] as const) {
  test.describe(`Library at ${vp.name} ${vp.width}x${vp.height}: 2 columns, one pane`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('2 columns, no panes and no sideways scrolling', async ({ page }) => {
      await openLibrary(page);
      await expect(cardPane(page)).toHaveCount(0);
      expect(await firstRowColumns(page)).toBe(2);
      expect(await overflowsSideways(page)).toBe(false);
    });
  });
}

// --- Part 5: the soft portrait guard and the banner slot on screens without a tab bar (PR 3) ---

test.describe('portrait guard on a touch phone held sideways 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('appears with Hoya and one line; "Keep sideways" removes it and a reload keeps it away', async ({ page }) => {
    await page.goto('/');
    const guard = page.getByTestId('portrait-guard');
    await expect(guard).toBeVisible();
    await expect(guard.getByText('Turn your phone upright')).toBeVisible();
    const keep = page.getByRole('button', { name: 'Keep sideways' });
    const b = await keep.boundingBox();
    expect(b!.height, 'button meets the touch floor').toBeGreaterThanOrEqual(64);
    expect(b!.y + b!.height, 'button fits the short window').toBeLessThanOrEqual(390);
    await keep.click();
    await expect(guard).toHaveCount(0);
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
    await waitForSaved(page, ['device:layout']);

    await page.reload();
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
    await page.waitForTimeout(600);
    await expect(guard).toHaveCount(0);
  });

  test('turning the phone upright removes it, and it does not ask again this session', async ({ page }) => {
    await page.goto('/');
    const guard = page.getByTestId('portrait-guard');
    await expect(guard).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(guard).toHaveCount(0);
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(600);
    await expect(guard).toHaveCount(0);
  });
});

for (const vp of [
  { name: 'iPad portrait', width: 768, height: 1024 },
  { name: 'iPad landscape', width: 1180, height: 820 },
] as const) {
  test(`no portrait guard on a touch tablet at ${vp.name} ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('portrait-guard')).toHaveCount(0);
  });
}

// Review of PR 3: "phone" is the physical screen, so a zoomed or windowed tablet is never asked.
test.describe('no portrait guard on a tablet whose window is phone-sized (200 % zoom proxy) 590x410', () => {
  test.use({ viewport: { width: 590, height: 410 } });

  test('the Welcome screen is usable at once', async ({ page }) => {
    await emulateScreen(page, { width: 1180, height: 820 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('portrait-guard')).toHaveCount(0);
  });
});

// Review of PR 3: a soft keyboard makes an upright phone's window wider than tall. The guard reads
// the device orientation, and never shows while a text field has focus.
test.describe('no portrait guard when the soft keyboard shortens an upright phone 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('typing the name: the window shrinks to 390x300 and nothing covers the form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: "Let's start" }).click();
    await page.getByRole('radio', { name: /^My child or a student/ }).click();
    const name = page.getByPlaceholder('Type a name');
    await name.focus();
    // Playwright reports a landscape orientation for a wider-than-tall viewport: only the focused field keeps the guard away here.
    await page.setViewportSize({ width: 390, height: 300 });
    await page.waitForTimeout(600);
    await expect(page.getByTestId('portrait-guard')).toHaveCount(0);
    await name.fill('Mina');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('portrait-guard')).toHaveCount(0);
  });

  test('the device stays upright while the window is short: no guard even with no field focused', async ({ page }) => {
    // What a phone with its keyboard up reports: the screen is upright whatever the window does.
    await page.addInitScript(() => {
      Object.defineProperty(ScreenOrientation.prototype, 'type', { configurable: true, get: () => 'portrait-primary' });
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 300 });
    await page.waitForTimeout(600);
    await expect(page.getByTestId('portrait-guard')).toHaveCount(0);
  });
});

/** Two boxes share no pixel. */
function apart(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
}

for (const vp of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1180, height: 820 },
] as const) {
  test(`with no tab bar the offline-ready toast sits at the top and never covers the CTA at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    await keepSidewaysIfAsked(page);
    const start = page.getByRole('button', { name: "Let's start" });
    await expect(start).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('hr:offline-ready')));
    await expect(page.getByText('All set! You can play without Wi-Fi now.')).toBeVisible();
    const banner = await box(page, 'pwa-banners');
    expect(banner.y, 'toast hangs from the top').toBeLessThan(vp.height / 2);
    expect(banner.width).toBeLessThanOrEqual(MAX_READING);
    expect(Math.abs(banner.x - (vp.width - banner.x - banner.width))).toBeLessThanOrEqual(1);
    expect(apart(banner, (await start.boundingBox())!), "toast clear of Let's start").toBe(true);

    // The form's Continue sits in the sticky footer at the bottom: the toast stays clear of it too.
    await start.click();
    const cont = page.getByRole('button', { name: 'Continue' });
    await expect(cont).toBeVisible();
    await expect(page.getByText('All set! You can play without Wi-Fi now.')).toBeVisible();
    expect(apart(await box(page, 'pwa-banners'), (await cont.boundingBox())!), 'toast clear of Continue').toBe(true);
  });
}

// Review of PR 3: on a screen with no tab bar the top slot sits below the header row and never takes a
// tap; the update bar (whose Refresh reloads the page) waits for a tab screen.
for (const vp of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1180, height: 820 },
] as const) {
  test(`on a quest the banners never cover "Leave quest" and the update bar waits at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await onboardChild(page, { name: 'Mina' });
    const leave = page.getByRole('button', { name: 'Leave quest' });
    await expect(leave).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(new Event('hr:update-ready'));
      window.dispatchEvent(new Event('hr:offline-ready'));
    });
    await expect(page.getByText('All set! You can play without Wi-Fi now.')).toBeVisible();
    await expect(page.getByText('New lessons are ready.')).toHaveCount(0);
    expect(apart(await box(page, 'pwa-banners'), (await leave.boundingBox())!), 'toast clear of Leave quest').toBe(true);
    // The toast only informs: the control under the slot still takes the tap.
    page.on('dialog', (d) => void d.accept());
    await leave.click();
    await expect(leave).toHaveCount(0);
  });

  test(`on the PIN pad the banners never cover its close button at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await onboardChild(page, { name: 'Mina', startJourney: false });
    await openGrownUpZone(page, 'Mina');
    await page.evaluate(() => window.dispatchEvent(new Event('hr:offline-ready')));
    await expect(page.getByText('All set! You can play without Wi-Fi now.')).toBeVisible();
    const close = page.getByRole('button', { name: 'Close', exact: true });
    expect(apart(await box(page, 'pwa-banners'), (await close.boundingBox())!), 'toast clear of Close').toBe(true);
  });
}

test('the queued update bar shows once a tab screen is open at 390x844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  await page.evaluate(() => window.dispatchEvent(new Event('hr:update-ready')));
  await expect(page.getByText('New lessons are ready.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
});


// --- Screenshots for the pull request (§5; not a test gate) ---
// Home, Journey and Library of a learner with three cards, at a phone, an upright tablet and a wide window.
// Skipped unless HR_SHOTS=1; the PNGs land in e2e/web/__shots__/ (git-ignored).

const SHOT_VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1180, height: 820 },
] as const;

for (const vp of SHOT_VIEWPORTS) {
  test.describe(`screenshots at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test.skip(!shotsEnabled(), 'screenshots only with HR_SHOTS=1');

    test('Home, Journey and Library', async ({ page }) => {
      const size = `${vp.width}x${vp.height}`;
      await openLibrary(page);
      await shot(page, `library-${size}`);
      await tab(page, 'Today').click();
      await expect(page.getByText('Today with Hoya')).toBeVisible();
      await shot(page, `home-${size}`);
      await tab(page, 'Journey').click();
      await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
      await shot(page, `journey-${size}`);
    });
  });
}
