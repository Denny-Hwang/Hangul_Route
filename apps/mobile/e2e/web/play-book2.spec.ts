import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, seedStoredAll } from './helpers';
import { shot } from './shots';
import { expectTextFits } from './text-fit';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 §5.6 S5, row CM-46: the Play cell's book 2 (Masks and Paper) on the release bundle. It is Volume 2 content
 * behind `volumes` (built-in pct 0), so the row merges dark: with the switch off the Stage 5 Play cell is its book 1
 * alone, and with it on (the stored remote copy, as a ramp would set it) the cell page offers Vol 1 / Vol 2 and book 2
 * lists its two tales. At 320 px nothing overflows.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const GATED_BUILD = process.env.E2E_CONTENT_GATING === '1';
const PLAY_CELL = /^Stage 5 [^,]+, Play & Crafts/;

async function openPlayCell(page: Page, volumes: boolean, textSize?: 'largest'): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  if (volumes) {
    await seedStoredAll(page, {
      'remote-config': { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { volumes: { on: true, pct: 100 } } },
      ...(textSize ? { 'device:settings': { uiLocale: 'en', textSize, uiLocaleAt: '2026-10-16T09:00:00.000Z' } } : {}),
    });
    await page.reload();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
  }
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
  const cell = page.getByRole('button', { name: PLAY_CELL });
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
}

test.describe('the Play book 2 (release build, F-CURR-002 CM-46)', () => {
  test.skip(FIXTURE_BUILD, 'the fixture bundle owns its own cells: see journey-stories.spec.ts');
  test.skip(GATED_BUILD, 'a free-plan build shows the book preview path: see episode-access.spec.ts');

  test('320: with volumes off the cell is book 1 alone; no Vol tabs, no Masks and Paper', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openPlayCell(page, false);
    await expect(page.getByTestId('story-episode-title')).toHaveText('Craft Stories');
    await expect(page.getByRole('tablist', { name: 'Volumes' })).toHaveCount(0);
    await expect(page.getByText('Masks and Paper')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test('320: with volumes on, Vol 2 is Masks and Paper with its two tales', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 320, height: 800 });
    await openPlayCell(page, true);
    const tabs = page.getByRole('tablist', { name: 'Volumes' });
    await tabs.getByRole('tab', { name: 'Volume 2' }).click();
    await expect(page.getByTestId('story-episode-title')).toHaveText('Masks and Paper');
    for (const id of ['story:hahoe-mask-dance', 'story:hanji-korean-paper']) {
      await expect(page.getByTestId(`story-episode-row-${id}`)).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
    await shot(page, 'play-book2-320');
    expect(errors).toEqual([]);
  });

  test('320 x 568 at the Largest text size: book 2 and its two tales fit, with no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openPlayCell(page, true, 'largest');
    await page.getByRole('tablist', { name: 'Volumes' }).getByRole('tab', { name: 'Volume 2' }).click();
    await expect(page.getByTestId('story-episode-title')).toHaveText('Masks and Paper');
    for (const id of ['story:hahoe-mask-dance', 'story:hanji-korean-paper']) {
      await page.getByTestId(`story-episode-row-${id}`).scrollIntoViewIfNeeded();
      await expect(page.getByTestId(`story-episode-row-${id}`)).toBeVisible();
    }
    await expectTextFits(page, 'the Play book 2 at Largest');
  });
});
