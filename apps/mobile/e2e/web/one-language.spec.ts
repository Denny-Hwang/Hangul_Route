import type { BrowserContext, Page } from '@playwright/test';
import { CONSOLE_SESSION_KEY, encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardSelf, openLettersEpisode, readStored, seedStored, waitForSaved } from './helpers';
import { shot } from './shots';
import { closeInstallGuide, expectNoSidewaysScroll } from './text-fit';

/**
 * Owner items 6 and 7: one UI language per device (and per account), and a text size on every page,
 * end to end on the merged app-host build (the learner app, All lessons, the presenter and the
 * grown-up pages on one origin, one record: `hr:device:settings`).
 *
 * - Korean set in the learner Profile reaches /parent, /teach, /signin, /browse and the presenter's
 *   home, start screen and Exit, live in a tab that was already open (BroadcastChannel 'hr-prefs')
 *   and after a reload.
 * - An English learner app with a console that once stored Korean shows the console in English.
 * - A console deck with no explicit slide language opens the home and the start screen in the
 *   device language.
 * - The presenter home has no language chips and an Aa button, portrait and landscape.
 * - Text size Largest at 360 x 640: Profile, Home, /parent and /teach/space never scroll sideways;
 *   at 320 x 568 (the fit rule of AMENDMENTS-DISPLAY-NAV section 4): the four tabs, Profile, the
 *   open Display sheet and a quest step; at 1180 x 820: Home and the grown-up frame header.
 * - A `?lang=` hand-off seeds a device that never chose with the 1970 stamp, so a signed-in
 *   account's choice still wins; a teacher laptop that never ran the learner app keeps the console
 *   language it chose before the record existed.
 *
 * The grown-up is signed in through the dev auth bridge's console session (the merged build has no
 * Clerk key in e2e, as grown-up-shell.spec.ts does), and the learner is a "Me" learner with no PIN, so
 * the grown-up lock opens straight away. The Korean Clerk widget itself needs a Clerk key: it is
 * covered by `apps/web` unit tests (`clerkLocalization`, the ClerkProvider `localization` prop).
 */
const ko = getMessages('ko');
const en = getMessages('en');

const SESSION = { token: 'acct-or67', accountId: 'acct-or67', displayName: 'Ms Kim' };

/** Puts the console session in `sessionStorage` on grown-up pages only (a learner page's boot removes it). */
async function signedInOnGrownUpPages(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ([key, value]) => {
      if (/^\/(signin|parent|teach|account|start)(\/|$)/.test(window.location.pathname)) window.sessionStorage.setItem(key, value);
    },
    [CONSOLE_SESSION_KEY, JSON.stringify(SESSION)] as const,
  );
}

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:or67a1',
  title: 'Week 3 letters',
  createdAt: '2026-10-16T09:00:00Z',
  seed: 7,
  blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
  picker: null,
};
const presentLink = (deck: LectureDeckInput = DECK): string => `/present#d=${encodeDeck(deck)}`;

async function openProfileDisplay(page: Page): Promise<void> {
  await page.goto('/');
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(500);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page.getByTestId('profile-display-row').click();
  await expect(page.getByTestId('display-sheet')).toBeVisible();
}

/** A learner on Home with the device's text size at Largest (the record, as the Display sheet writes it). */
async function learnerAtLargest(page: Page): Promise<void> {
  await onboardSelf(page, { name: 'Dani', startJourney: false });
  await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dani!')).toBeVisible();
  await closeInstallGuide(page);
}

test.describe('one UI language per device (owner items 6 and 7)', () => {
  test('Korean set in the learner Profile: every grown-up page, All lessons and the presenter speak Korean, live and after a reload', async ({ page, context }) => {
    await signedInOnGrownUpPages(context);
    await onboardSelf(page, { name: 'Dani', startJourney: false });

    // A grown-up tab already open on this device, still in English.
    const grownUp = await context.newPage();
    await grownUp.goto('/parent');
    await expect(grownUp.getByTestId('adult-frame')).toBeVisible();
    await expect(grownUp.locator('html')).toHaveAttribute('lang', 'en');
    await expect(grownUp.getByTestId('frame-display')).toHaveAccessibleName(en.common.display.a11y);
    // A presenter tab open on its home, in English too (a classroom screen size, so a lesson can run).
    const presenter = await context.newPage();
    await presenter.setViewportSize({ width: 1280, height: 720 });
    await presenter.goto('/present');
    await expect(presenter.getByRole('heading', { level: 1, name: en.learner.presenter.home.title })).toBeVisible();

    await page.bringToFront();
    await openProfileDisplay(page);
    await page.getByTestId('display-sheet').getByRole('radio', { name: '한국어' }).click();
    await page.getByTestId('display-sheet').getByRole('button', { name: ko.common.display.confirm.use('한국어') }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await waitForSaved(page, ['device:settings']);

    // Live: the open tabs switch without a reload (BroadcastChannel 'hr-prefs').
    await expect(grownUp.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(grownUp.getByTestId('frame-display')).toHaveAccessibleName(ko.common.display.a11y);
    await expect(grownUp).toHaveTitle(ko.console.docTitle.console);
    await expect(presenter.getByRole('heading', { level: 1, name: ko.learner.presenter.home.title })).toBeVisible();

    // After a reload, every grown-up page opens in Korean, with no English frame first.
    for (const path of ['/parent', '/teach', '/signin']) {
      await grownUp.goto(path);
      await expect(grownUp.locator('html'), path).toHaveAttribute('lang', 'ko');
      await expect(grownUp.getByRole('button', { name: ko.common.display.a11y }).first(), path).toBeVisible();
    }
    await expect(grownUp).toHaveTitle(ko.console.docTitle.signIn);
    await shot(grownUp, 'or67-signin-ko-pixel5');

    // All lessons (no pass on this device: its Access screen) speaks the device's language.
    await grownUp.goto('/browse');
    await expect(grownUp.locator('html')).toHaveAttribute('lang', 'ko');

    // The presenter: the home, a link's start screen and Exit, all in Korean.
    await presenter.reload();
    await expect(presenter.getByRole('heading', { level: 1, name: ko.learner.presenter.home.title })).toBeVisible();
    await presenter.goto(presentLink());
    await expect(presenter.getByTestId('presenter-start')).toBeVisible();
    await expect(presenter.getByTestId('presenter-start-back')).toHaveAccessibleName(ko.learner.presenter.start.back.cta);
    const start = presenter.getByTestId('presenter-start-button');
    await expect(start).toBeEnabled({ timeout: 10_000 });
    await start.click();
    await expect(presenter.getByTestId('presenter-stage')).toBeVisible();
    await presenter.keyboard.press('Escape');
    await expect(presenter.getByText(ko.learner.presenter.exit.title)).toBeVisible();
    await expect(presenter.getByTestId('presenter-exit-confirm')).toHaveAccessibleName(ko.learner.presenter.bar.exit.cta);
  });

  test('an English learner app with a console that once stored Korean shows the console in English', async ({ page, context }) => {
    await signedInOnGrownUpPages(context);
    await onboardSelf(page, { name: 'Dani', startJourney: false });
    // The learner app chose English on this device (Welcome's chips, a deliberate choice).
    await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    // The console's own stored choice from before (now only a mirror) says Korean.
    await page.evaluate(() => window.localStorage.setItem('hr:console:uiLocale', 'ko'));
    await page.goto('/parent');
    await expect(page.getByTestId('adult-frame')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('frame-display')).toHaveAccessibleName(en.common.display.a11y);
    // The mirror follows the record.
    expect(await page.evaluate(() => window.localStorage.getItem('hr:console:uiLocale'))).toBe('en');
  });

  test('the learner app hands off lang=en too: a console that stored Korean opens in English on a device that never chose', async ({ page, context }) => {
    await signedInOnGrownUpPages(context);
    // A learner app in English by detection (no language was ever chosen on this device).
    await onboardSelf(page, { name: 'Dani', startJourney: false });
    expect(await readStored(page, 'device:settings')).toBeNull();
    await page.evaluate(() => window.localStorage.setItem('hr:console:uiLocale', 'ko'));
    await page.goto('/parent?lang=en');
    await expect(page.getByTestId('adult-frame')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // The hand-off seeded the device (it never chose) and left the address. A seed is stamped 1970,
    // older than any real choice, so an account's language still wins the merge after a sign-in.
    await expect.poll(() => readStored(page, 'device:settings')).toEqual({ uiLocale: 'en', uiLocaleAt: '1970-01-01T00:00:00.000Z' });
    await expect(page).toHaveURL(/\/parent$/);
  });

  test('Welcome, then I am a teacher on a browser in English: the sign-in page seeds the device with the 1970 stamp only', async ({ page }) => {
    await page.goto('/signin?persona=teacher&lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect.poll(() => readStored(page, 'device:settings')).toEqual({ uiLocale: 'en', uiLocaleAt: '1970-01-01T00:00:00.000Z' });
    await expect(page).toHaveURL(/\/signin\?persona=teacher$/);
  });

  test('a teacher laptop that never ran the learner app keeps the console language it chose before the record existed', async ({ page }) => {
    // The console's own choice from before the record existed is on the laptop before any grown-up page runs (an init
    // script, once per tab). Written by `page.evaluate` after a page has loaded, it raced that page's own mirror sync
    // (which clears a mirror the record does not hold) and the reload, and CI's Chromium read English.
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem('e2e:console-choice') !== null) return;
      window.sessionStorage.setItem('e2e:console-choice', 'set');
      window.localStorage.setItem('hr:console:uiLocale', 'ko');
    });
    await page.goto('/signin');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    // Folded into the device record with the 1970 stamp (an account choice still wins over it).
    await expect.poll(() => readStored(page, 'device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: '1970-01-01T00:00:00.000Z' });
    // The record holds it now: a reload keeps Korean.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  });

  test('a console deck with no explicit slide language opens the home and the start screen in the device language', async ({ page }) => {
    await page.goto('/');
    await seedStored(page, 'device:settings', { uiLocale: 'es', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    await page.goto('/present');
    await expect(page.getByRole('heading', { level: 1, name: getMessages('es').learner.presenter.home.title })).toBeVisible();
    await page.goto(presentLink());
    await expect(page.getByTestId('presenter-start-back')).toHaveAccessibleName(getMessages('es').learner.presenter.start.back.cta);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    // A deck that names its slide language keeps the chrome in the device language all the same.
    await page.goto(presentLink({ ...DECK, id: 'lecture:or67a2', options: { uiLocale: 'ko' } }));
    await expect(page.getByTestId('presenter-start-back')).toHaveAccessibleName(getMessages('es').learner.presenter.start.back.cta);
  });
});

for (const viewport of [
  { width: 360, height: 640, name: 'portrait' },
  { width: 640, height: 360, name: 'landscape' },
]) {
  test.describe(`the presenter home at ${viewport.width} x ${viewport.height} (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('no language chips; the Aa button is there and opens the Display sheet', async ({ page }) => {
      await page.goto('/present');
      await expect(page.getByTestId('presenter-home-title')).toBeVisible();
      await expect(page.getByTestId('presenter-home-language')).toHaveCount(0);
      await expect(page.getByRole('radiogroup', { name: 'Presenter language' })).toHaveCount(0);
      const aa = page.getByTestId('presenter-home-display');
      await expect(aa).toBeVisible();
      await expect(aa).toHaveAccessibleName('Aa, Display: language and text size');
      const box = (await aa.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(64);
      expect(box.height).toBeGreaterThanOrEqual(64);
      await shot(page, `or67-presenter-home-${viewport.width}x${viewport.height}`);
      await aa.click();
      await expect(page.getByTestId('presenter-display-sheet')).toBeVisible();
      await expectNoSidewaysScroll(page, `presenter home ${viewport.name} with the sheet`);
    });
  });
}

test.describe('text size Largest at 360 x 640', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('Profile, Home, /parent and /teach/space never scroll sideways, and the type is larger', async ({ page, context }) => {
    await signedInOnGrownUpPages(context);
    await onboardSelf(page, { name: 'Dani', startJourney: false });
    await openProfileDisplay(page);
    await page.getByTestId('display-sheet').getByRole('radio', { name: 'Largest' }).click();
    await expect(page.getByTestId('profile-display-row')).toContainText('English · Text: Largest');
    await waitForSaved(page, ['device:settings']);
    await shot(page, 'or67-display-sheet-largest-360x640');
    await page.getByTestId('display-sheet').getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    await expectNoSidewaysScroll(page, 'Profile');
    await shot(page, 'or67-profile-largest-360x640');

    await page.goto('/');
    await expect(page.getByText('Hi, Dani!')).toBeVisible();
    await expectNoSidewaysScroll(page, 'Home');
    await shot(page, 'or67-home-largest-360x640');

    for (const path of ['/parent', '/teach/space?id=space_or67']) {
      await page.goto(path);
      await expect(page.getByTestId('adult-frame'), path).toBeVisible();
      // The root size follows the record: 1.5 x the 16 px default.
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize), { message: path }).toBe('24px');
      await expectNoSidewaysScroll(page, path);
      await shot(page, `or67-${path.replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}-largest-360x640`);
    }
  });
});

test.describe('text size Largest at 320 x 568 (the fit rule, AMENDMENTS-DISPLAY-NAV section 4)', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('the four tabs, Profile and the open Display sheet: no sideways scroll, no text past the edge', async ({ page }) => {
    await learnerAtLargest(page);
    await expectNoSidewaysScroll(page, 'Home');
    await shot(page, 'or67-home-largest-320x568');
    const tabs = page.getByRole('tablist').getByRole('link');
    await expect(tabs).toHaveCount(4);
    for (const [index, name] of [
      [1, 'Route'],
      [2, 'Journey'],
      [3, 'Library'],
    ] as const) {
      await tabs.nth(index).click();
      await page.waitForTimeout(400);
      await expectNoSidewaysScroll(page, name);
      await shot(page, `or67-${name.toLowerCase()}-largest-320x568`);
    }
    await tabs.nth(0).click();
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
    await expectNoSidewaysScroll(page, 'Profile');
    await page.getByTestId('profile-display-row').click();
    await expect(page.getByTestId('display-sheet')).toBeVisible();
    await expectNoSidewaysScroll(page, 'the Display sheet');
    await shot(page, 'or67-display-sheet-largest-320x568');
  });

  test('the quest player\'s first steps: no sideways scroll, no text past the edge', async ({ page }) => {
    await learnerAtLargest(page);
    await openLettersEpisode(page);
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
    await expectNoSidewaysScroll(page, 'the quest intro');
    await shot(page, 'or67-quest-intro-largest-320x568');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
    await expectNoSidewaysScroll(page, 'the Discover step');
    await shot(page, 'or67-quest-discover-largest-320x568');
  });
});

test.describe('text size Largest at 1180 x 820', () => {
  test.use({ viewport: { width: 1180, height: 820 } });

  test('Home (greeting, Aa and Profile) and the grown-up frame header fit', async ({ page, context }) => {
    await signedInOnGrownUpPages(context);
    await learnerAtLargest(page);
    await expect(page.getByTestId('home-display')).toBeVisible();
    await expectNoSidewaysScroll(page, 'Home');
    await page.goto('/parent');
    await expect(page.getByTestId('adult-frame')).toBeVisible();
    await expect(page.getByTestId('frame-display')).toBeVisible();
    await expectNoSidewaysScroll(page, '/parent');
    await shot(page, 'or67-parent-largest-1180x820');
  });
});
