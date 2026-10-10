import { describe, expect, it } from 'vitest';
import {
  jamoTileA11yLabel,
  narrativeLine,
  replyOptionLabel,
  traceCanvasA11yLabel,
  traceLetterA11yText,
} from '../korean-labels';
import type { MinigameScope } from '../minigame-config';

describe('replyOptionLabel (F-CNT-002 §3.5: TapRespond shows ko, romanization, gloss)', () => {
  it('joins Korean, romanization and gloss', () => {
    expect(replyOptionLabel({ ko: '안녕하세요', romanization: 'annyeonghaseyo', en: 'Hello' })).toBe(
      '안녕하세요  ·  annyeonghaseyo  ·  Hello',
    );
  });

  it('falls back to Korean and gloss while a legacy option has no romanization', () => {
    expect(replyOptionLabel({ ko: '네', en: 'Yes' })).toBe('네  ·  Yes');
  });

  it('treats an empty romanization as missing', () => {
    expect(replyOptionLabel({ ko: '네', romanization: '', en: 'Yes' })).toBe('네  ·  Yes');
  });
});

describe('jamo screen-reader labels (F-CNT-002 §3.3: a11yRomanization)', () => {
  it('reads silent/ng as "silent or ng" on a tile', () => {
    expect(jamoTileA11yLabel('silent/ng')).toBe('Korean letter silent or ng, tap to select');
  });

  it('leaves a plain sound value alone', () => {
    expect(jamoTileA11yLabel('eo')).toBe('Korean letter eo, tap to select');
  });

  it('reads the g/k pair as "g or k" in the trace prompt and canvas', () => {
    expect(traceLetterA11yText('g/k')).toBe('Trace the letter g or k');
    expect(traceCanvasA11yLabel('g/k')).toBe('Draw the letter g or k with your finger');
  });
});

describe('narrativeLine (hoyaLineKo on the quest player)', () => {
  const ko = { ko: '새해 복 많이 받으세요.', romanization: 'saehae bok mani badeuseyo', en: 'Happy New Year!' };

  it('shows the Korean line with romanization and gloss under the English message', () => {
    expect(narrativeLine({ hoyaLineEn: "Happy New Year! Let's learn the greeting.", hoyaLineKo: ko })).toEqual({
      message: "Happy New Year! Let's learn the greeting.",
      korean: ko.ko,
      romanization: ko.romanization,
      glossEn: ko.en,
    });
  });

  it('uses the gloss as the message, once, when there is no English line', () => {
    expect(narrativeLine({ hoyaLineKo: ko })).toEqual({
      message: 'Happy New Year!',
      korean: ko.ko,
      romanization: ko.romanization,
    });
  });

  it('keeps today behaviour when there is no Korean line: hoyaLineEn, then bodyEn, then a default', () => {
    expect(narrativeLine({ hoyaLineEn: 'Hi', bodyEn: 'Body' })).toEqual({ message: 'Hi' });
    expect(narrativeLine({ bodyEn: 'Body' })).toEqual({ message: 'Body' });
    expect(narrativeLine({})).toEqual({ message: "Let's keep going!" });
  });
});

describe('MinigameScope.storySteps[].romanization (type-level, F-CNT-002 §3.5)', () => {
  it('is optional on a step', () => {
    const scope: MinigameScope = {
      kind: 'story-sequence',
      storySteps: [
        { id: 'a', labelEn: 'Wash hands', labelKo: '손 씻기', romanization: 'son ssitgi' },
        { id: 'b', labelEn: 'Eat', labelKo: '먹기' },
      ],
    };
    expect(scope.storySteps?.[0]?.romanization).toBe('son ssitgi');
    expect(scope.storySteps?.[1]?.romanization).toBeUndefined();
  });
});
