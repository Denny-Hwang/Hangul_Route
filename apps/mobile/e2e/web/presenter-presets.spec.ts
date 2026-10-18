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

test.describe('the home kept on Back (section 18.2), 360 x 740', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  async function arrange(page: Page): Promise<number> {
    await page.goto('/present');
    await page.getByTestId('presenter-home-customize-toggle').tap();
    await page.getByRole('tab', { name: 'Stories' }).tap();
    await page.getByTestId('presenter-chooser-panel-stories').getByRole('checkbox').nth(1).tap();
    await page.getByTestId('presenter-preset-warm-up').tap();
    await page.getByTestId('presenter-preset-by-stage').tap();
    await page.getByTestId('presenter-preset-stage-stage3').tap();
    await page.getByTestId('presenter-preset-length-by-stage-30').tap();
    // Start sits below the first screen: tapping it scrolls the page.
    const startButton = page.getByTestId('presenter-preset-start-by-stage');
    await startButton.scrollIntoViewIfNeeded();
    const y = await homeScroll(page);
    expect(y).toBeGreaterThan(0);
    await startButton.tap();
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
    await expect.poll(() => homeScroll(page)).toBeGreaterThan(y - 3);
    expect(Math.abs((await homeScroll(page)) - y)).toBeLessThanOrEqual(2);
  }

  test('the start screen\'s Back returns to the home as it was', async ({ page }) => {
    const y = await arrange(page);
    await page.getByTestId('presenter-start-back').tap();
    await expectKept(page, y);
  });

  test('the browser back returns to the home as it was, and so does a reload there', async ({ page }) => {
    const y = await arrange(page);
    await page.goBack();
    await expectKept(page, y);
    // The home entry keeps the same position for a reload (a late scroll report of the page left behind never replaces it).
    const kept = () => page.evaluate(() => (history.state as { hrHome?: { scrollY?: number } } | null)?.hrHome?.scrollY ?? -1);
    await expect.poll(async () => Math.abs((await kept()) - y)).toBeLessThanOrEqual(2);
    await page.reload();
    await expectKept(page, y);
  });

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
    // While the page scrolls the footer stays at the bottom of the window.
    await page.evaluate(() => {
      const home = document.querySelector('[data-testid="presenter-home"]')!;
      home.scrollTop = Math.max(0, home.scrollHeight / 2);
    });
    const stuck = await page.getByTestId('presenter-chooser-footer').boundingBox();
    if (stuck && stuck.y < 740) expect(stuck.y + stuck.height).toBeLessThanOrEqual(741);
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
      await expect(page.getByRole('dialog').getByRole('radiogroup')).toHaveCount(0);
    });
  }
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
