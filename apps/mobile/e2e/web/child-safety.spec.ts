import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { forgetPin, onboardChild, openForGrownUps, readStored, seedStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * [OA] The child-safety suite on the release build with every switch on (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 9,
 * section 20 row OA-10). Row OA-10 turns "Who is using this?" (`EXPO_PUBLIC_WHO_CHOOSER`) and Who is joining?
 * (`EXPO_PUBLIC_MULTI_JOIN`) on by default, so this spec runs on the release build (`build:web`) in every pull
 * request, at 320 px and on a wide window; a bundle built with the chooser's kill switch off skips it with `E2E_WHO=0`.
 *
 * Each test is named by the invariant it checks. Where the invariants are checked:
 *
 * | Invariant | Here (320 px and 1280 px) | Also |
 * |---|---|---|
 * | CS-1 | chooser rows and Profile ask the PIN; a tile opens no session | `gate-handback.spec.ts`, `who-grown-up.spec.ts` (API build), `story-reader-sources.spec.ts` |
 * | CS-2 | Switch user from the Grown-up area, then the area row asks the PIN | `who-is-using.spec.ts` (the tab's unlock, the other tabs told) |
 * | CS-3 | — | `who-locked.spec.ts` |
 * | CS-4 | a device without a PIN: a grown-up row creates none; a lock is void | `PinEntryGrownUpUse.test.tsx`, `locks.test.ts` |
 * | CS-5 | no Back, the browser back held, `gate=grown-up` Cancel, the class join link | `who-is-using.spec.ts`, `join-batch.spec.ts` (API build) |
 * | CS-6 | the tiles carry names only | `WhoIsUsingScreen.test.tsx` (the chooser tree) |
 * | CS-7 | the rows carry the generic labels only | `who-grown-up.spec.ts` (API build, a signed-in account) |
 * | CS-8 | — | `pin-pauses.spec.ts`, `pin-reset.spec.ts` |
 * | CS-9, CS-10, CS-17 | — | `apps/web/e2e/pin-reset-signin.spec.ts`, `apps/web/e2e/one-account-console.spec.ts` (console export) |
 * | CS-11 | — | `join-batch.spec.ts` (API build) |
 * | CS-12, CS-20 | — | `people-remove.spec.ts` (API build) |
 * | CS-13, CS-18 | — | native only: `biometric-shortcut.test.ts`, `biometric.native.test.ts`, `PinEntryBiometric.test.tsx` |
 * | CS-14 | 5 minutes in the background close the Grown-up area session; a shorter break does not | `gate-background.test.tsx`, `session.test.ts`; the console unlock: `apps/web` `grown-up-lock-oa.test.tsx` |
 * | CS-15 | — | `gate-handback.spec.ts` |
 * | CS-16 | — | `pin-pauses.spec.ts`, `who-is-using.spec.ts` |
 * | CS-19 | — | `who-locked.spec.ts` |
 * | CS-21 | — | `who-is-using.spec.ts` |
 */
test.skip(process.env.E2E_WHO === '0', 'a build with the kill switch EXPO_PUBLIC_WHO_CHOOSER=false (E2E_WHO=0)');

const en = getMessages('en');
const w = en.learner.who;
const PIN_LINE = 'Enter your 4-digit PIN to continue.';
const title = (page: Page) => page.getByRole('heading', { name: w.title, exact: true });
const tile = (page: Page, name: string) => page.getByRole('button', { name: en.a11y.who.tile(name), exact: true });
const areaHeading = (page: Page) => page.getByRole('heading', { name: en.caregiver.audience.family.zoneLabel, exact: true });

/** Mina through onboarding (PIN set), then Joon added to the stored list: a shared family device on the chooser. */
async function sharedDevice(page: Page): Promise<void> {
  await onboardChild(page, { name: 'Mina', startJourney: false });
  const profiles = (await readStored<Array<Record<string, unknown>>>(page, 'profiles')) ?? [];
  const mina = profiles[0]!;
  await seedStored(page, 'profiles', [...profiles, { ...mina, id: 'profile:joon0001', displayName: 'Joon', createdAt: new Date().toISOString() }]);
  await expect(title(page)).toBeVisible();
}

async function hideAndShow(page: Page, awayMs: number): Promise<void> {
  const set = (state: 'hidden' | 'visible') =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await set('hidden');
  await page.clock.fastForward(awayMs);
  await set('visible');
}

/** Nothing on the page scrolls sideways (the body and the chooser fit the window). */
async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

for (const size of [
  { name: '320 px', width: 320, height: 640 },
  { name: 'wide', width: 1280, height: 800 },
]) {
  test.describe(`child safety on the release build, every switch on (${size.name})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    const tag = size.width;

    test('CS-1, CS-7: every grown-up row asks the PIN and Cancel returns to the chooser; the rows carry generic labels only; a tile opens no session', async ({ page }) => {
      await sharedDevice(page);
      await expectNoSidewaysScroll(page);
      // CS-7: Sign in as a grown-up (web, no use known) and the Grown-up area, nothing else: no name, no email.
      const rows = page.getByTestId('who-rows');
      await expect(page.getByTestId('who-row-signin')).toBeVisible();
      await expect(page.getByTestId('who-row-area')).toBeVisible();
      const rowText = (await rows.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
      expect(rowText.sort()).toEqual([en.caregiver.audience.family.zoneLabel, w.use.signIn].sort());
      expect(await rows.innerText()).not.toMatch(/@|Mina|Joon/);
      await shot(page, `child-safety-chooser-${tag}`);

      for (const row of ['who-row-area', 'who-row-signin']) {
        await page.getByTestId(row).click();
        await expect(page.getByText(PIN_LINE)).toBeVisible();
        await expect(areaHeading(page).filter({ visible: true })).toHaveCount(row === 'who-row-area' ? 1 : 0);
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(title(page)).toBeVisible();
      }

      // A learner tile needs no PIN and opens no grown-up session: Profile → Grown-up area still asks the PIN.
      await tile(page, 'Mina').click();
      await expect(page.getByText('Hi, Mina!')).toBeVisible();
      await page.getByRole('button', { name: 'Profile and settings' }).click();
      await openForGrownUps(page);
      await page.getByRole('button', { name: 'Grown-up area (PIN required)' }).click();
      await expect(page.getByText(PIN_LINE)).toBeVisible();
    });

    test('CS-2: Switch user in the Grown-up area lands on the chooser, and the Grown-up area row asks the PIN again', async ({ page }) => {
      await sharedDevice(page);
      await page.getByTestId('who-row-area').click();
      await unlockWithPin(page);
      await expect(areaHeading(page)).toBeVisible();
      await page.getByTestId('dashboard-switch-user').click();
      await expect(title(page)).toBeVisible();
      await page.getByTestId('who-row-area').click();
      await expect(page.getByText(PIN_LINE)).toBeVisible();
    });

    test('CS-4: on a device without a PIN, a grown-up row never creates one, and a lock is void', async ({ page }) => {
      await sharedDevice(page);
      await forgetPin(page);
      await expect(title(page)).toBeVisible();
      await expect(page.getByText(w.nopinCaption, { exact: true })).toBeVisible();
      await shot(page, `child-safety-nopin-${tag}`);
      // Sign in as a grown-up: the no-PIN line and Continue, never the new-PIN pad.
      await page.getByTestId('who-row-signin').click();
      await expect(page.getByText(en.caregiver.grownUpHome.noPin, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Digit 1' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(title(page)).toBeVisible();
      expect(await readStored(page, 'account:parentPinHash')).toBeNull();

      // A lock with no PIN on the device is void: Joon's tile opens his Home with no PIN screen.
      await seedStored(page, 'profiles:locks', { v: 1, ids: ['profile:joon0001'] });
      await expect(title(page)).toBeVisible();
      await page.getByRole('button', { name: /^Joon/ }).first().click();
      await expect(page.getByText('Hi, Joon!')).toBeVisible();
      await expect(page.getByText(PIN_LINE)).toHaveCount(0);
      expect(await readStored(page, 'account:parentPinHash')).toBeNull();
    });

    test('CS-5: no Back, the browser back stays on the chooser, gate=grown-up ends on a PIN screen whose Cancel returns, and the join link asks who first', async ({ page }) => {
      await sharedDevice(page);
      await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
      await tile(page, 'Mina').click();
      await page.getByTestId('home-who-switch').click();
      await expect(title(page)).toBeVisible();
      await page.goBack();
      await page.waitForTimeout(300);
      await expect(title(page)).toBeVisible();

      await page.goto('/?gate=grown-up&next=%2Fparent');
      await expect(page.getByText(PIN_LINE)).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(title(page)).toBeVisible();

      // OA-D20: a join link on a shared device never opens Join for whoever played last.
      await page.goto('/join#c=abc234');
      await expect(title(page)).toBeVisible();
      await expect(page.getByText(w.joinCaption, { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: en.caregiver.join.title, exact: true })).toHaveCount(0);
    });

    test('CS-6: the learner tiles carry names only: no stars, cards, level, streak, space, time or count', async ({ page }) => {
      await sharedDevice(page);
      const tiles = page.getByTestId('who-tiles');
      const lines = (await tiles.innerText()).split('\n').map((line) => line.trim()).filter(Boolean);
      expect(lines.sort()).toEqual(['Joon', 'Mina', w.add].sort());
      expect(await tiles.innerText()).not.toMatch(/\d|star|card|level|streak|day|minute|class|week/i);
    });

    test('CS-14: 5 minutes in the background close the Grown-up area session; a shorter break keeps it', async ({ page }) => {
      await page.clock.install();
      await sharedDevice(page);
      await page.getByTestId('who-row-area').click();
      await unlockWithPin(page);
      await expect(areaHeading(page)).toBeVisible();
      const report = page.getByRole('button', { name: en.report.action.seeReport, exact: true }).first();

      // Under 5 minutes away: the session holds, a report opens without the PIN.
      await hideAndShow(page, 4 * 60_000);
      await report.click();
      await expect(page.getByRole('heading', { name: /Mina: report|Joon: report/ })).toBeVisible();
      await expect(page.getByText(PIN_LINE)).toHaveCount(0);
      await page.getByRole('button', { name: 'Back' }).first().click();
      await expect(areaHeading(page)).toBeVisible();

      // 5 minutes away: the PIN is asked before anything of the Grown-up area opens again.
      await hideAndShow(page, 5 * 60_000 + 1_000);
      const pin = page.getByText(PIN_LINE);
      await expect(pin.or(report)).toBeVisible();
      if (!(await pin.isVisible())) await report.click();
      await expect(pin).toBeVisible();
      await expect(page.getByRole('heading', { name: /Mina: report|Joon: report/ })).toHaveCount(0);
    });
  });
}

