import { describe, expect, it } from 'vitest';
import type { StageKey } from '@hangul-route/content-schema';
import { episodesAll } from '../../../content/episodes';
import { questsAll } from '../../../content/quests';
import { gridEpisodesOf, routeOrder } from '../order';
import { cellRowsOf, pipStateOf, splitStagePips, type PipContext } from '../pips';
import { BUNDLE_8, THEME_DEFS, catalogOf, episode, quest } from './fixtures/bundle-2026-10';

const ctxOf = (over: Partial<PipContext> = {}, bundle = BUNDLE_8): PipContext => ({
  order: routeOrder({ catalog: catalogOf(bundle), episodes: bundle.episodes, quests: bundle.quests }),
  done: new Set(),
  placedOut: new Set(),
  latched: new Set(),
  isEntitled: () => true,
  cursorId: null,
  ...over,
});
const cells = (stage: StageKey, ctx: PipContext, episodes = BUNDLE_8.episodes) =>
  cellRowsOf(stage, gridEpisodesOf(episodes), THEME_DEFS, ctx);

describe('pipStateOf (F-ROUTE-001 section 3.4 precedence)', () => {
  const all = [false, true];
  it('is done > known > new > open > later for every combination', () => {
    for (const done of all)
      for (const placedOut of all)
        for (const joinedAfterLatch of all)
          for (const offerable of all) {
            const state = pipStateOf({ done, placedOut, joinedAfterLatch, offerable });
            const expected = done ? 'done' : placedOut ? 'known' : joinedAfterLatch ? 'new' : offerable ? 'open' : 'later';
            expect(state).toBe(expected);
          }
  });
});

describe('cellRowsOf', () => {
  it('draws one pip per grid quest of each playable cell and one later pip per other cell', () => {
    const s1 = cells('stage1', ctxOf());
    expect(s1.map((c) => c.pips.length)).toEqual([3, 2, 1, 1, 1]);
    expect(s1.flatMap((c) => c.pips).every((p) => p.kind === 'quest' && p.state === 'open')).toBe(true);
    const s2 = cells('stage2', ctxOf());
    expect(s2.map((c) => c.pips.map((p) => `${p.kind}:${p.state}`))).toEqual([
      ['cell:later'],
      ['quest:open'],
      ['cell:later'],
      ['quest:open'],
      ['cell:later'],
    ]);
    expect(s2[0]?.pips[0]?.key).toBe('episode:stage2-letters');
  });

  it('runs on the real unparsed bundle: Stage 1, 5 + 6 quest pips (Stage 2: two tastes + Playground Words 3; Stage 4: Greeting Dialogues 3 + Read Along 3)', () => {
    const live = { episodes: episodesAll, quests: questsAll };
    const ctx = ctxOf({}, live);
    const count = (stage: StageKey) =>
      cells(stage, ctx, episodesAll).flatMap((c) => c.pips).filter((p) => p.kind === 'quest').length;
    expect(count('stage1')).toBeGreaterThanOrEqual(8);
    expect([count('stage1'), count('stage2'), count('stage4')]).toEqual([
      ctx.order.filter((e) => e.stage === 'stage1').length,
      5,
      6,
    ]);
  });

  it('names the cell word: complete, partial, known, open, later', () => {
    const ctx = ctxOf({
      done: new Set(['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1', 'quest:stage1-rites-q1']),
      placedOut: new Set(['quest:stage1-nature-q1', 'quest:stage1-rites-q1']),
    });
    expect(cells('stage1', ctx).map((c) => c.state)).toEqual(['complete', 'partial', 'complete', 'known', 'open']);
    expect(cells('stage1', ctx).map((c) => c.done)).toEqual([3, 1, 1, 0, 0]);
    expect(cells('stage3', ctx).every((c) => c.state === 'later')).toBe(true);
  });

  it('marks a cell later when its stage is not entitled and nothing in it is done', () => {
    const ctx = ctxOf({ isEntitled: (s) => s === 'stage1', done: new Set(['quest:stage2-life-q1']) });
    const s2 = cells('stage2', ctx);
    expect(s2[1]?.state).toBe('complete');
    expect(s2[3]?.state).toBe('later');
    expect(s2[3]?.pips[0]?.state).toBe('later');
    expect(s2[3]?.pips[0]?.kind).toBe('quest');
  });

  it('gives laterReason notOpen only to a quest the access check closed, never to one later for want of entitlement', () => {
    // The `tier` cursor rule with no access check (switch off): a stage the learner is not entitled
    // to but has a quest done in keeps its other quests later with no reason, as before LR-3b.
    const tier = cells('stage2', ctxOf({ isEntitled: (s) => s === 'stage1', done: new Set(['quest:stage2-life-q1']) }));
    expect(tier[3]?.pips[0]).toMatchObject({ kind: 'quest', state: 'later' });
    expect(tier.flatMap((c) => c.pips).some((p) => p.laterReason === 'notOpen')).toBe(false);
    // The same stage with the access check closing that quest: Not open yet.
    const closed = cells('stage2', ctxOf({ isEntitled: (s) => s === 'stage1', isQuestOpen: () => false }));
    expect(closed[3]?.pips[0]).toMatchObject({ kind: 'quest', state: 'later', laterReason: 'notOpen' });
  });

  it('uses the episode title, else the theme title, and a null episode for a missing cell', () => {
    const episodes = BUNDLE_8.episodes.filter((e) => e.id !== 'episode:stage3-crafts');
    const s3 = cells('stage3', ctxOf(), episodes);
    expect(s3[0]?.title).toBe('First Sentences');
    expect(s3[4]).toMatchObject({ episodeId: null, title: 'Crafts & Play', state: 'later' });
    expect(s3[4]?.pips[0]?.key).toBe('cell:stage3-crafts');
    expect(s3[4]?.pips[0]?.episodeId).toBeUndefined();
    const noTheme = cellRowsOf('stage3', gridEpisodesOf(episodes), [], ctxOf());
    expect(noTheme[4]?.title).toBe('crafts');
  });

  it('flags the cursor pip only', () => {
    const pips = cells('stage1', ctxOf({ cursorId: 'quest:stage1-life-q2' })).flatMap((c) => c.pips);
    expect(pips.filter((p) => p.isCursor).map((p) => p.questId)).toEqual(['quest:stage1-life-q2']);
    expect(pips.some((p) => p.isStart)).toBe(false);
  });

  it('ignores placed-out ids absent from the bundle', () => {
    const pips = cells('stage1', ctxOf({ placedOut: new Set(['quest:removed-long-ago']) })).flatMap((c) => c.pips);
    expect(pips).toHaveLength(8);
    expect(pips.every((p) => p.state === 'open')).toBe(true);
  });

  it('draws quests that joined a latched stage as new, after a gap, and keeps the earned group full', () => {
    const grown = {
      episodes: BUNDLE_8.episodes.map((e) =>
        e.id === 'episode:stage1-life' ? episode('stage1', 'life', e.titleEn, [...e.questIds, 'quest:stage1-life-q3']) : e,
      ),
      quests: [...BUNDLE_8.quests, quest('quest:stage1-life-q3', 'Picnic', ['match-sound'])],
    };
    const done = new Set(BUNDLE_8.quests.filter((q) => q.id.startsWith('quest:stage1')).map((q) => q.id));
    const latched = cellRowsOf('stage1', gridEpisodesOf(grown.episodes), THEME_DEFS, ctxOf({ done, latched: new Set(['stage1']) }, grown));
    expect(latched[1]?.state).toBe('partial');
    const split = splitStagePips(latched, true);
    expect(split.pips).toHaveLength(8);
    expect(split.pips.every((p) => p.state === 'done')).toBe(true);
    expect(split.newPips.map((p) => p.questId)).toEqual(['quest:stage1-life-q3']);

    const unlatched = cellRowsOf('stage1', gridEpisodesOf(grown.episodes), THEME_DEFS, ctxOf({ done }, grown));
    expect(splitStagePips(unlatched, false).newPips).toEqual([]);
    expect(splitStagePips(unlatched, false).pips.filter((p) => p.state === 'open')).toHaveLength(1);
  });

  it('in a latched stage, a joined quest placed out later still goes to the second group', () => {
    const grown = {
      episodes: BUNDLE_8.episodes.map((e) =>
        e.id === 'episode:stage1-life' ? episode('stage1', 'life', e.titleEn, [...e.questIds, 'quest:stage1-life-q3', 'quest:stage1-life-q4']) : e,
      ),
      quests: [...BUNDLE_8.quests, quest('quest:stage1-life-q3', 'Picnic', ['match-sound']), quest('quest:stage1-life-q4', 'More', ['match-sound'])],
    };
    const done = new Set(BUNDLE_8.quests.filter((q) => q.id.startsWith('quest:stage1')).map((q) => q.id));
    const ctx = ctxOf({ done, latched: new Set(['stage1']), placedOut: new Set(['quest:stage1-life-q3']) }, grown);
    const split = splitStagePips(cellRowsOf('stage1', gridEpisodesOf(grown.episodes), THEME_DEFS, ctx), true);
    expect(split.pips.every((p) => p.state === 'done')).toBe(true);
    expect(split.newPips.map((p) => p.state)).toEqual(['known', 'new']);
  });

  it('puts later cell pips after the quest pips of the stage row', () => {
    const split = splitStagePips(cells('stage2', ctxOf()), false);
    expect(split.pips.map((p) => p.state)).toEqual(['open', 'open', 'later', 'later', 'later']);
  });
});
