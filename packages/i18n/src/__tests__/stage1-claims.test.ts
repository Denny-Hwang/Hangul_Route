import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 row AU-15 (audit EDU-4): Stage 1 teaches the 14 basic consonants, the 10 basic vowels
 * and six final consonants (apps/mobile/src/content/quests.ts), not the double consonants, the compound vowels or
 * every final sound. Its can-do, goal and completion lines claim the basic letters only.
 */
function stage1Lines(locale: 'en' | 'es' | 'ko'): string[] {
  const m = getMessages(locale);
  return [
    m.learner.myRoute.hero.goal,
    m.learner.myRoute.stage.canDo[1],
    m.learner.stageComplete.headline,
    m.learner.stageComplete.canDo,
    m.learner.stageReview.result.cheer,
    m.caregiver.journey.goal.first,
  ];
}

describe('Stage 1 lines claim the basic letters only (AU-15)', () => {
  it('en: the exact lines', () => {
    expect(stage1Lines('en')).toEqual([
      'Your first goal: read the basic Hangul letters.',
      'Read the basic Hangul letters and simple syllables, and know their sounds.',
      'You can read basic Hangul now!',
      'You know the basic letters and six final sounds. Hoya is so proud of you.',
      'You looked at every letter you learned. Hoya is proud of you.',
      'First goal: read the basic Hangul letters.',
    ]);
  });

  it('es: the exact lines', () => {
    expect(stage1Lines('es')).toEqual([
      'Tu primera meta: leer las letras básicas del hangul.',
      'Leer las letras básicas y sílabas simples del hangul, y saber sus sonidos.',
      '¡Ya puedes leer hangul básico!',
      'Conoces las letras básicas y seis sonidos finales. Hoya está muy orgulloso de ti.',
      'Miraste cada letra que aprendiste. Hoya está orgulloso de ti.',
      'Primera meta: leer las letras básicas del hangul.',
    ]);
  });

  it('ko: the exact lines', () => {
    expect(stage1Lines('ko')).toEqual([
      '첫 목표: 한글 기본 글자 읽기.',
      '한글 기본 글자와 쉬운 글자 덩어리를 읽고 소리를 알아요.',
      '이제 기본 한글을 읽을 수 있어요!',
      '기본 글자와 받침 소리 여섯 개를 알아요. 호야가 정말 뿌듯해해요.',
      '배운 글자를 하나도 빠짐없이 살펴봤어요. 호야가 뿌듯해해요.',
      '첫 목표: 한글 기본 글자 읽기.',
    ]);
  });

  it('no line claims every, any or all letters or final sounds of Hangul', () => {
    expect(stage1Lines('en').join(' ')).not.toMatch(/\b(every|any|all)\b(?! letter you learned)/i);
    expect(stage1Lines('es').join(' ')).not.toMatch(/\b(cualquier|todas|cada)\b(?! letra que aprendiste)/i);
    expect(stage1Lines('ko').join(' ')).not.toMatch(/모든|모두/);
  });
});
