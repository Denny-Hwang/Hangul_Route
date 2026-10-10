import { expect, test, type Page } from '@playwright/test';

/**
 * Landing layout in a real browser, over the static export (apps/web/out).
 * Audit W1 / p2-L6, roadmap PR-21, review of PR 93.
 *
 * The SSR contract test (src/app/__tests__/landing-layout.test.tsx) pins which
 * rules live in the stylesheet. This proves what they produce: no sideways
 * scroll, "Play now" in view, keyboard focus in reading order, and the two
 * illustrations capped when the layout stacks.
 */
const HEIGHT = 800;
/** The three phone / small-tablet widths the owner named. */
const WIDTHS = [320, 375, 768] as const;
/** Pages whose footer or body once pushed the document wider than the screen. */
const PAGES = ['/', '/about', '/privacy', '/terms'] as const;
/** The hero and Meet Hoya stack to one column below this width (globals.css). */
const STACK_BELOW = 720;

interface Box {
  name: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Elements whose right edge is past the viewport — named, so a failure points at the cause. */
async function overflowing(page: Page, width: number): Promise<string[]> {
  return page.evaluate((limit) => {
    const names: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > limit + 0.5) {
        const text = (el.textContent ?? '').trim().slice(0, 30);
        const cls = el.className ? `.${String(el.className).split(' ')[0]}` : '';
        names.push(`<${el.tagName.toLowerCase()}${cls}> "${text}" right=${Math.round(rect.right)}`);
      }
    }
    return names.slice(0, 5);
  }, width);
}

/** Presses Tab `count` times and records where keyboard focus lands each time. */
async function tabStops(page: Page, count: number): Promise<Box[]> {
  const stops: Box[] = [];
  for (let i = 0; i < count; i += 1) {
    await page.keyboard.press('Tab');
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const rect = el.getBoundingClientRect();
        return {
          name: (el.textContent ?? '').trim(),
          top: rect.top + window.scrollY,
          bottom: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          right: rect.right + window.scrollX,
        };
      }),
    );
  }
  return stops;
}

/** Does `next` come after `prev` when reading: further right on the same row, or on a lower row? */
function readsAfter(prev: Box, next: Box): boolean {
  const sameRow = prev.top < next.bottom && next.top < prev.bottom;
  return sameRow ? next.left >= prev.right - 1 : next.top >= prev.bottom - 1;
}

/** Page coordinates (scroll included), so boxes measured at different scroll positions compare. */
async function box(page: Page, selector: string): Promise<Box> {
  return page.locator(selector).first().evaluate((el, name) => {
    const rect = el.getBoundingClientRect();
    return {
      name,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
    };
  }, selector);
}

for (const width of WIDTHS) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height: HEIGHT } });

    for (const route of PAGES) {
      test(`${route} does not scroll sideways`, async ({ page }) => {
        await page.goto(route);
        const { doc, body } = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));
        const culprits = doc > width || body > width ? (await overflowing(page, width)).join('; ') : '';
        expect(doc, `document scrollWidth ${doc} > ${width}. ${culprits}`).toBeLessThanOrEqual(width);
        expect(body, `body scrollWidth ${body} > ${width}. ${culprits}`).toBeLessThanOrEqual(width);
      });
    }

    test('"Play now" is visible, inside the screen and above the fold', async ({ page }) => {
      await page.goto('/');
      const cta = page.getByRole('link', { name: 'Play now', exact: true });
      await expect(cta).toBeVisible();
      const rect = await cta.boundingBox();
      expect(rect).not.toBeNull();
      if (!rect) return;
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(HEIGHT);
      await expect(cta).toHaveAttribute('href', /^https?:\/\//);
    });
  });
}

test.describe('keyboard focus follows the visual order (WCAG 2.4.3 / 1.3.2)', () => {
  for (const width of [...WIDTHS, 1280]) {
    test(`${width}px: Tab goes brand row first ("Play now"), then the section links, left to right`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto('/');
      const stops = await tabStops(page, 6);
      expect(stops.map((stop) => stop.name)).toEqual([
        'Play now',
        'Cards',
        'Games',
        'For parents',
        'Dashboard',
        'For teachers',
      ]);
      for (let i = 1; i < stops.length; i += 1) {
        const prev = stops[i - 1];
        const next = stops[i];
        if (!prev || !next) throw new Error('missing tab stop');
        expect(readsAfter(prev, next), `${prev.name} → ${next.name} jumps backwards on screen`).toBe(true);
      }
    });
  }
});

test.describe('hero and Meet Hoya: stacked and capped below 720px, two columns from 720px', () => {
  /** 600 and 719 sit between the cap and the stacking breakpoint, where the cap, not the column, sets the width. */
  for (const width of [320, 375, 600, 719]) {
    test(`${width}px: hero and Meet Hoya art are capped and centred, text first`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto('/');

      for (const selector of ['.hr-landing-hero-art', '.hr-landing-split-art']) {
        const art = page.locator(selector).first();
        const cap = await art.evaluate((el) => getComputedStyle(el).maxWidth);
        expect(cap, `${selector} has a max-width below ${STACK_BELOW}px`).toMatch(/^\d+(\.\d+)?px$/);
        const capPx = Number.parseFloat(cap);

        const rect = await box(page, selector);
        expect(rect.right - rect.left, `${selector} width`).toBeLessThanOrEqual(capPx + 0.5);

        // Centred in its column: the gap to the container's left edge equals the gap to its right edge.
        const parent = await art.evaluate((el) => {
          const container = el.parentElement as HTMLElement;
          const r = container.getBoundingClientRect();
          const style = getComputedStyle(container);
          return {
            left: r.left + window.scrollX + Number.parseFloat(style.paddingLeft),
            right: r.right + window.scrollX - Number.parseFloat(style.paddingRight),
          };
        });
        const offCentre = Math.abs(rect.left - parent.left - (parent.right - rect.right));
        expect(offCentre, `${selector} is centred`).toBeLessThanOrEqual(1);

        // When the column is wider than the cap, the cap is what sets the width.
        if (parent.right - parent.left > capPx) {
          expect(rect.right - rect.left, `${selector} sits at its cap`).toBeCloseTo(capPx, 0);
        }
      }

      // Stacked: the hero text is above its illustration, Meet Hoya's illustration above its text.
      const heroText = await box(page, '.hr-landing-hero > div:first-child');
      const heroArt = await box(page, '.hr-landing-hero-art');
      expect(heroArt.top, 'hero art sits below the hero text').toBeGreaterThanOrEqual(heroText.bottom - 1);
      const splitArt = await box(page, '.hr-landing-split-art');
      const splitText = await box(page, '.hr-landing-split > div:last-child');
      expect(splitText.top, 'Meet Hoya text sits below its art').toBeGreaterThanOrEqual(splitArt.bottom - 1);
    });
  }

  test('768px: both sections use two columns and the art is not capped', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: HEIGHT });
    await page.goto('/');

    const heroText = await box(page, '.hr-landing-hero > div:first-child');
    const heroArt = await box(page, '.hr-landing-hero-art');
    expect(heroArt.left, 'hero art is beside the text').toBeGreaterThanOrEqual(heroText.right - 1);

    const splitArt = await box(page, '.hr-landing-split-art');
    const splitText = await box(page, '.hr-landing-split > div:last-child');
    expect(splitText.left, 'Meet Hoya text is beside its art').toBeGreaterThanOrEqual(splitArt.right - 1);

    for (const selector of ['.hr-landing-hero-art', '.hr-landing-split-art']) {
      const cap = await page.locator(selector).first().evaluate((el) => getComputedStyle(el).maxWidth);
      expect(cap, `${selector} has no cap at 768px`).toBe('none');
    }
  });
});
