import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALE_META, pseudoText, type Messages } from '@hangul-route/i18n';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { answerForkNew, onboardChild, readStored, waitForSaved } from './helpers';
import {
  allowedSmall,
  BROWSER_LOCALE,
  fixedButListed,
  matrixLocales,
  MATRIX_VIEWPORTS,
  nameIn,
  nameInAny,
  prefixIn,
  smallControlKeys,
  toleratedKeys,
  type MatrixAllowlist,
  type MatrixLocale,
  type MatrixScreen,
} from './locale-matrix';
import { shot } from './shots';
import { measureTargets, settleSignature, TARGET_MIN, type MeasuredTarget, type TouchTargetAllowlist } from './target-audit';
import { controlsPastEdge, expectNoHorizontalOverflow, expectReachable } from './viewport';

/**
 * F-I18N-001 PR 14 (§3.11, §5): UI locales in the real PWA.
 *
 * - The suite runs as an `en-US` browser (`playwright.config.ts`), so every
 *   other spec's English `getByText` stays English whatever the machine's language.
 * - On the default build es and ko are hidden: a `?lang=` hand-off is ignored.
 * - On a build with every language shown: detection, the Welcome choice and its
 *   persistence, the `?lang=` hand-off and a profile's own language over the device's.
 * - The layout matrix: Welcome, CreateProfile, Results, Home, Profile and PinEntry at
 *   320 / 375 / 768 in every locale the build shows — no sideways scroll, every control
 *   at least `touchTarget.min` (the touch-target ratchet's listed controls aside) and the
 *   primary CTA fully on screen once the learner scrolls to it.
 *
 * The default build (CI) runs the English half. The rest runs against flagged builds, on
 * demand (no pipeline builds them yet: F-I18N-001 §10), each served in place of `dist`:
 *
 *   EXPO_PUBLIC_SHOW_ALL_LOCALES=1 expo export --platform web --output-dir dist   ->  E2E_ALL_LOCALES=1
 *   EXPO_PUBLIC_PSEUDO_LOCALE=1    expo export --platform web --output-dir dist   ->  E2E_PSEUDO_LOCALE=1
 *
 * (`node scripts/pwa-postbuild.mjs dist` after each export; `--clear` keeps Metro from reusing
 * a transform made with other flags.) The es and ko dictionaries are filled (PR 15 / 16); the matrix
 * finds every control by its dictionary message, so those runs read Spanish and Korean.
 */
const ALL_LOCALES = process.env.E2E_ALL_LOCALES === '1';
const PSEUDO = process.env.E2E_PSEUDO_LOCALE === '1';

const readFixture = (name: string): unknown => JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));
/** Small controls listed today: the touch-target ratchet's (Home, Profile) and the matrix's own (screens it does not walk). */
const matrixList = readFixture('locale-matrix-allowlist.json') as MatrixAllowlist;
const ratchetList = readFixture('touch-target-allowlist.json') as TouchTargetAllowlist;

/**
 * A storage key the app must not write: it holds `expected` for a second after the page settled (the app's
 * writes are async IndexedDB puts, so a wrong write can land after the first read) and still after a reload.
 */
async function expectStoredStays(page: Page, key: string, expected: unknown, htmlLang: string): Promise<void> {
  for (let read = 0; read < 4; read += 1) {
    await page.waitForTimeout(250);
    expect(await readStored(page, key), `${key} after ${(read + 1) * 250} ms`).toEqual(expected);
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', htmlLang);
  expect(await readStored(page, key), `${key} after a reload`).toEqual(expected);
}

test.describe('the en-US pin', () => {
  test.skip(PSEUDO, 'a pseudo build draws English as en-XA');

  test('the suite runs as an en-US browser, so the app and every English spec read English', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => navigator.language)).toBe('en-US');
    await expect(page.getByText("Hi! I'm Hoya.")).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('default build (only English ships)', () => {
  test.skip(ALL_LOCALES || PSEUDO, 'runs against the default build');
  test.use({ locale: 'es-MX' });

  test('a ?lang= hand-off to a hidden locale is ignored, stores nothing and leaves a clean address bar', async ({ page }) => {
    await page.goto('/?lang=es');
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).not.toHaveURL(/lang=/);
    await expectStoredStays(page, 'device:settings', null, 'en');
  });
});

/**
 * The install guide shows from the third cached open, on its own schedule, and covers the Home tabs: whenever
 * it is in the way of an action, Playwright closes it first with "Not now", in whichever language it shows.
 */
async function dismissInstallGuideWhenShown(page: Page): Promise<void> {
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: nameInAny((m) => m.caregiver.install.notNow.cta) }).click();
  });
}

test.describe('every language shown (E2E_ALL_LOCALES=1)', () => {
  test.skip(!ALL_LOCALES || PSEUDO, 'needs a build made with EXPO_PUBLIC_SHOW_ALL_LOCALES=1 (and no pseudo flag)');

  test.describe('a Spanish browser', () => {
    test.use({ locale: 'es-MX' });

    test('starts in Spanish; a Welcome choice beats detection and survives a reload', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      await expect(page.getByRole('radio', { name: 'Español' })).toHaveAttribute('aria-checked', 'true');
      // Nothing was chosen yet: detection is a default, not a stored choice.
      expect(await readStored(page, 'device:settings')).toBeNull();

      await page.getByRole('radio', { name: 'English' }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await waitForSaved(page, ['device:settings']);
      expect(await readStored(page, 'device:settings')).toEqual({ uiLocale: 'en' });

      await page.reload();
      await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });

  test('?lang= hand-off: an unknown value is ignored; a known one is stored once and never overrides a choice', async ({ page }) => {
    await page.goto('/?lang=fr');
    await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
    await expect(page).not.toHaveURL(/lang=/);
    await expectStoredStays(page, 'device:settings', null, 'en');

    await page.goto('/?lang=ko&from=site');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(page.getByRole('radio', { name: '한국어' })).toHaveAttribute('aria-checked', 'true');
    // Only `lang` leaves the address bar.
    await expect(page).toHaveURL(/\?from=site$/);
    await waitForSaved(page, ['device:settings']);
    expect(await readStored(page, 'device:settings')).toEqual({ uiLocale: 'ko' });

    // The device has chosen now, so a later hand-off does not change it.
    await page.goto('/?lang=es');
    await expect(page.getByRole('radio', { name: '한국어' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(page).not.toHaveURL(/lang=/);
    await expectStoredStays(page, 'device:settings', { uiLocale: 'ko' }, 'ko');
  });

  test("a profile's own language wins over the device's, and both survive a reload", async ({ page }) => {
    await dismissInstallGuideWhenShown(page);
    await onboardChild(page, { name: 'Dani', startJourney: false });
    const id = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    await page.goto('/');
    await page.getByRole('button', { name: 'Profile and settings' }).click();

    // This profile reads Spanish.
    await page.getByRole('radio', { name: 'Español' }).first().click();
    await page.getByRole('button', { name: nameIn('es', (m) => m.learner.language.confirmUse('Español')) }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    // The device default moves to Korean; the profile keeps Spanish.
    await page.getByTestId('language-device-ko').click();
    await page.getByRole('button', { name: nameIn('ko', (m) => m.learner.language.confirmUse('한국어')) }).click();
    await expect(page.getByTestId('language-device-ko')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await waitForSaved(page, ['device:settings', `settings:${id}`]);
    expect(await readStored(page, 'device:settings')).toEqual({ uiLocale: 'ko' });
    expect(await readStored(page, `settings:${id}`)).toEqual({ uiLocale: 'es', romanizationMode: 'always' });

    await page.reload();
    await expect(page.getByText(nameIn('es', (m) => m.learner.home.greeting('Dani')))).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    // Back to "Same as this device": the profile now follows the device, in Korean.
    await page.getByRole('button', { name: nameIn('es', (m) => m.a11y.profileEntry) }).click();
    await page.getByRole('radio', { name: nameIn('es', (m) => m.learner.language.sameAsDevice('한국어')) }).click();
    await page.getByRole('button', { name: nameIn('ko', (m) => m.learner.language.confirmUse('한국어')) }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect.poll(() => readStored(page, `settings:${id}`)).toEqual({ romanizationMode: 'always' });
  });
});

/**
 * Every control under `touchTarget.min` on the screen (`role | name`, repeats numbered, and its size), read
 * until two reads 300 ms apart agree, so entrance animations and late layout settle first.
 */
async function smallControls(page: Page, screen: MatrixScreen): Promise<Array<{ key: string; size: string }>> {
  let last: string | null = null;
  for (let i = 0; i < 10; i += 1) {
    const measured: MeasuredTarget[] = await page.evaluate(measureTargets, null);
    const now = settleSignature(measured);
    if (last !== null && now === last) {
      expect(measured.length, `${screen} has controls to measure`).toBeGreaterThan(0);
      return smallControlKeys(measured);
    }
    last = now;
    await page.waitForTimeout(300);
  }
  throw new Error(`${screen}: the controls never settled`);
}

/**
 * §3.11 on one screen: no sideways scroll and no control clipped past the window's side (a vertical
 * ScrollView clips a too-wide child instead of widening the page), no small control beyond the listed ones
 * (and no listed one that has been fixed), and the primary CTA fully on screen once the learner scrolls to it.
 */
/** `part` names a step of a screen that has several (CreateProfile, F-LEARN-001 §3.15); the allow lists stay per screen. */
async function checkScreen(page: Page, locale: MatrixLocale, screen: MatrixScreen, cta: Locator, part?: string): Promise<void> {
  const vp = page.viewportSize() ?? { width: 0, height: 0 };
  const width = vp.width;
  const name = part === undefined ? screen : `${screen}-${part}`;
  const where = `${name} in ${locale} at ${width}px`;
  await expect(cta, `${where}: primary CTA`).toBeVisible();
  await expectNoHorizontalOverflow(page, `${where} scrolls sideways`);
  const small = await smallControls(page, screen);
  expect(await page.evaluate(controlsPastEdge), `${where}: controls past the side of the window`).toEqual([]);
  const allowed = allowedSmall(screen, locale, toleratedKeys(ratchetList, matrixList, vp));
  expect(
    small.filter((t) => !allowed.has(t.key)).map((t) => `${t.key} (${t.size})`),
    `${where}: controls under ${TARGET_MIN}; make them at least ${TARGET_MIN} x ${TARGET_MIN}`,
  ).toEqual([]);
  expect(
    fixedButListed(screen, locale, matrixList, small.map((t) => t.key)),
    `${where}: no longer under ${TARGET_MIN}; remove these lines from fixtures/locale-matrix-allowlist.json`,
  ).toEqual([]);
  await shot(page, `locale-${locale}-${width}-${name}`);
  await expectReachable(page, cta);
}

/** The number of Discover pages, read from "Page 1 of n" in the locale's words (retried while the label renders). */
async function discoverPageCount(page: Page, locale: MatrixLocale): Promise<number> {
  let pages = 0;
  await expect(async () => {
    for (let count = 1; count <= 30; count += 1) {
      const label = page.getByText(nameIn(locale, (m) => m.learner.quest.discover.pageLabel(1, count)));
      if ((await label.count()) > 0) {
        pages = count;
        return;
      }
    }
    throw new Error('no "Page 1 of n" label on the Discover step');
  }).toPass({ timeout: 5_000 });
  return pages;
}

/** One fresh learner through the six matrix screens, every control found by its dictionary message. */
async function walkMatrix(page: Page, locale: MatrixLocale): Promise<void> {
  const n = (pick: (m: Messages) => string): RegExp => nameIn(locale, pick);
  const button = (pick: (m: Messages) => string): Locator => page.getByRole('button', { name: n(pick) });

  // Welcome. The build really draws this locale: <html lang>, and for en-XA the padded title itself.
  await dismissInstallGuideWhenShown(page);
  await page.goto('/');
  await expect(page.getByText(n((m) => m.learner.welcome.title))).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', LOCALE_META[locale === 'en-XA' ? 'en' : locale].htmlLang);
  if (locale === 'en-XA') await expect(page.getByText(pseudoText("Hi! I'm Hoya."), { exact: true })).toBeVisible();
  const start = button((m) => m.learner.welcome.cta);
  await checkScreen(page, locale, 'Welcome', start);
  await start.click();

  // CreateProfile in its three steps (F-LEARN-001 §3.15): "Someone I look after", a name, then on
  // the Privacy step the grown-up PIN twice and consent.
  const cont = button((m) => m.learner.createProfile.cta);
  // Steps 1 and 2 carry the longest new lines (the who cards and their sub-lines), so each is checked too.
  await page.getByRole('radio', { name: prefixIn(locale, (m) => () => m.learner.createProfile.who.child.label) }).click();
  await checkScreen(page, locale, 'CreateProfile', cont, 'who');
  await cont.click();
  await page.getByPlaceholder(n((m) => m.learner.createProfile.namePlaceholder)).fill('Dani');
  await checkScreen(page, locale, 'CreateProfile', cont, 'profile');
  await cont.click();
  for (let round = 0; round < 2; round += 1) {
    for (const d of [1, 2, 3, 4]) await button((m) => m.a11y.pinDigit(d)).click();
  }
  await expect(page.getByText(n((m) => m.caregiver.pin.setup.set))).toBeVisible();
  await page.getByRole('checkbox').click();
  await checkScreen(page, locale, 'CreateProfile', cont);
  await cont.click();
  // The level check's fork (F-PLC-001, on since P-10): "I am new to Korean" goes on to the first-quest preview.
  await answerForkNew(page);

  // The first-quest preview opens the first quest: intro, Discover, skip the game, skip Build a Letter, the Check.
  await expect(page.getByText(n((m) => m.learner.firstQuest.title))).toBeVisible();
  await button((m) => m.learner.firstQuest.cta).click();
  await waitForSaved(page, ['profiles', 'account:parentPinHash']);
  await button((m) => m.learner.quest.continue.cta).click();
  const discover = page.getByText(n((m) => m.learner.quest.step.discover.pill));
  await expect(discover).toBeVisible();
  const pages = await discoverPageCount(page, locale);
  for (let i = 1; i <= pages; i += 1) {
    await expect(page.getByText(n((m) => m.learner.quest.discover.pageLabel(i, pages)))).toBeVisible();
    await button((m) => m.learner.quest.discover.continue.cta).click();
  }
  await expect(discover).toHaveCount(0);
  await button((m) => m.learner.quest.launcher.game.skip.cta).click();
  await button((m) => m.learner.quest.launcher.game.play.cta).click();
  await button((m) => m.learner.minigame.skip.cta).click();
  await button((m) => m.learner.quest.launcher.check.go.cta).click();
  const right = prefixIn(locale, (m) => m.a11y.minigame.option.correct);
  const answered = new RegExp(`${right.source}|${prefixIn(locale, (m) => m.a11y.minigame.option.wrong).source}`);
  const options = page.locator('[data-testid^="listen-pick-option-"]');
  const seeResults = button((m) => m.learner.quest.seeResults.cta);
  // Answer each Check round (a wrong card first, then the next, until one is right) until See results shows,
  // however many rounds the first quest's Check has.
  const state = { next: 'waiting' as 'results' | 'round' | 'waiting' };
  for (let round = 1; state.next !== 'results'; round += 1) {
    if (round > 10) throw new Error('the Check never offered See results after 10 rounds');
    await expect(options.first()).toBeVisible();
    const count = await options.count();
    for (let i = 0; i < count; i += 1) {
      const option = options.nth(i);
      // A tap inside the game's double-touch window is dropped: tap again until the card answers.
      await expect(async () => {
        await option.click();
        await expect(option).toHaveAttribute('aria-label', answered, { timeout: 250 });
      }).toPass({ timeout: 5_000 });
      if (right.test((await option.getAttribute('aria-label')) ?? '')) break;
    }
    // The right answer leads either to See results or to the next round (whose cards are not answered yet).
    await expect
      .poll(async () => {
        if (await seeResults.isVisible()) state.next = 'results';
        else {
          const labels = await options.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
          state.next = labels.length > 0 && !labels.some((label) => right.test(label)) ? 'round' : 'waiting';
        }
        return state.next;
      })
      .not.toBe('waiting');
  }
  await seeResults.click();

  // Results.
  const backHome = button((m) => m.learner.results.backHome.cta);
  await checkScreen(page, locale, 'Results', backHome);
  await backHome.click();

  // Home: the first of Today's mission cards is the way into the next quest.
  await expect(page.getByText(n((m) => m.learner.home.greeting('Dani')))).toBeVisible();
  await checkScreen(page, locale, 'Home', page.getByTestId('home-missions').getByRole('button').first());

  // Profile: the grown-up zone is its way on.
  await button((m) => m.a11y.profileEntry).click();
  await expect(page.getByRole('heading', { name: n((m) => m.learner.profile.title) })).toBeVisible();
  const zone = button((m) => m.caregiver.audience.gated(m.caregiver.audience.family.zoneLabel, true));
  await checkScreen(page, locale, 'Profile', zone);
  await zone.click();

  // PinEntry (verify mode: the form created the PIN).
  await expect(page.getByText(n((m) => m.caregiver.pin.entry.verifySubtitle))).toBeVisible();
  await checkScreen(page, locale, 'PinEntry', button((m) => m.caregiver.pin.entry.unlock.cta));
}

for (const locale of matrixLocales(process.env)) {
  for (const vp of MATRIX_VIEWPORTS) {
    test.describe(`layout matrix: ${locale} at ${vp.width}x${vp.height}`, () => {
      // Entrance animations off, so a control is measured at its resting size.
      test.use({ viewport: { width: vp.width, height: vp.height }, locale: BROWSER_LOCALE[locale], reducedMotion: 'reduce' });

      test('Welcome, CreateProfile, Results, Home, Profile and PinEntry fit, with touch-sized controls and the CTA on screen', async ({
        page,
      }) => {
        test.setTimeout(120_000);
        await walkMatrix(page, locale);
      });
    });
  }
}
