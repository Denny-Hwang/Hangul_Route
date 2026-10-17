import type { Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { onboardChild, passDiscover, seedStored } from './helpers';
import { shot } from './shots';
import { expectTextFits, fontSizeOf } from './text-fit';

/**
 * F-AUDIO-004 2026-10-17 (the web speech engine) and F-TCH-004 section 3.7 (Test the sound): a slow,
 * paused or refused Korean utterance is not lost, and every failure shows. The browser's engine is
 * replaced before the app loads by one that behaves like the real ones the owner hit:
 *
 * (a) Android Chrome on a phone, in the presenter: the voice list is empty until `voiceschanged` at
 *     800 ms; a `speak` before any user activation is refused with `not-allowed`; a cold Korean voice
 *     holds every utterance (speaking and pending) for 2 s before `onstart`, then ends 400 ms later.
 * (b) iOS Safari in the learner app: outside a gesture (touchend, click, keydown) a `speak` is dropped
 *     without a word until one has been accepted inside one.
 * (c) An engine that takes the silent unlock and never answers it (it holds it as speaking, so the
 *     queue behind it never moves), in the presenter: Test the sound still plays, and so does a slide.
 * (d) The presenter start screen at 320 x 568 on a phone held upright, at the Largest text size, with
 *     Details open and a Test the sound that did not play (no Korean voice): everything fits.
 *
 * Each engine records every `speak` and `cancel`, so the specs read what the app asked and when.
 */

interface Spoken {
  text: string;
  lang: string;
  volume: number;
  /** `navigator.userActivation.isActive` at the speak. */
  active: boolean;
  /** Milliseconds since the last trusted tap or key. */
  sinceTap: number;
  at: number;
  startedAt: number | null;
  cancelled: boolean;
  refused: boolean;
}

type EngineWindow = Window & { __spoken?: Spoken[]; __cancels?: number[]; __seen?: { noVoice: boolean; tapToHear: boolean } };

const NO_VOICE_LINE = 'No Korean voice on this device. You say the sounds; the slides show them.';

/** (a) An Android Chrome phone with a cold Korean voice that loads late. */
async function androidChrome(page: Page): Promise<void> {
  await page.addInitScript((noVoiceLine: string) => {
    const w = window as EngineWindow;
    const spoken: Spoken[] = [];
    const cancels: number[] = [];
    w.__spoken = spoken;
    w.__cancels = cancels;
    // What the page ever showed, sampled every 50 ms (a flash between two polls still counts).
    const seen = { noVoice: false, tapToHear: false };
    w.__seen = seen;
    setInterval(() => {
      if (document.body?.innerText.includes(noVoiceLine)) seen.noVoice = true;
      if (document.querySelector('[aria-label="Tap to hear"]')) seen.tapToHear = true;
    }, 50);
    let lastTap = Number.NEGATIVE_INFINITY;
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
      window.addEventListener(type, (e) => {
        if (e.isTrusted) lastTap = performance.now();
      }, true);
    }
    const korean = { name: 'Korean South Korea', lang: 'ko-KR', voiceURI: 'Korean South Korea', localService: true, default: false };
    let voices: (typeof korean)[] = [];
    const listeners = new Set<() => void>();
    interface Job {
      u: SpeechSynthesisUtterance;
      entry: Spoken;
      started: boolean;
      timer?: ReturnType<typeof setTimeout>;
    }
    let current: Job | null = null;
    const queue: Job[] = [];
    const begin = (job: Job): void => {
      current = job;
      // Cold: 2 s after its own speak, and never before the one ahead of it ended.
      const wait = Math.max(0, job.entry.at + 2000 - performance.now());
      job.timer = setTimeout(() => {
        if (current !== job) return;
        job.started = true;
        job.entry.startedAt = performance.now();
        job.u.onstart?.call(job.u, new Event('start') as SpeechSynthesisEvent);
        job.timer = setTimeout(() => {
          if (current !== job) return;
          current = null;
          job.u.onend?.call(job.u, new Event('end') as SpeechSynthesisEvent);
          const next = queue.shift();
          if (next) begin(next);
        }, 400);
      }, wait);
    };
    const synth = {
      get speaking() {
        return current !== null;
      },
      get pending() {
        return (current !== null && !current.started) || queue.length > 0;
      },
      paused: false,
      onvoiceschanged: null as null | (() => void),
      getVoices: () => voices.slice(),
      addEventListener: (type: string, fn: () => void) => {
        if (type === 'voiceschanged') listeners.add(fn);
      },
      removeEventListener: (type: string, fn: () => void) => {
        listeners.delete(fn);
      },
      speak: (u: SpeechSynthesisUtterance) => {
        const entry: Spoken = {
          text: u.text,
          lang: u.lang,
          volume: u.volume,
          active: navigator.userActivation.isActive,
          sinceTap: performance.now() - lastTap,
          at: performance.now(),
          startedAt: null,
          cancelled: false,
          refused: false,
        };
        spoken.push(entry);
        if (!navigator.userActivation.hasBeenActive) {
          entry.refused = true;
          setTimeout(() => u.onerror?.call(u, Object.assign(new Event('error'), { error: 'not-allowed' }) as SpeechSynthesisErrorEvent), 0);
          return;
        }
        const job: Job = { u, entry, started: false };
        if (current === null) begin(job);
        else queue.push(job);
      },
      cancel: () => {
        cancels.push(performance.now());
        const all = current ? [current, ...queue] : [...queue];
        current = null;
        queue.length = 0;
        for (const job of all) {
          clearTimeout(job.timer);
          job.entry.cancelled = true;
          setTimeout(() => job.u.onerror?.call(job.u, Object.assign(new Event('error'), { error: 'canceled' }) as SpeechSynthesisErrorEvent), 0);
        }
      },
      pause: () => undefined,
      resume: () => undefined,
    };
    setTimeout(() => {
      voices = [korean];
      for (const fn of [...listeners]) fn();
      synth.onvoiceschanged?.();
    }, 800);
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: unknown = null;
      onstart: ((ev: Event) => void) | null = null;
      onend: ((ev: Event) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
    // Start asks for fullscreen in its tap; headless Chromium would then resize the window (presenter-phone.spec.ts).
    Element.prototype.requestFullscreen = function requestFullscreen(): Promise<void> {
      return Promise.resolve();
    };
  }, NO_VOICE_LINE);
}

const spoken = (page: Page): Promise<Spoken[]> => page.evaluate(() => (window as EngineWindow).__spoken ?? []);
const cancels = (page: Page): Promise<number[]> => page.evaluate(() => (window as EngineWindow).__cancels ?? []);
const seen = (page: Page): Promise<{ noVoice: boolean; tapToHear: boolean }> =>
  page.evaluate(() => (window as EngineWindow).__seen ?? { noVoice: false, tapToHear: false });

const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2e031',
  title: 'Sound check lesson',
  createdAt: '2026-10-17T09:00:00Z',
  seed: 7,
  blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
};

test.describe('(a) Android Chrome, a phone sideways, the presenter', () => {
  test.use({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });

  test('no false no-voice line; Test the sound plays in the tap; a letter sound on a cold engine plays, never cancelled, never "Tap to hear"', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await androidChrome(page);
    await page.goto(`/present#d=${encodeDeck(DECK)}`);
    await expect(page.getByTestId('presenter-start-footer')).toBeVisible();

    // Details holds the device checks on a phone. Chrome's first voice list is empty: the voice line
    // waits for voiceschanged instead of saying there is no Korean voice.
    await page.getByTestId('presenter-start-details').tap();
    await expect(page.getByTestId('presenter-start-details-panel')).toBeVisible();
    const until = Date.now() + 2000;
    while (Date.now() < until) {
      await expect(page.getByText(NO_VOICE_LINE)).toHaveCount(0);
      await page.waitForTimeout(100);
    }
    await expect(page.getByTestId('presenter-check-voice')).toContainText('Korean voice: Korean South Korea, on this device');
    expect((await seen(page)).noVoice).toBe(false);
    await shot(page, 'presenter-start-test-sound-915x412');

    // Test the sound: the word is asked inside the tap, nothing is cancelled before it starts, and it is heard.
    const tapAt = (await spoken(page)).length;
    await page.getByTestId('presenter-test-sound').tap();
    await expect.poll(async () => (await spoken(page)).slice(tapAt).some((u) => u.text === '안녕하세요')).toBe(true);
    const word = (await spoken(page)).find((u) => u.text === '안녕하세요')!;
    expect(word).toMatchObject({ text: '안녕하세요', lang: 'ko-KR', active: true, refused: false });
    expect(word.sinceTap).toBeLessThan(1000);
    await expect(page.getByTestId('presenter-test-sound-result')).toHaveText('Did you hear it? If not, turn up the volume.', { timeout: 8000 });
    const heard = (await spoken(page)).find((u) => u.text === '안녕하세요')!;
    expect(heard.startedAt).not.toBeNull();
    expect(heard.cancelled).toBe(false);
    expect((await cancels(page)).filter((at) => at < heard.startedAt!)).toEqual([]);
    await shot(page, 'presenter-start-test-sound-played-915x412');

    // Start, the first letter, then the bar's sound button: a Korean utterance in the tap, held 2 s by the
    // cold engine and given its time (no cancel, no "Tap to hear").
    await page.getByTestId('presenter-start-button').tap();
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    await page.getByTestId('presenter-next').tap();
    await expect(page.getByTestId('presenter-glyph')).toBeVisible();
    // A phone step hides the bar at once; a tap in its strip shows it again.
    const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
    await page.touchscreen.tap(stage.x + stage.width * 0.95, stage.y + stage.height - 20);
    await expect(page.getByTestId('presenter-bar-compact')).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('presenter-sound')).not.toHaveCSS('pointer-events', 'none');
    const before = (await spoken(page)).length;
    const cancelsBefore = (await cancels(page)).length;
    await page.getByTestId('presenter-sound').tap();
    await expect.poll(async () => (await spoken(page)).slice(before).filter((u) => u.volume !== 0).length).toBe(1);
    const sound = (await spoken(page)).slice(before).find((u) => u.volume !== 0)!;
    expect(sound).toMatchObject({ lang: 'ko-KR', active: true, refused: false });
    expect(sound.text).toMatch(/^[가-힣]+$/);
    await expect.poll(async () => (await spoken(page)).find((u) => u.at === sound.at)?.startedAt ?? null, { timeout: 6000 }).not.toBeNull();
    await page.waitForTimeout(1000);
    expect((await spoken(page)).find((u) => u.at === sound.at)?.cancelled).toBe(false);
    expect((await cancels(page)).length).toBe(cancelsBefore);
    expect((await seen(page)).tapToHear).toBe(false);
    await expect(page.getByRole('button', { name: 'Tap to hear' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('(a2) a browser that has its voices at once (Safari, a warm Chrome), the presenter at 1280 x 720', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('the start screen names the Korean voice before any tap (the list landed before the presenter subscribed)', async ({ page }) => {
    await page.addInitScript(() => {
      const voices = [{ name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false }];
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
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: Utterance });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          speaking: false,
          pending: false,
          speak: (u: Utterance) => {
            setTimeout(() => {
              u.onstart?.();
              u.onend?.();
            }, 20);
          },
          cancel: () => undefined,
          getVoices: () => voices,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        },
      });
    });
    await page.goto(`/present#d=${encodeDeck(DECK)}`);
    await expect(page.getByTestId('presenter-check-voice')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('presenter-check-voice')).toContainText('Korean voice: Yuna, on this device');
    await expect(page.getByText(NO_VOICE_LINE)).toHaveCount(0);
  });
});

/** (b) iOS Safari: a speak outside a gesture is dropped without a word until one inside a gesture was accepted. */
async function iosSafari(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Asked = { text: string; lang: string; volume: number; accepted: boolean; gesture: string | null };
    const asked: Asked[] = [];
    (window as unknown as { __asked: Asked[] }).__asked = asked;
    // WebKit's gesture for speech: the task of a touchend, click or keydown.
    let gesture: string | null = null;
    for (const type of ['touchend', 'click', 'keydown']) {
      window.addEventListener(type, (e) => {
        if (!e.isTrusted) return;
        gesture = type;
        setTimeout(() => {
          if (gesture === type) gesture = null;
        }, 0);
      }, true);
    }
    let unlocked = false;
    const yuna = { name: 'Yuna', lang: 'ko-KR', voiceURI: 'com.apple.voice.compact.ko-KR.Yuna', localService: true, default: false };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        paused: false,
        getVoices: () => [yuna],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        speak: (u: SpeechSynthesisUtterance) => {
          const accepted = unlocked || gesture !== null;
          asked.push({ text: u.text, lang: u.lang, volume: u.volume, accepted, gesture });
          if (!accepted) return;
          unlocked = true;
          setTimeout(() => {
            u.onstart?.call(u, new Event('start') as SpeechSynthesisEvent);
            u.onend?.call(u, new Event('end') as SpeechSynthesisEvent);
          }, 0);
        },
        cancel: () => undefined,
        resume: () => undefined,
      },
    });
  });
}

type Asked = { text: string; lang: string; volume: number; accepted: boolean; gesture: string | null };
const asked = (page: Page): Promise<Asked[]> => page.evaluate(() => (window as unknown as { __asked?: Asked[] }).__asked ?? []);

test.describe('(b) iOS Safari, a touch screen, the learner app', () => {
  test.use({ isMobile: true, hasTouch: true });

  test('a lone touch pointerdown speaks nothing; the touchend unlocks in Korean inside the gesture; the round start then speaks', async ({ page }) => {
    await iosSafari(page);
    await onboardChild(page, { name: 'Dami', startJourney: false });
    // A fresh page: nothing unlocked yet.
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await page.waitForTimeout(500);
    expect(await asked(page)).toEqual([]);

    const point = (await page.getByText('Hi, Dami!').boundingBox())!;
    const touch = { x: point.x + point.width / 2, y: point.y + point.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    // The finger goes down: pointerdown and touchstart, no activation. Nothing is spoken, and the page keeps listening.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
    await page.waitForTimeout(300);
    expect(await asked(page)).toEqual([]);
    // The finger lifts: the silent Korean unlock is spoken inside the touchend.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await asked(page)).some((a) => a.accepted)).toBe(true);
    const unlock = (await asked(page)).find((a) => a.accepted)!;
    expect(unlock).toMatchObject({ text: ' ', lang: 'ko-KR', volume: 0, gesture: 'touchend' });
    await cdp.detach();

    // The first Match Sound round speaks its Korean prompt on its own, outside any gesture.
    await page.getByRole('button', { name: /^Meet a, eo, g, n/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await passDiscover(page);
    const roundAt = (await asked(page)).length;
    await page.getByRole('button', { name: 'Play minigame' }).click();
    await expect(page.getByText('1 / 6')).toBeVisible();
    await expect
      .poll(async () => (await asked(page)).slice(roundAt).filter((a) => a.volume !== 0 && /[가-힣]/.test(a.text)))
      .toContainEqual(expect.objectContaining({ lang: 'ko-KR', accepted: true }));
    await expect(page.getByText('Tap the letter you hear')).toBeVisible();
  });
});

/** (c) An engine that takes the blank unlock and never answers it: it stays the current utterance (speaking) and nothing behind it moves until a cancel. */
async function hangsOnBlank(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Heard = { text: string; volume: number; started: boolean; cancelled: boolean };
    const heard: Heard[] = [];
    const cancels: number[] = [];
    (window as unknown as { __heard: Heard[]; __cancels: number[] }).__heard = heard;
    (window as unknown as { __heard: Heard[]; __cancels: number[] }).__cancels = cancels;
    const yuna = { name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false };
    interface Job {
      u: SpeechSynthesisUtterance;
      entry: Heard;
    }
    let current: Job | null = null;
    const queue: Job[] = [];
    const begin = (job: Job): void => {
      current = job;
      // The blank unlock: taken, and never a word about it.
      if (job.u.text.trim() === '') return;
      setTimeout(() => {
        if (current !== job) return;
        job.entry.started = true;
        job.u.onstart?.call(job.u, new Event('start') as SpeechSynthesisEvent);
        setTimeout(() => {
          if (current !== job) return;
          current = null;
          job.u.onend?.call(job.u, new Event('end') as SpeechSynthesisEvent);
          const next = queue.shift();
          if (next) begin(next);
        }, 300);
      }, 20);
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        get speaking() {
          return current !== null;
        },
        get pending() {
          return queue.length > 0;
        },
        paused: false,
        getVoices: () => [yuna],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        speak: (u: SpeechSynthesisUtterance) => {
          const job: Job = { u, entry: { text: u.text, volume: u.volume, started: false, cancelled: false } };
          heard.push(job.entry);
          if (current === null) begin(job);
          else queue.push(job);
        },
        cancel: () => {
          cancels.push(performance.now());
          const all = current ? [current, ...queue] : [...queue];
          current = null;
          queue.length = 0;
          for (const job of all) {
            job.entry.cancelled = true;
            setTimeout(() => job.u.onerror?.call(job.u, Object.assign(new Event('error'), { error: 'canceled' }) as SpeechSynthesisErrorEvent), 0);
          }
        },
        resume: () => undefined,
      },
    });
    Element.prototype.requestFullscreen = function requestFullscreen(): Promise<void> {
      return Promise.resolve();
    };
  });
}

type Heard = { text: string; volume: number; started: boolean; cancelled: boolean };
const heardOf = (page: Page): Promise<Heard[]> => page.evaluate(() => (window as unknown as { __heard?: Heard[] }).__heard ?? []);

test.describe('(c) an engine that never answers the silent unlock, the presenter on a phone sideways', () => {
  test.use({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });

  test('Test the sound plays (the stuck queue is cleared once), and a slide sound then plays at once', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await hangsOnBlank(page);
    await page.goto(`/present#d=${encodeDeck(DECK)}`);
    await expect(page.getByTestId('presenter-start-footer')).toBeVisible();
    await page.getByTestId('presenter-start-details').tap();
    await expect(page.getByTestId('presenter-check-voice')).toContainText('Korean voice: Yuna, on this device');

    await page.getByTestId('presenter-test-sound').tap();
    // The greeting waits behind the unlock the engine never answers; at 3 s the queue is cleared and it is said again.
    await expect(page.getByTestId('presenter-test-sound-result')).toHaveText('Did you hear it? If not, turn up the volume.', { timeout: 8000 });
    const greeting = (await heardOf(page)).filter((u) => u.text === '안녕하세요');
    expect(greeting.some((u) => u.started && !u.cancelled)).toBe(true);
    await expect(page.getByText('The sound did not play here. You can say each word yourself.')).toHaveCount(0);

    // The engine is free now: Start, the first letter, Sound plays with no wait and never "Tap to hear".
    await page.getByTestId('presenter-start-button').tap();
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    await page.getByTestId('presenter-next').tap();
    await expect(page.getByTestId('presenter-glyph')).toBeVisible();
    const stage = (await page.getByTestId('presenter-stage').boundingBox())!;
    await page.touchscreen.tap(stage.x + stage.width * 0.95, stage.y + stage.height - 20);
    await expect(page.getByTestId('presenter-bar-compact')).toHaveCSS('opacity', '1');
    const before = (await heardOf(page)).length;
    await page.getByTestId('presenter-sound').tap();
    await expect
      .poll(async () => (await heardOf(page)).slice(before).some((u) => u.volume !== 0 && /^[가-힣]+$/.test(u.text) && u.started), { timeout: 3000 })
      .toBe(true);
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'Tap to hear' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('(d) the presenter start screen at 320 x 568, a phone held upright, Largest text', () => {
  test.use({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

  test('Details with Test the sound and its did-not-play line: nothing scrolls sideways and no text is clipped', async ({ page }) => {
    // The suite's silent engine has no Korean voice, so the test cannot play here.
    // The device's text size, set before the presenter opens (it reads `device:settings`, section 3.9).
    await page.goto('/');
    await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-17T09:00:00.000Z', textSize: 'largest' });
    await page.goto(`/present#d=${encodeDeck(DECK)}`);
    await expect(page.getByTestId('presenter-start-footer')).toBeVisible();
    await page.getByTestId('presenter-start-details').tap();
    await expect(page.getByTestId('presenter-check-voice')).toContainText('No Korean voice on this device.');
    await page.getByTestId('presenter-test-sound').tap();
    await expect(page.getByTestId('presenter-test-sound-result')).toHaveText('The sound did not play here. You can say each word yourself.', { timeout: 8000 });
    // The line really is at Largest: body (18) x 1.5.
    expect(await fontSizeOf(page.getByText('The sound did not play here. You can say each word yourself.'))).toBe(27);
    await page.getByTestId('presenter-test-sound').scrollIntoViewIfNeeded();
    await expectTextFits(page, 'presenter start, Details, Test the sound at Largest');
    await shot(page, 'presenter-start-test-sound-failed-largest-320x568');
  });
});
