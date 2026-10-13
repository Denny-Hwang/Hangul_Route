import { CATALOG, freeLessonsFacts, freeRouteDays } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import type { Page } from '@playwright/test';
import { FREE_VOCAB_TOPIC_IDS } from '../../src/logic/content-access';
import { expect, test } from './fixtures';
import { onboardChild, onboardSelf } from './helpers';

/**
 * F-ENT-003 E3-8 (section 3.9.1, wireframe billing/plan-status-free-lessons): the free-plan lines
 * in F-BILL-002's Plan screen slots. They show only on a web build with the free-plan switch on, so
 * this spec runs only against such a build (E2E_CONTENT_GATING=1 with a dist built with
 * EXPO_PUBLIC_CONTENT_GATING_ENABLED=true); the release build, whose switch is off, keeps
 * "Stage 1 is always free." (plan-screen.spec.ts, which also covers the premium no-plan line: it is
 * plan guidance and shows with the switch off too). Every figure comes from data, never typed.
 */
test.skip(process.env.E2E_CONTENT_GATING !== '1', 'needs a web build with EXPO_PUBLIC_CONTENT_GATING_ENABLED=true');

const m = getMessages('en').caregiver.plan;
const facts = freeLessonsFacts(CATALOG);
const LINE = m.freePlan.line(facts.lessons, facts.letters, facts.minutes);
const TOPICS = m.freePlan.topics(FREE_VOCAB_TOPIC_IDS.length);
const SET_PLAN = m.freePlan.setPlan;
const SET_PLAN_WEB = m.freePlan.setPlanWeb;

const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 320, height: 568 },
  { width: 1280, height: 800 },
] as const;

const screenText = (page: Page): Promise<string> => page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' '));

/** Reads, edits and writes back one JSON value of the active learner (idb-keyval, `hr:<key>:<id>`), then reloads. */
async function seed(page: Page, entries: Array<{ prefix: string; value: unknown; merge?: 'quests' }>): Promise<void> {
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const store = (mode: IDBTransactionMode): IDBObjectStore => db.transaction('keyval', mode).objectStore('keyval');
          const active = store('readonly').get('hr:profiles:active');
          active.onerror = () => reject(active.error);
          active.onsuccess = () => {
            const id = JSON.parse(String(active.result)) as string;
            let left = rows.length;
            for (const row of rows) {
              const key = `hr:${row.prefix}:${id}`;
              const read = store('readonly').get(key);
              read.onerror = () => reject(read.error);
              read.onsuccess = () => {
                let value = row.value;
                if (row.merge === 'quests') {
                  const snap = (read.result ? JSON.parse(String(read.result)) : { profileId: id, updatedAt: '', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0 }) as {
                    quests: unknown[];
                    updatedAt: string;
                  };
                  snap.quests = [...snap.quests, ...(row.value as unknown[])];
                  snap.updatedAt = new Date().toISOString();
                  value = snap;
                }
                const put = store('readwrite').put(JSON.stringify(value), key);
                put.onerror = () => reject(put.error);
                put.onsuccess = () => {
                  left -= 1;
                  if (left === 0) {
                    db.close();
                    resolve();
                  }
                };
              };
            }
          };
        };
      }),
    entries,
  );
  await page.reload();
}

async function openPlanDetails(page: Page, name: string, card = 'Free plan'): Promise<void> {
  await page.goto('/');
  await expect(page.getByText(`Hi, ${name}!`)).toBeVisible();
  await page.addLocatorHandler(page.getByTestId('install-guide'), async (guide) => {
    await guide.getByRole('button', { name: 'Not now' }).click();
  });
  await page.getByRole('button', { name: 'Profile and settings' }).click();
  await expect(page.getByText(card, { exact: true })).toBeVisible();
  const details = page.getByRole('button', { name: 'Plan details', exact: true });
  await details.scrollIntoViewIfNeeded();
  await details.click();
}

async function expectCalm(page: Page): Promise<void> {
  const text = await screenText(page);
  expect(text).not.toMatch(/\$|\d+\.\d{2}|\/ year|lifetime|premium|unlock|\bbuy\b|promo|terms|trial|\bdays?\b/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test('family device, free: the free-plan line replaces "Stage 1 is always free.", with the word topics list', async ({ page }) => {
      await onboardChild(page, { name: 'Mina' });
      await openPlanDetails(page, 'Mina');

      await expect(page.getByText('Mina is on the free plan.')).toBeVisible();
      await expect(page.getByText(LINE)).toBeVisible();
      await expect(page.getByText('Stage 1 is always free.')).toHaveCount(0);
      // The sampler stories line (since F-STORY-001 PR 1.9 marks shelf samplers), then the word topics line.
      const items = page.getByRole('list').getByRole('listitem');
      await expect(items.last()).toHaveText(TOPICS);
      const texts = await items.allInnerTexts();
      expect(texts.length).toBeLessThanOrEqual(2);
      if (texts.length === 2) {
        const stories = Number(/^(\d+) /.exec(texts[0] ?? '')?.[1] ?? 0);
        expect(stories).toBeGreaterThan(0);
        expect(texts[0]).toBe(m.freePlan.stories(stories));
      }
      await expect(page.getByText(/teacher can open|finished the free lessons/)).toHaveCount(0);
      await expectCalm(page);
      await page.screenshot({ path: test.info().outputPath(`plan-free-family-${vp.width}.png`), fullPage: true });
    });
  });
}

test.describe('situations', () => {
  test.use({ viewport: VIEWPORTS[0] });

  test('self learner whose only space is a class: the class line', async ({ page }) => {
    await onboardSelf(page, { name: 'Rio' });
    await seed(page, [
      {
        prefix: 'memberships',
        value: [{ spaceId: 'space:c', kind: 'class', name: 'Sunday Class A', role: 'learner', joinedAt: '2026-10-01T00:00:00.000Z' }],
      },
      // The server answered free for this learner (no fail-open premium for a member).
      { prefix: 'tier', value: { tier: 'free', source: null, validUntil: null, fetchedAt: new Date().toISOString() } },
    ]);
    await openPlanDetails(page, 'Rio');

    await expect(page.getByText("You're on the free plan.")).toBeVisible();
    await expect(page.getByText(LINE)).toBeVisible();
    await expect(page.getByText('Your teacher can open every lesson for the class.')).toBeVisible();
    await expectCalm(page);
    await page.screenshot({ path: test.info().outputPath('plan-free-self-class-375.png'), fullPage: true });
  });

  test('family device, every free lesson finished: the free-end line', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    const at = '2026-10-01T00:00:00.000Z';
    const quests = freeRouteDays(CATALOG).flatMap((day) =>
      day.questIds.map((questId) => ({ questId, episodeId: day.episodeId, startedAt: at, completedAt: at, stars: 3, attempts: 1, accuracy: 1 })),
    );
    await seed(page, [{ prefix: 'progress', value: quests, merge: 'quests' }]);
    await openPlanDetails(page, 'Mina');

    await expect(page.getByText(LINE)).toBeVisible();
    await expect(page.getByText('Mina finished the free lessons.')).toBeVisible();
    await expectCalm(page);
    await page.screenshot({ path: test.info().outputPath('plan-free-family-free-end-375.png'), fullPage: true });
  });

  test('full route from the family plan with no plan: the guidance line and the grown-up page line, no link', async ({ page }) => {
    await onboardChild(page, { name: 'Mina' });
    await seed(page, [
      { prefix: 'tier', value: { tier: 'premium', source: { kind: 'family', name: 'Kim family', spaceId: 'space:family' }, validUntil: null, fetchedAt: new Date().toISOString() } },
    ]);
    await openPlanDetails(page, 'Mina', 'Full route');

    await expect(page.getByText('Mina has the full route.')).toBeVisible();
    await expect(page.getByText(SET_PLAN)).toBeVisible();
    await expect(page.getByText(SET_PLAN_WEB)).toBeVisible();
    await expect(page.getByRole('link')).toHaveCount(0);
    await expect(page.getByText(LINE)).toHaveCount(0);
    await expectCalm(page);
    await page.screenshot({ path: test.info().outputPath('plan-free-full-no-plan-375.png'), fullPage: true });
  });
});
