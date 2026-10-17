import type { Locator, Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, headerClose, keepSidewaysIfAsked, openLettersEpisode, passDiscover, readStored, seedStored } from './helpers';
import { shot } from './shots';

/**
 * The learner audio pass (F-AUDIO-004 §3.8 and its 2026-10-17 revision): no learner speaker fails
 * silently. With sound off, a speak the browser drops (iOS outside a gesture) and no Korean voice, each
 * surface says why and offers its one action; a tap speaks Korean in ko-KR inside the tap's user
 * activation; leaving a Discover step stops a sentence mid-way; and a gloss no longer repeats the
 * romanization above it (the 김밥 slide). The browser's speech engine is replaced before the app loads.
 *
 * Listen & Pick, Discover, Discover's Read along and the presenter run on the release build. The story
 * episode page, Culture notes, Trace a Word and the word cards run on the fixture bundle (their
 * content or entry hooks live there):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test learner-audio -g "fixture bundle"
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

/** `korean`: a ko-KR voice that ends each line at once. `hold`: it never ends (a long sentence still playing). */
type SpeechMode = 'korean' | 'hold' | 'blocked' | 'none';
interface Said {
  text: string;
  lang: string;
  /** `navigator.userActivation.isActive` when speak() was called: still inside the tap's activation. */
  active: boolean | null;
}
type SpeechWindow = Window & { __said?: Said[]; __dropped?: string[]; __cancels?: number };

/**
 * Replace speechSynthesis. `blocked` is iOS Safari outside a gesture: speak() is accepted and nothing ever
 * starts. `none` is a device with only an English voice. The silent unlock utterance of the first gesture
 * (volume 0) is not a prompt and is not kept.
 */
async function fakeSpeech(page: Page, mode: SpeechMode): Promise<void> {
  await page.addInitScript((m: SpeechMode) => {
    const w = window as SpeechWindow;
    const said: Said[] = [];
    const dropped: string[] = [];
    w.__said = said;
    w.__dropped = dropped;
    w.__cancels = 0;
    const v = (name: string, lang: string, isDefault = false) => ({ name, lang, voiceURI: name, localService: true, default: isDefault });
    const voices = m === 'none' ? [v('Samantha', 'en-US', true)] : [v('Yuna', 'ko-KR'), v('Samantha', 'en-US', true)];
    class Utterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: { name: string } | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((ev: { error: string }) => void) | null = null;
      constructor(public text: string) {}
    }
    let current: Utterance | null = null;
    const synth = {
      speaking: false,
      pending: false,
      speak: (u: Utterance) => {
        if (u.volume === 0) {
          setTimeout(() => {
            u.onstart?.();
            u.onend?.();
          }, 0);
          return;
        }
        if (m === 'blocked') {
          dropped.push(u.text);
          return;
        }
        const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
        said.push({ text: u.text, lang: u.lang, active: activation ? activation.isActive : null });
        current = u;
        synth.speaking = true;
        setTimeout(() => {
          u.onstart?.();
          if (m === 'hold') return;
          synth.speaking = false;
          current = null;
          u.onend?.();
        }, 0);
      },
      cancel: () => {
        w.__cancels = (w.__cancels ?? 0) + 1;
        const u = current;
        current = null;
        synth.speaking = false;
        if (u) setTimeout(() => u.onerror?.({ error: 'canceled' }), 0);
      },
      getVoices: () => voices,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
  }, mode);
}

const said = (page: Page): Promise<Said[]> => page.evaluate(() => [...((window as SpeechWindow).__said ?? [])]);
const dropped = (page: Page): Promise<string[]> => page.evaluate(() => [...((window as SpeechWindow).__dropped ?? [])]);
const cancels = (page: Page): Promise<number> => page.evaluate(() => (window as SpeechWindow).__cancels ?? 0);

/** Screens under the top one stay in the page (hidden): every lookup takes the visible one. */
const shown = (page: Page, testId: string): Locator => page.getByTestId(testId).filter({ visible: true });

/** A new learner on Home, past the install guide and the offline toast. */
async function newLearner(page: Page): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  return id;
}

/** Sound switched off on this device (the persisted `device:audio`), then the app loads again on Home. */
async function soundOff(page: Page): Promise<void> {
  await seedStored(page, 'device:audio', { muted: true });
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

/** The three silent cases and what the status panel says and offers for each (learner.audio). */
const CASES = [
  { name: 'sound off', mode: 'korean' as const, muted: true, detail: 'Sound is off.', action: 'Turn sound on', help: false },
  { name: 'a speak the browser drops', mode: 'blocked' as const, muted: false, detail: null, action: 'Tap to hear', help: false },
  { name: 'no Korean voice', mode: 'none' as const, muted: false, detail: 'No Korean voice on this device.', action: null, help: true },
];
type Case = (typeof CASES)[number];

/** The status panel `testId` says the case: its detail line, its one action, the voice help link. */
async function expectPanel(page: Page, testId: string, c: Case): Promise<void> {
  // A dropped speak is given up after the controller's 1.5 s start timeout.
  const timeout = 5_000;
  if (c.detail !== null) await expect(shown(page, `${testId}-detail`)).toHaveText(c.detail, { timeout });
  else await expect(shown(page, `${testId}-detail`)).toHaveCount(0);
  if (c.action !== null) await expect(shown(page, `${testId}-action`)).toHaveAccessibleName(c.action, { timeout });
  else await expect(shown(page, `${testId}-action`)).toHaveCount(0);
  if (c.help) await expect(shown(page, `${testId}-help`)).toHaveAccessibleName('How to add a voice', { timeout });
  else await expect(shown(page, `${testId}-help`)).toHaveCount(0);
}

/** Its action plays the Korean again (sound turned on, or the tap that the browser lets through). */
async function expectActionPlays(page: Page, testId: string, c: Case): Promise<void> {
  if (c.action === null) {
    // No Korean voice: the help link opens the sheet, which returns to the screen.
    await shown(page, `${testId}-help`).click();
    await expect(page.getByText('Add a Korean voice')).toBeVisible();
    await page.getByTestId('voice-help-sheet-scrim').click();
    await expect(page.getByText('Add a Korean voice')).toHaveCount(0);
    return;
  }
  if (c.mode === 'blocked') {
    // The browser keeps dropping speech here; the button is still the learner's way to try.
    const before = (await dropped(page)).length;
    await shown(page, `${testId}-action`).click();
    await expect.poll(async () => (await dropped(page)).length).toBeGreaterThan(before);
    return;
  }
  const before = (await said(page)).length;
  await shown(page, `${testId}-action`).click();
  await expect.poll(async () => (await said(page)).length).toBeGreaterThan(before);
  const last = (await said(page)).at(-1)!;
  expect(last.lang).toBe('ko-KR');
}

// ---- release build: Discover, Listen & Pick, Read along, the presenter ---------------------------

/** Journey, Meet the Letters, its first quest: the intro, then Discover (Stage 1 quest 1). */
async function openQuestOneDiscover(page: Page): Promise<void> {
  await openLettersEpisode(page);
  await page.getByRole('button', { name: 'Start', exact: true }).first().click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
}

/** From Discover through the two games (skipped) to the Check, and its first round. */
async function openQuestOneCheck(page: Page): Promise<void> {
  await passDiscover(page);
  for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Go' }).click();
  await expect(page.getByText('Listen, then pick')).toBeVisible();
}

const discoverPanel = (page: Page): Locator => page.locator('[data-testid^="discover-sound-"]:not([data-testid*="-sound-"][data-testid$="-detail"])').filter({ visible: true }).first();

test.describe('Discover and Listen & Pick never fail silently (release build)', () => {
  for (const c of CASES) {
    test(`Discover, ${c.name}: the item says why and offers its one action`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await fakeSpeech(page, c.mode);
      await newLearner(page);
      if (c.muted) await soundOff(page);
      await openQuestOneDiscover(page);
      // Nothing is said, and nothing explains a silence, before a tap.
      await expect(page.locator('[data-testid^="discover-sound-"][data-testid$="-detail"]')).toHaveCount(0);
      await page.getByRole('button', { name: /^Hear it\. / }).first().click();
      const testId = (await discoverPanel(page).getAttribute('data-testid'))!;
      await expectPanel(page, testId, c);
      // The "say it" line stays, Continue never waits.
      await expect(page.getByText(/^Say it out loud: /).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
      if (c.name === 'no Korean voice') await shot(page, 'learner-audio-discover-no-voice');
      await expectActionPlays(page, testId, c);
      expect(errors).toEqual([]);
    });

    test(`Listen & Pick, ${c.name}: the prompt shows as text with why and its one action`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await fakeSpeech(page, c.mode);
      await newLearner(page);
      if (c.muted) await soundOff(page);
      await openQuestOneDiscover(page);
      await openQuestOneCheck(page);
      if (!c.muted) await page.getByTestId('listen-pick-speaker').click();
      // The text panel: the Korean above it, "No sound? Read it here.", why, and the one action.
      await expect(shown(page, 'listen-pick-prompt')).toContainText('No sound? Read it here.', { timeout: 5_000 });
      await expect(shown(page, 'listen-pick-prompt-text')).toBeVisible();
      await expectPanel(page, 'listen-pick-prompt', c);
      if (c.muted) await shot(page, 'learner-audio-listen-pick-sound-off');
      await expectActionPlays(page, 'listen-pick-prompt', c);
      expect(errors).toEqual([]);
    });
  }

  test('leaving a Discover step while a sentence plays stops it (speechSynthesis.cancel)', async ({ page }) => {
    await fakeSpeech(page, 'hold');
    await newLearner(page);
    // Read Along (Stage 4, Letters & Books): its Discover pages are exchanges between two speakers.
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByRole('button', { name: /^Stage 4 [^,]+, Letters & Books/ }).click();
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
    const line = page.locator('[data-testid^="discover-hear-exchange:"]').filter({ visible: true }).first();
    await line.click();
    await expect.poll(async () => (await said(page)).length).toBe(1);
    expect((await said(page))[0]).toMatchObject({ lang: 'ko-KR', active: true });
    expect((await said(page))[0]!.text).toMatch(/[.?!]$/);
    // The sentence is still being said; the learner leaves the quest from the header.
    const before = await cancels(page);
    await headerClose(page).click();
    await page.getByRole('alertdialog').getByRole('button').last().click();
    await expect(page.getByText('Look and learn', { exact: true })).toHaveCount(0);
    await expect.poll(() => cancels(page)).toBeGreaterThan(before);
  });
});

/** A word topic deck with one word, 김밥, through the presenter's vocab adapter. */
const GIMBAP_DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:e2e091',
  title: 'Snack words',
  createdAt: '2026-10-17T09:00:00Z',
  seed: 7,
  blocks: [{ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab:gimbap'] }],
};

test.describe('the 김밥 slide: the gloss is the meaning, not the romanization again (release build)', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('the presenter word slide reads "seaweed rice roll" under gimbap', async ({ page }) => {
    await page.goto(`/present#d=${encodeDeck(GIMBAP_DECK)}`);
    const start = page.getByTestId('presenter-start-button');
    await expect(start).toBeEnabled({ timeout: 10_000 });
    await start.click();
    await expect(page.getByTestId('presenter-stage')).toBeVisible();
    const word = page.getByTestId('presenter-word');
    for (let i = 0; i < 20 && (await word.count()) === 0; i++) await page.keyboard.press('PageDown');
    await expect(word).toHaveText('김밥');
    await expect(page.getByTestId('presenter-word-rom')).toHaveText('gimbap');
    await page.keyboard.press('PageDown');
    await expect(page.getByTestId('presenter-word-gloss')).toHaveText('seaweed rice roll');
    await shot(page, 'learner-audio-presenter-gimbap-1280x720');
  });
});

// ---- fixture bundle: the story episode page, Culture notes, Trace a Word, the word cards ----------

type E2eWindow = Window & {
  __hrStoryE2E?: unknown;
  __hrVocabE2E?: { openTopic(topicKey: string): void; collect(ids: readonly string[]): boolean };
  __hrTraceWordE2E?: { open(params: { rounds: Array<{ id: string; word: { ko: string; romanization: string; en: string } }> }): void };
};

const STORY = 'story:hangul-day';
const NOTE = 'cn-hangul-day';

/** Library, Story Time, the fixture story's tile: its episode page with the word chips. */
async function openStoryEpisode(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  await page.getByText('Library', { exact: true }).last().click();
  await page.getByRole('tab', { name: 'Story Time', exact: true }).click();
  await shown(page, `story-tile-${STORY}`).click();
  await expect(shown(page, 'story-episode-words')).toBeVisible();
}

/** The fixture story finished (its note found), then Library, Culture, Culture notes. */
async function openCultureNotes(page: Page, id: string): Promise<void> {
  const at = '2026-10-16T09:00:00.000Z';
  await seedStored(page, `progress:${id}`, {
    profileId: id,
    updatedAt: at,
    episodes: [],
    quests: [{ questId: 'quest:story-hangul-day-listen', episodeId: 'episode:shelf-hangul-day', startedAt: at, completedAt: at, stars: 3, attempts: 1, accuracy: 1 }],
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 1,
    placements: [],
  });
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await page.getByText('Library', { exact: true }).last().click();
  await page.getByRole('tab', { name: 'Culture', exact: true }).click();
  await shown(page, 'library-culture-notes').click();
  await expect(shown(page, `culture-note-hear-${NOTE}`)).toBeVisible();
}

/** The first word chip's Korean (its KoreanText's first line) and its speaker. */
async function firstChip(page: Page): Promise<{ ko: string; speaker: Locator }> {
  const chip = shown(page, 'story-episode-words').locator('[data-testid^="story-episode-word-"]').first();
  const ko = (await chip.innerText()).split('\n')[0]!.trim();
  return { ko, speaker: chip.locator('[data-testid^="story-episode-hear-"]') };
}

async function openTraceWord(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrTraceWordE2E), undefined, { timeout: 30_000 });
  await page.evaluate(() =>
    (window as E2eWindow).__hrTraceWordE2E?.open({ rounds: [{ id: 'hoya', word: { ko: '호야', romanization: 'hoya', en: 'Hoya' } }] }),
  );
  await expect(page.getByTestId('trace-word-canvas')).toBeVisible();
}

test.describe('learner audio surfaces (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  for (const c of CASES) {
    test(`the story episode page, ${c.name}: the status line under the word chips`, async ({ page }) => {
      await fakeSpeech(page, c.mode);
      await newLearner(page);
      if (c.muted) await soundOff(page);
      await openStoryEpisode(page);
      await expect(shown(page, 'story-episode-words-sound-detail')).toHaveCount(0);
      await (await firstChip(page)).speaker.click();
      await expectPanel(page, 'story-episode-words-sound', c);
      await expectActionPlays(page, 'story-episode-words-sound', c);
    });

    test(`Culture notes, ${c.name}: the status line under the tapped term`, async ({ page }) => {
      await fakeSpeech(page, c.mode);
      const id = await newLearner(page);
      if (c.muted) await soundOff(page);
      await openCultureNotes(page, id);
      await shown(page, `culture-note-hear-${NOTE}`).click();
      await expectPanel(page, `culture-note-sound-${NOTE}`, c);
      if (c.name === 'sound off') await shot(page, 'learner-audio-culture-notes-sound-off');
      await expectActionPlays(page, `culture-note-sound-${NOTE}`, c);
    });

    test(`Trace a Word, ${c.name}: the status line beside the block speakers`, async ({ page }) => {
      await fakeSpeech(page, c.mode);
      await newLearner(page);
      if (c.muted) await soundOff(page);
      await openTraceWord(page);
      // The block's opening sound waits for a tap while sound is off or nothing could sound (no Korean
      // voice); with a voice it is tried on open, and the browser drops it.
      if (c.mode !== 'blocked') {
        await expect(shown(page, 'trace-word-sound-detail')).toHaveCount(0);
        await shown(page, 'trace-word-strip').getByRole('button').first().click();
      }
      await expectPanel(page, 'trace-word-sound', c);
      if (c.name === 'no Korean voice') await shot(page, 'learner-audio-trace-word-no-voice');
      await expectActionPlays(page, 'trace-word-sound', c);
    });
  }

  test('a story word chip and a Culture notes term speak their Korean in ko-KR, inside the tap', async ({ page }) => {
    await fakeSpeech(page, 'korean');
    const id = await newLearner(page);
    await openStoryEpisode(page);
    const chip = await firstChip(page);
    await chip.speaker.click();
    await expect.poll(async () => (await said(page)).length).toBe(1);
    expect((await said(page))[0]).toEqual({ text: chip.ko, lang: 'ko-KR', active: true });

    await openCultureNotes(page, id);
    const term = (await shown(page, `culture-note-${NOTE}`).locator('[lang="ko"]').first().innerText()).trim();
    await shown(page, `culture-note-hear-${NOTE}`).click();
    await expect.poll(async () => (await said(page)).length).toBe(1);
    expect((await said(page))[0]).toEqual({ text: term, lang: 'ko-KR', active: true });
    await expect(shown(page, `culture-note-sound-${NOTE}-detail`)).toHaveCount(0);
  });

  test('the learner word card for 김밥 reads "seaweed rice roll"', async ({ page }) => {
    await newLearner(page);
    await page.waitForFunction(() => Boolean((window as E2eWindow).__hrVocabE2E), undefined, { timeout: 10_000 });
    expect(await page.evaluate(() => (window as E2eWindow).__hrVocabE2E?.collect(['vocab:gimbap']) ?? false)).toBe(true);
    await page.evaluate(() => (window as E2eWindow).__hrVocabE2E?.openTopic('food'));
    await expect(page.getByTestId('vocab-topic')).toBeVisible();
    await page.getByTestId('vocab-wall-vocab:gimbap').click();
    await expect(page.getByTestId('vocab-card-back')).toBeVisible();
    await expect(page.getByTestId('vocab-card-gloss')).toHaveText('seaweed rice roll');
    await shot(page, 'learner-audio-vocab-card-gimbap');
  });
});
