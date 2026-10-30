import type { Locator, Page } from '@playwright/test';
import { jamoAll } from '../../src/content/jamo';
import { expect, test } from './fixtures';
import { passDiscover } from './helpers';
import {
  captureSpeech,
  discoverPageOf,
  en,
  expectNoJamoSaid,
  hearIt,
  hearWithVowel,
  LETTER_OF,
  openQuestOneDiscover,
  roundPill,
  said,
  saidCount,
  shown,
  type VoiceWindow,
} from './jamo-voice-rig';

/**
 * AMENDMENTS-AUDIO-CLIPS JV-4, the second run: the same rule as `jamo-voice.spec.ts` on the e2e fixture
 * build, which maps the fixture tones of e2e/fixtures/audio (jamo/nieun.mp3 is ㄴ's sound clip, na, and
 * jamo/nieun-name.mp3 is in place for its name clip). A letter question never plays the sound clip, and a
 * sound question (Discover's Hear it with a vowel) does.
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test jamo-voice-audio
 *
 * CI runs this file in the fixture-bundle step through its `list audio -g "bundled clips"` line: the file
 * name holds "audio" and the group title holds "bundled clips". Keep both, or the group runs nowhere.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

/** ㄴ's record, and the name clip it declares once content gives one (AC-1, #879, adds `nameAudioRef`). */
const NIEUN = jamoAll.find((j) => j.id === 'jamo:nieun');
const NIEUN_NAME_REF = (NIEUN as { nameAudioRef?: unknown } | undefined)?.nameAudioRef;

/** The Stage 1 initial or vowel a letter is (ㄴ is jamo:nieun). */
const idOfLetter = (letter: string): string | undefined => jamoAll.find((j) => j.kind !== 'batchim' && j.char === letter)?.id;

/**
 * Records the URL of every clip that starts: the fetched bytes are tagged with their URL, the decoded
 * buffer with the bytes' URL, and a starting `AudioBufferSourceNode` reports its buffer's URL. Clips
 * the screen only warms (fetched and decoded, never started) are not counted.
 */
async function recordClipUrls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const clips: string[] = [];
    (window as VoiceWindow).__clips = clips;
    const bytesUrl = new WeakMap<ArrayBuffer, string>();
    const bufferUrl = new WeakMap<AudioBuffer, string>();
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const res = await fetchOriginal(input, init);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (/\.mp3(\?|$)/.test(url)) {
        const read = res.arrayBuffer.bind(res);
        Object.defineProperty(res, 'arrayBuffer', {
          configurable: true,
          value: async () => {
            const bytes = await read();
            bytesUrl.set(bytes, url);
            return bytes;
          },
        });
      }
      return res;
    };
    const ctx = (window.BaseAudioContext ?? window.AudioContext)?.prototype;
    if (ctx) {
      const decode = ctx.decodeAudioData;
      ctx.decodeAudioData = function (this: BaseAudioContext, data: ArrayBuffer, ok?: DecodeSuccessCallback | null, fail?: DecodeErrorCallback | null) {
        const url = bytesUrl.get(data);
        const tag = (buffer: AudioBuffer): AudioBuffer => {
          if (url !== undefined) bufferUrl.set(buffer, url);
          return buffer;
        };
        const pending = decode.call(this, data, ok ? (b: AudioBuffer) => ok(tag(b)) : ok, fail);
        return pending && typeof pending.then === 'function' ? pending.then(tag) : pending;
      };
    }
    const source = window.AudioBufferSourceNode?.prototype;
    if (source) {
      const start = source.start;
      source.start = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
        const url = this.buffer ? bufferUrl.get(this.buffer) : undefined;
        if (url !== undefined) clips.push(url);
        return start.apply(this, args);
      };
    }
  });
}


const clipsStarted = (page: Page): Promise<string[]> => page.evaluate(() => [...((window as VoiceWindow).__clips ?? [])]);
/** A built fixture clip's URL ends in its id, Metro's content hash and `.mp3`. */
const clipUrl = (id: string): RegExp => new RegExp(`/jamo/${id}(\\.[0-9a-f]+)?\\.mp3$`);
/** The file id of a fixture jamo clip (`a`, `nieun`, `nieun-name`). */
const CLIP_ID = /\/jamo\/([a-z]+)(-name)?(?:\.[0-9a-f]+)?\.mp3$/;

interface Heard {
  said: string[];
  clips: string[];
}

/** Taps `button` and returns what it played: the utterances and the clip URLs that started after the tap. */
async function heardAfter(page: Page, button: Locator): Promise<Heard> {
  const saidBefore = await saidCount(page);
  const clipsBefore = (await clipsStarted(page)).length;
  await button.click();
  await expect.poll(async () => (await saidCount(page)) + (await clipsStarted(page)).length).toBeGreaterThan(saidBefore + clipsBefore);
  return { said: (await said(page)).slice(saidBefore).map((u) => u.text), clips: (await clipsStarted(page)).slice(clipsBefore) };
}

/**
 * The jamo a Match Sound prompt asks for: the letter whose name was said, or the letter of the clip that
 * played (a vowel's name is its sound, so jamo/a.mp3 is ㅏ; jamo/nieun-name.mp3 is ㄴ).
 */
function targetOf(heard: Heard): string {
  for (const text of heard.said) {
    const letter = LETTER_OF.get(text);
    const id = letter === undefined ? undefined : idOfLetter(letter);
    if (id !== undefined) return id;
  }
  for (const url of heard.clips) {
    const match = CLIP_ID.exec(url);
    if (match) return `jamo:${match[1]}`;
  }
  throw new Error(`the prompt named no letter: ${JSON.stringify(heard)}`);
}

/**
 * From Quest 1's Discover to Match Sound's first ㄴ round (the pool's first pass asks every letter), and what
 * its speaker played there. A round that is not ㄴ is answered with the tile its prompt names, and only that one.
 */
async function matchSoundNieun(page: Page): Promise<Heard> {
  await passDiscover(page);
  await page.getByRole('button', { name: en.learner.quest.launcher.game.play.cta }).click();
  for (let round = 1; round <= 4; round += 1) {
    await expect(roundPill(page, round)).toBeVisible();
    const heard = await heardAfter(page, shown(page, 'match-sound-speaker'));
    const target = targetOf(heard);
    if (target === 'jamo:nieun') return heard;
    await expect(shown(page, 'match-sound-tiles').locator('[data-testid^="match-sound-tile-"]')).toHaveCount(4);
    await shown(page, `match-sound-tile-${target}`).click();
    await expect(roundPill(page, round + 1)).toBeVisible();
  }
  throw new Error('Quest 1 Match Sound never asked for ㄴ in the first pass of its pool');
}

test.describe('the voice matches the letter (fixture tones, bundled clips)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('Discover: Hear it with a vowel on ㄴ plays the sound clip jamo/nieun.mp3, Hear it never does', async ({ page }) => {
    await captureSpeech(page);
    await recordClipUrls(page);
    await openQuestOneDiscover(page);
    await discoverPageOf(page, 'jamo:nieun');

    // Hear it is a letter question: the name (니은, on the device voice until ㄴ has a name clip). The sound clip never stands in for it.
    const name = await heardAfter(page, hearIt(page, 'jamo:nieun'));
    expect(targetOf(name), JSON.stringify(name)).toBe('jamo:nieun');
    for (const url of name.clips) expect(url).not.toMatch(clipUrl('nieun'));

    // The second button is a sound question: the sound clip, and no device voice.
    const sound = await heardAfter(page, hearWithVowel(page, 'jamo:nieun'));
    expect(sound.clips).toHaveLength(1);
    expect(sound.clips[0]).toMatch(clipUrl('nieun'));
    expect(sound.said).toEqual([]);
    await expectNoJamoSaid(page);
  });

  test('Match Sound: a ㄴ round says the name and never plays the sound clip jamo/nieun.mp3', async ({ page }) => {
    test.setTimeout(120_000);
    await captureSpeech(page);
    await recordClipUrls(page);
    await openQuestOneDiscover(page);
    const heard = await matchSoundNieun(page);
    for (const url of heard.clips) expect(url).not.toMatch(clipUrl('nieun'));
    if (NIEUN_NAME_REF === undefined) expect(heard.said).toContain('니은');
    await expectNoJamoSaid(page);
  });

  test('Match Sound: a ㄴ round plays the name clip jamo/nieun-name.mp3', async ({ page }) => {
    // Runs as soon as content gives ㄴ a name clip; it then has to be the fixture's.
    test.skip(NIEUN_NAME_REF === undefined, 'ㄴ has no nameAudioRef in content until AC-1 (#879); e2e/fixtures/audio/jamo/nieun-name.mp3 is in place for it');
    expect(NIEUN_NAME_REF).toBe('audio/jamo/nieun-name.mp3');
    test.setTimeout(120_000);
    await captureSpeech(page);
    await recordClipUrls(page);
    await openQuestOneDiscover(page);
    const heard = await matchSoundNieun(page);
    expect(heard.clips.some((u) => clipUrl('nieun-name').test(u)), JSON.stringify(heard)).toBe(true);
    expect(heard.said).toEqual([]);
  });
});
