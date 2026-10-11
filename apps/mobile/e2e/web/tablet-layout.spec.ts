import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored } from './helpers';

/**
 * Tablet / desktop web shell (F-LAYOUT-001 §3.3, PR 2a): the window is the
 * app. `#root` is as wide as the window (the content cap lives inside
 * `Screen`, not on the shell) and the manifest no longer locks portrait.
 * Part 2 (PR 5a, §3.7): the split-pane Journey. A wide, not-short window
 * (>= 900 wide, >= 480 high) shows the grid left and the selected cell's page
 * right; every narrower window navigates on a tap, as before. The portrait
 * guard and the Library pane are later PRs of the spec.
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

// --- Part 2: the split-pane Journey (PR 5a) ---

/** Cold start to Home of a fresh learner, then the Journey tab. */
async function openJourney(page: Page): Promise<void> {
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

const cell = (page: Page, theme: RegExp, stage: string) => page.getByRole('button', { name: new RegExp(`${theme.source}.* episode for ${stage}(, coming soon)?$`) });
const detailPane = (page: Page) => page.getByRole('region', { name: 'Episode details' });
const mapPane = (page: Page) => page.getByRole('region', { name: 'Journey map' });
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
    await expect(cell(page, /^Letters/, 'stage1')).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, /^Life|^Food/, 'stage1')).toHaveAttribute('aria-selected', 'false');

    // A tap selects: the right pane changes, the map stays, no navigation.
    const url = page.url();
    await cell(page, /^Life|^Food/, 'stage1').click();
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await expect(cell(page, /^Life|^Food/, 'stage1')).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, /^Letters/, 'stage1')).toHaveAttribute('aria-selected', 'false');
    await expect(mapPane(page)).toBeVisible();
    expect(page.url()).toBe(url);
    expect(await overflowsSideways(page)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('a coming-soon cell shows the coming-soon content in the pane, not a lock or a paywall', async ({ page }) => {
    await openJourney(page);
    await cell(page, /^Letters/, 'stage2').click();
    await expect(cell(page, /^Letters/, 'stage2')).toHaveAttribute('aria-selected', 'true');
    await expect(detailPane(page).getByText('Coming soon', { exact: true }).first()).toBeVisible();
    await expect(detailPane(page).getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
    await expect(page.getByText('Premium', { exact: false }).first()).toBeVisible(); // the stage pill is untouched
    await expect(page.getByLabel('Go back', { exact: true })).toHaveCount(0);
  });

  test('Start opens the quest full screen; leaving returns to the same selection', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await openJourney(page);
    await cell(page, /^Life|^Food/, 'stage1').click();
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await detailPane(page).getByRole('button', { name: 'Start', exact: true }).first().click();
    // Its first quest builds on an earlier one: the "Start there?" sheet asks once, in the pane.
    await detailPane(page).getByRole('button', { name: 'Play anyway' }).click();

    await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
    await expect(mapPane(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Leave quest' }).click();

    // Leaving lands on the quest's episode page (QuestPlayer replaces itself with it, unchanged here);
    // its back arrow returns to the Journey, which kept its selection.
    await expect(page.getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await page.getByLabel('Go back', { exact: true }).click();
    await expect(mapPane(page)).toBeVisible();
    await expect(cell(page, /^Life|^Food/, 'stage1')).toHaveAttribute('aria-selected', 'true');
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
  });
});

test.describe('Journey at 768x1024: one pane, a tap navigates', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('no panes; tapping a cell opens the episode page', async ({ page }) => {
    await openJourney(page);
    await expect(mapPane(page)).toHaveCount(0);
    await expect(detailPane(page)).toHaveCount(0);
    expect(await overflowsSideways(page)).toBe(false);
    await expect(cell(page, /^Letters/, 'stage1')).not.toHaveAttribute('aria-selected', /.*/);
    await cell(page, /^Life|^Food/, 'stage1').click();
    await expect(page.getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await expect(page.getByLabel('Go back', { exact: true })).toBeVisible();
  });

  test('rotating between 768x1024 and 1024x768 keeps the selection and never navigates', async ({ page }) => {
    await openJourney(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(detailPane(page)).toBeVisible();
    await cell(page, /^Life|^Food/, 'stage1').click();
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(detailPane(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible(); // still the grid, not the episode page

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(detailPane(page).getByRole('heading', { name: 'Around the Korean Table' })).toBeVisible();
    await expect(cell(page, /^Life|^Food/, 'stage1')).toHaveAttribute('aria-selected', 'true');
    expect(await overflowsSideways(page)).toBe(false);
  });
});

for (const vp of [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: '200 % zoom proxy of 1180x820', width: 590, height: 410 },
  { name: 'phone landscape', width: 844, height: 390 },
] as const) {
  test.describe(`Journey at ${vp.name} ${vp.width}x${vp.height}: one pane`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('no panes and no sideways scrolling', async ({ page }) => {
      await openJourney(page);
      await expect(detailPane(page)).toHaveCount(0);
      await expect(cell(page, /^Letters/, 'stage1')).toBeAttached();
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
    await expect(items).toHaveCount(3);
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

// --- Part 3: the Library pane and card columns (PR 5b) ---

/** Cold start of a learner who has earned Book, then Paper Folding, then Kimchi (the latest), on the Library tab. */
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
    ],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 1,
  });
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
  await expect(page.getByText('3 of 42 collected')).toBeVisible();
}

const galleryPane = (page: Page) => page.getByRole('region', { name: 'Card gallery' });
const cardPane = (page: Page) => page.getByRole('region', { name: 'Card details' });
/** Gallery thumbs in content order: the first row is Book, then two locked Letters cards. */
const thumbs = (scope: Page | ReturnType<Page['locator']>) => scope.getByRole('button', { name: /^(Book|Kimchi|Paper Folding|Locked card)$/ });

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

  test('a locked card shows where it is earned, with no paywall', async ({ page }) => {
    await openLibrary(page);
    // The second Letters card (Hanji Paper) is the reward of the second Letters quest.
    await thumbs(galleryPane(page)).nth(1).click();
    await expect(thumbs(galleryPane(page)).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(cardPane(page).getByRole('heading', { name: 'Hanji Paper' })).toBeVisible();
    await expect(cardPane(page).getByText('How to earn it')).toBeVisible();
    await expect(cardPane(page).getByText('Get 2 or more stars in Meet m, b, s, ng to earn this card.')).toBeVisible();
    await expect(cardPane(page).getByText('Premium')).toHaveCount(0);
    await expect(cardPane(page).getByRole('button', { name: 'Hear it' })).toHaveCount(0);
    // A card no quest awards yet says so instead of promising one.
    await thumbs(galleryPane(page)).nth(5).click(); // Hangul Day (stage1-complete)
    await expect(cardPane(page).getByRole('heading', { name: 'Hangul Day' })).toBeVisible();
    await expect(cardPane(page).getByText('This card comes in a later quest.')).toBeVisible();
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
