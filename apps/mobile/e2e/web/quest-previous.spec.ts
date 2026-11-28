import type { Locator, Page } from '@playwright/test';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { getMessages } from '@hangul-route/i18n';
import { expect, test } from './fixtures';
import {
  QUEST_ONE_BLOCKS,
  completeChildForm,
  headerClose,
  jamoOfSpoken,
  onboardSelf,
  openLettersEpisode,
  passDiscover,
  seedStored,
  waitForNextListenPickRound,
  waitForSavedRunStep,
} from './helpers';
import { shot } from './shots';
import { closeInstallGuide, expectTextFits } from './text-fit';

/**
 * [QB] AMENDMENTS-QUEST-SOUND-BACK rows QB-1 to QB-4 on the web PWA: a quest step can be taken back.
 *
 * Quest 1 of Meet the Letters (intro, Look and learn, Match Sound, Build a Letter, the Check, the finish page):
 * - Previous inside Look and learn, from its first page back to the intro, and forward again (QB-1, QB-2);
 * - a game step shown again has Continue and Play again and no Skip for now, and a game played again, badly, leaves
 *   the result's stars as they were (QB-2, QB-3);
 * - a reload after going back resumes at the furthest step (QB-4), and the browser's back still asks the leave
 *   question: Previous is the quest's own move, never the navigation's back;
 * - at 320 x 568 with the text size at Largest the row wraps, main button first, and nothing is cut.
 */
const en = getMessages('en');
const QUEST = 'quest:stage1-letters-q1';
const PREVIOUS = en.learner.quest.previous.cta;
const AGAIN = en.learner.quest.launcher.again.cta;

type SpeechWindow = Window & { __spoken?: string[] };

/** Headless Chromium has no Korean voice: one ko-KR voice that ends each utterance at once and keeps what was said. */
async function stubVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as SpeechWindow).__spoken = spoken;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        speak: (u: SpeechSynthesisUtterance) => {
          if (u.volume !== 0) spoken.push(u.text);
          setTimeout(() => {
            u.onstart?.call(u, new Event('start') as SpeechSynthesisEvent);
            u.onend?.call(u, new Event('end') as SpeechSynthesisEvent);
          }, 0);
        },
        cancel: () => undefined,
        getVoices: () => [{ name: 'Yuna', lang: 'ko-KR', voiceURI: 'Yuna', localService: true, default: true }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}

const spokenCount = (page: Page): Promise<number> => page.evaluate(() => (window as SpeechWindow).__spoken?.length ?? 0);
const button = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true }).filter({ visible: true });
const previous = (page: Page): Locator => page.getByTestId('quest-previous').filter({ visible: true });
const stepDots = (page: Page): Locator => page.getByTestId('quest-step-dots').filter({ visible: true });
const pageDots = (page: Page): Locator => page.getByTestId('discover-page-dots').filter({ visible: true });
/** Discover's trace page, "Trace the new letters" ([TC] TC-1b): its first letter's heading, after the lazy pad is in. */
const tracePage = (page: Page): Locator => page.getByTestId('discover-write-heading').filter({ visible: true });

/** Onboard a child and pass the intro: quest 1 is on Look and learn, page 1. */
async function openDiscover(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await button(page, 'Continue').click();
  await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();
}

async function pagesOf(page: Page): Promise<number> {
  const text = await page.getByText(/^Page \d+ of \d+$/).first().innerText();
  return Number(/of (\d+)$/.exec(text)?.[1] ?? '1');
}

/**
 * Match Sound from its launcher (`open` is the launcher's button). Every round is answered right in the end; with
 * `missFirst` each round's first tap is a wrong tile, so every round is a first-try miss.
 */
async function playMatchSound(page: Page, open: string, rounds: number, missFirst = false): Promise<void> {
  let heard = await spokenCount(page);
  await button(page, open).click();
  for (let round = 1; round <= rounds; round += 1) {
    await expect(page.getByText(`${round} / ${rounds}`, { exact: true }).filter({ visible: true })).toBeVisible();
    await page.waitForFunction((n) => ((window as SpeechWindow).__spoken?.length ?? 0) > n, heard);
    const prompt = jamoOfSpoken(await page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1) ?? ''));
    heard = await spokenCount(page);
    const tiles = page.getByRole('button', { name: /^Korean letter / }).filter({ visible: true });
    if (missFirst) {
      const wrong = tiles.filter({ hasNotText: prompt }).first();
      await wrong.click();
      // The missed tile locks; the game says the prompt once more (800 ms) and the board's answer lock passes.
      // Locked, named "Not this one: …" and not disabled (F-A11Y-001 AF-4a).
      await expect(page.getByRole('button', { name: /^Not this one: / })).toHaveCount(1);
      await page.waitForTimeout(1000);
      heard = await spokenCount(page);
    }
    await tiles.filter({ hasText: prompt }).click();
  }
}

/** Build a Letter from its launcher, every block right on the first try, up to the Check's launcher. */
async function playBuildLetter(page: Page): Promise<void> {
  await button(page, 'Play minigame').click();
  await expect(page.getByText('Build this letter')).toBeVisible();
  for (const [syllable, tiles] of QUEST_ONE_BLOCKS) {
    await expect(page.getByTestId('build-letter-speaker')).toContainText(syllable);
    for (const name of tiles) await page.getByRole('button', { name, exact: true }).click();
  }
  await expect(button(page, 'Go')).toBeVisible();
}

/** The two-question Check answered right first time: the speaker, then the option for what was said. */
async function answerCheck(page: Page): Promise<void> {
  await button(page, 'Go').click();
  for (let round = 1; round <= 2; round += 1) {
    const heard = await spokenCount(page);
    await page.getByTestId('listen-pick-speaker').click();
    await page.waitForFunction((n) => ((window as SpeechWindow).__spoken?.length ?? 0) > n, heard);
    const said = await page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1) ?? '');
    const options = page.locator('[data-testid^="listen-pick-option-"]');
    const word = options.filter({ hasText: said });
    await ((await word.count()) === 1 ? word : options.filter({ hasText: jamoOfSpoken(said) })).click();
    if (round === 1) await waitForNextListenPickRound(page);
  }
}

/** The saved run of quest 1 as stored, or null. */
function savedRun(page: Page): Promise<{ stepIndex?: number; skippedSteps?: number[] } | null> {
  return page.evaluate(
    (quest) =>
      new Promise<{ stepIndex?: number; skippedSteps?: number[] } | null>((resolve) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('keyval').objectStore('keyval').openCursor();
          let found: { stepIndex?: number; skippedSteps?: number[] } | null = null;
          all.onerror = () => resolve(null);
          all.onsuccess = () => {
            const cursor = all.result;
            if (!cursor) {
              db.close();
              return resolve(found);
            }
            if (String(cursor.key).startsWith('hr:quest-run:') && typeof cursor.value === 'string') {
              try {
                const run = JSON.parse(cursor.value) as { questId?: string; stepIndex?: number; skippedSteps?: number[] } | null;
                if (run?.questId === quest) found = run;
              } catch {
                // Not a run this spec can read.
              }
            }
            cursor.continue();
          };
        };
      }),
    QUEST,
  );
}

const box = async (target: Locator): Promise<{ x: number; y: number; width: number; height: number }> => (await target.boundingBox())!;

test.describe('[QB] a quest step can be taken back', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Previous inside Look and learn, back to the intro, and forward again', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await stubVoice(page);
    await openDiscover(page);
    const pages = await pagesOf(page);
    expect(pages).toBeGreaterThanOrEqual(2);

    // Page 2: Previous beside Continue, on one line, Previous on the left, the main button wider.
    await button(page, 'Continue').click();
    await expect(page.getByText(`Page 2 of ${pages}`, { exact: true })).toBeVisible();
    await expect(previous(page)).toHaveAccessibleName(PREVIOUS);
    const prev = await box(previous(page));
    const next = await box(page.getByTestId('discover-continue').filter({ visible: true }));
    expect(Math.abs(prev.y - next.y)).toBeLessThan(2);
    expect(prev.x).toBeLessThan(next.x);
    expect(next.width).toBeGreaterThan(prev.width);
    expect(prev.height).toBeGreaterThanOrEqual(touchTarget.min);
    expect(next.height).toBeGreaterThanOrEqual(touchTarget.min);
    await shot(page, 'qb-look-and-learn-page2-390x844');

    // Previous shows page 1; the dots keep page 2 and ring page 1.
    await previous(page).click();
    await expect(page.getByText(`Page 1 of ${pages}`, { exact: true })).toBeVisible();
    await expect(pageDots(page)).toHaveAttribute('aria-valuenow', '2');
    await expect(pageDots(page)).toHaveAttribute('aria-valuetext', `Page 1 of ${pages}`);
    await expect(page.getByTestId('discover-page-dots-current').filter({ visible: true })).toHaveCount(1);
    await shot(page, 'qb-look-and-learn-page1-after-previous-390x844');

    // On page 1 Previous is the step's: the intro, as it was, with no Previous of its own.
    await previous(page).click();
    await expect(page.getByText('Look and learn', { exact: true })).toHaveCount(0);
    await expect(page.getByText(en.learner.quest.step.intro.pill, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(previous(page)).toHaveCount(0);
    await expect(stepDots(page)).toHaveAttribute('aria-valuenow', '2');
    await expect(stepDots(page)).toHaveAttribute('aria-valuetext', '1 of 6');
    // No leave question was asked on the way.
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    // Forward again: Look and learn from its first page, then on to the first game.
    await button(page, 'Continue').click();
    await expect(page.getByText(`Page 1 of ${pages}`, { exact: true })).toBeVisible();
    await passDiscover(page);
    await expect(button(page, 'Play minigame')).toBeVisible();

    // From the game's launcher, Previous opens Look and learn on its last page.
    await previous(page).click();
    await expect(page.getByText(`Page ${pages} of ${pages}`, { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a game shown again has Continue and Play again, no Skip for now; playing it again badly changes no star', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await stubVoice(page);
    await openDiscover(page);
    await passDiscover(page);

    // Match Sound, every round right on the first try; the next step is Build a Letter's launcher.
    await playMatchSound(page, 'Play minigame', 6);
    await expect(button(page, 'Skip for now')).toBeVisible();
    await expect(page.getByText(en.learner.quest.step.apply.pill, { exact: true }).filter({ visible: true })).toBeVisible();

    // Previous: Match Sound's launcher again, as a revisit.
    await previous(page).click();
    await expect(page.getByText(en.learner.quest.step.practice.pill, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(button(page, 'Continue')).toBeVisible();
    await expect(button(page, AGAIN)).toBeVisible();
    await expect(button(page, 'Skip for now')).toHaveCount(0);
    await expect(button(page, 'Play minigame')).toHaveCount(0);
    await expect(previous(page)).toBeVisible();
    await expect(stepDots(page)).toHaveAttribute('aria-valuenow', '4');
    await expect(page.getByTestId('quest-step-dots-current').filter({ visible: true })).toHaveCount(1);
    const prev = await box(previous(page));
    const main = await box(button(page, 'Continue'));
    const again = await box(button(page, AGAIN));
    expect(Math.abs(prev.y - main.y)).toBeLessThan(2);
    expect(prev.x).toBeLessThan(main.x);
    expect(again.y).toBeGreaterThan(main.y + main.height - 1);
    for (const b of [prev, main, again]) expect(b.height).toBeGreaterThanOrEqual(touchTarget.min);
    await shot(page, 'qb-launcher-revisit-390x844');

    // Play again, every round missed on its first tap. The game ends and the quest moves forward, as usual.
    await playMatchSound(page, AGAIN, 6, true);
    await expect(page.getByText(en.learner.quest.step.apply.pill, { exact: true }).filter({ visible: true })).toBeVisible();
    // The furthest step is a first visit: Play and Skip for now.
    await expect(button(page, 'Skip for now')).toBeVisible();

    // The rest right on the first try: the result is the first play's, three stars, whatever the replay did.
    await playBuildLetter(page);
    await answerCheck(page);
    await button(page, 'See results').click();
    await expect(page.getByLabel(en.a11y.stars(3), { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(previous(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a reload after going back resumes at the furthest step; the browser back still asks before leaving', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await onboardSelf(page, { name: 'Ana', startJourney: false });
    await page.goto('/');
    await expect(page.getByText('Hi, Ana!')).toBeVisible();
    await closeInstallGuide(page);
    await openLettersEpisode(page);
    await button(page, 'Start').first().click();
    await expect(headerClose(page)).toBeVisible();
    await expect(page.getByTestId('lesson-waiting')).toHaveCount(0);
    await button(page, 'Continue').click();
    await passDiscover(page);
    await button(page, 'Skip for now').click();
    await expect(page.getByText(en.learner.quest.step.apply.pill, { exact: true }).filter({ visible: true })).toBeVisible();
    await waitForSavedRunStep(page, QUEST, 3);

    // Two steps back: Look and learn, open on its last page, which in quest 1 is the trace page (its step pill hidden;
    // [TC] AMENDMENTS-STAGE1-TRACE-COVERAGE TC-1b section 3.3, "Coming back"). What is stored is still the furthest step,
    // with its skipped game.
    await previous(page).click();
    await previous(page).click();
    await expect(tracePage(page)).toBeVisible();
    await expect.poll(async () => (await savedRun(page))?.stepIndex).toBe(3);
    expect((await savedRun(page))?.skippedSteps).toEqual([2]);

    // The browser back is not Previous: it asks the leave question, and Keep playing stays on the step shown.
    await page.goBack();
    const sheet = page.getByRole('alertdialog');
    await expect(sheet).toContainText(en.learner.quest.leave.title);
    await sheet.getByRole('button').first().click();
    await expect(sheet).toHaveCount(0);
    await expect(tracePage(page)).toBeVisible();

    // A reload, then Start again: the quest goes on from the furthest step, not from the step shown before it.
    await page.goto('/');
    await closeInstallGuide(page);
    await openLettersEpisode(page);
    await button(page, 'Start').first().click();
    await expect(page.getByText(en.learner.quest.step.apply.pill, { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(button(page, 'Play minigame')).toBeVisible();
    await expect(page.getByText('Look and learn', { exact: true })).toHaveCount(0);
    // The game skipped before the reload is still a revisit behind it.
    await previous(page).click();
    await expect(button(page, AGAIN)).toBeVisible();
    await expect(button(page, 'Skip for now')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('[QB] Previous at 320 x 568 with the text size at Largest', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('the row wraps, main button first; both buttons keep 64 and nothing is cut', async ({ page }) => {
    await onboardSelf(page, { name: 'Rio', startJourney: false });
    await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
    await page.goto('/');
    await expect(page.getByText('Hi, Rio!')).toBeVisible();
    await closeInstallGuide(page);
    await openLettersEpisode(page);
    await button(page, 'Start').first().click();
    await button(page, 'Continue').click();
    await expect(page.getByText('Look and learn', { exact: true })).toBeVisible();

    /** The main button is the first line and Previous the second, each the full width of the row, 64 high or more. */
    const expectWrapped = async (main: Locator, where: string): Promise<void> => {
      await previous(page).scrollIntoViewIfNeeded();
      const m = await box(main);
      const p = await box(previous(page));
      expect(m.y + m.height, `${where}: main button first`).toBeLessThanOrEqual(p.y + 1);
      expect(Math.abs(m.width - p.width), `${where}: same width`).toBeLessThan(2);
      expect(m.height, `${where}: main height`).toBeGreaterThanOrEqual(touchTarget.min);
      expect(p.height, `${where}: Previous height`).toBeGreaterThanOrEqual(touchTarget.min);
      expect(p.x, `${where}: inside the window`).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width, `${where}: inside the window`).toBeLessThanOrEqual(320);
      await expectTextFits(page, where);
    };

    // A teaching step: Look and learn, page 1 of step 2.
    await expectWrapped(page.getByTestId('discover-continue').filter({ visible: true }), 'Look and learn with Previous');
    await shot(page, 'qb-look-and-learn-largest-320x568');

    // A game launcher shown again: Continue, Previous, then Play again.
    await passDiscover(page);
    await button(page, 'Skip for now').click();
    await previous(page).click();
    await expect(button(page, AGAIN)).toBeVisible();
    await expectWrapped(button(page, 'Continue'), 'a launcher shown again');
    const again = await box(button(page, AGAIN));
    expect(again.height).toBeGreaterThanOrEqual(touchTarget.min);
    expect(again.y).toBeGreaterThan((await box(previous(page))).y);
    await shot(page, 'qb-launcher-revisit-largest-320x568');
  });
});
