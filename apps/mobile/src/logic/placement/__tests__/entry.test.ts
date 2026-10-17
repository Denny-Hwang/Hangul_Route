import { describe, expect, it } from 'vitest';
import { PLACEMENT_BANK, PLACEMENT_WARMUP } from '../../../content/placement.generated';
import {
  afterProfileCreated,
  profileCreatedNext,
  inviteOutcome,
  placementBankReady,
  placementEntriesOn,
  questsDoneOf,
} from '../entry';

describe('the level check entry points (F-PLC-001 section 3.10, section 3.11)', () => {
  it('the bundled bank and its warm-up parse', () => {
    expect(placementBankReady(PLACEMENT_BANK, PLACEMENT_WARMUP)).toBe(true);
  });

  it('a bank or a warm-up that fails to parse hides every entry point', () => {
    expect(placementBankReady({ version: 1, templates: [] }, PLACEMENT_WARMUP)).toBe(false);
    expect(placementBankReady(PLACEMENT_BANK, { id: 'not-a-template' })).toBe(false);
    expect(placementBankReady(null, null)).toBe(false);
  });

  it('entries show only with the flag on and a bank that parsed', () => {
    expect(placementEntriesOn(true, () => true)).toBe(true);
    expect(placementEntriesOn(false, () => true)).toBe(false);
    expect(placementEntriesOn(true, () => false)).toBe(false);
  });

  it('the flag is read first: with it off the bank is never parsed', () => {
    let parsed = 0;
    const ready = (): boolean => {
      parsed += 1;
      return true;
    };
    expect(placementEntriesOn(false, ready)).toBe(false);
    expect(parsed).toBe(0);
  });

  it('by default it checks the bundled bank, once', () => {
    expect(placementEntriesOn(true)).toBe(true);
    expect(placementEntriesOn(true)).toBe(true);
    expect(placementEntriesOn(false)).toBe(false);
  });

  it('after CreateProfile: the fork when the check is on, else the first-quest preview as today', () => {
    expect(afterProfileCreated(true)).toBe('PlacementInvite');
    expect(afterProfileCreated(false)).toBe('FirstQuestPreview');
    // Welcome's "Got a class code?" (owner request 2026-10-16, item 8): Join a class after the profile, whatever the check.
    expect(profileCreatedNext('join', true)).toBe('JoinSpace');
    expect(profileCreatedNext('join', false)).toBe('JoinSpace');
    expect(profileCreatedNext(undefined, true)).toBe('PlacementInvite');
    expect(profileCreatedNext(undefined, false)).toBe('FirstQuestPreview');
  });

  it('"I am new to Korean": no run, the first-quest preview, the decline recorded and placement.skipped', () => {
    expect(inviteOutcome('new', 'p1', '2026-10-11T10:00:00.000Z')).toEqual({
      kind: 'declined',
      declinedAt: '2026-10-11T10:00:00.000Z',
      event: { name: 'placement.skipped', profileId: 'p1', payload: { source: 'onboarding' } },
    });
  });

  it('"I already know some Korean": the check with source onboarding, nothing recorded yet', () => {
    expect(inviteOutcome('knowSome', 'p1', '2026-10-11T10:00:00.000Z')).toEqual({
      kind: 'check',
      params: { source: 'onboarding' },
    });
  });

  it('counts completed quests only (the Home card hides after three)', () => {
    expect(questsDoneOf(undefined)).toBe(0);
    expect(questsDoneOf([{ completedAt: '2026-10-01' }, {}, { completedAt: '2026-10-02' }])).toBe(2);
  });
});
