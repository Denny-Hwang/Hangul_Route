import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Episode, RouteCatalog, StageKey, ThemeKey } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, gridEpisodes, stages, themes } from '../../content';
import {
  NO_CELL_MARKS,
  journeyCell,
  journeyCellState,
  journeyGridRows,
  learnerCellMarks,
  type JourneyMarksOf,
} from '../journey-grid';
import { shelfIndex, story } from '../story/__tests__/shelf-fixture';

/**
 * F-BROWSE-001 BR-5b: the Journey grid out of `JourneyScreen`, so All lessons can draw the learner's
 * own grid with nothing done. The learner marks keep today's look (completed tint, placed-out outline,
 * start pin); with no marks every cell is drawn as a learner with nothing done sees it.
 */

const ep = (id: string, stage: StageKey, theme: ThemeKey, status: Episode['status'], questIds = [`quest:${id}-q1`]): Episode => ({
  id: `episode:${id}`,
  stage,
  theme,
  order: 1,
  titleEn: id,
  hoyaIntroEn: 'hi',
  questIds,
  rewardCardIds: [],
  estimatedMinutes: 5,
  status,
});

const GRID: Episode[] = [
  ep('s1-letters', 'stage1', 'letters', 'shipped', ['quest:a', 'quest:b']),
  ep('s1-life', 'stage1', 'life', 'shipped'),
  ep('s2-letters', 'stage2', 'letters', 'preview'),
];

const catalogOf = (episodes: readonly Episode[]): RouteCatalog => ({
  quests: episodes.flatMap((e, i) =>
    e.questIds.map((id, k) => ({ id, episodeId: e.id, stage: e.stage, theme: e.theme, order: i * 10 + k, teaches: [], playable: true, grid: true })),
  ),
});

describe('journeyCellState', () => {
  it('open for a shipped or ready episode, later for none or a preview one', () => {
    expect(journeyCellState(undefined)).toBe('later');
    expect(journeyCellState({ status: 'preview' })).toBe('later');
    expect(journeyCellState({ status: 'shipped' })).toBe('open');
    expect(journeyCellState({ status: 'ready' })).toBe('open');
  });
});

describe('journeyCell', () => {
  const base = { gridEpisodes: GRID, paneMode: false, selectedId: null };

  it('an open cell is a button to its episode, with nothing done when no marks are given', () => {
    const cell = journeyCell({ ...base, stage: 'stage1', theme: 'letters' });
    expect(cell).toEqual({
      key: 'stage1-letters',
      stage: 'stage1',
      theme: 'letters',
      episodeId: 'episode:s1-letters',
      state: 'open',
      selected: false,
      disabled: false,
      marks: NO_CELL_MARKS,
      model: { stage: 'stage1', theme: 'letters', kind: 'lesson', episodeId: 'episode:s1-letters', completed: false, storyCount: 0, storiesFinished: 0 },
    });
  });

  it('one pane: a later cell does nothing; two panes: a preview cell is selectable, an empty cell never', () => {
    expect(journeyCell({ ...base, stage: 'stage2', theme: 'letters' }).disabled).toBe(true);
    expect(journeyCell({ ...base, paneMode: true, stage: 'stage2', theme: 'letters' }).disabled).toBe(false);
    const empty = journeyCell({ ...base, paneMode: true, stage: 'stage3', theme: 'crafts' });
    expect(empty).toMatchObject({ episodeId: null, state: 'later', disabled: true });
  });

  it('selected only on two panes and only for the selected episode', () => {
    expect(journeyCell({ ...base, selectedId: 'episode:s1-life', stage: 'stage1', theme: 'life' }).selected).toBe(false);
    expect(journeyCell({ ...base, paneMode: true, selectedId: 'episode:s1-life', stage: 'stage1', theme: 'life' }).selected).toBe(true);
    expect(journeyCell({ ...base, paneMode: true, selectedId: 'episode:s1-life', stage: 'stage1', theme: 'letters' }).selected).toBe(false);
  });

  it('asks the marks for each cell with its stage, theme and episode', () => {
    const seen: [StageKey, ThemeKey, string | undefined][] = [];
    const marksOf: JourneyMarksOf = (stage, theme, episode) => {
      seen.push([stage, theme, episode?.id]);
      return { completed: true, placedOut: false, isStart: false };
    };
    expect(journeyCell({ ...base, stage: 'stage1', theme: 'letters', marksOf }).marks.completed).toBe(true);
    expect(seen).toEqual([['stage1', 'letters', 'episode:s1-letters']]);
  });

  it('the cell episode is the first by volume, as episodeFor picks it', () => {
    const vol2 = { ...ep('s1-letters-v2', 'stage1', 'letters', 'shipped'), volume: 2 };
    const cell = journeyCell({ ...base, gridEpisodes: [vol2, ...GRID], stage: 'stage1', theme: 'letters' });
    expect(cell.episodeId).toBe('episode:s1-letters');
  });
});

describe('journeyCell with heritage stories (F-STORY-005 PR 5.5a)', () => {
  const base = { gridEpisodes: GRID, paneMode: false, selectedId: null };
  const jikji = story('jikji-metal-type', { recommendedStage: 2, theme: 'letters' });
  const sejong = story('sejong-new-letters', { recommendedStage: 1, theme: 'letters' });
  const storyEntries = shelfIndex([jikji, sejong]);

  it('a preview cell with a story is a stories-only button, on one pane and on two, and never selected', () => {
    for (const paneMode of [false, true]) {
      const cell = journeyCell({ ...base, paneMode, selectedId: 'episode:s2-letters', storyEntries, stage: 'stage2', theme: 'letters' });
      expect(cell).toMatchObject({ state: 'later', disabled: false, selected: false });
      expect(cell.model).toMatchObject({ kind: 'stories-only', storyCount: 1 });
    }
  });

  it('an empty cell with a story is a stories-only button too', () => {
    const empty = journeyCell({ ...base, storyEntries: shelfIndex([story('x', { recommendedStage: 3, theme: 'crafts' })]), stage: 'stage3', theme: 'crafts' });
    expect(empty).toMatchObject({ episodeId: null, disabled: false });
    expect(empty.model.kind).toBe('stories-only');
  });

  it('a lesson cell counts its stories and opens as before', () => {
    const cell = journeyCell({ ...base, storyEntries, stage: 'stage1', theme: 'letters' });
    expect(cell).toMatchObject({ episodeId: 'episode:s1-letters', state: 'open', disabled: false });
    expect(cell.model).toMatchObject({ kind: 'lesson', storyCount: 1 });
  });

  it('the model reads the learner quests: complete cells and finished stories', () => {
    const quests = [
      { questId: 'quest:a', episodeId: 'episode:s1-letters', completedAt: '2026-10-01T00:00:00.000Z' },
      { questId: 'quest:b', episodeId: 'episode:s1-letters', completedAt: '2026-10-01T00:00:00.000Z' },
      { questId: 'quest:story-sejong-new-letters-listen', episodeId: 'episode:shelf-sejong-new-letters', completedAt: '2026-10-01T00:00:00.000Z' },
    ];
    expect(journeyCell({ ...base, storyEntries, quests, stage: 'stage1', theme: 'letters' }).model).toMatchObject({
      completed: true,
      storiesFinished: 1,
    });
  });

  it('rows pass the stories to every cell; the stage pill still counts lesson cells only', () => {
    const rows = journeyGridRows({ stages, themes, ...base, storyEntries });
    expect(rows[1]?.availability).toBe('soon');
    expect(rows[1]?.cells[0]?.model.kind).toBe('stories-only');
    expect(rows.flatMap((r) => r.cells).filter((c) => c.model.storyCount > 0)).toHaveLength(2);
  });
});

describe('journeyGridRows', () => {
  it('one row per stage in order, five cells per row in theme order, with the stage availability', () => {
    const rows = journeyGridRows({ stages, themes, gridEpisodes: GRID, paneMode: false, selectedId: null });
    expect(rows.map((r) => r.stage)).toEqual(stages.map((s) => s.key));
    for (const row of rows) expect(row.cells.map((c) => c.theme)).toEqual(themes.map((t) => t.key));
    expect(rows[0]?.availability).toBe('open');
    expect(rows[1]?.availability).toBe('soon');
    const taste = journeyGridRows({ stages, themes, gridEpisodes: [...GRID, ep('s2-life', 'stage2', 'life', 'shipped')], paneMode: false, selectedId: null });
    expect(taste[1]?.availability).toBe('taste');
  });

  it('with no marks nothing is done anywhere, and every shipped bundled episode is an open cell', () => {
    const grid = gridEpisodes(episodesAll);
    const rows = journeyGridRows({ stages, themes, gridEpisodes: grid, paneMode: false, selectedId: null });
    const cells = rows.flatMap((r) => r.cells);
    expect(cells.every((c) => c.marks === NO_CELL_MARKS)).toBe(true);
    // Ships dark (F-STORY-005 §6): without story entries no cell is stories-only and none has a count.
    expect(cells.every((c) => c.model.storyCount === 0 && c.model.kind !== 'stories-only')).toBe(true);
    const openIds = new Set(cells.filter((c) => c.state === 'open').map((c) => c.episodeId));
    const firstShipped = grid.filter((e) => e.status === 'shipped' && cells.some((c) => c.episodeId === e.id));
    expect(firstShipped.length).toBeGreaterThan(0);
    for (const e of firstShipped) expect(openIds.has(e.id)).toBe(true);
  });
});

describe('learnerCellMarks (today’s learner look)', () => {
  const catalog = catalogOf(GRID);
  const s1 = GRID[0] as Episode;
  const s2 = GRID[2] as Episode;

  it('nothing done and no level check: no mark', () => {
    const marksOf = learnerCellMarks({ quests: [], marks: null, catalog, completedIds: new Set() });
    expect(marksOf('stage1', 'letters', s1)).toEqual(NO_CELL_MARKS);
  });

  it('completed only when every quest of the episode is done', () => {
    const done = (ids: string[]) => ids.map((questId) => ({ questId, episodeId: s1.id, completedAt: '2026-10-01T00:00:00.000Z' }));
    const half = learnerCellMarks({ quests: done(['quest:a']), marks: null, catalog, completedIds: new Set(['quest:a']) });
    expect(half('stage1', 'letters', s1).completed).toBe(false);
    const all = learnerCellMarks({ quests: done(['quest:a', 'quest:b']), marks: null, catalog, completedIds: new Set(['quest:a', 'quest:b']) });
    expect(all('stage1', 'letters', s1).completed).toBe(true);
  });

  it('placed out when every quest is done or placed out and not all done; never on a completed or preview cell', () => {
    const marks = { placedOut: new Set(['quest:a', 'quest:b', 'quest:s2-letters-q1']), start: null };
    const marksOf = learnerCellMarks({ quests: [], marks, catalog, completedIds: new Set() });
    expect(marksOf('stage1', 'letters', s1).placedOut).toBe(true);
    expect(marksOf('stage2', 'letters', s2).placedOut).toBe(false);
    expect(marksOf('stage3', 'letters', undefined).placedOut).toBe(false);
  });

  it('the start pin sits on the start cell only', () => {
    const marks = { placedOut: new Set<string>(), start: { episodeId: s1.id, stage: 'stage1' as const, theme: 'letters' as const } };
    const marksOf = learnerCellMarks({ quests: [], marks, catalog, completedIds: new Set() });
    expect(marksOf('stage1', 'letters', s1).isStart).toBe(true);
    expect(marksOf('stage1', 'life', GRID[1]).isStart).toBe(false);
  });
});

describe('JourneyGrid sources', () => {
  const SRC = join(__dirname, '..', '..');
  const grid = readFileSync(join(SRC, 'components', 'JourneyGrid.tsx'), 'utf8');
  const screen = readFileSync(join(SRC, 'screens', 'journey', 'JourneyScreen.tsx'), 'utf8');

  it('the grid reads no learner store, no navigation and no telemetry, so All lessons can reuse it', () => {
    expect(grid).not.toMatch(/from '\.\.\/store\//);
    expect(grid).not.toMatch(/@react-navigation/);
    expect(grid).not.toMatch(/platform\/telemetry/);
    expect(grid).not.toMatch(/AsyncStorage|localStorage/);
  });

  it('the grid names its design references and uses tokens only', () => {
    expect(grid).toMatch(/design\/wireframes\/journey\/grid\.md/);
    expect(grid).toMatch(/design\/wireframes\/browse\/home\.md/);
    expect(grid).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it('labels every cell with cellLabel and keeps the count mark out of the screen reader (F-STORY-005 PR 5.5a)', () => {
    expect(grid).toMatch(/design\/wireframes\/journey\/grid-with-stories\.md/);
    expect(grid).toContain('accessibilityLabel={cellLabel(model, stage, theme, messages.a11y.journeyCell, cell.marks)}');
    expect(grid).not.toMatch(/a11y\.gridCell/);
    expect(grid).toMatch(/aria-hidden\s+importantForAccessibility="no-hide-descendants"\s+accessibilityElementsHidden/);
  });

  it('each stage row is an anchor for scrolling to a stage, measured only when asked', () => {
    expect(grid).toContain('testID={`journey-stage-${row.stage}`}');
    expect(grid).toMatch(/onStageLayout\?: \(stage: StageKey, y: number\) => void/);
    expect(grid).toContain('onLayout={onStageLayout ? (e) => onStageLayout(row.stage, e.nativeEvent.layout.y) : undefined}');
    expect(screen).not.toContain('onStageLayout');
  });

  it('the learner Journey draws the extracted grid with the learner marks', () => {
    expect(screen).toContain('<JourneyGrid');
    expect(screen).toContain('learnerCellMarks(');
    expect(screen).not.toMatch(/function GridCell\(/);
  });
});
