import type { Locator, Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, passDiscover, seedStored } from './helpers';
import { Touchscreen, type TouchPoint } from './touch';

/**
 * OW-1-undo: Build a Letter has a visible Undo (a backspace) that takes back the LAST placed tile, one tap one tile, and a
 * tap on a filled slot still takes that slot's tile back (KT-6). The owner placed a tile by mistake on an Android phone and
 * could not take it back. Run on a touch screen (real touches, `Input.dispatchTouchEvent`) at 320 x 640 with the largest
 * text, on a phone turned sideways and on a tablet.
 *
 * The English cases play Holidays quest 7 (the Seollal greeting): its first block is 달, three slots (initial, vowel, final),
 * so Undo is pressed twice in a row on a real touch screen, and a wrong full fill is reset by the board while Undo waits. The
 * Spanish and Korean cases use the guest quest's first block (가, two slots) at 320 x 640 with the largest text: the label
 * must neither wrap nor push the page sideways. In every case Undo is at least 64 x 64, named for a screen reader, dimmed and
 * inert while nothing is placed, and is on screen together with the slots (and the tray too where the window is tall enough, see tilesWithUndo).
 *
 * Release build:  pnpm --filter @hangul-route/mobile exec playwright test build-letter-undo
 */
const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Past the 400 ms lock, with room for a busy machine's slow event dispatch. */
const AFTER_LOCK = 700;
/** The wrong block shows its hint this long, then the slots empty (BuildLetterGame WRONG_RESET_MS), plus slow dispatch. */
const AFTER_RESET = 1500;
const en = getMessages('en');

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

/** True when the element's whole box is inside the window right now (nothing scrolled to reach it). */
const insideWindow = (target: Locator): Promise<boolean> =>
  target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
  });

const PROFILES = [
  { name: 'phone 320, largest text', viewport: { width: 320, height: 640 }, largest: true, tilesWithUndo: false },
  { name: 'phone sideways 740 x 360', viewport: { width: 740, height: 360 }, largest: false, tilesWithUndo: true },
  { name: 'phone sideways 740 x 360, largest text', viewport: { width: 740, height: 360 }, largest: true, tilesWithUndo: false },
  { name: 'tablet 820', viewport: { width: 820, height: 1180 }, largest: false, tilesWithUndo: true },
] as const;
// tilesWithUndo: the board is the slots, Undo, then the tray. At the largest text the tray sits below Undo and needs a scroll
// (a phone 320 high 640 shows the slots and Undo; a phone turned sideways with the largest text, 360 high, cannot hold the
// slots, Undo and the tray at once). That is how the board was before Undo; Undo sits next to the slots it acts on.

const largestText = (page: Page): Promise<void> =>
  seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });

/** Onboard a child, open Holidays quest 7 and play up to its first Build a Letter block (달: three slots). */
async function openClosedBlock(page: Page, largest: boolean): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  if (largest) await largestText(page);
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Holidays & Traditions') }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).nth(0).click();
  await page.getByRole('button', { name: 'Play anyway' }).click();
  await expect(headerClose(page)).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('Build this letter')).toBeVisible();
}

const slotJamo = async (page: Page): Promise<string[]> =>
  (await page.locator('[data-testid^="build-letter-slot-"]').allInnerTexts()).map((t) => t.trim());
const placedCount = async (page: Page): Promise<number> => (await slotJamo(page)).filter((s) => s !== '').length;

/** The guest quest (Hoya's welcome) up to its first Build a Letter block (가: two slots), in any UI language. */
async function openGuestBlock(page: Page, locale: 'es' | 'ko'): Promise<void> {
  const m = getMessages(locale).learner;
  await page.goto('/');
  await seedStored(page, 'device:settings', { uiLocale: locale, uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  await page.goto('/?try=1');
  await keepSidewaysIfAsked(page);
  const skip = page.getByRole('button', { name: m.quest.launcher.game.skip.cta, exact: true });
  const next = page.getByRole('button', { name: m.quest.continue.cta, exact: true });
  // Intro and Discover are pages of Continue; the Match Sound card (Skip) follows.
  for (let i = 0; i < 12 && !(await skip.isVisible()); i++) {
    await next.first().click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
  await skip.click();
  await page.getByRole('button', { name: m.quest.launcher.game.play.cta }).click();
  await expect(page.locator('[data-testid^="build-letter-tile-"]').first()).toBeVisible();
}

for (const profile of PROFILES) {
  test.describe(`Build a Letter Undo, ${profile.name} (OW-1-undo)`, () => {
    test.skip(FIXTURE_BUILD, 'the release build: Holidays quest 7');
    test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

    test('Undo is on screen at once, 64 px or more, named, and takes back the last tile one tap at a time, down to an empty board', async ({ page }) => {
      test.setTimeout(150_000);
      await openClosedBlock(page, profile.largest);
      const undo = page.getByTestId('build-letter-undo');
      const tiles = page.locator('[data-testid^="build-letter-tile-"]');
      await expect(tiles.first()).toBeVisible();
      await expect(undo).toBeVisible();
      await expect(undo).toHaveAttribute('aria-label', en.learner.minigame.buildLetter.undo.name);
      await expect(undo).toContainText(en.learner.minigame.buildLetter.undo.label);
      await expect(undo, 'nothing placed yet: nothing to take back').toHaveAttribute('aria-disabled', 'true');
      const size = await undo.boundingBox();
      expect(size!.width, 'at least 64 wide').toBeGreaterThanOrEqual(64);
      expect(size!.height, 'at least 64 high').toBeGreaterThanOrEqual(64);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll').toBe(true);

      // On screen at once: with the slots scrolled to the top of the window Undo is in the window with them (the board is
      // slots, then Undo, then the tray), and so is the whole tray where the window is tall enough (tilesWithUndo).
      const slots = page.locator('[data-testid^="build-letter-slot-"]');
      expect(await slots.count(), '달 is a three-slot block (initial, vowel, final)').toBe(3);
      await slots.first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(200);
      expect(await insideWindow(undo), 'Undo is inside the window with the slots').toBe(true);
      for (let i = 0; i < 3; i++) expect(await insideWindow(slots.nth(i)), `slot ${i} is inside the window with Undo`).toBe(true);
      if (profile.tilesWithUndo) {
        const n = await tiles.count();
        for (let i = 0; i < n; i++) expect(await insideWindow(tiles.nth(i)), `tray tile ${i} is inside the window with Undo`).toBe(true);
      }
      await page.waitForTimeout(AFTER_LOCK);

      const touch = await Touchscreen.of(page);
      // A tap on it with nothing placed does nothing.
      await touch.tap(centre(await inView(undo)));
      await page.waitForTimeout(AFTER_LOCK);
      expect(await placedCount(page)).toBe(0);

      // Place two of the three slots (the block never completes: a full block is answered).
      const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
      for (let i = 0; i < 2; i++) {
        await touch.graze(centre(await inView(page.getByTestId(ids[i]!))), 0, 16, { steps: 4 });
        await expect.poll(() => placedCount(page)).toBe(i + 1);
        await page.waitForTimeout(AFTER_LOCK);
      }
      const before = await slotJamo(page);
      expect(before.filter((s) => s !== '')).toHaveLength(2);
      await expect(undo).not.toHaveAttribute('aria-disabled', 'true');

      // First Undo (a 12 px graze still lands): the LAST placed tile goes back to the tray, the first stays.
      await touch.graze(centre(await inView(undo)), 12, 0, { steps: 3 });
      await expect.poll(() => placedCount(page)).toBe(1);
      const afterOne = await slotJamo(page);
      expect(afterOne[0], 'the earlier tile stays').toBe(before[0]);
      expect(afterOne[1]).toBe('');
      await expect(page.getByTestId(ids[1]!), 'its tray tile is back').not.toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByTestId(ids[0]!), 'the first stays used').toHaveAttribute('aria-disabled', 'true');
      await expect(undo).not.toHaveAttribute('aria-disabled', 'true');

      // Second Undo (past the key bounce): the board is empty and Undo is inert again. Nothing was answered, so no nudge.
      await page.waitForTimeout(AFTER_LOCK);
      await touch.tap(centre(await inView(undo)));
      await expect.poll(() => placedCount(page)).toBe(0);
      await expect(undo).toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByTestId(ids[0]!)).not.toHaveAttribute('aria-disabled', 'true');
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

    test('a wrong full block still resets by itself after 900 ms, and Undo waits meanwhile', async ({ page }) => {
      test.setTimeout(150_000);
      await openClosedBlock(page, profile.largest);
      const undo = page.getByTestId('build-letter-undo');
      const touch = await Touchscreen.of(page);
      await page.waitForTimeout(AFTER_LOCK);
      // 달 with the first two letters swapped: ㅏ, ㄷ, final l.
      const wrong = ['Korean letter ㅏ, tap to select', 'Korean letter ㄷ, tap to select', 'final l'];
      for (let i = 0; i < wrong.length; i++) {
        const tile = page.getByRole('button', { name: wrong[i]!, exact: true });
        await touch.graze(centre(await inView(tile)), 0, 16, { steps: 4 });
        await page.waitForTimeout(AFTER_LOCK);
      }
      await expect(page.getByText(/Not quite/)).toBeVisible();
      expect(await placedCount(page), 'the wrong block shows for a moment').toBe(3);
      await expect(undo, 'Undo waits while the wrong block shows').toHaveAttribute('aria-disabled', 'true');
      await touch.tap(centre(await inView(undo)));
      await page.waitForTimeout(AFTER_RESET);
      expect(await placedCount(page), 'the board emptied itself').toBe(0);
      await expect(undo).toHaveAttribute('aria-disabled', 'true');
      // The same block can be tried again at once, and Undo works on the new attempt.
      await page.waitForTimeout(AFTER_LOCK);
      await touch.graze(centre(await inView(page.getByRole('button', { name: 'Korean letter ㄷ, tap to select', exact: true }))), 0, 16, { steps: 4 });
      await expect.poll(() => placedCount(page)).toBe(1);
      await page.waitForTimeout(AFTER_LOCK);
      await touch.tap(centre(await inView(undo)));
      await expect.poll(() => placedCount(page)).toBe(0);
    });
  });
}

for (const locale of ['es', 'ko'] as const) {
  test.describe(`Build a Letter Undo in ${locale}, phone 320, largest text (OW-1-undo)`, () => {
    test.skip(FIXTURE_BUILD, 'the release build: the guest quest');
    test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, locale: locale === 'es' ? 'es-MX' : 'ko-KR' });

    test('the label shows in full on one line, Undo is 64 px or more and in the window, and it takes the last tile back', async ({ page }) => {
      test.setTimeout(120_000);
      const copy = getMessages(locale).learner.minigame.buildLetter.undo;
      await openGuestBlock(page, locale);
      const undo = page.getByTestId('build-letter-undo');
      await expect(undo).toBeVisible();
      await expect(undo).toHaveAttribute('aria-label', copy.name);
      await expect(undo).toContainText(copy.label);
      const size = await undo.boundingBox();
      expect(size!.width).toBeGreaterThanOrEqual(64);
      expect(size!.height).toBeGreaterThanOrEqual(64);
      // The label sits on one line and inside the pill, and the page does not scroll sideways.
      const fit = await undo.evaluate((el) => {
        const text = [...el.querySelectorAll('*')].find((n) => n.children.length === 0 && (n.textContent ?? '').trim().length > 0);
        const t = text?.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const lh = text === undefined ? 0 : parseFloat(getComputedStyle(text).lineHeight) || (t?.height ?? 0);
        return { inside: t !== undefined && t.left >= r.left - 1 && t.right <= r.right + 1, lines: t === undefined || lh === 0 ? 0 : Math.round(t.height / lh), wide: r.right <= window.innerWidth + 1 && r.left >= -1 };
      });
      expect(fit.inside, 'the label is inside the pill').toBe(true);
      expect(fit.lines, 'the label is on one line').toBeLessThanOrEqual(1);
      expect(fit.wide, 'the pill is inside the window').toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll').toBe(true);

      const touch = await Touchscreen.of(page);
      await page.waitForTimeout(AFTER_LOCK);
      const first = page.locator('[data-testid^="build-letter-tile-"]').first();
      await touch.graze(centre(await inView(first)), 0, 16, { steps: 4 });
      await expect.poll(() => placedCount(page)).toBe(1);
      await page.waitForTimeout(AFTER_LOCK);
      await touch.tap(centre(await inView(undo)));
      await expect.poll(() => placedCount(page)).toBe(0);
      await expect(undo).toHaveAttribute('aria-disabled', 'true');
    });
  });
}
