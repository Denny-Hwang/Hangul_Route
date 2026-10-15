import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Episode, HomeworkAssignment, ProgressSnapshot, RouteCatalog, StageKey, ThemeKey } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, gridEpisodes, questsAll, stages, themes } from '../../content';
import { getMessages } from '@hangul-route/i18n';
import {
  NO_CELL_ACCESS,
  NO_CELL_MARKS,
  journeyCell,
  journeyLegend,
  labelMarksOf,
  withAccessWords,
  journeyCellState,
  journeyGridRows,
  learnerCellMarks,
  type JourneyAccessInput,
  type JourneyMarksOf,
} from '../journey-grid';
import { questOpenPredicate } from '../content-access';
import { cellLabel } from '../journey-cells';
import { planView, routeNext, type RouteNextInput } from '../route-next';
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

  it('later for a draft episode: the same playable rule as cellModel (F-STORY-005 PR 5.5a)', () => {
    expect(journeyCellState({ status: 'draft' })).toBe('later');
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
      access: NO_CELL_ACCESS,
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

  it('a draft grid episode draws as a placeholder, and as a stories-only button once it has a story', () => {
    const grid = [...GRID, ep('s3-life', 'stage3', 'life', 'draft')];
    const draft = journeyCell({ ...base, gridEpisodes: grid, stage: 'stage3', theme: 'life' });
    expect(draft).toMatchObject({ state: 'later', disabled: true });
    expect(draft.model.kind).toBe('placeholder');
    const withStory = journeyCell({
      ...base,
      gridEpisodes: grid,
      storyEntries: shelfIndex([story('y', { recommendedStage: 3, theme: 'life' })]),
      stage: 'stage3',
      theme: 'life',
    });
    expect(withStory).toMatchObject({ state: 'later', disabled: false });
    expect(withStory.model.kind).toBe('stories-only');
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
    expect(grid).toMatch(/accessibilityLabel=\{withAccessWords\(\s*cellLabel\(model,[^)]*messages\.a11y\.journeyCell/);
    expect(grid).not.toMatch(/a11y\.gridCell/);
    expect(grid).toMatch(/aria-hidden\s+importantForAccessibility="no-hide-descendants"\s+accessibilityElementsHidden/);
  });

  it('the count mark keeps its size at large text and grows rather than clips (F-STORY-005 §3.12)', () => {
    expect(grid).toMatch(/<Text \{\.\.\.KOREAN_LINE_BREAK\} maxFontSizeMultiplier=\{1\}[^>]*>\s*\{messages\.learner\.journey\.countMark\(/);
    expect(grid).toContain('minHeight: COUNT_MARK');
    expect(grid).not.toMatch(/\bheight: COUNT_MARK/);
  });

  it('draws its glyphs at a token size and takes the cell id from cellTestId (F-STORY-005 PR 5.5a review)', () => {
    expect(grid).not.toMatch(/size=\{\d+\}/);
    expect(grid).toMatch(/const CELL_GLYPH = spacing\./);
    expect(grid).toContain('testID={cellTestId(model.kind, cell.stage, cell.theme, cell.marks)}');
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

/**
 * F-ENT-003 E3-5 (section 3.7; design/components/RouteMarkers/spec.md D4, D5, D11): the route marks on
 * the Journey. Next on the cell of `routeNext`'s quest, the In your plan ring on `planView()`'s episodes,
 * the Not open yet dotted ring on a playable cell whose every quest is closed, the legend of the marks
 * drawn, and the taste note only on a row with a cell that is open or kept.
 */
describe('route marks (F-ENT-003 E3-5)', () => {
  const S2: Episode[] = [
    ep('s2-life', 'stage2', 'life', 'shipped', ['quest:s2-life-q1', 'quest:s2-life-q2']),
    ep('s2-nature', 'stage2', 'nature', 'shipped', ['quest:s2-nature-q1']),
  ];
  const ALL = [...GRID, ...S2];
  const FREE = new Set(['quest:a', 'quest:b', 'quest:s1-life-q1']);
  /** A free learner with the switch on: Stage 1 open, the rest closed unless kept. */
  const freeOpen = (kept: string[] = []) => (questId: string) => FREE.has(questId) || kept.includes(questId);
  const base = { gridEpisodes: ALL, paneMode: false, selectedId: null };
  const access = (over: Partial<JourneyAccessInput> = {}): JourneyAccessInput => ({
    nextEpisodeId: null,
    inPlanEpisodeIds: new Set(),
    isQuestOpen: () => true,
    ...over,
  });

  it('without access input no cell carries a mark (All lessons, and the grid before E3-5)', () => {
    const rows = journeyGridRows({ stages, themes, ...base });
    expect(rows.flatMap((r) => r.cells).every((c) => c.access === NO_CELL_ACCESS)).toBe(true);
    expect(journeyLegend(rows)).toEqual([]);
  });

  it('Next sits on the one cell holding the next quest, any volume of it', () => {
    const vol2 = { ...ep('s1-letters-v2', 'stage1', 'letters', 'shipped', ['quest:v2']), volume: 2 };
    const rows = journeyGridRows({ stages, themes, ...base, gridEpisodes: [...ALL, vol2], access: access({ nextEpisodeId: 'episode:s1-letters-v2' }) });
    const nexts = rows.flatMap((r) => r.cells).filter((c) => c.access.next);
    expect(nexts.map((c) => c.key)).toEqual(['stage1-letters']);
    expect(journeyLegend(rows)).toEqual(['next']);
  });

  it('no Next at rest and free-end (no next episode)', () => {
    const rows = journeyGridRows({ stages, themes, ...base, access: access() });
    expect(rows.flatMap((r) => r.cells).some((c) => c.access.next)).toBe(false);
  });

  it('In your plan rings the plan episodes; Next and In your plan can share a cell', () => {
    const rows = journeyGridRows({
      stages,
      themes,
      ...base,
      access: access({ nextEpisodeId: 'episode:s1-life', inPlanEpisodeIds: new Set(['episode:s1-life', 'episode:s2-life']) }),
    });
    const cells = rows.flatMap((r) => r.cells);
    const life = cells.find((c) => c.key === 'stage1-life');
    expect(life?.access).toEqual({ next: true, inPlan: true, notOpen: false });
    expect(cells.filter((c) => c.access.inPlan).map((c) => c.key)).toEqual(['stage1-life', 'stage2-life']);
    expect(journeyLegend(rows)).toEqual(['next', 'inPlan']);
  });

  it('Not open yet: a playable cell whose every quest is closed; never on Stage 1, a later cell or an empty one', () => {
    const rows = journeyGridRows({ stages, themes, ...base, access: access({ nextEpisodeId: 'episode:s1-letters', isQuestOpen: freeOpen() }) });
    const closed = rows.flatMap((r) => r.cells).filter((c) => c.access.notOpen);
    expect(closed.map((c) => c.key)).toEqual(['stage2-life', 'stage2-nature']);
    // The closed cell keeps its look and its tap (section 3.7): still an open, enabled cell.
    expect(closed.every((c) => c.state === 'open' && !c.disabled)).toBe(true);
    expect(journeyLegend(rows)).toEqual(['next', 'notOpen']);
  });

  it('a cell with any kept quest shows no ring', () => {
    const rows = journeyGridRows({ stages, themes, ...base, access: access({ isQuestOpen: freeOpen(['quest:s2-life-q2']) }) });
    const cells = rows.flatMap((r) => r.cells);
    expect(cells.find((c) => c.key === 'stage2-life')?.access.notOpen).toBe(false);
    expect(cells.find((c) => c.key === 'stage2-nature')?.access.notOpen).toBe(true);
  });

  it('precedence Next > In your plan > Not open yet: the higher mark wins on one cell, never two rings', () => {
    // A stale input naming a closed episode cannot put two marks on it: the ring of the higher mark wins.
    // (routeNext and planView never name a closed quest; the bundle test below ties the grid to them.)
    const rows = journeyGridRows({
      stages,
      themes,
      ...base,
      access: access({ nextEpisodeId: 'episode:s2-life', inPlanEpisodeIds: new Set(['episode:s2-nature']), isQuestOpen: freeOpen() }),
    });
    const cells = rows.flatMap((r) => r.cells);
    expect(cells.find((c) => c.key === 'stage2-life')?.access).toEqual({ next: true, inPlan: false, notOpen: false });
    expect(cells.find((c) => c.key === 'stage2-nature')?.access).toEqual({ next: false, inPlan: true, notOpen: false });
  });

  it('a coming-later cell never carries a mark, even when a later volume of it is playable', () => {
    // Volume 1 is a draft (the cell looks "coming later"); volume 2 is shipped and named by every input.
    const v1 = ep('s3-life', 'stage3', 'life', 'draft', ['quest:s3-life-q1']);
    const v2 = { ...ep('s3-life-v2', 'stage3', 'life', 'shipped', ['quest:s3-life-v2-q1']), volume: 2 };
    for (const over of [
      { nextEpisodeId: 'episode:s3-life-v2' },
      { inPlanEpisodeIds: new Set(['episode:s3-life-v2']) },
      { isQuestOpen: freeOpen() },
    ]) {
      const cell = journeyCell({ stage: 'stage3', theme: 'life', ...base, gridEpisodes: [...ALL, v1, v2], access: access(over) });
      expect(cell.state).toBe('later');
      expect(cell.access).toBe(NO_CELL_ACCESS);
    }
  });

  it('subscribers and the switch-off state show no access mark (questAccess never closes)', () => {
    for (const tier of ['premium', 'free'] as const) {
      const isQuestOpen = questOpenPredicate({ tier, gatingEnabled: tier === 'premium', completedQuestIds: new Set() });
      const rows = journeyGridRows({ stages, themes, ...base, access: access({ isQuestOpen }) });
      expect(rows.flatMap((r) => r.cells).some((c) => c.access.notOpen)).toBe(false);
    }
  });

  it('the bundle: a free learner with the switch on sees no dotted ring on Stage 1 and rings on every playable cell past it', () => {
    const grid = gridEpisodes(episodesAll);
    const isQuestOpen = questOpenPredicate({ tier: 'free', gatingEnabled: true, completedQuestIds: new Set() });
    const rows = journeyGridRows({ stages, themes, gridEpisodes: grid, paneMode: false, selectedId: null, access: access({ isQuestOpen }) });
    const stage1 = rows.find((r) => r.stage === 'stage1');
    expect(stage1?.cells.some((c) => c.access.notOpen)).toBe(false);
    const later = rows.filter((r) => r.stage !== 'stage1').flatMap((r) => r.cells).filter((c) => c.state === 'open' && c.model.kind !== 'stories-only');
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((c) => c.access.notOpen)).toBe(true);
  });

  it('tied to routeNext and planView on the bundle: no closed cell is Next or In your plan, the plan rings stay in Stage 1', () => {
    const P = 'profile:p1';
    const today = '2026-10-12';
    const grid = gridEpisodes(episodesAll);
    const playable = grid.filter((e) => e.status === 'shipped' || e.status === 'ready');
    const stage1 = playable.filter((e) => e.stage === 'stage1').flatMap((e) => e.questIds);
    const stage2 = playable.filter((e) => e.stage === 'stage2').flatMap((e) => e.questIds);
    expect(stage1.length).toBeGreaterThan(1);
    expect(stage2.length).toBeGreaterThan(0);
    // A seeded self plan reaching from Stage 1 into Stage 2, every item inside the horizon.
    const planned = [...stage1.slice(1, 3), ...stage2.slice(0, 2)];
    const episodeOf = (q: string): string => episodesAll.find((e) => e.questIds.includes(q))!.id;
    const homework: HomeworkAssignment[] = planned.map((questId) => ({
      id: `route:mine#${questId}`,
      profileId: P,
      questId,
      episodeId: episodeOf(questId),
      assignedBy: 'system',
      assignedAt: '2026-10-01T00:00:00.000Z',
      targetDate: today,
    }));
    const snapshot: ProgressSnapshot = {
      profileId: P,
      updatedAt: `${today}T08:00:00.000Z`,
      episodes: [],
      quests: [],
      cards: [],
      sessions: [],
      homework,
      reviews: [],
      streakDays: 0,
    };
    const isQuestOpen = questOpenPredicate({ tier: 'free', gatingEnabled: true, completedQuestIds: new Set() });
    const input: RouteNextInput = {
      snapshot,
      profileId: P,
      today,
      sources: [{ id: 'route:mine', kind: 'self', assignedAt: '2026-10-01T00:00:00.000Z', items: planned.map((id) => ({ kind: 'quest' as const, id })), meta: null }],
      quests: questsAll,
      episodes: episodesAll,
      cursor: { isEntitled: () => true, skipQuestIds: undefined, isQuestOpen },
      isQuestOpen,
      gating: { active: true, tier: 'free' },
    };
    const next = routeNext(input);
    const routeAccess: JourneyAccessInput = {
      nextEpisodeId: next.kind === 'quest' ? next.episodeId : null,
      inPlanEpisodeIds: planView(input).inPlanEpisodeIds,
      isQuestOpen,
    };
    const cells = journeyGridRows({ stages, themes, gridEpisodes: grid, paneMode: false, selectedId: null, access: routeAccess }).flatMap((r) => r.cells);
    const questsOfCell = (key: string): string[] => playable.filter((e) => `${e.stage}-${e.theme}` === key).flatMap((e) => e.questIds);
    const marked = cells.filter((c) => c.access.next || c.access.inPlan);
    expect(marked.some((c) => c.access.next)).toBe(true);
    expect(marked.some((c) => c.access.inPlan)).toBe(true);
    for (const c of marked) expect(questsOfCell(c.key).some(isQuestOpen)).toBe(true);
    expect(cells.filter((c) => c.access.inPlan).every((c) => c.stage === 'stage1')).toBe(true);
    // The plan's Stage 2 cells are closed for this learner: the dotted ring, not the solid one.
    const planStage2 = new Set(stage2.slice(0, 2).map(episodeOf));
    const closedPlanCells = cells.filter((c) => c.episodeId !== null && planStage2.has(c.episodeId));
    expect(closedPlanCells.length).toBeGreaterThan(0);
    expect(closedPlanCells.every((c) => c.access.notOpen && !c.access.inPlan && !c.access.next)).toBe(true);
  });

  describe('taste note (E3-D D11)', () => {
    const tasteRow = (isQuestOpen: (id: string) => boolean) =>
      journeyGridRows({ stages, themes, ...base, access: access({ isQuestOpen }) }).find((r) => r.stage === 'stage2');

    it('shown on a taste row with a cell that is open or kept', () => {
      expect(tasteRow(() => true)?.tasteNote).toBe(true);
      expect(tasteRow(freeOpen(['quest:s2-nature-q1']))?.tasteNote).toBe(true);
    });

    it('left out when every playable cell of the row is closed for this learner', () => {
      const row = tasteRow(freeOpen());
      expect(row?.availability).toBe('taste');
      expect(row?.tasteNote).toBe(false);
    });

    it('never on an open or a coming-later row, and shown as before without access input', () => {
      const rows = journeyGridRows({ stages, themes, ...base });
      expect(rows.find((r) => r.stage === 'stage2')?.tasteNote).toBe(true);
      expect(rows.find((r) => r.stage === 'stage1')?.tasteNote).toBe(false);
      expect(rows.find((r) => r.stage === 'stage3')?.tasteNote).toBe(false);
    });
  });

  describe('withAccessWords: the cell label (section 3.14, a11y.access)', () => {
    const m = getMessages('en').a11y.access;
    const head = 'Stage 1 Hangul, Life: lesson';

    it('adds nothing without a mark', () => {
      expect(withAccessWords(head, NO_CELL_ACCESS, 'Around the Korean Table', m)).toBe(head);
    });

    it('appends the words in the order Next, In your plan', () => {
      expect(withAccessWords(head, { next: true, inPlan: true, notOpen: false }, 'Around the Korean Table', m)).toBe(
        'Stage 1 Hangul, Life: lesson. Next. In your plan.',
      );
      expect(withAccessWords(head, { next: false, inPlan: true, notOpen: false }, 'x', m)).toBe('Stage 1 Hangul, Life: lesson. In your plan.');
    });

    it('after a label that already ends a sentence (the level-check marks)', () => {
      expect(withAccessWords('Stage 1 Hangul, Life: lesson. You started here.', { next: true, inPlan: false, notOpen: false }, 'x', m)).toBe(
        'Stage 1 Hangul, Life: lesson. You started here. Next.',
      );
    });

    it('a closed cell names its episode: "{title}: not open yet. Opens the lesson page."', () => {
      expect(withAccessWords('Stage 2 Words, Life: lesson', { next: false, inPlan: false, notOpen: true }, 'Lunch Box Words', m)).toBe(
        'Stage 2 Words, Life: lesson. Lunch Box Words: not open yet. Opens the lesson page.',
      );
    });

    it('a closed placed-out cell drops "still open to play": the label says only what is true', () => {
      const j = getMessages('en').a11y.journeyCell;
      const model = { stage: 'stage2', theme: 'life', kind: 'lesson', episodeId: 'episode:s2-life', completed: false, storyCount: 0, storiesFinished: 0 } as const;
      const stage = { order: 2, titleEn: 'Words' };
      const theme = { titleEn: 'Life' };
      const closed = { marks: { completed: false, placedOut: true, isStart: false }, access: { next: false, inPlan: false, notOpen: true } };
      const label = withAccessWords(cellLabel(model, stage, theme, j, labelMarksOf(closed)), closed.access, 'Lunch Box Words', m);
      expect(label).not.toMatch(/still open to play/);
      expect(label).toMatch(/Lunch Box Words: not open yet\. Opens the lesson page\.$/);
      // An open placed-out cell keeps its sentence, and the start pin is always read.
      const open = { marks: { completed: false, placedOut: true, isStart: true }, access: NO_CELL_ACCESS };
      expect(labelMarksOf(open)).toEqual(open.marks);
      expect(cellLabel(model, stage, theme, j, labelMarksOf(open))).toMatch(/still open to play/);
      expect(labelMarksOf({ ...closed, marks: { ...closed.marks, isStart: true } })).toEqual({ completed: false, placedOut: false, isStart: true });
    });

    it('the words carry no lock, price or product word', () => {
      const all = [m.next, m.inPlan, m.notOpen('T'), getMessages('en').learner.access.notOpen].join(' ');
      expect(all).not.toMatch(/lock|premium|buy|price|trial|family plan|\$|\d/i);
      // One word for the boundary everywhere: the legend, the cell label and the Learning Route state.
      expect(getMessages('en').learner.access.notOpen).toBe(getMessages('en').learner.myRoute.state.notOpen);
      expect(m.notOpen('T')).toContain(getMessages('en').learner.access.notOpen.toLowerCase());
    });
  });
});

describe('JourneyGrid sources (F-ENT-003 E3-5)', () => {
  const SRC = join(__dirname, '..', '..');
  const grid = readFileSync(join(SRC, 'components', 'JourneyGrid.tsx'), 'utf8');
  const screen = readFileSync(join(SRC, 'screens', 'journey', 'JourneyScreen.tsx'), 'utf8');

  it('a coming-later cell draws no glyph: no lock anywhere on the grid (E3-D D5, OD-6)', () => {
    expect(grid).not.toMatch(/name="lock"/);
    expect(grid).not.toMatch(/'lock'/);
  });

  it('cells and column labels draw the theme glyph, never a letter (owner decision 2026-10-14)', () => {
    expect(grid).toMatch(/design\/components\/Icon\/theme-glyphs\.md/);
    expect(grid).not.toMatch(/themeCellInitial/);
    expect(grid).toMatch(/<Icon name=\{themeGlyph\(theme\.key\)\}/);
    expect(grid).toMatch(/<Icon name=\{themeGlyph\(t\.key\)\}/);
  });

  it('draws the marks from the design system, the legend above the column labels, the taste note by the row rule', () => {
    expect(grid).toMatch(/design\/wireframes\/journey\/grid-plan-and-access\.md/);
    expect(grid).toMatch(/design\/components\/RouteMarkers\/spec\.md/);
    expect(grid).toContain('<RouteLegend');
    expect(grid.indexOf('<RouteLegend')).toBeLessThan(grid.indexOf('themeColumnLabel(t)'));
    expect(grid).toContain('<NextMarker');
    // The tip is placed from the cell's outer edge: the cell's border comes off the offset.
    expect(grid).toMatch(/<NextMarker[^>]*edge=\{cell\.selected \? borderWidth\.thick : CELL_EDGE\}/);
    expect(grid).toMatch(/borderWidth: cell\.selected \? borderWidth\.thick : CELL_EDGE/);
    expect(grid).toMatch(/cellLabel\(model, stage, theme, messages\.a11y\.journeyCell, labelMarksOf\(cell\)\)/);
    expect(grid).toContain('<RouteRing');
    expect(grid).toContain('row.tasteNote');
    expect(grid).not.toMatch(/\{row\.availability === 'taste' \? \(/);
  });

  it('the Journey passes routeNext and planView through the shared input, with the learner access predicate', () => {
    expect(screen).toContain('routeNextInputOf(');
    expect(screen).toContain('useQuestAccess()');
    expect(screen).toMatch(/planView\(/);
    expect(screen).toMatch(/routeNext\(/);
    expect(screen).toMatch(/access=\{/);
  });
});
