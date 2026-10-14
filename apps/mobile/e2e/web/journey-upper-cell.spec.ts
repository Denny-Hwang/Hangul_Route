import type { Page } from '@playwright/test';
import { keysFor } from '@hangul-route/content-schema';
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

/**
 * Sentence Builder: build round `n` of `total` by tapping its tiles by accessible name
 * ("<ko>, <romanization>"), past the 50 ms touch window between taps; the built sentence
 * moves on by itself (silent engine).
 */
async function build(page: Page, n: number, total: number, tiles: readonly string[]): Promise<void> {
  await expect(page.getByText(`${n} / ${total}`, { exact: true })).toBeVisible({ timeout: 5_000 });
  const tray = page.getByTestId('sentence-builder-tray');
  for (const name of tiles) {
    await page.waitForTimeout(120);
    await tray.getByRole('button', { name, exact: true }).click();
  }
  await expect(page.getByTestId('sentence-builder-done')).toBeVisible();
}

/** Listen & Pick (not the Check): each round's option by id, round by round. */
async function pickByIds(page: Page, ids: readonly string[]): Promise<void> {
  for (const [i, id] of ids.entries()) {
    const option = page.getByTestId(`listen-pick-option-${id}`);
    await expect(option).toBeVisible();
    await expect(async () => {
      await option.click();
      await expect(option).toHaveAttribute('aria-label', /^Right answer/, { timeout: 250 });
    }).toPass();
    if (i < ids.length - 1) await waitForNextListenPickRound(page);
  }
}

/** Start the episode page's first quest (a soft-prerequisite sheet may ask first) and pass its intro. */
async function startFirstQuest(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** The ids of the Pic-Word board on screen. */
const boardIds = (page: Page): Promise<string[]> =>
  page.locator('[data-testid^="pic-word-picture-"]').evaluateAll((els) => els.map((el) => (el.getAttribute('data-testid') ?? '').replace('pic-word-picture-', '')).sort());

/** Play every Pic-Word board in order: wait for the board (boards advance by themselves), then pair each picture with its word. */
async function playPicWordBoards(page: Page, boards: readonly (readonly string[])[]): Promise<void> {
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const ids of boards) {
    await expect.poll(() => boardIds(page)).toEqual([...ids].sort());
    for (const id of ids) {
      await page.getByTestId(`pic-word-picture-${id}`).click();
      await page.getByTestId(`pic-word-word-${id}`).click();
    }
  }
}

/** Play Card Match: each Korean card (labelled by its romanization), then its meaning. The cards carry a label, not a button role. */
async function playCardMatch(page: Page, pairs: readonly (readonly [romanization: string, meaning: string])[]): Promise<void> {
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const [romanization, meaning] of pairs) {
    await page.getByLabel(`Korean word ${romanization}`, { exact: true }).click();
    await page.getByLabel(`English meaning ${meaning}`, { exact: true }).click();
  }
}

/** Two-key vowels: `keysFor` gives the joined jamo, the in-app keyboard types its two keys (KS X 5002). */
const SPLIT_KEYS: Record<string, string> = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };

/**
 * Type Hangul round `n` of `total`: waits for the round, taps the keys that type `text` on the in-app
 * keyboard, then Done; a typed match moves on by itself.
 */
async function typeHangul(page: Page, n: number, total: number, text: string): Promise<void> {
  await expect(page.getByText(`${n} / ${total}`, { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('type-hangul-done')).toBeDisabled();
  for (const jamo of keysFor(text).flatMap((j) => [...(SPLIT_KEYS[j] ?? j)])) {
    await page.getByTestId(jamo === ' ' ? 'hangul-key-space' : `hangul-key-${jamo}`).click();
  }
  await page.getByTestId('type-hangul-done').click();
  await expect(page.getByText('You typed it!')).toBeVisible();
}

/** Each cell row appends its cell here (S2-1 onward). */
const CELLS: readonly UpperCell[] = [
  // F-CURR-001 S2-3: Playground Words q1, At the Playground, played through its real games.
  {
    episodeId: 'episode:stage2-crafts',
    cellButton: journeyCellName(2, 'Play & Crafts'),
    title: 'Playground Words',
    playFirstQuest: async (page) => {
      await startFirstQuest(page);
      await passDiscover(page);
      await playPicWordBoards(page, [
        ['gong', 'namu', 'haneul'],
        ['gong', 'yeon', 'jajeongeo'],
        ['nonggu', 'chukgu', 'namu'],
        ['jajeongeo', 'gong', 'haneul'],
        ['yeon', 'namu', 'nonggu'],
        ['yagu', 'jajeongeo', 'yeon'],
      ]);
      await playCardMatch(page, [
        ['geune', 'swing'],
        ['mikkeureomteul', 'slide'],
        ['morae', 'sand'],
        ['gong', 'ball'],
      ]);
      // One first-try miss shows the amber nudge, then the ball; the reading round reads 공.
      await playCheckByIds(page, [{ answer: 'sport-ball', missWith: 'kite' }, { answer: 'gong' }]);
      await page.getByRole('button', { name: 'See results' }).click();
      await expect(page.getByText('Next up')).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await page.goto('/');
      await page.getByText('Learning Route', { exact: true }).last().click();
      await page.getByRole('button', { name: /^Stage 2, Words\./ }).click();
      // A shipped, started cell is a button that reads "Playing"; a coming-later cell is no button.
      await expect(page.getByRole('button', { name: /^Play & Crafts: Playground Words\. Playing\.$/ })).toBeVisible();
    },
  },
  // F-CURR-001 S3-1: First Sentences, q1 "It Is a Book" played through its real games.
  {
    episodeId: 'episode:stage3-letters',
    cellButton: journeyCellName(3, 'Letters & Books'),
    title: 'First Sentences',
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      // Discover: the pattern page (frame, two examples, the note) and the sentence page.
      await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
      await shot(page, 'first-sentences-q1-discover-320');
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await build(page, 1, 5, ['네,, ne', '책이에요, chaegieyo']);
      await shot(page, 'first-sentences-q1-built-320');
      // Particle rounds: the noun is given, the ending is picked by its final sound.
      await build(page, 2, 5, ['이에요, ieyo']);
      await build(page, 3, 5, ['예요, yeyo']);
      await build(page, 4, 5, ['네,, ne', '가방이에요, gabangieyo']);
      await build(page, 5, 5, ['이에요, ieyo']);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await pickByIds(page, ['school-bag', 'school-school', 'book', 'school-school']);
      await playCheckByIds(page, [{ answer: 'school-bag' }, { answer: 'a' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await page.goto('/');
      await page.getByText('Learning Route', { exact: true }).last().click();
      await page.getByRole('button', { name: /^Stage 3, Sentences\./ }).click();
      await expect(page.getByRole('button', { name: /^Letters & Books: First Sentences\./ })).toBeVisible();
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
  // F-CURR-001 S7-2: My Day in Korean, q1 "Morning to Evening": Trace a Word (Skip is the
  // learner's own way past it), Type Hangul on the in-app keyboard, the Sentence Builder Check.
  {
    episodeId: 'episode:stage7-life',
    cellButton: journeyCellName(7, 'Food & Daily Life'),
    title: 'My Day in Korean',
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      // Discover: the time words, then the time frame ___에 밥을 먹어요.
      await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
      await shot(page, 'my-day-q1-discover-320');
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expect(page.getByTestId('trace-word-canvas')).toBeVisible();
      await page.getByRole('button', { name: 'Skip', exact: true }).click();
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await typeHangul(page, 1, 4, '아침');
      await shot(page, 'my-day-q1-typed-320');
      await typeHangul(page, 2, 4, '저녁');
      await typeHangul(page, 3, 4, '점심에');
      await typeHangul(page, 4, 4, '아침에 밥을 먹어요');
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      const tray = page.getByTestId('sentence-builder-tray');
      await expect(tray).toBeVisible({ timeout: 5_000 });
      await shot(page, 'my-day-q1-check-320');
      for (const tiles of [
        ['아침에, achime', '밥을, babeul', '먹어요, meogeoyo'],
        ['점심에, jeomsime', '밥을, babeul', '먹어요, meogeoyo'],
      ]) {
        await expect(tray.getByRole('button', { name: tiles[0], exact: true })).toBeVisible({ timeout: 5_000 });
        for (const name of tiles) {
          await page.waitForTimeout(120);
          await tray.getByRole('button', { name, exact: true }).click();
        }
      }
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await page.goto('/');
      await page.getByText('Learning Route', { exact: true }).last().click();
      await page.getByRole('button', { name: /^Stage 7, / }).click();
      await expect(page.getByRole('button', { name: /^Food & Daily Life: My Day in Korean\./ })).toBeVisible();
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
