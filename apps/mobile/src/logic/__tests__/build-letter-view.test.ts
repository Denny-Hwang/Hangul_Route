import { getMessages, pseudoLocalize, pseudoText } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { findJamo } from '../../content/jamo';
import {
  blockShape,
  shapeHint as shapeHintWith,
  tileAccessibilityLabel as tileAccessibilityLabelWith,
  type BlockShape,
} from '../build-letter-view';

// The words are learner.minigame.buildLetter.shape and a11y.minigame.finalTile (F-I18N-001 PR 7b).
const messages = getMessages('en');
const shapeHint = (shape: BlockShape): string => shapeHintWith(shape, messages.learner.minigame.buildLetter.shape);
const tileAccessibilityLabel = (jamo: Parameters<typeof tileAccessibilityLabelWith>[0]): string | undefined =>
  tileAccessibilityLabelWith(jamo, messages.a11y.minigame.finalTile);

describe('blockShape', () => {
  it('puts a vertical vowel beside the consonant (가)', () => {
    expect(blockShape(['jamo:giyeok', 'jamo:a'])).toEqual({ vowel: 'beside', hasFinal: false });
  });

  it('puts a horizontal vowel under the consonant (구)', () => {
    expect(blockShape(['jamo:giyeok', 'jamo:u'])).toEqual({ vowel: 'under', hasFinal: false });
  });

  it('marks a final slot when the last part is a batchim (물, 밥)', () => {
    expect(blockShape(['jamo:mieum', 'jamo:u', 'jamo:rieul-batchim'])).toEqual({ vowel: 'under', hasFinal: true });
    expect(blockShape(['jamo:bieup', 'jamo:a', 'jamo:bieup-batchim'])).toEqual({ vowel: 'beside', hasFinal: true });
  });

  it('treats every horizontal vowel as under and the rest as beside', () => {
    for (const id of ['jamo:o', 'jamo:yo', 'jamo:u', 'jamo:yu', 'jamo:eu']) {
      expect(blockShape(['jamo:giyeok', id]).vowel).toBe('under');
    }
    for (const id of ['jamo:a', 'jamo:ya', 'jamo:eo', 'jamo:yeo', 'jamo:i']) {
      expect(blockShape(['jamo:giyeok', id]).vowel).toBe('beside');
    }
  });

  it('falls back to beside when no vowel is present', () => {
    expect(blockShape([])).toEqual({ vowel: 'beside', hasFinal: false });
  });
});

describe('tileAccessibilityLabel', () => {
  it('labels a batchim tile with its final romanization', () => {
    const labels = (['giyeok', 'nieun', 'rieul', 'mieum', 'bieup', 'ieung'] as const).map((n) =>
      tileAccessibilityLabel(findJamo(`jamo:${n}-batchim`)!),
    );
    expect(labels).toEqual(['final k', 'final n', 'final l', 'final m', 'final p', 'final ng']);
  });

  it('leaves consonant and vowel tiles on the default label', () => {
    expect(tileAccessibilityLabel(findJamo('jamo:giyeok')!)).toBeUndefined();
    expect(tileAccessibilityLabel(findJamo('jamo:a')!)).toBeUndefined();
  });
});

describe('shapeHint', () => {
  it('describes where the vowel goes', () => {
    expect(shapeHint({ vowel: 'beside', hasFinal: false })).toBe('The vowel goes beside the first letter.');
    expect(shapeHint({ vowel: 'under', hasFinal: false })).toBe('The vowel goes under the first letter.');
  });

  it('adds the final consonant at the bottom', () => {
    expect(shapeHint({ vowel: 'beside', hasFinal: true })).toBe(
      'The vowel goes beside the first letter. The last letter sits at the bottom.',
    );
  });

  it('never claims letters only run left to right', () => {
    for (const vowel of ['beside', 'under'] as const) {
      for (const hasFinal of [false, true]) {
        expect(shapeHint({ vowel, hasFinal })).not.toMatch(/left to right/i);
      }
    }
  });
});

describe('the hint and the tile label take their words as a parameter (en-XA)', () => {
  it('render the subtree they are given', () => {
    const pseudo = pseudoLocalize(messages);
    expect(shapeHintWith({ vowel: 'under', hasFinal: true }, pseudo.learner.minigame.buildLetter.shape)).toBe(
      pseudoText('The vowel goes under the first letter. The last letter sits at the bottom.'),
    );
    expect(tileAccessibilityLabelWith(findJamo('jamo:nieun-batchim')!, pseudo.a11y.minigame.finalTile)).toBe(
      pseudoText('final n'),
    );
  });
});
