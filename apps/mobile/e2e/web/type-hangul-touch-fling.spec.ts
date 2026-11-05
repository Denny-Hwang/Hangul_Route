import type { CDPSession, Page } from '@playwright/test';
import { FLING_DECAY, FLING_FRAME_MS } from '@hangul-route/design-system/tap-model';
import { expect, test } from './fixtures';

/**
 * AMENDMENTS-TOUCH row KT-12, assumption U5 (section 10): a board-driven scroll with `FLING_DECAY` feels close enough to
 * a phone's own scroll that a child does not notice the difference. What an agent can measure, and this spec does, is the
 * distance the board's fling covers after the finger lifts, per px/ms of release speed (the fling's "gain", in ms), on
 * the fixture board in its scrolling layout, with real touches (CDP `Input.dispatchTouchEvent`), next to
 *
 * - the browser's own fling in the same Chromium for a touch that starts off the board (this is a desktop engine's
 *   curve, not a phone's; it is reported, not asserted), and
 * - the two phone engines' published curves, computed here from their formulas: iOS UIScrollView (normal deceleration,
 *   0.998 per ms, a gain of 499 ms at every speed) and Android's OverScroller (friction 0.015, at 3x density; a gain of
 *   about 100 ms at 0.5 px/ms to 380 ms at 3 px/ms).
 *
 * The tuning rule of `FLING_DECAY` (docs/specs/AMENDMENTS-TOUCH.md section 10, U5): at every flick the board's gain is
 * between the two phone engines' gains (the lower less 20 %, the higher plus 25 %, for a release speed that varies a
 * little from run to run), and over the four flicks it averages 260 to 380 ms, around the geometric middle of the two
 * engines over this range of speeds (about 335 ms; the theoretical gain of 0.95 per 16 ms is 320 ms, and the frames
 * measure 275 to 350). The felt comparison on a real phone stays an owner check.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test type-hangul-touch-fling
 *
 * Named under `type-hangul` so the fixture e2e run in web-app.yml selects it. Phone at 320 x 640.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

type E2eWindow = Window & {
  __hrTapBoardE2E?: { open(p: { lock: 'board'; layout: 'tall' }): void };
  __flick?: { moves: Array<{ t: number; y: number }>; frames: Array<{ t: number; top: number }>; stop: boolean };
};

/** iOS UIScrollView.DecelerationRate.normal: the velocity keeps 0.998 per ms, so a flick of v px/ms travels v / (1 - 0.998) px. */
export function iosGainMs(): number {
  return 0.998 / (1 - 0.998);
}

/**
 * Android OverScroller.fling with ViewConfiguration's friction (0.015) at density 3: the distance in physical px is
 * `friction * coeff * exp(r * ln(0.35 * v / (friction * coeff)))` with `r = d / (d - 1)` and `d = ln 0.78 / ln 0.9`, `coeff`
 * = 386.0878 * 160 * density. A speed of `v` dp/ms is `1000 * v * density` px/s. Returned as the gain in ms.
 */
export function androidGainMs(vPxPerMs: number, density = 3): number {
  const coeff = 386.0878 * 160 * density;
  const friction = 0.015;
  const d = Math.log(0.78) / Math.log(0.9);
  const r = d / (d - 1);
  const vPhysical = 1000 * vPxPerMs * density;
  const distancePhysical = friction * coeff * Math.exp(r * Math.log((0.35 * vPhysical) / (friction * coeff)));
  return distancePhysical / density / vPxPerMs;
}

/** The board's own gain in theory: the sum of `v * decay^n * frame` over n, per px/ms of v. */
export function boardGainMs(decay: number = FLING_DECAY): number {
  return FLING_FRAME_MS / (1 - decay);
}

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTapBoardE2E), undefined, { timeout: 10_000 });
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await page.evaluate(() => (window as E2eWindow).__hrTapBoardE2E?.open({ lock: 'board', layout: 'tall' }));
  await expect(page.getByTestId('tap-board')).toBeVisible();
  await expect.poll(() => page.getByTestId('tap-board').evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y pinch-zoom');
  await page.waitForTimeout(500);
}

interface Flick {
  /** Release speed over the last 100 ms of the touch, px/ms (the board's own measure). */
  v: number;
  /** Offset change from the release to rest, px. */
  after: number;
  /** `after / v`, ms. */
  gain: number;
  /** How far the scroller could still go when the flick began, px. */
  room: number;
}

/** One flick upward from `from`: `steps` moves of `stepMs` over `travel` px, then a lift; measured until the page rests. */
async function flick(page: Page, cdp: CDPSession, from: { x: number; y: number }, travel: number, steps: number, stepMs: number): Promise<Flick> {
  const room = await page.evaluate(() => {
    const w = window as E2eWindow;
    let el: Element | null = document.querySelector('[data-testid="tap-board"]');
    for (; el !== null; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) break;
    }
    const sc = el ?? document.scrollingElement!;
    sc.scrollTop = 0;
    const log = { moves: [] as Array<{ t: number; y: number }>, frames: [] as Array<{ t: number; top: number }>, stop: false };
    w.__flick = log;
    window.addEventListener('touchmove', (e) => log.moves.push({ t: e.timeStamp, y: e.touches[0]!.clientY }), { capture: true });
    const loop = (): void => {
      log.frames.push({ t: performance.now(), top: sc.scrollTop });
      if (!log.stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return sc.scrollHeight - sc.clientHeight;
  });
  await page.waitForTimeout(100);
  const send = (type: string, y: number): Promise<unknown> => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: from.x, y, id: 1 }] });
  await send('touchStart', from.y);
  for (let i = 1; i <= steps; i += 1) {
    await page.waitForTimeout(stepMs);
    await send('touchMove', from.y - (travel * i) / steps);
  }
  await send('touchEnd', from.y - travel);
  await page.waitForTimeout(2_800);
  const out = await page.evaluate(() => {
    const log = (window as E2eWindow).__flick!;
    log.stop = true;
    const last = log.moves[log.moves.length - 1]!;
    const win = log.moves.filter((m) => last.t - m.t <= 100);
    const v = -(win[win.length - 1]!.y - win[0]!.y) / (win[win.length - 1]!.t - win[0]!.t);
    // `timeStamp` and `performance.now()` share one clock in the page.
    const atRelease = (log.frames.find((f) => f.t >= last.t) ?? log.frames[0]!).top;
    return { v, atRelease, rest: log.frames[log.frames.length - 1]!.top };
  });
  const after = out.rest - out.atRelease;
  return { v: out.v, after, gain: after / out.v, room };
}

test.describe('board-driven fling against the phone engines (AMENDMENTS-TOUCH KT-12, U5)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  // [travel px, moves, ms between moves]: release speeds from about 0.5 to 3 px/ms.
  const FLICKS: ReadonlyArray<readonly [number, number, number]> = [
    [160, 8, 40],
    [200, 8, 24],
    [240, 8, 14],
    [320, 8, 10],
  ];

  test('the gain of a board-driven fling sits between iOS and Android, around their geometric middle', async ({ page }) => {
    test.setTimeout(180_000);
    const cdp = await page.context().newCDPSession(page);
    const rows: string[] = [];
    const gains: number[] = [];
    const logRatios: number[] = [];
    for (const [travel, steps, stepMs] of FLICKS) {
      await open(page);
      const box = (await page.getByTestId('tap-target-0').boundingBox())!;
      const board = await flick(page, cdp, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, travel, steps, stepMs);
      await open(page);
      const native = await flick(page, cdp, { x: 160, y: 590 }, travel, steps, stepMs);
      const ios = iosGainMs();
      const android = androidGainMs(board.v);
      const lo = Math.min(ios, android);
      const hi = Math.max(ios, android);
      rows.push(
        `release ${board.v.toFixed(2)} px/ms: board ${Math.round(board.gain)} ms (${Math.round(board.after)} px), Chromium's own ${Math.round(native.gain)} ms at ${native.v.toFixed(2)} px/ms, iOS ${Math.round(ios)} ms, Android ${Math.round(android)} ms`,
      );
      // The fling must have room to finish, or the gain reads short.
      expect(board.room, 'the scroller has room for the fling').toBeGreaterThan(board.after * 1.1);
      expect(board.gain, `the board's gain at ${board.v.toFixed(2)} px/ms (${Math.round(lo)} to ${Math.round(hi)} ms between the phone engines)`).toBeGreaterThanOrEqual(lo * 0.8);
      expect(board.gain).toBeLessThanOrEqual(hi * 1.25);
      gains.push(board.gain);
      logRatios.push(Math.log(board.gain / Math.sqrt(ios * android)));
    }
    const mean = Math.exp(logRatios.reduce((a, b) => a + b, 0) / logRatios.length);
    const meanGain = gains.reduce((a, b) => a + b, 0) / gains.length;
    rows.push(`mean gain ${Math.round(meanGain)} ms; ratio to the geometric middle of iOS and Android ${mean.toFixed(2)} (FLING_DECAY ${FLING_DECAY}, theoretical gain ${Math.round(boardGainMs())} ms)`);
    await test.info().attach('fling.txt', { body: rows.join('\n'), contentType: 'text/plain' });
    for (const row of rows) test.info().annotations.push({ type: 'fling', description: row });
    expect(meanGain, 'the mean gain, ms').toBeGreaterThan(260);
    expect(meanGain).toBeLessThan(380);
  });
});
