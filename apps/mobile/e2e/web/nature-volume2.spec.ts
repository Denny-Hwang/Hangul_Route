import type { Page } from '@playwright/test';
import { CATALOG } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStoredAll } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-41 S2: Nature & Animals Volume 2, Seasons and Animals, played from the Journey at 320 px and wide.
 * The cell's Volume 2 shows only while `volumes` is on (built-in pct 0, so it ships dark); each case turns it on through
 * the stored remote copy, as a ramp would, with Volume 1 done so the cell opens Volume 2. Runs on the release bundle
 * (`build:web`) and on the fixture bundle alike.
 */

const NATURE_V1 = CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-nature');
const V2 = NATURE_V1?.volumes?.[0];
const natureCell = (page: Page) => page.getByRole('button', { name: /^Stage 2 [^,]+, Nature & Animals/ });
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|score)\b|%/i;

async function learner(page: Page, flags: Record<string, { on: boolean; pct: number }>): Promise<void> {
  const AT = '2026-10-01T10:00:00.000Z';
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  const questIds = NATURE_V1?.questIds ?? [];
  const quests = questIds.map((questId) => ({ questId, episodeId: 'episode:stage2-nature', startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
  await seedStoredAll(page, {
    [`progress:${id}`]: { profileId: id, updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, questDoneAt: Object.fromEntries(questIds.map((q) => [q, AT])) },
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

test.describe('Nature & Animals Volume 2, Seasons and Animals (F-CURR-002 CM-41 S2)', () => {
  test('the catalogue ships it: three quests on its own episode, after Outdoor Words', () => {
    expect(V2?.episodeId).toBe('episode:stage2-nature-v2');
    expect(V2?.title).toBe('Seasons and Animals');
    expect(V2?.questIds).toEqual(['quest:stage2-nature-v2-q1', 'quest:stage2-nature-v2-q2', 'quest:stage2-nature-v2-q3']);
  });

  for (const [label, size] of [
    ['320', { width: 320, height: 640 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    test(`${label}: the cell opens Volume 2, its page lists the three quests, and quest 1 opens on the four seasons`, async ({ page }) => {
      await page.setViewportSize(size);
      await learner(page, { volumes: { on: true, pct: 100 } });
      await natureCell(page).scrollIntoViewIfNeeded();
      await natureCell(page).click();
      await expect(page.getByText('Seasons and Animals').first()).toBeVisible();
      for (const title of ['Four Seasons', 'Find the Seasons', 'Moon Bears and Magpies']) await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
      expect(await page.locator('body').innerText()).not.toMatch(SHAME);
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `nature-volume2-page-${label}`);
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      const anyway = page.getByRole('button', { name: 'Play anyway' });
      await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
      if (await anyway.isVisible()) await anyway.click();
      await expect(page.getByText('Korea has four seasons. Let us read them!')).toBeVisible();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText('봄', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Hear it. 봄, bom, spring' })).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `nature-volume2-discover-${label}`);
    });
  }

  test('volumes off (its launch state): the cell opens Outdoor Words and shows no Volume 2', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await learner(page, {});
    await natureCell(page).click();
    await expect(page.getByText('Outdoor Words', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Seasons and Animals')).toHaveCount(0);
  });
});
