import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { Touchscreen, pointIn } from './touch';

/**
 * AMENDMENTS-TOUCH row KT-2: the design system's ChoiceCard and Tile inside a `TapBoard`, and Button's press guard,
 * under real touches (sections 4.3 and 4.4). The fixture board (`window.__hrTapBoardE2E`, fixture bundle only, as in
 * `type-hangul-tap-board.spec.ts`) opens with `kind: 'cards'`: two ChoiceCards (commit 10 and 11), two Tiles (20 and
 * 21) and, under the board, a Button.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test type-hangul-tap-board-cards
 *
 * Named under `type-hangul` so the fixture e2e run's `type-hangul` entry in .github/workflows/web-app.yml selects it.
 * Phone at 320 x 640 and tablet at 820 x 1180, both with touch.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** `colors.border.shape`, the press look's outline (section 4.3). */
const PRESS_OUTLINE = 'rgb(133, 115, 96)';
/** `colors.border.focus`, the old press border (and the `hint` ring): never the press look. */
const FOCUS_BLUE = 'rgb(58, 127, 181)';
/** The 0.97 shrink of the press look as a computed transform. */
const SHRUNK = 'matrix(0.97, 0, 0, 0.97, 0, 0)';
const AFTER_LOCK = 450;

interface Params {
  lock: 'board' | 'target';
  layout: 'fit' | 'tall';
  disabled?: number[];
  kind: 'cards';
}
interface Log {
  commits: Array<{ index: number; at: number }>;
  controls: number;
  buttons: number;
}
type E2eWindow = Window & { __hrTapBoardE2E?: { open(p: Params): void; log(): Log } };

async function open(page: Page, params: Omit<Params, 'kind'>): Promise<Touchscreen> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTapBoardE2E), undefined, { timeout: 10_000 });
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await page.evaluate((p) => (window as E2eWindow).__hrTapBoardE2E?.open(p), { ...params, kind: 'cards' as const });
  await expect(page.getByTestId('tap-board')).toBeVisible();
  await expect.poll(() => page.getByTestId('tap-board').evaluate((el) => getComputedStyle(el).touchAction)).toBe(params.layout === 'fit' ? 'pinch-zoom' : 'pan-y pinch-zoom');
  await page.waitForTimeout(AFTER_LOCK);
  return Touchscreen.of(page);
}

const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrTapBoardE2E!.log());
const commits = async (page: Page): Promise<number[]> => (await log(page)).commits.map((c) => c.index);
/** The drawn box inside a target (the press look is painted there, never on the hit area the board measures). */
const drawn = (page: Page, testId: string, prop: 'borderTopColor' | 'transform'): Promise<string> =>
  page.getByTestId(testId).evaluate((el, p) => getComputedStyle(el.firstElementChild as Element)[p], prop);
const settle = (page: Page): Promise<void> => page.waitForTimeout(120);

test.describe('ChoiceCard, Tile and Button under touch (AMENDMENTS-TOUCH KT-2)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');
  test.slow();

  for (const size of [
    { name: 'phone 320', width: 320, height: 640 },
    { name: 'tablet 820', width: 820, height: 1180 },
  ]) {
    test.describe(size.name, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true });

      test('every card and tile is at least 64 on each side, and inside the board it is pinch-zoom', async ({ page }) => {
        await open(page, { lock: 'board', layout: 'fit' });
        for (const id of ['tap-card-0', 'tap-card-1', 'tap-tile-0', 'tap-tile-1', 'tap-button']) {
          const box = (await page.getByTestId(id).boundingBox())!;
          expect(Math.min(box.width, box.height), id).toBeGreaterThanOrEqual(64);
        }
        for (const id of ['tap-card-0', 'tap-tile-0']) {
          expect(await page.getByTestId(id).evaluate((el) => getComputedStyle(el).touchAction)).toBe('pinch-zoom');
        }
      });

      test('the press look on a card and a tile: the border.shape outline and the 0.97 shrink at once, never focus blue; gone after the release', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        for (const [id, index] of [['tap-card-0', 10], ['tap-tile-1', 21]] as const) {
          const centre = await pointIn(page, id);
          const hit = (await page.getByTestId(id).boundingBox())!;
          await touch.start({ id: 1, ...centre });
          await expect.poll(() => drawn(page, id, 'borderTopColor')).toBe(PRESS_OUTLINE);
          expect(await drawn(page, id, 'transform')).toBe(SHRUNK);
          // The hit area keeps its box while the drawn card shrinks.
          expect((await page.getByTestId(id).boundingBox())!).toEqual(hit);
          await touch.end(1);
          await settle(page);
          await expect.poll(() => drawn(page, id, 'borderTopColor')).not.toBe(PRESS_OUTLINE);
          expect(await drawn(page, id, 'borderTopColor')).not.toBe(FOCUS_BLUE);
          expect(await drawn(page, id, 'transform')).toBe('none');
          expect((await commits(page)).at(-1)).toBe(index);
          await page.waitForTimeout(AFTER_LOCK);
        }
        expect(await commits(page)).toEqual([10, 21]);
      });

      test('F1 grazes of 8 to 32 px on a card and a tile commit; a slide that ends 120 px away commits nothing and leaves no look', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        const card = await pointIn(page, 'tap-card-1');
        const tile = await pointIn(page, 'tap-tile-0');
        const grazes = [
          { at: card, dx: 0, dy: 20 },
          { at: card, dx: 32, dy: 0 },
          { at: tile, dx: 0, dy: -24 },
          { at: tile, dx: 8, dy: 8 },
        ];
        for (const g of grazes) {
          await touch.graze(g.at, g.dx, g.dy);
          await page.waitForTimeout(AFTER_LOCK);
        }
        // Down from the tile, past every reach and onto no other answer (the Button under the board is not one).
        await touch.graze(tile, 0, 120);
        await settle(page);
        expect(await commits(page)).toEqual([11, 11, 20, 20]);
        expect(await drawn(page, 'tap-tile-0', 'borderTopColor')).not.toBe(PRESS_OUTLINE);
        expect((await log(page)).buttons).toBe(0);
      });

      test('a bounce on a card (150 ms) commits once', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        const centre = await pointIn(page, 'tap-card-0');
        await touch.tap(centre, 20);
        await page.waitForTimeout(150);
        await touch.tap(centre, 20);
        await settle(page);
        expect(await commits(page)).toEqual([10]);
      });

      test('an answered card (a miss) takes no tap and shows no press look, and stays a focusable button', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit', disabled: [0] });
        const centre = await pointIn(page, 'tap-card-0');
        await touch.start({ id: 1, ...centre });
        await page.waitForTimeout(100);
        expect(await drawn(page, 'tap-card-0', 'borderTopColor')).not.toBe(PRESS_OUTLINE);
        await touch.end(1);
        await settle(page);
        expect(await commits(page)).toEqual([]);
        const card = page.getByTestId('tap-card-0');
        expect(await card.getAttribute('tabindex')).toBe('0');
        expect(await card.getAttribute('aria-disabled')).not.toBe('true');
      });

      test('R8 a bounce on the Button runs it once; a press after the lock runs it again', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        const button = await pointIn(page, 'tap-button');
        await touch.tap(button, 20);
        await page.waitForTimeout(150);
        await touch.tap(button, 20);
        await settle(page);
        expect((await log(page)).buttons).toBe(1);
        await page.waitForTimeout(AFTER_LOCK);
        await touch.tap(button, 20);
        await settle(page);
        expect((await log(page)).buttons).toBe(2);
      });

      test('a bounce from an answer onto the Button 150 ms later does not press it (the app lock); after the lock it does', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        await touch.tap(await pointIn(page, 'tap-card-1'), 20);
        await page.waitForTimeout(150);
        const button = await pointIn(page, 'tap-button');
        await touch.tap(button, 20);
        await settle(page);
        expect(await commits(page)).toEqual([11]);
        expect((await log(page)).buttons).toBe(0);
        await page.waitForTimeout(AFTER_LOCK);
        await touch.tap(button, 20);
        await settle(page);
        expect((await log(page)).buttons).toBe(1);
      });

      test('the Button shows its pressed fill on the first touch frame (no 50 ms delay)', async ({ page }) => {
        const touch = await open(page, { lock: 'board', layout: 'fit' });
        const button = page.getByTestId('tap-button');
        const rest = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
        await touch.start({ id: 1, ...(await pointIn(page, 'tap-button')) });
        // One frame, well under react-native-web's 50 ms delayPressIn.
        await page.waitForTimeout(20);
        expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(rest);
        await touch.end(1);
        await settle(page);
      });
    });
  }

  test.describe('reduced motion', () => {
    test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });

    test('the press look keeps the outline and drops the shrink', async ({ page }) => {
      const touch = await open(page, { lock: 'board', layout: 'fit' });
      const centre = await pointIn(page, 'tap-card-0');
      await touch.start({ id: 1, ...centre });
      await expect.poll(() => drawn(page, 'tap-card-0', 'borderTopColor')).toBe(PRESS_OUTLINE);
      expect(await drawn(page, 'tap-card-0', 'transform')).toBe('none');
      await touch.end(1);
      await settle(page);
    });
  });
});
