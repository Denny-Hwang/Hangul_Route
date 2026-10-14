import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { readStored } from './helpers';
import { shot } from './shots';

/**
 * F-TCH-004 PR 8 (section 3.12; design/screens/presenter/home.md, README D2,
 * D14, D19): the presenter home at `/present` with no deck link. Recent lessons
 * from `lecture:recent` (titles and days only), remove, Quick lesson groups and
 * Build lesson, the session language chips as a radiogroup, and the page with
 * storage off. Phone and wide layouts; screenshots with `HR_SHOTS=1`.
 */

const RECENT_KEY = 'hr:lecture:recent';

// The day labels ("Today", "Oct 9") are read in the runner's zone; pin it so the older row is Oct 9 everywhere.
test.use({ timezoneId: 'UTC' });

const deck = (id: string, title: string) => ({
  v: 1,
  id,
  title,
  createdAt: '2026-10-11T09:00:00.000Z',
  seed: 7,
  blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
  options: { romanization: 'always', strokeGuide: true, quizRounds: 5, sound: true },
  picker: { mode: 'numbers', count: 12 },
});

const today = new Date().toISOString();
const RECENT = {
  v: 1,
  items: [
    { deck: deck('lecture:week3abcde', 'Week 3 letters'), savedAt: today, lastSlideKey: 'b0/jamo:a' },
    { deck: deck('lecture:food12345a', 'Food'), savedAt: '2026-10-09T10:00:00.000Z' },
  ],
};

async function seedRecent(page: Page, value: unknown): Promise<void> {
  await page.goto('/present');
  await page.evaluate(
    ([k, json]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(json, k);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [RECENT_KEY, JSON.stringify(value)] as const,
  );
  await page.goto('/present');
}

test.describe('presenter home, wide (two columns)', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('shows Recent lessons by title and day, newest first, and removes one', async ({ page }) => {
    await seedRecent(page, RECENT);
    const home = page.getByTestId('presenter-home');
    await expect(home.getByRole('heading', { level: 1, name: 'Lecture' })).toBeVisible();
    const recent = page.getByTestId('presenter-home-recent');
    await expect(recent.getByText('Week 3 letters')).toBeVisible();
    await expect(recent.getByText('Today')).toBeVisible();
    await expect(recent.getByText('Oct 9')).toBeVisible();
    // Two columns from 900 px: Recent sits left of Quick lesson.
    const r = await recent.boundingBox();
    const q = await page.getByTestId('presenter-home-quick').boundingBox();
    expect(r && q && r.x + r.width <= q.x).toBe(true);
    await shot(page, 'presenter-home-1280');

    await page.getByRole('button', { name: 'Remove: Food' }).click();
    await expect(recent.getByText('Food')).toHaveCount(0);
    // Focus moves to the row that is left, not to the page body.
    await expect(page.getByRole('button', { name: 'Remove: Week 3 letters' })).toBeFocused();
    await expect
      .poll(async () => ((await readStored<{ items: { deck: { id: string } }[] }>(page, 'lecture:recent'))?.items ?? []).map((i) => i.deck.id))
      .toEqual(['lecture:week3abcde']);
  });

  test('Quick lesson: choose items, the count is a status, Build lesson leaves the home', async ({ page }) => {
    await page.goto('/present');
    const quick = page.getByTestId('presenter-home-quick');
    await expect(quick.getByRole('heading', { level: 3, name: 'Episodes' })).toBeVisible();
    await expect(quick.getByRole('heading', { level: 3, name: 'Single lessons' })).toBeVisible();
    await expect(quick.getByRole('heading', { level: 3, name: 'Letter sets' })).toBeVisible();
    await expect(page.getByTestId('presenter-home-recent-empty')).toBeVisible();
    const build = page.getByTestId('presenter-home-build');
    await expect(page.getByRole('status')).toHaveText('Choose at least one item to build a lesson.');
    await expect(build).toBeDisabled();
    await shot(page, 'presenter-home-empty-1280');

    const consonants = quick.getByRole('checkbox', { name: /^Consonants/ });
    await consonants.click();
    await expect(consonants).toHaveAttribute('aria-checked', 'true');
    await quick.getByRole('checkbox', { name: /^Meet the Letters/ }).click();
    await expect(page.getByRole('status')).toHaveText('2 chosen');
    await consonants.click();
    await expect(page.getByRole('status')).toHaveText('1 chosen');
    await build.click();
    await expect(page.getByTestId('presenter-home')).toHaveCount(0);
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    // The tab holds the built deck, as a link does: a reload reopens it, and the address stays /present.
    await page.reload();
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/present');
  });

  test('Resume opens the start screen; after Exit the home has focus on its h1', async ({ page }) => {
    await seedRecent(page, RECENT);
    await page.getByTestId('presenter-recent-resume-lecture:week3abcde').click();
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    await expect(page.getByTestId('presenter-start').getByText('Week 3 letters')).toBeVisible();
    const start = page.getByTestId('presenter-start-button');
    await expect(start).toBeEnabled({ timeout: 10_000 });
    await start.click();
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('presenter-exit-confirm').click();
    await expect(page.getByTestId('presenter-home-title')).toBeFocused();
    // Start over opens the same deck again.
    await page.getByTestId('presenter-recent-startover-lecture:week3abcde').click();
    await expect(page.getByTestId('presenter-start').getByText('Week 3 letters')).toBeVisible();
  });

  test('Back to lessons leaves the start screen with nothing saved, and a reload shows the home', async ({ page }) => {
    await seedRecent(page, RECENT);
    await page.getByTestId('presenter-recent-resume-lecture:food12345a').click();
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    await page.getByTestId('presenter-start-back').click();
    await expect(page.getByTestId('presenter-home-title')).toBeFocused();
    const stored = async () => (await readStored<{ items: { deck: { id: string }; savedAt: string }[] }>(page, 'lecture:recent'))?.items ?? [];
    expect((await stored()).map((i) => i.deck.id)).toEqual(['lecture:week3abcde', 'lecture:food12345a']);
    await page.reload();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
  });

  test('a resumed lesson moves to the top of Recent with today', async ({ page }) => {
    await seedRecent(page, RECENT);
    await page.getByTestId('presenter-recent-resume-lecture:food12345a').click();
    const start = page.getByTestId('presenter-start-button');
    await expect(start).toBeEnabled({ timeout: 10_000 });
    await start.click();
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('presenter-exit-confirm').click();
    await expect(page.getByTestId('presenter-home-title')).toBeFocused();
    const rows = page.getByTestId('presenter-home-recent').getByRole('listitem');
    await expect(rows.first()).toContainText('Food');
    await expect(rows.first()).toContainText('Today');
  });

  test('language chips: one tab stop, arrows move and select, the device locale is not written', async ({ page }) => {
    await page.goto('/present');
    const group = page.getByRole('radiogroup', { name: 'Presenter language' });
    if ((await group.count()) === 0) test.skip(true, 'one UI locale in this build: no chips are drawn');
    const english = group.getByRole('radio', { name: 'English' });
    await expect(english).toHaveAttribute('aria-checked', 'true');
    await english.focus();
    await page.keyboard.press('ArrowRight');
    // The group's own name is now Spanish too, so it is found by its test id.
    const chips = page.getByTestId('presenter-home-language');
    await expect(chips.getByRole('radio', { name: 'Español' })).toHaveAttribute('aria-checked', 'true');
    await expect(chips.getByRole('radio', { name: 'Español' })).toBeFocused();
    await expect(page.getByRole('heading', { level: 1, name: 'Proyección' })).toBeVisible();
    expect(await readStored(page, 'device:settings')).toBeNull();
  });
});

test.describe('presenter home, Keys and help', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('Keys and help opens the Help overlay from the home; Close and Esc return to the button', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/present');
    const help = page.getByTestId('presenter-home-help');
    await expect(help).toBeVisible();
    await expect(help).toHaveAccessibleName('Keys and help');
    await help.click();
    const overlay = page.getByRole('dialog', { name: 'Keys and controls' });
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId('presenter-help-close')).toBeFocused();
    await expect(overlay).toContainText('A presentation clicker works with no setup.');
    // No lesson is open, so there is no deck romanization to flip here.
    await expect(page.getByTestId('presenter-help-romanization')).toHaveCount(0);
    await expect(page.getByTestId('presenter-help-keep-visible')).toBeVisible();
    await shot(page, 'presenter-home-help-1280x800');
    await page.getByTestId('presenter-help-close').click();
    await expect(page.getByTestId('presenter-help')).toHaveCount(0);
    await expect(help).toBeFocused();
    await help.press('Enter');
    await expect(page.getByTestId('presenter-help')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('presenter-help')).toHaveCount(0);
    await expect(help).toBeFocused();
    // The home still works after: its h1 is there and nothing was saved.
    await expect(page.getByRole('heading', { level: 1, name: 'Lecture' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('presenter home, Keys and help on a narrow phone', () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

  test('the Help overlay fits 320 px, scrolls with PageDown and closes with a tap', async ({ page }) => {
    await page.goto('/present');
    const help = page.getByTestId('presenter-home-help');
    await help.tap();
    const close = page.getByTestId('presenter-help-close');
    await expect(close).toBeVisible();
    await expect(close).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth <= window.innerWidth)).toBe(true);
    // The home leaves the scroll keys to the browser: PageDown scrolls the taller overlay.
    const scrolled = () =>
      page.evaluate(() => {
        const root = document.querySelector('[data-testid="presenter-help"]');
        const all = root ? [root, ...Array.from(root.querySelectorAll('*'))] : [];
        return Math.max(0, ...all.map((el) => el.scrollTop));
      });
    expect(await scrolled()).toBe(0);
    await page.keyboard.press('PageDown');
    await expect.poll(scrolled).toBeGreaterThan(0);
    await expect(page.getByTestId('presenter-help')).toBeVisible();
    await close.tap();
    await expect(page.getByTestId('presenter-help')).toHaveCount(0);
    await expect(help).toBeVisible();
  });
});

test.describe('presenter home, phone (one column, Recent first)', () => {
  test.use({ viewport: { width: 375, height: 800 }, isMobile: false, hasTouch: true });

  test('stacks Recent above Quick lesson with no sideways scroll', async ({ page }) => {
    await seedRecent(page, RECENT);
    const r = await page.getByTestId('presenter-home-recent').boundingBox();
    const q = await page.getByTestId('presenter-home-quick').boundingBox();
    expect(r && q && r.y + r.height <= q.y).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shot(page, 'presenter-home-375');
  });

  test('works at 320 px with 200 % text', async ({ page }) => {
    // react-native-web sets text sizes in px, so a root font-size changes nothing; 320 px at 200 %
    // zoom is a 160 CSS px layout viewport (WCAG 1.4.10 reflow), which is what is drawn here.
    await page.setViewportSize({ width: 160, height: 800 });
    await seedRecent(page, RECENT);
    await expect(page.getByTestId('presenter-home-title')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const id of ['presenter-home-title', 'presenter-home-build', 'presenter-home-chosen', 'presenter-recent-resume-lecture:week3abcde', 'presenter-recent-startover-lecture:week3abcde']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= 160, id).toBe(true);
    }
    await shot(page, 'presenter-home-320-text200');
  });
});

test.describe('presenter home with storage off', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('replaces Recent with one line and Quick lesson still builds', async ({ page }) => {
    await page.addInitScript(() => {
      const failing = () => {
        throw new Error('storage is off');
      };
      Object.defineProperty(window, 'indexedDB', { configurable: true, get: failing });
    });
    await page.goto('/present');
    await expect(page.getByTestId('presenter-home-recent-off')).toHaveText('Recent lessons are off on this device. Lessons still work.');
    await page.getByTestId('presenter-home-quick').getByRole('checkbox', { name: /^Vowels/ }).click();
    await expect(page.getByTestId('presenter-home-build')).toBeEnabled();
  });
});
