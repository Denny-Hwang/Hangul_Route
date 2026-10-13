import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, passDiscover, playCheck } from './helpers';

/**
 * F-STORY-004 PR 4.8c (F-HW-001 §3.2): Today's mission stays pinned for the day when Home mounts
 * again. Results' Back home resets the stack to Main, which mounts Home again; the pin lives in a
 * session store keyed by profile and day, so the card the learner just finished keeps its slot with
 * the collected look and the other two cards keep their targets. Regular build (no story fixture):
 * the story-card half is in story-shelf.spec.ts.
 */

const missionCards = (page: Page): Locator => page.getByTestId('home-missions').getByRole('button');

async function cardNames(page: Page): Promise<string[]> {
  await expect(missionCards(page)).toHaveCount(3);
  return missionCards(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
}

/** A new learner on Home, with the install guide out of the way. */
async function newLearnerAtHome(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

test('Back home after the slot-2 Journey quest: the same card reads collected, slots 1 and 3 keep their targets', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await newLearnerAtHome(page);

  const before = await cardNames(page);
  // Slot 2 is the Journey cursor: the first quest, not collected yet.
  expect(before[1]).toMatch(/\. Something new today\.$/);

  // Finish it from Home: Discover read, the two games skipped, the Check played.
  await missionCards(page).nth(1).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheck(page);
  await page.getByRole('button', { name: 'See results' }).click();
  await page.getByRole('button', { name: 'Back home' }).click();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();

  // The pinned plan: slot 2 keeps the quest just finished, collected; slots 1 and 3 are unchanged.
  await expect(missionCards(page).nth(1)).toHaveAccessibleName(`${before[1]} Collected.`);
  const after = await cardNames(page);
  expect(after[0]).toBe(before[0]);
  expect(after[2]).toBe(before[2]);
  expect(errors).toEqual([]);
});
