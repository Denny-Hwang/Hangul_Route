import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { buildsFor, type BuildName } from '../../../logic/lecture/build-steps';
import { questsAll } from '../../../content';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { byTestId, hostNodes, render, screenTexts, textOf } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { Stage } from '../Stage';
import { QuestionSlide, isListenOrReply, type ListenBody, type ReplyBody } from '../slides/QuestionSlide';
import { RealiaQuestionSlide, isRealiaQuestion, type RealiaQuestionBody } from '../slides/RealiaQuestionSlide';

/**
 * The question slides on the stage (AMENDMENTS-LECTURE-V2 sections 5.1 and 5.2, LV-S2; design/screens/presenter/
 * slide-listen-reply.md, slide-realia.md "Realia question"), drawn from shipped Stage 1, 3, 4 and 6 lessons: what the
 * question build shows and keeps unread until the answer build (the prompt line, the meanings, the Hangul of a
 * teacher-says prompt, the found line on the sheet), the reveal (the mark on the right option only, nothing red), and
 * the live region naming each question. Nothing on these slides takes input: the room answers by pointing.
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
// The letter slide's animated stroke guide needs Reanimated's animated SVG, which the render setup stills; no question slide draws it.
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

const en = getMessages('en');

function slidesOf(blocks: LectureBlock[], canPlayKorean = true): Slide[] {
  const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:ask001', title: 'Questions', createdAt: '2026-10-17T09:00:00Z', seed: 3, blocks });
  return expandDeck(deck, lectureBundle('en'), { canPlayKorean }).slides;
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

const QUESTION: ReadonlySet<BuildName> = new Set(['question']);
const ANSWER: ReadonlySet<BuildName> = new Set(['question', 'answer']);

const stage1 = slidesOf([{ kind: 'quest', id: 'quest:stage1-letters-q1' }]);
const stage3 = slidesOf([{ kind: 'quest', id: 'quest:stage3-life-q1' }]);
const stage3Text = slidesOf([{ kind: 'quest', id: 'quest:stage3-life-q1' }], false);
const stage4 = slidesOf([{ kind: 'quest', id: 'quest:stage4-life-q1' }]);
const stage6 = slidesOf([{ kind: 'quest', id: 'quest:stage6-life-q3' }, { kind: 'quest', id: 'quest:stage6-crafts-q3' }]);
/** Every realia question of the shipped Stage 6 lessons, so a figure and a picture question are always found. */
const REALIA_ALL = slidesOf(questsAll.filter((q) => q.id.startsWith('quest:stage6-')).map((q): LectureBlock => ({ kind: 'quest', id: q.id }))).filter(
  (s): s is RealiaQuestionBody => isRealiaQuestion(s),
);

/** A listen question of a word or sentence round with text options (`rows`), or of a picture round. */
const listenOf = (slides: Slide[], rows: boolean): ListenBody =>
  slides.find(
    (s): s is ListenBody =>
      isListenOrReply(s) && s.prompt.ask === 'listen' && (rows ? s.prompt.speech !== 'sound' && s.options.every((o) => o.picture === undefined) : s.options.some((o) => o.picture !== undefined)),
  )!;
const replyOf = (slides: Slide[]): ReplyBody => slides.find((s): s is ReplyBody => isListenOrReply(s) && s.prompt.ask === 'reply')!;

describe('QuestionSlide: listen (LV-S2)', () => {
  it('the speaker and the question; what was heard joins under it only at the answer build, with the mark on the right option', async () => {
    const slide = listenOf(stage3, true);
    const r = await render(inView(<QuestionSlide slide={slide} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    expect(textOf(byTestId(r.root, 'presenter-quiz-question')[0]!)).toBe(en.learner.presenter.quiz.listen);
    expect(byTestId(r.root, 'presenter-quiz-speaker')).toHaveLength(1);
    expect(hiddenNow(byTestId(r.root, 'presenter-quiz-prompt-line')[0]!)).toBe(true);
    expect(byTestId(r.root, 'presenter-quiz-option-gloss').map(hiddenNow).every(Boolean)).toBe(true);
    expect(byTestId(r.root, 'presenter-quiz-mark')).toHaveLength(0);
    const shown = await render(inView(<QuestionSlide slide={slide} shown={ANSWER} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    const line = byTestId(shown.root, 'presenter-quiz-prompt-line')[0]!;
    expect(hiddenNow(line)).toBe(false);
    expect(screenTexts(line)).toEqual(expect.arrayContaining([slide.prompt.line.ko, slide.prompt.line.romanization, slide.prompt.line.gloss]));
    expect(byTestId(shown.root, 'presenter-quiz-option-gloss').map(hiddenNow).some(Boolean)).toBe(false);
    // One mark, on the row of the right option.
    const marks = byTestId(shown.root, 'presenter-quiz-mark');
    expect(marks).toHaveLength(1);
    const right = slide.options.findIndex((o) => o.correct);
    expect(byTestId(byTestId(shown.root, `presenter-quiz-option-${right + 1}`)[0]!, 'presenter-quiz-mark')).toHaveLength(1);
  });

  it('with no Korean voice the teacher reads the romanization; the Hangul joins the Say it box only at the answer build', async () => {
    const slide = listenOf(stage3Text, true);
    expect(slide.textPrompt).toBe(true);
    const r = await render(inView(<QuestionSlide slide={slide} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    expect(byTestId(r.root, 'presenter-quiz-speaker')).toHaveLength(0);
    expect(textOf(byTestId(r.root, 'presenter-say-it-rom')[0]!)).toBe(slide.prompt.line.romanization);
    expect(hiddenNow(byTestId(r.root, 'presenter-say-it-ko')[0]!)).toBe(true);
    expect(byTestId(r.root, 'presenter-quiz-prompt-line')).toHaveLength(0);
    const shown = await render(inView(<QuestionSlide slide={slide} shown={ANSWER} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    expect(hiddenNow(byTestId(shown.root, 'presenter-say-it-ko')[0]!)).toBe(false);
    expect(textOf(byTestId(shown.root, 'presenter-say-it-ko')[0]!)).toBe(slide.prompt.line.ko);
  });

  it("in the text variant the options' romanization waits for the answer build, so the room cannot match the box's letters", async () => {
    const slide = listenOf(stage3Text, true);
    const romOf = (root: TestRenderer.ReactTestInstance) =>
      hostNodes(byTestId(root, 'presenter-quiz-options')[0]!, (n) => slide.options.some((o) => o.romanization === textOf(n)) && n.props['aria-hidden'] !== undefined);
    const r = await render(inView(<QuestionSlide slide={slide} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    expect(romOf(r.root).length).toBe(slide.options.length);
    expect(romOf(r.root).every((n) => n.props['aria-hidden'] === true)).toBe(true);
    const shown = await render(inView(<QuestionSlide slide={slide} shown={ANSWER} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    expect(romOf(shown.root).every((n) => n.props['aria-hidden'] === false)).toBe(true);
    // With a voice the deck's 'always' still shows them from the question build.
    const voiced = await render(inView(<QuestionSlide slide={listenOf(stage3, true)} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    expect(hostNodes(byTestId(voiced.root, 'presenter-quiz-options')[0]!, (n) => n.props['aria-hidden'] === true && listenOf(stage3, true).options.some((o) => o.romanization === textOf(n)))).toHaveLength(0);
  });

  it('a picture round keeps the 2 x 2 grid of pictures, each named by its label', async () => {
    const slide = listenOf(stage3, false);
    const r = await render(inView(<QuestionSlide slide={slide} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    const pictures = byTestId(r.root, 'presenter-quiz-picture');
    expect(pictures.length).toBe(slide.options.length);
    const options = byTestId(r.root, 'presenter-quiz-options')[0]!;
    // The options hold no Korean (the room answers from the pictures); each picture is named by its label.
    expect(hostNodes(options, (n) => n.props.lang === 'ko')).toHaveLength(0);
    const names = hostNodes(options, (n) => typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label']);
    // Shipped content names some pictures by no label (Stage 3 life q1): those read "Picture", as in the learner's game.
    for (const o of slide.options) expect(names).toContain(o.gloss ?? en.a11y.minigame.picture);
    expect(names).toHaveLength(slide.options.length);
  });

  it("a Stage 1 letter round shows its letters in the grid, with no meaning on them", async () => {
    const slide = stage1.find((s): s is ListenBody => isListenOrReply(s) && s.prompt.ask === 'listen' && s.prompt.speech === 'sound')!;
    const r = await render(inView(<QuestionSlide slide={slide} shown={ANSWER} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    expect(byTestId(r.root, 'presenter-quiz-option-gloss')).toHaveLength(0);
    for (const o of slide.options) expect(screenTexts(r.root)).toContain(o.ko);
  });

  it("with romanization 'tap' the options' romanization waits for the answer build (D2)", async () => {
    const slide = { ...listenOf(stage3, true) };
    const r = await render(inView(<QuestionSlide slide={slide} shown={QUESTION} romanization="tap" sayIt={false} onPlaySound={() => undefined} />));
    const rom = hostNodes(byTestId(r.root, 'presenter-quiz-options')[0]!, (n) => slide.options.some((o) => o.romanization === textOf(n)) && n.props['aria-hidden'] !== undefined);
    expect(rom.length).toBeGreaterThan(0);
    expect(rom.every((n) => n.props['aria-hidden'] === true)).toBe(true);
  });
});

describe('QuestionSlide: a listen round that asks for the reply (the Stage 4 Check)', () => {
  it('asks "Which answer fits?"; what was heard still waits for the answer build', async () => {
    const slide = stage4.find((s): s is ListenBody => isListenOrReply(s) && s.prompt.ask === 'listen')!;
    expect(slide.prompt.reply).toBe(true);
    const r = await render(inView(<QuestionSlide slide={slide} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    expect(textOf(byTestId(r.root, 'presenter-quiz-question')[0]!)).toBe(en.learner.presenter.quiz.reply);
    expect(byTestId(r.root, 'presenter-quiz-speaker')).toHaveLength(1);
    expect(hiddenNow(byTestId(r.root, 'presenter-quiz-prompt-line')[0]!)).toBe(true);
  });
});

describe('QuestionSlide: reply (LV-S2)', () => {
  it("the question over the other speaker's line, drawn from the start; the replies' meanings join at the answer build", async () => {
    const slide = replyOf(stage4);
    const r = await render(inView(<QuestionSlide slide={slide} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />));
    expect(textOf(byTestId(r.root, 'presenter-quiz-question')[0]!)).toBe(en.learner.presenter.quiz.reply);
    // The Sound button plays the line: no stage speaker on a reply question.
    expect(byTestId(r.root, 'presenter-quiz-speaker')).toHaveLength(0);
    const said = byTestId(r.root, 'presenter-quiz-said')[0]!;
    expect(hiddenNow(said)).toBe(false);
    expect(screenTexts(said)).toEqual(expect.arrayContaining(['밥 먹었어요?', slide.prompt.line.romanization, slide.prompt.line.gloss]));
    expect(byTestId(r.root, 'presenter-quiz-option-gloss').map(hiddenNow).every(Boolean)).toBe(true);
    expect(byTestId(r.root, 'presenter-quiz-option-ko').map((n) => textOf(n)).sort()).toEqual(slide.options.map((o) => o.ko).sort());
  });
});

describe('RealiaQuestionSlide (LV-S2, V7)', () => {
  const realia = stage6.filter((s): s is RealiaQuestionBody => isRealiaQuestion(s));
  const withKey = realia.find((s) => s.prompt.key !== undefined && s.prompt.answerEntryId !== undefined && s.options.every((o) => o.ko !== undefined))!;

  it('the sheet stays beside the question; the key word and the lead line; the found line and the mark only at the answer build', async () => {
    const r = await render(inView(<RealiaQuestionSlide slide={withKey} shown={QUESTION} romanization="always" />));
    const sheet = byTestId(r.root, 'presenter-realia-sheet')[0]!;
    expect(sheet.props['aria-label']).toBe(withKey.prompt.sheet.alt);
    expect(textOf(byTestId(r.root, 'presenter-quiz-question')[0]!)).toBe(withKey.prompt.text);
    expect(screenTexts(byTestId(r.root, 'presenter-realia-key')[0]!)).toEqual(expect.arrayContaining([withKey.prompt.key!.ko, withKey.prompt.key!.romanization]));
    expect(textOf(byTestId(r.root, 'presenter-realia-ask')[0]!)).toBe(en.learner.presenter.slide.realia.ask);
    expect(byTestId(r.root, 'presenter-realia-found')).toHaveLength(0);
    expect(byTestId(r.root, 'presenter-quiz-mark')).toHaveLength(0);
    const shown = await render(inView(<RealiaQuestionSlide slide={withKey} shown={ANSWER} romanization="always" />));
    // "Hoya's answer" takes the lead line's place: the lead line keeps its room, unread.
    expect(hiddenNow(byTestId(shown.root, 'presenter-realia-ask')[0]!)).toBe(true);
    expect(hiddenNow(byTestId(shown.root, 'presenter-quiz-answer')[0]!)).toBe(false);
    const found = byTestId(shown.root, 'presenter-realia-found');
    expect(found).toHaveLength(1);
    const entry = withKey.prompt.sheet.entries.find((e) => e.id === withKey.prompt.answerEntryId)!;
    expect(screenTexts(found[0]!)).toContain(entry.text.ko);
    expect(byTestId(shown.root, 'presenter-quiz-mark')).toHaveLength(1);
  });

  it('a figure option is plain text; a picture option is a picture named by its label', async () => {
    const figure = REALIA_ALL.find((s) => s.options.some((o) => o.figure !== undefined));
    const picture = REALIA_ALL.find((s) => s.options.some((o) => o.picture !== undefined));
    expect(figure).toBeDefined();
    expect(picture).toBeDefined();
    const r = await render(inView(<RealiaQuestionSlide slide={figure!} shown={QUESTION} romanization="always" />));
    expect(byTestId(r.root, 'presenter-quiz-option-figure').map((n) => textOf(n)).sort()).toEqual(figure!.options.map((o) => o.figure).sort());
    const p = await render(inView(<RealiaQuestionSlide slide={picture!} shown={QUESTION} romanization="always" />));
    expect(byTestId(p.root, 'presenter-quiz-picture')).toHaveLength(picture!.options.length);
  });
});

describe('the question slides fit themselves like the reading slides (V8, useFitLevel)', () => {
  /**
   * A question slide drawn at a stage scale the test changes; its content box reports `measured.height` when the
   * hook measures it again through `contentRef` (react-native-web's `offsetHeight`).
   */
  async function mount(
    body: (rows: true) => React.ReactElement,
    contentId: string,
    roomId: string,
    measured: { height: number },
    unitOf: () => number,
  ): Promise<{ r: ReactTestRenderer; fit: () => string; layout: (id: string, height: number) => void; rerender: () => Promise<void> }> {
    const tree = (): React.ReactElement => (
      <PresenterViewProvider value={{ messages: en, locale: 'en', unit: unitOf(), reducedMotion: true }}>{body(true)}</PresenterViewProvider>
    );
    let r!: ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(tree(), {
        // The stage speaker (a pressable) listens on its node; the content box reports its height.
        createNodeMock: (el) => {
          const node = { addEventListener: () => undefined, removeEventListener: () => undefined };
          return (el.props as { 'data-testid'?: string })['data-testid'] === contentId ? { ...node, get offsetHeight() { return measured.height; } } : node;
        },
      });
    });
    const composite = (id: string) => r.root.findAll((n) => typeof n.type !== 'string' && n.props.testID === id)[0]!;
    const layout = (id: string, height: number): void => {
      (composite(id).props.onLayout as (e: { nativeEvent: { layout: { height: number } } }) => void)({ nativeEvent: { layout: { height } } });
    };
    const fit = (): string => (composite(contentId).props.dataSet as { fit: string }).fit;
    const rerender = async (): Promise<void> => {
      await act(async () => {
        r.update(tree());
      });
    };
    return { r, fit, layout, rerender };
  }

  const cases = [
    ['QuestionSlide', 'presenter-question-content', 'presenter-question', () => <QuestionSlide slide={listenOf(stage3, true)} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />],
    [
      'RealiaQuestionSlide',
      'presenter-realia-question-content',
      'presenter-realia-question',
      () => <RealiaQuestionSlide slide={REALIA_ALL.find((q) => q.options.every((o) => o.picture === undefined))!} shown={QUESTION} romanization="always" />,
    ],
  ] as const;

  it.each(cases)('%s fits again from level 0 when the stage grows (fullscreen, the projector)', async (_name, contentId, roomId, body) => {
    vi.useFakeTimers();
    try {
      const measured = { height: 330 };
      let unit = 0.5;
      const p = await mount(body, contentId, roomId, measured, () => unit);
      await act(async () => {
        p.layout(roomId, 278);
        p.layout(contentId, 330);
      });
      expect(p.fit()).toBe('1');
      unit = 1;
      measured.height = 500;
      await p.rerender();
      expect(p.fit()).toBe('0');
      await act(async () => {
        p.layout(roomId, 560);
        p.layout(contentId, 500);
        vi.advanceTimersByTime(400);
      });
      expect(p.fit()).toBe('0');
      await act(async () => {
        p.r.unmount();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(cases)('%s measures its content again when no layout event follows a step, so it never steps a level too far', async (_name, contentId, roomId, body) => {
    vi.useFakeTimers();
    try {
      const measured = { height: 330 };
      const p = await mount(body, contentId, roomId, measured, () => 1);
      await act(async () => {
        p.layout(roomId, 278);
        p.layout(contentId, 330);
      });
      expect(p.fit()).toBe('1');
      // Level 1 fits (270 tall now), but no layout event comes: the hook reads the height through contentRef.
      measured.height = 270;
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(p.fit()).toBe('1');
      await act(async () => {
        p.r.unmount();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Stage: the live region names each question by its question (section 10)', () => {
  const scale = { unit: 1, logicalWidth: 1280, logicalHeight: 600, stageWidth: 1280, stageHeight: 600, offsetX: 0, offsetY: 0, letterboxed: false, portrait: false, tooSmall: false };
  it.each([
    ['listen', stage3, en.learner.presenter.quiz.listen],
    ['reply', stage4, en.learner.presenter.quiz.reply],
    ['realia', stage6, null],
  ] as const)('%s', async (ask, slides, question) => {
    const idx = slides.findIndex((s) => s.kind === 'quiz' && s.prompt.ask === ask);
    const slide = slides[idx] as Extract<Slide, { kind: 'quiz' }>;
    const r = await render(
      inView(
        <Stage
          scale={scale}
          slides={slides}
          slideIdx={idx}
          reveal={0}
          deckTitle="Questions"
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
    const want = question ?? (slide.prompt as { text: string }).text;
    expect(textOf(byTestId(r.root, 'presenter-live')[0]!)).toBe(`Slide ${idx + 1} of ${slides.length}, ${en.learner.presenter.grid.kind.quiz}, ${want}`);
    // Nothing on a question slide takes input: the room answers by pointing, on paper or on its own devices.
    expect(hostNodes(byTestId(r.root, 'presenter-stage')[0]!, (n) => n.props.role === 'button' && n.props['data-testid'] !== 'presenter-quiz-speaker')).toHaveLength(0);
    expect(buildsFor(slide, { romanization: 'always', strokeGuide: true })).toEqual(['question', 'answer']);
  });
});
