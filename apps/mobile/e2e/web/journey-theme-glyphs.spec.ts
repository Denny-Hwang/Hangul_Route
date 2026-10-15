import type { Locator, Page } from '@playwright/test';
import { availableLocales, getMessages, type Locale } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, seedStored, waitForSaved } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * The Journey's theme glyphs and cell words (owner decision 2026-10-14 and owner request 2026-10-14;
 * design/components/Icon/theme-glyphs.md, wireframe journey/grid): every cell draws its theme's glyph
 * instead of the letters L / F / H / N / P with the theme word under it, each column label shows the
 * same glyph over the same word, the glyphs and the cell word are hidden from screen readers, and each
 * cell's accessible name names its theme in words. The corner marks (story count, start pin), the Next
 * triangle and the rings never cover the glyph or the word. Checked at 320 px and 768 px, in English on
 * every run and in Spanish and Korean on a build that shows every language:
 *
 *   HR_SHOTS=1 pnpm --filter @hangul-route/mobile test:e2e:web journey-theme-glyphs
 *   EXPO_PUBLIC_SHOW_ALL_LOCALES=1 build, then E2E_ALL_LOCALES=1 HR_SHOTS=1 ... journey-theme-glyphs
 */

const THEMES = [
  { key: 'letters', title: 'Letters & Books' },
  { key: 'life', title: 'Food & Daily Life' },
  { key: 'rites', title: 'Holidays & Traditions' },
  { key: 'nature', title: 'Nature & Animals' },
  { key: 'crafts', title: 'Play & Crafts' },
] as const;

type Box = { x: number; y: number; width: number; height: number };

const area = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return box as Box;
}

async function openJourney(page: Page, width: number, height: number, locale: Locale): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await waitForSaved(page, ['profiles']);
  if (locale !== 'en') {
    // The locale is read at start-up: store it, then reload so the whole app comes up in it.
    await seedStored(page, 'device:settings', { uiLocale: locale });
  }
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
  const m = getMessages(locale);
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: m.caregiver.install.notNow.cta }).click();
  await page.getByText(m.a11y.tabs.journey, { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: m.learner.journey.title })).toBeVisible();
}

for (const locale of availableLocales(process.env.E2E_ALL_LOCALES === '1')) {
  const words = getMessages(locale).learner.journey.themeWord;
  for (const [width, height] of [
    [320, 568],
    [768, 1024],
  ] as const) {
    test(`${width} px, ${locale}: theme glyphs with their word in the cells and over the column labels; no mark covers them`, async ({ page }) => {
      await openJourney(page, width, height, locale);

      for (const theme of THEMES) {
        // The column: the glyph (hidden) over the word (read).
        const column = page.getByTestId(`journey-col-${theme.key}`);
        const headerGlyph = page.getByTestId(`journey-col-glyph-${theme.key}`);
        await expect(headerGlyph).toBeVisible();
        await expect(headerGlyph).toHaveAttribute('aria-hidden', 'true');
        await expect(column).toContainText(words[theme.key]);
        const [glyphBox, columnBox] = await Promise.all([boxOf(headerGlyph), boxOf(column)]);
        expect(glyphBox.x).toBeGreaterThanOrEqual(columnBox.x - 0.5);
        expect(glyphBox.x + glyphBox.width).toBeLessThanOrEqual(columnBox.x + columnBox.width + 0.5);

        // The Stage 1 cell: its glyph and its word sit inside it, both hidden; no letter is drawn.
        const glyph = page.getByTestId(`journey-glyph-stage1-${theme.key}`);
        const word = page.getByTestId(`journey-word-stage1-${theme.key}`);
        const cell = page.getByRole('button').filter({ has: glyph });
        await expect(cell).toHaveCount(1);
        if (locale === 'en') {
          // The name says the theme in words, once: the hidden word under the glyph adds nothing to it.
          await expect(cell).toHaveAccessibleName(new RegExp(`^Stage 1 Hangul, ${theme.title.replace('&', '\\&')}: lesson`));
        }
        await expect(glyph).toBeVisible();
        await expect(glyph).toHaveAttribute('aria-hidden', 'true');
        await expect(word).toBeVisible();
        await expect(word).toHaveAttribute('aria-hidden', 'true');
        await expect(word).toHaveText(words[theme.key]);
        expect((await cell.innerText()).trim()).not.toMatch(/^[LFHNP]$/);
        const [g, w, c] = await Promise.all([boxOf(glyph), boxOf(word), boxOf(cell)]);
        expect(g.x).toBeGreaterThan(c.x);
        expect(g.y).toBeGreaterThan(c.y);
        expect(g.x + g.width).toBeLessThan(c.x + c.width);
        // The glyph is centred across its cell, and the word sits under it, inside the cell.
        expect(Math.abs(g.x + g.width / 2 - (c.x + c.width / 2))).toBeLessThan(1);
        expect(w.y).toBeGreaterThanOrEqual(g.y + g.height - 0.5);
        expect(w.x).toBeGreaterThanOrEqual(c.x);
        expect(w.x + w.width).toBeLessThanOrEqual(c.x + c.width);
        expect(w.y + w.height).toBeLessThanOrEqual(c.y + c.height);
        // One line, never clipped: the text is no wider than its box and no taller than one line.
        const fit = await word.evaluate((el) => {
          const text = (el.firstElementChild ?? el) as HTMLElement;
          const range = document.createRange();
          range.selectNodeContents(text);
          return { lines: range.getClientRects().length, scroll: text.scrollWidth, client: text.clientWidth, ink: range.getBoundingClientRect().width };
        });
        expect(fit.lines, `${locale} ${theme.key} "${words[theme.key]}"`).toBe(1);
        expect(fit.scroll, `${locale} ${theme.key}`).toBeLessThanOrEqual(fit.client);
        expect(fit.ink, `${locale} ${theme.key}`).toBeLessThanOrEqual(c.width);
      }

      // The story count mark keeps its corner and clears both the glyph and the word, at every width.
      let counts = 0;
      for (const theme of THEMES) {
        const mark = page.getByTestId(`journey-count-stage1-${theme.key}`);
        if ((await mark.count()) === 0) continue;
        counts += 1;
        const [m, g, w] = await Promise.all([
          boxOf(mark),
          boxOf(page.getByTestId(`journey-glyph-stage1-${theme.key}`)),
          boxOf(page.getByTestId(`journey-word-stage1-${theme.key}`)),
        ]);
        expect(area(m, g), theme.key).toBe(0);
        expect(area(m, w), theme.key).toBe(0);
      }
      expect(counts).toBeGreaterThan(0);

      // The Next triangle: one, clear of its cell's glyph and word.
      const next = page.locator('[data-testid^="journey-next-"]');
      await expect(next).toHaveCount(1);
      const nextId = String(await next.getAttribute('data-testid')).replace('journey-next-', '');
      const nextGlyph = page.getByTestId(`journey-glyph-${nextId}`);
      if ((await nextGlyph.count()) === 1) {
        const [n, g, w] = await Promise.all([boxOf(next), boxOf(nextGlyph), boxOf(page.getByTestId(`journey-word-${nextId}`))]);
        expect(area(n, g)).toBe(0);
        expect(area(n, w)).toBe(0);
      }

      // The start pin (a learner with a level-check result) never covers the glyph: the leaf's tip points up-left.
      const start = page.getByTestId('journey-cell-start');
      if ((await start.count()) === 1) {
        const pin = start.locator('svg').first();
        const glyphs = start.locator('[data-testid^="journey-glyph-"]');
        expect(area(await boxOf(pin), await boxOf(glyphs))).toBe(0);
      }

      // A ring (In your plan, Not open yet) goes round the glyph and ends above the word.
      for (const ring of await page.locator('[data-testid^="journey-ring-"]').all()) {
        const id = String(await ring.getAttribute('data-testid')).replace(/^journey-ring-(inPlan|notOpen)-/, '');
        const [r, w] = await Promise.all([boxOf(ring), boxOf(page.getByTestId(`journey-word-${id}`))]);
        expect(r.y + r.height, id).toBeLessThanOrEqual(w.y + 0.5);
      }

      // No cell anywhere on the grid shows a bare letter.
      const cellTexts = await page.locator('[data-testid^="journey-stage-"] [role="button"]').allInnerTexts();
      expect(cellTexts.length).toBeGreaterThanOrEqual(35);
      for (const text of cellTexts) expect(text.trim()).not.toMatch(/^[A-Z]$/);

      await expectNoHorizontalOverflow(page);
      await shot(page, `journey-theme-glyphs-${width}-${locale}`);
    });
  }
}
