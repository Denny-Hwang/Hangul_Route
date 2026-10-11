import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { SLOT, aroundSlot } from '../slot';

describe('aroundSlot (a one-argument message with its argument styled apart)', () => {
  it('splits the English sentence around the name', () => {
    expect(aroundSlot(getMessages('en').console.relink.askingToBe)).toEqual({ before: 'Someone is asking to be ', after: '' });
  });

  it('keeps text on both sides, wherever a translation puts the argument', () => {
    expect(aroundSlot((name) => `${name}님이 요청했어요`)).toEqual({ before: '', after: '님이 요청했어요' });
    expect(aroundSlot((name) => `Alguien quiere ser ${name} ahora`)).toEqual({ before: 'Alguien quiere ser ', after: ' ahora' });
  });

  it('drops a repeated argument instead of rendering the sentinel', () => {
    const { before, after } = aroundSlot((name) => `${name} — ${name}님`);
    expect(before).toBe('');
    expect(after).toBe(' — 님');
    expect(after).not.toContain(SLOT);
  });

  it('returns the whole text before an absent argument', () => {
    expect(aroundSlot(() => 'No name here')).toEqual({ before: 'No name here', after: '' });
  });
});
