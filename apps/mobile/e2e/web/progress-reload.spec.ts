import { expect, test, type Page } from '@playwright/test';

/**
 * Audit UX-01 / L16 (roadmap PR-01): progress earned in one visit is still
 * there after a reload, and still there after the first write of the next
 * visit — which used to replace it with a blank record.
 */

type SpeechWindow = Window & { __spoken?: string[] };

interface Saved {
  cards: string[];
  sessions: number;
}

/**
 * The match-sound prompt is audio only, and headless Chromium has no Korean
 * voice. Stand in for speechSynthesis: keep what the app asks it to say and
 * end each utterance at once.
 */
async function captureSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as SpeechWindow).__spoken = spoken;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (u: SpeechSynthesisUtterance) => {
          spoken.push(u.text);
          setTimeout(() => u.onend?.call(u, new Event('end') as SpeechSynthesisEvent), 0);
        },
        cancel: () => undefined,
        getVoices: () => [],
      },
    });
  });
}

const spokenCount = (page: Page): Promise<number> => page.evaluate(() => (window as SpeechWindow).__spoken?.length ?? 0);

/** Every round answered right: tap the tile for the letter the app just said. */
async function playMatchSound(page: Page, rounds: number): Promise<void> {
  let heard = await spokenCount(page);
  await page.getByRole('button', { name: 'Play minigame' }).click();
  for (let round = 1; round <= rounds; round += 1) {
    await expect(page.getByText(`${round} / ${rounds}`)).toBeVisible();
    await page.waitForFunction((n) => ((window as SpeechWindow).__spoken?.length ?? 0) > n, heard);
    const prompt = await page.evaluate(() => (window as SpeechWindow).__spoken?.at(-1) ?? '');
    heard = await spokenCount(page);
    await page.getByRole('button', { name: /^Korean letter / }).filter({ hasText: prompt }).click();
  }
}

/** The learner's saved progress record, read straight from IndexedDB (idb-keyval). */
function savedProgress(page: Page): Promise<Saved | null> {
  return page.evaluate(
    () =>
      new Promise<Saved | null>((resolve) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          const done = (value: Saved | null): void => {
            db.close();
            resolve(value);
          };
          if (!db.objectStoreNames.contains('keyval')) return done(null);
          const store = db.transaction('keyval').objectStore('keyval');
          const keys = store.getAllKeys();
          keys.onerror = () => done(null);
          keys.onsuccess = () => {
            const key = keys.result.find((k) => typeof k === 'string' && k.startsWith('hr:progress:'));
            if (key === undefined) return done(null);
            const get = store.get(key);
            get.onerror = () => done(null);
            get.onsuccess = () => {
              const snap = JSON.parse(String(get.result)) as { cards: { cardId: string }[]; sessions: unknown[] };
              done({ cards: snap.cards.map((c) => c.cardId), sessions: snap.sessions.length });
            };
          };
        };
      }),
  );
}

test('progress earned before a reload survives it and the next write', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await captureSpeech(page);

  await page.goto('/');
  await page.getByRole('button', { name: "Let's start" }).click();
  await page.getByPlaceholder('Type your name').fill('Dami');
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start my journey' }).click();

  // Quest 1: intro, one game played perfectly, the rest skipped → 3 stars and the Book card.
  await page.getByRole('button', { name: 'Continue' }).click();
  await playMatchSound(page, 4);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(page.getByText('Wonderful!')).toBeVisible();
  await page.getByRole('button', { name: 'Back home' }).click();
  await expect(page.getByText(/^1 cards?$/)).toBeVisible();
  await expect.poll(() => savedProgress(page)).toMatchObject({ cards: ['card:book'] });
  const earned = await savedProgress(page);

  // Reload: the app opens on what was earned, not on an empty record.
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await expect(page.getByText(/^1 cards?$/)).toBeVisible();

  // First write of the new visit: replaying the quest starts a session.
  await page.getByText('Journey', { exact: true }).last().click();
  await page.getByRole('button', { name: 'letters episode for stage1' }).click();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(page.getByRole('button', { name: 'Leave quest' })).toBeVisible();
  await expect.poll(async () => (await savedProgress(page))?.sessions ?? 0).toBeGreaterThan(earned?.sessions ?? 0);
  expect((await savedProgress(page))?.cards).toEqual(['card:book']);

  // And it is all still there after another reload.
  await page.reload();
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  await expect(page.getByText(/^1 cards?$/)).toBeVisible();
  await page.getByText('Library', { exact: true }).last().click();
  await expect(page.getByText(/^1 of \d+ collected$/)).toBeVisible();

  expect(errors).toEqual([]);
});
