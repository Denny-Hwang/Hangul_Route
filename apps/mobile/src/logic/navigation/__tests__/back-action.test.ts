import { describe, expect, it } from 'vitest';
import { isBackAction } from '../back-action';

describe('isBackAction', () => {
  it('the visible Back, the browser back and a swipe are backs; a replace, a reset or a navigate is the screen\'s own way on', () => {
    for (const type of ['GO_BACK', 'POP', 'POP_TO_TOP']) expect(isBackAction(type)).toBe(true);
    for (const type of ['REPLACE', 'RESET', 'NAVIGATE', 'PUSH']) expect(isBackAction(type)).toBe(false);
  });
});
