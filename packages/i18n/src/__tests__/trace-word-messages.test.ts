import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';

/**
 * Trace a Word (F-CURR-001 §3.7, row G-4; wireframe minigame/trace-word.md, "Draft strings"):
 * the English as shipped, and its Spanish and Korean values in the same PR.
 */

describe('Trace a Word (English wording as shipped)', () => {
  it('keeps the heading and Hoya lines', () => {
    expect(en.learner.minigame.traceWord).toEqual({
      heading: 'Trace the word',
      idle: 'Write each block. Start with the first letter.',
      letterIdle: 'Trace the letter in the bright box.',
      blockDone: 'One block done! Now the next one.',
      wordDone: 'You wrote the whole word!',
    });
  });

  it('keeps the screen-reader labels: a sound value, never Hangul', () => {
    const a = en.a11y.minigame;
    expect(a.traceWord('hoya', 'Hoya')).toBe('Trace the word hoya, Hoya');
    expect(a.traceBlock('ho', 1, 2)).toBe('Draw ho, block 1 of 2, with your finger');
    expect(a.hearBlockDone('ho')).toBe('Hear ho, done');
  });
});

describe('Trace a Word in Spanish and Korean', () => {
  it('has every line in both locales', () => {
    for (const overlay of [es, ko]) {
      expect(Object.keys(overlay.learner?.minigame?.traceWord ?? {}).sort()).toEqual(
        Object.keys(en.learner.minigame.traceWord).sort(),
      );
    }
  });

  it('reads the block number and the count in Spanish', () => {
    const a = es.a11y!.minigame!;
    expect(a.traceWord!('hoya', 'Hoya')).toBe('Traza la palabra hoya, Hoya');
    expect(a.traceBlock!('reum', 2, 2)).toBe('Dibuja reum, bloque 2 de 2, con el dedo');
    expect(a.hearBlockDone!('ho')).toBe('Escuchar ho, listo');
  });

  it('never attaches a particle to a variable in Korean (colon forms)', () => {
    const a = ko.a11y!.minigame!;
    expect(a.traceWord!('hoya', 'Hoya')).toBe('낱말 따라 쓰기: hoya, Hoya');
    expect(a.traceBlock!('ho', 1, 2)).toBe('손가락으로 쓰기: ho, 글자 덩어리 2개 중 1번째');
    expect(a.hearBlockDone!('ho')).toBe('듣기: ho, 다 썼어요');
  });
});
