import type { Page } from '@playwright/test';
import { CATALOG, keysFor } from '@hangul-route/content-schema';
import { decodeReviewItems } from '@hangul-route/content-schema/review-items';
import * as chunk from '../../src/content/__generated__/review-item-chunks/review-items';
import { expect, test } from './fixtures';
import { journeyCellName, onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { closeInstallGuide, expectTextFits } from './text-fit';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 sections 4.4, 4.5, 7.7, 11.3, 12.2 and 14, row CM-21 (design/wireframes/reviews/cell-check.md): the Cell
 * Check from a finished cell's page (a 3-star result latches `cellCheckAt` and shows "Cell Check done"; a lower one
 * writes the entry and latches nothing), Test out from an unstarted cell (a pass latches `testedOut`, the quests show
 * "Tested out" with 2 stars and the next lesson moves past the cell; a stopped test-out writes nothing), the plays
 * offline, text size Largest at 320 x 568 in English and Spanish, and with `cellCheck` off no Check and no Test out
 * while the latched Tested out mark stays drawn (routeNext keeps skipping the cell). Test out needs a cell whose topic
 * words are few (Stage 3 up today): Stage 3 Letters, the first cell of the route once Stage 2 is done. A lapsed plan
 * (F-ENT-003) is covered by the unit tests (`cell-check-api.test.ts`: the cell checked again at the start and the
 * finish; `cell-check-block.test.tsx`: a locked cell offers none), recorded in the wireframe. `cellCheck` ships at built-in pct 0, so each case turns it on through the
 * stored remote copy, with `memoryRecord`. This browser has no Korean voice (the fixture's silent engine): every heard
 * round is a read round.
 *
 *   HR_SHOTS=1 pnpm --filter @hangul-route/mobile test:e2e:web cell-check
 */

test.use({ timezoneId: 'UTC' });

const ITEMS = decodeReviewItems(chunk);
const AT = '2026-10-01T10:00:00.000Z';
const DONE_CELL = 'episode:stage2-life';
const OPEN_CELL = 'episode:stage3-letters';
const OPEN_THEME = 'Letters & Books';
const NEXT_CELL = 'episode:stage3-life';
const questsOf = (cell: string): string[] => CATALOG.cells.find((c) => c.episodeId === cell)?.questIds ?? [];
const doneBefore = CATALOG.cells.filter((c) => /^episode:stage[12]-/.test(c.episodeId)).map((c) => c.episodeId);

type Flags = Record<string, { on: boolean; pct: number }>;
const ON: Flags = { memoryRecord: { on: true, pct: 100 }, cellCheck: { on: true, pct: 100 }, mastery: { on: true, pct: 100 } };

/** Dami: Stages 1 and 2 done (seeded, Done latched), Stage 3 not started. */
async function learner(page: Page, flags: Flags = ON, settings?: { uiLocale: 'en' | 'es'; textSize: 'largest' }): Promise<string> {
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  const cells = doneBefore;
  const questDoneAt = Object.fromEntries(cells.flatMap(questsOf).map((q) => [q, AT]));
  const quests = cells.flatMap((cell) => questsOf(cell).map((questId) => ({ questId, episodeId: cell, startedAt: AT, completedAt: AT, stars: 2, attempts: 1, accuracy: 0.9 })));
  await seedStored(page, `progress:${id}`, {
    profileId: id,
    updatedAt: AT,
    episodes: [],
    quests,
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
    questDoneAt,
    memSeededAt: AT,
    cellBest: Object.fromEntries(cells.map((c) => [c, 1])),
  });
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags });
  if (settings) await seedStored(page, 'device:settings', { ...settings, uiLocaleAt: '2026-10-16T09:00:00.000Z' });
  await page.reload();
  await expect(page.getByText(settings?.uiLocale === 'es' ? '¡Hola, Dami!' : 'Hi, Dami!')).toBeVisible();
  return id;
}

async function openCell(page: Page, theme: string, stage = 2): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(stage, theme) }).click();
}

const cellItems = (cell: string | readonly string[]) => ITEMS.filter((i) => (typeof cell === 'string' ? [cell] : cell).some((c) => i.cells.includes(c)));
const SHIFTED: Record<string, string> = { 'ㅃ': 'ㅂ', 'ㅉ': 'ㅈ', 'ㄸ': 'ㄷ', 'ㄲ': 'ㄱ', 'ㅆ': 'ㅅ', 'ㅒ': 'ㅐ', 'ㅖ': 'ㅔ' };
const SPLIT: Record<string, string> = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };

async function typeKorean(page: Page, text: string): Promise<void> {
  for (const jamo of keysFor(text).flatMap((j) => [...(SPLIT[j] ?? j)])) {
    if (jamo === ' ') await page.getByTestId('hangul-key-space').click();
    else if (SHIFTED[jamo]) {
      await page.getByTestId('hangul-key-shift').click();
      await page.getByTestId(`hangul-key-${SHIFTED[jamo]}`).click();
    } else await page.getByTestId(`hangul-key-${jamo}`).click();
  }
}

/** Answers the round on screen from the cell's items: right on the first try, or wrong first and then right. */
async function answer(page: Page, cell: string | readonly string[], right: boolean): Promise<void> {
  const round = page.getByTestId('daily-review-round');
  await expect(round).toBeVisible();
  const items = cellItems(cell);
  const dots = page.getByTestId('daily-review-dots');
  const before = await dots.getAttribute('aria-label');
  if ((await page.getByTestId('daily-review-typed').count()) > 0) {
    // Type Hangul: the target is shown, or the picture names its meaning.
    let target = (await page.getByTestId('daily-review-type-target').count()) > 0 ? ((await page.getByTestId('daily-review-type-target').innerText()).split('\n')[0] ?? '').trim() : '';
    if (target === '') {
      const labels = await round.locator('[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
      target = items.find((i) => i.en !== undefined && labels.includes(i.en))?.ko ?? '';
    }
    if (!right || target === '') {
      await typeKorean(page, 'ㅋ');
      await page.getByTestId('daily-review-type-done').click();
      await expect(page.getByTestId('daily-review-miss')).toBeVisible();
      if (target === '') target = ((await page.getByTestId('daily-review-miss').innerText()).match(/[가-힣]+(?: [가-힣]+)*/g) ?? []).sort((a, b) => b.length - a.length)[0] ?? '';
    }
    await typeKorean(page, target);
    await page.getByTestId('daily-review-type-done').click();
  } else if ((await page.locator('[data-testid^="daily-review-tile-"]').count()) > 0) {
    const tiles = await page.locator('[data-testid^="daily-review-tile-"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    const sorted = [...tiles].sort().join('|');
    const item = items.find((i) => (i.reply?.ko ?? i.ko).split(' ').sort().join('|') === sorted);
    const words = (item?.reply?.ko ?? item?.ko ?? '').split(' ');
    if (!right) {
      const wrong = tiles.find((t) => t !== words[0]);
      if (wrong) await page.getByTestId('daily-review-round').getByRole('button', { name: wrong, exact: true }).first().click();
    }
    for (const w of words) await page.getByTestId('daily-review-round').getByRole('button', { name: w, exact: true, disabled: false }).first().click();
  } else {
    const ids = await page.locator('[data-testid^="daily-review-option-"]').evaluateAll((els) => els.map((e) => (e.getAttribute('data-testid') ?? '').replace('daily-review-option-', '')));
    // A shown sound (the letter for this romanization, the read choice of a symbol), else a shown Korean prompt.
    const sound = (await page.getByTestId('daily-review-sound').count()) > 0 ? (await page.getByTestId('daily-review-sound').innerText()).trim() : null;
    const ko = sound !== null ? (items.find((i) => i.romanization === sound && ids.includes(i.id))?.ko ?? sound) : ((await page.getByTestId('daily-review-prompt').innerText()).split('\n')[0] ?? '').trim();
    const id = items.find((i) => i.ko === ko && ids.includes(i.id))?.id ?? ids.find((x) => items.some((i) => i.id === x && i.ko === ko));
    expect(id, `the prompt ${ko} names an item of the cell`).toBeDefined();
    if (!right) {
      await page.getByTestId(`daily-review-option-${ids.find((x) => x !== id)}`).click();
      await expect(page.getByTestId('daily-review-miss')).toBeVisible();
    }
    await page.getByTestId(`daily-review-option-${id}`).click();
  }
  await expect
    .poll(async () => (await page.getByTestId('cell-check-result').count()) > 0 || (await dots.getAttribute('aria-label', { timeout: 1_000 }).catch(() => null)) !== before, { timeout: 8_000 })
    .toBe(true);
}

/** Plays every round, missing the first `misses` (each wrong first, then right). */
async function play(page: Page, cell: string | readonly string[], misses = 0, max = 10): Promise<number> {
  await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', 'Round 1');
  let n = 0;
  while ((await page.getByTestId('cell-check-result').count()) === 0) {
    await answer(page, cell, n >= misses);
    n += 1;
    expect(n).toBeLessThanOrEqual(max);
  }
  return n;
}

test.describe('the Cell Check', () => {
  test('320: the block after the first volume, 10 rounds, 3 stars, cellCheckAt and Cell Check done; no score anywhere', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const id = await learner(page);
    await openCell(page, 'Food & Daily Life');
    const block = page.getByTestId('cell-check-block');
    await expect(block).toBeVisible();
    await expect(block.getByText('Cell Check', { exact: true })).toBeVisible();
    await expect(page.getByTestId('cell-check-mastery')).toHaveAccessibleName('Done. Keep reviewing to reach Practiced.');
    await expectNoHorizontalOverflow(page);
    await block.scrollIntoViewIfNeeded();
    await shot(page, 'cell-check-block-320');
    await page.getByRole('button', { name: 'Take the Cell Check' }).click();
    await expect(page.getByTestId('cell-check-intro')).toBeVisible();
    await expect(page.getByTestId('cell-check-intro').getByText('About 3 minutes. Show what you know from this place. No timer.')).toBeVisible();
    await shot(page, 'cell-check-intro-320');
    await page.getByTestId('cell-check-go').click();
    await shot(page, 'cell-check-round-320');
    const rounds = await play(page, DONE_CELL);
    expect(rounds).toBe(10);
    await expect(page.getByTestId('cell-check-headline')).toHaveText('Wonderful!');
    await expect(page.getByTestId('cell-check-stars')).toHaveAccessibleName('3 stars');
    const text = await page.getByTestId('cell-check-result').innerText();
    expect(text).not.toMatch(/%|\d+\s*(of|\/)\s*\d+|fail|test/i);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'cell-check-result-320');
    // The entry, the latch and the answers in the memory store (each first answer recorded as given).
    await expect.poll(async () => (await readStored<{ cellCheckAt?: Record<string, string> }>(page, `progress:${id}`))?.cellCheckAt?.[DONE_CELL]).toBeTruthy();
    const snap = await readStored<{ reviews: Array<{ kind: string; scope: string; resultStars: number }> }>(page, `progress:${id}`);
    expect(snap?.reviews.filter((r) => r.kind === 'cell-check')).toEqual([expect.objectContaining({ scope: DONE_CELL, resultStars: 3 })]);
    await expect.poll(async () => Object.keys((await readStored<{ rows: Record<string, unknown> }>(page, `memory:${id}`))?.rows ?? {}).length).toBeGreaterThan(0);
    // Back to this place: Cell Check done and Take it again (its own words: each quest row has a Play again).
    await page.getByTestId('cell-check-to-place').click();
    await expect(page.getByTestId('cell-check-done')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take it again' })).toBeVisible();
  });

  test('wide: the block and a round on the bigger layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await learner(page);
    await openCell(page, 'Food & Daily Life');
    await expect(page.getByTestId('cell-check-block')).toBeVisible();
    await shot(page, 'cell-check-block-wide');
    await page.getByRole('button', { name: 'Take the Cell Check' }).click();
    await page.getByTestId('cell-check-go').click();
    await expect(page.getByTestId('daily-review-round')).toBeVisible();
    await shot(page, 'cell-check-round-wide');
  });

  test('3 misses: 2 stars, the calm lines, the entry and no latch', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const id = await learner(page);
    await openCell(page, 'Food & Daily Life');
    await page.getByRole('button', { name: 'Take the Cell Check' }).click();
    await page.getByTestId('cell-check-go').click();
    await play(page, DONE_CELL, 3);
    await expect(page.getByTestId('cell-check-stars')).toHaveAccessibleName('2 stars');
    await expect(page.getByTestId('cell-check-tricky')).toContainText('Your best result is kept.');
    const snap = await readStored<{ cellCheckAt?: Record<string, string>; reviews: Array<{ kind: string }> }>(page, `progress:${id}`);
    expect(snap?.cellCheckAt?.[DONE_CELL]).toBeUndefined();
    expect(snap?.reviews.filter((r) => r.kind === 'cell-check')).toHaveLength(1);
    await shot(page, 'cell-check-result-two-320');
  });
});

test.describe('Test out', () => {
  test('an unstarted cell: the line under the quests, a pass latches testedOut, Tested out with 2 stars, the next lesson moves on', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const id = await learner(page);
    await openCell(page, OPEN_THEME, 3);
    const line = page.getByTestId('cell-check-test-out-line');
    await expect(line).toBeVisible();
    await expect(line).toContainText('Already know this?');
    // Never above the first quest's Start.
    const start = await page.getByRole('button', { name: 'Start' }).first().boundingBox();
    expect((await line.boundingBox())?.y ?? 0).toBeGreaterThan(start?.y ?? 0);
    await line.scrollIntoViewIfNeeded();
    await shot(page, 'test-out-line-320');
    await page.getByTestId('cell-check-test-out').click();
    await expect(page.getByTestId('cell-check-title')).toHaveText('Test out');
    await expect(page.getByText(/this place is marked Done/)).toBeVisible();
    await page.getByTestId('cell-check-go').click();
    await play(page, OPEN_CELL);
    await expect(page.getByTestId('cell-check-headline')).toHaveText('You tested out!');
    await shot(page, 'test-out-result-320');
    await expect.poll(async () => (await readStored<{ testedOut?: Record<string, string> }>(page, `progress:${id}`))?.testedOut?.[OPEN_CELL]).toBeTruthy();
    const snap = await readStored<{ cellCheckAt?: Record<string, string>; questDoneAt?: Record<string, string> }>(page, `progress:${id}`);
    // A passed test-out never writes cellCheckAt or a quest's done mark.
    expect(snap?.cellCheckAt?.[OPEN_CELL]).toBeUndefined();
    for (const q of questsOf(OPEN_CELL)) expect(snap?.questDoneAt?.[q]).toBeUndefined();
    // The next lesson is past the tested-out cell: Stage 3 Letters was the route's next, Stage 3 Food is now.
    await page.getByTestId('cell-check-next').click();
    await expect(page.getByTestId(`episode-quest-${questsOf(NEXT_CELL)[0]}`)).toBeVisible();
    await expect(page.getByTestId(`episode-quest-${questsOf(OPEN_CELL)[0]}`)).toBeHidden();
    // Back on the tested-out cell: every quest shows Tested out and 2 stars, and stays playable.
    await page.goto('/');
    await openCell(page, OPEN_THEME, 3);
    await expect(page.getByTestId('episode-tested-out')).toHaveCount(questsOf(OPEN_CELL).length);
    await expect(page.getByTestId('cell-check-test-out-line')).toHaveCount(0);
    await shot(page, 'tested-out-quests-320');
  });

  test('a stopped test-out writes nothing', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const id = await learner(page);
    const memoryBefore = await readStored<{ rows: Record<string, unknown> }>(page, `memory:${id}`);
    await openCell(page, OPEN_THEME, 3);
    await page.getByTestId('cell-check-test-out').click();
    await page.getByTestId('cell-check-go').click();
    await answer(page, OPEN_CELL, true);
    await page.getByTestId('daily-review-close').click();
    await expect(page.getByText('Stop the check?')).toBeVisible();
    await shot(page, 'cell-check-stop-320');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.getByTestId('cell-check-test-out-line')).toBeVisible();
    const snap = await readStored<{ testedOut?: Record<string, string>; reviews: Array<{ kind: string }> }>(page, `progress:${id}`);
    expect(snap?.testedOut).toBeUndefined();
    expect(snap?.reviews.filter((r) => r.kind === 'cell-check')).toEqual([]);
    const rows = (await readStored<{ rows: Record<string, unknown> }>(page, `memory:${id}`))?.rows ?? {};
    for (const item of cellItems(OPEN_CELL)) if (!(item.id in (memoryBefore?.rows ?? {}))) expect(rows[item.id], item.id).toBeUndefined();
  });

  test('offline: after one online visit the test-out plays and latches with the network gone', async ({ page, context }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const id = await learner(page);
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active && !!navigator.serviceWorker.controller), { timeout: 30_000 }).toBe(true);
    // One online visit loads the chunks the Check needs into the precache.
    await openCell(page, OPEN_THEME, 3);
    await expect(page.getByTestId('cell-check-test-out')).toBeVisible();
    await context.setOffline(true);
    await page.getByTestId('cell-check-test-out').click();
    await page.getByTestId('cell-check-go').click();
    await play(page, OPEN_CELL);
    await expect(page.getByTestId('cell-check-headline')).toHaveText('You tested out!');
    await expect.poll(async () => (await readStored<{ testedOut?: Record<string, string> }>(page, `progress:${id}`))?.testedOut?.[OPEN_CELL]).toBeTruthy();
    await context.setOffline(false);
  });
});

test.describe('cellCheck off (section 12.2)', () => {
  test('no block button and no Test out line; a tested-out mark stays in the record and stays drawn (the route skips it)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const id = await learner(page, { ...ON, cellCheck: { on: true, pct: 0 }, mastery: { on: true, pct: 0 } });
    const snap = await readStored<Record<string, unknown>>(page, `progress:${id}`);
    await seedStored(page, `progress:${id}`, { ...snap, testedOut: { [OPEN_CELL]: AT } });
    await page.reload();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await openCell(page, 'Food & Daily Life');
    await expect(page.getByRole('heading', { name: /Quests/ })).toBeVisible();
    await expect(page.getByTestId('cell-check-block')).toHaveCount(0);
    await page.goto('/');
    await openCell(page, OPEN_THEME, 3);
    await expect(page.getByRole('heading', { name: /Quests/ })).toBeVisible();
    await expect(page.getByTestId('cell-check-test-out-line')).toHaveCount(0);
    await expect(page.getByTestId('episode-tested-out')).toHaveCount(questsOf(OPEN_CELL).length);
    expect((await readStored<{ testedOut?: Record<string, string> }>(page, `progress:${id}`))?.testedOut?.[OPEN_CELL]).toBe(AT);
  });
});

test.describe('text size Largest at 320 x 568 (the fit rule)', () => {
  test('English: the block, the Test out line, the intro and the result fit', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await learner(page, ON, { uiLocale: 'en', textSize: 'largest' });
    await closeInstallGuide(page);
    await openCell(page, 'Food & Daily Life');
    await expect(page.getByTestId('cell-check-block')).toBeVisible();
    await expectTextFits(page, 'the Cell Check block');
    await page.goto('/');
    await openCell(page, OPEN_THEME, 3);
    await page.getByTestId('cell-check-test-out-line').scrollIntoViewIfNeeded();
    await expectTextFits(page, 'the Test out line');
    await page.getByTestId('cell-check-test-out').click();
    await expect(page.getByTestId('cell-check-intro')).toBeVisible();
    await expectTextFits(page, 'the test-out intro');
    await page.getByTestId('cell-check-go').click();
    await play(page, OPEN_CELL);
    await expect(page.getByTestId('cell-check-result')).toBeVisible();
    await expectTextFits(page, 'the test-out result');
    await shot(page, 'cell-check-largest-result-320');
  });

  test('Spanish: the block, the Test out line and the intro fit', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await learner(page, ON, { uiLocale: 'es', textSize: 'largest' });
    await closeInstallGuide(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await page.getByText('Recorrido', { exact: true }).last().click();
    await page.getByRole('button', { name: /^Etapa 2 [^,]+, Food & Daily Life/ }).click();
    await expect(page.getByTestId('cell-check-block')).toBeVisible();
    await expect(page.getByTestId('cell-check-block')).toContainText('Repaso a fondo');
    await expectTextFits(page, 'the Cell Check block (es)');
    await page.getByTestId('cell-check-start').click();
    await expect(page.getByTestId('cell-check-intro')).toBeVisible();
    await expectTextFits(page, 'the Cell Check intro (es)');
  });
});

/**
 * Row CM-25: Stage Jump Ahead, the test-out rule over a whole stage, from the Journey stage header of the stage the
 * route has reached. A pass latches `testedOut` for every cell of the stage and the stage key (never `questDoneAt` or
 * `cellCheckAt`), every quest shows Tested out, and the next lesson is past the stage.
 */
test.describe('Stage Jump Ahead (row CM-25)', () => {
  // Stage 3: every Stage 2 cell holds too many topic words for Test out (CM-21's limit), so Stage 2 has no jump today.
  const STAGE3 = CATALOG.cells.filter((c) => /^episode:stage3-[a-z]+$/.test(c.episodeId) && c.questIds.length > 0 && (c.status === 'shipped' || c.status === 'ready')).map((c) => c.episodeId);

  /** Sora: every Stage 1 and Stage 2 quest done (seeded), Stage 3 not started. */
  async function jumper(page: Page, flags: Flags = ON): Promise<string> {
    await onboardChild(page, { name: 'Sora', startJourney: false });
    await page.goto('/');
    await expect(page.getByText('Hi, Sora!')).toBeVisible();
    const id = (await readStored<string>(page, 'profiles:active')) as string;
    const questDoneAt = Object.fromEntries(doneBefore.flatMap(questsOf).map((q) => [q, AT]));
    const quests = doneBefore.flatMap((cell) => questsOf(cell).map((questId) => ({ questId, episodeId: cell, startedAt: AT, completedAt: AT, stars: 2, attempts: 1, accuracy: 0.9 })));
    await seedStored(page, `progress:${id}`, { profileId: id, updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, questDoneAt, memSeededAt: AT });
    await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags });
    await page.reload();
    await expect(page.getByText('Hi, Sora!')).toBeVisible();
    return id;
  }

  const journey = async (page: Page): Promise<void> => {
    await page.getByText('Journey', { exact: true }).last().click();
    await expect(page.getByTestId('journey-stage-stage3')).toBeVisible();
  };

  test('320: the line on the reached stage only, 20 rounds, You jumped ahead!, every cell tested out, the next lesson past the stage', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const id = await jumper(page);
    await journey(page);
    const line = page.getByTestId('journey-stage-jump-stage3');
    await expect(line).toBeVisible();
    await expect(line).toContainText('Already know this stage?');
    await expect(page.getByTestId('journey-stage-jump')).toHaveAccessibleName(/^Jump ahead past Stage 3: /);
    // Only the reached stage: Stage 2 is done, and Stage 4 has no line while Stage 3 is not covered.
    await expect(page.getByTestId('journey-stage-jump-stage2')).toHaveCount(0);
    await expect(page.getByTestId('journey-stage-jump-stage4')).toHaveCount(0);
    await line.scrollIntoViewIfNeeded();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'stage-jump-line-320');
    await page.getByTestId('journey-stage-jump').click();
    await expect(page.getByTestId('cell-check-title')).toHaveText('Jump ahead');
    await expect(page.getByText(/every place in this stage is marked Done/)).toBeVisible();
    await shot(page, 'stage-jump-intro-320');
    await page.getByTestId('cell-check-go').click();
    const rounds = await play(page, STAGE3, 0, 20);
    expect(rounds).toBe(20);
    await expect(page.getByTestId('cell-check-headline')).toHaveText('You jumped ahead!');
    await expect(page.getByTestId('cell-check-stars')).toHaveAccessibleName('3 stars');
    expect(await page.getByTestId('cell-check-result').innerText()).not.toMatch(/%|\d+\s*(of|\/)\s*\d+|fail|test|exam/i);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'stage-jump-result-320');
    // The latch: every cell of the stage and the stage key; never a quest's done mark or cellCheckAt.
    await expect.poll(async () => (await readStored<{ testedOut?: Record<string, string> }>(page, `progress:${id}`))?.testedOut?.stage3).toBeTruthy();
    const snap = await readStored<{ testedOut?: Record<string, string>; cellCheckAt?: Record<string, string>; questDoneAt?: Record<string, string>; reviews: Array<{ kind: string; scope: string }> }>(page, `progress:${id}`);
    for (const cell of STAGE3) expect(snap?.testedOut?.[cell], cell).toBe(snap?.testedOut?.stage3);
    expect(snap?.cellCheckAt).toBeUndefined();
    for (const q of STAGE3.flatMap(questsOf)) expect(snap?.questDoneAt?.[q]).toBeUndefined();
    expect(snap?.reviews.filter((r) => r.kind === 'cell-check')).toEqual([expect.objectContaining({ scope: 'stage3' })]);
    // The next lesson is past the jumped stage.
    await page.getByTestId('cell-check-next').click();
    await expect(page.locator('[data-testid^="episode-quest-quest:stage4-"]').first()).toBeVisible();
    // Back on the map: Stage 3 has no line any more; Stage 4, now reached, offers its own.
    await page.goto('/');
    await journey(page);
    await expect(page.getByTestId('journey-stage-jump-stage3')).toHaveCount(0);
    await expect(page.getByTestId('journey-stage-jump-stage4')).toBeVisible();
    // A jumped cell's quests show Tested out with 2 stars.
    await page.getByRole('button', { name: journeyCellName(3, OPEN_THEME) }).click();
    await expect(page.getByTestId('episode-tested-out')).toHaveCount(questsOf(OPEN_CELL).length);
    await shot(page, 'stage-jump-tested-out-320');
  });

  test('wide: the line under the stage on the bigger layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await jumper(page);
    await journey(page);
    await expect(page.getByTestId('journey-stage-jump-stage3')).toBeVisible();
    await page.getByTestId('journey-stage-jump-stage3').scrollIntoViewIfNeeded();
    await shot(page, 'stage-jump-line-wide');
  });

  test('cellCheck off (section 12.2): no Jump ahead line', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await jumper(page, { ...ON, cellCheck: { on: true, pct: 0 } });
    await journey(page);
    await expect(page.getByTestId('journey-stage-stage3')).toBeVisible();
    await expect(page.getByTestId('journey-stage-jump')).toHaveCount(0);
  });
});
