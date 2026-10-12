import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored } from './helpers';
import { next } from './story-reader-helpers';

/**
 * F-REPORT-001 section 3.3.2 (RP-3b): the story reader records practice time
 * only. Its session id is time-only (`session:time:`), it ends with its
 * elapsed time when the reader closes, a hidden page ends it and a visible
 * page begins a new one, and the learner's streak never moves (OD-19). Runs
 * on the fixture bundle, like the other reader suites:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web practice-session
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const STORY = 'story:hangul-day';

type E2eWindow = Window & {
  __hrStoryE2E?: { openReader(p: { storyId: string; level: string }): void };
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
});
