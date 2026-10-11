import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored } from './helpers';
import { fullyVisible } from './story-reader-helpers';

/**
 * F-STORY-003 PR 3.4a: the story check step (`StoryCheckGame`, the
 * `story-check` case of the minigame shell), played inside the fixture
 * story's shelf quest. Like the reader quest suite, it needs the fixture
 * bundle (served from dist-e2e/), which holds `story:hangul-day` and the
 * `window.__hrStoryE2E` hook:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web story-checks
 *
 * `quest:story-hangul-day-listen` is intro, read, check, sequence, reward.
 * The suite skips the read step (it scores nothing), so the quest scores
 * 3 check rounds + 4 sequence slots = 7 rounds. Star tiers: 7 of 7 first try
 * = 3 stars; 6 of 7 = 2 stars and the card; 3 of 7 = 1 star, no card.
 * The silent speech engine (fixtures.ts) has no voices, like CI: every item
 * must stay playable with no sound at all.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const QUEST = 'quest:story-hangul-day-listen';
const EPISODE = 'episode:shelf-hangul-day';
const EMOJI = /\p{Extended_Pictographic}/u;
const AMBER = 'rgb(242, 179, 61)'; // colors.feedback.nudge
const RED = 'rgb(200, 75, 61)'; // colors.feedback.danger: never on a learner's miss

/** The listen tier's checks: the correct option id and a wrong one (display order is shuffled, ids are stable). */
const C1 = { right: 'a', wrong: ['b', 'c'], explain: 'King Sejong led the work so that ordinary people could read.' };
const C2 = { right: 'a', wrong: ['b', 'c'], explain: 'Hangul Day is the day Korea celebrates its alphabet.' };
const C3 = { right: 't', wrong: ['f'], explain: 'Hangul Day is celebrated on October 9.' };
/** The sequence step's cards in the correct order (listen tier `sequenceSceneIds`). */
const ORDER = ["A king's wish", 'A new alphabet', 'Hangul Day', 'A cheer'];

type E2eWindow = Window & {
  __hrStoryE2E?: {
    openQuest(p: { questId: string; episodeId: string }): void;
    events(): Array<{ name: string; profileId?: string; payload?: Record<string, unknown> }>;
  };
  __silentSpeech?: string[];
};

async function onboard(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

const stepHeading = (page: Page, name: string): Locator => page.getByRole('heading', { name });
const option = (page: Page, id: string): Locator => page.getByTestId(`story-check-option-${id}`);
const position = (page: Page): Locator => page.getByTestId('story-check-position');
const nextButton = (page: Page): Locator => page.getByTestId('story-check-next');

/** Stored learner settings (`settings:<profileId>`), seeded before the quest opens. */
type LearnerSettings = { romanizationMode?: 'always' | 'tap'; readToMe?: boolean };

async function seedSettings(page: Page, settings: LearnerSettings): Promise<void> {
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  await seedStored(page, `settings:${id}`, { romanizationMode: 'always', ...settings });
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

/** Intro, skip the read step, then open the check step. */
async function openChecks(page: Page, settings?: LearnerSettings): Promise<void> {
  await onboard(page);
  if (settings) await seedSettings(page, settings);
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  await page.evaluate(
    ([questId, episodeId]) => (window as E2eWindow).__hrStoryE2E?.openQuest({ questId, episodeId }),
    [QUEST, EPISODE] as const,
  );
  await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(stepHeading(page, 'Read the story')).toBeVisible();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(stepHeading(page, 'A few questions')).toBeVisible();
  await expect(page.getByText('3 / 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByTestId('story-check-prompt')).toBeVisible();
}

/** Answer the current item (the given wrong taps first), check the explanation, and tap Next. */
async function answer(page: Page, item: { right: string; explain: string }, wrong: string[] = []): Promise<void> {
  for (const id of wrong) await option(page, id).click();
  await option(page, item.right).click();
  await expect(page.getByText(item.explain)).toBeVisible();
  await nextButton(page).click();
}

/** The sequence step, every card right first time unless `missFirst`, then Skip replay and Results. */
async function finishQuest(page: Page, missFirst = false): Promise<void> {
  await expect(stepHeading(page, 'Put the story in order')).toBeVisible();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByRole('heading', { name: 'Put the story in order' })).toBeVisible();
  for (const [i, caption] of ORDER.entries()) {
    if (missFirst && i === 0) await sequenceCard(page, ORDER[1]!).click();
    await sequenceCard(page, caption).click();
  }
  await page.getByRole('button', { name: 'Skip replay' }).click();
  await page.getByRole('button', { name: 'See results' }).click();
}

const sequenceCard = (page: Page, caption: string): Locator =>
  page.locator('[data-testid^="story-sequence-card-"]').filter({ hasText: caption });

function storyEvents(page: Page): Promise<Array<{ name: string; payload?: Record<string, unknown> }>> {
  return page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.events() ?? []);
}

/** Border colour of a card's frame (the first child of its pressable). */
function frameColor(target: Locator): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el.firstElementChild ?? el).borderTopColor);
}

test.describe('story check step (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('all first try: explanation, no auto-advance, Next; three stars and the card', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await openChecks(page);

    // Item 1: position 1 / 3, the prompt, 3 option cards, a speaker; no Hoya line and no Next yet.
    await expect(position(page)).toHaveText('1 / 3');
    await expect(page.getByTestId('story-check-prompt')).toHaveText('Who led the making of the Korean alphabet?');
    await expect(page.locator('[data-testid^="story-check-option-"]')).toHaveCount(3);
    await expect(page.getByTestId('story-check-speaker')).toBeVisible();
    await expect(nextButton(page)).toHaveCount(0);
    await expect(page.getByText(C1.explain)).toHaveCount(0);

    // Right first: the check look in words, the explanation, the other cards disabled, Next waits.
    await option(page, C1.right).click();
    await expect(page.getByTestId(`story-check-status-${C1.right}`)).toHaveText('Correct');
    await expect(page.getByText(C1.explain)).toBeVisible();
    await expect(option(page, C1.right)).toHaveAccessibleName(/Correct$/);
    await expect(nextButton(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeFocused();
    // The other cards are disabled: a tap on one changes nothing and scores nothing.
    await option(page, C1.wrong[0]!).click({ force: true });
    await expect(page.getByTestId(`story-check-status-${C1.wrong[0]!}`)).toHaveCount(0);
    await page.waitForTimeout(3000);
    await expect(position(page)).toHaveText('1 / 3'); // no auto-advance (D3)
    await nextButton(page).click();

    // Item 2 (pick-meaning): the target in Korean with romanization; its gloss would give the answer away.
    await expect(position(page)).toHaveText('2 / 3');
    await expect(page.getByTestId('story-check-prompt')).toHaveText('What does 한글날 mean?');
    const target = page.getByTestId('story-check-target');
    await expect(target).toContainText('한글날');
    await expect(target).toContainText('hangeullal');
    await expect(target).not.toContainText('Hangul Day');
    // No Korean voice on this device: the shared "Say it yourself" chip, and the text carries the item.
    await expect(page.getByTestId('story-check-say-it')).toHaveText('Say it yourself');
    await expect(target).not.toHaveAttribute('role', 'button'); // the chip replaces the Korean speaker
    await option(page, C2.right).click();
    await expect(target).toContainText('Hangul Day'); // the gloss shows once the item resolves
    await expect(page.getByText(C2.explain)).toBeVisible();
    await nextButton(page).click();

    // Item 3 (true-false): never shuffled, True then False.
    await expect(position(page)).toHaveText('3 / 3');
    const shown = await page.locator('[data-testid^="story-check-option-"]').allInnerTexts();
    expect(shown.map((t) => t.trim())).toEqual(['True', 'False']);
    await answer(page, C3);

    const events = await storyEvents(page);
    const answered = events.filter((e) => e.name === 'story.check.answered');
    expect(answered.map((e) => e.payload)).toEqual([
      { storyId: 'story:hangul-day', level: 'listen', checkId: 'c1', kind: 'who', firstTry: true, taps: 1 },
      { storyId: 'story:hangul-day', level: 'listen', checkId: 'c2', kind: 'pick-meaning', firstTry: true, taps: 1 },
      { storyId: 'story:hangul-day', level: 'listen', checkId: 'c3', kind: 'true-false', firstTry: true, taps: 1 },
    ]);
    expect(events.filter((e) => e.name === 'story.check.finished').map((e) => e.payload)).toEqual([
      { storyId: 'story:hangul-day', level: 'listen', items: 3, firstTryCorrect: 3, retries: 0 },
    ]);

    // Next on the last item ends the step (no recap before PR 3.4b): the quest moves on.
    await finishQuest(page);
    await expect(page.getByText('Wonderful!')).toBeVisible();
    await expect(page.getByRole('button', { name: /^See my card/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a wrong tap is an amber "Try another"; a second one rings the right card; one miss keeps the card', async ({ page }) => {
    await openChecks(page);
    const [first, second] = C1.wrong as [string, string];

    await option(page, first).click();
    await expect(page.getByTestId(`story-check-status-${first}`)).toHaveText('Try another');
    expect(await frameColor(option(page, first))).toBe(AMBER);
    expect(await frameColor(option(page, first))).not.toBe(RED);
    await expect(option(page, first)).toHaveAccessibleName(/Try another$/);
    await expect(page.getByText('Think of the king in the first scene.')).toBeVisible(); // the check's hint
    await expect(position(page)).toHaveText('1 / 3'); // the item stays open
    await expect(nextButton(page)).toHaveCount(0);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(EMOJI);
    expect(body).not.toContain('Wrong');

    // A locked card does nothing; a second wrong card rings the right one.
    await option(page, first).click({ force: true });
    await option(page, second).click();
    await expect(page.getByText('This one is worth a look.')).toBeVisible();
    await expect(option(page, C1.right)).toHaveAccessibleName(/This one is worth a look\.$/);

    await option(page, C1.right).click();
    await expect(page.getByText(C1.explain)).toBeVisible();
    await nextButton(page).click();
    await answer(page, C2);
    await answer(page, C3);

    const events = await storyEvents(page);
    expect(events.find((e) => e.name === 'story.check.answered')?.payload).toMatchObject({ checkId: 'c1', firstTry: false, taps: 3 });
    expect(events.find((e) => e.name === 'story.check.finished')?.payload).toEqual({
      storyId: 'story:hangul-day',
      level: 'listen',
      items: 3,
      firstTryCorrect: 2,
      retries: 2,
    });

    // Three taps on one item cost one round: 6 of 7, two stars, and the card is still earned.
    await finishQuest(page);
    await expect(page.getByText('Great!')).toBeVisible();
    await expect(page.getByRole('button', { name: /^See my card/ })).toBeVisible();
  });

  test('four first-try misses of seven: one star and no card, and no number on Results', async ({ page }) => {
    await openChecks(page);
    await answer(page, C1, [C1.wrong[0]!]);
    await answer(page, C2, [C2.wrong[0]!]);
    await answer(page, C3, [C3.wrong[0]!]);
    await finishQuest(page, true);
    await expect(page.getByText('You tried!')).toBeVisible();
    await expect(page.getByRole('button', { name: /^See my card/ })).toHaveCount(0);
    const results = await page.locator('body').innerText();
    expect(results).not.toMatch(/\d+\s*(%|\/\s*\d)/);
  });

  test('screen reader: the labelled position, Korean in a Korean voice, each outcome said once, Close', async ({ page }) => {
    await openChecks(page);
    // The pill says "Question 1 of 3", not "one slash three"; the bar and the bare pill are hidden.
    await expect(page.getByTestId('story-check-position-group')).toHaveAccessibleName('Question 1 of 3');
    await expect(page.getByRole('group', { name: 'Question 1 of 3' })).toBeVisible();
    await option(page, C1.wrong[0]!).click();
    // The status line is the visible cue; the card's name already ends with it.
    await expect(page.getByTestId(`story-check-status-${C1.wrong[0]!}`)).toHaveText('Try another');
    const hidden = await page
      .getByTestId(`story-check-status-${C1.wrong[0]!}`)
      .evaluate((el) => Boolean(el.closest('[aria-hidden="true"]')));
    expect(hidden).toBe(true);
    await answer(page, C1);

    // The inline target of "What does 한글날 mean?" is marked Korean.
    await expect(page.getByTestId('story-check-prompt')).toHaveText('What does 한글날 mean?');
    await expect(page.getByTestId('story-check-prompt').locator('[lang="ko"]')).toHaveText('한글날');
    await expect(page.getByTestId('story-check-position-group')).toHaveAccessibleName('Question 2 of 3');

    // Close: back to the quest step without finishing it (wireframe check.md A).
    const close = page.getByTestId('story-check-close');
    await expect(close).toHaveAccessibleName('Close');
    await close.click();
    await expect(stepHeading(page, 'A few questions')).toBeVisible();
    const events = await storyEvents(page);
    expect(events.filter((e) => e.name === 'story.check.finished')).toEqual([]);
    expect(events.filter((e) => e.name === 'story.check.answered').map((e) => e.payload?.checkId)).toEqual(['c1']);
  });

  test('Read to me: the question is read when each item opens, with no tap', async ({ page }) => {
    await openChecks(page, { readToMe: true });
    const asked = (): Promise<string[]> => page.evaluate(() => (window as E2eWindow).__silentSpeech ?? []);
    await expect.poll(asked).toContain('Who led the making of the Korean alphabet?');
    await page.evaluate(() => {
      (window as E2eWindow).__silentSpeech?.splice(0);
    });
    await answer(page, C1);
    await expect.poll(asked).toContain('What does ');
    // Read once per item: answering and waiting reads nothing more for this item.
    await option(page, C2.right).click();
    const count = (await asked()).filter((t) => t === 'What does ').length;
    await page.waitForTimeout(1000);
    expect((await asked()).filter((t) => t === 'What does ').length).toBe(count);
  });

  test('hide until tap: romanization behind "Show how to say it", and always shown once resolved', async ({ page }) => {
    await openChecks(page, { romanizationMode: 'tap' });
    // Item 1 has no Korean: nothing to reveal.
    await expect(page.getByTestId('story-check-reveal')).toHaveCount(0);
    await answer(page, C1);

    const target = page.getByTestId('story-check-target');
    await expect(target).toContainText('한글날');
    await expect(target).not.toContainText('hangeullal');
    const reveal = page.getByTestId('story-check-reveal');
    await expect(reveal).toHaveText('Show how to say it');
    await reveal.click();
    await expect(target).toContainText('hangeullal');
    await expect(reveal).toHaveCount(0);
    await answer(page, C2);
    // Item 3 has no Korean: the reveal does not carry over.
    await expect(position(page)).toHaveText('3 / 3');
    await expect(page.getByTestId('story-check-reveal')).toHaveCount(0);
  });

  test('hide until tap, never revealed: the romanization shows once the item resolves', async ({ page }) => {
    await openChecks(page, { romanizationMode: 'tap' });
    await answer(page, C1);
    const target = page.getByTestId('story-check-target');
    await expect(target).not.toContainText('hangeullal');
    await option(page, C2.right).click();
    await expect(target).toContainText('hangeullal');
    await expect(page.getByTestId('story-check-reveal')).toHaveCount(0);
  });

  test('no sound needed: the speaker asks for the question, and the step still plays to the end', async ({ page }) => {
    await openChecks(page);
    await page.getByTestId('story-check-speaker').click();
    await expect
      .poll(() => page.evaluate(() => (window as E2eWindow).__silentSpeech ?? []))
      .toContain('Who led the making of the Korean alphabet?');
    await answer(page, C1);
    await answer(page, C2);
    await answer(page, C3);
    await expect(stepHeading(page, 'Put the story in order')).toBeVisible();
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('state changes are instant and nothing moves on by itself', async ({ page }) => {
      await openChecks(page);
      await option(page, C1.right).click();
      await expect(page.getByTestId(`story-check-status-${C1.right}`)).toHaveText('Correct');
      await page.waitForTimeout(2500);
      await expect(position(page)).toHaveText('1 / 3');
      await nextButton(page).click();
      await expect(position(page)).toHaveText('2 / 3');
    });
  });

  for (const vp of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ]) {
    test(`${vp.width}x${vp.height}: the options and Next are reachable, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize(vp);
      await openChecks(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // A wide window keeps the reading column (tokens layout.maxWidth.reading = 720).
      const optionsBox = await page.getByTestId('story-check-options').boundingBox();
      expect(optionsBox?.width ?? 0).toBeLessThanOrEqual(720);
      await option(page, C1.right).scrollIntoViewIfNeeded();
      await option(page, C1.right).click();
      const next = nextButton(page);
      await next.scrollIntoViewIfNeeded();
      await expect.poll(() => fullyVisible(page, next)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/story-check-${vp.width}x${vp.height}.png`, fullPage: true });
      await next.click();
      await expect(position(page)).toHaveText('2 / 3');
    });
  }
});
