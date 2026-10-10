import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Short-phone and phone-landscape layout (audit p1-L1..L4, p2-L1..L3, UX-09):
 * every primary CTA must be reachable by the learner's own scrolling, not
 * just by programmatic focus. The Expo web reset sets `body{overflow:hidden}`,
 * so a screen that does not scroll by itself clips whatever falls below the
 * fold. The grown-up PIN pad and its CTA must fit outright, without scrolling.
 */
const VIEWPORTS = [
  { name: 'iPhone SE 1st gen', width: 320, height: 568 },
  { name: 'iPhone SE in Safari (toolbar shown)', width: 375, height: 553 },
  { name: 'iPhone 14 landscape', width: 844, height: 390 },
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

async function onboard(page: Page, name: string): Promise<void> {
  await page.goto('/');
  const start = page.getByRole('button', { name: "Let's start" });
  await expectReachable(page, start);
  await start.click();
  await page.getByPlaceholder('Type your name').fill(name);
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start my journey' }).click();
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('quest, Build-a-Letter and Results CTAs are reachable', async ({ page }) => {
      await onboard(page, 'Dani');

      // Quest intro → skip the two listening games → Build-a-Letter.
      const cont = page.getByRole('button', { name: 'Continue' });
      await expectReachable(page, cont);
      await cont.click();
      for (let i = 0; i < 2; i++) {
        const skip = page.getByRole('button', { name: 'Skip for now' });
        await expectReachable(page, skip);
        await skip.click();
      }
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

      const seeResults = page.getByRole('button', { name: 'See results' });
      await expectReachable(page, seeResults);
      await seeResults.click();

      await expect(page.getByText('All done!')).toBeVisible();
      await expectReachable(page, page.getByRole('button', { name: 'Episode page' }));
      const home = page.getByRole('button', { name: 'Back home' });
      await expectReachable(page, home);
      await home.click();
      await expect(page.getByText('Hi, Dani!')).toBeVisible();
    });

    test('Profile entry is labelled, the PIN pad fits, and rescue-code fields stay on screen', async ({ page }) => {
      await onboard(page, 'Rio');
      await page.goto('/');
      await expect(page.getByText('Hi, Rio!')).toBeVisible();

      // UX-05: a visible "Profile" label on the learner's avatar, not a bare Hoya circle.
      const profile = page.getByRole('button', { name: 'Profile and settings' });
      await expect(profile).toBeVisible();
      await expect(profile.getByText('Profile', { exact: true })).toBeVisible();
      await profile.click();

      const restore = page.getByRole('button', { name: 'Restore from a file (grown-ups only)' });
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
        for (const d of ['1', '2', '3', '4']) await page.getByRole('button', { name: `Digit ${d}` }).click();
        await expectReachable(page, next);
        await next.click();
        if (round === 0) await expect(page.getByText('Enter it once more')).toBeVisible();
      }

      // p2-L3: the three rescue-code inputs share one row inside the screen.
      await expect(page.getByRole('heading', { name: 'Bring back progress' })).toBeVisible();
      await page.getByRole('button', { name: 'I have a rescue code' }).click();
      const width = page.viewportSize()?.width ?? vp.width;
      for (const label of ['Rescue code first word', 'Rescue code second word', 'Rescue code digits']) {
        const box = await page.getByLabel(label).boundingBox();
        expect(box, label).not.toBeNull();
        expect(box!.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, `${label} right edge`).toBeLessThanOrEqual(width);
      }
      await expectReachable(page, page.getByRole('button', { name: 'Find my cards' }));
    });
  });
}
