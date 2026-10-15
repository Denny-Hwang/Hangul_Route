import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, waitForSaved } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * The Journey's theme glyphs (owner decision 2026-10-14; design/components/Icon/theme-glyphs.md,
 * wireframe journey/grid): every cell draws its theme's glyph instead of the letters L / F / H / N / P,
 * each column label shows the same glyph over its word, the glyphs are hidden from screen readers,
 * and each cell's accessible name names its theme in words. Checked at 320 px and 768 px.
 *
 *   HR_SHOTS=1 pnpm --filter @hangul-route/mobile test:e2e:web journey-theme-glyphs
 */

const THEMES = [
  { key: 'letters', column: 'Letters', title: 'Letters & Books' },
  { key: 'life', column: 'Food', title: 'Food & Daily Life' },
  { key: 'rites', column: 'Holidays', title: 'Holidays & Traditions' },
  { key: 'nature', column: 'Nature', title: 'Nature & Animals' },
  { key: 'crafts', column: 'Play', title: 'Play & Crafts' },
] as const;

async function openJourney(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await waitForSaved(page, ['profiles']);
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

for (const [width, height] of [
  [320, 568],
  [768, 1024],
] as const) {
  test(`${width} px: theme glyphs in the cells and over the column labels, no letters, the theme named in each label`, async ({ page }) => {
    await openJourney(page, width, height);

    for (const theme of THEMES) {
      // The column: the glyph (hidden) over the word (read).
      const column = page.getByTestId(`journey-col-${theme.key}`);
      const headerGlyph = page.getByTestId(`journey-col-glyph-${theme.key}`);
      await expect(headerGlyph).toBeVisible();
      await expect(headerGlyph).toHaveAttribute('aria-hidden', 'true');
      await expect(column).toContainText(theme.column);
      const [glyphBox, columnBox] = await Promise.all([headerGlyph.boundingBox(), column.boundingBox()]);
      expect(glyphBox && columnBox).toBeTruthy();
      if (glyphBox && columnBox) {
        expect(glyphBox.x).toBeGreaterThanOrEqual(columnBox.x - 0.5);
        expect(glyphBox.x + glyphBox.width).toBeLessThanOrEqual(columnBox.x + columnBox.width + 0.5);
      }

      // The Stage 1 cell: its glyph sits inside it, hidden; its name says the theme in words; no letter is drawn.
      const cell = page.getByRole('button', { name: new RegExp(`^Stage 1 Hangul, ${theme.title.replace('&', '\\&')}: lesson`) });
      const glyph = page.getByTestId(`journey-glyph-stage1-${theme.key}`);
      await expect(glyph).toBeVisible();
      await expect(glyph).toHaveAttribute('aria-hidden', 'true');
      await expect(cell.getByTestId(`journey-glyph-stage1-${theme.key}`)).toHaveCount(1);
      expect((await cell.innerText()).trim()).not.toMatch(/^[LFHNP]$/);
      const [g, c] = await Promise.all([glyph.boundingBox(), cell.boundingBox()]);
      expect(g && c).toBeTruthy();
      if (g && c) {
        expect(g.x).toBeGreaterThan(c.x);
        expect(g.y).toBeGreaterThan(c.y);
        expect(g.x + g.width).toBeLessThan(c.x + c.width);
        expect(g.y + g.height).toBeLessThan(c.y + c.height);
        // The glyph is centred in its cell.
        expect(Math.abs(g.x + g.width / 2 - (c.x + c.width / 2))).toBeLessThan(1);
      }
    }

    // The story count mark sits on the cell's top-right corner. At 320 px it may cover only the glyph's
    // corner (at most 9 x 9 of its 24 x 24 box, where no glyph draws the part that names its theme; the
    // leaf's tip points up-left); at 768 px it clears the glyph.
    for (const theme of THEMES) {
      const mark = page.getByTestId(`journey-count-stage1-${theme.key}`);
      if ((await mark.count()) === 0) continue;
      const [m, g] = await Promise.all([mark.boundingBox(), page.getByTestId(`journey-glyph-stage1-${theme.key}`).boundingBox()]);
      expect(m && g).toBeTruthy();
      if (!m || !g) continue;
      const overlapX = Math.max(0, Math.min(m.x + m.width, g.x + g.width) - Math.max(m.x, g.x));
      const overlapY = Math.max(0, Math.min(m.y + m.height, g.y + g.height) - Math.max(m.y, g.y));
      if (width === 320) {
        expect(overlapX, theme.key).toBeLessThanOrEqual(9);
        expect(overlapY, theme.key).toBeLessThanOrEqual(9);
        // only the top-right corner: the mark starts right of the glyph's centre and ends above it
        expect(m.x, theme.key).toBeGreaterThan(g.x + g.width / 2);
        expect(m.y + m.height, theme.key).toBeLessThan(g.y + g.height / 2);
      } else {
        expect(overlapX * overlapY, theme.key).toBe(0);
      }
    }
    await expect(page.getByTestId('journey-count-stage1-nature')).toBeVisible();

    // No cell anywhere on the grid shows a bare letter.
    const cellTexts = await page.getByRole('button', { name: /^Stage \d / }).allInnerTexts();
    expect(cellTexts.length).toBeGreaterThanOrEqual(35);
    for (const text of cellTexts) expect(text.trim()).not.toMatch(/^[A-Z]$/);

    // The Next triangle and the count marks are unchanged.
    await expect(page.locator('[data-testid^="journey-next-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid^="journey-count-"]').first()).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await shot(page, `journey-theme-glyphs-${width}`);
  });
}
