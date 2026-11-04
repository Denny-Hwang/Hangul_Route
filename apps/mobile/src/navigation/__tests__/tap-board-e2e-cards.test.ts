import { checkRomanization } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { TAP_BOARD_E2E_CARDS } from '../tap-board-e2e-cards';

describe('the TapBoard e2e cards (AMENDMENTS-TOUCH row KT-2, fixture build only)', () => {
  it('pair each option word with its Revised Romanization', () => {
    for (const card of TAP_BOARD_E2E_CARDS) expect(checkRomanization(card.ko, card.romanization), card.ko).toEqual([]);
  });
});
