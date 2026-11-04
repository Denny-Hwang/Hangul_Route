import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { readStored } from './helpers';
import { shot } from './shots';

/**
 * Finish at the end of a lecture (F-TCH-004 section 3.5 amendment 2026-11-03, row NB-1; owner report:
 * "After each lecture there is no Finish button. Pressing Exit to leave counts as cancelled, not
 * completed, so the learning record is not kept"). On the real build:
 * - at the end of the run Next reads Finish on the docked bar, the phone rail and the phone's floating
 *   bar, and a press records the lesson as finished at once (the Recent row's `finishedAt`, "Finished:
 *   Today", Start over and no Resume);
 * - Exit after the last slide was reached offers Finish and records the same;
 * - Exit part way keeps the slide for Resume (`lastSlideKey`) and records nothing as finished;
 * - the home with a finished row fits a 320 px phone.
 * `lecture.complete` itself (`finished`) is held by `presenter-nav-telemetry.spec.ts` on an API build and
 * by the render lane (`presenter-finish.test.tsx`). Screenshots with `HR_SHOTS=1`.
 */

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2efinish01',
  title: 'Finish lesson',
  createdAt: '2026-11-03T09:00:00Z',
  seed: 3,
  blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
};
const link = `/present#d=${encodeDeck(DECK)}`;
const ROW = `presenter-recent-${DECK.id}`;

type RecentRow = { deck: { id: string }; savedAt: string; lastSlideKey?: string; finishedAt?: string };

/** Start asks for fullscreen; headless Chromium would resize the window, which no phone or tablet does. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = function requestFullscreen(): Promise<void> {
      return Promise.resolve();
    };
  });
});

async function row(page: Page): Promise<RecentRow | undefined> {
  return (await readStored<{ items: RecentRow[] }>(page, 'lecture:recent'))?.items.find((i) => i.deck.id === DECK.id);
}

async function startLesson(page: Page, touch: boolean): Promise<void> {
  await page.goto(link);
  const start = page.getByTestId('presenter-start-button');
  await expect(start).toBeEnabled({ timeout: 10_000 });
  if (touch) await start.tap();
  else await start.click();
  await expect(page.getByTestId('presenter-stage')).toBeVisible();
}

/** The End key, then Next until it reads Finish (the End slide at its last build). */
async function toTheEnd(page: Page): Promise<void> {
  await page.keyboard.press('End');
  const next = page.getByTestId('presenter-next');
  for (let i = 0; i < 10 && (await next.getAttribute('aria-label')) !== 'Finish'; i++) await page.keyboard.press('ArrowRight');
  await expect(next).toHaveAccessibleName('Finish');
}

async function pressId(page: Page, id: string, touch: boolean): Promise<void> {
  const target = page.getByTestId(id);
  await expect(target).toBeVisible();
  await expect(target).not.toHaveCSS('pointer-events', 'none');
  if (touch) await target.tap();
  else await target.click();
}

/** The finished row on the home: "Finished: Today", Start over as its one action. */
async function expectFinishedRow(page: Page): Promise<void> {
  await expect(page.getByTestId('presenter-home')).toBeVisible();
  await expect(page.getByTestId(`presenter-recent-day-${DECK.id}`)).toHaveText('Finished: Today');
  await expect(page.getByTestId(`presenter-recent-resume-${DECK.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`presenter-recent-startover-${DECK.id}`)).toBeVisible();
  await expect.poll(async () => (await row(page))?.finishedAt ?? null).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect((await row(page))?.lastSlideKey).toBeUndefined();
}

const MATRIX = [
  { name: 'docked bar 1280 x 720, mouse', width: 1280, height: 720, phone: false, touch: false, bar: 'presenter-bar-band' },
  { name: 'phone rail 844 x 390, touch', width: 844, height: 390, phone: true, touch: true, bar: 'presenter-rail' },
  { name: 'floating bar 568 x 320, touch', width: 568, height: 320, phone: true, touch: true, bar: 'presenter-bar-compact' },
] as const;

for (const c of MATRIX) {
  test.describe(c.name, () => {
    test.use({ viewport: { width: c.width, height: c.height }, isMobile: c.phone, hasTouch: c.touch });

    test('Next reads Finish at the end; Finish records the lesson as finished at once', async ({ page }) => {
      await startLesson(page, c.touch);
      await expect(page.getByTestId(c.bar)).toHaveCount(1);
      await expect(page.getByTestId('presenter-next')).not.toHaveAccessibleName('Finish');
      await toTheEnd(page);
      // A key at the end never leaves: the hint, and focus on Finish (the floating bar shows).
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('presenter-end-hint')).toHaveText('To finish, choose Finish.');
      await expect(page.getByTestId('presenter-next')).toBeFocused();
      await expect(page.getByTestId('presenter-stage')).toBeVisible();
      await shot(page, `presenter-finish-${c.width}x${c.height}`);
      await pressId(page, 'presenter-next', c.touch);
      await expect(page.getByTestId('presenter-exit-dialog')).toHaveCount(0);
      await expectFinishedRow(page);
      await shot(page, `presenter-finish-home-${c.width}x${c.height}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(c.width);
    });

    test('Exit after the last slide was reached offers Finish and records the lesson as finished', async ({ page }) => {
      await startLesson(page, c.touch);
      await toTheEnd(page);
      await page.keyboard.press('ArrowLeft');
      await expect(page.getByTestId('presenter-next')).not.toHaveAccessibleName('Finish');
      await page.keyboard.press('Escape');
      const dialog = page.getByTestId('presenter-exit-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Finish the lesson?')).toBeVisible();
      await expect(dialog.getByText('You reached the end of the lesson.')).toBeVisible();
      await expect(page.getByTestId('presenter-exit-confirm')).toHaveAccessibleName('Finish');
      await expect(page.getByTestId('presenter-exit-confirm')).toBeFocused();
      await shot(page, `presenter-finish-confirm-${c.width}x${c.height}`);
      await pressId(page, 'presenter-exit-confirm', c.touch);
      await expectFinishedRow(page);
    });

    test('Exit part way keeps the slide for Resume; nothing is recorded as finished', async ({ page }) => {
      await startLesson(page, c.touch);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Escape');
      const dialog = page.getByTestId('presenter-exit-dialog');
      await expect(dialog.getByText('Leave the lesson?')).toBeVisible();
      await expect(dialog.getByText('Recent lessons keeps this slide, so you can resume later.')).toBeVisible();
      await expect(page.getByTestId('presenter-exit-confirm')).toHaveAccessibleName('Exit');
      await shot(page, `presenter-leave-confirm-${c.width}x${c.height}`);
      await pressId(page, 'presenter-exit-confirm', c.touch);
      await expect(page.getByTestId('presenter-home')).toBeVisible();
      await expect(page.getByTestId(`presenter-recent-resume-${DECK.id}`)).toBeVisible();
      await expect.poll(async () => (await row(page))?.lastSlideKey ?? null).not.toBeNull();
      expect((await row(page))?.finishedAt).toBeUndefined();
    });
  });
}

test.describe('the home at the narrowest phone, 320 x 568', () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

  test('a finished row reads "Finished: Today" with Start over, and nothing scrolls sideways', async ({ page }) => {
    // The lesson itself runs sideways (568 x 320); the home is then seen upright.
    await page.setViewportSize({ width: 568, height: 320 });
    await startLesson(page, true);
    await toTheEnd(page);
    // Finished from the confirm here (the bar's Finish is held at 568 x 320 above).
    await page.keyboard.press('Escape');
    await pressId(page, 'presenter-exit-confirm', true);
    await page.setViewportSize({ width: 320, height: 568 });
    await expectFinishedRow(page);
    await page.getByTestId(ROW).scrollIntoViewIfNeeded();
    await shot(page, 'presenter-finish-home-320x568');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
});
