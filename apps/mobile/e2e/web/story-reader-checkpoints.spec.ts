import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked } from './helpers';
import { back, checkpointCard, checkpointSkip, fullyVisible, next, nextPage, position, primaryButtons } from './story-reader-helpers';

/**
 * F-STORY-002 PR 2.9: the inline checkpoint card of the story reader (§3.7,
 * wireframe design/wireframes/story/reader.md G2). The fixture story
 * `story:hangul-day` asks one true-false checkpoint (`cp1`, True is right)
 * after scene 3 of its listen tier. Like the other reader suites it runs on
 * the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web story-reader
 *
 * In a quest the card is "Quick question" and its first answer is a scored
 * round (`cp:cp1`): the quest suite below proves it on Results, where one
 * checkpoint miss turns 7 of 7 first-try rounds into 7 of 8 (two stars, not
 * three). In a replay the card is the unscored "Try it".
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const STORY = 'story:hangul-day';
const QUEST = 'quest:story-hangul-day-listen';
const EPISODE = 'episode:shelf-hangul-day';
const EMOJI = /\p{Extended_Pictographic}/u;
const AMBER = 'rgb(242, 179, 61)'; // colors.feedback.nudge
const RED = 'rgb(200, 75, 61)'; // colors.feedback.danger: never on a learner's miss
const PROMPT = 'Was the alphabet made to be easy to learn?';
const EXPLAIN = 'Yes. It was made so ordinary people could learn it.';
/** The check step's right options, and the sequence step's cards in order (as in story-checks.spec.ts). */
const CHECK_RIGHT = ['a', 'a', 't'];
const ORDER = ["A king's wish", 'A new alphabet', 'Hangul Day', 'A cheer'];

type E2eWindow = Window & {
  __hrStoryE2E?: {
    openReader(p: { storyId: string; level: string; sceneIndex?: number }): void;
    openQuest(p: { questId: string; episodeId: string }): void;
    events(): Array<{ name: string; payload?: Record<string, unknown> }>;
  };
};

const option = (page: Page, id: 't' | 'f'): Locator => page.getByTestId(`story-reader-checkpoint-option-${id}`);
const status = (page: Page, id: 't' | 'f'): Locator => page.getByTestId(`story-reader-checkpoint-status-${id}`);
const bubble = (page: Page): Locator => page.getByTestId('story-reader-checkpoint-bubble');

async function onboard(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

async function hook(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
}

/** The replay route on scene 3, the scene the checkpoint follows. */
async function openReplayAtScene3(page: Page): Promise<void> {
  await hook(page);
  await page.evaluate((storyId) => (window as E2eWindow).__hrStoryE2E?.openReader({ storyId, level: 'listen', sceneIndex: 2 }), STORY);
  await expect(position(page)).toHaveText('3 / 5');
}

/** Border colour of a card's frame (the first child of its pressable). */
function frameColor(target: Locator): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el.firstElementChild ?? el).borderTopColor);
}

function storyEvents(page: Page): Promise<Array<{ name: string; payload?: Record<string, unknown> }>> {
  return page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.events() ?? []);
}

test.describe('story reader checkpoints, replay (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('Next after scene 3 opens the "Try it" card: amber Try another, the explanation, then Next carries on', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboard(page);
    await openReplayAtScene3(page);
    await next(page).click();

    // The card replaces the scene: heading, the question, True then False (never shuffled), Skip.
    const card = checkpointCard(page);
    await expect(card).toBeVisible();
    await expect(page.getByTestId('story-reader-checkpoint-heading')).toHaveText('Try it');
    await expect(card).toHaveAccessibleName('Try it');
    await expect(page.getByTestId('story-reader-checkpoint-prompt')).toHaveText(PROMPT);
    const shown = await page.locator('[data-testid^="story-reader-checkpoint-option-"]').allInnerTexts();
    expect(shown.map((t) => t.trim())).toEqual(['True', 'False']);
    await expect(checkpointSkip(page)).toBeVisible();
    await expect(page.getByTestId('story-reader-art')).toHaveCount(0);
    await expect(page.getByTestId('story-reader-narration')).toHaveCount(0);
    // The page number stays on scene 3 and the dots do not move; Next waits for an answer, Back is there.
    await expect(position(page)).toHaveText('3 / 5');
    await expect(next(page)).toBeDisabled();
    await expect(back(page)).toBeEnabled();
    // No primary on the card: the bar's Next stays the one (disabled until the answer, so not filled yet).
    expect(await primaryButtons(page)).toEqual([]);
    // The question has its speaker (§3.4).
    await expect(page.getByTestId('story-reader-checkpoint-hear')).toHaveAccessibleName('Hear the question');
    // The right/Left keys never answer or skip a question: Right does nothing here.
    await page.keyboard.press('ArrowRight');
    await expect(card).toBeVisible();

    // A miss: the amber "Try another" in words, Hoya's hint, the card stays and Next still waits. Never red.
    await option(page, 'f').click();
    await expect(status(page, 'f')).toHaveText('Try another');
    await expect(option(page, 'f')).toHaveAccessibleName(/Try another$/);
    await expect.poll(() => frameColor(option(page, 'f'))).toBe(AMBER);
    expect(await frameColor(option(page, 'f'))).not.toBe(RED);
    await expect(bubble(page)).toContainText('Not quite. Have another look.');
    await expect(next(page)).toBeDisabled();

    // The right card: "Correct", the explanation, Next takes focus. No auto-advance (D3).
    await option(page, 't').click();
    await expect(status(page, 't')).toHaveText('Correct');
    await expect(bubble(page)).toContainText(EXPLAIN);
    await expect(next(page)).toBeEnabled();
    await expect(next(page)).toBeFocused();
    expect(await primaryButtons(page)).toEqual(['story-reader-next']);
    await page.waitForTimeout(1500);
    await expect(card).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(EMOJI);

    await next(page).click();
    await expect(position(page)).toHaveText('4 / 5');
    await expect(card).toHaveCount(0);
    // Answered once is answered: Back to scene 3 and Next again goes straight on.
    await back(page).click();
    await expect(position(page)).toHaveText('3 / 5');
    await next(page).click();
    await expect(position(page)).toHaveText('4 / 5');
    await expect(card).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Back from the card returns to scene 3 and keeps the card as it was; Skip records nothing and carries on', async ({ page }) => {
    await onboard(page);
    await openReplayAtScene3(page);
    await next(page).click();
    await option(page, 'f').click();
    await expect(status(page, 'f')).toHaveText('Try another');

    // Back (and the Left key) go to the scene, not past it.
    await back(page).click();
    await expect(checkpointCard(page)).toHaveCount(0);
    await expect(position(page)).toHaveText('3 / 5');
    await expect(page.getByTestId('story-reader-narration')).toBeVisible();
    await next(page).click();
    // The card comes back as it was left: the miss is still locked, the question still open.
    await expect(status(page, 'f')).toHaveText('Try another');
    await expect(next(page)).toBeDisabled();
    await page.keyboard.press('ArrowLeft');
    await expect(position(page)).toHaveText('3 / 5');
    await expect(checkpointCard(page)).toHaveCount(0);
    await next(page).click();

    // Skip is always there and moves on without an answer.
    await checkpointSkip(page).click();
    await expect(position(page)).toHaveText('4 / 5');
    await back(page).click();
    await next(page).click();
    await expect(position(page)).toHaveText('4 / 5');

    // Read again from the end page asks it again, fresh.
    await nextPage(page);
    await nextPage(page);
    await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
    await page.getByTestId('story-reader-read-again').click();
    for (const n of [2, 3]) {
      await next(page).click();
      await expect(position(page)).toHaveText(`${n} / 5`);
    }
    await next(page).click();
    await expect(checkpointCard(page)).toBeVisible();
    await expect(status(page, 'f')).toHaveCount(0);
    await expect(next(page)).toBeDisabled();
    // A replay scores nothing and sends no check event: the card is the unscored "Try it".
    const names = (await storyEvents(page)).map((e) => e.name);
    expect(names.filter((n) => n.startsWith('story.check'))).toEqual([]);
    expect(names.filter((n) => n === 'story.read.finished')).toHaveLength(1);
  });

  for (const vp of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1180, height: 820 },
  ]) {
    test(`${vp.width}x${vp.height}: the card keeps Next on screen, Skip and the explanation reachable, no sideways scroll`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await onboard(page);
      await openReplayAtScene3(page);
      await next(page).click();
      await expect(checkpointCard(page)).toBeVisible();
      await expect.poll(() => fullyVisible(page, next(page))).toBe(true);
      expect(await fullyVisible(page, page.getByRole('button', { name: 'Close' }))).toBe(true);
      await checkpointSkip(page).scrollIntoViewIfNeeded();
      await expect(checkpointSkip(page)).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`checkpoint-${vp.width}x${vp.height}-open.png`) });

      await option(page, 'f').click();
      await option(page, 't').click();
      // The explanation scrolls into view inside the text area; Next stays pinned.
      await expect(bubble(page)).toBeInViewport();
      await expect.poll(() => fullyVisible(page, next(page))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`checkpoint-${vp.width}x${vp.height}-answered.png`) });
    });
  }
});

// --- Quest mode: the first answer is a scored round -------------------------

async function startQuestReading(page: Page): Promise<void> {
  await hook(page);
  await page.evaluate(
    ([questId, episodeId]) => (window as E2eWindow).__hrStoryE2E?.openQuest({ questId, episodeId }),
    [QUEST, EPISODE] as const,
  );
  await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Read the story' })).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(position(page)).toHaveText('1 / 5');
}

/** Scenes 1-3, then the checkpoint card. */
async function readToCheckpoint(page: Page): Promise<void> {
  for (const n of [2, 3]) {
    await next(page).click();
    await expect(position(page)).toHaveText(`${n} / 5`);
  }
  await next(page).click();
  await expect(checkpointCard(page)).toBeVisible();
}

/** Scenes 4-5, the end page's Continue, every check right first time, the sequence in order, then Results. */
async function finishQuestAllRight(page: Page): Promise<void> {
  await expect(position(page)).toHaveText('4 / 5');
  await next(page).click();
  await next(page).click();
  await page.getByTestId('story-reader-end-primary').click();
  await expect(page.getByRole('heading', { name: 'A few questions' })).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const id of CHECK_RIGHT) {
    await page.getByTestId(`story-check-option-${id}`).click();
    await page.getByTestId('story-check-next').click();
  }
  await expect(page.getByRole('heading', { name: 'Put the story in order' })).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const caption of ORDER) {
    await page.locator('[data-testid^="story-sequence-card-"]').filter({ hasText: caption }).click();
  }
  await page.getByRole('button', { name: 'Skip replay' }).click();
  await page.getByRole('button', { name: 'See results' }).click();
}

test.describe('story reader checkpoints, quest step (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('"Quick question": right first time scores with the quest, 8 of 8 first try is three stars', async ({ page }) => {
    test.setTimeout(120_000);
    await onboard(page);
    await startQuestReading(page);
    await readToCheckpoint(page);
    await expect(page.getByTestId('story-reader-checkpoint-heading')).toHaveText('Quick question');
    await expect(checkpointCard(page)).toHaveAccessibleName('Quick question');
    await option(page, 't').click();
    await expect(bubble(page)).toContainText(EXPLAIN);
    // Back and Next reopen it answered: nothing is asked twice.
    await back(page).click();
    await next(page).click();
    await expect(status(page, 't')).toHaveText('Correct');
    await next(page).click();
    await finishQuestAllRight(page);
    await expect(page.getByText('Wonderful!')).toBeVisible();
    await expect(page.getByRole('button', { name: /^See my card/ })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/\d+\s*(%|\/\s*\d)/);
  });

  test('a first-try miss is the round that counts: 7 of 8 is two stars and still the card', async ({ page }) => {
    test.setTimeout(120_000);
    await onboard(page);
    await startQuestReading(page);
    await readToCheckpoint(page);
    await option(page, 'f').click();
    await expect(status(page, 'f')).toHaveText('Try another');
    // The right card afterwards is a retry, never a second scored answer.
    await option(page, 't').click();
    await next(page).click();
    await finishQuestAllRight(page);
    await expect(page.getByText('Great!')).toBeVisible();
    await expect(page.getByRole('button', { name: /^See my card/ })).toBeVisible();
  });
});
