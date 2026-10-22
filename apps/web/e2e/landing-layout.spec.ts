import { expect, test, type Page } from '@playwright/test';
import { LANDING_WIDTHS } from './landing-targets';

/**
 * Site layout in a real browser, over the static export (apps/web/out). Audit W1 / p2-L6, roadmap PR-21, review of
 * PR 93, F-SITE-002 §3.11.
 *
 * The SSR contract test (src/app/__tests__/landing-layout.test.tsx) pins which rules live in the stylesheet. This
 * proves what they produce: no sideways scroll on any site page, each page's primary action in view, keyboard focus
 * in reading order, and the home hero art capped and centred when the hero stacks.
 */
const HEIGHT = 800;
/**
 * Pages whose footer or body once pushed the document wider than the screen: the English site, `src/app/(en)/`
 * (F-I18N-001 PR 11b), and the layered site's persona pages (F-SITE-002 §3.11: `/learners` in S-4a, `/parents` and
 * `/teachers` in S-4b).
 * `/es` and `/ko` render the same bodies; their no-sideways-scroll matrix is `landing-locales.spec.ts`.
 */
const PAGES = ['/', '/about', '/privacy', '/terms', '/learners', '/parents', '/teachers'] as const;
/** Each page with a primary action, and its name (F-SITE-002 §3.1 rule 1). */
const PERSONA_PAGES = [
  { path: '/', primary: 'Start learning' },
  { path: '/learners', primary: 'Start learning' },
  { path: '/parents', primary: 'Create a free family space' },
  { path: '/teachers', primary: 'Create a free class' },
] as const;
/** The home hero stacks to one column below this width (globals.css, 45em). */
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

for (const width of LANDING_WIDTHS) {
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

    for (const { path, primary } of PERSONA_PAGES) {
      test(`${path}: the primary action is visible, inside the screen and above the fold`, async ({ page }) => {
        await page.goto(path);
        const cta = page.locator('main').getByRole('link', { name: primary, exact: true }).first();
        await expect(cta).toBeVisible();
        const rect = await cta.boundingBox();
        expect(rect).not.toBeNull();
        if (!rect) return;
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(HEIGHT);
      });
    }
  });
}

test.describe('the site header: keyboard focus follows the visual order (F-SITE-002 §3.2, §6)', () => {
  /**
   * Header stops, then the page's first stop (its primary action). Hidden phone items are out of the Tab order. [SN]
   * AMENDMENTS-SITE-NEWUSER §3.2: the Start pill (visible text "Start") on phones off `/`, and the language control
   * (its summary reads the hidden word "Language" and the endonym) before Sign in.
   */
  const LANGUAGE = 'Language English';
  const STOPS: Record<'home' | 'phone' | 'wide', string[]> = {
    home: ['Skip to content', 'Hangul Route', LANGUAGE, 'Sign in', 'Start learning'],
    phone: ['Skip to content', 'Hangul Route', 'Start', LANGUAGE, 'Sign in', 'Start learning'],
    // Every persona page ships from S-4b (SHIPPED_PERSONA_PAGES).
    wide: ['Skip to content', 'Hangul Route', 'Start', 'Learners', 'Parents', 'Teachers', LANGUAGE, 'Sign in', 'Start learning'],
  };
  for (const path of ['/', '/learners']) {
    for (const width of [...LANDING_WIDTHS, 1280]) {
      test(`${path} at ${width}px: skip link, brand, then the header items left to right, then the page`, async ({ page }) => {
        await page.setViewportSize({ width, height: HEIGHT });
        await page.goto(path);
        const expected = width >= 720 ? STOPS.wide : path === '/' ? STOPS.home : STOPS.phone;
        const stops = await tabStops(page, expected.length);
        // The brand mark ("HR", from 360 px) is part of the brand link's name (WCAG 2.5.3); the name is the rest.
        expect(stops.map((stop) => stop.name.replace(/^HR\s*/, '').replace(/\s+/g, ' '))).toEqual(expected);
        // Reading order from the brand on (the skip link sits over the page while focused).
        for (let i = 2; i < stops.length; i += 1) {
          const prev = stops[i - 1];
          const next = stops[i];
          if (!prev || !next) throw new Error('missing tab stop');
          expect(readsAfter(prev, next), `${prev.name} → ${next.name} jumps backwards on screen`).toBe(true);
        }
      });
    }
  }

  test("[SN] / : the hero's grown-up links open /parents and /teachers; an old #who link still focuses the chooser", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: HEIGHT });
    await page.goto('/');
    await page.locator('main').getByRole('link', { name: "I'm a parent or caregiver", exact: true }).click();
    await expect(page).toHaveURL(/\/parents$/);
    await page.goto('/');
    await page.locator('main').getByRole('link', { name: "I'm a teacher", exact: true }).click();
    await expect(page).toHaveURL(/\/teachers$/);
    await page.goto('/#who');
    await expect(page.locator('#who')).toBeInViewport();
  });

  test('[SN] the language menu: Escape closes it and returns focus to its summary; a tap outside closes it', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: HEIGHT });
    await page.goto('/parents');
    const summary = page.locator('header details.hr-site-lang > summary');
    await summary.click();
    await expect(page.locator('header details.hr-site-lang')).toHaveAttribute('open', '');
    await expect(page.locator('header .hr-site-lang-menu a[hreflang="es"]')).toHaveAttribute('href', '/es/parents');
    await page.keyboard.press('Escape');
    await expect(page.locator('header details.hr-site-lang')).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();
    await summary.click();
    await page.mouse.click(10, HEIGHT - 10);
    await expect(page.locator('header details.hr-site-lang')).not.toHaveAttribute('open', '');
  });
});

test.describe('home hero: stacked and capped below 720px, two columns from 720px', () => {
  /** 600 and 719 sit between the cap and the stacking breakpoint, where the cap, not the column, sets the width. */
  for (const width of [320, 375, 600, 719]) {
    // [SN] AMENDMENTS-SITE-NEWUSER §3.3: the art holds the phone frame, capped at 22rem (352 px at default text).
    test(`${width}px: the hero art is capped at 352 px and centred, under the text`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto('/');
      const art = page.locator('.hr-site-hero-art').first();
      const cap = await art.evaluate((el) => getComputedStyle(el).maxWidth);
      expect(cap).toBe('352px');
      const rect = await box(page, '.hr-site-hero-art');
      expect(rect.right - rect.left).toBeLessThanOrEqual(352.5);
      const parent = await art.evaluate((el) => {
        const r = (el.parentElement as HTMLElement).getBoundingClientRect();
        return { left: r.left + window.scrollX, right: r.right + window.scrollX };
      });
      expect(Math.abs(rect.left - parent.left - (parent.right - rect.right)), 'centred').toBeLessThanOrEqual(1);
      const text = await box(page, '.hr-site-hero > div:first-child');
      expect(rect.top, 'the art sits below the hero text').toBeGreaterThanOrEqual(text.bottom - 1);
    });
  }

  test(`${STACK_BELOW + 48}px: text and art side by side, the art capped at 360 px`, async ({ page }) => {
    await page.setViewportSize({ width: STACK_BELOW + 48, height: HEIGHT });
    await page.goto('/');
    const text = await box(page, '.hr-site-hero > div:first-child');
    const art = await box(page, '.hr-site-hero-art');
    expect(art.left, 'the art is beside the text').toBeGreaterThanOrEqual(text.right - 1);
    expect(await page.locator('.hr-site-hero-art').first().evaluate((el) => getComputedStyle(el).maxWidth)).toBe('360px');
  });
});

test.describe('Hoya is drawn square inside the hero art, and the bubble stays readable', () => {
  for (const width of [320, 375, 768, 1280]) {
    test(`${width}px: Hoya is square, a third of the box and inside it; the capture is drawn; the bubble never covers the phone frame`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto('/');
      const art = await box(page, '.hr-site-hero-art');
      const svg = await box(page, '.hr-site-hero-art svg[data-pose]');
      const w = svg.right - svg.left;
      const h = svg.bottom - svg.top;
      // [SN] Hoya is 34 % of the box (§3.3 item 2).
      expect(w / (art.right - art.left), 'Hoya is about a third of the art box').toBeGreaterThan(0.3);
      expect(w / (art.right - art.left)).toBeLessThan(0.38);
      expect(Math.abs(w - h), `Hoya is square (${w}x${h})`).toBeLessThanOrEqual(1);
      expect(svg.left).toBeGreaterThanOrEqual(art.left - 0.5);
      expect(svg.right).toBeLessThanOrEqual(art.right + 0.5);
      expect(svg.top).toBeGreaterThanOrEqual(art.top - 0.5);
      expect(svg.bottom).toBeLessThanOrEqual(art.bottom + 0.5);

      // [SN] The capture is loaded and drawn inside the phone frame, its alt text from the dictionary.
      const capture = page.locator('.hr-site-hero-phone img');
      await expect(capture).toHaveAttribute('alt', /^The app on a phone, in the first quest/);
      expect(await capture.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      const phone = await box(page, '.hr-site-hero-phone');
      expect(phone.left).toBeGreaterThanOrEqual(art.left - 0.5);
      expect(phone.right).toBeLessThanOrEqual(art.right + 0.5);

      // Copy that wraps (en-XA, longer es / ko) never covers the phone frame: stretch the bubble, then compare.
      const bubble = page.locator('.hr-site-bubble').first();
      const right = await bubble.evaluate((el) => {
        el.textContent = Array.from({ length: 6 }, () => 'Hoya says a longer hello that wraps').join(' ');
        return el.getBoundingClientRect().right + window.scrollX;
      });
      // On phones the bubble (at most 34 %) never covers the frame (from 40 %); from 45em it sits over Hoya, inside the box.
      if (width < STACK_BELOW) expect(right, 'the stretched bubble stays left of the phone frame').toBeLessThanOrEqual(phone.left + 0.5);
      else expect(right, 'the stretched bubble stays inside the art box').toBeLessThanOrEqual(art.right + 0.5);
    });
  }
});

/** [SN] AMENDMENTS-SITE-NEWUSER §4: nothing scrolls sideways with the header's language menu open. */
test.describe('[SN] the language menu open: no sideways scroll, the menu inside the screen', () => {
  for (const width of LANDING_WIDTHS) {
    for (const route of PAGES) {
      test(`${route} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: HEIGHT });
        await page.goto(route);
        await page.locator('header details.hr-site-lang > summary').click();
        const menu = await box(page, 'header .hr-site-lang-menu');
        expect(menu.left).toBeGreaterThanOrEqual(0);
        expect(menu.right).toBeLessThanOrEqual(width);
        const { doc, body } = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        const culprits = doc > width || body > width ? (await overflowing(page, width)).join('; ') : '';
        expect(doc, culprits).toBeLessThanOrEqual(width);
        expect(body, culprits).toBeLessThanOrEqual(width);
      });
    }
  }
});
