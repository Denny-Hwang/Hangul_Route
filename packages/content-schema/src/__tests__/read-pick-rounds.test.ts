import { describe, expect, it } from 'vitest';
import { ListenPickRoundSchema, isReadPickScope } from '../index';
import { kt } from './helpers/lesson-fixtures';

/**
 * F-CURR-002 row CM-3A S2: Read Pick Meaning, the default Stage 2 Check of section 7.1, is a Listen & Pick round that
 * shows its Korean prompt (`promptShown: true`), added to the round schema additively; its shape is the lint's.
 */

const options = [
  { id: 'haneul', pictureRef: 'word:nature-sky', labelEn: 'sky' },
  { id: 'bada', pictureRef: 'card:sea', labelEn: 'sea' },
];
const heard = { id: 'r', prompt: kt('하늘', 'haneul', 'sky'), options, answerId: 'haneul' };

describe('Read Pick Meaning rounds (row CM-3A S2)', () => {
  it('parses promptShown: true additively; a round written before it parses unchanged', () => {
    expect(ListenPickRoundSchema.parse(heard)).toEqual(heard);
    expect(ListenPickRoundSchema.parse({ ...heard, promptShown: true }).promptShown).toBe(true);
    expect(ListenPickRoundSchema.safeParse({ ...heard, promptShown: false }).success).toBe(false);
  });

  it('a scope is Read Pick Meaning only when every round shows its prompt', () => {
    expect(isReadPickScope([{ ...heard, promptShown: true }, { ...heard, promptShown: true }])).toBe(true);
    expect(isReadPickScope([{ ...heard, promptShown: true }, heard])).toBe(false);
    expect(isReadPickScope([heard])).toBe(false);
    expect(isReadPickScope([])).toBe(false);
  });
});
