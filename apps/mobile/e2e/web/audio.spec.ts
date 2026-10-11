import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { jamoOfSpoken, onboardChild } from './helpers';

/**
 * F-AUDIO-004 A-4a: one persisted sound switch (AD7) and a ranked Korean voice
 * (AD5). The browser's speech engine is replaced before the app loads:
 * headless Chromium has no Korean voice, and the real one cannot be driven.
 */

type SpeechWindow = Window & { __utterances?: Array<{ text: string; voice: string | null; lang: string }> };

type VoiceSet = 'korean' | 'none';

/** `none` is a device with only an English voice, like headless Chromium or a Firefox without Korean data. */
async function fakeSpeech(page: Page, voiceSet: VoiceSet = 'korean'): Promise<void> {
  await page.addInitScript((set: VoiceSet) => {
    const log: NonNullable<SpeechWindow['__utterances']> = [];
    (window as SpeechWindow).__utterances = log;
    const v = (name: string, lang: string, isDefault = false) => ({ name, lang, voiceURI: name, localService: true, default: isDefault });
    // The eight Apple novelty ko_KR voices come before Yuna (`say -v '?'`).
    const voices =
      set === 'none'
        ? [v('Samantha', 'en-US', true)]
        : [
            ...['Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley'].map((n) => v(`${n} (한국어(한국))`, 'ko-KR')),
            v('Yuna', 'ko-KR'),
            v('Samantha', 'en-US', true),
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
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: Utterance) => {
          if (u.volume !== 0) log.push({ text: u.text, voice: u.voice?.name ?? null, lang: u.lang });
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
  }, voiceSet);
}

const utterances = (page: Page): Promise<NonNullable<SpeechWindow['__utterances']>> =>
  page.evaluate(() => (window as SpeechWindow).__utterances ?? []);

/** The saved device audio preference, read straight from IndexedDB (idb-keyval). */
function savedAudioPrefs(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('keyval')) return resolve(null);
          const get = db.transaction('keyval').objectStore('keyval').get('hr:device:audio');
          get.onerror = () => resolve(null);
          get.onsuccess = () => {
            db.close();
            resolve(typeof get.result === 'string' ? get.result : null);
          };
        };
      }),
  );
}

test('the Korean prompt is spoken with Yuna, the sound, never a novelty voice', async ({ page }) => {
  await fakeSpeech(page);
  await onboardChild(page, { name: 'Dami' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('1 / 4')).toBeVisible();
  await expect.poll(async () => (await utterances(page)).length).toBeGreaterThan(0);
  const [first] = await utterances(page);
  expect(first).toMatchObject({ voice: 'Yuna', lang: 'ko-KR' });
});

test('an idle game speaks once when the round starts, and not again on a timer or when the tab returns', async ({ page }) => {
  await fakeSpeech(page);
  await onboardChild(page, { name: 'Dami' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('1 / 4')).toBeVisible();
  await expect.poll(async () => (await utterances(page)).length).toBe(1);

  // No input: nothing more is said while the learner thinks (a Trace/Match idle timer must not speak).
  await page.waitForTimeout(8000);
  expect(await utterances(page)).toHaveLength(1);

  // The tab goes to the background and comes back: still nothing.
  await page.evaluate(() => {
    const setState = (state: 'hidden' | 'visible'): void => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    setState('hidden');
    setState('visible');
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
  });
  await page.waitForTimeout(3000);
  expect(await utterances(page)).toHaveLength(1);
});

test('switching the sound off is saved on this device and still off after a reload', async ({ page }) => {
  await fakeSpeech(page);
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile and settings' }).click();

  const sound = page.getByRole('switch', { name: 'Sound' });
  await expect(sound).toContainText('On');
  await sound.click();
  await expect(sound).toContainText('Off');
  await expect.poll(() => savedAudioPrefs(page)).toBe(JSON.stringify({ muted: true }));

  await page.reload();
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByRole('switch', { name: 'Sound' })).toContainText('Off');
});

/** From the first-quest preview to the first Match Sound round. */
async function openMatchSound(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('1 / 4')).toBeVisible();
}

/** The prompt panel's Hangul syllable (its accessible name is "<ko>, <romanization>"). */
const panelText = (page: Page) => page.getByTestId('prompt-panel-text');

/** The tile of the letter whose sound the text prompt shows, and its tap. */
async function tapAnswerFromText(page: Page): Promise<void> {
  const label = (await panelText(page).getAttribute('aria-label')) ?? '';
  const letter = jamoOfSpoken(label.split(',')[0]!.trim());
  await page.getByRole('button', { name: /^Korean letter / }).filter({ hasText: letter }).click();
}

test('no Korean voice: the sound is shown as text, nothing is spoken, and the round still scores', async ({ page }) => {
  await fakeSpeech(page, 'none');
  await onboardChild(page, { name: 'Dami' });
  await openMatchSound(page);

  // The text prompt: spoken syllable + romanization + the line, with the "this sound" heading.
  await expect(panelText(page)).toBeVisible();
  await expect(page.getByText('No sound? Read it here.')).toBeVisible();
  await expect(page.getByText('No Korean voice on this device.')).toBeVisible();
  await expect(page.getByText('Tap the letter for this sound')).toBeVisible();
  // Tiles keep their romanization (D2).
  await expect(page.getByRole('button', { name: /^Korean letter / }).first()).toBeVisible();

  // Never a read of Hangul by an English voice.
  expect(await utterances(page)).toEqual([]);

  await tapAnswerFromText(page);
  await expect(page.getByText('2 / 4')).toBeVisible();
  await expect(panelText(page)).toBeVisible();
  expect(await utterances(page)).toEqual([]);
});

test('sound switched off: the text prompt shows at once, Turn sound on plays it, and the text stays for the round', async ({ page }) => {
  await fakeSpeech(page);
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page.getByRole('switch', { name: 'Sound' }).click();
  await expect.poll(() => savedAudioPrefs(page)).toBe(JSON.stringify({ muted: true }));
  await page.reload();

  await page.getByRole('button', { name: /^Meet g, n, d, l/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('1 / 4')).toBeVisible();

  await expect(panelText(page)).toBeVisible();
  await expect(page.getByText('Sound is off.')).toBeVisible();
  await expect(page.getByText('Tap the letter for this sound')).toBeVisible();
  expect(await utterances(page)).toEqual([]);

  await page.getByTestId('prompt-panel-action').click();
  await expect.poll(async () => (await utterances(page)).length).toBeGreaterThan(0);
  const [first] = await utterances(page);
  expect(first).toMatchObject({ voice: 'Yuna', lang: 'ko-KR' });
  await expect(panelText(page)).toBeVisible();
  await expect.poll(() => savedAudioPrefs(page)).toBe(JSON.stringify({ muted: false }));
});

test('a wrong tap says the sound, not the letter name', async ({ page }) => {
  await fakeSpeech(page);
  await onboardChild(page, { name: 'Dami' });
  await openMatchSound(page);
  await expect.poll(async () => (await utterances(page)).length).toBeGreaterThan(0);
  const [first] = await utterances(page);
  // 가 not 기역: one syllable, spoken at the sound rate.
  expect(first!.text).toMatch(/^[가-힣]$|^이응$/);
  const answer = jamoOfSpoken(first!.text);
  const wrong = page.getByRole('button', { name: /^Korean letter / }).filter({ hasNotText: answer }).first();
  await wrong.click();
  await expect(page.getByText('Listen again. This one says')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hear it' })).toBeVisible();
  const before = (await utterances(page)).length;
  await page.getByRole('button', { name: 'Hear it' }).click();
  await expect.poll(async () => (await utterances(page)).length).toBeGreaterThan(before);
  expect((await utterances(page)).at(-1)!.text).toBe(first!.text);
});
