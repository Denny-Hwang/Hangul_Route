import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll, stages, themes } from '../../../content';
import { catalogueTrail } from '../catalogue-trail';
import type { LaterRowView, StageRowView } from '../view';
import { BUNDLE_8, STAGE_DEFS, THEME_DEFS, catalogOf } from './fixtures/bundle-2026-10';

/**
 * F-BROWSE-001 BR-5b: the Learning Route trail with no learner model. All lessons draws the learner's
 * own `TrailRow` in a no-progress state (§4.5): stage name, its one-liner and the availability word
 * the learner trail uses; no here tag, no start tag, no pip filled, no cursor.
 */

const EN = getMessages('en');
const ONE_LINERS = STAGE_DEFS.map((s, i) => ({ ...s, oneLinerEn: `One-liner ${i + 1}` }));

const trail = (over: Partial<Parameters<typeof catalogueTrail>[0]> = {}) =>
  catalogueTrail({
    episodes: BUNDLE_8.episodes,
    quests: BUNDLE_8.quests,
    catalog: catalogOf(BUNDLE_8),
    stages: ONE_LINERS,
    themes: THEME_DEFS,
    messages: EN,
    ...over,
  });

const stageRows = (rows: ReturnType<typeof trail>): StageRowView[] => rows.filter((r): r is StageRowView => r.kind === 'stage');
const laterRows = (rows: ReturnType<typeof trail>): LaterRowView[] => rows.filter((r): r is LaterRowView => r.kind === 'later');

describe('catalogueTrail', () => {
  it('covers the seven stages in order, a coming-later run merged into one row as the learner trail does', () => {
    const rows = trail();
    const covered = rows.flatMap((r) => (r.kind === 'stage' ? [r.order] : r.details.map((d) => d.order)));
    expect(covered).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const later = laterRows(rows);
    expect(later.length).toBeGreaterThan(0);
    for (const row of later) expect(row.stateWord).toBe(EN.learner.myRoute.state.later);
  });

  it('a stage row carries its name, its one-liner and the availability word, nothing about a learner', () => {
    for (const row of stageRows(trail())) {
      expect(row.title).toBe(STAGE_DEFS[row.order - 1]?.titleEn);
      expect(row.captions).toEqual([`One-liner ${row.order}`]);
      expect([EN.learner.myRoute.state.open, EN.learner.myRoute.state.taste]).toContain(row.stateWord);
      expect(row.tags).toEqual([]);
      expect(row.groups).toEqual([]);
      expect(row.fill).toBeNull();
      expect(row.fresh).toBe(false);
      // All lessons never opens a stage in place, so it never draws the R-7c letter wall.
      expect(row.letterWall).toBeNull();
      expect(row.badge).toBe('number');
      expect(row.a11yLabel).not.toMatch(/You are here|You started here|played/);
      // Screen readers hear the one-liner the row shows (the header label replaces its children).
      expect(row.a11yLabel).toContain(`One-liner ${row.order}`);
    }
  });

  it('a taste stage reads "A taste" on the secondary tone, an open stage the primary tone', () => {
    const rows = stageRows(trail());
    const taste = rows.filter((r) => r.stateWord === EN.learner.myRoute.state.taste);
    expect(taste.length).toBeGreaterThan(0);
    for (const r of taste) expect(r.tone).toBe('secondary');
    for (const r of rows.filter((x) => x.stateWord === EN.learner.myRoute.state.open)) expect(r.tone).toBe('primary');
  });

  it('cells are open or coming later, never done or the cursor, and an open cell opens its episode', () => {
    for (const row of stageRows(trail())) {
      for (const cell of row.cells) {
        expect([EN.learner.myRoute.state.open, EN.learner.myRoute.state.later]).toContain(cell.word);
        expect(cell.pips.every((p) => p.state !== 'done' && p.state !== 'known' && !p.isCursor && !p.isStart)).toBe(true);
        if (cell.word === EN.learner.myRoute.state.later) expect(cell.episodeId).toBeNull();
        else expect(cell.episodeId).not.toBeNull();
      }
    }
  });

  it('the trail line is dotted all the way: nothing reached yet', () => {
    const rows = trail();
    expect(rows.slice(0, -1).every((r) => r.connector === 'dotted')).toBe(true);
    expect(rows[rows.length - 1]?.connector).toBeNull();
  });

  it('a stage without a one-liner draws no empty caption; a theme without a title reads its key', () => {
    const rows = stageRows(trail({ stages: STAGE_DEFS, themes: THEME_DEFS.filter((t) => t.key !== 'crafts') }));
    for (const row of rows) expect(row.captions).toEqual([]);
    const crafts = rows[0]?.cells.find((c) => c.key.endsWith('-crafts'));
    expect(crafts?.themeLabel).toBe('crafts');
  });

  it('reads the UI locale through the messages it is given', () => {
    const ko = getMessages('ko');
    const rows = trail({ messages: ko });
    for (const r of laterRows(rows)) expect(r.stateWord).toBe(ko.learner.myRoute.state.later);
  });

  it('works on the bundled content: every stage covered, stage 1 open with its cells', () => {
    const rows = catalogueTrail({
      episodes: episodesAll,
      quests: questsAll,
      catalog: { quests: [] },
      stages,
      themes,
      messages: EN,
    });
    const covered = rows.flatMap((r) => (r.kind === 'stage' ? [r.order] : r.details.map((d) => d.order)));
    expect(covered).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const first = stageRows(rows)[0];
    expect(first?.order).toBe(1);
    expect(first?.captions).toEqual([stages[0]?.oneLinerEn]);
    expect(first?.cells.some((c) => c.episodeId !== null)).toBe(true);
  });
});

describe('TrailRow without a learner', () => {
  const src = readFileSync(join(__dirname, '..', '..', '..', 'screens', 'my-route', 'TrailRow.tsx'), 'utf8');
  const logic = readFileSync(join(__dirname, '..', 'catalogue-trail.ts'), 'utf8');

  it('TrailRow and the catalogue trail read no learner store, navigation or storage', () => {
    for (const text of [src, logic]) {
      expect(text).not.toMatch(/store\//);
      expect(text).not.toMatch(/@react-navigation/);
      expect(text).not.toMatch(/AsyncStorage|localStorage/);
    }
  });

  it('a stage row can be a plain button (All lessons: a row opens the Journey) instead of an expander', () => {
    expect(src).toMatch(/expandable\?: boolean/);
    expect(src).toMatch(/aria-expanded=\{expandable \? open : undefined\}/);
  });
});
