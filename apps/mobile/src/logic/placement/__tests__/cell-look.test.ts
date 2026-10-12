import type { RouteCatalog, RouteQuest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { pipStateOf } from '../../my-route/pips';
import { cellLook, journeyMarks, placedOutEpisodeIds, startCell } from '../cell-look';
import { placementResult } from './fixtures';

const q = (id: string, episodeId: string, order: number, over: Partial<RouteQuest> = {}): RouteQuest => ({
  id,
  episodeId,
  stage: 'stage1',
  theme: 'letters',
  order,
  teaches: [],
  playable: true,
  grid: true,
  ...over,
});
const CATALOG: RouteCatalog = {
  quests: [
    q('q1', 'ep:letters', 1),
    q('q2', 'ep:letters', 2),
    q('q3', 'ep:life', 3, { theme: 'life' }),
    q('q4', 'ep:life', 4, { theme: 'life' }),
    q('story', 'ep:shelf', 5, { grid: false }),
    q('s2', 'ep:s2', 6, { stage: 'stage2', theme: 'rites' }),
  ],
};

describe('placed-out cells (F-PLC-001 section 3.7, consumer 3)', () => {
  it('a cell whose quests are all placed out or done, and not all done, looks placed out', () => {
    expect(placedOutEpisodeIds(CATALOG, new Set(['q1', 'q2']), new Set())).toEqual(['ep:letters']);
    expect(placedOutEpisodeIds(CATALOG, new Set(['q1']), new Set(['q2']))).toEqual(['ep:letters']);
    expect(placedOutEpisodeIds(CATALOG, new Set(), new Set(['q1', 'q2']))).toEqual([]);
    expect(placedOutEpisodeIds(CATALOG, new Set(['q3']), new Set())).toEqual([]);
  });

  it('shelf content is never placed out', () => {
    expect(placedOutEpisodeIds(CATALOG, new Set(['story']), new Set())).toEqual([]);
  });

  it('cellLook: done keeps its own look, placed out is different, otherwise none', () => {
    expect(cellLook('ep:letters', CATALOG, new Set(), new Set(['q1', 'q2']))).toBe('done');
    expect(cellLook('ep:letters', CATALOG, new Set(['q1', 'q2']), new Set())).toBe('placed-out');
    expect(cellLook('ep:life', CATALOG, new Set(['q3']), new Set())).toBe('none');
    expect(cellLook('ep:unknown', CATALOG, new Set(), new Set())).toBe('none');
  });

  it('the start cell carries the pin', () => {
    expect(startCell(CATALOG, 'q3')).toEqual({ episodeId: 'ep:life', stage: 'stage1', theme: 'life' });
    expect(startCell(CATALOG, 's2')).toEqual({ episodeId: 'ep:s2', stage: 'stage2', theme: 'rites' });
    expect(startCell(CATALOG, null)).toBeNull();
    expect(startCell(CATALOG, 'story')).toBeNull();
    expect(startCell(CATALOG, 'gone')).toBeNull();
  });
});

describe('one "placed out" definition (F-PLC-001 AM-13, F-ROUTE-001 section 6.3)', () => {
  it('a quest that is done and placed out counts as done, as pipStateOf says', () => {
    expect(pipStateOf({ done: true, placedOut: true, joinedAfterLatch: false, offerable: true })).toBe('done');
    expect(cellLook('ep:letters', CATALOG, new Set(['q1', 'q2']), new Set(['q1', 'q2']))).toBe('done');
  });

  it('a placed-out quest is "known" to pipStateOf and draws the placed-out look here', () => {
    expect(pipStateOf({ done: false, placedOut: true, joinedAfterLatch: false, offerable: true })).toBe('known');
    expect(cellLook('ep:life', CATALOG, new Set(['q3', 'q4']), new Set())).toBe('placed-out');
  });
});

describe("journeyMarks: the Journey grid's placed-out cells and start pin (F-PLC-001 section 3.7, consumer 3)", () => {
  const all = (): boolean => true;

  it('nothing to draw without a stored result: the Journey is unchanged', () => {
    expect(journeyMarks(undefined, CATALOG, all)).toBeNull();
    expect(journeyMarks([], CATALOG, all)).toBeNull();
  });

  it('the placed-out set is the union of every result, and the pin sits on the first cell still to play', () => {
    const first = placementResult({ id: 'placement:one', completedAt: '2026-10-01T00:00:00Z', placedOutQuestIds: ['q1'] });
    const second = placementResult({ id: 'placement:two', completedAt: '2026-10-02T00:00:00Z', placedOutQuestIds: ['q2'] });
    const marks = journeyMarks([second, first], CATALOG, all);
    expect([...(marks?.placedOut ?? [])].sort()).toEqual(['q1', 'q2']);
    expect(marks?.start).toEqual({ episodeId: 'ep:life', stage: 'stage1', theme: 'life' });
  });

  it('the pin is a fixed anchor: it does not follow the quests the learner finishes', () => {
    // No completions are read: finishing q3 later leaves "where you started" where it was.
    const marks = journeyMarks([placementResult({ placedOutQuestIds: ['q1', 'q2'] })], CATALOG, all);
    expect(marks?.start?.episodeId).toBe('ep:life');
  });

  it('a grown-up override puts quests back, and the pin moves to the chosen start', () => {
    const overridden = placementResult({
      placedOutQuestIds: ['q1', 'q2', 'q3'],
      override: { by: 'parent', at: '2026-10-03T00:00:00Z', startQuestId: 'q2' },
    });
    const marks = journeyMarks([overridden], CATALOG, all);
    expect([...(marks?.placedOut ?? [])]).toEqual(['q1']);
    expect(marks?.start?.episodeId).toBe('ep:letters');
  });

  it('the pin skips stages the cursor may not land on, and is absent when nothing is left', () => {
    const stage1Out = placementResult({ placedOutQuestIds: ['q1', 'q2', 'q3', 'q4'] });
    expect(journeyMarks([stage1Out], CATALOG, all)?.start?.episodeId).toBe('ep:s2');
    expect(journeyMarks([stage1Out], CATALOG, (stage) => stage === 'stage1')?.start).toBeNull();
  });
});
