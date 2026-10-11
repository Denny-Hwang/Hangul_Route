import { expect, test, type Page } from '@playwright/test';
import { onboardChild } from './helpers';

/**
 * F-AUDIO-004 A-4a: one persisted sound switch (AD7) and a ranked Korean voice
 * (AD5). The browser's speech engine is replaced before the app loads:
 * headless Chromium has no Korean voice, and the real one cannot be driven.
 */

type SpeechWindow = Window & { __utterances?: Array<{ text: string; voice: string | null; lang: string }> };

async function fakeSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: NonNullable<SpeechWindow['__utterances']> = [];
    (window as SpeechWindow).__utterances = log;
    const v = (name: string, lang: string, isDefault = false) => ({ name, lang, voiceURI: name, localService: true, default: isDefault });
    // The eight Apple novelty ko_KR voices come before Yuna (`say -v '?'`).
    const voices = [
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
  });
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
