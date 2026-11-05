import type { Page } from '@playwright/test';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { answerForkNew, completeChildForm, keepSidewaysIfAsked, passPlacementLanguage, pastTapLock, seedStored, waitForSaved } from './helpers';
import { TARGET_MIN, isOffender, measureTargets } from './target-audit';
import { STORY_ORDER_FIXTURES } from '../../src/navigation/story-order-e2e-fixture';
import { Touchscreen, type TouchPoint } from './touch';

/**
 * AMENDMENTS-TOUCH row KT-5 (sections 6, 6.3, 6.4 and 11.2): Story Sequence, Story Order, Sentence Builder and
 * Placement on their `board` boards, under real touches (`touch.ts`, CDP `Input.dispatchTouchEvent`), on the fixture
 * bundle:
 *
 * - F4: on Story Sequence and Story Order a right card leaves the row and the others reflow; a second tap 150 ms later,
 *   on the card now under the finger, is no miss.
 * - F5: on Sentence Builder a bounce 100 ms after a tile is no Skip, and one 60, 150 or 200 ms after a right tile is no
 *   miss on the tile that slid under the finger.
 * - F6: on the level check, two taps 150 ms apart across the item change give one `placement.item_answered`.
 * - The graze matrix of section 11.2 on every one of these boards: 0 to 32 px on both axes and a 900 ms hold commit, a
 *   release 40 px outside and a slide into the neighbour commit nothing, a 72 px vertical drag on a board that scrolls
 *   scrolls the page and changes nothing (the case says in its annotation when the screen fits), and a bounce 60 or
 *   150 ms after a commit is no second commit. Each bounce measures its own release-to-down gap and reports itself
 *   skipped, with the time, when a busy machine let it land past the lock.
 *
 * The 64 floor (section 11.2) for these boards: every answer, and Skip, is at least 64 x 64 on both profiles, in
 * English; the ratchet in en, es and ko over every game is KT-11's (section 12).
 *
 * Profiles (section 11.2): 320 x 640 with touch and the largest text size, and the 820 x 1180 tablet.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test sentence-builder-story-placement-touch
 *
 * The file name starts with `sentence-builder` so the fixture e2e run of web-app.yml, whose file list selects specs by
 * name, runs it.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Past the 400 ms lock, with room for a busy machine's slow event dispatch. */
const AFTER_LOCK = 700;
/** Past a missed tile's slide back (520 ms, the app lock) with the same room. */
const AFTER_RETURN = 900;
const SEQ = getMessages('en').learner.story.sequence;
/** A bounce measured at this or later is too near the 400 ms lock to test it (KT-3's Daily Review case). */
const SLOW_BOUNCE_MS = 350;

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
    // Settled: a scroll event that lands during the next touch would cancel it (rule 7, T15c); react-native-web reports
    // the end of a scroll a little after the page stops moving.
    await scrollSettled(page);
    await page.waitForTimeout(250);
  }
  return boxOf(page, testId);
}

/**
 * Two taps `gapMs` apart, from the first release to the second touch-down, measured. A gap a busy machine stretched
 * to the lock's edge would test nothing (the second tap may rightly count): the case then reports itself skipped.
 */
async function bounce(page: Page, touch: Touchscreen, first: TouchPoint, second: TouchPoint, gapMs: number): Promise<void> {
  await touch.tap(first);
  const released = Date.now();
  await page.waitForTimeout(gapMs);
  const measured = Date.now() - released;
  await touch.tap(second);
  test.info().annotations.push({ type: 'bounce', description: `${gapMs} ms bounce measured ${measured} ms` });
  test.skip(measured >= SLOW_BOUNCE_MS, `the ${gapMs} ms bounce landed ${measured} ms after the release (a busy machine): it tests nothing`);
}

/**
 * F4, F5, F6: a tap at `p`, then `gapMs` after its release a tap on the answer that is now under the finger, or else on
 * the nearest point of the nearest one (4 px inside it), read from the page once the commit has redrawn it: a bounce
 * that lands on an answer, never on the gap a reflow may leave. `selector` names the answers; `gone` is the one the
 * first tap takes away.
 */
async function bounceOnReflow(page: Page, touch: Touchscreen, p: TouchPoint, gapMs: number, selector: string, gone: string | null): Promise<TouchPoint> {
  await touch.tap(p);
  const released = Date.now();
  const q = await page.evaluate(
    async ({ x, y, sel, skip }) => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const el of Array.from(document.querySelectorAll(sel))) {
        if (el.getAttribute('data-testid') === skip) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const at = { x: Math.min(Math.max(x, r.left + 4), r.right - 4), y: Math.min(Math.max(y, r.top + 4), r.bottom - 4) };
        const d = Math.hypot(at.x - x, at.y - y);
        if (d < bestD) [best, bestD] = [at, d];
      }
      return best;
    },
    { x: p.x, y: p.y, sel: selector, skip: gone },
  );
  if (q === null) throw new Error(`no answer left to bounce onto (${selector})`);
  const left = gapMs - (Date.now() - released);
  if (left > 0) await page.waitForTimeout(left);
  const measured = Date.now() - released;
  await touch.tap(q);
  test.info().annotations.push({ type: 'bounce', description: `${gapMs} ms bounce measured ${measured} ms, ${Math.round(Math.hypot(q.x - p.x, q.y - p.y))} px from the first tap` });
  test.skip(measured >= SLOW_BOUNCE_MS, `the ${gapMs} ms bounce landed ${measured} ms after the release (a busy machine): it tests nothing`);
  return q;
}

/** Waits until nothing on the page scrolls any more (a scroll that lands during a touch cancels it: rule 7, T15c). */
async function scrollSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const snap = (): string => JSON.stringify([window.scrollY, ...Array.from(document.querySelectorAll('*')).filter((e) => e.scrollTop > 0).map((e) => e.scrollTop)]);
    let last = snap();
    for (let i = 0; i < 40; i += 1) {
      await new Promise((r) => setTimeout(r, 120));
      const now = snap();
      if (now === last) return;
      last = now;
    }
  });
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

/** A slide from 4 px inside `from`'s edge that faces `to`, to `to`'s centre (T17). */
async function slideInto(page: Page, from: string, to: string): Promise<{ start: TouchPoint; dx: number; dy: number }> {
  const a = await boxOf(page, from);
  const b = await boxOf(page, to);
  const horizontal = Math.abs(centre(b).x - centre(a).x) >= Math.abs(centre(b).y - centre(a).y);
  const sign = horizontal ? Math.sign(centre(b).x - centre(a).x) : Math.sign(centre(b).y - centre(a).y);
  const lo = horizontal ? a.x : a.y;
  const hi = lo + (horizontal ? a.width : a.height);
  const fromEdge = (sign > 0 ? hi : lo) - sign * 4;
  const d = (horizontal ? centre(b).x : centre(b).y) - fromEdge;
  const start = horizontal ? { x: fromEdge, y: centre(a).y } : { x: centre(a).x, y: fromEdge };
  return { start, dx: horizontal ? d : 0, dy: horizontal ? 0 : d };
}

/** A move from `id`'s centre that ends 40 px outside it, on the screen and, where there is room, on no other answer. */
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
  const m = onScreen.find((mv) => !boxes.some((o) => inside({ x: c.x + mv.dx, y: c.y + mv.dy }, o))) ?? onScreen[0];
  if (m === undefined) throw new Error(`no spot on the screen 40 px outside ${id}`);
  return { start: c, ...m };
}

/** The room the nearest scrolling ancestor of `testId` has, and its offset (null when nothing scrolls). */
async function scroller(page: Page, testId: string): Promise<{ room: number; top: number } | null> {
  return page.getByTestId(testId).evaluate((el) => {
    for (let n = el.parentElement; n !== null; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return { room: n.scrollHeight - n.clientHeight, top: n.scrollTop };
    }
    return null;
  });
}

/**
 * On a screen that scrolls, a 72 px vertical drag from `testId` scrolls it by at least 20 px; `unchanged` then checks
 * nothing was committed. On a screen that fits, the case says so in an annotation (nothing to drag).
 */
async function dragScrolls(page: Page, touch: Touchscreen, testId: string, board: string, unchanged: () => Promise<void>): Promise<void> {
  await inView(page, testId);
  const sc = await scroller(page, testId);
  test.info().annotations.push({ type: 'board', description: sc === null || sc.room < 40 ? `${board} fits: no drag case` : `${board} scrolls (${sc.room} px)` });
  if (sc === null || sc.room < 40) return;
  const up = sc.room - sc.top >= sc.top;
  await touch.graze(centre(await boxOf(page, testId)), 0, up ? -72 : 72, { steps: 8 });
  await page.waitForTimeout(AFTER_LOCK);
  await unchanged();
  const after = await scroller(page, testId);
  expect(Math.abs((after?.top ?? sc.top) - sc.top), `the drag scrolled ${board}`).toBeGreaterThanOrEqual(20);
}

/** Section 11.2's matrix: 0, 8, 16, 24 and 32 px on both axes (both signs), one 900 ms hold. */
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

/** The target ratchet on one board: every control inside `within` is at least `TARGET_MIN` in both dimensions. */
async function expectNoSmallTargets(page: Page, within: string): Promise<void> {
  const all = await page.evaluate(measureTargets, within);
  expect(all.length, `${within} has controls to measure`).toBeGreaterThan(0);
  expect(all.filter((t) => isOffender(t)).map((t) => `${t.role} | ${t.name} (${Math.round(t.width)}x${Math.round(t.height)})`), `${within}: under ${TARGET_MIN}`).toEqual([]);
}
async function expectAtLeastMin(page: Page, testIds: readonly string[]): Promise<void> {
  for (const id of testIds) {
    const b = await boxOf(page, id);
    expect(Math.min(b.width, b.height), `${id} (${Math.round(b.width)}x${Math.round(b.height)})`).toBeGreaterThanOrEqual(TARGET_MIN);
  }
}

const PROFILES = [
  { name: 'phone 320, largest text', viewport: { width: 320, height: 640 }, largest: true },
  { name: 'tablet 820', viewport: { width: 820, height: 1180 }, largest: false },
] as const;

/** The largest text size, stored before the app reads its settings (as pick-one-graze.spec.ts). */
async function largestText(page: Page): Promise<void> {
  await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
}

// --- Sentence Builder ---------------------------------------------------------------------------------------------

interface SentenceLog {
  answers: Array<{ key: string; correct: boolean }>;
  completes: number;
}
type SentenceWindow = Window & { __hrSentenceE2E?: { open(params: { set: 'practice'; mode: 'quest' }): void; log(): SentenceLog } };

async function openSentence(page: Page, largest: boolean): Promise<void> {
  await page.goto('/');
  if (largest) await largestText(page);
  await page.waitForFunction(() => Boolean((window as SentenceWindow).__hrSentenceE2E), undefined, { timeout: 10_000 });
  await page.evaluate(() => (window as SentenceWindow).__hrSentenceE2E?.open({ set: 'practice', mode: 'quest' }));
  await expect(page.getByRole('heading', { name: 'Build the sentence' })).toBeVisible();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await expect(page.getByTestId('sentence-builder-tray').getByRole('button')).toHaveCount(3);
  await page.waitForTimeout(AFTER_LOCK);
}
const sentenceLog = (page: Page): Promise<SentenceLog> => page.evaluate(() => (window as SentenceWindow).__hrSentenceE2E!.log());
/** Round 1 (I eat rice.): 밥을 first, 먹어요 last, 물을 never. */
const SB = { rice: '밥을, babeul', eat: '먹어요, meogeoyo', water: '물을, mureul' } as const;
async function sbTileId(page: Page, name: string): Promise<string> {
  const id = await page.getByTestId('sentence-builder-tray').getByRole('button', { name: new RegExp(`^${name}`) }).getAttribute('data-testid');
  if (id === null) throw new Error(`no tile ${name}`);
  return id;
}

// --- Story Sequence -----------------------------------------------------------------------------------------------

type StoryWindow = Window & {
  __hrStoryE2E?: {
    openQuest(p: { questId: string; episodeId: string }): void;
    run(): { scoredRounds: string[] };
  };
};
/** The Hangul Day listen tier (as story-results.spec.ts): the check's right options, then the four steps in order. */
const CHECKS = ['a', 'a', 't'];
const ORDER = ["A king's wish", 'A new alphabet', 'Hangul Day', 'A cheer'];

async function openSequence(page: Page, largest: boolean): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  if (largest) await largestText(page);
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.waitForFunction(() => Boolean((window as StoryWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  await page.evaluate(() => (window as StoryWindow).__hrStoryE2E?.openQuest({ questId: 'quest:story-hangul-day-listen', episodeId: 'episode:shelf-hangul-day' }));
  await expect(page.getByRole('heading', { name: 'Story time' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (const right of CHECKS) {
    await pastTapLock(page);
    await page.getByTestId(`story-check-option-${right}`).click();
    await page.getByTestId('story-check-next').click();
  }
  const heading = page.getByRole('heading', { name: SEQ.title });
  const recapDone = page.getByTestId('story-recap-done');
  await expect(heading.or(recapDone)).toBeVisible();
  if (await recapDone.isVisible()) await recapDone.click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(heading).toBeVisible();
  await page.waitForTimeout(AFTER_LOCK);
}
/** The quest's scored rounds: the run store keeps a slot's first answer, so a miss on an open slot adds one. */
const scoredRounds = (page: Page): Promise<number> => page.evaluate(() => (window as StoryWindow).__hrStoryE2E!.run().scoredRounds.length);
async function sequenceCardId(page: Page, caption: string): Promise<string> {
  const id = await page.locator('[data-testid^="story-sequence-card-"]').filter({ hasText: caption }).first().getAttribute('data-testid');
  if (id === null) throw new Error(`no card ${caption}`);
  return id;
}
/** The Story Sequence cards (their art carries `-art-` in its test id). */
const SEQUENCE_CARDS = '[data-testid^="story-sequence-card-"]:not([data-testid*="-art-"])';
const sequenceCardIds = (page: Page): Promise<string[]> =>
  page.locator(SEQUENCE_CARDS).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));

// --- Story Order and its Story Sequence fallback, on the fixture scope -------------------------------------------

interface OrderLog {
  answers: Array<{ key: string; correct: boolean }>;
}
type OrderWindow = Window & { __hrStoryOrderE2E?: { open(p: unknown): void; log(): OrderLog } };
/** The captions-only morning: up, wash, eat, park (story-order-e2e-fixture.ts). */
const MORNING_IDS = STORY_ORDER_FIXTURES.captions.storyOrder!.rounds[0]!.panels.map((pl) => pl.id);

/** The morning round as Story Order (`game.story-order` on) or as its Story Sequence fallback (off), as story-checks-story-order.spec.ts. */
async function openMorning(page: Page, on: boolean, largest: boolean): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as OrderWindow).__hrStoryOrderE2E), undefined, { timeout: 10_000 });
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { 'game.story-order': { on, pct: 100 } } });
  if (largest) await largestText(page);
  await page.reload();
  await page.waitForFunction(() => Boolean((window as OrderWindow).__hrStoryOrderE2E), undefined, { timeout: 10_000 });
  await page.evaluate((scope) => (window as OrderWindow).__hrStoryOrderE2E?.open({ scope }), STORY_ORDER_FIXTURES.captions);
  await expect(page.getByTestId(on ? 'story-order-cards' : 'story-sequence-cards')).toBeVisible();
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await page.waitForTimeout(AFTER_LOCK);
}
/** Every answer the step reported: each tap, a miss included (the run store keeps only a slot's first). */
const orderAnswers = async (page: Page): Promise<number> => (await page.evaluate(() => (window as OrderWindow).__hrStoryOrderE2E!.log())).answers.length;

const MORNING_BOARDS = [
  { name: 'Story Sequence (Story Order fallback, text cards)', on: false, prefix: 'story-sequence-card-', cards: 'story-sequence-cards' },
  { name: 'Story Order', on: true, prefix: 'story-order-card-', cards: 'story-order-cards' },
] as const;

// --- Placement ----------------------------------------------------------------------------------------------------

type PlacementWindow = Window & { __hrPlacementE2E?: { open(source: string): void; events(): Array<{ name: string; payload?: Record<string, unknown> }> } };

async function openItems(page: Page, largest: boolean): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await page.getByRole('radio', { name: /^Me\./ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder('Type a name').fill('Sam');
  await page.getByRole('radio', { name: /^Some reading/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await answerForkNew(page);
  await page.getByRole('button', { name: 'Start my journey' }).click();
  await waitForSaved(page, ['profiles']);
  await page.goto('/');
  if (largest) await largestText(page);
  await expect(page.getByText('Hi, Sam!')).toBeVisible();
  await startItems(page);
}
/** Opens the level check and plays it to its first item (again after a run ends: a new run). */
async function startItems(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as PlacementWindow).__hrPlacementE2E), undefined, { timeout: 10_000 });
  await page.evaluate(() => (window as PlacementWindow).__hrPlacementE2E?.open('home'));
  await passPlacementLanguage(page);
  await expect(page.getByTestId('placement-options')).toBeVisible();
  await page.getByTestId('placement-guide-tap').click();
  await page.getByTestId('placement-next').click();
  await expect(page.getByTestId('placement-warmup')).toBeVisible();
  await page.getByTestId('placement-warmup-speaker').click();
  // The pictures wait for the sound check (placement-screens.spec.ts `warmUp`): the note without sound, or Hear it again.
  await expect(page.getByTestId('placement-no-sound-note').or(page.getByRole('button', { name: 'Hear it again' })).first()).toBeVisible();
  await pastTapLock(page);
  await page.getByTestId('placement-warmup-option-rice').click();
  await expect(page.getByTestId('placement-item')).toBeVisible();
  await page.waitForTimeout(AFTER_LOCK);
}
const answeredItems = async (page: Page): Promise<number> =>
  (await page.evaluate(() => (window as PlacementWindow).__hrPlacementE2E?.events() ?? [])).filter((e) => e.name === 'placement.item_answered').length;
const optionIds = (page: Page): Promise<string[]> =>
  page.locator('[data-testid^="placement-option-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));

for (const profile of PROFILES) {
  test.describe(`KT-5 boards under touch, ${profile.name} (AMENDMENTS-TOUCH KT-5, section 11.2)`, () => {
    test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1, build:web:fixtures)');
    test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

    test('Story Sequence: a 150 ms bounce on the reflowed card is no miss (F4); grazes commit; outside and slide commit nothing', async ({ page }) => {
      test.setTimeout(120_000);
      await openSequence(page, profile.largest);
      await expectNoSmallTargets(page, 'story-sequence-cards');
      const touch = await Touchscreen.of(page);
      const tryAnother = page.getByText(SEQ.tryAnother, { exact: true });
      const checks = await scoredRounds(page);
      const scoredSlots = async (): Promise<number> => (await scoredRounds(page)) - checks;

      // F4: the first card right, then 150 ms after its release a tap where the finger was (the row has reflowed).
      const first = await sequenceCardId(page, ORDER[0]!);
      const p = centre(await inView(page, first));
      await bounceOnReflow(page, touch, p, 150, SEQUENCE_CARDS, first);
      await expect.poll(() => scoredSlots()).toBe(1);
      await page.waitForTimeout(AFTER_LOCK);
      expect(await scoredSlots(), 'the bounce scored no miss').toBe(1);
      await expect(tryAnother).toHaveCount(0);

      const ids = await sequenceCardIds(page);
      const right = await sequenceCardId(page, ORDER[1]!);
      const wrong = ids.find((id) => id !== right)!;

      // On a screen that scrolls, a 72 px vertical drag from a card scrolls it and scores nothing (T15b).
      await dragScrolls(page, touch, wrong, 'Story Sequence', async () => {
        expect(await scoredSlots(), '72 px drag').toBe(1);
        await expect(tryAnother).toHaveCount(0);
      });

      // A release 40 px outside a card and a slide into its neighbour commit nothing.
      await inView(page, wrong);
      const out = await outsideRelease(page, wrong, ids);
      await touch.graze(out.start, out.dx, out.dy, { steps: 6 });
      await inView(page, wrong);
      const deep = await slideInto(page, wrong, await nearest(page, wrong, ids));
      await touch.graze(deep.start, deep.dx, deep.dy, { steps: 6 });
      await page.waitForTimeout(AFTER_LOCK);
      expect(await scoredSlots(), 'outside or slide').toBe(1);
      await expect(tryAnother).toHaveCount(0);

      // Grazes on both axes commit the right card each time: 32 px down, 32 px across, then a 900 ms hold.
      for (const [i, g] of [
        { dx: 0, dy: 32 },
        { dx: -32, dy: 0 },
        { dx: 0, dy: 0, holdMs: 900 },
      ].entries()) {
        const id = await sequenceCardId(page, ORDER[i + 1]!);
        await touch.graze(centre(await inView(page, id)), g.dx, g.dy, { steps: 4, holdMs: g.holdMs ?? 0 });
        await expect(page.getByTestId(id), `graze ${g.dx},${g.dy}`).toHaveCount(0);
        await page.waitForTimeout(AFTER_LOCK);
      }
      expect(await scoredSlots()).toBe(4);
      await expect(tryAnother).toHaveCount(0);
    });

    for (const gap of [60, 150, 200]) {
      test(`Sentence Builder: a bounce ${gap} ms after a right tile, on the tile that slid under the finger, is no miss (F5)`, async ({ page }) => {
        await openSentence(page, profile.largest);
        const touch = await Touchscreen.of(page);
        // 밥을 is placed and the tray reflows: a tap `gap` ms later where the finger was lands on another tile.
        const rice = await sbTileId(page, SB.rice);
        const pr = centre(await inView(page, rice));
        await bounceOnReflow(page, touch, pr, gap, '[data-testid="sentence-builder-tray"] [role="button"]', rice);
        await expect(page.getByLabel(`Place 1 of 2: ${SB.rice}`)).toBeVisible();
        await page.waitForTimeout(AFTER_RETURN);
        expect((await sentenceLog(page)).answers, `the ${gap} ms bounce scored no miss`).toEqual([]);
        await expect(page.getByTestId('sentence-builder-returning')).toHaveCount(0);
        await expect(page.getByLabel('Place 2 of 2, empty, next', { exact: true })).toBeVisible();
      });
    }

    test('Sentence Builder: the graze matrix, outside, slide and drag on the tray', async ({ page }) => {
      test.setTimeout(180_000);
      await openSentence(page, profile.largest);
      await expectNoSmallTargets(page, 'sentence-builder-tray');
      await expectAtLeastMin(page, ['sentence-builder-skip']);
      const touch = await Touchscreen.of(page);

      // 밥을 first, so the tray holds the two words the matrix needs.
      await touch.tap(centre(await inView(page, await sbTileId(page, SB.rice))));
      await expect(page.getByLabel(`Place 1 of 2: ${SB.rice}`)).toBeVisible();
      await page.waitForTimeout(AFTER_LOCK);

      // The matrix: each graze on 물을 (never right) is a miss, recorded; 먹어요 stays for the end.
      const water = await sbTileId(page, SB.water);
      const tray = [water, await sbTileId(page, SB.eat)];
      let misses = 0;
      for (const g of MATRIX) {
        await touch.graze(centre(await inView(page, water)), g.dx, g.dy, { steps: 4, holdMs: g.holdMs ?? 0 });
        misses += 1;
        await expect.poll(async () => (await sentenceLog(page)).answers.length, { message: `graze ${g.dx},${g.dy}` }).toBe(misses);
        await page.waitForTimeout(AFTER_RETURN);
      }

      // A release 40 px outside a tile and a slide into its neighbour commit nothing.
      await inView(page, water);
      const out = await outsideRelease(page, water, tray);
      await touch.graze(out.start, out.dx, out.dy, { steps: 6 });
      await inView(page, water);
      const deep = await slideInto(page, water, await nearest(page, water, tray));
      await touch.graze(deep.start, deep.dx, deep.dy, { steps: 6 });
      await page.waitForTimeout(AFTER_RETURN);
      expect((await sentenceLog(page)).answers, 'outside or slide').toHaveLength(misses);
      await expect(page.getByLabel('Place 2 of 2, empty, next', { exact: true })).toBeVisible();

      // On a scrolling screen, a 72 px vertical drag from a tile scrolls the page and commits nothing (T15b).
      await dragScrolls(page, touch, water, 'Sentence Builder', async () => {
        expect((await sentenceLog(page)).answers, '72 px drag').toHaveLength(misses);
      });

      // The last word builds the sentence (the 100 ms bounce on Skip is the next test).
      await pastTapLock(page);
      await touch.tap(centre(await inView(page, await sbTileId(page, SB.eat))));
      await expect(page.getByTestId('sentence-builder-done')).toBeVisible();
      expect((await sentenceLog(page)).completes).toBe(0);
    });

    for (const b of MORNING_BOARDS) {
      test(`${b.name}: F4 and 60 ms bounces on the reflowed card are no miss; the graze matrix; outside, slide and drag`, async ({ page }) => {
        test.setTimeout(180_000);
        await openMorning(page, b.on, profile.largest);
        await expectNoSmallTargets(page, b.cards);
        const touch = await Touchscreen.of(page);
        const ids = (): Promise<string[]> =>
          page.locator(`[data-testid^="${b.prefix}"]`).evaluateAll((els, prefix) => els.map((e) => e.getAttribute('data-testid') ?? '').filter((id) => /^[a-z]+$/.test(id.slice(prefix.length))), b.prefix);
        let answers = 0;

        // F4 at 150 ms, then 60 ms: a right card leaves, the cards reflow, a tap where the finger was is no miss.
        for (const [i, gap] of [150, 60].entries()) {
          const right = `${b.prefix}${MORNING_IDS[i]!}`;
          const p = centre(await inView(page, right));
          await bounceOnReflow(page, touch, p, gap, (await ids()).map((id) => `[data-testid="${id}"]`).join(', '), right);
          answers += 1;
          await expect.poll(() => orderAnswers(page), { message: `the right card ${MORNING_IDS[i]}` }).toBe(answers);
          await page.waitForTimeout(AFTER_LOCK);
          expect(await orderAnswers(page), `the ${gap} ms bounce scored no miss`).toBe(answers);
        }

        // Left: eat (right next) and park (never right before it).
        const park = `${b.prefix}park`;

        // On a screen that scrolls, a 72 px vertical drag from a card scrolls it and scores nothing (T15b).
        await dragScrolls(page, touch, park, b.name, async () => {
          expect(await orderAnswers(page), '72 px drag').toBe(answers);
        });

        // The matrix on park: each graze is one miss.
        for (const g of MATRIX) {
          await touch.graze(centre(await inView(page, park)), g.dx, g.dy, { steps: 4, holdMs: g.holdMs ?? 0 });
          answers += 1;
          await expect.poll(() => orderAnswers(page), { message: `graze ${g.dx},${g.dy}` }).toBe(answers);
          await page.waitForTimeout(AFTER_LOCK);
        }

        // A release 40 px outside a card and a slide into its neighbour commit nothing.
        const left = await ids();
        await inView(page, park);
        const out = await outsideRelease(page, park, left);
        await touch.graze(out.start, out.dx, out.dy, { steps: 6 });
        await inView(page, park);
        const deep = await slideInto(page, park, await nearest(page, park, left));
        await touch.graze(deep.start, deep.dx, deep.dy, { steps: 6 });
        await page.waitForTimeout(AFTER_LOCK);
        expect(await orderAnswers(page), 'outside or slide').toBe(answers);

      });
    }

    test('Sentence Builder: a tap on Skip 100 ms after a tile is ignored; after the lock Skip ends the step (F5)', async ({ page }) => {
      await openSentence(page, profile.largest);
      const touch = await Touchscreen.of(page);
      // Both points before the first tap, so the 100 ms is measured from its release to the second touch-down.
      const riceId = await sbTileId(page, SB.rice);
      await page.getByTestId('sentence-builder-skip').evaluate((el) => el.scrollIntoView({ block: 'end' }));
      await scrollSettled(page);
      const rice = centre(await boxOf(page, riceId));
      const skip = centre(await boxOf(page, 'sentence-builder-skip'));
      const vh = page.viewportSize()!.height;
      expect(rice.y > 0 && rice.y < vh && skip.y > 0 && skip.y < vh, 'the tile and Skip are both on the screen').toBe(true);
      await bounce(page, touch, rice, skip, 100);
      await page.waitForTimeout(AFTER_LOCK);
      expect((await sentenceLog(page)).completes).toBe(0);
      await expect(page.getByLabel(`Place 1 of 2: ${SB.rice}`)).toBeVisible();
      await touch.tap(centre(await inView(page, 'sentence-builder-skip')));
      await expect.poll(async () => (await sentenceLog(page)).completes).toBe(1);
    });

    test('Placement: two taps 150 ms apart across the item change are one placement.item_answered (F6); grazes, outside, slide and drag', async ({ page }) => {
      test.setTimeout(180_000);
      await openItems(page, profile.largest);
      await expectAtLeastMin(page, [...(await optionIds(page)), 'placement-not-sure']);
      const touch = await Touchscreen.of(page);

      // F6: a tap on a choice, and 150 ms after its release a tap at the same place, on the next item's choice.
      const first = (await optionIds(page))[0]!;
      const p = centre(await inView(page, first));
      await bounceOnReflow(page, touch, p, 150, '[data-testid^="placement-option-"]', null);
      await expect.poll(() => answeredItems(page)).toBe(1);
      await page.waitForTimeout(AFTER_LOCK);
      expect(await answeredItems(page), 'the bounce answered no second item').toBe(1);
      let answered = 1;

      // A release 40 px outside a choice and a slide into its neighbour commit nothing.
      const ids = await optionIds(page);
      const a = ids[0]!;
      await inView(page, a);
      const out = await outsideRelease(page, a, [...ids, 'placement-not-sure']);
      await touch.graze(out.start, out.dx, out.dy, { steps: 6 });
      await inView(page, a);
      const deep = await slideInto(page, a, await nearest(page, a, ids));
      await touch.graze(deep.start, deep.dx, deep.dy, { steps: 6 });
      await page.waitForTimeout(AFTER_LOCK);
      expect(await answeredItems(page), 'outside or slide').toBe(answered);

      // On a scrolling screen, a 72 px vertical drag from a choice scrolls the page and answers nothing (T15b).
      await dragScrolls(page, touch, a, 'the level check item', async () => {
        expect(await answeredItems(page), '72 px drag').toBe(answered);
      });

      // A bounce 60 ms after an answer, where the finger was, is no second answer.
      const q = centre(await inView(page, (await optionIds(page))[0]!));
      await bounceOnReflow(page, touch, q, 60, '[data-testid^="placement-option-"]', null);
      answered += 1;
      await expect.poll(() => answeredItems(page)).toBe(answered);
      await page.waitForTimeout(AFTER_LOCK);
      expect(await answeredItems(page), 'the 60 ms bounce answered no second item').toBe(answered);

      // The whole matrix: each graze answers one item, on a choice or on "not sure" in turn, over as many runs as it takes.
      let runs = 1;
      for (const g of MATRIX) {
        // A run is two to four rungs of three: when it ends, the next graze starts a new one.
        if (!(await page.getByTestId('placement-item').isVisible())) {
          // The result screen closes to Home (the same page, so the events so far are kept), then a new run.
          await expect(page.getByTestId('placement-result')).toBeVisible();
          await pastTapLock(page);
          await page.getByTestId('screen-header-close').click();
          await expect(page.getByTestId('placement-result')).toHaveCount(0);
          await startItems(page);
          runs += 1;
        }
        const target = answered % 2 === 0 ? 'placement-not-sure' : (await optionIds(page))[0]!;
        await touch.graze(centre(await inView(page, target)), g.dx, g.dy, { steps: 4, holdMs: g.holdMs ?? 0 });
        answered += 1;
        await expect.poll(() => answeredItems(page), { message: `graze ${g.dx},${g.dy} on ${target}` }).toBe(answered);
        await page.waitForTimeout(AFTER_LOCK);
      }
      test.info().annotations.push({ type: 'matrix', description: `${MATRIX.length} grazes over ${runs} runs` });
    });
  });
}
