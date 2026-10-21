import { OA_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { afterRemoval, checkedStep, isSaved, openingStep, removalFacts, removedEvent, type RemoveStep } from '../removal';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-7a (OA-D13, sections 10.4, 15; CS-12): the removal plan.

const synced = { secret: 's3cret', pendingProfile: null, lastSyncedAt: '2026-10-21T10:00:00.000Z' };

describe('[OA] isSaved (10.4: registered and nothing pending)', () => {
  it('registered, no queued edit, and the last push at or after the last local write', () => {
    expect(isSaved(synced, '2026-10-21T09:59:59.000Z')).toBe(true);
    expect(isSaved(synced, '2026-10-21T10:00:00.000Z')).toBe(true);
  });

  it('a registered learner with nothing ever written has nothing pending', () => {
    expect(isSaved(synced, null)).toBe(true);
    expect(isSaved({ ...synced, lastSyncedAt: null }, null)).toBe(true);
  });

  it('never registered (no record, or no secret) is not saved', () => {
    expect(isSaved(null, null)).toBe(false);
    expect(isSaved({ ...synced, secret: null }, '2026-10-21T09:00:00.000Z')).toBe(false);
    expect(isSaved({ ...synced, secret: '' }, null)).toBe(false);
  });

  it('a queued name, level or avatar edit is pending', () => {
    expect(isSaved({ ...synced, pendingProfile: { fields: { displayName: 'Jun' }, at: '2026-10-21T09:00:00.000Z' } }, null)).toBe(false);
  });

  it('a local write after the last push, or no push at all, is pending', () => {
    expect(isSaved(synced, '2026-10-21T10:00:00.001Z')).toBe(false);
    expect(isSaved({ ...synced, lastSyncedAt: null }, '2026-10-21T09:00:00.000Z')).toBe(false);
  });

  it('a time that does not parse counts as not saved (the safe side)', () => {
    expect(isSaved({ ...synced, lastSyncedAt: 'yesterday' }, '2026-10-21T09:00:00.000Z')).toBe(false);
    expect(isSaved(synced, 'soon')).toBe(false);
  });

  it('an undefined pendingProfile (an older stored record) is no edit', () => {
    expect(isSaved({ ...synced, pendingProfile: undefined }, null)).toBe(true);
  });
});

describe('[OA] the sheet steps (boards 6 to 9)', () => {
  it('a saved learner opens on saved; any other tries to sync first (checking)', () => {
    expect(openingStep(true)).toBe('saved');
    expect(openingStep(false)).toBe('checking');
  });

  it('after the sync attempt: saved, or unsaved when it failed, was offline or sync is off', () => {
    expect(checkedStep(true)).toBe('saved');
    expect(checkedStep(false)).toBe('unsaved');
  });

  it('only saved and the Remove anyway step remove; checking and unsaved never do (CS-12 second step)', () => {
    expect(removalFacts('saved')).toEqual({ saved: true, anyway: false });
    expect(removalFacts('anyway')).toEqual({ saved: false, anyway: true });
    for (const step of ['checking', 'unsaved'] as RemoveStep[]) expect(removalFacts(step)).toBeNull();
  });
});

describe('[OA] afterRemoval (10.4: active and last)', () => {
  it('the last learner opens Welcome, whether or not it was active', () => {
    expect(afterRemoval({ wasActive: true, learnersLeft: 0 })).toBe('welcome');
    expect(afterRemoval({ wasActive: false, learnersLeft: 0 })).toBe('welcome');
  });

  it('the active learner opens the chooser; another learner stays in the Grown-up area', () => {
    expect(afterRemoval({ wasActive: true, learnersLeft: 2 })).toBe('chooser');
    expect(afterRemoval({ wasActive: false, learnersLeft: 1 })).toBe('stay');
  });
});

describe('[OA] profile.removed (section 15)', () => {
  it('three booleans, no profile id, and the payload the Worker keeps', () => {
    const event = removedEvent({ saved: false, wasActive: true, anyway: true });
    expect(event).toEqual({ name: 'profile.removed', payload: { saved: false, wasActive: true, anyway: true } });
    expect('profileId' in event).toBe(false);
    expect(OA_TELEMETRY_PAYLOADS['profile.removed'].safeParse(event.payload).success).toBe(true);
  });
});
