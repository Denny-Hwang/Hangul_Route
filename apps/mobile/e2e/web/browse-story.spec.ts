import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { onboardChild } from './helpers';
import { shot } from './shots';
import { nextPage, position } from './story-reader-helpers';

/**
 * F-BROWSE-001 BR-8 (sections 4.7, 4.8 and 4.10): a story previewed in All lessons writes nothing. The release
 * build holds no reviewed story yet (F-STORY-004 D14), so this runs on the fixture bundle, whose ready
 * fixture story passes the review gate:
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile test:e2e:web browse-story
 *
 * The story opens from its item page as the learner replay reader (no rounds, no bookmark, no progress) under
 * the preview strip, ends on the preview end screen's story form, and its sources are copy-only.
 */
const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const STORY = 'story:hangul-day';
const PASS_KEY = 'hr:browse:pass';
const LEARNER_QUEUE = 'hr:telemetry:queue';
const SEEDED_QUEUE = JSON.stringify([{ id: 'e2e-learner-1', name: 'quest.completed', profileId: 'e2e-profile', at: '2026-10-12T08:00:00.000Z' }]);

/** Every key and value of the device's `keyval-store` (IndexedDB), as `platform/storage.web` keeps them. */
function readAllStored(page: Page): Promise<Record<string, string>> {
  return page.evaluate(
    () =>
      new Promise<Record<string, string>>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const out: Record<string, string> = {};
          const tx = db.transaction('keyval', 'readonly');
          const cursor = tx.objectStore('keyval').openCursor();
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (!c) return;
            out[String(c.key)] = typeof c.value === 'string' ? c.value : JSON.stringify(c.value);
            c.continue();
          };
          tx.oncomplete = () => {
            db.close();
            resolve(out);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

function putStored(page: Page, key: string, json: string): Promise<void> {
  return page.evaluate(
    ([k, v]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('keyval', 'readwrite');
          tx.objectStore('keyval').put(v, k);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    [key, json] as const,
  );
}

test.describe('All lessons, a story preview (fixture bundle)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1, build:web:fixtures)');

  test('a story plays as the learner replay reader under the strip, ends on the story end screen and writes nothing', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    await page.goto('/');
    await expect(page.getByText('Hi, Mina!')).toBeVisible();
    await putStored(page, LEARNER_QUEUE, SEEDED_QUEUE);
    const before = await readAllStored(page);
    await page.evaluate((key) => {
      const at = Date.now();
      sessionStorage.setItem(key, JSON.stringify({ v: 1, scope: 'full', source: 'gate', issuedAt: at, seen: at }));
    }, PASS_KEY);
    await page.evaluate((id) => window.location.assign(`/browse#t=${id}&s=gate`), STORY);
    await expect(page.getByTestId('browse-item')).toBeVisible();
    await expect(page.locator('html[data-hr-boot="settled"]')).toHaveCount(1);

    // The sources page from the item page: Copy link only, no Open, and no strip (it is not a lesson screen).
    await page.getByTestId('browse-see-sources').click();
    await expect(page.getByTestId('story-sources-title')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open link' })).toHaveCount(0);
    await expect(page.getByTestId('preview-strip')).toHaveCount(0);
    await page.getByTestId('story-sources-back').click();
    await expect(page.getByTestId('browse-preview')).toHaveText('Preview this story');
    await expect(page.getByTestId('browse-preview-questions')).toBeVisible();

    // The replay reader at scene 1 of the lowest level, under the strip.
    await page.getByTestId('browse-preview').click();
    await expect(page.getByTestId('preview-strip')).toBeVisible();
    await expect(position(page)).toHaveText(/^1 \/ \d+$/);
    await shot(page, 'br8-browse-story-reader-pixel5');
    const total = Number(/\/ (\d+)$/.exec(await position(page).innerText())?.[1] ?? '0');
    for (let i = 1; i <= total; i += 1) await nextPage(page);
    await page.getByTestId('story-reader-end-primary').click();

    // The story form of the end screen: no stars, no card.
    await expect(page.getByRole('heading', { name: 'That is the whole story.' })).toBeVisible();
    await expect(page.getByText('A learner can read it again any time.')).toBeVisible();
    await expect(page.getByTestId('browse-end-card')).toHaveCount(0);
    await expect(page.getByTestId('browse-end-again')).toHaveText('Read again');
    await shot(page, 'br8-browse-story-end-pixel5');
    await page.getByTestId('browse-end-back').click();
    await expect(page.getByTestId('browse-item')).toBeVisible();

    const after = await readAllStored(page);
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]);
    expect(changed.filter((k) => !k.startsWith('hr:browse:'))).toEqual([]);
    expect(after[LEARNER_QUEUE]).toBe(SEEDED_QUEUE);
  });
});
