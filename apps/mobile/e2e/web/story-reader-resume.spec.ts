import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored, headerClose } from './helpers';
import { nextPage, position } from './story-reader-helpers';

/**
 * F-STORY-004 PR 4.4b (§3.8, continue where you left off) on the fixture
 * story's shelf quest: the reader saves the scene reached, a resumed quest
 * opens on its read step with the reader on that scene, a bookmark for
 * another level is ignored, and Results clears the bookmark once the quest is
 * scored. The shelf and the Home card are later PRs (4.4a-4.6), so the quest
 * opens through the fixture bundle's `window.__hrStoryE2E` hook with the
 * `resume` a Keep reading card passes:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web story-reader-resume
 *
 * `quest:story-hangul-day-listen` has five steps (intro, read, check, sequence,
 * reward); its listen tier has five scenes and orders s1, s2, s4, s5.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const QUEST = 'quest:story-hangul-day-listen';
const EPISODE = 'episode:shelf-hangul-day';
const STORY = 'story:hangul-day';
const EMOJI = /\p{Extended_Pictographic}/u;

type StoredBookmarks = { v: number; byStory: Record<string, { level: string; sceneIndex: number; updatedAt: string }> };

type E2eWindow = Window & {
  __hrStoryE2E?: {
    openQuest(p: { questId: string; episodeId: string; resume?: boolean }): void;
    events(): Array<{ name: string; profileId?: string; payload?: Record<string, unknown> }>;
  };
};

async function onboard(page: Page): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  return id;
}

async function openQuest(page: Page, resume: boolean): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  await page.evaluate(
    ([questId, episodeId, r]) => (window as E2eWindow).__hrStoryE2E?.openQuest({ questId, episodeId, ...(r ? { resume: true } : {}) }),
    [QUEST, EPISODE, resume] as const,
  );
}

const stepHeading = (page: Page, name: string): Locator => page.getByRole('heading', { name });
const bookmarksOf = (page: Page, id: string): Promise<StoredBookmarks | null> => readStored<StoredBookmarks>(page, `story:bookmarks:${id}`);

function resumedEvents(page: Page): Promise<Array<{ name: string; payload?: Record<string, unknown> }>> {
  return page.evaluate(() => ((window as E2eWindow).__hrStoryE2E?.events() ?? []).filter((e) => e.name === 'story.bookmark.resumed'));
}

/** Start the quest from its intro, read to scene 3 and leave the quest from its close control. */
async function leaveAtSceneThree(page: Page, id: string): Promise<void> {
  await openQuest(page, false);
  await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await nextPage(page);
  await nextPage(page);
  await expect(position(page)).toHaveText('3 / 5');
  await expect.poll(() => bookmarksOf(page, id)).toMatchObject({ v: 1, byStory: { [STORY]: { level: 'listen', sceneIndex: 2 } } });
  await headerClose(page).click();
  await expect(stepHeading(page, 'Read the story')).toBeVisible();
}

/** From the reader at its last scene: finish reading, skip the check and either order the story or skip it, then see results. */
async function finishFromLastScene(page: Page, order: boolean): Promise<void> {
  await nextPage(page);
  await page.getByTestId('story-reader-end-primary').click();
  await expect(stepHeading(page, 'A few questions')).toBeVisible();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByText('4 / 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  if (order) {
    for (const scene of ['s1', 's2', 's4', 's5']) await page.getByTestId(`story-sequence-card-${scene}`).click();
    await page.getByRole('button', { name: 'Skip replay' }).click();
  } else {
    await page.getByRole('button', { name: 'Skip this one' }).click();
  }
  await page.getByRole('button', { name: 'See results' }).click();
}

test.describe('story resume (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('leave at scene 3, reload: a resumed quest skips the intro and the reader opens on scene 3', async ({ page }) => {
    const id = await onboard(page);
    await leaveAtSceneThree(page, id);

    // The bookmark is device storage, so it survives a reload; the quest run does not.
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await openQuest(page, true);

    // Straight to the read step (2 / 5), the intro skipped; the learner still taps Play (no auto-open).
    await expect(stepHeading(page, 'Read the story')).toBeVisible();
    await expect(page.getByText('2 / 5', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Story time' })).toHaveCount(0);
    expect(await resumedEvents(page)).toHaveLength(0);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('3 / 5');
    const resumed = await resumedEvents(page);
    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.payload).toEqual({ storyId: STORY, sceneIndex: 2 });
    expect(await page.locator('body').innerText()).not.toMatch(EMOJI);

    // Reading on moves the bookmark forward.
    await nextPage(page);
    await expect(position(page)).toHaveText('4 / 5');
    await expect.poll(async () => (await bookmarksOf(page, id))?.byStory[STORY]?.sceneIndex).toBe(3);
  });

  test('a plain start (no resume) begins at the intro; the reader still opens on the bookmark', async ({ page }) => {
    const id = await onboard(page);
    await leaveAtSceneThree(page, id);
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();

    await openQuest(page, false);
    await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
    await expect(page.getByText('1 / 5', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('3 / 5');
  });

  test('a bookmark for another level is ignored: step 0 and scene 1, nothing resumed', async ({ page }) => {
    const id = await onboard(page);
    await seedStored(page, `story:bookmarks:${id}`, {
      v: 1,
      byStory: { [STORY]: { level: 'read-along', sceneIndex: 2, updatedAt: '2026-10-11T09:00:00.000Z' } },
    });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    // The seeded read-along bookmark is really there, so ignoring it is a choice, not a missed seed.
    await expect.poll(async () => (await bookmarksOf(page, id))?.byStory[STORY]).toMatchObject({ level: 'read-along', sceneIndex: 2 });

    await openQuest(page, true);
    await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
    await expect(page.getByText('1 / 5', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('1 / 5');
    expect(await resumedEvents(page)).toHaveLength(0);
  });

  test('finishing the quest on Results clears the story bookmark', async ({ page }) => {
    const id = await onboard(page);
    await leaveAtSceneThree(page, id);

    // Resume, read to the end, skip the check, order the story, see results.
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await openQuest(page, true);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('3 / 5');
    for (const n of [4, 5]) {
      await nextPage(page);
      await expect(position(page)).toHaveText(`${n} / 5`);
    }
    await nextPage(page);
    await page.getByTestId('story-reader-end-primary').click();
    await expect(stepHeading(page, 'A few questions')).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByText('4 / 5', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    for (const scene of ['s1', 's2', 's4', 's5']) await page.getByTestId(`story-sequence-card-${scene}`).click();
    await page.getByRole('button', { name: 'Skip replay' }).click();

    // The bookmark is still there until the score is written.
    await expect.poll(async () => (await bookmarksOf(page, id))?.byStory[STORY]).toMatchObject({ level: 'listen' });
    await page.getByRole('button', { name: 'See results' }).click();
    await expect.poll(async () => (await bookmarksOf(page, id))?.byStory).toEqual({});
  });

  test('a bookmark past the end of the tier is kept inside the story: the reader opens on the last scene', async ({ page }) => {
    const id = await onboard(page);
    await seedStored(page, `story:bookmarks:${id}`, {
      v: 1,
      byStory: { [STORY]: { level: 'listen', sceneIndex: 9, updatedAt: '2026-10-11T09:00:00.000Z' } },
    });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();

    // The same seeding at the quest's level is loaded and used (the other-level case above is ignored, not unloaded).
    await openQuest(page, true);
    await expect(stepHeading(page, 'Read the story')).toBeVisible();
    await expect(page.getByText('2 / 5', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('5 / 5');
    const resumed = await resumedEvents(page);
    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.payload).toEqual({ storyId: STORY, sceneIndex: 4 });
  });

  test('a run with every game skipped writes no score, so Results keeps the bookmark', async ({ page }) => {
    const id = await onboard(page);
    await seedStored(page, `story:bookmarks:${id}`, {
      v: 1,
      byStory: { [STORY]: { level: 'listen', sceneIndex: 4, updatedAt: '2026-10-11T09:00:00.000Z' } },
    });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();

    await openQuest(page, true);
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('5 / 5');
    await finishFromLastScene(page, false);
    // Results is on screen with 0 / 0 (its clear runs in the same effect as the score write).
    await expect(page.getByText('Play the games next time to earn stars and a card!')).toBeVisible();

    await expect.poll(async () => (await readStored<{ quests: Array<{ questId: string; completedAt?: string }> }>(page, `progress:${id}`))?.quests ?? []).not.toContainEqual(
      expect.objectContaining({ questId: QUEST, completedAt: expect.any(String) }),
    );
    expect((await bookmarksOf(page, id))?.byStory[STORY]).toMatchObject({ level: 'listen', sceneIndex: 4 });
  });

  test('a bookmark of a story already finished at that level (another device) is ignored: step 0 and scene 1, nothing resumed', async ({ page }) => {
    const id = await onboard(page);
    // Finish the quest on this device: its completion is in the progress snapshot, as a synced one would be.
    await openQuest(page, false);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    for (const n of [2, 3, 4, 5]) {
      await nextPage(page);
      await expect(position(page)).toHaveText(`${n} / 5`);
    }
    await finishFromLastScene(page, true);
    await expect
      .poll(async () => (await readStored<{ quests: Array<{ questId: string; completedAt?: string }> }>(page, `progress:${id}`))?.quests ?? [])
      .toContainEqual(expect.objectContaining({ questId: QUEST, completedAt: expect.any(String) }));

    // Another device left a bookmark at scene 3 of the same level before the finish synced here.
    await seedStored(page, `story:bookmarks:${id}`, {
      v: 1,
      byStory: { [STORY]: { level: 'listen', sceneIndex: 2, updatedAt: '2026-10-11T09:00:00.000Z' } },
    });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await expect.poll(async () => (await bookmarksOf(page, id))?.byStory[STORY]).toMatchObject({ level: 'listen', sceneIndex: 2 });

    await openQuest(page, true);
    await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
    await expect(page.getByText('1 / 5', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(position(page)).toHaveText('1 / 5');
    expect(await resumedEvents(page)).toHaveLength(0);
  });
});
