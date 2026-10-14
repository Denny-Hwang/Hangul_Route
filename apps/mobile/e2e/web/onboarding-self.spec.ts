import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { WHO_CHILD, WHO_SELF, agreeOnPrivacy, fillWhoAndProfile, readStored, typeDigits, waitForSaved } from './helpers';

/**
 * F-LEARN-001 §3.2, §3.3, §3.14, §3.15: the "Me" path in three steps. Step 1
 * asks who is learning with no age wording and says the answer does not change
 * the lessons; step 2 is the profile; step 3, Privacy, holds the "13 or older"
 * box (never a parent statement) and "I'm under 13", which hands the step to a
 * grown-up without losing the name or cub. No PIN is needed on the "Me" path.
 */
const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
] as const;

/** Text of the whole screen, whitespace collapsed. */
const screenText = (page: Page): Promise<string> =>
  page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));

const AGE_WORDING = /\b13\b|\bages?\b|how old|\bolder\b|5[-–]7|8[-–]9|10[-–]11/i;

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('"Me": three steps, no age before Privacy, the box but no PIN', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: "Let's start" }).click();

      // Step one: only the question, nothing preselected, Continue says why it waits.
      await expect(page.getByText('Step 1 of 3')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Who is learning?' })).toBeVisible();
      const me = page.getByRole('radio', { name: WHO_SELF });
      const child = page.getByRole('radio', { name: WHO_CHILD });
      await expect(me).toHaveAttribute('aria-checked', 'false');
      await expect(child).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByText("I'm setting this up for myself.")).toBeVisible();
      await expect(page.getByText("I'm a parent, guardian or teacher, setting it up for them.")).toBeVisible();
      await expect(page.getByText(/^This doesn't change your lessons\./)).toBeVisible();
      await expect(page.getByPlaceholder('Type a name')).toHaveCount(0);
      const next = page.getByRole('button', { name: 'Continue' });
      await expect(next).toBeDisabled();
      await expect(page.getByText('Choose who is learning')).toBeVisible();
      expect(await screenText(page)).not.toMatch(AGE_WORDING);

      await me.click();
      await expect(me).toHaveAttribute('aria-checked', 'true');
      await next.click();

      // Step two: first-person wording, the three reading levels with the middle one picked, five labelled cubs.
      await expect(page.getByText('Step 2 of 3')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
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
      // The consent is not on this step.
      await expect(page.getByRole('checkbox')).toHaveCount(0);
      await expect(next).toBeDisabled();
      await expect(page.getByText('Type a name')).toBeVisible();
      await page.getByPlaceholder('Type a name').fill('Andrés');
      expect(await screenText(page)).not.toMatch(AGE_WORDING);
      await next.click();

      // Step three, Privacy: a short statement, the "13 or older" box, a link to the policy,
      // an optional PIN row that stays closed, and the under-13 hand-over.
      await expect(page.getByText('Step 3 of 3')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
      await expect(page.getByText('Before you start')).toBeVisible();
      await expect(page.getByText("I'm 13 or older and I agree to the Privacy Policy.")).toBeAttached();
      await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeAttached();
      await expect(page.getByRole('button', { name: 'Protect settings with a PIN (optional)' })).toBeAttached();
      await expect(page.getByRole('button', { name: "I'm under 13" })).toBeAttached();
      await expect(page.getByText("Agreeing doesn't change the lessons.")).toBeAttached();
      await expect(page.getByRole('button', { name: 'Digit 1' })).toHaveCount(0);
      await expect(page.getByText('For a grown-up')).toHaveCount(0);
      await expect(page.getByText('Create a grown-up PIN')).toHaveCount(0);
      await expect(page.getByText('Tick the box to agree')).toBeVisible();

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

    test('"I\'m under 13" hands Privacy to a grown-up and keeps the name and cub', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: "Let's start" }).click();
      await fillWhoAndProfile(page, 'self', { name: 'Sam', avatar: 'Home Tiger' });
      await page.getByRole('checkbox').click();

      await page.getByRole('button', { name: "I'm under 13" }).click();
      await expect(page.getByText('A grown-up finishes this step: they agree and create a PIN. The name and Hoya stay the same.')).toBeVisible();
      await expect(page.getByText('For a grown-up')).toBeVisible();
      await expect(page.getByText(/^I'm a parent or guardian of this learner/)).toBeAttached();
      await expect(page.getByText("I'm 13 or older and I agree to the Privacy Policy.")).toHaveCount(0);
      await expect(page.getByRole('button', { name: "I'm under 13" })).toHaveCount(0);
      // The box starts over (it is a different statement) and the PIN is now required.
      await expect(page.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
      const next = page.getByRole('button', { name: 'Continue' });
      await expect(next).toBeDisabled();
      await expect(page.getByText('Tick the box to agree')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await agreeOnPrivacy(page, 'child');
      await expect(next).toBeEnabled();
      await next.click();
      await expect(page.getByText('Your first card is waiting.')).toBeVisible();
      await page.getByRole('button', { name: 'Start my journey' }).click();
      await waitForSaved(page, ['profiles', 'account:parentPinHash', 'account:guardianConsentAcceptedAt']);

      const profiles = await readStored<Array<{ displayName: string; avatar: string; learnerType?: string }>>(page, 'profiles');
      expect(profiles).toHaveLength(1);
      expect(profiles![0]).toMatchObject({ displayName: 'Sam', avatar: 'hoya-blue', learnerType: 'child' });
      expect(await readStored(page, 'account:selfConsentAcceptedAt')).toBeNull();
    });

    test('Back walks the steps and keeps every answer', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: "Let's start" }).click();
      await fillWhoAndProfile(page, 'self', { name: 'Soo', avatar: 'Craft Tiger' });
      await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();

      const back = page.getByRole('button', { name: 'Go back' });
      await back.click();
      await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
      await expect(page.getByPlaceholder('Type a name')).toHaveValue('Soo');
      await expect(page.getByRole('radio', { name: 'Craft Tiger' })).toHaveAttribute('aria-checked', 'true');
      await back.click();
      await expect(page.getByRole('heading', { name: 'Who is learning?' })).toBeVisible();
      await expect(page.getByRole('radio', { name: WHO_SELF })).toHaveAttribute('aria-checked', 'true');
      // First run: the question has no back control of its own.
      await expect(page.getByRole('button', { name: 'Go back' })).toHaveCount(0);

      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByPlaceholder('Type a name')).toHaveValue('Soo');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
    });

    test('"Me": the optional PIN row opens a 64 dp pad and a confirmed PIN is kept', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: "Let's start" }).click();
      await fillWhoAndProfile(page, 'self', { name: 'Soo' });
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
