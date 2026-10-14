import type { Page } from '@playwright/test';
import { CATALOG, generateCurriculum, toMeta, toPlanItems } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';
import { completeChildForm, keepSidewaysIfAsked, readStored, seedStored, waitForSaved } from './helpers';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-ENT-003 E3-5 (section 3.7; wireframe journey/grid-plan-and-access; design/components/RouteMarkers/spec.md):
 * the Journey's route marks on the default build (the free-plan switch is off, so no dotted ring exists).
 * Next is the cursor triangle over the cell of the one next quest, the legend line lists only the marks
 * drawn, a coming-later cell is empty (no lock glyph, D5), and a learner with a plan sees the In your plan
 * ring. The switch-on states (the dotted ring, the taste note rule) are unit-tested and drawn by the
 * E3-11 e2e build with the switch on.
 */

const LETTERS = /^Stage 1 Hangul, Letters & Books: lesson/;
/** RouteMarkers spec, Geometry: the Next tip `borderWidth.base + spacing.xxs` below the cell's outer top edge. */
const TIP_INSET = 4;
/** The 19.2 x 9.6 triangle reaches this far above the cell. */
const TRIANGLE_ABOVE = 5.6;

async function newLearner(page: Page, width = 320, height = 568): Promise<string> {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await page.getByRole('button', { name: "Let's start" }).click();
  await completeChildForm(page, { name: 'Dami' });
  await waitForSaved(page, ['profiles']);
  await page.goto('/');
  await expect(page.getByText('Hi, Dami!')).toBeVisible();
  return (await readStored<Array<{ id: string }>>(page, 'profiles'))?.[0]?.id ?? '';
}

async function openJourney(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
  await page.getByText('Journey', { exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Heritage Journey' })).toBeVisible();
}

test.describe('Journey route marks (F-ENT-003 E3-5)', () => {
  test('a new learner: the Next triangle over Meet the Letters, a legend with Next only, no ring and no lock', async ({ page }) => {
    await newLearner(page);
    await openJourney(page);

    const next = page.getByTestId('journey-next-stage1-letters');
    await expect(next).toBeVisible();
    await expect(page.locator('[data-testid^="journey-next-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid^="journey-ring-"]')).toHaveCount(0);

    // The words are on the page (the legend) and in the label; the marks themselves are hidden.
    const legend = page.getByTestId('journey-legend');
    await expect(legend).toHaveText('Next');
    await expect(legend).toHaveAttribute('aria-hidden', 'true');
    await expect(next).toHaveAttribute('aria-hidden', 'true');
    const cell = page.getByRole('button', { name: LETTERS });
    await expect(cell).toHaveAccessibleName(/\. Next\.$/);
    await expect(page.getByRole('button', { name: /Next\.$/ })).toHaveCount(1);

    // The triangle sits over the cell's top edge, centred, tip inside the cell, not clipped by the row.
    const [tri, box] = await Promise.all([next.boundingBox(), cell.boundingBox()]);
    expect(tri && box).toBeTruthy();
    if (tri && box) {
      expect(tri.y).toBeLessThan(box.y);
      expect(box.y - tri.y).toBeLessThanOrEqual(8);
      expect(Math.abs(tri.x + tri.width / 2 - (box.x + box.width / 2))).toBeLessThan(1);
      // Not clipped: every ancestor that clips (overflow other than visible) holds the whole drawn triangle.
      // (The mark takes no pointer events, so a hit test cannot see it.)
      const drawn = await next.evaluate((el) => {
        const path = el.querySelector('path');
        if (!path) return null;
        const r = path.getBoundingClientRect();
        let clipped = false;
        for (let a = el.parentElement; a; a = a.parentElement) {
          const cs = getComputedStyle(a);
          if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
          const b = a.getBoundingClientRect();
          if (r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5 || r.left < b.left - 0.5 || r.right > b.right + 0.5) clipped = true;
        }
        return { top: r.top, bottom: r.bottom, height: r.height, clipped };
      });
      expect(drawn).not.toBeNull();
      expect(drawn?.clipped).toBe(false);
      expect(drawn!.height).toBeGreaterThan(9);
      // The spec's geometry, measured from the cell's outer edge: the tip 4 dp inside (NEXT_TIP_INSET),
      // the triangle's top 5.6 dp above the cell.
      expect(Math.abs(drawn!.bottom - box.y - TIP_INSET)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(box.y - drawn!.top - TRIANGLE_ABOVE)).toBeLessThanOrEqual(0.5);
    }

    // A coming-later cell is sunken and empty: no glyph (D5), no lock anywhere on the grid.
    const later = page.getByRole('button', { name: /^Stage 3 Sentences, Nature & Animals, coming soon$/ });
    await expect(later).toBeDisabled();
    await expect(later.locator('svg')).toHaveCount(0);
    await expect(page.getByText(/locked|premium|not open yet/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath('journey-next-320.png') });
  });

  test('a learner with a plan: the In your plan ring on the plan cells, the legend names it', async ({ page }) => {
    const id = await newLearner(page);
    const today = new Date().toISOString().slice(0, 10);
    const draft = generateCurriculum(
      {
        audience: 'self',
        level: { stage: 'stage1', band: 0 },
        startDate: today,
        weeks: 8,
        sessionsPerWeek: 7,
        sessionDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        minutesPerSession: 15,
        goals: { focus: 'balanced', motivation: 'kculture' },
        unlockedStages: ['stage1'],
        reviewEvery: 4,
      },
      CATALOG,
    );
    const now = new Date().toISOString();
    const route = { id: 'route:e2e-marks', createdAt: now, updatedAt: now, archivedAt: null, meta: toMeta(draft), items: toPlanItems(draft) };
    const progress = (await readStored<Record<string, unknown>>(page, `progress:${id}`)) ?? {
      profileId: id,
      updatedAt: now,
      episodes: [],
      quests: [],
      cards: [],
      sessions: [],
      homework: [],
      reviews: [],
      streakDays: 0,
    };
    await seedStored(page, `progress:${id}`, { ...progress, selfRoute: route });
    await expect(page.getByText('Hi, Dami!')).toBeVisible();
    await openJourney(page);

    await expect(page.locator('[data-testid^="journey-ring-inPlan-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="journey-ring-notOpen-"]')).toHaveCount(0);
    await expect(page.getByTestId('journey-legend')).toHaveText(/^Next\s*In your plan$/);
    await expect(page.getByRole('button', { name: /In your plan\.$/ }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath('journey-plan-320.png') });
  });
});
