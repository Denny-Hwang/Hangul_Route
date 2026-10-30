import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { swipeStage, type WindowPoint } from './helpers';
import { shot } from './shots';

/**
 * AMENDMENTS-PRESENTER-NAV section 14, row PN-2 (owner report 2026-10-29: "when I tap answer 1 or
 * answer 3 it often goes back or forward instead"): no hidden tap zones on the lecture stage. On
 * each layout family (title, 2 x 2 option grid, full-width option rows, order steps, sentence
 * tiles, write-together chips) and at every window of the matrix (V1 568 x 320, V2c 640 x 360 and
 * V2 844 x 390 with and without notch insets, all touch and the overlay layout before PN-4; V3
 * 1180 x 820, 1024 x 768 and upright 820 x 1180 and V4 1920 x 1080, docked, by touch and by mouse):
 * every content target tapped at its centre, on its Korean, 20 px in from its left edge and 8 px
 * inside its right and bottom edges steps nothing and presses no control; every content target box
 * is at least 32 px from every visible control box on docked windows; a touch tap on empty stage
 * rings Next (docked) or shows and hides the bar (overlay); a mouse click on empty stage goes on on
 * a target-free slide and does nothing on a slide with targets; a swipe from the centre and from an
 * option steps once, a vertical drag, a diagonal at 1.2, a two-finger swipe (either lift order) and
 * a swipe from 10 px of either window edge do nothing; on docked touch, Previous and Next are shown
 * and take taps at the start, after 5 s idle, after a step and on every question slide; on the
 * overlay layout, More open blocks a swipe and an option tap, and a tap closes it. Swipes drive CDP
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

interface Viewport {
  id: string;
  width: number;
  height: number;
  phone: boolean;
  inputs: readonly Input[];
  insets?: { top: number; right: number; bottom: number; left: number };
}

const MATRIX: readonly Viewport[] = [
  { id: 'V1', width: 568, height: 320, phone: true, inputs: ['touch'] },
  { id: 'V2c', width: 640, height: 360, phone: true, inputs: ['touch'] },
  { id: 'V2', width: 844, height: 390, phone: true, inputs: ['touch'] },
  { id: 'V2-notch', width: 844, height: 390, phone: true, inputs: ['touch'], insets: { top: 0, right: 47, bottom: 21, left: 47 } },
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
    const bars = Array.from(document.querySelectorAll('[data-testid="presenter-bar-band"], [data-testid="presenter-bar-compact"]'));
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

/** Previous and Next are drawn in full and take taps. */
async function pairShown(page: Page, label: string): Promise<void> {
  for (const id of ['presenter-back', 'presenter-next']) {
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
    const layout = vp.phone ? 'overlay' : 'docked';
    test.describe(`${vp.id} ${vp.width} x ${vp.height}${vp.insets ? ' with notch insets' : ''}, ${input} (${layout})`, () => {
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
          if (layout === 'docked') {
            // Section 5.0: at least 32 window px between every target and every visible control.
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
        } else if (layout === 'docked') {
          // The ring: a static outline on Next, for NUDGE_MS, and no step.
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

      if (input === 'touch' && layout === 'docked') {
        test('Previous and Next are shown and take taps at the start, after 5 s idle, after a step and on every question slide', async ({ page }) => {
          test.setTimeout(120_000);
          await open(page, vp, input);
          await pairShown(page, 'start');
          await page.waitForTimeout(5000);
          await pairShown(page, 'after 5 s idle');
          // The tools fade; the pair does not.
          await expect(page.getByTestId('presenter-sound')).toHaveCSS('pointer-events', 'none');
          await page.getByTestId('presenter-next').tap();
          await expect.poll(() => counter(page)).toMatch(/^2 \//);
          await pairShown(page, 'after a step');
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
              await expect(page.getByTestId('presenter-sound')).toHaveCSS('pointer-events', 'none', { timeout: 6000 });
              await pairShown(page, `question at ${n} / ${total}`);
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
          await tapAt(page, input, await emptyPoint(page));
          await overlayBar(page, true);
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
          await shot(page, 'presenter-nav-V2-more');
          await page.touchscreen.tap(exposed.x, exposed.y);
          await expect(page.getByTestId('presenter-more-sheet')).toHaveCount(0);
          expect({ counter: await counter(page), live: await live(page) }).toEqual(before);
        });
      }

      if (vp.id === 'V1') {
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
          await shot(page, 'presenter-nav-V1-bar-on-question');
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
const HINT = { docked: 'Swipe, or tap Previous and Next.', overlay: 'Swipe to move. Tap the slide to show the controls.' };

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
    const layout = vp.phone ? 'overlay' : 'docked';
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
          // The first bar button (docked) or swipe (overlay) step ends it, and a reload keeps it off.
          if (layout === 'docked') await page.getByTestId('presenter-next').tap();
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
          await page.reload();
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
