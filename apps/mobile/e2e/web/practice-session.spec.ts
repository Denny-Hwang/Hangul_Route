import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { answerForkNew, completeChildForm, keepSidewaysIfAsked, readStored, waitForSaved, passPlacementLanguage } from './helpers';
import { next } from './story-reader-helpers';

/**
 * F-REPORT-001 section 3.3.2 (RP-3b): the story reader records practice time
 * only. Its session id is time-only (`session:time:`), it ends with its
 * elapsed time when the reader closes, a hidden page ends it and a visible
 * page begins a new one, and the learner's streak never moves (OD-19). Runs
 * on the fixture bundle, like the other reader suites. The level check's
 * session runs only while the check is in front: the grown-up report pushed
 * over it ends it (RP-3b review).
 *
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web practice-session
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const STORY = 'story:hangul-day';

type E2eWindow = Window & {
  __hrStoryE2E?: { openReader(p: { storyId: string; level: string }): void };
  __hrPlacementE2E?: { open(source: string): void };
};

interface Saved {
  streakDays: number;
  sessions: Array<{ id: string; endedAt?: string; durationSeconds?: number }>;
}

/** The time-only sessions saved for the learner (the onboarding quest's own session is left out). */
const timeOnly = (snap: Saved | null): Saved['sessions'] => (snap?.sessions ?? []).filter((s) => s.id.startsWith('session:time:'));

async function onboard(page: Page): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  return id;
}

/** Sets `document.visibilityState` and fires `visibilitychange`, as a browser does when the tab is hidden or shown. */
async function setVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((s) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

test.describe('practice sessions (F-REPORT-001 section 3.3.2)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('the story reader records time-only sessions, ends one on a hidden page, and leaves the streak alone', async ({ page }) => {
    const profileId = await onboard(page);
    const saved = (): Promise<Saved | null> => readStored<Saved>(page, `progress:${profileId}`);
    const streakBefore = (await saved())?.streakDays ?? 0;

    await page.evaluate((storyId) => (window as E2eWindow).__hrStoryE2E?.openReader({ storyId, level: 'listen' }), STORY);
    await expect(next(page)).toBeVisible();
    await expect.poll(async () => timeOnly(await saved()).length).toBe(1);
    expect(timeOnly(await saved())[0]?.endedAt).toBeUndefined();

    await setVisibility(page, 'hidden');
    await expect.poll(async () => timeOnly(await saved())[0]?.endedAt).toBeDefined();
    await setVisibility(page, 'visible');
    await expect.poll(async () => timeOnly(await saved()).length).toBe(2);
    expect(timeOnly(await saved())[1]?.endedAt).toBeUndefined();

    await page.getByTestId('story-reader-close').click();
    await expect(page.getByTestId('story-reader')).toHaveCount(0);
    await expect.poll(async () => timeOnly(await saved()).every((s) => s.endedAt !== undefined)).toBe(true);
    const after = await saved();
    expect(timeOnly(after).every((s) => (s.durationSeconds ?? -1) >= 0 && (s.durationSeconds ?? 0) <= 3600)).toBe(true);
    expect(after?.streakDays).toBe(streakBefore);
  });

  test('the level check records a time-only session that ends while the grown-up report is in front', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: "Let's start" }).click();
    await page.getByRole('radio', { name: /^Me\./ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByPlaceholder('Type a name').fill('Sam');
    await page.getByRole('radio', { name: /^Some reading/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await answerForkNew(page);
    await page.getByRole('button', { name: 'Start my journey' }).click();
    await waitForSaved(page, ['profiles']);
    await page.goto('/');
    await expect(page.getByText('Hi, Sam!')).toBeVisible();
    const profileId = (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
    const saved = (): Promise<Saved | null> => readStored<Saved>(page, `progress:${profileId}`);
    const streakBefore = (await saved())?.streakDays ?? 0;

    await page.waitForFunction(() => Boolean((window as E2eWindow).__hrPlacementE2E), undefined, { timeout: 10_000 });
    await page.evaluate(() => (window as E2eWindow).__hrPlacementE2E?.open('home'));
    await passPlacementLanguage(page);
    await expect(page.getByTestId('placement-options')).toBeVisible();
    await expect.poll(async () => timeOnly(await saved()).length).toBe(1);
    expect(timeOnly(await saved())[0]?.endedAt).toBeUndefined();

    await page.getByTestId('placement-guide-tap').click();
    await page.getByTestId('placement-next').click();
    await page.getByTestId('placement-warmup-speaker').click();
    await expect(page.getByTestId('placement-no-sound-note')).toBeVisible();
    await page.getByTestId('placement-warmup-option-rice').click();
    await page.locator('[data-testid^="placement-option-"]').first().click();
    await page.getByTestId('placement-exit').click();
    await page.getByTestId('placement-enough').click();
    await expect(page.getByTestId('placement-result')).toBeVisible();

    await page.getByTestId('placement-link-forGrownUps').click();
    await expect(page.getByTestId('placement-report')).toBeVisible();
    await expect.poll(async () => timeOnly(await saved()).every((s) => s.endedAt !== undefined)).toBe(true);
    expect(timeOnly(await saved())).toHaveLength(1);
    expect((await saved())?.streakDays).toBe(streakBefore);
  });
});
