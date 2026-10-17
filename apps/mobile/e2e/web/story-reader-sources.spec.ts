import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { nextPage } from './story-reader-helpers';
import { completeChildForm, completeSelfForm, keepSidewaysIfAsked, seedStored, typeDigits, unlockWithPin, headerBack } from './helpers';

/**
 * F-STORY-002 PR 2.7: the Sources screen (`StorySources`), reached from the
 * replay reader's top bar and end page, plus the deep links F-STORY-004 will
 * use (opened here through `window.__hrStoryE2E.openSources`). Like the
 * reader suite it runs on the fixture bundle only:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web story-reader
 *
 * The fixture (`story:hangul-day`) has three facts and five source links:
 * listen scenes cite f1 | f1+f2 | f1 | f3 | -, read-along f1 | f1 | f3, so
 * Sources shows Scene 1 [f1], Scene 2 [see f1, f2], Scene 3 [see f1, f3],
 * Scene 4 [see f3]. A second fixture (`story:hangul-day-revised`, no shelf)
 * adds two visible corrections, a revised fact (f2, rev 2) and a fact only a
 * culture note cites (f4). No external site is ever opened: `window.open` is
 * replaced by a recorder before any page script runs; it hands back a fake
 * tab (so the app's `opener = null` can be checked), or null like a blocked
 * pop-up when a test sets `__blockPopups`.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const STORY = 'story:hangul-day';
const REVISED = 'story:hangul-day-revised';
const F1_URL = 'https://www.heritage.go.kr/fixture/hangul';
const GATE_DONE = 'Grown-up check done. Tap Open link to open it.';
const DAY_MS = 24 * 60 * 60 * 1000;
const EMOJI = /\p{Extended_Pictographic}/u;

type E2eEvent = { name: string; profileId?: string; payload?: Record<string, unknown> };
type E2eWindow = Window & {
  __hrStoryE2E?: {
    openReader(p: { storyId: string; level: string; sceneIndex?: number }): void;
    openSources(p: { storyId: string; factId?: string; sceneIndex?: number; from: string }): void;
    stories(): Array<{ id: string; levels: string[]; fixture: boolean; traditional: boolean }>;
    events(): E2eEvent[];
  };
  __opened?: Array<[string, string]>;
  __tabs?: Array<{ opener: unknown }>;
  __blockPopups?: boolean;
  __copied?: string[];
};

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    const w = window as E2eWindow;
    w.__opened = [];
    w.__tabs = [];
    w.__copied = [];
    // Records the hand-off instead of opening a tab. A blocked pop-up opens nothing and returns
    // null; otherwise a fake tab whose opener still points here until the app clears it.
    window.open = ((url?: string | URL, target?: string) => {
      if (w.__blockPopups) return null;
      w.__opened!.push([String(url), String(target)]);
      const tab = { opener: window as unknown };
      w.__tabs!.push(tab);
      return tab;
    }) as unknown as typeof window.open;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void w.__copied!.push(text) },
    });
  });
});

async function onboard(page: Page, who: 'child' | 'self' = 'child'): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  if (who === 'child') await completeChildForm(page, { name: 'Dami' });
  else await completeSelfForm(page, { name: 'Alex' });
  await page.goto('/');
  await expect(page.getByText(who === 'child' ? 'Hi, Dami!' : 'Hi, Alex!')).toBeVisible();
}

async function hook(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrStoryE2E), undefined, { timeout: 10_000 });
}

async function openReader(page: Page, level = 'listen', sceneIndex?: number): Promise<void> {
  await hook(page);
  await page.evaluate(
    ([id, lvl, scene]) =>
      (window as E2eWindow).__hrStoryE2E?.openReader({ storyId: id as string, level: lvl as string, ...(scene === null ? {} : { sceneIndex: scene as number }) }),
    [STORY, level, sceneIndex ?? null] as const,
  );
  await expect(page.getByTestId('story-reader-next')).toBeVisible();
}

async function openSources(page: Page, params: { storyId?: string; factId?: string; sceneIndex?: number; from: string }): Promise<void> {
  await hook(page);
  await page.evaluate((p) => (window as E2eWindow).__hrStoryE2E?.openSources({ storyId: 'story:hangul-day', ...p }), params);
  await expect(page.getByTestId('story-sources-title')).toBeVisible();
}

const events = (page: Page): Promise<E2eEvent[]> => page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.events() ?? []);
const opened = (page: Page): Promise<Array<[string, string]>> => page.evaluate(() => (window as E2eWindow).__opened ?? []);
/** Whether every tab the app opened had its handle back to the app cut (`opener = null`). */
const tabsCutOff = (page: Page): Promise<boolean> =>
  page.evaluate(() => ((window as E2eWindow).__tabs ?? []).every((t) => t.opener === null));
const linkOpenedEvents = async (page: Page): Promise<Array<Record<string, unknown> | undefined>> =>
  (await events(page)).filter((e) => e.name === 'story.sources.link_opened').map((e) => e.payload);

/**
 * What would scroll sideways: the Sources scroll box wider than its frame, or
 * a source link or fact card past the right edge of the window (the scroll box
 * clips overflow, so the document width alone cannot show it).
 */
async function sidewaysOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vw = window.innerWidth;
    const scroll = document.querySelector<HTMLElement>('[data-testid="story-sources-scroll"]');
    if (!scroll) out.push('no story-sources-scroll');
    else if (scroll.scrollWidth > scroll.clientWidth + 1) out.push(`scroll ${scroll.scrollWidth} > ${scroll.clientWidth}`);
    let urls = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-testid]'))) {
      const id = el.getAttribute('data-testid') ?? '';
      if (!/-url$/.test(id) && !/^story-sources-fact-f\d+$/.test(id)) continue;
      if (id.endsWith('-url')) urls += 1;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 0.5 || el.scrollWidth > el.clientWidth + 1) out.push(`${id}: right ${r.right}, ${el.scrollWidth} > ${el.clientWidth}`);
    }
    if (urls === 0) out.push('no source links measured');
    return out;
  });
}
const copied = (page: Page): Promise<string[]> => page.evaluate(() => (window as E2eWindow).__copied ?? []);

async function inViewport(page: Page, testId: string): Promise<boolean> {
  const box = await page.getByTestId(testId).boundingBox();
  const vp = page.viewportSize();
  return Boolean(box && vp && box.y >= 0 && box.y < vp.height);
}

test.describe('story Sources (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle: build:web:fixtures, then STORY_FIXTURES=1');

  test('from the top bar: header, checked line, facts by scene, See fact rows, Korean claim, scrolled to the scene', async ({ page }) => {
    await onboard(page);
    await openReader(page, 'listen', 1);
    await page.getByTestId('story-reader-sources').click();

    await expect(page.getByRole('heading', { name: 'Sources', exact: true })).toBeVisible();
    await expect(page.getByTestId('story-sources-story-title')).toBeAttached();
    await expect(page.getByTestId('story-sources-traditional')).toHaveCount(0);
    await expect(page.getByTestId('story-sources-checked')).toHaveText(
      'Checked in 3 independent passes · last checked 2026-10-10 · story version 1',
    );
    await expect(page.getByText('These checks covered a group of related stories, not this story alone.')).toBeAttached();
    await expect(page.getByTestId('story-sources-counts')).toHaveText('3 facts · 5 sources');
    await expect(page.getByTestId('story-sources-advisory')).toContainText('Mentions that most people could not read long ago.');
    // The fixture's one erratum is `show: false`: no Corrections heading at all (§3.14 #1).
    await expect(page.getByTestId('story-sources-corrections')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Corrections' })).toHaveCount(0);

    // Opened at scene 2: its section is scrolled into view.
    await expect.poll(() => inViewport(page, 'story-sources-scene-1')).toBe(true);

    // Facts by the first scene that cites them; later citations are one-line rows (§3.14 #2).
    await expect(page.getByTestId('story-sources-scene-0').getByTestId('story-sources-fact-f1')).toBeAttached();
    await expect(page.getByTestId('story-sources-scene-1').getByTestId('story-sources-fact-f2')).toBeAttached();
    await expect(page.getByTestId('story-sources-scene-1').getByText('See fact f1')).toBeVisible();
    await expect(page.getByTestId('story-sources-scene-3').getByText('See fact f3')).toBeAttached();
    await expect(page.getByTestId('story-sources-scene-3').getByTestId('story-sources-fact-f3')).toHaveCount(0);
    await expect(page.getByTestId('story-sources-used')).toHaveCount(0);

    // A fact card: scope, claim, Sources (n), each source one labelled group with its link as text.
    const f2 = page.getByTestId('story-sources-fact-f2');
    await expect(f2.getByTestId('story-sources-fact-f2-scope')).toHaveText('What we know');
    await expect(f2.getByRole('heading', { name: 'Sources (2)' })).toBeAttached();
    await expect(f2.getByRole('group', { name: 'Source 2 of 2: Hunminjeongeum Manuscript, UNESCO' })).toBeAttached();
    await expect(f2.getByTestId('story-sources-fact-f2-source-0-url')).toHaveText('https://www.heritage.go.kr/fixture/hunminjeongeum');
    await expect(f2.getByText('Cultural Heritage Administration · accessed 2026-10-09')).toBeAttached();

    // The Korean claim sits under a disclosure and is marked as Korean.
    await expect(f2.getByTestId('story-sources-fact-f2-claim-ko')).toHaveCount(0);
    await f2.getByTestId('story-sources-fact-f2-korean').click();
    await expect(f2.getByTestId('story-sources-fact-f2-claim-ko')).toHaveText('훈민정음은 1446년에 반포되었다.');
    await expect(f2.getByTestId('story-sources-fact-f2-claim-ko')).toHaveAttribute('lang', 'ko');

    // How it was checked expands the reviewers' notes.
    await page.getByTestId('story-sources-how-checked').click();
    await expect(page.getByTestId('story-sources-checked-notes')).toHaveText('Test fixture: sources are placeholders and were not re-fetched.');

    // "See fact f1" jumps to the card and highlights it with an outline and a label, not colour alone.
    await page.getByTestId('story-sources-scene-1').getByText('See fact f1').click();
    await expect(page.getByTestId('story-sources-fact-f1-highlighted')).toHaveText('Highlighted');
    await expect.poll(() => inViewport(page, 'story-sources-fact-f1')).toBe(true);

    const shown = await page.getByTestId('story-sources').innerText();
    expect(shown).not.toMatch(EMOJI);

    // story.sources.opened once, from the reader, ids only.
    const opens = (await events(page)).filter((e) => e.name === 'story.sources.opened');
    expect(opens.map((e) => e.payload)).toEqual([{ storyId: STORY, from: 'reader' }]);

    // Back returns to the same scene of the reader.
    await headerBack(page).click();
    await expect(page.getByTestId('story-reader-position')).toHaveText('2 / 5');
  });

  test('from the end page: opens at the top, from = end', async ({ page }) => {
    await onboard(page);
    await openReader(page, 'read-along');
    for (let i = 0; i < 4; i += 1) await nextPage(page);
    await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
    await page.getByTestId('story-reader-end-sources').click();
    await expect(page.getByTestId('story-sources-title')).toBeVisible();
    await expect.poll(() => inViewport(page, 'story-sources-checked')).toBe(true);
    const opens = (await events(page)).filter((e) => e.name === 'story.sources.opened');
    expect(opens.map((e) => e.payload)).toEqual([{ storyId: STORY, from: 'end' }]);
    await headerBack(page).click();
    await expect(page.getByRole('heading', { name: 'The End' })).toBeVisible();
  });

  test('Open link on a device with a PIN asks for the gate first; Cancel opens nothing; after the PIN one more tap opens it safely (§3.14 #3)', async ({ page }) => {
    await onboard(page, 'child');
    await openSources(page, { factId: 'f1', from: 'scene' });
    const open = page.getByTestId('story-sources-fact-f1-source-0-open');

    // Cancel: nothing opens, nothing is reported.
    await open.click();
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('story-sources-title')).toBeVisible();
    expect(await opened(page)).toEqual([]);

    // The PIN: back on Sources nothing opens by itself (a tab opened outside a tap may be
    // blocked); the block asks for one more tap, which opens a new tab that cannot reach back.
    await open.click();
    await unlockWithPin(page);
    await expect(page.getByTestId('story-sources-title')).toBeVisible();
    await expect(page.getByTestId('story-sources-fact-f1-source-0-note')).toHaveText(GATE_DONE);
    expect(await opened(page)).toEqual([]);
    expect(await linkOpenedEvents(page)).toEqual([]);
    await open.click();
    await expect.poll(() => opened(page)).toEqual([[F1_URL, '_blank']]);
    expect(await tabsCutOff(page)).toBe(true);
    await expect(page.getByTestId('story-sources-fact-f1-source-0-note')).toHaveCount(0);
    await expect.poll(() => linkOpenedEvents(page)).toEqual([{ storyId: STORY, factId: 'f1' }]);

    // The grown-up session is open now: a second link opens without the PIN.
    await page.getByTestId('story-sources-fact-f3-source-1-open').click();
    await expect.poll(async () => (await opened(page)).length).toBe(2);
    expect(await tabsCutOff(page)).toBe(true);
    await expect(page.getByText('Enter your 4-digit PIN to continue.')).toHaveCount(0);

    const opens = (await events(page)).filter((e) => e.name === 'story.sources.opened');
    expect(opens.map((e) => e.payload)).toEqual([{ storyId: STORY, from: 'scene', factId: 'f1' }]);
  });

  test('a self-only device with no PIN opens directly; Copy link needs no gate (§3.14 #3-4)', async ({ page }) => {
    await onboard(page, 'self');
    await openSources(page, { from: 'episode' });
    await page.getByTestId('story-sources-fact-f1-source-0-copy').click();
    await expect(page.getByTestId('story-sources-fact-f1-source-0-note')).toHaveText('Link copied');
    expect(await copied(page)).toEqual([F1_URL]);
    expect(await opened(page)).toEqual([]);

    await page.getByTestId('story-sources-fact-f1-source-0-open').click();
    await expect.poll(() => opened(page)).toEqual([[F1_URL, '_blank']]);
    expect(await tabsCutOff(page)).toBe(true);
    await expect(page.getByText('Create a PIN')).toHaveCount(0);
    await expect.poll(() => linkOpenedEvents(page)).toEqual([{ storyId: STORY, factId: 'f1' }]);
  });

  test('a blocked pop-up is not a success: the link to open by hand shows and nothing is reported', async ({ page }) => {
    await onboard(page, 'self');
    await openSources(page, { from: 'episode' });
    await page.evaluate(() => {
      (window as E2eWindow).__blockPopups = true;
    });
    await page.getByTestId('story-sources-fact-f1-source-0-open').click();
    await expect(page.getByTestId('story-sources-fact-f1-source-0-note')).toHaveText(`Open this link in a browser: ${F1_URL}`);
    expect(await opened(page)).toEqual([]);
    expect(await linkOpenedEvents(page)).toEqual([]);
  });

  test('Forgot PIN on the way to a link: a new PIN brings Sources back with the link waiting for one tap', async ({ page }) => {
    await onboard(page, 'child');
    await seedStored(page, 'account:pinResetRequestedAt', new Date(Date.now() - DAY_MS - 60_000).toISOString());
    await openSources(page, { from: 'scene', factId: 'f1' });
    const open = page.getByTestId('story-sources-fact-f1-source-0-open');
    await open.click();
    await page.getByRole('button', { name: 'Forgot PIN?' }).click();
    await expect(page.getByText('The 24 hours are up.')).toBeVisible();
    await page.getByRole('button', { name: 'Set a new PIN' }).click();
    await expect(page.getByText('Create a grown-up PIN')).toBeVisible();
    for (const round of [0, 1]) {
      await typeDigits(page, '2468');
      await page.getByRole('button', { name: 'Next' }).click();
      if (round === 0) await expect(page.getByText('Enter it once more')).toBeVisible();
    }
    await expect(page.getByTestId('story-sources-title')).toBeVisible();
    await expect(page.getByTestId('story-sources-fact-f1-source-0-note')).toHaveText(GATE_DONE);
    expect(await opened(page)).toEqual([]);
    await open.click();
    await expect.poll(() => opened(page)).toEqual([[F1_URL, '_blank']]);
    await expect.poll(() => linkOpenedEvents(page)).toEqual([{ storyId: STORY, factId: 'f1' }]);
  });

  test('a revised story: Corrections newest first, the Updated date on the fact, the Used section, approximations', async ({ page }) => {
    await onboard(page);
    await openSources(page, { storyId: REVISED, from: 'episode' });
    await expect(page.getByTestId('story-sources-counts')).toHaveText('4 facts · 6 sources');

    // Visible errata only (e1 is `show: false`), newest first, each naming its fact (§3.14 #1).
    const corrections = page.getByTestId('story-sources-corrections');
    await expect(corrections.getByRole('heading', { name: 'Corrections' })).toBeVisible();
    await expect(corrections.locator('[data-testid^="story-sources-correction-"]')).toHaveCount(2);
    const ids = await corrections
      .locator('[data-testid^="story-sources-correction-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    expect(ids).toEqual(['story-sources-correction-e2', 'story-sources-correction-e3']);
    await expect(page.getByTestId('story-sources-correction-e2')).toContainText('2026-10-11');
    await expect(page.getByTestId('story-sources-correction-e2')).toContainText('We corrected the year the guide to the alphabet was published.');
    await expect(page.getByTestId('story-sources-correction-e2')).toContainText('f2: The Hunminjeongeum, the guide to the new alphabet, was published in 1446.');
    await expect(page.getByTestId('story-sources-correction-e1')).toHaveCount(0);

    // The revised fact (rev 2) carries the date of the newest visible erratum naming it; an unrevised one has no tag.
    await expect(page.getByTestId('story-sources-fact-f2-updated')).toHaveText('Updated 2026-10-11');
    await expect(page.getByTestId('story-sources-fact-f1-updated')).toHaveCount(0);

    // A fact no scene cites (only a culture note) sits in the last section.
    const used = page.getByTestId('story-sources-used');
    await expect(used.getByRole('heading', { name: 'Used in questions and notes' })).toBeAttached();
    await expect(used.getByTestId('story-sources-fact-f4')).toBeAttached();
    await expect(used.getByTestId('story-sources-fact-f4-claim')).toHaveText('Korea celebrates its alphabet with a holiday every autumn.');

    // The rounding the narration makes, under its fact, with the today note for a time-relative one.
    await expect(page.getByText('About “About 600 years ago”: 1446 to 2026 is 580 years; the narration rounds it.')).toBeAttached();
    await expect(page.getByText('This depends on today’s date.')).toBeAttached();

    expect(await page.getByTestId('story-sources').innerText()).not.toMatch(EMOJI);
  });

  test('offline: the text is all there; Open link says it needs a connection and keeps the link copyable', async ({ page, context }) => {
    await onboard(page, 'self');
    await openSources(page, { from: 'episode' });
    await context.setOffline(true);
    await expect(page.getByTestId('story-sources-counts')).toHaveText('3 facts · 5 sources');
    await page.getByTestId('story-sources-fact-f1-source-0-open').click();
    await expect(page.getByTestId('story-sources-fact-f1-source-0-note')).toHaveText(
      `Opening a link needs a connection. Open this link in a browser: ${F1_URL}`,
    );
    expect(await opened(page)).toEqual([]);
    expect((await events(page)).filter((e) => e.name === 'story.sources.link_opened')).toEqual([]);
    await context.setOffline(false);
  });

  test('a deep link to a fact scrolls to and highlights its card', async ({ page }) => {
    await onboard(page);
    await openSources(page, { factId: 'f3', from: 'scene' });
    await expect(page.getByTestId('story-sources-fact-f3-highlighted')).toHaveText('Highlighted');
    await expect.poll(() => inViewport(page, 'story-sources-fact-f3')).toBe(true);
    await expect(page.getByTestId('story-sources-fact-f1-highlighted')).toHaveCount(0);
  });

  for (const vp of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    test(`${vp.width}x${vp.height}: no sideways scroll, every source can be opened and copied`, async ({ page }) => {
      await page.setViewportSize(vp);
      await onboard(page);
      await openSources(page, { from: 'episode' });
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sideways).toBeLessThanOrEqual(0);
      expect(await sidewaysOverflow(page)).toEqual([]);
      const openButton = page.getByTestId('story-sources-fact-f3-source-1-open');
      await openButton.scrollIntoViewIfNeeded();
      await expect(openButton).toBeVisible();
      const box = await openButton.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(64);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 0.5);
      await page.screenshot({ path: `test-results/story-sources-${vp.width}x${vp.height}.png`, fullPage: false });
    });
  }

  test('every bundled story at 320 wide: Sources lists facts with https links, labels tales, no emoji, nothing sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await onboard(page);
    await hook(page);
    const stories = await page.evaluate(() => (window as E2eWindow).__hrStoryE2E?.stories() ?? []);
    const real = stories.filter((s) => !s.fixture);
    expect(real.length).toBeGreaterThan(0);
    for (const story of real) {
      await openSources(page, { storyId: story.id, from: 'episode' });
      await expect(page.getByTestId('story-sources-counts')).toHaveText(/^\d+ facts? · \d+ sources?$/);
      await expect(page.getByTestId('story-sources-empty')).toHaveCount(0);
      await expect(page.getByTestId('story-sources-traditional')).toHaveCount(story.traditional ? 1 : 0);
      const urls = await page.locator('[data-testid$="-url"]').allInnerTexts();
      expect(urls.length, story.id).toBeGreaterThan(0);
      for (const url of urls) expect(url, story.id).toMatch(/^https:\/\//);
      const text = await page.getByTestId('story-sources').innerText();
      expect(text, story.id).not.toMatch(EMOJI);
      expect(await sidewaysOverflow(page), story.id).toEqual([]);
      await headerBack(page).click();
      await expect(page.getByTestId('story-sources')).toHaveCount(0);
    }
  });
});
