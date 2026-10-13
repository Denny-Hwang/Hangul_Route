import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getMessages } from '@hangul-route/i18n';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  allowedFor,
  baselinePage,
  controlKey,
  isSmall,
  LANDING_WIDTHS,
  measureControls,
  occurrenceKeys,
  ratchet,
  TARGET_MIN,
  type LandingTouchAllowlist,
} from './landing-targets';

/**
 * F-I18N-001 PR 14 (§3.11, §5): the landing half of the locale layout matrix, over the static export.
 * `/`, `/about` and, on a build that shows every locale (`NEXT_PUBLIC_SHOW_ALL_LOCALES=1`, on demand: no
 * pipeline runs it yet, F-I18N-001 §10), `/es`, `/ko`, `/es/about` and `/ko/about`, each at 320 / 375 / 768: the right `<html lang>`, no
 * sideways scroll, the primary CTA on screen without scrolling, and no control under `touchTarget.min`
 * beyond the ones listed today (`fixtures/landing-touch-allowlist.json`, a ratchet that only shrinks). The
 * es and ko dictionaries are filled (PR 15 / 16), so those pages read Spanish and Korean; the checks hold
 * their layout to the English page's, so a translation that pushes the page wider or adds a small control fails.
 *
 * The pseudo-locale's layout is covered on the learner app (`apps/mobile/e2e/web/locale.spec.ts`); on the site
 * `src/app/__tests__/landing-pseudo.test.tsx` checks that every word comes from the dictionary.
 */
const QA = process.env.NEXT_PUBLIC_SHOW_ALL_LOCALES === '1';
const HEIGHT = 800;
const allowlist = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'landing-touch-allowlist.json'), 'utf8')) as LandingTouchAllowlist;

interface LandingPage {
  path: string;
  lang: 'en' | 'es' | 'ko';
  /** The page's primary CTA: "Play now" on the landing, "Back home" on About. */
  cta: (page: Page, lang: LandingPage['lang']) => Locator;
}

/** The header's "Play now" (its class is pinned by `landing-layout.test.tsx`), whatever app origin it links to. */
const PLAY_NOW = (page: Page): Locator => page.locator('header a.hr-landing-cta');
/** About's "Back home" link, by its words in the page's locale. */
const BACK_HOME = (page: Page, lang: LandingPage['lang']): Locator =>
  page.getByRole('link', { name: getMessages(lang).landing.about.backHome, exact: true });
/** A layered-site page's primary action (F-SITE-002 §3.1 rule 1): the first primary pill inside `main`. */
const SITE_PRIMARY = (page: Page): Locator => page.locator('main a.hr-site-primary');
const PAGES: readonly LandingPage[] = [
  { path: '/', lang: 'en', cta: PLAY_NOW },
  { path: '/learners', lang: 'en', cta: SITE_PRIMARY },
  { path: '/es/learners', lang: 'es', cta: SITE_PRIMARY },
  { path: '/ko/learners', lang: 'ko', cta: SITE_PRIMARY },
  { path: '/about', lang: 'en', cta: BACK_HOME },
  { path: '/es', lang: 'es', cta: PLAY_NOW },
  { path: '/ko', lang: 'ko', cta: PLAY_NOW },
  { path: '/es/about', lang: 'es', cta: BACK_HOME },
  { path: '/ko/about', lang: 'ko', cta: BACK_HOME },
];

/**
 * The learner app's origin as this export links to it (`NEXT_PUBLIC_APP_URL` at build time), read off "Play now", or
 * off the layered site's header Start learning (F-SITE-002 §3.2), which links to the same app.
 */
async function appOrigin(page: Page): Promise<string | null> {
  const play = (await PLAY_NOW(page).count()) > 0 ? PLAY_NOW(page) : page.locator('header a.hr-site-header-start');
  if ((await play.count()) === 0) return null;
  const href = await play.first().getAttribute('href');
  try {
    return href ? new URL(href).origin : null;
  } catch {
    return null;
  }
}

/** Keys of the controls under the floor on the page as it is laid out now, repeats numbered. */
async function smallKeys(page: Page): Promise<Map<string, string>> {
  const measured = await page.evaluate(measureControls);
  const small = measured.filter((c) => isSmall(c));
  const origin = await appOrigin(page);
  const keys = occurrenceKeys(small.map((c) => controlKey(c, origin)));
  return new Map(keys.map((key, i) => [key, `${Math.round(small[i]?.width ?? 0)}x${Math.round(small[i]?.height ?? 0)}`]));
}

for (const landing of PAGES) {
  test.describe(`${landing.path} (${landing.lang})`, () => {
    test.skip(landing.lang !== 'en' && !QA, 'es and ko are exported only by a build that shows every locale');

    test(`at ${LANDING_WIDTHS.join(' / ')}: its lang, no sideways scroll, the primary CTA on screen and no new small control`, async ({
      page,
    }) => {
      const found = new Map<string, string>();
      for (const width of LANDING_WIDTHS) {
        await page.setViewportSize({ width, height: HEIGHT });
        const response = await page.goto(landing.path);
        expect(response?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', landing.lang);

        const { doc, body } = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));
        expect(doc, `${landing.path} at ${width}px: document scrollWidth`).toBeLessThanOrEqual(width);
        expect(body, `${landing.path} at ${width}px: body scrollWidth`).toBeLessThanOrEqual(width);

        const cta = landing.cta(page, landing.lang).first();
        await expect(cta).toBeVisible();
        const box = await cta.boundingBox();
        expect(box, `${landing.path} at ${width}px: primary CTA`).not.toBeNull();
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.y + box.height).toBeLessThanOrEqual(HEIGHT);
        }

        for (const [key, size] of await smallKeys(page)) found.set(key, `${size} at ${width}px`);
      }

      const { added, gone } = ratchet([...found.keys()], allowedFor(allowlist, baselinePage(landing.path), QA));
      expect(
        added.map((key) => `${key} (${found.get(key) ?? '?'})`),
        `New controls under ${TARGET_MIN} on ${landing.path}; make them at least ${TARGET_MIN} x ${TARGET_MIN}`,
      ).toEqual([]);
      expect(
        gone,
        `No longer under ${TARGET_MIN} (or no longer on ${landing.path}); remove these lines from e2e/fixtures/landing-touch-allowlist.json`,
      ).toEqual([]);
    });
  });
}

test.describe('the locale switcher on /es and /ko', () => {
  test.skip(!QA, 'needs NEXT_PUBLIC_SHOW_ALL_LOCALES=1');

  for (const lang of ['es', 'ko'] as const) {
    test(`/${lang}: links every locale's landing, marks its own, and fits a 320 px screen`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: HEIGHT });
      await page.goto(`/${lang}`);
      // The switcher is named in the page's language (Spanish since F-I18N-001 PR 15, Korean since PR 16).
      const nav = page.locator(`nav[aria-label="${getMessages(lang).landing.footer.language}"]`);
      await expect(nav.locator('a')).toHaveText(['English', 'Español', '한국어']);
      for (const [hreflang, href] of [
        ['en', '/'],
        ['es', '/es'],
        ['ko', '/ko'],
      ] as const) {
        await expect(nav.locator(`a[hreflang="${hreflang}"]`)).toHaveAttribute('href', href);
      }
      await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('hreflang', lang);
      const box = await nav.boundingBox();
      expect((box?.x ?? -1) + (box?.width ?? Infinity)).toBeLessThanOrEqual(320);
    });
  }
});

/**
 * F-I18N-001 PR 16 (the Korean layout lens, adjudicated): `:lang(ko)` sets `word-break: keep-all`, which makes
 * each unspaced Korean run (an address plus its particle, "app.hangulroute.com에서") one unbreakable word. The
 * rule must keep `.hr-site`'s `overflow-wrap: anywhere`, or such a run cannot shrink inside a flex or grid item
 * and the page scrolls sideways at large text (WCAG 1.4.4 / 1.4.10). The matrix above runs at default text size,
 * so this runs the Korean pages at 320 px with the root font at 200%.
 */
test.describe('Korean pages at 200% text', () => {
  test.skip(!QA, 'needs NEXT_PUBLIC_SHOW_ALL_LOCALES=1');

  for (const path of ['/ko', '/ko/about', '/ko/learners']) {
    test(`${path} at 320 px and 200% text: no sideways scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: HEIGHT });
      await page.goto(path);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const { doc, body, wrap } = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        wrap: getComputedStyle(document.body).overflowWrap,
      }));
      expect(wrap, `${path}: Korean keeps overflow-wrap anywhere`).toBe('anywhere');
      expect(doc, `${path} at 200% text: document scrollWidth`).toBeLessThanOrEqual(320);
      expect(body, `${path} at 200% text: body scrollWidth`).toBeLessThanOrEqual(320);
    });
  }
});
