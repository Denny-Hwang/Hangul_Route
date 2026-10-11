import { expect, test, type Page } from '@playwright/test';
import { typeDigits } from './helpers';

/**
 * F-LEARN-001 §3.2, §3.3, §3.14: the "Me" path. Nothing but the question is
 * drawn until it is answered; the agreement card says "13 or older" (never a
 * parent statement); no PIN is needed; and no age range or grown-up wording
 * leaks into the form.
 */
const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
] as const;

/** Text of the whole screen, whitespace collapsed. */
const screenText = (page: Page): Promise<string> =>
  page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('"Me": the form appears after the answer, needs the box but no PIN, and says no age', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: "Let's start" }).click();

      // Step one: only the question, nothing preselected, Continue says why it waits.
      await expect(page.getByRole('heading', { name: 'Who is learning?' })).toBeVisible();
      const me = page.getByRole('radio', { name: /^Me\./ });
      const child = page.getByRole('radio', { name: /^My child or a student/ });
      await expect(me).toHaveAttribute('aria-checked', 'false');
      await expect(child).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByPlaceholder('Type a name')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
      await expect(page.getByText('Choose who is learning')).toBeVisible();

      // "Me": first-person wording, the three reading levels with the middle one picked, five labelled cubs.
      await me.click();
      await expect(me).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByText('Your name', { exact: true })).toBeVisible();
      await expect(page.getByText('How do you like to learn?')).toBeVisible();
      await expect(page.getByRole('radio', { name: /^Some reading\./ })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('radio', { name: /^Pictures first\./ })).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByRole('radio', { name: /^Reads easily\./ })).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByText('You can change this any time in Profile.')).toBeVisible();
      for (const cub of ['Book Tiger', 'Home Tiger', 'Feast Tiger', 'Mountain Tiger', 'Craft Tiger']) {
        await expect(page.getByRole('radio', { name: cub })).toBeAttached();
      }
      await page.getByRole('radio', { name: 'Home Tiger' }).click();
      await expect(page.getByRole('radio', { name: 'Home Tiger' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('radio', { name: 'Book Tiger' })).toHaveAttribute('aria-checked', 'false');

      // Continue names the next missing step, in order.
      const next = page.getByRole('button', { name: 'Continue' });
      await expect(next).toBeDisabled();
      await expect(page.getByText('Type a name')).toBeVisible();
      await page.getByPlaceholder('Type a name').fill('Andrés');
      await expect(page.getByText('Tick the box to agree')).toBeVisible();

      // The agreement card: a short statement, an optional PIN row that stays closed, a link to the policy.
      await expect(page.getByText('Before you start')).toBeVisible();
      await expect(page.getByText("I'm 13 or older and I agree to the Privacy Policy.")).toBeAttached();
      await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeAttached();
      await expect(page.getByRole('button', { name: 'Protect settings with a PIN (optional)' })).toBeAttached();
      await expect(page.getByRole('button', { name: 'Digit 1' })).toHaveCount(0);
      await expect(page.getByText('For a grown-up')).toHaveCount(0);
      await expect(page.getByText('Create a grown-up PIN')).toHaveCount(0);

      // No age range anywhere on the form.
      const form = await screenText(page);
      expect(form).not.toMatch(/\bAges?\b|how old|5[-–]7|8[-–]9|10[-–]11/i);

      await page.getByRole('checkbox').click();
      await expect(next).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await next.click();

      await expect(page.getByText('Your first card is waiting.')).toBeVisible();
      const preview = await screenText(page);
      expect(preview).not.toMatch(/\bAges?\b|grown-up/i);
      await page.getByRole('button', { name: 'Start my journey' }).click();
      await page.goto('/');
      await expect(page.getByText('Hi, Andrés!')).toBeVisible();
    });

    test('"Me": the optional PIN row opens a 64 dp pad and a confirmed PIN is kept', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: "Let's start" }).click();
      await page.getByRole('radio', { name: /^Me\./ }).click();
      await page.getByPlaceholder('Type a name').fill('Soo');
      const row = page.getByRole('button', { name: 'Protect settings with a PIN (optional)' });
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await expect(page.getByText('Create a PIN', { exact: true })).toBeVisible();
      const key = page.getByRole('button', { name: 'Digit 5', exact: true });
      await key.scrollIntoViewIfNeeded();
      const box = await key.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(64);
      expect(box!.height).toBeGreaterThanOrEqual(64);

      await typeDigits(page);
      await expect(page.getByText('Type it again')).toBeVisible();
      await typeDigits(page);
      await expect(page.getByText('PIN set')).toBeVisible();
      await page.getByRole('checkbox').click();
      await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
    });
  });
}
