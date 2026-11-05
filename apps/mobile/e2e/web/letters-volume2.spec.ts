import type { Page } from '@playwright/test';
import { CATALOG } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStoredAll } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-44 S2: Letters & Books Volume 2, Final Letters and Families, played from the Journey at 320 px and
 * wide. The cell's Volume 2 shows only while `volumes` is on (built-in pct 0, so it ships dark); each case turns it on
 * through the stored remote copy, as a ramp would, with Volume 1 (Word Builder) done so the cell opens Volume 2. Runs on
 * the release bundle (`build:web`).
 */

const LETTERS_V1 = CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-letters');
const V2 = LETTERS_V1?.volumes?.find((v) => v.episodeId === 'episode:stage2-letters-v2');
const lettersCell = (page: Page) => page.getByRole('button', { name: /^Stage 2 [^,]+, Letters & Books/ });
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
  const questIds = LETTERS_V1?.questIds ?? [];
  const quests = questIds.map((questId) => ({ questId, episodeId: 'episode:stage2-letters', startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
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

test.describe('Letters & Books Volume 2, Final Letters and Families (F-CURR-002 CM-44 S2)', () => {
  test('the catalogue ships it: three quests on its own episode, after Word Builder', () => {
    expect(V2?.title).toBe('Final Letters and Families');
    expect(V2?.questIds).toEqual(['quest:stage2-letters-v2-q1', 'quest:stage2-letters-v2-q2', 'quest:stage2-letters-v2-q3']);
  });

  for (const [label, size] of [
    ['320', { width: 320, height: 640 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    test(`${label}: the cell opens Volume 2, its page lists the three quests, and quest 1 opens on the final sounds`, async ({ page }) => {
      await page.setViewportSize(size);
      await learner(page, { volumes: { on: true, pct: 100 } });
      await lettersCell(page).scrollIntoViewIfNeeded();
      await lettersCell(page).click();
      await expect(page.getByText('Final Letters and Families').first()).toBeVisible();
      for (const title of ['Seven Final Sounds', 'School Words', 'Sounds That Move']) await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
      expect(await page.locator('body').innerText()).not.toMatch(SHAME);
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `cm44-s2-letters-v2-page-${label}`);
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      const anyway = page.getByRole('button', { name: 'Play anyway' });
      await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
      if (await anyway.isVisible()) await anyway.click();
      await expect(page.getByText('A bottom letter is said as one of just seven sounds. Let us hear them all!')).toBeVisible();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText('손', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Hear it. 손, son, hand' })).toBeVisible();
      if (label === '320') await expectNoHorizontalOverflow(page);
      await shot(page, `cm44-s2-letters-v2-discover-${label}`);
    });
  }

  test('volumes off (its launch state): the cell opens Word Builder and shows no Volume 2', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await learner(page, {});
    await lettersCell(page).click();
    await expect(page.getByText('Word Builder', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Final Letters and Families')).toHaveCount(0);
  });
});
