import { IDLE_PAUSE_MS, hashSeed, type PlacementRunState } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  FALLBACK_MAX_MS,
  RESUME_WINDOW_MS,
  acknowledgement,
  appStateEvent,
  canProceed,
  choicesEnabled,
  choicesFallbackMs,
  defaultMode,
  flowReducer,
  controlsFor,
  idleTimeoutMs,
  languageTiles,
  pauseSheet,
  previousExclude,
  promptPlayback,
  resumableRun,
  resumeClocks,
  resumedFlow,
  withGuideHidden,
  retakeFlow,
  selectableLocale,
  runConfig,
  shortAvailable,
  showSoundGuideQuestion,
  speaksInstruction,
  startFlow,
  warmupAvoidTags,
  type FlowEvent,
  type FlowState,
  type SavedRun,
  type StartFlowInput,
} from '../flow';
import { gate, placementResult } from './fixtures';

const SOUND = { koreanAudio: true, instructionVoice: true, koreanInstructionVoice: true };
const NO_KO = { koreanAudio: false, instructionVoice: true, koreanInstructionVoice: false };
const NO_VOICE = { koreanAudio: true, instructionVoice: false, koreanInstructionVoice: true };
/** Korean clips can play, but no Korean voice speaks the instructions. */
const CLIPS_ONLY = { koreanAudio: true, instructionVoice: true, koreanInstructionVoice: false };

const start = (over: Partial<StartFlowInput> = {}): FlowState =>
  startFlow({
    source: 'home',
    levelOrder: 1,
    locales: ['en'],
    uiLocale: 'en',
    placements: [],
    screenReader: false,
    capability: SOUND,
    ...over,
  });
const run = (state: FlowState, ...events: FlowEvent[]): FlowState => events.reduce(flowReducer, state);

describe('shortAvailable', () => {
  it('needs both a Korean voice and an instruction voice', () => {
    expect(shortAvailable(true, true)).toBe(true);
    expect(shortAvailable(false, true)).toBe(false);
    expect(shortAvailable(true, false)).toBe(false);
  });
});

describe('defaultMode (section 3.1 step 3, first rule that matches)', () => {
  const band0 = { stage: 'stage1', band: 0 } as const;
  const shortHint = placementResult({
    mode: 'short',
    length: 'quick',
    gates: [gate('sound-basic', 'decode', 'pass', 3), gate('syl-cv', 'decode', 'fail', 2)],
  });

  it('rule 1: a newest Short whose hint fired (held at band 0 by the 3-of-3 rule) -> Standard', () => {
    expect(defaultMode(0, band0, shortHint, true)).toBe('standard');
  });

  it('rule 2: above stage1 band 0, whatever levelOrder -> Standard, also at stage3', () => {
    expect(defaultMode(0, { stage: 'stage1', band: 1 }, null, true)).toBe('standard');
    expect(defaultMode(0, { stage: 'stage3', band: 0 }, null, true)).toBe('standard');
  });

  it('rule 3: Pictures first with Short available -> Short', () => {
    expect(defaultMode(0, band0, null, true)).toBe('short');
    const noHint = placementResult({ mode: 'short', length: 'quick', gates: [gate('sound-basic', 'decode', 'fail', 1)] });
    expect(defaultMode(0, band0, noHint, true)).toBe('short');
  });

  it('rule 4: Pictures first without Short -> Standard', () => {
    expect(defaultMode(0, band0, null, false)).toBe('standard');
  });

  it('rule 5: everyone else -> Standard; Deep is never pre-selected', () => {
    for (const order of [1, 2, null] as const) expect(defaultMode(order, band0, null, true)).toBe('standard');
  });
});

describe('startFlow and the fork', () => {
  it('onboarding opens the fork; "I am new" declines without a run', () => {
    const s = start({ source: 'onboarding' });
    expect(s.screen).toBe('invite');
    expect(run(s, { type: 'declineFork' }).screen).toBe('declined');
  });

  it('with one shipped locale the language screen is skipped and testLocale is en', () => {
    const s = run(start({ source: 'onboarding' }), { type: 'acceptFork', capability: SOUND });
    expect(s.screen).toBe('options');
    expect(s.testLocale).toBe('en');
    expect(start().screen).toBe('options');
  });

  it('with more locales the language screen opens, defaulting to the UI locale', () => {
    const s = run(start({ source: 'onboarding', locales: ['en', 'es', 'ko'], uiLocale: 'es' }), {
      type: 'acceptFork',
      capability: SOUND,
    });
    expect(s.screen).toBe('language');
    expect(s.testLocale).toBe('es');
    expect(start({ locales: ['en', 'es'], uiLocale: 'ko' }).testLocale).toBe('en');
    expect(start({ locales: ['es', 'ko'], uiLocale: 'en' }).testLocale).toBe('es');
    expect(start({ locales: [] }).testLocale).toBe('en');
  });

  it('a Korean UI on a device without Korean sound starts on English, never on a disabled ko tile', () => {
    const noKo = start({ source: 'onboarding', locales: ['en', 'ko'], uiLocale: 'ko', capability: NO_KO });
    expect(noKo.testLocale).toBe('en');
    expect(run(noKo, { type: 'acceptFork', capability: NO_KO }).testLocale).toBe('en');
    expect(start({ locales: ['es', 'ko'], uiLocale: 'ko', capability: CLIPS_ONLY }).testLocale).toBe('es');
    expect(start({ locales: ['en', 'ko'], uiLocale: 'ko', capability: SOUND }).testLocale).toBe('ko');
  });

  it('with one shipped locale that locale is the test language', () => {
    expect(start({ locales: ['es'], uiLocale: 'en' }).testLocale).toBe('es');
    expect(start({ locales: ['es'], uiLocale: 'es' }).screen).toBe('options');
  });

  it('selectableLocale: ko only when it can be chosen; English first, else the first other locale', () => {
    expect(selectableLocale(['en', 'ko'], 'ko', true)).toBe('ko');
    expect(selectableLocale(['en', 'ko'], 'ko', false)).toBe('en');
    expect(selectableLocale(['es', 'ko', 'en'], 'ko', false)).toBe('en');
    expect(selectableLocale(['es', 'ko'], 'ko', false)).toBe('es');
    expect(selectableLocale(['ko'], 'ko', false)).toBe('en');
    expect(selectableLocale(['en', 'es'], 'es', false)).toBe('es');
  });

  it('a screen reader pre-sets Take my time and never changes the mode', () => {
    const s = start({ screenReader: true, levelOrder: 0 });
    expect(s.takeMyTime).toBe(true);
    expect(s.mode).toBe('short');
    expect(start().takeMyTime).toBe(false);
  });

  it('the effective level comes from every stored result', () => {
    const placed = placementResult({ level: { stage: 'stage1', band: 2 } });
    const s = start({ levelOrder: 0, placements: [placed] });
    expect(s.effectiveLevel).toEqual({ stage: 'stage1', band: 2 });
    expect(s.mode).toBe('standard');
  });
});

describe('the language screen', () => {
  const lang = () => start({ locales: ['en', 'es', 'ko'] });

  it('tiles: ko disabled without a Korean voice; a missing instruction voice only adds a line', () => {
    const voice = (l: string) => l !== 'es';
    expect(languageTiles(['en', 'es', 'ko'], 'en', false, voice)).toEqual([
      { locale: 'en', selected: true, disabled: false, line: null },
      { locale: 'es', selected: false, disabled: false, line: 'noVoice' },
      { locale: 'ko', selected: false, disabled: true, line: 'noKoreanVoice' },
    ]);
    expect(languageTiles(['ko'], 'ko', true, () => true)[0]).toEqual({ locale: 'ko', selected: true, disabled: false, line: null });
  });

  it('ko is disabled when Korean clips play but no Korean voice speaks its audio-only instructions', () => {
    const noKoVoice = (l: string) => l !== 'ko';
    expect(languageTiles(['en', 'ko'], 'en', true, noKoVoice)[1]).toEqual({ locale: 'ko', selected: false, disabled: true, line: 'noKoreanVoice' });
    const clips = start({ locales: ['en', 'ko'], capability: CLIPS_ONLY });
    expect(run(clips, { type: 'pickLocale', locale: 'ko' }).testLocale).toBe('en');
  });

  it('confirming never opens options on ko when Korean sound is missing', () => {
    const picked = run(start({ locales: ['en', 'ko'], uiLocale: 'ko' }), { type: 'pickLocale', locale: 'ko' });
    expect(picked.testLocale).toBe('ko');
    const confirmed = run(picked, { type: 'confirmLanguage', capability: NO_KO });
    expect(confirmed.screen).toBe('options');
    expect(confirmed.testLocale).toBe('en');
    expect(run(picked, { type: 'confirmLanguage', capability: SOUND }).testLocale).toBe('ko');
  });

  it('picking a tile sets the run locale; a disabled ko tile cannot be picked', () => {
    expect(run(lang(), { type: 'pickLocale', locale: 'es' }).testLocale).toBe('es');
    const noKo = start({ locales: ['en', 'ko'], capability: NO_KO });
    expect(run(noKo, { type: 'pickLocale', locale: 'ko' }).testLocale).toBe('en');
  });

  it('confirming opens options with Short availability read now', () => {
    const s = run(start({ locales: ['en', 'es'], levelOrder: 0 }), { type: 'confirmLanguage', capability: NO_VOICE });
    expect(s.screen).toBe('options');
    expect(s.shortAvailable).toBe(false);
    expect(s.mode).toBe('standard');
    expect(s.optionsLayout).toBe('full');
  });

  it('events that do not belong to the screen change nothing', () => {
    const s = lang();
    expect(run(s, { type: 'next' })).toBe(s);
    expect(run(s, { type: 'tapHoya' })).toBe(s);
    expect(run(s, { type: 'warmupAnswer' })).toBe(s);
    expect(run(s, { type: 'tryAgain' })).toBe(s);
    expect(run(s, { type: 'runFinished' })).toBe(s);
    expect(run(s, { type: 'declineFork' })).toBe(s);
    expect(run(start(), { type: 'pickLocale', locale: 'en' })).toEqual(start());
  });
});

describe('the options screen', () => {
  it('Pictures first with Short pre-selected: the C1 card, Start needs nothing else', () => {
    const s = start({ levelOrder: 0 });
    expect(s.optionsLayout).toBe('card');
    expect(s.mode).toBe('short');
    expect(showSoundGuideQuestion(s)).toBe(false);
    expect(canProceed(s)).toBe(true);
    expect(run(s, { type: 'next' }).screen).toBe('handoff');
  });

  it('Change opens the full screen (C2)', () => {
    const s = run(start({ levelOrder: 0 }), { type: 'change' });
    expect(s.optionsLayout).toBe('full');
    expect(s.mode).toBe('short');
  });

  it('a Pictures first learner with Standard pre-selected gets C2 and the sound-guide question', () => {
    const s = start({ levelOrder: 0, placements: [placementResult({ level: { stage: 'stage1', band: 1 } })] });
    expect(s.optionsLayout).toBe('full');
    expect(showSoundGuideQuestion(s)).toBe(true);
    expect(canProceed(s)).toBe(false);
  });

  it('the sound guide is asked for Standard and Deep with nothing pre-selected; NEXT waits for it', () => {
    const s = start();
    expect(s.revealMode).toBeNull();
    expect(showSoundGuideQuestion(s)).toBe(true);
    expect(canProceed(s)).toBe(false);
    expect(run(s, { type: 'next' })).toBe(s);
    const chosen = run(s, { type: 'setRevealMode', revealMode: 'always' });
    expect(canProceed(chosen)).toBe(true);
    expect(run(chosen, { type: 'next' }).screen).toBe('warmup');
    const deep = run(s, { type: 'selectMode', mode: 'deep' });
    expect(showSoundGuideQuestion(deep)).toBe(true);
    expect(canProceed(deep)).toBe(false);
  });

  it('the Short tile is disabled whenever Short is unavailable', () => {
    const s = start({ capability: NO_KO });
    expect(s.shortAvailable).toBe(false);
    expect(run(s, { type: 'selectMode', mode: 'short' }).mode).toBe('standard');
    const ok = run(start(), { type: 'selectMode', mode: 'short' });
    expect(ok.mode).toBe('short');
    expect(showSoundGuideQuestion(ok)).toBe(false);
    expect(run(ok, { type: 'next' }).screen).toBe('handoff');
  });

  it('Take my time and Why Korean? are set here', () => {
    const s = run(start(), { type: 'setTakeMyTime', on: true }, { type: 'setMotivation', motivation: 'kculture' });
    expect(s.takeMyTime).toBe(true);
    expect(s.motivation).toBe('kculture');
    expect(run(s, { type: 'setMotivation', motivation: null }).motivation).toBeNull();
  });

  it('options events outside the options screen change nothing', () => {
    const s = run(start({ source: 'onboarding' }));
    for (const e of [
      { type: 'change' },
      { type: 'selectMode', mode: 'deep' },
      { type: 'setRevealMode', revealMode: 'tap' },
      { type: 'setTakeMyTime', on: true },
      { type: 'setMotivation', motivation: 'curious' },
    ] as FlowEvent[]) {
      expect(run(s, e)).toBe(s);
    }
    expect(canProceed(s)).toBe(false);
    expect(showSoundGuideQuestion(s)).toBe(false);
  });
});

describe('the hand-off (section 3.1 step 3a)', () => {
  it('Pictures first in any mode goes through the hand-off', () => {
    const s = run(
      start({ levelOrder: 0, capability: NO_KO }),
      { type: 'setRevealMode', revealMode: 'tap' },
      { type: 'next' },
    );
    expect(s.screen).toBe('handoff');
    expect(run(s, { type: 'tapHoya' }).screen).toBe('warmup');
  });

  it('a Pictures first learner reaches the warm-up from the options card only through spoken controls with an icon', () => {
    let s = start({ levelOrder: 0 });
    expect(s).toMatchObject({ screen: 'options', optionsLayout: 'card' });
    const path: string[] = [];
    for (const want of ['options.start', 'handoff.hoya']) {
      const controls = controlsFor(s);
      expect(controls.length).toBeGreaterThan(0);
      for (const c of controls) {
        expect(c.spoken).toBe(true);
        expect(c.icon.length).toBeGreaterThan(0);
      }
      const control = controls.find((c) => c.id === want);
      expect(control).toBeDefined();
      path.push(s.screen);
      s = flowReducer(s, control!.event);
    }
    expect(path).toEqual(['options', 'handoff']);
    expect(s.screen).toBe('warmup');
    expect(controlsFor(s)).toEqual([]);
  });

  it('Change on the card opens the full options screen, a grown-up screen with no learner controls', () => {
    const card = start({ levelOrder: 0 });
    const change = controlsFor(card).find((c) => c.id === 'options.change')!;
    const full = flowReducer(card, change.event);
    expect(full.optionsLayout).toBe('full');
    expect(controlsFor(full)).toEqual([]);
  });
});

describe('the warm-up and sound-needed (section 3.1 step 4)', () => {
  const toWarmup = (over: Partial<StartFlowInput> = {}, ...events: FlowEvent[]) =>
    run(start(over), ...events, { type: 'next' }, ...(over.levelOrder === 0 ? [{ type: 'tapHoya' } as FlowEvent] : []));

  it('Standard, not listen-first, with no sound: a note, then the items without audio', () => {
    const s = toWarmup({}, { type: 'setRevealMode', revealMode: 'tap' });
    expect(s.screen).toBe('warmup');
    const muted = run(s, { type: 'warmupAudio', result: 'unavailable' });
    expect(muted.screen).toBe('warmup');
    expect(muted.noSoundNote).toBe(true);
    expect(muted.audio).toBe(false);
    const item = run(muted, { type: 'warmupAnswer' });
    expect(item.screen).toBe('item');
    expect(item.warmupDone).toBe(true);
  });

  it('a played warm-up keeps audio on', () => {
    const s = toWarmup({}, { type: 'setRevealMode', revealMode: 'tap' });
    expect(run(s, { type: 'warmupAudio', result: 'played' }).audio).toBe(true);
    expect(run(s, { type: 'warmupAnswer' }).audio).toBe(true);
  });

  it('sound switched off (muted) at the warm-up leaves the heard questions out of the draw (section 3.11)', () => {
    const standard = run(toWarmup({}, { type: 'setRevealMode', revealMode: 'tap' }), { type: 'warmupAudio', result: 'muted' });
    expect(standard.screen).toBe('warmup');
    expect(standard.audio).toBe(false);
    expect(standard.noSoundNote).toBe(true);
    expect(run(standard, { type: 'warmupAnswer' }).audio).toBe(false);
    // Short and a listen-first run need sound: "Turn on sound to play".
    expect(run(toWarmup({ levelOrder: 0 }), { type: 'warmupAudio', result: 'muted' }).screen).toBe('sound-needed');
    const listenFirstStandard = run(
      toWarmup({ levelOrder: 0, capability: NO_VOICE }, { type: 'setRevealMode', revealMode: 'tap' }),
      { type: 'warmupAudio', result: 'muted' },
    );
    expect(listenFirstStandard.mode).toBe('standard');
    expect(listenFirstStandard.screen).toBe('sound-needed');
  });

  it('Short or a listen-first learner without sound: the run does not start', () => {
    const short = run(toWarmup({ levelOrder: 0 }), { type: 'warmupAudio', result: 'unavailable' });
    expect(short.screen).toBe('sound-needed');
    const listenFirstStandard = run(
      toWarmup({ levelOrder: 0, capability: NO_VOICE }, { type: 'setRevealMode', revealMode: 'tap' }),
      { type: 'warmupAudio', result: 'unavailable' },
    );
    expect(listenFirstStandard.screen).toBe('sound-needed');
  });

  it('Try again repeats the warm-up; Start learning leaves with nothing recorded', () => {
    const s = run(toWarmup({ levelOrder: 0 }), { type: 'warmupAudio', result: 'unavailable' });
    const again = run(s, { type: 'tryAgain' });
    expect(again.screen).toBe('warmup');
    expect(again.audio).toBeNull();
    expect(run(s, { type: 'startLearning' }).screen).toBe('left');
  });

  it('Check without sound: C2 with Standard, Short disabled, the sound guide unanswered, no second warm-up', () => {
    const s = run(toWarmup({ levelOrder: 0 }), { type: 'warmupAudio', result: 'unavailable' }, { type: 'withoutSound' });
    expect(s.screen).toBe('options');
    expect(s.optionsLayout).toBe('full');
    expect(s.mode).toBe('standard');
    expect(s.shortAvailable).toBe(false);
    expect(s.revealMode).toBeNull();
    expect(s.listenFirst).toBe(false);
    expect(s.audio).toBe(false);
    expect(canProceed(s)).toBe(false);
    const handoff = run(s, { type: 'setRevealMode', revealMode: 'tap' }, { type: 'next' });
    expect(handoff.screen).toBe('handoff');
    expect(run(handoff, { type: 'tapHoya' }).screen).toBe('item');
    const reader = run(
      toWarmup({ levelOrder: 1 }, { type: 'selectMode', mode: 'short' }),
      { type: 'tapHoya' },
      { type: 'warmupAudio', result: 'unavailable' },
      { type: 'withoutSound' },
      { type: 'setRevealMode', revealMode: 'always' },
      { type: 'next' },
    );
    expect(reader.screen).toBe('item');
  });

  it('events that do not belong to the warm-up, items or the terminal screens change nothing', () => {
    const warm = toWarmup({}, { type: 'setRevealMode', revealMode: 'tap' });
    expect(run(warm, { type: 'next' })).toBe(warm);
    const item = run(warm, { type: 'warmupAnswer' });
    expect(run(item, { type: 'tapHoya' })).toBe(item);
    const done = run(item, { type: 'runFinished' });
    expect(run(done, { type: 'next' })).toBe(done);
    const declined = run(start({ source: 'onboarding' }), { type: 'declineFork' });
    expect(run(declined, { type: 'acceptFork', capability: SOUND })).toBe(declined);
    const needed = run(toWarmup({ levelOrder: 0 }), { type: 'warmupAudio', result: 'unavailable' });
    expect(run(needed, { type: 'next' })).toBe(needed);
    const hand = run(start({ levelOrder: 0 }), { type: 'next' });
    expect(run(hand, { type: 'next' })).toBe(hand);
  });

  it('the run finishing opens the result', () => {
    const s = run(toWarmup({}, { type: 'setRevealMode', revealMode: 'tap' }), { type: 'warmupAnswer' }, { type: 'runFinished' });
    expect(s.screen).toBe('result');
  });
});

describe('runConfig', () => {
  const ctx = {
    profileId: 'p1',
    startedAtMs: 1_000,
    screenReader: false,
    koreanAudio: true,
    exclude: ['pitem:old'],
    resolvesPicture: () => true,
    warmup: { question: { tags: ['word:bap', 'topic:food'] } },
  };
  const ready = (over: Partial<StartFlowInput>, ...events: FlowEvent[]) => run(start(over), ...events, { type: 'next' });

  it('Short runs with tap reveal (no sound-guide question), listen-first, and avoids the warm-up word', () => {
    const s = run(ready({ levelOrder: 0 }), { type: 'tapHoya' }, { type: 'warmupAudio', result: 'played' }, { type: 'warmupAnswer' });
    const config = runConfig(s, ctx);
    expect(config).toMatchObject({
      mode: 'short',
      listenFirst: true,
      revealMode: 'tap',
      audio: true,
      visual: true,
      takeMyTime: false,
      exclude: ['pitem:old'],
      avoidTags: ['word:bap'],
      seed: hashSeed(['p1', '1000']),
    });
  });

  it('Standard uses the explicit sound-guide choice; audio needs the warm-up and a Korean voice', () => {
    const s = run(ready({}, { type: 'setRevealMode', revealMode: 'always' }), { type: 'warmupAudio', result: 'played' });
    expect(runConfig(s, ctx).revealMode).toBe('always');
    expect(runConfig(s, { ...ctx, koreanAudio: false }).audio).toBe(false);
    expect(runConfig(s, { ...ctx, screenReader: true }).visual).toBe(false);
    expect(runConfig(s, { ...ctx, screenReader: true }).skipGates).toBeUndefined();
    expect(runConfig(ready({}, { type: 'setRevealMode', revealMode: 'tap' }), ctx).audio).toBe(false);
  });

  it('a Korean test language with a screen reader leaves the vocabulary and sentence rungs unasked (section 3.2)', () => {
    const ko = run(
      start({ locales: ['en', 'ko'], uiLocale: 'ko' }),
      { type: 'confirmLanguage', capability: SOUND },
      { type: 'setRevealMode', revealMode: 'tap' },
      { type: 'next' },
    );
    expect(ko.testLocale).toBe('ko');
    expect(runConfig(ko, { ...ctx, screenReader: true }).skipGates).toEqual(['vocab', 'sentence']);
    expect(runConfig(ko, ctx).skipGates).toBeUndefined();
  });

  it('never starts a Standard or Deep run without an explicit revealMode', () => {
    expect(() => runConfig(start(), ctx)).toThrow(/sound guide/);
  });

  it('the warm-up word tags and the previous result ids', () => {
    expect(warmupAvoidTags({ question: { tags: ['word:bap', 'word:x', 'topic:food'] } })).toEqual(['word:bap', 'word:x']);
    expect(previousExclude([])).toEqual([]);
    const older = placementResult({ id: 'placement:o', completedAt: '2026-01-01T00:00:00Z' });
    const newer = placementResult({
      id: 'placement:n',
      completedAt: '2026-02-01T00:00:00Z',
      responses: [
        { questionId: 'pitem:a', outcome: 'correct', chosenOptionId: 'x', assisted: false, ms: 1 },
        { questionId: 'pitem:b', outcome: 'skipped', chosenOptionId: null, assisted: false, ms: 1 },
      ],
    });
    expect(previousExclude([newer, older])).toEqual(['pitem:a', 'pitem:b']);
  });
});

describe('the item gate (section 3.1 step 5, Short layout)', () => {
  it('the fallback delay is the prompt length plus 3 s, at most 8 s', () => {
    expect(choicesFallbackMs(1_000)).toBe(4_000);
    expect(choicesFallbackMs(20_000)).toBe(FALLBACK_MAX_MS);
    expect(FALLBACK_MAX_MS).toBe(8_000);
  });

  it('Short enables the choices on the playback end or after the fallback delay', () => {
    const at = { mode: 'short', shownAtMs: 0, estimatedPromptMs: 1_000 } as const;
    expect(choicesEnabled({ ...at, playbackEnded: false, nowMs: 3_999 })).toBe(false);
    expect(choicesEnabled({ ...at, playbackEnded: true, nowMs: 100 })).toBe(true);
    expect(choicesEnabled({ ...at, playbackEnded: false, nowMs: 4_000 })).toBe(true);
    expect(choicesEnabled({ ...at, estimatedPromptMs: 60_000, playbackEnded: false, nowMs: 8_000 })).toBe(true);
  });

  it('Standard and Deep choices are enabled at once', () => {
    expect(choicesEnabled({ mode: 'standard', shownAtMs: 0, estimatedPromptMs: 5_000, playbackEnded: false, nowMs: 0 })).toBe(true);
  });

  it('prompts play on open, except the first item after a resume or cold start, and never with a screen reader', () => {
    expect(promptPlayback({ screenReader: false, needsGesture: false })).toBe('auto');
    expect(promptPlayback({ screenReader: false, needsGesture: true })).toBe('tap');
    expect(promptPlayback({ screenReader: true, needsGesture: false })).toBe('tap');
  });

  it('Short speaks the instruction on a rung first item only and acknowledges with the trail', () => {
    expect(speaksInstruction('short', 0)).toBe(true);
    expect(speaksInstruction('short', 1)).toBe(false);
    expect(speaksInstruction('standard', 2)).toBe(true);
    expect(acknowledgement('short')).toBe('trail');
    expect(acknowledgement('deep')).toBe('got-it');
  });
});

describe('pause rules (section 3.1 step 6)', () => {
  const state = (pause: PlacementRunState['pause']) => ({ pause }) as Pick<PlacementRunState, 'pause'>;

  it('the app leaving the foreground sends exit; coming back sends nothing', () => {
    expect(appStateEvent('background')).toEqual({ type: 'exit' });
    expect(appStateEvent('inactive')).toEqual({ type: 'exit' });
    expect(appStateEvent('active')).toBeNull();
  });

  it('45 s idle unless Take my time', () => {
    expect(idleTimeoutMs(false)).toBe(IDLE_PAUSE_MS);
    expect(idleTimeoutMs(true)).toBeNull();
  });

  it('the sheet: Need a break? with the grown-up link; the rest card has only the two buttons', () => {
    expect(pauseSheet(state(null))).toBeNull();
    for (const p of ['not-sure', 'idle', 'exit'] as const) {
      expect(pauseSheet(state(p))).toEqual({ kind: 'pause', grownUpLink: true, enough: { type: 'quit', by: 'learner' } });
    }
    expect(pauseSheet(state('rest'))).toEqual({ kind: 'rest', grownUpLink: false, enough: { type: 'quit', by: 'learner' } });
  });
});

describe('resumableRun (section 3.1 step 8)', () => {
  const runState = {
    version: 1,
    bankVersion: 1,
    config: { mode: 'standard', listenFirst: false, revealMode: 'tap', audio: true, visual: true, takeMyTime: false, seed: 7, exclude: [] },
    startedAtMs: 0,
    deadlineMs: null,
    lastTouchMs: 0,
    shownAtMs: 0,
    pause: null,
    pausedAtMs: null,
    timeUp: false,
    draws: {},
    done: [],
    current: null,
    responses: [],
    tags: {},
    notSureStreak: 0,
    rested: false,
    stop: null,
  } satisfies PlacementRunState;
  const saved: SavedRun = { version: 1, savedAtMs: 1_000, testLocale: 'en', source: 'home', run: runState };

  it('offers a run saved within 24 hours from the same bank', () => {
    expect(resumableRun(saved, 1_000 + RESUME_WINDOW_MS, 1)).toEqual({ kind: 'continue', saved });
    expect(resumableRun({ ...saved, motivation: 'curious' }, 2_000, 1)?.saved.motivation).toBe('curious');
  });

  it('discards older runs, other bank versions and anything that does not parse', () => {
    expect(resumableRun(saved, 1_001 + RESUME_WINDOW_MS, 1)).toBeNull();
    expect(resumableRun(saved, 2_000, 2)).toBeNull();
    expect(resumableRun({ ...saved, savedAtMs: 5_000 }, 2_000, 1)).toBeNull();
    expect(resumableRun(null, 2_000, 1)).toBeNull();
    expect(resumableRun({ version: 2 }, 2_000, 1)).toBeNull();
  });

  it('a stopped run with answers is offered to finish, whatever its age or bank; one with none is discarded', () => {
    const answered = {
      ...saved,
      run: {
        ...runState,
        stop: 'quit',
        responses: [{ questionId: 'pitem:a', outcome: 'correct', chosenOptionId: 'x', assisted: false, ms: 1 }],
      },
    } satisfies SavedRun;
    expect(resumableRun(answered, 2_000, 1)).toEqual({ kind: 'finish', saved: answered });
    expect(resumableRun(answered, 10 * RESUME_WINDOW_MS, 2)?.kind).toBe('finish');
    expect(resumableRun({ ...saved, run: { ...runState, stop: 'quit' } }, 2_000, 1)).toBeNull();
  });
});

describe('resumeClocks (section 3.1 steps 6 and 8)', () => {
  const base = {
    version: 1,
    bankVersion: 1,
    config: { mode: 'standard', listenFirst: false, revealMode: 'tap', audio: true, visual: true, takeMyTime: false, seed: 7, exclude: [] },
    startedAtMs: 0,
    deadlineMs: 600_000,
    lastTouchMs: 100_000,
    shownAtMs: 100_000,
    pause: null,
    pausedAtMs: null,
    timeUp: false,
    draws: {},
    done: [],
    current: null,
    responses: [],
    tags: {},
    notSureStreak: 0,
    rested: false,
    stop: null,
  } satisfies PlacementRunState;

  it('moves the deadline by the time away and restarts the idle clock and the open question', () => {
    expect(resumeClocks(base, 7_300_000)).toMatchObject({ deadlineMs: 7_800_000, lastTouchMs: 7_300_000, shownAtMs: 7_300_000 });
    expect(resumeClocks({ ...base, deadlineMs: null }, 7_300_000).deadlineMs).toBeNull();
    expect(resumeClocks(base, 50_000)).toMatchObject({ deadlineMs: 600_000, lastTouchMs: 50_000 });
  });

  it('leaves a paused or finished run alone (Keep going moves the deadline)', () => {
    const paused = { ...base, pause: 'rest', pausedAtMs: 100_000 } satisfies PlacementRunState;
    expect(resumeClocks(paused, 7_300_000)).toBe(paused);
    const stopped = { ...base, stop: 'quit' } satisfies PlacementRunState;
    expect(resumeClocks(stopped, 7_300_000)).toBe(stopped);
  });
});

describe('back on the options screen (wireframe C)', () => {
  it('returns to the language screen when it was shown', () => {
    const options = run(start({ locales: ['en', 'es'] }), { type: 'confirmLanguage', capability: SOUND });
    expect(options.screen).toBe('options');
    expect(run(options, { type: 'back' }).screen).toBe('language');
  });

  it('stays with one locale, and after "Check without sound" (the warm-up ran for this language)', () => {
    const one = start();
    expect(run(one, { type: 'back' })).toBe(one);
    const withoutSound = { ...run(start({ locales: ['en', 'es'] }), { type: 'confirmLanguage', capability: SOUND }), warmupDone: true };
    expect(run(withoutSound, { type: 'back' })).toBe(withoutSound);
  });
});

describe('resumedFlow (section 3.1 step 8)', () => {
  const config = { mode: 'deep' as const, listenFirst: true, revealMode: 'always' as const, audio: false, visual: true, takeMyTime: true, seed: 7, exclude: [] };
  const savedRun = (stop: PlacementRunState['stop']): SavedRun => ({
    version: 1,
    savedAtMs: 1_000,
    testLocale: 'es',
    source: 'profile',
    motivation: 'kculture',
    run: {
      version: 1,
      bankVersion: 1,
      config,
      startedAtMs: 0,
      deadlineMs: null,
      lastTouchMs: 0,
      shownAtMs: 0,
      pause: null,
      pausedAtMs: null,
      timeUp: false,
      draws: {},
      done: [],
      current: null,
      responses: [],
      tags: {},
      notSureStreak: 0,
      rested: false,
      stop,
    },
  });

  it('Continue opens the question the run stopped at, with the run\'s own settings', () => {
    const state = resumedFlow(start(), { kind: 'continue', saved: savedRun(null) });
    expect(state).toMatchObject({
      screen: 'item',
      source: 'profile',
      testLocale: 'es',
      mode: 'deep',
      revealMode: 'always',
      takeMyTime: true,
      listenFirst: true,
      motivation: 'kculture',
      audio: false,
      warmupDone: true,
    });
  });

  it('a stopped run that was never recorded opens on the result', () => {
    const saved = savedRun('quit');
    const { motivation: _unused, ...withoutMotivation } = saved;
    expect(resumedFlow(start(), { kind: 'finish', saved: withoutMotivation }).screen).toBe('result');
    expect(resumedFlow(start(), { kind: 'finish', saved: withoutMotivation }).motivation).toBeNull();
  });
});

describe('withGuideHidden (section 3.1 step 7, the one-tap retake)', () => {
  it('opens the full screen with the same length and the guide hidden, so NEXT can start', () => {
    const state = withGuideHidden(start(), 'deep');
    expect(state).toMatchObject({ screen: 'options', optionsLayout: 'full', mode: 'deep', revealMode: 'tap' });
    expect(canProceed(state)).toBe(true);
    // From the Pictures first card too.
    const card = start({ levelOrder: 0 });
    expect(card.optionsLayout).toBe('card');
    expect(withGuideHidden(card, 'standard')).toMatchObject({ optionsLayout: 'full', mode: 'standard', revealMode: 'tap' });
  });

  it('leaves Short and any other screen as they are', () => {
    const options = start();
    expect(withGuideHidden(options, 'short')).toBe(options);
    const invite = start({ source: 'onboarding' });
    expect(withGuideHidden(invite, 'standard')).toBe(invite);
  });
});

describe('retakeFlow (section 3.1 step 7: "Try it with the sound guide hidden" is a one-tap retake)', () => {
  const capability = () => SOUND;

  it('starts at once: the warm-up, or the hand-off for a Pictures first learner', () => {
    expect(retakeFlow(start(), 'standard', capability)).toMatchObject({ screen: 'warmup', mode: 'standard', revealMode: 'tap' });
    expect(retakeFlow(start({ levelOrder: 0 }), 'deep', capability)).toMatchObject({ screen: 'handoff', mode: 'deep', revealMode: 'tap' });
  });

  it('with more than one shipped locale it keeps the last check\'s language instead of asking again', () => {
    const placements = [placementResult({ testLocale: 'es' })];
    const lang = start({ locales: ['en', 'es'], uiLocale: 'en', placements });
    expect(lang.screen).toBe('language');
    expect(retakeFlow(lang, 'standard', capability)).toMatchObject({ screen: 'warmup', testLocale: 'es', revealMode: 'tap' });
    // No earlier check, or its language is no longer shipped: the current test language.
    expect(retakeFlow(start({ locales: ['en', 'es'], uiLocale: 'es' }), 'standard', capability).testLocale).toBe('es');
    const gone = start({ locales: ['en', 'es'], uiLocale: 'en', placements: [placementResult({ testLocale: 'ko' })] });
    expect(retakeFlow(gone, 'standard', capability)).toMatchObject({ screen: 'warmup', testLocale: 'en' });
  });

  it('leaves Short and the invite as they are', () => {
    const options = start();
    expect(retakeFlow(options, 'short', capability)).toBe(options);
    const invite = start({ source: 'onboarding' });
    expect(retakeFlow(invite, 'standard', capability)).toBe(invite);
  });
});
