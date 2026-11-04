import type { Locator, Page } from '@playwright/test';
import { HiddenHeritageRoundSchema } from '@hangul-route/content-schema';
import { LIBRARY_SCENE } from '@hangul-route/content-schema/testing/role-play';
import { FOOD_MARKET_SCENE } from '@hangul-route/design-system/src/scene-art/hidden-heritage/food-market';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, journeyCellName, keepSidewaysIfAsked, passDiscover, seedStored } from './helpers';
import { Touchscreen, type TouchPoint } from './touch';

/**
 * AMENDMENTS-TOUCH row KT-6, section 11.2 for this row's boards: Hidden Heritage's spots (the graze matrix; a
 * release 40 px outside and a slide into a neighbour commit nothing and leave no press look; in the narrow latch a
 * sideways drag past 32 px scrolls the scene and a vertical drag on a spot moves nothing), Write Frame's word pick and
 * Role Play's replies (fixture build), Build a Letter (a bounce on the tray never reaches a slot; a slot takes its tile
 * back) and Match Shape (grazes commit) in the release build. The hit-area ratchet of these games is `target-size.spec.ts`
 * (release build) and `realia-read-hidden-heritage-hit-areas.spec.ts` (F8, fixture build). KT-11 runs the whole matrix over every board.
 *
 * The file's name starts with `realia-read-` so the fixture e2e run of the PWA workflow, which selects spec files by
 * name, runs its fixture half; its Build a Letter and Match Shape tests skip there and run in the release build.
 *
 * Profiles: 320 x 640 with touch and the largest text size (the screens scroll), and the 820 x 1180 tablet (they fit).
 *
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test realia-read-hidden-heritage-touch   (the fixture half)
 *   pnpm --filter @hangul-route/mobile exec playwright test realia-read-hidden-heritage-touch                    (the release half)
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Past the 400 ms lock, with room for a busy machine's slow event dispatch. */
const AFTER_LOCK = 700;
/** Past the lock and Hidden Heritage's 600 ms miss ring. */
const AFTER_MISS = 1_000;
const en = getMessages('en');

type Box = { x: number; y: number; width: number; height: number };
const centre = (b: Box): TouchPoint => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

async function boxOf(target: Locator): Promise<Box> {
  const box = await target.boundingBox();
  if (box === null) throw new Error('no box');
  return box;
}

/** Scrolls an element to the middle of the screen if it is near an edge, then returns its box. */
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
];

const PROFILES = [
  { name: 'phone 320, largest text', viewport: { width: 320, height: 640 }, largest: true },
  { name: 'tablet 820', viewport: { width: 820, height: 1180 }, largest: false },
] as const;

async function largestText(page: Page): Promise<void> {
  await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
}

/** The page's own vertical scroller (the nearest scrolling ancestor), or null. */
async function pageScroll(target: Locator): Promise<{ room: number; top: number } | null> {
  return target.evaluate((el) => {
    for (let n = el.parentElement; n !== null; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return { room: n.scrollHeight - n.clientHeight, top: n.scrollTop };
    }
    return null;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Hidden Heritage, Write Frame, Role Play: the fixture build's e2e screens.

type HhWindow = Window & {
  __hrHiddenHeritageE2E?: { open(p: { sceneId?: string }): void; log(): { answers: Array<{ key: string; correct: boolean }>; completed: number } };
};

async function openScene(page: Page, sceneId: string, largest: boolean): Promise<void> {
  await page.goto('/');
  if (largest) await largestText(page);
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 86_400, flags: { 'game.hidden-heritage': { on: true, pct: 100 } } });
  await page.reload();
  await page.waitForFunction(() => Boolean((window as HhWindow).__hrHiddenHeritageE2E), undefined, { timeout: 10_000 });
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await page.evaluate((id) => (window as HhWindow).__hrHiddenHeritageE2E?.open({ sceneId: id }), sceneId);
  await expect(page.getByTestId('hh-scene')).toBeVisible({ timeout: 15_000 });
}
const hhAnswers = async (page: Page): Promise<number> => (await page.evaluate(() => (window as HhWindow).__hrHiddenHeritageE2E!.log())).answers.length;

/** The thing ids of a scene in the order `spotHitRects` takes them, with their spots. */
function things(scene: typeof FOOD_MARKET_SCENE): Array<{ id: string; spot: { x: number; y: number; w: number; h: number } }> {
  const round = HiddenHeritageRoundSchema.parse(scene.round);
  return [...round.targets, ...round.others].map((t) => ({ id: t.id, spot: t.spot }));
}

for (const profile of PROFILES) {
  test.describe(`Hidden Heritage, Write Frame and Role Play under touch, ${profile.name} (AMENDMENTS-TOUCH KT-6, 11.2)`, () => {
    test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');
    test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

    test('Hidden Heritage: every graze of the matrix commits; outside and a slide commit nothing and leave no press look', async ({ page }) => {
      test.setTimeout(120_000);
      await openScene(page, 'scene:food-market', profile.largest);
      const touch = await Touchscreen.of(page);
      // A thing that is never asked (an "other"): every tap on it is one more scored answer, a miss, and the round goes on.
      const round = HiddenHeritageRoundSchema.parse(FOOD_MARKET_SCENE.round);
      const other = round.others[0]!.id;
      const spot = page.getByTestId(`hh-spot-${other}`);
      await page.waitForTimeout(AFTER_LOCK);

      for (const g of MATRIX) {
        const before = await hhAnswers(page);
        await touch.graze(centre(await inView(spot)), g.dx, g.dy, { steps: 4, holdMs: g.holdMs ?? 0 });
        await expect.poll(() => hhAnswers(page), { message: `graze ${g.dx},${g.dy}` }).toBe(before + 1);
        await page.waitForTimeout(AFTER_MISS);
      }

      // 40 px outside the hit area, on the scene's free side: nothing, and no press look stays.
      let before = await hhAnswers(page);
      const b = await inView(spot);
      const scene = await boxOf(page.getByTestId('hh-scene'));
      const down = b.y + b.height / 2 > scene.y + scene.height / 2 ? -1 : 1;
      await touch.graze(centre(b), 0, down * (b.height / 2 + 40), { steps: 6 });
      await page.waitForTimeout(AFTER_LOCK);
      expect(await hhAnswers(page), 'released 40 px outside').toBe(before);
      await expect(page.getByTestId('hh-press')).toHaveCount(0);

      // A slide from one spot deep into its nearest neighbour: nothing.
      const ids = things(FOOD_MARKET_SCENE).map((t) => t.id).filter((id) => id !== other);
      let nearest = ids[0]!;
      let best = Infinity;
      for (const id of ids) {
        const d = Math.hypot(centre(await boxOf(page.getByTestId(`hh-spot-${id}`))).x - centre(b).x, centre(await boxOf(page.getByTestId(`hh-spot-${id}`))).y - centre(b).y);
        if (d < best) [nearest, best] = [id, d];
      }
      const to = centre(await boxOf(page.getByTestId(`hh-spot-${nearest}`)));
      before = await hhAnswers(page);
      await touch.graze(centre(await inView(spot)), to.x - centre(b).x, to.y - centre(b).y, { steps: 8 });
      await page.waitForTimeout(AFTER_LOCK);
      expect(await hhAnswers(page), 'slid into the neighbour').toBe(before);
      await expect(page.getByTestId('hh-press')).toHaveCount(0);

      // On a scrolling screen, a 72 px vertical drag from a spot scrolls the page and commits nothing.
      const from = centre(await inView(spot));
      const sc = await pageScroll(spot);
      if (sc !== null && sc.room >= 40) {
        before = await hhAnswers(page);
        const up = sc.room - sc.top >= sc.top;
        await touch.graze(from, 0, up ? -72 : 72, { steps: 8 });
        await page.waitForTimeout(AFTER_LOCK);
        expect(await hhAnswers(page), '72 px drag').toBe(before);
        expect(Math.abs(((await pageScroll(spot))?.top ?? sc.top) - sc.top), 'the drag scrolled the page').toBeGreaterThanOrEqual(20);
      }
    });

    test('Write Frame word pick: grazes on both axes pick the word; 40 px outside picks nothing', async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto('/');
      if (profile.largest) await largestText(page);
      await page.waitForFunction(() => Boolean((window as WfWindow).__hrWriteFrameE2E), undefined, { timeout: 10_000 });
      await page.evaluate(() => (window as WfWindow).__hrWriteFrameE2E?.open({ rounds: [], story: 'on' }));
      await expect(page.getByTestId('write-frame')).toBeVisible({ timeout: 10_000 });
      await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
      const touch = await Touchscreen.of(page);
      const word = page.getByTestId('write-frame-word-1');
      await expect(word).toBeVisible();
      await page.waitForTimeout(AFTER_LOCK);

      // 40 px outside the card (below it, or above where it is the last row): no pick, the bank stays.
      const b = await inView(word);
      await touch.graze(centre(b), 0, -(b.height / 2 + 40), { steps: 6 });
      await page.waitForTimeout(AFTER_LOCK);
      await expect(page.getByTestId('write-frame-change-word')).toHaveCount(0);

      for (const g of [{ dx: 0, dy: 16 }, { dx: 24, dy: 0 }, { dx: 0, dy: -32 }, { dx: -32, dy: 0 }]) {
        await touch.graze(centre(await inView(word)), g.dx, g.dy, { steps: 4 });
        await expect(page.getByTestId('write-frame-change-word'), `graze ${g.dx},${g.dy}`).toBeVisible();
        await page.waitForTimeout(AFTER_LOCK);
        await page.getByTestId('write-frame-change-word').click();
        await expect(word).toBeVisible();
        await page.waitForTimeout(AFTER_LOCK);
      }
    });

    test('Role Play replies: a 32 px graze sends the reply; 40 px outside sends nothing', async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto('/');
      await keepSidewaysIfAsked(page);
      await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { 'game.role-play': { on: true, pct: 100 } } });
      if (profile.largest) await largestText(page);
      await page.waitForFunction(() => Boolean((window as RpWindow).__hrRolePlayE2E), undefined, { timeout: 10_000 });
      await page.evaluate((scene) => (window as RpWindow).__hrRolePlayE2E?.open({ scene }), LIBRARY_SCENE as unknown);
      await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
      const replies = page.locator('[data-testid^="role-play-reply-"]');
      await expect(replies.first()).toBeVisible({ timeout: 10_000 });
      const touch = await Touchscreen.of(page);
      const answers = async (): Promise<number> => (await page.evaluate(() => (window as RpWindow).__hrRolePlayE2E!.log())).answers.length;
      await page.waitForTimeout(AFTER_LOCK);
      const first = replies.first();
      const b = await inView(first);
      await touch.graze(centre(b), b.width / 2 + 40 < page.viewportSize()!.width - centre(b).x ? b.width / 2 + 40 : -(b.width / 2 + 40), 0, { steps: 6 });
      await page.waitForTimeout(AFTER_LOCK);
      expect(await answers(), 'released 40 px outside').toBe(0);
      await touch.graze(centre(await inView(first)), 0, 32, { steps: 4 });
      await expect.poll(answers).toBe(1);
    });
  });
}

type WfWindow = Window & { __hrWriteFrameE2E?: { open(params: { rounds: string[]; story?: 'on' | 'off' | 'long' }): void } };
type RpWindow = Window & { __hrRolePlayE2E?: { open(params: { scene: unknown }): void; log(): { answers: unknown[] } } };

test.describe('Hidden Heritage in the narrow latch: the scene scrolls sideways under its board (AMENDMENTS-TOUCH 6.6)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  test('a sideways drag past 32 px on a spot scrolls the scene; a vertical drag on a spot moves nothing; a graze still counts', async ({ page }) => {
    test.setTimeout(90_000);
    await openScene(page, 'scene:food-market', false);
    const touch = await Touchscreen.of(page);
    const round = HiddenHeritageRoundSchema.parse(FOOD_MARKET_SCENE.round);
    const other = round.others[0]!.id;
    await page.waitForTimeout(AFTER_LOCK);
    // The first answer latches the scene, then a split screen narrows the window: the scene keeps 256 dp and scrolls.
    await touch.tap(centre(await inView(page.getByTestId(`hh-spot-${other}`))));
    await expect.poll(() => hhAnswers(page)).toBe(1);
    await page.setViewportSize({ width: 260, height: 640 });
    const scroller = page.getByTestId('hh-scene-scroll');
    await expect(scroller).toBeVisible();
    const left = (): Promise<number> => scroller.evaluate((el) => {
      for (const n of [el, ...Array.from(el.querySelectorAll('*'))]) if (n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible') return n.scrollLeft;
      return -1;
    });
    expect(await left(), 'the scene scrolls sideways').toBeGreaterThanOrEqual(0);
    await page.waitForTimeout(AFTER_MISS);

    // The left-most spot: a sideways drag to the left from it, past 32 px, scrolls the scene and commits nothing.
    const spots = things(FOOD_MARKET_SCENE);
    const lefts = await Promise.all(spots.map(async (t) => ({ id: t.id, b: await boxOf(page.getByTestId(`hh-spot-${t.id}`)) })));
    const start = lefts.filter((s) => s.b.x >= 0 && s.b.x + s.b.width <= 260).sort((a, z) => z.b.x - a.b.x)[0]!;
    let at = await left();
    await touch.graze(centre(start.b), -72, 0, { steps: 8 });
    await page.waitForTimeout(AFTER_LOCK);
    expect(await hhAnswers(page), 'the sideways drag answered nothing').toBe(1);
    expect(await left(), 'the sideways drag scrolled the scene').toBeGreaterThan(at + 20);

    // A vertical drag on a spot: nothing answers and the scene does not move sideways.
    at = await left();
    const visibleSpot = (await Promise.all(spots.map(async (t) => ({ id: t.id, b: await boxOf(page.getByTestId(`hh-spot-${t.id}`)) })))).find((s) => s.b.x >= 0 && s.b.x + s.b.width <= 260)!;
    await touch.graze(centre(visibleSpot.b), 0, 72, { steps: 8 });
    await page.waitForTimeout(AFTER_LOCK);
    expect(await hhAnswers(page), 'the vertical drag answered nothing').toBe(1);
    expect(await left()).toBe(at);

    // A 24 px sideways graze on a spot still counts.
    await touch.graze(centre(visibleSpot.b), 24, 0, { steps: 4 });
    await expect.poll(() => hhAnswers(page)).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Build a Letter and Match Shape: the release build.

async function startGuestQuest(page: Page, largest: boolean): Promise<void> {
  if (largest) {
    await page.goto('/');
    await largestText(page);
  }
  await page.goto('/?try=1');
  await expect(page.getByText('Hi from Hoya', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: en.learner.quest.continue.cta, exact: true }).click();
  await passDiscover(page);
}

const slotJamo = async (page: Page): Promise<string[]> => {
  const slots = page.locator('[data-testid^="build-letter-slot-"]');
  return (await slots.allInnerTexts()).map((t) => t.trim());
};

for (const profile of PROFILES) {
  test.describe(`Build a Letter and Match Shape under touch, ${profile.name} (AMENDMENTS-TOUCH KT-6, 6.5, 11.2)`, () => {
    test.skip(FIXTURE_BUILD, 'the release build: the guest quest and the learner journey');
    test.use({ viewport: profile.viewport, hasTouch: true, isMobile: true });

    test('Build a Letter: grazes place tiles; a bounce on the tray never reaches a slot; a slot takes its tile back', async ({ page }) => {
      test.setTimeout(120_000);
      await startGuestQuest(page, profile.largest);
      // The quest's Match Sound step is skipped; its next game is Build a Letter.
      await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta, exact: true }).click();
      await page.getByRole('button', { name: en.learner.quest.launcher.game.play.cta }).click();
      await expect(page.getByText('Build this letter')).toBeVisible();
      const touch = await Touchscreen.of(page);
      const tiles = page.locator('[data-testid^="build-letter-tile-"]');
      await expect(tiles.first()).toBeVisible();
      const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
      await page.waitForTimeout(AFTER_LOCK);

      // A 16 px graze on the first tile places it in the first slot.
      const first = page.getByTestId(ids[0]!);
      await touch.graze(centre(await inView(first)), 0, 16, { steps: 4 });
      await expect.poll(async () => (await slotJamo(page))[0]).not.toBe('');
      const placed = (await slotJamo(page))[0];
      await expect(first).toHaveAttribute('aria-disabled', 'true');
      // A bounce on the same (now used) tile, 60 and 150 ms after: nothing moves, the slot keeps it.
      for (const gap of [60, 150]) {
        await page.waitForTimeout(gap);
        await touch.tap(centre(await boxOf(first)));
      }
      await page.waitForTimeout(AFTER_LOCK);
      expect((await slotJamo(page))[0], 'the bounce took nothing back').toBe(placed);
      expect((await slotJamo(page)).filter((s) => s !== '').length, 'and placed nothing more').toBe(1);

      // 3 px outside the filled slot: nothing; a tap inside it: the tile goes back to the tray.
      const slot = page.getByTestId('build-letter-slot-0');
      await expect(slot).toHaveAttribute('aria-label', /^Take back /);
      const s = await inView(slot);
      await touch.tap({ x: s.x - 3, y: s.y + s.height / 2 });
      await page.waitForTimeout(AFTER_LOCK);
      expect((await slotJamo(page))[0]).toBe(placed);
      await touch.graze(centre(s), 8, 0, { steps: 2 });
      await expect.poll(async () => (await slotJamo(page))[0]).toBe('');
      await expect(first).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('Match Shape: grazes on both axes commit an answer; 40 px outside commits nothing', async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto('/');
      await keepSidewaysIfAsked(page);
      await page.getByRole('button', { name: "Let's start" }).click();
      await completeChildForm(page, { name: 'Dami' });
      await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { 'game.match-shape': { on: true, pct: 100 } } });
      if (profile.largest) await largestText(page);
      await page.goto('/');
      await expect(page.getByText('Hi, Dami!')).toBeVisible();
      const guide = page.getByTestId('install-guide');
      await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
      if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
      await page.getByText('Journey', { exact: true }).last().click();
      await page.getByRole('button', { name: journeyCellName(1, 'Play & Crafts') }).click();
      await page.getByRole('button', { name: 'Start', exact: true }).nth(3).click();
      await page.getByRole('button', { name: 'Play anyway' }).click();
      await expect(headerClose(page)).toBeVisible();
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.getByRole('button', { name: 'Play minigame' }).click();
      await expect(page.getByTestId('match-shape-game')).toBeVisible();
      const touch = await Touchscreen.of(page);
      await page.waitForTimeout(AFTER_LOCK);

      // Round 1 is ㄴ from its shape; ㄱ is a miss (amber, Hoya's line), then ㄴ is right (Continue).
      const wrong = page.getByTestId('match-shape-tile-jamo:giyeok');
      const b = await inView(wrong);
      await touch.graze(centre(b), 0, -(b.height / 2 + 40), { steps: 6 });
      await page.waitForTimeout(AFTER_LOCK);
      await expect(page.getByTestId('match-shape-hoya')).toHaveCount(0);
      await touch.graze(centre(await inView(wrong)), 24, 0, { steps: 4 });
      await expect(page.getByTestId('match-shape-hoya')).toBeVisible();
      await page.waitForTimeout(AFTER_LOCK);
      await touch.graze(centre(await inView(page.getByTestId('match-shape-tile-jamo:nieun'))), 0, 32, { steps: 4 });
      await expect(page.getByTestId('match-shape-continue')).toBeVisible();
    });
  });
}
