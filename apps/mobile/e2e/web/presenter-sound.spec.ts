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

/** One story, King Sejong's new letters: a cover, then its scenes (art, narration, korean). */
const STORY_DECK: LectureDeckInput = { ...DECK, id: 'lecture:sound020', title: 'King Sejong', blocks: [{ kind: 'story', storyId: 'story:sejong-new-letters' }] };

const link = (deck: LectureDeckInput = DECK): string => `/present#d=${encodeDeck(deck)}`;

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

/** How the stand-in engine behaves in one test: no voice at all, or every utterance failing. */
interface SpeechConfig {
  voices?: 'none';
  error?: string;
}

type SoundWindow = Window & { __utterances?: Utterance[]; __speechConfig?: SpeechConfig };

/** Sets the engine's behaviour for the page about to load (registered after the engine, read at each call). */
const speechConfig = (page: Page, config: SpeechConfig): Promise<void> =>
  page.addInitScript((c) => {
    (window as SoundWindow).__speechConfig = c;
  }, config);

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
    const config = (): SpeechConfig => (window as SoundWindow).__speechConfig ?? {};
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
        const error = config().error;
        if (error !== undefined) {
          setTimeout(() => u.onerror?.({ error }), 50);
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
      getVoices: () => (config().voices === 'none' ? [] : voices),
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

/**
 * Waits until the stand-in engine has answered every utterance (it ends one 300 ms after it is asked,
 * or fails it after 50 ms) and the press's result has had time to show, so a flash that is not there
 * is not there because nothing came, not because it has not come yet.
 */
async function settled(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.speechSynthesis.speaking)).toBe(false);
  await page.waitForTimeout(400);
}

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

async function startOnPhone(page: Page, deck: LectureDeckInput = DECK): Promise<void> {
  await page.goto(link(deck));
  const start = page.getByTestId('presenter-start-button');
  await expect(start).toBeEnabled({ timeout: 10_000 });
  await start.tap();
  await expect(page.getByTestId('presenter-stage')).toBeVisible();
}

/** Start at 1280 x 720 (a click), then ArrowRight until the word card reads `ko`. */
async function startDocked(page: Page, deck: LectureDeckInput = DECK): Promise<void> {
  await page.goto(link(deck));
  const start = page.getByTestId('presenter-start-button');
  await expect(start).toBeEnabled({ timeout: 10_000 });
  await start.click();
  await expect(page.getByTestId('presenter-stage')).toBeVisible();
}

async function arrowUntilWord(page: Page, ko: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const word = page.getByTestId('presenter-word');
    if ((await word.count()) > 0 && (await word.textContent())?.trim() === ko) return;
    await page.keyboard.press('ArrowRight');
  }
  throw new Error(`never reached the word ${ko}`);
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
      const flash = page.getByTestId('presenter-no-sound-flash');
      // A flash belongs to its slide: none is left over from the slide before.
      await expect(flash).toHaveCount(0);
      await showPhoneBar(page);
      await page.getByTestId('presenter-sound').tap();
      await expect.poll(async () => (await spoken(page)).length > before || (await flash.count()) > 0).toBe(true);
      const said = (await spoken(page)).slice(before);
      if (said.length === 0) {
        await expect(flash).toBeVisible();
        await expect(flash).toHaveText('This slide has no sound.');
        // One polite live region, there from the start, says it; the pill itself is not read twice.
        await expect(page.getByTestId('presenter-sound-live')).toHaveText('This slide has no sound.');
        await expect(flash).toHaveAttribute('aria-hidden', 'true');
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

  test('no Korean voice: a forward sound build on a letter flashes the no-voice words', async ({ page }) => {
    await speechConfig(page, { voices: 'none' });
    await startOnPhone(page, { ...DECK, id: 'lecture:sound019', blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }] });
    const flash = page.getByTestId('presenter-no-voice-flash');
    await tapStage(page);
    await expect(page.getByTestId('presenter-glyph')).toBeVisible();
    // ko, then the stroke guide, then the sound build.
    await tapStage(page);
    await expect(flash).toHaveCount(0);
    await tapStage(page);
    await expect(flash).toHaveText('No Korean voice here. You say it!');
    await expect(page.getByTestId('presenter-sound-live')).toHaveText('No Korean voice here. You say it!');
    expect(await spoken(page)).toEqual([]);
  });

  test('no Korean voice: stepping through word cards (no sound build) flashes nothing', async ({ page }) => {
    await speechConfig(page, { voices: 'none' });
    await startOnPhone(page);
    const flash = page.getByTestId('presenter-no-voice-flash');
    for (let i = 0; i < 6; i++) {
      await tapStage(page);
      await expect(flash).toHaveCount(0);
    }
    await expect(page.getByTestId('presenter-word')).toBeVisible();
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

  test('no Korean voice: S on 김밥 flashes the no-voice words and says nothing', async ({ page }) => {
    await speechConfig(page, { voices: 'none' });
    await startDocked(page);
    await arrowUntilWord(page, '김밥');
    await page.keyboard.press('s');
    const flash = page.getByTestId('presenter-no-voice-flash');
    await expect(flash).toHaveText('No Korean voice here. You say it!');
    await expect(page.getByTestId('presenter-sound-live')).toHaveText('No Korean voice here. You say it!');
    expect(await spoken(page)).toEqual([]);
    await shot(page, 'presenter-no-voice-flash-1280x720');
  });

  test('a voice that fails: S on 김밥 flashes "The sound did not play. You say it!"', async ({ page }) => {
    await speechConfig(page, { error: 'synthesis-failed' });
    await startDocked(page);
    await arrowUntilWord(page, '김밥');
    await page.keyboard.press('s');
    const flash = page.getByTestId('presenter-sound-failed-flash');
    await expect(flash).toHaveText('The sound did not play. You say it!');
    await expect(page.getByTestId('presenter-sound-live')).toHaveText('The sound did not play. You say it!');
    // It was asked for once, in Korean, and failed.
    expect(await spoken(page)).toMatchObject([{ text: '김밥', lang: 'ko-KR' }]);
    await shot(page, 'presenter-sound-failed-flash-1280x720');
  });

  test('a lesson set up with sound off: S on 김밥 says so and plays nothing', async ({ page }) => {
    await startDocked(page, { ...DECK, id: 'lecture:sound018', options: { sound: false } });
    await arrowUntilWord(page, '김밥');
    await page.keyboard.press('s');
    const flash = page.getByTestId('presenter-deck-sound-off-flash');
    await expect(flash).toHaveText('Sound is off for this lesson.');
    await expect(page.getByTestId('presenter-no-sound-flash')).toHaveCount(0);
    expect(await spoken(page)).toEqual([]);
  });

  test('a flash belongs to its slide: S on the title, then the next slide at once, leaves no flash', async ({ page }) => {
    await startDocked(page);
    await expect(page.getByTestId('presenter-counter')).toHaveText(/^1 \//);
    await page.keyboard.press('s');
    const flash = page.getByTestId('presenter-no-sound-flash');
    await expect(flash).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-counter')).toHaveText(/^2 \//);
    await expect(flash).toHaveCount(0);
    await expect(page.getByTestId('presenter-sound-live')).toHaveText('');
  });

  test("a story scene: S reads the narration, then the scene's Korean once it shows", async ({ page }) => {
    await startDocked(page, STORY_DECK);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-story')).toBeVisible();
    // The narration build: Read-to-me says the narration only.
    await page.keyboard.press('ArrowRight');
    let before = (await spoken(page)).length;
    await page.keyboard.press('s');
    await expect.poll(async () => (await spoken(page)).slice(before).map((u) => u.lang)).toEqual(['en-US']);
    // The narration played, so the press flashes nothing once the chain ends (section 3.7, 2026-10-20).
    await settled(page);
    await expect(page.getByTestId('presenter-sound-failed-flash')).toHaveCount(0);
    await expect(page.getByTestId('presenter-no-voice-flash')).toHaveCount(0);
    // The korean build: the narration, then the Korean drawn on the stage, in Korean.
    await page.keyboard.press('ArrowRight');
    // The scene's keyword, with its romanization under it.
    await expect(page.getByTestId('presenter-story-korean-line')).toContainText('세종대왕');
    before = (await spoken(page)).length;
    await page.keyboard.press('s');
    await expect.poll(async () => (await spoken(page)).slice(before).map((u) => u.lang), { timeout: 5_000 }).toEqual(['en-US', 'ko-KR']);
    expect((await spoken(page)).at(-1)).toMatchObject({ text: '세종대왕', lang: 'ko-KR' });
  });

  test('a voice that fails: S on a story scene flashes "The sound did not play. You say it!" (section 3.7, 2026-10-20)', async ({ page }) => {
    await speechConfig(page, { error: 'synthesis-failed' });
    await startDocked(page, STORY_DECK);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-story')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('s');
    const flash = page.getByTestId('presenter-sound-failed-flash');
    await expect(flash).toHaveText('The sound did not play. You say it!');
    await expect(page.getByTestId('presenter-sound-live')).toHaveText('The sound did not play. You say it!');
    // The narration was asked for once and failed; the chain ended there.
    expect(await spoken(page)).toMatchObject([{ lang: 'en-US' }]);
    await expect(page.getByTestId('presenter-no-voice-flash')).toHaveCount(0);
  });

  test('a Read-to-me stopped by the next slide flashes nothing, even when its voice fails', async ({ page }) => {
    await speechConfig(page, { error: 'synthesis-failed' });
    await startDocked(page, STORY_DECK);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-story')).toBeVisible();
    // The narration, then the korean build: the scene's last build, so the next step is the next slide.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-story-korean-line')).toContainText('세종대왕');
    await expect(page.getByTestId('presenter-next')).not.toHaveAccessibleName('Reveal');
    const at = await counter(page);
    await page.keyboard.press('s');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('presenter-counter')).not.toHaveText(at);
    await expect.poll(async () => (await spoken(page)).length).toBe(1);
    // The failing voice answers 50 ms after it is asked; by then the chain was stopped.
    await settled(page);
    await expect(page.getByTestId('presenter-sound-failed-flash')).toHaveCount(0);
    await expect(page.getByTestId('presenter-sound-live')).toHaveText('');
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
