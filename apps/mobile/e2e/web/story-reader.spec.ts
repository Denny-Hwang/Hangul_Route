import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored, waitForSaved } from './helpers';

/**
 * F-STORY-002 PR 2.6a: the story reader on its replay route (`StoryReader`,
 * unscored, writes nothing). No shelf exists yet (F-STORY-004), so the reader
 * has no learner entry point: this suite opens it through the
 * `window.__hrStoryE2E` hook and reads fixture-specific content, both of which
 * exist only in the fixture bundle (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web story-reader
 *
 * The bundle carries `packages/content-schema/src/__fixtures__/story/valid.ready.json`
 * (`story:hangul-day`: five listen scenes, four read-along scenes) and the
 * `window.__hrStoryE2E` entry (navigation/story-e2e.tsx). In the production
 * build the suite is skipped; with STORY_FIXTURES=1 a missing entry fails.
 * Headless speech is the silent engine of ./fixtures: no voices, so the
 * device has no Korean voice, like CI's Linux Chromium.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const STORY = 'story:hangul-day';
const EMOJI = /\p{Extended_Pictographic}/u;

type E2eWindow = Window & {
  __hrStoryE2E?: {
    openReader(p: { storyId: string; level: string; sceneIndex?: number }): void;
    stories(): Array<{ id: string; levels: string[]; fixture: boolean; traditional: boolean }>;
    events(): Array<{ name: string; profileId?: string; payload?: Record<string, unknown> }>;
  };
  __silentSpeech?: string[];
};

async function onboard(page: Page): Promise<void> {
  await page.goto('/');
  // A touch phone held sideways (844x390) is asked to turn upright first (F-LAYOUT-001 PR 3).
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

/** Opens the replay route without waiting for a scene (the content-error fallback has none). */
async function navigateToReader(page: Page, level = 'listen', sceneIndex?: number, storyId = STORY): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  await page.evaluate(
    ([storyId, lvl, scene]) =>
      (window as E2eWindow).__hrStoryE2E?.openReader({
        storyId: storyId as string,
        level: lvl as string,
        ...(scene === null ? {} : { sceneIndex: scene as number }),
      }),
    [storyId, level, sceneIndex ?? null] as const,
  );
}

async function openReader(page: Page, level = 'listen', sceneIndex?: number, storyId = STORY): Promise<void> {
  await navigateToReader(page, level, sceneIndex, storyId);
  await expect(page.getByTestId('story-reader-next')).toBeVisible();
}

function storyEvents(page: Page): Promise<Array<{ name: string; profileId?: string; payload?: Record<string, unknown> }>> {
  return page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.events() ?? []);
}

/**
 * Runs `action` in the page, then samples the effective opacity of `testId` (its own times every
 * ancestor's) on each animation frame for `ms`, and returns the lowest seen.
 */
async function lowestOpacityAfter(page: Page, testId: string, action: 'next', ms = 450): Promise<number> {
  return page.evaluate(
    async ([id, act, span]) => {
      const target = document.querySelector(`[data-testid="${id}"]`);
      const button = document.querySelector(`[data-testid="story-reader-${act}"]`) as HTMLElement | null;
      if (!target || !button) return -1;
      const effective = (): number => {
        let o = 1;
        for (let el: Element | null = target; el; el = el.parentElement) o *= Number(getComputedStyle(el).opacity);
        return o;
      };
      button.click();
      let lowest = effective();
      const t0 = performance.now();
      while (performance.now() - t0 < (span as number)) {
        await new Promise((r) => requestAnimationFrame(r));
        lowest = Math.min(lowest, effective());
      }
      return lowest;
    },
    [testId, action, ms] as const,
  );
}

const position = (page: Page): Locator => page.getByTestId('story-reader-position');
const BRAND = 'rgb(178, 73, 21)'; // colors.brand.primary: a filled dot

/** Filled dots of the fill-only meter (Progress dots carry no aria-valuenow on react-native-web). */
function filledDots(page: Page): Promise<number> {
  return page
    .getByTestId('story-reader-dots')
    // The dots are hidden from screen readers (the labelled page number speaks instead).
    .getByRole('progressbar', { includeHidden: true })
    .evaluate((bar, brand) => Array.from(bar.children).filter((d) => getComputedStyle(d).backgroundColor === brand).length, BRAND);
}
const next = (page: Page): Locator => page.getByTestId('story-reader-next');
const back = (page: Page): Locator => page.getByTestId('story-reader-back');

async function profileId(page: Page): Promise<string> {
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored');
  return id;
}

async function fullyVisible(page: Page, target: Locator): Promise<boolean> {
  const vp = page.viewportSize();
  const box = await target.boundingBox();
  if (!vp || !box) return false;
  return box.y >= 0 && box.x >= 0 && box.y + box.height <= vp.height + 0.5 && box.x + box.width <= vp.width + 0.5;
}

test.describe('story reader, replay route (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('reads the listen tier scene by scene: page number, fill-only dots, Back, Finish, end page, Done', async ({ page }) => {
    await onboard(page);
    await openReader(page);

    // Scene 1: position, meter, Back disabled, picture, narration with its inline term, Korean block.
    await expect(position(page)).toHaveText('1 / 5');
    // A screen reader hears "Scene 1 of 5", not "one slash five".
    await expect(page.getByRole('group', { name: 'Scene 1 of 5' })).toBeVisible();
    await expect.poll(() => filledDots(page)).toBe(1);
    await expect(back(page)).toBeDisabled();
    await expect(next(page)).toBeEnabled();
    await expect(next(page)).toHaveText('Next');
    await expect(page.getByRole('img', { name: 'King Sejong sits in a palace hall while Hoya waves.' })).toBeVisible();
    await expect(page.getByTestId('story-reader-narration-text')).toContainText('Long ago, King');
    await expect(page.getByTestId('story-reader-narration-text')).toContainText('wanted everyone to learn to read.');
    await expect(page.getByRole('button', { name: 'Korean word sejong, King Sejong. Double tap to hear.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Korean: 세종, Sejong, King Sejong the Great' })).toBeAttached();
    // The Korean block has its own 64 dp speaker (§3.3 item 4).
    await expect(page.getByTestId('story-reader-hear-korean')).toHaveAccessibleName('Hear the Korean');
    // Sources (PR 2.7) sits at the end of the top bar; story-reader-sources.spec.ts covers the screen.
    await expect(page.getByTestId('story-reader-sources')).toBeVisible();

    // Next and Back: the page number goes down, the dots never do (D3).
    await next(page).click();
    await expect(position(page)).toHaveText('2 / 5');
    await expect.poll(() => filledDots(page)).toBe(2);
    await back(page).click();
    await expect(position(page)).toHaveText('1 / 5');
    await expect.poll(() => filledDots(page)).toBe(2);

    // Keyboard: Right / Left arrows turn the page.
    await page.keyboard.press('ArrowRight');
    await expect(position(page)).toHaveText('2 / 5');
    await page.keyboard.press('ArrowLeft');
    await expect(position(page)).toHaveText('1 / 5');

    for (const n of [2, 3, 4, 5]) {
      await next(page).click();
      await expect(position(page)).toHaveText(`${n} / 5`);
    }
    // Scene 5: authored words are chips, the whole-line gloss stays beneath; Next reads Finish.
    await expect(next(page)).toHaveText('Finish');
    await expect(page.getByTestId('story-reader-word-0')).toBeAttached();
    await expect(page.getByTestId('story-reader-word-1')).toBeAttached();
    await expect(page.getByTestId('story-reader-line-gloss')).toHaveText('Happy Hangul Day');

    // No raw tokens and no emoji anywhere in the reader.
    const shown = await page.getByTestId('story-reader').innerText();
    expect(shown).not.toContain('{kw:');
    expect(shown).not.toMatch(EMOJI);

    await next(page).click();
    await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
    await expect(page.getByTestId('story-reader-end-primary')).toHaveText('Done');
    await expect(page.getByTestId('story-reader-read-again')).toBeVisible();
    await expect(page.getByTestId('story-reader-end-sources')).toBeVisible();
    await expect(page.getByTestId('story-reader-bottom-bar')).toHaveCount(0);

    // Read again starts over; the meter stays full.
    await page.getByTestId('story-reader-read-again').click();
    await expect(position(page)).toHaveText('1 / 5');
    await expect.poll(() => filledDots(page)).toBe(5);

    for (let i = 0; i < 5; i += 1) await next(page).click();
    await page.getByTestId('story-reader-end-primary').click();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await expect(page.getByTestId('story-reader')).toHaveCount(0);
  });

  test('Close returns at once, with no confirmation and nothing written', async ({ page }) => {
    await onboard(page);
    const id = await profileId(page);
    await openReader(page, 'listen', 2);
    await expect(position(page)).toHaveText('3 / 5');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    // Replay writes no bookmark and no progress.
    expect(await readStored(page, `story:bookmarks:${id}`)).toBeNull();
  });

  test('a term chip opens the gloss card under the narration; tap again or Escape closes it', async ({ page }) => {
    await onboard(page);
    await openReader(page);
    const chip = page.getByTestId('story-reader-term-sejong');
    await chip.click();
    const gloss = page.getByTestId('story-reader-gloss');
    await expect(gloss).toBeVisible();
    // Inline under the narration, scrolled into view (wireframe C), never a floating popover.
    await expect(gloss).toBeInViewport();
    await expect(gloss).toContainText('세종');
    await expect(gloss).toContainText('sejong');
    await expect(gloss).toContainText('King Sejong');
    // The gloss card has its speaker (§3.5).
    await expect(page.getByTestId('story-reader-gloss-hear')).toHaveAccessibleName('Hear sejong');
    await page.keyboard.press('Escape');
    await expect(gloss).toHaveCount(0);
    await chip.click();
    await expect(gloss).toBeVisible();
    await chip.click();
    await expect(gloss).toHaveCount(0);
    // A word of the Korean line opens the same card.
    for (let i = 0; i < 4; i += 1) await next(page).click();
    await page.getByTestId('story-reader-word-1').click();
    await expect(gloss).toContainText('congratulations');
    // Moving scene closes it.
    await back(page).click();
    await expect(gloss).toHaveCount(0);
  });

  test('hide-until-tap: romanization shows after a tap and stays for the scene; the gloss is never hidden', async ({ page }) => {
    await onboard(page);
    const id = await profileId(page);
    await seedStored(page, `settings:${id}`, { romanizationMode: 'tap' });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await openReader(page);

    const chip = page.getByTestId('story-reader-term-sejong');
    await expect(chip).not.toContainText('sejong');
    const block = page.getByTestId('story-reader-korean');
    const lines = async (): Promise<string[]> => (await block.innerText()).split('\n').map((l) => l.trim());
    expect(await lines()).not.toContain('Sejong');
    expect(await lines()).toContain('King Sejong the Great');

    await chip.click();
    await expect(chip).toContainText('sejong');
    await block.click();
    await expect.poll(lines).toContain('Sejong');
    // The reveal lasts the scene only.
    await next(page).click();
    await expect(page.getByTestId('story-reader-term-hangeul')).not.toContainText('hangeul');
  });

  test('no Korean voice: the text fallback and Say it yourself show; Read to me reads the English and is saved', async ({ page }) => {
    await onboard(page);
    const id = await profileId(page);
    await openReader(page);

    await expect(page.getByTestId('story-reader-say-it')).toHaveText('Say it yourself');
    const prompt = page.getByTestId('story-reader-prompt');
    await expect(prompt).toContainText('No sound? Read it here.');
    await expect(prompt).toContainText('No Korean voice on this device.');
    // The Korean is already on screen: the panel does not draw it again.
    await expect(prompt.getByTestId('story-reader-prompt-text')).toHaveCount(0);

    // Hearing the scene reads the English only, and the no-voice state stays (§3.4, §3.14 row 7).
    await page.getByTestId('story-reader-hear-scene').click();
    await expect
      .poll(() => page.evaluate(() => (window as E2eWindow).__silentSpeech ?? []))
      .toContainEqual(expect.stringContaining('Long ago, King'));
    await page.waitForTimeout(500);
    await expect(page.getByTestId('story-reader-say-it')).toBeVisible();
    await expect(prompt).toContainText('No Korean voice on this device.');
    await expect(prompt.getByTestId('story-reader-prompt-help')).toBeVisible();

    const toggle = page.getByRole('switch', { name: 'Read to me' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await waitForSaved(page, [`settings:${id}`]);
    expect(await readStored(page, `settings:${id}`)).toEqual({ romanizationMode: 'always', readToMe: true });

    // The next scene reads itself once: the English narration, never Hangul (no Korean voice).
    // Forget what scene 1 asked (emptied in place: the silent engine keeps this array).
    await page.evaluate(() => {
      (window as E2eWindow).__silentSpeech?.splice(0);
    });
    await next(page).click();
    await expect
      .poll(() => page.evaluate(() => (window as E2eWindow).__silentSpeech ?? []))
      .toContainEqual(expect.stringContaining('About 600 years ago'));
    const asked = await page.evaluate(() => (window as E2eWindow).__silentSpeech ?? []);
    for (const text of asked) expect(text).not.toMatch(/[가-힣]/);
    expect(asked.filter((t) => t.trim() !== '').length).toBeGreaterThan(0);
    // Nothing ever turns the page.
    await page.waitForTimeout(1500);
    await expect(position(page)).toHaveText('2 / 5');
  });

  test('English voice only: hearing the scene keeps Say it yourself, the no-voice line and the help link', async ({ page }) => {
    // A device with an English voice and no Korean one (the silent engine has no voice at all, so its
    // English never plays): English utterances end normally, so an English-only play succeeds.
    await page.addInitScript(() => {
      const log: string[] = [];
      (window as Window & { __englishOnly?: string[] }).__englishOnly = log;
      const samantha = { name: 'Samantha', lang: 'en-US', voiceURI: 'Samantha', localService: true, default: true };
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
            if (u.volume !== 0) log.push(u.text);
            setTimeout(() => {
              u.onstart?.();
              u.onend?.();
            }, 0);
          },
          cancel: () => undefined,
          getVoices: () => [samantha],
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        },
      });
    });
    await onboard(page);
    await openReader(page);
    const prompt = page.getByTestId('story-reader-prompt');
    await expect(page.getByTestId('story-reader-say-it')).toBeVisible();
    await expect(prompt).toContainText('No Korean voice on this device.');

    await page.getByTestId('story-reader-hear-scene').click();
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __englishOnly?: string[] }).__englishOnly ?? []))
      .toContainEqual(expect.stringContaining('wanted everyone to learn to read.'));
    // The English chain has ended (played); the Korean could still not play, so nothing hides (§3.14 row 7).
    await page.waitForTimeout(500);
    await expect(page.getByTestId('story-reader-say-it')).toBeVisible();
    await expect(prompt).toContainText('No Korean voice on this device.');
    await expect(prompt.getByTestId('story-reader-prompt-help')).toBeVisible();
  });

  test('sound off: text only, and the panel offers Turn sound on', async ({ page }) => {
    await onboard(page);
    await seedStored(page, 'device:audio', { muted: true });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await openReader(page);
    const prompt = page.getByTestId('story-reader-prompt');
    await expect(prompt).toContainText('Sound is off.');
    await page.getByTestId('story-reader-hear-scene').click();
    // Only the silent first-gesture unlock utterance, never a line, even after the chain had time to run.
    await page.waitForTimeout(800);
    const asked = await page.evaluate(() => (window as E2eWindow).__silentSpeech ?? []);
    expect(asked.filter((t) => t.trim() !== '')).toEqual([]);
    await prompt.getByRole('button', { name: 'Turn sound on' }).click();
    await expect.poll(() => readStored(page, 'device:audio')).toEqual({ muted: false });
  });

  test('read-along: the Korean line comes first, then the narration "In English"', async ({ page }) => {
    await onboard(page);
    await openReader(page, 'read-along');
    await expect(position(page)).toHaveText('1 / 4');
    const korean = page.getByTestId('story-reader-korean');
    const narration = page.getByTestId('story-reader-narration');
    await expect(korean).toContainText('세종은 한글을 만들었어요');
    await expect(korean).toContainText('sejongeun hangeureul mandeureosseoyo');
    await expect(page.getByText('In English')).toBeVisible();
    const k = await korean.boundingBox();
    const n = await narration.boundingBox();
    expect(k && n && k.y < n.y).toBe(true);
  });

  test('a page turn fades the scene in; with reduced motion it turns instantly', async ({ page }) => {
    await onboard(page);
    await openReader(page);
    // The opening shows at once (it is not a page turn).
    expect(await page.getByTestId('story-reader-body').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    // Control: without reduced motion the body fades (so the check below can fail).
    expect(await lowestOpacityAfter(page, 'story-reader-narration', 'next')).toBeLessThan(0.9);
    await expect(position(page)).toHaveText('2 / 5');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await openReader(page);
    // The opening never fades; give the reduced-motion setting its moment to load after mount.
    await page.waitForTimeout(300);
    expect(await lowestOpacityAfter(page, 'story-reader-narration', 'next')).toBe(1);
    await expect(position(page)).toHaveText('2 / 5');
  });

  test('story.read.finished fires once per mount on the end page, with ids and counts only', async ({ page }) => {
    await onboard(page);
    const id = await profileId(page);
    await openReader(page);
    for (let i = 0; i < 5; i += 1) await next(page).click();
    await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
    // Read again and finish a second time: still one event for this mount.
    await page.getByTestId('story-reader-read-again').click();
    for (let i = 0; i < 5; i += 1) await next(page).click();
    await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
    await page.getByTestId('story-reader-end-primary').click();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    expect(await storyEvents(page)).toEqual([
      {
        name: 'story.read.finished',
        profileId: id,
        payload: { storyId: STORY, level: 'listen', mode: 'replay', scenes: 5, scenesSeen: 5, linesPlayed: 0, termsOpened: 0 },
      },
    ]);

    // A new mount opened on scene 4 counts only the scenes it showed (4 and 5); a gloss card counts.
    await openReader(page, 'listen', 3);
    await page.getByTestId('story-reader-term-hangeullal').click();
    await expect(page.getByTestId('story-reader-gloss')).toBeVisible();
    await next(page).click();
    await next(page).click();
    await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
    const events = await storyEvents(page);
    expect(events).toHaveLength(2);
    expect(events[1]?.payload).toEqual({ storyId: STORY, level: 'listen', mode: 'replay', scenes: 5, scenesSeen: 2, linesPlayed: 0, termsOpened: 1 });
  });

  test('a story that cannot open shows one line and Back; replay has no Continue', async ({ page }) => {
    await onboard(page);
    await navigateToReader(page, 'listen', undefined, 'story:does-not-exist');
    const fallback = page.getByTestId('story-reader-unavailable');
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText('This story is not ready to read yet.');
    await expect(page.getByTestId('story-reader-continue')).toHaveCount(0);
    await expect(page.getByTestId('story-reader-next')).toHaveCount(0);
    await page.getByTestId('story-reader-fallback-back').click();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await expect(page.getByTestId('story-reader')).toHaveCount(0);
  });

  test('page keys do nothing behind the voice-help sheet', async ({ page }) => {
    await onboard(page);
    await openReader(page);
    await page.getByTestId('story-reader-prompt-help').click();
    await expect(page.getByTestId('voice-help-sheet')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await expect(position(page)).toHaveText('1 / 5');
    await page.getByTestId('voice-help-sheet-ok').click();
    await expect(page.getByTestId('voice-help-sheet')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(position(page)).toHaveText('2 / 5');
  });

  test('320x568: every scene opens at the top of its text', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await onboard(page);
    await openReader(page);
    const scroll = page.getByTestId('story-reader-scroll');
    // Scroll the text down, as a learner reading on a small phone does.
    await scroll.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await next(page).click();
    await expect(position(page)).toHaveText('2 / 5');
    await expect.poll(() => scroll.evaluate((el) => el.scrollTop)).toBe(0);
    const top = await scroll.boundingBox();
    const narration = await page.getByTestId('story-reader-narration').boundingBox();
    expect(top && narration && narration.y >= top.y - 0.5).toBe(true);
    // Focus moved to the narration without scrolling the text.
    await expect(page.getByTestId('story-reader-narration')).toBeFocused();
    expect(await scroll.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('320x568 read-along: after a page turn the Korean line above the narration is in view', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await onboard(page);
    await openReader(page, 'read-along');
    const scroll = page.getByTestId('story-reader-scroll');
    await scroll.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await next(page).click();
    await expect(position(page)).toHaveText('2 / 4');
    await expect(page.getByTestId('story-reader-narration')).toBeFocused();
    const box = await scroll.boundingBox();
    const korean = await page.getByTestId('story-reader-korean').boundingBox();
    expect(box && korean && korean.y >= box.y - 0.5 && korean.y < box.y + box.height).toBe(true);
  });

  test('every bundled story reads through to its end page on every tier, with no raw token or emoji', async ({ page }) => {
    test.setTimeout(240_000);
    await onboard(page);
    await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E));
    const stories = await page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.stories() ?? []);
    expect(stories.some((s) => s.fixture)).toBe(true);
    for (const story of stories) {
      for (const level of story.levels) {
        await openReader(page, level, undefined, story.id);
        await expect(page.getByTestId('story-reader-unavailable')).toHaveCount(0);
        // Traditional tales say so under the picture on every scene (F-STORY-001 §3.5 T4).
        await expect(page.getByTestId('story-reader-traditional')).toHaveCount(story.traditional ? 1 : 0);
        const total = Number((await position(page).innerText()).split('/')[1]);
        expect(total, `${story.id} ${level}`).toBeGreaterThanOrEqual(4);
        for (let n = 1; n <= total; n += 1) {
          await expect(position(page)).toHaveText(`${n} / ${total}`);
          const shown = await page.getByTestId('story-reader').innerText();
          expect(shown, `${story.id} ${level} scene ${n}`).not.toContain('{kw:');
          expect(shown, `${story.id} ${level} scene ${n}`).not.toMatch(EMOJI);
          await next(page).click();
        }
        await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
        await page.getByTestId('story-reader-end-primary').click();
        await expect(page.getByText('Hi, Dami!')).toBeVisible();
      }
    }
  });

  for (const vp of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 844, height: 390 },
    { width: 1180, height: 820 },
  ]) {
    test(`${vp.width}x${vp.height}: Next and the top bar stay on screen, no sideways scroll`, async ({ page }) => {
      await page.setViewportSize(vp);
      await onboard(page);
      await openReader(page);
      await expect.poll(() => fullyVisible(page, next(page))).toBe(true);
      expect(await fullyVisible(page, page.getByRole('button', { name: 'Close' }))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const art = await page.getByTestId('story-reader-art').boundingBox();
      const narration = await page.getByTestId('story-reader-narration').boundingBox();
      expect(art && narration).toBeTruthy();
      if (!art || !narration) return;
      if (vp.width > vp.height && vp.width >= 700) {
        // Side by side (§3.3, F-LAYOUT-001 LD2): art left, text right.
        expect(art.x + art.width).toBeLessThanOrEqual(narration.x);
        expect(art.width).toBeLessThanOrEqual(vp.width * 0.55);
        // The controls stay put on a page turn; only the art and the text fade (§3.10).
        expect(await lowestOpacityAfter(page, 'story-reader-bottom-bar', 'next')).toBe(1);
      } else {
        expect(art.y + art.height).toBeLessThanOrEqual(narration.y);
      }
    });
  }
});
