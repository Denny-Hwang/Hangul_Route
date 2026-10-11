import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked } from './helpers';

/**
 * F-STORY-003 PR 3.5a: Story Order v2 on the shipped Stage 1 sequences.
 * "New Year Order" is the apply step of the Seollal quest ("Bow & Eat
 * Tteokguk"); its four steps carry Korean and romanization (F-CNT-002).
 * Cards start in a derangement of the correct order, a wrong tap is an amber
 * nudge that moves nothing, the finished order replays, and the quest still
 * completes. Nothing here needs a Korean voice or a network.
 */

/** Correct order of the Seollal steps: English caption, Korean, romanization. */
const STEPS = [
  { caption: 'Wear hanbok', ko: '한복 입기', rr: 'hanbok ipgi' },
  { caption: 'Bow to elders', ko: '세배 드리기', rr: 'sebae deurigi' },
  { caption: 'Eat tteokguk', ko: '떡국 먹기', rr: 'tteokguk meokgi' },
  { caption: 'Receive lucky money', ko: '세뱃돈 받기', rr: 'sebaetdon batgi' },
] as const;

const AMBER = 'rgb(242, 179, 61)'; // colors.feedback.nudge
const RED = 'rgb(200, 75, 61)'; // colors.feedback.danger: never on a learner's miss

/** Onboard, open the Seollal quest and play up to its Story Order step (the other games are skipped). */
async function openSeollalOrder(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: 'Holidays & Traditions episode for stage1' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  await page.getByRole('button', { name: 'Play anyway' }).click(); // soft prerequisite sheet
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByRole('heading', { name: 'Put the story in order' })).toBeVisible();
}

const card = (page: Page, caption: string): Locator =>
  page.getByRole('button', { name: new RegExp(`${caption}(\\.|$)`) }).filter({ hasNotText: 'Skip' });

/** Scroll the way a learner would (wheel over the screen) until the target is fully visible. */
async function expectReachable(page: Page, target: Locator): Promise<void> {
  const vp = page.viewportSize();
  if (!vp) throw new Error('viewport size unavailable');
  await expect(target).toBeAttached();
  for (let i = 0; i < 15 && !(await target.isVisible() && (await fullyInViewport(page, target))); i += 1) {
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await page.mouse.wheel(0, Math.round(vp.height / 2));
    await page.waitForTimeout(120);
  }
  await expect(target).toBeInViewport({ ratio: 1 });
}

async function fullyInViewport(page: Page, target: Locator): Promise<boolean> {
  const vp = page.viewportSize();
  const box = await target.boundingBox();
  if (!vp || !box) return false;
  return box.y >= 0 && box.x >= 0 && box.y + box.height <= vp.height && box.x + box.width <= vp.width;
}

/** Border colour of a card's frame (the first child of its pressable). */
function frameColor(target: Locator): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el.firstElementChild ?? el).borderTopColor);
}

/** Card captions in the order they are shown (the order a screen reader walks them). */
async function shownOrder(page: Page): Promise<string[]> {
  const shown = await page.locator('[data-testid^="story-sequence-card-"]').allInnerTexts();
  return STEPS.map((s) => s.caption)
    .filter((c) => shown.some((t) => t.includes(c)))
    .sort((a, b) => shown.findIndex((t) => t.includes(a)) - shown.findIndex((t) => t.includes(b)));
}

async function placeAll(page: Page): Promise<void> {
  for (const [i, step] of STEPS.entries()) {
    await card(page, step.caption).click();
    if (i < STEPS.length - 1) {
      await expect(page.getByTestId(`story-sequence-slot-${i + 1}`)).toContainText(step.caption);
    }
  }
  await expect(page.getByRole('heading', { name: 'The story, in order' })).toBeVisible(); // the last card starts the replay
}

test('the cards never start in the right order, and every one carries its Korean and romanization', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openSeollalOrder(page);

  const order = await shownOrder(page);
  expect(order).toHaveLength(4);
  expect(order).not.toEqual(STEPS.map((s) => s.caption));
  order.forEach((caption, i) => expect(caption, `card ${i + 1} sits in its own place`).not.toBe(STEPS[i]?.caption));

  for (const step of STEPS) {
    const target = card(page, step.caption);
    await expect(target).toContainText(step.ko);
    await expect(target).toContainText(step.rr);
    await expect(target).toContainText(step.caption);
  }
  // The four numbered slots are empty, and the fill-only position pill starts at 0.
  for (const n of [1, 2, 3, 4]) await expect(page.getByTestId(`story-sequence-slot-${n}`)).toBeVisible();
  await expect(page.getByText('0 / 4')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a wrong card is an amber nudge that moves nothing; two misses ring the right card', async ({ page }) => {
  await openSeollalOrder(page);
  const wrong = card(page, 'Eat tteokguk');

  await wrong.click();
  await expect(page.getByText('Try another').first()).toBeVisible();
  expect(await frameColor(wrong)).toBe(AMBER);
  expect(await frameColor(wrong)).not.toBe(RED);
  await expect(page.getByText('0 / 4')).toBeVisible(); // nothing moved, nothing dropped
  await expect(page.getByTestId('story-sequence-slot-1')).not.toContainText('Eat tteokguk');

  // After the flash the card is plain again; a second wrong card rings the right one.
  await page.waitForTimeout(800);
  await card(page, 'Receive lucky money').click();
  await expect(page.getByText('This one comes next.')).toBeVisible();
  const right = card(page, 'Wear hanbok');
  await expect(right).toHaveAccessibleName(/This one comes next\./);

  await right.click();
  await expect(page.getByTestId('story-sequence-slot-1')).toContainText('Wear hanbok');
  await expect(page.getByText('1 / 4')).toBeVisible();
});

test('every slot placed: the story replays in order, pauses, steps, and Done finishes the quest with its card', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openSeollalOrder(page);
  await placeAll(page);

  // Replay: first card in full, with its Korean and caption.
  const caption = page.getByTestId('story-sequence-replay-caption');
  await expect(page.getByRole('heading', { name: 'The story, in order' })).toBeVisible();
  await expect(caption).toHaveText('Wear hanbok');
  await expect(page.getByTestId('story-sequence-replay-card')).toContainText('한복 입기');
  await expect(page.getByTestId('story-sequence-replay-card')).toContainText('hanbok ipgi');

  // Paused: it stays put well past the 2.5 s step.
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.waitForTimeout(3200);
  await expect(caption).toHaveText('Wear hanbok');

  // Next and Back are manual; Play resumes the auto-advance.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(caption).toHaveText('Bow to elders');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(caption).toHaveText('Wear hanbok');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(caption).toHaveText('Bow to elders', { timeout: 4500 });

  // Done ends the step (a button, not a timer); the Seollal quest is still completable.
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Wonderful!')).toBeVisible(); // four first-try slots
  await expect(page.getByRole('button', { name: /^See my card/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Skip replay ends the step at once; one first-try miss still keeps the card', async ({ page }) => {
  await openSeollalOrder(page);
  await card(page, 'Bow to elders').click(); // one miss on slot 1
  await placeAll(page);
  await page.getByRole('button', { name: 'Skip replay' }).click();
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Great!')).toBeVisible(); // 3 of 4 first try: two stars
  await expect(page.getByRole('button', { name: /^See my card/ })).toBeVisible();
});

test('Skip this one records nothing: the quest still finishes and no star is given', async ({ page }) => {
  await openSeollalOrder(page);
  await page.getByRole('button', { name: 'Skip this one' }).click();
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('All done!')).toBeVisible();
  await expect(page.getByRole('button', { name: /^See my card/ })).toHaveCount(0);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the replay does not advance by itself and has no pause control', async ({ page }) => {
    await openSeollalOrder(page);
    await placeAll(page);
    const caption = page.getByTestId('story-sequence-replay-caption');
    await expect(caption).toHaveText('Wear hanbok');
    await page.waitForTimeout(3200);
    await expect(caption).toHaveText('Wear hanbok');
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(caption).toHaveText('Bow to elders');
  });
});

for (const vp of [
  { name: 'iPhone SE 320x568', width: 320, height: 568 },
  { name: 'phone landscape 844x390', width: 844, height: 390 },
] as const) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('cards stay in one column of whole words, Skip and Done are reachable by scrolling', async ({ page }) => {
      await openSeollalOrder(page);
      const noSideScroll = (): Promise<boolean> =>
        page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(await noSideScroll()).toBe(true);

      await expectReachable(page, page.getByRole('button', { name: 'Skip this one' }));

      await placeAll(page);
      await expectReachable(page, page.getByRole('button', { name: 'Done', exact: true }));
      expect(await noSideScroll()).toBe(true);
    });
  });
}
