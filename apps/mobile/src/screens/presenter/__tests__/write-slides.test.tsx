import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { colors } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { byTestId, hostNodes, render, screenTexts, textOf } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { Stage } from '../Stage';
import { WriteTogetherSlide, type WriteTogetherBody } from '../slides/WriteTogetherSlide';

/**
 * The write-together slides on the stage (AMENDMENTS-LECTURE-V2 sections 5.2, 5.3 and 10, LV-D8, LV-S4; design/screens/
 * presenter/slide-write-together.md, V10-V12), drawn from shipped Stage 6 and Stage 7 lessons: the line every write slide
 * carries, a type prompt and its answer on the next click, the trace ghost, a frame with its gap, banks and example, and
 * the name round's frame and sound table (never a name). Nothing on the slide takes input.
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
// The letter slide's animated stroke guide needs Reanimated's animated SVG, which the render setup stills; no write slide draws it.
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

const en = getMessages('en');

function slidesOf(blocks: LectureBlock[], locale: UiLocale = 'en', romanization: 'always' | 'tap' = 'always'): Slide[] {
  const deck = LectureDeckSchema.parse({
    v: 1,
    id: 'lecture:write001',
    title: 'Write',
    createdAt: '2026-10-20T09:00:00Z',
    seed: 3,
    options: { romanization, quizRounds: 5, sound: true, strokeGuide: true },
    blocks,
  });
  return expandDeck(deck, lectureBundle(locale), { canPlayKorean: true }).slides;
}

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

const styleOf = (node: { props: Record<string, unknown> }): Record<string, unknown> => {
  const flat = (s: unknown): Record<string, unknown> => (Array.isArray(s) ? Object.assign({}, ...s.map(flat)) : ((s ?? {}) as Record<string, unknown>));
  return flat(node.props.style);
};

const writes = (slides: Slide[]) => slides.filter((s): s is WriteTogetherBody => s.kind === 'write-together');
const stage6 = slidesOf([{ kind: 'quest', id: 'quest:stage6-life-q1' }]);
const water = writes(stage6).find((s) => s.variant === 'type' && s.answer.ko === '물 주세요')!;
const morning = writes(slidesOf([{ kind: 'quest', id: 'quest:stage7-life-q1' }])).find((s) => s.variant === 'trace' && s.word.ko === '아침')!;
const meal = writes(slidesOf([{ kind: 'quest', id: 'quest:stage7-life-q2' }])).find((s) => s.variant === 'frame')!;
const letters = slidesOf([{ kind: 'quest', id: 'quest:stage7-letters-q3' }]);
const name = writes(letters).find((s) => s.variant === 'own-name')!;

describe('WriteTogetherSlide (LV-S4)', () => {
  it('every variant carries the kind label and the line that nothing is typed here, with the pencil', async () => {
    for (const slide of [water, morning, meal, name]) {
      const r = await render(inView(<WriteTogetherSlide slide={slide} reveal={0} romanization="always" />));
      expect(textOf(byTestId(r.root, 'presenter-kind-label')[0]!)).toBe(en.learner.presenter.slide.write.title);
      expect(textOf(byTestId(r.root, 'presenter-write-where')[0]!)).toBe(en.learner.presenter.slide.write.where);
      expect(r.root.findAll((n) => typeof n.type !== 'string' && (n.props as { name?: string }).name === 'pencil').length).toBeGreaterThan(0);
    }
  });

  it('type: the line, the prompt and its picture; the answer keeps its place, unread, until the next click', async () => {
    const r = await render(inView(<WriteTogetherSlide slide={water} reveal={0} romanization="always" />));
    expect(textOf(byTestId(r.root, 'presenter-write-variant')[0]!)).toBe(en.learner.presenter.slide.write.type);
    expect(textOf(byTestId(r.root, 'presenter-write-prompt')[0]!)).toBe('Ask for water.');
    expect(byTestId(r.root, 'presenter-write-art').length).toBeGreaterThan(0);
    expect(hiddenNow(byTestId(r.root, 'presenter-write-answer')[0]!)).toBe(true);
    const shown = await render(inView(<WriteTogetherSlide slide={water} reveal={1} romanization="tap" />));
    const answer = byTestId(shown.root, 'presenter-write-answer')[0]!;
    expect(hiddenNow(answer)).toBe(false);
    expect(screenTexts(answer)).toEqual(['물 주세요', 'mul juseyo', 'Water, please.']);
  });

  it('trace: the word as an outline ghost from the start; its romanization and meaning at the answer', async () => {
    const r = await render(inView(<WriteTogetherSlide slide={morning} reveal={0} romanization="always" />));
    const ghost = byTestId(r.root, 'presenter-write-ghost')[0]!;
    expect(screenTexts(ghost)).toEqual(['아침']);
    const text = hostNodes(ghost, (n) => screenTexts(n).join('') === '아침' && styleOf(n).fontSize !== undefined)[0]!;
    // The outline: no fill, a text.secondary stroke (V11).
    expect(['transparent', 'rgba(0,0,0,0.00)']).toContain(styleOf(text).color);
    expect(String(styleOf(text).WebkitTextStroke)).toContain(colors.text.secondary);
    expect(textOf(byTestId(r.root, 'presenter-write-variant')[0]!)).toBe(en.learner.presenter.slide.write.trace);
    expect(hiddenNow(byTestId(r.root, 'presenter-write-answer')[0]!)).toBe(true);
    const shown = await render(inView(<WriteTogetherSlide slide={morning} reveal={1} romanization="always" />));
    expect(screenTexts(byTestId(shown.root, 'presenter-write-answer')[0]!)).toEqual(['achim', 'morning']);
  });

  it('frame: the frame with its gap named "gap", then the bank, then "For example" with the ending that fits', async () => {
    const r = await render(inView(<WriteTogetherSlide slide={meal} reveal={0} romanization="always" />));
    expect(textOf(byTestId(r.root, 'presenter-write-variant')[0]!)).toBe(en.learner.presenter.slide.write.frame);
    const gap = byTestId(r.root, 'presenter-write-gap')[0]!;
    expect(gap.props['aria-label']).toBe(en.a11y.presenter.slot);
    expect(hiddenNow(byTestId(r.root, 'presenter-write-bank')[0]!)).toBe(true);
    expect(hiddenNow(byTestId(r.root, 'presenter-write-example')[0]!)).toBe(true);
    const bank = await render(inView(<WriteTogetherSlide slide={meal} reveal={1} romanization="always" />));
    expect(byTestId(bank.root, 'presenter-write-chip').map((n) => screenTexts(n)[0])).toEqual(['밥', '빵', '사과', '달걀', '김밥']);
    expect(hiddenNow(byTestId(bank.root, 'presenter-write-example')[0]!)).toBe(true);
    const example = await render(inView(<WriteTogetherSlide slide={meal} reveal={2} romanization="always" />));
    expect(screenTexts(byTestId(example.root, 'presenter-write-example')[0]!)).toEqual([en.learner.presenter.slide.write.example, '아침에 밥을 먹어요.', 'achime babeul meogeoyo']);
  });

  it('frame with tap: the romanization of the frame and the bank wait for the example', async () => {
    const tapMeal = writes(slidesOf([{ kind: 'quest', id: 'quest:stage7-life-q2' }], 'en', 'tap')).find((s) => s.variant === 'frame')!;
    const bank = await render(inView(<WriteTogetherSlide slide={tapMeal} reveal={1} romanization="tap" />));
    expect(hiddenNow(byTestId(bank.root, 'presenter-write-frame-rom')[0]!)).toBe(true);
    const example = await render(inView(<WriteTogetherSlide slide={tapMeal} reveal={2} romanization="tap" />));
    expect(hiddenNow(byTestId(example.root, 'presenter-write-frame-rom')[0]!)).toBe(false);
    expect(hiddenNow(byTestId(example.root, 'presenter-write-example-rom')[0]!)).toBe(false);
  });

  it('the name round: its frame, then the sound table in its place, five groups a build, every block with its romanization; no name anywhere', async () => {
    const r = await render(inView(<WriteTogetherSlide slide={name} reveal={0} romanization="always" />));
    expect(textOf(byTestId(r.root, 'presenter-write-variant')[0]!)).toBe(en.learner.presenter.slide.write.ownName);
    expect(byTestId(r.root, 'presenter-write-gap')).toHaveLength(1);
    expect(byTestId(r.root, 'presenter-write-table')).toHaveLength(0);
    for (const page of [1, 2]) {
      const t = await render(inView(<WriteTogetherSlide slide={name} reveal={page} romanization="tap" />));
      expect(byTestId(t.root, 'presenter-write-frame')).toHaveLength(0);
      expect(byTestId(t.root, 'presenter-write-table-row')).toHaveLength(5);
      const cells = byTestId(t.root, 'presenter-write-cell');
      expect(cells.length).toBe(name.groups.slice((page - 1) * 5, page * 5).flat().length);
      expect(screenTexts(cells[0]!)).toEqual(page === 1 ? ['아', 'a'] : ['고', 'go']);
    }
    // Nothing takes input: no text field, no button.
    const all = await render(inView(<WriteTogetherSlide slide={name} reveal={2} romanization="always" />));
    expect(hostNodes(all.root, (n) => n.type === 'input' || n.type === 'textarea' || n.props.role === 'button')).toHaveLength(0);
  });

  it.each(['es', 'ko'] as const)('in %s: the lines, the prompt and the meaning are in the slide language', async (locale) => {
    const m = getMessages(locale);
    const slide = writes(slidesOf([{ kind: 'quest', id: 'quest:stage6-life-q1' }], locale)).find((s) => s.variant === 'type' && s.answer.ko === '물 주세요')!;
    expect(slide.variant === 'type' && slide.prompt).not.toBe('Ask for water.');
    const r = await render(inView(<WriteTogetherSlide slide={slide} reveal={1} romanization="always" />, locale));
    expect(textOf(byTestId(r.root, 'presenter-kind-label')[0]!)).toBe(m.learner.presenter.slide.write.title);
    expect(textOf(byTestId(r.root, 'presenter-write-where')[0]!)).toBe(m.learner.presenter.slide.write.where);
    expect(textOf(byTestId(r.root, 'presenter-write-variant')[0]!)).toBe(m.learner.presenter.slide.write.type);
    expect(slide.variant === 'type' && screenTexts(byTestId(r.root, 'presenter-write-answer')[0]!)).toContain(slide.variant === 'type' ? slide.answer.gloss : '');
  });
});

describe('Stage: the live region names a write slide by what its first build shows (section 10)', () => {
  const scale = { unit: 1, logicalWidth: 1280, logicalHeight: 600, stageWidth: 1280, stageHeight: 600, offsetX: 0, offsetY: 0, letterboxed: false, portrait: false, tooSmall: false };
  const stage = (slides: Slide[], idx: number, reveal: number) =>
    inView(
      <Stage
        scale={scale}
        slides={slides}
        slideIdx={idx}
        reveal={reveal}
        deckTitle="Write"
        strokeToken={0}
        joinCta="Join"
        onCommand={() => undefined}
        onPlaySound={() => undefined}
        romanization="always"
        sayIt={false}
        storyScene={() => undefined}
      />,
    );
  const kind = en.learner.presenter.grid.kind.write;

  it('a type round by its prompt, the name round by its line; never by an answer or a name', async () => {
    const at = stage6.indexOf(water);
    const r = await render(stage(stage6, at, 1));
    expect(textOf(byTestId(r.root, 'presenter-live')[0]!)).toBe(`Slide ${at + 1} of ${stage6.length}, ${kind}, Ask for water.`);
    const own = letters.indexOf(name);
    const n = await render(stage(letters, own, 2));
    expect(textOf(byTestId(n.root, 'presenter-live')[0]!)).toBe(`Slide ${own + 1} of ${letters.length}, ${kind}, ${en.learner.presenter.slide.write.ownName}`);
    expect(hostNodes(byTestId(n.root, 'presenter-stage')[0]!, (x) => x.props.role === 'button')).toHaveLength(0);
  });
});
