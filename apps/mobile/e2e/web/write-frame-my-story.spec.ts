import type { Page } from '@playwright/test';
import { keysFor } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 §7.1 F8, OD-13 (row CM-38): My Story (design/wireframes/minigame/my-story.md, design/screens/minigame-variety/
 * board Y). No shipped lesson cell plays `my-story` yet, so this suite opens the game on the fixture chain through the
 * `window.__hrWriteFrameE2E` hook (`story`), which exists only in the fixture bundle (served from dist-e2e/), through the
 * same switch and fallback as MinigameScreen and the game's own lazy chunk:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test write-frame-my-story
 *
 * In the production build the suite is skipped. The file is named `write-frame-*` so the fixture-bundle job's
 * `write-frame` file filter (web-app.yml) runs it with Write Frame's suite, which plays each frame.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
/** Words a learner never reads here (anti-shame, CLAUDE.md §1). */
const SHAME = /\b(fail\w*|incorrect|wrong|missed|lost)\b/i;
const HANGUL = /[ㄱ-ㆎ가-힣]/;
/** The 48 dp floor of F-CURR-002 §14 (the app's own floor, `touchTarget.min`, is 64). */
const FLOOR = 48;

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string }>;
  completes: number;
}
interface TelemetryEvent {
  name: string;
  payload?: Record<string, unknown>;
}
type E2eWindow = Window & {
  __hrWriteFrameE2E?: { open(params: { rounds: string[]; story?: 'on' | 'off' | 'long' }): void; log(): Log; events(): TelemetryEvent[] };
};

async function open(page: Page, off: boolean | 'long' = false): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrWriteFrameE2E), undefined, { timeout: 10_000 });
  await page.evaluate((o) => (window as E2eWindow).__hrWriteFrameE2E?.open({ rounds: [], story: o === 'long' ? 'long' : o ? 'off' : 'on' }), off);
  await expect(page.getByTestId('write-frame')).toBeVisible({ timeout: 10_000 });
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}

const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrWriteFrameE2E!.log());
const events = (page: Page): Promise<TelemetryEvent[]> => page.evaluate(() => (window as E2eWindow).__hrWriteFrameE2E!.events());
async function typeText(page: Page, text: string): Promise<void> {
  for (const jamo of keysFor(text)) await page.getByTestId(`hangul-key-${jamo}`).click();
}
async function box(page: Page, testId: string) {
  const b = await page.getByTestId(testId).first().boundingBox();
  expect(b, `${testId} has a box`).not.toBeNull();
  return b!;
}
/** Every free-text field on the page: an input outside the in-app keyboard's own, a textarea, anything editable. */
const freeText = (page: Page) => page.locator('input:not([type="hidden"]), textarea, [contenteditable="true"], [contenteditable=""]');
/**
 * What the browser keeps for this origin: both Web Storages, and every key and value of every object store of every
 * IndexedDB database (the app's own storage is IndexedDB through idb-keyval, `platform/storage.web.ts`).
 */
async function stored(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const all: string[] = [];
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i += 1) {
        const k = store.key(i) ?? '';
        all.push(k, store.getItem(k) ?? '');
      }
    }
    const text = (v: unknown): string => {
      try {
        return typeof v === 'string' ? v : JSON.stringify(v) ?? String(v);
      } catch {
        return String(v);
      }
    };
    const request = <T,>(r: IDBRequest<T>): Promise<T> =>
      new Promise((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const dbs = (await indexedDB.databases?.()) ?? [];
    for (const { name, version } of dbs) {
      if (!name) continue;
      all.push(name);
      const db = await request(indexedDB.open(name, version));
      for (const storeName of Array.from(db.objectStoreNames)) {
        const tx = db.transaction(storeName, 'readonly');
        const os = tx.objectStore(storeName);
        const [keys, values] = await Promise.all([request(os.getAllKeys()), request(os.getAll())]);
        all.push(storeName, ...keys.map(text), ...values.map(text));
      }
      db.close();
    }
    return all.join('\n');
  });
}

/** Elements under `testId` with a running CSS animation or a non-zero transition (the mastery suite's check). */
const animatedUnder = (page: Page, testId: string): Promise<number> =>
  page.getByTestId(testId).first().evaluate((el) =>
    [el, ...Array.from(el.querySelectorAll('*'))].filter((n) => {
      const cs = getComputedStyle(n);
      return cs.animationName !== 'none' || (cs.transitionDuration !== '0s' && cs.transitionProperty !== 'none' && cs.transitionDuration !== '');
    }).length,
  );

test.describe('My Story: a short text from word-bank frames, shown as My page and not kept (F-CURR-002 CM-38)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1, build:web:fixtures)');

  test('320 x 568: three frames, word bank only, the story so far, My page not kept, nothing stored or sent', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page);
    await expect(page.getByRole('heading', { name: 'Write your story' })).toBeVisible();
    await expect(page.getByText('1 / 3')).toBeVisible();
    const before = await stored(page);
    // Word bank only: no free-text field anywhere, the neutral option drawn like the others (last, unlabelled).
    await expect(freeText(page)).toHaveCount(0);
    for (const id of ['write-frame-word-0', 'write-frame-word-1', 'write-frame-word-2']) {
      const b = await box(page, id);
      expect(b.height, id).toBeGreaterThanOrEqual(FLOOR);
      expect(b.width, id).toBeGreaterThanOrEqual(FLOOR);
    }
    await expect(page.getByTestId('write-frame-word-2')).toHaveAttribute('aria-label', /공원/);
    expect(await page.getByTestId('write-frame-word-2').innerText()).not.toMatch(/neutral|safe|private/i);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'my-story-320-frame1');

    // Frame 1: pick 공원 (the neutral option), write it.
    await page.getByTestId('write-frame-word-2').click();
    await expect(freeText(page)).toHaveCount(0);
    await typeText(page, '공원');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('저는 주말에 공원에 가요.')).toBeVisible();

    // Frame 2: the story so far above the frame; the particle follows the pick (호야와).
    await expect(page.getByText('2 / 3')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('my-story-so-far')).toContainText('저는 주말에 공원에 가요.');
    await expect(page.getByTestId('my-story-so-far')).toContainText('On the weekend I go to the park.');
    await expect(page.getByTestId('my-story-so-far').getByRole('button')).toHaveCount(0);
    await expect(page.getByTestId('write-frame-ending')).toHaveText('과/와');
    await expectNoHorizontalOverflow(page);
    await shot(page, 'my-story-320-pick');
    await page.getByTestId('write-frame-word-2').click();
    await expect(page.getByTestId('write-frame-ending')).toHaveText('와');
    // On a phone the pinned keyboard leaves room for the frame only: the story so far waits for the next pick, so
    // the frame and the answer row keep their place.
    await expect(page.getByTestId('my-story-so-far-folded')).toHaveCount(0);
    await expect(page.getByTestId('my-story-so-far')).toHaveCount(0);
    const line = await box(page, 'write-frame-card');
    expect(line.y).toBeGreaterThanOrEqual(0);
    const done = await box(page, 'write-frame-done');
    expect(done.y + done.height).toBeLessThanOrEqual(568);
    expect(done.height).toBeGreaterThanOrEqual(FLOOR);
    await shot(page, 'my-story-320-write');
    await typeText(page, '호야');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('호야와 같이 가요.')).toBeVisible();

    // Frame 3 is pick only.
    await expect(page.getByText('3 / 3')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('write-frame-word-2').click();

    // My page: the not-kept line above the text, a Hear button per sentence, Hoya, Done; nothing to keep.
    await expect(page.getByTestId('my-story-page')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'My page' })).toBeVisible();
    const notKept = await box(page, 'my-story-not-kept');
    const sheet = await box(page, 'my-story-page-sheet');
    expect(notKept.y + notKept.height).toBeLessThanOrEqual(sheet.y);
    await expect(page.getByTestId('my-story-not-kept')).toHaveText('This page is just for now. It is not saved.');
    for (const text of ['저는 주말에 공원에 가요.', '호야와 같이 가요.', '기분이 괜찮아요.', 'I feel okay.']) {
      await expect(page.getByTestId('my-story-page-sheet').getByText(text)).toBeVisible();
    }
    await expect(page.getByText('You wrote a whole story!')).toBeVisible();
    const buttons = page.getByTestId('my-story-page').getByRole('button');
    await expect(buttons).toHaveCount(4);
    const names = await buttons.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent ?? ''));
    expect(names).toEqual(['Hear jeoneun jumare gongwone gayo', 'Hear hoyawa gachi gayo', 'Hear gibuni gwaenchanayo', 'Done']);
    expect(names.join(' ')).not.toMatch(/save|share|copy|download|print|keep/i);
    for (const id of ['my-story-hear-0', 'my-story-hear-1', 'my-story-hear-2', 'my-story-done']) {
      expect((await box(page, id)).height, id).toBeGreaterThanOrEqual(FLOOR);
    }
    expect(await page.locator('body').innerText()).not.toMatch(SHAME);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'my-story-320-my-page');

    // Test P-1: the host hears ids and booleans only; nothing written is stored, sent or put in the URL.
    expect((await log(page)).answers).toEqual([
      { key: '0', correct: true, itemId: 'e2e-weekend' },
      { key: '1', correct: true, itemId: 'e2e-with' },
    ]);
    await page.getByTestId('my-story-done').click();
    await expect.poll(async () => (await log(page)).completes).toBe(1);
    const sent = await events(page);
    expect(sent.filter((e) => e.name === 'minigame.finished').map((e) => e.payload)).toEqual([{ kind: 'my-story', questId: 'e2e-my-story', stepIndex: 0 }]);
    expect(JSON.stringify(sent)).not.toMatch(HANGUL);
    // Nor the sentences' romanization or meaning.
    expect(JSON.stringify(sent)).not.toMatch(/gongwon|hoyawa|gwaenchanayo|jumare|gibuni|the park|with Hoya|feel okay/i);
    // Every key and value the origin keeps, against what it kept before the first pick: no written sentence, its
    // romanization or its meaning was added.
    const written = /공원에|호야와|괜찮아요|gongwone|hoyawa|gwaenchanayo|the park|with Hoya|feel okay/g;
    const count = (text: string): number => text.match(written)?.length ?? 0;
    expect(count(await stored(page))).toBe(count(before));
    expect(decodeURIComponent(page.url())).not.toMatch(HANGUL);
    await expect(page.getByTestId('my-story-page')).toHaveCount(0);
  });

  test('reduced motion, 320 x 568: each sentence shows in the story so far and on My page at once, nothing animates', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page);
    expect(await animatedUnder(page, 'write-frame')).toBe(0);
    await page.getByTestId('write-frame-word-2').click();
    await typeText(page, '공원');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('2 / 3')).toBeVisible({ timeout: 5_000 });
    // The written sentence is in the list as the next frame opens: no slide-in to wait for.
    await expect(page.getByTestId('my-story-so-far')).toContainText('저는 주말에 공원에 가요.');
    expect(await animatedUnder(page, 'write-frame')).toBe(0);
    await page.getByTestId('write-frame-word-2').click();
    await typeText(page, '호야');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('3 / 3')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('write-frame-word-2').click();
    await expect(page.getByTestId('my-story-page')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('my-story-page-line')).toHaveCount(3);
    expect(await animatedUnder(page, 'my-story-page')).toBe(0);
    await expect(freeText(page)).toHaveCount(0);
    await shot(page, 'my-story-320-reduced-motion');
  });

  test('Skip after one frame: My page shows the story so far with the same not-kept line', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await open(page);
    await page.getByTestId('write-frame-word-0').click();
    await typeText(page, '도서관');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('2 / 3')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('write-frame-word-0').click();
    await expect(page.getByTestId('my-story-so-far-folded')).toHaveCount(0);
    await expect(page.getByTestId('write-frame-card')).toBeInViewport();
    await shot(page, 'my-story-375-write');
    await page.getByTestId('write-frame-skip').first().click();
    await expect(page.getByTestId('my-story-page')).toBeVisible();
    await expect(page.getByText('This page is just for now. It is not saved.')).toBeVisible();
    await expect(page.getByTestId('my-story-page-sheet').getByText('저는 주말에 도서관에 가요.')).toBeVisible();
    await expect(page.getByText('Here is your story so far.')).toBeVisible();
    await expect(page.getByText('You wrote a whole story!')).toHaveCount(0);
    await page.getByTestId('my-story-done').click();
    await expect.poll(async () => (await log(page)).completes).toBe(1);
  });

  test('320 x 568, five frames: from 3 lines the story so far folds while picking, and the frame and bank stay in view', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, 'long');
    await expect(page.getByText('1 / 5')).toBeVisible();
    await page.getByTestId('write-frame-word-2').click();
    await typeText(page, '공원');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('2 / 5')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('write-frame-word-2').click();
    await typeText(page, '호야');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('3 / 5')).toBeVisible({ timeout: 5_000 });
    // Two lines: still the list.
    await expect(page.getByTestId('my-story-so-far')).toBeVisible();
    await page.getByTestId('write-frame-word-2').click();
    await expect(page.getByText('4 / 5')).toBeVisible({ timeout: 5_000 });
    // Three lines: the folded line, the frame card and the first bank card in view.
    await expect(page.getByTestId('my-story-so-far-folded')).toHaveText('3 lines so far');
    await expect(page.getByTestId('my-story-so-far')).toHaveCount(0);
    await expect(page.getByTestId('write-frame-card')).toBeInViewport();
    await expect(page.getByTestId('write-frame-word-0')).toBeInViewport();
    expect((await box(page, 'my-story-so-far-folded')).height).toBeGreaterThanOrEqual(FLOOR);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'my-story-320-long-folded');
    // A tap opens it; the list has every line.
    await page.getByTestId('my-story-so-far-folded').click();
    await expect(page.getByTestId('my-story-so-far-line')).toHaveCount(3);
    await page.getByTestId('write-frame-word-2').click();
    await expect(page.getByText('5 / 5')).toBeVisible({ timeout: 5_000 });
    // The next frame starts folded again.
    await expect(page.getByTestId('my-story-so-far-folded')).toHaveText('4 lines so far');
    await expect(page.getByTestId('write-frame-card')).toBeInViewport();
    await expect(page.getByTestId('write-frame-word-0')).toBeInViewport();
    await page.getByTestId('write-frame-word-2').click();
    await expect(page.getByTestId('my-story-page')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('my-story-page-line')).toHaveCount(5);
    await expect(page.getByText('You wrote a whole story!')).toBeVisible();
    await expect(freeText(page)).toHaveCount(0);
  });

  test('768 x 1024: the story so far beside the frame card, three-column bank', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page);
    await page.getByTestId('write-frame-word-1').click();
    await typeText(page, '시장');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('2 / 3')).toBeVisible({ timeout: 5_000 });
    const soFar = await box(page, 'my-story-so-far');
    const card = await box(page, 'write-frame-card');
    expect(soFar.x + soFar.width).toBeLessThanOrEqual(card.x + 1);
    expect(Math.abs(soFar.y - card.y)).toBeLessThanOrEqual(1);
    const a = await box(page, 'write-frame-word-0');
    const c = await box(page, 'write-frame-word-2');
    expect(Math.abs(a.y - c.y)).toBeLessThanOrEqual(1);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'my-story-768-pick');
    await page.getByTestId('write-frame-word-2').click();
    // While writing, the story so far folds to one line that opens on a tap; the frame stays in view.
    await expect(page.getByTestId('my-story-so-far-folded')).toHaveText('1 line so far');
    expect((await box(page, 'my-story-so-far-folded')).height).toBeGreaterThanOrEqual(FLOOR);
    await expect(page.getByTestId('write-frame-card')).toBeInViewport();
    await shot(page, 'my-story-768-write-folded');
    await page.getByTestId('my-story-so-far-folded').click();
    await expect(page.getByTestId('my-story-so-far')).toContainText('저는 주말에 시장에 가요.');
    await typeText(page, '호야');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByText('3 / 3')).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('write-frame-word-0').click();
    await expect(page.getByTestId('my-story-page')).toBeVisible({ timeout: 5_000 });
    await shot(page, 'my-story-768-my-page');
  });

  test('game.my-story off: Write Frame on the first frame, its bank with the neutral option, then its own My page', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, true);
    await expect(page.getByRole('heading', { name: 'Make your own sentence' })).toBeVisible();
    await expect(page.getByText('1 / 1')).toBeVisible();
    await expect(page.getByTestId('write-frame-word-2')).toHaveAttribute('aria-label', /공원/);
    await expect(page.getByText('Write your story')).toHaveCount(0);
    await shot(page, 'my-story-320-off');
    await page.getByTestId('write-frame-word-2').click();
    await typeText(page, '공원');
    await page.getByTestId('write-frame-done').click();
    await expect(page.getByTestId('write-frame-my-page')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('write-frame-my-page-sheet').getByText('저는 주말에 공원에 가요.')).toBeVisible();
    await page.getByTestId('write-frame-continue').click();
    await expect.poll(async () => (await log(page)).completes).toBe(1);
    expect((await events(page)).filter((e) => e.name === 'minigame.finished').map((e) => e.payload)).toEqual([{ kind: 'write-frame', questId: 'e2e-my-story', stepIndex: 0 }]);
  });
});
