import type { Page } from '@playwright/test';
import { LESSON_EPISODES } from '../../src/content/__generated__/lessons-index';
import { expect, test } from './fixtures';
import { completeChildForm, journeyCellName, keepSidewaysIfAsked, passDiscover, playCheckByIds } from './helpers';

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

/** Sentence Builder: tap a tray tile by its accessible name ("Korean, romanization"), past the game's touch window. */
async function placeTile(page: Page, name: string): Promise<void> {
  const tile = page.getByTestId('sentence-builder-tray').getByRole('button', { name, exact: true });
  await expect(tile).toBeVisible();
  await page.waitForTimeout(120);
  await tile.click();
}

/** Sentence Builder: build each round in order (its tiles, or its one particle choice), waiting for the round's count. */
async function buildSentences(page: Page, rounds: readonly (readonly string[])[]): Promise<void> {
  for (const [i, tiles] of rounds.entries()) {
    await expect(page.getByText(`${i + 1} / ${rounds.length}`, { exact: true })).toBeVisible({ timeout: 5_000 });
    for (const name of tiles) await placeTile(page, name);
    await expect(page.getByTestId('sentence-builder-done')).toBeVisible();
  }
}

/** Pic-Word Match on whole sentences: each board's pairs by id (picture, then its sentence); a board ends by itself. */
async function matchBoards(page: Page, boards: number, ids: readonly string[]): Promise<void> {
  for (let b = 0; b < boards; b += 1) {
    if (b > 0) await expect(page.getByTestId(`pic-word-word-${ids[0]}`)).not.toHaveAttribute('aria-label', /^Matched/, { timeout: 5_000 });
    for (const id of ids) {
      const word = page.getByTestId(`pic-word-word-${id}`);
      await expect(async () => {
        await page.getByTestId(`pic-word-picture-${id}`).click();
        await word.click();
        await expect(word).toHaveAttribute('aria-label', /^Matched/, { timeout: 400 });
      }).toPass();
    }
  }
}

/** Each cell row appends its cell here (S2-1 onward). */
const CELLS: readonly UpperCell[] = [
  // F-CURR-001 S3-2: Daily Mini-Sentences, q1 "I Eat, I Drink" played through its real games.
  {
    episodeId: 'episode:stage3-life',
    cellButton: journeyCellName(3, 'Food & Daily Life'),
    title: 'Daily Mini-Sentences',
    playFirstQuest: async (page) => {
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      // Discover: the pattern page (its examples) and the drink page; captions are plain UI text.
      await expect(page.getByText('These sentences use the polite style people use most in everyday talk.')).toBeVisible();
      await expect(page.getByText('{ko:', { exact: false })).toHaveCount(0);
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await buildSentences(page, [
        ['밥을, babeul', '먹어요, meogeoyo'],
        ['물을, mureul', '마셔요, masyeoyo'],
        ['사과를, sagwareul', '먹어요, meogeoyo'],
        ['를, reul'],
        ['을, eul'],
      ]);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await matchBoards(page, 4, ['p1', 'p2', 'p3']);
      await playCheckByIds(page, [{ answer: 'o1' }, { answer: 'o1' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await page.goto('/');
      await page.getByText('Learning Route', { exact: true }).last().click();
      await page.getByRole('button', { name: /^Stage 3, Sentences\./ }).click();
      await expect(page.getByRole('button', { name: /^Food & Daily Life: Daily Mini-Sentences\./ })).toBeVisible();
    },
  },
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
