import { encodeDeck, LectureDeckSchema, type LectureBlock, type LectureDeckInput } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { UNKNOWN_CAPABILITY, type AudioCapability } from '../../audio/capability';
import { lectureBundle } from '../content';
import { initialPresenterState } from '../controls';
import { expandDeck, withBuilds, type ExpandedDeck, type Slide } from '../deck-builder';
import { emptyRecent, rememberDeck, setLastSlide } from '../recent';
import {
  SHELL_SLIDE_KINDS,
  blockIndexOfSlide,
  countRows,
  distinctParts,
  completePayload,
  endLetters,
  fitShown,
  gestureCommand,
  homeStart,
  presenterLocale,
  resolveBoot,
  runDeck,
  slideDetail,
  startPayload,
  startTally,
  tallyStep,
  voiceState,
  voiceCheck,
  nextStrokePlay,
  strokeTokenFor,
} from '../shell';
import { barBand, stageBox, stageButtonSize, units } from '../stage-constants';
import { stageScale } from '../stage-scale';
import { layout, presenter, spacing, touchTarget } from '@hangul-route/design-system/tokens';

const BAR_BAND = barBand(touchTarget.hero, spacing.md);
const BOUNDS = { ...presenter.stage, compactWidth: layout.breakpoint.regular };

/**
 * The presenter shell's pure decisions (F-TCH-004 PR 6): the boot, the slides PR 6 draws and the
 * skipped parts, the End slide lists and fit step, the live-region detail, the telemetry payloads
 * (counts and modes only), and the stage box of README D1.
 */

const deckInput = (blocks: LectureBlock[], extra: Partial<LectureDeckInput> = {}): LectureDeckInput => ({
  v: 1,
  id: 'lecture:shell01',
  title: 'Week 3 letters',
  createdAt: '2026-10-13T09:00:00Z',
  seed: 7,
  blocks,
  ...extra,
});
const deckOf = (blocks: LectureBlock[], extra: Partial<LectureDeckInput> = {}) => LectureDeckSchema.parse(deckInput(blocks, extra));

const ready: AudioCapability = { tts: { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' }, clips: false, unlocked: false };
const none: AudioCapability = { tts: { state: 'none', reason: 'no_korean_voice' }, clips: false, unlocked: false };

describe('resolveBoot', () => {
  const link = (raw: string) => ({ raw, reloaded: false });

  it('opens a valid deck link, from the console or a Quick lesson', () => {
    const deck = deckOf([{ kind: 'episode', id: 'episode:stage1-letters' }]);
    expect(resolveBoot(link(encodeDeck(deck)), emptyRecent())).toEqual({ kind: 'deck', deck, source: 'console' });
    const quick = deckOf([{ kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }], { source: 'quick' });
    expect(resolveBoot(link(encodeDeck(quick)), emptyRecent())).toMatchObject({ kind: 'deck', source: 'quick' });
  });

  it('rejects a broken fragment with the codec reason', () => {
    expect(resolveBoot(link(''), emptyRecent())).toEqual({ kind: 'invalid', reason: 'empty' });
    expect(resolveBoot(link('1.!!!'), emptyRecent())).toEqual({ kind: 'invalid', reason: 'bad_encoding' });
    expect(resolveBoot(link('9.abc'), emptyRecent())).toMatchObject({ kind: 'invalid', reason: 'unsupported_version' });
  });

  it('after a reload reopens a started lesson at its slide, as a Recent start', () => {
    const deck = deckOf([{ kind: 'episode', id: 'episode:stage1-letters' }]);
    const list = setLastSlide(rememberDeck(emptyRecent(), deck, '2026-10-13T09:00:00Z'), deck.id, 'episode:stage1-letters/x');
    expect(resolveBoot({ raw: encodeDeck(deck), reloaded: true }, list)).toEqual({ kind: 'deck', deck, source: 'recent', resumeKey: 'episode:stage1-letters/x' });
  });

  it('a reload before Start, or a fresh link to a deck in Recent, starts from the beginning', () => {
    const deck = deckOf([{ kind: 'episode', id: 'episode:stage1-letters' }]);
    const saved = rememberDeck(emptyRecent(), deck, '2026-10-13T09:00:00Z');
    // A held deck that is in Recent stays a Recent start (lecture.start source), with no slide to resume.
    expect(resolveBoot({ raw: encodeDeck(deck), reloaded: true }, saved)).toEqual({ kind: 'deck', deck, source: 'recent' });
    expect(resolveBoot({ raw: encodeDeck(deck), reloaded: true }, emptyRecent())).toEqual({ kind: 'deck', deck, source: 'console' });
    const started = setLastSlide(saved, deck.id, 'episode:stage1-letters/x');
    expect(resolveBoot(link(encodeDeck(deck)), started)).toEqual({ kind: 'deck', deck, source: 'console' });
  });

  it('a Start over deck reloaded before Start opens at its first slide, still as a Recent start', () => {
    const deck = deckOf([{ kind: 'episode', id: 'episode:stage1-letters' }]);
    const list = setLastSlide(rememberDeck(emptyRecent(), deck, '2026-10-13T09:00:00Z'), deck.id, 'episode:stage1-letters/x');
    expect(resolveBoot({ raw: encodeDeck(deck), reloaded: true, fresh: true }, list)).toEqual({ kind: 'deck', deck, source: 'recent' });
  });

  it('shows the home without a deck', () => {
    expect(resolveBoot(null, emptyRecent())).toEqual({ kind: 'home' });
  });
});

describe('runDeck: the slides this build draws', () => {
  it('draws title, letter, syllable, word, order, card, activity and End slides (PR 6 and PR 7)', () => {
    expect([...SHELL_SLIDE_KINDS].sort()).toEqual(['activity', 'card', 'end', 'letter', 'sequence', 'syllable', 'title', 'vocab']);
    const deck = deckOf([
      { kind: 'episode', id: 'episode:stage1-letters' },
      { kind: 'quest', id: 'quest:stage1-life-q1' },
      { kind: 'quest', id: 'quest:stage1-rites-q3' },
      { kind: 'activity', preset: 'air-write', minutes: 3 },
      { kind: 'cards', cardIds: ['card:book'] },
      { kind: 'class-code', code: 'HYRA42' },
    ]);
    const expanded = expandDeck(deck, lectureBundle('en'), { canPlayKorean: true });
    const run = runDeck(deck, expanded);
    expect(new Set(run.slides.map((s) => s.kind))).toEqual(new Set(['title', 'letter', 'syllable', 'vocab', 'sequence', 'card', 'activity', 'end']));
    // The activity's minutes stay in the estimate with its slide.
    const quizzes = expanded.slides.filter((s) => s.kind === 'quiz').length;
    expect(run.minutes).toBe(expanded.minutes - quizzes);
  });

  it('a word whose card the art cannot draw loses its art build, so no press reveals nothing', () => {
    const end: Slide = { kind: 'end', letters: [], words: [], key: 'end', builds: ['summary'] };
    const word = { ko: '책', romanization: 'chaek', gloss: 'book' };
    const drawn: Slide = { kind: 'vocab', word, cardId: 'card:book', key: 'w/1', builds: ['ko', 'gloss', 'art'] };
    const undrawn: Slide = { kind: 'vocab', word, cardId: 'card:nope', key: 'w/2', builds: ['ko', 'rom', 'gloss', 'art'] };
    const deck = deckOf([{ kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]);
    const run = runDeck(deck, { slides: [drawn, undrawn, end], skipped: [], taught: [], minutes: 2 }, SHELL_SLIDE_KINDS, ['card:book']);
    expect(run.slides[0]).toEqual(drawn);
    expect(run.slides[1]).toEqual({ kind: 'vocab', word, key: 'w/2', builds: ['ko', 'rom', 'gloss'] });
    // The live romanization flip recomputes builds from the slide, and the art stays gone.
    expect(withBuilds(run.slides, { romanization: 'always', strokeGuide: true })[1]?.builds).toEqual(['ko', 'gloss']);
    // Without the drawable list the slides pass through unchanged.
    expect(runDeck(deck, { slides: [undrawn, end], skipped: [], taught: [], minutes: 2 }).slides[0]).toEqual(undrawn);
  });

  it('everything else is a skipped part, one per block and kind', () => {
    const deck = deckOf([
      { kind: 'episode', id: 'episode:stage1-letters' },
      { kind: 'quiz', from: 'all', rounds: 3 },
      { kind: 'activity', preset: 'air-write', minutes: 3 },
      { kind: 'class-code', code: 'HYRA42' },
    ]);
    const expanded = expandDeck(deck, lectureBundle('en'), { canPlayKorean: true });
    const run = runDeck(deck, expanded);
    expect(run.slides.at(-1)?.kind).toBe('end');
    expect(run.slides.filter((s) => s.kind === 'letter').length).toBeGreaterThan(4);
    const dropped = expanded.slides.filter((s) => !run.slides.includes(s));
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped.every((s) => s.kind === 'quiz')).toBe(true);
    // The skipped parts: the builder's own, plus the undrawn runs; the quiz block is one part.
    const added = run.parts.slice(expanded.skipped.length);
    expect(added.every((p) => p.reason === 'unsupported-step')).toBe(true);
    expect(added.filter((p) => p.blockIndex === 1)).toHaveLength(1);
    expect(added.filter((p) => p.blockIndex === 2)).toHaveLength(0);
    expect(added.length).toBeLessThan(dropped.length);
    // Quiz minutes leave the estimate with their slides; the activity's stay.
    expect(run.minutes).toBe(expanded.minutes - dropped.length);
  });

  it('an undrawn activity slide takes its minutes out of the estimate', () => {
    const end: Slide = { kind: 'end', letters: [], words: [], key: 'end', builds: ['summary'] };
    const activity: Slide = { kind: 'activity', preset: 'air-write', minutes: 3, key: 'activity:air-write', builds: ['prompt'] };
    const letter = expandDeck(deckOf([{ kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]), lectureBundle('en'), { canPlayKorean: true }).slides[0]!;
    const deck = deckOf([{ kind: 'activity', preset: 'air-write', minutes: 3 }, { kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]);
    const run = runDeck(deck, { slides: [activity, letter, end], skipped: [], taught: [], minutes: 5 }, new Set(['letter', 'end']));
    expect(run.minutes).toBe(2);
    expect(run.parts).toEqual([{ blockIndex: 0, reason: 'unsupported-step' }]);
  });

  it('a deck with nothing to draw but the End slide is empty (the invalid-deck screen)', () => {
    const end: Slide = { kind: 'end', letters: [], words: [], key: 'end', builds: ['summary'] };
    const quiz: Slide = { kind: 'quiz', prompt: { ask: 'odd-one-out' }, options: [], textPrompt: false, key: 'quiz/q1', builds: ['question', 'answer'] };
    const expanded: ExpandedDeck = { slides: [quiz, end], skipped: [], taught: [], minutes: 4 };
    const run = runDeck(deckOf([{ kind: 'quiz', from: 'all', rounds: 3 }]), expanded);
    expect(run.slides).toEqual([]);
    expect(run.parts).toEqual([{ blockIndex: 0, reason: 'unsupported-step' }]);
    expect(runDeck(deckOf([{ kind: 'quiz', from: 'all', rounds: 3 }]), { slides: [], skipped: [], taught: [], minutes: 0 }).slides).toEqual([]);
  });

  it('draws a story: its cover title, scenes, the order slide (PR 7) and checks', () => {
    const storyId = 'story:sejong-new-letters';
    const deck = deckOf([{ kind: 'story', storyId, checks: true }]);
    const expanded = expandDeck(deck, lectureBundle('en'), { canPlayKorean: true });
    expect(expanded.skipped).toEqual([]);
    const run = runDeck(deck, expanded);
    const kinds = run.slides.map((s) => s.kind);
    expect(kinds[0]).toBe('title');
    expect(run.slides[0]).toMatchObject({ source: 'story', cover: { storyId } });
    expect(kinds).toContain('story');
    expect(kinds).toContain('quiz');
    expect(kinds).toContain('sequence');
    expect(kinds.at(-1)).toBe('end');
    expect(run.slides.length).toBe(expanded.slides.length);
    expect(run.parts).toEqual([]);
  });

  it('draws only story checks among quiz slides; the other quizzes wait for PR 9', () => {
    expect(SHELL_SLIDE_KINDS.has('story')).toBe(true);
    expect(SHELL_SLIDE_KINDS.has('quiz')).toBe(true);
    const check: Slide = {
      kind: 'quiz',
      prompt: { ask: 'check', text: 'Who?' },
      options: [{ gloss: 'A', correct: true }, { gloss: 'B', correct: false }],
      textPrompt: false,
      key: 'story:x/check-c1',
      builds: ['question', 'answer'],
    };
    const odd: Slide = { ...check, prompt: { ask: 'odd-one-out' }, key: 'quiz/q1' };
    const letter = expandDeck(deckOf([{ kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]), lectureBundle('en'), { canPlayKorean: true }).slides;
    const run = runDeck(deckOf([{ kind: 'story', storyId: 'story:x', checks: true }, { kind: 'quiz', from: 'all', rounds: 1 }, { kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]), {
      slides: [check, odd, ...letter],
      skipped: [],
      taught: [],
      minutes: 3,
    });
    expect(run.slides.map((s) => s.key)).toEqual(['story:x/check-c1', ...letter.map((s) => s.key)]);
    expect(run.parts).toEqual([{ blockIndex: 1, reason: 'unsupported-step' }]);
    expect(run.minutes).toBe(2);
  });

  it('keeps the builder skips with their block', () => {
    const deck = deckOf([{ kind: 'quest', id: 'quest:nope' }, { kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]);
    const run = runDeck(deck, expandDeck(deck, lectureBundle('en'), { canPlayKorean: true }));
    expect(run.parts).toEqual([{ blockIndex: 0, reason: 'unknown-id' }]);
  });
});

describe('distinctParts', () => {
  it('lists each lesson and reason once, in order', () => {
    expect(
      distinctParts([
        { blockIndex: 0, reason: 'unsupported-step' },
        { blockIndex: 0, reason: 'unsupported-step' },
        { blockIndex: 0, reason: 'scope-too-small' },
        { blockIndex: null, reason: 'unsupported-step' },
      ]),
    ).toEqual([
      { blockIndex: 0, reason: 'unsupported-step' },
      { blockIndex: 0, reason: 'scope-too-small' },
      { blockIndex: null, reason: 'unsupported-step' },
    ]);
  });
});

describe('blockIndexOfSlide', () => {
  it('finds the block of a slide key, repeated blocks by their #n, and null for the End slide', () => {
    const deck = deckOf([
      { kind: 'quest', id: 'quest:stage1-letters-q1' },
      { kind: 'quiz', from: 'all', rounds: 2 },
      { kind: 'quest', id: 'quest:stage1-letters-q1' },
      { kind: 'activity', preset: 'air-write', minutes: 2 },
    ]);
    expect(blockIndexOfSlide(deck, 'quest:stage1-letters-q1/s2/jamo:giyeok')).toBe(0);
    expect(blockIndexOfSlide(deck, 'quiz/q1')).toBe(1);
    expect(blockIndexOfSlide(deck, 'quest:stage1-letters-q1#2/title')).toBe(2);
    expect(blockIndexOfSlide(deck, 'activity:air-write')).toBe(3);
    expect(blockIndexOfSlide(deck, 'end')).toBeNull();
  });
});

describe('the End slide', () => {
  it('merges a letter met twice into one item with its first reading', () => {
    expect(
      endLetters([
        { ko: 'a', romanization: 'g/k' },
        { ko: 'b', romanization: 'n' },
        { ko: 'a', romanization: 'k' },
      ]),
    ).toEqual([
      { ko: 'a', romanization: 'g/k' },
      { ko: 'b', romanization: 'n' },
    ]);
  });

  it('counts wrapped rows by overlap, so baseline offsets inside a row do not add rows', () => {
    expect(countRows([])).toBe(0);
    expect(countRows([{ y: 0, height: 40 }, { y: 6, height: 30 }, { y: 2, height: 36 }])).toBe(1);
    expect(countRows([{ y: 0, height: 40 }, { y: 52, height: 40 }, { y: 58, height: 30 }, { y: 104, height: 40 }])).toBe(3);
  });

  it('drops one item per step while the rows overflow, and stops at zero or when it fits', () => {
    expect(fitShown(11, 3, 2)).toBe(10);
    expect(fitShown(10, 2, 2)).toBe(10);
    expect(fitShown(0, 3, 2)).toBe(0);
  });
});

describe('slideDetail', () => {
  it('says the title, or the letter and its romanization; nothing for the End slide', () => {
    const [title, letter] = expandDeck(deckOf([{ kind: 'quest', id: 'quest:stage1-letters-q1' }]), lectureBundle('en'), { canPlayKorean: true }).slides;
    expect(slideDetail(title!)).toBe((title as Extract<Slide, { kind: 'title' }>).title);
    const l = expandDeck(deckOf([{ kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]), lectureBundle('en'), { canPlayKorean: true }).slides;
    expect(slideDetail(l[0]!)).toBe(`${(l[0] as Extract<Slide, { kind: 'letter' }>).char}, g/k`);
    expect(slideDetail(l[1]!)).toBe('');
    expect(letter).toBeDefined();
  });

  it('names the PR 7 slides by their taught item, card title or activity name; the order slide by its kind alone', () => {
    const slides = expandDeck(
      deckOf([
        { kind: 'quest', id: 'quest:stage1-letters-q1' },
        { kind: 'quest', id: 'quest:stage1-life-q1' },
        { kind: 'quest', id: 'quest:stage1-rites-q3' },
        { kind: 'activity', preset: 'air-write', minutes: 3 },
      ]),
      lectureBundle('en'),
      { canPlayKorean: true },
    ).slides;
    const of = <K extends Slide['kind']>(kind: K) => slides.find((s) => s.kind === kind) as Extract<Slide, { kind: K }>;
    const names = { activity: (preset: string) => `name of ${preset}` };
    expect(slideDetail(of('syllable'), names)).toBe(`${of('syllable').ko}, ${of('syllable').romanization}`);
    const vocab = of('vocab');
    expect(slideDetail(vocab, names)).toBe(`${vocab.word.ko}, ${vocab.word.romanization}, ${vocab.word.gloss}`);
    expect(slideDetail(of('card'), names)).toBe(of('card').title);
    expect(slideDetail(of('activity'), names)).toBe('name of air-write');
    expect(slideDetail(of('activity'))).toBe('');
    expect(slideDetail(of('sequence'), names)).toBe('');
  });

  it('says a story scene by its caption (README D8), and nothing for a check', () => {
    const slides = expandDeck(deckOf([{ kind: 'story', storyId: 'story:sejong-new-letters', checks: true }]), lectureBundle('en'), { canPlayKorean: true }).slides;
    const scene = slides.find((s): s is Extract<Slide, { kind: 'story' }> => s.kind === 'story' && s.caption !== undefined)!;
    expect(slideDetail(scene)).toBe(scene.caption);
    expect(slideDetail({ ...scene, caption: undefined })).toBe('');
    expect(slideDetail(slides.find((s) => s.kind === 'quiz')!)).toBe('');
  });
});

describe('telemetry payloads', () => {
  it('lecture.start carries counts and modes, nothing about a person or the title', () => {
    const deck = deckOf([{ kind: 'episode', id: 'episode:stage1-letters' }], { picker: { mode: 'names', count: 12 }, options: { romanization: 'tap' } });
    const run = runDeck(deck, expandDeck(deck, lectureBundle('en'), { canPlayKorean: true }));
    const payload = startPayload({ deck, run, source: 'console', pickerMode: 'numbers', capability: ready, offlineReady: true });
    expect(payload).toEqual({
      source: 'console',
      blocks: 1,
      slides: run.slides.length,
      skipped: run.parts.length,
      picker: 'numbers',
      romanization: 'tap',
      voice: 'ready',
      offlineReady: true,
    });
    expect(JSON.stringify(payload)).not.toContain('Week 3');
  });

  it('voice: ready with a voice or a clip, none without, unknown before the check', () => {
    expect(voiceState(ready)).toBe('ready');
    expect(voiceState({ ...none, clips: true })).toBe('ready');
    expect(voiceState(none)).toBe('none');
    expect(voiceState(UNKNOWN_CAPABILITY)).toBe('unknown');
  });

  it('lecture.complete counts distinct slides shown, reveals and whole minutes', () => {
    const slides = [{ key: 'a', builds: [] }, { key: 'b', builds: [] }, { key: 'c', builds: [] }];
    let t = startTally(1_000, 'a');
    t = tallyStep(t, { slideIdx: 0, reveal: 0 }, { slideIdx: 0, reveal: 1 }, slides);
    t = tallyStep(t, { slideIdx: 0, reveal: 1 }, { slideIdx: 1, reveal: 0 }, slides);
    t = tallyStep(t, { slideIdx: 1, reveal: 0 }, { slideIdx: 0, reveal: 1 }, slides);
    t = tallyStep(t, { slideIdx: 0, reveal: 1 }, { slideIdx: 0, reveal: 0 }, slides);
    t = tallyStep(t, { slideIdx: 0, reveal: 0 }, { slideIdx: 9, reveal: 0 }, slides);
    expect(completePayload(t, 1_000 + 5 * 60_000 + 20_000)).toEqual({ slidesShown: 2, minutes: 5, reveals: 1 });
    expect(completePayload(startTally(5_000, undefined), 1_000)).toEqual({ slidesShown: 0, minutes: 0, reveals: 0 });
    expect(initialPresenterState({ slides }).slideIdx).toBe(0);
  });
});

describe('stage box (README D1)', () => {
  it('the bar band is touchTarget.hero + 2 x spacing.md = 120, and the stage box is the window minus it', () => {
    expect(BAR_BAND).toBe(120);
    expect(stageBox({ width: 1280, height: 720 }, BAR_BAND)).toEqual({ width: 1280, height: 600 });
    expect(stageBox({ width: 100, height: 50 }, BAR_BAND)).toEqual({ width: 100, height: 0 });
  });

  it('1280 x 720 gives unit 1; 1920 x 1080 unit 1.5; 2560 x 1080 unit 1.6 (not the window 1.8)', () => {
    expect(stageScale(stageBox({ width: 1280, height: 720 }, BAR_BAND), BOUNDS).unit).toBe(1);
    expect(stageScale(stageBox({ width: 1920, height: 1080 }, BAR_BAND), BOUNDS).unit).toBe(1.5);
    expect(stageScale(stageBox({ width: 2560, height: 1080 }, BAR_BAND), BOUNDS).unit).toBeCloseTo(1.6);
    expect(stageScale(stageBox({ width: 1024, height: 768 }, BAR_BAND), BOUNDS).unit).toBeCloseTo(0.8);
  });

  it('a stage button never drops below the hero target; units round to whole pixels', () => {
    expect(stageButtonSize(0.6, touchTarget.hero)).toBe(touchTarget.hero);
    expect(stageButtonSize(1.5, touchTarget.hero)).toBe(144);
    expect(units(1.5, 360)).toBe(540);
  });
});

describe('gestureCommand (section 3.5)', () => {
  it('a tap on the left third goes back, elsewhere forward', () => {
    expect(gestureCommand({ x: 100, width: 1200, dx: 0, dy: 0 })).toBe('prev');
    expect(gestureCommand({ x: 400, width: 1200, dx: 2, dy: 3 })).toBe('next');
    expect(gestureCommand({ x: 1100, width: 1200, dx: 0, dy: 0 })).toBe('next');
  });

  it('a horizontal swipe of 60 px or more: left forward, right back', () => {
    expect(gestureCommand({ x: 600, width: 1200, dx: -60, dy: 10 })).toBe('next');
    expect(gestureCommand({ x: 100, width: 1200, dx: 80, dy: -20 })).toBe('prev');
  });

  it('a vertical or diagonal drag, or a stage with no width, does nothing', () => {
    expect(gestureCommand({ x: 600, width: 1200, dx: 60, dy: 50 })).toBeNull();
    expect(gestureCommand({ x: 600, width: 1200, dx: 0, dy: 90 })).toBeNull();
    expect(gestureCommand({ x: 600, width: 0, dx: 0, dy: 0 })).toBeNull();
  });
});

describe('voiceCheck (the start screen voice line)', () => {
  const ready = (local: boolean): AudioCapability => ({
    tts: { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local, quality: 'enhanced' },
    clips: false,
    unlocked: false,
  });

  it('names the ready voice, on this device or over the internet', () => {
    expect(voiceCheck(ready(true), false)).toEqual({ kind: 'local', name: 'Yuna' });
    expect(voiceCheck(ready(false), true)).toEqual({ kind: 'network', name: 'Yuna' });
  });

  it('reads clips-only as a ready voice with no empty name', () => {
    const clips: AudioCapability = { tts: { state: 'none', reason: 'no_engine' }, clips: true, unlocked: false };
    expect(voiceCheck(clips, true)).toEqual({ kind: 'clips' });
    expect(voiceCheck({ ...UNKNOWN_CAPABILITY, clips: true }, false)).toEqual({ kind: 'clips' });
  });

  it('says when the voice needs the internet, or there is none', () => {
    expect(voiceCheck({ tts: { state: 'none', reason: 'offline_network_only' }, clips: false, unlocked: false }, true)).toEqual({ kind: 'needs-internet' });
    expect(voiceCheck({ tts: { state: 'none', reason: 'no_engine' }, clips: false, unlocked: false }, true)).toEqual({ kind: 'none' });
  });

  it('is checking until the first check finished, then none', () => {
    expect(voiceCheck(UNKNOWN_CAPABILITY, false)).toEqual({ kind: 'checking' });
    expect(voiceCheck(UNKNOWN_CAPABILITY, true)).toEqual({ kind: 'none' });
  });
});

describe('stroke guide play (going back to a complete slide is silent)', () => {
  it('plays on a stroke reveal or replay, with a fresh token each time', () => {
    const first = nextStrokePlay(null, { slideKey: 'a', play: true });
    expect(first).toEqual({ slideKey: 'a', token: 1 });
    expect(nextStrokePlay(first, { slideKey: 'a', play: true })).toEqual({ slideKey: 'a', token: 2 });
  });

  it('keeps the guide through other reveals on the same slide', () => {
    const playing = { slideKey: 'a', token: 3 };
    expect(nextStrokePlay(playing, { slideKey: 'a', play: false })).toBe(playing);
  });

  it('drops the guide on any slide change without a stroke reveal, so Next then Prev does not replay it', () => {
    const playing = nextStrokePlay(null, { slideKey: 'a', play: true });
    const moved = nextStrokePlay(playing, { slideKey: 'b', play: false });
    expect(moved).toBeNull();
    const back = nextStrokePlay(moved, { slideKey: 'a', play: false });
    expect(back).toBeNull();
    expect(strokeTokenFor(back, 'a')).toBe(0);
  });

  it('gives the token only to the slide it was played on', () => {
    const playing = { slideKey: 'a', token: 2 };
    expect(strokeTokenFor(playing, 'a')).toBe(2);
    expect(strokeTokenFor(playing, 'b')).toBe(0);
    expect(strokeTokenFor(playing, undefined)).toBe(0);
    expect(strokeTokenFor(null, 'a')).toBe(0);
  });
});

describe('homeStart and presenterLocale (the presenter home, F-TCH-004 PR 8)', () => {
  const deck = deckOf([{ kind: 'episode', id: 'episode:stage1-letters' }]);
  const item = { deck, savedAt: '2026-10-13T09:00:00Z', lastSlideKey: 'episode:stage1-letters/x' };

  it('Resume opens the start screen at the saved slide, as a Recent start', () => {
    expect(homeStart({ kind: 'resume', item })).toEqual({ kind: 'ready', deck, source: 'recent', resumeKey: 'episode:stage1-letters/x' });
    const { lastSlideKey: _unused, ...never } = item;
    expect(homeStart({ kind: 'resume', item: never })).toEqual({ kind: 'ready', deck, source: 'recent' });
  });

  it('Start over opens the same deck from its first slide', () => {
    expect(homeStart({ kind: 'start-over', item })).toEqual({ kind: 'ready', deck, source: 'recent' });
  });

  it('Build lesson opens the Quick lesson deck as a quick start', () => {
    const quick = deckOf([{ kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }], { source: 'quick' });
    expect(homeStart({ kind: 'quick', deck: quick })).toEqual({ kind: 'ready', deck: quick, source: 'quick' });
  });

  it('the session chip wins, then the deck language, then the device locale', () => {
    const es = deckOf([{ kind: 'episode', id: 'episode:stage1-letters' }], { options: { uiLocale: 'es' } });
    const available = ['en', 'es', 'ko'] as const;
    expect(presenterLocale({ deck: null, session: null, device: 'en', available })).toBe('en');
    expect(presenterLocale({ deck: es, session: null, device: 'en', available })).toBe('es');
    expect(presenterLocale({ deck: es, session: 'ko', device: 'en', available })).toBe('ko');
    expect(presenterLocale({ deck: null, session: 'ko', device: 'en', available })).toBe('ko');
    // A chip for a locale this build does not offer is ignored.
    expect(presenterLocale({ deck: null, session: 'ko', device: 'en', available: ['en'] })).toBe('en');
    // So is a deck's language this build does not offer (the English-only release build).
    expect(presenterLocale({ deck: es, session: null, device: 'en', available: ['en'] })).toBe('en');
  });
});
