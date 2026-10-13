import { ReviewEntrySchema } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { bannedNumberIn, leafStrings } from '../../reviews/banned-text';
import { buildHangulCheck } from '../hangul-check';
import {
  pauseLine,
  resultHeadline,
  reviewCompleteEvent,
  reviewResultView,
  reviewStartEvent,
  stageCertificateEntry,
  startReviewFlow,
  stepReviewFlow,
  tallyReview,
  type ReviewAnswer,
  type ReviewFlowEvent,
  type ReviewFlowState,
} from '../review-flow';

const copy = getMessages('en').learner.stageReview;
const check = buildHangulCheck({ seed: 3 });
const ids = check.items.map((i) => i.id);

function run(state: ReviewFlowState, events: ReviewFlowEvent[]) {
  const effects: unknown[] = [];
  let s = state;
  for (const e of events) {
    const out = stepReviewFlow(s, e);
    s = out.state;
    effects.push(...out.effects);
  }
  return { state: s, effects };
}

describe('the Hangul Check flow (F-QUEST-002 §3.9)', () => {
  it('starts on the intro, the romanization switch off unless the profile reads in tap mode', () => {
    expect(startReviewFlow({ chunks: 5, romanizationMode: 'always' })).toEqual({
      phase: 'intro',
      chunk: 0,
      chunks: 5,
      hideRomanization: false,
      leaving: false,
    });
    expect(startReviewFlow({ chunks: 5, romanizationMode: 'tap' }).hideRomanization).toBe(true);
  });

  it('the switch is for this attempt only and changes only on the intro', () => {
    const s0 = startReviewFlow({ chunks: 5, romanizationMode: 'always' });
    const { state } = run(s0, [{ type: 'toggle-romanization' }]);
    expect(state.hideRomanization).toBe(true);
    const playing = run(state, [{ type: 'start' }, { type: 'toggle-romanization' }]).state;
    expect(playing.hideRomanization).toBe(true);
  });

  it('plays 5 chunks with a Hoya pause between them, then the result, sending started then finished once', () => {
    const s0 = startReviewFlow({ chunks: 5, romanizationMode: 'always' });
    const start = run(s0, [{ type: 'start' }]);
    expect(start.state).toMatchObject({ phase: 'playing', chunk: 0 });
    expect(start.effects).toEqual([{ type: 'started', hideRomanization: false }]);
    let s = start.state;
    const all: unknown[] = [];
    for (let c = 0; c < 4; c += 1) {
      const pause = run(s, [{ type: 'chunk-done' }]);
      expect(pause.state).toMatchObject({ phase: 'pause', chunk: c });
      const next = run(pause.state, [{ type: 'keep-going' }]);
      expect(next.state).toMatchObject({ phase: 'playing', chunk: c + 1 });
      all.push(...pause.effects, ...next.effects);
      s = next.state;
    }
    expect(all).toEqual([]);
    const end = run(s, [{ type: 'chunk-done' }]);
    expect(end.state.phase).toBe('result');
    expect(end.effects).toEqual([{ type: 'finished' }]);
    // A stray event after the result changes nothing.
    expect(run(end.state, [{ type: 'chunk-done' }, { type: 'keep-going' }, { type: 'start' }]).effects).toEqual([]);
  });

  it('asks before stopping mid-check; staying keeps everything, stopping exits and saves nothing', () => {
    const playing = run(startReviewFlow({ chunks: 5, romanizationMode: 'always' }), [{ type: 'start' }]).state;
    const asking = run(playing, [{ type: 'leave' }]);
    expect(asking.state.leaving).toBe(true);
    expect(asking.effects).toEqual([]);
    expect(run(asking.state, [{ type: 'stay' }]).state).toEqual(playing);
    expect(run(asking.state, [{ type: 'confirm-leave' }]).effects).toEqual([{ type: 'exit' }]);
    // Also from a pause.
    const pause = run(playing, [{ type: 'chunk-done' }, { type: 'leave' }]);
    expect(pause.state.leaving).toBe(true);
  });

  it('leaves at once from the intro (Maybe later) and from the result', () => {
    const s0 = startReviewFlow({ chunks: 5, romanizationMode: 'always' });
    expect(run(s0, [{ type: 'leave' }]).effects).toEqual([{ type: 'exit' }]);
    const done = run(s0, [{ type: 'start' }, ...Array.from({ length: 4 }, () => [{ type: 'chunk-done' }, { type: 'keep-going' }] as ReviewFlowEvent[]).flat(), { type: 'chunk-done' }]);
    expect(done.state.phase).toBe('result');
    expect(run(done.state, [{ type: 'leave' }]).effects).toEqual([{ type: 'exit' }]);
    // A confirm with no question open does nothing.
    expect(run(s0, [{ type: 'confirm-leave' }, { type: 'stay' }])).toEqual({ state: s0, effects: [] });
  });

  it('a one-chunk check goes straight to the result', () => {
    const s = run(startReviewFlow({ chunks: 1, romanizationMode: 'always' }), [{ type: 'start' }, { type: 'chunk-done' }]);
    expect(s.state.phase).toBe('result');
  });
});

describe('tallyReview: first try over the 35 items', () => {
  const all = (first: boolean): Record<string, ReviewAnswer> => Object.fromEntries(ids.map((id) => [id, { first, retries: 0 }]));

  it('counts symbols and words right on the first try, retries, and the misses in item order', () => {
    const answers = all(true);
    answers['jamo:tieut'] = { first: false, retries: 1 };
    answers['word:bap'] = { first: false, retries: 2 };
    const tally = tallyReview(ids, answers);
    expect(tally).toMatchObject({ total: 35, correct: 33, symbolsCorrect: 29, wordsCorrect: 4, retries: 3 });
    expect(tally.missedItemIds).toEqual(ids.filter((id) => id === 'jamo:tieut' || id === 'word:bap'));
  });

  it('an item never answered is not right and not a miss', () => {
    const tally = tallyReview(ids, {});
    expect(tally).toMatchObject({ correct: 0, symbolsCorrect: 0, wordsCorrect: 0, missedItemIds: [] });
  });
});

describe('reviewResultView: what the learner sees', () => {
  const answers = Object.fromEntries(ids.map((id) => [id, { first: true, retries: 0 }])) as Record<string, ReviewAnswer>;

  it('every letter right: 3 stars and "Every letter!", no tips', () => {
    const view = reviewResultView(tallyReview(ids, answers));
    expect(view).toEqual({ stars: 3, tips: [], everyLetter: true });
  });

  it('up to three tip letters, each with the quest that teaches it; word misses are not tips', () => {
    const missed = { ...answers };
    for (const id of ['jamo:tieut', 'jamo:yu', 'jamo:ieung-batchim', 'jamo:a', 'word:san']) missed[id] = { first: false, retries: 1 };
    const view = reviewResultView(tallyReview(ids, missed));
    expect(view.everyLetter).toBe(false);
    expect(view.tips).toHaveLength(3);
    const tieut = reviewResultView(tallyReview(['jamo:tieut'], { 'jamo:tieut': { first: false, retries: 0 } })).tips[0];
    expect(tieut).toEqual({ jamoId: 'jamo:tieut', char: 'ㅌ', romanization: 't', questId: 'quest:stage1-life-q3', episodeId: 'episode:stage1-life' });
    const final = reviewResultView(tallyReview(['jamo:ieung-batchim'], { 'jamo:ieung-batchim': { first: false, retries: 0 } })).tips[0];
    expect(final).toMatchObject({ char: 'ㅇ', romanization: 'ng', questId: 'quest:stage1-rites-q2' });
  });

  it('a word miss alone keeps "Every letter!"', () => {
    const view = reviewResultView(tallyReview(ids, { ...answers, 'word:yeon': { first: false, retries: 0 } }));
    expect(view.everyLetter).toBe(true);
  });

  it('stars follow F-RVW-001 §3.1 and never fall to 0', () => {
    expect(reviewResultView(tallyReview(ids, {})).stars).toBe(1);
  });

  it('leaves out a tip whose symbol no quest teaches (never a dead chip)', () => {
    expect(reviewResultView(tallyReview(['jamo:nope'], { 'jamo:nope': { first: false, retries: 0 } })).tips).toEqual([]);
  });
});

describe('copy helpers', () => {
  it('picks a headline per star tier and a pause line per part', () => {
    expect([3, 2, 1].map((s) => resultHeadline(s as 1 | 2 | 3, copy.result.headline))).toEqual(['Wonderful!', 'Great work!', 'You did it!']);
    expect([0, 1, 2, 3, 9].map((c) => pauseLine(c, copy.pause))).toEqual([
      copy.pause.first,
      copy.pause.second,
      copy.pause.third,
      copy.pause.fourth,
      copy.pause.fourth,
    ]);
  });

  it('the learner copy shows no percent and no fraction', () => {
    for (const s of leafStrings(copy)) expect(bannedNumberIn(s), s).toBeNull();
  });
});

describe('the caregiver entry and telemetry', () => {
  const answers = Object.fromEntries(ids.map((id) => [id, { first: id !== 'jamo:pieup', retries: id === 'jamo:pieup' ? 2 : 0 }]));
  const tally = tallyReview(ids, answers);

  it('builds one stage-certificate entry with the 35 item ids, the stars and the misses', () => {
    const entry = stageCertificateEntry({ itemIds: ids, tally, now: new Date('2026-10-12T09:00:00.000Z') });
    expect(entry).toEqual({
      id: 'review:stage1:2026-10-12T09:00:00.000Z',
      kind: 'stage-certificate',
      generatedAt: '2026-10-12T09:00:00.000Z',
      scope: 'stage1',
      itemIds: ids,
      resultStars: 3,
      missedItemIds: ['jamo:pieup'],
    });
    expect(ReviewEntrySchema.safeParse(entry).success).toBe(true);
  });

  it('sends review.start and review.complete with numbers only on the analytics channel', () => {
    expect(reviewStartEvent('p1', true)).toEqual({
      name: 'review.start',
      profileId: 'p1',
      payload: { kind: 'stage-certificate', stageKey: 'stage1', hideRomanization: true },
    });
    expect(reviewCompleteEvent('p1', tally)).toEqual({
      name: 'review.complete',
      profileId: 'p1',
      payload: { kind: 'stage-certificate', stageKey: 'stage1', symbolsCorrect: 29, wordsCorrect: 5, retries: 2, stars: 3 },
    });
  });
});
