import type { Locator, Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { shot } from './shots';

/**
 * Sound plays the Korean on every slide that shows it (owner report 2026-10-17: an Android phone in
 * landscape, the word slide 김밥 / gimbap, Sound in the floating bar played nothing; F-TCH-004
 * section 3.4 and 3.7 amendments 2026-10-17). The browser engine is a stand-in with one ko-KR voice
 * that, like Chrome on Android, refuses to speak before the page has had a user activation; it
 * records each utterance with whether the activation was still live and how long after the last tap
 * or key it was asked for. Screenshots with `HR_SHOTS=1`.
 */

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:sound017',
  title: 'Lunch box words',
  createdAt: '2026-10-17T09:00:00Z',
  seed: 7,
  blocks: [{ kind: 'quest', id: 'quest:stage2-life-q1' }],
};

const link = (): string => `/present#d=${encodeDeck(DECK)}`;

interface Utterance {
  text: string;
  lang: string;
  volume: number;
  /** `navigator.userActivation.isActive` when `speak` was called. */
  active: boolean;
  /** Milliseconds since the last pointerup or click (capture phase). */
  sinceTap: number;
  /** Milliseconds since the last keydown (capture phase). */
  sinceKey: number;
}

type SoundWindow = Window & { __utterances?: Utterance[] };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Start asks for fullscreen in its tap; headless Chromium would resize the window to the
    // emulated screen, which is not what a phone sideways does, so the request is only answered.
    Element.prototype.requestFullscreen = function requestFullscreen(): Promise<void> {
      return Promise.resolve();
    };
    let lastTap = -Infinity;
    let lastKey = -Infinity;
    const tap = (): void => {
      lastTap = performance.now();
    };
    window.addEventListener('pointerup', tap, true);
    window.addEventListener('click', tap, true);
    window.addEventListener('keydown', () => (lastKey = performance.now()), true);

    const log: Utterance[] = [];
    Object.defineProperty(window, '__utterances', { configurable: true, value: log });
    class FakeUtterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: unknown = null;
      onstart: ((ev: object) => void) | null = null;
      onend: ((ev: object) => void) | null = null;
      onerror: ((ev: { error: string }) => void) | null = null;
      constructor(public text: string) {}
    }
    const voices = [{ name: 'Korean South Korea', lang: 'ko-KR', voiceURI: 'Korean South Korea', localService: true, default: false }];
    const synth = {
      speaking: false,
      pending: false,
      speak(u: FakeUtterance): void {
        const now = performance.now();
        log.push({ text: u.text, lang: u.lang, volume: u.volume, active: navigator.userActivation.isActive, sinceTap: now - lastTap, sinceKey: now - lastKey });
        // Chrome on Android: no speech before the page has had a user activation.
        if (!navigator.userActivation.hasBeenActive) {
          setTimeout(() => u.onerror?.({ error: 'not-allowed' }), 0);
          return;
        }
        synth.speaking = true;
        setTimeout(() => u.onstart?.({}), 50);
        setTimeout(() => {
          synth.speaking = false;
          u.onend?.({});
        }, 300);
      },
      cancel(): void {
        synth.speaking = false;
      },
      getVoices: () => voices,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: FakeUtterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
  });
});

/** What the page asked to say aloud (the silent unlock utterance of Start left out). */
const spoken = (page: Page): Promise<Utterance[]> =>
  page.evaluate(() => ((window as SoundWindow).__utterances ?? []).filter((u) => u.volume !== 0 && u.text.trim() !== ''));

/** The Korean drawn on the stage: its text without the screen reader's live line. */
const stageText = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const stage = document.querySelector('[data-testid="presenter-stage"]')?.cloneNode(true) as Element | undefined;
    stage?.querySelector('[data-testid="presenter-live"]')?.remove();
    return stage?.textContent ?? '';
  });

/** Write values the way `platform/storage` does (IndexedDB `keyval-store`), before the presenter boots. */
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

const counter = async (page: Page): Promise<string> => (await page.getByTestId('presenter-counter').textContent()) ?? '';
const bar = (page: Page): Locator => page.getByTestId('presenter-bar-compact');
/** The `speaker-off` glyph's cross, the one part `speaker` does not draw. */
const speakerOff = (page: Page): Locator => page.getByTestId('presenter-sound').locator('path[d="M16 9.5 L21 14.5"]');

/** A tap in the compact bar's strip (the bottom of the stage): it shows a hidden bar and hides a shown one. */
async function tapStrip(page: Page): Promise<void> {
  const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
  await page.touchscreen.tap(stage.x + stage.width * 0.95, stage.y + stage.height - 20);
}

/** A tap in the middle of the stage, above the strip (the right two thirds: reveal or next). */
async function tapStage(page: Page): Promise<void> {
  const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
  await page.touchscreen.tap(stage.x + stage.width * 0.7, stage.y + stage.height * 0.4);
}

/**
 * Shows the compact bar with a strip tap, as a teacher does. A bar still shown from an earlier tap
 * is let hide first (it fades after `presenter.autoHideMs`), so it cannot fade under the next tap.
 */
async function showPhoneBar(page: Page): Promise<void> {
  await expect(page.getByTestId('presenter-next')).toHaveCSS('pointer-events', 'none', { timeout: 10_000 });
  await expect(bar(page)).toHaveCSS('opacity', '0');
  await tapStrip(page);
  await expect(bar(page)).toHaveCSS('opacity', '1');
  await expect(page.getByTestId('presenter-sound')).not.toHaveCSS('pointer-events', 'none');
}

/** Next on the phone bar (shown first, as a teacher does), until the word card reads `ko`. */
async function nextOnBarUntilWord(page: Page, ko: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const word = page.getByTestId('presenter-word');
    if ((await word.count()) > 0 && (await word.textContent())?.trim() === ko) return;
    await showPhoneBar(page);
    await page.getByTestId('presenter-next').tap();
    // Every step hides the bar at once (F-TCH-004 section 3.6).
    await expect(page.getByTestId('presenter-next')).toHaveCSS('pointer-events', 'none');
  }
  throw new Error(`never reached the word ${ko}`);
}

async function startOnPhone(page: Page): Promise<void> {
  await page.goto(link());
  const start = page.getByTestId('presenter-start-button');
  await expect(start).toBeEnabled({ timeout: 10_000 });
  await start.tap();
  await expect(page.getByTestId('presenter-stage')).toBeVisible();
}

test.describe('Sound on an Android phone, sideways at 915 x 412', () => {
  test.use({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });

  test('the owner report: Sound in the floating bar on 김밥 says 김밥 once, in Korean, inside the tap', async ({ page }) => {
    await startOnPhone(page);
    await nextOnBarUntilWord(page, '김밥');
    await expect(page.getByTestId('presenter-word')).toHaveText('김밥');
    const before = (await spoken(page)).length;
    await showPhoneBar(page);
    await page.getByTestId('presenter-sound').tap();
    await expect.poll(async () => (await spoken(page)).slice(before)).toHaveLength(1);
    const [said] = (await spoken(page)).slice(before);
    expect(said).toMatchObject({ text: '김밥', lang: 'ko-KR', active: true });
    expect(said!.sinceTap).toBeLessThan(1000);
    // Nothing is flashed: the sound played.
    await expect(page.getByTestId('presenter-no-sound-flash')).toHaveCount(0);
    await expect(page.getByTestId('presenter-sound-failed-flash')).toHaveCount(0);
    await shot(page, 'presenter-sound-gimbap-915x412');
  });

  test('every slide: Sound says Korean drawn on the stage, or the stage says the slide has no sound', async ({ page }) => {
    await startOnPhone(page);
    const total = Number((await counter(page)).split('/')[1]);
    expect(total).toBeGreaterThan(10);
    const flashed: string[] = [];
    for (let n = 1; n <= total; n++) {
      await expect(page.getByTestId('presenter-counter')).toHaveText(`${n} / ${total}`);
      // Every build revealed by stage taps, so all of the slide's Korean is on the stage.
      for (let i = 0; i < 10 && (await page.getByTestId('presenter-next').getAttribute('aria-label')) === 'Reveal'; i++) await tapStage(page);
      const before = (await spoken(page)).length;
      await showPhoneBar(page);
      await page.getByTestId('presenter-sound').tap();
      const flash = page.getByTestId('presenter-no-sound-flash');
      await expect.poll(async () => (await spoken(page)).length > before || (await flash.count()) > 0).toBe(true);
      const said = (await spoken(page)).slice(before);
      if (said.length === 0) {
        await expect(flash).toBeVisible();
        await expect(flash).toHaveText('This slide has no sound.');
        await expect(flash).toHaveAttribute('role', 'status');
        flashed.push(await counter(page));
        if (flashed.length === 1) await shot(page, 'presenter-no-sound-flash-915x412');
      } else {
        expect(said, `slide ${n}`).toHaveLength(1);
        expect(said[0]!.lang, `slide ${n}`).toBe('ko-KR');
        expect(await stageText(page), `slide ${n}: ${said[0]!.text}`).toContain(said[0]!.text);
      }
      if (n < total) await tapStage(page);
    }
    // The title and the End slide have nothing of their own to say; every word, question and card does.
    expect(flashed).toEqual([`1 / ${total}`, `${total} / ${total}`]);
  });

  test('muted on this device: Sound turns sound on and says the word once', async ({ page }) => {
    await page.goto('/present');
    await seedKeys(page, { 'hr:device:audio': { muted: true } });
    await startOnPhone(page);
    await nextOnBarUntilWord(page, '김밥');
    await showPhoneBar(page);
    await expect(speakerOff(page)).toHaveCount(1);
    const before = (await spoken(page)).length;
    await page.getByTestId('presenter-sound').tap();
    await expect.poll(async () => (await spoken(page)).slice(before)).toHaveLength(1);
    expect((await spoken(page)).slice(before)[0]).toMatchObject({ text: '김밥', lang: 'ko-KR', active: true });
    await expect(speakerOff(page)).toHaveCount(0);
    // The device record the learner app shares says sound is on.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<string | null>((resolve) => {
              const open = indexedDB.open('keyval-store');
              open.onsuccess = () => {
                const get = open.result.transaction('keyval').objectStore('keyval').get('hr:device:audio');
                get.onsuccess = () => resolve(typeof get.result === 'string' ? get.result : null);
                get.onerror = () => resolve(null);
              };
              open.onerror = () => resolve(null);
            }),
        ),
      )
      .toBe(JSON.stringify({ muted: false }));
  });
});

test.describe('Sound at 1280 x 720 with the S key', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('S on 김밥 says 김밥 once, in Korean, inside the key press', async ({ page }) => {
    await page.goto(link());
    const start = page.getByTestId('presenter-start-button');
    await expect(start).toBeEnabled({ timeout: 10_000 });
    await start.click();
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    for (let i = 0; i < 40; i++) {
      const word = page.getByTestId('presenter-word');
      if ((await word.count()) > 0 && (await word.textContent())?.trim() === '김밥') break;
      await page.keyboard.press('ArrowRight');
    }
    await expect(page.getByTestId('presenter-word')).toHaveText('김밥');
    const before = (await spoken(page)).length;
    await page.keyboard.press('s');
    await expect.poll(async () => (await spoken(page)).slice(before)).toHaveLength(1);
    const [said] = (await spoken(page)).slice(before);
    expect(said).toMatchObject({ text: '김밥', lang: 'ko-KR', active: true });
    expect(said!.sinceKey).toBeLessThan(1000);
  });

  test('S on the title slide flashes "This slide has no sound." over the docked stage', async ({ page }) => {
    await page.goto(link());
    const start = page.getByTestId('presenter-start-button');
    await expect(start).toBeEnabled({ timeout: 10_000 });
    await start.click();
    await expect(page.getByTestId('presenter-counter')).toHaveText(/^1 \//);
    await page.keyboard.press('s');
    const flash = page.getByTestId('presenter-no-sound-flash');
    await expect(flash).toHaveText('This slide has no sound.');
    await expect(flash).toHaveCSS('pointer-events', 'none');
    await shot(page, 'presenter-no-sound-flash-1280x720');
    // It goes after presenter.autoHideMs.
    await expect(flash).toHaveCount(0, { timeout: 6_000 });
    expect(await spoken(page)).toEqual([]);
  });
});
