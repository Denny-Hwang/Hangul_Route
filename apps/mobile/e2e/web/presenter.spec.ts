import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { colors } from '@hangul-route/design-system/tokens';
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
    // The hand-off left the address and was held for this page only (section 3.9).
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

    // Activity: one build; Start timer is drawn and waits for the class timer (PR 9).
    await page.keyboard.press('PageDown');
    await forwardTo(page, 'Activity');
    await expect(page.getByTestId('presenter-live')).toHaveText(/Activity, Write it in the air$/);
    await expect(page.getByRole('heading', { name: 'Write it in the air' })).toBeVisible();
    await expect(page.getByText('3 minutes')).toBeVisible();
    await expect(page.getByTestId('presenter-start-timer')).toHaveAccessibleName('Start timer');
    await expect(page.getByTestId('presenter-start-timer')).toBeDisabled();
    // Disabled, it is outlined on paper, never the filled primary action.
    await expect(page.getByTestId('presenter-start-timer')).toHaveCSS('background-color', rgb(colors.surface.paper));
    await expect(page.getByTestId('presenter-next')).toHaveAccessibleName('Next');
    await shot(page, 'presenter-activity-1280x720');

    // No slide overflows the stage, and the page never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
    expect(errors).toEqual([]);
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
    const measure = async () => ({
      box: (await page.getByTestId('presenter-stage').boundingBox())!,
      band: (await page.getByRole('toolbar').locator('..').boundingBox())!,
    });
    await expect.poll(async () => {
      const { box, band } = await measure();
      return box.height + band.height;
    }).toBe(768);
    const { box, band } = await measure();
    expect(band.height).toBeGreaterThanOrEqual(120);
    expect(box.width).toBe(1024);
    expect(box.height).toBe(768 - band.height);
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
    await expect(page.getByText('Make the window bigger or turn the screen.')).toBeVisible();
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
    expect(await revealAll(page)).toBe(3);
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
    await page.keyboard.press('PageDown');
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
