import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Episode, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../content';
import { CURSOR_STAGE_RULE, cursorContext, cursorEntitlement } from '../cursor-context';
import { buildTodaysMission } from '../homework/mission-builder';
import { routeCursor } from '../my-route/cursor';
import { nextQuestAfter, offerableQuests } from '../next-quest';
import { placementResult } from '../placement/__tests__/fixtures';
import { resultsTeaser } from '../quest-flow/results-teaser';
import { episodeOf, plainQuest, snapshotWith } from '../stage1/__tests__/fixtures';

/**
 * F-ROUTE-001 R-4a (section 3.5, decision M4): one cursor, told the same
 * stages and the same placed-out quests on every surface that shows it.
 */

const QUESTS: Quest[] = ['a', 'b', 'c', 'e'].map((k) => plainQuest(`quest:${k}`));
const EPISODES: Episode[] = [
  episodeOf('episode:one', ['quest:a', 'quest:b']),
  episodeOf('episode:two', ['quest:c'], { theme: 'life' }),
  episodeOf('episode:s2', ['quest:e'], { stage: 'stage2', theme: 'life' }),
];

describe('CURSOR_STAGE_RULE (OD-4)', () => {
  it('defaults to "every shipped stage is playable", today\'s behaviour on Home and the Journey', () => {
    expect(CURSOR_STAGE_RULE).toBe('shipped');
  });
});

describe('cursorEntitlement', () => {
  it('opens every stage under the default rule, whatever the tier', () => {
    for (const tier of ['free', 'premium'] as const) {
      const isEntitled = cursorEntitlement(tier);
      expect(['stage1', 'stage2', 'stage4', 'stage7'].every(isEntitled)).toBe(true);
    }
  });

  it('under the OD-4 alternative it opens only the stages the tier includes', () => {
    const free = cursorEntitlement('free', 'tier');
    expect(free('stage1')).toBe(true);
    expect(free('stage2')).toBe(false);
    expect(free('stage4')).toBe(false);
    const premium = cursorEntitlement('premium', 'tier');
    expect(['stage1', 'stage2', 'stage4'].every(premium)).toBe(true);
  });
});

describe('cursorContext', () => {
  it('has no placed-out set without a stored level-check result', () => {
    const ctx = cursorContext({ tier: 'free', placements: undefined, quests: QUESTS, episodes: EPISODES });
    expect(ctx.skipQuestIds).toBeUndefined();
    expect(ctx.isEntitled('stage2')).toBe(true);
    expect(cursorContext({ tier: 'free', placements: [], quests: QUESTS, episodes: EPISODES }).skipQuestIds).toBeUndefined();
  });

  it('carries the placed-out quests of the stored results', () => {
    const placements = [placementResult({ placedOutQuestIds: ['quest:a', 'quest:b'] })];
    const ctx = cursorContext({ tier: 'free', placements, quests: QUESTS, episodes: EPISODES });
    expect([...(ctx.skipQuestIds ?? [])].sort()).toEqual(['quest:a', 'quest:b']);
  });

  it('passes the rule through (OD-4 alternative)', () => {
    const ctx = cursorContext({ tier: 'free', placements: undefined, quests: QUESTS, episodes: EPISODES, rule: 'tier' });
    expect(ctx.isEntitled('stage2')).toBe(false);
    expect(nextQuestAfter({ snapshot: snapshotWith([]), quests: QUESTS, episodes: EPISODES, ...ctx })?.id).toBe('quest:a');
  });
});

/** Home's "New" card (slot 2) for a snapshot, built the way HomeScreen builds it. */
function homeNext(snapshot: ProgressSnapshot, ctx: ReturnType<typeof cursorContext>): string | undefined {
  return buildTodaysMission({
    profileId: snapshot.profileId,
    snapshot,
    quests: questsAll,
    episodes: episodesAll,
    today: '2026-10-11',
    ...ctx,
  }).cards.find((c) => c.slot === 2)?.questId;
}

/** The Results "Next up" quest after replaying a quest already done (so the cursor itself is teased). */
function resultsNext(snapshot: ProgressSnapshot, ctx: ReturnType<typeof cursorContext>, replayed: string): string | undefined {
  return resultsTeaser({ snapshot, quests: questsAll, episodes: episodesAll, questId: replayed, total: 5, ...ctx })?.questId;
}

function doneSnapshot(questIds: readonly string[]): ProgressSnapshot {
  return snapshotWith(
    questIds.map((questId) => ({ questId, episodeId: episodesAll.find((e) => e.questIds.includes(questId))?.id ?? '' })),
  );
}

describe('Home, Results and My route agree on the shipped bundle (decision M4)', () => {
  const offerable = offerableQuests(questsAll, episodesAll).map((q) => q.id);
  const stage1 = offerableQuests(questsAll, episodesAll).filter((q) =>
    episodesAll.some((e) => e.stage === 'stage1' && e.questIds.includes(q.id)),
  );

  it('the bundle still has a Stage 1 and a later playable stage to cross into', () => {
    expect(stage1.length).toBeGreaterThan(1);
    expect(offerable.length).toBeGreaterThan(stage1.length);
  });

  const cases: { name: string; done: readonly string[]; placedOut: readonly string[] }[] = [
    { name: 'first quest done', done: [offerable[0]!], placedOut: [] },
    { name: 'half of Stage 1 done', done: stage1.slice(0, Math.ceil(stage1.length / 2)).map((q) => q.id), placedOut: [] },
    { name: 'all of Stage 1 done (a free learner crosses into the next shipped stage)', done: stage1.map((q) => q.id), placedOut: [] },
    { name: 'placed out of the first two quests, one done', done: [offerable[2]!], placedOut: offerable.slice(0, 2) },
  ];

  for (const c of cases) {
    it(`${c.name}: one next quest on every surface, for a free and a premium learner`, () => {
      const snapshot = doneSnapshot(c.done);
      const placements = c.placedOut.length > 0 ? [placementResult({ placedOutQuestIds: [...c.placedOut] })] : undefined;
      for (const tier of ['free', 'premium'] as const) {
        const ctx = cursorContext({ tier, placements, quests: questsAll, episodes: episodesAll });
        const cursor = nextQuestAfter({ snapshot, quests: questsAll, episodes: episodesAll, ...ctx })?.id;
        expect(cursor).toBeDefined();
        expect(homeNext(snapshot, ctx)).toBe(cursor);
        expect(resultsNext(snapshot, ctx, c.done[0]!)).toBe(cursor);
        expect(routeCursor({ snapshot, quests: questsAll, episodes: episodesAll, ...ctx })?.id).toBe(cursor);
        // The placed-out set really reaches the cursor on the shipped bundle.
        if (c.placedOut.length > 0) expect(cursor).toBe(offerable[3]);
      }
    });

    if (c.name !== 'all of Stage 1 done (a free learner crosses into the next shipped stage)') {
      it(`${c.name}: one next quest on every surface under the OD-4 tier rule (free learner)`, () => {
        const snapshot = doneSnapshot(c.done);
        const placements = c.placedOut.length > 0 ? [placementResult({ placedOutQuestIds: [...c.placedOut] })] : undefined;
        const ctx = cursorContext({ tier: 'free', placements, quests: questsAll, episodes: episodesAll, rule: 'tier' });
        const cursor = nextQuestAfter({ snapshot, quests: questsAll, episodes: episodesAll, ...ctx })?.id;
        expect(stage1.some((q) => q.id === cursor)).toBe(true);
        expect(homeNext(snapshot, ctx)).toBe(cursor);
        expect(resultsNext(snapshot, ctx, c.done[0]!)).toBe(cursor);
        expect(routeCursor({ snapshot, quests: questsAll, episodes: episodesAll, ...ctx })?.id).toBe(cursor);
      });
    }
  }

  it('under the OD-4 tier rule, a free learner past Stage 1 has no cursor; Home keeps its replay', () => {
    const snapshot = doneSnapshot(stage1.map((q) => q.id));
    const ctx = cursorContext({ tier: 'free', placements: undefined, quests: questsAll, episodes: episodesAll, rule: 'tier' });
    expect(resultsNext(snapshot, ctx, stage1[0]!.id)).toBeUndefined();
    expect(routeCursor({ snapshot, quests: questsAll, episodes: episodesAll, ...ctx })).toBeUndefined();
    expect(homeNext(snapshot, ctx)).toBe(stage1[stage1.length - 1]!.id);
  });

  it('accepted exception (section 3.5): with only placed-out quests left, Home and Results offer one; My route is at rest', () => {
    const placedOut = offerable.slice(0, 2);
    const snapshot = doneSnapshot(offerable.slice(2));
    const ctx = cursorContext({ tier: 'free', placements: [placementResult({ placedOutQuestIds: placedOut })], quests: questsAll, episodes: episodesAll });
    expect(homeNext(snapshot, ctx)).toBe(offerable[0]);
    expect(resultsNext(snapshot, ctx, offerable[2]!)).toBe(offerable[0]);
    expect(routeCursor({ snapshot, quests: questsAll, episodes: episodesAll, ...ctx })).toBeUndefined();
  });

  it('after all of Stage 1, the next quest is in a later stage for a free learner too (OD-4 default)', () => {
    const snapshot = doneSnapshot(stage1.map((q) => q.id));
    const ctx = cursorContext({ tier: 'free', placements: undefined, quests: questsAll, episodes: episodesAll });
    const next = nextQuestAfter({ snapshot, quests: questsAll, episodes: episodesAll, ...ctx });
    expect(next).toBeDefined();
    expect(stage1.some((q) => q.id === next?.id)).toBe(false);
  });
});

describe('the screens build the cursor from cursorContext (wiring guard)', () => {
  const read = (rel: string): string => readFileSync(join(__dirname, '../../screens', rel), 'utf8');

  it('Home spreads cursorContext with the learner tier and placements into the mission builder', () => {
    const src = read('home/HomeScreen.tsx');
    expect(src).toMatch(/buildTodaysMission\(\{[\s\S]*\.\.\.cursorContext\(\{\s*tier,\s*placements: snap\.placements,/);
    expect(src).toMatch(/useTierStore\(/);
    expect(src).not.toMatch(/isStageEntitled|placedOutSkipSet/);
  });

  it('Results spreads cursorContext with the learner tier and placements into the teaser', () => {
    const src = read('results/ResultsScreen.tsx');
    expect(src).toMatch(/resultsTeaser\(\{[\s\S]*\.\.\.cursorContext\(\{\s*tier,\s*placements: snapshot\?\.placements,/);
    expect(src).toMatch(/useTierStore\(/);
    expect(src).not.toMatch(/isStageEntitled|placedOutSkipSet/);
  });
});
