import type { Locator, Page } from '@playwright/test';
import { encodeDeck, type LectureDeckInput, type ProgressSnapshot } from '@hangul-route/content-schema';
import { colors } from '@hangul-route/design-system/tokens';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, onboardChild, openLettersEpisode, passDiscover, readStored, seedStored, waitForNextListenPickRound } from './helpers';
import {
  captureSpeech,
  discoverPageOf,
  en,
  expectNoLoneJamo,
  FINAL_SYLLABLE,
  FINAL_SYLLABLES,
  hear,
  hearIt,
  hearWithVowel,
  JAMO,
  LETTER_OF,
  NAME,
  nextSaid,
  openQuestOneDiscover,
  roundPill,
  said,
  saidCount,
  shown,
} from './jamo-voice-rig';
import { shot } from './shots';

/**
 * AMENDMENTS-AUDIO-CLIPS JV-4 (goals G1 and G2, invariant JV-A1): the voice says what the screen asks.
 * A letter question says the letter's name (ㄴ is 니은, a vowel's name is its sound, ㅇ is 이응); a
 * sound question says a syllable (나 for ㄴ on a vowel, 안 for the final ㄴ). The browser's speech engine
 * is a stand-in with one ko-KR voice that records every utterance, the way `audio.spec.ts`,
 * `learner-audio.spec.ts` and `test-support/audio-rig.ts` capture speech. Every utterance of every
 * test is checked against the invariant: none is a lone jamo, so the device never reads a bare letter
 * (whose voice differs by engine).
 *
 * These tests run on the release build and the device voice (no generated clips exist yet). The second
 * run, on the fixture clips, is `jamo-voice-audio.spec.ts`; the two share `jamo-voice-rig.ts`.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';

/** A token hex as the browser computes it (`rgb(r, g, b)`). */
const rgbOf = (hex: string): string => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const AMBER = rgbOf(colors.feedback.nudge);
const RED = rgbOf(colors.feedback.danger);
/** Every border and ground colour drawn inside `target` (itself included). */
const drawnColors = (target: Locator): Promise<string[]> =>
  target.evaluate((el) =>
    [el, ...Array.from(el.querySelectorAll('*'))].flatMap((n) => {
      const cs = getComputedStyle(n);
      return [cs.borderTopColor, cs.backgroundColor, cs.color];
    }),
  );

test.describe('the voice matches the letter (release build, device voice)', () => {
  test.skip(FIXTURE_BUILD, 'the fixture build plays clips for six letters; these tests pin the device voice');

  test('Quest 1 Discover: ㄴ says 니은, Hear it with a vowel says 나; ㅏ says 아', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await captureSpeech(page);
    await openQuestOneDiscover(page);
    // Nothing plays before a tap.
    expect(await said(page)).toEqual([]);

    // Page 1: a vowel. Its name is its sound, so one Hear it (아) and no second button.
    await discoverPageOf(page, 'jamo:a');
    expect(await hear(page, hearIt(page, 'jamo:a'))).toBe('아');
    await expect(shown(page, 'discover-spoken-jamo:a')).toContainText('아');
    await expect(shown(page, 'discover-spoken-jamo:a')).toContainText('a');
    await expect(hearWithVowel(page, 'jamo:a')).toHaveCount(0);

    // Page 2: ㄴ. Hear it says its name with the line "니은 · nieun"; the second button says the syllable 나.
    await discoverPageOf(page, 'jamo:nieun');
    expect(await hear(page, hearIt(page, 'jamo:nieun'))).toBe('니은');
    const spokenLine = shown(page, 'discover-spoken-jamo:nieun');
    await expect(spokenLine).toContainText('니은');
    await expect(spokenLine).toContainText('nieun');
    await expect(spokenLine).not.toContainText(/\bna\b/);
    const withVowel = hearWithVowel(page, 'jamo:nieun');
    await expect(withVowel).toHaveAccessibleName(en.learner.quest.discover.soundWith.cta);
    expect(await hear(page, withVowel)).toBe('나');
    const item = shown(page, 'discover-item-jamo:nieun');
    await expect(item).toContainText('나 = ㄴ + ㅏ');
    await expect(item).toContainText('na');
    // ㄱ on the same page: its name, never 가.
    expect(await hear(page, hearIt(page, 'jamo:giyeok'))).toBe('기역');
    expect(await hear(page, hearWithVowel(page, 'jamo:giyeok'))).toBe('가');
    await shot(page, 'jamo-voice-discover-nieun');

    await expectNoLoneJamo(page);
    expect(errors).toEqual([]);
  });

  test('Quest 2 Discover: ㅇ says 이응 and has no second button', async ({ page }) => {
    await captureSpeech(page);
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await page.goto('/');
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    const guide = page.getByTestId('install-guide');
    await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
    if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
    await openLettersEpisode(page);
    await page.getByTestId('episode-quest-quest:stage1-letters-q2').getByRole('button', { name: en.learner.episode.quests.start.cta, exact: true }).click();
    // Quest 2 builds on Quest 1: the episode offers to start there, and the learner plays it anyway.
    await page.getByRole('button', { name: en.learner.episode.prereq.playAnyway.cta, exact: true }).click();
    await page.getByRole('button', { name: en.learner.quest.continue.cta }).click();
    await expect(page.getByText(en.learner.quest.step.discover.pill, { exact: true })).toBeVisible();

    await discoverPageOf(page, 'jamo:ieung');
    expect(await hear(page, hearIt(page, 'jamo:ieung'))).toBe('이응');
    await expect(hearWithVowel(page, 'jamo:ieung')).toHaveCount(0);
    await expect(shown(page, 'discover-spoken-jamo:ieung')).toContainText('이응');
    // ㅁ on the same page: its name, then 마 on its second button.
    expect(await hear(page, hearIt(page, 'jamo:mieum'))).toBe('미음');
    expect(await hear(page, hearWithVowel(page, 'jamo:mieum'))).toBe('마');
    await expectNoLoneJamo(page);
  });

  test('Quest 1 Play and Check: every round says its target letter by name, and a miss on ㄴ reads 니은 · nieun', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await captureSpeech(page);
    await openQuestOneDiscover(page);
    await passDiscover(page);
    await page.getByRole('button', { name: en.learner.quest.launcher.game.play.cta }).click();
    await expect(roundPill(page, 1)).toBeVisible();
    await expect(shown(page, 'match-sound-tiles')).toBeVisible();
    const playFrom = await saidCount(page);

    const POOL = ['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ'];
    const targets: string[] = [];
    let missedOnNieun = false;
    for (let round = 1; round <= 6; round += 1) {
      await expect(roundPill(page, round)).toBeVisible();
      // The round says its prompt on open; the speaker says it again. The last thing said is this round's.
      const before = await saidCount(page);
      await shown(page, 'match-sound-speaker').click();
      const spoken = await nextSaid(page, before);
      // The voice names a letter of the pool, never its syllable (나) and never a lone jamo.
      const letter = LETTER_OF.get(spoken);
      expect(letter, `round ${round} said "${spoken}", which is no letter's name`).toBeDefined();
      expect(POOL).toContain(letter);
      // Every tile on screen is a letter of the pool, and only the named one is right.
      const tiles = shown(page, 'match-sound-tiles').locator('[data-testid^="match-sound-tile-"]');
      await expect(tiles).toHaveCount(4);
      const right = tiles.filter({ hasText: letter! });
      await expect(right).toHaveCount(1);

      if (letter === 'ㄴ' && !missedOnNieun) {
        // ㅏ is not heard in 니은: tapping it is a plain miss, with the amber nudge and Hoya naming the letter.
        const a = tiles.filter({ hasText: 'ㅏ' });
        await a.click();
        const bubble = shown(page, 'match-sound-bubble');
        await expect(bubble).toBeVisible();
        await expect(bubble).toContainText(en.learner.audio.listenAgainLetter);
        await expect(bubble).toContainText('니은');
        await expect(bubble).toContainText('nieun');
        await expect(bubble).not.toContainText(/나/u);
        // No red and no cross: the missed tile is drawn in amber, and only its letter and romanization are on it.
        const missColors = await drawnColors(a);
        expect(missColors).toContain(AMBER);
        expect(missColors).not.toContain(RED);
        expect(((await a.innerText()).replace(/\s+/g, ' ').trim())).toBe('ㅏ a');
        await shot(page, 'jamo-voice-match-sound-miss-nieun');
        // The miss replays the prompt: the name again.
        await expect.poll(async () => (await said(page)).at(-1)?.text).toBe('니은');
        missedOnNieun = true;
      }
      await right.click();
      targets.push(letter!);
      if (round < 6) await expect(roundPill(page, round + 1)).toBeVisible();
    }
    // The first pass of the pool holds every letter, so all four were asked, ㄴ among them.
    expect(new Set(targets)).toEqual(new Set(POOL));
    expect(missedOnNieun).toBe(true);
    // Everything Match Sound said is a name of the pool: 기역, 니은, 아, 어.
    const playSaid = (await said(page)).slice(playFrom).map((u) => u.text);
    expect(new Set(playSaid)).toEqual(new Set(['기역', '니은', '아', '어']));

    // On to the Check: Build a Letter is skipped; the Check's letter round (lp:sym ㅓ) says 어.
    await page.getByRole('button', { name: en.learner.quest.launcher.game.skip.cta }).click();
    await page.getByRole('button', { name: en.learner.quest.launcher.check.go.cta, exact: true }).click();
    await expect(page.getByText(en.learner.minigame.listenPick.heading)).toBeVisible();
    const beforeCheck = await saidCount(page);
    await shown(page, 'listen-pick-speaker').click();
    expect(await nextSaid(page, beforeCheck)).toBe('어');
    const eo = page.getByTestId('listen-pick-option-jamo:eo');
    await expect(async () => {
      await eo.click();
      await expect(eo).toHaveAttribute('aria-label', /^Right answer/, { timeout: 250 });
    }).toPass();
    await waitForNextListenPickRound(page);
    // The Check's word round says the word 너 (a sound question on a whole word).
    const beforeWord = await saidCount(page);
    await shown(page, 'listen-pick-speaker').click();
    expect(await nextSaid(page, beforeWord)).toBe('너');

    await expectNoLoneJamo(page);
    expect(errors).toEqual([]);
  });

  test('the Hangul Check: letter rounds say names, final rounds say closed syllables among syllable options', async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await captureSpeech(page);
    await stage1Learner(page);
    await page.getByText('Journey', { exact: true }).last().click();
    await page.getByTestId('journey-hangul-check').click();
    await expect(page.getByTestId('hangul-check-intro')).toBeVisible();
    await page.getByRole('button', { name: en.learner.stageReview.intro.start.cta }).click();

    const OPTIONS = '[data-testid^="listen-pick-option-"]';
    const lettersSaid = new Set<string>();
    const finalsSaid = new Set<string>();
    for (let part = 0; part < 5; part += 1) {
      for (let item = 0; item < 7; item += 1) {
        await expect(page.locator(OPTIONS).first()).toBeVisible();
        const before = await saidCount(page);
        await shown(page, 'listen-pick-speaker').click();
        const spoken = await nextSaid(page, before);
        const options = page.locator(OPTIONS);
        let right: Locator;
        const letter = LETTER_OF.get(spoken);
        if (letter !== undefined) {
          // A letter round: the name is said, and the options are letters.
          lettersSaid.add(letter);
          right = options.filter({ hasText: letter });
          for (const text of await options.allInnerTexts()) expect(text.split('\n')[0]!.trim()).toMatch(JAMO);
        } else if (FINAL_SYLLABLES.has(spoken)) {
          // A final round: the closed syllable is said, the options are whole syllables (one differs only in
          // its final), and the heading stays Listen & Pick's "which one did you hear", never "at the bottom".
          finalsSaid.add(spoken);
          right = page.getByTestId(`listen-pick-option-${spoken}`);
          for (const text of await options.allInnerTexts()) expect(text.split('\n')[0]!.trim()).toMatch(/^[가-힣]$/u);
          await expect(page.getByText(en.learner.minigame.listenPick.heading)).toBeVisible();
          await expect(page.getByText(en.learner.audio.heading.endsWith)).toHaveCount(0);
          if (finalsSaid.size === 1) await shot(page, 'jamo-voice-hangul-check-final');
        } else {
          // The part's word (a picture to pick): one of the five, said whole.
          const picture = WORD_PICTURES[spoken];
          expect(picture, `the Hangul Check said "${spoken}": no name, final syllable or word`).toBeDefined();
          right = page.getByTestId(`listen-pick-option-${picture}`);
        }
        await expect(right).toHaveCount(1);
        await expect(async () => {
          await right.click();
          await expect(right).toHaveAttribute('aria-label', /^Right answer/, { timeout: 250 });
        }).toPass();
        if (item < 6) await waitForNextListenPickRound(page);
      }
      if (part < 4) {
        await expect(page.getByTestId('hangul-check-pause')).toBeVisible();
        await page.getByRole('button', { name: en.learner.stageReview.pause.keepGoing.cta }).click();
      }
    }
    await expect(page.getByTestId('hangul-check-result')).toBeVisible();
    // All 24 initials and vowels were asked by name, all six finals by their closed syllable.
    expect([...lettersSaid].sort()).toEqual(Object.keys(NAME).sort());
    expect([...finalsSaid].sort()).toEqual([...FINAL_SYLLABLES].sort());
    await expectNoLoneJamo(page);
    expect(errors).toEqual([]);
  });

  test.describe('a lecture deck at 1280 x 720', () => {
    test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

    test('a letter slide says the name and then the sound, the quiz says names, and a final slide shows its finalLine and no name', async ({ page }) => {
      test.setTimeout(180_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await captureSpeech(page);
      await page.addInitScript(() => {
        // Start asks for fullscreen in its click; the request is only answered.
        Element.prototype.requestFullscreen = function requestFullscreen(): Promise<void> {
          return Promise.resolve();
        };
      });
      await page.goto(`/present#d=${encodeDeck(LETTER_DECK)}`);
      const start = page.getByTestId('presenter-start-button');
      await expect(start).toBeEnabled({ timeout: 10_000 });
      await start.click();
      await expect(page.getByTestId('presenter-stage')).toBeVisible();

      const done = { nieun: false, finalNieun: false, quizRounds: 0 };
      const seen = new Set<string>();
      for (let step = 0; step < 300; step += 1) {
        const st = await stageState(page);
        if (st.end) break;
        if (!seen.has(st.counter)) {
          seen.add(st.counter);
          if (st.glyph === 'ㄴ' && st.finalLine !== null) {
            // The final ㄴ: its finalLine ("ㄴ at the bottom: 안 · an"), no letter name, and its voice is 안.
            await revealUntil(page, st.counter, (s) => s.finalLine === 1);
            await expect(page.getByTestId('presenter-final-line')).toHaveText(en.learner.audio.finalLine('ㄴ', `${FINAL_SYLLABLE['ㄴ']} · an`));
            await expect(page.getByTestId('presenter-letter-name')).toHaveCount(0);
            await expect(page.getByTestId('presenter-letter-sound')).toHaveCount(0);
            const before = await saidCount(page);
            await page.keyboard.press('s');
            expect(await nextSaid(page, before)).toBe(FINAL_SYLLABLE['ㄴ']);
            await shot(page, 'jamo-voice-lecture-final-nieun-1280x720');
            done.finalNieun = true;
          } else if (st.glyph === 'ㄴ' && st.letterName !== null) {
            // The initial ㄴ: the letter-name line, the main speaker says 니은, the second speaker 나 (with "나 = ㄴ + ㅏ").
            await revealUntil(page, st.counter, (s) => s.letterName === 1);
            await expect(page.getByTestId('presenter-letter-name')).toHaveText(en.learner.presenter.slide.letterName('nieun', '니은'));
            await expect(page.getByTestId('presenter-stage')).toContainText('나 = ㄴ + ㅏ');
            const before = await saidCount(page);
            await page.keyboard.press('s');
            expect(await nextSaid(page, before)).toBe('니은');
            const beforeSound = await saidCount(page);
            await page.getByTestId('presenter-letter-sound').click();
            expect(await nextSaid(page, beforeSound)).toBe('나');
            await shot(page, 'jamo-voice-lecture-letter-nieun-1280x720');
            done.nieun = true;
          } else if (st.quizSpeaker) {
            // A sound quiz: what the speaker says, then the teacher's reveal marks the letter whose name that is.
            const before = await saidCount(page);
            await page.getByTestId('presenter-quiz-speaker').click();
            const spoken = await nextSaid(page, before);
            const revealed = await revealUntil(page, st.counter, (s) => s.marked !== null && s.answerShown);
            const answer = /[\u3131-\u318E\uAC00-\uD7A3]+/u.exec(revealed.marked ?? '')?.[0] ?? '';
            if (answer.length === 1 && JAMO.test(answer)) {
              if (revealed.question === en.learner.audio.heading.endsWith) expect(spoken, `the quiz asked for the final ${answer}`).toBe(FINAL_SYLLABLE[answer]);
              else expect(spoken, `the quiz asked for ${answer}`).toBe(NAME[answer]);
              done.quizRounds += 1;
            } else {
              // A syllable or a word option: it is said whole.
              expect(spoken).toBe(answer);
            }
          }
        }
        await page.keyboard.press('ArrowRight');
      }
      expect(done.nieun, 'the deck shows the ㄴ letter slide').toBe(true);
      expect(done.finalNieun, 'the deck shows the final ㄴ slide').toBe(true);
      expect(done.quizRounds, 'the deck asks letters by ear').toBeGreaterThan(0);
      await expectNoLoneJamo(page);
      expect(errors).toEqual([]);
    });
  });
});

/** Stage 1 / Letters / Quest 1 (ㅏ ㅓ ㄱ ㄴ, its Match Sound quiz) and Holidays / Quest 7 (the finals ㄴ and ㄹ). */
const LETTER_DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:jv4001',
  title: 'Letters and finals',
  createdAt: '2026-10-29T09:00:00Z',
  seed: 7,
  blocks: [
    { kind: 'quest', id: 'quest:stage1-letters-q1' },
    { kind: 'quest', id: 'quest:stage1-rites-q1' },
  ],
};

interface StageState {
  counter: string;
  end: boolean;
  glyph: string | null;
  /** The opacity a line is drawn with (a build not reached yet is 0), or null when the slide has none. */
  finalLine: number | null;
  letterName: number | null;
  quizSpeaker: boolean;
  question: string | null;
  /** The text of the option the reveal marks, or null before the reveal. */
  marked: string | null;
  answerShown: boolean;
}

/** One read of the stage: what the slide on screen shows and which of its builds are drawn. */
function stageState(page: Page): Promise<StageState> {
  return page.evaluate((endTitle) => {
    const q = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);
    const opacity = (el: Element | null): number | null => {
      if (el === null) return null;
      let o = 1;
      for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
      return o;
    };
    const marked = Array.from(document.querySelectorAll('[data-testid^="presenter-quiz-option-"]')).find((e) => e.querySelector('[data-testid="presenter-quiz-mark"]'));
    const stage = q('presenter-stage');
    return {
      counter: q('presenter-counter')?.textContent ?? '',
      end: (stage?.textContent ?? '').includes(endTitle),
      glyph: q('presenter-glyph')?.textContent?.trim() ?? null,
      finalLine: opacity(q('presenter-final-line')),
      letterName: opacity(q('presenter-letter-name')),
      quizSpeaker: q('presenter-quiz-speaker') !== null,
      question: q('presenter-quiz-question')?.textContent?.trim() ?? null,
      marked: marked?.textContent ?? null,
      answerShown: opacity(q('presenter-quiz-answer')) === 1,
    };
  }, en.learner.presenter.slide.end.title);
}

/** Steps through the builds of the slide `counter` names until `ready` holds (never past the slide). */
async function revealUntil(page: Page, counter: string, ready: (s: StageState) => boolean): Promise<StageState> {
  for (let build = 0; build < 8; build += 1) {
    expect((await stageState(page)).counter, 'the slide is still on screen').toBe(counter);
    const drawn = await expect
      .poll(async () => ready(await stageState(page)), { timeout: 1_000 })
      .toBe(true)
      .then(
        () => true,
        () => false,
      );
    if (drawn) return stageState(page);
    await page.keyboard.press('ArrowRight');
  }
  throw new Error(`slide ${counter} never showed the build it needs`);
}

const WORD_PICTURES: Readonly<Record<string, string>> = {
  한글: 'card:hangul-day',
  밥: 'card:rice',
  한복: 'card:hanbok',
  산: 'card:mountain',
  연: 'card:kite',
};

const AT = '2026-10-01T09:05:00.000Z';
const STAGE1_THEMES = ['letters', 'life', 'rites', 'nature', 'crafts'] as const;

/** A learner with all 15 Stage 1 quests done (the Hangul Check is open), on Home. */
async function stage1Learner(page: Page): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const profileId = (await readStored<string>(page, 'profiles:active')) as string;
  const progress: ProgressSnapshot = {
    profileId,
    updatedAt: AT,
    episodes: [],
    quests: STAGE1_THEMES.flatMap((theme) =>
      [1, 2, 3].map((n) => ({
        questId: `quest:stage1-${theme}-q${n}`,
        episodeId: `episode:stage1-${theme}`,
        startedAt: AT,
        completedAt: AT,
        stars: 2 as const,
        attempts: 1,
        accuracy: 0.8,
      })),
    ),
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  };
  await seedStored(page, `progress:${profileId}`, progress);
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}
