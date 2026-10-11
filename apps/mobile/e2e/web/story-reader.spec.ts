import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeChildForm, readStored, seedStored, waitForSaved } from './helpers';

/**
 * F-STORY-002 PR 2.6a: the story reader on its replay route (`StoryReader`,
 * unscored, writes nothing). No story is ready and no shelf exists yet, so this
 * runs against the fixture bundle only:
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
  __hrStoryE2E?: { openReader(p: { storyId: string; level: string; sceneIndex?: number }): void };
  __silentSpeech?: string[];
};

async function onboard(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
}

async function openReader(page: Page, level = 'listen', sceneIndex?: number): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
  await page.evaluate(
    ([storyId, lvl, scene]) =>
      (window as E2eWindow).__hrStoryE2E?.openReader({
        storyId: storyId as string,
        level: lvl as string,
        ...(scene === null ? {} : { sceneIndex: scene as number }),
      }),
    [STORY, level, sceneIndex ?? null] as const,
  );
  await expect(page.getByTestId('story-reader-next')).toBeVisible();
}

const position = (page: Page): Locator => page.getByTestId('story-reader-position');
const BRAND = 'rgb(178, 73, 21)'; // colors.brand.primary: a filled dot

/** Filled dots of the fill-only meter (Progress dots carry no aria-valuenow on react-native-web). */
function filledDots(page: Page): Promise<number> {
  return page
    .getByTestId('story-reader-dots')
    .getByRole('progressbar')
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
    await expect.poll(() => filledDots(page)).toBe(1);
    await expect(back(page)).toBeDisabled();
    await expect(next(page)).toBeEnabled();
    await expect(next(page)).toHaveText('Next');
    await expect(page.getByRole('img', { name: 'King Sejong sits in a palace hall while Hoya waves.' })).toBeVisible();
    await expect(page.getByTestId('story-reader-narration-text')).toContainText('Long ago, King');
    await expect(page.getByTestId('story-reader-narration-text')).toContainText('wanted everyone to learn to read.');
    await expect(page.getByRole('button', { name: 'Korean word sejong, King Sejong. Double tap to hear.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Korean: 세종, Sejong, King Sejong the Great' })).toBeAttached();
    // Sources arrives with PR 2.7: no button yet.
    await expect(page.getByTestId('story-reader-sources')).toHaveCount(0);

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
    await expect(page.getByTestId('story-reader-end-sources')).toHaveCount(0);
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

    const toggle = page.getByRole('switch', { name: 'Read to me' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await waitForSaved(page, [`settings:${id}`]);
    expect(await readStored(page, `settings:${id}`)).toEqual({ romanizationMode: 'always', readToMe: true });

    // The next scene reads itself once: the English narration, never Hangul (no Korean voice).
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

  test('sound off: text only, and the panel offers Turn sound on', async ({ page }) => {
    await onboard(page);
    await seedStored(page, 'device:audio', { muted: true });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await openReader(page);
    const prompt = page.getByTestId('story-reader-prompt');
    await expect(prompt).toContainText('Sound is off.');
    await page.getByTestId('story-reader-hear-scene').click();
    // Only the silent first-gesture unlock utterance, never a line.
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

  test('reduced motion: the page turns instantly', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await onboard(page);
    await openReader(page);
    await next(page).click();
    await expect(position(page)).toHaveText('2 / 5');
    const opacity = await page.getByTestId('story-reader-body').evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');
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
      } else {
        expect(art.y + art.height).toBeLessThanOrEqual(narration.y);
      }
    });
  }
});
