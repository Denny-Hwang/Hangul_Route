import type { Page } from '@playwright/test';
import { CATALOG } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, passDiscover, readStored, seedStoredAll } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-43 S7 on the release bundle: Stage 7 Food & Daily Life Volume 2, "My Favorite Food" (a favorite
 * food and the steps of a simple recipe). `volumes` is at built-in pct 0 (the row merges dark), so each case turns it on through the
 * stored remote copy, as a ramp would. On: the cell opens Volume 2 once Volume 1 is done, its page, its first quest's
 * Discover (the frame 제가 좋아하는 음식은 ___이에요/예요) and its Type Hangul Practice fit 320 px. Off: the cell is its Volume 1 alone.
 */
const LIFE_V1 = CATALOG.cells.find((c) => c.episodeId === 'episode:stage7-life');
const VOLUMES_ON = { volumes: { on: true, pct: 100 } };
const lifeCell = (page: Page) => page.getByRole('button', { name: /^Stage 7 [^,]+, Food & Daily Life/ });

/** A learner with Stage 7 Food & Daily Life's Volume 1 done, and the switches as given. */
async function foodLearner(page: Page, flags: Record<string, { on: boolean; pct: number }>): Promise<void> {
  const AT = '2026-10-01T10:00:00.000Z';
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  const questIds = LIFE_V1?.questIds ?? [];
  expect(questIds).toHaveLength(3);
  const quests = questIds.map((questId) => ({ questId, episodeId: 'episode:stage7-life', startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
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

test.describe('Stage 7 Food & Daily Life Volume 2, My Favorite Food (release bundle, F-CURR-002 CM-43 S7)', () => {
  for (const [label, size] of [
    ['320', { width: 320, height: 800 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    test(`${label}: volumes on, the cell opens Volume 2, its page and its first quest's Discover fit the screen`, async ({ page }) => {
      await page.setViewportSize(size);
      await foodLearner(page, VOLUMES_ON);
      await lifeCell(page).scrollIntoViewIfNeeded();
      await expect(lifeCell(page)).toHaveAccessibleName(/Opens Volume 2\.$/);
      await expect(page.getByTestId('journey-volumes-stage7-life-2-open')).toHaveCount(1);
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `favorite-food-v2-grid-${label}`);
      await lifeCell(page).click();
      await expect(page.getByText('My Favorite Food').first()).toBeVisible();
      const tabs = page.getByRole('tablist', { name: 'Volumes' });
      await expect(tabs.getByRole('tab', { name: 'Volume 2' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText('Make Bibimbap').first()).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `favorite-food-v2-page-${label}`);
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      const anyway = page.getByRole('button', { name: 'Play anyway' });
      await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
      if (await anyway.isVisible()) await anyway.click();
      // The intro, then the Discover pages: the frame and its two examples first.
      await page.getByRole('button', { name: 'Continue' }).first().click();
      await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
      await expect(page.getByText(/좋아하는 음식/).first()).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `favorite-food-v2-discover-${label}`);
      await passDiscover(page);
      // Practice: Type Hangul on the food words (음식, 비빔밥, 떡볶이, 비빔밥이 맛있어요).
      await expect(page.getByText('Type the Words').first()).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `favorite-food-v2-practice-${label}`);
    });
  }

  test('volumes off (the launch state): the cell is Volume 1 alone and nothing of Volume 2 shows', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await foodLearner(page, {});
    await lifeCell(page).scrollIntoViewIfNeeded();
    await expect(page.getByTestId('journey-volumes-stage7-life')).toHaveCount(0);
    await expect(lifeCell(page)).not.toHaveAccessibleName(/Volume/);
    await lifeCell(page).click();
    await expect(page.getByText('My Day in Korean').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Volumes' })).toHaveCount(0);
    await expect(page.getByText('My Favorite Food')).toHaveCount(0);
  });
});
