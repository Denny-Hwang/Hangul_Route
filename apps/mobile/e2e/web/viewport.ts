import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Viewport helpers shared by the short-phone layout spec (`layout.spec.ts`, PR #95) and the
 * locale layout matrix (`locale.spec.ts`, F-I18N-001 §3.11). The Expo web reset sets
 * `body{overflow:hidden}`, so a screen that does not scroll by itself clips whatever falls
 * below the fold: a CTA counts only once the learner's own scrolling brings it fully on screen.
 */

/**
 * How much of the target is on screen, the way `toBeInViewport` measures it (an IntersectionObserver
 * with the viewport as root): a part clipped by a scrolling ancestor, such as the strip of a screen
 * that sits behind the tab bar, does not count.
 */
export async function visibleRatio(target: Locator): Promise<number> {
  return target.evaluate(
    (el) =>
      new Promise<number>((resolve) => {
        const observer = new IntersectionObserver((entries) => {
          observer.disconnect();
          resolve(entries[0]?.intersectionRatio ?? 0);
        });
        observer.observe(el);
      }),
  );
}

/** Scroll the way a learner would (wheel over the screen) until the target is fully visible, then require it. */
export async function expectReachable(page: Page, target: Locator): Promise<void> {
  await expect(target).toBeAttached();
  const vp = page.viewportSize();
  if (!vp) throw new Error('viewport size unavailable');
  for (let i = 0; i < 15 && (await visibleRatio(target)) < 1; i++) {
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await page.mouse.wheel(0, Math.round(vp.height / 2));
    await page.waitForTimeout(120);
  }
  await expect(target).toBeInViewport({ ratio: 1 });
}

/** Nothing may force the page wider than the window (a fixed-width child would show as a sideways scrollbar). */
export async function expectNoHorizontalOverflow(page: Page, what = 'horizontal overflow'): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, what).toBeLessThanOrEqual(innerWidth);
}
