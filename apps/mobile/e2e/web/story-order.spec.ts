import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, journeyCellName, keepSidewaysIfAsked, passDiscover, playCheckByIds, type CheckAnswer } from './helpers';

/**
 * F-STORY-003 PR 3.5a: Story Order v2 on the shipped Stage 1 sequences.
 * "New Year Order" is the apply step of Holidays quest 3 ("Hanbok and the
 * Bow", F-QUEST-002 Q-7b); its four steps carry Korean and romanization (F-CNT-002).
 * Cards start in a derangement of the correct order, a wrong tap is an amber
 * nudge that moves nothing, the finished order replays, and the quest still
 * completes through its Check. Nothing here needs a Korean voice or a network.
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

/** The quest's Check (F-QUEST-002 section 3.6, quest 9): the vowel yo among yo o yu yeo, then the word 한복. */
const CHECK_RIGHT: readonly [CheckAnswer, CheckAnswer] = [{ answer: 'jamo:yo' }, { answer: '한복' }];

/** Onboard, open Hanbok and the Bow and play up to its Story Order step (Discover read, practice skipped). */
async function openNewYearOrder(page: Page): Promise<void> {
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
  await page.getByRole('button', { name: journeyCellName(1, 'Holidays & Traditions') }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).nth(2).click();
  await page.getByRole('button', { name: 'Play anyway' }).click(); // soft prerequisite sheet
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
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

const PAPER = 'rgb(255, 255, 255)'; // colors.surface.paper

function background(target: Locator): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el).backgroundColor);
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
  await openNewYearOrder(page);

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

test('the shipped steps have no art yet: no picture on a card, and the replay card keeps the paper surface', async ({ page }) => {
  await openNewYearOrder(page);
  await expect(page.locator('[data-testid^="story-sequence-card-art-"]')).toHaveCount(0);
  await placeAll(page);
  await expect(page.getByTestId('story-sequence-replay-art')).toHaveCount(0);
  await expect(page.getByTestId('story-sequence-replay-caption')).toHaveText('Wear hanbok');
  expect(await background(page.getByTestId('story-sequence-replay-card'))).toBe(PAPER);
});

test('a wrong card is an amber nudge that moves nothing; two misses ring the right card', async ({ page }) => {
  await openNewYearOrder(page);
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
  await openNewYearOrder(page);
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

  // Done ends the step (a button, not a timer); the quest is still completable through its Check.
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await playCheckByIds(page, CHECK_RIGHT);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Wonderful!')).toBeVisible(); // four first-try slots and two first-try Check answers
  await expect(page.getByRole('button', { name: /^See my card/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Skip replay ends the step at once; one first-try miss still keeps the card', async ({ page }) => {
  await openNewYearOrder(page);
  await card(page, 'Bow to elders').click(); // one miss on slot 1
  await placeAll(page);
  await page.getByRole('button', { name: 'Skip replay' }).click();
  await playCheckByIds(page, CHECK_RIGHT);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Great!')).toBeVisible(); // 5 of 6 first try (3 of 4 slots, 2 of 2 Check): two stars
  await expect(page.getByRole('button', { name: /^See my card/ })).toBeVisible();
});

test('Skip this one records nothing: the quest goes on to its Check, which alone sets the stars', async ({ page }) => {
  await openNewYearOrder(page);
  await page.getByRole('button', { name: 'Skip this one' }).click();
  // One Check answer right first time of two: 1 star. Had the skipped order counted as four misses, it would be none.
  await playCheckByIds(page, [{ answer: 'jamo:yo' }, { answer: '한복', missWith: '한국' }]);
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('You tried!').or(page.getByText('Good try!')).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^See my card/ })).toHaveCount(0);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the replay does not advance by itself and has no pause control', async ({ page }) => {
    await openNewYearOrder(page);
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
      await openNewYearOrder(page);
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

/**
 * F-STORY-003 PR 3.5b: scene art. No shipped story has a sequence step yet,
 * so this group plays the fixture story's derived shelf quest (opened through
 * the `window.__hrStoryE2E` hook, which exists only in the fixture bundle):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test story-order -g "scene art"
 *
 * `quest:story-hangul-day-listen` orders the listen scenes s1, s2, s4 and s5
 * of `story:hangul-day`; all four have art on `scene:palace-hall`.
 */
const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

const ART_STEPS = [
  { id: 's1', caption: "A king's wish", alt: 'King Sejong sits in a palace hall while Hoya waves.' },
  { id: 's2', caption: 'A new alphabet', alt: 'Scholars hold a book of the new alphabet.' },
  { id: 's4', caption: 'Hangul Day', alt: 'Families fly flags on Hangul Day.' },
  { id: 's5', caption: 'A cheer', alt: 'Hoya cheers with both paws up.' },
] as const;

type StoryE2eWindow = Window & {
  __hrStoryE2E?: { openQuest(p: { questId: string; episodeId: string }): void };
};

/** Onboard, open the fixture shelf quest and skip its read and check steps up to Story Order. */
async function openArtOrder(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as StoryE2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  await page.evaluate(() =>
    (window as StoryE2eWindow).__hrStoryE2E?.openQuest({
      questId: 'quest:story-hangul-day-listen',
      episodeId: 'episode:shelf-hangul-day',
    }),
  );
  await page.getByRole('button', { name: 'Continue' }).click(); // intro
  await page.getByRole('button', { name: 'Skip for now' }).click(); // read
  await page.getByRole('button', { name: 'Skip for now' }).click(); // check
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByRole('heading', { name: 'Put the story in order' })).toBeVisible();
}

const artCard = (page: Page, id: string): Locator => page.getByTestId(`story-sequence-card-${id}`);
const cardArt = (page: Page, id: string): Locator => page.getByTestId(`story-sequence-card-art-${id}`);

async function placeArtSteps(page: Page): Promise<void> {
  for (const step of ART_STEPS) await artCard(page, step.id).click();
  await expect(page.getByRole('heading', { name: 'The story, in order' })).toBeVisible();
}

/** Escapes text for a RegExp (captions and alt text hold `.` and `'`). */
const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** How many of the story cards sit on each row of the grid. */
async function cardRows(page: Page): Promise<number[]> {
  const ys = await Promise.all(ART_STEPS.map(async (s) => Math.round((await artCard(page, s.id).boundingBox())?.y ?? -1)));
  const counts = new Map<number, number>();
  for (const y of ys) counts.set(y, (counts.get(y) ?? 0) + 1);
  return [...counts.values()];
}

/** The picture lies inside its card, at least touchTarget.child (80) wide and at most 2 x touchTarget.hero (192). */
async function expectPictureInCard(page: Page, id: string): Promise<{ x: number; y: number; width: number }> {
  const art = await cardArt(page, id).boundingBox();
  const box = await artCard(page, id).boundingBox();
  expect(art && box, `card ${id} and its picture are laid out`).toBeTruthy();
  if (!art || !box) throw new Error('no layout');
  expect(art.width).toBeGreaterThanOrEqual(80);
  expect(art.width).toBeLessThanOrEqual(192 + 0.5);
  expect(Math.abs(art.height - (art.width * 3) / 4)).toBeLessThan(1.5); // 4:3
  expect(art.x).toBeGreaterThanOrEqual(box.x);
  expect(art.x + art.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
  return { x: box.x, y: box.y, width: art.width };
}

test.describe('scene art (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('every story card shows its picture inside the card; the replay shows each picture full width with its description', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await openArtOrder(page);

    const placed: Array<{ x: number; y: number; width: number }> = [];
    for (const step of ART_STEPS) {
      await expect(cardArt(page, step.id)).toBeVisible();
      placed.push(await expectPictureInCard(page, step.id));
      // The picture is decorative on a card: the card's own words name it (the caption), not the alt text.
      await expect(artCard(page, step.id)).toHaveAccessibleName(new RegExp(escapeRe(step.caption)));
      await expect(artCard(page, step.id)).not.toHaveAccessibleName(new RegExp(escapeRe(step.alt)));
    }
    // A 393-wide phone keeps two columns: two cards share a row.
    const rows = new Set(placed.map((p) => Math.round(p.y)));
    expect(rows.size).toBeLessThan(placed.length);

    await placeArtSteps(page);
    // Pause first: the replay auto-advances every 2.5 s, and the checks below read card 1.
    await page.getByRole('button', { name: 'Pause' }).click();
    const replayArt = page.getByTestId('story-sequence-replay-art');
    await expect(replayArt).toBeVisible();
    await expect(replayArt).toHaveAttribute('aria-label', ART_STEPS[0].alt);
    const replayBox = await replayArt.boundingBox();
    expect(replayBox?.width ?? 0).toBeGreaterThan(placed[0]?.width ?? 0);
    const cardBox = await page.getByTestId('story-sequence-replay-card').boundingBox();
    expect((replayBox?.x ?? 0) + (replayBox?.width ?? 0)).toBeLessThanOrEqual((cardBox?.x ?? 0) + (cardBox?.width ?? 0));
    expect(await background(page.getByTestId('story-sequence-replay-card'))).toBe(PAPER);
    await expect(page.getByTestId('story-sequence-replay-caption')).toHaveText(ART_STEPS[0].caption);

    // Each card of the replay brings its own picture.
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(replayArt).toHaveAttribute('aria-label', ART_STEPS[1].alt);
    await expect(page.getByTestId('story-sequence-replay-caption')).toHaveText(ART_STEPS[1].caption);

    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByTestId('story-sequence-replay-card')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  for (const vp of [
    { name: '320x568', width: 320, height: 568 },
    { name: '360x740', width: 360, height: 740 },
    { name: '375x667', width: 375, height: 667 },
    { name: '844x390', width: 844, height: 390 },
    { name: '1024x768', width: 1024, height: 768 },
    // 200 % text scale on a 1024x768 tablet, modelled as half the window (tablet-layout.spec.ts).
    { name: '200 % zoom proxy of 1024x768', width: 512, height: 384 },
  ] as const) {
    test.describe(vp.name, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('pictures fit their cards with no sideways scroll; the replay picture leaves its controls near', async ({ page }) => {
        await openArtOrder(page);
        const noSideScroll = (): Promise<boolean> =>
          page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
        for (const step of ART_STEPS) await expectPictureInCard(page, step.id);
        expect(await noSideScroll()).toBe(true);
        if (vp.width === 320) {
          // Too narrow for two pictures side by side: one column.
          const xs = await Promise.all(ART_STEPS.map(async (s) => Math.round((await artCard(page, s.id).boundingBox())?.x ?? -1)));
          expect(new Set(xs).size).toBe(1);
        } else if (vp.width === 360 || vp.width === 375) {
          // F-STORY-003 §3.5: two columns from 360 dp, pictures included.
          expect(Math.max(...(await cardRows(page)))).toBe(2);
        } else if (vp.width === 1024) {
          // Tablet width: three or four columns with pictures.
          expect(Math.max(...(await cardRows(page)))).toBeGreaterThanOrEqual(3);
        }

        await placeArtSteps(page);
        const art = await page.getByTestId('story-sequence-replay-art').boundingBox();
        // At most 42 % of the window height (4:3), so the words and controls follow close below.
        expect(art?.height ?? 0).toBeGreaterThan(0);
        expect(art?.height ?? 0).toBeLessThanOrEqual(vp.height * 0.42 + 1);
        await expectReachable(page, page.getByRole('button', { name: 'Done', exact: true }));
        expect(await noSideScroll()).toBe(true);
      });
    });
  }
});
