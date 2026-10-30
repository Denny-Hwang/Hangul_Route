import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { seedStored, swipeStage, type WindowPoint } from './helpers';
import { shot } from './shots';

/**
 * AMENDMENTS-PRESENTER-NAV section 14, row PN-2 (owner report 2026-10-29: "when I tap answer 1 or
 * answer 3 it often goes back or forward instead"): no hidden tap zones on the lecture stage. On
 * each layout family (title, 2 x 2 option grid, full-width option rows, order steps, sentence
 * tiles, write-together chips) and at every window of the matrix (V1 568 x 320, the overlay layout;
 * since row PN-4 V2c 640 x 360 the compact rail and V2 844 x 390 with and without notch insets the
 * full rail, all touch; V3 1180 x 820, 1024 x 768 and upright 820 x 1180 and V4 1920 x 1080,
 * docked, by touch and by mouse; with `E2E_RAIL_OFF=1`, a local `EXPO_PUBLIC_PRESENTER_RAIL=0`
 * build, every phone is the overlay layout and its cases run there):
 * every content target tapped at its centre, on its Korean, 20 px in from its left edge and 8 px
 * inside its right and bottom edges steps nothing and presses no control; every content target box
 * is at least 32 px from every visible control box on docked windows and beside the rail; a touch
 * tap on empty stage rings Next (docked and rail) or shows and hides the bar (overlay); a mouse click on empty stage goes on on
 * a target-free slide and does nothing on a slide with targets; a swipe from the centre and from an
 * option steps once, a vertical drag, a diagonal at 1.2, a two-finger swipe (either lift order) and
 * a swipe from 10 px of either window edge do nothing; on docked touch and on the rail, Previous and
 * Next are shown and take taps at the start, after 5 s idle, after a step and on every question slide
 * (the rail's More and Sound too); a tap in the gap between a target and the band or the rail presses
 * nothing; More open blocks a swipe and an option tap, and a tap closes it (the rail and the overlay
 * layout). Swipes drive CDP
 * touch events (`swipeStage`), Chromium only: under `E2E_WEBKIT` they skip and the taps run.
 * Screenshots with `HR_SHOTS=1`.
 */

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2enav1',
  title: 'Nav lesson',
  createdAt: '2026-10-29T09:00:00Z',
  seed: 7,
  blocks: [
    // Letters with their Check (the 2 x 2 option grid), a listen-word question (rows), an order slide,
    // a sentence build and a write-together frame (chips).
    { kind: 'quest', id: 'quest:stage1-letters-q1' },
    { kind: 'quest', id: 'quest:stage3-life-q1' },
    { kind: 'quest', id: 'quest:stage1-rites-q3' },
    { kind: 'quest', id: 'quest:stage3-life-q3' },
    { kind: 'quest', id: 'quest:stage7-life-q2' },
  ],
};

const link = (deck: LectureDeckInput = DECK): string => `/present#d=${encodeDeck(deck)}`;
const SWIPES_SKIPPED = process.env.E2E_WEBKIT === '1';
/** 32 px: the clearance between a content target and a control (section 5.0, `spacing.xxl`). */
const NAV_CLEARANCE = 32;

type Input = 'touch' | 'mouse';
type Family = 'title' | 'grid' | 'rows' | 'order' | 'tiles' | 'chips';
const FAMILIES: readonly Family[] = ['title', 'grid', 'rows', 'order', 'tiles', 'chips'];

type Layout = 'docked' | 'rail' | 'overlay';

interface Viewport {
  id: string;
  width: number;
  height: number;
  phone: boolean;
  inputs: readonly Input[];
  insets?: { top: number; right: number; bottom: number; left: number };
  /** A phone's layout from PN-4 on (section 14 "Layout (PN-4 on)"): the rail where it fits, else the overlay. */
  rail?: 'full' | 'compact';
}

/** `E2E_RAIL_OFF=1`: a local `EXPO_PUBLIC_PRESENTER_RAIL=0` build, where every phone uses the overlay layout (section 15). */
const RAIL_OFF = process.env.E2E_RAIL_OFF === '1';
const layoutOf = (vp: Viewport): Layout => (!vp.phone ? 'docked' : vp.rail !== undefined && !RAIL_OFF ? 'rail' : 'overlay');

const MATRIX: readonly Viewport[] = [
  { id: 'V1', width: 568, height: 320, phone: true, inputs: ['touch'] },
  { id: 'V2c', width: 640, height: 360, phone: true, inputs: ['touch'], rail: 'compact' },
  { id: 'V2', width: 844, height: 390, phone: true, inputs: ['touch'], rail: 'full' },
  { id: 'V2-notch', width: 844, height: 390, phone: true, inputs: ['touch'], insets: { top: 0, right: 47, bottom: 21, left: 47 }, rail: 'full' },
  { id: 'V3', width: 1180, height: 820, phone: false, inputs: ['touch', 'mouse'] },
  { id: 'V3-4x3', width: 1024, height: 768, phone: false, inputs: ['touch', 'mouse'] },
  { id: 'V3-upright', width: 820, height: 1180, phone: false, inputs: ['touch', 'mouse'] },
  { id: 'V4', width: 1920, height: 1080, phone: false, inputs: ['mouse', 'touch'] },
];

/**
 * Start asks for fullscreen in its tap; headless Chromium would grant it and resize the window, which
 * no phone or tablet does, so the request is recorded and the window left as it is.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = function requestFullscreen(): Promise<void> {
      return Promise.resolve();
    };
  });
});

async function open(page: Page, vp: Viewport, input: Input): Promise<void> {
  if (vp.insets) {
    // The insets come from CDP `Emulation.setSafeAreaInsetsOverride` (Chromium only).
    test.skip(SWIPES_SKIPPED, 'notch insets are emulated through CDP (Chromium only)');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: vp.insets });
  }
  await page.goto(link());
  const start = page.getByTestId('presenter-start-button');
  await expect(start).toBeEnabled({ timeout: 10_000 });
  if (input === 'touch') await start.tap();
  else await start.click();
  await expect(page.getByTestId('presenter-stage')).toBeVisible();
  await expect.poll(() => counter(page)).toMatch(/^1 \//);
}

const counter = async (page: Page): Promise<string> => (await page.getByTestId('presenter-counter').textContent()) ?? '';
const live = async (page: Page): Promise<string> => (await page.getByTestId('presenter-live').textContent()) ?? '';

/** Every overlay or flash a pressed control would open: none may appear after a tap on the stage. */
const PRESSED = ['presenter-more-sheet', 'presenter-grid', 'presenter-help', 'presenter-blank', 'presenter-exit-dialog', 'presenter-timer-full', 'presenter-timer-corner', 'presenter-no-sound-flash', 'presenter-sound-failed-flash'];

/** What a step, a reveal, a pressed control or a bar toggle would change. */
async function state(page: Page): Promise<{ counter: string; next: string | null; live: string; pressed: string[]; bar: string | null }> {
  const pressed: string[] = [];
  for (const id of PRESSED) if ((await page.getByTestId(id).count()) > 0) pressed.push(id);
  const compact = page.getByTestId('presenter-bar-compact');
  const bar = (await compact.count()) > 0 ? await compact.evaluate((el) => getComputedStyle(el).opacity) : null;
  // Next reads Reveal while the slide has builds left: a reveal changes it.
  const next = await page.getByTestId('presenter-next').getAttribute('aria-label');
  return { counter: await counter(page), next, live: await live(page), pressed, bar };
}

/** Which layout family the slide on the stage is, from its DOM. */
async function familyNow(page: Page): Promise<Family | null> {
  return page.getByTestId('presenter-stage').evaluate((stage) => {
    const q = (id: string) => stage.querySelector(`[data-testid="${id}"]`);
    if (q('presenter-title-kind') || stage.querySelector('[data-testid="presenter-live"]')?.textContent?.startsWith('Slide 1 of')) return 'title';
    if (q('presenter-sequence-order')) return 'order';
    if (q('presenter-build')) return 'tiles';
    const chips = Array.from(stage.querySelectorAll('[data-testid="presenter-write-chip"]')).filter((el) => Number(getComputedStyle(el.closest('[data-testid="presenter-write-bank"]') ?? el).opacity) > 0.5);
    if (chips.length > 0) return 'chips';
    const options = Array.from(stage.querySelectorAll('[data-stage-target^="option:"]')).map((el) => el.getBoundingClientRect());
    if (options.length >= 3) {
      const tops = new Set(options.map((r) => Math.round(r.top)));
      return tops.size < options.length ? 'grid' : 'rows';
    }
    return null;
  }) as Promise<Family | null>;
}

/** The ArrowRight presses from the first build of slide 1 to the first build of each family (one walk per test). */
async function familyPresses(page: Page): Promise<Map<Family, number>> {
  const found = new Map<Family, number>();
  const total = Number((await counter(page)).split('/')[1]);
  let presses = 0;
  while (found.size < FAMILIES.length && presses < total * 8) {
    const family = await familyNow(page);
    if (family !== null && !found.has(family)) found.set(family, presses);
    await page.keyboard.press('ArrowRight');
    presses += 1;
  }
  expect([...found.keys()].sort()).toEqual([...FAMILIES].sort());
  await page.keyboard.press('Home');
  await expect.poll(() => counter(page)).toMatch(/^1 \//);
  return found;
}

async function goToFamily(page: Page, presses: Map<Family, number>, family: Family): Promise<void> {
  await page.keyboard.press('Home');
  await expect.poll(() => counter(page)).toMatch(/^1 \//);
  for (let i = 0; i < presses.get(family)!; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => familyNow(page)).toBe(family);
}

interface TargetBox {
  marker: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  ko: WindowPoint | null;
}

/** The content targets drawn now (visible, with a size), each with the centre of its first Korean text. */
function targets(page: Page): Promise<TargetBox[]> {
  return page.getByTestId('presenter-stage').evaluate((stage) => {
    const shown = (el: Element): boolean => {
      for (let at: Element | null = el; at; at = at.parentElement) if (Number(getComputedStyle(at).opacity) < 0.01) return false;
      return true;
    };
    const out: TargetBox[] = [];
    for (const el of Array.from(stage.querySelectorAll('[data-stage-target]'))) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || !shown(el)) continue;
      const korean = Array.from(el.querySelectorAll('*')).find((n) => n.childElementCount === 0 && /[가-힣]/.test(n.textContent ?? ''));
      const k = korean?.getBoundingClientRect();
      out.push({
        marker: el.getAttribute('data-stage-target') ?? '',
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        ko: k && k.width > 0 ? { x: k.left + k.width / 2, y: k.top + k.height / 2 } : null,
      });
    }
    return out;
  });
}

/** The targets once the slide has fit itself (a question's rows settle over a few frames): two reads 150 ms apart agree. */
async function settledTargets(page: Page): Promise<TargetBox[]> {
  let last = JSON.stringify(await targets(page));
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const now = JSON.stringify(await targets(page));
    if (now === last) return JSON.parse(now) as TargetBox[];
    last = now;
  }
  throw new Error('the slide never settled');
}

/** Every visible control box on the bar (opacity above 0.01 all the way up). */
function controls(page: Page): Promise<{ id: string; left: number; top: number; right: number; bottom: number }[]> {
  return page.evaluate(() => {
    const shown = (el: Element): boolean => {
      for (let at: Element | null = el; at; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (Number(style.opacity) < 0.01 || style.visibility === 'hidden' || style.display === 'none') return false;
      }
      return true;
    };
    const bars = Array.from(document.querySelectorAll('[data-testid="presenter-bar-band"], [data-testid="presenter-bar-compact"], [data-testid="presenter-rail"]'));
    return bars
      .flatMap((bar) => Array.from(bar.querySelectorAll('[role="button"]')))
      .filter(shown)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.getAttribute('data-testid') ?? '', left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      });
  });
}

/** The gap between two boxes (0 when they meet). */
function gap(a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }): number {
  const dx = Math.max(0, b.left - a.right, a.left - b.right);
  const dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
  return Math.hypot(dx, dy);
}

/** The five points of section 14 on a target: centre, its Korean, 20 px in from the left, 8 px inside the right and the bottom edge. */
function pointsOn(t: TargetBox): { name: string; at: WindowPoint }[] {
  const cx = (t.left + t.right) / 2;
  const cy = (t.top + t.bottom) / 2;
  return [
    { name: 'centre', at: { x: cx, y: cy } },
    ...(t.ko ? [{ name: 'Korean', at: t.ko }] : []),
    { name: 'left 20', at: { x: t.left + 20, y: cy } },
    { name: 'right 8', at: { x: t.right - 8, y: cy } },
    { name: 'bottom 8', at: { x: cx, y: t.bottom - 8 } },
  ];
}

async function tapAt(page: Page, input: Input, at: WindowPoint): Promise<void> {
  if (input === 'touch') await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}

/** Empty stage area: the stage's top-left padding, where no slide draws. */
async function emptyPoint(page: Page): Promise<WindowPoint> {
  const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
  return { x: stage.x + 10, y: stage.y + 10 };
}

async function stageCentre(page: Page): Promise<WindowPoint> {
  const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
  return { x: stage.x + stage.width / 2, y: stage.y + stage.height / 2 };
}

/** The overlay bar is hidden (transparent, no pointer), or shown and past its grace. */
async function overlayBar(page: Page, shown: boolean): Promise<void> {
  const bar = page.getByTestId('presenter-bar-compact');
  if (shown) {
    await expect(bar).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('presenter-next')).not.toHaveCSS('pointer-events', 'none');
  } else {
    await expect(page.getByTestId('presenter-next')).toHaveCSS('pointer-events', 'none');
    await expect(bar).toHaveCSS('opacity', '0');
  }
}

/** Previous and Next (and, `ids`, more of the bar) are drawn in full and take taps. */
async function pairShown(page: Page, label: string, ids: readonly string[] = ['presenter-back', 'presenter-next']): Promise<void> {
  for (const id of ids) {
    const opacity = await page.getByTestId(id).evaluate((el) => {
      let out = 1;
      for (let at: Element | null = el; at; at = at.parentElement) out *= Number(getComputedStyle(at).opacity);
      return out;
    });
    expect(opacity, `${label}: ${id}`).toBe(1);
    await expect(page.getByTestId(id), `${label}: ${id}`).not.toHaveCSS('pointer-events', 'none');
    await expect(page.getByTestId(id), `${label}: ${id}`).toBeEnabled();
  }
}

for (const vp of MATRIX) {
  for (const input of vp.inputs) {
    const layout = layoutOf(vp);
    test.describe(`${vp.id} ${vp.width} x ${vp.height}${vp.insets ? ' with notch insets' : ''}, ${input} (${layout}${layout === 'rail' && vp.rail === 'compact' ? ', compact' : ''})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.phone, hasTouch: input === 'touch' });

      test('every content target, tapped anywhere on it, steps nothing and presses no control; clearance on docked windows', async ({ page }) => {
        test.setTimeout(180_000);
        await open(page, vp, input);
        await expect(page.getByTestId('presenter-grabber')).toHaveCount(0);
        const presses = await familyPresses(page);
        for (const family of FAMILIES) {
          if (family === 'title') continue;
          await goToFamily(page, presses, family);
          // Overlay: the keyboard step hid the bar; a tap on a target must leave it so.
          if (layout === 'overlay') await overlayBar(page, false);
          const boxes = await settledTargets(page);
          expect(boxes.length, family).toBeGreaterThan(0);
          if (family === 'grid' || family === 'rows') expect(boxes.every((b) => /^option:[1-4]$/.test(b.marker)), family).toBe(true);
          if (family === 'order') expect(boxes.every((b) => b.marker === 'step'), family).toBe(true);
          if (family === 'tiles') expect(boxes.every((b) => b.marker === 'tile'), family).toBe(true);
          if (family === 'chips') expect(boxes.some((b) => b.marker === 'chip'), family).toBe(true);
          if (layout !== 'overlay') {
            // Section 5.0: at least 32 window px between every target and every visible control (the band or the rail).
            const shown = await controls(page);
            expect(shown.length, `${family}: the bar's controls are on screen`).toBeGreaterThan(0);
            let least = { gap: Infinity, pair: '' };
            for (const t of boxes) for (const c of shown) if (gap(t, c) < least.gap) least = { gap: gap(t, c), pair: `${t.marker} ${JSON.stringify(t)} / ${c.id} ${JSON.stringify(c)}` };
            expect(least.gap, `${family}: clearance, ${least.pair}`).toBeGreaterThanOrEqual(NAV_CLEARANCE);
          }
          const before = await state(page);
          for (const t of boxes) {
            for (const point of pointsOn(t)) {
              await tapAt(page, input, point.at);
              await page.waitForTimeout(60);
              expect(await state(page), `${family} ${t.marker} ${point.name} at ${Math.round(point.at.x)},${Math.round(point.at.y)}`).toEqual(before);
            }
          }
          if (family === 'grid') await shot(page, `presenter-nav-${vp.id}-${input}-grid`);
        }
      });

      test('an empty-stage tap: touch rings Next or shows and hides the bar; a mouse click goes on only on a target-free slide', async ({ page }) => {
        await open(page, vp, input);
        if (layout === 'overlay') {
          // The start shows the bar for a moment; then it hides.
          await overlayBar(page, false);
        }
        const presses = await familyPresses(page);
        const title = await state(page);
        await tapAt(page, input, await emptyPoint(page));
        if (input === 'mouse') {
          await expect.poll(() => counter(page)).toMatch(/^2 \//);
        } else if (layout !== 'overlay') {
          // The ring: a static outline on Next (the band's or the rail's), for NUDGE_MS, and no step.
          await expect(page.getByTestId('presenter-next')).toHaveAttribute('data-nudge', 'on');
          await expect(page.getByTestId('presenter-next')).toHaveCSS('outline-style', 'solid');
          expect(await counter(page)).toBe(title.counter);
          await shot(page, `presenter-nav-${vp.id}-ring`);
          await expect(page.getByTestId('presenter-next')).not.toHaveAttribute('data-nudge', 'on', { timeout: 3000 });
          expect(await counter(page)).toBe(title.counter);
        } else {
          await overlayBar(page, true);
          expect(await counter(page)).toBe(title.counter);
          await shot(page, `presenter-nav-${vp.id}-bar`);
          await tapAt(page, input, await emptyPoint(page));
          await overlayBar(page, false);
          expect(await counter(page)).toBe(title.counter);
        }
        // A slide with targets: an empty-area tap or click never steps.
        await goToFamily(page, presses, 'grid');
        const grid = await counter(page);
        const liveBefore = await live(page);
        await tapAt(page, input, await emptyPoint(page));
        await page.waitForTimeout(150);
        expect(await counter(page)).toBe(grid);
        expect(await live(page)).toBe(liveBefore);
      });

      if (input === 'touch') {
        test('swipes: from the centre and from an option one step each; vertical, diagonal 1.2, two fingers and the window edges nothing', async ({ page }) => {
          test.skip(SWIPES_SKIPPED, 'swipes drive CDP touch events (Chromium only)');
          await open(page, vp, input);
          const presses = await familyPresses(page);
          const centre = await stageCentre(page);
          const travel = Math.min(160, (vp.width - 2 * (vp.insets?.left ?? 0)) * 0.25);
          // From the centre: left is next, right is back.
          await swipeStage(page, centre, { x: centre.x - travel, y: centre.y });
          await expect.poll(() => counter(page)).toMatch(/^2 \//);
          await swipeStage(page, centre, { x: centre.x + travel, y: centre.y });
          await expect.poll(() => counter(page)).toMatch(/^1 \//);
          // From the middle of an option: one step.
          await goToFamily(page, presses, 'grid');
          const at = await state(page);
          const first = (await targets(page))[0]!;
          const mid = { x: (first.left + first.right) / 2, y: (first.top + first.bottom) / 2 };
          await swipeStage(page, mid, { x: mid.x - travel, y: mid.y });
          // One step: the answer is revealed (Next no longer reads Reveal) or the slide changes.
          await expect.poll(async () => { const now = await state(page); return now.counter !== at.counter || now.next !== at.next; }).toBe(true);
          const after = await state(page);
          // Nothing: a vertical drag, a diagonal at 1.2, two fingers either way, and a start 10 px from each
          // edge. Each is checked on its own, so a broken pair (one forward, one back) cannot cancel out.
          const c = await stageCentre(page);
          const nothing = async (label: string, from: WindowPoint, to: WindowPoint, options?: Parameters<typeof swipeStage>[3]): Promise<void> => {
            await swipeStage(page, from, to, options);
            await page.waitForTimeout(150);
            expect(await state(page), label).toEqual(after);
          };
          await nothing('vertical', c, { x: c.x + 30, y: c.y + 120 });
          await nothing('diagonal 1.2', c, { x: c.x - 120, y: c.y - 100 });
          for (const liftFirst of ['tracked', 'other'] as const) {
            await nothing(`two fingers left, ${liftFirst} lifts first`, c, { x: c.x - travel, y: c.y - 40 }, { fingers: 2, liftFirst });
            await nothing(`two fingers right, ${liftFirst} lifts first`, c, { x: c.x + travel, y: c.y - 40 }, { fingers: 2, liftFirst });
          }
          await nothing('10 px from the left edge, right (back)', { x: 10, y: c.y }, { x: 10 + travel, y: c.y });
          await nothing('10 px from the right edge, left (next)', { x: vp.width - 10, y: c.y }, { x: vp.width - 10 - travel, y: c.y });
          if (vp.insets) {
            // The guard reaches the inset plus 8 (55 px here): a start at 50 px is still inside it.
            await nothing('inside the left inset guard', { x: vp.insets.left + 3, y: c.y }, { x: vp.insets.left + 3 + travel, y: c.y });
            await nothing('inside the right inset guard', { x: vp.width - vp.insets.right - 3, y: c.y }, { x: vp.width - vp.insets.right - 3 - travel, y: c.y });
          }
        });
      }

      if (vp.id === 'V3') {
        test('a tap in the padding between the bottom option row and the band presses nothing and steps nothing', async ({ page }) => {
          await open(page, vp, input);
          const presses = await familyPresses(page);
          for (const family of ['grid', 'rows'] as const) {
            await goToFamily(page, presses, family);
            const boxes = await settledTargets(page);
            const band = (await page.getByTestId('presenter-bar-band').boundingBox())!;
            const lowest = boxes.reduce((a, b) => (b.bottom > a.bottom ? b : a));
            const at = { x: (lowest.left + lowest.right) / 2, y: (lowest.bottom + band.y) / 2 };
            expect(band.y - lowest.bottom, `${family}: the gap`).toBeGreaterThanOrEqual(NAV_CLEARANCE);
            const before = await state(page);
            await tapAt(page, input, at);
            await page.waitForTimeout(150);
            expect(await state(page), `${family} gap at ${Math.round(at.x)},${Math.round(at.y)}`).toEqual(before);
          }
        });
      }

      if (vp.id === 'V3' && input === 'touch') {
        test('a swipe inside the Slides grid or Help steps nothing and leaves it open', async ({ page }) => {
          test.skip(SWIPES_SKIPPED, 'swipes drive CDP touch events (Chromium only)');
          await open(page, vp, input);
          await page.keyboard.press('ArrowRight');
          await expect.poll(() => counter(page)).toMatch(/^2 \//);
          for (const { key, id } of [{ key: 'g', id: 'presenter-grid' }, { key: 'h', id: 'presenter-help' }]) {
            await page.keyboard.press(key);
            const overlay = page.getByTestId(id);
            await expect(overlay).toBeVisible();
            const before = { counter: await counter(page), live: await live(page) };
            const box = (await overlay.boundingBox())!;
            const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
            for (const dx of [-160, 160]) {
              await swipeStage(page, mid, { x: mid.x + dx, y: mid.y });
              await page.waitForTimeout(150);
              expect({ counter: await counter(page), live: await live(page) }, `${id}, swipe ${dx < 0 ? 'left' : 'right'}`).toEqual(before);
              await expect(overlay).toBeVisible();
            }
            await page.keyboard.press('Escape');
            await expect(overlay).toHaveCount(0);
          }
        });
      }

      if (input === 'touch' && layout !== 'overlay') {
        test('Previous and Next are shown and take taps at the start, after 5 s idle, after a step and on every question slide', async ({ page }) => {
          test.setTimeout(120_000);
          await open(page, vp, input);
          // The rail never hides anything: its More and Sound are checked with the pair.
          const shownIds = layout === 'rail' ? ['presenter-more', 'presenter-next', 'presenter-back', 'presenter-sound'] : ['presenter-back', 'presenter-next'];
          await pairShown(page, 'start', shownIds);
          await page.waitForTimeout(5000);
          await pairShown(page, 'after 5 s idle', shownIds);
          // Docked, the tools fade; the pair does not.
          if (layout === 'docked') await expect(page.getByTestId('presenter-sound')).toHaveCSS('pointer-events', 'none');
          await page.getByTestId('presenter-next').tap();
          await expect.poll(() => counter(page)).toMatch(/^2 \//);
          await pairShown(page, 'after a step', shownIds);
          await shot(page, `presenter-nav-${vp.id}-pinned`);
          // Every question slide, each after the tools have faded again. The walk is by keys (a press's own
          // focus holds a docked bar, README D3), from a page with nothing focused.
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
          const total = Number((await counter(page)).split('/')[1]);
          let questions = 0;
          for (let n = 2; n <= total; n++) {
            await expect.poll(() => counter(page)).toBe(`${n} / ${total}`);
            if ((await page.getByTestId('presenter-quiz-options').count()) > 0) {
              questions += 1;
              if (layout === 'docked') await expect(page.getByTestId('presenter-sound')).toHaveCSS('pointer-events', 'none', { timeout: 6000 });
              await pairShown(page, `question at ${n} / ${total}`, shownIds);
            }
            // On to the next slide (its builds first).
            for (let i = 0; i < 12 && (await counter(page)) === `${n} / ${total}` && n < total; i++) await page.keyboard.press('ArrowRight');
          }
          expect(questions).toBeGreaterThan(3);
        });
      }

      if (vp.id === 'V2' && input === 'touch') {
        test('More open covers the stage: a swipe and an option tap there do nothing, a tap there closes it', async ({ page }) => {
          await open(page, vp, input);
          const presses = await familyPresses(page);
          await goToFamily(page, presses, 'grid');
          // The floating bar is shown first; the rail is always there.
          if (layout === 'overlay') {
            await tapAt(page, input, await emptyPoint(page));
            await overlayBar(page, true);
          }
          await page.getByTestId('presenter-more').tap();
          await expect(page.getByTestId('presenter-more-sheet')).toBeVisible();
          const before = { counter: await counter(page), live: await live(page) };
          const option = (await targets(page))[0]!;
          // The option's top-left part, above the sheet: the stage is what the finger lands on.
          const exposed = { x: option.left + 20, y: option.top + 8 };
          const landsOnStage = await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.closest('[data-testid="presenter-stage"]') !== null, exposed);
          expect(landsOnStage).toBe(true);
          if (!SWIPES_SKIPPED) {
            await swipeStage(page, exposed, { x: exposed.x + 150, y: exposed.y });
            await page.waitForTimeout(150);
            await expect(page.getByTestId('presenter-more-sheet')).toBeVisible();
            expect({ counter: await counter(page), live: await live(page) }).toEqual(before);
          }
          await shot(page, `presenter-nav-${vp.id}-more`);
          await page.touchscreen.tap(exposed.x, exposed.y);
          await expect(page.getByTestId('presenter-more-sheet')).toHaveCount(0);
          expect({ counter: await counter(page), live: await live(page) }).toEqual(before);
          if (layout === 'rail') {
            // Beside the rail (PN-3's rule for an open sheet, section 5.1 as built): the rail's Next stays enabled,
            // and a press closes the sheet and then steps once.
            await page.getByTestId('presenter-more').tap();
            await expect(page.getByTestId('presenter-more-sheet')).toBeVisible();
            await pairShown(page, 'More open', ['presenter-more', 'presenter-next', 'presenter-back', 'presenter-sound']);
            const at = await state(page);
            await page.getByTestId('presenter-next').tap();
            await expect(page.getByTestId('presenter-more-sheet')).toHaveCount(0);
            await expect.poll(async () => { const now = await state(page); return now.counter !== at.counter || now.next !== at.next; }).toBe(true);
          }
        });
      }

      if (layout === 'rail') {
        test('a tap in the gap between a target and the rail presses nothing; the rail sits beside the stage, never over it', async ({ page }) => {
          await open(page, vp, input);
          const presses = await familyPresses(page);
          const rail = (await page.getByTestId('presenter-rail').boundingBox())!;
          const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
          expect(stage.x + stage.width).toBeLessThanOrEqual(rail.x + 0.5);
          const insets = vp.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
          expect(Math.round(rail.x + rail.width)).toBe(vp.width - insets.right);
          expect(Math.round(rail.width)).toBe(vp.rail === 'compact' ? 80 : 104);
          const firstButton = (await page.getByTestId('presenter-more').boundingBox())!;
          for (const family of ['grid', 'rows'] as const) {
            await goToFamily(page, presses, family);
            const boxes = await settledTargets(page);
            const rightmost = boxes.reduce((a, b) => (b.right > a.right ? b : a));
            expect(firstButton.x - rightmost.right, `${family}: the gap`).toBeGreaterThanOrEqual(NAV_CLEARANCE);
            const at = { x: (rightmost.right + firstButton.x) / 2, y: (rightmost.top + rightmost.bottom) / 2 };
            const before = await state(page);
            await tapAt(page, input, at);
            await page.waitForTimeout(150);
            expect(await state(page), `${family} gap at ${Math.round(at.x)},${Math.round(at.y)}`).toEqual(before);
          }
          // No button's hit area reaches into the rail's 12 px stage side: what is under a point there is the rail
          // itself. (A fingertip there is still moved onto the nearest rail button by the browser's own touch
          // adjustment, as beside any button; the 32 px on the stage side keeps a tap on a target off it.)
          const pair = (await page.getByTestId('presenter-next').boundingBox())!;
          for (const dx of [1, 6, 11]) {
            const hit = await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.getAttribute('data-testid') ?? null, { x: rail.x + dx, y: pair.y + pair.height / 2 });
            expect(hit, `rail gap at +${dx}`).toBe('presenter-rail');
          }
        });
      }

      if (layout === 'overlay') {
        test('after a step the bar is hidden: taps on options 3 and 4 change nothing; an empty tap shows the bar in full before the next tap', async ({ page }) => {
          await open(page, vp, input);
          const presses = await familyPresses(page);
          await goToFamily(page, presses, 'grid');
          await overlayBar(page, false);
          const before = await state(page);
          const boxes = await targets(page);
          for (const marker of ['option:3', 'option:4']) {
            const t = boxes.find((b) => b.marker === marker)!;
            await tapAt(page, input, { x: (t.left + t.right) / 2, y: (t.top + t.bottom) / 2 });
          }
          await page.waitForTimeout(150);
          expect(await state(page)).toEqual(before);
          await tapAt(page, input, await emptyPoint(page));
          // The bar the teacher brought up is fully drawn (and taking taps) before anything else is tapped.
          await overlayBar(page, true);
          await shot(page, `presenter-nav-${vp.id}-bar-on-question`);
        });
      }
    });
  }
}

/**
 * Row PN-3 (AMENDMENTS-PRESENTER-NAV sections 5.0, 5.1, 9.2, 9.3 and 14): the docked bar's order (O6:
 * Previous first, the tools Exit to Sound, Next last; O9: Previous beside Next on a touch window 1600 px
 * or wider), its wrap (1024 x 768 and upright 820 x 1180: the tools on a row above, Previous and Next at
 * the ends of the bottom row, the band two `BAR_BAND` rows and the stage shorter, nothing overlapping),
 * the 32 px clearance between the stage's content box and every band button, the start hint (on touch
 * only, on the first slide, until the first bar button or swipe step, kept across a reload through the
 * storage wrapper) and Help's Touch and mouse group. Screenshots with `HR_SHOTS=1`.
 */
const O6 = ['presenter-back', 'presenter-exit', 'presenter-fullscreen', 'presenter-grid-button', 'presenter-blank-button', 'presenter-timer', 'presenter-sound', 'presenter-next'];
const O9 = ['presenter-exit', 'presenter-fullscreen', 'presenter-grid-button', 'presenter-blank-button', 'presenter-timer', 'presenter-sound', 'presenter-back', 'presenter-next'];
const HINT = { docked: 'Swipe, or tap Previous and Next.', rail: 'Swipe, or tap Previous and Next.', overlay: 'Swipe to move. Tap the slide to show the controls.' };

/** The docked band's buttons in DOM (focus) order, each with its box. */
function bandButtons(page: Page): Promise<{ id: string; left: number; top: number; right: number; bottom: number }[]> {
  return page.getByTestId('presenter-bar-band').evaluate((band) =>
    Array.from(band.querySelectorAll('[role="button"]')).map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.getAttribute('data-testid') ?? '', left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }),
  );
}

/** The stage's content box: the stage less its padding, where every slide draws. */
async function contentBox(page: Page): Promise<{ left: number; top: number; right: number; bottom: number }> {
  return page.getByTestId('presenter-stage').evaluate((stage) => {
    const r = stage.getBoundingClientRect();
    const s = getComputedStyle(stage);
    return { left: r.left + parseFloat(s.paddingLeft), top: r.top + parseFloat(s.paddingTop), right: r.right - parseFloat(s.paddingRight), bottom: r.bottom - parseFloat(s.paddingBottom) };
  });
}

/** Every text the slide draws (the aria-hidden counter aside) and every content target: the hint may cover none. */
function slideBoxes(page: Page): Promise<{ what: string; left: number; top: number; right: number; bottom: number }[]> {
  return page.getByTestId('presenter-stage').evaluate((stage) =>
    Array.from(stage.querySelectorAll('*'))
      .filter((el) => el.getAttribute('data-testid') !== 'presenter-counter' && el.getAttribute('data-testid') !== 'presenter-live')
      .filter((el) => el.hasAttribute('data-stage-target') || (el.childElementCount === 0 && (el.textContent ?? '').trim() !== ''))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { what: el.getAttribute('data-stage-target') ?? (el.textContent ?? '').trim().slice(0, 24), left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      })
      .filter((b) => b.right - b.left > 0 && b.bottom - b.top > 0),
  );
}

/** `lecture:navHint` as the web storage wrapper keeps it (idb-keyval's store, the `hr:` prefix); null when unset. */
function storedNavHint(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('keyval')) return resolve(null);
          const get = db.transaction('keyval', 'readonly').objectStore('keyval').get('hr:lecture:navHint');
          get.onsuccess = () => resolve((get.result as string | undefined) ?? null);
          get.onerror = () => resolve(null);
        };
      }),
  );
}

const overlaps = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

for (const vp of MATRIX) {
  for (const input of vp.inputs) {
    const layout = layoutOf(vp);
    const wide = layout === 'docked' && input === 'touch' && vp.width >= 1600;
    const wraps = layout === 'docked' && vp.width < 1100;
    test.describe(`PN-3 ${vp.id} ${vp.width} x ${vp.height}${vp.insets ? ' with notch insets' : ''}, ${input} (${layout}${wide ? ', O9' : ''})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.phone, hasTouch: input === 'touch' });

      test('order and wrap, the clearance, the start hint and Help', async ({ page }) => {
        test.setTimeout(90_000);
        await open(page, vp, input);
        if (layout === 'docked') {
          const buttons = await bandButtons(page);
          const ids = buttons.map((b) => b.id);
          expect(ids).toEqual(wide ? O9 : O6);
          const row = page.getByTestId('presenter-bar-docked');
          await expect(row).toHaveAttribute('data-rows', wraps ? '2' : '1');
          await expect(row).toHaveAttribute('data-order', wide ? 'o9' : 'o6');
          const box = (id: string) => buttons.find((b) => b.id === id)!;
          const prev = box('presenter-back');
          const next = box('presenter-next');
          // Previous and Next on one (the bottom) row; Next at its end, Previous at its start (O6) or just before Next (O9).
          expect(Math.abs(prev.top - next.top)).toBeLessThan(1);
          for (const b of buttons) expect(next.right, b.id).toBeGreaterThanOrEqual(b.right - 0.5);
          if (wide) expect(next.left - prev.right).toBeLessThanOrEqual(16.5);
          else for (const b of buttons) expect(prev.left, b.id).toBeLessThanOrEqual(b.left + 0.5);
          // The stage re-lays out for the band's height (a wrapped band is two rows): wait for it to settle above the band.
          await expect
            .poll(async () => {
              const s = (await page.getByTestId('presenter-stage').boundingBox())!;
              const b = (await page.getByTestId('presenter-bar-band').boundingBox())!;
              return s.y + s.height - b.y;
            })
            .toBeLessThanOrEqual(0.5);
          const band = (await page.getByTestId('presenter-bar-band').boundingBox())!;
          const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
          if (wraps) {
            // The tools take the row above; the band is two rows and the stage sits above it.
            for (const id of ['presenter-exit', 'presenter-sound']) expect(box(id).bottom, id).toBeLessThanOrEqual(prev.top);
            expect(Math.round(band.height)).toBe(240);
          } else {
            for (const b of buttons) expect(Math.abs(b.top - prev.top), b.id).toBeLessThan(1);
            expect(Math.round(band.height)).toBe(120);
          }
          // Nothing overlaps the stage; every band button is at least 32 px from the stage's content box.
          expect(stage.y + stage.height).toBeLessThanOrEqual(band.y + 0.5);
          const content = await contentBox(page);
          for (const b of buttons) expect(gap(content, b), b.id).toBeGreaterThanOrEqual(NAV_CLEARANCE);
          // Buttons keep their size: 96 px, Next at least 144 wide and the primary fill.
          for (const b of buttons) expect(Math.round(b.bottom - b.top), b.id).toBeGreaterThanOrEqual(96);
          expect(next.right - next.left).toBeGreaterThanOrEqual(144);
        }

        // The start hint: on touch only, at the top of the first slide, over nothing the slide draws.
        const hint = page.getByTestId('presenter-nav-hint');
        if (input === 'mouse') {
          await page.waitForTimeout(500);
          await expect(hint).toHaveCount(0);
          expect(await storedNavHint(page)).toBeNull();
        } else {
          await expect(hint).toBeVisible();
          await expect(hint).toHaveText(HINT[layout]);
          await expect(hint).toHaveCSS('pointer-events', 'none');
          const pill = (await hint.boundingBox())!;
          const pillBox = { left: pill.x, top: pill.y, right: pill.x + pill.width, bottom: pill.y + pill.height };
          for (const b of await slideBoxes(page)) expect(overlaps(pillBox, b), `the hint covers "${b.what}"`).toBe(false);
          // This lesson is counted (one of at most three).
          await expect.poll(() => storedNavHint(page)).toBe('"1"');
        }
        await shot(page, `presenter-nav-pn3-${vp.id}-${input}`);

        // Help: the Touch and mouse group above the key rows.
        await page.keyboard.press('h');
        await expect(page.getByTestId('presenter-help')).toBeVisible();
        const group = page.getByTestId('presenter-help-touch');
        await expect(group).toBeVisible();
        await expect(group.getByRole('heading')).toHaveText('Touch and mouse');
        for (const row of ['swipe', 'buttons', 'click', 'keep']) await expect(page.getByTestId(`presenter-help-touch-${row}`)).toBeVisible();
        const groupBox = (await group.boundingBox())!;
        const firstRow = (await page.getByTestId('presenter-help').getByRole('listitem').first().boundingBox())!;
        expect(groupBox.y + groupBox.height).toBeLessThanOrEqual(firstRow.y + 0.5);
        await shot(page, `presenter-nav-pn3-${vp.id}-${input}-help`);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('presenter-help')).toHaveCount(0);

        if (input === 'touch') {
          // A key step is no button or swipe step: the hint stays for its 6 s on the first slide only, so go back.
          // The first bar or rail button (docked, rail) or swipe (overlay) step ends it, and a reload keeps it off.
          if (layout !== 'overlay') await page.getByTestId('presenter-next').tap();
          else {
            test.skip(SWIPES_SKIPPED, 'swipes drive CDP touch events (Chromium only)');
            const c = await stageCentre(page);
            await swipeStage(page, c, { x: c.x - 120, y: c.y });
          }
          await expect.poll(() => counter(page)).toMatch(/^2 \//);
          await expect(hint).toHaveCount(0);
          // Written through the storage wrapper (IndexedDB), never localStorage.
          await expect.poll(() => storedNavHint(page)).toBe('"done"');
          expect(await page.evaluate(() => localStorage.getItem('hr:lecture:navHint'))).toBeNull();
          // A reload resumes this lesson from Recent on slide 2, where no hint shows anyway; so a fresh lesson
          // (a deck Recent has never seen, which opens on its title slide) proves 'done' keeps the hint off for good.
          // A full load of the new link (from about:blank): a goto that changes only the hash of the page a
          // reload is still loading raced it and could keep the old lesson.
          await page.goto('about:blank');
          await page.goto(link({ ...DECK, id: 'lecture:e2enav2' }));
          const start = page.getByTestId('presenter-start-button');
          await expect(start).toBeEnabled({ timeout: 10_000 });
          await start.tap();
          await expect(page.getByTestId('presenter-stage')).toBeVisible();
          await expect.poll(() => counter(page)).toMatch(/^1 \//);
          await page.waitForTimeout(800);
          await expect(hint).toHaveCount(0);
          expect(await storedNavHint(page)).toBe('"done"');
        }
      });
    });
  }
}

test.describe('PN-3: Spanish at 768 x 1024 (touch) takes the docked More fallback', () => {
  test.use({ viewport: { width: 768, height: 1024 }, isMobile: false, hasTouch: true, locale: 'es-ES' });

  test('Previous, More and Next on the bottom row; More holds Slides, Timer and Blank', async ({ page }) => {
    await open(page, { id: 'V3-es', width: 768, height: 1024, phone: false, inputs: ['touch'] }, 'touch');
    const row = page.getByTestId('presenter-bar-docked');
    await expect(row).toHaveAttribute('data-rows', '2');
    await expect(row).toHaveAttribute('data-more', 'true');
    const buttons = await bandButtons(page);
    expect(buttons.map((b) => b.id)).toEqual(['presenter-back', 'presenter-exit', 'presenter-fullscreen', 'presenter-sound', 'presenter-more', 'presenter-next']);
    const box = (id: string) => buttons.find((b) => b.id === id)!;
    for (const id of ['presenter-more', 'presenter-next']) expect(Math.abs(box(id).top - box('presenter-back').top), id).toBeLessThan(1);
    expect(box('presenter-sound').bottom).toBeLessThanOrEqual(box('presenter-back').top);
    // No tool label breaks inside a word or leaves its button.
    for (const b of buttons) expect(b.right, b.id).toBeLessThanOrEqual(768);
    await expect(page.getByTestId('presenter-nav-hint')).toHaveText('Desliza o toca Anterior y Siguiente.');
    await shot(page, 'presenter-nav-pn3-768x1024-touch-es');
    await page.getByTestId('presenter-more').tap();
    const sheet = page.getByTestId('presenter-more-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button')).toHaveText(['Cerrar', 'Diapositivas', 'Temporizador', 'En blanco']);
    // The sheet sits over the stage, above the band.
    const band = (await page.getByTestId('presenter-bar-band').boundingBox())!;
    const sheetBox = (await sheet.boundingBox())!;
    expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(band.y + 0.5);
    await shot(page, 'presenter-nav-pn3-768x1024-touch-es-more');
    // While it is open it covers the stage (section 5.2): a swipe there steps nothing, a tap there closes it.
    const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
    const exposed = { x: stage.x + stage.width / 2, y: stage.y + 60 };
    const at = await counter(page);
    if (!SWIPES_SKIPPED) {
      await swipeStage(page, exposed, { x: exposed.x - 150, y: exposed.y });
      await page.waitForTimeout(150);
      expect(await counter(page)).toBe(at);
      await expect(sheet).toBeVisible();
    }
    await page.touchscreen.tap(exposed.x, exposed.y);
    await expect(sheet).toHaveCount(0);
    expect(await counter(page)).toBe(at);
    // The pinned Next stays beside the sheet, opaque and enabled: a tap on it closes the sheet and steps.
    await page.getByTestId('presenter-more').tap();
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('presenter-next')).not.toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('presenter-next').tap();
    await expect(sheet).toHaveCount(0);
    await expect.poll(() => counter(page)).not.toBe(at);
    // A step key (an arrow, a clicker) does the same: the sheet closes and the lesson steps back.
    const stepped = await counter(page);
    await page.getByTestId('presenter-more').tap();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(sheet).toHaveCount(0);
    await expect.poll(() => counter(page)).not.toBe(stepped);
    // A tool key closes the sheet first and opens its tool (never under the sheet).
    await page.getByTestId('presenter-more').tap();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('b');
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId('presenter-blank')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('presenter-blank')).toHaveCount(0);
    await page.getByTestId('presenter-more').tap();
    await expect(sheet).toBeVisible();
    await page.getByTestId('presenter-timer').tap();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId('presenter-timer-corner').or(page.getByTestId('presenter-timer-full'))).toBeVisible();
  });
});

/** The spec's other wrap windows (section 5.1): 1080 x 810 and 1133 x 744, by touch, in English. */
for (const vp of [
  { id: 'V3-1080', width: 1080, height: 810 },
  { id: 'V3-1133', width: 1133, height: 744 },
] as const) {
  test.describe(`PN-3 ${vp.id} ${vp.width} x ${vp.height}, touch (docked, wrapped)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, isMobile: false, hasTouch: true });

    test('the band wraps: tools above, Previous and Next at the bottom row ends, the clearance kept', async ({ page }) => {
      await open(page, { id: vp.id, width: vp.width, height: vp.height, phone: false, inputs: ['touch'] }, 'touch');
      const row = page.getByTestId('presenter-bar-docked');
      await expect(row).toHaveAttribute('data-rows', '2');
      await expect(row).toHaveAttribute('data-more', 'false');
      const buttons = await bandButtons(page);
      expect(buttons.map((b) => b.id)).toEqual(O6);
      const box = (id: string) => buttons.find((b) => b.id === id)!;
      const prev = box('presenter-back');
      const next = box('presenter-next');
      expect(Math.abs(prev.top - next.top)).toBeLessThan(1);
      for (const b of buttons) {
        expect(prev.left, b.id).toBeLessThanOrEqual(b.left + 0.5);
        expect(next.right, b.id).toBeGreaterThanOrEqual(b.right - 0.5);
        expect(b.right, b.id).toBeLessThanOrEqual(vp.width);
      }
      for (const id of ['presenter-exit', 'presenter-sound']) expect(box(id).bottom, id).toBeLessThanOrEqual(prev.top);
      const band = (await page.getByTestId('presenter-bar-band').boundingBox())!;
      const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
      expect(Math.round(band.height)).toBe(240);
      expect(stage.y + stage.height).toBeLessThanOrEqual(band.y + 0.5);
      const content = await contentBox(page);
      for (const b of buttons) expect(gap(content, b), b.id).toBeGreaterThanOrEqual(NAV_CLEARANCE);
      await shot(page, `presenter-nav-pn3-${vp.id}-touch`);
    });
  });
}

/**
 * Row PN-4 (AMENDMENTS-PRESENTER-NAV sections 5.0, 5.2, 11 and 14; owner choices O1 a, O3 a and O10 a,
 * decided 2026-10-29; mocks stage-and-bar.md "Navigation (PN-0b)", "Phone rail"): the rail's place and
 * size at each window of the section 5.2 table (the stage box is the window less the four insets and
 * the rail; the rail sits inside the right inset, full height between the top and bottom insets), its
 * order and role, the pair centred in its height, the button sizes, the compact rail's accessible
 * names, no label overflowing its button or breaking inside a word in en, es and ko at 18 px (the real
 * text, measured in the browser), and the label fallback at a larger text size (the full rail turns
 * compact, More shows the `more` glyph). With the rail switched off the same windows draw the overlay.
 */
interface RailCase {
  width: number;
  height: number;
  insets?: { top: number; right: number; bottom: number; left: number };
  rail: 'full' | 'compact' | null;
  box: { width: number; height: number };
}

const RAIL_TABLE: readonly RailCase[] = [
  { width: 568, height: 320, rail: null, box: { width: 568, height: 320 } },
  { width: 640, height: 360, rail: 'compact', box: { width: 560, height: 360 } },
  { width: 667, height: 375, rail: 'full', box: { width: 563, height: 375 } },
  { width: 780, height: 360, rail: 'full', box: { width: 676, height: 360 } },
  { width: 844, height: 390, rail: 'full', box: { width: 740, height: 390 } },
  { width: 844, height: 390, insets: { top: 0, right: 47, bottom: 21, left: 47 }, rail: 'full', box: { width: 646, height: 369 } },
  { width: 932, height: 430, insets: { top: 0, right: 59, bottom: 21, left: 59 }, rail: 'full', box: { width: 710, height: 409 } },
];

/** Every rail button and its label: the box, whether the label leaves the button, and the most lines a label takes. */
function railButtons(page: Page): Promise<{ id: string; name: string; left: number; top: number; right: number; bottom: number; text: string; overflow: boolean; lines: number; wordBroken: boolean }[]> {
  return page.getByTestId('presenter-rail').evaluate((rail) =>
    Array.from(rail.querySelectorAll('[role="button"]')).map((el) => {
      const r = el.getBoundingClientRect();
      const label = Array.from(el.querySelectorAll('[dir="auto"]'))[0] as HTMLElement | undefined;
      let lines = 0;
      let wordBroken = false;
      let overflow = el.scrollWidth > el.clientWidth + 0.5;
      if (label) {
        const range = document.createRange();
        range.selectNodeContents(label);
        const rects = Array.from(range.getClientRects());
        lines = new Set(rects.map((x) => Math.round(x.top))).size;
        for (const x of rects) if (x.left < r.left - 0.5 || x.right > r.right + 0.5) overflow = true;
        // A word broken across two lines: some word's own rects sit on two lines.
        const text = label.textContent ?? '';
        let at = 0;
        for (const word of text.split(/\s+/).filter(Boolean)) {
          const start = text.indexOf(word, at);
          at = start + word.length;
          const node = label.firstChild;
          if (!node) continue;
          const wr = document.createRange();
          wr.setStart(node, start);
          wr.setEnd(node, start + word.length);
          if (new Set(Array.from(wr.getClientRects()).map((x) => Math.round(x.top))).size > 1) wordBroken = true;
        }
      }
      return {
        id: el.getAttribute('data-testid') ?? '',
        name: el.getAttribute('aria-label') ?? '',
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        text: label?.textContent ?? '',
        overflow,
        lines,
        wordBroken,
      };
    }),
  );
}

async function openPhone(page: Page, c: { width: number; height: number; insets?: RailCase['insets'] }): Promise<void> {
  await open(page, { id: 'rail', width: c.width, height: c.height, phone: true, inputs: ['touch'], ...(c.insets ? { insets: c.insets } : {}) }, 'touch');
}

for (const c of RAIL_TABLE) {
  const label = `${c.width} x ${c.height}${c.insets ? ` with insets ${c.insets.left} / ${c.insets.right} / ${c.insets.bottom}` : ''}`;
  const rail = RAIL_OFF ? null : c.rail;
  test.describe(`PN-4 ${label}, touch: ${rail === null ? 'the overlay layout' : `the ${rail} rail`}`, () => {
    test.use({ viewport: { width: c.width, height: c.height }, isMobile: true, hasTouch: true });

    test('place, size, order, role and the stage box (section 5.2 table)', async ({ page }) => {
      await openPhone(page, c);
      const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
      if (rail === null) {
        await expect(page.getByTestId('presenter-rail')).toHaveCount(0);
        await expect(page.getByTestId('presenter-bar-compact')).toHaveCount(1);
        await expect(page.getByTestId('presenter-grabber')).toHaveCount(0);
        const insets = c.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
        const box = RAIL_OFF ? { width: c.width - insets.left - insets.right, height: c.height - insets.top - insets.bottom } : c.box;
        expect(Math.max(stage.width / box.width, stage.height / box.height)).toBeGreaterThan(0.99);
        await shot(page, `presenter-nav-pn4-${c.width}x${c.height}${c.insets ? '-notch' : ''}-${RAIL_OFF ? 'railoff' : 'overlay'}`);
        return;
      }
      const insets = c.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
      const r = (await page.getByTestId('presenter-rail').boundingBox())!;
      // A column at the right, inside the right inset, full height between the top and bottom insets.
      expect(Math.round(r.width)).toBe(rail === 'full' ? 104 : 80);
      expect(Math.round(r.x + r.width)).toBe(c.width - insets.right);
      expect(Math.round(r.y)).toBe(insets.top);
      expect(Math.round(r.y + r.height)).toBe(c.height - insets.bottom);
      // The stage box is the window less the four insets and the rail; the stage fills it in one direction.
      expect(Math.max(stage.width / c.box.width, stage.height / c.box.height)).toBeGreaterThan(0.99);
      expect(stage.x).toBeGreaterThanOrEqual(insets.left - 0.5);
      expect(stage.x + stage.width).toBeLessThanOrEqual(r.x + 0.5);
      // Order, role, the pair centred.
      const toolbar = page.getByTestId('presenter-rail-toolbar');
      await expect(toolbar).toHaveAttribute('role', 'toolbar');
      await expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
      await expect(toolbar).toHaveAttribute('aria-label', 'Lesson controls');
      const buttons = await railButtons(page);
      expect(buttons.map((b) => b.id)).toEqual(['presenter-more', 'presenter-next', 'presenter-back', 'presenter-sound']);
      for (let i = 1; i < buttons.length; i++) expect(buttons[i]!.top, buttons[i]!.id).toBeGreaterThanOrEqual(buttons[i - 1]!.bottom);
      const next = buttons[1]!;
      const prev = buttons[2]!;
      const pairMid = (next.top + prev.bottom) / 2;
      expect(Math.abs(pairMid - (r.y + r.height / 2))).toBeLessThan(1.5);
      // Sizes: full 88 wide, at least 64 tall, Next 96 tall on the primary fill; compact 64 squares.
      for (const b of buttons) {
        const w = b.right - b.left;
        const h = b.bottom - b.top;
        if (rail === 'full') {
          expect(Math.round(w), b.id).toBe(88);
          expect(h, b.id).toBeGreaterThanOrEqual(b.id === 'presenter-next' ? 96 : 64);
        } else {
          expect(Math.round(w), b.id).toBe(64);
          expect(Math.round(h), b.id).toBe(64);
        }
        // The inert gap: 12 px between the rail's stage side and every button.
        expect(b.left - r.x, b.id).toBeGreaterThanOrEqual(12 - 0.5);
        expect(b.overflow, `${b.id} overflows`).toBe(false);
      }
      // The rail clips nothing (only its probe clips itself), so a focused button's ring stays whole.
      expect(await page.getByTestId('presenter-rail').evaluate((el) => getComputedStyle(el).overflow)).toBe('visible');
      // Next is the primary fill (brand.primaryDark), the others paper.
      const fills = await page.evaluate(() => ['presenter-next', 'presenter-back'].map((id) => getComputedStyle(document.querySelector(`[data-testid="${id}"]`)!).backgroundColor));
      expect(fills[0]).not.toBe(fills[1]);
      if (rail === 'compact') {
        // Icon only, named by their labels; More keeps its word.
        expect(buttons.map((b) => b.name)).toEqual(['More', 'Next', 'Previous', 'Sound']);
        expect(buttons.slice(1).map((b) => b.text)).toEqual(['', '', '']);
        expect(buttons[0]!.text).toBe('More');
      } else {
        expect(buttons.map((b) => b.text)).toEqual(['More', 'Next', 'Previous', 'Sound']);
      }
      // The clearance on the first slide: the stage's content box is at least 32 px from every rail button.
      const content = await contentBox(page);
      for (const b of buttons) expect(gap(content, b), b.id).toBeGreaterThanOrEqual(NAV_CLEARANCE);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await shot(page, `presenter-nav-pn4-${c.width}x${c.height}${c.insets ? '-notch' : ''}-${rail}`);
    });
  });
}

/** The shipped `bar.reveal.cta` in each locale (packages/i18n). */
const REVEAL: Record<'en-US' | 'es-ES' | 'ko-KR', string> = { 'en-US': 'Reveal', 'es-ES': 'Mostrar', 'ko-KR': '다음 보기' };

/**
 * Short windows (a landscape phone with its browser bars showing; review of #892): the gate checks the
 * rail's height as well as its width, so its four buttons never overlap. 780 x 280 and 640 x 280 are
 * too short for even the compact rail (296 px) and take the overlay; 844 x 330 and 667 x 328 hold the
 * full rail with Next at its label height (316 px), not 96.
 */
const SHORT_TABLE: readonly { width: number; height: number; rail: 'full' | 'compact' | null }[] = [
  { width: 780, height: 280, rail: null },
  { width: 640, height: 280, rail: null },
  { width: 844, height: 300, rail: 'compact' },
  { width: 844, height: 330, rail: 'full' },
  { width: 667, height: 328, rail: 'full' },
];

for (const c of SHORT_TABLE) {
  const rail = RAIL_OFF ? null : c.rail;
  test.describe(`PN-4 short window ${c.width} x ${c.height}, touch: ${rail === null ? 'the overlay layout' : `the ${rail} rail`}`, () => {
    test.use({ viewport: { width: c.width, height: c.height }, isMobile: true, hasTouch: true });

    test('no two rail buttons meet: each gap at least spacing.sm, every button inside the rail', async ({ page }) => {
      await openPhone(page, c);
      if (rail === null) {
        await expect(page.getByTestId('presenter-rail')).toHaveCount(0);
        await expect(page.getByTestId('presenter-bar-compact')).toHaveCount(1);
        await shot(page, `presenter-nav-pn4-short-${c.width}x${c.height}-overlay`);
        return;
      }
      // The rail settles once it has measured its labels as drawn.
      await expect.poll(async () => Math.round((await page.getByTestId('presenter-rail').boundingBox())?.width ?? 0)).toBe(rail === 'full' ? 104 : 80);
      const r = (await page.getByTestId('presenter-rail').boundingBox())!;
      const buttons = await railButtons(page);
      expect(buttons.map((b) => b.id)).toEqual(['presenter-more', 'presenter-next', 'presenter-back', 'presenter-sound']);
      for (let i = 1; i < buttons.length; i++) expect(buttons[i]!.top - buttons[i - 1]!.bottom, `${buttons[i - 1]!.id} to ${buttons[i]!.id}`).toBeGreaterThanOrEqual(8 - 0.5);
      for (const b of buttons) {
        expect(b.top, b.id).toBeGreaterThanOrEqual(r.y - 0.5);
        expect(b.bottom, b.id).toBeLessThanOrEqual(r.y + r.height + 0.5);
        expect(b.bottom - b.top, b.id).toBeGreaterThanOrEqual(64 - 0.5);
        expect(b.overflow, b.id).toBe(false);
      }
      // A tap at the top edge of Previous presses Previous (Sound does not lie over it).
      const prev = buttons[2]!;
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('[role="button"]')?.getAttribute('data-testid') ?? null, [(prev.left + prev.right) / 2, prev.top + 2]);
      expect(hit).toBe('presenter-back');
      await shot(page, `presenter-nav-pn4-short-${c.width}x${c.height}-${rail}`);
    });
  });
}

for (const locale of ['en-US', 'es-ES', 'ko-KR'] as const) {
  for (const size of [{ width: 844, height: 390, rail: 'full' as const }, { width: 640, height: 360, rail: 'compact' as const }]) {
    test.describe(`PN-4 rail labels, ${locale}, ${size.width} x ${size.height} (${size.rail})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true, locale });
      test.skip(RAIL_OFF, 'the rail is switched off in this build');

      test('no label leaves its button or breaks inside a word at 18 px; the rail keeps its size (no fallback)', async ({ page }) => {
        await openPhone(page, size);
        const r = (await page.getByTestId('presenter-rail').boundingBox())!;
        expect(Math.round(r.width)).toBe(size.rail === 'full' ? 104 : 80);
        const buttons = await railButtons(page);
        for (const b of buttons) {
          expect(b.overflow, `${b.id} "${b.text}" overflows`).toBe(false);
          expect(b.wordBroken, `${b.id} "${b.text}" breaks a word`).toBe(false);
          expect(b.lines, `${b.id} "${b.text}" lines`).toBeLessThanOrEqual(2);
        }
        // Reveal (the slide's next build) fits too: step until Next reads the locale's Reveal, then measure it drawn.
        const next = page.getByTestId('presenter-next');
        for (let i = 0; i < 12 && (await next.getAttribute('aria-label')) !== REVEAL[locale]; i++) await page.keyboard.press('ArrowRight');
        await expect(next).toHaveAttribute('aria-label', REVEAL[locale]);
        const revealed = (await railButtons(page)).find((b) => b.id === 'presenter-next')!;
        if (size.rail === 'full') expect(revealed.text).toBe(REVEAL[locale]);
        for (const b of await railButtons(page)) {
          expect(b.overflow, `${b.id} "${b.text}" overflows`).toBe(false);
          expect(b.wordBroken, `${b.id} "${b.text}" breaks a word`).toBe(false);
        }
        // The labels are drawn at the body floor, 18 px (the compact rail draws More's only).
        const labelled = size.rail === 'full' ? 'presenter-back' : 'presenter-more';
        const fontSize = await page.getByTestId(labelled).evaluate((el) => {
          const label = el.querySelector('[dir="auto"]');
          return label ? getComputedStyle(label).fontSize : null;
        });
        expect(fontSize).toBe('18px');
        await shot(page, `presenter-nav-pn4-labels-${locale}-${size.width}x${size.height}`);
      });
    });
  }
}

test.describe('PN-4 the rail label fallback at the largest text size, 844 x 390', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  test.skip(RAIL_OFF, 'the rail is switched off in this build');

  test('a word wider than its button turns the full rail compact, and More into the three dots, named More', async ({ page }) => {
    // The device's text size, set before the presenter opens (it reads `device:settings`, as audio-engine.spec.ts (d) does).
    await page.goto('/');
    await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-30T09:00:00.000Z', textSize: 'largest' });
    await openPhone(page, { width: 844, height: 390 });
    // The rail draws what the gate gives, then measures its words on the real text: the fallback follows in a frame or two.
    await expect.poll(async () => Math.round((await page.getByTestId('presenter-rail').boundingBox())?.width ?? 0)).toBe(80);
    const more = page.getByTestId('presenter-more');
    await expect(more).toHaveAttribute('data-glyph', 'more');
    await expect(more).toHaveAccessibleName('More');
    for (const b of await railButtons(page)) {
      expect(b.overflow, b.id).toBe(false);
      expect(b.text, b.id).toBe('');
    }
    // The stage takes the room the compact rail leaves: 844 - 80.
    await expect.poll(async () => { const stage = (await page.getByTestId('presenter-stage').boundingBox())!; return Math.max(stage.width / 764, stage.height / 390); }).toBeGreaterThan(0.99);
    await shot(page, 'presenter-nav-pn4-844x390-largest');
  });
});
