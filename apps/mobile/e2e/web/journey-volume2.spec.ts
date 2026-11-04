import type { Page } from '@playwright/test';
import { CATALOG } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, passDiscover, readStored, seedStoredAll } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-42 S4: the Play Volume 2 of Stage 4 ("Who Goes First?", content/episodes/stage-4/crafts.v2.json) on
 * the release bundle. It ships at launch state: `volumes` at built-in pct 0, so with it off the Play & Crafts cell is
 * its Volume 1 alone; each case that opens Volume 2 turns `volumes` on through the stored remote copy, as a ramp
 * would. Its new formats stay dark too (`game.role-play`, `game.story-order`, `game.cloze-pick` at pct 0), so its first
 * quest plays their fallbacks: Tap to Respond on the Role Play's main path, Story Sequence on the captions, and Listen &
 * Pick with a text prompt; with `game.role-play` on, the Role Play chunk draws the chat.
 */

const V1 = CATALOG.cells.find((c) => c.episodeId === 'episode:stage4-crafts');
const VOLUMES_ON = { volumes: { on: true, pct: 100 } };
const playCell = (page: Page) => page.getByRole('button', { name: journeyCellName(4, 'Play & Crafts'), exact: true });

/** A learner with Stage 4 Play's Volume 1 done, and the switches as given; ends on the Journey. */
async function learner(page: Page, flags: Record<string, { on: boolean; pct: number }>): Promise<void> {
  const AT = '2026-10-01T10:00:00.000Z';
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  const questIds = V1?.questIds ?? [];
  const quests = questIds.map((questId) => ({ questId, episodeId: 'episode:stage4-crafts', startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
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

/** Start the page's first quest (a soft-prerequisite sheet may ask first) and pass its intro. */
async function startFirstQuest(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await expect(headerClose(page)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Tap to Respond: the written reply whose label starts with `ko`, while turn `n` of `total` shows, until the next shows. */
async function replyTurns(page: Page, turns: readonly string[], last: 'minigame' | 'finish'): Promise<void> {
  for (const [i, ko] of turns.entries()) {
    const current = page.getByText(`${i + 1} / ${turns.length}`, { exact: true });
    await expect(current).toBeVisible({ timeout: 5_000 });
    const after =
      i + 1 < turns.length
        ? page.getByText(`${i + 2} / ${turns.length}`, { exact: true })
        : last === 'minigame'
          ? page.getByRole('button', { name: 'Play minigame' })
          : page.getByText('Finish', { exact: true }).first();
    const option = page.getByRole('button', { name: new RegExp(`^${ko.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · `) });
    await expect(async () => {
      if (await after.isVisible()) return;
      await page.waitForTimeout(120);
      if ((await current.isVisible()) && !(await after.isVisible())) await option.click();
      await expect(after).toBeVisible({ timeout: 1500 });
    }).toPass();
  }
}

test.describe('Play Volume 2, Stage 4, at launch state (F-CURR-002 row CM-42 S4)', () => {
  test('volumes off: the Play cell opens Volume 1 and its page has no volume tabs', async ({ page }) => {
    await learner(page, {});
    await playCell(page).click();
    await expect(page.getByText('Playdate Talk').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Volumes' })).toHaveCount(0);
    await expect(page.getByText('Who Goes First?')).toHaveCount(0);
  });

  test('320: volumes on, the cell opens Volume 2 and its first quest plays to the reward with every game switch dark', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 320, height: 640 });
    await learner(page, VOLUMES_ON);
    await expect(playCell(page)).toHaveAccessibleName(/Opens Volume 2\.$/);
    await playCell(page).click();
    await expect(page.getByText('Who Goes First?').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Volumes' }).getByRole('tab', { name: 'Volume 2' })).toHaveAttribute('aria-selected', 'true');
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cm42-s4-v2-page-320');
    await startFirstQuest(page);
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await expect(page.getByText('같이 놀래?').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cm42-s4-v2-q1-discover-320');
    await passDiscover(page);
    // Practice: Role Play, dark, so Tap to Respond on its main path (the first natural reply of each turn).
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByText('같이 놀래?').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cm42-s4-v2-q1-practice-320');
    await replyTurns(page, ['응, 좋아!', '숨바꼭질 하자!', '좋아!', '좋아! 같이 가자!'], 'minigame');
    // Apply: Story Order, dark, so Story Sequence on the same captions.
    await page.getByRole('button', { name: 'Play minigame' }).click();
    for (const id of ['ask', 'what', 'hide', 'go']) await page.getByTestId(`story-sequence-card-${id}`).click();
    await page.getByTestId('story-sequence-skip-replay').or(page.getByTestId('story-sequence-done')).first().click();
    // Check: Cloze Pick, dark, so Listen & Pick with the sentence as its text prompt.
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    for (const [round, tile] of [['c1', 0], ['c2', 2]] as const) {
      await expect(page.getByTestId('listen-pick-text-prompt')).toBeVisible({ timeout: 5_000 });
      const option = page.getByTestId(`listen-pick-option-${round}:t${tile}`);
      await expect(option).toBeVisible({ timeout: 5_000 });
      if (round === 'c1') await shot(page, 'cm42-s4-v2-q1-check-320');
      await page.waitForTimeout(120);
      await option.click();
    }
    await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    await shot(page, 'cm42-s4-v2-q1-reward-320');
    expect(errors).toEqual([]);
  });

  test('wide: with game.role-play on, the Volume 2 Practice is the Role Play chat with its reply bubbles', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 1280, height: 900 });
    await learner(page, { ...VOLUMES_ON, 'game.role-play': { on: true, pct: 100 } });
    await playCell(page).click();
    await expect(page.getByText('Who Goes First?').first()).toBeVisible();
    await shot(page, 'cm42-s4-v2-page-wide');
    await startFirstQuest(page);
    await passDiscover(page);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByTestId('role-play-partner-newest')).toContainText('같이 놀래?');
    await expect(page.getByTestId('role-play-reply-yes')).toBeVisible();
    await expect(page.getByTestId('role-play-reply-polite')).toBeVisible();
    await shot(page, 'cm42-s4-v2-q1-role-play-wide');
    // The polite reply is less natural with a close friend: it is never sent, and the chat waits for another tap.
    await page.getByTestId('role-play-reply-polite').click();
    await expect(page.getByTestId('role-play-partner-newest')).toContainText('같이 놀래?');
    await page.waitForTimeout(150);
    await page.getByTestId('role-play-reply-yes').click();
    await expect(page.getByTestId('role-play-partner-newest')).toContainText('뭐 할래?');
    expect(errors).toEqual([]);
  });
});
