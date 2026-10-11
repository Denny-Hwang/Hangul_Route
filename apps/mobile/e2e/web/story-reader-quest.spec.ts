import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored } from './helpers';
import { back, filledDots, fullyVisible, next, position, primaryButtons } from './story-reader-helpers';

/**
 * F-STORY-002 PR 2.6b: the story reader as a quest step (`StoryReadGame`,
 * the `story-read` case of the minigame shell). No shelf exists yet
 * (F-STORY-004), so the suite opens the fixture story's derived shelf quest
 * through the `window.__hrStoryE2E` hook; both the hook and the fixture exist
 * only in the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web story-reader
 *
 * `story:hangul-day` has a shelf block, so the generator derives
 * `episode:shelf-hangul-day` and the five-step `quest:story-hangul-day-listen`
 * (intro, read, check, sequence, reward; F-STORY-001 §3.9). Its listen tier has
 * five scenes and one checkpoint, which the reader reads straight through
 * until the inline question card ships (PR 2.9).
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const QUEST = 'quest:story-hangul-day-listen';
const EPISODE = 'episode:shelf-hangul-day';
const EMOJI = /\p{Extended_Pictographic}/u;

type E2eWindow = Window & {
  __hrStoryE2E?: {
    openQuest(p: { questId: string; episodeId: string }): void;
    events(): Array<{ name: string; profileId?: string; payload?: Record<string, unknown> }>;
  };
};

async function onboard(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

async function openQuest(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  await page.evaluate(
    ([questId, episodeId]) => (window as E2eWindow).__hrStoryE2E?.openQuest({ questId, episodeId }),
    [QUEST, EPISODE] as const,
  );
}

/** Intro step, then the read step's launcher, then the reader on scene 1. */
async function startReading(page: Page): Promise<void> {
  await openQuest(page);
  await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(stepHeading(page, 'Read the story')).toBeVisible();
  await expect(page.getByText('2 / 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(next(page)).toBeVisible();
}

const stepHeading = (page: Page, name: string): Locator => page.getByRole('heading', { name });

function storyEvents(page: Page): Promise<Array<{ name: string; payload?: Record<string, unknown> }>> {
  return page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.events() ?? []);
}

test.describe('story reader, quest step (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('a quest step opens the reader; reading to the end and Continue completes the step', async ({ page }) => {
    await onboard(page);
    await startReading(page);

    // Scene 1 in quest mode: page number, fill-only dots, Back disabled.
    await expect(position(page)).toHaveText('1 / 5');
    await expect.poll(() => filledDots(page)).toBe(1);
    await expect(back(page)).toBeDisabled();
    await expect(page.getByTestId('story-reader-narration-text')).toContainText('Long ago, King');

    // Back works and the dots never drop (D3).
    await next(page).click();
    await expect(position(page)).toHaveText('2 / 5');
    await back(page).click();
    await expect(position(page)).toHaveText('1 / 5');
    await expect.poll(() => filledDots(page)).toBe(2);

    // The checkpoint scene reads straight through (no card before PR 2.9): five Nexts reach the end.
    for (const n of [2, 3, 4, 5]) {
      await next(page).click();
      await expect(position(page)).toHaveText(`${n} / 5`);
    }
    await expect(next(page)).toHaveText('Finish');
    const shown = await page.getByTestId('story-reader').innerText();
    expect(shown).not.toContain('{kw:');
    expect(shown).not.toMatch(EMOJI);
    await next(page).click();

    // The end page in quest mode: Continue is the one primary, Read again a ghost; no Done.
    await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
    const primary = page.getByTestId('story-reader-end-primary');
    await expect(primary).toHaveText('Continue');
    await expect(page.getByTestId('story-reader-read-again')).toBeVisible();
    await expect(page.getByText('Done', { exact: true })).toHaveCount(0);
    // At most one primary on the end page, and it is Continue (Read again is a ghost).
    expect(await primaryButtons(page)).toEqual(['story-reader-end-primary']);
    expect(await page.locator('body').innerText()).not.toMatch(EMOJI);

    const finished = (await storyEvents(page)).filter((e) => e.name === 'story.read.finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]?.payload).toMatchObject({ storyId: 'story:hangul-day', level: 'listen', mode: 'quest', scenes: 5 });

    // Continue marks the step complete and returns: the quest moves on to the check step.
    await primary.click();
    await expect(page.getByTestId('story-reader')).toHaveCount(0);
    await expect(stepHeading(page, 'A few questions')).toBeVisible();
    await expect(page.getByText('3 / 5', { exact: true })).toBeVisible();
  });

  test('Close returns to the read step without completing it; the step can be played again', async ({ page }) => {
    await onboard(page);
    const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
    const id = profiles?.[0]?.id;
    expect(id).toBeTruthy();
    await startReading(page);
    await next(page).click();
    await next(page).click();
    await expect(position(page)).toHaveText('3 / 5');

    // No confirmation: reading records no score, so nothing is lost by leaving (§3.3).
    await page.getByTestId('story-reader-close').click();
    await expect(page.getByTestId('story-reader')).toHaveCount(0);
    await expect(stepHeading(page, 'Read the story')).toBeVisible();
    await expect(page.getByText('2 / 5', { exact: true })).toBeVisible();
    expect((await storyEvents(page)).filter((e) => e.name === 'story.read.finished')).toHaveLength(0);
    // The bookmark seam (F-STORY-004 PR 4.4b) saved the scene reached: index 2, page 3 / 5.
    await expect
      .poll(() => readStored<{ v: number; byStory: Record<string, { level: string; sceneIndex: number }> }>(page, `story:bookmarks:${id ?? ''}`))
      .toMatchObject({ v: 1, byStory: { 'story:hangul-day': { level: 'listen', sceneIndex: 2 } } });
    expect((await storyEvents(page)).filter((e) => e.name === 'story.bookmark.resumed')).toHaveLength(0);

    // Played again, the step opens the reader on the bookmarked scene and says so once.
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('3 / 5');
    const resumed = (await storyEvents(page)).filter((e) => e.name === 'story.bookmark.resumed');
    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.payload).toEqual({ storyId: 'story:hangul-day', sceneIndex: 2 });

    // Skip for now still moves the quest on without reading (the launcher is unchanged).
    await page.getByTestId('story-reader-close').click();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(stepHeading(page, 'A few questions')).toBeVisible();
  });

  // Phone portrait, a phone held sideways and a tablet held sideways (side by side, §3.3); the two short
  // windows (< layout.compactHeight) get the compact end page, whose lg Continue must still fit.
  for (const vp of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1180, height: 820 },
  ]) {
    test(`${vp.width}x${vp.height}: Next and the end page Continue stay on screen in quest mode`, async ({ page }) => {
      await page.setViewportSize(vp);
      await onboard(page);
      await startReading(page);
      await expect.poll(() => fullyVisible(page, next(page))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      for (let i = 0; i < 5; i += 1) await next(page).click();
      const primary = page.getByTestId('story-reader-end-primary');
      await expect(primary).toHaveText('Continue');
      await expect(page.getByTestId('story-reader-read-again')).toBeVisible();
      await expect(page.getByText('Done', { exact: true })).toHaveCount(0);
      await expect.poll(() => fullyVisible(page, primary)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await primary.click();
      await expect(stepHeading(page, 'A few questions')).toBeVisible();
    });
  }
});
