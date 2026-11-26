import { ReviewEntrySchema } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { bannedNumberIn, leafStrings } from '../../reviews/banned-text';
import { buildHangulCheck } from '../hangul-check';
import {
  guardsBack,
  hangulCheckOpens,
  pauseLine,
  resultHeadline,
  reviewCompleteEvent,
  reviewResultView,
  reviewStartEvent,
  stageCertificateEntry,
  stageCertificateId,
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
  it('starts on the intro, with no romanization switch: every Check holds the romanization until the answer (DC-1a)', () => {
    expect(startReviewFlow({ chunks: 5 })).toEqual({
      phase: 'intro',
      chunk: 0,
      from: 0,
      chunks: 5,
      leaving: false,
    });
    expect(startReviewFlow({ chunks: 5, reading: true }).phase).toBe('reading');
  });

  it('plays 5 chunks with a Hoya pause between them, then the result, sending started then finished once', () => {
    const s0 = startReviewFlow({ chunks: 5 });
    const start = run(s0, [{ type: 'start' }]);
    expect(start.state).toMatchObject({ phase: 'playing', chunk: 0 });
    expect(start.effects).toEqual([{ type: 'started' }]);
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
    const playing = run(startReviewFlow({ chunks: 5 }), [{ type: 'start' }]).state;
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
    const s0 = startReviewFlow({ chunks: 5 });
    expect(run(s0, [{ type: 'leave' }]).effects).toEqual([{ type: 'exit' }]);
    const done = run(s0, [{ type: 'start' }, ...Array.from({ length: 4 }, () => [{ type: 'chunk-done' }, { type: 'keep-going' }] as ReviewFlowEvent[]).flat(), { type: 'chunk-done' }]);
    expect(done.state.phase).toBe('result');
    expect(run(done.state, [{ type: 'leave' }]).effects).toEqual([{ type: 'exit' }]);
    // A confirm with no question open does nothing.
    expect(run(s0, [{ type: 'confirm-leave' }, { type: 'stay' }])).toEqual({ state: s0, effects: [] });
  });

  it('a one-chunk check goes straight to the result', () => {
    const s = run(startReviewFlow({ chunks: 1 }), [{ type: 'start' }, { type: 'chunk-done' }]);
    expect(s.state.phase).toBe('result');
  });
});

/** [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-3a (test 18): the `reading` and `resume` phases. */
describe('[LR] the stored check: reading, resume, Continue, Start again', () => {
  const reading = () => startReviewFlow({ chunks: 5, reading: true });

  it('starts in reading when asked to, and a read that found nothing opens the intro', () => {
    expect(reading().phase).toBe('reading');
    expect(run(reading(), [{ type: 'read', found: false }]).state.phase).toBe('intro');
  });

  it('a read that found a run opens the resume page', () => {
    expect(run(reading(), [{ type: 'read', found: true }]).state.phase).toBe('resume');
  });

  it('a late read switches the intro to the resume page, but only while the intro shows (never after Let us go)', () => {
    const intro = run(reading(), [{ type: 'read', found: false }]).state;
    expect(run(intro, [{ type: 'read', found: true }]).state.phase).toBe('resume');
    // A late read that found nothing changes nothing.
    expect(run(intro, [{ type: 'read', found: false }]).state).toEqual(intro);
    // After Let us go (playing, a pause, the result) it is ignored.
    const playing = run(intro, [{ type: 'start' }]).state;
    expect(run(playing, [{ type: 'read', found: true }]).state).toEqual(playing);
    const pause = run(playing, [{ type: 'chunk-done' }]).state;
    expect(run(pause, [{ type: 'read', found: true }]).state).toEqual(pause);
  });

  it('Continue goes to playing at the resume point and sends no started effect', () => {
    const resume = run(reading(), [{ type: 'read', found: true }]).state;
    const out = run(resume, [{ type: 'continue', at: { chunk: 2, from: 3 } }]);
    expect(out.state).toMatchObject({ phase: 'playing', chunk: 2, from: 3 });
    expect(out.effects).toEqual([]);
  });

  it('Continue with every item answered goes straight to the finish', () => {
    const resume = run(reading(), [{ type: 'read', found: true }]).state;
    const out = run(resume, [{ type: 'continue', at: null }]);
    expect(out.state.phase).toBe('result');
    expect(out.effects).toEqual([{ type: 'finished' }]);
  });

  it('the offset belongs to the resumed part only: Keep going starts the next part from its first item', () => {
    const resume = run(reading(), [{ type: 'read', found: true }]).state;
    const playing = run(resume, [{ type: 'continue', at: { chunk: 1, from: 4 } }]).state;
    const next = run(playing, [{ type: 'chunk-done' }, { type: 'keep-going' }]).state;
    expect(next).toMatchObject({ phase: 'playing', chunk: 2, from: 0 });
  });

  it('Start again shows the intro with no effect (nothing is cleared until Let us go), and Let us go then starts a new check', () => {
    const resume = run(reading(), [{ type: 'read', found: true }]).state;
    const again = run(resume, [{ type: 'start-again' }]);
    expect(again.state.phase).toBe('intro');
    expect(again.effects).toEqual([]);
    expect(run(again.state, [{ type: 'start' }]).effects).toEqual([{ type: 'started' }]);
    // Only the resume page has these two events.
    expect(run(again.state, [{ type: 'start-again' }, { type: 'continue', at: null }])).toEqual({ state: again.state, effects: [] });
  });

  it('a leave on the reading frame or the resume page exits at once, and neither guards a back', () => {
    const resume = run(reading(), [{ type: 'read', found: true }]).state;
    expect(run(reading(), [{ type: 'leave' }]).effects).toEqual([{ type: 'exit' }]);
    expect(run(resume, [{ type: 'leave' }]).effects).toEqual([{ type: 'exit' }]);
    expect(guardsBack(reading())).toBe(false);
    expect(guardsBack(resume)).toBe(false);
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

  it('an item never answered is not right and not a learner miss, but is listed as unanswered', () => {
    const tally = tallyReview(ids, {});
    expect(tally).toMatchObject({ correct: 0, symbolsCorrect: 0, wordsCorrect: 0, missedItemIds: [] });
    expect(tally.unansweredItemIds).toEqual(ids);
  });

  it('the caregiver entry counts an unanswered item as not right on the first try, in item order', () => {
    const answers = all(true);
    delete answers['jamo:tieut'];
    answers['word:bap'] = { first: false, retries: 1 };
    const tally = tallyReview(ids, answers);
    expect(tally.missedItemIds).toEqual(['word:bap']);
    expect(tally.unansweredItemIds).toEqual(['jamo:tieut']);
    const entry = stageCertificateEntry({ itemIds: ids, tally, now: new Date('2026-10-12T09:00:00.000Z') });
    expect(entry.missedItemIds).toEqual(ids.filter((id) => id === 'jamo:tieut' || id === 'word:bap'));
    // The learner sees no tip for a letter that was never asked.
    expect(reviewResultView(tally).tips).toEqual([]);
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
    expect(tieut).toEqual({ jamoId: 'jamo:tieut', char: 'ㅌ', romanization: 't', final: false, questId: 'quest:stage1-life-q3', episodeId: 'episode:stage1-life' });
    const final = reviewResultView(tallyReview(['jamo:ieung-batchim'], { 'jamo:ieung-batchim': { first: false, retries: 0 } })).tips[0];
    expect(final).toMatchObject({ char: 'ㅇ', romanization: 'ng', final: true, questId: 'quest:stage1-rites-q2' });
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

describe('guardsBack: a system back mid-check asks "Stop the check?" first', () => {
  const start = startReviewFlow({ chunks: 5 });
  it('guards while playing and during a pause', () => {
    const playing = run(start, [{ type: 'start' }]).state;
    expect(guardsBack(playing)).toBe(true);
    expect(guardsBack(run(playing, [{ type: 'chunk-done' }]).state)).toBe(true);
  });

  it('lets back through on the intro and on the result', () => {
    expect(guardsBack(start)).toBe(false);
    const one = startReviewFlow({ chunks: 1 });
    expect(guardsBack(run(one, [{ type: 'start' }, { type: 'chunk-done' }]).state)).toBe(false);
  });

  it('a guarded back opens the same question as the close button', () => {
    const playing = run(start, [{ type: 'start' }]).state;
    expect(stepReviewFlow(playing, { type: 'leave' }).state.leaving).toBe(true);
  });
});

describe('hangulCheckOpens: the route opens only for a learner who finished Stage 1', () => {
  it('is true for stage1 when Stage 1 is complete', () => {
    expect(hangulCheckOpens('stage1', new Set(['stage1']))).toBe(true);
  });

  it('is false before Stage 1 is complete and for any other stage key', () => {
    expect(hangulCheckOpens('stage1', new Set())).toBe(false);
    expect(hangulCheckOpens('stage2', new Set(['stage1', 'stage2']))).toBe(false);
  });
});

describe('tip labels', () => {
  const a11y = getMessages('en').a11y;
  it('names a letter as a letter and a final as a final consonant', () => {
    expect(a11y.practiceLetter('t')).toBe('Practice the letter t again');
    expect(a11y.practiceFinal('n')).toBe('Practice the final consonant n again');
  });

  it('the not-ready line has no number and no shame word', () => {
    expect(bannedNumberIn(copy.notReady)).toBeNull();
    expect(copy.notReady).toBe('The Hangul Check is not open yet. Keep playing your quests.');
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

  it('[LR] the entry is named by the check\'s start time when it has one, and generated at the finish', () => {
    const startedAt = '2026-10-12T08:55:00.000Z';
    const entry = stageCertificateEntry({ itemIds: ids, tally, now: new Date('2026-10-13T09:00:00.000Z'), startedAt });
    expect(entry.id).toBe(stageCertificateId(startedAt));
    expect(entry.id).toBe('review:stage1:2026-10-12T08:55:00.000Z');
    expect(entry.generatedAt).toBe('2026-10-13T09:00:00.000Z');
    // The same check finished twice is the same entry.
    expect(stageCertificateEntry({ itemIds: ids, tally, now: new Date('2026-10-13T09:00:07.000Z'), startedAt }).id).toBe(entry.id);
  });

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
    expect(reviewStartEvent('p1')).toEqual({
      name: 'review.start',
      profileId: 'p1',
      payload: { kind: 'stage-certificate', stageKey: 'stage1' },
    });
    expect(reviewCompleteEvent('p1', tally)).toEqual({
      name: 'review.complete',
      profileId: 'p1',
      payload: { kind: 'stage-certificate', stageKey: 'stage1', symbolsCorrect: 29, wordsCorrect: 5, retries: 2, stars: 3 },
    });
  });
});
