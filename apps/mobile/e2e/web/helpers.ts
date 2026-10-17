import { expect, type Locator, type Page } from '@playwright/test';
import { layoutClassFor } from '@hangul-route/design-system/layout';
import { isDeviceLandscape, isPhoneDevice } from '../../src/logic/layout/orientation-guard';

/**
 * Shared onboarding for the web e2e specs (F-LEARN-001 §5). Every spec that
 * needs a learner goes through the real "Who is learning?" form here, so a
 * change to that form is made in one place.
 */

/** The grown-up PIN every spec uses. */
export const E2E_PIN = '1234';

export type TigerLabel = 'Book Tiger' | 'Home Tiger' | 'Feast Tiger' | 'Mountain Tiger' | 'Craft Tiger';

export interface OnboardOptions {
  name: string;
  /** Visible label of the cub to pick; the form's default (Book Tiger) when omitted. */
  avatar?: TigerLabel;
  /** The grown-up PIN a "Someone I look after" learner creates. */
  pin?: string;
  /** Press "Start my journey" on the first-quest preview (default true). */
  startJourney?: boolean;
  /**
   * The level check's onboarding fork (F-PLC-001 section 3.1 step 1, on since P-10): `'new'` (the default)
   * answers "I am new to Korean" and goes on to the first-quest preview; `'stop'` stays on the fork, for a
   * spec that takes the check from there.
   */
  levelCheck?: 'new' | 'stop';
  /** Visible label of the reading level to pick (`Pictures first`, `Some reading`, ...); the form's default when omitted. */
  readingLevel?: string;
}

/**
 * Past the level check's test-language screen (F-PLC-001 §3.1 step 2). A build that shows more than one UI language
 * asks for the check's language before its options (es and ko ship, F-I18N-001 rows 15b / 16b); Continue keeps the
 * language it starts on, the UI language. A one-language build, or a screen already past it, goes straight on.
 */
export async function passPlacementLanguage(page: Page): Promise<void> {
  const language = page.getByTestId('placement-language');
  const options = page.getByTestId('placement-options').or(page.getByTestId('placement-options-card'));
  await expect(language.or(options).first()).toBeVisible();
  if (await language.isVisible()) {
    await page.getByTestId('placement-language-continue').click();
    await expect(language).toHaveCount(0);
  }
}

/**
 * The onboarding fork, "Where should we start?" (F-PLC-001 P-7; on by default since P-10): "I am new to
 * Korean" goes on to the first-quest preview exactly as before the fork existed.
 */
export async function answerForkNew(page: Page): Promise<void> {
  await expect(page.getByTestId('placement-invite')).toBeVisible();
  await page.getByTestId('placement-invite-new').click();
  await expect(page.getByTestId('placement-invite')).toHaveCount(0);
  // The fork speaks its question on open. Specs that count utterances (`__utterances`, `__spoken`, the silent
  // engine's `__silentSpeech`) count from the first-quest preview on, as they did before the fork existed.
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    for (const key of ['__utterances', '__spoken', '__silentSpeech']) {
      const log = w[key];
      if (Array.isArray(log)) log.length = 0;
    }
  });
}

/** Tap the four digits of a PIN on the on-screen pad (the pad on the PIN screen and the one in the form share the labels). */
export async function typeDigits(page: Page, pin: string = E2E_PIN): Promise<void> {
  for (const d of pin) await page.getByRole('button', { name: `Digit ${d}`, exact: true }).click();
}

/** Verify mode of the PIN screen: the PIN, then "Unlock". */
export async function unlockWithPin(page: Page, pin: string = E2E_PIN): Promise<void> {
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
  await typeDigits(page, pin);
  await page.getByRole('button', { name: 'Unlock' }).click();
}

/** First gate of a device that has no PIN yet (legacy / self-only): create it twice. */
export async function createGateIn(page: Page, pin: string = E2E_PIN): Promise<void> {
  for (const round of [0, 1]) {
    await typeDigits(page, pin);
    await page.getByRole('button', { name: 'Next' }).click();
    if (round === 0) await expect(page.getByText('Enter it once more')).toBeVisible();
  }
}

/** Resolves once the keys are in IndexedDB, so an immediate reload does not race the async write. */
export function waitForSaved(page: Page, keys: string[]): Promise<unknown> {
  return page.waitForFunction(
    (wanted) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => resolve(false);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('keyval')) {
            db.close();
            return resolve(false);
          }
          const store = db.transaction('keyval').objectStore('keyval');
          const found = wanted.map(() => false);
          let pending = wanted.length;
          wanted.forEach((key, i) => {
            const get = store.get(`hr:${key}`);
            get.onerror = () => {
              pending -= 1;
              if (pending === 0) resolve(found.every(Boolean));
            };
            get.onsuccess = () => {
              found[i] = get.result !== undefined && get.result !== null && get.result !== 'null';
              pending -= 1;
              if (pending === 0) {
                db.close();
                resolve(found.every(Boolean));
              }
            };
          });
        };
      }),
    keys,
  );
}

/** The "Who is learning?" cards (F-LEARN-001 §3.15.2): "Me", or someone a grown-up looks after. */
export const WHO_SELF = /^Me\./;
export const WHO_CHILD = /^Someone I look after/;

/**
 * Steps 1 and 2 of the setup (F-LEARN-001 §3.15): the answer, Continue, the name and cub,
 * Continue. Leaves the form on the Privacy step (or on the created profile when the device
 * already holds what the answer needs).
 */
export async function fillWhoAndProfile(page: Page, who: 'child' | 'self', o: Pick<OnboardOptions, 'name' | 'avatar' | 'readingLevel'>): Promise<void> {
  await page.getByRole('radio', { name: who === 'child' ? WHO_CHILD : WHO_SELF }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder('Type a name').fill(o.name);
  if (o.avatar) await page.getByRole('radio', { name: o.avatar }).click();
  if (o.readingLevel) await page.getByRole('radio', { name: new RegExp(`^${o.readingLevel}`) }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Step 3, Privacy: the grown-up PIN twice for someone looked after, then the box. Does not press Continue. */
export async function agreeOnPrivacy(page: Page, who: 'child' | 'self', pin: string = E2E_PIN): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
  if (who === 'child') {
    await typeDigits(page, pin); // create
    await typeDigits(page, pin); // type it again
    await expect(page.getByText('PIN set')).toBeVisible();
  }
  await page.getByRole('checkbox').click();
}

/** From the Welcome screen's "Let's start" to the first-quest preview, through the three steps. */
async function fillForm(page: Page, who: 'child' | 'self', o: OnboardOptions): Promise<void> {
  await fillWhoAndProfile(page, who, o);
  await agreeOnPrivacy(page, who, o.pin ?? E2E_PIN);
  await page.getByRole('button', { name: 'Continue' }).click();
  if (o.levelCheck === 'stop') {
    await expect(page.getByTestId('placement-invite')).toBeVisible();
    return;
  }
  await answerForkNew(page);
  await expect(page.getByText('Your first card is waiting.')).toBeVisible();
}

async function finish(page: Page, who: 'child' | 'self', o: OnboardOptions): Promise<void> {
  if (o.levelCheck === 'stop') {
    await waitForSaved(page, ['profiles', ...(who === 'child' ? ['account:parentPinHash'] : [])]);
    return;
  }
  if (o.startJourney ?? true) await page.getByRole('button', { name: 'Start my journey' }).click();
  await waitForSaved(page, ['profiles', ...(who === 'child' ? ['account:parentPinHash'] : [])]);
}

/** Continue from the Welcome screen: someone a grown-up looks after, grown-up PIN created on the Privacy step. */
export async function completeChildForm(page: Page, o: OnboardOptions): Promise<void> {
  await fillForm(page, 'child', o);
  await finish(page, 'child', o);
}

/** Continue from the Welcome screen: "Me", the "13 or older" box on the Privacy step, no PIN. */
export async function completeSelfForm(page: Page, o: OnboardOptions): Promise<void> {
  await fillForm(page, 'self', o);
  await finish(page, 'self', o);
}

/**
 * A touch phone held sideways is asked to turn upright (F-LAYOUT-001 §3.4). Specs that run at a
 * landscape phone size (844x390) answer "Keep sideways" once, right after the first `goto`; the
 * choice is saved on the device, so later opens in the same test skip it. Decided with the guard's
 * own rules (`isPhoneDevice` / `isDeviceLandscape` on the emulated screen), so a token change
 * cannot make the helper drift from the guard. A no-op at every other size, on a tablet screen
 * and with a mouse.
 */
export async function keepSidewaysIfAsked(page: Page): Promise<void> {
  const vp = page.viewportSize();
  if (!vp) return;
  const device = await page.evaluate(() => {
    const type = typeof screen.orientation?.type === 'string' ? screen.orientation.type : '';
    return {
      coarse: window.matchMedia('(pointer: coarse)').matches,
      screen: { width: screen.width, height: screen.height },
      orientation: type.startsWith('landscape') ? ('landscape' as const) : type.startsWith('portrait') ? ('portrait' as const) : null,
    };
  });
  const l = layoutClassFor(vp);
  if (!device.coarse || !isPhoneDevice(l, layoutClassFor(device.screen).form) || !isDeviceLandscape(l, device.orientation)) return;
  const keep = page.getByRole('button', { name: 'Keep sideways' });
  await expect(keep).toBeVisible();
  await keep.click();
  await expect(page.getByTestId('portrait-guard')).toHaveCount(0);
  await waitForSaved(page, ['device:layout']);
}

/** Cold start to the first-quest preview (or Home with `startJourney: false` left out): "Someone I look after", PIN `E2E_PIN`. */
export async function onboardChild(page: Page, o: OnboardOptions): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, o);
}

/** Cold start through the "Me" path: ticks "13 or older", sets no PIN, so the first grown-up action still creates one. */
export async function onboardSelf(page: Page, o: OnboardOptions): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeSelfForm(page, o);
}

/** The JSON value the app stored under `key` (IndexedDB, same prefix as `platform/storage`), or null. */
export function readStored<T = unknown>(page: Page, key: string): Promise<T | null> {
  return page.evaluate(
    (k) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('keyval').objectStore('keyval').get(`hr:${k}`);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            db.close();
            resolve(typeof get.result === 'string' ? JSON.parse(get.result) : null);
          };
        };
      }),
    key,
  ) as Promise<T | null>;
}

/** Write a JSON value under `key` the way `platform/storage` does, then load the app again so its stores hydrate from it. */
export async function seedStored(page: Page, key: string, value: unknown): Promise<void> {
  await page.evaluate(
    ([k, json]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(json, `hr:${k}`);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [key, JSON.stringify(value)] as const,
  );
  await page.goto('/');
}

/** Give the (only) learner on the device a stored Rescue Code, as a synced profile has (`sync:<id>`). */
export async function seedRescueCode(page: Page, code: string): Promise<void> {
  const profiles = await readStored<Array<{ id: string }>>(page, 'profiles');
  const id = profiles?.[0]?.id;
  if (!id) throw new Error('no profile stored to attach a Rescue Code to');
  await seedStored(page, `sync:${id}`, { secret: null, rev: 0, lastSyncedAt: null, rescueCode: code });
}

/** Home to the Grown-up zone PIN screen (verify mode) of a family device. */
export async function openGrownUpZone(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  // The install guide shows from the third cached open and covers the Home tabs.
  const guide = page.getByTestId('install-guide');
  await page.waitForTimeout(800);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await page.getByRole('button', { name: 'Grown-up zone (PIN required)' }).click();
  await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
}

/**
 * Turn the device into one that was set up before the form made the PIN
 * (F-LEARN-001 L8): a family device with no PIN yet, so the first grown-up
 * action still shows the PIN setup screen. Deletes the stored hash, reloads.
 */
export async function forgetPin(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').delete('hr:account:parentPinHash');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.goto('/');
}

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

/**
 * The letter a Match Sound prompt is the sound of. The app says the sound of a
 * letter as a syllable (F-AUDIO-004 AD2): 가 is ㄱ, 아 is ㅏ, 악 is the final ㄱ,
 * and the silent ㅇ is said by its name 이응.
 */
export function jamoOfSpoken(spoken: string): string {
  if (spoken === '이응') return 'ㅇ';
  const code = spoken.charCodeAt(0) - 0xac00;
  const initial = Math.floor(code / 588);
  const vowel = Math.floor((code % 588) / 28);
  const final = code % 28;
  if (final > 0) return FINALS[final]!;
  return initial === 11 ? VOWELS[vowel]! : INITIALS[initial]!;
}

/**
 * Continue through every page of a quest's Discover step (F-QUEST-002 §3.2) to the
 * next step. Stage 1 quest 1 opens on it since Q-6a: intro, Discover, then the games.
 */
export async function passDiscover(page: Page): Promise<void> {
  const pill = page.getByText('Look and learn', { exact: true });
  await expect(pill).toBeVisible();
  const label = await page.getByText(/^Page \d+ of \d+$/).first().innerText();
  const pages = Number(/of (\d+)$/.exec(label)?.[1] ?? '1');
  for (let i = 1; i <= pages; i += 1) {
    await expect(page.getByText(`Page ${i} of ${pages}`, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(pill).toHaveCount(0);
}

/** The Listen & Pick option cards; a tapped card says so in its label ("Right answer: ..." / "Not this one: ..."). */
const LISTEN_PICK_OPTIONS = '[data-testid^="listen-pick-option-"]';

/**
 * Wait for the Listen & Pick round after a right tap: the card marked right leaves when
 * the next round opens (state, not the game's 700 ms timer).
 */
export async function waitForNextListenPickRound(page: Page): Promise<void> {
  await expect(page.locator(`${LISTEN_PICK_OPTIONS}[aria-label^="Right answer"]`)).toHaveCount(0);
}

/**
 * Play a quest's two-question Check (F-QUEST-002 §3.3) from its launcher without
 * knowing the content: Go, then `answerCheckRounds`. The Check has no Skip.
 */
export async function playCheck(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  await answerCheckRounds(page);
}

/**
 * Answer the two Check rounds once the game is open, without knowing the content: tap
 * the options in order each round until one is marked right. A wrong tap only locks that
 * card (amber nudge); the right one ends the round, and round 2 is awaited by state.
 */
export async function answerCheckRounds(page: Page): Promise<void> {
  for (let round = 1; round <= 2; round += 1) {
    const options = page.locator(LISTEN_PICK_OPTIONS);
    await expect(options.first()).toBeVisible();
    const count = await options.count();
    for (let i = 0; i < count; i += 1) {
      const option = options.nth(i);
      // A tap inside the game's double-touch window is dropped: tap again until the card answers.
      await expect(async () => {
        await option.click();
        await expect(option).toHaveAttribute('aria-label', /^(Right answer|Not this one)/, { timeout: 250 });
      }).toPass();
      if ((await option.getAttribute('aria-label'))?.startsWith('Right answer')) break;
    }
    if (round === 1) await waitForNextListenPickRound(page);
  }
}

/** One Check round answered by option id: `missWith` is tapped first (a first-try miss), then `answer`. */
export type CheckAnswer = { answer: string; missWith?: string };

/**
 * Play a quest's two-question Check from its launcher when the spec knows the content:
 * Go, then each round's option by id (`listen-pick-option-<id>`), so the stars come out
 * the same on every run. A miss locks only that card (amber nudge); the right one ends the round.
 */
export async function playCheckByIds(page: Page, rounds: readonly [CheckAnswer, CheckAnswer]): Promise<void> {
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  for (const [i, { answer, missWith }] of rounds.entries()) {
    for (const [id, verdict] of [...(missWith === undefined ? [] : [[missWith, /^Not this one/] as const]), [answer, /^Right answer/] as const]) {
      const option = page.getByTestId(`listen-pick-option-${id}`);
      await expect(option).toBeVisible();
      // A tap inside the game's double-touch window is dropped: tap again until the card answers.
      await expect(async () => {
        await option.click();
        await expect(option).toHaveAttribute('aria-label', verdict, { timeout: 250 });
      }).toPass();
    }
    if (i === 0) await waitForNextListenPickRound(page);
  }
}

/**
 * A Journey cell's accessible name (F-STORY-005 §3.12): "Stage 1 Hangul, Letters & Books: lesson",
 * "Stage 2 Words, Letters & Books, coming soon". Matches the stage number and the start of the theme
 * title, so a complete look, a story count or a level-check mark later in the label still matches.
 */
export function journeyCellName(stage: number, theme: string): RegExp {
  return new RegExp(`^Stage ${stage} [^,]+, ${theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}

/**
 * Open the Meet the Letters episode from the Journey (Stage 1, Letters & Books). Since the launch
 * stories are reviewed (F-STORY-001 PR 1.9), Home's day-one slots 1 and 3 hold story cards, so the
 * Letters episode is no longer a Home card; the Journey cell is the learner's own way in.
 */
export async function openLettersEpisode(page: Page): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: journeyCellName(1, 'Letters & Books') }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).first().waitFor();
}

/**
 * The route's ScreenHeader controls (AMENDMENTS-DISPLAY-NAV section 7.1): Back or Close, top left on every
 * non-root screen. The screens under the current one stay mounted, hidden, so only the visible one counts.
 */
export function headerBack(scope: Page | Locator): Locator {
  return scope.getByTestId('screen-header-back').filter({ visible: true });
}

export function headerClose(scope: Page | Locator): Locator {
  return scope.getByTestId('screen-header-close').filter({ visible: true });
}

/**
 * Answers every ConfirmSheet with its confirm button, as `page.on('dialog', accept)` answered the browser's `confirm()`
 * before the web build drew the sheet (AMENDMENTS-DISPLAY-NAV section 8): the confirm is the sheet's last button
 * (the safe choice comes first).
 */
export async function acceptConfirmSheets(page: Page): Promise<void> {
  await page.addLocatorHandler(page.getByRole('alertdialog'), async (sheet) => {
    await sheet.getByRole('button').last().click();
  });
}
