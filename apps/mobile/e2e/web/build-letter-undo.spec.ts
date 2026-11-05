import type { Locator, Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { keepSidewaysIfAsked, passDiscover, seedStored } from './helpers';
import { Touchscreen, type TouchPoint } from './touch';

/**
 * OW-1-undo: Build a Letter has a visible Undo (a backspace) that takes back the LAST placed tile, one tap one tile, and a
 * tap on a filled slot still takes that slot's tile back (KT-6). The owner placed a tile by mistake on an Android phone and
 * could not take it back. Run on a touch screen (real touches, `Input.dispatchTouchEvent`) at 320 x 640 with the largest
 * text, on a phone turned sideways and on a tablet. It is on screen at once, at least 64 x 64, named for a screen reader, dimmed
 * and inert while nothing is placed, and it never scores or shows the answer.
 *
 * Release build (the guest quest):  pnpm --filter @hangul-route/mobile exec playwright test build-letter-undo
 */
const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Past the 400 ms lock, with room for a busy machine's slow event dispatch. */
const AFTER_LOCK = 700;
const en = getMessages('en');
const undoName = en.learner.minigame.buildLetter.undo.name;

type Box = { x: number; y: number; width: number; height: number };
const centre = (b: Box): TouchPoint => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

async function inView(target: Locator): Promise<Box> {
  const ok = await target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 40 && r.bottom <= window.innerHeight - 40;
  });
  if (!ok) {
    await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await target.page().waitForTimeout(150);
  }
  const box = await target.boundingBox();
  if (box === null) throw new Error('no box');
  return box;
}

const PROFILES = [
  { name: 'phone 320, largest text', viewport: { width: 320, height: 640 }, largest: true },
  { name: 'phone sideways 740 x 360', viewport: { width: 740, height: 360 }, largest: false },
  { name: 'phone sideways 740 x 360, largest text', viewport: { width: 740, height: 360 }, largest: true },
  { name: 'tablet 820', viewport: { width: 820, height: 1180 }, largest: false },
] as const;

async function openBuildLetter(page: Page, largest: boolean): Promise<void> {
  if (largest) {
    await page.goto('/');
    await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  }
  await page.goto('/?try=1');
  await keepSidewaysIfAsked(page);
  await expect(page.getByText('Hi from Hoya', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
  await passDiscover(page);
  // The quest's Match Sound step is skipped; its next game is Build a Letter.
  await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
  await page.getByRole('button', { name: en.learner.quest.launcher.game.play.cta }).click();
  await expect(page.getByText('Build this letter')).toBeVisible();
}

const slotJamo = async (page: Page): Promise<string[]> =>
  (await page.locator('[data-testid^="build-letter-slot-"]').allInnerTexts()).map((t) => t.trim());
const placedCount = async (page: Page): Promise<number> => (await slotJamo(page)).filter((s) => s !== '').length;

for (const profile of PROFILES) {
  test.describe(`Build a Letter Undo, ${profile.name} (OW-1-undo)`, () => {
    test.skip(FIXTURE_BUILD, 'the release build: the guest quest');
    test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

    test('Undo is on screen at once, 64 px or more, named, and removes the last placed tile one tap at a time', async ({ page }) => {
      test.setTimeout(120_000);
      await openBuildLetter(page, profile.largest);
      const touch = await Touchscreen.of(page);
      const undo = page.getByTestId('build-letter-undo');
      const tiles = page.locator('[data-testid^="build-letter-tile-"]');
      await expect(tiles.first()).toBeVisible();
      await expect(undo).toBeVisible();
      await expect(undo).toHaveAttribute('aria-label', undoName);
      await expect(undo).toContainText(en.learner.minigame.buildLetter.undo.label);
      await expect(undo, 'nothing placed yet: nothing to take back').toHaveAttribute('aria-disabled', 'true');
      const size = await undo.boundingBox();
      expect(size!.width, 'at least 64 wide').toBeGreaterThanOrEqual(64);
      expect(size!.height, 'at least 64 high').toBeGreaterThanOrEqual(64);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll').toBe(true);
      await page.waitForTimeout(AFTER_LOCK);

      // A tap on it with nothing placed does nothing.
      await touch.tap(centre(await inView(undo)));
      await page.waitForTimeout(AFTER_LOCK);
      expect(await placedCount(page)).toBe(0);

      // Place all but one slot, so the block never completes (a full block is answered).
      const slots = (await slotJamo(page)).length;
      const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
      const place = slots - 1;
      for (let i = 0; i < place; i++) {
        await touch.graze(centre(await inView(page.getByTestId(ids[i]!))), 0, 16, { steps: 4 });
        await expect.poll(() => placedCount(page)).toBe(i + 1);
        await page.waitForTimeout(AFTER_LOCK);
      }
      const before = await slotJamo(page);
      await expect(undo).not.toHaveAttribute('aria-disabled', 'true');

      // One tap on Undo (a 12 px graze still lands): the LAST placed tile goes back to the tray, the earlier ones stay.
      await touch.graze(centre(await inView(undo)), 12, 0, { steps: 3 });
      await expect.poll(() => placedCount(page)).toBe(place - 1);
      const after = await slotJamo(page);
      expect(after.slice(0, place - 1)).toEqual(before.slice(0, place - 1));
      expect(after[place - 1]).toBe('');
      await expect(page.getByTestId(ids[place - 1]!)).not.toHaveAttribute('aria-disabled', 'true');
      if (place > 1) await expect(page.getByTestId(ids[0]!)).toHaveAttribute('aria-disabled', 'true');

      // Undo until the board is empty; then it is inert again. Nothing was answered, so no "not quite" nudge shows.
      for (let left = place - 1; left > 0; left--) {
        await page.waitForTimeout(AFTER_LOCK);
        await touch.tap(centre(await inView(undo)));
        await expect.poll(() => placedCount(page)).toBe(left - 1);
      }
      await expect(undo).toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByText(/Not quite/)).toHaveCount(0);

      // A filled slot still takes its own tile back (KT-6).
      await page.waitForTimeout(AFTER_LOCK);
      await touch.graze(centre(await inView(page.getByTestId(ids[0]!))), 0, 12, { steps: 3 });
      await expect.poll(() => placedCount(page)).toBe(1);
      const slot = page.getByTestId('build-letter-slot-0');
      await expect(slot).toHaveAttribute('aria-label', /^Take back /);
      await page.waitForTimeout(AFTER_LOCK);
      await touch.tap(centre(await inView(slot)));
      await expect.poll(() => placedCount(page)).toBe(0);
    });
  });
}
