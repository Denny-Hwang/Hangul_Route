import type { Page } from '@playwright/test';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { expect } from './fixtures';
import { Touchscreen, type TouchPoint } from './touch';

/**
 * The touch matrix of docs/specs/AMENDMENTS-TOUCH.md section 11.2 for any board (row KT-11), as helpers a spec calls
 * with a way to reach the board and nothing else: the answers are found on the page the way the browser sees them (an
 * element that is a button and sets `touch-action: pinch-zoom` is a `TapTarget`, KT-D3), a commit is any change in
 * what the answers or the page say, and a move that commits nothing is a page that stays exactly as it was. So one
 * runner serves ChoiceCard, Tile and Button boards without knowing the game.
 *
 * Not a spec file: a spec file may not import another.
 */

/** Nothing of an earlier run stays: leave the app (it holds its database open), clear the origin's data, and load it again. */
export async function clearDevice(page: Page, baseURL: string | undefined): Promise<void> {
  await page.goto('about:blank');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Storage.clearDataForOrigin', { origin: new URL(baseURL ?? 'http://localhost:4173').origin, storageTypes: 'all' });
  await cdp.detach();
  await page.goto('/');
}

/** `touchTarget.min`: the floor of every answer target. */
export const TARGET_MIN = touchTarget.min;

/**
 * `E2E_TOUCH_MATRIX=full` runs every board at both profiles with all nine grazes and the fit audit (on demand, as
 * `E2E_WEBKIT=1`). The default is the smoke set CI runs: it has to fit the PWA e2e shards' 20 minutes, which the
 * whole suite already uses most of.
 */
export const FULL_MATRIX = process.env.E2E_TOUCH_MATRIX === 'full';

export type Box = { x: number; y: number; width: number; height: number };

export const centre = (b: Box): TouchPoint => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
export const inside = (p: TouchPoint, b: Box): boolean => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

/** Past the 400 ms lock, with room for a busy machine's slow event dispatch. */
export const AFTER_LOCK = 500;
/** Past the lock and a miss's 800 ms replay (which can move the cards). */
export const AFTER_MISS = 1_200;
/** How long a move that must commit nothing is watched: past the lock, the replay and a right answer's 700 ms advance. */
export const WATCH_MS = 1_400;
/** `colors.border.shape`, the press look's outline (section 4.3). */
export const PRESS_OUTLINE = 'rgb(133, 115, 96)';
/** The 0.97 shrink of the press look as a computed transform. */
export const SHRUNK = 'matrix(0.97, 0, 0, 0.97, 0, 0)';

/** One answer target as the page shows it. */
export interface Answer extends Box {
  /** Position among the targets on the page, in document order. */
  index: number;
  label: string;
  disabled: boolean;
  /** The drawn box's computed press-look signs (a ChoiceCard or Tile; a Button paints a pressed fill instead). */
  lookedPressed: boolean;
  /** The drawn box's resting paint (fill and outline): a miss on a board that names no outcome shows only in it. */
  paint: string;
  /** A selection board's pick (Pic-Word's "Selected: ..." name, Card Match's `aria-selected`): a commit there moves it. */
  selected: boolean;
}

/** An answer's name without its selection: the same answer before and after it is picked (a pick is a commit, a repeat tap is none). */
export const identity = (a: Pick<Answer, 'label'>): string => a.label.replace(/^Selected: /, '');

/**
 * Every answer target on the page: a button (role or tag) whose computed `touch-action` has `pinch-zoom` and is not
 * the board itself (a board is no button), outermost first, with a box on the screen.
 */
export function readAnswers(page: Page): Promise<Answer[]> {
  return page.evaluate(
    ({ shape, shrunk }) => {
      const out: Array<{ x: number; y: number; width: number; height: number; label: string; disabled: boolean; lookedPressed: boolean; paint: string; selected: boolean }> = [];
      const isButton = (el: Element): boolean => el.getAttribute('role') === 'button' || el.tagName === 'BUTTON';
      for (const el of Array.from(document.querySelectorAll('[role="button"], button'))) {
        if (!isButton(el)) continue;
        if (!/pinch-zoom/.test(getComputedStyle(el).touchAction)) continue;
        // A button inside a button is one answer.
        if (el.parentElement?.closest('[role="button"], button') != null) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        // Hidden screens stay mounted under the visible one: an answer on one is not on the page.
        if (el.closest('[aria-hidden="true"], [inert]') != null) continue;
        const drawn = el.firstElementChild;
        const d = drawn === null ? null : getComputedStyle(drawn);
        out.push({
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          label: (el.getAttribute('aria-label') ?? (el as HTMLElement).innerText ?? '').trim(),
          // An answered ChoiceCard stays enabled and says so in its name (it takes no second tap); a locked Tile or Button is disabled.
          disabled:
            el.getAttribute('aria-disabled') === 'true' ||
            (el as HTMLButtonElement).disabled === true ||
            /^(Right answer|Not this one|Matched, )/.test(el.getAttribute('aria-label') ?? ''),
          lookedPressed: d !== null && (d.transform === shrunk || d.borderTopColor === shape),
          paint: d === null ? '' : `${d.backgroundColor} ${d.borderTopColor}`,
          selected: el.getAttribute('aria-selected') === 'true' || /^Selected: /.test(el.getAttribute('aria-label') ?? ''),
        });
      }
      return out.map((a, index) => ({ ...a, index }));
    },
    { shape: PRESS_OUTLINE, shrunk: SHRUNK },
  );
}

/** What the answers say and the page says: a commit changes it, a move that commits nothing does not. */
export async function snapshot(page: Page): Promise<string> {
  const answers = await readAnswers(page);
  const text = await page.evaluate(() => document.body.innerText);
  return JSON.stringify({ answers: answers.map((a) => [a.label, a.disabled, a.lookedPressed ? '' : a.paint, a.selected]), text });
}

/** The answers and where they are, for knowing the layout has stopped moving. */
async function layout(page: Page): Promise<string> {
  const answers = await readAnswers(page);
  const text = await page.evaluate(() => document.body.innerText);
  return JSON.stringify({ answers: answers.map((a) => [a.label, a.disabled, Math.round(a.x), Math.round(a.y), Math.round(a.width), Math.round(a.height)]), text });
}

/** Waits until two reads 350 ms apart agree (late layout, a voice check, an advance), then returns the answers. */
export async function settle(page: Page, maxMs = 12_000): Promise<Answer[]> {
  const t0 = Date.now();
  let last = '';
  for (;;) {
    const now = await layout(page);
    if (now === last) return readAnswers(page);
    last = now;
    if (Date.now() - t0 > maxMs) throw new Error('the board never settled');
    await page.waitForTimeout(350);
  }
}

/** Waits until the page's text has not changed for `quietMs` (a late voice notice, an advance), at most `maxMs`. */
export async function calm(page: Page, quietMs = 2_500, maxMs = 15_000): Promise<void> {
  const t0 = Date.now();
  let last = await page.evaluate(() => document.body.innerText);
  let since = Date.now();
  while (Date.now() - since < quietMs && Date.now() - t0 < maxMs) {
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => document.body.innerText);
    if (now !== last) {
      last = now;
      since = Date.now();
    }
  }
}

/** Whether the screen holds the board without scrolling, and how far it would scroll if not (the fit audit, report only). */
export async function fitOf(page: Page): Promise<{ fits: boolean; room: number }> {
  // The screen's scroller at the middle of its right edge: an answer may sit below the fold, where nothing is under a point.
  const vp = page.viewportSize()!;
  const sc = await scrollerAt(page, { x: vp.width - 2, y: vp.height / 2 });
  return { fits: sc === null || sc.room < 2, room: sc?.room ?? 0 };
}

/** The target ratchet (KT-D8) on the board the page shows now: every answer is at least 64 x 64 at this text size and language. */
export async function expectTargets(page: Page, name: string): Promise<number> {
  const answers = await readAnswers(page);
  expect(answers.length, `${name}: answers on the page`).toBeGreaterThanOrEqual(2);
  for (const a of answers) {
    expect(Math.min(Math.round(a.width), Math.round(a.height)), `${name}: "${a.label}" is ${Math.round(a.width)} x ${Math.round(a.height)}`).toBeGreaterThanOrEqual(TARGET_MIN);
  }
  return answers.length;
}

/** The distance the screen's own scroller (the nearest scrolling ancestor of the point) can still move, and its offset. */
export async function scrollerAt(page: Page, at: TouchPoint): Promise<{ room: number; top: number } | null> {
  return page.evaluate((p) => {
    let el: Element | null = document.elementFromPoint(p.x, p.y);
    for (; el !== null; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) return { room: el.scrollHeight - el.clientHeight, top: el.scrollTop };
    }
    const d = document.scrollingElement;
    return d !== null && d.scrollHeight > d.clientHeight + 1 ? { room: d.scrollHeight - d.clientHeight, top: d.scrollTop } : null;
  }, at);
}

/** Scrolls the answer to the middle of the screen if it is near an edge, then returns it again. */
export async function inView(page: Page, a: Answer): Promise<Answer> {
  const vh = page.viewportSize()!.height;
  if (a.y >= 60 && a.y + a.height <= vh - 60) return a;
  await page.evaluate(
    ({ x, y }) => {
      document.elementFromPoint(x, y)?.scrollIntoView({ block: 'center' });
    },
    { x: a.x + a.width / 2, y: Math.min(Math.max(a.y + a.height / 2, 1), vh - 1) },
  );
  await page.waitForTimeout(200);
  const again = (await readAnswers(page)).find((b) => b.label === a.label);
  return again ?? a;
}

/** A move from the answer's centre that ends 40 px outside it, on the screen and on no other answer if it can. */
export function outsideRelease(a: Answer, others: readonly Box[], viewport: { width: number; height: number }): { start: TouchPoint; dx: number; dy: number } {
  const c = centre(a);
  const moves = [
    { dx: 0, dy: -(a.height / 2 + 40) },
    { dx: 0, dy: a.height / 2 + 40 },
    { dx: -(a.width / 2 + 40), dy: 0 },
    { dx: a.width / 2 + 40, dy: 0 },
  ];
  const onScreen = moves.filter((m) => {
    const end = { x: c.x + m.dx, y: c.y + m.dy };
    return end.x >= 4 && end.y >= 4 && end.x <= viewport.width - 4 && end.y <= viewport.height - 4;
  });
  const clear = onScreen.find((m) => !others.some((o) => inside({ x: c.x + m.dx, y: c.y + m.dy }, o)));
  const m = clear ?? onScreen[0];
  if (m === undefined) throw new Error(`no spot on the screen 40 px outside ${a.label}`);
  return { start: c, ...m };
}

/** A slide from 4 px inside `from`'s edge that faces `to`, along the line between their centres, to `to`'s centre. */
export function slideInto(from: Box, to: Box): { start: TouchPoint; dx: number; dy: number } {
  const horizontal = Math.abs(centre(to).x - centre(from).x) >= Math.abs(centre(to).y - centre(from).y);
  const sign = horizontal ? Math.sign(centre(to).x - centre(from).x) : Math.sign(centre(to).y - centre(from).y);
  const edge = horizontal ? (sign > 0 ? from.x + from.width : from.x) : sign > 0 ? from.y + from.height : from.y;
  const fromEdge = edge - sign * 4;
  const target = horizontal ? centre(to).x : centre(to).y;
  const start = horizontal ? { x: fromEdge, y: centre(from).y } : { x: centre(from).x, y: fromEdge };
  const d = target - fromEdge;
  return { start, dx: horizontal ? d : 0, dy: horizontal ? 0 : d };
}

/** The gap between two boxes (0 when they touch or overlap). */
export function gapBetween(a: Box, b: Box): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  return Math.hypot(dx, dy);
}

/** The graze matrix of section 11.2: 0, 8, 16, 24 and 32 px on both axes, in an order whose first five cover every distance and both axes. */
export const MATRIX: ReadonlyArray<{ dx: number; dy: number; holdMs?: number }> = [
  { dx: 0, dy: 0, holdMs: 900 },
  { dx: 0, dy: 8 },
  { dx: -16, dy: 0 },
  { dx: 0, dy: 24 },
  { dx: 32, dy: 0 },
  { dx: 8, dy: 0 },
  { dx: 0, dy: -16 },
  { dx: -24, dy: 0 },
  { dx: 0, dy: -32 },
];

/** The five distances every board must see commit, whatever its answers allow. */
export const DISTANCES = [0, 8, 16, 24, 32] as const;

export interface MatrixOptions {
  /** How many entries of `MATRIX` to run (default 5, whose first five cover every distance and both axes; `FULL_MATRIX` runs all nine). */
  grazes?: number;
  /** The board's name, for failure messages. */
  name: string;
  /** Reaches a fresh run of the game from nothing (a new device), for when a run ends before the matrix does. */
  restart?: () => Promise<void>;
  /** Called when no answer is open (a game that waits on its own Continue or Next): true when it moved the game on. */
  onIdle?: () => Promise<boolean>;
  /** The most fresh runs to start (default 2). */
  maxRestarts?: number;
  /** A ChoiceCard or Tile board: an answered target says so in its label or `aria-disabled`, which the bounce and two-finger checks need. */
  statefulAnswers?: boolean;
  /** Reports what the board did (fits or scrolls) to the test's annotations. */
  note: (type: string, description: string) => void;
}

export interface MatrixResult {
  committed: string[];
  scrolled: boolean;
  runs: number;
}

/** A round whose right answer is named is over: the other answers take no tap until the game moves on. */
const SOLVED = /^Right answer|\. Correct$/;

const key = (g: { dx: number; dy: number }): string => `${g.dx},${g.dy}`;

/** The viewport of the page, which a mobile profile always has. */
function viewportOf(page: Page): { width: number; height: number } {
  return page.viewportSize()!;
}

/** Nothing committed: the page says exactly what it said, after the lock, a replay and an advance would have shown. */
async function expectNothing(page: Page, before: string, what: string): Promise<void> {
  await page.waitForTimeout(WATCH_MS);
  const now = await snapshot(page);
  if (now !== before) {
    let i = 0;
    while (before[i] === now[i]) i += 1;
    throw new Error(`${what}: the page changed, so something committed. Before: ...${before.slice(Math.max(0, i - 80), i + 80)} After: ...${now.slice(Math.max(0, i - 80), i + 80)}`);
  }
  expect((await readAnswers(page)).filter((a) => a.lookedPressed), `${what}: a press look stayed on`).toHaveLength(0);
}

/** A graze at a point; commits when the page changes within a few seconds. */
async function grazeAndExpectCommit(page: Page, touch: Touchscreen, at: TouchPoint, g: { dx: number; dy: number; holdMs?: number }, before: string, what: string): Promise<void> {
  await touch.graze(at, g.dx, g.dy, { steps: 4, holdMs: g.holdMs ?? 0 });
  await expect.poll(() => snapshot(page), { message: `${what}: the graze ${g.dx},${g.dy} committed nothing`, timeout: 4_000, intervals: [150] }).not.toBe(before);
}

/**
 * The matrix on the board the page shows now. Per run: the move that ends 40 px outside, a slide into the neighbour,
 * a 72 px drag where the screen scrolls, then (ChoiceCard and Tile boards) a bounce and two fingers, and then one
 * graze per entry of `MATRIX` on whichever answer is open, until every distance has committed (and as many of the
 * rest as the game's rounds allow). A run that ends first starts a fresh one through `restart`.
 */
export async function runMatrix(page: Page, touch: Touchscreen, o: MatrixOptions): Promise<MatrixResult> {
  const viewport = viewportOf(page);
  const committed: string[] = [];
  const queue = MATRIX.slice(0, o.grazes ?? 5);
  let scrolled = false;
  let runs = 1;
  let checkedNothing = false;
  let checkedPair = false;
  let pairTries = 0;
  // An answer already tapped in this round: some boards (Read Pick) show a miss only by paint, so it still reads as open.
  const tapped = new Set<string>();
  let round = '';

  // The device voice check settles a moment after a prompt opens and may put "No sound? Read it here." above the answers.
  await calm(page);
  for (;;) {
    const settled = await settle(page);
    const answers = settled.some((a) => SOLVED.test(a.label)) ? [] : settled.filter((a) => !a.disabled);
    if (answers.length === 0) {
      if (o.onIdle !== undefined && (await o.onIdle())) {
        continue;
      }
      // The run is over (or the board is not here yet): once the distances are in, that is the end.
      const covered = DISTANCES.every((d) => committed.some((c) => [Math.abs(Number(c.split(',')[0])), Math.abs(Number(c.split(',')[1]))].includes(d) && (d !== 0 || c === '0,0')));
      if (covered || queue.length === 0) break;
      if (o.restart === undefined || runs > (o.maxRestarts ?? 2)) throw new Error(`${o.name}: the game ended with ${queue.length} grazes of the matrix left and no run to start (committed ${committed.join(' ')})`);
      runs += 1;
      checkedNothing = false;
      await o.restart();
      await calm(page);
      continue;
    }

    if (!checkedNothing) {
      checkedNothing = true;
      const all = (await readAnswers(page)).map((a) => a as Box);
      // The target ratchet (KT-D8): every answer is at least 64 x 64, at this profile's text size and language.
      await expectTargets(page, o.name);
      // A move that ends 40 px outside an answer commits nothing and leaves no press look.
      const first = await inView(page, answers[0]!);
      let before = await snapshot(page);
      const out = outsideRelease(first, (await readAnswers(page)).filter((a) => a.index !== first.index), viewport);
      await touch.graze(out.start, out.dx, out.dy, { steps: 6 });
      await expectNothing(page, before, 'released 40 px outside');
      // A slide from one answer into the nearest other, when they sit close, commits nothing (the target never changes).
      const open = (await settle(page)).filter((a) => !a.disabled);
      const a = await inView(page, open[0]!);
      const near = (await readAnswers(page))
        .filter((b) => b.index !== a.index && !b.disabled)
        .map((b) => ({ b, gap: gapBetween(a, b) }))
        .sort((x, y) => x.gap - y.gap)[0];
      if (near !== undefined && near.gap < 40) {
        before = await snapshot(page);
        const s = slideInto(a, near.b);
        await touch.graze(s.start, s.dx, s.dy, { steps: 6 });
        await expectNothing(page, before, 'slid into the neighbour');
      }
      // On a scrolling screen, a 72 px vertical drag from an answer scrolls the page and commits nothing (T15b).
      const b = await inView(page, (await settle(page)).filter((x) => !x.disabled)[0]!);
      const sc = await scrollerAt(page, centre(b));
      scrolled = sc !== null && sc.room >= 40;
      o.note('board', `${o.name} ${sc !== null && sc.room >= 2 ? `scrolls (${sc.room} px${scrolled ? '' : ', too little for a drag case'})` : 'fits the screen'}; ${all.length} answers`);
      if (scrolled && sc !== null) {
        before = await snapshot(page);
        const up = sc.room - sc.top >= sc.top;
        await touch.graze(centre(b), 0, up ? -72 : 72, { steps: 8 });
        await expectNothing(page, before, '72 px drag');
        const after = await scrollerAt(page, { x: viewport.width - 2, y: viewport.height / 2 });
        expect(Math.abs((after?.top ?? sc.top) - sc.top), 'the drag scrolled the page').toBeGreaterThanOrEqual(20);
        await inView(page, b);
      }
    }

    // The queue: one graze on the first open answer not tapped yet in this round.
    const every = await settle(page);
    const roundNow = every.map(identity).sort().join('|');
    if (roundNow !== round) {
      round = roundNow;
      tapped.clear();
    }
    // A solved round (the right answer named) leaves the rest inactive until the game moves on.
    const open = every.some((a) => SOLVED.test(a.label)) ? [] : every.filter((a) => !a.disabled);
    const fresh = open.filter((a) => !tapped.has(identity(a)));
    const live = fresh.length > 0 ? fresh : open;
    if (live.length === 0) continue;
    if (queue.length === 0) break;

    if (o.statefulAnswers === true && !checkedPair && live.length >= 3) {
      pairTries += 1;
      checkedPair = true;
      const [a, b] = [await inView(page, live[0]!), live[1]!];
      const fresh = (await readAnswers(page)).find((x) => x.label === b.label) ?? b;
      // A bounce: a tap, and 150 ms after its release a tap on another answer. One commit: the second stays as it was.
      const stateOf = async (label: string): Promise<string> => JSON.stringify((await readAnswers(page)).filter((x) => x.label === label).map((x) => x.disabled));
      const pa = centre(a);
      const pb = centre(fresh);
      const bBefore = await stateOf(fresh.label);
      await touch.tap(pa);
      tapped.add(identity(a));
      await page.waitForTimeout(150);
      await touch.tap(pb);
      await page.waitForTimeout(300);
      const bNow = await stateOf(fresh.label);
      // The round moving on (the first tap was the right answer) leaves nothing of the second to read: try again on the next round.
      if (bNow === '[]' && pairTries < 3) checkedPair = false;
      else if (bNow !== '[]') expect(bNow, `${o.name}: the 150 ms bounce answered the second answer`).toBe(bBefore);
      else o.note('bounce', `${o.name}: the round moved on after the first tap each time; the bounce is not readable here`);
      await settle(page);
      await page.waitForTimeout(AFTER_MISS);
      continue;
    }

    const g = queue.shift()!;
    const a = await inView(page, live[0]!);
    const before = await snapshot(page);
    await grazeAndExpectCommit(page, touch, centre(a), g, before, o.name);
    tapped.add(identity(a));
    committed.push(key(g));
    await page.waitForTimeout(AFTER_LOCK);
  }

  for (const d of DISTANCES) {
    expect(
      committed.some((c) => c.split(',').some((n) => Math.abs(Number(n)) === d) && (d !== 0 || c === '0,0')),
      `${o.name}: a ${d} px move committed (${committed.join(' ')})`,
    ).toBe(true);
  }
  o.note('matrix', `${o.name}: ${committed.length} of ${o.grazes ?? 5} grazes committed (${committed.join(' ')}) in ${runs} run(s)`);
  return { committed, scrolled, runs };
}
