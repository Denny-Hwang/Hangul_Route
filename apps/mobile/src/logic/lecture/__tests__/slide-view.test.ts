import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { buildsFor, type BuildName, type SlideBody } from '../build-steps';
import { lectureBundle } from '../content';
import { expandDeck, type Slide } from '../deck-builder';
import {
  activityTimerMs,
  cardView,
  markerFor,
  romShown,
  sequenceView,
  shownBuilds,
  slideSound,
  syllableView,
  vocabArtId,
} from '../slide-view';

/**
 * What the PR 7 slides show at each build (F-TCH-004 section 3.4; design/screens/presenter/
 * slide-syllable.md, slide-vocab.md, slide-sequence.md, slide-card.md, slide-activity.md): pure
 * decisions the slide components draw, tested over real `expandDeck` output.
 */

const SHAPES = ['circle', 'triangle', 'square', 'star'] as const;

function deckOf(blocks: LectureBlock[]) {
  return LectureDeckSchema.parse({ v: 1, id: 'lecture:view001', title: 'Week 3', createdAt: '2026-10-13T09:00:00Z', seed: 7, blocks });
}

function slidesOf(blocks: LectureBlock[]): Slide[] {
  return expandDeck(deckOf(blocks), lectureBundle('en'), { canPlayKorean: true }).slides;
}

function first<K extends Slide['kind']>(slides: Slide[], kind: K): Extract<Slide, { kind: K }> {
  const found = slides.find((s) => s.kind === kind);
  if (!found) throw new Error(`no ${kind} slide`);
  return found as Extract<Slide, { kind: K }>;
}

const tapBuilds = (body: SlideBody): BuildName[] => buildsFor(body, { romanization: 'tap', strokeGuide: true });

describe('shownBuilds', () => {
  it('is build 0 to the current reveal', () => {
    expect([...shownBuilds(['parts', 'join', 'rom', 'sound'], 0)]).toEqual(['parts']);
    expect([...shownBuilds(['parts', 'join', 'rom', 'sound'], 2)]).toEqual(['parts', 'join', 'rom']);
    expect([...shownBuilds(['step', 'step', 'order'], 1)]).toEqual(['step']);
  });
});

describe('romShown', () => {
  it('comes with the Korean by default, at its own build with tap (D2)', () => {
    expect(romShown(['ko', 'gloss'], new Set<BuildName>(['ko']), 'ko')).toBe(true);
    expect(romShown(['ko', 'rom', 'gloss'], new Set<BuildName>(['ko']), 'ko')).toBe(false);
    expect(romShown(['ko', 'rom', 'gloss'], new Set<BuildName>(['ko', 'rom']), 'ko')).toBe(true);
    expect(romShown(['ko', 'gloss'], new Set<BuildName>(), 'ko')).toBe(false);
  });
});

describe('syllableView: the parts become the block (README D5)', () => {
  const syllable = first(slidesOf([{ kind: 'quest', id: 'quest:stage1-letters-q1' }]), 'syllable');

  it('the builder gives a real syllable with its parts and four builds', () => {
    expect(syllable.parts.length).toBeGreaterThanOrEqual(2);
    expect(syllable.builds).toEqual(['parts', 'join', 'rom', 'sound']);
  });

  it('build 0 shows only the parts; join replaces them with the block; rom and sound follow', () => {
    expect(syllableView(syllable, 0)).toEqual({ joined: false, rom: false, sound: false });
    expect(syllableView(syllable, 1)).toEqual({ joined: true, rom: false, sound: false });
    expect(syllableView(syllable, 2)).toEqual({ joined: true, rom: true, sound: false });
    expect(syllableView(syllable, 3)).toEqual({ joined: true, rom: true, sound: true });
  });
});

describe('sequenceView', () => {
  const sequence = first(slidesOf([{ kind: 'quest', id: 'quest:stage1-rites-q3' }]), 'sequence');

  it('reveals the steps in their true order one build at a time, then asks what comes first', () => {
    const n = sequence.steps.length;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(sequenceView(sequence, 0)).toEqual({ mode: 'steps', count: 1, rom: true });
    expect(sequenceView(sequence, n - 1)).toEqual({ mode: 'steps', count: n, rom: true });
    const order = sequenceView(sequence, n);
    expect(order.mode).toBe('order');
    if (order.mode !== 'order') return;
    // The builder's shuffled order, each step once, never the true order (a derangement).
    expect(order.steps.map((s) => s.id)).toEqual(sequence.shuffled);
    expect(new Set(order.steps.map((s) => s.id))).toEqual(new Set(sequence.steps.map((s) => s.id)));
    expect(order.steps.map((s) => s.id)).not.toEqual(sequence.steps.map((s) => s.id));
  });

  it('with tap, every romanization appears at one build before the question', () => {
    const tap = { ...sequence, builds: tapBuilds(sequence) };
    const n = sequence.steps.length;
    expect(tap.builds.at(-2)).toBe('rom');
    expect(sequenceView(tap, n - 1)).toEqual({ mode: 'steps', count: n, rom: false });
    expect(sequenceView(tap, n)).toEqual({ mode: 'steps', count: n, rom: true });
    expect(sequenceView(tap, n + 1).mode).toBe('order');
  });

  it('a shuffled id the steps do not hold is left out', () => {
    const odd = { ...sequence, shuffled: [...sequence.shuffled, 'nope'] };
    const order = sequenceView(odd, odd.builds.length - 1);
    expect(order.mode === 'order' ? order.steps.length : 0).toBe(sequence.steps.length);
  });
});

describe('cardView', () => {
  const card = first(slidesOf([{ kind: 'cards', cardIds: ['card:book'] }]), 'card');

  it('art first with the title and the Korean chip, then the fact', () => {
    expect(card.builds).toEqual(['art', 'fact']);
    expect(cardView(card, 0)).toEqual({ rom: true, fact: false });
    expect(cardView(card, 1)).toEqual({ rom: true, fact: true });
  });

  it('with tap the chip romanization is its own build', () => {
    const tap = { ...card, builds: tapBuilds(card) };
    expect(tap.builds).toEqual(['art', 'rom', 'fact']);
    expect(cardView(tap, 0)).toEqual({ rom: false, fact: false });
    expect(cardView(tap, 1)).toEqual({ rom: true, fact: false });
    expect(cardView(tap, 2)).toEqual({ rom: true, fact: true });
  });
});

describe('vocabArtId', () => {
  const supported = ['card:kimchi', 'card:book'];
  const vocab = first(slidesOf([{ kind: 'quest', id: 'quest:stage1-life-q1' }]), 'vocab');

  it('a quest word has no picture: text only', () => {
    expect(vocabArtId(vocab, supported)).toBeUndefined();
  });

  it('a word with a drawn card shows that card; an undrawn card shows none', () => {
    expect(vocabArtId({ ...vocab, cardId: 'card:kimchi' }, supported)).toBe('card:kimchi');
    expect(vocabArtId({ ...vocab, cardId: 'card:nope' }, supported)).toBeUndefined();
  });
});

describe('markerFor', () => {
  it('pairs a shape with a number: circle 1, triangle 2, square 3, star 4', () => {
    expect([0, 1, 2, 3].map((i) => markerFor(i, SHAPES))).toEqual([
      { shape: 'circle', n: 1 },
      { shape: 'triangle', n: 2 },
      { shape: 'square', n: 3 },
      { shape: 'star', n: 4 },
    ]);
  });

  it('past four the shapes repeat and the number keeps counting, so every marker stays distinct', () => {
    expect(markerFor(4, SHAPES)).toEqual({ shape: 'circle', n: 5 });
    expect(markerFor(6, SHAPES)).toEqual({ shape: 'square', n: 7 });
  });
});

describe('activityTimerMs', () => {
  it('is the slide minutes in milliseconds; the timer never starts by itself', () => {
    const activity = first(slidesOf([{ kind: 'activity', preset: 'air-write', minutes: 3 }, { kind: 'jamo-set', jamoIds: ['jamo:giyeok'] }]), 'activity');
    expect(activity.builds).toEqual(['prompt']);
    expect(activityTimerMs(activity)).toBe(180_000);
    expect(activityTimerMs({ ...activity, minutes: 1 })).toBe(60_000);
  });
});

describe('slideSound', () => {
  it('a letter and a syllable play their spoken form; other slides have none', () => {
    const slides = slidesOf([{ kind: 'quest', id: 'quest:stage1-letters-q1' }]);
    const letter = first(slides, 'letter');
    const syllable = first(slides, 'syllable');
    expect(slideSound(letter)).toEqual(letter.spoken);
    expect(slideSound(syllable)).toEqual({ text: syllable.ko, romanization: syllable.romanization });
    expect(slideSound(first(slides, 'card'))).toBeUndefined();
    expect(slideSound(undefined)).toBeUndefined();
  });
});
