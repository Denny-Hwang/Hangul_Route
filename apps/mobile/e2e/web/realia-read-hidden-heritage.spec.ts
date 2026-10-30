import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedStored, seedStoredAll } from './helpers';
import { expectNoClippedText, expectNoSidewaysScroll } from './text-fit';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-36: Hidden Heritage (design/wireframes/minigame/hidden-heritage.md, mock
 * design/screens/journey-topic-pages/mock/hidden-heritage.html). No lesson cell plays it until the Food Volume 2 cell
 * ships, so this suite opens the step on the Food market scene's reference round through `window.__hrHiddenHeritageE2E`,
 * which exists only in the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test realia-read-hidden-heritage
 *
 * The file is named under `realia-read` (its sibling scene game) so the fixture e2e run's `realia-read` entry in
 * .github/workflows/web-app.yml selects it, the way sentence-builder-* and write-frame-* specs ride their parents.
 *
 * `game.hidden-heritage` ships at built-in pct 0, so each case seeds the stored remote copy. Speech is the silent
 * engine of ./fixtures (no voice: the written word with romanization carries the round).
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const SHAME = /\b(wrong|fail\w*|missed|lost|lose|score)\b|%/i;
const THINGS = ['jar', 'basket', 'rice', 'soup', 'kimchi', 'chopsticks'];
const TARGETS: Record<string, { id: string; meaning: string }> = {
  밥: { id: 'bap', meaning: 'rice' },
  김치: { id: 'gimchi', meaning: 'kimchi' },
  젓가락: { id: 'jeotgarak', meaning: 'chopsticks' },
};

type E2eWindow = Window & { __hrHiddenHeritageE2E?: { open(p: { missing?: boolean; sceneId?: string }): void; log(): { answers: Array<{ key: string; correct: boolean }>; completed: number } } };

async function open(page: Page, gameOn: boolean, missing = false, sceneId?: string): Promise<void> {
  await page.goto('/');
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 86_400, flags: { 'game.hidden-heritage': { on: gameOn, pct: gameOn ? 100 : 0 } } });
  await page.reload();
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrHiddenHeritageE2E), undefined, { timeout: 10_000 });
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
  await page.evaluate(([m, id]) => (window as E2eWindow).__hrHiddenHeritageE2E?.open({ missing: m as boolean, ...(id ? { sceneId: id as string } : {}) }), [missing, sceneId ?? ''] as const);
}

const spot = (page: Page, id: string) => page.getByTestId(`hh-spot-${id}`);
const log = (page: Page) => page.evaluate(() => (window as E2eWindow).__hrHiddenHeritageE2E!.log());

/** The Korean word Hoya asks now. */
async function asked(page: Page): Promise<string> {
  const ko = (await page.getByTestId('hh-prompt').innerText()).split('\n')[0]!.trim();
  expect(Object.keys(TARGETS)).toContain(ko);
  return ko;
}

test.describe('Hidden Heritage (F-CURR-002 CM-36)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  for (const size of [
    { name: '320', width: 320, height: 568, spotMin: 54 },
    { name: '768', width: 768, height: 1024, spotMin: 135 },
  ]) {
    test.describe(`at ${size.name}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('a Korean word with romanization, never an English label; every thing a named button of 48 dp or more', async ({ page }) => {
        await open(page, true);
        await expect(page.getByTestId('hh-scene')).toBeVisible();
        await expect(page.getByText('Find this', { exact: true })).toBeVisible();
        const ko = await asked(page);
        await expect(page.getByTestId('hh-prompt')).toContainText(TARGETS[ko]!.id);
        // The meanings name the spots for a screen reader only: none is drawn before a find.
        const body = await page.locator('body').innerText();
        for (const meaning of Object.values(TARGETS).map((t) => t.meaning)) expect(body).not.toContain(meaning);
        for (const name of THINGS) {
          const button = page.getByRole('button', { name, exact: true });
          await expect(button).toBeVisible();
          const box = (await button.boundingBox())!;
          expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(48);
          expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(size.spotMin - 1);
        }
        await expect(page.getByLabel('Not found yet')).toHaveCount(3);
        await expectNoHorizontalOverflow(page);
        await shot(page, `hidden-heritage-ask-${size.name}`);
      });

      test('a miss nudges and ends nothing; the second rings the right spot; every find fills a slot; the end panel lists the words', async ({ page }) => {
        await open(page, true);
        let ko = await asked(page);
        const other = ['hangari', 'baguni'];
        await spot(page, other[0]!).click();
        await expect(page.getByText('Look again').first()).toBeVisible();
        await expect(page.getByTestId('hh-ring-miss')).toBeVisible();
        // State, not sleeps: the miss ring clears on its own (MISS_RING_MS) before the next tap.
        await expect(page.getByTestId('hh-ring-miss')).toHaveCount(0);
        await spot(page, other[1]!).click();
        await expect(page.getByTestId('hh-ring-hint')).toBeVisible();
        await shot(page, `hidden-heritage-hint-${size.name}`);
        expect(await asked(page)).toBe(ko);
        await expectNoShame(page);
        for (let i = 0; i < 3; i += 1) {
          ko = await asked(page);
          await spot(page, TARGETS[ko]!.id).click();
          await expect(page.getByRole('button', { name: `${TARGETS[ko]!.meaning}, found` })).toBeVisible();
          if (i === 0) await shot(page, `hidden-heritage-found-${size.name}`);
          // The next word comes once the meaning has shown (FOUND_ADVANCE_MS); after the last, the end panel.
          if (i < 2) await expect(page.getByTestId('hh-prompt')).not.toContainText(ko);
        }
        await expect(page.getByText('You found them all')).toBeVisible();
        for (const t of Object.values(TARGETS)) await expect(page.getByTestId('hh-end').getByText(t.meaning, { exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await shot(page, `hidden-heritage-end-${size.name}`);
        const answers = (await log(page)).answers;
        // The first word: two misses, then the find (its first try scored the miss); the next two found first time.
        expect(answers.map((a) => a.correct)).toEqual([false, false, true, true, true]);
        await page.getByTestId('hh-continue').click();
        await expect.poll(async () => (await log(page)).completed).toBe(1);
      });
    });
  }

  test.describe('at 320', () => {
    test.use({ viewport: { width: 320, height: 568 } });

    test('the rings carry their text.primary casing (they read on a gold, green or dark thing)', async ({ page }) => {
      await open(page, true);
      await spot(page, 'hangari').click();
      const ring = page.getByTestId('hh-ring-miss');
      await expect(ring).toBeVisible();
      const outer = await ring.evaluate((el) => getComputedStyle(el).borderTopColor);
      expect(outer).toBe('rgb(42, 31, 20)');
    });

    test('keyboard: Tab reaches the spots in reading order and draws the focus outline outside the spot', async ({ page }) => {
      await open(page, true);
      await expect(page.getByTestId('hh-scene')).toBeVisible();
      const order: string[] = [];
      for (let i = 0; i < 20 && order.length < THINGS.length; i += 1) {
        await page.keyboard.press('Tab');
        const name = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
        if (THINGS.includes(name) && !order.includes(name)) {
          order.push(name);
          if (order.length === 1) await expect(page.getByTestId('hh-focus')).toBeVisible();
        }
      }
      expect(order).toEqual(THINGS);
      await page.keyboard.press('Enter');
      await expect(page.getByText(/Look again|Found: /).first()).toBeVisible();
    });

    test('reduced motion: nothing moves, the rings appear at once', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, true);
      const ko = await asked(page);
      await spot(page, TARGETS[ko]!.id).click();
      await expect(page.getByTestId('hh-ring-found')).toBeVisible();
      const animated = await page.getByTestId('hh-scene').evaluate((el) => [...el.querySelectorAll('*')].some((n) => getComputedStyle(n).animationName !== 'none' || getComputedStyle(n).transitionDuration !== '0s'));
      expect(animated).toBe(false);
    });

    test('game.hidden-heritage off (the launch state): Pic-Word Match on the same targets, from their own pictures', async ({ page }) => {
      await open(page, false);
      for (const t of Object.values(TARGETS)) await expect(page.getByTestId(`pic-word-picture-${t.id}`)).toBeVisible();
      await expect(page.getByTestId('hh-scene')).toHaveCount(0);
      await shot(page, 'hidden-heritage-off-320');
    });

    test('a scene this build cannot load: the same Pic-Word Match fallback, never an error box', async ({ page }) => {
      await open(page, true, true);
      for (const t of Object.values(TARGETS)) await expect(page.getByTestId(`pic-word-picture-${t.id}`)).toBeVisible();
      await expect(page.getByTestId('hh-scene')).toHaveCount(0);
    });
  });
});

/** F-CURR-002 row CM-37 part 1: the Letters school room scene, opened through the same e2e hook. */
const LETTERS = 'scene:letters-school';
const LETTERS_THINGS = ['mountain', 'bird', 'book', 'brush', 'tree', 'flower'];
const LETTERS_TARGETS: Record<string, { id: string; meaning: string }> = {
  책: { id: 'chaek', meaning: 'book' },
  붓: { id: 'but', meaning: 'brush' },
  나무: { id: 'namu', meaning: 'tree' },
};

test.describe('Hidden Heritage, the Letters school room (F-CURR-002 CM-37)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');
  test.use({ viewport: { width: 320, height: 568 } });

  test('at 320: a Korean Letters word with romanization; six named spots of 54 dp or more; every find fills a slot', async ({ page }) => {
    await open(page, true, false, LETTERS);
    await expect(page.getByTestId('hh-scene')).toBeVisible();
    const first = (await page.getByTestId('hh-prompt').innerText()).split('\n')[0]!.trim();
    expect(Object.keys(LETTERS_TARGETS)).toContain(first);
    await expect(page.getByTestId('hh-prompt')).toContainText(LETTERS_TARGETS[first]!.id);
    for (const name of LETTERS_THINGS) {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(53);
    }
    await expectNoHorizontalOverflow(page);
    await shot(page, 'hidden-heritage-letters-ask-320');
    for (let i = 0; i < 3; i += 1) {
      const ko = (await page.getByTestId('hh-prompt').innerText()).split('\n')[0]!.trim();
      await spot(page, LETTERS_TARGETS[ko]!.id).click();
      await expect(page.getByRole('button', { name: `${LETTERS_TARGETS[ko]!.meaning}, found` })).toBeVisible();
      // State, not sleeps: the next word comes once the meaning has shown (FOUND_ADVANCE_MS).
      if (i < 2) await expect(page.getByTestId('hh-prompt')).not.toContainText(ko);
    }
    await expect(page.getByText('You found them all')).toBeVisible();
    await expectNoShame(page);
    await shot(page, 'hidden-heritage-letters-end-320');
    expect((await log(page)).answers.map((a) => a.correct)).toEqual([true, true, true]);
    await page.getByTestId('hh-continue').click();
    await expect.poll(async () => (await log(page)).completed).toBe(1);
  });

  test('at 320, game.hidden-heritage off: Pic-Word Match on 책, 붓 and 나무 from their own pictures', async ({ page }) => {
    await open(page, false, false, LETTERS);
    for (const t of Object.values(LETTERS_TARGETS)) await expect(page.getByTestId(`pic-word-picture-${t.id}`)).toBeVisible();
    await expect(page.getByTestId('hh-scene')).toHaveCount(0);
  });

  test('at 320 with the Largest text size: the word, its romanization and the end panel fit, with no sideways scroll or clipped text', async ({ page }) => {
    await page.goto('/');
    await seedStoredAll(page, {
      'remote-config': { v: 1, fetchedAt: Date.now(), maxAgeS: 86_400, flags: { 'game.hidden-heritage': { on: true, pct: 100 } } },
      'device:settings': { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' },
    });
    await page.reload();
    await page.waitForFunction(() => Boolean((window as E2eWindow).__hrHiddenHeritageE2E), undefined, { timeout: 10_000 });
    await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
    await page.evaluate((id) => (window as E2eWindow).__hrHiddenHeritageE2E?.open({ sceneId: id }), LETTERS);
    await expect(page.getByTestId('hh-scene')).toBeVisible();
    await expect(page.getByTestId('hh-prompt')).toBeVisible();
    await expectNoSidewaysScroll(page, 'Letters ask, Largest');
    await expectNoClippedText(page, 'Letters ask, Largest');
    for (let i = 0; i < 3; i += 1) {
      const ko = (await page.getByTestId('hh-prompt').innerText()).split('\n')[0]!.trim();
      await spot(page, LETTERS_TARGETS[ko]!.id).click();
      await expect(page.getByRole('button', { name: `${LETTERS_TARGETS[ko]!.meaning}, found` })).toBeVisible();
      if (i < 2) await expect(page.getByTestId('hh-prompt')).not.toContainText(ko);
    }
    await expect(page.getByText('You found them all')).toBeVisible();
    await page.getByTestId('hh-continue').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('hh-continue')).toBeVisible();
    await expectNoSidewaysScroll(page, 'Letters end, Largest');
    await expectNoClippedText(page, 'Letters end, Largest');
  });

  test.describe('at 768', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test('the same six named spots, each 135 dp or more, and no sideways scroll', async ({ page }) => {
      await open(page, true, false, LETTERS);
      await expect(page.getByTestId('hh-scene')).toBeVisible();
      for (const name of LETTERS_THINGS) {
        const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
        expect(Math.min(box.width, box.height), name).toBeGreaterThanOrEqual(134);
      }
      await expectNoHorizontalOverflow(page);
      await shot(page, 'hidden-heritage-letters-ask-768');
    });
  });
});

async function expectNoShame(page: Page): Promise<void> {
  expect(await page.locator('body').innerText()).not.toMatch(SHAME);
}
