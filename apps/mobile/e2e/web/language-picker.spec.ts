import type { Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { answerForkNew, readStored, seedStored, waitForSaved } from './helpers';

/**
 * F-I18N-001 PR 5, owner items 6 and 7: the Welcome language row, the Profile Display row (the Display
 * sheet: the device's one language and its text size) and the reading-practice switch.
 *
 * English, Spanish and Korean all ship (`LOCALE_STATUS`, F-I18N-001 rows 15b / 16b), so the default build
 * draws the pickers; a Spanish-speaking device starts in Spanish. The suite itself runs as an en-US
 * browser (`playwright.config.ts`). A text size chosen on the sheet applies at once; another
 * language chosen first asks in that language (Use / Back), the F-I18N-001 §3.3 safety rule.
 */
/** The Spanish and Korean words of the Display sheet (AMENDMENTS-DISPLAY-NAV section 10). */
const es = getMessages('es').common.display;
const ko = getMessages('ko').common.display;
const esWelcome = getMessages('es').learner.language;
/** An ISO 8601 time, as `device:settings.uiLocaleAt` stores it. */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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

test.describe('every build shows English, Spanish and Korean (F-I18N-001 rows 15b / 16b)', () => {
  test.describe('on a Spanish-speaking device', () => {
    test.use({ locale: 'es-MX' });

    test('Welcome opens in Spanish, with the language row and Spanish marked', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      const group = page.getByRole('radiogroup', { name: esWelcome.groupLabel });
      await expect(group.getByRole('radio')).toHaveText(['English', 'Español', '한국어']);
      await expect(page.getByRole('radio', { name: 'Español' })).toHaveAttribute('aria-checked', 'true');
      // Detection is a default, not a stored choice.
      expect(await readStored(page, 'device:settings')).toBeNull();
    });
  });

  test('Profile: the reading-practice switch is saved per profile, in its own card', async ({ page }) => {
    await page.goto('/');
    const id = await onboardAndOpenProfile(page);

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

  test('Welcome: three endonym chips, English marked; a tap stores the device choice with its time and sets <html lang>', async ({ page }) => {
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
    expect(await readStored(page, 'device:settings')).toEqual({ uiLocale: 'es', uiLocaleAt: expect.stringMatching(ISO) });

    // The choice survives a reload.
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Español' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('Profile: the Display row opens the sheet; another language asks first, in that language, with a way back', async ({ page }) => {
    await page.goto('/');
    const id = await onboardAndOpenProfile(page);

    const row = page.getByTestId('profile-display-row');
    await expect(row).toContainText('English · Text: Standard');
    await row.click();
    const sheet = page.getByTestId('display-sheet');
    await expect(sheet.getByRole('heading', { name: 'Display' })).toBeVisible();
    const language = sheet.getByRole('radiogroup', { name: 'Language' });
    await expect(language.getByRole('radio')).toHaveText(['English', 'Español', '한국어']);
    await expect(language.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');

    // A mis-tap: the step is written in Spanish, and "Volver a English" changes nothing.
    await language.getByRole('radio', { name: 'Español' }).click();
    const step = sheet.getByTestId('display-sheet-language-confirm');
    await expect(step.getByText(es.confirm.question('Español'))).toBeVisible();
    await expect(step).toHaveAttribute('lang', 'es');
    await sheet.getByRole('button', { name: es.confirm.back('English') }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await readStored(page, 'device:settings')).toBeNull();

    // Korean for the whole device: Use writes it once, with its time; the profile holds no language.
    await sheet.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: '한국어' }).click();
    await sheet.getByRole('button', { name: ko.confirm.use('한국어') }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    await expect(sheet.getByRole('heading', { name: ko.title })).toBeVisible();
    await waitForSaved(page, ['device:settings']);
    await expect.poll(() => readStored(page, 'device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: expect.stringMatching(ISO) });
    expect(await readStored<Record<string, unknown> | null>(page, `settings:${id}`)).toBeNull();
    await sheet.getByRole('button', { name: getMessages('ko').common.buttons.done }).click();
    await expect(sheet).toHaveCount(0);
  });

  test('Profile: Text size grows the screen live and is stored on the device', async ({ page }) => {
    await page.goto('/');
    await onboardAndOpenProfile(page);
    const heading = page.getByRole('heading', { name: 'Profiles & settings' });
    const before = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    await page.getByTestId('profile-display-row').click();
    const sheet = page.getByTestId('display-sheet');
    const size = sheet.getByRole('radiogroup', { name: 'Text size' });
    await expect(size.getByRole('radio')).toHaveCount(4);
    await expect(size.getByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
    await size.getByRole('radio', { name: 'Largest' }).click();
    await expect(size.getByRole('radio', { name: 'Largest' })).toHaveAttribute('aria-checked', 'true');
    await waitForSaved(page, ['device:settings']);
    expect(await readStored(page, 'device:settings')).toEqual({ textSize: 'largest' });
    await sheet.getByRole('button', { name: 'Done' }).click();

    const after = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(after).toBeGreaterThan(before);
    // A reload opens Home at the same size; so does Profile.
    await page.reload();
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    await expect.poll(() => heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(after);
  });

  test('an old per-profile language becomes the device language once, and is stripped (owner items 6 and 7)', async ({ page }) => {
    await page.goto('/');
    const id = await onboardAndOpenProfile(page);
    await seedStored(page, `settings:${id}`, { uiLocale: 'ko', romanizationMode: 'tap' });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    // Stamped older than any real choice (AMENDMENTS-DISPLAY-NAV section 3.3): an account's choice wins over it.
    await expect.poll(() => readStored(page, 'device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: '1970-01-01T00:00:00.000Z' });
    await expect.poll(() => readStored(page, `settings:${id}`)).toEqual({ romanizationMode: 'tap' });
  });
});
