import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedStored } from './helpers';
import { Touchscreen, type TouchPoint } from './touch';

/**
 * AMENDMENTS-TOUCH row KT-7 (section 6.7, KT-D7; fixes F7): the Type Hangul keyboard under real touches. One
 * `TapBoard` with `multiTouch="each"`: a key types when its finger lifts, the key under the finger at that moment; a
 * lift off the keyboard types nothing; a rollover types both letters in the order the fingers lift; a repeat on the
 * same key within 120 ms is a bounce; Shift has the 400 ms lock. Opened on fixture rounds through
 * `window.__hrTypeHangulE2E` (fixture bundle only, as type-hangul.spec.ts):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test type-hangul-keyboard-touch
 *
 * Profiles (section 11.2): 320 x 640 with touch and the largest text size, and the 820 x 1180 tablet.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** `colors.border.shape`, the press look's outline (section 4.3). */
const PRESS_OUTLINE = 'rgb(133, 115, 96)';
/** Past the longest key lock (Shift, 400 ms), with room for a busy machine. */
const APART = 500;

type E2eWindow = Window & { __hrTypeHangulE2E?: { open(params: { rounds: string[] }): void } };
type Box = { x: number; y: number; width: number; height: number };

async function open(page: Page, largest: boolean): Promise<Touchscreen> {
  if (largest) {
    await page.goto('/');
    await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  }
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTypeHangulE2E), undefined, { timeout: 10_000 });
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await page.evaluate(() => (window as E2eWindow).__hrTypeHangulE2E?.open({ rounds: ['hoya'] }));
  await expect(page.getByTestId('type-hangul-field')).toBeVisible();
  await page.getByTestId('hangul-key-ㅎ').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(150);
  return Touchscreen.of(page);
}

const keyBox = async (page: Page, id: string): Promise<Box> => {
  const b = await page.getByTestId(`hangul-key-${id}`).boundingBox();
  if (b === null) throw new Error(`no box for ${id}`);
  return b;
};
const centre = (b: Box): TouchPoint => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
/** What the answer field shows: the typed text (the open block included), or the instruction while empty. */
const field = (page: Page): Promise<string> => page.getByTestId('type-hangul-field').evaluate((el) => el.firstElementChild?.textContent ?? '');
const outline = (page: Page, id: string): Promise<string> =>
  page.getByTestId(`hangul-key-${id}`).evaluate((el) => getComputedStyle(el.firstElementChild as Element).borderTopColor);

/** The key whose hit cell holds `p` (strictly inside), from every key's box. */
async function keyAt(page: Page, p: TouchPoint): Promise<string> {
  const boxes = await page.locator('[data-testid^="hangul-key-"]').evaluateAll((els) =>
    els.map((el) => ({ id: (el.getAttribute('data-testid') ?? '').replace('hangul-key-', ''), r: el.getBoundingClientRect().toJSON() as DOMRect })),
  );
  return boxes.find(({ r }) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom)?.id ?? '';
}

test.describe('Type Hangul keyboard under touch (AMENDMENTS-TOUCH KT-7, F7)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1, build:web:fixtures)');
  test.slow();

  for (const profile of [
    { name: 'phone 320, largest text', viewport: { width: 320, height: 640 }, largest: true },
    { name: 'tablet 820', viewport: { width: 820, height: 1180 }, largest: false },
  ]) {
    test.describe(profile.name, () => {
      test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

      test('F7 a rollover types both letters, in the order the fingers lift', async ({ page }) => {
        const touch = await open(page, profile.largest);
        const h = centre(await keyBox(page, 'ㅎ'));
        const o = centre(await keyBox(page, 'ㅗ'));
        await touch.start({ id: 1, ...h });
        await page.waitForTimeout(40);
        await touch.start({ id: 2, ...o });
        await page.waitForTimeout(40);
        await touch.end(1);
        await page.waitForTimeout(40);
        await touch.end(2);
        await expect.poll(() => field(page)).toBe('호');
        // The second finger lifts first: ㅏ, then ㄴ.
        const a = centre(await keyBox(page, 'ㅏ'));
        const n = centre(await keyBox(page, 'ㄴ'));
        await page.waitForTimeout(APART);
        await touch.start({ id: 1, ...n });
        await page.waitForTimeout(40);
        await touch.start({ id: 2, ...a });
        await page.waitForTimeout(40);
        await touch.end(2);
        await page.waitForTimeout(40);
        await touch.end(1);
        // ㅏ then ㄴ joins into 환; the other order would read 호나.
        await expect.poll(() => field(page)).toBe('환');
      });

      test('F7 an 18 px slide on a key types that key', async ({ page }) => {
        const touch = await open(page, profile.largest);
        const before = await field(page);
        const b = await keyBox(page, 'ㅎ');
        // From 20 px inside the left edge, 18 px right: still on ㅎ.
        await touch.graze({ x: b.x + 20, y: b.y + b.height / 2 }, 18, 0);
        await expect.poll(() => field(page)).toBe('ㅎ');
        expect(before).not.toBe('ㅎ');
      });

      test('graze rows: 0, 8, 16, 24 and 32 px slides type the key under the finger at release, and the press look follows the finger', async ({ page }) => {
        const touch = await open(page, profile.largest);
        const b = await keyBox(page, 'ㅇ');
        const from = { x: b.x + 20, y: b.y + 20 };
        const expected: string[] = [];
        for (const d of [0, 8, 16, 24, 32]) {
          for (const [dx, dy] of [[d, 0], [0, d], [-d, 0], [0, -d]] as const) {
            const end = { x: from.x + dx, y: from.y + dy };
            expected.push(await keyAt(page, end));
            await touch.graze(from, dx, dy);
            await page.waitForTimeout(APART);
          }
        }
        // Rightwards and downwards stay on ㅇ; leftwards and upwards cross to its neighbours past the edge. Consonants
        // alone never join into a block, so the field shows each key in the order typed.
        expect(new Set(expected)).toEqual(new Set(['ㅇ', 'ㄴ', 'ㄷ']));
        await expect.poll(() => field(page)).toBe(expected.join(''));
        // The press look: down on ㅇ, slide well into ㄴ (its left neighbour), back: it follows the finger.
        const o = centre(b);
        const n = centre(await keyBox(page, 'ㄴ'));
        const before = await field(page);
        await touch.start({ id: 1, ...o });
        await expect.poll(() => outline(page, 'ㅇ')).toBe(PRESS_OUTLINE);
        await touch.move({ id: 1, ...n });
        await expect.poll(() => outline(page, 'ㄴ')).toBe(PRESS_OUTLINE);
        await expect.poll(() => outline(page, 'ㅇ')).not.toBe(PRESS_OUTLINE);
        // Off the keyboard, far above it: no key looks pressed and the lift types nothing.
        await touch.move({ id: 1, x: n.x, y: Math.max(1, (await keyBox(page, 'ㅂ')).y - 120) });
        await expect.poll(() => outline(page, 'ㄴ')).not.toBe(PRESS_OUTLINE);
        await touch.end(1);
        await page.waitForTimeout(APART);
        expect(await field(page)).toBe(before);
      });

      test('a lift off the keyboard types nothing', async ({ page }) => {
        const touch = await open(page, profile.largest);
        const before = await field(page);
        const b = await keyBox(page, 'ㅂ');
        // From the top row, 120 px up: past every key and the gap reach.
        await touch.graze(centre(b), 0, -120, { steps: 6 });
        await page.waitForTimeout(APART);
        expect(await field(page)).toBe(before);
      });

      test('a bounce on a letter (60 ms) types once; deletes 150 to 250 ms apart each erase one', async ({ page }) => {
        const touch = await open(page, profile.largest);
        const h = centre(await keyBox(page, 'ㅎ'));
        await touch.tap(h, 20);
        await page.waitForTimeout(60);
        await touch.tap(h, 20);
        await page.waitForTimeout(APART);
        expect(await field(page)).toBe('ㅎ');
        for (const id of ['ㅗ', 'ㅇ']) {
          await touch.tap(centre(await keyBox(page, id)), 20);
          await page.waitForTimeout(APART);
        }
        await expect.poll(() => field(page)).toBe('홍');
        const del = centre(await keyBox(page, 'delete'));
        await touch.tap(del, 20);
        await page.waitForTimeout(150);
        await touch.tap(del, 20);
        await page.waitForTimeout(250);
        await touch.tap(del, 20);
        await page.waitForTimeout(APART);
        expect(await field(page)).not.toMatch(/[ㄱ-ㆎ가-힣]/);
      });

      test('a bounce on Shift (150 ms) leaves it on; the next letter types tense', async ({ page }) => {
        const touch = await open(page, profile.largest);
        const shift = centre(await keyBox(page, 'shift'));
        await touch.tap(shift, 20);
        await page.waitForTimeout(150);
        await touch.tap(shift, 20);
        await expect(page.getByTestId('hangul-key-shift')).toHaveAttribute('aria-pressed', 'true');
        await page.waitForTimeout(APART);
        await touch.tap(centre(await keyBox(page, 'ㄱ')), 20);
        await expect.poll(() => field(page)).toBe('ㄲ');
        await expect(page.getByTestId('hangul-key-shift')).toHaveAttribute('aria-pressed', 'false');
      });

      test('keys stay 64 x 64 or more, edge to edge in a row', async ({ page }) => {
        await open(page, profile.largest);
        const boxes = await page.locator('[data-testid^="hangul-key-"]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
        expect(boxes).toHaveLength(29);
        for (const b of boxes) {
          expect(b.width).toBeGreaterThanOrEqual(63.5);
          expect(b.height).toBeGreaterThanOrEqual(63.5);
        }
        for (const b of boxes) {
          const next = boxes.find((o) => Math.abs(o.top - b.top) < 0.5 && o.left > b.left && o.left - b.right < 4);
          if (next !== undefined) expect(Math.abs(next.left - b.right)).toBeLessThan(0.5);
        }
      });
    });
  }
});
