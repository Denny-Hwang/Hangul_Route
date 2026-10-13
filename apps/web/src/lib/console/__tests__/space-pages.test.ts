import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as parentSpace from '@/app/(console)/parent/space/page';
import * as parentCurriculum from '@/app/(console)/parent/space/curriculum/page';
import * as parentLecture from '@/app/(console)/parent/space/lecture/page';
import * as parentLearner from '@/app/(console)/parent/space/learner/page';
import * as parentPlan from '@/app/(console)/parent/space/plan/page';
import * as parentRelink from '@/app/(console)/parent/space/relink/page';
import * as parentReport from '@/app/(console)/parent/space/report/page';
import * as parentRoute from '@/app/(console)/parent/space/route/page';
import * as parentSettings from '@/app/(console)/parent/space/settings/page';
import * as parentTransfers from '@/app/(console)/parent/space/transfers/page';
import * as teachSpace from '@/app/(console)/teach/space/page';
import * as teachCurriculum from '@/app/(console)/teach/space/curriculum/page';
import * as teachLecture from '@/app/(console)/teach/space/lecture/page';
import * as teachLearner from '@/app/(console)/teach/space/learner/page';
import * as teachPlan from '@/app/(console)/teach/space/plan/page';
import * as teachRelink from '@/app/(console)/teach/space/relink/page';
import * as teachReport from '@/app/(console)/teach/space/report/page';
import * as teachRoute from '@/app/(console)/teach/space/route/page';
import * as teachSettings from '@/app/(console)/teach/space/settings/page';
import * as teachTransfers from '@/app/(console)/teach/space/transfers/page';
import { SPACE_PAGES } from '../space-pages';

/**
 * F-APP-001 A-5b, section 3.8: every page under `app/(console)/teach/space/` has its family twin
 * under `app/(console)/parent/space/` and an entry in `SPACE_PAGES`, so a sibling page cannot ship
 * without its family URL (R-3). The walk finds every page file; the pairs below are imported once,
 * statically (a dynamic page import inside a test loads Next code while the file is collected).
 */
const consoleDir = fileURLToPath(new URL('../../../app/(console)/', import.meta.url));

/** The subpage of every `page.tsx` under `root`: '' for the space page itself, else its folder path. */
function subpages(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name === 'page.tsx') out.push(relative(root, dir).split(sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

const PAIRS: Record<string, [unknown, unknown]> = {
  '': [teachSpace.default, parentSpace.default],
  plan: [teachPlan.default, parentPlan.default],
  curriculum: [teachCurriculum.default, parentCurriculum.default],
  relink: [teachRelink.default, parentRelink.default],
  settings: [teachSettings.default, parentSettings.default],
  lecture: [teachLecture.default, parentLecture.default],
  route: [teachRoute.default, parentRoute.default],
  transfers: [teachTransfers.default, parentTransfers.default],
  learner: [teachLearner.default, parentLearner.default],
  report: [teachReport.default, parentReport.default],
};

describe('SPACE_PAGES and the /parent/space twins', () => {
  const teach = subpages(join(consoleDir, 'teach', 'space'));
  const parent = subpages(join(consoleDir, 'parent', 'space'));

  it('lists every page under teach/space, and nothing else', () => {
    expect([...SPACE_PAGES].sort()).toEqual(teach);
  });

  it('every teach/space page has a parent/space twin, and no twin lacks its teacher page', () => {
    expect(parent).toEqual(teach);
  });

  it('each twin is the same page component as its teacher page', () => {
    expect(Object.keys(PAIRS).sort()).toEqual(teach);
    for (const [sub, [teacherPage, familyPage]] of Object.entries(PAIRS)) {
      expect(typeof teacherPage, sub).toBe('function');
      expect(familyPage, sub).toBe(teacherPage);
    }
  });
});
