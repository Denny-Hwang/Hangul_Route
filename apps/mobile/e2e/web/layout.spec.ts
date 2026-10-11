import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, forgetPin, keepSidewaysIfAsked, passDiscover, playCheck, typeDigits, unlockWithPin } from './helpers';

/**
 * Short-phone and phone-landscape layout (audit p1-L1..L4, p2-L1..L3, UX-09):
 * every primary CTA must be reachable by the learner's own scrolling, not
 * just by programmatic focus. The Expo web reset sets `body{overflow:hidden}`,
 * so a screen that does not scroll by itself clips whatever falls below the
 * fold. The grown-up PIN pad and its CTA must fit outright, without scrolling,
 * and so must the Trace game (its canvas owns vertical drags, so it cannot
 * scroll): the canvas shrinks to leave room for Done and Skip.
 */
const VIEWPORTS = [
  { name: 'iPhone SE 1st gen', width: 320, height: 568 },
  { name: 'iPhone SE in Safari (toolbar shown)', width: 375, height: 553 },
  { name: 'iPhone 8 / SE 2nd gen', width: 375, height: 667 },
  { name: 'iPhone 14 landscape', width: 844, height: 390 },
  // F-LAYOUT-001 PR 2a: the 480 px `#root` cap is gone, so tablets and desktops run the same flows at full width.
  { name: 'iPhone 14 portrait', width: 390, height: 844 },
  { name: 'iPad portrait', width: 768, height: 1024 },
  { name: 'iPad Air landscape / laptop', width: 1180, height: 820 },
] as const;

async function fullyInViewport(page: Page, target: Locator): Promise<boolean> {
  const vp = page.viewportSize();
  const box = await target.boundingBox();
  if (!vp || !box) return false;
  return box.y >= 0 && box.x >= 0 && box.y + box.height <= vp.height && box.x + box.width <= vp.width;
}

/** Scroll the way a learner would (wheel over the screen), then require the target fully visible. */
async function expectReachable(page: Page, target: Locator): Promise<void> {
  await expect(target).toBeAttached();
  const vp = page.viewportSize();
  if (!vp) throw new Error('viewport size unavailable');
  for (let i = 0; i < 15 && !(await fullyInViewport(page, target)); i++) {
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await page.mouse.wheel(0, Math.round(vp.height / 2));
    await page.waitForTimeout(120);
  }
  await expect(target).toBeInViewport({ ratio: 1 });
}

/** Nothing may force the page wider than the window (a fixed-width child would show as a sideways scrollbar). */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'horizontal overflow').toBeLessThanOrEqual(innerWidth);
}

/**
 * Onboard through the real form: "My child or a student" creates the grown-up PIN in the form, so the gate later asks for it.
 * At 844x390 (a touch phone on its side) the portrait guard asks first; "Keep sideways" answers it once (F-LAYOUT-001 PR 3).
 */
async function onboard(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  const start = page.getByRole('button', { name: "Let's start" });
  await expectReachable(page, start);
  await start.click();
  await completeChildForm(page, { name });
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test.afterEach(async ({ page }) => {
      await expectNoHorizontalOverflow(page);
    });

    test('quest, Build-a-Letter and Results CTAs are reachable', async ({ page }) => {
      await onboard(page, 'Dani');

      // Quest intro → Discover pages → skip the listening game → Build-a-Letter.
      const cont = page.getByRole('button', { name: 'Continue' });
      await expectReachable(page, cont);
      await cont.click();
      await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
      while (await page.getByText(/^Page \d+ of \d+$/).first().isVisible()) {
        const label = await page.getByText(/^Page \d+ of \d+$/).first().innerText();
        await expectReachable(page, cont);
        await cont.click();
        if (/^Page (\d+) of \1$/.test(label)) break;
        await expect(page.getByText(label, { exact: true })).toHaveCount(0);
      }
      const skip = page.getByRole('button', { name: 'Skip for now' });
      await expectReachable(page, skip);
      await skip.click();
      await expect(page.getByText('Build a Letter')).toBeVisible();
      const play = page.getByRole('button', { name: 'Play minigame' });
      await expectReachable(page, play);
      await play.click();

      await expect(page.getByText('Build this letter')).toBeVisible();
      const tiles = page.getByRole('button', { name: /^Korean letter / });
      await expect(tiles.first()).toBeVisible();
      for (const tile of await tiles.all()) await expectReachable(page, tile);
      const skipGame = page.getByRole('button', { name: 'Skip', exact: true });
      await expectReachable(page, skipGame);
      await skipGame.click();

      // The two-question Check has no Skip (F-QUEST-002 §3.3): its Go must be reachable.
      await expectReachable(page, page.getByRole('button', { name: 'Go', exact: true }));
      await playCheck(page);

      const seeResults = page.getByRole('button', { name: 'See results' });
      await expectReachable(page, seeResults);
      await seeResults.click();

      // Results (the heading follows the Check's stars, so it is not pinned here).
      await expectReachable(page, page.getByRole('button', { name: 'Episode page' }));
      const home = page.getByRole('button', { name: 'Back home' });
      await expectReachable(page, home);
      await home.click();
      await expect(page.getByText('Hi, Dani!')).toBeVisible();
    });

    test('Profile entry is labelled, the PIN pad fits, and rescue-code field stays on screen', async ({ page }) => {
      await onboard(page, 'Rio');
      // A device set up before the form made the PIN (L8): the first grown-up action shows the PIN setup screen.
      await forgetPin(page);
      await expect(page.getByText('Hi, Rio!')).toBeVisible();

      // UX-05: a visible "Profile" label on the learner's avatar, not a bare Hoya circle.
      const profile = page.getByRole('button', { name: 'Profile and settings' });
      await expect(profile).toBeVisible();
      await expect(profile.getByText('Profile', { exact: true })).toBeVisible();
      await profile.click();

      const restore = page.getByRole('button', { name: 'Restore from a file (PIN required)' });
      await expectReachable(page, restore);
      await restore.click();

      // p1-L1: the whole pad and its CTA fit without scrolling.
      await expect(page.getByText('Create a grown-up PIN')).toBeVisible();
      const next = page.getByRole('button', { name: 'Next' });
      await expect(next).toBeInViewport({ ratio: 1 });
      for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
        await expect(page.getByRole('button', { name: `Digit ${d}` })).toBeInViewport({ ratio: 1 });
      }
      await expect(page.getByRole('button', { name: 'Delete last digit' })).toBeInViewport({ ratio: 1 });
      for (const round of [0, 1]) {
        await typeDigits(page);
        await expectReachable(page, next);
        await next.click();
        if (round === 0) await expect(page.getByText('Enter it once more')).toBeVisible();
      }

      // The rescue-code field (one multiline input, #96) stays inside the screen.
      await expect(page.getByRole('heading', { name: 'Bring back progress' })).toBeVisible();
      await page.getByRole('button', { name: 'I have a rescue code' }).click();
      const width = page.viewportSize()?.width ?? vp.width;
      const box = await page.getByTestId('rescue-code-input').boundingBox();
      expect(box, 'rescue code field').not.toBeNull();
      expect(box!.x, 'rescue code left edge').toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, 'rescue code right edge').toBeLessThanOrEqual(width);
      await expectReachable(page, page.getByRole('button', { name: 'Find my cards' }));
    });

    test('Trace: canvas, Done and Skip all fit the viewport and a drag does not scroll', async ({ page }) => {
      await onboard(page, 'Tess');
      await page.goto('/');
      await expect(page.getByText('Hi, Tess!')).toBeVisible();

      // Home → Meet the Letters → quest 2 → skip to its Trace game.
      await page.getByRole('button', { name: /Meet the Letters/ }).click();
      await page.getByRole('button', { name: 'Start' }).nth(1).click();
      // Quest 2 builds on quest 1, which is not done yet: the soft-prerequisite sheet asks once (F-QUEST-002 §3.5).
      await page.getByRole('button', { name: 'Play anyway' }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await passDiscover(page);
      await page.getByRole('button', { name: 'Skip for now' }).click();
      await expect(page.getByText('Trace Each Letter')).toBeVisible();
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expect(page.getByText(/^Trace the letter /)).toBeVisible();

      const canvas = page.locator('#trace-canvas');
      for (const name of ['Done', 'Skip', 'Show me', 'Clear']) {
        await expect(page.getByRole('button', { name, exact: true }), name).toBeInViewport({ ratio: 1 });
      }
      await expect(canvas).toBeInViewport({ ratio: 1 });
      const box = await canvas.boundingBox();
      expect(box!.width, 'canvas stays usable').toBeGreaterThanOrEqual(160);
      expect(box!.height).toBeCloseTo(box!.width, 0);

      // Nothing scrolls: no page overflow, and a vertical drag on the canvas leaves the layout where it was.
      const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
      expect(overflow, 'page overflow').toBeLessThanOrEqual(0);
      const skip = page.getByRole('button', { name: 'Skip', exact: true });
      const before = await skip.boundingBox();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.25);
      await page.mouse.down();
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.75, { steps: 8 });
      await page.mouse.up();
      const after = await skip.boundingBox();
      expect(after!.y, 'Skip did not move').toBe(before!.y);
      await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeInViewport({ ratio: 1 });

      // Feedback appearing must not resize the canvas under the child's finger.
      const settled = await canvas.boundingBox();
      expect(settled!.width).toBe(box!.width);
      await page.getByRole('button', { name: 'Skip', exact: true }).click();
    });

    test('PIN pad keeps its size when the wrong-PIN hint appears', async ({ page }) => {
      await onboard(page, 'Pia');
      await page.goto('/');
      await expect(page.getByText('Hi, Pia!')).toBeVisible();
      await page.getByRole('button', { name: 'Profile and settings' }).click();
      await page.getByRole('button', { name: 'Restore from a file (PIN required)' }).click();

      // The grown-up PIN was created in the onboarding form, so the gate is already in verify mode
      // (the keypad and Unlock must fit as the setup screen's did), and the right PIN opens it.
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Unlock' })).toBeInViewport({ ratio: 1 });
      for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
        await expect(page.getByRole('button', { name: `Digit ${d}` })).toBeInViewport({ ratio: 1 });
      }
      await unlockWithPin(page);
      await expect(page.getByRole('heading', { name: 'Bring back progress' })).toBeVisible();

      // A later visit asks for the PIN again: a wrong one shows a hint.
      await page.goto('/');
      await expect(page.getByText('Hi, Pia!')).toBeVisible();
      // The install guide shows from the third cached open and covers the Home tabs.
      const guide = page.getByTestId('install-guide');
      await page.waitForTimeout(800);
      if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
      await page.getByRole('button', { name: 'Profile and settings' }).click();
      await page.getByRole('button', { name: 'Restore from a file (PIN required)' }).click();
      await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
      const key = page.getByRole('button', { name: 'Digit 5' });
      const unlock = page.getByRole('button', { name: 'Unlock' });
      await page.waitForTimeout(500); // the measured header has settled the pad size
      const keyBefore = await key.boundingBox();
      const unlockBefore = await unlock.boundingBox();
      for (const d of ['9', '9', '9', '9']) await page.getByRole('button', { name: `Digit ${d}` }).click();
      await unlock.click();
      await expect(page.getByText(/Not quite\./)).toBeVisible();
      expect(await key.boundingBox()).toEqual(keyBefore);
      expect(await unlock.boundingBox()).toEqual(unlockBefore);
      await expect(unlock).toBeInViewport({ ratio: 1 });
    });
  });
}

// F-LAYOUT-001 §3.4 / §5: the guard needs touch input. The same landscape phone size with a mouse never shows it.
test.describe('iPhone 14 landscape size with a mouse 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: false, hasTouch: false });

  test('no portrait guard: the Welcome screen is usable at once', async ({ page }) => {
    await page.goto('/');
    const start = page.getByRole('button', { name: "Let's start" });
    await expectReachable(page, start);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('portrait-guard')).toHaveCount(0);
    await start.click();
    await expect(page.getByRole('radio', { name: /^My child or a student/ })).toBeVisible();
  });
});
