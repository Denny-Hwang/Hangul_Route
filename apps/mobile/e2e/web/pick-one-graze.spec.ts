import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { passDiscover, seedStored } from './helpers';
import { LETTER_OF, captureSpeech, en, nextSaid, roundPill, saidCount, shown } from './jamo-voice-rig';
import { Touchscreen, type TouchPoint } from './touch';

/**
 * AMENDMENTS-TOUCH row KT-3, section 11.2 for this row's own boards: the graze matrix, the 150 ms bounce, the release
 * outside the target, the slide into a neighbour, the edge graze that ends just inside one, two fingers, a hold and a
 * 72 px drag, on one Tile board (Match Sound) and one ChoiceCard board (Listen & Pick), in the guest's first quest.
 * KT-11 runs the whole matrix over every board.
 *
 * Profiles (section 11.2): 320 x 640 with touch and the largest text size, and the 820 x 1180 tablet. Release build.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Past the 400 ms lock, with room for a busy machine's slow event dispatch. */
const AFTER_LOCK = 700;
/** Past the lock and a miss's 800 ms replay (which can move the cards). */
const AFTER_MISS = 1_200;
const ANSWERED = /^(Right answer|Not this one)/;

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(page: Page, testId: string): Promise<Box> {
  const box = await page.getByTestId(testId).boundingBox();
  if (box === null) throw new Error(`no box for ${testId}`);
  return box;
}

/** Scrolls an element to the middle of the screen if it is near an edge, then returns its box. */
async function inView(page: Page, testId: string): Promise<Box> {
  const ok = await page.getByTestId(testId).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 60 && r.bottom <= window.innerHeight - 60;
  });
  if (!ok) {
    await page.getByTestId(testId).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(150);
  }
  return boxOf(page, testId);
}

const centre = (b: Box): TouchPoint => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const inside = (p: TouchPoint, b: Box): boolean => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

/** The neighbour of `from` whose centre is nearest. */
async function nearest(page: Page, from: string, among: readonly string[]): Promise<string> {
  const a = centre(await boxOf(page, from));
  let best = '';
  let bestD = Infinity;
  for (const id of among) {
    if (id === from) continue;
    const c = centre(await boxOf(page, id));
    const d = Math.hypot(c.x - a.x, c.y - a.y);
    if (d < bestD) [best, bestD] = [id, d];
  }
  return best;
}

/**
 * A slide from 4 px inside `from`'s edge that faces `to`, along the line between their centres: `depth` px into `to`'s
 * own rectangle (the edge graze of T17b), or to `to`'s centre when `depth` is undefined (the slide of T17).
 */
async function slide(page: Page, from: string, to: string, depth?: number): Promise<{ start: TouchPoint; dx: number; dy: number }> {
  const a = await boxOf(page, from);
  const b = await boxOf(page, to);
  const horizontal = Math.abs(centre(b).x - centre(a).x) >= Math.abs(centre(b).y - centre(a).y);
  const sign = horizontal ? Math.sign(centre(b).x - centre(a).x) : Math.sign(centre(b).y - centre(a).y);
  const along = (box: Box, near: boolean): number => {
    const lo = horizontal ? box.x : box.y;
    const hi = lo + (horizontal ? box.width : box.height);
    // The edge of `box` that faces the other card.
    return (sign > 0) === near ? hi : lo;
  };
  const fromEdge = along(a, true) - sign * 4;
  const target = depth === undefined ? (horizontal ? centre(b).x : centre(b).y) : along(b, false) + sign * depth;
  const start = horizontal ? { x: fromEdge, y: centre(a).y } : { x: centre(a).x, y: fromEdge };
  const d = target - fromEdge;
  return { start, dx: horizontal ? d : 0, dy: horizontal ? 0 : d };
}

/** A move from `id`'s centre that ends 40 px outside it, on the screen and on no other answer. */
async function outsideRelease(page: Page, id: string, others: readonly string[]): Promise<{ start: TouchPoint; dx: number; dy: number }> {
  const b = await boxOf(page, id);
  const c = centre(b);
  const vw = page.viewportSize()!;
  const boxes = await Promise.all(others.filter((o) => o !== id).map((o) => boxOf(page, o)));
  const moves = [
    { dx: 0, dy: -(b.height / 2 + 40) },
    { dx: 0, dy: b.height / 2 + 40 },
    { dx: -(b.width / 2 + 40), dy: 0 },
    { dx: b.width / 2 + 40, dy: 0 },
  ];
  const onScreen = moves.filter((m) => {
    const end = { x: c.x + m.dx, y: c.y + m.dy };
    return end.x >= 4 && end.y >= 4 && end.x <= vw.width - 4 && end.y <= vw.height - 4;
  });
  // Prefer an end on no other answer; full-width cards stacked in a column leave none, and an end on a neighbour
  // must commit nothing as well (rule 4: the target never changes during a touch).
  const clear = onScreen.find((m) => !boxes.some((o) => inside({ x: c.x + m.dx, y: c.y + m.dy }, o)));
  const m = clear ?? onScreen[0];
  if (m === undefined) throw new Error(`no spot on the screen 40 px outside ${id}`);
  return { start: c, ...m };
}

/** The distance the screen's own scroller (the nearest scrolling ancestor of `testId`) can still move, and its offset. */
async function scroller(page: Page, testId: string): Promise<{ room: number; top: number } | null> {
  return page.getByTestId(testId).evaluate((el) => {
    for (let n = el.parentElement; n !== null; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return { room: n.scrollHeight - n.clientHeight, top: n.scrollTop };
    }
    const d = document.scrollingElement;
    return d !== null && d.scrollHeight > d.clientHeight + 1 ? { room: d.scrollHeight - d.clientHeight, top: d.scrollTop } : null;
  });
}

async function startGuestQuest(page: Page, largest: boolean): Promise<void> {
  if (largest) {
    await page.goto('/');
    await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
  }
  await page.goto('/?try=1');
  await expect(page.getByText('Hi from Hoya', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
  await passDiscover(page);
}

/** The graze matrix of section 11.2: 0, 8, 16, 24 and 32 px on both axes (both signs), one hold of 900 ms. */
const MATRIX: ReadonlyArray<{ dx: number; dy: number; holdMs?: number }> = [
  { dx: 0, dy: 0, holdMs: 900 },
  { dx: 0, dy: 8 },
  { dx: 0, dy: -16 },
  { dx: 0, dy: 24 },
  { dx: 0, dy: -32 },
  { dx: 8, dy: 0 },
  { dx: -16, dy: 0 },
  { dx: 24, dy: 0 },
  { dx: -32, dy: 0 },
  { dx: 0, dy: 32 },
  { dx: 32, dy: 0 },
];

for (const profile of [
  { name: 'phone 320, largest text', viewport: { width: 320, height: 640 }, largest: true },
  { name: 'tablet 820', viewport: { width: 820, height: 1180 }, largest: false },
]) {
  test.describe(`pick-one boards, the touch matrix, ${profile.name} (AMENDMENTS-TOUCH KT-3, section 11.2)`, () => {
    test.skip(FIXTURE_BUILD, 'the release build: the guest quest and the device voice');
    test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

    test('Match Sound tiles: every graze of the matrix commits; outside, slide and drag commit nothing; two fingers', async ({ page }) => {
      test.setTimeout(180_000);
      await captureSpeech(page);
      await startGuestQuest(page, profile.largest);
      await page.getByRole('button', { name: en.learner.quest.launcher.game.play.cta }).click();
      const touch = await Touchscreen.of(page);
      const queue = [...MATRIX];
      let round = 1;
      let checkedNothing = false;
      let checkedTwoFingers = false;

      while (queue.length > 0) {
        await expect(roundPill(page, round)).toBeVisible();
        await expect(shown(page, 'match-sound-tiles')).toBeVisible();
        const before = await saidCount(page);
        await shown(page, 'match-sound-speaker').click();
        const letter = LETTER_OF.get(await nextSaid(page, before));
        expect(letter).toBeDefined();
        const tiles = shown(page, 'match-sound-tiles').locator('[data-testid^="match-sound-tile-"]');
        await expect(tiles).toHaveCount(4);
        const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
        const texts = await tiles.allInnerTexts();
        const rightId = ids[texts.findIndex((t) => t.includes(letter!))]!;
        const wrongIds = ids.filter((id) => id !== rightId);
        await page.waitForTimeout(AFTER_LOCK);

        /** Nothing was answered: no tile locked, no replay of the prompt, the same round. */
        const expectNothing = async (from: number, what: string): Promise<void> => {
          await page.waitForTimeout(AFTER_LOCK);
          for (const id of ids) await expect(page.getByTestId(id), `${what}: ${id}`).not.toHaveAttribute('aria-disabled', 'true');
          expect(await saidCount(page), `${what}: no replay`).toBe(from);
          await expect(roundPill(page, round)).toBeVisible();
        };

        if (!checkedNothing) {
          checkedNothing = true;
          const [a] = wrongIds as [string];
          // A move that ends 40 px outside the tile commits nothing.
          await inView(page, a);
          let from = await saidCount(page);
          const out = await outsideRelease(page, a, ids);
          await touch.graze(out.start, out.dx, out.dy, { steps: 6 });
          await expectNothing(from, 'released 40 px outside');
          // A slide from the tile into its neighbour commits nothing.
          await inView(page, a);
          const b = await nearest(page, a, ids);
          const deep = await slide(page, a, b);
          await touch.graze(deep.start, deep.dx, deep.dy, { steps: 6 });
          await expectNothing(from, 'slid into the neighbour');
          // On a scrolling screen, a 72 px vertical drag from the tile scrolls the page and commits nothing (T15b). On a
          // fitting one there is no scroll, and a 72 px move can stay inside a tall tile, where it is a graze.
          await inView(page, a);
          const sc = await scroller(page, a);
          test.info().annotations.push({ type: 'board', description: sc === null || sc.room < 40 ? 'Match Sound fits the screen: no drag case' : `Match Sound scrolls (${sc.room} px)` });
          if (sc !== null && sc.room >= 40) {
            from = await saidCount(page);
            const p = centre(await boxOf(page, a));
            const up = sc.room - sc.top >= sc.top;
            await touch.graze(p, 0, up ? -72 : 72, { steps: 8 });
            await expectNothing(from, '72 px drag');
            const after = await scroller(page, a);
            expect(Math.abs((after?.top ?? sc.top) - sc.top), 'the drag scrolled the page').toBeGreaterThanOrEqual(20);
          }
          // An edge graze that ends just inside the neighbour (4 px, under NEIGHBOUR_DEPTH) commits the tile it started on.
          await inView(page, a);
          from = await saidCount(page);
          const edge = await slide(page, a, b, 4);
          await touch.graze(edge.start, edge.dx, edge.dy, { steps: 4 });
          await expect(page.getByTestId(a)).toHaveAttribute('aria-disabled', 'true');
          await expect(page.getByTestId(b)).not.toHaveAttribute('aria-disabled', 'true');
          await expect.poll(() => saidCount(page)).toBe(from + 1);
          await page.waitForTimeout(AFTER_MISS);
        } else if (!checkedTwoFingers) {
          checkedTwoFingers = true;
          // Two fingers (T9): finger 1 on one tile, finger 2 on another 40 ms later; 1 lifts, then 2. Only 2 commits.
          const [a, b] = wrongIds as [string, string];
          await inView(page, a);
          const pa = centre(await boxOf(page, a));
          const pb = centre(await boxOf(page, b));
          await touch.start({ id: 1, ...pa });
          await page.waitForTimeout(40);
          await touch.start({ id: 2, ...pb });
          await page.waitForTimeout(40);
          await touch.end(1);
          await page.waitForTimeout(40);
          await touch.end(2);
          await expect(page.getByTestId(b)).toHaveAttribute('aria-disabled', 'true');
          await expect(page.getByTestId(a)).not.toHaveAttribute('aria-disabled', 'true');
          await page.waitForTimeout(AFTER_MISS);
        }

        // The matrix: each wrong tile still open, then the right one, takes the next graze and must commit.
        for (const id of [...wrongIds, rightId]) {
          if (queue.length === 0) break;
          if (id !== rightId && (await page.getByTestId(id).getAttribute('aria-disabled')) === 'true') continue;
          const g = queue.shift()!;
          const p = centre(await inView(page, id));
          await touch.graze(p, g.dx, g.dy, { steps: 4, holdMs: g.holdMs ?? 0 });
          if (id === rightId) {
            round += 1;
            await expect(roundPill(page, round), `graze ${g.dx},${g.dy} on the right tile`).toBeVisible();
          } else {
            await expect(page.getByTestId(id), `graze ${g.dx},${g.dy} on ${id}`).toHaveAttribute('aria-disabled', 'true');
            await page.waitForTimeout(AFTER_MISS);
          }
        }
      }
      expect(queue).toHaveLength(0);
    });

    test('Listen & Pick cards: a 150 ms bounce answers nothing; outside and slide commit nothing; grazes on both axes commit', async ({ page }) => {
      test.setTimeout(120_000);
      await startGuestQuest(page, profile.largest);
      await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
      await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      const options = page.locator('[data-testid^="listen-pick-option-"]').filter({ visible: true });
      await expect(page.getByTestId('listen-pick-option-jamo:eo')).toBeVisible();
      const ids = await options.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
      const rightId = 'listen-pick-option-jamo:eo';
      const wrongIds = ids.filter((id) => id !== rightId);
      expect(wrongIds.length).toBeGreaterThanOrEqual(2);
      const [w1, w2] = wrongIds as [string, string];
      await page.waitForTimeout(AFTER_LOCK);
      const touch = await Touchscreen.of(page);
      const answered = async (id: string): Promise<boolean> => ANSWERED.test((await page.getByTestId(id).getAttribute('aria-label')) ?? '');

      // Bounce: a miss, then 150 ms after its release a touch on another card: one answer.
      await inView(page, w1);
      // Both points first, so the 150 ms is measured from the first release to the second touch-down.
      const p1 = centre(await boxOf(page, w1));
      const p2 = centre(await boxOf(page, w2));
      await touch.tap(p1);
      await page.waitForTimeout(150);
      await touch.tap(p2);
      await expect(page.getByTestId(w1)).toHaveAttribute('aria-label', /^Not this one/);
      await page.waitForTimeout(AFTER_MISS);
      expect(await answered(w2), 'the 150 ms bounce answered nothing').toBe(false);
      expect(await answered(rightId)).toBe(false);

      // A move that ends 40 px outside a card, and a slide into its neighbour, commit nothing.
      await inView(page, w2);
      const out = await outsideRelease(page, w2, ids);
      await touch.graze(out.start, out.dx, out.dy, { steps: 6 });
      await inView(page, w2);
      const neighbour = await nearest(page, w2, ids.filter((id) => id !== w1));
      const deep = await slide(page, w2, neighbour);
      await touch.graze(deep.start, deep.dx, deep.dy, { steps: 6 });
      await page.waitForTimeout(AFTER_LOCK);
      for (const id of [w2, rightId]) expect(await answered(id), `outside or slide: ${id}`).toBe(false);

      // Grazes on both axes commit: 16 px horizontal on a wrong card, 32 px vertical on the right one.
      await touch.graze(centre(await inView(page, w2)), 16, 0);
      await expect(page.getByTestId(w2)).toHaveAttribute('aria-label', /^Not this one/);
      await page.waitForTimeout(AFTER_MISS);
      await touch.graze(centre(await inView(page, rightId)), 0, -32);
      await expect(page.getByTestId(rightId)).toHaveAttribute('aria-label', /^Right answer/);
    });
  });
}
