import type { Page } from '@playwright/test';
import { CATALOG } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, passDiscover, readStored, seedStoredAll } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-44 S4: the Letters Volume 2 of Stage 4 ("At the Library", content/episodes/stage-4/letters.v2.json)
 * on the release bundle. It ships at launch state: `volumes` at built-in pct 0, so with it off the Letters & Books cell
 * is its Volume 1 alone; each case that opens Volume 2 turns `volumes` on through the stored remote copy, as a ramp
 * would. Its new formats stay dark too (`game.role-play`, `game.story-order` at pct 0), so its first quest plays their
 * fallbacks: Tap to Respond on the Role Play's main path and Story Sequence on the captions, then its Tap to Respond
 * Check; with `game.role-play` on, the Role Play chunk draws the chat at the library desk.
 */

const V1 = CATALOG.cells.find((c) => c.episodeId === 'episode:stage4-letters');
const VOLUMES_ON = { volumes: { on: true, pct: 100 } };
const lettersCell = (page: Page) => page.getByRole('button', { name: journeyCellName(4, 'Letters & Books'), exact: true });

/** A learner with Stage 4 Letters' Volume 1 done, and the switches as given; ends on the Journey. */
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
  const quests = questIds.map((questId) => ({ questId, episodeId: 'episode:stage4-letters', startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
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

test.describe('Letters Volume 2, Stage 4, at launch state (F-CURR-002 row CM-44 S4)', () => {
  test('volumes off: the Letters cell opens Volume 1 and its page has no volume tabs', async ({ page }) => {
    await learner(page, {});
    await lettersCell(page).click();
    await expect(page.getByText('Read Along').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Volumes' })).toHaveCount(0);
    await expect(page.getByText('At the Library')).toHaveCount(0);
  });

  test('320: volumes on, the cell opens Volume 2 and its first quest plays to the reward with every game switch dark', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 320, height: 640 });
    await learner(page, VOLUMES_ON);
    await expect(lettersCell(page)).toHaveAccessibleName(/Opens Volume 2\.$/);
    await lettersCell(page).click();
    await expect(page.getByText('At the Library').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Volumes' }).getByRole('tab', { name: 'Volume 2' })).toHaveAttribute('aria-selected', 'true');
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cm44-s4-v2-page-320');
    await startFirstQuest(page);
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await expect(page.getByText('이 책 빌려 주세요.').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cm44-s4-v2-q1-discover-320');
    await passDiscover(page);
    // Practice: Role Play, dark, so Tap to Respond on its main path (the first natural reply of each turn).
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByText('호야, 안녕하세요!').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cm44-s4-v2-q1-practice-320');
    await replyTurns(page, ['안녕하세요! 이 책 빌려 주세요.', '네, 여기 있어요.', '감사합니다!', '감사합니다!'], 'minigame');
    // Apply: Story Order, dark, so Story Sequence on the same captions.
    await page.getByRole('button', { name: 'Play minigame' }).click();
    for (const id of ['borrow', 'card', 'here', 'book']) await page.getByTestId(`story-sequence-card-${id}`).click();
    await page.getByTestId('story-sequence-skip-replay').or(page.getByTestId('story-sequence-done')).first().click();
    // Check: Tap to Respond, the Dialogue reply pick (two turns).
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cm44-s4-v2-q1-check-320');
    await replyTurns(page, ['네, 여기 있어요.', '감사합니다!'], 'finish');
    await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    await shot(page, 'cm44-s4-v2-q1-reward-320');
    expect(errors).toEqual([]);
  });

  test('wide: with game.role-play on, the Volume 2 Practice is the Role Play chat at the library desk', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 1280, height: 900 });
    await learner(page, { ...VOLUMES_ON, 'game.role-play': { on: true, pct: 100 } });
    await lettersCell(page).click();
    await expect(page.getByText('At the Library').first()).toBeVisible();
    await shot(page, 'cm44-s4-v2-page-wide');
    await startFirstQuest(page);
    await passDiscover(page);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByTestId('role-play-partner-newest')).toContainText('호야, 안녕하세요!');
    await expect(page.getByTestId('role-play-reply-borrow')).toBeVisible();
    await expect(page.getByTestId('role-play-reply-hi')).toBeVisible();
    await shot(page, 'cm44-s4-v2-q1-role-play-wide');
    // The casual hello is less natural with the librarian: it is never sent, and the chat waits for another tap.
    await page.getByTestId('role-play-reply-hi').click();
    await expect(page.getByTestId('role-play-partner-newest')).toContainText('호야, 안녕하세요!');
    await page.waitForTimeout(150);
    await page.getByTestId('role-play-reply-borrow').click();
    await expect(page.getByTestId('role-play-partner-newest')).toContainText('도서관 카드 있어요?');
    expect(errors).toEqual([]);
  });
});
