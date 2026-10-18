import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildsFor } from '../../../logic/lecture/build-steps';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { byTestId, hostNodes, render, screenTexts, textOf } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { Stage } from '../Stage';
import { PatternSlide } from '../slides/PatternSlide';
import { ReadAlongSlide } from '../slides/ReadAlongSlide';
import { RealiaSlide } from '../slides/RealiaSlide';
import { SentenceSlide } from '../slides/SentenceSlide';
import { WordChip } from '../slides/ReadingParts';

/**
 * The reading slides on the stage (AMENDMENTS-LECTURE-V2 section 5.2, LV-S1; design/screens/presenter/
 * slide-sentence.md, slide-pattern.md, slide-read-along.md, slide-realia.md), drawn from shipped
 * Stage 3, 4 and 6 lessons: what each build shows, what is hidden until its build (kept in place, not
 * read), the kind label, the gap box's name, the lit read-along line and the realia sheet's own text.
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
// The letter slide's animated stroke guide needs Reanimated's animated SVG, which the render setup stills; no reading slide draws it.
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

const en = getMessages('en');

function slidesOf(blocks: LectureBlock[], canPlayKorean = true): Slide[] {
  const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:read01', title: 'Reading', createdAt: '2026-10-17T09:00:00Z', seed: 3, blocks });
  return expandDeck(deck, lectureBundle('en'), { canPlayKorean }).slides;
}

function first<K extends Slide['kind']>(slides: Slide[], kind: K): Extract<Slide, { kind: K }> {
  const found = slides.find((s) => s.kind === kind);
  if (!found) throw new Error(`no ${kind} slide`);
  return found as Extract<Slide, { kind: K }>;
}

const tap = <S extends Slide>(slide: S): S => ({ ...slide, builds: buildsFor(slide, { romanization: 'tap', strokeGuide: true }) });

function inView(child: React.ReactElement, locale: UiLocale = 'en'): React.ReactElement {
  return <PresenterViewProvider value={{ messages: getMessages(locale), locale, unit: 1, reducedMotion: true }}>{child}</PresenterViewProvider>;
}

/** Whether a host node, or a host above it, is hidden from assistive tech (a build not reached yet). */
function hiddenNow(node: { props: Record<string, unknown>; parent: unknown }): boolean {
  let at: { props: Record<string, unknown>; parent: unknown } | null = node;
  while (at) {
    if (at.props['aria-hidden'] === true) return true;
    at = (at.parent as typeof at) ?? null;
  }
  return false;
}

const stage3 = slidesOf([{ kind: 'quest', id: 'quest:stage3-life-q1' }]);
const stage4 = slidesOf([{ kind: 'quest', id: 'quest:stage4-life-q1' }]);
const stage6 = slidesOf([{ kind: 'quest', id: 'quest:stage6-life-q1' }, { kind: 'quest', id: 'quest:stage6-nature-q1' }]);

describe('SentenceSlide', () => {
  const slide = first(stage3, 'sentence');

  it('the kind label, the Korean with its romanization; the meaning and the picture wait for their builds', async () => {
    const r = await render(inView(<SentenceSlide slide={slide} reveal={0} />));
    expect(textOf(byTestId(r.root, 'presenter-kind-label')[0]!)).toBe(en.learner.presenter.slide.sentence.label);
    expect(textOf(byTestId(r.root, 'presenter-sentence-ko')[0]!)).toBe('물을 마셔요.');
    expect(hiddenNow(byTestId(r.root, 'presenter-sentence-rom')[0]!)).toBe(false);
    expect(hiddenNow(byTestId(r.root, 'presenter-sentence-gloss')[0]!)).toBe(true);
    expect(hiddenNow(byTestId(r.root, 'presenter-sentence-art')[0]!)).toBe(true);
    const full = await render(inView(<SentenceSlide slide={slide} reveal={2} />));
    expect(hiddenNow(byTestId(full.root, 'presenter-sentence-gloss')[0]!)).toBe(false);
    expect(hiddenNow(byTestId(full.root, 'presenter-sentence-art')[0]!)).toBe(false);
  });

  it("with romanization 'tap' the romanization waits one build; a sentence with no picture draws none", async () => {
    const r = await render(inView(<SentenceSlide slide={tap(slide)} reveal={0} />));
    expect(hiddenNow(byTestId(r.root, 'presenter-sentence-rom')[0]!)).toBe(true);
    const { picture: _none, ...plain } = slide;
    const noPicture = await render(inView(<SentenceSlide slide={{ ...plain, builds: ['ko', 'gloss'] }} reveal={1} />));
    expect(byTestId(noPicture.root, 'presenter-sentence-art')).toHaveLength(0);
  });
});

describe('PatternSlide', () => {
  const slide = first(stage3, 'pattern');

  it('the frame draws a gap box named "gap" for each slot, never the underscores', async () => {
    const r = await render(inView(<PatternSlide slide={slide} reveal={0} />));
    expect(textOf(byTestId(r.root, 'presenter-kind-label')[0]!)).toBe(en.learner.presenter.slide.pattern.label);
    const gaps = byTestId(r.root, 'presenter-pattern-gap');
    expect(gaps).toHaveLength(slide.frame.pieces.length - 1);
    expect(gaps[0]!.props['aria-label']).toBe(en.a11y.presenter.slot);
    const frameKo = hostNodes(byTestId(r.root, 'presenter-pattern-frame')[0]!, (n) => n.props.lang === 'ko').map((n) => textOf(n));
    expect(frameKo.join('')).toBe(slide.frame.pieces.join(''));
    expect(frameKo.join('')).not.toContain('___');
  });

  it('the note with its Korean chips, then one example per build', async () => {
    const r = await render(inView(<PatternSlide slide={slide} reveal={1} />));
    const note = byTestId(r.root, 'presenter-pattern-note')[0]!;
    expect(hiddenNow(note)).toBe(false);
    expect(byTestId(note, 'presenter-pattern-note-chip').length).toBeGreaterThan(0);
    const examples = byTestId(r.root, 'presenter-pattern-example');
    expect(examples.map(hiddenNow)).toEqual([true, true]);
    const full = await render(inView(<PatternSlide slide={slide} reveal={3} />));
    expect(byTestId(full.root, 'presenter-pattern-example').map(hiddenNow)).toEqual([false, false]);
    expect(screenTexts(full.root)).toContain(slide.examples[1]!.ko);
  });
});

describe('ReadAlongSlide', () => {
  const slide = first(stage4, 'read-along');

  it('one line per build, each with its speaker; nothing is lit until Sound plays', async () => {
    const r = await render(inView(<ReadAlongSlide slide={slide} reveal={0} />));
    expect(textOf(byTestId(r.root, 'presenter-kind-label')[0]!)).toBe(en.learner.presenter.slide.readAlong.label);
    const lines = byTestId(r.root, 'presenter-read-along-line');
    expect(lines.map(hiddenNow)).toEqual([false, true]);
    expect(textOf(lines[0]!)).toContain(slide.lines[0]!.speaker);
    expect(byTestId(r.root, 'presenter-read-along-playing')).toHaveLength(0);
  });

  it('the playing line is lit with the speaker glyph; a line not yet shown is never lit', async () => {
    const lit = await render(inView(<ReadAlongSlide slide={slide} reveal={1} playing={1} />));
    const lines = byTestId(lit.root, 'presenter-read-along-line');
    expect(byTestId(lines[1]!, 'presenter-read-along-playing')).toHaveLength(1);
    expect(byTestId(lines[0]!, 'presenter-read-along-playing')).toHaveLength(0);
    const early = await render(inView(<ReadAlongSlide slide={slide} reveal={0} playing={1} />));
    expect(byTestId(early.root, 'presenter-read-along-playing')).toHaveLength(0);
  });

  it('with no Korean voice every line shows at build 0 and none is lit (section 5.1)', async () => {
    const together = first(slidesOf([{ kind: 'quest', id: 'quest:stage4-life-q1' }], false), 'read-along');
    const r = await render(inView(<ReadAlongSlide slide={together} reveal={0} />));
    const lines = byTestId(r.root, 'presenter-read-along-line');
    expect(lines.map(hiddenNow)).toEqual([false, false]);
    expect(textOf(lines[1]!)).toContain(together.lines[1]!.ko);
    expect(byTestId(r.root, 'presenter-read-along-playing')).toHaveLength(0);
  });
});

describe('RealiaSlide', () => {
  const menu = first(stage6, 'realia');
  const sign = stage6.find((s): s is Extract<Slide, { kind: 'realia' }> => s.kind === 'realia' && s.sheet.kind === 'sign')!;

  it('the sheet is one group named by its own text, every line drawn; the key words wait for their build', async () => {
    const r = await render(inView(<RealiaSlide slide={menu} reveal={0} />));
    const sheet = byTestId(r.root, 'presenter-realia-sheet')[0]!;
    expect(sheet.props['aria-label']).toBe(menu.sheet.alt);
    for (const entry of menu.sheet.entries) expect(screenTexts(sheet)).toContain(entry.text.ko);
    expect(byTestId(r.root, 'presenter-realia-word').map(hiddenNow).every(Boolean)).toBe(true);
    const full = await render(inView(<RealiaSlide slide={menu} reveal={1} />));
    expect(byTestId(full.root, 'presenter-realia-word').map(hiddenNow).some(Boolean)).toBe(false);
    expect(byTestId(full.root, 'presenter-realia-word')).toHaveLength(menu.keyWords.length);
  });

  it('a compact key word (a crowded column) runs its Korean, romanization and meaning as one line, named the same', async () => {
    const word = menu.keyWords[0]!;
    const roomy = await render(inView(<WordChip word={word} rom testID="w" />));
    const compact = await render(inView(<WordChip word={word} rom compact testID="w" />));
    const [a, b] = [byTestId(roomy.root, 'w')[0]!, byTestId(compact.root, 'w')[0]!];
    expect(b.props['aria-label']).toBe(a.props['aria-label']);
    expect(b.props['aria-label']).toContain(word.gloss);
    for (const part of [word.ko, word.romanization, word.gloss]) expect(textOf(b)).toContain(part);
    // One text run (a single block inside the chip), not a row of separate boxes.
    expect(hostNodes(b, (n) => n.type === 'div' && n !== b)).toHaveLength(1);
    expect(hostNodes(a, (n) => n.type === 'div' && n !== a).length).toBeGreaterThan(1);
  });

  it('a trail sign draws every board, the arrows hidden from assistive tech, nothing to press', async () => {
    const r = await render(inView(<RealiaSlide slide={sign} reveal={1} />));
    const sheet = byTestId(r.root, 'presenter-realia-sheet')[0]!;
    for (const entry of sign.sheet.entries) expect(screenTexts(sheet)).toContain(entry.text.ko);
    expect(hostNodes(sheet, (n) => n.props.role === 'button')).toHaveLength(0);
  });
});

describe('Stage: the live region names each reading slide by its kind (section 10)', () => {
  it.each([
    ['sentence', stage3, en.learner.presenter.grid.kind.sentence],
    ['pattern', stage3, en.learner.presenter.grid.kind.pattern],
    ['read-along', stage4, en.learner.presenter.grid.kind.readAlong],
    ['realia', stage6, en.learner.presenter.grid.kind.realia],
  ] as const)('%s', async (kind, slides, label) => {
    const idx = slides.findIndex((s) => s.kind === kind);
    const r = await render(
      inView(
        <Stage
          scale={{ unit: 1, logicalWidth: 1280, logicalHeight: 600, stageWidth: 1280, stageHeight: 600, offsetX: 0, offsetY: 0, letterboxed: false, portrait: false, tooSmall: false }}
          slides={slides}
          slideIdx={idx}
          reveal={0}
          deckTitle="Reading"
          strokeToken={0}
          joinCta="Join"
          onCommand={() => undefined}
          onPlaySound={() => undefined}
          romanization="always"
          sayIt={false}
          storyScene={() => undefined}
        />,
      ),
    );
    const live = textOf(byTestId(r.root, 'presenter-live')[0]!);
    expect(live.startsWith(`Slide ${idx + 1} of ${slides.length}, ${label}, `)).toBe(true);
    if (kind === 'pattern') expect(live).toContain(`${en.a11y.presenter.slot} `);
  });
});
