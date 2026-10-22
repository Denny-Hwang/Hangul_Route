import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, passDiscover, playCheck, readStored, seedStored } from './helpers';

/**
 * F-CURR-002 section 4.5 (row CM-15) on the web PWA: the quest warm-up before a Stage 2+ quest's first step and
 * Try these again on the reward step, each behind its switch (`questWarmup`, `missedPractice`, with `memoryRecord`).
 * The remote copy is the stored one: this build has no API. The e2e browser has no Korean voice (the silent
 * engine of ./fixtures), so every round is a reading round and the sound notice shows.
 */

interface StoredMemory {
  rows: Record<string, { sh: string; st: { b: number; n: number; d: string | null } }>;
  seededFrom: string | null;
}
interface StoredProgress {
  memSeededAt?: string;
  reviews: Array<{ id: string; kind: string; resultStars?: number; itemIds: string[] }>;
}

/** Three Stage 1 Food & Daily Life words the learner met earlier, due today: what a Stage 2 quest warms up with. */
const EARLIER = ['lex:gochu', 'lex:chijeu', 'lex:abeoji'] as const;

const localToday = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

async function onboard(page: Page): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  return profiles?.[0]?.id ?? '';
}

async function switches(page: Page, on: Record<string, boolean>): Promise<void> {
  const flags = Object.fromEntries(Object.entries(on).map(([flag, value]) => [flag, { on: value, pct: 100 }]));
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

async function dismissInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}

/**
 * Answers the session's pick rounds until its end panel (`doneId`) shows: in each round the options in order until
 * one is right (a miss is the amber nudge "Not this one", then the right one). Returns how many rounds there were.
 */
async function answerRounds(page: Page, doneId: string): Promise<number> {
  let rounds = 0;
  while (!(await page.getByTestId(doneId).isVisible())) {
    const round = page.getByTestId('quest-review-round');
    await expect(round).toBeVisible();
    const prompt = (await page.getByTestId('quest-review-prompt-text').first().textContent()) ?? '';
    const options = page.locator('[data-testid^="quest-review-option-"]');
    const count = await options.count();
    for (let i = 0; i < count; i += 1) {
      const option = options.nth(i);
      await option.click();
      const said = (await option.getAttribute('aria-label')) ?? '';
      if (said.startsWith('Right answer')) break;
      // Never red and never a score: a miss reads "Not this one", and the right one then shows "Look here".
      expect(said.startsWith('Not this one')).toBe(true);
    }
    rounds += 1;
    // The next round (a new prompt) or the end panel.
    await expect(async () => {
      if (await page.getByTestId(doneId).isVisible()) return;
      const shown = page.getByTestId('quest-review-prompt-text');
      expect((await shown.count()) > 0 && (await shown.first().textContent()) !== prompt).toBe(true);
    }).toPass({ timeout: 3000 });
    expect(rounds).toBeLessThanOrEqual(8);
  }
  return rounds;
}

async function shots(page: Page, name: string): Promise<void> {
  for (const [label, size] of [
    ['320', { width: 320, height: 720 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    await page.setViewportSize(size);
    await page.screenshot({ path: test.info().outputPath(`${name}-${label}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 393, height: 851 });
}

/** Food & Daily Life quest 1: Discover, skip Match Sound, the Pic-Word board with one first-try miss (젓가락), the Check, then the reward step. */
async function playLifeQuestWithAMiss(page: Page): Promise<void> {
  await dismissInstallGuide(page);
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Food & Daily Life') }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).nth(0).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await expect(headerClose(page)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  // The chopsticks picture, then the kimchi word: a first-try miss on 젓가락.
  await page.getByTestId('pic-word-picture-jeotgarak').click();
  await page.getByTestId('pic-word-word-gimchi').click();
  for (const id of ['gimchi', 'bap', 'gimbap', 'jeotgarak']) {
    await page.getByTestId(`pic-word-picture-${id}`).click();
    await page.getByTestId(`pic-word-word-${id}`).click();
  }
  await playCheck(page);
}

test('the warm-up opens a Stage 2 quest with earlier due words, outside its six steps, then the quest starts as always', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = await onboard(page);
  await switches(page, { memoryRecord: true, questWarmup: true });
  // The one-time seeding latches first (nothing done yet, so nothing is seeded); then three earlier words fall due today.
  await expect.poll(async () => (await readStored<StoredProgress>(page, `progress:${id}`))?.memSeededAt ?? null, { timeout: 10_000 }).not.toBeNull();
  const seededAt = (await readStored<StoredProgress>(page, `progress:${id}`))?.memSeededAt ?? null;
  const today = await localToday(page);
  const rows = Object.fromEntries(
    EARLIER.map((item) => [item, { sh: 'stage1', st: { b: 2, d: today, c: 0, r: 0, n: 2, f: '2026-09-01', s: 2, at: '2026-09-01T09:00:00.000Z' }, l: '2026-09-01' }]),
  );
  await seedStored(page, `memory:${id}`, { v: 1, rows, vf: {}, pending: [], cursor: 0, seededFrom: seededAt, day: null, dailySent: null });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();

  await dismissInstallGuide(page);
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(2, 'Food & Daily Life'), exact: false }).first().click();
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  await anyway.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await anyway.isVisible()) await anyway.click();

  // The warm-up: its own pill and line, fill-only dots, no step counter, the sound notice (no voice here).
  await expect(page.getByText('Warm-up', { exact: true })).toBeVisible();
  await expect(page.getByText('A quick look back before we start.')).toBeVisible();
  await expect(page.getByTestId('quest-review-sound-notice')).toBeVisible();
  await expect(page.getByText(/^\d+ \/ \d+$/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Skip warm-up' })).toBeVisible();
  await shots(page, 'warmup-round');
  expect(await answerRounds(page, 'quest-warmup-done')).toBe(EARLIER.length);
  await expect(page.getByTestId('quest-warmup-done')).toBeVisible();
  await expect(page.getByText('Warmed up', { exact: true })).toBeVisible();
  await shots(page, 'warmup-done');
  await page.getByTestId('quest-review-done').click();

  // The quest's first step, with its own counter: the warm-up took no step.
  await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
  // The answers count (section 4.3): each word was answered once more, and the day has one warm-up entry with no stars.
  await expect
    .poll(
      async () => {
        const memory = await readStored<StoredMemory>(page, `memory:${id}`);
        return EARLIER.map((item) => memory?.rows[item]?.st.n ?? 0);
      },
      { timeout: 10_000 },
    )
    .toEqual([3, 3, 3]);
  await expect.poll(async () => (await readStored<StoredProgress>(page, `progress:${id}`))?.reviews.find((r) => r.kind === 'warmup') ?? null, { timeout: 10_000 }).toMatchObject({ id: `warmup:${today}` });
  const entry = (await readStored<StoredProgress>(page, `progress:${id}`))?.reviews.find((r) => r.kind === 'warmup');
  expect(entry?.resultStars).toBeUndefined();
  expect([...(entry?.itemIds ?? [])].sort()).toEqual([...EARLIER].sort());
  expect(errors).toEqual([]);
});

test('Try these again is the reward step’s suggestion after a miss; it ends on stars, and Results follows', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = await onboard(page);
  await switches(page, { memoryRecord: true, missedPractice: true });
  await playLifeQuestWithAMiss(page);

  // The reward step: Try these again is the one primary, See results stays right under it.
  await expect(page.getByTestId('quest-try-again')).toBeVisible();
  await expect(page.getByText('A quick second look at the tricky ones.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'See results' })).toBeVisible();
  await shots(page, 'try-again-offer');
  await page.getByTestId('quest-try-again').click();
  await expect(page.getByText('Try these again', { exact: true })).toBeVisible();
  await shots(page, 'try-again-round');
  // The misses of this play: 젓가락 on the board, and any Check round missed on the first try.
  expect(await answerRounds(page, 'quest-try-again-done')).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('quest-try-again-done')).toBeVisible();
  // Stars only, with the word of their tier: never a count or a percentage.
  await expect(page.getByRole('heading', { name: /^(Wonderful!|Great work!|You did it!)$/ })).toBeVisible();
  await expect(page.getByText(/%|\d+ \/ \d+/)).toHaveCount(0);
  await shots(page, 'try-again-done');
  await page.getByTestId('quest-review-done').click();
  await expect(page.getByText('Next up')).toBeVisible();

  const today = await localToday(page);
  await expect.poll(async () => (await readStored<StoredProgress>(page, `progress:${id}`))?.reviews.find((r) => r.kind === 'feedback') ?? null, { timeout: 10_000 }).toMatchObject({
    id: `feedback:${today}`,
    itemIds: expect.arrayContaining(['lex:jeotgarak']),
  });
  expect(errors).toEqual([]);
});

test('with missedPractice off the same miss leaves the reward step as it always was', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = await onboard(page);
  await switches(page, { memoryRecord: true, missedPractice: false, questWarmup: false });
  await playLifeQuestWithAMiss(page);
  await expect(page.getByRole('button', { name: 'See results' })).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('quest-try-again')).toHaveCount(0);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
  expect(((await readStored<StoredProgress>(page, `progress:${id}`))?.reviews ?? []).some((r) => r.kind === 'feedback')).toBe(false);
  expect(errors).toEqual([]);
});
