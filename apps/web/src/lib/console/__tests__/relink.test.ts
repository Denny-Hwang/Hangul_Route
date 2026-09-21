import { describe, expect, it } from 'vitest';
import { canDeleteLearnerData, expiresLabel, minutesLeft, requestedLabel } from '../relink';

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
});
