import { describe, expect, it } from 'vitest';
import { UPPER_CARD_GATED_IDS } from '../../../content/heritage-cards';
import { canDrawPicture } from '../../__tests__/drawn-pictures';
import { defaultBrowseBundle } from '../bundle';
import { browseLibrary } from '../catalogue';
import { episodeOutline } from '../facts';
import { resolveTarget } from '../target';
import { browseBundleUnderUpperCards } from '../upper-cards-gate';

describe('browseBundleUnderUpperCards: All lessons follows upperCards (F-CURR-002 §12.2, row CM-23)', () => {
  const gated = [...UPPER_CARD_GATED_IDS];
  const full = defaultBrowseBundle(canDrawPicture);
  const STAGE2_CELLS = ['episode:stage2-letters', 'episode:stage2-rites', 'episode:stage2-crafts'];
  const STAGE3_CELLS = ['episode:stage3-letters', 'episode:stage3-life', 'episode:stage3-rites', 'episode:stage3-nature', 'episode:stage3-crafts'];

  it('off (the launch state, pct 0): no gated card in the card list, the Library groups, any episode reward list or any outline; a card link is not in this version', () => {
    const off = browseBundleUnderUpperCards(full, false);
    // Every gated card is in the learner bundle, so the gate is what leaves them out.
    expect(full.cards.filter((c) => UPPER_CARD_GATED_IDS.has(c.id))).toHaveLength(UPPER_CARD_GATED_IDS.size);
    expect(off.cards.filter((c) => UPPER_CARD_GATED_IDS.has(c.id))).toEqual([]);
    expect(browseLibrary(off).flatMap((g) => ('cards' in g ? g.cards.map((c) => c.id) : [])).filter((id) => UPPER_CARD_GATED_IDS.has(id))).toEqual([]);
    expect(off.episodes.flatMap((e) => e.rewardCardIds).filter((id) => UPPER_CARD_GATED_IDS.has(id))).toEqual([]);
    for (const id of [...STAGE2_CELLS, ...STAGE3_CELLS]) {
      expect(episodeOutline(id, off)?.rewardCardIds.filter((c) => UPPER_CARD_GATED_IDS.has(c)), id).toEqual([]);
    }
    expect(resolveTarget({ kind: 'card', id: 'card:norae' }, off)).not.toMatchObject({ screen: 'card' });
    // The shipped cards of those cells stay: the taste cells' four and their q1 album cards.
    expect(episodeOutline('episode:stage2-life', off)?.rewardCardIds).toContain('card:dosirak');
    expect(episodeOutline('episode:stage2-nature', off)?.rewardCardIds).toContain('card:byeol');
  });

  it('on: every gated card is listed, and each cell outline names its own', () => {
    const on = browseBundleUnderUpperCards(full, true);
    expect(on).toBe(full);
    expect(on.cards.filter((c) => UPPER_CARD_GATED_IDS.has(c.id)).map((c) => c.id).sort()).toEqual([...gated].sort());
    expect(episodeOutline('episode:stage2-letters', on)?.rewardCardIds).toContain('card:norae');
    expect(resolveTarget({ kind: 'card', id: 'card:norae' }, on)).toMatchObject({ screen: 'card', cardId: 'card:norae' });
  });
});
