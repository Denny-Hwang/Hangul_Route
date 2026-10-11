import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { jamoOfSpoken, keepSidewaysIfAsked, onboardChild } from './helpers';

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

/** F-AUDIO-004 A-4b: the Profile Sound card says whether the device has a Korean voice. */
async function openProfile(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile and settings' }).click();
}

test('Profile Sound card with a Korean voice: says ready, offers no how-to, and the switch still works', async ({ page }) => {
  await fakeSpeech(page, 'korean');
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await openProfile(page);

  await expect(page.getByTestId('sound-voice-status')).toHaveText('Korean voice: ready');
  await expect(page.getByTestId('sound-how-to-add')).toHaveCount(0);
  const sound = page.getByRole('switch', { name: 'Sound, on. Korean voice ready.' });
  await expect(sound).toBeVisible();
  await sound.click();
  await expect(page.getByRole('switch', { name: 'Sound, off. Korean voice ready.' })).toContainText('Off');
});

test('Profile Sound card with no Korean voice: says so and the how-to sheet lists the steps', async ({ page }) => {
  await fakeSpeech(page, 'none');
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await openProfile(page);

  await expect(page.getByTestId('sound-voice-status')).toHaveText('No Korean voice on this device');
  const sound = page.getByRole('switch', { name: 'Sound, on. No Korean voice on this device.' });
  await expect(sound).toBeVisible();

  await page.getByTestId('sound-how-to-add').click();
  const sheet = page.getByTestId('voice-help-sheet');
  await expect(sheet.getByText('Add a Korean voice')).toBeVisible();
  await expect(sheet.getByText('Menu names can differ on your device.')).toBeVisible();
  for (const family of ['iPhone or iPad', 'Android', 'Computer']) await expect(sheet.getByText(family, { exact: true })).toBeVisible();
  await expect(sheet.getByText('You can still play: the sound is written on screen.')).toBeVisible();

  // Help never changes the sound switch.
  await page.getByTestId('voice-help-sheet-ok').click();
  await expect(page.getByTestId('voice-help-sheet')).toHaveCount(0);
  await expect(sound).toContainText('On');
});

test('no Korean voice in Match Sound: the panel links to the same sheet and the round carries on', async ({ page }) => {
  await fakeSpeech(page, 'none');
  await onboardChild(page, { name: 'Dami' });
  await openMatchSound(page);

  await page.getByTestId('prompt-panel-help').click();
  await expect(page.getByTestId('voice-help-sheet').getByText('Add a Korean voice')).toBeVisible();
  await page.getByTestId('voice-help-sheet-ok').click();
  await expect(page.getByTestId('voice-help-sheet')).toHaveCount(0);

  await expect(page.getByText('1 / 4')).toBeVisible();
  await tapAnswerFromText(page);
  await expect(page.getByText('2 / 4')).toBeVisible();
});

test('a ready voice never shows the how-to link in Match Sound', async ({ page }) => {
  await fakeSpeech(page, 'korean');
  await onboardChild(page, { name: 'Dami' });
  await openMatchSound(page);
  await expect(page.getByTestId('prompt-panel-help')).toHaveCount(0);
});

/** F-AUDIO-004 A-5b: from the first-quest preview, past the two listening games, to Build a Letter. */
async function openBuildLetter(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continue' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('Build this letter')).toBeVisible();
}

const buildSpeaker = (page: Page) => page.getByTestId('build-letter-speaker');

test('Build a Letter says the syllable with Yuna when it is tapped, and shows no panel while sound works', async ({ page }) => {
  await fakeSpeech(page, 'korean');
  await onboardChild(page, { name: 'Dami' });
  await openBuildLetter(page);
  // Nothing autoplays here, not even after the controller's capability wait (up to 1.5 s).
  await page.waitForTimeout(1600);
  expect(await utterances(page)).toEqual([]);

  await buildSpeaker(page).click();
  await expect.poll(async () => (await utterances(page)).length).toBe(1);
  const [said] = await utterances(page);
  expect(said).toMatchObject({ voice: 'Yuna', lang: 'ko-KR' });
  expect(said!.text).toMatch(/^[가-힣]$/);
  await expect(buildSpeaker(page)).toContainText(said!.text);
  await expect(page.getByTestId('prompt-panel-detail')).toHaveCount(0);
});

test('Build a Letter with no Korean voice: the syllable stays on screen and a tap says why it is silent', async ({ page }) => {
  await fakeSpeech(page, 'none');
  await onboardChild(page, { name: 'Dami' });
  await openBuildLetter(page);
  // The syllable and its romanization are the text; no panel before the learner asks for the sound.
  await expect(page.getByTestId('prompt-panel-detail')).toHaveCount(0);

  await buildSpeaker(page).click();
  await expect(page.getByTestId('prompt-panel-detail')).toHaveText('No Korean voice on this device.');
  // The syllable is not printed a second time.
  await expect(page.getByTestId('prompt-panel-text')).toHaveCount(0);
  expect(await utterances(page)).toEqual([]);

  await page.getByTestId('prompt-panel-help').click();
  await expect(page.getByTestId('voice-help-sheet').getByText('Add a Korean voice')).toBeVisible();
  await page.getByTestId('voice-help-sheet-ok').click();
  await expect(page.getByRole('button', { name: /^Korean letter / }).first()).toBeVisible();
});

test('Build a Letter with sound off: a tap says sound is off, and Turn sound on says the syllable', async ({ page }) => {
  await fakeSpeech(page, 'korean');
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page.getByRole('switch', { name: /^Sound/ }).click();
  await expect.poll(() => savedAudioPrefs(page)).toBe(JSON.stringify({ muted: true }));
  await page.reload();
  await page.getByRole('button', { name: /^Meet g, n, d, l/ }).click();
  await openBuildLetter(page);
  await expect(page.getByTestId('prompt-panel-detail')).toHaveCount(0);

  await buildSpeaker(page).click();
  await expect(page.getByTestId('prompt-panel-detail')).toHaveText('Sound is off.');
  expect(await utterances(page)).toEqual([]);

  await page.getByTestId('prompt-panel-action').click();
  await expect.poll(async () => (await utterances(page)).length).toBe(1);
  expect((await utterances(page))[0]).toMatchObject({ voice: 'Yuna', lang: 'ko-KR' });
  await expect.poll(() => savedAudioPrefs(page)).toBe(JSON.stringify({ muted: false }));
});

/**
 * F-AUDIO-004 A-5b: the Stage 4 "Greeting Dialogues" quest (Journey, Holidays & Traditions, stage 4):
 * step 3 is Tap & Respond, step 4 Culture Quiz. `skips` is how many minigame steps to skip first.
 */
async function openGreetingQuest(page: Page, name: string, skips: number): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: 'Holidays & Traditions episode for stage4' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const anyway = page.getByRole('button', { name: 'Play anyway' });
  if (await anyway.isVisible()) await anyway.click();
  await page.getByRole('button', { name: 'Continue' }).click();
  for (let i = 0; i < skips; i++) await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Play minigame' }).click();
}

async function openTapRespond(page: Page, name = 'Dami'): Promise<void> {
  await openGreetingQuest(page, name, 1);
  await expect(page.getByText('Choose your reply', { exact: true })).toBeVisible();
  await expect(page.getByText('1 / 3')).toBeVisible();
}

const tapRespondHear = (page: Page) => page.getByTestId('tap-respond-hear');
const reply = (page: Page, english: string) => page.getByRole('button', { name: new RegExp(`·\\s+${english}$`) });

async function muteOnThisDevice(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page.getByRole('switch', { name: /^Sound/ }).click();
  await expect.poll(() => savedAudioPrefs(page)).toBe(JSON.stringify({ muted: true }));
  await page.reload();
}

test('Tap & Respond with a Korean voice: the line is said when the turn opens and again on Hear it', async ({ page }) => {
  await fakeSpeech(page, 'korean');
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await openTapRespond(page);

  await expect.poll(async () => (await utterances(page)).map((u) => u.text)).toEqual(['안녕하세요!']);
  expect((await utterances(page))[0]).toMatchObject({ voice: 'Yuna', lang: 'ko-KR' });
  await expect(tapRespondHear(page)).toHaveAccessibleName('Hear annyeonghaseyo');
  // The line and its romanization are on screen; no panel while the sound works.
  await expect(page.getByTestId('prompt-panel-detail')).toHaveCount(0);

  await tapRespondHear(page).click();
  await expect.poll(async () => (await utterances(page)).map((u) => u.text)).toEqual(['안녕하세요!', '안녕하세요!']);
});

test('Tap & Respond: a right reply is said in full before the next line, and Hear it cannot cut it off', async ({ page }) => {
  await fakeSpeech(page, 'korean');
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await openTapRespond(page);
  await expect.poll(async () => (await utterances(page)).length).toBe(1);

  await reply(page, 'Hello').click();
  // While the reply is said (and for at least 900 ms), Hear it is off.
  await expect(tapRespondHear(page)).toBeDisabled();
  await expect(page.getByText('2 / 3')).toBeVisible();
  const texts = (await utterances(page)).map((u) => u.text);
  // NPC line, the reply, then the next turn's line: never the next line before the reply.
  expect(texts.slice(0, 2)).toEqual(['안녕하세요!', '안녕하세요']);
  await expect.poll(async () => (await utterances(page)).length).toBe(3);
  const next = (await utterances(page))[2]!;
  expect(next.text).not.toBe('안녕하세요');
  await expect(page.getByText(next.text, { exact: true })).toBeVisible();
  await expect(tapRespondHear(page)).toBeEnabled();
});

test('Tap & Respond with no Korean voice: nothing is said and the panel says why', async ({ page }) => {
  await fakeSpeech(page, 'none');
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await openTapRespond(page);

  // The turn-open play counts as asking, so the reason shows at once.
  await expect(page.getByTestId('prompt-panel-detail')).toHaveText('No Korean voice on this device.');
  await expect(page.getByTestId('prompt-panel-help')).toBeVisible();
  // The Korean is not printed a second time.
  await expect(page.getByTestId('prompt-panel-text')).toHaveCount(0);
  await reply(page, 'Hello').click();
  await expect(page.getByText('2 / 3')).toBeVisible();
  expect(await utterances(page)).toEqual([]);
});

test('Tap & Respond with sound off: the turn opens quietly, and Hear it says sound is off', async ({ page }) => {
  await fakeSpeech(page, 'korean');
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await muteOnThisDevice(page);
  await openTapRespond(page);

  await page.waitForTimeout(1600);
  await expect(page.getByTestId('prompt-panel-detail')).toHaveCount(0);
  expect(await utterances(page)).toEqual([]);

  await tapRespondHear(page).click();
  await expect(page.getByTestId('prompt-panel-detail')).toHaveText('Sound is off.');
  expect(await utterances(page)).toEqual([]);
  await page.getByTestId('prompt-panel-action').click();
  await expect.poll(async () => (await utterances(page)).map((u) => u.text)).toEqual(['안녕하세요!']);
});

test('Culture Quiz: Hear it says the prompt word, and nothing plays before the tap', async ({ page }) => {
  await fakeSpeech(page, 'korean');
  await onboardChild(page, { name: 'Dami', startJourney: false });
  await openGreetingQuest(page, 'Dami', 2);
  const hear = page.getByTestId('culture-quiz-hear');
  await expect(hear).toBeVisible();
  await page.waitForTimeout(1600);
  expect(await utterances(page)).toEqual([]);
  await expect(hear).toHaveAccessibleName(/^Hear /);

  await hear.click();
  await expect.poll(async () => (await utterances(page)).length).toBe(1);
  const [said] = await utterances(page);
  expect(said).toMatchObject({ voice: 'Yuna', lang: 'ko-KR' });
  // The word that was said is the one printed above the button.
  await expect(page.getByRole('heading', { name: said!.text, exact: true })).toBeVisible();
  await expect(page.getByTestId('prompt-panel-detail')).toHaveCount(0);
});

/**
 * F-AUDIO-004 A-6: bundled clips on the web (§3.10). Letter clips are precached; vocabulary,
 * story, card and dialogue clips are runtime-cached. Real letter clips arrive with A-9 (T-017);
 * until then these tests run on the e2e fixture build, which maps fixture tones for g, n, d, l
 * and one vocabulary tone from e2e/fixtures/audio (CI: the "Story reader e2e (fixture bundle)" step):
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test audio -g "bundled clips"
 * (Only this group: in the fixture build those four letters play a tone, not the voice, so the
 * voice tests above expect the regular build.)
 */
const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const DIST = join(__dirname, '..', '..', FIXTURE_BUILD ? 'dist-e2e' : 'dist');

/** Built .mp3 files, relative to dist (dot folders included). */
function builtClips(): string[] {
  if (!existsSync(DIST)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.mp3')) out.push(relative(DIST, full).split('\\').join('/'));
    }
  };
  walk(DIST);
  return out;
}

const RUNTIME_CLIP = /(^|\/)audio\/(vocab|story|card|dialogue)\//;
const letterClips = builtClips().filter((p) => /\/audio\/jamo\//.test(p));
const runtimeClips = builtClips().filter((p) => RUNTIME_CLIP.test(p));
// The fixture build must hold its clips: a silent skip there would leave the clip path unchecked in CI.
const NO_CLIPS = 'No letter clips in this build: real ones arrive with A-9 (T-017); the fixture build (see above) has four.';

type ClipWindow = Window & { __clipStarts?: number[] };

/** Records every Web Audio buffer that starts (its duration), so a played clip is visible. */
async function recordClipStarts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const starts: number[] = [];
    (window as ClipWindow).__clipStarts = starts;
    const proto = window.AudioBufferSourceNode?.prototype;
    if (!proto) return;
    const start = proto.start;
    proto.start = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
      starts.push(this.buffer?.duration ?? 0);
      return start.apply(this, args);
    };
  });
}

/** Clips (not the one-sample unlock buffer) that have started. */
const clipStarts = async (page: Page): Promise<number> =>
  (await page.evaluate(() => (window as ClipWindow).__clipStarts ?? [])).filter((d) => d > 0.1).length;

/** One online visit until the service worker controls the page. */
async function controlledBySw(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg?.active && !!navigator.serviceWorker.controller;
  });
}

test.describe('bundled clips (A-6)', () => {
  test('the service worker precaches every letter clip and runtime-caches the other clip groups', async ({ page }) => {
    if (FIXTURE_BUILD) {
      expect(letterClips.length, 'fixture letter clips').toBeGreaterThan(0);
      expect(runtimeClips.length, 'fixture vocabulary clip').toBeGreaterThan(0);
    }
    const res = await page.request.get('/sw.js');
    expect(res.ok()).toBe(true);
    const sw = await res.text();
    for (const clip of letterClips) expect(sw, clip).toContain(clip);
    for (const clip of runtimeClips) expect(sw, clip).not.toContain(clip);
    // The cache-first rule for vocabulary / story / card / dialogue clips.
    expect(sw).toContain('hr-audio-v1');
    expect(sw).toContain('CacheFirst');
  });

  test('a vocabulary clip is cached on its first online fetch and then served offline', async ({ page, context }) => {
    test.skip(runtimeClips.length === 0 && !FIXTURE_BUILD, 'No runtime-cached clips in this build; the fixture build has one.');
    const url = `/${runtimeClips[0]}`;
    await fakeSpeech(page, 'none');
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await page.goto('/');
    await controlledBySw(page);
    const online = await page.evaluate(async (u) => {
      const res = await fetch(u);
      return { ok: res.ok, type: res.headers.get('content-type') };
    }, url);
    expect(online).toEqual({ ok: true, type: 'audio/mpeg' });
    await expect
      .poll(() => page.evaluate(async (u) => !!(await (await caches.open('hr-audio-v1')).match(u)), url))
      .toBe(true);
    await context.setOffline(true);
    const offline = await page.evaluate(async (u) => {
      const res = await fetch(u);
      return { ok: res.ok, bytes: (await res.arrayBuffer()).byteLength };
    }, url);
    expect(offline.ok).toBe(true);
    expect(offline.bytes).toBeGreaterThan(0);
  });

  test('offline after one visit, Match Sound plays the letter clip and the "no voice" text stays away', async ({ page, context }) => {
    test.skip(letterClips.length === 0 && !FIXTURE_BUILD, NO_CLIPS);
    await fakeSpeech(page, 'none');
    await recordClipStarts(page);
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await page.goto('/');
    await controlledBySw(page);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();

    await page.getByRole('button', { name: /^Meet g, n, d, l/ }).click();
    await openMatchSound(page);

    // A clip started, served by the service worker.
    await expect.poll(() => clipStarts(page)).toBeGreaterThan(0);
    // A recording plays, so the round is not switched to the "no Korean voice" text prompt.
    await expect(page.getByText('No Korean voice on this device.')).toHaveCount(0);
    await expect(page.getByText('Tap the letter you hear')).toBeVisible();
  });

  test('with a Korean voice on the device the recording still wins (clip > voice, AD4)', async ({ page }) => {
    test.skip(letterClips.length === 0 && !FIXTURE_BUILD, NO_CLIPS);
    await fakeSpeech(page, 'korean');
    await recordClipStarts(page);
    await onboardChild(page, { name: 'Dami' });
    await openMatchSound(page);

    await expect.poll(() => clipStarts(page)).toBeGreaterThan(0);
    // The clip played to its end: the Korean voice never spoke the letter.
    await page.waitForTimeout(1500);
    expect((await utterances(page)).filter((u) => u.lang === 'ko-KR')).toEqual([]);
  });
});
