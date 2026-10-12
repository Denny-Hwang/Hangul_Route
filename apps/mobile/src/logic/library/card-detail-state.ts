/**
 * Which parts of the card detail show (F-CARD-003, F-STORY-006 §3.7,
 * F-BROWSE-001 §4.7). `learner` is today's card: face up and flippable once
 * the active profile earned it, the earn hint on a card not earned yet, Share
 * when the OS can share. `preview` (All lessons) shows the card as an earned
 * card looks, whatever any profile earned, with no earn hint and no share
 * action.
 */
export type CardDetailState = 'learner' | 'preview';

export interface CardDetailDisplay {
  /** Art, title, blurb, Hear it and the flip, as an earned card. */
  faceUp: boolean;
  /** The "How to earn it" panel. */
  howToEarn: boolean;
  /** The Share action. */
  share: boolean;
}

export function cardDetailDisplay(input: {
  state: CardDetailState;
  earned: boolean;
  showHowToEarn: boolean;
  shareAvailable: boolean;
}): CardDetailDisplay {
  if (input.state === 'preview') return { faceUp: true, howToEarn: false, share: false };
  return {
    faceUp: input.earned,
    howToEarn: input.showHowToEarn && !input.earned,
    share: input.earned && input.shareAvailable,
  };
}
