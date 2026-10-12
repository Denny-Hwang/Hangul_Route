import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared locators and probes of the story reader e2e suites (F-STORY-002):
 * the replay route (story-reader.spec.ts) and the quest step
 * (story-reader-quest.spec.ts).
 */

/** `colors.brand.primary` as react-native-web computes it: a filled dot, a primary button's fill. */
export const BRAND = 'rgb(178, 73, 21)';

export const position = (page: Page): Locator => page.getByTestId('story-reader-position');
export const next = (page: Page): Locator => page.getByTestId('story-reader-next');
export const back = (page: Page): Locator => page.getByTestId('story-reader-back');
/** The inline checkpoint card (F-STORY-002 §3.7, PR 2.9). */
export const checkpointCard = (page: Page): Locator => page.getByTestId('story-reader-checkpoint');
export const checkpointSkip = (page: Page): Locator => page.getByTestId('story-reader-checkpoint-skip');

async function positionNow(page: Page): Promise<string | null> {
  const label = position(page);
  return (await label.count()) > 0 ? label.innerText() : null;
}

/**
 * Turns one page with Next, as a reader who is not under test at a checkpoint
 * would: when the inline question card opens instead (the fixture's listen
 * tier asks one after scene 3), it taps Skip, which records nothing. The
 * checkpoint itself is covered by story-reader-checkpoints.spec.ts.
 */
export async function nextPage(page: Page): Promise<void> {
  const before = await positionNow(page);
  await next(page).click();
  await expect
    .poll(async () => (await checkpointCard(page).count()) > 0 || (await positionNow(page)) !== before)
    .toBe(true);
  if ((await checkpointCard(page).count()) > 0) await checkpointSkip(page).click();
}

/** Filled dots of the fill-only meter (Progress dots carry no aria-valuenow on react-native-web). */
export function filledDots(page: Page): Promise<number> {
  return (
    page
      .getByTestId('story-reader-dots')
      // The dots are hidden from screen readers (the labelled page number speaks instead).
      .getByRole('progressbar', { includeHidden: true })
      .evaluate((bar, brand) => Array.from(bar.children).filter((d) => getComputedStyle(d).backgroundColor === brand).length, BRAND)
  );
}

/** Test ids of the reader's buttons drawn with the primary (brand) fill. */
export function primaryButtons(page: Page): Promise<string[]> {
  return page
    .getByTestId('story-reader')
    .evaluate(
      (root, brand) =>
        Array.from(root.querySelectorAll('[role="button"]'))
          .filter((b) => getComputedStyle(b).backgroundColor === brand)
          .map((b) => b.getAttribute('data-testid') ?? ''),
      BRAND,
    );
}

export async function fullyVisible(page: Page, target: Locator): Promise<boolean> {
  const vp = page.viewportSize();
  const box = await target.boundingBox();
  if (!vp || !box) return false;
  return box.y >= 0 && box.x >= 0 && box.y + box.height <= vp.height + 0.5 && box.x + box.width <= vp.width + 0.5;
}
