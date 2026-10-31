import type { Page } from '@playwright/test';
import { CATALOG } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, passDiscover, readStored, seedStoredAll } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-44 S7 on the release bundle: Stage 7 Letters & Books Volume 2, "My Postcard" (a letter frame, a
 * one-line diary and a postcard of the learner's own). `volumes` is at built-in pct 0 (the row merges dark), so each case
 * turns it on through the stored remote copy, as a ramp would. On: the cell opens Volume 2 once Volume 1 is done, its page,
 * its first quest's Discover (편지 and the letter frame ___에게) and its Type Hangul Practice fit 320 px. Off: the cell is
 * its Volume 1 alone.
 */
const LETTERS_V1 = CATALOG.cells.find((c) => c.episodeId === 'episode:stage7-letters');
const VOLUMES_ON = { volumes: { on: true, pct: 100 } };
const lettersCell = (page: Page) => page.getByRole('button', { name: /^Stage 7 [^,]+, Letters & Books/ });

/** A learner with Stage 7 Letters & Books' Volume 1 done, and the switches as given. */
async function lettersLearner(page: Page, flags: Record<string, { on: boolean; pct: number }>): Promise<void> {
  const AT = '2026-10-01T10:00:00.000Z';
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  const questIds = LETTERS_V1?.questIds ?? [];
  expect(questIds).toHaveLength(3);
  const quests = questIds.map((questId) => ({ questId, episodeId: 'episode:stage7-letters', startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
  const questDoneAt = Object.fromEntries(questIds.map((q) => [q, AT]));
  await seedStoredAll(page, {
    [`progress:${id}`]: { profileId: id, updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, questDoneAt },
    'remote-config': { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags },
  });
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

test.describe('Stage 7 Letters & Books Volume 2, My Postcard (release bundle, F-CURR-002 CM-44 S7)', () => {
  for (const [label, size] of [
    ['320', { width: 320, height: 800 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    test(`${label}: volumes on, the cell opens Volume 2, its page and its first quest's Discover fit the screen`, async ({ page }) => {
      await page.setViewportSize(size);
      await lettersLearner(page, VOLUMES_ON);
      await lettersCell(page).scrollIntoViewIfNeeded();
      await expect(lettersCell(page)).toHaveAccessibleName(/Opens Volume 2\.$/);
      await expect(page.getByTestId('journey-volumes-stage7-letters-2-open')).toHaveCount(1);
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `postcard-v2-grid-${label}`);
      await lettersCell(page).click();
      await expect(page.getByText('My Postcard').first()).toBeVisible();
      const tabs = page.getByRole('tablist', { name: 'Volumes' });
      await expect(tabs.getByRole('tab', { name: 'Volume 2' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText('One-Line Diary').first()).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `postcard-v2-page-${label}`);
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      const anyway = page.getByRole('button', { name: 'Play anyway' });
      await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
      if (await anyway.isVisible()) await anyway.click();
      // The intro, then the Discover pages: 편지 and the letter frame ___에게 with its two examples first.
      await page.getByRole('button', { name: 'Continue' }).first().click();
      await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
      await expect(page.getByText(/편지/).first()).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `postcard-v2-discover-${label}`);
      await passDiscover(page);
      // Practice: Type Hangul on the letter words (편지, 호야에게, 친구, 잘 지냈어요).
      await expect(page.getByText('Type the Words').first()).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `postcard-v2-practice-${label}`);
    });
  }

  test('volumes off (the launch state): the cell is Volume 1 alone and nothing of Volume 2 shows', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await lettersLearner(page, {});
    await lettersCell(page).scrollIntoViewIfNeeded();
    await expect(page.getByTestId('journey-volumes-stage7-letters')).toHaveCount(0);
    await expect(lettersCell(page)).not.toHaveAccessibleName(/Volume/);
    await lettersCell(page).click();
    await expect(page.getByText('Write Your Name').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Volumes' })).toHaveCount(0);
    await expect(page.getByText('My Postcard')).toHaveCount(0);
  });
});
