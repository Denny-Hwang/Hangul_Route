import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild } from './helpers';

/**
 * Tablet / desktop web shell (F-LAYOUT-001 §3.3, PR 2a): the window is the
 * app. `#root` is as wide as the window (the content cap lives inside
 * `Screen`, not on the shell) and the manifest no longer locks portrait.
 * Part 2 (PR 5a, §3.7): the split-pane Journey. A wide, not-short window
 * (>= 900 wide, >= 480 high) shows the grid left and the selected cell's page
 * right; every narrower window navigates on a tap, as before. The portrait
 * guard, the Library pane and the tab bar are later PRs of the spec.
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
