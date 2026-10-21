import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * The question slides' words (AMENDMENTS-LECTURE-V2 row LV-S2, section 12.3; design/screens/presenter/slide-listen-reply.md,
 * slide-realia.md "Realia question"): the listen and reply questions and the line beside a realia question's key word,
 * in the three UI languages (F-I18N-001 §3.10: Spanish neutral, informal tú; Korean 해요체, no particle on a variable).
 * The realia question's slide is `grid.kind.quiz` ("Question") in the grid and the live region, like every quiz.
 */
const VALUES = {
  en: { listen: 'Which one did you hear?', reply: 'Which answer fits?', ask: 'Look closely and find the answer.', quiz: 'Question' },
  es: { listen: '¿Cuál escuchaste?', reply: '¿Qué respuesta va bien?', ask: 'Mira con atención y busca la respuesta.', quiz: 'Pregunta' },
  ko: { listen: '어떤 것을 들었나요?', reply: '어떤 대답이 어울릴까요?', ask: '잘 보고 답을 찾아요.', quiz: '문제' },
} as const;

describe('learner.presenter question slides (LV-S2)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: the listen and reply questions and the realia line', (locale) => {
    const m = getMessages(locale);
    const want = VALUES[locale];
    expect([m.learner.presenter.quiz.listen, m.learner.presenter.quiz.reply, m.learner.presenter.slide.realia.ask]).toEqual([want.listen, want.reply, want.ask]);
    expect(m.learner.presenter.grid.kind.quiz).toBe(want.quiz);
  });

  it('no question asks the room to speak (LV-D9): the room answers by pointing, writing or on its own devices', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const m = getMessages(locale).learner.presenter;
      for (const line of [m.quiz.listen, m.quiz.reply, m.slide.realia.ask]) expect(line).not.toMatch(/\b(say|speak|repeat|dilo|di |habla|repite)\b|말해|따라 해/i);
    }
  });
});
