import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardDetailDisplay } from '../card-detail-state';

/**
 * F-BROWSE-001 §4.7 (BR-5c): `CardDetailView` gains a `state` prop. `learner`
 * (the default) keeps today's card exactly; `preview` shows the front and back
 * as an earned card looks, with no earn hint and no share action, whatever the
 * active profile has earned.
 */
describe('cardDetailDisplay', () => {
  const base = { showHowToEarn: true, shareAvailable: true };

  it('learner, earned: flips, blurb, hear and share; no earn hint', () => {
    expect(cardDetailDisplay({ ...base, state: 'learner', earned: true })).toEqual({
      faceUp: true,
      howToEarn: false,
      share: true,
    });
  });

  it('learner, not earned: face down, the earn hint when asked for, no share', () => {
    expect(cardDetailDisplay({ ...base, state: 'learner', earned: false })).toEqual({
      faceUp: false,
      howToEarn: true,
      share: false,
    });
    expect(cardDetailDisplay({ ...base, showHowToEarn: false, state: 'learner', earned: false }).howToEarn).toBe(false);
  });

  it('learner, earned, sharing unavailable: no share', () => {
    expect(cardDetailDisplay({ ...base, shareAvailable: false, state: 'learner', earned: true }).share).toBe(false);
  });

  it('preview: face up as an earned card, never an earn hint or a share action', () => {
    for (const earned of [true, false]) {
      expect(cardDetailDisplay({ ...base, state: 'preview', earned })).toEqual({
        faceUp: true,
        howToEarn: false,
        share: false,
      });
    }
  });
});

describe('CardDetailView wiring (BR-5c)', () => {
  const view = readFileSync(resolve(__dirname, '../../../screens/library/CardDetailView.tsx'), 'utf8');
  const screen = readFileSync(resolve(__dirname, '../../../screens/library/CardDetailScreen.tsx'), 'utf8');

  it('takes the state prop with the learner default', () => {
    expect(view).toMatch(/state\?: CardDetailState/);
    expect(view).toContain("state = 'learner'");
    expect(view).toContain('cardDetailDisplay(');
  });

  it('reads no earned card from the progress store in preview', () => {
    expect(view).toMatch(/state === 'preview'/);
  });

  it('the learner stack screen keeps the default state', () => {
    expect(screen).not.toContain('state=');
  });
});
