import type { Page } from '@playwright/test';
import { LESSON_EPISODES } from '../../src/content/__generated__/lessons-index';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, passDiscover, playCheckByIds } from './helpers';

/**
 * F-CURR-001 section 5 (row C-2 lands the skeleton; each cell row adds its cell):
 * on the release bundle, offline-capable, a shipped upper-stage lesson cell opens
 * from the Journey grid, one of its quests plays to the reward step, and the
 * Learning Route gains the cell's day. Every cell in the generated lesson index
 * must have an entry here, so a cell cannot ship without its e2e path.
 */

interface UpperCell {
  episodeId: string;
  /**
   * The start of the grid cell's accessible name, e.g. "Stage 2 Words, Holidays & Traditions: lesson" (the
   * heritage-story count after it differs between the release and the story fixture bundles).
   */
  cellButton: string;
  /** The episode page title. */
  title: string;
  /** Plays the first quest from its launcher to the reward step (the cell's games, in order). */
  playFirstQuest: (page: Page) => Promise<void>;
  /** Checks the Learning Route shows the cell's day. */
  expectRouteDay: (page: Page) => Promise<void>;
}

/** Start the first quest of the open episode page; Stage 1 is not done, so the soft-prerequisite sheet may ask. */
async function startFirstQuest(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
}

/** The Learning Route tab: the cell's stage row, opened, lists the cell by its title. */
async function expectCellOnRoute(page: Page, stage: number, title: string): Promise<void> {
  await page.getByRole('tablist').getByRole('link', { name: 'Learning Route' }).click();
  const row = page.getByTestId(`my-route-stage-${stage}`);
  await expect(row).toBeVisible();
  const cell = row.getByRole('button', { name: new RegExp(`: ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`) }).first();
  if (!(await cell.isVisible())) await row.getByRole('button', { name: new RegExp(`^Stage ${stage}, `) }).first().click();
  await expect(cell).toBeVisible();
}

/** Word Builder q1's Pic-Word boards (content/episodes/stage-2/letters.json), as pair ids in board order. */
const WORD_BUILDER_Q1_BOARDS = [
  ['sae', 'hae', 'namu'],
  ['norae', 'bae', 'byeol'],
  ['mujigae', 'jiugae', 'chaek'],
  ['baegu', 'taeksi', 'bada'],
  ['hayansaek', 'noransaek', 'paransaek'],
  ['sebae', 'dongsaeng', 'galsaek'],
] as const;

/** Each cell row appends its cell here (S2-1 onward). */
const CELLS: readonly UpperCell[] = [
  // F-CURR-001 S2-1: Word Builder. q1 teaches ㅐ ㅔ ㅒ ㅖ; its six Pic-Word boards are played, its Card Match is
  // skipped (the shipped game), and the Check is answered by id: the sun picture, then the written 노래.
  {
    episodeId: 'episode:stage2-letters',
    cellButton: 'Stage 2 Words, Letters & Books: lesson',
    title: 'Word Builder',
    playFirstQuest: async (page) => {
      await startFirstQuest(page);
      await page.getByRole('button', { name: 'Continue' }).click();
      // Discover shows the new vowel ㅐ with its example 개 and the words you can read now.
      await expect(page.getByText('ㅐ', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('개', { exact: true }).first()).toBeVisible();
      await page.screenshot({ path: test.info().outputPath('stage2-letters-q1-discover.png'), fullPage: true });
      await passDiscover(page);
      // Practice: all six Pic-Word boards, each picture drawn art (an svg), never the gloss fallback tile.
      await page.getByRole('button', { name: 'Play minigame' }).click();
      for (const [n, board] of WORD_BUILDER_Q1_BOARDS.entries()) {
        for (const id of board) await expect(page.getByTestId(`pic-word-picture-${id}`).locator('svg').first()).toBeVisible();
        if (n === 0) await page.screenshot({ path: test.info().outputPath('stage2-letters-q1-pic-word.png'), fullPage: true });
        for (const id of board) {
          await page.getByTestId(`pic-word-picture-${id}`).click();
          await page.getByTestId(`pic-word-word-${id}`).click();
        }
      }
      // Apply (the shipped Card Match) is skipped; the Check is answered by id.
      await page.getByRole('button', { name: 'Skip for now' }).click();
      await playCheckByIds(page, [{ answer: 'hae' }, { answer: 'norae' }]);
      await page.getByRole('button', { name: 'See results' }).click();
      await expect(page.getByText('Next up')).toBeVisible();
      await page.screenshot({ path: test.info().outputPath('stage2-letters-q1-results.png'), fullPage: true });
    },
    expectRouteDay: async (page) => {
      await page.context().setOffline(false);
      await page.goto('/');
      await expectCellOnRoute(page, 2, 'Word Builder');
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
      // Section 3.14 layout: the narrowest phone (320 px); the screenshots are the PR's 320 px evidence.
      await page.setViewportSize({ width: 320, height: 720 });
      await openJourney(page);
      // Section 3.14: all lesson content is in the bundle, so the cell opens and plays with no network.
      await page.context().setOffline(true);
      await page.getByRole('button', { name: cell.cellButton }).click();
      await expect(page.getByText(cell.title).first()).toBeVisible();
      await cell.playFirstQuest(page);
      await cell.expectRouteDay(page);
      expect(errors).toEqual([]);
    });
  }
});
