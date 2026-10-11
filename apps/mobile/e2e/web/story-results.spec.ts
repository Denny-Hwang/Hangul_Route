import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored } from './helpers';
import { fullyVisible } from './story-reader-helpers';

/**
 * F-STORY-003 PR 3.7: the story variant of Results (`StoryResultsExtras`),
 * after the fixture story's shelf quest. Needs the fixture bundle:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web story-results
 *
 * `quest:story-hangul-day-listen` is intro, read, check, sequence, reward. The
 * suite skips the read step, so a run scores 3 check rounds + 4 sequence slots.
 * The fixture bundle holds one shelf story, so `nextStoryAfter` has nothing to
 * offer and the primary is Back home; the Next story choice is covered by the
 * unit tests of `nextStoryAfter` and `storyResultsExtras`.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const QUEST = 'quest:story-hangul-day-listen';
const EPISODE = 'episode:shelf-hangul-day';
const STORY = 'story:hangul-day';
const EMOJI = /\p{Extended_Pictographic}/u;

/** The listen tier's checks: the correct option id and a wrong one (ids are stable, display order is shuffled). */
const CHECKS = [
  { right: 'a', wrong: 'b' },
  { right: 'a', wrong: 'b' },
  { right: 't', wrong: 'f' },
];
const ORDER = ["A king's wish", 'A new alphabet', 'Hangul Day', 'A cheer'];

type E2eWindow = Window & {
  __hrStoryE2E?: {
    openQuest(p: { questId: string; episodeId: string }): void;
    events(): Array<{ name: string; profileId?: string; payload?: Record<string, unknown> }>;
  };
};

type StoredSnapshot = { quests: Array<{ questId: string; stars: number; attempts?: number }> };

async function onboard(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
}

const stepHeading = (page: Page, name: string): Locator => page.getByRole('heading', { name });
const sequenceCard = (page: Page, caption: string): Locator =>
  page.locator('[data-testid^="story-sequence-card-"]').filter({ hasText: caption });

/**
 * One run of the quest to Results. `misses`: how many check items get a wrong tap first (each costs
 * its round); `missSlot`: a wrong card before the first slot.
 */
async function playQuest(page: Page, misses = 0, missSlot = false): Promise<void> {
  await page.evaluate(
    ([questId, episodeId]) => (window as E2eWindow).__hrStoryE2E?.openQuest({ questId, episodeId }),
    [QUEST, EPISODE] as const,
  );
  await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(stepHeading(page, 'Read the story')).toBeVisible();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(stepHeading(page, 'A few questions')).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const [i, check] of CHECKS.entries()) {
    if (i < misses) await page.getByTestId(`story-check-option-${check.wrong}`).click();
    await page.getByTestId(`story-check-option-${check.right}`).click();
    await page.getByTestId('story-check-next').click();
  }
  // The word recap (PR 3.4b) ends the check step with Done when it is there.
  const sequence = stepHeading(page, 'Put the story in order');
  const recapDone = page.getByTestId('story-recap-done');
  await expect(sequence.or(recapDone)).toBeVisible();
  if (await recapDone.isVisible()) await recapDone.click();
  await expect(sequence).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByRole('heading', { name: 'Put the story in order' })).toBeVisible();
  for (const [i, caption] of ORDER.entries()) {
    if (missSlot && i === 0) await sequenceCard(page, ORDER[1]!).click();
    await sequenceCard(page, caption).click();
  }
  await page.getByRole('button', { name: 'Skip replay' }).click();
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByTestId('story-results-extras')).toBeVisible();
}

function storyEvents(page: Page): Promise<Array<{ name: string; payload?: Record<string, unknown> }>> {
  return page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.events() ?? []);
}

async function storedStars(page: Page): Promise<number | undefined> {
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) return undefined;
  const snap = await readStored<StoredSnapshot>(page, `progress:${id}`);
  return snap?.quests.find((q) => q.questId === QUEST)?.stars;
}

test.describe('story Results (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('three stars: the story card, one primary and two ghosts, no "Next up", no number', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboard(page);
    await playQuest(page);

    await expect(page.getByText('Wonderful!')).toBeVisible();
    await expect(page.getByRole('button', { name: /^See my card/ })).toBeVisible();
    // The story title: Korean with its romanization, and the title in English.
    const title = page.getByTestId('story-results-title');
    await expect(title).toContainText('한글날');
    await expect(title).toContainText('hangeullal');
    await expect(page.getByTestId('story-results-title-en')).toHaveText('Hangul Day');
    // One primary (no next story in this bundle: Back home), then Read it again and Episode page.
    const actions = page.locator('[data-testid^="story-results-"][role="button"]');
    expect(await actions.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))).toEqual([
      'story-results-home',
      'story-results-read-again',
      'story-results-episode',
    ]);
    await expect(page.getByTestId('story-results-home')).toHaveText('Back home');
    await expect(page.getByTestId('story-results-read-again')).toHaveText('Read it again');
    await expect(page.getByTestId('story-results-episode')).toHaveText('Episode page');
    // The story actions replace "Next up" and the generic buttons: exactly one Back home.
    await expect(page.getByTestId('next-up-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back home' })).toHaveCount(1);
    await expect(page.getByTestId('story-results-encourage')).toHaveCount(0);
    await expect(page.getByTestId('story-results-culture-note')).toHaveCount(0);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\d+\s*(%|\/\s*\d)/);
    expect(body).not.toMatch(EMOJI);
    expect(errors).toEqual([]);
  });

  test('Read it again opens the unscored replay; the stars stay as they were', async ({ page }) => {
    await onboard(page);
    await playQuest(page);
    await expect.poll(() => storedStars(page)).toBe(3);

    await page.getByTestId('story-results-read-again').click();
    await expect(page.getByTestId('story-reader-next')).toBeVisible();
    const events = await storyEvents(page);
    expect(events.filter((e) => e.name === 'story.results.action').map((e) => e.payload)).toEqual([
      { questId: QUEST, storyId: STORY, action: 'read-again' },
    ]);
    // Read every scene of the replay to its end page: nothing is written.
    while (await page.getByTestId('story-reader-next').isVisible()) await page.getByTestId('story-reader-next').click();
    await expect.poll(() => storedStars(page)).toBe(3);
  });

  test('a replay with fewer stars keeps the best; it shows no new card', async ({ page }) => {
    await onboard(page);
    await playQuest(page);
    await expect.poll(() => storedStars(page)).toBe(3);
    await page.getByTestId('story-results-home').click();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();

    // Three missed checks and a missed slot: 3 of 7 first try, one star.
    await playQuest(page, 3, true);
    await expect(page.getByText('You tried!')).toBeVisible();
    await expect(page.getByRole('button', { name: /^See my card/ })).toHaveCount(0);
    await expect.poll(() => storedStars(page)).toBe(3);

    // 0-1 star (wireframe H2): the encouraging line, and Read it again first among the ghosts.
    await expect(page.getByTestId('story-results-encourage')).toHaveText('Every read helps. Want to read it again?');
    const ghosts = page.locator('[data-testid="story-results-read-again"], [data-testid="story-results-episode"]');
    expect(await ghosts.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))).toEqual([
      'story-results-read-again',
      'story-results-episode',
    ]);
  });

  test('Back home and Episode page record their action and go where they say', async ({ page }) => {
    await onboard(page);
    await playQuest(page);
    await page.getByTestId('story-results-episode').click();
    // The story's episode page (the shelf episode), with this quest's stars on it.
    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible();
    await expect(page.getByTestId('story-results-extras')).toBeHidden();
    await page.getByLabel('Go back').first().click();
    await expect(page.getByTestId('story-results-extras')).toBeVisible();
    await page.getByTestId('story-results-home').click();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    const actions = (await storyEvents(page)).filter((e) => e.name === 'story.results.action').map((e) => e.payload?.action);
    expect(actions).toEqual(['episode', 'home']);
  });

  for (const vp of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    test(`${vp.width}x${vp.height}: the story card and the primary are reachable, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize(vp);
      await onboard(page);
      await playQuest(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const primary = page.getByTestId('story-results-home');
      await primary.scrollIntoViewIfNeeded();
      await expect.poll(() => fullyVisible(page, primary)).toBe(true);
      await page.screenshot({ path: `test-results/story-results-${vp.width}x${vp.height}.png`, fullPage: true });
    });
  }
});
