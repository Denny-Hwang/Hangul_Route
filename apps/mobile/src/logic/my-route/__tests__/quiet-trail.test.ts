import type { ThemeKey } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { buildMyRoute } from '../model';
import { localizedRouteContent, routeModelInput } from '../route-input';
import type { MyRouteModel } from '../types';
import { emptySnapshot, myRouteView, readyOnce, routeHasClosed, type StageRowView, type TrailRowView } from '../view';

/**
 * The quiet trail of the Route tab (owner request 2026-10-16, item 8; design/wireframes/journey/learning-route.md A),
 * on the shipped bundle with a brand-new learner: no "Open" pill or cell word while nothing is closed, "Ready when you
 * are" once, and the stages after the one the learner is on as one-line rows.
 */

const EN = getMessages('en');
const localized = localizedRouteContent('en');
const THEMES = Object.fromEntries(localized.themes.map((t) => [t.key, t.titleEn])) as Record<ThemeKey, string>;
const NOW = new Date('2026-10-16T12:00:00.000Z');

const freshModel = (): MyRouteModel => buildMyRoute(routeModelInput({ snapshot: emptySnapshot('p1'), tier: 'premium', localized, now: NOW }));
const viewOf = (model: MyRouteModel, viewer: 'self' | 'grownup' = 'self') =>
  myRouteView({ model, messages: EN, viewer, name: 'Mina', themeTitles: THEMES, nextTitle: null, hasStories: false, seen: undefined });
const stageRows = (rows: readonly TrailRowView[]): StageRowView[] => rows.filter((r): r is StageRowView => r.kind === 'stage');

describe('the quiet trail for a brand-new learner (nothing closed)', () => {
  const model = freshModel();
  const rows = stageRows(viewOf(model).trail);

  it('the shipped bundle has full stages after Stage 1 and nothing closed', () => {
    expect(routeHasClosed(model)).toBe(false);
    expect(rows.length).toBeGreaterThan(1);
  });

  it('no open stage draws an "Open" pill; its label still says it', () => {
    for (const row of rows) {
      const source = model.stages.find((s) => s.stage === row.stage);
      if (source?.state === 'open' && source.availability !== 'taste') {
        expect(row.pillShown, row.stage).toBe(false);
        expect(row.a11yLabel).toContain(EN.learner.myRoute.state.open);
      }
    }
  });

  it('no open cell draws its "Open" word', () => {
    const cells = rows.flatMap((r) => r.cells);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) if (cell.word === EN.learner.myRoute.state.open) expect(cell.wordShown, cell.key).toBe(false);
  });

  it('"Ready when you are" shows once, on the stage the learner is on', () => {
    const ready = EN.learner.myRoute.caption.ready;
    const withReady = rows.filter((r) => r.captions.includes(ready));
    expect(withReady).toHaveLength(1);
    expect(withReady[0]?.stage).toBe(model.stages.find((s) => s.here)?.stage);
  });

  it('the stages after the one the learner is on are one-line rows; the stage they are on is not', () => {
    const hereAt = model.stages.findIndex((s) => s.here);
    for (const row of rows) {
      const at = model.stages.findIndex((s) => s.stage === row.stage);
      const source = model.stages[at];
      expect(row.compact, row.stage).toBe(at > hereAt && source?.state === 'open' && source.done === 0);
    }
    expect(rows.find((r) => r.stage === model.stages[hereAt]?.stage)?.compact).toBe(false);
    expect(rows.some((r) => r.compact === true)).toBe(true);
  });

  it('the grown-up page says "Not started yet" once, never "Ready when Mina is"', () => {
    const grownUp = stageRows(viewOf(model, 'grownup').trail);
    const lines = grownUp.flatMap((r) => r.captions);
    expect(lines.filter((l) => l === EN.caregiver.journey.ready('Mina'))).toHaveLength(1);
    expect(EN.caregiver.journey.ready('Mina')).toBe('Not started yet');
    expect(lines.join(' ')).not.toContain('Ready when');
  });
});

describe('a closed lesson keeps the words', () => {
  it('with a not-open quest on the route, open stages keep their pill and open cells their word', () => {
    const base = routeModelInput({ snapshot: emptySnapshot('p1'), tier: 'free', localized, now: NOW });
    const model = buildMyRoute({ ...base, isQuestOpen: (id) => id.startsWith('quest:stage1-') });
    expect(routeHasClosed(model)).toBe(true);
    const rows = stageRows(viewOf(model).trail);
    expect(rows.every((r) => r.pillShown === true)).toBe(true);
    expect(rows.flatMap((r) => r.cells).every((c) => c.wordShown === true)).toBe(true);
  });
});

describe('readyOnce', () => {
  it('keeps the first row with the line and drops it from the rest, other lines untouched', () => {
    const row = (stage: string, captions: string[]) => ({ kind: 'stage', stage, captions }) as unknown as TrailRowView;
    const out = readyOnce([row('stage1', ['Ready']), row('stage2', ['Ready', 'New quests joined']), row('stage3', ['2 played'])], 'Ready');
    expect(out.map((r) => (r as StageRowView).captions)).toEqual([['Ready'], ['New quests joined'], ['2 played']]);
  });
});
