import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, unlockWithPin } from './helpers';

/**
 * F-LAYOUT-001 PR 6 (§3.6 game rows, PIN row, LD4 "media scales, text does not"):
 * tiles, the Trace canvas and the PIN keys grow by the window's media scale
 * (1 / 1.2 / 1.4), Match Sound puts the prompt beside its tiles only on a wide
 * landscape window, and a phone, upright or on its side, keeps today's sizes.
 * The base sizes are the design-system touch targets: hero 96 (Match Sound
 * tiles), child 80 (Build a Letter tiles, PIN keys).
 */
interface Case {
  name: string;
  width: number;
  height: number;
  scale: number;
  /** Prompt beside the tiles (wide landscape, not short). */
  side: boolean;
  /** 2 x 2 tile grid (regular and wide, not short). */
  grid: boolean;
  /** All four tiles on one row, as on main (a landscape phone: short, no grid cap). */
  oneRow: boolean;
  /** Trace canvas ceiling: 320 x scale. */
  canvasMax: number;
}

const CASES: Case[] = [
  { name: 'iPad Air landscape / laptop', width: 1180, height: 820, scale: 1.4, side: true, grid: true, oneRow: false, canvasMax: 448 },
  { name: 'iPad portrait', width: 768, height: 1024, scale: 1.2, side: false, grid: true, oneRow: false, canvasMax: 384 },
  { name: 'iPhone 14 portrait', width: 390, height: 844, scale: 1, side: false, grid: false, oneRow: false, canvasMax: 320 },
  // A short window: the games opt out of side-by-side and nothing scales (mediaScale 1).
  { name: 'iPhone 14 landscape', width: 844, height: 390, scale: 1, side: false, grid: false, oneRow: true, canvasMax: 320 },
  { name: 'iPhone SE 1st gen', width: 320, height: 568, scale: 1, side: false, grid: false, oneRow: false, canvasMax: 320 },
];

const scaled = (base: number, scale: number): number => Math.round(base * scale);

async function box(target: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await target.boundingBox();
  expect(b, 'element has a box').not.toBeNull();
  return b!;
}

/** The install guide shows from the third cached open and covers the Home tabs. */
async function home(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

for (const c of CASES) {
  test.describe(`${c.name} ${c.width}x${c.height}`, () => {
    test.use({
      viewport: { width: c.width, height: c.height },
      // A landscape phone runs with a mouse here, so a phone-only portrait guard (F-LAYOUT-001 PR 3) never
      // covers the game; pointer type does not change any game size.
      ...(c.width > c.height && c.height < 480 ? { isMobile: false, hasTouch: false } : {}),
    });

    test('Match Sound, Build a Letter, Trace and the PIN pad take the size of the window class', async ({ page }) => {
      test.setTimeout(150_000);
      const name = 'Gabi';
      await page.goto('/');
      await page.getByRole('button', { name: "Let's start" }).click();
      await completeChildForm(page, { name });

      // Quest 1, step 2: Match Sound.
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Play minigame' }).click();
      const tiles = page.getByTestId('match-sound-tiles').getByRole('button');
      await expect(tiles).toHaveCount(4);
      const tileBoxes = await Promise.all((await tiles.all()).map(box));
      for (const t of tileBoxes) {
        expect(t.width, 'tile width').toBeCloseTo(scaled(96, c.scale), 0);
        expect(t.height, 'tile height').toBeGreaterThanOrEqual(scaled(96, c.scale) - 1);
      }
      const rows = new Set(tileBoxes.map((t) => Math.round(t.y)));
      if (c.grid) expect(rows.size, 'four tiles sit 2 x 2').toBe(2);
      if (c.oneRow) expect(rows.size, 'four tiles on one row, as on main').toBe(1);
      const speaker = await box(page.getByTestId('match-sound-speaker'));
      const grid = await box(page.getByTestId('match-sound-tiles'));
      if (c.side) {
        expect(grid.x, 'tiles right of the prompt').toBeGreaterThanOrEqual(speaker.x + speaker.width);
        // The columns are top-aligned: the grid starts above the speaker's bottom edge (stacked, it starts below it).
        expect(grid.y, 'tiles level with the prompt').toBeLessThan(speaker.y + speaker.height);
      } else {
        expect(grid.y, 'tiles under the prompt').toBeGreaterThanOrEqual(speaker.y + speaker.height);
      }

      // Quest 1, step 4: Build a Letter tiles (base touchTarget.child).
      await home(page, name);
      await page.getByRole('button', { name: /Meet the Letters/ }).click();
      await page.getByRole('button', { name: 'Start' }).first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Skip for now' }).click();
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expect(page.getByText('Build this letter')).toBeVisible();
      const letter = await box(page.getByRole('button', { name: /^Korean letter / }).first());
      expect(letter.width, 'Build a Letter tile').toBeCloseTo(scaled(80, c.scale), 0);

      // Quest 2, step 3: Trace.
      await home(page, name);
      await page.getByRole('button', { name: /Meet the Letters/ }).click();
      await page.getByRole('button', { name: 'Start' }).nth(1).click();
      await page.getByRole('button', { name: 'Play anyway' }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Skip for now' }).click();
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expect(page.getByText(/^Trace the letter /)).toBeVisible();
      const canvas = await box(page.locator('#trace-canvas'));
      expect(canvas.width, 'canvas ceiling').toBeLessThanOrEqual(c.canvasMax);
      if (c.canvasMax > 320) expect(canvas.width, 'canvas grows past the phone ceiling').toBeGreaterThan(320);
      if (c.side) {
        expect(canvas.width, 'wide canvas').toBe(448);
        const done = await box(page.getByRole('button', { name: 'Done', exact: true }));
        expect(done.x, 'controls beside the canvas').toBeGreaterThanOrEqual(canvas.x + canvas.width);
      }
      await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeInViewport({ ratio: 1 });

      // PIN pad (verify mode): keys scale up to touchTarget.hero.
      await home(page, name);
      await page.getByRole('button', { name: 'Profile and settings' }).click();
      await page.getByRole('button', { name: 'Restore from a file (PIN required)' }).click();
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
      // The pad sizes itself from an estimate until the header is measured: poll until the keys settle.
      const digit5 = page.getByRole('button', { name: 'Digit 5' });
      await expect(async () => {
        const key = await box(digit5);
        expect(key.width, 'PIN key').toBeLessThanOrEqual(Math.min(96, scaled(80, c.scale)));
        expect(key.width, 'PIN key floor').toBeGreaterThanOrEqual(64);
        if (c.scale > 1) expect(key.width, 'tablet PIN key').toBe(96);
      }).toPass({ timeout: 5_000 });
      await unlockWithPin(page);
    });
  });
}
