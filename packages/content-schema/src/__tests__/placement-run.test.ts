import { describe, expect, it } from 'vitest';
import {
  PlacementResultSchema,
  PlacementRunStateSchema,
  apply,
  currentQuestion,
  finishRun,
  isFinished,
  startRun,
  type AssessmentQuestion,
  type FinishContext,
  type PlacementConfig,
  type PlacementEvent,
  type PlacementRunState,
} from '..';
import { FULL_ROUTE, STAGE1_15, ids, q, qs } from './fixtures/stage1-15';
import { makeBank, only, template } from './fixtures/placement-bank';
import { PlacementResultSchemaV1 } from './fixtures/placement-result-schema-v1';
import { modeOf, levelOf } from '..';

const config = (over: Partial<PlacementConfig> = {}): PlacementConfig => ({
  mode: 'standard',
  revealMode: 'tap',
  audio: true,
  visual: true,
  takeMyTime: false,
  seed: 7,
  exclude: [],
  resolvesPicture: () => true,
  ...over,
});

const context = (over: Partial<FinishContext> = {}): FinishContext => ({
  catalog: STAGE1_15,
  isEntitled: () => true,
  completedQuestIds: new Set<string>(),
  completedAt: '2026-10-10T10:06:00.000Z',
  contentVer: 'test',
  testLocale: 'en',
  source: 'onboarding',
  ...over,
});

type Verdict = 'correct' | 'wrong' | 'skip' | 'assisted';

/** The rung a built question belongs to, from the synthetic bank's template ids. */
const rungOf = (id: string): string => {
  const m = /^pitem:(recog|sound-basic|sound-rest|syl-cvc|syl-cv)-/.exec(id);
  if (m !== null) return m[1] as string;
  if (id.startsWith('pitem:vocab-read')) return 'vocab:read';
  if (id.startsWith('pitem:vocab-hear')) return 'vocab:oral';
  if (id.startsWith('pitem:sent-hear')) return 'sentence:oral';
  return 'sentence:read';
};

const eventFor = (question: AssessmentQuestion, verdict: Verdict): PlacementEvent => {
  if (verdict === 'skip') return { type: 'notSure' };
  const correct = question.options.find((o) => o.isCorrect)!;
  const wrong = question.options.find((o) => !o.isCorrect)!;
  return { type: 'answer', optionId: (verdict === 'wrong' ? wrong : correct).id, assisted: verdict === 'assisted' };
};

/** Plays to the end. `verdicts` maps a rung key to what the learner does there (default: correct). */
const play = (
  start: PlacementRunState,
  verdicts: Record<string, Verdict> = {},
  fallback: Verdict = 'correct',
  t0 = 1_000,
): { state: PlacementRunState; asked: string[] } => {
  let state = start;
  let t = t0;
  const asked: string[] = [];
  for (let guard = 0; guard < 200 && !isFinished(state); guard += 1) {
    if (state.pause !== null) {
      state = apply(state, { type: 'keepGoing' }, t);
      continue;
    }
    const question = currentQuestion(state) as AssessmentQuestion;
    asked.push(question.id);
    t += 3_000;
    state = apply(state, eventFor(question, verdicts[rungOf(question.id)] ?? fallback), t);
  }
  return { state, asked };
};

const run = (over: Partial<PlacementConfig> = {}, bank = makeBank(), now = 1_000) => startRun(bank, config(over), now);

const ALL_PASS: Record<string, Verdict> = {};
const FAIL_FROM = (...rungs: string[]): Record<string, Verdict> => Object.fromEntries(rungs.map((r) => [r, 'wrong' as const]));

describe('startRun and currentQuestion', () => {
  it('opens on the first recognition question, unfinished, not paused', () => {
    const s = run();
    expect(isFinished(s)).toBe(false);
    expect(s.pause).toBeNull();
    expect(s.stop).toBeNull();
    const first = currentQuestion(s)!;
    expect(rungOf(first.id)).toBe('recog');
    expect(first.format).toBe('shape-odd-one-out');
  });

  it('builds the question from the template: its id, its options (one correct), its tags', () => {
    const first = currentQuestion(run())!;
    const bank = makeBank();
    const t = bank.templates.find((x) => x.id === first.id)!;
    expect(first.tags).toEqual(t.question.tags);
    expect(first.options.map((o) => o.id).sort()).toEqual(t.question.options.map((o) => o.id).sort());
    expect(first.options.filter((o) => o.isCorrect)).toHaveLength(1);
    expect(first).not.toHaveProperty('status');
    expect(first).not.toHaveProperty('glossEn');
  });

  it('is deterministic for a seed and varies with it', () => {
    const a = JSON.stringify(run({ seed: 11 }));
    expect(JSON.stringify(run({ seed: 11 }))).toBe(a);
    expect(JSON.stringify(run({ seed: 12 }))).not.toBe(a);
  });

  it('is a plain JSON value that its schema accepts', () => {
    const s = run();
    const copy = JSON.parse(JSON.stringify(s));
    expect(copy).toEqual(s);
    expect(PlacementRunStateSchema.parse(copy)).toEqual(s);
    expect(PlacementRunStateSchema.safeParse({ ...copy, version: 2 }).success).toBe(false);
  });

  it('keeps the picture resolver out of the persisted state', () => {
    expect(JSON.stringify(run())).not.toContain('resolvesPicture');
  });

  it('does not always put the correct option first', () => {
    const seeds = 300;
    let first = 0;
    for (let seed = 1; seed <= seeds; seed += 1) {
      if (currentQuestion(run({ seed }))!.options[0]!.isCorrect) first += 1;
    }
    expect(first / seeds).toBeLessThanOrEqual(0.35);
  });

  it('never puts the correct option in the same slot three times running inside a rung', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const s = run({ seed });
      const rungs = [s.current!.questions, ...Object.values(s.draws)];
      for (const questions of rungs) {
        const slots = questions.map((x) => x.options.findIndex((o) => o.isCorrect));
        expect(new Set(slots).size).toBeGreaterThan(1);
      }
    }
  });
});

describe('the draw', () => {
  const askedIn = (over: Partial<PlacementConfig> = {}, verdicts: Record<string, Verdict> = {}, bank = makeBank()) =>
    play(run(over, bank), verdicts).asked;

  it('asks three questions per rung from three distinct spread keys', () => {
    const asked = askedIn({}, ALL_PASS);
    const bank = makeBank();
    const tagsOf = (id: string) => bank.templates.find((t) => t.id === id)!.question.tags;
    const group = (rung: string) => asked.filter((id) => rungOf(id) === rung);
    expect(asked).toHaveLength(24);
    for (const rung of ['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc']) expect(group(rung)).toHaveLength(3);
    expect(group('vocab:read')).toHaveLength(6); // Standard confirms a vocab read pass
    const pairs = group('recog').map((id) => tagsOf(id).filter((t) => t.startsWith('sym:')).sort().join('|'));
    expect(new Set(pairs).size).toBe(3);
    const syms = group('sound-basic').map((id) => tagsOf(id)[0]);
    expect(new Set(syms).size).toBe(3);
    const syls = group('syl-cv').map((id) => tagsOf(id).find((t) => t.startsWith('syl:')));
    expect(new Set(syls).size).toBe(3);
  });

  it('sentence read is two read-pick-picture then one reply-pick', () => {
    const asked = askedIn({}, ALL_PASS).filter((id) => rungOf(id) === 'sentence:read');
    const bank = makeBank();
    const formats = asked.map((id) => bank.templates.find((t) => t.id === id)!.question.format);
    expect(formats).toEqual(['read-pick-picture', 'read-pick-picture', 'reply-pick']);
  });

  it('sentence read tops up from read items when there is no reply item, and is unavailable when still short', () => {
    const noReplies = only(makeBank(), (t) => t.question.format !== 'reply-pick');
    const asked = askedIn({}, ALL_PASS, noReplies).filter((id) => rungOf(id) === 'sentence:read');
    expect(asked).toHaveLength(3);
    const short = only(makeBank(), (t) => !(t.gate === 'sentence' && t.form === 'read' && t.id !== 'pitem:sent-read-0' && t.id !== 'pitem:sent-read-1'));
    expect(askedIn({}, ALL_PASS, short).filter((id) => rungOf(id) === 'sentence:read')).toHaveLength(0);
  });

  it('leaves draft templates out', () => {
    const bank = makeBank();
    const drafts = { ...bank, templates: bank.templates.map((t) => (t.id.startsWith('pitem:recog-odd-1') ? { ...t, status: 'draft' as const } : t)) };
    for (let seed = 1; seed <= 40; seed += 1) {
      const asked = play(run({ seed }, drafts)).asked;
      expect(asked.some((id) => id.startsWith('pitem:recog-odd-1') && id !== 'pitem:recog-odd-1' + id.slice(-1))).toBe(false);
      expect(asked).not.toContain('pitem:recog-odd-1');
      expect(asked).not.toContain('pitem:recog-odd-10');
    }
  });

  it('avoids the ids of the previous result when it can', () => {
    const bank = makeBank();
    const recog = bank.templates.filter((t) => t.gate === 'recog').map((t) => t.id);
    const exclude = recog.slice(0, 17);
    for (let seed = 1; seed <= 20; seed += 1) {
      const asked = askedIn({ seed, exclude }, FAIL_FROM('sound-basic')).filter((id) => rungOf(id) === 'recog');
      expect(asked.every((id) => !exclude.includes(id))).toBe(true);
    }
  });

  it('relaxes the exclusion only when a rung would otherwise have fewer than three questions', () => {
    const bank = makeBank();
    const recog = bank.templates.filter((t) => t.gate === 'recog').map((t) => t.id);
    const asked = askedIn({ exclude: recog.slice(0, 19) }, FAIL_FROM('sound-basic'), bank).filter((id) => rungOf(id) === 'recog');
    expect(asked).toHaveLength(3);
    expect(asked.filter((id) => recog.slice(0, 19).includes(id)).length).toBeGreaterThanOrEqual(2);
  });

  it('leaves out audio templates when there is no sound', () => {
    const asked = askedIn({ audio: false }, ALL_PASS);
    const bank = makeBank();
    for (const id of asked) expect(bank.templates.find((t) => t.id === id)!.question.requires.audio).toBe(false);
  });

  it('leaves out templates whose picture does not resolve (never substituting text)', () => {
    const bank = makeBank();
    const asked = askedIn({ resolvesPicture: (ref) => !ref.startsWith('card:vocab-read') }, ALL_PASS, bank);
    expect(asked.some((id) => rungOf(id) === 'vocab:read')).toBe(false);
  });

  it('with the sound guide always on, draws no leaking template', () => {
    const bank = makeBank();
    const { asked } = play(run({ revealMode: 'always' }, bank));
    for (const id of asked) expect(bank.templates.find((t) => t.id === id)!.question.leaks).toBe(false);
  });

  it('does not run a rung whose own draw has fewer than three eligible templates', () => {
    const thin = only(makeBank(), (t) => t.gate !== 'syl-cv' || t.id === 'pitem:syl-cv-0');
    const { asked } = play(run({}, thin));
    expect(asked.some((id) => rungOf(id) === 'syl-cv')).toBe(false);
  });

  it('treats an oral form as unavailable without audio and recog as unavailable without sight, even if a template says otherwise', () => {
    const bank = makeBank();
    const lax = {
      ...bank,
      templates: [
        ...bank.templates.filter((t) => !(t.gate === 'vocab' && t.form === 'oral')),
        ...[0, 1, 2].map((i) => template({ id: `vocab-hear-quiet-${i}`, gate: 'vocab', form: 'oral', format: 'hear-pick-picture', tags: [`word:q${i}`], kind: 'picture', audio: false })),
      ],
    };
    const muted = play(run({ audio: false }, lax), FAIL_FROM('sound-basic')).asked;
    expect(muted.some((id) => id.includes('quiet'))).toBe(false);
    const sighted = play(run({ visual: true }, lax), FAIL_FROM('sound-basic')).asked;
    expect(sighted.some((id) => id.includes('quiet'))).toBe(true);
    expect(play(run({ visual: false }, lax)).asked.some((id) => rungOf(id) === 'recog')).toBe(false);
  });
});

describe('a run end to end (the section 3.14 behaviours)', () => {
  it('fails sound-basic: exactly the two oral rungs follow, 12 questions, stage1 band 0, nothing placed out', () => {
    const { state, asked } = play(run(), FAIL_FROM('sound-basic'));
    expect(asked).toHaveLength(12);
    expect(asked.map(rungOf)).toEqual([
      ...Array(3).fill('recog'),
      ...Array(3).fill('sound-basic'),
      ...Array(3).fill('vocab:oral'),
      ...Array(3).fill('sentence:oral'),
    ]);
    const r = finishRun(state, context());
    expect(PlacementResultSchema.parse(r)).toEqual(r);
    expect(r.level).toEqual({ stage: 'stage1', band: 0 });
    expect(r.placedOutQuestIds).toEqual([]);
    expect(r.startQuestId).toBe(q(1));
    expect(r.stopReason).toBe('complete');
    expect(r.oralStage).toBe('stage3');
    expect(r.strands['sound-letter']).toBe('not-yet');
    expect(r.strands['hangul-recognition']).toBe('secure');
    expect(r.gates.map((g) => `${g.gate}:${g.form}:${g.result}`)).toEqual([
      'recog:decode:pass',
      'sound-basic:decode:fail',
      'vocab:oral:pass',
      'sentence:oral:pass',
    ]);
  });

  it('answers every rung through syl-cvc and reads vocabulary twice: 24 questions at most, stage2 band 0, all 15 placed out, none completed', () => {
    const { state, asked } = play(run(), { 'sentence:read': 'wrong' });
    expect(asked.length).toBeLessThanOrEqual(24);
    const r = finishRun(state, context());
    expect(r.level).toEqual({ stage: 'stage2', band: 0 });
    expect(r.placedOutQuestIds).toEqual(ids(STAGE1_15.quests));
    expect(r.startQuestId).toBeNull();
    expect(r.oralStage).toBeNull();
    expect(r.stopReason).toBe('cap');
    expect(r.beyondContent).toBe(false);
    expect(Object.keys(r)).not.toEqual(expect.arrayContaining(['quests', 'cards', 'homework', 'stars']));
  });

  it('on a free tier that learner has no entitled start, needsStage is stage2', () => {
    const { state } = play(run(), { 'sentence:read': 'wrong' });
    const r = finishRun(state, context({ isEntitled: (s) => s === 'stage1' }));
    expect(r.startQuestId).toBeNull();
    expect(r.needsStage).toBe('stage2');
    expect(r.placedOutQuestIds).toHaveLength(15);
  });

  it('a learner who passes everything lands at stage3 (beyond the content), 24 questions, cap', () => {
    const { state, asked } = play(run());
    expect(asked).toHaveLength(24);
    const r = finishRun(state, context({ catalog: FULL_ROUTE }));
    expect(r.level).toEqual({ stage: 'stage3', band: 0 });
    expect(r.beyondContent).toBe(true);
    expect(r.stopReason).toBe('cap');
    expect(r.strands).toEqual({
      'hangul-recognition': 'secure',
      'sound-letter': 'secure',
      'syllable-reading': 'secure',
      vocabulary: 'secure',
      sentences: 'secure',
    });
    expect(r.startQuestId).toBe('quest:stage4-life-q1');
    expect(r.placedOutQuestIds).toContain('quest:stage2-nature-q1');
  });

  it('Short stops after syl-cv: 9 questions (sounds, words, syllables), band 1, stored as quick + short, stop reason complete', () => {
    const { state, asked } = play(run({ mode: 'short' }));
    expect(asked).toHaveLength(9);
    expect(asked.map(rungOf)).toEqual([
      ...Array(3).fill('sound-basic'),
      ...Array(3).fill('vocab:oral'),
      ...Array(3).fill('syl-cv'),
    ]);
    const r = finishRun(state, context());
    expect(r.level).toEqual({ stage: 'stage1', band: 1 });
    expect(r.length).toBe('quick');
    expect(r.mode).toBe('short');
    expect(r.stopReason).toBe('complete');
    expect(r.oralStage).toBe('stage2');
    expect(r.placedOutQuestIds).toEqual(qs(1, 2, 3));
    expect(r.startQuestId).toBe(q(4));
  });

  it('Short needs all three CV syllables: 2 of 3 is a stored fail (band 0) that adds no blending token', () => {
    let state = run({ mode: 'short' });
    let t = 1_000;
    let missed = false;
    for (let guard = 0; guard < 20 && !isFinished(state); guard += 1) {
      const question = currentQuestion(state)!;
      const verdict: Verdict = rungOf(question.id) === 'syl-cv' && !missed ? 'skip' : 'correct';
      if (verdict === 'skip') missed = true;
      t += 1_000;
      state = apply(state, eventFor(question, verdict), t);
    }
    const r = finishRun(state, context());
    expect(r.gates.find((g) => g.gate === 'syl-cv')).toMatchObject({ correct: 2, result: 'fail' });
    expect(r.level).toEqual({ stage: 'stage1', band: 0 });
    expect(r.priorityTokens).not.toContain('skill:blending');
  });

  it('Short has no "three not sure" sheet', () => {
    let s = run({ mode: 'short' });
    for (let i = 0; i < 3; i += 1) s = apply(s, { type: 'notSure' }, 2_000 + i * 1_000);
    expect(s.pause).toBeNull();
    expect(isFinished(s)).toBe(false);
  });

  it('Short never draws Latin sound chips or tile items; neither does any mode for a listen-first learner', () => {
    const bank = makeBank();
    const formatOf = (id: string) => bank.templates.find((t) => t.id === id)!.question.format;
    for (let seed = 1; seed <= 30; seed += 1) {
      const runs = [
        play(run({ seed, mode: 'short' }, bank)).asked,
        play(run({ seed, mode: 'standard', listenFirst: true }, bank)).asked,
        play(run({ seed, mode: 'deep', listenFirst: true }, bank)).asked,
      ];
      for (const asked of runs) {
        for (const id of asked) expect(['see-pick-sound', 'build-syllable']).not.toContain(formatOf(id));
      }
    }
    expect(run({ mode: 'standard', listenFirst: true }).config.listenFirst).toBe(true);
    expect(run({ mode: 'short' }).config.listenFirst).toBe(true);
    expect(run().config.listenFirst).toBe(false);
  });

  it('Short with the sound guide shown asks shapes and words: 6 questions, band 0', () => {
    const { state, asked } = play(run({ mode: 'short', revealMode: 'always' }));
    expect(asked.map(rungOf)).toEqual([...Array(3).fill('vocab:oral'), ...Array(3).fill('recog')]);
    expect(finishRun(state, context()).level).toEqual({ stage: 'stage1', band: 0 });
  });

  it('Short with no sound asks nothing (the app never starts it; a zero-question result is never stored)', () => {
    for (const visual of [true, false]) {
      const s = run({ mode: 'short', audio: false, visual });
      expect(isFinished(s)).toBe(true);
      const r = finishRun(s, context());
      expect(r.responses).toEqual([]);
      expect(r.stopReason).toBe('complete');
    }
  });

  it('a listen-first learner with no sound has no decoding item in any mode (the app asks for sound first)', () => {
    const { asked } = play(run({ mode: 'standard', listenFirst: true, audio: false }));
    expect(asked.map(rungOf)).toEqual(Array(3).fill('recog'));
  });

  it('Standard with the sound guide shown and no screen reader is 9; with a screen reader too, 6', () => {
    expect(play(run({ revealMode: 'always' })).asked).toHaveLength(9);
    expect(play(run({ revealMode: 'always', visual: false })).asked).toHaveLength(6);
  });

  it('leaves out templates that share a tag with the warm-up (avoidTags)', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const asked = play(run({ seed, mode: 'short', avoidTags: ['word:w0', 'word:w1'] }), FAIL_FROM('sound-basic')).asked;
      expect(asked).not.toContain('pitem:vocab-hear-0');
      expect(asked).not.toContain('pitem:vocab-hear-1');
    }
  });

  it('Deep stores one row per draw and the result parses; Deep is stored as full + deep', () => {
    const { state, asked } = play(run({ mode: 'deep' }));
    expect(asked).toHaveLength(42);
    const r = finishRun(state, context({ catalog: FULL_ROUTE }));
    expect(PlacementResultSchema.parse(r)).toEqual(r);
    expect(r.length).toBe('full');
    expect(r.mode).toBe('deep');
    expect(r.gates.filter((g) => g.gate === 'syl-cv')).toHaveLength(2);
    expect(r.level).toEqual({ stage: 'stage3', band: 0 });
    expect(r.oralStage).toBe('stage3');
    expect(r.stopReason).toBe('cap');
  });

  it('Deep\'s confirming draw shares no template and no spread key with the first draw', () => {
    const bank = makeBank();
    const tmpl = (id: string) => bank.templates.find((t) => t.id === id)!;
    const key = (id: string) => {
      const tags = tmpl(id).question.tags;
      return tags.find((t) => t.startsWith('syl:') || t.startsWith('word:')) ?? tags.filter((t) => t.startsWith('sym:')).sort().join('|');
    };
    for (let seed = 1; seed <= 40; seed += 1) {
      const s = run({ seed, mode: 'deep' }, bank);
      for (const rung of ['sound-basic:decode', 'syl-cv:decode', 'sound-rest:decode', 'syl-cvc:decode', 'vocab:read']) {
        const one = (rung === 'sound-basic:decode' ? s.current!.questions : s.draws[rung]!).map((x) => x.id);
        const two = s.draws[`${rung}:2`]!.map((x) => x.id);
        expect(two.some((id) => one.includes(id))).toBe(false);
        expect(two.some((id) => one.map(key).includes(key(id)))).toBe(false);
      }
    }
  });

  it('Deep\'s confirming syllable draw holds one tile item when one is eligible', () => {
    const bank = makeBank();
    for (let seed = 1; seed <= 20; seed += 1) {
      const s = run({ seed, mode: 'deep' }, bank);
      const formats = s.draws['syl-cv:decode:2']!.map((x) => x.format);
      expect(formats.filter((f) => f === 'build-syllable')).toHaveLength(1);
    }
  });

  it('a second draw falls back on templates with a used spread key, and is unavailable only when too few remain', () => {
    const bank = makeBank();
    // four sound-basic templates over two symbols: the second draw must reuse a symbol
    const thin = only(bank, (t) => t.gate !== 'sound-basic' || ['pitem:sound-basic-hear-0', 'pitem:sound-basic-see-0', 'pitem:sound-basic-hear-1', 'pitem:sound-basic-see-1', 'pitem:sound-basic-hear-2', 'pitem:sound-basic-see-2'].includes(t.id));
    const s = run({ mode: 'deep' }, thin);
    expect(s.draws['sound-basic:decode:2']).toHaveLength(3);
    const thinner = only(bank, (t) => t.gate !== 'sound-basic' || ['pitem:sound-basic-hear-0', 'pitem:sound-basic-see-0', 'pitem:sound-basic-hear-1', 'pitem:sound-basic-see-1'].includes(t.id));
    expect(run({ mode: 'deep' }, thinner).draws['sound-basic:decode:2']).toBeUndefined();
  });

  it('Deep offers one rest card after 18 questions; keep going carries on, quit ends with quit', () => {
    let s = run({ mode: 'deep' });
    let t = 1_000;
    let rests = 0;
    for (let guard = 0; guard < 60 && !isFinished(s); guard += 1) {
      if (s.pause === 'rest') {
        rests += 1;
        expect(s.responses).toHaveLength(18);
        s = apply(s, { type: 'keepGoing' }, t);
        continue;
      }
      t += 1_000;
      s = apply(s, eventFor(currentQuestion(s)!, 'correct'), t);
    }
    expect(rests).toBe(1);
    let q18 = run({ mode: 'deep' });
    for (let i = 0; i < 18; i += 1) q18 = apply(q18, eventFor(currentQuestion(q18)!, 'correct'), 2_000 + i);
    expect(q18.pause).toBe('rest');
    expect(finishRun(apply(q18, { type: 'quit', by: 'learner' }, 9_000), context()).stopReason).toBe('quit');
    // the backstop stops while the rest card is open: keep going moves the deadline by exactly the time it was open
    const before = q18.deadlineMs as number;
    expect(q18.pausedAtMs).toBe(2_017);
    const resumed = apply(q18, { type: 'keepGoing' }, 2_017 + 95_000);
    expect(resumed.pause).toBeNull();
    expect(resumed.deadlineMs).toBe(before + 95_000);
  });

  it('Deep: when three "not sure" at the 18th answer open the pause sheet, the rest card follows at the next rung, once', () => {
    let s = run({ mode: 'deep' });
    let t = 1_000;
    for (let i = 0; i < 15; i += 1) s = apply(s, eventFor(currentQuestion(s)!, 'correct'), (t += 1_000));
    for (let i = 0; i < 3; i += 1) s = apply(s, { type: 'notSure' }, (t += 1_000));
    expect(s.responses).toHaveLength(18);
    expect(s.pause).toBe('not-sure');
    s = apply(s, { type: 'keepGoing' }, (t += 1_000));
    const pauses: [string, number][] = [];
    for (let guard = 0; guard < 40 && !isFinished(s); guard += 1) {
      if (s.pause !== null) {
        pauses.push([s.pause, s.responses.length]);
        s = apply(s, { type: 'keepGoing' }, (t += 1_000));
        continue;
      }
      s = apply(s, eventFor(currentQuestion(s)!, 'correct'), (t += 1_000));
    }
    expect(isFinished(s)).toBe(true);
    expect(pauses).toEqual([['rest', 21]]);
  });

  /** Plays Deep to the end; `failDraws` names `<gate>:<form>#<n>` draws (n = 1 or 2) answered wrong. */
  const playDeepFailing = (...failDraws: string[]): PlacementRunState => {
    let s = run({ mode: 'deep' });
    let t = 1_000;
    const seen: Record<string, number> = {};
    let lastStart = -1;
    for (let guard = 0; guard < 80 && !isFinished(s); guard += 1) {
      if (s.pause !== null) {
        s = apply(s, { type: 'keepGoing' }, (t += 1_000));
        continue;
      }
      const cur = s.current!;
      const rung = `${cur.gate}:${cur.form}`;
      if (cur.start !== lastStart) {
        seen[rung] = (seen[rung] ?? 0) + 1;
        lastStart = cur.start;
      }
      const verdict = failDraws.includes(`${rung}#${seen[rung]}`) ? 'wrong' : 'correct';
      s = apply(s, eventFor(currentQuestion(s)!, verdict), (t += 1_000));
    }
    expect(isFinished(s)).toBe(true);
    return s;
  };

  it('Deep: a pass left unconfirmed when an earlier confirmation fails places nothing out above the level', () => {
    // syl-cv's confirming draw fails after sound-rest's first draw passed: band 0, nothing placed out
    const cv = finishRun(playDeepFailing('syl-cv:decode#2'), context());
    expect(cv.gates.filter((g) => g.gate === 'sound-rest').map((g) => g.result)).toEqual(['pass']);
    expect(cv.level).toEqual({ stage: 'stage1', band: 0 });
    expect(cv.placedOutQuestIds).toEqual([]);
    expect(cv.startQuestId).toBe(q(1));
    // sound-rest's confirming draw fails after syl-cvc's first draw passed: band 1, only q1 to q3
    const rest = finishRun(playDeepFailing('sound-rest:decode#2'), context());
    expect(rest.gates.filter((g) => g.gate === 'syl-cvc').map((g) => g.result)).toEqual(['pass']);
    expect(rest.level).toEqual({ stage: 'stage1', band: 1 });
    expect(rest.placedOutQuestIds).toEqual(qs(1, 2, 3));
    expect(rest.startQuestId).toBe(q(4));
  });

  it('Deep: quitting inside a confirming draw keeps the first pass (the partial row is stopped, never a fail)', () => {
    let s = run({ mode: 'deep' });
    let t = 1_000;
    // recog, sound-basic, syl-cv, then the sound-basic confirmation: answer one wrong and quit
    for (let i = 0; i < 9; i += 1) s = apply(s, eventFor(currentQuestion(s)!, 'correct'), (t += 1_000));
    s = apply(s, eventFor(currentQuestion(s)!, 'wrong'), (t += 1_000));
    const r = finishRun(apply(s, { type: 'quit', by: 'learner' }, (t += 1_000)), context());
    expect(r.gates.filter((g) => g.gate === 'sound-basic').map((g) => [g.result, g.reason])).toEqual([
      ['pass', undefined],
      ['not-run', 'stopped'],
    ]);
    expect(r.level).toEqual({ stage: 'stage1', band: 1 });
    s = apply(s, eventFor(currentQuestion(s)!, 'wrong'), (t += 1_000));
    const two = finishRun(apply(s, { type: 'quit', by: 'learner' }, (t += 1_000)), context());
    expect(two.gates.filter((g) => g.gate === 'sound-basic').map((g) => g.result)).toEqual(['pass', 'fail']);
    expect(two.level).toEqual({ stage: 'stage1', band: 0 });
  });

  it('a wrong symbol cuts its quest back: the band is 1 but the start is the quest that teaches it', () => {
    let state = run({ mode: 'short' });
    let t = 1_000;
    let target: AssessmentQuestion | null = null;
    for (let guard = 0; guard < 40 && !isFinished(state); guard += 1) {
      if (state.pause !== null) {
        state = apply(state, { type: 'keepGoing' }, t);
        continue;
      }
      const question = currentQuestion(state)!;
      if (target === null && rungOf(question.id) === 'sound-basic') target = question;
      t += 1_000;
      // one sound-basic question is answered wrong; the rung still passes on the other two
      state = apply(state, eventFor(question, question === target ? 'wrong' : 'correct'), t);
    }
    const r = finishRun(state, context());
    const symbol = target!.tags.find((tag) => tag.startsWith('sym:'))!.slice(4);
    const teaching = STAGE1_15.quests.find((x) => x.teaches.includes(symbol))!;
    expect(r.level).toEqual({ stage: 'stage1', band: 1 });
    expect(r.gates.find((g) => g.gate === 'sound-basic')).toMatchObject({ correct: 2, result: 'pass' });
    expect(r.placedOutQuestIds).not.toContain(teaching.id);
    expect(r.startQuestId).toBe(STAGE1_15.quests.find((x) => !r.placedOutQuestIds.includes(x.id))!.id);
    expect(r.priorityTokens[0]).toBe(`sym:${symbol}`);
  });

  it('assisted answers count like "not sure": no pass, no covered symbols', () => {
    const { state } = play(run({ mode: 'short' }), { 'sound-basic': 'assisted' });
    const r = finishRun(state, context());
    const gate = r.gates.find((g) => g.gate === 'sound-basic')!;
    expect(gate).toMatchObject({ correct: 0, assisted: 3, result: 'fail' });
    expect(r.responses.filter((x) => x.assisted)).toHaveLength(3);
    expect(r.level).toEqual({ stage: 'stage1', band: 0 });
    expect(r.priorityTokens.every((tok) => tok.startsWith('sym:') || tok.startsWith('skill:'))).toBe(true);
    expect(r.priorityTokens.length).toBeGreaterThan(0);
  });

  it('the sound guide always on: recognition and listening only, decoding not tested, 9 questions, band 0', () => {
    const { state, asked } = play(run({ revealMode: 'always' }));
    expect(asked).toHaveLength(9);
    const r = finishRun(state, context());
    expect(r.revealMode).toBe('always');
    expect(r.level).toEqual({ stage: 'stage1', band: 0 });
    expect(r.strands['sound-letter']).toBe('not-tested');
    expect(r.strands['syllable-reading']).toBe('not-tested');
    expect(r.strands['hangul-recognition']).toBe('secure');
    expect(r.gates.find((g) => g.gate === 'sound-basic')).toMatchObject({ result: 'not-run', reason: 'unavailable', asked: 0 });
    expect(r.stopReason).toBe('complete');
    expect(r.placedOutQuestIds).toEqual([]);
  });

  it('no sound: audio-required templates are out, the oral rungs are not-run (unavailable), listening is not tested', () => {
    const { state } = play(run({ audio: false }), FAIL_FROM('sound-basic'));
    const r = finishRun(state, context());
    expect(r.oralStage).toBeNull();
    expect(r.gates.filter((g) => g.form === 'oral').map((g) => [g.result, g.reason])).toEqual([
      ['not-run', 'unavailable'],
      ['not-run', 'unavailable'],
    ]);
    expect(r.responses).toHaveLength(6);
  });

  it('a screen reader (no recognition rung): the floor is 9 and recog is reported unavailable', () => {
    const { state, asked } = play(run({ visual: false }), FAIL_FROM('sound-basic'));
    expect(asked).toHaveLength(9);
    const r = finishRun(state, context());
    expect(r.gates[0]).toMatchObject({ gate: 'recog', result: 'not-run', reason: 'unavailable', asked: 0 });
    expect(r.strands['hangul-recognition']).toBe('not-tested');
  });

  it('skipGates: a Korean test language with a screen reader leaves vocabulary and sentences unasked, reported unavailable (section 3.2)', () => {
    const { state, asked } = play(run({ visual: false, skipGates: ['vocab', 'sentence'] }));
    expect(asked.some((id) => /^(vocab|sentence):/.test(rungOf(id)))).toBe(false);
    const r = finishRun(state, context());
    const skipped = r.gates.filter((g) => g.gate === 'vocab' || g.gate === 'sentence');
    expect(skipped.length).toBeGreaterThan(0);
    for (const g of skipped) expect(g).toMatchObject({ result: 'not-run', reason: 'unavailable', asked: 0 });
    expect(r.strands.vocabulary).toBe('not-tested');
    expect(r.strands.sentences).toBe('not-tested');
    // The other rungs are drawn as before.
    expect(asked.some((id) => rungOf(id) === 'sound-basic')).toBe(true);
  });

  it('never exceeds 24 questions over many seeds and verdict mixes', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const verdicts: Record<string, Verdict> = {};
      for (const rung of ['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab:read', 'sentence:read', 'vocab:oral', 'sentence:oral']) {
        verdicts[rung] = (seed >> (rung.length % 5)) % 3 === 0 ? 'wrong' : 'correct';
      }
      const { asked } = play(run({ seed }), verdicts);
      expect(asked.length).toBeLessThanOrEqual(24);
      expect(asked.length).toBeGreaterThanOrEqual(12);
    }
  });

  it('uses today\'s completed quests: the start never lands on a completed quest', () => {
    const { state } = play(run({ mode: 'short' }));
    const r = finishRun(state, context({ completedQuestIds: new Set(qs(4, 5)) }));
    expect(r.startQuestId).toBe(q(6));
  });

  it('writes the context into the result: id from the seed, ISO start, source, locale, motivation, content version', () => {
    const started = Date.UTC(2026, 9, 10, 10, 0, 0);
    const { state } = play(run({ seed: 123456 }, makeBank(), started), FAIL_FROM('sound-basic'), 'correct', started + 1_000);
    const r = finishRun(
      state,
      context({ motivation: 'curious', source: 'parent', testLocale: 'ko', contentVer: 'v9', completedAt: '2026-10-10T10:07:00.000Z' }),
    );
    expect(r.id).toBe(`placement:${(123456).toString(36)}`);
    expect(r.startedAt).toBe('2026-10-10T10:00:00.000Z');
    expect(r).toMatchObject({ motivation: 'curious', source: 'parent', testLocale: 'ko', contentVer: 'v9', bankVersion: 1, completedAt: '2026-10-10T10:07:00.000Z' });
    expect(PlacementResultSchema.safeParse(r).success).toBe(true);
    expect('motivation' in finishRun(state, context())).toBe(false);
  });

  it('refuses to finish a run that is still going', () => {
    expect(() => finishRun(run(), context())).toThrow(/not finished/);
  });
});

describe('stored shape: old readers (the pre-mode schema) parse what the engine writes', () => {
  const mixes = (seed: number): Record<string, Verdict> => {
    const verdicts: Record<string, Verdict> = {};
    for (const rung of ['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab:read', 'sentence:read', 'vocab:oral', 'sentence:oral']) {
      verdicts[rung] = (['correct', 'wrong', 'skip', 'correct'] as const)[(seed * 7 + rung.length) % 4] as Verdict;
    }
    return verdicts;
  };

  it('every Short and Standard result parses with the old schema; the old reader drops mode', () => {
    for (let seed = 1; seed <= 80; seed += 1) {
      for (const mode of ['short', 'standard'] as const) {
        for (const verdicts of [mixes(seed), ALL_PASS]) {
          const r = finishRun(play(run({ seed, mode }), verdicts).state, context({ catalog: FULL_ROUTE }));
          const old = PlacementResultSchemaV1.safeParse(r);
          expect(old.success).toBe(true);
          expect(old.data).not.toHaveProperty('mode');
          expect(modeOf(old.data!)).toBe(mode);
        }
      }
    }
  });

  it('a long Deep result needs the relaxed bounds; with mode stripped it reads as Standard and its rows still score', () => {
    const r = finishRun(play(run({ mode: 'deep' })).state, context({ catalog: FULL_ROUTE }));
    expect(PlacementResultSchemaV1.safeParse(r).success).toBe(false);
    const { mode: _m, ...stripped } = r;
    expect(modeOf(stripped)).toBe('standard');
    expect(levelOf(stripped.gates)).toEqual(r.level);
    const shortDeep = finishRun(play(run({ mode: 'deep' }), FAIL_FROM('sound-basic')).state, context());
    expect(PlacementResultSchemaV1.safeParse(shortDeep).success).toBe(true);
  });
});

describe('events', () => {
  it('records "not sure" as skipped and an answer as correct or wrong, with the time taken', () => {
    let s = run({}, makeBank(), 10_000);
    const first = currentQuestion(s)!;
    s = apply(s, { type: 'notSure' }, 14_500);
    expect(s.responses[0]).toEqual({ questionId: first.id, outcome: 'skipped', chosenOptionId: null, assisted: false, ms: 4_500 });
    const second = currentQuestion(s)!;
    const wrong = second.options.find((o) => !o.isCorrect)!;
    s = apply(s, { type: 'answer', optionId: wrong.id }, 16_000);
    expect(s.responses[1]).toMatchObject({ questionId: second.id, outcome: 'wrong', chosenOptionId: wrong.id, assisted: false, ms: 1_500 });
    const third = currentQuestion(s)!;
    s = apply(s, { type: 'answer', optionId: third.options.find((o) => o.isCorrect)!.id, assisted: true }, 15_000);
    expect(s.responses[2]).toMatchObject({ outcome: 'correct', assisted: true, ms: 0 });
  });

  it('caps the time taken at ten minutes', () => {
    let s = run({ takeMyTime: true });
    s = apply(s, { type: 'notSure' }, 1_000 + 900_000);
    expect(s.responses[0]!.ms).toBe(600_000);
  });

  it('rejects an option that is not on the open question', () => {
    expect(() => apply(run(), { type: 'answer', optionId: 'nope' }, 2_000)).toThrow(/not an option/);
  });

  it('does not change the input state', () => {
    const s = run();
    const before = JSON.stringify(s);
    apply(s, { type: 'notSure' }, 5_000);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('ignores every event once the run is finished', () => {
    const { state } = play(run(), FAIL_FROM('sound-basic'));
    for (const e of [{ type: 'notSure' }, { type: 'tick' }, { type: 'idle' }, { type: 'keepGoing' }, { type: 'touch' }, { type: 'quit', by: 'learner' }] as PlacementEvent[]) {
      expect(apply(state, e, 999_999)).toBe(state);
    }
    expect(currentQuestion(state)).toBeNull();
  });
});

describe('stop reasons', () => {
  it('quit by the learner', () => {
    const s = apply(run(), { type: 'quit', by: 'learner' }, 5_000);
    expect(isFinished(s)).toBe(true);
    expect(finishRun(s, context()).stopReason).toBe('quit');
  });

  it('quit by a grown-up (behind the PIN gate)', () => {
    const s = apply(run(), { type: 'quit', by: 'grown-up' }, 5_000);
    expect(finishRun(s, context()).stopReason).toBe('grown-up');
  });

  it('"That is enough" after three "not sure" in a row is not-sure', () => {
    let s = run();
    for (let i = 0; i < 3; i += 1) s = apply(s, { type: 'notSure' }, 2_000 + i * 1_000);
    expect(s.pause).toBe('not-sure');
    const done = apply(s, { type: 'quit', by: 'learner' }, 9_000);
    const r = finishRun(done, context());
    expect(r.stopReason).toBe('not-sure');
    expect(r.responses).toHaveLength(3);
    expect(r.level).toEqual({ stage: 'stage1', band: 0 });
  });

  it('a grown-up ending a not-sure pause is still grown-up', () => {
    let s = run();
    for (let i = 0; i < 3; i += 1) s = apply(s, { type: 'notSure' }, 2_000 + i * 1_000);
    expect(finishRun(apply(s, { type: 'quit', by: 'grown-up' }, 9_000), context()).stopReason).toBe('grown-up');
  });

  it('a partly answered rung is still scored: two correct answers pass it; undecided ones are stopped', () => {
    let s = run();
    const one = (state: PlacementRunState, verdict: Verdict, t: number) => apply(state, eventFor(currentQuestion(state)!, verdict), t);
    s = one(s, 'correct', 2_000);
    s = one(s, 'correct', 3_000);
    const passed = finishRun(apply(s, { type: 'quit', by: 'learner' }, 4_000), context());
    expect(passed.gates).toEqual([{ gate: 'recog', form: 'decode', asked: 2, correct: 2, assisted: 0, result: 'pass' }]);
    const undecided = finishRun(apply(one(run(), 'correct', 2_000), { type: 'quit', by: 'learner' }, 3_000), context());
    expect(undecided.gates).toEqual([{ gate: 'recog', form: 'decode', asked: 1, correct: 1, assisted: 0, result: 'not-run', reason: 'stopped' }]);
    expect(undecided.strands['hangul-recognition']).toBe('not-tested');
  });

  it('a quit with nothing asked records no gate', () => {
    const r = finishRun(apply(run(), { type: 'quit', by: 'learner' }, 2_000), context());
    expect(r.gates).toEqual([]);
    expect(r.responses).toEqual([]);
    expect(r.level).toEqual({ stage: 'stage1', band: 0 });
  });
});

describe('pauses', () => {
  it('three "not sure" in a row open the pause; keep going carries on with the next question', () => {
    let s = run();
    for (let i = 0; i < 3; i += 1) s = apply(s, { type: 'notSure' }, 2_000 + i * 1_000);
    expect(s.pause).toBe('not-sure');
    const open = currentQuestion(s)!;
    s = apply(s, { type: 'notSure' }, 6_000);
    expect(s.responses).toHaveLength(3); // answers are ignored while the sheet is up
    s = apply(s, { type: 'keepGoing' }, 7_000);
    expect(s.pause).toBeNull();
    expect(currentQuestion(s)).toEqual(open);
    expect(s.notSureStreak).toBe(0);
    s = apply(s, { type: 'notSure' }, 8_000);
    expect(s.pause).toBeNull(); // the streak starts over
  });

  it('an answer between two "not sure" breaks the streak', () => {
    let s = run();
    s = apply(s, { type: 'notSure' }, 2_000);
    s = apply(s, { type: 'notSure' }, 3_000);
    s = apply(s, eventFor(currentQuestion(s)!, 'correct'), 4_000);
    s = apply(s, { type: 'notSure' }, 5_000);
    expect(s.pause).toBeNull();
  });

  it('a prompt that cannot play is recorded skipped but is not a "not sure" of the learner (section 3.11)', () => {
    let s = run();
    for (let i = 0; i < 3; i += 1) s = apply(s, { type: 'notSure', cause: 'no-sound' }, 2_000 + i * 1_000);
    expect(s.responses.map((r) => r.outcome)).toEqual(['skipped', 'skipped', 'skipped']);
    expect(s.pause).toBeNull();
    expect(s.notSureStreak).toBe(0);
    // It neither adds to nor breaks a streak the learner is on.
    s = apply(s, { type: 'notSure' }, 6_000);
    s = apply(s, { type: 'notSure' }, 7_000);
    s = apply(s, { type: 'notSure', cause: 'no-sound' }, 8_000);
    expect(s.notSureStreak).toBe(2);
    s = apply(s, { type: 'notSure' }, 9_000);
    expect(s.pause).toBe('not-sure');
  });

  it('no pause opens when the third "not sure" ends the run', () => {
    const { state } = play(run(), {}, 'correct');
    expect(state.pause).toBeNull();
  });

  it('45 seconds without a touch opens the inactivity pause and records nothing; keep going asks the same question again', () => {
    let s = run({}, makeBank(), 1_000);
    const open = currentQuestion(s)!;
    s = apply(s, { type: 'tick' }, 1_000 + 44_999);
    expect(s.pause).toBeNull();
    s = apply(s, { type: 'tick' }, 1_000 + 45_000);
    expect(s.pause).toBe('idle');
    expect(s.responses).toEqual([]);
    s = apply(s, { type: 'keepGoing' }, 80_000);
    expect(s.pause).toBeNull();
    expect(currentQuestion(s)).toEqual(open);
    expect(s.responses).toEqual([]);
    const timed = apply(s, { type: 'notSure' }, 83_000);
    expect(timed.responses[0]!.ms).toBe(3_000);
  });

  it('a touch resets the inactivity clock', () => {
    let s = run({}, makeBank(), 0);
    s = apply(s, { type: 'touch' }, 40_000);
    s = apply(s, { type: 'tick' }, 80_000);
    expect(s.pause).toBeNull();
    s = apply(s, { type: 'tick' }, 85_000);
    expect(s.pause).toBe('idle');
  });

  it('the idle event opens the same pause; ticks do nothing while paused', () => {
    let s = run();
    s = apply(s, { type: 'idle' }, 5_000);
    expect(s.pause).toBe('idle');
    expect(apply(s, { type: 'idle' }, 6_000)).toBe(s);
    expect(apply(s, { type: 'tick' }, 99_000_000)).toBe(s);
    expect(apply(s, { type: 'notSure' }, 7_000)).toBe(s);
    expect(apply(s, { type: 'answer', optionId: 'o1' }, 7_000)).toBe(s);
  });

  it('keep going when nothing is paused does nothing', () => {
    const s = run();
    expect(apply(s, { type: 'keepGoing' }, 3_000)).toBe(s);
  });

  it('a grown-up or learner can still quit from an inactivity pause', () => {
    let s = apply(run(), { type: 'idle' }, 5_000);
    s = apply(s, { type: 'quit', by: 'learner' }, 6_000);
    expect(finishRun(s, context()).stopReason).toBe('quit');
  });

  it('three "not sure" still open the pause with Take my time (there is no deadline to shift)', () => {
    let s = run({ takeMyTime: true });
    for (let i = 0; i < 3; i += 1) s = apply(s, { type: 'notSure' }, 2_000 + i * 1_000);
    expect(s.pause).toBe('not-sure');
    s = apply(s, { type: 'keepGoing' }, 99_000);
    expect(s.pause).toBeNull();
    expect(s.deadlineMs).toBeNull();
  });

  it('Take my time removes the inactivity pause and the backstop clock', () => {
    let s = run({ takeMyTime: true }, makeBank(), 0);
    expect(s.deadlineMs).toBeNull();
    s = apply(s, { type: 'tick' }, 10_000_000);
    expect(s.pause).toBeNull();
    expect(s.timeUp).toBe(false);
    s = apply(s, { type: 'idle' }, 10_000_001);
    expect(s.pause).toBeNull();
    s = apply(s, { type: 'notSure' }, 10_000_002);
    expect(isFinished(s)).toBe(false);
  });
});

describe('the backstop clock (D3)', () => {
  const answerCorrect = (s: PlacementRunState, t: number) => apply(s, eventFor(currentQuestion(s)!, 'correct'), t);

  it('starts when the run starts: 10 minutes Standard, 20 minutes Deep, none for Short', () => {
    expect(run({}, makeBank(), 1_000).deadlineMs).toBe(1_000 + 600_000);
    expect(run({ mode: 'deep' }, makeBank(), 1_000).deadlineMs).toBe(1_000 + 1_200_000);
    expect(run({ mode: 'short' }, makeBank(), 1_000).deadlineMs).toBeNull();
  });

  it('stops while the exit sheet is open: the deadline shifts by the time it was open', () => {
    let s = run({}, makeBank(), 0);
    s = apply(s, { type: 'exit' }, 100_000);
    expect(s.pause).toBe('exit');
    expect(apply(s, { type: 'exit' }, 101_000)).toBe(s);
    s = apply(s, { type: 'tick' }, 900_000);
    expect(s.timeUp).toBe(false);
    s = apply(s, { type: 'keepGoing' }, 1_000_000);
    expect(s.pause).toBeNull();
    expect(s.deadlineMs).toBe(600_000 + 900_000);
    expect(finishRun(apply(apply(s, { type: 'exit' }, 1_000_001), { type: 'quit', by: 'learner' }, 1_000_002), context()).stopReason).toBe('quit');
  });

  it('stops while the pause sheet is open too (a family break does not end the run)', () => {
    let s = run({}, makeBank(), 0);
    for (let i = 0; i < 3; i += 1) s = apply(s, { type: 'notSure' }, 1_000 + i);
    expect(s.pause).toBe('not-sure');
    s = apply(s, { type: 'tick' }, 3_000_000);
    expect(s.timeUp).toBe(false);
    s = apply(s, { type: 'keepGoing' }, 3_000_000);
    s = apply(s, { type: 'notSure' }, 3_001_000);
    expect(isFinished(s)).toBe(false);
  });

  it('when it runs out the open question can still be answered, then the run ends with time', () => {
    let s = run({}, makeBank(), 0);
    s = answerCorrect(s, 599_000);
    s = apply(s, { type: 'tick' }, 600_000);
    expect(s.timeUp).toBe(true);
    expect(isFinished(s)).toBe(false);
    const open = currentQuestion(s);
    expect(open).not.toBeNull();
    s = answerCorrect(s, 605_000);
    expect(isFinished(s)).toBe(true);
    const r = finishRun(s, context());
    expect(r.stopReason).toBe('time');
    expect(r.responses).toHaveLength(2);
    expect(r.responses.every((x) => x.outcome === 'correct')).toBe(true);
  });

  it('answering after the deadline without a tick ends the run too, and "not sure" is skipped, never wrong', () => {
    let s = run({}, makeBank(), 0);
    s = apply(s, { type: 'notSure' }, 700_000);
    expect(isFinished(s)).toBe(true);
    const r = finishRun(s, context());
    expect(r.stopReason).toBe('time');
    expect(r.responses.map((x) => x.outcome)).toEqual(['skipped']);
    expect(r.responses.some((x) => x.outcome === 'wrong')).toBe(false);
  });

  it('a partly answered rung is scored from what was asked', () => {
    let s = run({}, makeBank(), 0);
    s = answerCorrect(s, 1_000);
    s = answerCorrect(s, 700_000);
    const r = finishRun(s, context());
    expect(r.gates).toEqual([{ gate: 'recog', form: 'decode', asked: 2, correct: 2, assisted: 0, result: 'pass' }]);
    expect(r.stopReason).toBe('time');
  });

  it('a run that finishes on its own ends complete or cap, even when the clock has run out', () => {
    let state = run({}, makeBank(), 0);
    let t = 1_000;
    for (let guard = 0; guard < 40 && !isFinished(state); guard += 1) {
      if (state.pause !== null) state = apply(state, { type: 'keepGoing' }, t);
      else {
        state = apply(state, eventFor(currentQuestion(state)!, guard < 11 ? 'wrong' : 'correct'), t);
        t += 1_000;
      }
    }
    expect(['complete', 'cap']).toContain(finishRun(state, context()).stopReason);
  });

  it('ticks before the deadline change nothing; the pause shifts the deadline by the time paused', () => {
    let s = run({}, makeBank(), 0);
    expect(apply(s, { type: 'tick' }, 30_000)).toBe(s);
    s = apply(s, { type: 'idle' }, 20_000);
    s = apply(s, { type: 'keepGoing' }, 320_000);
    expect(s.deadlineMs).toBe(600_000 + 300_000);
    s = apply(s, { type: 'tick' }, 400_000);
    expect(s.timeUp).toBe(false);
  });

  it('the inactivity pause is dated from the last touch, so a late tick does not charge the waiting', () => {
    let s = run({}, makeBank(), 0);
    s = apply(s, { type: 'tick' }, 100_000);
    expect(s.pause).toBe('idle');
    expect(s.pausedAtMs).toBe(45_000);
    s = apply(s, { type: 'keepGoing' }, 100_000);
    expect(s.deadlineMs).toBe(600_000 + 55_000);
  });

  it('time does not shift when nothing is paused for a deep run with take my time off', () => {
    const s = run({ mode: 'deep' }, makeBank(), 0);
    expect(apply(s, { type: 'keepGoing' }, 5_000).deadlineMs).toBe(1_200_000);
  });
});

describe('resume', () => {
  it('a state serialised mid-run, parsed and continued gives the same questions and the same result', () => {
    const verdicts: Record<string, Verdict> = { 'syl-cv': 'wrong' };
    const straight = play(run({ seed: 99 }), verdicts).state;

    let s = run({ seed: 99 });
    let t = 1_000;
    for (let i = 0; i < 7; i += 1) {
      if (s.pause !== null) s = apply(s, { type: 'keepGoing' }, t);
      const question = currentQuestion(s)!;
      t += 3_000;
      s = apply(s, eventFor(question, verdicts[rungOf(question.id)] ?? 'correct'), t);
    }
    const revived = PlacementRunStateSchema.parse(JSON.parse(JSON.stringify(s)));
    expect(currentQuestion(revived)).toEqual(currentQuestion(s));
    expect(revived).toEqual(s);
    const resumed = play(revived, verdicts, 'correct', t).state;
    expect(finishRun(resumed, context())).toEqual(finishRun(straight, context()));
  });

  it('shrinks as rungs are used: a drawn rung is dropped from the persisted draws', () => {
    const start = run();
    const keysAtStart = Object.keys(start.draws).length;
    const { state } = play(start);
    expect(keysAtStart).toBeGreaterThan(0);
    expect(Object.keys(state.draws)).toEqual([]);
    expect(state.current).toBeNull();
  });
});
