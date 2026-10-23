import type { Page } from '@playwright/test';
import { CATALOG, keysFor } from '@hangul-route/content-schema';
import { decodeReviewItems } from '@hangul-route/content-schema/review-items';
import * as chunk from '../../src/content/__generated__/review-item-chunks/review-items';
import { expect, test } from './fixtures';
import { onboardChild, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 sections 4.5, 4.8 step 7, 7.3, 7.7, 12.2 and 14, row CM-22 (design/wireframes/reviews/stage-check.md): a
 * learner who finished Stage 2 before this build sees the one retroactive summary once (it latches `stageCeremonyAt`),
 * then reopens the Stage 2 ceremony from the Journey header, takes the Stage Check (about 20 rounds in parts of 5 with
 * pauses), sees stars and "Your best result is kept", and the header carries the best stars. With `stageChecks` off
 * nothing shows and the latched results stay. `stageChecks` ships at built-in pct 0, so each case turns it on through
 * the stored remote copy, with `memoryRecord`. This browser has no Korean voice (the fixture's silent engine): every
 * heard round is a read round.
 *
 *   HR_SHOTS=1 pnpm --filter @hangul-route/mobile test:e2e:web stage-check
 */

test.use({ timezoneId: 'UTC' });

const ITEMS = decodeReviewItems(chunk);
const AT = '2026-10-01T10:00:00.000Z';
const cellsOf = (stage: number): string[] => CATALOG.cells.filter((c) => c.episodeId.startsWith(`episode:stage${stage}-`)).map((c) => c.episodeId);
const questsOf = (cell: string): string[] => CATALOG.cells.find((c) => c.episodeId === cell)?.questIds ?? [];
const STAGE2 = cellsOf(2);

type Flags = Record<string, { on: boolean; pct: number }>;
const ON: Flags = { memoryRecord: { on: true, pct: 100 }, stageChecks: { on: true, pct: 100 }, mastery: { on: true, pct: 100 } };

/** Dami: Stages 1 and 2 done (seeded on an older build: no stageCeremonyAt). */
async function learner(page: Page, flags: Flags = ON, extra: Record<string, unknown> = {}): Promise<string> {
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  const cells = [...cellsOf(1), ...STAGE2];
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
    ...extra,
  });
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags });
  await page.reload();
  return id;
}

const stageItems = ITEMS.filter((i) => i.cells.some((c) => STAGE2.includes(c)));
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

/** Answers the round on screen from the stage's items: right on the first try, or wrong first and then right. */
async function answer(page: Page, right: boolean): Promise<void> {
  const round = page.getByTestId('daily-review-round');
  await expect(round).toBeVisible();
  const dots = page.getByTestId('daily-review-dots');
  const before = await dots.getAttribute('aria-label');
  if ((await page.getByTestId('daily-review-typed').count()) > 0) {
    let target = (await page.getByTestId('daily-review-type-target').count()) > 0 ? ((await page.getByTestId('daily-review-type-target').innerText()).split('\n')[0] ?? '').trim() : '';
    if (target === '') {
      const labels = await round.locator('[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
      target = stageItems.find((i) => i.en !== undefined && labels.includes(i.en))?.ko ?? '';
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
    const item = stageItems.find((i) => (i.reply?.ko ?? i.ko).split(' ').sort().join('|') === sorted);
    const words = (item?.reply?.ko ?? item?.ko ?? '').split(' ');
    if (!right) {
      const wrong = tiles.find((t) => t !== words[0]);
      if (wrong) await round.getByRole('button', { name: wrong, exact: true }).first().click();
    }
    for (const w of words) await round.getByRole('button', { name: w, exact: true, disabled: false }).first().click();
  } else {
    const ko = ((await page.getByTestId('daily-review-prompt').innerText()).split('\n')[0] ?? '').trim();
    const ids = await page.locator('[data-testid^="daily-review-option-"]').evaluateAll((els) => els.map((e) => (e.getAttribute('data-testid') ?? '').replace('daily-review-option-', '')));
    const id = stageItems.find((i) => i.ko === ko && ids.includes(i.id))?.id ?? ids.find((x) => stageItems.some((i) => i.id === x && i.ko === ko));
    expect(id, `the prompt ${ko} names an item of the stage`).toBeDefined();
    if (!right) {
      await page.getByTestId(`daily-review-option-${ids.find((x) => x !== id)}`).click();
      await expect(page.getByTestId('daily-review-miss')).toBeVisible();
    }
    await page.getByTestId(`daily-review-option-${id}`).click();
  }
  const moved = async (): Promise<boolean> =>
    (await page.getByTestId('stage-check-result').count()) > 0 ||
    (await page.getByTestId('stage-check-pause').count()) > 0 ||
    (await dots.getAttribute('aria-label', { timeout: 1_000 }).catch(() => null)) !== before;
  await expect.poll(moved, { timeout: 8_000 }).toBe(true);
}

/** Plays every round and the pauses between parts, missing the first `misses`; returns the rounds and the pauses. */
async function play(page: Page, misses = 0, onPause?: (n: number) => Promise<void>): Promise<{ rounds: number; pauses: number }> {
  await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', 'Round 1');
  let rounds = 0;
  let pauses = 0;
  while ((await page.getByTestId('stage-check-result').count()) === 0) {
    if ((await page.getByTestId('stage-check-pause').count()) > 0) {
      pauses += 1;
      await onPause?.(pauses);
      await page.getByTestId('stage-check-keep-going').click();
      // A new part: its dots start again at round 1, never "n of m".
      await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', 'Round 1');
      continue;
    }
    await answer(page, rounds >= misses);
    rounds += 1;
    expect(rounds).toBeLessThanOrEqual(20);
  }
  return { rounds, pauses };
}

test.describe('the one retroactive summary, the Stage 2 ceremony and the Stage Check', () => {
  test('320: the summary once, the ceremony from the header, 20 rounds in 4 parts, stars, best result kept, the best stars on the header', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 320, height: 800 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const id = await learner(page);

    // G: Home opens the one summary of the stages finished earlier.
    const recap = page.getByTestId('stage-recap');
    await expect(recap).toBeVisible();
    await expect(page.getByTestId('stage-recap-title')).toHaveText('You finished Stage 2 earlier');
    await expect(recap.getByText('Every stage you finished stays on your Journey.')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'stage-recap-320');
    await expect.poll(async () => (await readStored<{ stageCeremonyAt?: Record<string, string> }>(page, `progress:${id}`))?.stageCeremonyAt?.stage2).toBeTruthy();
    await page.getByTestId('stage-recap-home').click();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    // Never shown again: not on the next Home, not after a reload.
    await page.reload();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId('stage-recap')).toHaveCount(0);

    // C: the Journey's Stage 2 header, Complete, with See your prize and Stage Check.
    await page.getByText('Journey', { exact: true }).last().click();
    await expect(page.getByTestId('journey-stage-pill-stage2')).toHaveText('Complete');
    const header = page.getByTestId('journey-stage-stage2');
    await expect(header.getByTestId('journey-stage-prize-stage2')).toBeVisible();
    await expect(header.getByTestId('journey-stage-check-stage2')).toBeVisible();
    await expect(page.getByTestId('journey-stage-prize-stage3')).toHaveCount(0);
    await header.scrollIntoViewIfNeeded();
    await shot(page, 'stage-check-header-320');

    // B: the ceremony.
    await header.getByTestId('journey-stage-prize-stage2').click();
    const ceremony = page.getByTestId('upper-stage-complete');
    await expect(ceremony).toBeVisible();
    await expect(page.getByText('Stage 2 complete!')).toBeVisible();
    await expect(ceremony.getByLabel('Hoya the tiger, cheering')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take the Stage Check' })).toBeVisible();
    await expect(page.getByText('About 7 minutes. You can skip it.')).toBeVisible();
    const copy = await page.locator('body').innerText();
    expect(copy).not.toMatch(/%|\d+\s*\/\s*\d+|premium|price|exam|certificate|\$/i);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'stage-complete-stage2-320');

    // D: the intro.
    await page.getByRole('button', { name: 'Take the Stage Check' }).click();
    await expect(page.getByTestId('stage-check-intro')).toBeVisible();
    await expect(page.getByTestId('stage-check-title')).toHaveText('Stage Check');
    await expect(page.getByText(/About 7 minutes\. Words, sounds and sentences from all five places\. No timer\./)).toBeVisible();
    await shot(page, 'stage-check-intro-320');
    await page.getByTestId('stage-check-go').click();

    // E and E2: four parts of five rounds, a pause between parts, the theme line on each round.
    await expect(page.getByTestId('stage-check-theme')).toBeVisible();
    await shot(page, 'stage-check-round-320');
    const played = await play(page, 0, async (n) => {
      if (n === 1) {
        await expect(page.getByText('Lovely reading! Ready for more?')).toBeVisible();
        await shot(page, 'stage-check-pause-320');
      }
    });
    expect(played).toEqual({ rounds: 20, pauses: 3 });

    // F: stars, then the best result line; never a score.
    await expect(page.getByTestId('stage-check-headline')).toHaveText('Wonderful!');
    await expect(page.getByTestId('stage-check-stars')).toHaveAccessibleName('3 stars');
    await expect(page.getByTestId('stage-check-best')).toHaveText('Your best result is kept.');
    const result = await page.getByTestId('stage-check-result').innerText();
    expect(result).not.toMatch(/%|\d+\s*(of|\/)\s*\d+|fail|test|exam|certificate/i);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'stage-check-result-320');

    // The entry and the latch.
    await expect.poll(async () => (await readStored<{ stageCheckAt?: Record<string, string> }>(page, `progress:${id}`))?.stageCheckAt?.stage2).toBeTruthy();
    const snap = await readStored<{ reviews: Array<{ kind: string; scope: string; resultStars: number }> }>(page, `progress:${id}`);
    expect(snap?.reviews.filter((r) => r.kind === 'stage-certificate')).toEqual([expect.objectContaining({ scope: 'stage2', resultStars: 3 })]);

    // The header carries the best stars; Stage 3 is unchanged (the check never gates).
    await page.getByTestId('stage-check-home').click();
    await page.getByText('Journey', { exact: true }).last().click();
    await expect(page.getByTestId('journey-stage-check-stage2')).toHaveAccessibleName('Stage Check, best 3 stars');
    await page.getByTestId('journey-stage-stage2').scrollIntoViewIfNeeded();
    await shot(page, 'stage-check-header-best-320');
    expect(errors).toEqual([]);
  });

  test('wide, reduced motion: the ceremony is all there at once, and a round on the bigger layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await learner(page, ON, { stageCeremonyAt: { stage2: AT } });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByTestId('journey-stage-prize-stage2').click();
    await expect(page.getByTestId('upper-stage-complete-title')).toBeVisible();
    await expect(page.getByTestId('upper-stage-complete-title')).toHaveCSS('opacity', '1');
    await shot(page, 'stage-complete-stage2-wide');
    await page.getByRole('button', { name: 'Take the Stage Check' }).click();
    await page.getByTestId('stage-check-go').click();
    await expect(page.getByTestId('daily-review-round')).toBeVisible();
    await shot(page, 'stage-check-round-wide');
  });

  test('a stopped check keeps nothing but the answers: no entry and no latch; taken again with misses, the best stars stay', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 320, height: 800 });
    const best = { id: 'stage-check:stage2:2026-10-01:a', kind: 'stage-certificate', generatedAt: AT, scope: 'stage2', itemIds: [], resultStars: 3 };
    const id = await learner(page, ON, { stageCeremonyAt: { stage2: AT }, stageCheckAt: { stage2: AT }, reviews: [best] });
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByTestId('journey-stage-check-stage2').click();
    await page.getByTestId('stage-check-go').click();
    await answer(page, true);
    await page.getByTestId('daily-review-close').click();
    await expect(page.getByText('Stop the check?')).toBeVisible();
    await shot(page, 'stage-check-stop-320');
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    let snap = await readStored<{ stageCheckAt?: Record<string, string>; reviews: Array<{ kind: string }> }>(page, `progress:${id}`);
    expect(snap?.reviews.filter((r) => r.kind === 'stage-certificate')).toHaveLength(1);
    expect(snap?.stageCheckAt?.stage2).toBe(AT);
    // Again, with 8 misses: 2 stars on the result, 3 stars kept on the header.
    await page.getByTestId('journey-stage-check-stage2').click();
    await page.getByTestId('stage-check-go').click();
    await play(page, 8);
    await expect(page.getByTestId('stage-check-stars')).toHaveAccessibleName(/[12] stars?/);
    await expect(page.getByTestId('stage-check-tricky')).toBeVisible();
    snap = await readStored<{ stageCheckAt?: Record<string, string>; reviews: Array<{ kind: string }> }>(page, `progress:${id}`);
    expect(snap?.reviews.filter((r) => r.kind === 'stage-certificate')).toHaveLength(2);
    expect(snap?.stageCheckAt?.stage2).toBe(AT);
    await page.getByTestId('stage-check-home').click();
    await page.getByText('Journey', { exact: true }).last().click();
    await expect(page.getByTestId('journey-stage-check-stage2')).toHaveAccessibleName('Stage Check, best 3 stars');
  });
});

test.describe('stageChecks off (section 12.2)', () => {
  test('no summary, no prize or check buttons; the latched results stay in the record', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const id = await learner(page, { ...ON, stageChecks: { on: true, pct: 0 } }, { stageCheckAt: { stage2: AT } });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId('stage-recap')).toHaveCount(0);
    await page.getByText('Journey', { exact: true }).last().click();
    await expect(page.getByTestId('journey-stage-pill-stage2')).toHaveText('Complete');
    await expect(page.getByTestId('journey-stage-prize-stage2')).toHaveCount(0);
    await expect(page.getByTestId('journey-stage-check-stage2')).toHaveCount(0);
    const snap = await readStored<{ stageCheckAt?: Record<string, string>; stageCeremonyAt?: Record<string, string> }>(page, `progress:${id}`);
    expect(snap?.stageCheckAt?.stage2).toBe(AT);
    expect(snap?.stageCeremonyAt).toBeUndefined();
  });
});
