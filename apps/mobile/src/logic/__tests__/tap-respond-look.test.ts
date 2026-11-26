import { describe, expect, it } from 'vitest';
import { tapRespondTurnView, type TapRespondTurnInput } from '../tap-respond-look';

/**
 * Tap Respond's hold in a quest Check (AMENDMENTS-STAGE1-DECODING-CHECK section 3.3, row DC-1c): the NPC line's romanization
 * and every reply's romanization and meaning wait for the turn's right reply; the NPC line's meaning, the stimulus, stays.
 */
const turn: TapRespondTurnInput = {
  npcKo: '이름이 뭐예요?',
  npcRomanization: 'ireumi mwoyeyo?',
  npcEn: 'What is your name?',
  options: [
    { ko: '저는 다미예요.', romanization: 'jeoneun damiyeyo.', en: 'I am Dami.' },
    { ko: '안녕히 가세요.', romanization: 'annyeonghi gaseyo.', en: 'Goodbye.' },
    { ko: '네.', en: 'Yes.' },
  ],
};

describe('practice: everything shows', () => {
  it('no hold: the lines are drawn and nothing is held', () => {
    const view = tapRespondTurnView(turn, { hold: false, answered: false });
    expect(view.held).toBe(false);
    expect(view.npc).toEqual({ ko: '이름이 뭐예요?', en: 'What is your name?', romanization: 'ireumi mwoyeyo?', romanizationHeld: '' });
    expect(view.options.map((o) => [o.romanization, o.gloss, o.romanizationHeld, o.glossHeld])).toEqual([
      ['jeoneun damiyeyo.', 'I am Dami.', false, false],
      ['annyeonghi gaseyo.', 'Goodbye.', false, false],
      ['', 'Yes.', false, false],
    ]);
  });
});

describe('a Check holds the turn until the right reply', () => {
  it('open: the NPC line and every reply draw no romanization and no meaning, and keep their room', () => {
    const view = tapRespondTurnView(turn, { hold: true, answered: false });
    expect(view.held).toBe(true);
    // The NPC line's meaning is the stimulus the replies are chosen from.
    expect(view.npc).toEqual({ ko: '이름이 뭐예요?', en: 'What is your name?', romanization: '', romanizationHeld: 'ireumi mwoyeyo?' });
    expect(view.options.map((o) => [o.romanization, o.gloss, o.romanizationHeld, o.glossHeld])).toEqual([
      ['', '', true, true],
      ['', '', true, true],
      // A reply without a romanization has no line to hold; its meaning is still held.
      ['', '', false, true],
    ]);
  });

  it('answered: every line shows (a missed reply keeps the turn open, so it is not "answered")', () => {
    const view = tapRespondTurnView(turn, { hold: true, answered: true });
    expect(view.held).toBe(false);
    expect(view.npc.romanization).toBe('ireumi mwoyeyo?');
    expect(view.options[0]).toMatchObject({ romanization: 'jeoneun damiyeyo.', gloss: 'I am Dami.', romanizationHeld: false, glossHeld: false });
  });

  it('a turn with no NPC romanization has nothing to hold on that line', () => {
    const view = tapRespondTurnView({ ...turn, npcRomanization: undefined }, { hold: true, answered: false });
    expect(view.npc).toMatchObject({ romanization: '', romanizationHeld: '' });
  });
});
