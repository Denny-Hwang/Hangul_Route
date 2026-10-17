import type { Page } from '@playwright/test';
import { colors } from '@hangul-route/design-system/tokens';
import { availableLocales, getMessages, type UiLocale } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, openGrownUpZone, readStored, seedStored, unlockWithPin, headerBack, headerClose } from './helpers';
import { shot } from './shots';

/**
 * The Route tab (AMENDMENTS-ROUTE-LEARNING-ROUTE LR-4, section 5.1 and 5.2;
 * design/screens/learning-route/tab-bar.md, mock/tab-bar.html and
 * mock/route-tab.html). `flags.myRouteEnabled` is on by default since the
 * F-ROUTE-001 R-10b beta flip, so every build has the four-tab bar and CI
 * runs this spec on the release build (the three-tab bar of a build made with
 * `EXPO_PUBLIC_MY_ROUTE_ENABLED=false` is pinned by `mainTabs` unit tests).
 *
 * The label fit runs per UI locale the build ships (`availableLocales`: en, es
 * and ko since F-I18N-001 rows 15b / 16b).
 *
 * LR-10 (amendment section 13) adds two entry cases: (a) the parent dashboard
 * row of the active learner, through the PIN gate, opens the read-only page;
 * (b) a finished level check's "See Learning Route" opens the Route tab. Case
 * (b) opens the check through the fixture bundle's `window.__hrPlacementE2E`
 * hook (written before F-PLC-001 P-10 turned the learner entries on;
 * `placement.spec.ts` takes them on the release build) and runs in CI's
 * fixture run (its own describe, "the level check entry"):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test route-tab -g "level check entry"
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const LOCALES: UiLocale[] = availableLocales();
/**
 * Locales whose four tab labels fit their 80 px items at the 1.3 x cap, so the native shrink-to-fit never starts. Only
 * English: a Korean label's width follows the platform's CJK font (it fits with macOS's Korean font, and is 90 px on the
 * CI image's, as on an Android phone's Noto CJK), and two Spanish labels ("Recorrido", "Colección") are wider too.
 */
const SHRINK_FREE: readonly UiLocale[] = ['en'];
/**
 * The widest a tab item may get at the cap in the other locales before the shrink (measured when es and ko shipped,
 * F-I18N-001 rows 15b / 16b: Spanish 84 px on macOS and 86 on the CI image, Korean 90 on the CI image). The native
 * shrink-to-fit could absorb up to 104 px (minimumFontScale 1 / 1.3), but a label that grows past this is a copy change
 * to look at, so it fails here first.
 */
const SHRINK_MAX_ITEM = 92;
const en = getMessages('en');

const tabLinks = (page: Page) => page.getByRole('tablist').getByRole('link');

/** Each tab's label text, and whether it fits its item: not cut, not wider than the item. */
function labelFit(page: Page): Promise<Array<{ text: string; fits: boolean; inItem: boolean; lines: number }>> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role="tablist"] a')].map((item) => {
      const leaves = [...item.querySelectorAll('div, span')].filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '');
      const label = leaves[leaves.length - 1] as HTMLElement | undefined;
      if (label === undefined) return { text: '', fits: false, inItem: false, lines: 0 };
      const box = label.getBoundingClientRect();
      const itemBox = item.getBoundingClientRect();
      // The rendered lines of the label's text: one client rect per line box, so a wrapped label counts two.
      const range = document.createRange();
      range.selectNodeContents(label);
      const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
      return {
        text: label.textContent ?? '',
        fits: label.scrollWidth <= label.clientWidth,
        inItem: box.left >= itemBox.left - 0.5 && box.right <= itemBox.right + 0.5,
        lines: tops.size,
      };
    }),
  );
}

/** `#RRGGBB` as the browser reports a computed colour. */
const rgbOf = (hex: string): string => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

/**
 * The selected tab: the web tab bar marks no aria-selected and does not change the address, so the
 * selected item is the one whose label wears the active tint (`tabBarActiveTintColor`, brand.primary).
 * The label is found by its own words (`labels`), never by its place, so an icon glyph or a badge in the
 * item cannot be read instead. Returns every item's label and tint, for a readable failure.
 */
async function tabTints(page: Page, labels: readonly string[]): Promise<Array<{ text: string; color: string }>> {
  return page.evaluate(
    (words) =>
      [...document.querySelectorAll('[role="tablist"] a')].map((item) => {
        const label = [...item.querySelectorAll('div, span')].find((el) => el.children.length === 0 && words.includes((el.textContent ?? '').trim()));
        return { text: label?.textContent?.trim() ?? '', color: label ? getComputedStyle(label).color : '' };
      }),
    [...labels],
  );
}

async function selectedTabs(page: Page, labels: readonly string[]): Promise<string[]> {
  const tints = await tabTints(page, labels);
  return tints.filter((t) => t.color === rgbOf(colors.brand.primary)).map((t) => t.text);
}

/** The four tab labels in English (the flag-on bar: Today, Route, Journey, Library). */
const TAB_LABELS: readonly string[] = Object.values(en.a11y.tabs);

const noSideScroll = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** The install guide's Not now, in the UI locale the app came up in (es and ko read it in their own words). */
async function closeInstallGuide(page: Page, locale: UiLocale = 'en'): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: getMessages(locale).caregiver.install.notNow.cta, exact: true }).click();
}

async function learnerOnHome(page: Page): Promise<void> {
  // onboardChild answers the sideways guard of a phone held sideways once; the answer is kept.
  await onboardChild(page, { name: 'Dani', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await closeInstallGuide(page);
}

test.describe('the Route tab (LR-4)', () => {
  for (const locale of LOCALES) {
    test(`320 x 568, ${locale}: Today, Route, Journey, Library; each label fits its item; Route is announced as Learning Route`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await learnerOnHome(page);
      if (locale !== 'en') {
        // The locale is read at start-up: store it, then reload so the whole app comes up in it.
        await seedStored(page, 'device:settings', { uiLocale: locale });
        await page.reload();
        await closeInstallGuide(page, locale);
      }
      // The UI really is in this locale before the labels are measured.
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
      const m = getMessages(locale);
      await expect(tabLinks(page)).toHaveCount(4);
      const labels = await labelFit(page);
      expect(labels.map((l) => l.text)).toEqual([m.a11y.tabs.home, m.a11y.tabs.route, m.a11y.tabs.journey, m.a11y.tabs.library]);
      for (const label of labels) {
        expect(label.fits, `${label.text} is cut off`).toBe(true);
        expect(label.inItem, `${label.text} is wider than its item`).toBe(true);
        expect(label.lines, `${label.text} wraps`).toBe(1);
      }
      await expect(tabLinks(page).nth(1)).toHaveAccessibleName(m.a11y.myRoute.tab);
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `route-tab-bar-320-${locale}`);
    });
  }

  for (const locale of LOCALES) {
    test(`320 x 568, ${locale}: at the native label cap (1.3 x caption) each label still fits its 80 px item on one line (assumption a)`, async ({ page }) => {
      // Assumption a's worst case: with large text a native label grows to FOUR_TAB_LABEL_FIT's cap (1.3 x caption)
      // and no further, so at 200 % text on a 320 dp phone each label is 1.3 x caption in an 80 dp item. The web
      // label ignores the text size, so the cap is applied here by hand. Fitting at the cap means the native
      // shrink-to-fit (down to 1.0 x, never below) is never needed.
      await page.setViewportSize({ width: 320, height: 568 });
      await learnerOnHome(page);
      if (locale !== 'en') {
        await seedStored(page, 'device:settings', { uiLocale: locale });
        await page.reload();
        await closeInstallGuide(page, locale);
      }
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${locale}`));
      await expect(tabLinks(page)).toHaveCount(4);
      const sizes = await page.evaluate((cap) =>
        [...document.querySelectorAll('[role="tablist"] a')].map((item) => {
          const leaves = [...item.querySelectorAll('div, span')].filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '');
          const label = leaves[leaves.length - 1] as HTMLElement;
          const base = Number.parseFloat(getComputedStyle(label).fontSize);
          const lineHeight = Number.parseFloat(getComputedStyle(label).lineHeight);
          label.style.fontSize = `${base * cap}px`;
          if (Number.isFinite(lineHeight)) label.style.lineHeight = `${lineHeight * cap}px`;
          return { base, item: Math.round(item.getBoundingClientRect().width), now: Number.parseFloat(getComputedStyle(label).fontSize) };
        }),
      1.3);
      for (const s of sizes) expect(s.now).toBeCloseTo(s.base * 1.3, 1);
      if (SHRINK_FREE.includes(locale)) {
        for (const s of sizes) expect(s.item).toBeLessThanOrEqual(80);
      } else {
        // A Spanish or Korean label can be a few px wider than its item at the cap: the native label shrinks to fit
        // (FOUR_TAB_LABEL_FIT), never below the caption size. Apply that shrink by hand, as the cap.
        const shrunk = await page.evaluate(() =>
          [...document.querySelectorAll('[role="tablist"] a')].map((item) => {
            const leaves = [...item.querySelectorAll('div, span')].filter((el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '');
            const label = leaves[leaves.length - 1] as HTMLElement;
            const width = item.getBoundingClientRect().width;
            const before = Math.round(width);
            if (width > 80) {
              const scale = 80 / width;
              label.style.fontSize = `${Number.parseFloat(getComputedStyle(label).fontSize) * scale}px`;
              const lineHeight = Number.parseFloat(getComputedStyle(label).lineHeight);
              if (Number.isFinite(lineHeight)) label.style.lineHeight = `${lineHeight * scale}px`;
            }
            return { before, item: Math.round(item.getBoundingClientRect().width), now: Number.parseFloat(getComputedStyle(label).fontSize) };
          }),
        );
        shrunk.forEach((s, i) => {
          expect(s.before, `${locale} tab ${i + 1} at the cap, before the shrink`).toBeLessThanOrEqual(SHRINK_MAX_ITEM);
          expect(s.item).toBeLessThanOrEqual(80);
          // minimumFontScale (1 / 1.3): a shrunk label is never smaller than the caption size.
          expect(s.now).toBeGreaterThanOrEqual(sizes[i]!.base);
        });
      }
      const labels = await labelFit(page);
      const m = getMessages(locale);
      expect(labels.map((l) => l.text)).toEqual([m.a11y.tabs.home, m.a11y.tabs.route, m.a11y.tabs.journey, m.a11y.tabs.library]);
      for (const label of labels) {
        expect(label.fits, `${label.text} is cut off at 1.3 x caption`).toBe(true);
        expect(label.inItem, `${label.text} at 1.3 x caption is wider than its item`).toBe(true);
        expect(label.lines, `${label.text} at 1.3 x caption wraps`).toBe(1);
      }
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `route-tab-bar-320-cap-${locale}`);
    });
  }

  test('the tab is a root page: the name and the purpose line, no back button', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await learnerOnHome(page);
    await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
    const screen = page.getByTestId('my-route-screen');
    await expect(screen).toBeVisible();
    await expect(screen.getByText(en.learner.myRoute.title, { exact: true })).toBeVisible();
    await expect(screen.getByText(en.learner.myRoute.purpose, { exact: true })).toBeVisible();
    await expect(headerBack(page)).toHaveCount(0);
    await expect(page.getByTestId('my-route-trail')).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, 'route-tab-320');
  });

  test("the active learner's entries open the tab: the Journey header link and the Home strip", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await learnerOnHome(page);
    const purpose = page.getByText(en.learner.myRoute.purpose, { exact: true });

    await page.getByRole('tablist').getByRole('link', { name: en.a11y.tabs.journey }).click();
    await expect(page.getByText(en.learner.journey.intro, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: en.learner.myRoute.open.cta, exact: true }).click();
    await expect(purpose).toBeVisible();
    await expect(headerBack(page)).toHaveCount(0);

    await page.getByRole('tablist').getByRole('link', { name: en.a11y.tabs.home }).click();
    await page.getByTestId('home-route-strip').click();
    await expect(purpose).toBeVisible();
    await expect(headerBack(page)).toHaveCount(0);
  });

  test('the open Stage 1 draws the letter wall (R-7c): lit, outlined and plain letters, each one KoreanText', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await learnerOnHome(page);
    const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    const at = '2026-10-09T10:00:00.000Z';
    // Finished: letters q1 (lights its four letters). The level check placed out letters q2 and q3 (outlines their eight).
    await seedStored(page, `progress:${profileId}`, {
      profileId,
      updatedAt: at,
      episodes: [],
      quests: [{ questId: 'quest:stage1-letters-q1', episodeId: 'episode:stage1-letters', startedAt: at, completedAt: at, stars: 3, attempts: 1, accuracy: 1 }],
      cards: [],
      sessions: [],
      homework: [],
      reviews: [],
      streakDays: 0,
      placements: [
        {
          id: 'placement:seeded',
          startedAt: at,
          completedAt: at,
          source: 'home',
          testLocale: 'en',
          length: 'full',
          mode: 'standard',
          revealMode: 'tap',
          bankVersion: 1,
          contentVer: 'e2e',
          responses: [],
          gates: [],
          strands: { 'hangul-recognition': 'not-tested', 'sound-letter': 'not-tested', 'syllable-reading': 'not-tested', vocabulary: 'not-tested', sentences: 'not-tested' },
          level: { stage: 'stage1', band: 1 },
          oralStage: null,
          beyondContent: false,
          startQuestId: 'quest:stage1-life-q1',
          placedOutQuestIds: ['quest:stage1-letters-q2', 'quest:stage1-letters-q3'],
          priorityTokens: [],
          needsStage: null,
          stopReason: 'complete',
        },
      ],
    });
    await closeInstallGuide(page);
    await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
    const wall = page.getByTestId('my-route-letter-wall');
    const toggle = wall.getByRole('button', { name: en.learner.myRoute.wall.title, exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(wall.getByText(en.learner.myRoute.wall.lead, { exact: true })).toBeVisible();
    // One list of the 30 letters, each tile a list item.
    await expect(wall.getByRole('list', { name: en.learner.myRoute.wall.title, exact: true }).getByRole('listitem')).toHaveCount(30);
    await expect(wall.getByTestId('my-route-letter-met')).toHaveCount(4);
    await expect(wall.getByTestId('my-route-letter-known')).toHaveCount(8);
    await expect(wall.getByTestId('my-route-letter-ahead')).toHaveCount(18);
    for (const word of Object.values(en.learner.myRoute.wall.state)) await expect(wall.getByText(word, { exact: true })).toBeVisible();
    // Each letter carries its own label: the sound, the gloss of a final consonant, and the state word.
    const w = en.learner.myRoute.wall;
    const labelled = (label: string) => wall.locator(`[aria-label="${label}"]`);
    await expect(labelled(`ㄴ, n. ${w.state.met}.`)).toBeVisible();
    await expect(labelled(`ㅇ, silent/ng. ${w.state.known}.`)).toBeVisible();
    await expect(labelled(`ㄴ, n, ${w.final}. ${w.state.ahead}.`)).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    await toggle.scrollIntoViewIfNeeded();
    await shot(page, 'route-letter-wall-320');
    await labelled(`ㄴ, n, ${w.final}. ${w.state.ahead}.`).scrollIntoViewIfNeeded();
    await shot(page, 'route-letter-wall-320-finals');
    await labelled(`ㅇ, silent/ng. ${w.state.known}.`).scrollIntoViewIfNeeded();
    await shot(page, 'route-letter-wall-320-known');
  });

  for (const size of [
    { width: 375, height: 667 },
    { width: 844, height: 390 },
    { width: 1180, height: 820 },
  ]) {
    test(`${size.width} x ${size.height}: four tabs, every label in its item, no side scroll`, async ({ page }) => {
      await page.setViewportSize(size);
      await learnerOnHome(page);
      await expect(tabLinks(page)).toHaveCount(4);
      for (const label of await labelFit(page)) {
        expect(label.fits, label.text).toBe(true);
        expect(label.inItem, label.text).toBe(true);
      }
      await page.getByRole('tablist').getByRole('link', { name: en.a11y.myRoute.tab }).click();
      await expect(page.getByText(en.learner.myRoute.purpose, { exact: true })).toBeVisible();
      expect(await noSideScroll(page)).toBe(true);
      await shot(page, `route-tab-${size.width}`);
    });
  }

  test('(a) the dashboard row of the active learner, through the gate, opens the read-only page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await onboardChild(page, { name: 'Dani', startJourney: false });
    const id = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    await openGrownUpZone(page, 'Dani');
    await unlockWithPin(page);
    await page.getByTestId(`dashboard-route-${id}-open`).click();

    const screen = page.getByTestId('my-route-screen');
    await expect(screen).toBeVisible();
    await expect(screen.getByText(en.caregiver.journey.viewing('Dani'), { exact: true })).toBeVisible();
    // The root-stack page, forced read-only even for the active profile (amendment section 5.1): Go back, no
    // purpose line, no button on the card.
    await expect(headerBack(page)).toBeVisible();
    await expect(page.getByText(en.learner.myRoute.purpose, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('my-route-card-cta')).toHaveCount(0);
    await expect(page.getByTestId('my-route-card').getByRole('button')).toHaveCount(0);
    // No tab redirect: once the page has settled (no request in flight, two frames drawn) it is still the
    // read-only page, not the learner's tab.
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    await expect(screen.getByText(en.caregiver.journey.viewing('Dani'), { exact: true })).toBeVisible();
    await expect(page.getByText(en.learner.myRoute.purpose, { exact: true })).toHaveCount(0);
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, 'route-dashboard-read-only-375');

    await headerBack(page).click();
    await expect(page.getByTestId(`dashboard-route-${id}-open`)).toBeVisible();
  });
});

test.describe('the level check entry (LR-10 case b)', () => {
  test.skip(!FIXTURE_BUILD, 'the level check opens through the fixture bundle hook (STORY_FIXTURES=1, dist-e2e/)');

  test("(b) a finished level check's See Learning Route opens the Route tab", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await learnerOnHome(page);
    type E2eWindow = Window & { __hrPlacementE2E?: { open(source: string): void } };
    await page.waitForFunction(() => Boolean((window as E2eWindow).__hrPlacementE2E), undefined, { timeout: 10_000 });
    await page.evaluate(() => (window as E2eWindow).__hrPlacementE2E?.open('home'));

    // The shortest finished check: the options, the warm-up, one answer, then "That is enough". A build that
    // ships more than one UI language asks for the check's language first (English stays chosen).
    const guide = page.getByTestId('placement-guide-tap');
    await expect(guide.or(page.getByTestId('placement-language')).first()).toBeVisible();
    if (await page.getByTestId('placement-language').isVisible()) await page.getByTestId('placement-language-continue').click();
    await guide.click();
    await page.getByTestId('placement-next').click();
    await page.getByTestId('placement-warmup-speaker').click();
    await page.getByTestId('placement-warmup-option-rice').click();
    await page.locator('[data-testid^="placement-option-"]').first().click();
    await headerClose(page).click();
    await page.getByTestId('placement-enough').click();
    await expect(page.getByTestId('placement-result')).toBeVisible();

    const link = page.getByTestId('placement-link-seeMyRoute');
    await expect(link).toHaveText(en.learner.placement.result.seeMyRoute);
    await link.click();
    await expect(page.getByTestId('placement-result')).toHaveCount(0);
    // The learner's own tab: the purpose line, no back button, the Route tab selected.
    await expect(page.getByText(en.learner.myRoute.purpose, { exact: true })).toBeVisible();
    await expect(headerBack(page)).toHaveCount(0);
    await expect(page.getByTestId('my-route-screen')).toBeVisible();
    await expect
      .poll(() => selectedTabs(page, TAB_LABELS), { message: 'the Route tab wears the active tint (see tabTints for every item)' })
      .toEqual([en.a11y.tabs.route]);
    await shot(page, 'route-from-level-check-375');
  });
});
