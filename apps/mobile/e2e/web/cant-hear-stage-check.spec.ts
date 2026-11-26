import type { Page } from '@playwright/test';
import { CATALOG, keysFor } from '@hangul-route/content-schema';
import { decodeReviewItems } from '@hangul-route/content-schema/review-items';
import * as chunk from '../../src/content/__generated__/review-item-chunks/review-items';
import { expect, test } from './fixtures';
import { onboardChild, pastTapLock, readStored, seedStored, tapHangulKey } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * AMENDMENTS-AUDIO-CANT-HEAR row CH-1e, review of the PR (owner decision 2026-11-25), and AMENDMENTS-STAGE1-DECODING-CHECK
 * row DC-1b: the Stage Check holds every round's romanization until it is answered (there is no switch for it). A heard
 * pick round holds its options' romanization, "Can't hear it?" is there, and Show the letters prints the prompt's
 * romanization only, which matches no option on screen. The Stage Check is played to its first heard pick round (the plan is not fixed), the rounds before it
 * answered from the stage's items. A device with a Korean voice that "plays", so rounds are heard.
 */

test.use({ timezoneId: 'UTC' });

const ITEMS = decodeReviewItems(chunk);
const AT = '2026-10-01T10:00:00.000Z';
const cellsOf = (stage: number): string[] => CATALOG.cells.filter((c) => c.episodeId.startsWith(`episode:stage${stage}-`)).map((c) => c.episodeId);
const questsOf = (cell: string): string[] => CATALOG.cells.find((c) => c.episodeId === cell)?.questIds ?? [];
const STAGE2 = cellsOf(2);
const stageItems = ITEMS.filter((i) => i.cells.some((c) => STAGE2.includes(c)));
const HANGUL = /[ㄱ-ㆎ가-힣]/;
const SIZES = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
] as const;

async function koreanVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: SpeechSynthesisUtterance) => {
          setTimeout(() => {
            u.onstart?.call(u, new Event('start') as SpeechSynthesisEvent);
            u.onend?.call(u, new Event('end') as SpeechSynthesisEvent);
          }, 0);
        },
        cancel: () => undefined,
        getVoices: () => [{ name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

async function learner(page: Page, extraFlags: Record<string, { on: boolean; pct: number }> = {}): Promise<void> {
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
    stageCeremonyAt: { stage2: AT },
  });
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { memoryRecord: { on: true, pct: 100 }, stageChecks: { on: true, pct: 100 }, mastery: { on: true, pct: 100 }, ...extraFlags } });
  await page.reload();
}

const SHIFTED: Record<string, string> = { 'ㅃ': 'ㅂ', 'ㅉ': 'ㅈ', 'ㄸ': 'ㄷ', 'ㄲ': 'ㄱ', 'ㅆ': 'ㅅ', 'ㅒ': 'ㅐ', 'ㅖ': 'ㅔ' };
const SPLIT: Record<string, string> = { 'ㅘ': 'ㅗㅏ', 'ㅙ': 'ㅗㅐ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅔ', 'ㅟ': 'ㅜㅣ', 'ㅢ': 'ㅡㅣ' };

async function typeKorean(page: Page, text: string): Promise<void> {
  for (const jamo of keysFor(text).flatMap((j) => [...(SPLIT[j] ?? j)])) {
    if (jamo === ' ') await tapHangulKey(page, 'space');
    else if (SHIFTED[jamo]) {
      await tapHangulKey(page, 'shift');
      await tapHangulKey(page, SHIFTED[jamo]);
    } else await tapHangulKey(page, jamo);
  }
}

/** Moves on from the round on screen, answered right: a heard pick by trying its options, the others from the stage's items. */
async function moveOn(page: Page): Promise<void> {
  const dots = page.getByTestId('daily-review-dots');
  const before = await dots.getAttribute('aria-label');
  const options = page.locator('[data-testid^="daily-review-option-"]');
  if ((await page.getByTestId('daily-review-typed').count()) > 0) {
    let target = (await page.getByTestId('daily-review-type-target').count()) > 0 ? ((await page.getByTestId('daily-review-type-target').innerText()).split('\n')[0] ?? '').trim() : '';
    if (target === '') {
      const labels = await page.getByTestId('daily-review-round').locator('[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
      target = stageItems.find((i) => i.en !== undefined && labels.includes(i.en))?.ko ?? '';
    }
    await typeKorean(page, target === '' ? 'ㅋㅋㅋㅋ' : target);
    await page.getByTestId('daily-review-type-done').click();
    if (target === '') {
      const miss = page.getByTestId('daily-review-miss');
      await expect(miss).toBeVisible();
      target = ((await miss.innerText()).match(/[가-힣]+(?: [가-힣]+)*/g) ?? []).sort((a, b) => b.length - a.length)[0] ?? '';
      await typeKorean(page, target);
      await page.getByTestId('daily-review-type-done').click();
    }
  } else if ((await page.locator('[data-testid^="daily-review-tile-"]').count()) > 0) {
    const tiles = await page.locator('[data-testid^="daily-review-tile-"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    const sorted = [...tiles].sort().join('|');
    const item = stageItems.find((i) => (i.reply?.ko ?? i.ko).split(' ').sort().join('|') === sorted);
    for (const w of (item?.reply?.ko ?? item?.ko ?? '').split(' ')) await page.getByTestId('daily-review-round').getByRole('button', { name: w, exact: true, disabled: false }).first().click();
  } else {
    // A pick round: try the options in turn until the round moves (a miss keeps the round open).
    const n = await options.count();
    for (let i = 0; i < n; i += 1) {
      await pastTapLock(page);
      await options.nth(i).click();
      if ((await dots.getAttribute('aria-label', { timeout: 1_500 }).catch(() => before)) !== before) break;
    }
  }
  await expect.poll(async () => (await page.getByTestId('stage-check-pause').count()) > 0 || (await dots.getAttribute('aria-label', { timeout: 1_000 }).catch(() => null)) !== before, { timeout: 10_000 }).toBe(true);
}

/** Plays the Stage Check until a heard round of the wanted kind (`pick` or `dictation`) with the link is on screen. */
async function toHeardPick(page: Page, want: 'pick' | 'dictation' = 'pick'): Promise<void> {
  // The produce rung is Dictation only with `game.type-hangul-hear` on (row CM-31).
  await learner(page, want === 'dictation' ? { 'game.type-hangul-hear': { on: true, pct: 100 } } : {});
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByTestId('journey-stage-check-stage2').click();
  await expect(page.getByTestId('stage-check-intro')).toBeVisible();
  // No attempt switch on the intro (DC-1b).
  await expect(page.getByRole('switch', { name: 'Reading practice: hide the romanization until I tap' })).toHaveCount(0);
  await page.getByTestId('stage-check-go').click();
  await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', 'Round 1');
  for (let round = 0; round < 20; round += 1) {
    if ((await page.getByTestId('stage-check-pause').count()) > 0) {
      await page.getByTestId('stage-check-keep-going').click();
      await expect(page.getByTestId('daily-review-dots')).toHaveAttribute('aria-label', 'Round 1');
    }
    await expect(page.getByTestId('daily-review-round')).toBeVisible();
    await page.waitForTimeout(400);
    if ((await page.getByTestId('cant-hear').count()) > 0) {
      if (want === 'dictation' && (await page.getByTestId('daily-review-dictation-speaker').count()) > 0) return;
      if (want === 'pick' && (await page.getByTestId('daily-review-hear-again').count()) > 0 && (await page.locator('[data-testid^="daily-review-option-"]').count()) > 0) return;
    }
    await moveOn(page);
  }
  throw new Error(`no heard ${want} round came up in the Stage Check`);
}

for (const size of SIZES) {
  test(`the Stage Check at ${size.width} x ${size.height} holds the options' romanization, Show the letters prints the romanization only`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await koreanVoice(page);
    await page.setViewportSize(size);
    await toHeardPick(page);
    const options = page.locator('[data-testid^="daily-review-option-"]');
    const count = await options.count();
    // Held: every option's romanization line is the reserved, invisible one, and none is drawn.
    await expect(options.locator('[data-testid="korean-text-romanization-reserved"]')).toHaveCount(count);
    await shot(page, `ch-1e-stage-check-link-${size.width}x${size.height}`);

    await page.getByTestId('cant-hear').click();
    await page.getByTestId('cant-hear-show-letters').click();
    const asked = page.getByTestId('daily-review-prompt-panel-text');
    await expect(asked).toBeVisible();
    const sound = (await asked.innerText()).trim();
    expect(sound).toMatch(/^[A-Za-z/]+$/);
    expect(sound).not.toMatch(HANGUL);
    // The asked romanization matches no option text on screen: the options draw their Hangul only.
    const labels = await options.evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText));
    for (const text of labels) expect(text.replace(/\s+/g, ' ')).toMatch(HANGUL);
    await expect(page.getByTestId('cant-hear')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await shot(page, `ch-1e-stage-check-asked-${size.width}x${size.height}`);
    expect(errors).toEqual([]);
  });
}

test('the Stage Check holds the options of a heard pick round until one is answered, then shows their romanization', async ({ page }) => {
  test.setTimeout(240_000);
  await koreanVoice(page);
  await page.setViewportSize(SIZES[1]);
  await toHeardPick(page);
  const options = page.locator('[data-testid^="daily-review-option-"]');
  await expect(options.locator('[data-testid="korean-text-romanization-reserved"]')).toHaveCount(await options.count());
  // A miss does not end the hold; the right answer does. Try the options in turn until the held lines come.
  const n = await options.count();
  let revealed = false;
  for (let i = 0; i < n && !revealed; i += 1) {
    await pastTapLock(page);
    await options.nth(i).click();
    // Answered right: the held lines are gone and the options show their romanization (read before the round moves on).
    if ((await page.locator('[data-testid="korean-text-romanization-reserved"]').count()) === 0) {
      revealed = true;
      const shown = await options.evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText));
      for (const text of shown) expect(text.replace(/\s+/g, ' ')).toMatch(/[A-Za-z]/);
    }
  }
  expect(revealed).toBe(true);
});

// CH-1g (owner decision 2026-11-25): a Check's Dictation hear round has the link, but its sheet is guidance only, since
// Show the letters would print the word the learner has to type.
for (const size of SIZES) {
  test(`the Stage Check's Dictation hear round at ${size.width} x ${size.height}: the sheet is guidance only, Hear it plays, the word is never printed`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await koreanVoice(page);
    await page.setViewportSize(size);
    await toHeardPick(page, 'dictation');
    await expect(page.getByTestId('daily-review-type-target')).toHaveCount(0);
    await page.getByTestId('cant-hear').click();
    await expect(page.getByTestId('cant-hear-sheet')).toBeVisible();
    await expect(page.getByTestId('cant-hear-show-letters')).toHaveCount(0);
    await expect(page.getByTestId('cant-hear-hear')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, `ch-1g-stage-check-dictation-${size.width}x${size.height}`);
    await page.getByTestId('cant-hear-hear').click();
    await expect(page.getByTestId('cant-hear-sheet')).toHaveCount(0);
    await expect(page.getByTestId('daily-review-type-target')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
