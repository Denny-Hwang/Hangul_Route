import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { BuildName } from '../../../logic/lecture/build-steps';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { byTestId, render, textOf } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { QuizSlide } from '../slides/QuizSlide';

/**
 * The lecture quiz's final rounds (AMENDMENTS-AUDIO-CLIPS JV-A3 rules 3 and 4): the closed syllable plays,
 * the question asks which letter is at the bottom of it (`learner.audio.heading.endsWith`) and the options
 * are final letters; a letter round keeps "Which letter makes this sound?".
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

type QuizBody = Extract<Slide, { kind: 'quiz' }>;
const QUESTION: ReadonlySet<BuildName> = new Set(['question']);

function soundQuiz(): QuizBody[] {
  const blocks: LectureBlock[] = [
    { kind: 'jamo-set', jamoIds: ['jamo:giyeok', 'jamo:nieun', 'jamo:digeut', 'jamo:rieul', 'jamo:a', 'jamo:eo'] },
    { kind: 'jamo-set', jamoIds: ['jamo:giyeok-batchim', 'jamo:nieun-batchim', 'jamo:rieul-batchim', 'jamo:mieum-batchim', 'jamo:bieup-batchim', 'jamo:ieung-batchim'] },
    { kind: 'quiz', from: 'all', rounds: 4 },
  ];
  const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:final01', title: 'Finals', createdAt: '2026-10-29T09:00:00Z', seed: 5, blocks });
  return expandDeck(deck, lectureBundle('en'), { canPlayKorean: true }).slides.filter((s): s is QuizBody => s.kind === 'quiz' && s.prompt.ask === 'sound');
}

function inView(child: ReactElement, locale: UiLocale): ReactElement {
  return <PresenterViewProvider value={{ messages: getMessages(locale), locale, unit: 1, reducedMotion: true }}>{child}</PresenterViewProvider>;
}

describe('QuizSlide: final rounds ask for the letter at the bottom', () => {
  const quiz = soundQuiz();
  const final = quiz.find((s) => s.prompt.ask === 'sound' && s.prompt.frame === 'endsWith')!;
  const letter = quiz.find((s) => s.prompt.ask === 'sound' && s.prompt.frame === undefined)!;

  it('the deck holds both kinds of round', () => {
    expect(final).toBeDefined();
    expect(letter).toBeDefined();
  });

  it.each(['en', 'es', 'ko'] as const)('%s: a final round shows the endsWith question, a letter round the sound question', async (locale) => {
    const m = getMessages(locale);
    const f = await render(inView(<QuizSlide slide={final} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />, locale));
    expect(textOf(byTestId(f.root, 'presenter-quiz-question')[0]!)).toBe(m.learner.audio.heading.endsWith);
    const l = await render(inView(<QuizSlide slide={letter} shown={QUESTION} romanization="always" sayIt={false} onPlaySound={() => undefined} />, locale));
    expect(textOf(byTestId(l.root, 'presenter-quiz-question')[0]!)).toBe(m.learner.presenter.quiz.sound);
  });

  it('the final round plays a closed syllable and its options are the final letters', () => {
    if (final.prompt.ask !== 'sound') throw new Error('not a sound round');
    expect(['악', '안', '알', '암', '압', '앙']).toContain(final.prompt.spoken.text);
    expect(final.options).toHaveLength(4);
    expect(final.options.filter((o) => o.correct)).toHaveLength(1);
  });
});
