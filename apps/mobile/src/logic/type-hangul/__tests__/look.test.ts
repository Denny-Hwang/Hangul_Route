import { describe, expect, it } from 'vitest';
import { typeHangulLook, type TypeHangulLookInput } from '../look';

/**
 * Type Hangul's hold in a quest Check (AMENDMENTS-STAGE1-DECODING-CHECK section 3.3, row DC-1c, OD-DC4): the shown word's
 * romanization, the picture round's cue and the keyboard's Latin line wait for the right answer; practice never holds.
 */
const input = (over: Partial<TypeHangulLookInput> = {}): TypeHangulLookInput => ({ mode: 'see', hold: false, solved: false, romanizationMode: 'always', revealed: false, ...over });

describe('practice (no hold): what the mode shows, as before', () => {
  it('see, always: the line and the keyboard line show; nothing to reveal', () => {
    expect(typeHangulLook(input())).toEqual({ romanizationVisible: true, romanizationReserved: false, canReveal: false, keyboardSoundHeld: false, hangulHidden: false, hearHintHeld: false });
  });

  it('see, tap: the line waits for a tap, offered until it is revealed', () => {
    expect(typeHangulLook(input({ romanizationMode: 'tap' }))).toMatchObject({ romanizationVisible: false, romanizationReserved: false, canReveal: true });
    expect(typeHangulLook(input({ romanizationMode: 'tap', revealed: true }))).toMatchObject({ romanizationVisible: true, canReveal: false });
  });

  it('picture: the cue always shows, whatever the mode', () => {
    expect(typeHangulLook(input({ mode: 'picture', romanizationMode: 'tap' }))).toMatchObject({ romanizationVisible: true, keyboardSoundHeld: false });
  });
});

describe('a Check holds until the round is passed', () => {
  it('see, always: the line is reserved, not drawn; the keyboard line is held', () => {
    expect(typeHangulLook(input({ hold: true }))).toEqual({ romanizationVisible: false, romanizationReserved: true, canReveal: false, keyboardSoundHeld: true, hangulHidden: false, hearHintHeld: false });
  });

  it('a held line cannot be revealed by a tap, in any mode, even after a tap', () => {
    expect(typeHangulLook(input({ hold: true, romanizationMode: 'tap' })).canReveal).toBe(false);
    expect(typeHangulLook(input({ hold: true, romanizationMode: 'tap', revealed: true }))).toMatchObject({ romanizationVisible: false, romanizationReserved: true, canReveal: false });
  });

  it('see, tap, not revealed: nothing to keep the room of (the mode would not show it)', () => {
    expect(typeHangulLook(input({ hold: true, romanizationMode: 'tap' }))).toMatchObject({ romanizationVisible: false, romanizationReserved: false });
  });

  it('picture: the romanization cue is held, whatever the mode, so the task is spelling from the picture and its meaning', () => {
    for (const romanizationMode of ['always', 'tap'] as const) {
      expect(typeHangulLook(input({ mode: 'picture', hold: true, romanizationMode }))).toMatchObject({ romanizationVisible: false, romanizationReserved: true, keyboardSoundHeld: true });
    }
  });

  it('passed: the word shows as the mode shows it; the keyboard is gone with the answer', () => {
    expect(typeHangulLook(input({ hold: true, solved: true }))).toMatchObject({ romanizationVisible: true, romanizationReserved: false, canReveal: false });
    expect(typeHangulLook(input({ mode: 'picture', hold: true, solved: true }))).toMatchObject({ romanizationVisible: true, romanizationReserved: false });
    expect(typeHangulLook(input({ hold: true, solved: true, romanizationMode: 'tap' }))).toMatchObject({ romanizationVisible: false, canReveal: true });
  });

  it("a hear (Dictation) round draws no word before its answer: the keyboard line and its own hint are held (a held line cannot be revealed)", () => {
    expect(typeHangulLook(input({ mode: 'hear', hold: true }))).toEqual({
      romanizationVisible: false,
      romanizationReserved: false,
      canReveal: false,
      keyboardSoundHeld: true,
      hangulHidden: false,
      hearHintHeld: true,
    });
    // Practice keeps the hint.
    expect(typeHangulLook(input({ mode: 'hear' }))).toMatchObject({ romanizationVisible: false, keyboardSoundHeld: false, hearHintHeld: false });
  });
});

describe('a heard word that cannot be heard (sound off, no voice, failed plays): the stand-in for the sound (section 3.2)', () => {
  it('in a Check the romanization is the sound and the Hangul is not drawn, whatever the mode; the keyboard line is held', () => {
    for (const romanizationMode of ['always', 'tap'] as const) {
      expect(typeHangulLook(input({ hold: true, standIn: true, romanizationMode }))).toEqual({
        romanizationVisible: true,
        romanizationReserved: false,
        canReveal: false,
        keyboardSoundHeld: true,
        hangulHidden: true,
        hearHintHeld: false,
      });
    }
  });

  it('passed: the Korean shows as the answer', () => {
    expect(typeHangulLook(input({ hold: true, standIn: true, solved: true }))).toMatchObject({ hangulHidden: false, romanizationVisible: true });
  });

  it('practice (no hold) is the see round of the word, unchanged', () => {
    expect(typeHangulLook(input({ standIn: true }))).toEqual(typeHangulLook(input()));
  });
});
