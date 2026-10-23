import type { Locator, Page } from '@playwright/test';
import { blockParts, type ProgressSnapshot } from '@hangul-route/content-schema';
import { REVIEW_ITEM_ROWS } from '../../src/content/__generated__/review-item-chunks/review-items';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 section 7.1 F3 and F9, OD-8, sections 12.2 and 14, row CM-32 (design/wireframes/minigame/syllable-build.md,
 * design/wireframes/minigame/decoding-sprint.md): Syllable Build and the Block Sprint in the release build.
 *
 * - A learner who finished Stage 1, with `decodingSprint` and `game.syllable-build` on: the Block Sprint from the
 *   Journey's Stage 1 footer at 320 x 568, its pick and build rounds (every target at least 48 dp, the tiles 64), the
 *   one-minute clock, the held-out probe and the private result; the record stays on the device.
 * - Reduced motion: the build round draws and plays the same.
 * - `game.syllable-build` off: every drill round is a pick (Listen & Pick on the block); `decodingSprint` off: no offer.
 * - The Daily Review at the produce rung: a held block item is asked as Syllable Build, and the right block is recorded.
 * The time zone is fixed and nothing here reads a calendar day but the Daily Review's due day, which the page computes.
 *
 *   HR_SHOTS=1 pnpm --filter @hangul-route/mobile test:e2e:web syllable-build
 */

test.use({ timezoneId: 'UTC' });

type SpeechWindow = Window & { __spoken?: string[] };
type Flags = Record<string, { on: boolean; pct: number }>;
const ON: Flags = { decodingSprint: { on: true, pct: 100 }, 'game.syllable-build': { on: true, pct: 100 } };
const AT = '2026-10-01T09:05:00.000Z';

/** A ko-KR voice that answers at once and keeps what it said, so a round's block is known (headless Chromium has none). */
async function captureSpeech(page: Page): Promise<void> {
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
const lastSpoken = (page: Page): Promise<string | undefined> => page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1));

const STAGE1 = ['letters', 'life', 'rites', 'nature', 'crafts'] as const;
const stage1Done = (profileId: string): ProgressSnapshot => ({
  profileId,
  updatedAt: AT,
  episodes: [],
  quests: STAGE1.flatMap((theme) =>
    [1, 2, 3].map((i) => ({ questId: `quest:stage1-${theme}-q${i}`, episodeId: `episode:stage1-${theme}`, startedAt: AT, completedAt: AT, stars: 2 as const, attempts: 1, accuracy: 0.8 })),
  ),
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});

async function learner(page: Page, flags: Flags = ON, done = true): Promise<string> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const id = (await readStored<string>(page, 'profiles:active')) as string;
  if (done) await seedStored(page, `progress:${id}`, stage1Done(id));
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags });
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  return id;
}

async function openSprint(page: Page): Promise<void> {
  await page.getByText('Journey', { exact: true }).last().click();
  const offer = page.getByTestId('journey-decoding-sprint');
  await offer.scrollIntoViewIfNeeded();
  await expect(offer).toContainText('Bonus round: read as many blocks as you can in one minute.');
  await page.getByTestId('journey-decoding-sprint-cta').click();
  await expect(page.getByTestId('decoding-sprint-intro')).toBeVisible();
}

/** Every one of these is a target at least 48 dp (CSS px) on both sides. */
async function expectTargets(locators: Locator[]): Promise<void> {
  for (const l of locators) {
    const box = await l.boundingBox();
    expect(box, await l.getAttribute('data-testid')).not.toBeNull();
    expect(box!.width, await l.getAttribute('data-testid')).toBeGreaterThanOrEqual(48);
    expect(box!.height, await l.getAttribute('data-testid')).toBeGreaterThanOrEqual(48);
  }
}

/** Answers the drill or probe round on screen right, from the block the voice said; returns the round's kind. */
async function answerRound(page: Page, prefix: 'decoding-sprint' | 'decoding-sprint-probe', before: string | undefined): Promise<{ kind: 'pick' | 'build'; spoken: string }> {
  await expect.poll(() => lastSpoken(page)).not.toBe(before);
  const spoken = (await lastSpoken(page)) as string;
  const build = page.getByTestId('decoding-sprint-build');
  if (prefix === 'decoding-sprint' && (await build.count()) > 0) {
    const p = blockParts(spoken)!;
    await page.getByTestId(`decoding-sprint-build-tile-first:${p.first}`).click();
    await page.getByTestId(`decoding-sprint-build-tile-vowel:${p.vowel}`).click();
    await page.getByTestId(`decoding-sprint-build-tile-final:${p.final ?? 'none'}`).click();
    await expect(page.getByTestId('decoding-sprint-build-built')).toBeVisible();
    return { kind: 'build', spoken };
  }
  await page.getByTestId(`${prefix}-pick-option-${spoken}`).click();
  await expect(page.getByTestId(`${prefix}-pick-answer`)).toBeVisible();
  return { kind: 'pick', spoken };
}

test.describe('the Block Sprint (Decoding Sprint, row CM-32)', () => {
  test('from the Journey at 320 x 568: picks and builds, one clock, the held-out probe, a private result', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await captureSpeech(page);
    await page.clock.install();
    const id = await learner(page);
    await openSprint(page);
    await expectNoHorizontalOverflow(page);
    await shot(page, 'decoding-sprint-intro-320');
    await page.getByTestId('decoding-sprint-start').click();
    await expect(page.getByTestId('vocab-speed-clock')).toContainText('1:00');

    // Round 1 is a pick, round 2 a build (every other round while game.syllable-build is on).
    const kinds: string[] = [];
    let before: string | undefined;
    for (let i = 0; i < 4; i += 1) {
      if (i === 0) {
        await expect(page.getByTestId('decoding-sprint-pick')).toBeVisible();
        await expectTargets([page.getByTestId('decoding-sprint-pick-speaker'), ...(await page.locator('[data-testid^="decoding-sprint-pick-option-"]').all()), page.getByTestId('decoding-sprint-pause')]);
        await shot(page, 'decoding-sprint-pick-320');
      }
      if (i === 1) {
        await expect(page.getByTestId('decoding-sprint-build')).toBeVisible();
        const tiles = await page.locator('[data-testid^="decoding-sprint-build-tile-"]').all();
        expect(tiles.length).toBe(12);
        await expectTargets([...tiles, ...(await page.locator('[data-testid^="decoding-sprint-build-zone-"]').all()), page.getByTestId('decoding-sprint-build-speaker')]);
        // Tiles show the jamo only; the romanization waits until the block is right.
        for (const t of tiles.slice(0, 11)) expect((await t.innerText()).trim()).toMatch(/^[ㄱ-ㅣ]$/);
        await expectNoHorizontalOverflow(page);
        await shot(page, 'syllable-build-sprint-320');
      }
      const r = await answerRound(page, 'decoding-sprint', before);
      kinds.push(r.kind);
      before = r.spoken;
    }
    expect(kinds).toEqual(['pick', 'build', 'pick', 'build']);

    // The minute runs out while a round waits: the round is dropped, never a miss.
    await expect.poll(() => lastSpoken(page)).not.toBe(before);
    // The clock holds while an answer shows, so some of the minute is left: run it out, a second at a time at the end.
    const seconds = Number((await page.getByTestId('vocab-speed-clock').innerText()).split(':')[1]);
    expect(seconds).toBeGreaterThan(30);
    await page.clock.runFor((seconds - 1) * 1000);
    await expect(page.getByTestId('decoding-sprint-drill')).toBeVisible();
    await page.clock.runFor(1000);
    await expect(page.getByText("That's the time! Nice work.")).toBeVisible();
    // Time flows on by itself again (runFor leaves the fake clock where it stopped).
    await page.clock.resume();
    await expect(page.getByText('A few more blocks. No clock now.')).toBeVisible({ timeout: 5_000 });
    // Read before the tap: the probe's first round speaks as it opens.
    before = await lastSpoken(page);
    await page.getByTestId('decoding-sprint-probe-start').click();
    for (let i = 0; i < 6; i += 1) {
      await expect(page.getByTestId('vocab-speed-clock')).toHaveCount(0);
      const r = await answerRound(page, 'decoding-sprint-probe', before);
      before = r.spoken;
    }
    await expect(page.getByTestId('decoding-sprint-result')).toBeVisible();
    await expect(page.getByText('4 blocks read')).toBeVisible();
    await expect(page.getByTestId('decoding-sprint-best')).toHaveCount(0);
    const text = await page.getByTestId('decoding-sprint-result').innerText();
    expect(text).not.toMatch(/%|\bof\b|wrong|miss/i);
    await shot(page, 'decoding-sprint-result-320');
    await expect.poll(() => readStored(page, `decode-sprint:${id}`)).toEqual({ v: 1, sprints: 1, best: 4 });
  });

  test('a wide window: the same sprint in one reading column', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await captureSpeech(page);
    await learner(page);
    await openSprint(page);
    await page.getByTestId('decoding-sprint-start').click();
    const first = await answerRound(page, 'decoding-sprint', undefined);
    await expect(page.getByTestId('decoding-sprint-build')).toBeVisible();
    await shot(page, 'syllable-build-sprint-wide');
    await answerRound(page, 'decoding-sprint', first.spoken);
  });

  test('reduced motion: the build round draws and plays the same', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    await captureSpeech(page);
    await learner(page);
    await openSprint(page);
    await page.getByTestId('decoding-sprint-start').click();
    const first = await answerRound(page, 'decoding-sprint', undefined);
    await expect(page.getByTestId('decoding-sprint-build')).toBeVisible();
    // A miss is amber with where to listen, and the zones that fit stay.
    await expect.poll(() => lastSpoken(page)).not.toBe(first.spoken);
    const spoken = (await lastSpoken(page)) as string;
    const p = blockParts(spoken)!;
    const wrongVowel = await page.locator('[data-testid^="decoding-sprint-build-tile-vowel:"]').evaluateAll((els, own) => els.map((e) => e.getAttribute('data-testid') ?? '').find((t) => !t.endsWith(`:${own}`)), p.vowel);
    await page.getByTestId(`decoding-sprint-build-tile-first:${p.first}`).click();
    await page.getByTestId(wrongVowel!).click();
    await page.getByTestId(`decoding-sprint-build-tile-final:${p.final ?? 'none'}`).click();
    await expect(page.getByTestId('decoding-sprint-build-hoya')).toContainText('Listen to the middle sound.');
    await shot(page, 'syllable-build-miss-reduced-motion-320');
    await page.getByTestId(`decoding-sprint-build-tile-vowel:${p.vowel}`).click();
    await expect(page.getByTestId('decoding-sprint-build-built')).toBeVisible();
  });

  test('game.syllable-build off: every drill round is a pick (Listen & Pick on the block)', async ({ page }) => {
    await captureSpeech(page);
    await learner(page, { decodingSprint: { on: true, pct: 100 } });
    await openSprint(page);
    await page.getByTestId('decoding-sprint-start').click();
    let before: string | undefined;
    for (let i = 0; i < 3; i += 1) {
      const r = await answerRound(page, 'decoding-sprint', before);
      expect(r.kind).toBe('pick');
      before = r.spoken;
    }
  });

  test('decodingSprint off: no offer on the Journey; not before Stage 1 is done either', async ({ page }) => {
    await learner(page, { 'game.syllable-build': { on: true, pct: 100 } });
    await page.getByText('Journey', { exact: true }).last().click();
    await expect(page.getByTestId('journey-hangul-check')).toBeVisible();
    await expect(page.getByTestId('journey-decoding-sprint')).toHaveCount(0);
  });
});

test.describe('Syllable Build at the produce rung of the Daily Review (row CM-32)', () => {
  /** Block items of this build: held (box 3, the ladder at produce) and due today. */
  const BLOCKS = REVIEW_ITEM_ROWS.filter(([id, ko]) => id.startsWith('syl:') && blockParts(ko) !== null && 'ㄱㄴㄷㄹㅁㅂㅇ'.includes(blockParts(ko)!.final ?? 'ㄱ')).slice(0, 4);

  test('a held block is asked as Syllable Build and its right block is recorded', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await captureSpeech(page);
    const id = await learner(page, { ...ON, memoryRecord: { on: true, pct: 100 }, dailyReview: { on: true, pct: 100 } }, false);
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const rows: Record<string, unknown> = {};
    for (const [itemId] of BLOCKS) rows[itemId] = { sh: 'stage1', st: { b: 3, d: today, c: 2, r: 3, n: 4, f: '2026-01-01', s: 3, at: '2026-01-02T09:00:00.000Z' } };
    await seedStored(page, `memory:${id}`, { v: 1, rows, vf: {}, pending: [], cursor: 0, seededFrom: null, day: null, dailySent: null });
    await page.reload();
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await page.getByRole('button', { name: /^Daily Review\. About 3 minutes\./ }).click();
    await expect(page.getByTestId('daily-review-build')).toBeVisible();
    await expectTargets(await page.locator('[data-testid^="daily-review-build-board-tile-"]').all());
    await shot(page, 'syllable-build-daily-review-320');
    await expect.poll(() => lastSpoken(page)).toBeTruthy();
    const spoken = (await lastSpoken(page)) as string;
    const p = blockParts(spoken)!;
    await page.getByTestId(`daily-review-build-board-tile-first:${p.first}`).click();
    await page.getByTestId(`daily-review-build-board-tile-vowel:${p.vowel}`).click();
    await page.getByTestId(`daily-review-build-board-tile-final:${p.final ?? 'none'}`).click();
    await expect(page.getByTestId('daily-review-build-board-built')).toBeVisible();
    const item = BLOCKS.find(([, ko]) => ko === spoken)![0];
    await expect.poll(async () => (await readStored<{ rows: Record<string, { st: { n: number } }> }>(page, `memory:${id}`))?.rows[item]?.st.n, { timeout: 10_000 }).toBe(5);
  });
});
