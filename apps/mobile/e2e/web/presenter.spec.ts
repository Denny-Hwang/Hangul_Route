import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { colors } from '@hangul-route/design-system/tokens';
import { expect, test } from './fixtures';
import { shot } from './shots';
import { readStored } from './helpers';

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
  // A link from an older console still names a helper picker: the presenter opens it and shows none (LV-H).
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

/** One stored value (`keyval-store`), as stored (a JSON string). */
function storedValue(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (k) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('keyval', 'readonly').objectStore('keyval').get(k);
          req.onsuccess = () => {
            open.result.close();
            resolve(req.result);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    key,
  );
}

/** Writes learner-looking keys (stored as JSON strings, as the app stores them) before a lesson. */
function seedKeys(page: Page, entries: Record<string, unknown>): Promise<void> {
  return page.evaluate(
    (values) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains('keyval')) open.result.createObjectStore('keyval');
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite');
          for (const [key, value] of Object.entries(values)) tx.objectStore('keyval').put(JSON.stringify(value), key);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    entries,
  );
}

/** Reveal presses on the open slide until the bar reads Next. */
async function revealAll(page: Page): Promise<number> {
  let presses = 0;
  while (presses < 10 && (await page.getByTestId('presenter-next').getAttribute('aria-label')) === 'Reveal') {
    await page.keyboard.press('PageDown');
    presses += 1;
  }
  return presses;
}

/**
 * A device with a Korean voice (the fixtures' silent engine has none): the presenter then draws
 * the speaker, not the teacher-says text. The voice speaks nothing; what it was asked to say is
 * kept in `window.__spoken`.
 */
async function koreanVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const voices = [
      { name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false },
      { name: 'Samantha', lang: 'en-US', voiceURI: 'Samantha', localService: true, default: true },
    ];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    const spoken: string[] = [];
    Object.defineProperty(window, '__spoken', { configurable: true, value: spoken });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: Utterance) => {
          spoken.push(u.text);
          setTimeout(() => {
            u.onstart?.();
            u.onend?.();
          }, 0);
        },
        cancel: () => undefined,
        getVoices: () => voices,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
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

    // The presenter home writes nothing: the key set before the lesson.
    await page.goto('/present');
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    const before = await storedKeys(page);

    await page.goto(link());
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    // The deck left the address and the entry's URL and stays only in this tab's history state,
    // for a reload; the start screen has its own entry (the way back, owner report 2026-10-16);
    // the tab title is fixed (section 3.2).
    expect(new URL(page.url()).pathname).toBe('/present');
    expect(new URL(page.url()).hash).toBe('');
    expect(await page.evaluate(() => Object.keys((history.state ?? {}) as object).sort())).toEqual(['hrHomeBack', 'hrIndex', 'hrLectureFragment', 'hrPresenter']);
    expect(await page.evaluate(() => history.state as { hrPresenter?: string; hrIndex?: number })).toMatchObject({ hrPresenter: 'ready', hrIndex: 1 });
    await expect(page).toHaveTitle('Hangul Route lecture');
    // `#root` is not capped (F-LAYOUT-001).
    expect(await page.evaluate(() => document.getElementById('root')?.getBoundingClientRect().width)).toBe(1280);

    await expect(page.getByRole('heading', { name: 'Week 3 letters' })).toBeVisible();
    await expect(page.getByTestId('presenter-start-facts')).toHaveText(/^\d+ slides · about \d+ minutes?$/);
    await expect(page.getByText('Before you start')).toBeVisible();
    // No helper picker (LV-H), even for a link that still names one.
    await expect(page.getByTestId('presenter-picker-row')).toHaveCount(0);
    await expect(page.getByText(/Helper|Numbers 1 to/)).toHaveCount(0);
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
    // Every build of the letter, then the bar reads Next.
    for (let i = 0; i < 8 && (await page.getByTestId('presenter-next').getAttribute('aria-label')) === 'Reveal'; i++) await page.keyboard.press('PageDown');
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Next');
    expect(await counter(page)).toBe(`2 / ${total}`);
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

    // Next on the End slide does nothing but say how to finish, with focus on Exit.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-end-hint')).toHaveText('To finish, choose Exit.');
    await expect(page.getByTestId('presenter-exit')).toBeFocused();
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
    // Exit forgets the open deck: the tab is back on its home entry, which holds none (sections 3.2, 3.5 "History").
    await expect.poll(() => page.evaluate(() => history.state)).toMatchObject({ hrPresenter: 'home', hrIndex: 0 });
    expect(await page.evaluate(() => Object.keys((history.state ?? {}) as object))).not.toContain('hrLectureFragment');

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
    await expect.poll(() => counter(page)).toMatch(/^(\d+) \/ \1$/);
    const at = await counter(page);
    // Recent keeps the open slide (the End slide's key is "end"); then the tab reloads.
    await expect.poll(async () => JSON.stringify(await storedValue(page, 'hr:lecture:recent'))).toContain('\\"lastSlideKey\\":\\"end\\"');
    await page.reload();
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    await startLesson(page);
    await expect.poll(() => counter(page)).toBe(at);
  });

  test('learner data already on the device is left byte for byte, and ?lang= is never stored', async ({ page }) => {
    await page.goto('/present?lang=ko');
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    // The hand-off left the address and is never used: the presenter speaks the device's language (owner items 6 and 7).
    await expect.poll(() => new URL(page.url()).search).toBe('');
    expect(await storedKeys(page)).not.toContain('hr:device:settings');

    const learner = {
      'hr:device:settings': { uiLocale: 'en' },
      'hr:profiles': { v: 1, profiles: [{ id: 'profile:e2e', name: 'Mina' }] },
      'hr:progress:profile:e2e': { v: 1, done: ['quest:stage1-letters-q1'] },
    };
    await seedKeys(page, learner);
    const before = await Promise.all(Object.keys(learner).map((k) => storedValue(page, k)));

    await page.goto(link());
    await startLesson(page);
    await page.keyboard.press('ArrowRight');
    await revealAll(page);
    await page.keyboard.press('End');
    await page.keyboard.press('Escape');
    await page.getByTestId('presenter-exit-confirm').click();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    await expect.poll(async () => (await storedKeys(page)).includes('hr:lecture:recent')).toBe(true);

    expect(await Promise.all(Object.keys(learner).map((k) => storedValue(page, k)))).toEqual(before);
  });

  test('a tap on the right two thirds of the stage goes on, on the left third goes back', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    const box = (await page.getByTestId('presenter-stage').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.5);
    await expect.poll(() => counter(page)).toMatch(/^2 \//);
    await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.5);
    await expect.poll(() => counter(page)).toMatch(/^1 \//);
  });

  test('Shift+R gives romanization its own reveal, and Back on the first build stays put', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    await page.keyboard.press('ArrowLeft');
    expect(await counter(page)).toMatch(/^1 \//);
    await page.keyboard.press('ArrowRight');
    const always = await revealAll(page);
    await page.keyboard.press('Home');
    await expect.poll(() => counter(page)).toMatch(/^1 \//);
    await page.keyboard.press('Shift+KeyR');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => counter(page)).toMatch(/^2 \//);
    expect(await revealAll(page)).toBe(always + 1);
  });

  test('an update that arrives mid-lesson applies only after the Exit confirm', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    await page.evaluate(() => {
      const w = window as unknown as { __hrApplyUpdate?: () => void; __hrApplied?: number };
      w.__hrApplied = 0;
      w.__hrApplyUpdate = () => {
        w.__hrApplied = (w.__hrApplied ?? 0) + 1;
      };
      window.dispatchEvent(new Event('hr:update-ready'));
    });
    const applied = () => page.evaluate(() => (window as unknown as { __hrApplied?: number }).__hrApplied ?? 0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('presenter-exit-dialog')).toBeVisible();
    expect(await applied()).toBe(0);
    // Tab stays inside the dialog.
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="presenter-exit-dialog"]')))).toBe(true);
    await page.getByTestId('presenter-exit-confirm').click();
    await expect.poll(applied).toBe(1);
  });

  test('a broken link shows the invalid screen and leads to the presenter home', async ({ page }) => {
    await page.goto('/present#d=1.not-a-deck!!');
    await expect(page.getByText('This link does not work')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    await shot(page, 'presenter-invalid-1280x720');
    await page.getByRole('button', { name: 'Open Quick lesson' }).click();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
  });

  test('a link from a newer presenter offers Reload, which opens the same link again (AMENDMENTS-LECTURE-V2 4.5)', async ({ page }) => {
    // A version this build does not read: the newer presenter's link.
    await page.goto('/present#d=9.eyJ2Ijo5fQ');
    await expect(page.getByText('This link does not work')).toBeVisible();
    await expect(page.getByText('This link is from a newer version. Close other Hangul Route tabs, then reload.')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    const reload = page.getByRole('button', { name: 'Reload' });
    await expect(reload).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Quick lesson' })).toBeVisible();
    await shot(page, 'presenter-invalid-stale-1280x720');
    await page.evaluate(() => ((window as unknown as { __beforeReload?: boolean }).__beforeReload = true));
    await reload.click();
    // The page reloads with the link held in the tab: still unreadable here, so the same page, never the home.
    await expect.poll(() => page.evaluate(() => (window as unknown as { __beforeReload?: boolean }).__beforeReload === true)).toBe(false);
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
    await page.getByRole('button', { name: 'Open Quick lesson' }).click();
    await expect(page.getByTestId('presenter-home')).toBeVisible();
  });

  test('a v2 Word review link opens: word cards, then the word-to-meaning quiz (AMENDMENTS-LECTURE-V2 4.5)', async ({ page }) => {
    const review: LectureDeckInput = {
      v: 2,
      id: 'lecture:e2ewr1',
      title: 'Word review',
      createdAt: '2026-10-15T09:00:00Z',
      seed: 7,
      blocks: [{ kind: 'word-review', questIds: ['quest:stage1-life-q1', 'quest:stage1-life-q2'], vocabIds: [], rounds: 5 }],
      source: 'quick',
      preset: 'word-review',
    };
    await page.goto(link(review));
    await startLesson(page);
    // The two quests teach 10 different words: 10 cards, 5 quiz slides, the End slide.
    await expect.poll(() => counter(page)).toBe('1 / 16');
    // Slide 1 is a word card: the first word the first quest teaches.
    await expect(page.getByTestId('presenter-live')).toHaveText(/^Slide 1 of 16, Word\b/);
    await expect(page.getByTestId('presenter-stage').getByText('고추', { exact: true }).first()).toBeVisible();
    await shot(page, 'presenter-word-review-1280x720');
    // After the cards, the word-to-meaning quiz.
    await forwardTo(page, 'Question');
    await expect(page.getByTestId('presenter-live')).toHaveText(/^Slide 11 of 16, Question\b/);
    await expect(page.getByTestId('presenter-quiz-options')).toBeVisible();
    // The v2 deck lands in Recent like any other.
    await expect.poll(async () => JSON.stringify(await storedValue(page, 'hr:lecture:recent'))).toContain('lecture:e2ewr1');
  });

  test('another open tab of the app answers the hr-tabs ping, so Reload never takes over under it (AMENDMENTS-LECTURE-V2 4.5)', async ({ page, context }) => {
    const ping = () =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const tabs = (window as unknown as { __hrTabs?: BroadcastChannel | null }).__hrTabs;
            if (!tabs) return resolve(false);
            const timer = setTimeout(() => resolve(false), 1000);
            tabs.addEventListener('message', (e: MessageEvent) => {
              if ((e.data as { type?: string } | null)?.type === 'hr-tab-here') {
                clearTimeout(timer);
                resolve(true);
              }
            });
            tabs.postMessage({ type: 'hr-tab-ping' });
          }),
      );
    await page.goto('/present');
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __hrTabs?: unknown }).__hrTabs != null)).toBe(true);
    // Alone, the page never hears its own ping.
    expect(await ping()).toBe(false);
    const other = await context.newPage();
    await other.goto('/');
    await other.waitForLoadState('load');
    expect(await ping()).toBe(true);
    await other.close();
  });

  test('a broken link (not a newer one) has no Reload', async ({ page }) => {
    await page.goto('/present#d=1.not-a-deck!!');
    await expect(page.getByText('This link does not work')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload' })).toHaveCount(0);
  });

  test('an unknown path under /present shows the presenter home', async ({ page }) => {
    await page.goto('/present/some/old/link');
    await expect(page.getByTestId('presenter-home')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/present');
  });
});

/** PR 7: a deck that holds every teaching slide (syllables and a card, words, an order slide, an activity). */
const TEACHING_DECK: LectureDeckInput = {
  ...DECK,
  id: 'lecture:e2e007',
  title: 'Week 4 words',
  blocks: [
    { kind: 'quest', id: 'quest:stage1-letters-q1' },
    { kind: 'quest', id: 'quest:stage1-life-q1' },
    { kind: 'quest', id: 'quest:stage1-rites-q3' },
    { kind: 'activity', preset: 'air-write', minutes: 3 },
  ],
};

async function liveText(page: Page): Promise<string> {
  return (await page.getByTestId('presenter-live').textContent()) ?? '';
}

/** Steps forward (through every build) until the live region names a slide of `kind`. */
async function forwardTo(page: Page, kind: string): Promise<void> {
  const at = new RegExp(`^Slide \\d+ of \\d+, ${kind}\\b`);
  for (let i = 0; i < 200 && !at.test(await liveText(page)); i++) {
    await page.keyboard.press('PageDown');
    // Two frames: the key's state change has rendered before the live region is read again.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await expect(page.getByTestId('presenter-live')).toHaveText(at);
}

/** A build that is not reached keeps its space and is not drawn: its wrapper is transparent. */
async function expectDrawn(page: Page, testId: string, drawn: boolean): Promise<void> {
  await expect(page.getByTestId(testId).locator('xpath=..')).toHaveCSS('opacity', drawn ? '1' : '0');
}

/**
 * Starts recording whether the leaving syllable parts (the join's slide-together and fade layer)
 * are ever drawn; `leftSeen` reads the record. A MutationObserver sees a frame that lasts a
 * fraction of `motion.duration.base`, which a polling assertion could miss.
 */
async function watchLeaving(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __leaving?: boolean; __leavingObs?: MutationObserver };
    w.__leaving = false;
    w.__leavingObs?.disconnect();
    const check = () => {
      if (document.querySelector('[data-testid="presenter-syllable-parts-leaving"]')) w.__leaving = true;
    };
    w.__leavingObs = new MutationObserver(check);
    w.__leavingObs.observe(document.body, { subtree: true, childList: true, attributes: true });
  });
}

function leftSeen(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { __leaving?: boolean }).__leaving === true);
}

/** `#rrggbb` as the computed `rgb(r, g, b)` string. */
function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** Every element of the open slide stays inside the stage box. */
async function expectInsideStage(page: Page): Promise<void> {
  const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
  const outside = await page.getByTestId('presenter-stage').evaluate((root, box) => {
    const out: string[] = [];
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < box.x - 1 || r.top < box.y - 1 || r.right > box.x + box.width + 1 || r.bottom > box.y + box.height + 1) out.push(`${el.tagName} ${el.getAttribute('data-testid') ?? ''} ${(el.textContent ?? '').slice(0, 30)}`);
    }
    return out;
  }, stage);
  expect(outside).toEqual([]);
}

test.describe('PR 7 teaching slides at 1280 x 720', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });
  test.beforeEach(async ({ page }) => koreanVoice(page));

  test('syllable, word, order, card and activity slides reveal build by build', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(link(TEACHING_DECK));
    await startLesson(page);

    // Syllable (README D5): the parts alone, then the block with the parts small beside it, then
    // the romanization, then the speaker.
    await forwardTo(page, 'Syllable');
    await expect(page.getByTestId('presenter-syllable-parts')).toBeVisible();
    await expect(page.getByTestId('presenter-syllable')).toHaveCount(0);
    await shot(page, 'presenter-syllable-build0-1280x720');
    await watchLeaving(page);
    await page.keyboard.press('PageDown');
    await expect(page.getByTestId('presenter-syllable')).toBeVisible();
    await expect(page.getByTestId('presenter-syllable-parts')).toHaveCount(0);
    // With motion the parts slide together and fade over the block, then leave.
    await expect.poll(() => leftSeen(page)).toBe(true);
    await expect(page.getByTestId('presenter-syllable-parts-leaving')).toHaveCount(0);
    await expectDrawn(page, 'presenter-syllable-rom', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-syllable-rom', true);
    await expect(page.getByTestId('presenter-syllable-rom')).toHaveText('ga');
    await expect(page.getByTestId('presenter-syllable-speaker')).toBeDisabled();
    await page.keyboard.press('PageDown');
    await expect(page.getByTestId('presenter-syllable-speaker')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Play the sound' })).toBeVisible();
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Next');
    await expect(page.getByTestId('presenter-live')).toHaveText(/^Slide \d+ of \d+, Syllable, .+, ga$/);
    await shot(page, 'presenter-syllable-1280x720');

    // Heritage card: art, title and the Korean chip, then the fact.
    await forwardTo(page, 'Card');
    await expect(page.getByText('Heritage card')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Book' })).toBeVisible();
    await expect(page.getByTestId('presenter-card-chip')).toContainText('chaek');
    await expectDrawn(page, 'presenter-card-fact', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-card-fact', true);
    await shot(page, 'presenter-card-1280x720');

    // Word: the Korean with its romanization, then the gloss.
    await forwardTo(page, 'Word');
    await expect(page.getByTestId('presenter-word')).toBeVisible();
    await expectDrawn(page, 'presenter-word-rom', true);
    await expectDrawn(page, 'presenter-word-gloss', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-word-gloss', true);
    await expect(page.getByTestId('presenter-live')).toHaveText(/^Slide \d+ of \d+, Word, .+, .+, .+$/);
    await shot(page, 'presenter-vocab-1280x720');

    // Order: the steps in their true order one by one, then "What comes first?" with shape markers.
    await forwardTo(page, 'Order');
    // Steps not reached yet keep their space but are hidden from assistive tech, so count them by test id.
    const steps = page.getByTestId('presenter-sequence-steps').getByTestId('presenter-step');
    const n = await steps.count();
    expect(n).toBeGreaterThanOrEqual(3);
    await expect(steps.nth(0)).toHaveCSS('opacity', '1');
    await expect(steps.nth(1)).toHaveCSS('opacity', '0');
    for (let i = 1; i < n; i++) await page.keyboard.press('PageDown');
    await expect(steps.nth(n - 1)).toHaveCSS('opacity', '1');
    await shot(page, 'presenter-sequence-steps-1280x720');
    await page.keyboard.press('PageDown');
    await expect(page.getByRole('heading', { name: 'What comes first?' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Option 1, circle' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Option 2, triangle' })).toBeVisible();
    await expect(page.getByTestId('presenter-sequence-order').getByRole('listitem')).toHaveCount(n);
    await expect(page.getByTestId('presenter-sequence-order').getByRole('img', { name: /^Option \d+, (circle|triangle|square|star)$/ })).toHaveCount(n);
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Next');
    await shot(page, 'presenter-sequence-order-1280x720');
    // Back shows the true order again.
    await page.keyboard.press('PageUp');
    await expect(page.getByTestId('presenter-sequence-steps')).toBeVisible();

    // Activity: one build; Start timer opens the class timer with the slide's minutes (PR 9).
    await page.keyboard.press('PageDown');
    await forwardTo(page, 'Activity');
    await expect(page.getByTestId('presenter-live')).toHaveText(/Activity, Write it in the air$/);
    await expect(page.getByRole('heading', { name: 'Write it in the air' })).toBeVisible();
    await expect(page.getByText('3 minutes')).toBeVisible();
    await expect(page.getByTestId('presenter-start-timer')).toHaveAccessibleName('Start timer');
    await expect(page.getByTestId('presenter-start-timer')).toBeEnabled();
    // Enabled with the class timer (PR 9), it is the filled primary action.
    await expect(page.getByTestId('presenter-start-timer')).toHaveCSS('background-color', rgb(colors.brand.primaryDark));
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Next');
    await shot(page, 'presenter-activity-1280x720');
    await page.getByTestId('presenter-start-timer').click();
    await expect(page.getByTestId('presenter-timer-corner')).toBeVisible();
    await expect(page.getByTestId('presenter-timer-text')).toHaveText(/^(3:00|2:5\d)$/);
    await page.getByTestId('presenter-timer-close').click();
    await expect(page.getByTestId('presenter-timer-corner')).toHaveCount(0);

    // No slide overflows the stage, and the page never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    expect(errors).toEqual([]);
  });

  test('a bundled card the heritage art cannot draw still shows a face, never an empty art build', async ({ page }) => {
    // card:sagwa is bundled but has no HeritageCardArt drawing: the card face falls back (CardArt, F-STORY-006 D7).
    await page.goto(
      link({ ...DECK, id: 'lecture:e2e019', title: 'Apple card', blocks: [{ kind: 'cards', cardIds: ['card:sagwa'] }], options: { romanization: 'tap' } }),
    );
    await startLesson(page);
    await forwardTo(page, 'Card');
    await expect(page.getByRole('heading', { name: 'Apple' })).toBeVisible();
    const art = page.getByTestId('presenter-card-art');
    await expect(art).toBeVisible();
    await expect(art).toHaveAccessibleName('Apple');
    // The word face is taught Korean, so it is set in the presenter font like the chip (section 3.6).
    const word = art.locator('[lang="ko"]');
    await expect(word).toHaveText('사과');
    await expect(word).toHaveCSS('font-family', /HR Presenter KR/);
    // The art build keeps its place: on landing the chip romanization and the fact wait for their own builds.
    await expectDrawn(page, 'presenter-card-chip-rom', false);
    await expectDrawn(page, 'presenter-card-fact', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-card-chip-rom', true);
    await expectDrawn(page, 'presenter-card-fact', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-card-fact', true);
    await shot(page, 'presenter-card-fallback-1280x720');
  });

  test('a card the heritage art draws shows it through the same card face', async ({ page }) => {
    await page.goto(link({ ...DECK, id: 'lecture:e2e020', title: 'Book card', blocks: [{ kind: 'cards', cardIds: ['card:book'] }] }));
    await startLesson(page);
    await forwardTo(page, 'Card');
    const art = page.getByTestId('presenter-card-art');
    await expect(art).toBeVisible();
    await expect(art.locator('svg').first()).toBeVisible();
    await expect(art.locator('[lang="ko"]')).toHaveCount(0);
  });

  test('with Shift+R the card, the word and the order slide give romanization its own build', async ({ page }) => {
    await page.goto(link(TEACHING_DECK));
    await startLesson(page);
    await page.keyboard.press('Shift+KeyR');
    await forwardTo(page, 'Card');
    await expectDrawn(page, 'presenter-card-chip-rom', false);
    await expectDrawn(page, 'presenter-card-fact', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-card-chip-rom', true);
    await expectDrawn(page, 'presenter-card-fact', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-card-fact', true);
    await forwardTo(page, 'Word');
    await expectDrawn(page, 'presenter-word-rom', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-word-rom', true);
    await expectDrawn(page, 'presenter-word-gloss', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-word-gloss', true);

    await forwardTo(page, 'Order');
    const steps = await page.getByTestId('presenter-sequence-steps').getByTestId('presenter-step').count();
    // n step builds, one romanization build, then the question.
    expect(await revealAll(page)).toBe(steps + 1);
    await expect(page.getByRole('heading', { name: 'What comes first?' })).toBeVisible();
  });
});

/** PR 12: a word topic (Food, four words) through the vocab adapter. */
const TOPIC_DECK: LectureDeckInput = {
  ...DECK,
  id: 'lecture:e2e012',
  title: 'Food words',
  blocks: [{ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab:sagwa-apple', 'vocab:uyu', 'vocab:ppang', 'vocab:gimchi'] }],
};

test.describe('PR 12 word topic slides at 1280 x 720', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('the topic title, then each word with its picture at the build after the gloss', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(link(TOPIC_DECK));
    await startLesson(page);

    // Title (slide-topic.md): the "Word topics" kind label, the topic title and its Hoya line.
    await expect(page.getByTestId('presenter-live')).toHaveText(/^Slide 1 of \d+, Title, Food/);
    await expect(page.getByTestId('presenter-title-kind')).toHaveText('Word topics');
    await expect(page.getByRole('heading', { name: 'Food' })).toBeVisible();
    await shot(page, 'presenter-topic-title-1280x720');

    // Word (README D9): the word with its romanization, then the gloss, then the WordArt picture.
    await forwardTo(page, 'Word');
    await expect(page.getByTestId('presenter-word')).toHaveText('사과');
    await expect(page.getByTestId('presenter-word-rom')).toHaveText('sagwa');
    await expectDrawn(page, 'presenter-word-gloss', false);
    await expectDrawn(page, 'presenter-word-art', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-word-gloss', true);
    await expectDrawn(page, 'presenter-word-art', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-word-art', true);
    await expect(page.getByRole('img', { name: 'apple' })).toBeVisible();
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Next');
    await shot(page, 'presenter-topic-word-1280x720');

    // A topic word whose picture is a heritage card (kimchi): the card art at the same build, no WordArt.
    const word = page.getByTestId('presenter-word');
    const atKimchi = async () => (await word.count()) > 0 && (await word.textContent()) === '김치';
    for (let i = 0; i < 40 && !(await atKimchi()); i++) {
      await page.keyboard.press('PageDown');
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    await expect(page.getByTestId('presenter-live')).toHaveText(/^Slide \d+ of \d+, Word\b/);
    await expect(word).toHaveText('김치');
    await expectDrawn(page, 'presenter-word-gloss', false);
    await page.keyboard.press('PageDown');
    await expectDrawn(page, 'presenter-word-gloss', true);
    await page.keyboard.press('PageDown');
    await expect(page.getByRole('img', { name: 'kimchi' })).toBeVisible();
    await expect(page.getByTestId('presenter-word-art')).toHaveCount(0);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    expect(errors).toEqual([]);
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
    for (let i = 0; i < 8 && (await page.getByTestId('presenter-next').getAttribute('aria-label')) === 'Reveal'; i++) await page.keyboard.press('ArrowDown');
    await shot(page, 'presenter-letter-1920x1080');
    await page.keyboard.press('End');
    await shot(page, 'presenter-end-1920x1080');
  });

  test('the syllable joins at once and the teaching slides scale with the stage', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(link(TEACHING_DECK));
    await startLesson(page);
    await forwardTo(page, 'Syllable');
    await watchLeaving(page);
    await page.keyboard.press('PageDown');
    // Reduced motion: an instant swap; the parts never draw over the block.
    await expect(page.getByTestId('presenter-syllable')).toBeVisible();
    await expect(page.getByTestId('presenter-syllable-parts')).toHaveCount(0);
    expect(await leftSeen(page)).toBe(false);
    await revealAll(page);
    await shot(page, 'presenter-syllable-1920x1080');
    await forwardTo(page, 'Card');
    await revealAll(page);
    await shot(page, 'presenter-card-1920x1080');
    await forwardTo(page, 'Word');
    await revealAll(page);
    await shot(page, 'presenter-vocab-1920x1080');
    await forwardTo(page, 'Order');
    await revealAll(page);
    await shot(page, 'presenter-sequence-order-1920x1080');
    await page.keyboard.press('PageDown');
    await forwardTo(page, 'Activity');
    await shot(page, 'presenter-activity-1920x1080');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
  });
});

test.describe('presenter on a 4:3 projector, 1024 x 768', () => {
  test.use({ viewport: { width: 1024, height: 768 }, isMobile: false, hasTouch: false });

  test('a taller logical stage at unit 0.8, no bars', async ({ page }) => {
    await page.goto(link());
    await startLesson(page);
    // 1024 x 768 minus the band: with one row of controls a 1024 x 648 box (unit 0.8, logical stage
    // 1280 x 810); where the labels are wider and the controls wrap, the band grows and the stage
    // takes the rest (D1), still at unit 0.8 and the full width.
    // The band is measured after the first layout (`onBandHeight`): wait until the stage has settled into the rest.
    // The fixtures' engine has no Korean voice, so the "You say it!" chip joins the bar (PR 9); the
    // stage follows the band once the bar has laid out again.
    await expect(page.getByTestId('presenter-chip-no-voice')).toBeVisible();
    const measure = async () => ({
      box: (await page.getByTestId('presenter-stage').boundingBox())!,
      band: (await page.getByTestId('presenter-bar-band').boundingBox())!,
    });
    await expect.poll(async () => {
      const { box, band } = await measure();
      return box.height === 768 - band.height;
    }).toBe(true);
    const { box, band } = await measure();
    expect(band.height).toBeGreaterThanOrEqual(120);
    expect(box.width).toBe(1024);
    expect(box.y + box.height).toBeLessThanOrEqual(band.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
    await page.keyboard.press('ArrowRight');
    await revealAll(page);
    await shot(page, 'presenter-letter-1024x768');
  });

  test('every PR 7 teaching slide, fully revealed, stays inside the stage', async ({ page }) => {
    await page.goto(link(TEACHING_DECK));
    await startLesson(page);
    for (const kind of ['Syllable', 'Card', 'Word', 'Order']) {
      await forwardTo(page, kind);
      await revealAll(page);
      // Let the syllable join finish before measuring.
      await expect(page.getByTestId('presenter-syllable-parts-leaving')).toHaveCount(0);
      await expectInsideStage(page);
    }
    // The order question is the order slide's last build; the next slide follows.
    await page.keyboard.press('PageDown');
    await forwardTo(page, 'Activity');
    await expectInsideStage(page);
    await shot(page, 'presenter-activity-1024x768');
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
    // A small window with a fine pointer is not a phone (F-TCH-004 section 3.6): the too-small page, never the rotate page.
    await expect(page.getByText('Make the window bigger or turn the screen.')).toBeVisible();
    await expect(page.getByTestId('presenter-rotate')).toHaveCount(0);
    await shot(page, 'presenter-too-small-375x667');
  });
});

test.describe('presenter at the narrowest phone, 320 x 568', () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: false, hasTouch: false });

  test('the start screen and the too-small page never scroll sideways', async ({ page }) => {
    await page.goto(link());
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await startLesson320(page);
    await expect(page.getByText('Make the window bigger or turn the screen.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
});

async function startLesson320(page: Page): Promise<void> {
  const start = page.getByTestId('presenter-start-button');
  await expect(start).toBeEnabled({ timeout: 10_000 });
  await start.click();
}

// F-TCH-004 PR 11: story slides. "King Sejong's New Letters" is reviewed (the Library lists it):
// its cover title, seven scenes, the order slide (PR 7) and three checks.
const STORY_DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2e011',
  title: 'Hangul history',
  createdAt: '2026-10-13T09:00:00Z',
  seed: 11,
  blocks: [{ kind: 'story', storyId: 'story:sejong-new-letters', checks: true }],
};

/** Forward (through any reveals) until the counter reads slide `n`. */
async function goToSlide(page: Page, n: number): Promise<void> {
  for (let i = 0; i < 40 && !(await counter(page)).startsWith(`${n} /`); i++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => counter(page)).toMatch(new RegExp(`^${n} /`));
}

/** Forward until the stage shows `testId` (at most `max` presses). */
async function nextUntil(page: Page, testId: string, max = 40): Promise<void> {
  for (let i = 0; i < max && (await page.getByTestId(testId).count()) === 0; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId(testId)).toBeVisible();
}

test.describe('presenter story slides at 1280 x 720 (PR 11)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('a story deck: cover title, scenes with art, narration and Korean, then checks with a positive reveal', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(link(STORY_DECK));
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    // Title, 7 scenes, the order slide, 3 checks and the End slide; nothing is left out.
    await expect(page.getByTestId('presenter-start-facts')).toHaveText(/^13 slides · about \d+ minutes?$/);
    await expect(page.getByTestId('presenter-see-which')).toHaveCount(0);
    await startLesson(page);

    // The cover title: the cover scene instead of Hoya, the Story label, the title and Hoya's line.
    await expect(page.getByTestId('presenter-story-cover')).toBeVisible();
    const stage = page.getByTestId('presenter-stage');
    await expect(stage.getByText('Story', { exact: true })).toBeVisible();
    await expect(stage.getByRole('heading', { name: "King Sejong's New Letters" })).toBeVisible();
    await expect(stage.getByText("Come with me to Joseon! Let's find out why King Sejong made new letters.")).toBeVisible();
    await shot(page, 'presenter-story-title-1280x720');

    // The fourth scene: art first (named by its caption, README D8), then narration, then the Korean line.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-story')).toBeVisible();
    await expect(page.getByTestId('presenter-live')).toHaveText("Slide 2 of 13, Story, Hoya lands in King Sejong's Joseon");
    await goToSlide(page, 5);
    await expect(page.getByTestId('presenter-live')).toHaveText('Slide 5 of 13, Story, He names them Hunminjeongeum');
    await expect(page.getByRole('img', { name: 'He names them Hunminjeongeum' })).toBeVisible();
    // The caption is the art's name only, never drawn as text.
    await expect(stage.getByText('He names them Hunminjeongeum', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('presenter-story-narration')).toHaveCSS('opacity', '0');
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Reveal');
    expect(await revealAll(page)).toBe(2);
    await expect(page.getByTestId('presenter-story-narration')).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('presenter-story-narration')).toContainText('He named them Hunminjeongeum');
    await expect(page.getByTestId('presenter-story-narration')).toContainText('baekseong');
    await expect(page.getByTestId('presenter-story-korean')).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('presenter-story-korean')).toContainText('Hunminjeongeum');
    await expect(page.getByTestId('presenter-story-korean')).toContainText('the proper sounds for teaching the people');
    // Read-to-me (S) on a scene with no voice falls back quietly: the text stays on the slide (D6).
    await page.keyboard.press('KeyS');
    await expect(page.getByTestId('presenter-story-narration')).toHaveCSS('opacity', '1');
    await shot(page, 'presenter-story-1280x720');

    // The first check: its own prompt and four options with shape-and-number markers; no answer yet.
    await nextUntil(page, 'presenter-check');
    await expect(page.getByTestId('presenter-live')).toHaveText('Slide 10 of 13, Question');
    await expect(page.getByTestId('presenter-check-prompt')).toHaveText('Who created Hangul?');
    await expect(page.getByRole('img', { name: 'Option 1, circle' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Option 4, star' })).toBeVisible();
    await expect(page.getByTestId('presenter-quiz-mark')).toHaveCount(0);
    await expect(page.getByTestId('presenter-quiz-answer')).toHaveCSS('opacity', '0');
    await expect(page.getByTestId('presenter-check-explain')).toHaveCSS('opacity', '0');
    await shot(page, 'presenter-story-check-question-1280x720');

    // The teacher's reveal: the right option marked, Hoya's answer, the explanation; the others only soften.
    await page.keyboard.press('PageDown');
    await expect(page.getByRole('img', { name: "Hoya's answer" })).toBeVisible();
    await expect(page.getByTestId('presenter-quiz-answer')).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('presenter-check-explain')).toHaveCSS('opacity', '1');
    const options = page.getByTestId('presenter-quiz-options');
    const marked = options.locator('[data-testid^="presenter-quiz-option-"]').filter({ has: page.getByTestId('presenter-quiz-mark') });
    await expect(marked).toHaveCount(1);
    await expect(marked).toContainText('King Sejong');
    await expect(marked).toHaveCSS('opacity', '1');
    const others = options.locator('[data-testid^="presenter-quiz-option-"]').filter({ hasNot: page.getByTestId('presenter-quiz-mark') });
    await expect(others).toHaveCount(3);
    for (const o of await others.all()) await expect(o).toHaveCSS('opacity', '0.8');
    // Anti-shame: no failure words anywhere on the stage (D3).
    await expect(stage).not.toContainText(/wrong|incorrect|fail|miss/i);
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Next');
    await shot(page, 'presenter-story-check-answer-1280x720');

    await page.keyboard.press('End');
    await expect(page.getByText('Today we met')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('with romanization on tap, a scene shows every romanization at one last reveal', async ({ page }) => {
    await page.goto(link({ ...STORY_DECK, id: 'lecture:e2e012', options: { romanization: 'tap' } }));
    await startLesson(page);
    await goToSlide(page, 5);
    await expect(page.getByTestId('presenter-live')).toHaveText('Slide 5 of 13, Story, He names them Hunminjeongeum');
    // Before the romanization reveal the chips and the Korean line name only the Korean: a screen
    // reader never says the hidden romanization early, and the hidden text is aria-hidden too.
    const chip = page.getByTestId('presenter-story-chip').filter({ hasText: 'baekseong' });
    const line = page.getByTestId('presenter-story-korean-line');
    for (let i = 0; i < 2; i++) await page.keyboard.press('PageDown');
    await expect(page.getByTestId('presenter-story-narration')).toHaveCSS('opacity', '1');
    await expect(chip.getByText('baekseong')).toHaveCSS('opacity', '0');
    await expect(chip.getByText('baekseong')).toHaveAttribute('aria-hidden', 'true');
    await expect(chip).not.toHaveAttribute('aria-label', /baekseong/);
    await expect(line).not.toHaveAttribute('aria-label', /Hunminjeongeum/);
    await expect(line.getByText('Hunminjeongeum', { exact: true })).toHaveAttribute('aria-hidden', 'true');
    await page.keyboard.press('PageDown');
    await expect(chip.getByText('baekseong')).toHaveCSS('opacity', '1');
    await expect(chip.getByText('baekseong')).not.toHaveAttribute('aria-hidden', 'true');
    await expect(chip).toHaveAttribute('aria-label', /, baekseong$/);
    await expect(line).toHaveAttribute('aria-label', /, Hunminjeongeum$/);
    await expect(page.getByTestId('presenter-story-korean').getByText('Hunminjeongeum', { exact: true })).toHaveCSS('opacity', '1');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('presenter-story-korean').getByText('Hunminjeongeum', { exact: true })).toHaveCSS('opacity', '0');
    await shot(page, 'presenter-story-tap-1280x720');
  });

  test('a story the bundle does not have is listed as not shown, never drawn', async ({ page }) => {
    await page.goto(link({ ...STORY_DECK, id: 'lecture:e2e013', blocks: [{ kind: 'story', storyId: 'story:not-in-bundle' }, { kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }] }));
    await expect(page.getByTestId('presenter-start')).toBeVisible();
    await page.getByTestId('presenter-see-which').click();
    await expect(page.getByTestId('presenter-skipped-list').getByText('Not in this version of the app')).toBeVisible();
    await startLesson(page);
    await expect(page.getByTestId('presenter-story-cover')).toHaveCount(0);
    await expect(page.getByTestId('presenter-glyph')).toBeAttached();
  });
});

/** A speech engine with an English and a Korean voice that records each utterance and each cancel. */
async function recordingSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: { lang: string; text: string }[] = [];
    const record = window as Window & { __spoken?: typeof log; __cancels?: number };
    record.__spoken = log;
    record.__cancels = 0;
    const voices = [
      { name: 'Samantha', lang: 'en-US', voiceURI: 'Samantha', localService: true, default: true },
      { name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false },
    ];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: { name: string } | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: Utterance) => {
          if (u.volume !== 0) log.push({ lang: u.lang, text: u.text });
          setTimeout(() => {
            u.onstart?.();
            u.onend?.();
          }, 20);
        },
        cancel: () => {
          record.__cancels = (record.__cancels ?? 0) + 1;
        },
        getVoices: () => voices,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

const spoken = (page: Page) => page.evaluate(() => (window as Window & { __spoken?: { lang: string; text: string }[] }).__spoken ?? []);
const cancels = (page: Page) => page.evaluate(() => (window as Window & { __cancels?: number }).__cancels ?? 0);

test.describe('presenter Read-to-me and the projected check at 1280 x 720 (PR 11)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('S reads the scene: the narration in English and its keyword chip in Korean; the next slide stops it', async ({ page }) => {
    await recordingSpeech(page);
    await page.goto(link({ ...STORY_DECK, id: 'lecture:e2e014' }));
    await startLesson(page);
    await goToSlide(page, 5);
    await revealAll(page);
    const before = (await spoken(page)).length;
    await page.keyboard.press('KeyS');
    await expect.poll(async () => (await spoken(page)).slice(before)).toContainEqual(expect.objectContaining({ lang: 'en-US', text: expect.stringContaining('He named them Hunminjeongeum') }));
    await expect.poll(async () => (await spoken(page)).slice(before).some((u) => u.lang === 'ko-KR')).toBe(true);
    const cancelled = await cancels(page);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => cancels(page)).toBeGreaterThan(cancelled);
  });

  test('a pick-meaning target keeps its gloss for the answer; hidden parts are hidden from assistive tech too', async ({ page }) => {
    // The Bowl That Measured the Rain: its second check asks what the target word means.
    await page.goto(link({ ...STORY_DECK, id: 'lecture:e2e015', blocks: [{ kind: 'story', storyId: 'story:cheugugi-rain-gauge', checks: true }], options: { romanization: 'tap' } }));
    await startLesson(page);
    await nextUntil(page, 'presenter-check');
    await expect(page.getByTestId('presenter-check-explain')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('presenter-quiz-answer')).toHaveAttribute('aria-hidden', 'true');
    await page.keyboard.press('PageDown');
    await expect(page.getByTestId('presenter-check-explain')).not.toHaveAttribute('aria-hidden', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-check-prompt')).toContainText('What does a');
    const gloss = page.getByTestId('presenter-check-gloss');
    await expect(gloss).toHaveText('rain gauge');
    await expect(gloss).toHaveCSS('opacity', '0');
    await expect(gloss).toHaveAttribute('aria-hidden', 'true');
    // The target chip names its romanization only once it shows (romanization on tap).
    const target = page.getByTestId('presenter-check-target').first();
    await expect(target).toHaveAttribute('aria-label', '측우기');
    await page.keyboard.press('PageDown');
    await expect(target).toHaveAttribute('aria-label', '측우기, cheugugi');
    await expect(gloss).toHaveCSS('opacity', '1');
    await expect(gloss).not.toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('presenter-check-explain')).toHaveCSS('opacity', '1');
  });
});

test.describe('presenter story slides on a 4:3 projector, 1024 x 768 (PR 11)', () => {
  test.use({ viewport: { width: 1024, height: 768 }, isMobile: false, hasTouch: false });

  test('every scene and every revealed check stays inside the stage', async ({ page }) => {
    await page.goto(link({ ...STORY_DECK, id: 'lecture:e2e016', blocks: [{ kind: 'story', storyId: 'story:cheugugi-rain-gauge', checks: true }] }));
    await startLesson(page);
    const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
    const inside = async (testId: string) => {
      const part = page.getByTestId(testId);
      if ((await part.count()) === 0) return;
      const box = (await part.boundingBox())!;
      expect(box.x, testId).toBeGreaterThanOrEqual(stage.x - 1);
      expect(box.y, testId).toBeGreaterThanOrEqual(stage.y - 1);
      expect(box.x + box.width, testId).toBeLessThanOrEqual(stage.x + stage.width + 1);
      expect(box.y + box.height, testId).toBeLessThanOrEqual(stage.y + stage.height + 1);
    };
    const total = Number((await counter(page)).split('/')[1]!.trim());
    for (let n = 1; n < total; n++) {
      await goToSlide(page, n);
      await revealAll(page);
      for (const id of ['presenter-story-art', 'presenter-story-narration', 'presenter-story-korean', 'presenter-check-explain', 'presenter-quiz-options', 'presenter-quiz-answer']) await inside(id);
    }
    await shot(page, 'presenter-story-1024x768');
  });
});

test.describe('presenter story slides at 1920 x 1080 (PR 11)', () => {
  test.use({ viewport: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false });

  test('the scene and the check scale with the stage', async ({ page }) => {
    await page.goto(link(STORY_DECK));
    await startLesson(page);
    await shot(page, 'presenter-story-title-1920x1080');
    await goToSlide(page, 5);
    await revealAll(page);
    // 400 scene units at unit 1.5.
    const art = (await page.getByTestId('presenter-story-art').boundingBox())!;
    expect(Math.round(art.width)).toBe(600);
    await shot(page, 'presenter-story-1920x1080');
    await nextUntil(page, 'presenter-check');
    await page.keyboard.press('PageDown');
    await shot(page, 'presenter-story-check-1920x1080');
  });
});

/** PR 9: letters, a Match Sound quiz over them, a one-minute activity and the class code. */
const TOOLS_DECK: LectureDeckInput = {
  ...DECK,
  id: 'lecture:e2e009',
  title: 'Week 5 review',
  blocks: [
    { kind: 'jamo-set', jamoIds: ['jamo:giyeok', 'jamo:nieun', 'jamo:a', 'jamo:eo'] },
    { kind: 'quiz', from: 'all', rounds: 2 },
    { kind: 'activity', preset: 'air-write', minutes: 1 },
    { kind: 'class-code', code: 'HYRA42' },
  ],
  picker: null,
};

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test.describe('PR 9 quiz and class tools at 1280 x 720, with a Korean voice', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });
  test.beforeEach(async ({ page }) => koreanVoice(page));

  test('a Match Sound quiz: the question with the speaker, markers on every option, then the teacher reveal', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(link(TOOLS_DECK));
    await startLesson(page);
    await forwardTo(page, 'Question');
    await expect(page.getByRole('heading', { name: 'Which letter makes this sound?' })).toBeVisible();
    await expect(page.getByTestId('presenter-quiz-speaker')).toBeEnabled();
    await expect(page.getByTestId('presenter-say-it')).toHaveCount(0);
    // The speaker and S both say the prompt's carrier syllable.
    const said = (): Promise<string[]> => page.evaluate(() => [...(window as unknown as { __spoken: string[] }).__spoken]);
    const already = (await said()).length;
    await page.getByTestId('presenter-quiz-speaker').click();
    await expect.poll(async () => (await said()).length).toBe(already + 1);
    expect((await said()).at(-1)).toMatch(/^[\uac00-\ud7af]+$/);
    await page.keyboard.press('s');
    await expect.poll(async () => (await said()).length).toBe(already + 2);
    expect((await said()).at(-1)).toBe((await said()).at(-2));
    const options = page.getByTestId('presenter-quiz-options').getByRole('listitem');
    await expect(options).toHaveCount(4);
    for (const [n, shape] of [[1, 'circle'], [2, 'triangle'], [3, 'square'], [4, 'star']] as const) {
      await expect(page.getByRole('img', { name: `Option ${n}, ${shape}` })).toBeVisible();
    }
    await expect(page.getByTestId('presenter-quiz-mark')).toHaveCount(0);
    await expect(page.getByTestId('presenter-quiz-answer')).toHaveCSS('opacity', '0');
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Reveal');
    await shot(page, 'presenter-quiz-question-1280x720');

    const before = await page.getByTestId('presenter-quiz-option-1').boundingBox();
    await page.keyboard.press('PageDown');
    await expect(page.getByTestId('presenter-quiz-mark')).toHaveCount(1);
    await expect(page.getByRole('img', { name: "Hoya's answer" })).toBeVisible();
    await expect(page.getByTestId('presenter-quiz-answer')).toHaveCSS('opacity', '1');
    // The options never move; one is the answer, the other three are dimmed, never red.
    expect(await page.getByTestId('presenter-quiz-option-1').boundingBox()).toEqual(before);
    let dimmed = 0;
    for (let i = 1; i <= 4; i++) {
      const option = page.getByTestId(`presenter-quiz-option-${i}`);
      if ((await option.getByTestId('presenter-quiz-mark').count()) === 0) {
        await expect(option).toHaveCSS('opacity', '0.8');
        dimmed += 1;
      }
    }
    expect(dimmed).toBe(3);
    await expect(page.getByText(/wrong|incorrect|fail/i)).toHaveCount(0);
    await shot(page, 'presenter-quiz-answer-1280x720');
    expect(errors).toEqual([]);
  });

  test('the timer: T opens it full with the presets, Small puts it in the corner while slides move, Close shuts it', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(link(TOOLS_DECK));
    await startLesson(page);
    await page.keyboard.press('t');
    await expect(page.getByTestId('presenter-timer-full')).toBeVisible();
    for (const label of ['30 s', '1 min', '3 min', '5 min']) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    await page.getByRole('button', { name: '1 min', exact: true }).click();
    await expect(page.getByTestId('presenter-timer-text').first()).toHaveText(/^(1:00|0:5\d)$/);
    await expect(page.getByRole('timer', { name: /^Time left: \d:\d\d$/ })).toBeVisible();
    await shot(page, 'presenter-timer-full-1280x720');
    // Full screen swallows navigation: End, then a later change that has drawn, and the slide has not moved.
    const live = await liveText(page);
    const counter = await page.getByTestId('presenter-counter').textContent();
    await page.keyboard.press('End');
    await page.getByTestId('presenter-timer-numbers').click();
    await expect(page.getByTestId('presenter-timer-text')).toHaveCount(0);
    expect(await liveText(page)).toBe(live);
    await expect(page.getByTestId('presenter-counter')).toHaveText(counter ?? '');
    await page.getByTestId('presenter-timer-numbers').click();
    await page.getByTestId('presenter-timer-small').click();
    await expect(page.getByTestId('presenter-timer-corner')).toBeVisible();
    // In the corner the lesson goes on under it.
    await page.keyboard.press('End');
    await expect(page.getByTestId('presenter-live')).not.toHaveText(live);
    await page.getByTestId('presenter-timer-pause').click();
    await expect(page.getByTestId('presenter-timer-resume')).toHaveAccessibleName('Go on');
    const paused = await page.getByTestId('presenter-timer-text').textContent();
    await page.waitForTimeout(1200);
    expect(await page.getByTestId('presenter-timer-text').textContent()).toBe(paused);
    await shot(page, 'presenter-timer-corner-1280x720');
    await page.getByTestId('presenter-timer-close').click();
    await expect(page.getByTestId('presenter-timer-corner')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('at zero the timer says All done!, with no alarm and no red', async ({ page }) => {
    await page.clock.install();
    await page.goto(link(TOOLS_DECK));
    await startLesson(page);
    await page.keyboard.press('t');
    await page.getByRole('button', { name: '30 s', exact: true }).click();
    await page.clock.runFor(31_000);
    await expect(page.getByTestId('presenter-timer-done')).toHaveText('All done!');
    await expect(page.getByTestId('presenter-timer-text')).toHaveText('0:00');
    await expect(page.getByTestId('presenter-timer-pause')).toHaveCount(0);
    await shot(page, 'presenter-timer-done-1280x720');
  });

  test('the helper picker is gone (LV-H): P does nothing and the bar has no Helper', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(link(TOOLS_DECK));
    await startLesson(page);
    const live = await liveText(page);
    await page.keyboard.press('p');
    await expect(page.getByTestId('presenter-picker')).toHaveCount(0);
    expect(await liveText(page)).toBe(live);
    await expect(page.getByTestId('presenter-picker-button')).toHaveCount(0);
    await expect(page.getByRole('toolbar').getByText('Helper')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Blank hides the slide, its Pause button swaps in Pause, and the first key brings the slide back unchanged', async ({ page }) => {
    await page.goto(link(TOOLS_DECK));
    await startLesson(page);
    await page.keyboard.press('ArrowRight');
    const live = await liveText(page);
    await page.keyboard.press('b');
    await expect(page.getByTestId('presenter-blank')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Eyes on me' })).toBeVisible();
    await shot(page, 'presenter-blank-1280x720');
    await page.getByTestId('presenter-blank-pause').click();
    await expect(page.getByTestId('presenter-pause')).toBeVisible();
    await expect(page.getByTestId('presenter-pause-gloss')).toHaveText('wait a moment');
    await expect(page.getByText('jamkkan')).toBeVisible();
    await shot(page, 'presenter-pause-1280x720');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-pause')).toHaveCount(0);
    expect(await liveText(page)).toBe(live);
    // Space on the Blank overlay clears it (the dialog, not its Pause button, has focus).
    await page.keyboard.press('.');
    await expect(page.getByTestId('presenter-blank')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('presenter-blank')).toHaveCount(0);
    expect(await liveText(page)).toBe(live);
  });

  test('the grid jumps to a slide, hides one for this lesson, and has no Hide on the End slide', async ({ page }) => {
    await page.goto(link(TOOLS_DECK));
    await startLesson(page);
    await page.keyboard.press('g');
    const grid = page.getByTestId('presenter-grid');
    await expect(grid).toBeVisible();
    await expect(page.getByRole('heading', { name: 'All slides' })).toBeVisible();
    await expect(page.getByTestId('presenter-grid-item-1')).toContainText('Now');
    const count = await grid.locator('[data-testid^="presenter-grid-item-"]').count();
    expect(count).toBeGreaterThan(5);
    await expect(page.getByTestId(`presenter-grid-toggle-${count}`)).toHaveCount(0);
    // No Korean on any thumbnail.
    expect(await grid.innerText()).not.toMatch(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/);
    await page.getByTestId('presenter-grid-toggle-3').click();
    await expect(page.getByTestId('presenter-grid-item-3')).toContainText('Hidden');
    await shot(page, 'presenter-grid-1280x720');
    await page.getByTestId('presenter-grid-goto-2').click();
    await expect(grid).toHaveCount(0);
    await expect(page.getByTestId('presenter-counter')).toHaveText(`2 / ${count}`);
    await revealAll(page);
    await page.keyboard.press('PageDown');
    // Slide 3 is hidden for this lesson: the next slide is 4.
    await expect(page.getByTestId('presenter-counter')).toHaveText(`4 / ${count}`);
    // Opened from the bar, Tab stays inside the grid, and closing it gives focus back to Slides.
    await page.getByTestId('presenter-grid-button').click();
    await expect(grid).toBeVisible();
    const inGrid = (): Promise<boolean> => page.evaluate(() => document.activeElement?.closest('[data-testid="presenter-grid"]') != null);
    await page.keyboard.press('Shift+Tab');
    expect(await inGrid()).toBe(true);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      expect(await inGrid()).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(grid).toHaveCount(0);
    await expect(page.getByTestId('presenter-grid-button')).toBeFocused();
  });

  test('Keys and controls lists every key, flips romanization live and keeps the controls visible', async ({ page }) => {
    await page.goto(link(TOOLS_DECK));
    await startLesson(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('h');
    const help = page.getByTestId('presenter-help');
    await expect(help).toBeVisible();
    // The slide step back reads Previous (LV-M1): "Back" only ever means leaving a screen.
    for (const row of ['Next', 'Previous', 'First and last slide', 'Blank the screen', 'Class timer', 'All slides', 'Close or exit']) {
      await expect(help.getByText(row, { exact: true })).toBeVisible();
    }
    await expect(help.getByText('Helper picker')).toHaveCount(0);
    await expect(help.getByText('A presentation clicker works with no setup.')).toBeVisible();
    await shot(page, 'presenter-help-1280x720');
    // The romanization chips are one radiogroup: an arrow moves and selects.
    await page.getByTestId('presenter-help-romanization-always').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-help-romanization-tap')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('presenter-help-romanization-tap')).toBeFocused();
    await page.getByTestId('presenter-help-keep-visible').click();
    await expect(page.getByTestId('presenter-help-keep-visible')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    // tap: the letter's romanization is now its own build.
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Reveal');
    // With Keep controls visible the bar does not fade.
    await page.waitForTimeout(3500);
    await expect(page.getByTestId('presenter-next')).toBeVisible();
    await expect(page.getByRole('toolbar').locator('..')).toHaveCSS('opacity', '1');
  });

  test('Keys and controls has no language chips: the presenter speaks the device language (owner items 6 and 7)', async ({ page }) => {
    await page.goto(link(TOOLS_DECK));
    await startLesson(page);
    await page.keyboard.press('h');
    await expect(page.getByTestId('presenter-help')).toBeVisible();
    await expect(page.getByTestId('presenter-help-language')).toHaveCount(0);
    await expect(page.getByTestId('presenter-help-close')).toHaveAccessibleName('Close');
    await page.keyboard.press('Escape');
    expect(await readStored(page, 'device:settings')).toBeNull();
  });

});

test.describe('PR 9 with no Korean voice at 1280 x 720', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('the bar says "You say it!" and letters and the quiz show the Say it text', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(link(TOOLS_DECK));
    await startLesson(page);
    await expect(page.getByTestId('presenter-chip-no-voice')).toHaveText('No Korean voice here. You say it!');
    await forwardTo(page, 'Letter');
    await revealAll(page);
    const say = page.getByTestId('presenter-say-it');
    await expect(say).toBeVisible();
    await expect(say).toContainText('Say it:');
    await expect(say).toContainText('[k]');
    await expect(page.getByRole('button', { name: 'Play the sound' })).toHaveCount(0);
    await shot(page, 'presenter-letter-novoice-1280x720');
    await forwardTo(page, 'Question');
    await expect(page.getByRole('heading', { name: 'Which letter makes this sound?' })).toBeVisible();
    await expect(page.getByTestId('presenter-say-it')).toBeVisible();
    await expect(page.getByTestId('presenter-quiz-speaker')).toHaveCount(0);
    await shot(page, 'presenter-quiz-text-1280x720');
    expect(errors).toEqual([]);
  });

  test('muted: the Sound is off chip turns sound back on', async ({ page }) => {
    await page.goto('/present');
    await seedKeys(page, { 'hr:device:audio': { muted: true } });
    await page.goto(link(TOOLS_DECK));
    await startLesson(page);
    await expect(page.getByTestId('presenter-chip-sound-off')).toContainText('Sound is off.');
    await shot(page, 'presenter-bar-chips-1280x720');
    await page.getByTestId('presenter-turn-sound-on').click();
    await expect(page.getByTestId('presenter-chip-sound-off')).toHaveCount(0);
  });
});
