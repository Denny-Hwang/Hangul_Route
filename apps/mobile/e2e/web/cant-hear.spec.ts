import { devices, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { shot } from './shots';
import { jamoOfSpoken, onboardChild, passDiscover, readStored, seedStored } from './helpers';

/**
 * AMENDMENTS-AUDIO-CANT-HEAR row CH-1a, the e2e of section 6: Match Sound in quest 1 over an engine that has a Korean
 * voice and answers every utterance, so a play ends `played` and nothing is heard (the silent switch, a muted page).
 * The "Can't hear it?" link is there from the first frame; its sheet shows this device's one line (the user agent
 * decides on the web); Show the letters reaches the text prompt in two taps and the round is answered from it.
 */

type SpeechWindow = Window & { __utterances?: string[] };

/** A Korean voice that "plays" every utterance (the shipped adapter reports `played`). */
async function koreanVoiceThatPlays(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as SpeechWindow).__utterances = log;
    const yuna = { name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: false };
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
        getVoices: () => [yuna],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

const utterances = (page: Page): Promise<string[]> => page.evaluate(() => (window as SpeechWindow).__utterances ?? []);

async function openMatchSound(page: Page, prefs?: { muted: boolean; showLetters: boolean }): Promise<void> {
  await koreanVoiceThatPlays(page);
  if (prefs !== undefined) {
    await page.goto('/');
    await seedStored(page, 'device:audio', prefs);
  }
  await onboardChild(page, { name: 'Dami' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await passDiscover(page);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  await expect(page.getByText('1 / 6')).toBeVisible();
}

const link = (page: Page) => page.getByRole('button', { name: "Can't hear it?" });

const LINES = {
  apple: 'Turn off silent mode. Then turn the volume up.',
  android: 'Turn up the media volume with the volume buttons.',
  computer: 'Turn the volume up. Check that this page is not muted.',
} as const;

/** Link, sheet with one line, Show the letters (two taps), then the round is answered from the text. */
async function twoTapsToTheText(page: Page, line: string): Promise<void> {
  await expect(link(page)).toBeVisible();
  // The sound "played": no text, the listening heading.
  await expect(page.getByText('Tap the letter you hear')).toBeVisible();
  await expect(page.getByTestId('prompt-panel-text')).toHaveCount(0);

  await link(page).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText("Can't hear it?", { exact: true })).toBeVisible();
  await expect(sheet.getByTestId('cant-hear-line')).toHaveText(line);
  for (const other of Object.values(LINES).filter((l) => l !== line)) await expect(page.getByText(other)).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Hear it' })).toBeVisible();

  await sheet.getByRole('button', { name: 'Show the letters' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Tap the letter for this sound')).toBeVisible();
  await expect(page.getByText('No sound? Read it here.')).toBeVisible();
  await expect(link(page)).toHaveCount(0);
  await expect(page.getByTestId('match-sound-speaker')).toBeFocused();

  const label = (await page.getByTestId('prompt-panel-text').getAttribute('aria-label')) ?? '';
  const letter = jamoOfSpoken(label.split(',')[0]!.trim());
  await page.getByRole('button', { name: /^Korean letter / }).filter({ hasText: letter }).click();
  await expect(page.getByText('2 / 6')).toBeVisible();
  // The next round opens sound-only, with the link back.
  await expect(page.getByText('Tap the letter you hear')).toBeVisible();
  await expect(link(page)).toBeVisible();
}

test.describe('desktop Chromium: the computer line', () => {
  const desktop = devices['Desktop Chrome'];
  test.use({ userAgent: desktop.userAgent, viewport: desktop.viewport, hasTouch: false, isMobile: false, deviceScaleFactor: 1, locale: 'en-US' });

  test('Match Sound: the link, the computer line, and the text in two taps', async ({ page }) => {
    await openMatchSound(page);
    await twoTapsToTheText(page, LINES.computer);
  });

  test('Hear it plays the prompt once more and answers nothing; the close button leaves the round as it was', async ({ page }) => {
    await openMatchSound(page);
    await expect.poll(async () => (await utterances(page)).length).toBeGreaterThan(0);
    const before = (await utterances(page)).length;
    await link(page).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Hear it' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(async () => (await utterances(page)).length).toBe(before + 1);
    await expect(page.getByText('1 / 6')).toBeVisible();

    await link(page).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(link(page)).toBeFocused();
    await expect(page.getByText('Tap the letter you hear')).toBeVisible();
  });
});

test.describe('an iPhone user agent: the Apple line', () => {
  const iphone = devices['iPhone 13'];
  test.use({ userAgent: iphone.userAgent, viewport: iphone.viewport, hasTouch: true, isMobile: true, locale: 'en-US' });

  test('Match Sound: the Apple line, and the text in two taps', async ({ page }) => {
    await openMatchSound(page);
    await twoTapsToTheText(page, LINES.apple);
  });
});

test.describe('an Android phone (the project device): the Android line', () => {
  test('Match Sound: the Android line, and the text in two taps', async ({ page }) => {
    await openMatchSound(page);
    await twoTapsToTheText(page, LINES.android);
  });
});

test.describe('Always show the letters (CH-2)', () => {
  const desktop = devices['Desktop Chrome'];
  test.use({ userAgent: desktop.userAgent, viewport: desktop.viewport, hasTouch: false, isMobile: false, deviceScaleFactor: 1, locale: 'en-US' });

  const alwaysShow = (page: Page) => page.getByRole('switch', { name: 'Always show the letters' });

  test('Profile: a switch under Sound, off at first, saved with the mute, and the Sound switch says its state once', async ({ page }) => {
    await koreanVoiceThatPlays(page);
    await onboardChild(page, { name: 'Dami', startJourney: false });
    await page.goto('/');
    await page.getByRole('button', { name: 'Profile and settings' }).click();
    const sound = page.getByRole('switch', { name: 'Sound. Korean voice ready.' });
    await expect(sound).toHaveAttribute('aria-checked', 'true');
    await expect(alwaysShow(page)).toHaveAttribute('aria-checked', 'false');
    await expect(alwaysShow(page)).toContainText('Off');
    await alwaysShow(page).click();
    await expect(alwaysShow(page)).toHaveAttribute('aria-checked', 'true');
    await expect(alwaysShow(page)).toContainText('On');
    await expect.poll(() => readStored(page, 'device:audio')).toEqual({ muted: false, showLetters: true });
    // Turning the sound off keeps the other switch.
    await sound.click();
    await expect.poll(() => readStored(page, 'device:audio')).toEqual({ muted: true, showLetters: true });
    await expect(alwaysShow(page)).toHaveAttribute('aria-checked', 'true');
  });

  test('Match Sound opens with the letters up, no link, and the sound still plays; every round', async ({ page }) => {
    await openMatchSound(page, { muted: false, showLetters: true });
    await expect(page.getByText('Tap the letter for this sound')).toBeVisible();
    await expect(page.getByText('No sound? Read it here.')).toBeVisible();
    await expect(page.getByTestId('prompt-panel-text')).toBeVisible();
    await expect(link(page)).toHaveCount(0);
    await expect.poll(async () => (await utterances(page)).length).toBeGreaterThan(0);

    const label = (await page.getByTestId('prompt-panel-text').getAttribute('aria-label')) ?? '';
    const letter = jamoOfSpoken(label.split(',')[0]!.trim());
    await page.getByRole('button', { name: /^Korean letter / }).filter({ hasText: letter }).click();
    await expect(page.getByText('2 / 6')).toBeVisible();
    await expect(page.getByTestId('prompt-panel-text')).toBeVisible();
    await expect(link(page)).toHaveCount(0);
  });

  test('with the switch off the round is sound-only with the link, as before', async ({ page }) => {
    await openMatchSound(page, { muted: false, showLetters: false });
    await expect(page.getByText('Tap the letter you hear')).toBeVisible();
    await expect(page.getByTestId('prompt-panel-text')).toHaveCount(0);
    await expect(link(page)).toBeVisible();
  });
});

// AMENDMENTS-AUDIO-CANT-HEAR row CH-1d (OD-CH3): Discover's guidance-only link, once per page under the first card's buttons.
test.describe('Discover: the guidance-only link (CH-1d)', () => {
  for (const size of [
    { width: 320, height: 568 },
    { width: 360, height: 740 },
  ]) {
    test(`${size.width} x ${size.height}: one link on the page, a sheet with the line and Hear it only, Continue never waits for it`, async ({ page }) => {
      await page.setViewportSize(size);
      await koreanVoiceThatPlays(page);
      await onboardChild(page, { name: 'Dami' });
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
      await expect(page.getByText(/^Page 1 of \d+$/)).toBeVisible();

      // One link on the page, in the first card, after its Hear it button.
      await expect(link(page)).toHaveCount(1);
      await link(page).scrollIntoViewIfNeeded();
      const box = (await link(page).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(64 - 0.5);
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width + 0.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await shot(page, `ch-1d-discover-${size.width}x${size.height}`);

      // Continue is enabled at once; the link gates nothing.
      await expect(page.getByTestId('discover-continue')).toBeEnabled();

      await link(page).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByTestId('cant-hear-line')).toBeVisible();
      await expect(sheet.getByRole('button', { name: 'Show the letters' })).toHaveCount(0);
      await expect(sheet.getByRole('button', { name: 'Hear it' })).toBeVisible();
      await shot(page, `ch-1d-sheet-${size.width}x${size.height}`);

      // Hear it plays the page's first sound once, through the card's own Hear it.
      const before = (await utterances(page)).length;
      await sheet.getByRole('button', { name: 'Hear it' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect.poll(async () => (await utterances(page)).length).toBe(before + 1);
      await expect(link(page)).toBeFocused();

      // The next page has its own link.
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText(/^Page 2 of \d+$/)).toBeVisible();
      await expect(link(page)).toHaveCount(1);
    });
  }
});
