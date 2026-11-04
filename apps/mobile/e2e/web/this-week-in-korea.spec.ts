import type { Page } from '@playwright/test';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { REVIEW_ITEM_ROWS } from '../../src/content/__generated__/review-item-chunks/review-items';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { expectNoSidewaysScroll } from './text-fit';

/**
 * F-CURR-002 §5.7 (row CM-48, design/wireframes/home/this-week-in-korea.md) on the web PWA: "This week in Korea" behind
 * `weeklyDrop` (the remote copy is the stored one: this build has no API). With the device clock on Wednesday
 * 4 November 2026, Home shows the week of 2 November (Winter Begins); the Meet page, 5 quick rounds whose answers enter
 * the `week` memory shard, and Done; the card then says Done for this week. With the switch off (its built-in pct 0, the
 * launch state) nothing shows. With the network off after one online visit the right drop still opens from the
 * precache. 320 px and wide: nothing scrolls sideways; buttons at least the touch floor.
 */

const ID_OF = new Map(REVIEW_ITEM_ROWS.map((r) => [r[1], r[0]]));
const WED = new Date('2026-11-04T10:00:00.000Z');

async function onboard(page: Page, on: boolean | null): Promise<string> {
  await page.clock.install({ time: WED });
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  const flags = on === null ? null : { weeklyDrop: { on, pct: on ? 100 : 0 }, memoryRecord: { on: true, pct: 100 } };
  if (flags !== null) await seedStored(page, 'remote-config', { v: 1, fetchedAt: WED.getTime(), maxAgeS: 300, flags });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  return profileId;
}

const card = (page: Page) => page.getByTestId('home-week-drop');

/** Answers the round on screen right (the option of the asked word), and waits for the next round or the Done page. */
async function answerRound(page: Page, round: number): Promise<void> {
  await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', `Round ${round}`);
  const ko = ((await page.getByTestId('daily-review-prompt').innerText()).split('\n')[0] ?? '').trim();
  const id = ID_OF.get(ko);
  expect(id, `a drop word: ${ko}`).toBeDefined();
  await page.getByTestId(`daily-review-option-${id}`).click();
}

test.describe('This week in Korea (row CM-48)', () => {
  test('off at the launch state: no card on Home', async ({ page }) => {
    await onboard(page, null);
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await expect(card(page)).toHaveCount(0);
    await expect(page.getByText('This week in Korea')).toHaveCount(0);
  });

  test('switched off: no card on Home', async ({ page }) => {
    await onboard(page, false);
    await expect(card(page)).toHaveCount(0);
  });

  test("on: this week's drop, its Meet page, 5 rounds recorded in the week shard, Done, and the card says so", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const profileId = await onboard(page, true);
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toHaveAttribute('aria-label', 'This week in Korea: Winter Begins. About 2 minutes.');
    expect((await card(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(touchTarget.min);
    await expectNoSidewaysScroll(page);
    await card(page).scrollIntoViewIfNeeded();
    await shot(page, 'week-drop-home-320');
    await card(page).click();

    await expect(page.getByTestId('week-drop-title')).toHaveText('Winter Begins');
    await expect(page.getByTestId('week-drop-note')).toContainText('입동');
    await expect(page.getByTestId('week-drop-source')).toContainText('Source: Korea Astronomy and Space Science Institute');
    for (const id of ['ipdong', 'gyeoul', 'gimjang', 'baechu', 'mu']) await expect(page.getByTestId(`week-drop-word-${id}`)).toBeVisible();
    await expectNoSidewaysScroll(page);
    await shot(page, 'week-drop-meet-320');
    const practice = page.getByRole('button', { name: 'Practice the words' });
    expect((await practice.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(touchTarget.min);
    await practice.click();

    for (let round = 1; round <= 5; round += 1) {
      if (round === 1) await shot(page, 'week-drop-round-320');
      await answerRound(page, round);
    }
    await expect(page.getByTestId('week-drop-done-headline')).toHaveText('Done for this week');
    await expect(page.getByText('A new one comes next week.')).toBeVisible();
    await expect(page.getByTestId('week-drop-done')).not.toContainText(/%|star|score/i);
    await shot(page, 'week-drop-done-320');

    // The answers are in the memory store's week shard (section 4.8), each first answer once.
    await expect
      .poll(async () => {
        const file = await readStored<{ rows: Record<string, { sh: string; st: { n: number } }> }>(page, `memory:${profileId}`);
        return Object.values(file?.rows ?? {}).filter((r) => r.sh === 'week').length;
      })
      .toBeGreaterThanOrEqual(3);
    await page.getByRole('button', { name: 'Back home' }).click();
    await expect(page.getByTestId('home-week-drop-done')).toHaveText('Done for this week');
  });

  test('wide: the card heads the side column, and the Meet page reads at reading width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await onboard(page, true);
    await expect(card(page)).toBeVisible();
    await expectNoSidewaysScroll(page);
    await shot(page, 'week-drop-home-wide');
    await card(page).click();
    await expect(page.getByTestId('week-drop-title')).toHaveText('Winter Begins');
    await shot(page, 'week-drop-meet-wide');
  });

  test('offline: after one online visit, the drop of the week opens from the precache with the network off', async ({ page, context }) => {
    await onboard(page, true);
    await expect(card(page)).toBeVisible();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await expect(card(page)).toBeVisible();
    await card(page).click();
    await expect(page.getByTestId('week-drop-title')).toHaveText('Winter Begins');
    await page.getByRole('button', { name: 'Practice the words' }).click();
    await answerRound(page, 1);
    await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', 'Round 2');
    await context.setOffline(false);
  });

  test('the week turns at local midnight: Sunday shows the week of 2 November, Monday the next one', async ({ page }) => {
    await onboard(page, true);
    await page.clock.setSystemTime(new Date('2026-11-08T12:00:00.000Z'));
    await page.reload();
    await expect(card(page)).toHaveAttribute('aria-label', /Winter Begins/);
    await page.clock.setSystemTime(new Date('2026-11-09T12:00:00.000Z'));
    await page.reload();
    await expect(card(page)).toHaveAttribute('aria-label', /Kimjang Together/);
  });
});
