import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * The write-together slides' words (AMENDMENTS-LECTURE-V2 row LV-S4, sections 5.3 and 12.3, LV-D8; design/screens/presenter/
 * slide-write-together.md, V10-V12): the kind label (the same value as its slide-grid name), the line every write slide
 * carries, each variant's line, the label over a frame's example and the name round's line, in the three UI languages
 * (F-I18N-001 §3.10: Spanish neutral, informal tú; Korean 해요체). Values are the spec's section 12.3 table.
 */
const VALUES = {
  en: {
    title: 'Write together',
    where: 'Write on paper or on your own device. Nothing is typed here.',
    type: 'Type it on your own device, then look.',
    trace: 'Trace it in the air, then on paper.',
    frame: 'Fill the gap with a word from the list.',
    example: 'For example',
    ownName: 'Write your own name in Hangul on paper.',
  },
  es: {
    title: 'Escribir en grupo',
    where: 'Escribe en papel o en tu propio dispositivo. Aquí no se escribe nada.',
    type: 'Escríbelo en tu propio dispositivo y luego mira.',
    trace: 'Trázalo en el aire y luego en papel.',
    frame: 'Completa el espacio con una palabra de la lista.',
    example: 'Por ejemplo',
    ownName: 'Escribe tu propio nombre en hangul en papel.',
  },
  ko: {
    title: '함께 써요',
    where: '종이나 각자 기기에 써요. 이 화면에는 아무것도 입력하지 않아요.',
    type: '각자 기기로 입력해 보고 확인해요.',
    trace: '허공에 따라 쓰고 종이에 써 봐요.',
    frame: '목록에서 낱말을 골라 빈칸을 채워요.',
    example: '예를 들면',
    ownName: '자기 이름을 종이에 한글로 써 봐요.',
  },
} as const;

describe('learner.presenter write together (LV-S4)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: the kind label, the lines and the grid kind', (locale) => {
    const m = getMessages(locale);
    expect(m.learner.presenter.slide.write).toEqual(VALUES[locale]);
    // The grid and the live region name the slide by its kind label.
    expect(m.learner.presenter.grid.kind.write).toBe(VALUES[locale].title);
  });

  it('no line asks the room to speak (LV-D9) or names a learner (LV-D8): the room writes', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      for (const line of Object.values(getMessages(locale).learner.presenter.slide.write)) {
        expect(line).not.toMatch(/\b(say|speak|repeat|aloud|dilo|di |habla|repite|en voz alta)\b|말해|따라 해|소리 내/i);
        expect(line).not.toMatch(/\{|\}/);
      }
    }
  });

  it('the trace line and the name round both say where the writing goes: in the air and on paper, never on the screen', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const write = getMessages(locale).learner.presenter.slide.write;
      expect(write.ownName).toMatch(/paper|papel|종이/);
      expect(write.trace).toMatch(/paper|papel|종이/);
    }
  });
});
