import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { shot } from './shots';

/**
 * F-TCH-004 PR 6 (spec sections 3.1 to 3.9, 5): the lecture presenter shell at `/present`, first
 * cases. The deck fragment leaves the address and the tab title is the fixed catalogue string;
 * the start screen shows the deck facts and checks; Start runs the lesson: reveals step by key,
 * the counter and the bar follow, the End slide shows the class code, Exit confirms and goes to
 * the presenter home; a reload mid-lesson reopens the same slide; a broken link shows the invalid
 * screen; a small window shows the too-small hint; and the device's stored keys change only by
 * the allowed `lecture:recent`. PRs 7 to 9 extend this file (the other slides, the home, the
 * overlays, voice fallbacks and the offline reload).
 */

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2e001',
  title: 'Week 3 letters',
  createdAt: '2026-10-13T09:00:00Z',
  seed: 7,
  blocks: [
    { kind: 'quest', id: 'quest:stage1-letters-q1' },
    { kind: 'class-code', code: 'HYRA42' },
  ],
  picker: { mode: 'numbers', count: 12 },
};

const ALLOWED_NEW_KEYS = new Set(['hr:lecture:recent', 'hr:device:audio', 'hr:telemetry:queue']);

function link(deck: LectureDeckInput = DECK): string {
  return `/present#d=${encodeDeck(deck)}`;
}

/** Every key the app keeps in IndexedDB (`keyval-store`). */
function storedKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('keyval')) {
            db.close();
            resolve([]);
            return;
          }
          const req = db.transaction('keyval', 'readonly').objectStore('keyval').getAllKeys();
          req.onsuccess = () => {
            db.close();
            resolve(req.result.map(String));
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

async function startLesson(page: Page): Promise<void> {
  const start = page.getByTestId('presenter-start-button');
  await expect(start).toBeEnabled({ timeout: 10_000 });
  await start.click();
  await expect(page.getByTestId('presenter-stage')).toBeVisible();
}

async function counter(page: Page): Promise<string> {
  return (await page.getByTestId('presenter-counter').textContent()) ?? '';
}

test.describe('presenter at 1280 x 720', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('opens a deck link, strips the fragment, starts, reveals by key, ends and exits', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await page.goto('/');
    const before = await storedKeys(page);

    await page.goto(link());
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    // The deck left the address and the history entry; the tab title is fixed (section 3.2).
    expect(new URL(page.url()).pathname).toBe('/present');
    expect(new URL(page.url()).hash).toBe('');
    await expect(page).toHaveTitle('Hangul Route lecture');
    // `#root` is not capped (F-LAYOUT-001).
    expect(await page.evaluate(() => document.getElementById('root')?.getBoundingClientRect().width)).toBe(1280);

    await expect(page.getByRole('heading', { name: 'Week 3 letters' })).toBeVisible();
    await expect(page.getByTestId('presenter-start-facts')).toHaveText(/^\d+ slides · about \d+ minutes?$/);
    await expect(page.getByText('Before you start')).toBeVisible();
    await expect(page.getByText('Numbers 1 to 12')).toBeVisible();
    // A numbers deck expects no names, so no hand-off line.
    await expect(page.getByText(/Names come from the console page/)).toHaveCount(0);
    await expect(page.getByTestId('presenter-check-skipped')).toBeVisible();
    await page.getByTestId('presenter-see-which').click();
    await expect(page.getByTestId('presenter-skipped-list')).toBeVisible();
    await expect(page.getByTestId('presenter-skipped-list').getByText('A step the slides do not show').first()).toBeVisible();
    await shot(page, 'presenter-start-1280');

    await startLesson(page);
    const total = Number((await counter(page)).split('/')[1]);
    expect(await counter(page)).toBe(`1 / ${total}`);
    await expect(page.getByTestId('presenter-stage').getByText('Week 3 letters')).toBeVisible();
    await shot(page, 'presenter-title-1280x720');

    // The first letter: Reveal steps through its builds, then Next moves on.
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => counter(page)).toBe(`2 / ${total}`);
    await expect(page.getByTestId('presenter-glyph')).toBeVisible();
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Reveal');
    for (let i = 0; i < 6; i++) await page.keyboard.press('PageDown');
    await expect(page.getByText('Simplified stroke guide')).toBeVisible();
    await expect(page.getByText(/^Letter name: /)).toBeVisible();
    await shot(page, 'presenter-letter-1280x720');
    await expect(page.getByTestId('presenter-live')).toHaveText(/^Slide \d+ of \d+, Letter, /);

    // Back lands on the previous slide complete; End jumps to the last slide.
    await page.keyboard.press('End');
    await expect.poll(() => counter(page)).toBe(`${total} / ${total}`);
    await expect(page.getByText('Today we met')).toBeVisible();
    await expect(page.getByTestId('presenter-class-code')).toHaveText('HYRA42');
    await expect(page.getByText('Tap “Join a class” in Hangul Route and type this code.')).toBeVisible();
    await shot(page, 'presenter-end-1280x720');

    // Next on the End slide does nothing but say how to finish.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-end-hint')).toHaveText('To finish, choose Exit.');
    expect(await counter(page)).toBe(`${total} / ${total}`);

    // Esc opens the Exit confirm; Keep going closes it; Exit goes home.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('presenter-exit-dialog')).toBeVisible();
    await expect(page.getByText("Nothing about anyone's progress changes.")).toBeVisible();
    await shot(page, 'presenter-exit-1280x720');
    await page.getByTestId('presenter-keep-going').click();
    await expect(page.getByTestId('presenter-exit-dialog')).toHaveCount(0);
    await page.getByTestId('presenter-exit').click();
    await page.getByTestId('presenter-exit-confirm').click();
    await expect(page.getByTestId('presenter-home')).toBeVisible();

    // Only the allowed keys were added (section 3.9).
    await expect.poll(async () => (await storedKeys(page)).includes('hr:lecture:recent')).toBe(true);
    const added = (await storedKeys(page)).filter((k) => !before.includes(k));
    expect(added.filter((k) => !ALLOWED_NEW_KEYS.has(k))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('a reload mid-lesson reopens the same slide from Recent', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('End');
    const at = await counter(page);
    await expect.poll(() => counter(page)).toMatch(/^(\d+) \/ \1$/);
    await page.reload();
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    await startLesson(page);
    await expect.poll(() => counter(page)).toBe(at);
  });

  test('a broken link shows the invalid screen and leads to the presenter home', async ({ page }) => {
    await page.goto('/present#d=1.not-a-deck!!');
    await expect(page.getByText('This link does not work')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    await shot(page, 'presenter-invalid-1280x720');
    await page.getByRole('button', { name: 'Open Quick lesson' }).click();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
  });

  test('an unknown path under /present shows the presenter home', async ({ page }) => {
    await page.goto('/present/some/old/link');
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/present');
  });
});

test.describe('presenter at 1920 x 1080 with reduced motion', () => {
  test.use({ viewport: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false });

  test('scales the stage by the stage box and reveals instantly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(link());
    await shot(page, 'presenter-start-1920x1080');
    await startLesson(page);
    // 1920 x 1080 minus the 120 px band: a 1920 x 960 stage box, unit 1.5.
    const box = await page.getByTestId('presenter-stage').boundingBox();
    expect(box?.width).toBe(1920);
    expect(box?.height).toBe(960);
    await shot(page, 'presenter-title-1920x1080');
    await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
    await shot(page, 'presenter-letter-1920x1080');
    await page.keyboard.press('End');
    await shot(page, 'presenter-end-1920x1080');
  });
});

test.describe('presenter in a small window', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: false, hasTouch: false });

  test('the start screen fits a phone and the stage asks for a bigger window', async ({ page }) => {
    await page.goto(link());
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await shot(page, 'presenter-start-375');
    const start = page.getByTestId('presenter-start-button');
    await expect(start).toBeEnabled({ timeout: 10_000 });
    await start.click();
    await expect(page.getByText('Make the window bigger or turn the screen.')).toBeVisible();
    await shot(page, 'presenter-too-small-375x667');
  });
});
