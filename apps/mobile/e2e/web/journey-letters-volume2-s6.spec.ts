import type { Page } from '@playwright/test';
import { CATALOG, keysFor } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, passDiscover, readStored, seedStoredAll } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-44 S6: the Letters Volume 2 of Stage 6 ("Library Day", content/episodes/stage-6/letters.v2.json)
 * on the release bundle. It ships at launch state: `volumes` at built-in pct 0, so with it off the Letters & Books cell
 * is its Volume 1 alone; each case that opens Volume 2 turns `volumes` on through the stored remote copy, as a ramp
 * would. Its switched formats stay dark too (`game.cloze-pick`, `game.type-hangul-hear` at pct 0), so its first quest
 * plays Realia Read on the library card, Cloze Pick as Listen & Pick with a text prompt on the book cover, and its
 * Dictation Check as Type Hangul see rounds; with `game.cloze-pick` on, the Apply draws the book cover (a CM-47 poster).
 */

const V1 = CATALOG.cells.find((c) => c.episodeId === 'episode:stage6-letters');
const VOLUMES_ON = { volumes: { on: true, pct: 100 } };
const lettersCell = (page: Page) => page.getByRole('button', { name: journeyCellName(6, 'Letters & Books'), exact: true });
const SPLIT: Record<string, string> = { 'ㅘ': 'ㅗㅏ' };

/** A learner with Stage 6 Letters' Volume 1 done, and the switches as given; ends on the Journey. */
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
  const quests = questIds.map((questId) => ({ questId, episodeId: 'episode:stage6-letters', startedAt: AT, completedAt: AT, stars: 3, attempts: 1, accuracy: 1 }));
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

/** Realia Read on the library card: each round by its question, then the right option (a right pick moves on). */
async function readCard(page: Page): Promise<void> {
  for (const [question, option] of [
    ['Whose card is this?', 'hoya'],
    ['How many books can you take home?', 'five'],
    ['What time does it open?', 'nine'],
    ['Which day is it closed?', 'woryoil'],
  ] as const) {
    await expect(page.getByTestId('realia-read-question')).toHaveText(question, { timeout: 5_000 });
    await page.getByTestId(`realia-read-option-${option}`).click();
  }
}

test.describe('Letters Volume 2, Stage 6, at launch state (F-CURR-002 row CM-44 S6)', () => {
  test('volumes off: the Letters cell opens Volume 1 and its page has no volume tabs', async ({ page }) => {
    await learner(page, {});
    await lettersCell(page).click();
    await expect(page.getByText('Read the Menu').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Volumes' })).toHaveCount(0);
    await expect(page.getByText('Library Day')).toHaveCount(0);
  });

  test('320: volumes on, the cell opens Volume 2 and its first quest plays to the reward with every game switch dark', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // 320 x 720, the height of the shipped Dictation smokes (row CM-3A S3), so the prompt shows above the keyboard.
    await page.setViewportSize({ width: 320, height: 720 });
    await learner(page, VOLUMES_ON);
    await expect(lettersCell(page)).toHaveAccessibleName(/Opens Volume 2\.$/);
    await lettersCell(page).click();
    await expect(page.getByText('Library Day').first()).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Volumes' }).getByRole('tab', { name: 'Volume 2' })).toHaveAttribute('aria-selected', 'true');
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cm44-s6-v2-page-320');
    await startFirstQuest(page);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cm44-s6-v2-q1-discover-320');
    await passDiscover(page);
    // Practice: Realia Read on the library card (a ticket sheet).
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByTestId('realia-read-question')).toHaveText('Whose card is this?', { timeout: 5_000 });
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cm44-s6-v2-q1-practice-320');
    await readCard(page);
    // Apply: Cloze Pick, dark, so Listen & Pick with a text prompt on the same rounds (미나, 호야, 읽어요).
    await page.getByRole('button', { name: 'Play minigame' }).click();
    for (const [i, [round, tile]] of ([['a1', 1], ['a2', 2], ['a3', 1]] as const).entries()) {
      await expect(page.getByTestId('listen-pick-text-prompt')).toBeVisible({ timeout: 5_000 });
      const option = page.getByTestId(`listen-pick-option-${round}:t${tile}`);
      await expect(option).toBeVisible({ timeout: 5_000 });
      if (i === 0) {
        await expectNoHorizontalOverflow(page);
        await shot(page, 'cm44-s6-v2-q1-apply-cloze-off-320');
      }
      await page.waitForTimeout(120);
      await option.click();
    }
    // Check: Dictation with game.type-hangul-hear dark, so see rounds: the word shows, no speaker, typed on the keyboard.
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    for (const word of ['도서관', '책']) {
      await expect(page.getByTestId('type-hangul-prompt')).toContainText(word, { timeout: 5_000 });
      await expect(page.getByTestId('dictation-prompt-speaker')).toHaveCount(0);
      // The word card shows above the field (its meaning line runs under the field at 320 px: see the PR's follow-up).
      await expect(page.getByTestId('type-hangul-prompt')).toBeInViewport({ ratio: 0.8 });
      if (word === '도서관') {
        await expectNoHorizontalOverflow(page);
        await shot(page, 'cm44-s6-v2-q1-check-see-320');
      }
      for (const jamo of keysFor(word).flatMap((j) => [...(SPLIT[j] ?? j)])) await page.getByTestId(`hangul-key-${jamo}`).click();
      await page.getByTestId('type-hangul-done').click();
      await expect(page.getByText('You typed it!')).toBeVisible();
    }
    await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    await shot(page, 'cm44-s6-v2-q1-reward-320');
    expect(errors).toEqual([]);
  });

  test('wide: with game.cloze-pick on, the Volume 2 Apply reads the book cover sheet', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 1280, height: 900 });
    await learner(page, { ...VOLUMES_ON, 'game.cloze-pick': { on: true, pct: 100 } });
    await lettersCell(page).click();
    await expect(page.getByText('Library Day').first()).toBeVisible();
    await shot(page, 'cm44-s6-v2-page-wide');
    await startFirstQuest(page);
    await passDiscover(page);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByTestId('realia-read-question')).toHaveText('Whose card is this?', { timeout: 5_000 });
    await shot(page, 'cm44-s6-v2-q1-practice-wide');
    await readCard(page);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    // The book cover's title shows on the sheet beside the first gap.
    await expect(page.getByText('한글 이야기').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('listen-pick-text-prompt')).toHaveCount(0);
    await shot(page, 'cm44-s6-v2-q1-apply-cloze-wide');
    expect(errors).toEqual([]);
  });
});
