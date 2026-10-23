import type { ProgressSnapshot, StageKey } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../../content';
import { completeStages } from '../../my-route/latch';
import { routeNext, routeNextInputOf } from '../../route-next';
import { gridEpisodesOf } from '../../my-route/order';
import { mergeSnapshots } from '../../sync/merge';
import { RECAP_SYNC_GRACE_MS, UPPER_PRIZE_STAGES, recapStages, recapSyncSettled, withStageCeremony } from '../stage-ceremony';

/*
 * F-CURR-002 sections 4.8 step 7 and 7.3, row CM-22: the one retroactive summary lists every finished Stage 2-7 with
 * no `stageCeremonyAt` key, once; Results latches the stage its run finished, so that stage is never in it.
 */

const AT = '2026-10-01T10:00:00.000Z';
const NOW = new Date('2026-10-22T12:00:00.000Z');
const grid = gridEpisodesOf(episodesAll);

/** Every grid quest of these stages done. */
function finished(stages: readonly StageKey[], over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  const quests = grid
    .filter((e) => stages.includes(e.stage))
    .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id, startedAt: AT, completedAt: AT, stars: 2 as const, attempts: 1, accuracy: 0.9 })));
  return { profileId: 'profile:a', updatedAt: AT, episodes: [], quests, cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over };
}

describe('recapStages: what the one retroactive summary lists', () => {
  it('lists the finished Stages 2-7 with no key, in stage order, and never Stage 1', () => {
    expect(recapStages(finished(['stage1', 'stage2', 'stage3']), episodesAll)).toEqual(['stage2', 'stage3']);
    expect(recapStages(finished(['stage1']), episodesAll)).toEqual([]);
  });

  it('leaves out a stage that holds a key (its ceremony was offered at Results, or a summary listed it)', () => {
    expect(recapStages(finished(['stage2', 'stage3'], { stageCeremonyAt: { stage2: AT } }), episodesAll)).toEqual(['stage3']);
  });

  it('reads a stage latched in stageDoneAt as finished', () => {
    expect(recapStages(finished([], { stageDoneAt: { stage4: AT } }), episodesAll)).toEqual(['stage4']);
  });

  it('a stage not finished is not listed (a tested-out cell never finishes a stage)', () => {
    const partly = finished(['stage2']);
    const short = { ...partly, quests: partly.quests.slice(1) };
    expect(recapStages(short, episodesAll)).toEqual([]);
  });
});

describe('withStageCeremony: the latch', () => {
  it('writes a key per stage, the earliest time winning, and leaves the other fields alone', () => {
    const snap = finished(['stage2', 'stage3'], { stageCeremonyAt: { stage4: AT } });
    const out = withStageCeremony(snap, ['stage2', 'stage3'], NOW.toISOString());
    expect(out?.stageCeremonyAt).toEqual({ stage2: NOW.toISOString(), stage3: NOW.toISOString(), stage4: AT });
    expect(out?.quests).toBe(snap.quests);
  });

  it('is idempotent: nothing to write returns null, and a held key never moves later', () => {
    const snap = finished(['stage2'], { stageCeremonyAt: { stage2: AT } });
    expect(withStageCeremony(snap, ['stage2'], NOW.toISOString())).toBeNull();
    expect(withStageCeremony(snap, [], NOW.toISOString())).toBeNull();
    // Stage 1 keeps its own ceremony: never a key.
    expect(withStageCeremony(snap, ['stage1'], NOW.toISOString())).toBeNull();
  });

  it('a finished stage once latched is never listed again', () => {
    const snap = finished(['stage2', 'stage3']);
    const latched = withStageCeremony(snap, recapStages(snap, episodesAll), NOW.toISOString()) as ProgressSnapshot;
    expect(recapStages(latched, episodesAll)).toEqual([]);
  });
});

describe('two devices: the summary is shown once (section 14)', () => {
  it('a device that summed up Stages 2-3 syncs; the other device merges and lists nothing', () => {
    const phone = finished(['stage2', 'stage3']);
    const tablet = finished(['stage2', 'stage3']);
    expect(recapStages(phone, episodesAll)).toEqual(['stage2', 'stage3']);
    const shown = withStageCeremony(phone, recapStages(phone, episodesAll), NOW.toISOString()) as ProgressSnapshot;
    const merged = mergeSnapshots(tablet, shown, { now: NOW });
    expect(recapStages(merged, episodesAll)).toEqual([]);
    // Both devices summed up at once (offline): the merge keeps one key per stage, the earliest, whichever side wins.
    const early = withStageCeremony(tablet, ['stage2', 'stage3'], AT) as ProgressSnapshot;
    const ab = mergeSnapshots(early, shown, { now: NOW }).stageCeremonyAt;
    const ba = mergeSnapshots(shown, early, { now: NOW }).stageCeremonyAt;
    expect(ab).toEqual({ stage2: AT, stage3: AT });
    expect(ba).toEqual(ab);
  });

  it('an older build that leaves the key out does not bring a stage back (the merge keeps the other side)', () => {
    const shown = withStageCeremony(finished(['stage2']), ['stage2'], AT) as ProgressSnapshot;
    const older = finished(['stage2']);
    expect(recapStages(mergeSnapshots(older, shown, { now: NOW }), episodesAll)).toEqual([]);
    expect(recapStages(mergeSnapshots(shown, older, { now: NOW }), episodesAll)).toEqual([]);
  });
});

describe('the Stage Check never blocks the next stage (OD-1, section 7.3)', () => {
  const inputOf = (snapshot: ProgressSnapshot) =>
    routeNextInputOf({ snapshot, profileId: 'profile:a', today: '2026-10-22', plans: undefined, quests: questsAll, episodes: episodesAll, tier: 'premium', gatingActive: false, isQuestOpen: () => true });

  it('the next lesson, the complete stages and every Stage 3 quest are the same whether or not a Stage Check was taken or latched', () => {
    const untaken = finished(['stage1', 'stage2']);
    const taken: ProgressSnapshot = {
      ...untaken,
      stageCheckAt: { stage2: AT },
      stageCeremonyAt: { stage2: AT },
      reviews: [{ id: 'stage-check:stage2', kind: 'stage-certificate', generatedAt: AT, scope: 'stage2', itemIds: ['lex:a'], resultStars: 1, missedItemIds: ['lex:a'] }],
    };
    const a = routeNext(inputOf(untaken));
    const b = routeNext(inputOf(taken));
    expect(a).toEqual(b);
    expect(a.kind === 'quest' ? episodesAll.find((e) => e.id === a.episodeId)?.stage : null).toBe('stage3');
    expect([...completeStages(untaken, episodesAll)]).toEqual([...completeStages(taken, episodesAll)]);
  });
});

describe('UPPER_PRIZE_STAGES: the stages of the stage ceremony, from the one prize table', () => {
  it('is Stages 2-7 in stage order, never Stage 1', () => {
    expect(UPPER_PRIZE_STAGES).toEqual(['stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']);
  });
});

describe('recapSyncSettled: the summary waits for this session\'s sync, so a key another device latched is pulled first', () => {
  it('never while a sync runs, even after the grace', () => {
    expect(recapSyncSettled('syncing', false)).toBe(false);
    expect(recapSyncSettled('syncing', true)).toBe(false);
  });

  it('at once after a finished sync, offline (error) or with no server (off)', () => {
    expect(recapSyncSettled('synced', false)).toBe(true);
    expect(recapSyncSettled('error', false)).toBe(true);
    expect(recapSyncSettled('off', false)).toBe(true);
  });

  it('idle or no record yet: only once the grace passed with no sync started', () => {
    expect(recapSyncSettled('idle', false)).toBe(false);
    expect(recapSyncSettled(undefined, false)).toBe(false);
    expect(recapSyncSettled('idle', true)).toBe(true);
    expect(recapSyncSettled(undefined, true)).toBe(true);
    expect(RECAP_SYNC_GRACE_MS).toBeGreaterThanOrEqual(1000);
  });
});
