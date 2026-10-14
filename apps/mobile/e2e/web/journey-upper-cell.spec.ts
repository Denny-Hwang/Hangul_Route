import type { Page } from '@playwright/test';
import { LESSON_EPISODES } from '../../src/content/__generated__/lessons-index';
import { expect, test } from './fixtures';
import { completeChildForm, journeyCellName, keepSidewaysIfAsked, passDiscover, playCheckByIds, waitForNextListenPickRound } from './helpers';
import { shot } from './shots';

/**
 * F-CURR-001 section 5 (row C-2 lands the skeleton; each cell row adds its cell):
 * on the release bundle, offline-capable, a shipped upper-stage lesson cell opens
 * from the Journey grid, one of its quests plays to the reward step, and the
 * Learning Route gains the cell's day. Every cell in the generated lesson index
 * must have an entry here, so a cell cannot ship without its e2e path.
 */

interface UpperCell {
  episodeId: string;
  /** The grid cell's accessible name, e.g. "Stage 2 Words, Holidays & Traditions: ..." (or `journeyCellName`). */
  cellButton: string | RegExp;
  /** The episode page title. */
  title: string;
  /** Plays the first quest from its launcher to the reward step (the cell's games, in order). */
  playFirstQuest: (page: Page) => Promise<void>;
  /** Checks the Learning Route shows the cell's day. */
  expectRouteDay: (page: Page) => Promise<void>;
}

/**
 * Tap to Respond: tap the written reply whose button label starts with `ko` (the label is
 * "<ko>  ·  <romanization>  ·  <gloss>"); a right reply moves to the next turn.
 */
async function reply(page: Page, ko: string): Promise<void> {
  // The accessible name collapses the label's double spaces.
  const option = page.getByRole('button', { name: new RegExp(`^${ko.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · `) });
  await expect(option).toBeVisible();
  await option.click();
}

/** Story Sequence: place the lesson lines in order by card id, then leave the replay. */
async function orderLines(page: Page, ids: readonly string[]): Promise<void> {
  for (const id of ids) await page.getByTestId(`story-sequence-card-${id}`).click();
  await page.getByTestId('story-sequence-skip-replay').or(page.getByTestId('story-sequence-done')).first().click();
}

/** Sentence Builder: tap one round's tiles ("<ko>, <romanization>") in order until it is built. */
async function buildSentence(page: Page, tiles: readonly string[]): Promise<void> {
  const tray = page.getByTestId('sentence-builder-tray');
  for (const name of tiles) {
    // A tap inside the game's touch window is dropped: wait it out before each tile.
    await page.waitForTimeout(120);
    await tray.getByRole('button', { name, exact: true }).click();
  }
  await expect(page.getByTestId('sentence-builder-done')).toBeVisible();
}

/** Listen & Pick: answer each round by option id, the next round awaited by state. */
async function pickByIds(page: Page, ids: readonly string[]): Promise<void> {
  for (const [i, id] of ids.entries()) {
    const option = page.getByTestId(`listen-pick-option-${id}`);
    await expect(async () => {
      await option.click();
      await expect(option).toHaveAttribute('aria-label', /^Right answer/, { timeout: 500 });
    }).toPass();
    if (i + 1 < ids.length) await waitForNextListenPickRound(page);
  }
}

/** Each cell row appends its cell here (S2-1 onward). */
const CELLS: readonly UpperCell[] = [
  // F-CURR-001 S4-1: Read Along, q1 "What Is This?" played through its real games.
  {
    episodeId: 'episode:stage4-letters',
    cellButton: journeyCellName(4, 'Letters & Books'),
    title: 'Read Along',
    playFirstQuest: async (page) => {
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      // Discover: two exchange pages; Read along is offered, never started by itself.
      await expect(page.getByRole('button', { name: 'Read along' })).toBeVisible();
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await reply(page, '책이에요.');
      await reply(page, '친구예요.');
      await reply(page, '가방이에요.');
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await orderLines(page, ['l1', 'l2', 'l3', 'l4']);
      await playCheckByIds(page, [{ answer: 'a' }, { answer: 'a' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await page.goto('/');
      await page.getByText('Learning Route', { exact: true }).last().click();
      await page.getByRole('button', { name: /^Stage 4, Dialogue\./ }).click();
      await expect(page.getByRole('button', { name: /^Letters & Books: Read Along\./ })).toBeVisible();
    },
  },
  // F-CURR-001 S3-3: Festival Sentences, q1 "Grandma and Grandpa" at 320 px: Discover (three pages),
  // Sentence Builder (five rounds), Listen & Pick (four rounds), the two-round Check, the reward.
  {
    episodeId: 'episode:stage3-rites',
    cellButton: journeyCellName(3, 'Holidays & Traditions'),
    title: 'Festival Sentences',
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.getByTestId('episode-quest-quest:stage3-rites-q1').getByRole('button', { name: 'Start' }).click();
      await expect(page.getByText('Family and Festival Food')).toBeVisible();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText('Page 1 of 3')).toBeVisible();
      await shot(page, 's3-3-q1-discover-320');
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expect(page.getByRole('heading', { name: 'Build the sentence' })).toBeVisible();
      await shot(page, 's3-3-q1-sentence-builder-320');
      const rounds = [
        ['송편하고, songpyeonhago', '떡을, tteogeul', '먹어요, meogeoyo'],
        ['할머니하고, halmeonihago', '할아버지가, harabeojiga', '있어요, isseoyo'],
        ['사과하고, sagwahago', '떡을, tteogeul', '먹어요, meogeoyo'],
        ['엄마하고, eommahago', '할머니가, halmeoniga', '있어요, isseoyo'],
        ['송편하고, songpyeonhago', '사과를, sagwareul', '먹어요, meogeoyo'],
      ] as const;
      for (const [i, tiles] of rounds.entries()) {
        await expect(page.getByText(`${i + 1} / ${rounds.length}`, { exact: true })).toBeVisible({ timeout: 5_000 });
        await buildSentence(page, tiles);
        if (i === 0) await shot(page, 's3-3-q1-sentence-built-320');
      }
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await pickByIds(page, ['o1', 'songpyeon', 'o1', 'grandma']);
      await expect(page.getByText('Two quick ones', { exact: true })).toBeVisible();
      await playCheckByIds(page, [{ answer: 'grandpa' }, { answer: 'o1' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
      await shot(page, 's3-3-q1-reward-320');
    },
    expectRouteDay: async (page) => {
      await page.goto('/');
      await page.getByText('Learning Route', { exact: true }).last().click();
      await page.getByRole('button', { name: /^Stage 3, Sentences\./ }).click();
      await expect(page.getByRole('button', { name: /^Holidays & Traditions: Festival Sentences\./ })).toBeVisible();
    },
  },
];

async function openJourney(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

test.describe('upper-stage lesson cells (F-CURR-001)', () => {
  test('every shipped lesson cell has an e2e entry', () => {
    expect(CELLS.map((c) => c.episodeId).sort()).toEqual(LESSON_EPISODES.map((e) => e.id).sort());
  });

  for (const cell of CELLS) {
    test(`${cell.episodeId}: opens from the grid, a quest plays to its reward, the Learning Route day appears`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await openJourney(page);
      await page.getByRole('button', { name: cell.cellButton, exact: true }).click();
      await expect(page.getByText(cell.title).first()).toBeVisible();
      await cell.playFirstQuest(page);
      await cell.expectRouteDay(page);
      expect(errors).toEqual([]);
    });
  }
});
