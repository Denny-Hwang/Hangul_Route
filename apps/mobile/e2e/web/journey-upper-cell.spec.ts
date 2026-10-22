import type { Page } from '@playwright/test';
import { keysFor, type ThemeKey } from '@hangul-route/content-schema';
import { LESSON_EPISODES } from '../../src/content/__generated__/lessons-index';
import { strokesForJamo } from '../../src/content/jamo-strokes';
import { placeWordStrokes } from '../../src/logic/trace-word/block-strokes';
import { expect, test } from './fixtures';
import { completeChildForm, journeyCellName, keepSidewaysIfAsked, openGrownUpZone, passDiscover, playCheckByIds, readStored, unlockWithPin, waitForNextListenPickRound, headerClose } from './helpers';
import { shot } from './shots';

/**
 * F-CURR-001 section 5 (row C-2 lands the skeleton): on the release bundle, offline-capable, a shipped
 * upper-stage lesson cell opens from the Journey grid, its first quest plays, and the Learning Route
 * gains the cell's day. Since F-CURR-002 row CM-6 the cell list is the generated lesson manifest
 * (`LESSON_EPISODES`; the Topic Pack levels join it with row CM-50a), so a cell gets its e2e path from
 * its own content file and a content PR never edits this spec. A cell with a deep play below plays its
 * first quest through its real games to the reward step; any other cell opens its first quest and
 * finds its day on the Learning Route. The stage trail is on the grown-up's
 * read-only Learning Route page since the owner decision of 2026-10-17 (the learner's Route tab lists the next
 * lessons), so the day is read there (`openRouteMap`), where a lesson group is a labelled row rather than a button.
 */

/** A deep play of one cell, by hand: its first quest through its real games, and where its day shows. */
interface CellPlay {
  /** Plays the first quest from its launcher to the reward step (the cell's games, in order). */
  playFirstQuest: (page: Page) => Promise<void>;
  /** Checks the Learning Route shows the cell's day. */
  expectRouteDay: (page: Page) => Promise<void>;
}

interface UpperCell extends CellPlay {
  episodeId: string;
  /** The grid cell's accessible name, e.g. "Stage 2 Words, Holidays & Traditions: ..." (`journeyCellName`). */
  cellButton: RegExp;
  /** The episode page title. */
  title: string;
}

/** The grid's theme column names (en), by theme key. */
const THEME_LABEL: Readonly<Record<ThemeKey, string>> = {
  letters: 'Letters & Books',
  life: 'Food & Daily Life',
  rites: 'Holidays & Traditions',
  nature: 'Nature & Animals',
  crafts: 'Play & Crafts',
};

/** Shifted letters on the in-app keyboard and the joined vowels it types with two keys (KS X 5002). */
const SHIFTED: Record<string, string> = { 'ㅃ': 'ㅂ', 'ㅉ': 'ㅈ', 'ㄸ': 'ㄷ', 'ㄲ': 'ㄱ', 'ㅆ': 'ㅅ', 'ㅒ': 'ㅐ', 'ㅖ': 'ㅔ' };
const SPLIT: Record<string, string> = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };
/** The same two-key vowels, by the name the Stage 7 helpers use. */
const SPLIT_KEYS: Record<string, string> = SPLIT;


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

/** Sentence Builder Check: place the tiles of the round in order, by accessible name. */
async function placeTiles(page: Page, tiles: readonly string[]): Promise<void> {
  const tray = page.getByTestId('sentence-builder-tray');
  await expect(tray).toBeVisible({ timeout: 5_000 });
  for (const name of tiles) {
    await page.waitForTimeout(120);
    await tray.getByRole('button', { name, exact: true }).click();
  }
}

/** Type Hangul: tap the keys for each word, then Done; a typed word moves on by itself. */
async function typeWords(page: Page, words: readonly string[]): Promise<void> {
  for (const [i, word] of words.entries()) {
    await expect(page.getByText(`${i + 1} / ${words.length}`)).toBeVisible({ timeout: 5_000 });
    for (const jamo of keysFor(word).flatMap((j) => [...(SPLIT[j] ?? j)])) {
      if (jamo === ' ') await page.getByTestId('hangul-key-space').click();
      else if (SHIFTED[jamo]) {
        await page.getByTestId('hangul-key-shift').click();
        await page.getByTestId(`hangul-key-${SHIFTED[jamo]}`).click();
      } else await page.getByTestId(`hangul-key-${jamo}`).click();
    }
    await page.getByTestId('type-hangul-done').click();
    await expect(page.getByText('You typed it!')).toBeVisible();
  }
}

/** Realia Read: answer each round by option id once its question shows (a right answer moves on by itself). */
async function readRealia(page: Page, rounds: ReadonlyArray<readonly [question: string, optionId: string]>): Promise<void> {
  for (const [question, optionId] of rounds) {
    await expect(page.getByTestId('realia-read-question')).toHaveText(question, { timeout: 5_000 });
    await page.getByTestId(`realia-read-option-${optionId}`).click();
  }
}

/**
 * Trace a Word: trace `word` block by block over its placed ghost (the canvas's 200 viewBox, the
 * same placement the game draws, computed here), one finger stroke per stroke. A fully drawn block
 * is scored by the idle timer or by Done, whichever comes first; the game then moves on by itself.
 */
async function traceWord(page: Page, word: string, romanization: string): Promise<void> {
  const blocks = placeWordStrokes(word, strokesForJamo);
  expect(blocks, word).not.toBeNull();
  await expect(page.getByRole('heading', { name: new RegExp(`^Trace the word ${romanization},`) })).toBeVisible({ timeout: 5_000 });
  for (const [i, block] of blocks!.entries()) {
    const canvas = page.getByTestId('trace-word-canvas');
    await expect(canvas).toHaveAttribute('aria-label', new RegExp(`block ${i + 1} of ${blocks!.length}`));
    const box = (await canvas.boundingBox())!;
    const at = (p: { x: number; y: number }): [number, number] => [box.x + (p.x * box.width) / 200, box.y + (p.y * box.height) / 200];
    for (const stroke of block.letters.flatMap((l) => l.strokes)) {
      await page.mouse.move(...at(stroke[0]!));
      await page.mouse.down();
      for (const point of stroke.slice(1)) await page.mouse.move(...at(point), { steps: 12 });
      await page.mouse.up();
    }
    await page.getByRole('button', { name: 'Done', exact: true }).click({ timeout: 1_500 }).catch(() => undefined);
  }
}

/** Sentence Builder as the Check (S7-4): no round counter; the round's gloss shows, then its tiles by accessible name in order. */
async function buildCheckRound(page: Page, gloss: string, tiles: readonly string[]): Promise<void> {
  await expect(page.getByTestId('sentence-builder-gloss')).toHaveText(gloss, { timeout: 5_000 });
  const tray = page.getByTestId('sentence-builder-tray');
  for (const name of tiles) {
    await page.waitForTimeout(120);
    await tray.getByRole('button', { name, exact: true }).click();
  }
}

/** Sentence Builder as the Stage 7 Check (S7-5): tap one round's tiles in order, past the touch window. */
async function buildCheckTiles(page: Page, tiles: readonly string[]): Promise<void> {
  const tray = page.getByTestId('sentence-builder-tray');
  for (const name of tiles) {
    await page.waitForTimeout(120);
    await expect(tray.getByRole('button', { name, exact: true })).toBeVisible({ timeout: 5_000 });
    await tray.getByRole('button', { name, exact: true }).click();
  }
}

/** Sentence Builder in the Stage 7 Check (no round counter, no Skip): build each round by its tiles. */
async function buildCheck(page: Page, rounds: readonly (readonly string[])[]): Promise<void> {
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  for (const tiles of rounds) {
    const tray = page.getByTestId('sentence-builder-tray');
    for (const name of tiles) {
      await page.waitForTimeout(120);
      await tray.getByRole('button', { name, exact: true }).click();
    }
    await expect(page.getByTestId('sentence-builder-done')).toBeVisible();
    await expect(page.getByTestId('sentence-builder-done')).toHaveCount(0, { timeout: 5_000 });
  }
}

/**
 * Type Hangul: round `n` of `total`, typed on the in-app keyboard (Space for a space, Shift for a tense
 * letter, two keys for a joined vowel), then Done; a pass moves on by itself.
 */
async function typeRound(page: Page, n: number, total: number, text: string): Promise<void> {
  await expect(page.getByText(`${n} / ${total}`, { exact: true })).toBeVisible({ timeout: 5_000 });
  const key = (id: string) => page.getByTestId(`hangul-key-${id}`);
  for (const jamo of keysFor(text).flatMap((j) => [...(SPLIT[j] ?? j)])) {
    if (jamo === ' ') {
      await key('space').click();
    } else if (SHIFTED[jamo]) {
      await key('shift').click();
      await key(SHIFTED[jamo]).click();
    } else {
      await key(jamo).click();
    }
  }
  await page.getByTestId('type-hangul-done').click();
  await expect(page.getByText('You typed it!')).toBeVisible();
}

const LUNCH_BOX_Q1_BOARDS = [
  ['gimbap', 'uyu', 'dalgyal'],
  ['uyu', 'bap', 'mul'],
  ['dalgyal', 'gimchi', 'banana'],
  ['gimbap', 'ramyeon', 'uyu'],
  ['dalgyal', 'gimbap', 'mul'],
  ['gimchi', 'uyu', 'gimbap'],
] as const;
const OUTDOOR_Q1_BOARDS = [
  ['haneul', 'byeol', 'namu'],
  ['san', 'dal', 'haneul'],
  ['namu', 'bada', 'byeol'],
  ['haneul', 'gang', 'san'],
  ['byeol', 'namu', 'dal'],
  ['bada', 'haneul', 'namu'],
] as const;

/** A refreshed Stage 2 taste (F-CURR-001 T-1): Discover, six Pic-Word boards, the Apply game skipped, the Check by id. */
async function playTasteQ1(
  page: Page,
  shot: string,
  firstWord: string,
  boards: readonly (readonly string[])[],
  check: readonly [string, string],
): Promise<void> {
  await startFirstQuest(page);
  await expect(page.getByText(firstWord, { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath(`${shot}-q1-discover.png`), fullPage: true });
  await passDiscover(page);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const [n, board] of boards.entries()) {
    for (const id of board) await expect(page.getByTestId(`pic-word-picture-${id}`).locator('svg').first()).toBeVisible();
    if (n === 0) await page.screenshot({ path: test.info().outputPath(`${shot}-q1-pic-word.png`), fullPage: true });
    for (const id of board) {
      await page.getByTestId(`pic-word-picture-${id}`).click();
      await page.getByTestId(`pic-word-word-${id}`).click();
    }
  }
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await playCheckByIds(page, [{ answer: check[0] }, { answer: check[1] }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath(`${shot}-q1-results.png`), fullPage: true });
}

/**
 * The learner's Learning Route with its stage trail: the grown-up's read-only page (Profile, For grown-ups, the
 * Grown-up area behind the PIN, the learner's Learning Route row). The learner's own Route tab shows the next lessons
 * since the owner decision of 2026-10-17; the trail and its days are on this page.
 */
async function openRouteMap(page: Page): Promise<void> {
  const id = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
  await openGrownUpZone(page, 'Dami');
  await unlockWithPin(page);
  await page.getByTestId(`dashboard-route-${id}-open`).click();
  await expect(page.getByTestId('my-route-screen')).toBeVisible();
}

/** The Learning Route's trail: the cell's stage row, opened, lists the cell by its title. */
async function expectCellOnRoute(page: Page, stage: number, title: string): Promise<void> {
  await openRouteMap(page);
  const row = page.getByTestId(`my-route-stage-${stage}`);
  await expect(row).toBeVisible();
  // On the grown-up page a lesson group is a labelled row, not a button (a grown-up never opens an episode there).
  const cell = row.getByLabel(new RegExp(`: ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`)).first();
  if (!(await cell.isVisible())) await row.getByRole('button', { name: new RegExp(`^Stage ${stage}, `) }).first().click();
  await expect(cell).toBeVisible();
}

/** Type Hangul: tap the keys that type `text` (no tense or two-key letters in these targets), then Done. */
async function typeAnswer(page: Page, text: string): Promise<void> {
  await expect(page.getByTestId('type-hangul-field')).toBeVisible();
  for (const jamo of keysFor(text)) await page.getByTestId(jamo === ' ' ? 'hangul-key-space' : `hangul-key-${jamo}`).click();
  await page.getByTestId('type-hangul-done').click();
  await expect(page.getByText('You typed it!')).toBeVisible();
}

/** Realia Read: tap the option until the game marks it right (a tap inside its double-touch window is dropped). */
async function pickRealia(page: Page, ids: readonly string[]): Promise<void> {
  for (const [i, id] of ids.entries()) {
    await expect(page.getByTestId('realia-read-question')).toBeVisible();
    const option = page.getByTestId(`realia-read-option-${id}`);
    await expect(async () => {
      await option.click();
      await expect(option).toHaveAttribute('aria-label', /^Right answer/, { timeout: 250 });
    }).toPass();
    if (i < ids.length - 1) await expect(option).toHaveCount(0, { timeout: 5_000 }).catch(() => undefined);
  }
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
  await expect(headerClose(page)).toBeVisible();
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

/** Word Builder q1's Pic-Word boards (content/episodes/stage-2/letters.json), as pair ids in board order. */
const WORD_BUILDER_Q1_BOARDS = [
  ['sae', 'hae', 'namu'],
  ['norae', 'bae', 'byeol'],
  ['mujigae', 'jiugae', 'chaek'],
  ['baegu', 'taeksi', 'bada'],
  ['hayansaek', 'noransaek', 'paransaek'],
  ['sebae', 'dongsaeng', 'galsaek'],
] as const;

/** The deep plays, by episode id (rows S2-1 to S7-5 wrote them); a later cell may add one, never must. */
const PLAYS: Readonly<Record<string, CellPlay>> = {
  // F-CURR-001 S2-3: Playground Words q1, At the Playground, played through its real games.
  'episode:stage2-crafts': {
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
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 2, Words\./ }).click();
      // A shipped, started cell is a button that reads "Playing"; a coming-later cell is no button.
      await expect(page.getByLabel(/^Play & Crafts: Playground Words\. Playing\.$/)).toBeVisible();
    },
  },
  // F-CURR-001 S3-1: First Sentences, q1 "It Is a Book" played through its real games.
  'episode:stage3-letters': {
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
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 3, Sentences\./ }).click();
      await expect(page.getByLabel(/^Letters & Books: First Sentences\./)).toBeVisible();
    },
  },
  // F-CURR-001 S4-1: Read Along, q1 "What Is This?" played through its real games.
  'episode:stage4-letters': {
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
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 4, Dialogue\./ }).click();
      await expect(page.getByLabel(/^Letters & Books: Read Along\./)).toBeVisible();
    },
  },
  // F-CURR-001 S3-3: Festival Sentences, q1 "Grandma and Grandpa" at 320 px: Discover (three pages),
  // Sentence Builder (five rounds), Listen & Pick (four rounds), the two-round Check, the reward.
  'episode:stage3-rites': {
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
      await playCheckByIds(page, [{ answer: 'grandpa' }, { answer: 'songpyeon' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
      await shot(page, 's3-3-q1-reward-320');
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 3, Sentences\./ }).click();
      await expect(page.getByLabel(/^Holidays & Traditions: Festival Sentences\./)).toBeVisible();
    },
  },
  // F-CURR-001 S3-5: Game Sentences, q1 "I Want to Play" played through its real games.
  'episode:stage3-crafts': {
    playFirstQuest: async (page) => {
      await startFirstQuest(page);
      await passDiscover(page);
      // Sentence Builder: three particle rounds (를, 을, 를) and two word-order rounds with one extra tile.
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await build(page, 1, 5, ['를, reul']);
      await build(page, 2, 5, ['을, eul']);
      await build(page, 3, 5, ['축구를, chukgureul', '하고, hago', '싶어요, sipeoyo']);
      await build(page, 4, 5, ['를, reul']);
      await build(page, 5, 5, ['야구를, yagureul', '하고, hago', '싶어요, sipeoyo']);
      // Pic-Word Match on whole sentences: four boards of three.
      await playPicWordBoards(page, [
        ['yunnori', 'yeon', 'chukgu'],
        ['julleomgi', 'yagu', 'yunnori'],
        ['nonggu', 'yeon', 'julleomgi'],
        ['chukgu', 'yunnori', 'yeon'],
      ]);
      await playCheckByIds(page, [{ answer: 'kite' }, { answer: 'chukgu' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 3, Sentences\./ }).click();
      await expect(page.getByLabel(/^Play & Crafts: Game Sentences\./)).toBeVisible();
    },
  },
  // F-CURR-001 S3-2: Daily Mini-Sentences, q1 "I Eat, I Drink" played through its real games.
  'episode:stage3-life': {
    playFirstQuest: async (page) => {
      await startFirstQuest(page);
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
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 3, Sentences\./ }).click();
      await expect(page.getByLabel(/^Food & Daily Life: Daily Mini-Sentences\./)).toBeVisible();
    },
  },
  // F-CURR-001 T-2: Greeting Dialogues, q1 "Nice to Meet You" (the taste quest's id, now a six-step lesson).
  'episode:stage4-rites': {
    playFirstQuest: async (page) => {
      await startFirstQuest(page);
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await reply(page, '안녕하세요!');
      await reply(page, '저는 호야예요.');
      await reply(page, '저도 반가워요.');
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await orderLines(page, ['l1', 'l2', 'l3', 'l4']);
      await playCheckByIds(page, [{ answer: 'a' }, { answer: 'b' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 4, Dialogue\./ }).click();
      await expect(page.getByLabel(/^Holidays & Traditions: Greeting Dialogues\./)).toBeVisible();
    },
  },
  // F-CURR-001 S2-1: Word Builder. q1 teaches ㅐ ㅔ ㅒ ㅖ; its six Pic-Word boards are played, its Card Match is
  // skipped (the shipped game), and the Check is answered by id: the sun picture, then the written 노래.
  'episode:stage2-letters': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      // Discover shows the new vowel ㅐ with its example 개 and the words you can read now.
      await expect(page.getByText('ㅐ', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('개', { exact: true }).first()).toBeVisible();
      await shot(page, 's2-1-q1-discover-320');
      await passDiscover(page);
      // Practice: all six Pic-Word boards, each picture drawn art (an svg), never the gloss fallback tile.
      await page.getByRole('button', { name: 'Play minigame' }).click();
      for (const [n, board] of WORD_BUILDER_Q1_BOARDS.entries()) {
        for (const id of board) await expect(page.getByTestId(`pic-word-picture-${id}`).locator('svg').first()).toBeVisible();
        if (n === 0) await shot(page, 's2-1-q1-pic-word-320');
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
      await shot(page, 's2-1-q1-results-320');
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 2, Words\./ }).click();
      await expect(page.getByLabel(/^Letters & Books: Word Builder\./)).toBeVisible();
    },
  },
  // F-CURR-001 S2-2: Holiday Words, q1 "Seollal Words": Discover, all six Pic-Word boards, Build a Letter
  // (the shipped game, skipped here), and the Check by id: the 세배 picture, then the written 설날.
  'episode:stage2-rites': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      await passDiscover(page);
      await shot(page, 's2-2-q1-practice-320');
      await playPicWordBoards(page, [
        ['seollal', 'tteokguk', 'san'],
        ['sebae', 'hanbok', 'bap'],
        ['tteokguk', 'sebae', 'gimchi'],
        ['hanbok', 'seollal', 'san'],
        ['sebae', 'san', 'tteokguk'],
        ['hanbok', 'tteokguk', 'sebae'],
      ]);
      await page.getByRole('button', { name: 'Skip for now' }).click();
      await playCheckByIds(page, [{ answer: 'sebae' }, { answer: 'seollal' }]);
      await page.getByRole('button', { name: 'See results' }).click();
      await expect(page.getByText('Next up')).toBeVisible();
      await shot(page, 's2-2-q1-results-320');
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 2, Words\./ }).click();
      await expect(page.getByLabel(/^Holidays & Traditions: Holiday Words\./)).toBeVisible();
    },
  },
  // F-CURR-001 S4-2: Kitchen Talk, q1 "Have You Eaten?": Discover, three Tap to Respond turns, the four-line
  // Story Sequence and the Check, at 320 px.
  'episode:stage4-life': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await reply(page, '네, 먹었어요.');
      await reply(page, '네, 마셨어요.');
      await reply(page, '네, 먹었어요.');
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await orderLines(page, ['l1', 'l2', 'l3', 'l4']);
      await playCheckByIds(page, [{ answer: 'a' }, { answer: 'a' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
      await shot(page, 's4-2-q1-reward-320');
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 4, Dialogue\./ }).click();
      await expect(page.getByLabel(/^Food & Daily Life: Kitchen Talk\./)).toBeVisible();
    },
  },
  // F-CURR-001 S4-3: Park Conversations, q1 "Sky Watching": Discover, three Tap to Respond turns, the four-line
  // Story Sequence and the Check, at 320 px.
  'episode:stage4-nature': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await reply(page, '안녕하세요!');
      await reply(page, '네, 좋아요!');
      await reply(page, '집에 가요!');
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await orderLines(page, ['l1', 'l2', 'l3', 'l4']);
      await playCheckByIds(page, [{ answer: 'a' }, { answer: 'a' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
      await shot(page, 's4-3-q1-reward-320');
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 4, Dialogue\./ }).click();
      await expect(page.getByLabel(/^Nature & Animals: Park Conversations\./)).toBeVisible();
    },
  },
  // F-CURR-001 S4-4: Playdate Talk, q1 "What Shall We Play?" at 320 px: Discover (two exchange pages),
  // Tap to Respond (three turns), Story Sequence (three lines), the two-round Check, the reward.
  'episode:stage4-crafts': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await startFirstQuest(page);
      await expect(page.getByText('Page 1 of 2')).toBeVisible();
      await shot(page, 's4-4-q1-discover-320');
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await shot(page, 's4-4-q1-tap-respond-320');
      const turns = ['좋아!', '윷놀이 하자!', '좋아!'];
      for (const [i, line] of turns.entries()) {
        await expect(page.getByText(`${i + 1} / ${turns.length}`, { exact: true })).toBeVisible();
        // A tap inside the game's double-touch window is dropped (the same 좋아! twice): tap again until the turn moves on.
        const after = i + 1 < turns.length ? page.getByText(`${i + 2} / ${turns.length}`, { exact: true }) : page.getByRole('button', { name: 'Play minigame' });
        await expect(async () => {
          await reply(page, line);
          await expect(after).toBeVisible({ timeout: 1500 });
        }).toPass();
      }
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await orderLines(page, ['l1', 'l2', 'l3']);
      await playCheckByIds(page, [{ answer: 'a' }, { answer: 'a' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
      await shot(page, 's4-4-q1-reward-320');
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 4, Dialogue\./ }).click();
      await expect(page.getByLabel(/^Play & Crafts: Playdate Talk\./)).toBeVisible();
    },
  },
  // F-CURR-001 S6-1: Read the Menu, q1 "Dishes on the Menu" played through its real games.
  'episode:stage6-letters': {
    playFirstQuest: async (page) => {
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      // Realia Read: each round by its question, then the right option; a right pick moves on by itself.
      for (const [question, answer] of [
        ['Which one is on the menu?', 'b'],
        ['Which dish is noodles?', 'a'],
        ['Which dish is spicy rice cakes?', 'b'],
        ['Which dish is mixed rice?', 'a'],
      ] as const) {
        await expect(page.getByTestId('realia-read-question')).toHaveText(question);
        await page.getByTestId(`realia-read-option-${answer}`).click();
      }
      await page.getByRole('button', { name: 'Play minigame' }).click();
      // Type Hangul on the in-app keyboard: 김밥, 라면, 비빔밥 (no shifted or two-key letter).
      for (const [i, word] of ['김밥', '라면', '비빔밥'].entries()) {
        await expect(page.getByText(`${i + 1} / 3`)).toBeVisible({ timeout: 5_000 });
        for (const jamo of keysFor(word)) await page.getByTestId(`hangul-key-${jamo}`).click();
        await page.getByTestId('type-hangul-done').click();
        await expect(page.getByText('You typed it!')).toBeVisible();
      }
      await playCheckByIds(page, [{ answer: 'b' }, { answer: 'a' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 6, Real-use\./ }).click();
      await expect(page.getByLabel(/^Letters & Books: Read the Menu\./)).toBeVisible();
    },
  },
  // F-CURR-001 S6-2: Order Food, q1 "Excuse Me!": Realia Read on the table menu, Type Hangul, Listen & Pick.
  'episode:stage6-life': {
    playFirstQuest: async (page) => {
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await pickRealia(page, ['a', 'b', 'c', 'a']);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await typeAnswer(page, '여기요');
      await typeAnswer(page, '김밥 주세요');
      await typeAnswer(page, '물 주세요');
      await playCheckByIds(page, [{ answer: 'a' }, { answer: 'b' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 6, Real-use\./ }).click();
      await expect(page.getByLabel(/^Food & Daily Life: Order Food\./)).toBeVisible();
    },
  },
  // F-CURR-001 S6-3: Travel for Chuseok, q1 "The Train Ticket" played through its real games.
  'episode:stage6-rites': {
    playFirstQuest: async (page) => {
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await readRealia(page, [
        ['Where does the train leave from?', 'seoul'],
        ['Which word on the ticket means arrival?', 'dochak'],
        ['Where does the train arrive?', 'busan'],
        ['Which word on the ticket means departure?', 'chulbal'],
        ['What is this ticket for?', 'train'],
      ]);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await typeWords(page, ['기차', '출발', '도착']);
      await playCheckByIds(page, [{ answer: 'b' }, { answer: 'a' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 6, Real-use\./ }).click();
      await expect(page.getByLabel(/^Holidays & Traditions: Travel for Chuseok\./)).toBeVisible();
    },
  },
  // F-CURR-001 S6-4: Hike & Ask, q1 "Trail Signs" at 320 px: Discover, Realia Read on the trail sign
  // (four boards), Type Hangul (산길, 정상, 입구, 출구) and the Check by id (정상, then 출구).
  'episode:stage6-nature': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await shot(page, 's6-4-q1-realia-320');
      await pickRealia(page, ['jeongsang', 'chulgu', 'ipgu', 'hwajangsil']);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      for (const word of ['산길', '정상', '입구', '출구']) await typeAnswer(page, word);
      await playCheckByIds(page, [{ answer: 'a' }, { answer: 'a' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 6, Real-use\./ }).click();
      await expect(page.getByLabel(/^Nature & Animals: Hike & Ask\./)).toBeVisible();
    },
  },
  // F-CURR-001 S6-5: Buy at Market, q1 "At the Stall" at 320 px: Discover, Realia Read on the three price
  // cards (a drawn stall, round practice amounts, OD-11), Type Hangul (한지, 부채, 오일장) and the Check by id.
  'episode:stage6-crafts': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await shot(page, 's6-5-q1-realia-320');
      await pickRealia(page, ['hanji', 'buchae', 'apple', 'cheon']);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      for (const word of ['한지', '부채', '오일장']) await typeAnswer(page, word);
      await playCheckByIds(page, [{ answer: 'b' }, { answer: 'c' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 6, Real-use\./ }).click();
      await expect(page.getByLabel(/^Play & Crafts: Buy at Market\./)).toBeVisible();
    },
  },
  // F-CURR-001 S3-4: Animal Sentences, q1 "Where Is the Bird?" played through its real games.
  'episode:stage3-nature': {
    playFirstQuest: async (page) => {
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      // Discover: the pattern page (frame, two examples, the note), then the sentence page.
      await expect(page.getByText('나무에 새가 있어요.').first()).toBeVisible();
      await page.setViewportSize({ width: 320, height: 720 });
      await shot(page, 'animal-sentences-q1-discover-320');
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await buildSentence(page, ['나무에, namue', '새가, saega', '있어요, isseoyo']);
      await shot(page, 'animal-sentences-q1-built-320');
      await buildSentence(page, ['물에, mure', '물고기가, mulgogiga', '있어요, isseoyo']);
      await buildSentence(page, ['집에, jibe', '고양이가, goyangiga', '있어요, isseoyo']);
      await buildSentence(page, ['산에, sane', '토끼가, tokkiga', '있어요, isseoyo']);
      await buildSentence(page, ['산에, sane', '곰이, gomi', '있어요, isseoyo']);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await pickByIds(page, ['bird', 'fox', 'a', 'a']);
      await playCheckByIds(page, [{ answer: 'bear' }, { answer: 'a' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 3, / }).click();
      await expect(page.getByLabel(/^Nature & Animals: Animal Sentences\./)).toBeVisible();
    },
  },
  // F-CURR-001 T-1: Lunch Box Words. q1 keeps its id and its card; its Card Match is skipped, the Check is the
  // gimbap picture, then the written 도시락.
  'episode:stage2-life': {
    playFirstQuest: (page) => playTasteQ1(page, 'stage2-life', '도시락', LUNCH_BOX_Q1_BOARDS, ['gimbap', 'dosirak']),
    expectRouteDay: async (page) => {
      await page.context().setOffline(false);
      await page.goto('/');
      await expectCellOnRoute(page, 2, 'Lunch Box Words');
    },
  },
  // F-CURR-001 T-1: Outdoor Words. q1's Build the Word is skipped; the Check is the star picture, then the written 나무.
  'episode:stage2-nature': {
    playFirstQuest: (page) => playTasteQ1(page, 'stage2-nature', '하늘', OUTDOOR_Q1_BOARDS, ['byeol', 'namu']),
    expectRouteDay: async (page) => {
      await page.context().setOffline(false);
      await page.goto('/');
      await expectCellOnRoute(page, 2, 'Outdoor Words');
    },
  },
  // F-CURR-001 S7-1: Write Your Name, q1 "Hoya's Name": Trace a Word (left with Skip, a first-class way
  // on), Type Hangul with the cast name 호야, and the Stage 7 Sentence Builder Check.
  'episode:stage7-letters': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expect(page.getByTestId('trace-word-canvas')).toBeVisible();
      await page.getByRole('button', { name: 'Skip', exact: true }).click();
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await typeAnswer(page, '호야');
      await shot(page, 'write-your-name-q1-type-320');
      await typeAnswer(page, '이름');
      await typeAnswer(page, '한글');
      await typeAnswer(page, '이건 이름이에요');
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      await placeTiles(page, ['이건, igeon', '이름이에요, ireumieyo']);
      await expect(page.getByTestId('sentence-builder-gloss')).toHaveText('This is Hangul.', { timeout: 5_000 });
      await placeTiles(page, ['이건, igeon', '한글이에요, hangeurieyo']);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 7, / }).click();
      await expect(page.getByLabel(/^Letters & Books: Write Your Name\./)).toBeVisible();
    },
  },
  // F-CURR-001 S7-2: My Day in Korean, q1 "Morning to Evening": Trace a Word (Skip is the
  // learner's own way past it), Type Hangul on the in-app keyboard, the Sentence Builder Check.
  'episode:stage7-life': {
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
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 7, / }).click();
      await expect(page.getByLabel(/^Food & Daily Life: My Day in Korean\./)).toBeVisible();
    },
  },
  // F-CURR-001 S7-3: My Holiday Memory, q1 "I Ate Tteokguk" played through its real games at 320 px.
  'episode:stage7-rites': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      // Discover: the past-tense frame page and the model page (songpyeon, the full moon).
      await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
      await shot(page, 'my-holiday-memory-q1-discover-320');
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await build(page, 1, 4, ['떡국을, tteokgugeul', '먹었어요, meogeosseoyo']);
      await shot(page, 'my-holiday-memory-q1-built-320');
      await build(page, 2, 4, ['을, eul']);
      await build(page, 3, 4, ['보름달을, boreumdareul', '봤어요, bwasseoyo']);
      await build(page, 4, 4, ['를, reul']);
      // Type Hangul on the in-app keyboard: the three past forms, then the soup's name.
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await typeRound(page, 1, 4, '먹었어요');
      await shot(page, 'my-holiday-memory-q1-typed-320');
      await typeRound(page, 2, 4, '봤어요');
      await typeRound(page, 3, 4, '만들었어요');
      await typeRound(page, 4, 4, '떡국');
      await buildCheck(page, [
        ['송편을, songpyeoneul', '먹었어요, meogeosseoyo'],
        ['보름달을, boreumdareul', '봤어요, bwasseoyo'],
      ]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 7, Self-expression\./ }).click();
      await expect(page.getByLabel(/^Holidays & Traditions: My Holiday Memory\./)).toBeVisible();
    },
  },
  // F-CURR-001 S7-4: My Favorite Animal, q1 "Animals I Like": Trace a Word, Type Hangul, the order-it Check.
  'episode:stage7-nature': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
      await shot(page, 'favorite-animal-q1-discover-320');
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await traceWord(page, '곰', 'gom');
      await shot(page, 'favorite-animal-q1-trace-320');
      await traceWord(page, '새', 'sae');
      await traceWord(page, '토끼', 'tokki');
      await traceWord(page, '동물', 'dongmul');
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await typeRound(page, 1, 4, '호랑이');
      await typeRound(page, 2, 4, '고양이');
      await typeRound(page, 3, 4, '곰이 좋아요');
      await shot(page, 'favorite-animal-q1-type-320');
      await typeRound(page, 4, 4, '새가 좋아요');
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      // Check round 1 is a particle round (the noun is given, 가 is picked); round 2 builds the sentence.
      await buildCheckRound(page, 'I like cats.', ['가, ga']);
      await buildCheckRound(page, 'I like tigers.', ['호랑이가, horangiga', '좋아요, joayo']);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 7, / }).click();
      await expect(page.getByLabel(/^Nature & Animals: My Favorite Animal\./)).toBeVisible();
    },
  },
  // F-CURR-001 S7-5: Make & Share, q1 "Fold, Cut, Draw" played through its real games at 320 px.
  'episode:stage7-crafts': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.getByRole('button', { name: 'Start', exact: true }).first().click();
      await page.getByRole('button', { name: 'Continue' }).click();
      // Discover: the frame page (fold) and the sentence page (cut with scissors, draw).
      await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
      await shot(page, 'make-share-q1-discover-320');
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      // Type Hangul on the in-app keyboard: fold, cut, draw, plane.
      await typeRound(page, 1, 4, '접어요');
      await shot(page, 'make-share-q1-typed-320');
      await typeRound(page, 2, 4, '잘라요');
      await typeRound(page, 3, 4, '그려요');
      await typeRound(page, 4, 4, '비행기');
      await page.getByRole('button', { name: 'Play minigame' }).click();
      // Sentence Builder: a particle round (를 after a vowel), then two built sentences.
      await build(page, 1, 3, ['를, reul']);
      await build(page, 2, 3, ['꽃을, kkocheul', '그려요, geuryeoyo']);
      await build(page, 3, 3, ['가위로, gawiro', '잘라요, jallayo']);
      // The Stage 7 Check is two Sentence Builder rounds: 을 after a final consonant, then one sentence.
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      await buildCheckTiles(page, ['을, eul']);
      await buildCheckTiles(page, ['별을, byeoreul', '그려요, geuryeoyo']);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 7, Self-expression\./ }).click();
      await expect(page.getByLabel(/^Play & Crafts: Make & Share\./)).toBeVisible();
    },
  },
};

/**
 * A cell with no deep play: its first quest opens from the launcher, its intro moves on, its Discover
 * pages are read, and its first game step mounts (through its launcher when it has one), so a cell
 * whose games break after the intro fails here too (the test also fails on any page error).
 */
async function openFirstQuest(page: Page): Promise<void> {
  await startFirstQuest(page);
  await passDiscover(page);
  const launch = page.getByRole('button', { name: 'Play minigame' });
  await launch.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  if (await launch.isVisible()) {
    await launch.click();
    await expect(launch).toHaveCount(0);
  }
  await expect(page.getByText('Look and learn', { exact: true })).toHaveCount(0);
  await expect(headerClose(page)).toBeVisible();
}

/** One test per cell of the lesson manifest, with its deep play when it has one. */
const CELLS: readonly UpperCell[] = LESSON_EPISODES.map((episode) => {
  const stage = Number(episode.stage.replace('stage', ''));
  const play = PLAYS[episode.id];
  return {
    episodeId: episode.id,
    cellButton: journeyCellName(stage, THEME_LABEL[episode.theme]),
    title: episode.titleEn,
    playFirstQuest: play?.playFirstQuest ?? openFirstQuest,
    expectRouteDay: play?.expectRouteDay ?? ((page) => expectCellOnRoute(page, stage, episode.titleEn)),
  };
});

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
  test('the cell list is the lesson manifest, and every deep play names a shipped cell', () => {
    expect(CELLS.map((c) => c.episodeId)).toEqual(LESSON_EPISODES.map((e) => e.id));
    const shipped = new Set(LESSON_EPISODES.map((e) => e.id));
    for (const id of Object.keys(PLAYS)) expect(shipped.has(id), `${id} has a deep play but is not in the lesson manifest`).toBe(true);
  });

  // Every shipped cell has a deep play today, so the generic path a new cell takes (openFirstQuest, then its
  // day on the Learning Route) runs here for the first cell of the manifest: a content PR that adds a cell
  // with no deep play never meets that path for the first time.
  test('the generic path of a cell with no deep play: its first quest opens, its first game mounts and its Learning Route day appears', async ({ page }) => {
    const episode = LESSON_EPISODES[0];
    expect(episode, 'the lesson manifest lists a cell').toBeDefined();
    const stage = Number(episode!.stage.replace('stage', ''));
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await openJourney(page);
    await page.getByRole('button', { name: journeyCellName(stage, THEME_LABEL[episode!.theme]), exact: true }).click();
    await expect(page.getByText(episode!.titleEn).first()).toBeVisible();
    await openFirstQuest(page);
    await expectCellOnRoute(page, stage, episode!.titleEn);
    expect(errors).toEqual([]);
  });

  for (const cell of CELLS) {
    test(`${cell.episodeId}: opens from the grid, its first quest plays (to the reward with a deep play), the Learning Route day appears`, async ({ page }) => {
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
