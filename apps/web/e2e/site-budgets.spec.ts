import { getMessages } from '@hangul-route/i18n';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Length and glance budgets of the layered site (F-SITE-002 §3.11), over the static export, in Chromium.
 *
 * - Height at 375 x 812 and at 1280 x 800, with the claims as `SITE_CLAIMS` has them, under the budget and, at 375,
 *   under the headroom budget that leaves room for claim lines that switch on later (each claim-flip PR runs this
 *   spec with its claim on).
 * - Visible words (`innerText`, folds closed): Chromium leaves closed `<details>` bodies and `display: none` items
 *   out of `innerText`, so this counts what a visitor reads.
 * - The first screen at 320 x 568 holds the header, the h1, the lead and the page's primary action.
 * - The header is one row, at most 96 px tall, at 320 and 375; with 200 % text at 320 and at 720 it is at most two
 *   rows and nothing scrolls sideways. 200 % text is the browser's default font size (Chrome DevTools Protocol
 *   `Page.setFontSizes`, standard 32 instead of 16), as a visitor's text-size setting does, never an `html` font-size
 *   override (em breakpoints ignore that one). Chromium drops the CDP sizes when the view is resized, so the
 *   viewport is set first and the sizes after it.
 *
 * - At 320 px, at default and 200 % text, every fold opened keeps its content inside the fold's content box.
 *
 * S-4a measures `/learners`; S-4b adds `/parents` and `/teachers`; S-5 adds `/`.
 */
const en = getMessages('en').landing;

interface SitePageBudget {
  path: string;
  h1: string;
  lead: string;
  /** The page's primary action: the first link with this name inside `main`. */
  primary: string;
  /** Heights in CSS px. */
  phoneMax: number;
  phoneHeadroom: number;
  wideMax: number;
  words: number;
}

/** Persona page budgets (§3.11): 5 screens at 375 x 812 (headroom 3,700), 3,200 px at 1280 x 800, 550 words. */
const PERSONA = { phoneMax: 4060, phoneHeadroom: 3700, wideMax: 3200, words: 550 } as const;

const PAGES: readonly SitePageBudget[] = [
  { path: '/learners', h1: en.persona.learners.title, lead: en.persona.learners.lead, primary: en.nav.start, ...PERSONA },
];

/** One row of 64 px targets plus padding (§3.11). */
const HEADER_MAX = 96;
/** The browser default font size for 200 % text (16 px is 100 %). */
const TEXT_200 = 32;

const primaryOf = (page: Page, budget: SitePageBudget): Locator =>
  page.locator('main').getByRole('link', { name: budget.primary, exact: true }).first();

/** The visible header controls (the skip link is off screen until focused) and the header's own box. */
async function headerRows(page: Page): Promise<{ height: number; rows: number }> {
  return page.evaluate(() => {
    const header = document.querySelector('header.hr-site-header');
    if (!header) return { height: 0, rows: 0 };
    const tops = new Set<number>();
    for (const el of Array.from(header.querySelectorAll('a'))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) tops.add(Math.round(r.top));
    }
    // Controls whose tops are within a few px share a row (sub-pixel layout and differing heights).
    const sorted = [...tops].sort((a, b) => a - b);
    const rows = sorted.filter((top, i) => i === 0 || top - (sorted[i - 1] ?? top) > 8).length;
    return { height: header.getBoundingClientRect().height, rows };
  });
}

/** Elements whose right edge is past the viewport, named, so a failure points at the cause. */
async function overflowing(page: Page, width: number): Promise<string> {
  return page.evaluate((limit) => {
    const names: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > limit + 0.5) {
        const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : '';
        names.push(`<${el.tagName.toLowerCase()}${cls}> "${(el.textContent ?? '').trim().slice(0, 30)}" right=${Math.round(rect.right)}`);
      }
    }
    return names.slice(0, 5).join('; ');
  }, width);
}

async function setText200(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Page.setFontSizes', { fontSizes: { standard: TEXT_200, fixed: TEXT_200 } });
  // Guards the method itself: the root font size follows the browser setting, so rem text doubles.
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(`${TEXT_200}px`);
}

for (const budget of PAGES) {
  test.describe(budget.path, () => {
    test(`at 375 x 812: at most ${budget.phoneMax} px tall (headroom ${budget.phoneHeadroom}) and ${budget.words} visible words`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(budget.path);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(height).toBeLessThanOrEqual(budget.phoneMax);
      expect(height, 'headroom budget while claims are off').toBeLessThanOrEqual(budget.phoneHeadroom);
      const words = await page.evaluate(() => document.body.innerText.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length);
      expect(words).toBeGreaterThan(50);
      expect(words).toBeLessThanOrEqual(budget.words);
    });

    test(`at 1280 x 800: at most ${budget.wideMax} px tall and ${budget.words} visible words`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(budget.path);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(budget.wideMax);
      const words = await page.evaluate(() => document.body.innerText.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length);
      expect(words).toBeLessThanOrEqual(budget.words);
    });

    test('the first screen at 320 x 568 holds the header, the h1, the lead and the primary action', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto(budget.path);
      const parts: Array<[string, Locator]> = [
        ['header', page.locator('header.hr-site-header')],
        ['h1', page.getByRole('heading', { level: 1, name: budget.h1 })],
        ['lead', page.locator('main').getByText(budget.lead, { exact: true })],
        ['primary action', primaryOf(page, budget)],
      ];
      for (const [name, locator] of parts) {
        await expect(locator, name).toBeVisible();
        const box = await locator.boundingBox();
        expect(box, name).not.toBeNull();
        expect((box?.y ?? Infinity) + (box?.height ?? 0), `${name} ends on the first screen`).toBeLessThanOrEqual(568);
        expect((box?.x ?? -1) + (box?.width ?? Infinity), `${name} fits the width`).toBeLessThanOrEqual(320);
      }
    });

    for (const width of [320, 375]) {
      test(`at ${width} px the header is one row, at most ${HEADER_MAX} px tall: the brand and Sign in`, async ({ page }) => {
        await page.setViewportSize({ width, height: 812 });
        await page.goto(budget.path);
        const { height, rows } = await headerRows(page);
        expect(rows).toBe(1);
        expect(height).toBeLessThanOrEqual(HEADER_MAX);
        await expect(page.locator('header.hr-site-header').getByRole('link', { name: en.nav.signIn, exact: true })).toBeVisible();
        await expect(page.locator('header.hr-site-header').getByRole('link', { name: en.nav.start, exact: true })).toBeHidden();
        await expect(page.getByRole('navigation', { name: en.nav.label })).toBeHidden();
      });
    }

    for (const width of [320, 720]) {
      test(`with 200 % text at ${width} px: the header is at most two rows and nothing scrolls sideways`, async ({ page }) => {
        await page.setViewportSize({ width, height: 812 });
        await page.goto(budget.path);
        await setText200(page);
        const { rows } = await headerRows(page);
        expect(rows).toBeGreaterThanOrEqual(1);
        expect(rows).toBeLessThanOrEqual(2);
        const { doc, body } = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        const culprits = doc > width || body > width ? await overflowing(page, width) : '';
        expect(doc, culprits).toBeLessThanOrEqual(width);
        expect(body, culprits).toBeLessThanOrEqual(width);
        const primary = await primaryOf(page, budget).boundingBox();
        expect((primary?.x ?? -1) + (primary?.width ?? Infinity), 'the primary action is not clipped').toBeLessThanOrEqual(width);
      });
    }

    for (const text200 of [false, true]) {
      test(`at 320 px${text200 ? ' with 200 % text' : ''}: every fold opened keeps its content inside its box and the screen`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 812 });
        await page.goto(budget.path);
        if (text200) await setText200(page);
        const folds = await page.evaluate(() => {
          const all = Array.from(document.querySelectorAll('main details'));
          for (const fold of all) (fold as HTMLDetailsElement).open = true;
          return all.length;
        });
        expect(folds).toBeGreaterThan(0);
        // Each fold's body (the div after its summary) against its content box: padding is not room for content.
        const spills = await page.evaluate(() => {
          const out: string[] = [];
          for (const body of Array.from(document.querySelectorAll('main details > div'))) {
            const box = body.getBoundingClientRect();
            const style = getComputedStyle(body);
            const left = box.left + Number.parseFloat(style.paddingLeft);
            const right = box.right - Number.parseFloat(style.paddingRight);
            for (const el of Array.from(body.querySelectorAll('*'))) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && (r.right > right + 0.5 || r.left < left - 0.5)) {
                out.push(`<${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.left)}..${Math.round(r.right)} vs ${Math.round(left)}..${Math.round(right)}`);
              }
            }
          }
          return out.slice(0, 5).join('; ');
        });
        expect(spills).toBe('');
        const { doc, body } = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        const culprits = doc > 320 || body > 320 ? await overflowing(page, 320) : '';
        expect(doc, culprits).toBeLessThanOrEqual(320);
        expect(body, culprits).toBeLessThanOrEqual(320);
      });
    }

    test('at 1280 px the header is one row with every item, the current page marked', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(budget.path);
      const { height, rows } = await headerRows(page);
      expect(rows).toBe(1);
      expect(height).toBeLessThanOrEqual(HEADER_MAX);
      const nav = page.getByRole('navigation', { name: en.nav.label });
      // The shipped persona pages only (SHIPPED_PERSONA_PAGES); S-4b adds Parents and Teachers.
      await expect(nav.getByRole('link')).toHaveText([en.nav.learners]);
      await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('href', budget.path);
    });
  });
}
