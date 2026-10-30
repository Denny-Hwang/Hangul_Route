import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { colors, presenter, spacing } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { BuildName } from '../../../logic/lecture/build-steps';
import { storiesAll } from '../../../content/stories';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { units } from '../../../logic/lecture/stage-constants';
import { byTestId, render } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { STAGE_BORDER, STAGE_BORDER_MIN } from '../stage-metrics';
import { QuestionSlide, isListenOrReply, type ListenBody, type ReplyBody } from '../slides/QuestionSlide';
import { OptionRows, QuizOptions } from '../slides/QuizParts';
import { QuizSlide } from '../slides/QuizSlide';
import { RealiaQuestionSlide, isRealiaQuestion } from '../slides/RealiaQuestionSlide';
import { StoryCheckSlide, isStoryCheck } from '../slides/StoryCheckSlide';

/**
 * The pointed option's look (AMENDMENTS-PRESENTER-NAV section 7.3, owner choice O2; design/screens/
 * presenter/slide-quiz.md and slide-listen-reply.md "Pointed option"): `data-pointed="true"` on that
 * option only; a dashed `text.primary` outline `STAGE_BORDER` units wide (never under
 * `STAGE_BORDER_MIN`), `spacing.sm` units outside a grid card and in the middle of the gap on rows;
 * the `pin` glyph on a paper disc at `presenter.size.caption` units or larger. No fill change, no
 * border change, no `feedback` colour, no motion; the quiz, story check, listen and reply, and realia
 * question slides all draw it.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

const QUESTION: ReadonlySet<BuildName> = new Set(['question']);
const ANSWER: ReadonlySet<BuildName> = new Set(['question', 'answer']);

function slidesOf(blocks: LectureBlock[]): Slide[] {
  const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:point2', title: 'Point', createdAt: '2026-10-29T09:00:00Z', seed: 3, blocks });
  return expandDeck(deck, lectureBundle('en'), { canPlayKorean: true }).slides;
}

function inView(child: ReactElement, unit = 1): ReactElement {
  return <PresenterViewProvider value={{ messages: getMessages('en'), locale: 'en', unit, reducedMotion: true }}>{child}</PresenterViewProvider>;
}

type Style = Record<string, unknown>;
/** The host node of option n (the one carrying its content-target marker). */
const optionHost = (r: ReactTestRenderer, n: number): ReactTestInstance =>
  r.root.find((x) => typeof x.type === 'string' && x.props['data-stage-target'] === `option:${n}`);
/** react-native-web's host style, flattened (it may be an array). */
function styleOf(node: ReactTestInstance): Style {
  const raw = node.props.style as Style | Style[] | undefined;
  return Array.isArray(raw) ? Object.assign({}, ...raw.filter(Boolean)) : (raw ?? {});
}
const pointedOptions = (r: ReactTestRenderer): string[] =>
  r.root.findAll((x) => typeof x.type === 'string' && x.props['data-pointed'] === 'true').map((x) => String(x.props['data-stage-target']));
/** A react-native-web length ('4.5px') as a number. */
const px = (v: unknown): number => Number.parseFloat(String(v));
/** Every style key but the outline, which only a pointed option carries. */
const withoutOutline = (s: Style): Style => Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith('outline')));

const stage1 = slidesOf([{ kind: 'quest', id: 'quest:stage1-letters-q1' }]);
const stage3 = slidesOf([{ kind: 'quest', id: 'quest:stage3-life-q1' }]);
const stage4 = slidesOf([{ kind: 'quest', id: 'quest:stage4-life-q1' }]);
const stage6 = slidesOf([{ kind: 'quest', id: 'quest:stage6-life-q3' }]);
const stories = slidesOf(storiesAll.map((story): LectureBlock => ({ kind: 'story', storyId: story.id, checks: true })));

const quiz = stage1.find((s): s is Extract<Slide, { kind: 'quiz' }> => s.kind === 'quiz' && !isListenOrReply(s) && !isStoryCheck(s) && !isRealiaQuestion(s) && s.options.length === 4)!;
const listenRows = [...stage3, ...stage4].find(
  (s): s is ListenBody => isListenOrReply(s) && s.prompt.ask === 'listen' && s.prompt.speech !== 'sound' && s.options.every((o) => o.picture === undefined),
)!;
const reply = [...stage3, ...stage4].find((s): s is ReplyBody => isListenOrReply(s) && s.prompt.ask === 'reply')!;
const realia = stage6.find(isRealiaQuestion)!;
const check = stories.find(isStoryCheck)!;

describe('a pointed grid card (QuizOptions)', () => {
  it('only option 2 carries data-pointed; a dashed text.primary outline STAGE_BORDER units wide, spacing.sm units outside its border', async () => {
    const r = await render(inView(<QuizOptions options={quiz.options} revealed={false} romanization="always" pointed={2} />));
    expect(pointedOptions(r)).toEqual(['option:2']);
    const s = styleOf(optionHost(r, 2));
    expect(s.outlineStyle).toBe('dashed');
    expect(s.outlineColor).toBe(colors.text.primary);
    expect(px(s.outlineWidth)).toBe(STAGE_BORDER);
    expect(px(s.outlineOffset)).toBe(spacing.sm);
    for (const n of [1, 3, 4]) expect(styleOf(optionHost(r, n)).outlineStyle, `option ${n}`).toBeUndefined();
  });

  it('changes no fill, no border, no opacity and nothing in the layout: the same style as unpointed, but the outline', async () => {
    const plain = await render(inView(<QuizOptions options={quiz.options} revealed={false} romanization="always" />));
    const pointed = await render(inView(<QuizOptions options={quiz.options} revealed={false} romanization="always" pointed={2} />));
    expect(withoutOutline(styleOf(optionHost(pointed, 2)))).toEqual(styleOf(optionHost(plain, 2)));
    expect(JSON.stringify(styleOf(optionHost(pointed, 2)))).not.toMatch(/feedback|success|nudge|transition|animation/);
    for (const c of Object.values(colors.feedback)) expect(Object.values(styleOf(optionHost(pointed, 2)))).not.toContain(c);
  });

  it('the pin: one, inside option 2, on a paper disc, at presenter.size.caption units or larger, hidden from assistive tech and taking no taps', async () => {
    const r = await render(inView(<QuizOptions options={quiz.options} revealed={false} romanization="always" pointed={2} />));
    const pins = byTestId(r.root, 'presenter-quiz-pin');
    expect(pins).toHaveLength(1);
    let at: ReactTestInstance | null = pins[0]!;
    while (at && at.props['data-stage-target'] === undefined) at = at.parent;
    expect(at?.props['data-stage-target']).toBe('option:2');
    const s = styleOf(pins[0]!);
    expect(px(s.width)).toBeGreaterThanOrEqual(presenter.size.caption);
    // react-native-web writes the colour as rgba: compare with a probe drawn in surface.paper.
    const probe = await render(<View testID="probe" style={{ backgroundColor: colors.surface.paper }} />);
    expect(s.backgroundColor).toBe(styleOf(byTestId(probe.root, 'probe')[0]!).backgroundColor);
    expect(pins[0]!.props['aria-hidden']).toBe(true);
    expect(String(pins[0]!.props.className ?? '') + JSON.stringify(s)).toMatch(/pointerEvents/);
  });

  it('on a phone stage (unit 0.44) the outline keeps its STAGE_BORDER_MIN floor and the pin its spacing.xl floor', async () => {
    const unit = 0.44;
    const r = await render(inView(<QuizOptions options={quiz.options} revealed={false} romanization="always" pointed={4} />, unit));
    const s = styleOf(optionHost(r, 4));
    expect(px(s.outlineWidth)).toBe(Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)));
    expect(px(styleOf(byTestId(r.root, 'presenter-quiz-pin')[0]!).width)).toBe(Math.max(spacing.xl, units(unit, presenter.size.body)));
  });

  it('nothing pointed: no option carries data-pointed, an outline or a pin', async () => {
    const r = await render(inView(<QuizOptions options={quiz.options} revealed={false} romanization="always" pointed={null} />));
    expect(pointedOptions(r)).toEqual([]);
    expect(byTestId(r.root, 'presenter-quiz-pin')).toHaveLength(0);
  });
});

describe('a pointed row (OptionRows)', () => {
  it('the outline sits in the middle of the row gap: (gap - width) / 2, at a full and a compact row', async () => {
    for (const compact of [false, true]) {
      const r = await render(inView(<OptionRows options={listenRows.options} revealed={false} romanization="always" pointed={1} compact={compact} />));
      expect(pointedOptions(r)).toEqual(['option:1']);
      const s = styleOf(optionHost(r, 1));
      const gap = compact ? spacing.sm : spacing.md;
      expect(s.outlineStyle).toBe('dashed');
      expect(s.outlineColor).toBe(colors.text.primary);
      expect(px(s.outlineOffset), `compact ${compact}`).toBe((gap - STAGE_BORDER) / 2);
      expect(byTestId(r.root, 'presenter-quiz-pin')).toHaveLength(1);
    }
  });

  it('at a phone unit the outline never reaches the next row: offset plus width stay inside the gap', async () => {
    for (const unit of [0.44, 0.58]) {
      const r = await render(inView(<OptionRows options={listenRows.options} revealed={false} romanization="always" pointed={2} />, unit));
      const s = styleOf(optionHost(r, 2));
      expect(px(s.outlineOffset) + px(s.outlineWidth), `unit ${unit}`).toBeLessThanOrEqual(units(unit, spacing.md));
    }
  });

  it('the answer row keeps its own look when pointed after the reveal: the outline is added, nothing else changes', async () => {
    const answer = listenRows.options.findIndex((o) => o.correct) + 1;
    const plain = await render(inView(<OptionRows options={listenRows.options} revealed romanization="always" />));
    const pointed = await render(inView(<OptionRows options={listenRows.options} revealed romanization="always" pointed={answer} />));
    expect(withoutOutline(styleOf(optionHost(pointed, answer)))).toEqual(styleOf(optionHost(plain, answer)));
    expect(px(styleOf(optionHost(pointed, answer)).outlineOffset)).toBeGreaterThanOrEqual(0);
  });
});

describe('every slide with options draws it (section 7.1)', () => {
  it.each([
    ['quiz', () => <QuizSlide slide={quiz} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} pointed={3} />],
    ['story check', () => <StoryCheckSlide slide={check} shown={QUESTION} romanization="always" pointed={3} />],
    ['listen rows', () => <QuestionSlide slide={listenRows} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} pointed={3} />],
    ['reply', () => <QuestionSlide slide={reply} shown={ANSWER} romanization="always" sayIt={false} onPlaySound={() => undefined} pointed={3} />],
    ['realia question', () => <RealiaQuestionSlide slide={realia} shown={QUESTION} romanization="always" pointed={3} />],
  ] as Array<[string, () => ReactElement]>)('%s: option 3 pointed, nothing else', async (_name, slide) => {
    const r = await render(inView(slide()));
    expect(pointedOptions(r)).toEqual(['option:3']);
    expect(styleOf(optionHost(r, 3)).outlineStyle).toBe('dashed');
    expect(byTestId(r.root, 'presenter-quiz-pin')).toHaveLength(1);
  });
});
