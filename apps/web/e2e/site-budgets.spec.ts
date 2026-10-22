import { getMessages } from '@hangul-route/i18n';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { homePath, openForcedHome } from './forced-claims';

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
 * S-4a measures `/learners`; S-4b adds `/parents` and `/teachers`; S-5 adds `/`, and the header checks on About and
 * the legal pages (their header is the legal variant: the brand alone on phones).
 */
const en = getMessages('en').landing;
/**
 * The footer carries the locale switcher (one row) since es and ko shipped (F-I18N-001 rows 15b / 16b); the heights
 * are budgets of the production export with it.
 */

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
  /** A persona page marks itself in the header nav. */
  current: boolean;
  /** A persona page ends in question folds; the home has none (§3.3: each persona explains itself on its own page). */
  folds: boolean;
}

/** Persona page budgets (§3.11): 5 screens at 375 x 812 (headroom 3,700), 3,200 px at 1280 x 800, 550 words. */
const PERSONA = { phoneMax: 4060, phoneHeadroom: 3700, wideMax: 3200, words: 550, current: true, folds: true } as const;
/**
 * Home budgets (§3.11): about 3.5 screens at 375 x 812 (headroom 2,810: 2,750 plus the footer's locale switcher row on
 * phones, F-I18N-001 rows 15b / 16b), 2,100 px at 1280 x 800 (the switcher sits on the copyright line there), 280 words.
 */
const HOME = { phoneMax: 3250, phoneHeadroom: 3150, wideMax: 2300, words: 300, current: false, folds: false } as const;
/**
 * [SN] AMENDMENTS-SITE-NEWUSER §3.11: the closing band and the hero capture cost about 180 px on a phone, so the home
 * moves to 3,250 (headroom 3,150), 2,300 at 1280 and 300 words; `/teachers` gains the media row and the schools
 * section: 4,300 (headroom 4,150) and 3,600 at 1280. The other persona pages keep theirs.
 */
const TEACHERS = { ...PERSONA, phoneMax: 4300, phoneHeadroom: 4150, wideMax: 3600 } as const;

const PAGES: readonly SitePageBudget[] = [
  { path: '/', h1: en.home.hero.title, lead: en.home.hero.lead, primary: en.home.hero.start, ...HOME },
  { path: '/learners', h1: en.persona.learners.title, lead: en.persona.learners.lead, primary: en.nav.start, ...PERSONA },
  { path: '/parents', h1: en.persona.parents.title, lead: en.persona.parents.lead, primary: en.persona.parents.create, ...PERSONA },
  { path: '/teachers', h1: en.persona.teachers.title, lead: en.persona.teachers.lead, primary: en.persona.teachers.create, ...TEACHERS },
];

/**
 * The Spanish and Korean pages (indexable since F-I18N-001 rows 15b / 16b) are held to the same height and word
 * budgets (F-SITE-002 §3.11, "Locales"), times a 10 % text allowance. Spanish runs longer (the home measured 3,039 px
 * against English 2,805 at 375 x 812 when it shipped); Korean's height depends on the CJK font the platform has (the
 * home measured 2,805 px with macOS's Korean font and 2,979 px on the CI image's). Only the budgets are checked here;
 * the layout checks of these pages are in `landing-locales.spec.ts`.
 */
const LOCALE_ALLOWANCE = { es: 1.1, ko: 1.1 } as const;
const LOCALE_PAGES = (['es', 'ko'] as const).flatMap((lang) =>
  PAGES.map((budget) => ({ lang, path: budget.path === '/' ? `/${lang}` : `/${lang}${budget.path}`, budget })),
);

for (const { lang, path, budget } of LOCALE_PAGES) {
  const allow = (value: number): number => Math.round(value * LOCALE_ALLOWANCE[lang]);
  test.describe(`${path} budgets`, () => {
    test(`at 375 x 812: at most ${allow(budget.phoneMax)} px tall (headroom ${allow(budget.phoneHeadroom)}) and ${allow(budget.words)} visible words`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(height).toBeLessThanOrEqual(allow(budget.phoneMax));
      expect(height, 'headroom budget while claims are off').toBeLessThanOrEqual(allow(budget.phoneHeadroom));
      const words = await page.evaluate(() => document.body.innerText.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length);
      expect(words).toBeGreaterThan(50);
      expect(words).toBeLessThanOrEqual(allow(budget.words));
    });

    test(`at 1280 x 800: at most ${allow(budget.wideMax)} px tall`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(allow(budget.wideMax));
    });
  });
}

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
    const boxes: Array<{ top: number; bottom: number }> = [];
    // [SN] The language control's summary is a header control too (AMENDMENTS-SITE-NEWUSER §3.2). The closed menu's
    // links are not drawn (checkVisibility), and neither is the skip link until it is focused.
    for (const el of Array.from(header.querySelectorAll('a, summary'))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && el.checkVisibility()) boxes.push({ top: r.top, bottom: r.bottom });
    }
    // Controls share a row when they overlap vertically (items are centred in the row, so a taller one, such as the
    // brand mark at 200 % text, starts higher than its neighbours).
    boxes.sort((a, b) => a.top - b.top);
    let rows = 0;
    let rowBottom = -Infinity;
    for (const box of boxes) {
      if (box.top >= rowBottom - 1) {
        rows += 1;
        rowBottom = box.bottom;
      } else rowBottom = Math.max(rowBottom, box.bottom);
    }
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
      const home = budget.path === '/';
      test(`at ${width} px the header is one row, at most ${HEADER_MAX} px tall: the brand, ${home ? '' : 'Start, '}Language and Sign in`, async ({ page }) => {
        await page.setViewportSize({ width, height: 812 });
        await page.goto(budget.path);
        const { height, rows } = await headerRows(page);
        expect(rows).toBe(1);
        expect(height).toBeLessThanOrEqual(HEADER_MAX);
        const header = page.locator('header.hr-site-header');
        await expect(header.getByRole('link', { name: en.nav.signIn, exact: true })).toBeVisible();
        await expect(header.locator('summary')).toBeVisible();
        // [SN] OD-SN-1: the phone Start pill on every page but `/`, named "Start learning", reading "Start".
        const start = header.getByRole('link', { name: en.nav.start, exact: true });
        if (home) await expect(start).toBeHidden();
        else await expect(start).toHaveText(en.nav.startShort);
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

    for (const text200 of budget.folds ? [false, true] : []) {
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

    test(`at 1280 px the header is one row with every item${budget.current ? ', the current page marked' : ', none marked'}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(budget.path);
      const { height, rows } = await headerRows(page);
      expect(rows).toBe(1);
      expect(height).toBeLessThanOrEqual(HEADER_MAX);
      const nav = page.getByRole('navigation', { name: en.nav.label });
      // Every persona page ships from S-4b (SHIPPED_PERSONA_PAGES).
      await expect(nav.getByRole('link')).toHaveText([en.nav.learners, en.nav.parents, en.nav.teachers]);
      if (budget.current) await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('href', budget.path);
      else await expect(nav.locator('a[aria-current="page"]')).toHaveCount(0);
    });
  });
}

/** The header on the other site pages (§3.11 "measured on every site page"); the legal pages use the legal variant. */
for (const { path, legal } of [
  { path: '/about', legal: false },
  { path: '/privacy', legal: true },
  { path: '/terms', legal: true },
]) {
  test.describe(`${path} header`, () => {
    for (const width of [320, 375]) {
      test(`at ${width} px: one row, at most ${HEADER_MAX} px tall`, async ({ page }) => {
        await page.setViewportSize({ width, height: 812 });
        await page.goto(path);
        const { height, rows } = await headerRows(page);
        expect(rows).toBe(1);
        expect(height).toBeLessThanOrEqual(HEADER_MAX);
        const signIn = page.locator('header.hr-site-header').getByRole('link', { name: en.nav.signIn, exact: true });
        if (legal) await expect(signIn).toHaveCount(0);
        else await expect(signIn).toBeVisible();
      });
    }

    for (const width of [320, 720]) {
      test(`with 200 % text at ${width} px: at most two rows, nothing scrolls sideways`, async ({ page }) => {
        await page.setViewportSize({ width, height: 812 });
        await page.goto(path);
        await setText200(page);
        const { rows } = await headerRows(page);
        expect(rows).toBeLessThanOrEqual(2);
        const { doc } = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth }));
        const culprits = doc > width ? await overflowing(page, width) : '';
        expect(doc, culprits).toBeLessThanOrEqual(width);
      });
    }

    test('at 1280 px: one row; the legal variant has no Sign in and no Start learning', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path);
      const { rows } = await headerRows(page);
      expect(rows).toBe(1);
      const header = page.locator('header.hr-site-header');
      await expect(header.getByRole('link', { name: en.nav.start, exact: true })).toHaveCount(legal ? 0 : 1);
      await expect(header.getByRole('link', { name: en.nav.signIn, exact: true })).toHaveCount(legal ? 0 : 1);
    });
  });
}

/**
 * [SN] AMENDMENTS-SITE-NEWUSER §3.11 first screens: at 375 x 812 the home also shows the two grown-up links and the
 * brand name in every locale; at 320 x 568 the persona pages show their Create action in every locale.
 */
for (const lang of ['en', 'es', 'ko'] as const) {
  const t = getMessages(lang).landing;
  const prefix = lang === 'en' ? '' : `/${lang}`;
  test.describe(`[SN] ${lang} first screens and header`, () => {
    test(`${prefix || '/'} at 375 x 812: the grown-up links and the brand name on the first screen`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(prefix || '/');
      for (const name of [t.home.hero.forParents, t.home.hero.forTeachers]) {
        const box = await page.locator('main').getByRole('link', { name, exact: true }).boundingBox();
        expect(box, name).not.toBeNull();
        expect((box?.y ?? Infinity) + (box?.height ?? 0), `${name} ends on the first screen`).toBeLessThanOrEqual(812);
      }
      const brandName = page.locator('header .hr-site-brand-name');
      await expect(brandName).toBeVisible();
      const box = await brandName.boundingBox();
      expect(box?.width ?? 0, 'the name is drawn, not visually hidden').toBeGreaterThan(40);
    });

    for (const [path, create] of [
      ['/parents', t.persona.parents.create],
      ['/teachers', t.persona.teachers.create],
    ] as const) {
      test(`${prefix}${path} at 320 x 568: Create on the first screen`, async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });
        await page.goto(`${prefix}${path}`);
        const box = await page.locator('main').getByRole('link', { name: create, exact: true }).first().boundingBox();
        expect(box).not.toBeNull();
        expect((box?.y ?? Infinity) + (box?.height ?? 0)).toBeLessThanOrEqual(568);
        expect((box?.x ?? -1) + (box?.width ?? Infinity)).toBeLessThanOrEqual(320);
      });
    }

    for (const path of ['/', '/learners', '/parents', '/teachers', '/about']) {
      for (const width of [320, 375]) {
        test(`${prefix}${path === '/' ? '' : path || '/'} at ${width} px: the header is one row, at most ${HEADER_MAX} px tall`, async ({ page }) => {
          await page.setViewportSize({ width, height: 812 });
          await page.goto(`${prefix}${path === '/' ? '' : path}` || '/');
          const { height, rows } = await headerRows(page);
          expect(rows).toBe(1);
          expect(height).toBeLessThanOrEqual(HEADER_MAX);
        });
      }
    }
  });
}

/**
 * [SN] On tablets and laptops the header is one row in every locale (from 720 to 959 px the brand shows its mark and
 * the language control its globe, so the Spanish labels fit beside the nav from about 740 px; between 720 and 740 px
 * the Spanish header takes two rows, which no device width in common use falls in).
 */
for (const lang of ['en', 'es', 'ko'] as const) {
  for (const width of [768, 1024, 1280]) {
    test(`[SN] ${lang} at ${width} px: the header is one row on every site page`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ['/', '/learners', '/parents', '/teachers', '/about', '/privacy']) {
        await page.goto(lang === 'en' ? path : path === '/' ? `/${lang}` : `/${lang}${path}`);
        const { height, rows } = await headerRows(page);
        expect(rows, `${lang} ${path}`).toBe(1);
        expect(height, `${lang} ${path}`).toBeLessThanOrEqual(HEADER_MAX);
      }
    });
  }
}

/** [SN] §3.11 image budgets: the page's own capture files, one locale, every `<picture>` source counted. */
const IMAGE_BUDGET_KB: Readonly<Record<string, number>> = { '/': 40, '/learners': 70, '/parents': 60, '/teachers': 80 };
for (const lang of ['en', 'es', 'ko'] as const) {
  for (const [path, kb] of Object.entries(IMAGE_BUDGET_KB)) {
    const url = lang === 'en' ? path : path === '/' ? `/${lang}` : `/${lang}${path}`;
    test(`[SN] ${url}: its captures are at most ${kb} KB, each in the page's locale`, async ({ page }) => {
      await page.goto(url);
      const srcs = await page.evaluate(() =>
        [...new Set(Array.from(document.querySelectorAll('main img[src], main source[srcset]')).map((el) => el.getAttribute('src') ?? el.getAttribute('srcset') ?? ''))].filter(
          (src) => src.startsWith('/site/captures/'),
        ),
      );
      expect(srcs.length).toBeGreaterThan(0);
      let bytes = 0;
      for (const src of srcs) {
        expect(src).toMatch(new RegExp(`^/site/captures/${lang}/[a-z-]+\\.[0-9a-f]{8}\\.webp$`));
        const res = await page.request.get(src);
        expect(res.ok(), src).toBe(true);
        expect(res.headers()['content-type']).toBe('image/webp');
        bytes += (await res.body()).byteLength;
      }
      expect(bytes).toBeLessThanOrEqual(kb * 1024);
    });
  }
}

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 13.2 (row GU-6): the home with the `guestLesson` claim forced on through
 * its `claims` prop (`forced-claims.ts`; the export keeps the claim off until GU-7). AMENDMENTS-SITE-NEWUSER section
 * 3.11's first screens hold in every locale: at 375 x 812 the two grown-up links and the brand name, at 320 x 568 the
 * header, the h1, the lead and Start learning. The hero line sits right under the facts line, above the grown-up links.
 * The home stays inside its height and word budgets with the line (es and ko with their 10 % allowance); spec section
 * 13.2 leaves no budget change open, and pre-approves one fallback at 960 px and wider if this run is over. The values are
 * recorded (annotations) for GU-7, which re-measures them with the shipped claim.
 */
for (const lang of ['en', 'es', 'ko'] as const) {
  const t = getMessages(lang).landing;
  const hero = t.home.hero;
  test.describe(`[GU] ${homePath(lang)} with the guestLesson claim forced on`, () => {
    test('the harness measures what ships: with today\'s claims its home is the export\'s home, box for box', async ({ page }) => {
      const measure = async (): Promise<number[]> =>
        page.evaluate(() => {
          const out = [document.documentElement.scrollHeight];
          for (const selector of ['header.hr-site-header', '#home-title', '.hr-site-lead', '.hr-site-hero-links', '#home-how', '.hr-site-band']) {
            const r = document.querySelector(selector)?.getBoundingClientRect();
            out.push(Math.round(r?.top ?? -1), Math.round(r?.height ?? -1));
          }
          return out;
        });
      for (const [width, height] of [
        [375, 812],
        [1280, 800],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.goto(homePath(lang));
        const shipped = await measure();
        await openForcedHome(page, lang, 'off');
        await expect(page.locator('.hr-site-hero-guest')).toHaveCount(0);
        const harness = await measure();
        for (const [i, value] of harness.entries()) expect(Math.abs(value - (shipped[i] ?? NaN)), `${width}: value ${i}`).toBeLessThanOrEqual(2);
      }
    });

    test('at 375 x 812: the grown-up links and the brand name on the first screen; the line under the facts line, above the links', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await openForcedHome(page, lang, 'on');
      const main = page.locator('main');
      const line = main.getByText(hero.guest, { exact: true });
      await expect(line).toBeVisible();
      const facts = await main.getByText(hero.facts, { exact: true }).boundingBox();
      const lineBox = await line.boundingBox();
      for (const name of [hero.forParents, hero.forTeachers]) {
        const box = await main.getByRole('link', { name, exact: true }).boundingBox();
        expect(box, name).not.toBeNull();
        expect((box?.y ?? Infinity) + (box?.height ?? 0), `${name} ends on the first screen`).toBeLessThanOrEqual(812);
        expect(box?.y ?? -1, `${name} is under the line`).toBeGreaterThanOrEqual((lineBox?.y ?? Infinity) + (lineBox?.height ?? 0) - 1);
      }
      expect(lineBox?.y ?? -1, 'the line is under the facts line').toBeGreaterThanOrEqual((facts?.y ?? Infinity) + (facts?.height ?? 0) - 1);
      const brandName = page.locator('header .hr-site-brand-name');
      await expect(brandName).toBeVisible();
      expect((await brandName.boundingBox())?.width ?? 0, 'the name is drawn, not visually hidden').toBeGreaterThan(40);
      // Body size, the lead's colour: the line reads as text, not as a second action.
      const style = await line.evaluate((el) => ({ tag: el.tagName, size: getComputedStyle(el).fontSize, color: getComputedStyle(el).color }));
      const lead = await main.getByText(hero.lead, { exact: true }).evaluate((el) => getComputedStyle(el).color);
      expect(style.tag).toBe('P');
      expect(style.color).toBe(lead);
      expect(style.size).toBe(await page.evaluate(() => getComputedStyle(document.querySelector('.hr-site') as Element).fontSize));
    });

    test('at 320 x 568: the header, the h1, the lead and Start learning on the first screen', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await openForcedHome(page, lang, 'on');
      const parts: Array<[string, Locator]> = [
        ['header', page.locator('header.hr-site-header')],
        ['h1', page.getByRole('heading', { level: 1, name: hero.title })],
        ['lead', page.locator('main').getByText(hero.lead, { exact: true })],
        ['Start learning', page.locator('main').getByRole('link', { name: hero.start, exact: true }).first()],
      ];
      for (const [name, locator] of parts) {
        await expect(locator, name).toBeVisible();
        const box = await locator.boundingBox();
        expect((box?.y ?? Infinity) + (box?.height ?? 0), `${name} ends on the first screen`).toBeLessThanOrEqual(568);
        expect((box?.x ?? -1) + (box?.width ?? Infinity), `${name} fits the width`).toBeLessThanOrEqual(320);
      }
    });

    test('inside the home budgets with the line: height at 375 (headroom) and 1280, visible words', async ({ page }) => {
      const allow = (value: number): number => (lang === 'en' ? value : Math.round(value * LOCALE_ALLOWANCE[lang]));
      for (const [width, height, max] of [
        [375, 812, HOME.phoneHeadroom],
        [1280, 800, HOME.wideMax],
      ] as const) {
        await page.setViewportSize({ width, height });
        await openForcedHome(page, lang, 'on');
        const scroll = await page.evaluate(() => document.documentElement.scrollHeight);
        const words = await page.evaluate(() => document.body.innerText.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length);
        test.info().annotations.push({ type: `guestLesson on, ${width}`, description: `height ${scroll} px (budget ${allow(max)}), ${words} words (budget ${allow(HOME.words)})` });
        expect(scroll, `${width} px tall`).toBeLessThanOrEqual(allow(max));
        expect(words).toBeGreaterThan(50);
        expect(words, 'visible words').toBeLessThanOrEqual(allow(HOME.words));
      }
    });
  });
}
