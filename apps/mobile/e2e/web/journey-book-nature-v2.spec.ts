import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, seedStoredAll } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 §5.5 S5, row CM-46: the Stage 5 Nature cell's book 2 (`episode:stage5-nature-v2`) on the release
 * bundle. It is a later volume (row CM-40): `volumes` is at built-in pct 0, so with it off the cell is its book 1
 * alone and the three new tales are nowhere (not in the cell, not on the Library shelf); each case that needs it on
 * turns it on through the stored remote copy, as a ramp would.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const GATED_BUILD = process.env.E2E_CONTENT_GATING === '1';
const VOLUMES_ON = { volumes: { on: true, pct: 100 } };
const TALES = ['story:jeju-volcanic-island', 'story:jirisan-national-park', 'story:suncheon-bay-wetland'];
const natureCell = (page: Page) => page.getByRole('button', { name: /^Stage 5 [^,]+, Nature & Animals/ });

async function openJourney(page: Page, flags: Record<string, { on: boolean; pct: number }>): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await seedStoredAll(page, { 'remote-config': { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags } });
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

test.describe('the Stage 5 Nature book 2 (regular build, F-CURR-002 CM-46)', () => {
  test.skip(FIXTURE_BUILD, 'the fixture bundle owns its own cells: see journey-stories.spec.ts');
  test.skip(GATED_BUILD, 'a free-plan build shows the book preview path: see episode-access.spec.ts');

  test('320 with volumes on: Vol 2 on the cell page is the book of the three tales, with no sideways scroll', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 320, height: 800 });
    await openJourney(page, VOLUMES_ON);
    // The cell shows its two volumes once the stored remote copy is read.
    await expect(page.getByTestId('journey-volumes-stage5-nature')).toHaveCount(1);
    // Stage 2 Holidays & Traditions ships its Volume 2 (CM-45 S2), so its cell has the dots too.
    await expect(page.getByTestId('journey-volumes-stage2-rites')).toHaveCount(1);
    await natureCell(page).scrollIntoViewIfNeeded();
    await expectNoHorizontalOverflow(page, 'the Journey with the Nature volume dots at 320');
    await natureCell(page).click();
    const tabs = page.getByRole('tablist', { name: 'Volumes' });
    await tabs.getByRole('tab', { name: 'Volume 2' }).click();
    await expect(page.getByTestId('story-episode-title')).toHaveText('Island, Mountain and Wetland');
    for (const id of TALES) await expect(page.getByTestId(`story-episode-row-${id}`)).toBeVisible();
    await expectNoHorizontalOverflow(page, 'the Nature book 2 at 320');
    await shot(page, 'nature-book2-320');
    expect(errors).toEqual([]);
  });

  test('volumes off: the cell has no volume tabs and the tales are on no shelf', async ({ page }) => {
    await openJourney(page, {});
    await expect(page.getByTestId('journey-volumes-stage5-nature')).toHaveCount(0);
    await natureCell(page).click();
    await expect(page.getByTestId('story-episode-title')).toHaveText('Nature Tales');
    await expect(page.getByRole('tablist', { name: 'Volumes' })).toHaveCount(0);
    for (const id of TALES) await expect(page.getByTestId(`story-episode-row-${id}`)).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await page.getByText('Library', { exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Heritage Library' })).toBeVisible();
    await page.getByRole('tab', { name: 'Culture', exact: true }).click();
    for (const id of TALES) await expect(page.getByTestId(`story-tile-${id}`)).toHaveCount(0);
  });
});
