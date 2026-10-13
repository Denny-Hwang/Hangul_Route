import { describe, expect, it } from 'vitest';
import { fallbackPaths, getMessages } from '../resolve';

/**
 * F-ROUTE-001 R-10: before `flags.myRouteEnabled` flips, Spanish and Korean carry their own value for every string
 * the Learning Route page, the Home strip and the Route tab draw or read out: `learner.myRoute.*` and
 * `a11y.myRoute.*` (R-3, R-4b, with `home.strip.*` and `homeStrip*`, and the LR-3b / LR-5a / R-7c additions),
 * and the tab's `a11y.tabs.route` and `a11y.tabPosition` (LR-4). No English fallback under these paths.
 */
const ROUTE_PATHS = ['learner.myRoute.', 'a11y.myRoute.'] as const;
const ROUTE_KEYS = ['a11y.tabs.route', 'a11y.tabPosition'] as const;

const isRoutePath = (path: string): boolean =>
  ROUTE_PATHS.some((prefix) => path.startsWith(prefix)) || (ROUTE_KEYS as readonly string[]).includes(path);

const enStage = getMessages('en').a11y.myRoute;
const enGoalPart = enStage
  .stage(1, 'T', 'S', true, false, 0, true)
  .slice(enStage.stage(1, 'T', 'S', true, false, 0, false).length)
  .trim();
const enGrownGoalPart = enStage
  .stageGrownup('Mina', 1, 'T', 'S', true, false, 0, true)
  .slice(enStage.stageGrownup('Mina', 1, 'T', 'S', true, false, 0, false).length)
  .trim();

describe('Learning Route strings in es and ko (R-10)', () => {
  it('en: the goal parts the es and ko checks compare against are not empty', () => {
    expect(enGoalPart.length).toBeGreaterThan(0);
    expect(enGrownGoalPart).toContain('Mina');
  });

  for (const locale of ['es', 'ko'] as const) {
    it(`${locale}: no English fallback under learner.myRoute, a11y.myRoute, a11y.tabs.route and a11y.tabPosition`, () => {
      expect(fallbackPaths(locale).filter(isRoutePath)).toEqual([]);
    });

    it(`${locale}: a stage row read aloud names the goal between the here and start parts, as English does`, () => {
      const { stage, stageGrownup } = getMessages(locale).a11y.myRoute;
      // here only, here + goal, here + goal + start: each part is appended in that order.
      const here = stage(1, 'T', 'S', true, false, 0, false);
      const hereGoal = stage(1, 'T', 'S', true, false, 0, true);
      const goalPart = hereGoal.slice(here.length).trim();
      expect(hereGoal.startsWith(`${here} `)).toBe(true);
      expect(goalPart.length).toBeGreaterThan(0);
      const all = stage(1, 'T', 'S', true, true, 0, true);
      expect(all.startsWith(`${hereGoal} `)).toBe(true);
      const grownHere = stageGrownup('Mina', 1, 'T', 'S', true, false, 0, false);
      const grownGoal = stageGrownup('Mina', 1, 'T', 'S', true, false, 0, true);
      expect(grownGoal.startsWith(`${grownHere} `)).toBe(true);
      expect(grownGoal.slice(grownHere.length)).toContain('Mina');

      // The goal part is the locale's own words: not the English goal part, and not a copy of the here or start part.
      const startPart = all.slice(hereGoal.length).trim();
      expect(goalPart).not.toBe(enGoalPart);
      expect(here.endsWith(goalPart)).toBe(false);
      expect(goalPart).not.toBe(startPart);
      const grownGoalPart = grownGoal.slice(grownHere.length).trim();
      expect(grownGoalPart).not.toBe(enGrownGoalPart);
    });
  }
});
