import { describe, expect, it } from 'vitest';
import { canDeleteLearnerData, canReissueRescueCode, decideFailureNote, expiresLabel, minutesLeft, requestedLabel } from '../relink';

const now = new Date('2026-09-21T12:00:00.000Z');

describe('relink helpers (F-TCH-001 §10)', () => {
  it('labels time left and time since, coarse to the minute', () => {
    expect(minutesLeft('2026-09-21T12:08:30.000Z', now)).toBe(9);
    expect(expiresLabel('2026-09-21T12:08:30.000Z', now)).toBe('expires in 9 min');
    expect(expiresLabel('2026-09-21T12:00:30.000Z', now)).toBe('expires in 1 min');
    expect(expiresLabel('2026-09-21T11:59:00.000Z', now)).toBe('expired');
    expect(expiresLabel('garbage', now)).toBe('expired');
    expect(requestedLabel('2026-09-21T11:59:40.000Z', now)).toBe('asked just now');
    expect(requestedLabel('2026-09-21T11:57:10.000Z', now)).toBe('asked 2 min ago');
    expect(requestedLabel('garbage', now)).toBe('asked just now');
  });

  it('deletion rights follow kind and consent mode', () => {
    expect(canDeleteLearnerData('family', 'parent')).toBe(true);
    expect(canDeleteLearnerData('class', 'parent')).toBe(false);
    expect(canDeleteLearnerData('class', 'school')).toBe(true);
    expect(canDeleteLearnerData('school', 'school')).toBe(false);
  });

  it('only a family re-issues rescue codes — a code opens the whole snapshot, which class roles never read (SEC-4)', () => {
    expect(canReissueRescueCode('family')).toBe(true);
    expect(canReissueRescueCode('class')).toBe(false);
    expect(canReissueRescueCode('school')).toBe(false);
  });

  it('decide failures: a closed request says so; a learner who left the class (409 not_a_member, F-SPACE-002 T-1b) gets the generic error', () => {
    expect(decideFailureNote({ error: 'unknown', code: 'not_pending' })).toBe('This request already closed — the learner can ask again.');
    expect(decideFailureNote({ error: 'unknown', code: 'expired' })).toBe('This request already closed — the learner can ask again.');
    expect(decideFailureNote({ error: 'unknown' })).toBe('This request already closed — the learner can ask again.');
    expect(decideFailureNote({ error: 'unknown', code: 'not_a_member' })).toBe("Didn't go through. Try again.");
    expect(decideFailureNote({ error: 'network' })).toBe("Didn't go through. Try again.");
    expect(decideFailureNote({ error: 'forbidden', code: 'forbidden' })).toBe("Didn't go through. Try again.");
  });
});
