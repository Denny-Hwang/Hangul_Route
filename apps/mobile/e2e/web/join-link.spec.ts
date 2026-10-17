import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { agreeOnPrivacy, fillWhoAndProfile, onboardChild, waitForSaved } from './helpers';
import { shot } from './shots';

/**
 * The class join link (owner decision 2026-10-17): `app.hangulroute.com/join#c=<code>`, the code alone in the
 * fragment, never a name. The learner app reads it once at boot, the address goes back to the app root with no
 * fragment (the code never stays in the address or in the history entry), and Join a class opens with the code in
 * its field; the learner still taps Join. A device with no profile yet starts the class-code first run (the profile
 * and consent steps, then Join a class), as Welcome's "Got a class code?" does. The teacher's roster shows the link
 * and its QR code (`apps/web/e2e/join-link.spec.ts`).
 */
test.use({ viewport: { width: 360, height: 640 } });

const en = getMessages('en');
const join = en.caregiver.join;

async function joinScreen(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: join.title, exact: true })).toBeVisible();
  await expect(page.getByTestId('join-code')).toBeVisible();
}

/** The address holds no trace of the code: no /join path, no fragment, and the history entry is the app root. */
async function expectCodeOutOfAddress(page: Page, code: string): Promise<void> {
  const address = await page.evaluate(() => ({ path: location.pathname, hash: location.hash, href: location.href }));
  expect(address.path).toBe('/');
  expect(address.hash).toBe('');
  expect(address.href).not.toContain(code);
}

test.describe('the class join link', () => {
  test('a device with a profile: Join a class opens with the code filled in, and the address loses it', async ({ page }) => {
    await onboardChild(page, { name: 'Mina', startJourney: false });
    await page.goto('/join#c=abc234');
    await joinScreen(page);
    await expect(page.getByTestId('join-code')).toHaveValue('ABC234');
    await expectCodeOutOfAddress(page, 'ABC234');
    await shot(page, 'join-link-prefilled-360');
    // A reload opens the app root, not Join a class again: the code was read once.
    await page.reload();
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    await expect(page.getByTestId('join-code')).toHaveCount(0);
  });

  test('a link with no valid code opens Join a class with an empty field', async ({ page }) => {
    await onboardChild(page, { name: 'Mina', startJourney: false });
    await page.goto('/join#c=O0O0O0');
    await joinScreen(page);
    await expect(page.getByTestId('join-code')).toHaveValue('');
    await expectCodeOutOfAddress(page, 'O0O0O0');
  });

  test('a fresh device: the profile and consent steps first, then Join a class with the code filled in', async ({ page }) => {
    await page.goto('/join#c=XYZ789');
    await expectCodeOutOfAddress(page, 'XYZ789');
    // The first-run form starts at once (Welcome is under it), for someone a grown-up looks after.
    await fillWhoAndProfile(page, 'child', { name: 'Jun' });
    await agreeOnPrivacy(page, 'child');
    await page.getByRole('button', { name: 'Continue' }).click();
    await waitForSaved(page, ['profiles', 'account:parentPinHash']);
    await joinScreen(page);
    await expect(page.getByTestId('join-code')).toHaveValue('XYZ789');
    // The level check's fork and the first-quest preview wait: Join a class is what the link asked for.
    await expect(page.getByTestId('placement-invite')).toHaveCount(0);
    await shot(page, 'join-link-first-run-360');
  });

  test("Welcome's Got a class code? takes the same first run, with nothing filled in", async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-class-code').click();
    await fillWhoAndProfile(page, 'self', { name: 'Ari' });
    await agreeOnPrivacy(page, 'self');
    await page.getByRole('button', { name: 'Continue' }).click();
    await waitForSaved(page, ['profiles']);
    await joinScreen(page);
    await expect(page.getByTestId('join-code')).toHaveValue('');
  });
});
