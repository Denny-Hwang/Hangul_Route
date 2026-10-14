import { encodeDeck, LectureDeckSchema, type LectureBlock, type LectureDeckInput } from '@hangul-route/content-schema';
import { touchTarget } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { UNKNOWN_CAPABILITY, type AudioCapability } from '../../audio/capability';
import { lectureBundle } from '../content';
import { initialPresenterState } from '../controls';
import { expandDeck, type ExpandedDeck, type Slide } from '../deck-builder';
import { emptyRecent, rememberDeck, setLastSlide } from '../recent';
import {
  SHELL_SLIDE_KINDS,
  blockIndexOfSlide,
  countRows,
  completePayload,
  endLetters,
  fitShown,
  gestureCommand,
  resolveBoot,
  runDeck,
  slideDetail,
  startPayload,
  startTally,
  tallyStep,
  voiceState,
} from '../shell';
import { BAR_BAND, stageBox, stageButtonSize, units } from '../stage-constants';
import { stageScale } from '../stage-scale';
import { presenter } from '@hangul-route/design-system/tokens';

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
  it('opens a valid deck fragment, from the console or a Quick lesson', () => {
    const deck = deckOf([{ kind: 'episode', id: 'episode:stage1-letters' }]);
    expect(resolveBoot(encodeDeck(deck), null, emptyRecent())).toEqual({ kind: 'deck', deck, source: 'console' });
    const quick = deckOf([{ kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }], { source: 'quick' });
    expect(resolveBoot(encodeDeck(quick), null, emptyRecent())).toMatchObject({ kind: 'deck', source: 'quick' });
  });

  it('rejects a broken fragment with the codec reason', () => {
    expect(resolveBoot('', null, emptyRecent())).toEqual({ kind: 'invalid', reason: 'empty' });
    expect(resolveBoot('1.!!!', null, emptyRecent())).toEqual({ kind: 'invalid', reason: 'bad_encoding' });
    expect(resolveBoot('9.abc', null, emptyRecent())).toMatchObject({ kind: 'invalid', reason: 'unsupported_version' });
  });

  it('after a reload reopens the lesson the tab had open, at its slide, as a Recent start', () => {
    const deck = deckOf([{ kind: 'episode', id: 'episode:stage1-letters' }]);
    const list = setLastSlide(rememberDeck(emptyRecent(), deck, '2026-10-13T09:00:00Z'), deck.id, 'episode:stage1-letters/x');
    expect(resolveBoot(null, deck.id, list)).toEqual({ kind: 'deck', deck, source: 'recent', resumeKey: 'episode:stage1-letters/x' });
    const noSlide = rememberDeck(emptyRecent(), deck, '2026-10-13T09:00:00Z');
    expect(resolveBoot(null, deck.id, noSlide)).toEqual({ kind: 'deck', deck, source: 'recent' });
  });

  it('shows the home without a fragment or an open lesson', () => {
    const deck = deckOf([{ kind: 'episode', id: 'episode:stage1-letters' }]);
    const list = rememberDeck(emptyRecent(), deck, '2026-10-13T09:00:00Z');
    expect(resolveBoot(null, null, list)).toEqual({ kind: 'home' });
    expect(resolveBoot(null, 'lecture:other01', list)).toEqual({ kind: 'home' });
  });
});

describe('runDeck: the slides PR 6 draws', () => {
  it('draws title, letter and End slides; everything else is a skipped part, one per block and kind', () => {
    const deck = deckOf([
      { kind: 'episode', id: 'episode:stage1-letters' },
      { kind: 'quiz', from: 'all', rounds: 3 },
      { kind: 'activity', preset: 'air-write', minutes: 3 },
      { kind: 'class-code', code: 'HYRA42' },
    ]);
    const expanded = expandDeck(deck, lectureBundle('en'), { canPlayKorean: true });
    const run = runDeck(deck, expanded);
    expect(new Set(run.slides.map((s) => s.kind))).toEqual(new Set(['title', 'letter', 'end']));
    expect(run.slides.at(-1)?.kind).toBe('end');
    expect(run.slides.filter((s) => s.kind === 'letter').length).toBeGreaterThan(4);
    const dropped = expanded.slides.filter((s) => !SHELL_SLIDE_KINDS.has(s.kind));
    expect(dropped.length).toBeGreaterThan(0);
    // The skipped parts: the builder's own, plus the undrawn runs; the quiz and activity blocks are one part each.
    const added = run.parts.slice(expanded.skipped.length);
    expect(added.every((p) => p.reason === 'unsupported-step')).toBe(true);
    expect(added.filter((p) => p.blockIndex === 1)).toHaveLength(1);
    expect(added.filter((p) => p.blockIndex === 2)).toHaveLength(1);
    expect(added.length).toBeLessThan(dropped.length);
    // Quiz minutes and activity minutes leave the estimate with their slides.
    const quizzes = dropped.filter((s) => s.kind === 'quiz').length;
    expect(run.minutes).toBe(expanded.minutes - quizzes - 3);
  });

  it('a deck with nothing to draw but the End slide is empty (the invalid-deck screen)', () => {
    const end: Slide = { kind: 'end', letters: [], words: [], key: 'end', builds: ['summary'] };
    const card: Slide = { kind: 'card', cardId: 'card:book', title: 'Book', key: 'cards/card:book', builds: ['art'] };
    const expanded: ExpandedDeck = { slides: [card, end], skipped: [], taught: [], minutes: 4 };
    const run = runDeck(deckOf([{ kind: 'cards', cardIds: ['card:book'] }]), expanded);
    expect(run.slides).toEqual([]);
    expect(run.parts).toEqual([{ blockIndex: 0, reason: 'unsupported-step' }]);
    expect(runDeck(deckOf([{ kind: 'cards', cardIds: ['card:book'] }]), { slides: [], skipped: [], taught: [], minutes: 0 }).slides).toEqual([]);
  });

  it('a story title (cover scene) waits for the story slides', () => {
    const title: Slide = { kind: 'title', source: 'story', title: 'T', cover: { storyId: 'story:x', sceneId: 's' }, key: 'story:x/title', builds: ['title'] };
    const letter = expandDeck(deckOf([{ kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]), lectureBundle('en'), { canPlayKorean: true }).slides;
    const run = runDeck(deckOf([{ kind: 'story', storyId: 'story:x' }, { kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]), {
      slides: [title, ...letter],
      skipped: [],
      taught: [],
      minutes: 0,
    });
    expect(run.slides.map((s) => s.kind)).toEqual(['letter', 'end']);
    expect(run.parts).toEqual([{ blockIndex: 0, reason: 'unsupported-step' }]);
  });

  it('keeps the builder skips with their block', () => {
    const deck = deckOf([{ kind: 'quest', id: 'quest:nope' }, { kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]);
    const run = runDeck(deck, expandDeck(deck, lectureBundle('en'), { canPlayKorean: true }));
    expect(run.parts).toEqual([{ blockIndex: 0, reason: 'unknown-id' }]);
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
    const slides = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
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
    expect(stageBox({ width: 1280, height: 720 })).toEqual({ width: 1280, height: 600 });
    expect(stageBox({ width: 100, height: 50 })).toEqual({ width: 100, height: 0 });
  });

  it('1280 x 720 gives unit 1; 1920 x 1080 unit 1.5; 2560 x 1080 unit 1.6 (not the window 1.8)', () => {
    expect(stageScale(stageBox({ width: 1280, height: 720 }), presenter.stage).unit).toBe(1);
    expect(stageScale(stageBox({ width: 1920, height: 1080 }), presenter.stage).unit).toBe(1.5);
    expect(stageScale(stageBox({ width: 2560, height: 1080 }), presenter.stage).unit).toBeCloseTo(1.6);
    expect(stageScale(stageBox({ width: 1024, height: 768 }), presenter.stage).unit).toBeCloseTo(0.8);
  });

  it('a stage button never drops below the hero target; units round to whole pixels', () => {
    expect(stageButtonSize(0.6)).toBe(touchTarget.hero);
    expect(stageButtonSize(1.5)).toBe(144);
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
