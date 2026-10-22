import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, passDiscover, playCheck, readStored, seedStored } from './helpers';

/**
 * F-CURR-002 row CM-12, shadow mode (section 12.3): with `memoryRecord` on for the learner, a quest's
 * scored rounds are recorded in the learner's own memory store (`hr:memory:<profileId>`) and the
 * one-time seeding latches `memSeededAt`; nothing on screen changes. With it off (the built-in pct
 * 0, or a remote off), nothing is recorded. The remote copy is the stored one: this build has no API.
 */

const FOODS = ['gimchi', 'bap', 'gimbap', 'jeotgarak'] as const;

interface StoredMemory {
  rows: Record<string, { sh: string; st: { b: number; n: number; d: string | null } }>;
  pending: string[];
}

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

async function memoryRecord(page: Page, flag: { on: boolean; pct: number }): Promise<void> {
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { memoryRecord: flag } });
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

/** Food & Daily Life quest 1: Discover, skip Match Sound, match the four Pic-Word pairs, then the Check and Results. */
async function playLifeQuest(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Food & Daily Life') }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).nth(0).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await expect(headerClose(page)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const id of FOODS) {
    await page.getByTestId(`pic-word-picture-${id}`).click();
    await page.getByTestId(`pic-word-word-${id}`).click();
  }
  await playCheck(page);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Next up')).toBeVisible();
}

async function shots(page: Page, name: string): Promise<void> {
  for (const [label, size] of [
    ['320', { width: 320, height: 720 }],
    ['wide', { width: 1280, height: 900 }],
  ] as const) {
    await page.setViewportSize(size);
    await page.screenshot({ path: test.info().outputPath(`${name}-${label}.png`), fullPage: true });
  }
}

test('memoryRecord on: the rounds are recorded in the learner’s own store, the seeding latches, the screens do not change', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = await onboard(page);
  expect(id).toMatch(/^profile:/);
  await memoryRecord(page, { on: true, pct: 100 });
  await playLifeQuest(page);
  await shots(page, 'memory-shadow-results');

  // Saved shortly after the answers (coalesced writes): 젓가락 from the board, the Check's symbols. 김치, 밥 and 김밥 are
  // topic words, whose state stays in the word slice (and only for words the learner collected), so they are not here.
  await expect.poll(async () => Object.keys((await readStored<StoredMemory>(page, `memory:${id}`))?.rows ?? {}), { timeout: 10_000 }).toContain('lex:jeotgarak');
  const memory = (await readStored<StoredMemory>(page, `memory:${id}`)) as StoredMemory;
  const answered = Object.entries(memory.rows);
  expect(answered.some(([itemId]) => itemId.startsWith('sym:'))).toBe(true);
  expect(answered.some(([itemId]) => itemId.startsWith('vocab:'))).toBe(false);
  // Met today: box 1, answered at least once, queued for the server.
  for (const [, row] of answered) {
    expect(row.st.b).toBe(1);
    expect(row.st.n).toBeGreaterThanOrEqual(1);
  }
  expect(memory.pending.sort()).toEqual(answered.map(([itemId]) => itemId).sort());
  // The seeding ran once for this learner (nothing was done before, so nothing is seeded) and is latched in the snapshot.
  await expect.poll(async () => (await readStored<{ memSeededAt?: string }>(page, `progress:${id}`))?.memSeededAt ?? null, { timeout: 10_000 }).not.toBeNull();

  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await shots(page, 'memory-shadow-home');
  expect(errors).toEqual([]);
});

test('memoryRecord off: the same quest records nothing and seeds nothing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = await onboard(page);
  await memoryRecord(page, { on: false, pct: 100 });
  await playLifeQuest(page);
  await page.waitForTimeout(1500);
  expect(await readStored(page, `memory:${id}`)).toBeNull();
  expect((await readStored<{ memSeededAt?: string }>(page, `progress:${id}`))?.memSeededAt).toBeUndefined();
  expect(errors).toEqual([]);
});
