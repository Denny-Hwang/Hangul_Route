import type { BrowserContext, Page } from '@playwright/test';
import { CATALOG, CONSOLE_SESSION_KEY, SHELL_DB, SHELL_KEYS, SHELL_STORE, storyIsReady } from '@hangul-route/content-schema';
import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import { onboardChild, readStored, unlockWithPin } from './helpers';
import { shot } from './shots';

/**
 * AMENDMENTS-LECTURE-V2 row LV-3 (sections 4, 7 item 3, 10, 14 and 18; design
 * `design/screens/presenter/presets.md`): the presenter home with Ready-made lessons first, the
 * preview, Customize's grouped chooser, the one Back, the home kept on Back, no language chips,
 * offline, and the stale-presenter Reload with a stubbed service-worker registration.
 * Screenshots with `HR_SHOTS=1`.
 */

const en = getMessages('en');
const w = en.learner.presenter.presets;
const PRESETS = ['next-lesson', 'hangul-week-1', 'by-stage', 'story-time', 'word-review', 'warm-up'] as const;
const TITLES: Record<(typeof PRESETS)[number], string> = {
  'next-lesson': w.next.title,
  'hangul-week-1': w.zero.title,
  'by-stage': w.stage.title,
  'story-time': w.story.title,
  'word-review': w.words.title,
  'warm-up': w.warmup.title,
};
const DEFAULT_MINUTES: Record<(typeof PRESETS)[number], number> = { 'next-lesson': 20, 'hangul-week-1': 20, 'by-stage': 20, 'story-time': 20, 'word-review': 10, 'warm-up': 10 };
const ALLOWED_NEW_KEYS = new Set(['hr:lecture:recent', 'hr:device:audio', 'hr:telemetry:queue']);

test.use({ timezoneId: 'UTC' });

/** The home's own scroller (react-native-web's ScrollView), and whether anything scrolls sideways. */
const noSidewaysScroll = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const doc = document.scrollingElement!;
    const home = document.querySelector('[data-testid="presenter-home"]');
    return doc.scrollWidth <= doc.clientWidth && (!home || home.scrollWidth <= home.clientWidth);
  });
const homeScroll = (page: Page): Promise<number> => page.evaluate(() => document.querySelector('[data-testid="presenter-home"]')?.scrollTop ?? 0);
/**
 * Section 10 reflow: every drawn box sits inside the window's width, and no scroller
 * (the document, react-native-web's ScrollViews) scrolls sideways. Returns what does not.
 */
const outside = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.left < -1 || r.right > width + 1) out.push(`${el.closest<HTMLElement>('[data-testid]')?.dataset.testid ?? '?'} <${el.tagName.toLowerCase()}> ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    for (const el of [document.scrollingElement as HTMLElement, ...document.querySelectorAll<HTMLElement>('div')]) {
      const style = getComputedStyle(el);
      const scrolls = el === document.scrollingElement || style.overflowX === 'auto' || style.overflowX === 'scroll';
      if (scrolls && el.scrollWidth > el.clientWidth + 1) out.push(`scroller ${el.dataset.testid ?? el.tagName} ${el.scrollWidth}>${el.clientWidth}`);
    }
    return out;
  });
/** A seeded Recent of one Hangul week 1 lesson started today (it teaches 3 words). */
const WEEK1_RECENT = {
  v: 1,
  items: [
    {
      deck: {
        v: 1,
        id: 'lecture:week1abcde',
        title: 'Hangul week 1',
        createdAt: '2026-10-11T09:00:00.000Z',
        seed: 7,
        blocks: [{ kind: 'episode', id: 'episode:stage1-letters' }],
        options: { romanization: 'always', strokeGuide: true, quizRounds: 5, sound: true },
      },
      savedAt: new Date().toISOString(),
    },
  ],
};

function storedKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
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

/** Puts a value in the app's IndexedDB store (creating it on a fresh profile), then reloads `/present`. */
async function seed(page: Page, key: string, value: unknown): Promise<void> {
  await page.goto('/present');
  await page.evaluate(
    ([k, json]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => open.result.createObjectStore('keyval');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(json, k);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [`hr:${key}`, JSON.stringify(value)] as const,
  );
  await page.goto('/present');
}

for (const [width, height] of [
  [320, 740],
  [768, 900],
  [1180, 820],
] as const) {
  test.describe(`the presets home at ${width} px`, () => {
    test.use({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900 });

    test('every card is reachable, named "{title}, about {n} minutes", and opens its own panel with Start; nothing scrolls sideways', async ({ page }) => {
      await page.goto('/present');
      await expect(page.getByRole('heading', { level: 1, name: 'Lecture mode', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: w.title })).toBeVisible();
      // No language chips on the home (section 18.4): the Display (Aa) control replaces them.
      await expect(page.getByRole('radiogroup')).toHaveCount(0);
      expect(await noSidewaysScroll(page)).toBe(true);
      await shot(page, `lv3-presets-${width}`);
      for (const preset of PRESETS) {
        const card = page.getByTestId(`presenter-preset-${preset}`);
        await expect(card).toHaveAccessibleName(`${TITLES[preset]}, about ${DEFAULT_MINUTES[preset]} minutes`);
        await card.click();
        await expect(card).toHaveAttribute('aria-expanded', 'true');
        for (const other of PRESETS.filter((p) => p !== preset)) await expect(page.getByTestId(`presenter-preset-${other}`)).toHaveAttribute('aria-expanded', 'false');
        const panel = page.locator(`#${await card.getAttribute('aria-controls')}`);
        await expect(panel.getByRole('button', { name: w.start.cta, exact: true })).toBeVisible();
        expect(await noSidewaysScroll(page), preset).toBe(true);
      }
      // Nothing to follow on a fresh device: Next lesson is last, and open it says what it starts instead.
      await page.getByTestId('presenter-preset-next-lesson').click();
      await expect(page.getByTestId('presenter-preset-fallback-next-lesson')).toHaveText(w.fallback.zero);
      await shot(page, `lv3-presets-nothing-to-follow-${width}`);
      await page.getByTestId('presenter-preset-by-stage').click();
      await page.getByTestId('presenter-preset-stage-stage3').click();
      await shot(page, `lv3-presets-stage-${width}`);
      await page.getByTestId('presenter-home-customize-toggle').click();
      await expect(page.getByTestId('presenter-home-quick')).toBeVisible();
      expect(await noSidewaysScroll(page)).toBe(true);
      await shot(page, `lv3-presets-customize-${width}`);
    });

    test('the grouped chooser: one tab at a time, Stories and Word topics there, no sideways scroll on any tab', async ({ page }) => {
      await page.goto('/present');
      await page.getByTestId('presenter-home-customize-toggle').click();
      const tabs = page.getByRole('tablist', { name: w.chooser.label });
      await expect(tabs.getByRole('tab')).toHaveText(['Lessons', 'Stories', 'Word topics', 'Letters']);
      for (const [tab, id] of [
        ['Stories', 'stories'],
        ['Word topics', 'topics'],
        ['Letters', 'letters'],
        ['Lessons', 'lessons'],
      ] as const) {
        await tabs.getByRole('tab', { name: tab }).click();
        await expect(page.getByRole('tabpanel')).toHaveCount(1);
        await expect(page.getByTestId(`presenter-chooser-panel-${id}`)).toBeVisible();
        expect(await noSidewaysScroll(page), tab).toBe(true);
      }
      await tabs.getByRole('tab', { name: 'Stories' }).click();
      await expect(page.getByTestId('presenter-chooser-panel-stories').getByRole('checkbox')).toHaveCount(8);
      await page.getByTestId('presenter-chooser-more-stories').click();
      await expect(page.getByTestId('presenter-chooser-panel-stories').getByRole('checkbox').nth(8)).toBeFocused();
    });

    test('the keyboard: the arrows move and select the tabs; Space checks a row and does not scroll the page', async ({ page }) => {
      await page.goto('/present');
      await page.getByTestId('presenter-home-customize-toggle').click();
      const tabs = page.getByRole('tablist', { name: w.chooser.label });
      await tabs.getByRole('tab', { name: 'Lessons' }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(tabs.getByRole('tab', { name: 'Stories' })).toHaveAttribute('aria-selected', 'true');
      await expect(tabs.getByRole('tab', { name: 'Stories' })).toBeFocused();
      await expect(page.getByRole('tabpanel')).toHaveCount(1);
      await page.keyboard.press('End');
      await expect(tabs.getByRole('tab', { name: 'Letters' })).toBeFocused();
      await page.keyboard.press('Home');
      await expect(tabs.getByRole('tab', { name: 'Lessons' })).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('ArrowLeft');
      await expect(tabs.getByRole('tab', { name: 'Letters' })).toHaveAttribute('aria-selected', 'true');
      const row = page.getByTestId('presenter-chooser-panel-letters').getByRole('checkbox').first();
      await row.focus();
      const before = await homeScroll(page);
      await page.keyboard.press(' ');
      await expect(row).toHaveAttribute('aria-checked', 'true');
      expect(await homeScroll(page)).toBe(before);
      await page.keyboard.press(' ');
      await expect(row).toHaveAttribute('aria-checked', 'false');
      // The length chips: one tab stop, the arrows move and select.
      await page.getByTestId('presenter-preset-hangul-week-1').click();
      await page.getByTestId('presenter-preset-length-hangul-week-1-20').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('presenter-preset-length-hangul-week-1-30')).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('presenter-preset-length-hangul-week-1-30')).toBeFocused();
      await expect(page.getByTestId('presenter-preset-hangul-week-1')).toHaveAccessibleName(`${TITLES['hangul-week-1']}, about 30 minutes`);
    });
  });
}

test.describe('one tap, then Start (1280 x 720)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('a card, Start, the preview with What\'s in this lesson, Start: slide 1', async ({ page }) => {
    await page.goto('/present');
    await page.getByTestId('presenter-preset-hangul-week-1').click();
    await page.getByTestId('presenter-preset-start-hangul-week-1').click();
    const start = page.getByTestId('presenter-start');
    await expect(start.getByRole('heading', { level: 1, name: 'Hangul week 1' })).toBeVisible();
    const preview = page.getByTestId('presenter-preview');
    await expect(preview.getByRole('heading', { name: w.preview.title })).toBeVisible();
    await expect(preview.getByRole('listitem')).toHaveCount(4);
    await expect(preview.getByRole('listitem').last()).toContainText('Quick quiz: 4 questions');
    await expect(page.getByTestId('presenter-start-facts')).toContainText('about 19 minutes');
    await expect(page.getByTestId('presenter-preview-customize')).toBeVisible();
    // The start screen's entry holds the preset, so a reload still counts the start as a preset (section 11).
    expect(await page.evaluate(() => (history.state as { hrLecturePreset?: string } | null)?.hrLecturePreset)).toBe('hangul-week-1');
    await shot(page, 'lv3-preset-preview-1280');
    const go = page.getByTestId('presenter-start-button');
    await expect(go).toBeEnabled({ timeout: 10_000 });
    await go.click();
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
  });

  test('the preview\'s Customize goes back to the home with Customize open and nothing chosen', async ({ page }) => {
    await page.goto('/present');
    await page.getByTestId('presenter-preset-by-stage').click();
    await page.getByTestId('presenter-preset-stage-stage2').click();
    await page.getByTestId('presenter-preset-start-by-stage').click();
    await expect(page.getByTestId('presenter-preview')).toBeVisible();
    await page.getByTestId('presenter-preview-customize').click();
    const toggle = page.getByTestId('presenter-home-customize-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toBeFocused();
    await expect(page.getByTestId('presenter-chooser-tray-empty')).toBeVisible();
    // The Lessons tab opens on the stage the preset started at.
    await expect(page.getByTestId('presenter-chooser-stage-stage2')).toHaveAttribute('aria-checked', 'true');
  });

  test('Stage 5 (its lessons read as stories): the preview\'s Customize opens on Stage 5', async ({ page }) => {
    await page.goto('/present');
    await page.getByTestId('presenter-preset-by-stage').click();
    await page.getByTestId('presenter-preset-stage-stage5').click();
    await page.getByTestId('presenter-preset-start-by-stage').click();
    await expect(page.getByTestId('presenter-preview')).toBeVisible();
    await page.getByTestId('presenter-preview-customize').click();
    await expect(page.getByTestId('presenter-chooser-stage-stage5')).toHaveAttribute('aria-checked', 'true');
  });

  test('Word review after Hangul week 1 (3 words): the warm-up instead, with its line, and the start screen is the warm-up', async ({ page }) => {
    await seed(page, 'lecture:recent', WEEK1_RECENT);
    await page.getByTestId('presenter-preset-word-review').click();
    await expect(page.getByTestId('presenter-preset-fallback-word-review')).toHaveText(w.fallback.warmUp);
    await page.getByTestId('presenter-preset-length-word-review-20').click();
    await expect(page.getByTestId('presenter-preset-word-review')).toHaveAccessibleName(`${TITLES['word-review']}, about 10 minutes`);
    await shot(page, 'lv3-presets-words-fallback-1280');
    await page.getByTestId('presenter-preset-start-word-review').click();
    await expect(page.getByTestId('presenter-start').getByRole('heading', { level: 1, name: w.warmup.short })).toBeVisible();
  });

  test('Customize builds a lesson of a story and a word topic', async ({ page }) => {
    await page.goto('/present');
    await page.getByTestId('presenter-home-customize-toggle').click();
    await page.getByRole('tab', { name: 'Stories' }).click();
    await page.getByTestId('presenter-chooser-panel-stories').getByRole('checkbox').first().click();
    await page.getByRole('tab', { name: 'Word topics' }).click();
    await page.getByTestId('presenter-chooser-panel-topics').getByRole('checkbox').first().click();
    await expect(page.getByTestId('presenter-home-chosen')).toContainText('2 parts');
    await page.getByTestId('presenter-home-build').click();
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    // Not a preset: no preview.
    await expect(page.getByTestId('presenter-preview')).toHaveCount(0);
    const go = page.getByTestId('presenter-start-button');
    await expect(go).toBeEnabled({ timeout: 10_000 });
    await go.click();
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
  });
});

/** The home arranged (a card, its chips, Customize, a tab, a choice and a scroll), then Start: where the page was. */
async function arrange(page: Page, touch: boolean): Promise<number> {
  const hit = (target: ReturnType<Page['getByTestId']>) => (touch ? target.tap() : target.click());
  await page.goto('/present');
  await hit(page.getByTestId('presenter-home-customize-toggle'));
  await hit(page.getByTestId('presenter-chooser-tab-stories'));
  await hit(page.getByTestId('presenter-chooser-panel-stories').getByRole('checkbox').nth(1));
  await hit(page.getByTestId('presenter-preset-warm-up'));
  await hit(page.getByTestId('presenter-preset-by-stage'));
  await hit(page.getByTestId('presenter-preset-stage-stage3'));
  await hit(page.getByTestId('presenter-preset-length-by-stage-30'));
  // The page scrolled so that Start sits near the top of the window: the kept position is not 0.
  const startButton = page.getByTestId('presenter-preset-start-by-stage');
  await page.evaluate(() => {
    const home = document.querySelector('[data-testid="presenter-home"]')!;
    const start = document.querySelector('[data-testid="presenter-preset-start-by-stage"]')!;
    const top = start.getBoundingClientRect().top - home.getBoundingClientRect().top + home.scrollTop;
    home.scrollTop = Math.max(40, top - 40);
  });
  await expect(startButton).toBeInViewport();
  await expect.poll(() => homeScroll(page)).toBeGreaterThan(0);
  // The scroll end is reported to the page before Start (react-native-web reports it 100 ms late).
  await page.waitForTimeout(400);
  const y = await homeScroll(page);
  await hit(startButton);
  await expect(page.getByTestId('presenter-start')).toBeVisible();
  return y;
}

async function expectKept(page: Page, y: number): Promise<void> {
  await expect(page.getByTestId('presenter-home')).toBeVisible();
  await expect(page.getByTestId('presenter-preset-by-stage')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('presenter-preset-stage-stage3')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('presenter-preset-length-by-stage-30')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('presenter-home-customize-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('tab', { name: 'Stories' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('presenter-chooser-panel-stories').getByRole('checkbox').nth(1)).toHaveAttribute('aria-checked', 'true');
  // The page lands where it was once its layout settles, and stays there.
  await expect.poll(async () => Math.abs((await homeScroll(page)) - y)).toBeLessThanOrEqual(2);
  await page.waitForTimeout(1000);
  expect(Math.abs((await homeScroll(page)) - y)).toBeLessThanOrEqual(2);
  // The home entry holds the same state (nothing wrote the default over it).
  await expect
    .poll(() => page.evaluate(() => (history.state as { hrHome?: { open?: string; customize?: boolean } } | null)?.hrHome ?? null))
    .toMatchObject({ open: 'by-stage', customize: true });
}

for (const [width, height] of [
  [320, 740],
  [768, 900],
  [1180, 820],
] as const) {
  const touch = width < 900;
  test.describe(`the home kept on Back (section 18.2), ${width} x ${height}`, () => {
    test.use({ viewport: { width, height }, isMobile: touch, hasTouch: touch });

    test("the start screen's Back returns to the home as it was", async ({ page }) => {
      const y = await arrange(page, touch);
      const back = page.getByTestId('presenter-start-back');
      await (touch ? back.tap() : back.click());
      await expectKept(page, y);
    });

    test('the browser back returns to the home as it was, and so does a reload there', async ({ page }) => {
      const y = await arrange(page, touch);
      await page.goBack();
      await expectKept(page, y);
      // The home entry keeps the same position for a reload (a late scroll report of the page left behind never replaces it).
      const kept = () => page.evaluate(() => (history.state as { hrHome?: { scrollY?: number } } | null)?.hrHome?.scrollY ?? -1);
      await expect.poll(async () => Math.abs((await kept()) - y)).toBeLessThanOrEqual(2);
      await page.reload();
      await expectKept(page, y);
    });

    test('a reload on the start screen, then its Back or the browser back: the home as it was', async ({ page }) => {
      const y = await arrange(page, touch);
      await page.reload();
      await expect(page.getByTestId('presenter-start')).toBeVisible();
      const back = page.getByTestId('presenter-start-back');
      await (touch ? back.tap() : back.click());
      await expectKept(page, y);
      // Again, by the browser back this time.
      const start = page.getByTestId('presenter-preset-start-by-stage');
      await (touch ? start.tap() : start.click());
      await expect(page.getByTestId('presenter-start')).toBeVisible();
      await page.reload();
      await expect(page.getByTestId('presenter-start')).toBeVisible();
      await page.goBack();
      await expectKept(page, y);
    });
  });
}

test.describe('the home kept on Back after a reload in the lesson (section 18.2), 360 x 740', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  test('a reload in the lesson steps back to its start screen; its Back shows the home as it was', async ({ page }) => {
    test.setTimeout(90_000);
    const y = await arrange(page, true);
    const go = page.getByTestId('presenter-start-button');
    await expect(go).toBeEnabled({ timeout: 10_000 });
    await go.tap();
    await page.reload();
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    await page.getByTestId('presenter-start-back').tap();
    await expectKept(page, y);
  });
});

test.describe('the home and its chooser, 360 x 740', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  test('a reload on the home keeps where it was scrolled to', async ({ page }) => {
    await page.goto('/present');
    await page.getByTestId('presenter-home-customize-toggle').tap();
    await page.evaluate(() => {
      document.querySelector('[data-testid="presenter-home"]')!.scrollTop = 600;
    });
    await expect.poll(() => page.evaluate(() => (history.state as { hrHome?: { scrollY?: number } } | null)?.hrHome?.scrollY)).toBe(600);
    await page.reload();
    await expect(page.getByTestId('presenter-home-customize-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => homeScroll(page)).toBe(600);
  });

  test('the chooser from Customize to its footer is under three screens with one episode open', async ({ page }) => {
    await page.goto('/present');
    await page.getByTestId('presenter-home-customize-toggle').tap();
    await page.getByTestId('presenter-chooser-inside-episode:stage1-letters').tap();
    await expect(page.getByTestId('presenter-chooser-lesson-quest:stage1-letters-q1')).toBeVisible();
    // At the bottom of the page the sticky footer sits at its own place, so both boxes are in one coordinate space.
    await page.evaluate(() => {
      const home = document.querySelector('[data-testid="presenter-home"]')!;
      home.scrollTop = home.scrollHeight;
    });
    const toggle = await page.getByTestId('presenter-home-customize-toggle').boundingBox();
    const footer = await page.getByTestId('presenter-chooser-footer').boundingBox();
    expect(toggle && footer).toBeTruthy();
    expect(footer!.y - toggle!.y).toBeLessThan(3 * 740);
    // While the page scrolls through the chooser the footer stays at the bottom of the window.
    await page.evaluate(() => {
      const home = document.querySelector('[data-testid="presenter-home"]')!;
      const quick = document.querySelector('[data-testid="presenter-home-quick"]')!;
      const r = quick.getBoundingClientRect();
      home.scrollTop += r.top - home.getBoundingClientRect().top + r.height / 2 - window.innerHeight / 2;
    });
    const stuck = await page.getByTestId('presenter-chooser-footer').boundingBox();
    expect(stuck).toBeTruthy();
    expect(stuck!.y).toBeGreaterThan(0);
    expect(stuck!.y + stuck!.height).toBeLessThanOrEqual(741);
    expect(stuck!.y + stuck!.height).toBeGreaterThan(740 - 4);
    await shot(page, 'lv3-presets-customize-footer-360');
  });
});

test.describe('titles in the device language (F-I18N-001 section 3.6)', () => {
  test.use({ viewport: { width: 1180, height: 820 }, isMobile: false, hasTouch: false });

  for (const locale of ['es', 'ko'] as const) {
    test(`${locale}: the chrome, the cards and the chooser's catalogue titles follow the device language`, async ({ page }) => {
      const m = getMessages(locale).learner.presenter;
      await seed(page, 'device:settings', { uiLocale: locale, uiLocaleAt: '2026-10-17T00:00:00.000Z' });
      await expect(page.getByRole('heading', { level: 1, name: m.home.title, exact: true })).toBeVisible();
      await expect(page.getByTestId('presenter-preset-story-time')).toHaveAccessibleName(getMessages(locale).a11y.presenter.presetCard(m.presets.story.title, 20));
      await page.getByTestId('presenter-home-customize-toggle').click();
      const lessons = page.getByTestId('presenter-chooser-panel-lessons');
      const episode = (OVERLAYS[locale]['episode:stage1-letters'] as { title?: string } | undefined)?.title;
      expect(episode).toBeTruthy();
      await expect(lessons.getByRole('checkbox', { name: new RegExp(`^${episode!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })).toBeVisible();
      await page.getByRole('tab', { name: m.presets.chooser.tab.stories }).click();
      const firstReady = CATALOG.stories.filter(storyIsReady).sort((a, b) => a.order - b.order)[0]!;
      const story = (OVERLAYS[locale][firstReady.id] as { title?: string } | undefined)?.title;
      expect(story).toBeTruthy();
      await expect(page.getByTestId('presenter-chooser-panel-stories').getByRole('checkbox').first()).toContainText(story!);
      await page.getByRole('tab', { name: m.presets.chooser.tab.words }).click();
      const topic = (OVERLAYS[locale]['vocab-topic:animals'] as { title?: string } | undefined)?.title;
      expect(topic).toBeTruthy();
      await expect(page.getByTestId('presenter-chooser-panel-topics')).toContainText(topic!);
      await shot(page, `lv3-presets-customize-${locale}-1180`);
      // No language chips in Help either.
      await page.getByTestId('presenter-home-help').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByRole('radiogroup')).toHaveCount(0);
    });
  }
});

test.describe('320 px at 200 % text: a 160 px layout (section 10, WCAG 1.4.10)', () => {
  test.use({ viewport: { width: 160, height: 800 }, isMobile: true, hasTouch: true });

  for (const locale of ['en', 'es'] as const) {
    test(`${locale}: every card, every chooser tab and the preview stay inside the page`, async ({ page }) => {
      test.setTimeout(90_000);
      const m = getMessages(locale).learner.presenter;
      if (locale === 'es') await seed(page, 'device:settings', { uiLocale: locale, uiLocaleAt: '2026-10-17T00:00:00.000Z' });
      else await page.goto('/present');
      await expect(page.getByRole('heading', { level: 1, name: m.home.title, exact: true })).toBeVisible();
      expect(await outside(page)).toEqual([]);
      if (locale === 'en') await shot(page, 'lv3-presets-320-text200');
      for (const preset of PRESETS) {
        await page.getByTestId(`presenter-preset-${preset}`).tap();
        expect(await outside(page), preset).toEqual([]);
      }
      await page.getByTestId('presenter-preset-by-stage').tap();
      if (locale === 'en') await shot(page, 'lv3-presets-stage-320-text200');
      await page.getByTestId('presenter-home-customize-toggle').tap();
      for (const tab of ['stories', 'topics', 'letters', 'lessons'] as const) {
        await page.getByTestId(`presenter-chooser-tab-${tab}`).tap();
        await expect(page.getByTestId(`presenter-chooser-panel-${tab}`)).toBeVisible();
        expect(await outside(page), tab).toEqual([]);
      }
      await page.getByTestId('presenter-chooser-inside-episode:stage1-letters').tap();
      expect(await outside(page)).toEqual([]);
      const start = page.getByTestId('presenter-preset-start-by-stage');
      await start.scrollIntoViewIfNeeded();
      await start.tap();
      await expect(page.getByTestId('presenter-preview')).toBeVisible();
      expect(await outside(page)).toEqual([]);
      await page.getByTestId('presenter-preview').scrollIntoViewIfNeeded();
      if (locale === 'en') await shot(page, 'lv3-preset-preview-320-text200');
    });
  }
});

test.describe('320 px with the largest text size (Display, section 10)', () => {
  test.use({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });

  test('a card open and Customize open stay inside the page', async ({ page }) => {
    await seed(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-17T00:00:00.000Z', textSize: 'largest' });
    await page.getByTestId('presenter-preset-by-stage').tap();
    await page.getByTestId('presenter-home-customize-toggle').tap();
    await page.getByTestId('presenter-chooser-inside-episode:stage1-letters').tap();
    expect(await outside(page)).toEqual([]);
  });
});

test.describe('a phone held sideways (568 x 320): the sticky footer never covers the focused row (WCAG 2.4.11)', () => {
  test.use({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true });

  test('Tab through the chooser: each focused row is clear of the footer', async ({ page }) => {
    await page.goto('/present');
    await page.getByTestId('presenter-home-customize-toggle').tap();
    await page.getByTestId('presenter-chooser-tab-stories').tap();
    await page.getByTestId('presenter-chooser-tab-stories').focus();
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const clear = await page.evaluate(() => {
        const focused = document.activeElement as HTMLElement | null;
        const footer = document.querySelector('[data-testid="presenter-chooser-footer"]');
        if (!focused || !footer || footer.contains(focused)) return true;
        const a = focused.getBoundingClientRect();
        const b = footer.getBoundingClientRect();
        return a.bottom <= b.top + 1 || a.top >= b.bottom - 1;
      });
      expect(clear, `Tab ${i + 1}`).toBe(true);
    }
  });
});

test.describe("the home's one Back (section 7 item 3)", () => {
  test.use({ viewport: { width: 1180, height: 820 }, isMobile: false, hasTouch: false });

  test('opened with window.open from a grown-up page: a new tab, Back is a link to /', async ({ page }) => {
    await page.goto('/signin');
    const [tab] = await Promise.all([page.context().waitForEvent('page'), page.evaluate(() => void window.open('/present', '_blank'))]);
    await expect(tab!.getByTestId('presenter-home')).toBeVisible();
    const back = tab!.getByTestId('presenter-home-back');
    await expect(back).toHaveAttribute('href', '/');
    await back.click();
    await expect.poll(() => new URL(tab!.url()).pathname).toBe('/');
  });

  test('a fresh tab with no referrer: Back lands on /', async ({ page }) => {
    await page.goto('/present');
    await page.getByTestId('presenter-home-back').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  });

  /** The console session of the dev auth bridge (grown-up-shell.spec.ts), on grown-up pages only. */
  async function signedIn(context: BrowserContext): Promise<void> {
    await context.addInitScript(
      ([key, value]) => {
        if (/^\/(signin|parent|teach|account|start)(\/|$)/.test(window.location.pathname)) window.sessionStorage.setItem(key, value);
      },
      [CONSOLE_SESSION_KEY, JSON.stringify({ token: 'acct-lv3', accountId: 'acct-lv3', displayName: 'Ms Kim' })] as const,
    );
  }

  test('opened in the same tab from the family home: Back is history.back(), and the grown-up lock asks again', async ({ page, context }) => {
    test.setTimeout(120_000);
    await signedIn(context);
    await onboardChild(page, { name: 'Mina' });
    const pinSetAt = await readStored<number>(page, 'account:pinSetAt');
    await page.evaluate(
      ([db, store, key, value]) =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open(db);
          open.onupgradeneeded = () => {
            if (!open.result.objectStoreNames.contains(store)) open.result.createObjectStore(store);
          };
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const tx = open.result.transaction(store, 'readwrite');
            tx.objectStore(store).put(value, key);
            tx.oncomplete = () => {
              open.result.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
      [SHELL_DB, SHELL_STORE, SHELL_KEYS.pinEpoch, pinSetAt] as const,
    );
    await page.goto('/?gate=grown-up&next=%2Fparent');
    await unlockWithPin(page);
    await expect(page).toHaveURL(/\/parent$/);
    await page.evaluate(() => window.location.assign('/present'));
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    const back = page.getByTestId('presenter-home-back');
    await expect(back).toHaveAttribute('role', 'button');
    await back.click();
    await expect(page).toHaveURL(/\/parent$/);
    await expect(page.getByRole('heading', { name: en.console.lock.title })).toBeVisible();
  });
});

test.describe('offline (section 9)', () => {
  test.use({ viewport: { width: 1180, height: 820 }, isMobile: false, hasTouch: false });

  test('after one online visit the presets resolve and start offline; only allowed keys are written', async ({ page, context }) => {
    await page.goto('/present');
    const before = await storedKeys(page);
    await expect
      .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active && !!navigator.serviceWorker.controller), { timeout: 30_000 })
      .toBe(true);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('presenter-home-presets')).toBeVisible();
    await page.getByTestId('presenter-preset-warm-up').click();
    await page.getByTestId('presenter-preset-start-warm-up').click();
    const go = page.getByTestId('presenter-start-button');
    await expect(go).toBeEnabled({ timeout: 10_000 });
    await go.click();
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    await expect.poll(async () => (await storedKeys(page)).includes('hr:lecture:recent')).toBe(true);
    const added = (await storedKeys(page)).filter((k) => !before.includes(k));
    for (const key of added) expect(ALLOWED_NEW_KEYS.has(key), key).toBe(true);
    await context.setOffline(false);
  });
});

test.describe('a link from a newer presenter, with a stubbed service-worker registration (section 4.5)', () => {
  test.use({ viewport: { width: 1180, height: 820 }, isMobile: false, hasTouch: false });

  test('the invalid page asks the worker to update, shows Reload, and Reload reloads the page', async ({ page }) => {
    await page.addInitScript(() => {
      const record = window as unknown as { __updates: number; __skip: unknown[] };
      record.__updates = 0;
      record.__skip = [];
      const container = navigator.serviceWorker;
      if (!container) return;
      const waiting = {
        state: 'installed',
        postMessage: (message: unknown) => {
          record.__skip.push(message);
          container.dispatchEvent(new Event('controllerchange'));
        },
        addEventListener: () => undefined,
      };
      const registration = {
        update: () => {
          record.__updates += 1;
          return Promise.resolve();
        },
        waiting,
        installing: null,
      };
      Object.defineProperty(container, 'getRegistration', { configurable: true, value: () => Promise.resolve(registration) });
    });
    // A version this build does not read: `unsupported_version` on the current build.
    await page.goto('/present#d=9.eyJ2Ijo5fQ');
    await expect(page.getByText(en.learner.presenter.state.invalid.staleLine)).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __updates: number }).__updates)).toBeGreaterThan(0);
    await page.evaluate(() => ((window as unknown as { __beforeReload?: boolean }).__beforeReload = true));
    await page.getByRole('button', { name: en.learner.presenter.state.invalid.reload }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __beforeReload?: boolean }).__beforeReload === true).catch(() => true))
      .toBe(false);
    await expect(page.getByRole('button', { name: en.learner.presenter.state.invalid.reload })).toBeVisible();
    await expect(page.getByRole('button', { name: en.learner.presenter.state.invalid.cta })).toBeVisible();
  });
});
