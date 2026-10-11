import { describe, expect, it } from 'vitest';
import type { Episode } from '@hangul-route/content-schema';
import { nextQuestAfter } from '../../next-quest';
import { gridEpisodesOf, isGridEpisode, routeOrder } from '../order';
import { routeCursor } from '../cursor';
import { BUNDLE_15, BUNDLE_8, catalogOf, episode, quest, snapshotWith, type Bundle } from './fixtures/bundle-2026-10';

const ids = (b: Bundle) => routeOrder({ catalog: catalogOf(b), episodes: b.episodes, quests: b.quests }).map((e) => e.questId);

describe('routeOrder (F-ROUTE-001 section 3.2)', () => {
  it('lists the 8 + 2 + 1 grid quests of the frozen bundle in stage, theme, cell order', () => {
    expect(ids(BUNDLE_8)).toEqual([
      'quest:stage1-letters-q1',
      'quest:stage1-letters-q2',
      'quest:stage1-letters-q3',
      'quest:stage1-life-q1',
      'quest:stage1-life-q2',
      'quest:stage1-rites-q1',
      'quest:stage1-nature-q1',
      'quest:stage1-crafts-q1',
      'quest:stage2-life-q1',
      'quest:stage2-nature-q1',
      'quest:stage4-rites-q1',
    ]);
  });

  it('lists the 15 Stage 1 quests of the frozen 15-quest fixture first', () => {
    const order = ids(BUNDLE_15);
    expect(order).toHaveLength(18);
    expect(order.slice(0, 6)).toEqual([
      'quest:stage1-letters-q1',
      'quest:stage1-letters-q2',
      'quest:stage1-letters-q3',
      'quest:stage1-life-q1',
      'quest:stage1-life-q2',
      'quest:stage1-life-q3',
    ]);
  });

  it('follows the stage and theme rank whatever order the episodes come in', () => {
    const b: Bundle = { ...BUNDLE_8, episodes: [...BUNDLE_8.episodes].reverse() };
    expect(ids(b)).toEqual(ids(BUNDLE_8));
  });

  it('leaves out shelf episodes, unplayable episodes and quest ids the bundle does not hold', () => {
    const shelf: Episode = { ...episode('stage1', 'letters', 'Shelf', ['quest:story-x']), id: 'episode:shelf-x', placement: 'shelf' };
    const draft = episode('stage3', 'life', 'Draft', ['quest:stage3-life-q1'], 'draft');
    const ghost = episode('stage3', 'nature', 'Ghost', ['quest:missing'], 'ready');
    const b: Bundle = {
      episodes: [...BUNDLE_8.episodes, shelf, draft, ghost],
      quests: [...BUNDLE_8.quests, quest('quest:story-x', 'X', ['story-read']), quest('quest:stage3-life-q1', 'Y', ['match-sound'])],
    };
    expect(ids(b)).toEqual(ids(BUNDLE_8));
  });

  it('puts a quest the catalogue does not list after the listed ones of its cell', () => {
    const b: Bundle = {
      episodes: BUNDLE_8.episodes.map((e) =>
        e.id === 'episode:stage1-crafts' ? { ...e, questIds: ['quest:stage1-crafts-q9', ...e.questIds] } : e,
      ),
      quests: [...BUNDLE_8.quests, quest('quest:stage1-crafts-q9', 'Nine', ['match-sound'])],
    };
    const order = routeOrder({ catalog: catalogOf(BUNDLE_8), episodes: b.episodes, quests: b.quests }).map((e) => e.questId);
    expect(order.indexOf('quest:stage1-crafts-q9')).toBe(order.indexOf('quest:stage1-crafts-q1') + 1);
  });

  it('keeps the episode order between two quests the catalogue does not list', () => {
    const extra = ['quest:stage1-crafts-q8', 'quest:stage1-crafts-q7'];
    const b: Bundle = {
      episodes: BUNDLE_8.episodes.map((e) => (e.id === 'episode:stage1-crafts' ? { ...e, questIds: [...e.questIds, ...extra] } : e)),
      quests: [...BUNDLE_8.quests, ...extra.map((id) => quest(id, id, ['match-sound']))],
    };
    const order = routeOrder({ catalog: catalogOf(BUNDLE_8), episodes: b.episodes, quests: b.quests }).map((e) => e.questId);
    expect(order.slice(7, 10)).toEqual(['quest:stage1-crafts-q1', ...extra]);
  });

  it('treats a missing placement as grid (the bundle is not parsed)', () => {
    expect(isGridEpisode({})).toBe(true);
    expect(isGridEpisode({ placement: 'grid' })).toBe(true);
    expect(isGridEpisode({ placement: 'shelf' })).toBe(false);
    expect(gridEpisodesOf(BUNDLE_8.episodes)).toHaveLength(35);
  });
});

describe('cursor = nextQuestAfter = first route entry not done', () => {
  const progressions: Record<string, Bundle> = { 'the 8-quest bundle': BUNDLE_8, 'the 15-quest fixture': BUNDLE_15 };
  for (const [name, b] of Object.entries(progressions)) {
    it(`agrees at every step on ${name}`, () => {
      const order = ids(b);
      for (let n = 0; n <= order.length; n += 1) {
        const snapshot = snapshotWith(order.slice(0, n));
        const shared = nextQuestAfter({ snapshot, quests: b.quests, episodes: b.episodes });
        const mine = routeCursor({ snapshot, quests: b.quests, episodes: b.episodes });
        expect(mine?.id).toBe(shared?.id);
        expect(mine?.id).toBe(order[n]);
      }
    });
  }
});
