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
 *
 * Row PN-5 (section 7.3, owner choice O2): a tap or click on an option points at it. It sets
 * `data-pointed="true"` on that option only and changes nothing else (the counter, the build, the
 * bar, no control pressed); a second tap clears it; a step clears it; keys 1 to 4 do the same, with
 * focus on a bar button too; the live region names the pointed option; the dashed outline and the
 * pin stay inside the stage, and on docked windows the 32 px clearance still holds while an option
 * is pointed at. Screenshots with `HR_SHOTS=1`, plus a 1280 x 720 projector-style shot.
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
/** The markers of the options carrying `data-pointed="true"` (section 7.3). */
const pointedNow = (page: Page): Promise<string[]> =>
  page.getByTestId('presenter-stage').evaluate((stage) => Array.from(stage.querySelectorAll('[data-pointed="true"]')).map((el) => el.getAttribute('data-stage-target') ?? ''));
/** What the live region says for a pointed option, or for none (`a11y.presenter.pointed` / `unpointed`, en). */
const POINTED = (n: number): string => `Option ${n} pointed at`;
const UNPOINTED = 'No option pointed at';

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
          else {
            // A first pointer on empty stage (a ring on touch, nothing for a mouse on a target slide) lets the docked
            // band take its shown height, and wrap on a narrow window, before the boxes are measured and tapped.
            await tapAt(page, input, await emptyPoint(page));
            await page.waitForTimeout(600);
          }
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
          // Pointing (O2, row PN-5) changes only the option's `data-pointed` and the live region: each tap on
          // an option toggles it; a tap on any other target changes nothing at all.
          const still = ({ live: _live, ...rest }: Awaited<ReturnType<typeof state>>) => rest;
          for (const [i, t] of boxes.entries()) {
            const option = /^option:(\d)$/.exec(t.marker);
            for (const name of pointsOn(t).map((p) => p.name)) {
              // Read the target's box again before each tap, in case anything moved the stage since the last one.
              const point = pointsOn((await targets(page))[i]!).find((p) => p.name === name)!;
              const where = `${family} ${t.marker} ${point.name} at ${Math.round(point.at.x)},${Math.round(point.at.y)}`;
              if (option) {
                // A tap toggles the option: what it should show next is read from the page, not counted here.
                const pointed = (await pointedNow(page)).length === 0;
                await tapAt(page, input, point.at);
                await expect.poll(() => pointedNow(page), where).toEqual(pointed ? [t.marker] : []);
                await expect.poll(() => live(page), where).toBe(pointed ? POINTED(Number(option[1])) : UNPOINTED);
                expect(still(await state(page)), where).toEqual(still(before));
              } else {
                await tapAt(page, input, point.at);
                await page.waitForTimeout(60);
                expect(await state(page), where).toEqual(before);
                expect(await pointedNow(page), where).toEqual([]);
              }
            }
            // Leave nothing pointed for the next target.
            if ((await pointedNow(page)).length > 0) await tapAt(page, input, pointsOn((await targets(page))[i]!)[0]!.at);
            await expect.poll(() => pointedNow(page)).toEqual([]);
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
          // Key 1 points at nothing while More covers the stage (row PN-5).
          await page.keyboard.press('1');
          await page.touchscreen.tap(exposed.x, exposed.y);
          await expect(page.getByTestId('presenter-more-sheet')).toHaveCount(0);
          expect({ counter: await counter(page), live: await live(page) }).toEqual(before);
          expect(await pointedNow(page)).toEqual([]);
        });
      }

      if (vp.id === 'V1') {
        test('after a step the bar is hidden: taps on options 3 and 4 only point; an empty tap shows the bar in full before the next tap', async ({ page }) => {
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
          // No step, no reveal, the bar still hidden: option 4 is pointed at (row PN-5), nothing else changed.
          expect(await state(page)).toEqual({ ...before, live: POINTED(4) });
          expect(await pointedNow(page)).toEqual(['option:4']);
          await tapAt(page, input, await emptyPoint(page));
          // The bar the teacher brought up is fully drawn (and taking taps) before anything else is tapped.
          await overlayBar(page, true);
          await shot(page, 'presenter-nav-V1-bar-on-question');
        });
      }
    });
  }
}

// --- Row PN-5: pointing at an option (section 7.3, owner choice O2) ---------------------------------

/** The PN-5 matrix: V1, V2c, V2 (touch), V3 and V3-4x3 (touch and mouse), V4 (mouse and touch), and the 1280 x 720 projector (mouse). */
const POINT_MATRIX: readonly Viewport[] = [
  // V3-4x3 (1024 x 768) is the tightest docked window: its band wraps, so the clearance check runs there too.
  ...MATRIX.filter((vp) => ['V1', 'V2c', 'V2', 'V3', 'V3-4x3', 'V4'].includes(vp.id)),
  { id: 'P', width: 1280, height: 720, phone: false, inputs: ['mouse'] },
];

/** Where the pointed option's outline and pin reach (the target box grown by the outline's offset and width, and the pin's box). */
function pointedReach(page: Page): Promise<{ outline: { left: number; top: number; right: number; bottom: number }; pin: { left: number; top: number; right: number; bottom: number } | null; style: string; colour: string } | null> {
  return page.getByTestId('presenter-stage').evaluate((stage) => {
    const el = stage.querySelector('[data-pointed="true"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const grow = Number.parseFloat(cs.outlineOffset) + Number.parseFloat(cs.outlineWidth);
    const pin = el.querySelector('[data-testid="presenter-quiz-pin"]')?.getBoundingClientRect();
    return {
      outline: { left: r.left - grow, top: r.top - grow, right: r.right + grow, bottom: r.bottom + grow },
      pin: pin ? { left: pin.left, top: pin.top, right: pin.right, bottom: pin.bottom } : null,
      style: cs.outlineStyle,
      colour: cs.outlineColor,
    };
  });
}

for (const vp of POINT_MATRIX) {
  for (const input of vp.inputs) {
    const layout = vp.phone ? 'overlay' : 'docked';
    test.describe(`PN-5 pointing: ${vp.id} ${vp.width} x ${vp.height}, ${input} (${layout})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.phone, hasTouch: input === 'touch' });

      test('a tap or click on each option points at it and changes nothing else; a second clears it; a step clears it; outline inside the stage; clearance holds', async ({ page }) => {
        test.setTimeout(180_000);
        await open(page, vp, input);
        const presses = await familyPresses(page);
        for (const family of ['grid', 'rows'] as const) {
          await goToFamily(page, presses, family);
          if (layout === 'overlay') await overlayBar(page, false);
          else {
            // A first pointer on empty stage (a ring, or nothing on a question slide) lets the docked band take its
            // shown height before the boxes are measured; it may wrap on a narrow window and move the stage.
            await tapAt(page, input, await emptyPoint(page));
            await page.waitForTimeout(600);
          }
          const boxes = await settledTargets(page);
          const options = boxes.filter((b) => /^option:[1-4]$/.test(b.marker));
          expect(options.length, family).toBeGreaterThanOrEqual(3);
          const before = await state(page);
          const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
          for (const t of options) {
            const n = Number(t.marker.slice('option:'.length));
            const centre = { x: (t.left + t.right) / 2, y: (t.top + t.bottom) / 2 };
            await tapAt(page, input, centre);
            await expect.poll(() => pointedNow(page), `${family} ${t.marker}`).toEqual([t.marker]);
            // Nothing else: the counter, the build (Next still reads Reveal), no control pressed, the bar as it was, no answer mark.
            expect({ ...(await state(page)), live: '' }, `${family} ${t.marker}`).toEqual({ ...before, live: '' });
            expect(await page.getByTestId('presenter-quiz-mark').count(), `${family} ${t.marker}`).toBe(0);
            await expect.poll(() => live(page)).toBe(POINTED(n));
            // The target boxes do not move or grow (an outline takes no room).
            expect(await targets(page), `${family} ${t.marker}`).toEqual(boxes);
            const reach = (await pointedReach(page))!;
            expect(reach.style).toBe('dashed');
            // The outline and the pin stay inside the stage.
            for (const box of [reach.outline, ...(reach.pin ? [reach.pin] : [])]) {
              expect(box.left, `${family} ${t.marker} inside the stage`).toBeGreaterThanOrEqual(stage.x - 0.5);
              expect(box.top, `${family} ${t.marker} inside the stage`).toBeGreaterThanOrEqual(stage.y - 0.5);
              expect(box.right, `${family} ${t.marker} inside the stage`).toBeLessThanOrEqual(stage.x + stage.width + 0.5);
              expect(box.bottom, `${family} ${t.marker} inside the stage`).toBeLessThanOrEqual(stage.y + stage.height + 0.5);
            }
            expect(reach.pin, `${family} ${t.marker} pin`).not.toBeNull();
            if (layout === 'docked') {
              // Section 5.0 with an option pointed at: every target box still 32 px or more from every visible control.
              const shown = await controls(page);
              expect(shown.length).toBeGreaterThan(0);
              for (const b of boxes) for (const c of shown) expect(gap(b, c), `${family} ${t.marker}: ${b.marker} / ${c.id}`).toBeGreaterThanOrEqual(NAV_CLEARANCE);
              // The outline and the pin themselves keep the clearance too: drawing them never brings the content within 32 px of a control.
              for (const c of shown) {
                expect(gap(reach.outline, c), `${family} ${t.marker}: outline / ${c.id}`).toBeGreaterThanOrEqual(NAV_CLEARANCE);
                if (reach.pin) expect(gap(reach.pin, c), `${family} ${t.marker}: pin / ${c.id}`).toBeGreaterThanOrEqual(NAV_CLEARANCE);
              }
            }
            // The pin takes no taps.
            expect(await page.getByTestId('presenter-quiz-pin').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
            if (t.marker === 'option:2') await shot(page, `presenter-point-${vp.id}-${input}-${family}`);
            // A second tap on the same option clears it.
            await tapAt(page, input, centre);
            await expect.poll(() => pointedNow(page)).toEqual([]);
            await expect.poll(() => live(page)).toBe(UNPOINTED);
            expect({ ...(await state(page)), live: '' }).toEqual({ ...before, live: '' });
          }
          // One at a time: pointing at another moves it.
          const [a, b] = options;
          await tapAt(page, input, { x: (a!.left + a!.right) / 2, y: (a!.top + a!.bottom) / 2 });
          await tapAt(page, input, { x: (b!.left + b!.right) / 2, y: (b!.top + b!.bottom) / 2 });
          await expect.poll(() => pointedNow(page)).toEqual([b!.marker]);
          // A step clears it: Reveal shows the answer with nothing outlined.
          await page.keyboard.press('ArrowRight');
          await expect.poll(() => page.getByTestId('presenter-quiz-mark').count()).toBe(1);
          expect(await pointedNow(page)).toEqual([]);
          expect(await live(page)).not.toContain('pointed');
          // Once the answer shows, a tap or a key points at nothing: no pick is outlined beside the answer.
          const revealed = await state(page);
          const answerBoxes = (await targets(page)).filter((x) => /^option:[1-4]$/.test(x.marker));
          for (const x of answerBoxes) await tapAt(page, input, { x: (x.left + x.right) / 2, y: (x.top + x.bottom) / 2 });
          await page.keyboard.press('2');
          await page.waitForTimeout(150);
          expect(await pointedNow(page), `${family} after the reveal`).toEqual([]);
          expect(await page.getByTestId('presenter-quiz-pin').count()).toBe(0);
          expect(await state(page), `${family} after the reveal`).toEqual(revealed);
        }
      });

      test('keys 1 to 4 point at an option, also with focus on a bar button; a step clears it', async ({ page }) => {
        await open(page, vp, input);
        const presses = await familyPresses(page);
        await goToFamily(page, presses, 'grid');
        const before = await counter(page);
        for (const n of [1, 2, 3, 4]) {
          await page.keyboard.press(String(n));
          await expect.poll(() => pointedNow(page)).toEqual([`option:${n}`]);
          await expect.poll(() => live(page)).toBe(POINTED(n));
        }
        await page.keyboard.press('4');
        await expect.poll(() => pointedNow(page)).toEqual([]);
        expect(await counter(page)).toBe(before);
        if (layout === 'docked') {
          // Focus on a bar button (as after a click on Previous or Next) does not block a digit.
          await page.getByTestId('presenter-back').focus();
          await page.keyboard.press('2');
          await expect.poll(() => pointedNow(page)).toEqual(['option:2']);
          expect(await counter(page)).toBe(before);
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
        } else {
          await page.keyboard.press('2');
          await expect.poll(() => pointedNow(page)).toEqual(['option:2']);
        }
        await page.keyboard.press('ArrowLeft');
        await expect.poll(() => pointedNow(page)).toEqual([]);
        // A slide with no options: a digit points at nothing and steps nothing.
        await page.keyboard.press('Home');
        await expect.poll(() => counter(page)).toMatch(/^1 \//);
        await page.keyboard.press('1');
        await page.waitForTimeout(100);
        expect(await pointedNow(page)).toEqual([]);
        expect(await counter(page)).toMatch(/^1 \//);
      });

      if (vp.id === 'P') {
        test('the 1280 x 720 projector look: the pointed option at lowered contrast', async ({ page }) => {
          await open(page, vp, input);
          const presses = await familyPresses(page);
          for (const family of ['grid', 'rows'] as const) {
            await goToFamily(page, presses, family);
            await page.keyboard.press('2');
            await expect.poll(() => pointedNow(page)).toEqual(['option:2']);
            // The design mock's washed-out projector in a lit room (design/screens/presenter/mock/presenter-nav.css --mock-projector).
            await page.addStyleTag({ content: 'html { filter: contrast(0.55) brightness(1.2) saturate(0.7); }' });
            await shot(page, `presenter-point-P-projector-${family}`);
            await page.evaluate(() => document.querySelectorAll('style').forEach((el) => { if (el.textContent?.includes('contrast(0.55)')) el.remove(); }));
          }
        });
      }
    });
  }
}
