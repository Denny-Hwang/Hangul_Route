import type { Locator, Page } from '@playwright/test';

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
