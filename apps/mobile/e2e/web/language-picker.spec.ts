import type { Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { answerForkNew, readStored, waitForSaved } from './helpers';

/**
 * F-I18N-001 PR 5: the Welcome language row, the Profile Language card and the
 * reading-practice switch (wireframe profile/language-picker.md A and B).
 *
 * Only English ships (`LOCALE_STATUS`), so the DEFAULT build must draw no
 * language picker at all, even on a device whose browser prefers Spanish. The
 * pickers appear only in a build made with `EXPO_PUBLIC_SHOW_ALL_LOCALES=1`
 * (the QA flag); the second describe covers that build and runs only when
 * `E2E_ALL_LOCALES=1` points the suite at it:
 *
 *   EXPO_PUBLIC_SHOW_ALL_LOCALES=1 expo export --platform web --output-dir dist-all
 *   E2E_ALL_LOCALES=1  (and serve dist-all)
 *
 * The confirm sheet is written in the language being chosen: Spanish since the
 * Spanish dictionary landed (F-I18N-001 PR 15), Korean since the Korean one did
 * (PR 16). The tests read those lines from the dictionary.
 */
const ALL_LOCALES = process.env.E2E_ALL_LOCALES === '1';
/** The Spanish language-picker lines (the sheet is drawn in the language being chosen). */
const es = getMessages('es').learner.language;
/** The Korean language-picker lines (F-I18N-001 PR 16). */
const ko = getMessages('ko').learner.language;

/** Welcome to Home for one child profile (PIN 1234), then the Profile screen. */
async function onboardAndOpenProfile(page: Page): Promise<string> {
  await page.getByRole('button', { name: "Let's start" }).click();
  await page.getByRole('radio', { name: /^Someone I look after/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder('Type a name').fill('Dani');
  await page.getByRole('button', { name: 'Continue' }).click();
  for (let round = 0; round < 2; round++) {
    for (const d of '1234') await page.getByRole('button', { name: `Digit ${d}`, exact: true }).click();
  }
  await expect(page.getByText('PIN set')).toBeVisible();
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await answerForkNew(page);
  await expect(page.getByText('Your first card is waiting.')).toBeVisible();
  await waitForSaved(page, ['profiles']);
  await page.goto('/');
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('heading', { name: 'Profiles & settings' })).toBeVisible();
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  return profiles?.[0]?.id ?? '';
}

const switchName = 'Hide romanization until I tap';

test.describe('default build (English only)', () => {
  test.skip(ALL_LOCALES, 'run against the flagged build in the other describe');

  test.describe('on a Spanish-speaking device', () => {
    test.use({ locale: 'es-MX' });

    test('Welcome stays English and draws no language row', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText("Hi! I'm Hoya.")).toBeVisible();
      await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
      await expect(page.getByRole('radiogroup', { name: 'Language' })).toHaveCount(0);
      for (const endonym of ['English', 'Español', '한국어']) {
        await expect(page.getByRole('radio', { name: endonym })).toHaveCount(0);
      }
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });

  test('Profile has no language rows, only the reading-practice switch, and it is saved per profile', async ({ page }) => {
    await page.goto('/');
    const id = await onboardAndOpenProfile(page);

    await expect(page.getByText('This profile', { exact: true })).toHaveCount(0);
    await expect(page.getByText('New profiles and this device start in:')).toHaveCount(0);
    await expect(page.getByTestId('language-device')).toHaveCount(0);
    // The card is titled for reading alone, and the switch is there with its default (off).
    await expect(page.getByRole('heading', { name: 'Reading practice' })).toBeVisible();
    const toggle = page.getByRole('switch', { name: switchName });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await waitForSaved(page, [`settings:${id}`]);
    expect(await readStored(page, `settings:${id}`)).toEqual({ romanizationMode: 'tap' });

    // It survives a reload, and switching back stores the default again.
    await page.goto('/');
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await expect(page.getByRole('switch', { name: switchName })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('switch', { name: switchName }).click();
    await expect(page.getByRole('switch', { name: switchName })).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => readStored(page, `settings:${id}`)).toEqual({ romanizationMode: 'always' });
    // No locale was ever chosen on this device.
    expect(await readStored(page, 'device:settings')).toBeNull();
  });
});

test.describe('QA build with every language shown (E2E_ALL_LOCALES=1)', () => {
  test.skip(!ALL_LOCALES, 'needs a build made with EXPO_PUBLIC_SHOW_ALL_LOCALES=1');

  test('Welcome: three endonym chips, English marked; a tap stores the device choice and sets <html lang>', async ({ page }) => {
    await page.goto('/');
    const group = page.getByRole('radiogroup', { name: 'Language' });
    await expect(group).toBeVisible();
    await expect(group.getByRole('radio')).toHaveText(['English', 'Español', '한국어']);
    await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Español' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('radio', { name: 'Español' })).toHaveAttribute('lang', 'es');
    // The primary CTA is still there, above the row.
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();

    await page.getByRole('radio', { name: 'Español' }).click();
    await expect(page.getByRole('radio', { name: 'Español' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await waitForSaved(page, ['device:settings']);
    expect(await readStored(page, 'device:settings')).toEqual({ uiLocale: 'es' });

    // The choice survives a reload.
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Español' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('Profile: Language card with a confirm sheet in the new language and a way back', async ({ page }) => {
    await page.goto('/');
    const id = await onboardAndOpenProfile(page);

    await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Same as this device (English)' })).toHaveAttribute('aria-checked', 'true');

    // A mis-tap: the sheet is written in the language being chosen, and "Back to English" undoes it.
    await page.getByRole('radio', { name: 'Español' }).first().click();
    await expect(page.getByTestId('language-confirm')).toBeVisible();
    await expect(page.getByText(es.confirmProfile('Español'))).toBeVisible();
    await page.getByRole('button', { name: es.confirmBack('English') }).click();
    await expect(page.getByTestId('language-confirm')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Confirm: the profile gets its own language.
    await page.getByRole('radio', { name: 'Español' }).first().click();
    await page.getByRole('button', { name: es.confirmUse('Español') }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await waitForSaved(page, [`settings:${id}`]);
    expect(await readStored(page, `settings:${id}`)).toEqual({ uiLocale: 'es', romanizationMode: 'always' });
    expect(await readStored(page, 'device:settings')).toBeNull();

    // "Same as this device" removes the override (the profile is in Spanish now).
    await page.getByRole('radio', { name: es.sameAsDevice('English') }).click();
    await page.getByRole('button', { name: 'Use English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect.poll(() => readStored(page, `settings:${id}`)).toEqual({ romanizationMode: 'always' });
  });

  test('Profile: the device default asks first, then applies to the device', async ({ page }) => {
    await page.goto('/');
    await onboardAndOpenProfile(page);

    await page.getByTestId('language-device-ko').click();
    await expect(page.getByText(ko.confirmDevice('한국어'))).toBeVisible();
    await page.getByRole('button', { name: ko.confirmUse('한국어') }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await waitForSaved(page, ['device:settings']);
    expect(await readStored(page, 'device:settings')).toEqual({ uiLocale: 'ko' });
    await expect(page.getByTestId('language-device-ko')).toHaveAttribute('aria-checked', 'true');
  });
});
