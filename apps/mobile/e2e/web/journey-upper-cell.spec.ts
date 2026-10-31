import type { Page } from '@playwright/test';
import { keysFor, type ThemeKey } from '@hangul-route/content-schema';
import { LESSON_EPISODES } from '../../src/content/__generated__/lessons-index';
import { strokesForJamo } from '../../src/content/jamo-strokes';
import { placeWordStrokes } from '../../src/logic/trace-word/block-strokes';
import { expect, test } from './fixtures';
import { completeChildForm, journeyCellName, keepSidewaysIfAsked, openGrownUpZone, passDiscover, playCheckByIds, readStored, seedStoredAll, unlockWithPin, waitForNextListenPickRound, headerClose } from './helpers';
import { expectNoHorizontalOverflow } from './viewport';
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

/** Sentence Builder as a Check (no round counter, no Skip; row CM-3A S3's Stage 3 Check): build each round by its tiles. */
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
 * A Stage 7 Cloze Pick Check (F-CURR-002 row CM-3A S7). `game.cloze-pick` ships at built-in pct 0, so the release
 * build plays its Listen & Pick fallback in the text prompt mode (the sentence with its gap and its meaning, the same
 * tiles): tap the tile that fits each round, by its tile id (`<round>:t<index>`), a beat apart.
 */
async function pickClozeCheck(page: Page, answers: ReadonlyArray<readonly [round: string, tile: number]>, screenshot?: string): Promise<void> {
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  for (const [i, [round, tile]] of answers.entries()) {
    await expect(page.getByTestId('listen-pick-text-prompt')).toBeVisible({ timeout: 5_000 });
    const option = page.getByTestId(`listen-pick-option-${round}:t${tile}`);
    await expect(option).toBeVisible({ timeout: 5_000 });
    if (i === 0 && screenshot !== undefined) await shot(page, screenshot);
    await page.waitForTimeout(120);
    await option.click();
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
  check: (page: Page) => Promise<void>,
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
  await check(page);
  await page.screenshot({ path: test.info().outputPath(`${shot}-q1-check.png`), fullPage: true });
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

/** A Realia Read Check (F-CURR-002 row CM-3A S6): the Check card's Go, then the two questions by option id. */
async function playRealiaCheck(page: Page, ids: readonly [string, string]): Promise<void> {
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await pickRealia(page, ids);
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

/**
 * Tap to Respond turns by their right reply, the counter moving on after each (`n / total`); after the last turn the
 * next step's Play minigame (or the Check's Go, or the reward) shows. A tap inside the double-touch window is dropped (the same reply twice in a row),
 * so a turn is tapped again until it moves on, and only while its own counter still shows. A Role Play step plays this while `game.role-play` is off (row CM-35).
 */
async function replyTurns(page: Page, turns: readonly string[], last: 'minigame' | 'check' | 'finish' = 'minigame'): Promise<void> {
  for (const [i, line] of turns.entries()) {
    await expect(page.getByText(`${i + 1} / ${turns.length}`, { exact: true })).toBeVisible({ timeout: 5_000 });
    const after =
      i + 1 < turns.length
        ? page.getByText(`${i + 2} / ${turns.length}`, { exact: true })
        : last === 'minigame'
          ? page.getByRole('button', { name: 'Play minigame' })
          : last === 'check'
            ? page.getByRole('button', { name: 'Go', exact: true })
            : page.getByText('Finish', { exact: true }).first();
    // Tap only while this turn's counter still shows and the next one does not, so a retry never answers the next turn
    // (consecutive turns can share a reply, life q1 and crafts q1). The wait passes the double-touch window first.
    const current = page.getByText(`${i + 1} / ${turns.length}`, { exact: true });
    await expect(async () => {
      if (await after.isVisible()) return;
      await page.waitForTimeout(120);
      if ((await current.isVisible()) && !(await after.isVisible())) await reply(page, line);
      await expect(after).toBeVisible({ timeout: 1500 });
    }).toPass();
  }
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

/** A Pic-Word Match Check (F-CURR-002 row CM-3A S2): the launcher's Go, then each board's pairs by id. */
async function playCheckBoards(page: Page, boards: readonly (readonly string[])[]): Promise<void> {
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  for (const ids of boards) {
    await expect.poll(() => boardIds(page)).toEqual([...ids].sort());
    // A Check has no Skip (F-QUEST-002 L2), and its header is "Quick check", never "n / N".
    await expect(page.getByTestId('pic-word-skip')).toHaveCount(0);
    await expect(page.locator('text=Quick check >> visible=true').first()).toBeVisible();
    for (const id of ids) {
      await page.getByTestId(`pic-word-picture-${id}`).click();
      await page.getByTestId(`pic-word-word-${id}`).click();
    }
  }
}

/** A Read Pick Meaning Check (row CM-3A S2): the Korean is drawn as text, no speaker, then the pictures by id. */
async function playReadPickCheck(page: Page, answers: readonly [string, string]): Promise<void> {
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByTestId('listen-pick-text-prompt')).toBeVisible();
  await expect(page.getByText('What does this mean?')).toBeVisible();
  await expect(page.getByTestId('listen-pick-speaker')).toHaveCount(0);
  const size = page.viewportSize();
  await shot(page, `read-pick-${answers[0]}-${size?.width ?? 0}`);
  // The same round wide (1024 x 768), then back to the test's own size.
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByTestId('listen-pick-text-prompt')).toBeVisible();
  await shot(page, `read-pick-${answers[0]}-wide`);
  if (size) await page.setViewportSize(size);
  await pickByIds(page, answers);
}

/** A Dictation Check (row CM-3A S2): the launcher's Go, then each word typed (a `see` round when no voice or its switch is off). */
async function playDictationCheck(page: Page, name: string, words: readonly [string, string]): Promise<void> {
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await expect(page.getByTestId('type-hangul-field')).toBeVisible();
  // A Check has no Skip (F-QUEST-002 L2), at the phone width and wide; the prompt and the field stay on screen.
  await expect(page.getByTestId('type-hangul-skip')).toHaveCount(0);
  await expect(page.getByTestId('type-hangul-prompt')).toBeInViewport();
  await shot(page, `dictation-${name}-${page.viewportSize()?.width ?? 0}`);
  const size = page.viewportSize();
  // The smallest phone (320 x 568): the word to copy and the field are on screen without scrolling.
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(page.getByTestId('type-hangul-prompt')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('type-hangul-done')).toBeInViewport({ ratio: 1 });
  await shot(page, `dictation-${name}-320x568`);
  // The last key row is a short scroll away, and the word is still in view with it.
  await page.getByTestId('hangul-key-space').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('hangul-key-space')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('type-hangul-prompt')).toBeInViewport({ ratio: 1 });
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByTestId('type-hangul-field')).toBeVisible();
  await expect(page.getByTestId('type-hangul-skip')).toHaveCount(0);
  if (size) await page.setViewportSize(size);
  for (const word of words) await typeAnswer(page, word);
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
      // F-CURR-002 row CM-3A S2: the Check is Pic-Word Match on the cell's own words (Check rotation, section 7.1).
      await playCheckBoards(page, [
        ['gong', 'jajeongeo', 'haneul'],
        ['yeon', 'namu', 'chukgu'],
      ]);
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
      // The Check is Cloze Pick (F-CURR-002 row CM-3A S3); `game.cloze-pick` is dark, so it plays its Listen & Pick fallback (tile ids `<round>:t<n>`).
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      await expect(page.getByTestId('listen-pick-option-c1:t0')).toBeVisible({ timeout: 5_000 });
      await shot(page, 'first-sentences-q1-cloze-check-320');
      await playCheckByIds(page, [{ answer: 'c1:t0' }, { answer: 'c2:t0' }], { go: false });
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
      await replyTurns(page, ['책이에요.', '친구예요.', '가방이에요.']);
      // The Apply is Role Play (F-CURR-002 row CM-3A S4); `game.role-play` is dark, so it plays Tap to Respond on its main path.
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await replyTurns(page, ['지우개예요.', '책이에요.', '할머니예요.', '친구예요.'], 'check');
      // The Check is Cloze Pick (F-CURR-002 row CM-3A S4); `game.cloze-pick` is dark, so it plays its Listen & Pick fallback (tile ids `<round>:t<n>`).
      await playCheckByIds(page, [{ answer: 'c1:t1' }, { answer: 'c2:t1' }]);
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
      // The Check is Sentence Builder (F-CURR-002 row CM-3A S3): a built sentence, then the 을 / 를 choice after 송편.
      await buildCheck(page, [
        ['할아버지하고, harabeojihago', '할머니가, halmeoniga', '있어요, isseoyo'],
        // A particle round: the words are given in order, the ending after 송편 is picked.
        ['을, eul'],
      ]);
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
      // The Check is Cloze Pick (F-CURR-002 row CM-3A S3); `game.cloze-pick` is dark, so it plays its Listen & Pick fallback (tile ids `<round>:t<n>`).
      await playCheckByIds(page, [{ answer: 'c1:t0' }, { answer: 'c2:t0' }]);
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
      // The Check is Cloze Pick (F-CURR-002 row CM-3A S3); `game.cloze-pick` is dark, so it plays its Listen & Pick fallback (tile ids `<round>:t<n>`).
      await playCheckByIds(page, [{ answer: 'c1:t0' }, { answer: 'c2:t0' }]);
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
      // The Practice is Story Sequence and the Apply Cloze Pick (F-CURR-002 row CM-3A S4); `game.cloze-pick` is dark, so
      // the Apply plays its Listen & Pick fallback (tile ids `<round>:t<n>`).
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await orderLines(page, ['l1', 'l2', 'l3', 'l4']);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await pickByIds(page, ['r1:t0', 'r2:t0', 'r3:t1', 'r4:t1']);
      // The Check is the Dialogue reply pick (Tap to Respond).
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      await replyTurns(page, ['저는 호야예요.', '저도 반가워요.'], 'finish');
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 4, Dialogue\./ }).click();
      await expect(page.getByLabel(/^Holidays & Traditions: Greeting Dialogues\./)).toBeVisible();
    },
  },
  // F-CURR-001 S2-1: Word Builder. q1 teaches ㅐ ㅔ ㅒ ㅖ; its six Pic-Word boards are played, its Card Match is
  // skipped (the shipped game), and the Check is Read Pick Meaning on 해 and 노래 (row CM-3A S2).
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
      // Row CM-3A S2: Read Pick Meaning, 해 and 노래 read, their pictures picked.
      await playReadPickCheck(page, ['hae', 'norae']);
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
  // (the shipped game, skipped here), and the Check: Read Pick Meaning on 설날 and 한복 (row CM-3A S2).
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
      // Row CM-3A S2: Read Pick Meaning, 설날 and 한복 read, their pictures picked.
      await playReadPickCheck(page, ['seollal', 'hanbok']);
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
  // F-CURR-001 S4-2: Kitchen Talk, q1 "Have You Eaten?": Discover, Role Play (its Tap to Respond fallback), four
  // Sentence Builder rounds and the Dialogue reply pick Check, at 320 px (F-CURR-002 row CM-3A S4).
  'episode:stage4-life': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      await passDiscover(page);
      // The Practice is Role Play (F-CURR-002 row CM-3A S4); `game.role-play` is dark, so it plays Tap to Respond on its main path.
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await shot(page, 's4-2-q1-role-play-fallback-320');
      await replyTurns(page, ['네, 먹었어요.', '네, 먹었어요.', '네, 마셨어요.', '네, 먹었어요.']);
      // The Apply is Sentence Builder: two built questions, the yes answer, then the 을 / 를 choice after 우유.
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await build(page, 1, 4, ['밥, bap', '먹었어요, meogeosseoyo']);
      await build(page, 2, 4, ['우유, uyu', '마셨어요, masyeosseoyo']);
      await build(page, 3, 4, ['네,, ne', '먹었어요, meogeosseoyo']);
      await build(page, 4, 4, ['를, reul']);
      // The Check is the Dialogue reply pick (Tap to Respond).
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      await replyTurns(page, ['네, 먹었어요.', '네, 마셨어요.'], 'finish');
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
      await shot(page, 's4-2-q1-reward-320');
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 4, Dialogue\./ }).click();
      await expect(page.getByLabel(/^Food & Daily Life: Kitchen Talk\./)).toBeVisible();
    },
  },
  // F-CURR-001 S4-3: Park Conversations, q1 "Sky Watching": Discover, three Tap to Respond turns, Realia Read on the
  // weather card and the Cloze Pick Check (its fallback), at 320 px (F-CURR-002 row CM-3A S4).
  'episode:stage4-nature': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await startFirstQuest(page);
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await replyTurns(page, ['안녕하세요!', '네, 좋아요!', '집에 가요!']);
      // The Apply is Realia Read on the park weather card (F-CURR-002 row CM-3A S4).
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await shot(page, 's4-3-q1-weather-card-320');
      await pickRealia(page, ['sun', 'river', 'wind', 'mountain']);
      // The Check is Cloze Pick (F-CURR-002 row CM-3A S4); `game.cloze-pick` is dark, so it plays its Listen & Pick fallback (tile ids `<round>:t<n>`).
      await playCheckByIds(page, [{ answer: 'c1:t1' }, { answer: 'c2:t0' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
      await shot(page, 's4-3-q1-reward-320');
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 4, Dialogue\./ }).click();
      await expect(page.getByLabel(/^Nature & Animals: Park Conversations\./)).toBeVisible();
    },
  },
  // F-CURR-001 S4-4: Playdate Talk, q1 "What Shall We Play?" at 320 px: Discover (two exchange pages), Role Play
  // and Story Order (their fallbacks), the Dialogue reply pick Check, the reward (F-CURR-002 row CM-3A S4).
  'episode:stage4-crafts': {
    playFirstQuest: async (page) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await startFirstQuest(page);
      await expect(page.getByText('Page 1 of 2')).toBeVisible();
      await shot(page, 's4-4-q1-discover-320');
      await passDiscover(page);
      // The Practice is Role Play and the Apply Story Order (F-CURR-002 row CM-3A S4); both switches are dark, so they
      // play Tap to Respond on the Role Play's main path and Story Sequence on the captions.
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await shot(page, 's4-4-q1-tap-respond-320');
      await replyTurns(page, ['좋아!', '윷놀이 하자!', '좋아!', '좋아! 같이 가자!']);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await orderLines(page, ['ask', 'what', 'yut', 'okay']);
      // The Check is the Dialogue reply pick (Tap to Respond).
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      await replyTurns(page, ['윷놀이 하자!', '좋아!'], 'finish');
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
      // Row CM-3A S6: the Check reads the menu (김밥 by its meaning, then 라면 by its picture).
      await playRealiaCheck(page, ['b', 'c']);
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
      // Row CM-3A S6: the Check reads the table menu (라면 by its meaning, then 우유 by its picture).
      await playRealiaCheck(page, ['c', 'b']);
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
      // Row CM-3A S6: the Check reads the ticket (서울 goes with 출발, 부산 with 도착).
      await playRealiaCheck(page, ['b', 'c']);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 6, Real-use\./ }).click();
      await expect(page.getByLabel(/^Holidays & Traditions: Travel for Chuseok\./)).toBeVisible();
    },
  },
  // F-CURR-001 S6-4: Hike & Ask, q1 "Trail Signs" at 320 px: Discover, Realia Read on the trail sign
  // (four boards), Type Hangul (산길, 정상, 입구, 출구) and the Realia Read Check (강, then 출구; row CM-3A S6).
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
      // Row CM-3A S6: the Check reads the sign (the board to the river, then the way out).
      await playRealiaCheck(page, ['b', 'c']);
      await shot(page, 's6-4-q1-check-320');
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
      // Row CM-3A S6: the Check is Cloze Pick on the price cards (부채는 ___ 원이에요, 사과는 ___ 원이에요); with
      // game.cloze-pick at its built-in pct 0 it plays as Listen & Pick with a text prompt, on the same tiles.
      await playCheckByIds(page, [{ answer: 'c1:t0' }, { answer: 'c2:t1' }]);
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
      // The Check is Cloze Pick (F-CURR-002 row CM-3A S3); `game.cloze-pick` is dark, so it plays its Listen & Pick fallback (tile ids `<round>:t<n>`).
      await playCheckByIds(page, [{ answer: 'c1:t0' }, { answer: 'c2:t0' }]);
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 3, / }).click();
      await expect(page.getByLabel(/^Nature & Animals: Animal Sentences\./)).toBeVisible();
    },
  },
  // F-CURR-001 T-1: Lunch Box Words. q1 keeps its id and its card; its Card Match is skipped, the Check is Read
  // Pick Meaning on 김밥 and 우유 (row CM-3A S2).
  'episode:stage2-life': {
    playFirstQuest: (page) => playTasteQ1(page, 'stage2-life', '도시락', LUNCH_BOX_Q1_BOARDS, (p) => playReadPickCheck(p, ['gimbap', 'uyu'])),
    expectRouteDay: async (page) => {
      await page.context().setOffline(false);
      await page.goto('/');
      await expectCellOnRoute(page, 2, 'Lunch Box Words');
    },
  },
  // F-CURR-001 T-1: Outdoor Words. q1's Build the Word is skipped; the Check is Dictation of 하늘 and 나무 (row CM-3A S2).
  'episode:stage2-nature': {
    playFirstQuest: (page) => playTasteQ1(page, 'stage2-nature', '하늘', OUTDOOR_Q1_BOARDS, async (p) => {
      await p.setViewportSize({ width: 320, height: 720 });
      await playDictationCheck(p, 'haneul', ['하늘', '나무']);
    }),
    expectRouteDay: async (page) => {
      await page.context().setOffline(false);
      await page.goto('/');
      await expectCellOnRoute(page, 2, 'Outdoor Words');
    },
  },
  // F-CURR-001 S7-1: Write Your Name, q1 "Hoya's Name": Trace a Word (left with Skip, a first-class way
  // on), Type Hangul with the cast name 호야 (이름 is a Dictation round, a see round with its switch off), and the
  // Cloze Pick Check of row CM-3A S7 (이건 ___이에요.).
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
      await pickClozeCheck(page, [['c1', 0], ['c2', 2]], 'write-your-name-q1-cloze-check-320');
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 7, / }).click();
      await expect(page.getByLabel(/^Letters & Books: Write Your Name\./)).toBeVisible();
    },
  },
  // F-CURR-001 S7-2: My Day in Korean, q1 "Morning to Evening": Trace a Word (Skip is the
  // learner's own way past it), Type Hangul on the in-app keyboard (아침 and 저녁 are Dictation rounds, see rounds
  // with their switch off), and the Cloze Pick Check of row CM-3A S7 (___에 밥을 먹어요.).
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
      await pickClozeCheck(page, [['c1', 0], ['c2', 2]], 'my-day-q1-check-320');
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
      // The Cloze Pick Check of row CM-3A S7: the past verb that fits each sentence.
      await pickClozeCheck(page, [['c1', 0], ['c2', 2]], 'my-holiday-memory-q1-cloze-check-320');
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
    expectRouteDay: async (page) => {
      await openRouteMap(page);
      await page.getByRole('button', { name: /^Stage 7, Self-expression\./ }).click();
      await expect(page.getByLabel(/^Holidays & Traditions: My Holiday Memory\./)).toBeVisible();
    },
  },
  // F-CURR-001 S7-4: My Favorite Animal, q1 "Animals I Like": Trace a Word, Type Hangul, and the Cloze Pick Check of
  // row CM-3A S7 with a particle gap (고양이___ takes 가, 곰___ takes 이).
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
      await pickClozeCheck(page, [['c1', 1], ['c2', 1]], 'favorite-animal-q1-cloze-check-320');
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
      // The Stage 7 Check (row CM-3A S7) is Cloze Pick: 을 after a final consonant, then the verb that fits.
      await pickClozeCheck(page, [['c1', 0], ['c2', 2]], 'make-share-q1-cloze-check-320');
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

/**
 * A cell's Volume 2 is a later episode of the manifest (F-CURR-002 row CM-40), reached from its cell's page with
 * `volumes` on; it has its own play below (row CM-45 S6), so the grid list holds first volumes.
 */
const FIRST_VOLUMES = LESSON_EPISODES.filter((episode) => (episode.volume ?? 1) === 1);
const LATER_VOLUMES = LESSON_EPISODES.filter((episode) => (episode.volume ?? 1) > 1);

/** One test per cell of the lesson manifest, with its deep play when it has one. */
const CELLS: readonly UpperCell[] = FIRST_VOLUMES.map((episode) => {
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
    expect(CELLS.map((c) => c.episodeId)).toEqual(FIRST_VOLUMES.map((e) => e.id));
    // Every Volume 2 of the manifest has its own play (the describe below).
    expect(LATER_VOLUMES.map((e) => e.id)).toEqual([...VOLUME2_PLAYS.keys()]);
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

  // F-CURR-002 row CM-3A S3: a Stage 3 Dictation Check at launch state. `game.type-hangul-hear` is dark (built-in
  // pct 0), so the Check's hear rounds play as Type Hangul see rounds on the in-app keyboard, and the quest finishes.
  test('episode:stage3-rites q2: its Dictation Check plays as see rounds with game.type-hangul-hear dark, to the reward', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 320, height: 720 });
    await openJourney(page);
    await page.getByRole('button', { name: journeyCellName(3, THEME_LABEL.rites), exact: true }).click();
    await page.getByTestId('episode-quest-quest:stage3-rites-q2').getByRole('button', { name: 'Start' }).click();
    const anyway = page.getByRole('button', { name: 'Play anyway' });
    await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await anyway.isVisible()) await anyway.click();
    await expect(headerClose(page)).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    // Sentence Builder: four particle rounds (the words are given, 이 or 가 is picked) and one built sentence.
    await build(page, 1, 5, ['이, i']);
    await build(page, 2, 5, ['이, i']);
    await build(page, 3, 5, ['가, ga']);
    await build(page, 4, 5, ['사과하고, sagwahago', '떡이, tteogi', '맛있어요, masisseoyo']);
    await build(page, 5, 5, ['이, i']);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await pickByIds(page, ['hanbok', 'apple', 'moon', 'tteok']);
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    for (const word of ['한복', '송편']) {
      // A see round: the word is shown, there is no speaker, and the in-app keyboard types it.
      await expect(page.getByTestId('type-hangul-prompt')).toContainText(word, { timeout: 5_000 });
      await expect(page.getByTestId('dictation-prompt-speaker')).toHaveCount(0);
      if (word === '한복') await shot(page, 's3-3-q2-dictation-check-see-320');
      for (const jamo of keysFor(word)) await page.getByTestId(`hangul-key-${jamo}`).click();
      await page.getByTestId('type-hangul-done').click();
      await expect(page.getByText('You typed it!')).toBeVisible();
    }
    await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});

/**
 * F-CURR-002 row CM-45 S6: Stage 6 Holidays Volume 2, "Holiday Calendar", at its launch state. `volumes` is at its
 * built-in pct 0 (the row merges dark), so the Volume 2 case turns it on through the stored remote copy, as a ramp
 * would; every `game.<kind>` stays at pct 0, so the Apply's Cloze Pick plays as Listen & Pick with a text prompt and the
 * card above it, and the Dictation Check as Type Hangul see rounds. The calendar sits beside the option cards at 320 px.
 */
const VOLUME2_PLAYS = new Map<string, (page: Page) => Promise<void>>([
  [
    'episode:stage6-rites-v2',
    async (page) => {
      await startFirstQuest(page);
      await passDiscover(page);
      await page.getByRole('button', { name: 'Play minigame' }).click();
      // Practice: Realia Read on the calendar page (CM-47 kind `calendar`): solar days and lunar dates.
      await expect(page.getByTestId('realia-read-question')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await shot(page, `cm45-s6-q1-calendar-${page.viewportSize()?.width === 320 ? '320' : 'wide'}`);
      await pickRealia(page, ['d25', 'chubun', 'd11', 'lunar-8-15']);
      // Apply: Cloze Pick on the calendar's days and holidays, played as its Listen & Pick fallback with game.cloze-pick dark.
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expectNoHorizontalOverflow(page);
      await shot(page, `cm45-s6-q1-cloze-fallback-${page.viewportSize()?.width === 320 ? '320' : 'wide'}`);
      await pickByIds(page, ['a1:t1', 'a2:t1', 'a3:t1']);
      // Check: Dictation of 추석 and 송편, played as see rounds with game.type-hangul-hear dark.
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      for (const word of ['추석', '송편']) {
        await expect(page.getByTestId('type-hangul-prompt')).toContainText(word, { timeout: 5_000 });
        await expect(page.getByTestId('dictation-prompt-speaker')).toHaveCount(0);
        await typeAnswer(page, word);
      }
      await expect(page.getByText('Finish', { exact: true }).first()).toBeVisible();
    },
  ],
]);

/** A new learner whose stored remote copy holds `flags` (the `volumes` ramp), on the Journey. */
async function journeyWithFlags(page: Page, flags: Record<string, { on: boolean; pct: number }>): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await seedStoredAll(page, { 'remote-config': { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags } });
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

test.describe('Volume 2 cells (F-CURR-002 rows CM-40 and CM-45)', () => {
  for (const [label, size] of [
    ['320', { width: 320, height: 720 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    for (const episode of LATER_VOLUMES) {
      test(`${label}: ${episode.id} opens from its cell's Vol 2 tab with volumes on, and its first quest plays to the reward`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.setViewportSize(size);
        await journeyWithFlags(page, { volumes: { on: true, pct: 100 } });
        const stage = Number(episode.stage.replace('stage', ''));
        await page.getByRole('button', { name: journeyCellName(stage, THEME_LABEL[episode.theme]), exact: false }).first().click();
        const tabs = page.getByRole('tablist', { name: 'Volumes' });
        await tabs.getByRole('tab', { name: 'Volume 2' }).click();
        await expect(tabs.getByRole('tab', { name: 'Volume 2' })).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByText(episode.titleEn).first()).toBeVisible();
        if (label === '320') await expectNoHorizontalOverflow(page);
        await VOLUME2_PLAYS.get(episode.id)?.(page);
        expect(errors).toEqual([]);
      });
    }
  }

  test('volumes off (launch state): the cell opens Volume 1 alone, with no Vol tabs and no Volume 2 title', async ({ page }) => {
    await journeyWithFlags(page, {});
    for (const episode of LATER_VOLUMES) {
      const stage = Number(episode.stage.replace('stage', ''));
      await page.getByRole('button', { name: journeyCellName(stage, THEME_LABEL[episode.theme]), exact: false }).first().click();
      await expect(page.getByRole('tablist', { name: 'Volumes' })).toHaveCount(0);
      await expect(page.getByText(episode.titleEn)).toHaveCount(0);
    }
  });
});
