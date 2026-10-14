import type { Page } from '@playwright/test';
import { LESSON_EPISODES } from '../../src/content/__generated__/lessons-index';
import { expect, test } from './fixtures';
import { answerCheckRounds, completeChildForm, keepSidewaysIfAsked } from './helpers';
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
  /** The grid cell's accessible name, e.g. "Stage 2 Words, Holidays & Traditions: ...". */
  cellButton: string;
  /** The episode page title. */
  title: string;
  /** Plays the first quest from its launcher to the reward step (the cell's games, in order). */
  playFirstQuest: (page: Page) => Promise<void>;
  /** Checks the Learning Route shows the cell's day. */
  expectRouteDay: (page: Page) => Promise<void>;
}

/** Taps the reply whose accessible name starts with this Korean line ("좋아!  ·  joa  ·  ..."). */
async function reply(page: Page, ko: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${ko.replace(/[?!.]/g, '\\$&')}\\s+·`) }).click();
}

/** Opens the Learning Route from the Journey and checks the stage row lists the cell as open. */
async function expectRouteCell(page: Page, stageRow: RegExp, cellRow: RegExp): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByTestId('journey-my-route').click();
  await page.getByRole('button', { name: stageRow }).click();
  await expect(page.getByRole('button', { name: cellRow })).toBeVisible();
}

/** Each cell row appends its cell here (S2-1 onward). */
const CELLS: readonly UpperCell[] = [
  {
    // F-CURR-001 S4-4: Playdate Talk q1 at 320 px: Discover (two exchange pages, speakers named),
    // Tap to Respond (three turns), Story Sequence (three lines), the two-round Check, the reward.
    episodeId: 'episode:stage4-crafts',
    cellButton: 'Stage 4 Dialogue, Play & Crafts: lesson',
    title: 'Playdate Talk',
    playFirstQuest: async (page) => {
      await page.getByTestId('episode-quest-quest:stage4-crafts-q1').getByRole('button', { name: 'Start' }).click();
      await expect(page.getByText('Time to Play')).toBeVisible();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText('Page 1 of 2')).toBeVisible();
      await expect(page.getByRole('button', { name: "Hear it. Mina: 같이 놀자!, gachi nolja, let's play together!" })).toBeVisible();
      await shot(page, 's4-4-q1-discover-320');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText('Page 2 of 2')).toBeVisible();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expect(page.getByText('Choose your reply')).toBeVisible();
      await shot(page, 's4-4-q1-tap-respond-320');
      const turns = ['좋아!', '윷놀이 하자!', '좋아!'];
      for (const [i, line] of turns.entries()) {
        await expect(page.getByText(`${i + 1} / ${turns.length}`, { exact: true })).toBeVisible();
        // A tap inside the game's double-touch window is dropped: tap again until the turn moves on.
        const after = i + 1 < turns.length ? page.getByText(`${i + 2} / ${turns.length}`, { exact: true }) : page.getByRole('button', { name: 'Play minigame' });
        await expect(async () => {
          await reply(page, line);
          await expect(after).toBeVisible({ timeout: 1500 });
        }).toPass();
      }
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expect(page.getByText('Put the story in order')).toBeVisible();
      await shot(page, 's4-4-q1-sequence-320');
      for (const [i, id] of ['l1', 'l2', 'l3'].entries()) {
        await expect(async () => {
          await page.getByTestId(`story-sequence-card-${id}`).click();
          await expect(page.getByText(`${i + 1} / 3`, { exact: true })).toBeVisible({ timeout: 1500 });
        }).toPass();
      }
      // The ordered lines replay one by one; the learner may skip the replay.
      await expect(page.getByText('The story, in order')).toBeVisible();
      await page.getByRole('button', { name: 'Skip replay' }).click();
      await expect(page.getByText('Two quick ones')).toBeVisible();
      await page.getByRole('button', { name: 'Go' }).click();
      await answerCheckRounds(page);
      await page.getByRole('button', { name: 'See results' }).click();
      await expect(page.getByRole('button', { name: 'Back home' })).toBeVisible();
      await shot(page, 's4-4-q1-reward-320');
      await page.getByRole('button', { name: 'Back home' }).click();
    },
    expectRouteDay: (page) => expectRouteCell(page, /^Stage 4, Dialogue\./, /^Play & Crafts: Playdate Talk\./),
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
      await page.setViewportSize({ width: 320, height: 640 });
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
