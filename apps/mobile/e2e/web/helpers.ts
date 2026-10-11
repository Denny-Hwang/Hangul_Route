import { expect, type Page } from '@playwright/test';

/**
 * Shared onboarding for the web e2e specs (F-LEARN-001 §5). Every spec that
 * needs a learner goes through the real "Who is learning?" form here, so a
 * change to that form is made in one place.
 */

/** The grown-up PIN every spec uses. */
export const E2E_PIN = '1234';

export type TigerLabel = 'Book Tiger' | 'Home Tiger' | 'Feast Tiger' | 'Mountain Tiger' | 'Craft Tiger';

export interface OnboardOptions {
  name: string;
  /** Visible label of the cub to pick; the form's default (Book Tiger) when omitted. */
  avatar?: TigerLabel;
  /** The grown-up PIN a "My child or a student" learner creates. */
  pin?: string;
  /** Press "Start my journey" on the first-quest preview (default true). */
  startJourney?: boolean;
}

/** Tap the four digits of a PIN on the on-screen pad (the pad on the PIN screen and the one in the form share the labels). */
export async function typeDigits(page: Page, pin: string = E2E_PIN): Promise<void> {
  for (const d of pin) await page.getByRole('button', { name: `Digit ${d}`, exact: true }).click();
}

/** Verify mode of the PIN screen: the PIN, then "Unlock". */
export async function unlockWithPin(page: Page, pin: string = E2E_PIN): Promise<void> {
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
  await typeDigits(page, pin);
  await page.getByRole('button', { name: 'Unlock' }).click();
}

/** First gate of a device that has no PIN yet (legacy / self-only): create it twice. */
export async function createGateIn(page: Page, pin: string = E2E_PIN): Promise<void> {
  for (const round of [0, 1]) {
    await typeDigits(page, pin);
    await page.getByRole('button', { name: 'Next' }).click();
    if (round === 0) await expect(page.getByText('Enter it once more')).toBeVisible();
  }
}

/** Resolves once the keys are in IndexedDB, so an immediate reload does not race the async write. */
export function waitForSaved(page: Page, keys: string[]): Promise<unknown> {
  return page.waitForFunction(
    (wanted) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('keyval')) {
            db.close();
            return resolve(false);
          }
          const store = db.transaction('keyval').objectStore('keyval');
          const found = wanted.map(() => false);
          let pending = wanted.length;
          wanted.forEach((key, i) => {
            const get = store.get(`hr:${key}`);
            get.onerror = () => {
              pending -= 1;
              if (pending === 0) resolve(found.every(Boolean));
            };
            get.onsuccess = () => {
              found[i] = get.result !== undefined && get.result !== null && get.result !== 'null';
              pending -= 1;
              if (pending === 0) {
                db.close();
                resolve(found.every(Boolean));
              }
            };
          });
        };
      }),
    keys,
  );
}

/** From the Welcome screen's "Let's start" to the first-quest preview, answering "My child or a student". */
async function fillForm(page: Page, who: 'child' | 'self', o: OnboardOptions): Promise<void> {
  await page.getByRole('radio', { name: who === 'child' ? /^My child or a student/ : /^Me\./ }).click();
  await page.getByPlaceholder('Type a name').fill(o.name);
  if (o.avatar) await page.getByRole('radio', { name: o.avatar }).click();
  if (who === 'child') {
    const pin = o.pin ?? E2E_PIN;
    await typeDigits(page, pin); // create
    await typeDigits(page, pin); // type it again
    await expect(page.getByText('PIN set')).toBeVisible();
  }
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Your first card is waiting.')).toBeVisible();
}

async function finish(page: Page, who: 'child' | 'self', o: OnboardOptions): Promise<void> {
  if (o.startJourney ?? true) await page.getByRole('button', { name: 'Start my journey' }).click();
  await waitForSaved(page, ['profiles', ...(who === 'child' ? ['account:parentPinHash'] : [])]);
}

/** Continue from the Welcome screen: a child or student, grown-up PIN created in the form. */
export async function completeChildForm(page: Page, o: OnboardOptions): Promise<void> {
  await fillForm(page, 'child', o);
  await finish(page, 'child', o);
}

/** Continue from the Welcome screen: a learner who is 13 or older, no PIN. */
export async function completeSelfForm(page: Page, o: OnboardOptions): Promise<void> {
  await fillForm(page, 'self', o);
  await finish(page, 'self', o);
}

/** Cold start to the first-quest preview (or Home with `startJourney: false` left out): "My child or a student", PIN `E2E_PIN`. */
export async function onboardChild(page: Page, o: OnboardOptions): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, o);
}

/** Cold start through the "Me" path: ticks "13 or older", sets no PIN, so the first grown-up action still creates one. */
export async function onboardSelf(page: Page, o: OnboardOptions): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeSelfForm(page, o);
}
