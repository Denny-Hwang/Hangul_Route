import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { openPlaygroundWordsQuest } from './helpers';
import { Touchscreen, type TouchPoint } from './touch';

/**
 * AMENDMENTS-TOUCH row KT-4b, section 11.2 for this row's boards: Pic-Word Match and Card Match, each on two `target`
 * TapBoards, in the first quest of Stage 2 Play & Crafts (Pic-Word is its Practice, Card Match its Apply).
 *
 * - The graze matrix (moves of 0, 8, 16, 24 and 32 px on both axes, and a 900 ms hold) commits on Pic-Word's pictures,
 *   on the scrolling board (320 x 640, largest text) and on the fitting one (the 820 x 1180 tablet), and on Card Match's
 *   Korean cards. A picture or a Korean card only moves the selection, so the matrix scores nothing.
 * - A move that ends 40 px outside a tile commits nothing and shows no press look while the finger is out; a slide into
 *   the neighbouring tile commits nothing, an edge graze 4 px into it commits the tile it started on; on the scrolling
 *   board a 72 px vertical drag from a tile scrolls the page and changes nothing.
 * - Regressions: F1 (a 20 px vertical graze selects, scrolling profile), F2 (taps 60 and 150 ms apart, release to
 *   down, end selected), F3 (Card Match: the next pick is still selected 700 ms after a miss's flash would have ended).
 *
 * The 300 ms bounce stays a fake-timer unit test (section 11.2). Release build.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Past the 400 ms lock, with room for a busy machine's slow event dispatch. */
const AFTER_LOCK = 700;
const SELECTED = /^Selected: /;

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(target: Locator): Promise<Box> {
  const box = await target.boundingBox();
  if (box === null) throw new Error('no box');
  return box;
}

/** Scrolls a tile to the middle of the screen if it is near an edge, then returns its box. */
async function inView(target: Locator): Promise<Box> {
  const ok = await target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.top >= 60 && r.bottom <= window.innerHeight - 60;
  });
  if (!ok) {
    await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await target.page().waitForTimeout(150);
  }
  return boxOf(target);
}

const centre = (b: Box): TouchPoint => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** The drawn card inside a tile's target: its border and transform, where the press look shows (section 4.3). */
async function drawn(target: Locator): Promise<string> {
  return target.evaluate((el) => {
    const card = el.firstElementChild as HTMLElement | null;
    if (card === null) return '';
    const s = getComputedStyle(card);
    return `${s.borderTopColor} ${s.borderTopWidth} ${s.transform}`;
  });
}

/** The scrolling ancestor of a tile: how far it can still move, and its offset; null when the screen fits. */
async function scroller(target: Locator): Promise<{ room: number; top: number } | null> {
  return target.evaluate((el) => {
    for (let n = el.parentElement; n !== null; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return { room: n.scrollHeight - n.clientHeight, top: n.scrollTop };
    }
    const d = document.scrollingElement;
    return d !== null && d.scrollHeight > d.clientHeight + 1 ? { room: d.scrollHeight - d.clientHeight, top: d.scrollTop } : null;
  });
}

/** A slide from 4 px inside `a`'s edge that faces `b` (stacked in one column), to `depth` px into `b`, or to its centre. */
async function slide(a: Locator, b: Locator, depth?: number): Promise<{ start: TouchPoint; dy: number }> {
  const ba = await boxOf(a);
  const bb = await boxOf(b);
  const down = bb.y > ba.y;
  const fromEdge = down ? ba.y + ba.height - 4 : ba.y + 4;
  const to = depth === undefined ? centre(bb).y : down ? bb.y + depth : bb.y + bb.height - depth;
  return { start: { x: centre(ba).x, y: fromEdge }, dy: to - fromEdge };
}

/** The graze matrix of section 11.2: 0 (held 900 ms), 8, 16, 24 and 32 px on both axes, both signs. */
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

/** The tiles of one side, top to bottom. */
async function column(page: Page, prefix: string): Promise<Locator[]> {
  const ids = await page.locator(`[data-testid^="${prefix}"][role="button"]`).evaluateAll((els) =>
    els
      .map((e) => ({ id: e.getAttribute('data-testid') ?? '', y: e.getBoundingClientRect().y }))
      .sort((p, q) => p.y - q.y)
      .map((p) => p.id),
  );
  return ids.map((id) => page.getByTestId(id));
}

for (const profile of [
  { name: 'phone 320, largest text', viewport: { width: 320, height: 640 }, largest: true },
  { name: 'tablet 820', viewport: { width: 820, height: 1180 }, largest: false },
]) {
  test.describe(`Pic-Word Match and Card Match on target boards, ${profile.name} (AMENDMENTS-TOUCH KT-4b, section 11.2)`, () => {
    test.skip(FIXTURE_BUILD, 'the release build: the Stage 2 quest');
    test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

    test('Pic-Word: the graze matrix selects; outside, slide and drag change nothing; F1 and F2', async ({ page }) => {
      test.setTimeout(180_000);
      await openPlaygroundWordsQuest(page, { largest: profile.largest });
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expect(page.getByTestId('pic-word-pictures')).toBeVisible();
      await page.waitForTimeout(AFTER_LOCK);
      const pictures = await column(page, 'pic-word-picture-');
      expect(pictures.length).toBeGreaterThanOrEqual(3);
      const touch = await Touchscreen.of(page);
      const selected = async (t: Locator): Promise<boolean> => SELECTED.test((await t.getAttribute('aria-label')) ?? '');
      /** Exactly `which` is selected among the pictures (or none). */
      const expectOnly = async (which: Locator | null, what: string): Promise<void> => {
        for (const t of pictures) {
          const want = which !== null && (await t.getAttribute('data-testid')) === (await which.getAttribute('data-testid'));
          await expect.poll(() => selected(t), `${what}: ${await t.getAttribute('data-testid')}`).toBe(want);
        }
      };

      const first = pictures[0]!;
      const sc = await scroller(first);
      test.info().annotations.push({ type: 'board', description: sc === null || sc.room < 40 ? 'Pic-Word fits the screen' : `Pic-Word scrolls (${sc.room} px)` });
      if (profile.largest) expect(sc !== null && sc.room >= 40, 'Pic-Word scrolls at 320 px with the largest text').toBe(true);

      // F1: a 20 px vertical graze selects the picture, and the press look showed while the finger was on it.
      const rest = await drawn(first);
      const p = centre(await inView(first));
      await touch.start({ id: 1, ...p });
      await touch.move({ id: 1, x: p.x, y: p.y + 10 });
      await expect.poll(() => drawn(first), { message: 'the press look shows at once', timeout: 2_000 }).not.toBe(rest);
      await touch.move({ id: 1, x: p.x, y: p.y + 20 });
      await touch.end(1);
      await expectOnly(first, 'F1: a 20 px vertical graze');

      // F2: taps 60 and 150 ms apart (release to down) on the selected picture keep it selected.
      for (const gap of [60, 150]) {
        const at = centre(await inView(first));
        await touch.tap(at);
        await page.waitForTimeout(gap);
        await touch.tap(at);
        await page.waitForTimeout(AFTER_LOCK);
        await expectOnly(first, `F2: a ${gap} ms bounce`);
      }

      // A move that ends 40 px outside another picture commits nothing and shows no press look while out.
      const [, second, third] = pictures as [Locator, Locator, Locator];
      const restSecond = await drawn(second);
      const b2 = await inView(second);
      const c2 = centre(b2);
      const side = c2.x - b2.width / 2 - 40 >= 4 ? -1 : 1;
      const out = { x: c2.x + side * (b2.width / 2 + 40), y: c2.y };
      await touch.start({ id: 1, ...c2 });
      for (let i = 1; i <= 6; i++) await touch.move({ id: 1, x: c2.x + ((out.x - c2.x) * i) / 6, y: c2.y });
      await expect.poll(() => drawn(second), { message: 'no press look 40 px outside', timeout: 2_000 }).toBe(restSecond);
      await touch.end(1);
      await page.waitForTimeout(AFTER_LOCK);
      await expectOnly(first, 'released 40 px outside');

      // A slide from the second picture into its neighbour commits nothing.
      await inView(second);
      const deep = await slide(second, third);
      await touch.graze(deep.start, 0, deep.dy, { steps: 6 });
      await page.waitForTimeout(AFTER_LOCK);
      await expectOnly(first, 'slid into the neighbour');

      // On the scrolling board a 72 px vertical drag from a picture scrolls the page and changes nothing (T15b).
      const sc2 = await scroller(second);
      if (sc2 !== null && sc2.room >= 40) {
        const at = centre(await inView(second));
        const up = sc2.room - sc2.top >= sc2.top;
        await touch.graze(at, 0, up ? -72 : 72, { steps: 8 });
        await page.waitForTimeout(AFTER_LOCK);
        await expectOnly(first, '72 px drag');
        const after = await scroller(second);
        expect(Math.abs((after?.top ?? sc2.top) - sc2.top), 'the drag scrolled the page').toBeGreaterThanOrEqual(20);
      }

      // An edge graze that ends 4 px inside the neighbour (under NEIGHBOUR_DEPTH) commits the picture it started on.
      await inView(second);
      const edge = await slide(second, third, 4);
      await touch.graze(edge.start, 0, edge.dy, { steps: 4 });
      await expectOnly(second, 'edge graze 4 px into the neighbour');

      // The matrix: each graze lands on a picture other than the selected one, so each must move the selection.
      let current = 1;
      for (const g of MATRIX) {
        current = (current + 1) % pictures.length;
        const t = pictures[current]!;
        await page.waitForTimeout(150);
        await touch.graze(centre(await inView(t)), g.dx, g.dy, { steps: 4, holdMs: g.holdMs ?? 0 });
        await expectOnly(t, `graze ${g.dx},${g.dy}${g.holdMs ? ` held ${g.holdMs} ms` : ''}`);
      }

      // The words board: a 16 px vertical graze on the selected picture's word makes the pair.
      const id = ((await pictures[current]!.getAttribute('data-testid')) ?? '').replace('pic-word-picture-', '');
      const word = page.getByTestId(`pic-word-word-${id}`).and(page.locator('[role="button"]'));
      await page.waitForTimeout(150);
      await touch.graze(centre(await inView(word)), 0, 16);
      await expect(word).toHaveAttribute('aria-label', /^Matched, number 1/);
    });

    test('Card Match: the graze matrix picks Korean cards; outside commits nothing; F3, the next pick stays selected', async ({ page }) => {
      test.setTimeout(180_000);
      await openPlaygroundWordsQuest(page, { largest: profile.largest });
      await page.getByRole('button', { name: 'Skip for now' }).click();
      await page.getByRole('button', { name: 'Play minigame' }).click();
      const korean = (romanization: string): Locator => page.getByLabel(`Korean word ${romanization}`, { exact: true });
      const meaning = (gloss: string): Locator => page.getByLabel(`English meaning ${gloss}`, { exact: true });
      await expect(korean('geune')).toBeVisible();
      await page.waitForTimeout(AFTER_LOCK);
      const cards = await column(page, 'card-match-ko-');
      expect(cards).toHaveLength(4);
      const touch = await Touchscreen.of(page);
      const expectOnly = async (which: Locator | null, what: string): Promise<void> => {
        const want = which === null ? null : await which.getAttribute('data-testid');
        for (const c of cards) {
          const id = await c.getAttribute('data-testid');
          if (id === want) await expect(c, `${what}: ${id}`).toHaveAttribute('aria-selected', 'true');
          else await expect(c, `${what}: ${id}`).not.toHaveAttribute('aria-selected', 'true');
        }
      };
      const sc = await scroller(cards[0]!);
      test.info().annotations.push({ type: 'board', description: sc === null || sc.room < 40 ? 'Card Match fits the screen' : `Card Match scrolls (${sc.room} px)` });

      // The matrix on the Korean cards: each graze picks a card other than the picked one (no score, no pair).
      let current = -1;
      for (const g of MATRIX) {
        current = (current + 1) % cards.length;
        const c = cards[current]!;
        await page.waitForTimeout(150);
        await touch.graze(centre(await inView(c)), g.dx, g.dy, { steps: 4, holdMs: g.holdMs ?? 0 });
        await expectOnly(c, `graze ${g.dx},${g.dy}${g.holdMs ? ` held ${g.holdMs} ms` : ''}`);
      }

      // A move that ends 40 px outside a card commits nothing and shows no press look while out.
      const picked = cards[current]!;
      const other = cards[(current + 1) % cards.length]!;
      const rest = await drawn(other);
      const b = await inView(other);
      const c = centre(b);
      const side = c.x - b.width / 2 - 40 >= 4 ? -1 : 1;
      await touch.start({ id: 1, ...c });
      for (let i = 1; i <= 6; i++) await touch.move({ id: 1, x: c.x + (side * (b.width / 2 + 40) * i) / 6, y: c.y });
      await expect.poll(() => drawn(other), { message: 'no press look 40 px outside', timeout: 2_000 }).toBe(rest);
      await touch.end(1);
      await page.waitForTimeout(AFTER_LOCK);
      await expectOnly(picked, 'released 40 px outside');

      // F3: geune, the wrong "sand", then morae at once: morae is still selected after the miss's flash would have ended.
      await touch.tap(centre(await inView(korean('geune'))));
      await touch.tap(centre(await inView(meaning('sand'))));
      await touch.tap(centre(await inView(korean('morae'))));
      await page.waitForTimeout(AFTER_LOCK);
      await expect(korean('morae')).toHaveAttribute('aria-selected', 'true');
      await expect(korean('geune')).not.toHaveAttribute('aria-selected', 'true');
      // The pick still makes its pair with a graze on its meaning.
      await touch.graze(centre(await inView(meaning('sand'))), 0, -16);
      await expect(korean('morae')).toHaveAttribute('aria-disabled', 'true');
    });
  });
}
