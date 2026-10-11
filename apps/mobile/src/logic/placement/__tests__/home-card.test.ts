import { describe, expect, it } from 'vitest';
import { HOME_CARD_MAX_QUESTS, homeQuietCard, levelCheckCard, type LevelCheckCardInput } from '../home-card';

const eligible: LevelCheckCardInput = {
  enabled: true,
  bankReady: true,
  hasResult: false,
  questsDone: 0,
  dismissedAt: undefined,
  resumable: false,
};

describe('the Home level-check card (F-PLC-001 section 3.10)', () => {
  it('shows "Take the level check" while eligible', () => {
    expect(levelCheckCard(eligible)).toBe('take');
    expect(levelCheckCard({ ...eligible, questsDone: HOME_CARD_MAX_QUESTS - 1 })).toBe('take');
    expect(HOME_CARD_MAX_QUESTS).toBe(3);
  });

  it('reads "Continue the level check" while a run can be resumed', () => {
    expect(levelCheckCard({ ...eligible, resumable: true })).toBe('continue');
  });

  it('hidden with the flag off, a bank that failed to parse, a result, three quests done or Not now', () => {
    expect(levelCheckCard({ ...eligible, enabled: false })).toBeNull();
    expect(levelCheckCard({ ...eligible, bankReady: false })).toBeNull();
    expect(levelCheckCard({ ...eligible, hasResult: true })).toBeNull();
    expect(levelCheckCard({ ...eligible, questsDone: 3 })).toBeNull();
    expect(levelCheckCard({ ...eligible, dismissedAt: '2026-10-01T00:00:00Z' })).toBeNull();
    expect(levelCheckCard({ ...eligible, dismissedAt: '' })).toBe('take');
  });

  it('at most one quiet card: the level check wins while eligible, then the plan prompt', () => {
    expect(homeQuietCard('take', true)).toBe('level-check');
    expect(homeQuietCard('continue', false)).toBe('level-check');
    expect(homeQuietCard(null, true)).toBe('plan-prompt');
    expect(homeQuietCard(null, false)).toBeNull();
  });
});
