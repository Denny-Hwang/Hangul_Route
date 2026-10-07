import { describe, expect, it } from 'vitest';
import { displayNameFrom, sessionFromClerkUser } from '../clerk';

describe('clerk session mapping (F-AUTH-002 §3.2)', () => {
  it('picks a display name in order: full, first+last, username, email local part, fallback', () => {
    expect(displayNameFrom({ id: 'u', fullName: ' Ms Kim ' })).toBe('Ms Kim');
    expect(displayNameFrom({ id: 'u', firstName: 'Min', lastName: 'Kim' })).toBe('Min Kim');
    expect(displayNameFrom({ id: 'u', firstName: 'Min' })).toBe('Min');
    expect(displayNameFrom({ id: 'u', username: 'mskim' })).toBe('mskim');
    expect(displayNameFrom({ id: 'u', primaryEmailAddress: { emailAddress: 'kim@example.com' } })).toBe('kim');
    expect(displayNameFrom({ id: 'u', fullName: null, primaryEmailAddress: null })).toBe('Grown-up');
  });

  it('builds the session the pages use, without a token', () => {
    expect(sessionFromClerkUser({ id: 'user_1', fullName: 'Ms Kim', primaryEmailAddress: { emailAddress: 'kim@example.com' } })).toEqual({ accountId: 'user_1', displayName: 'Ms Kim', email: 'kim@example.com' });
    expect(sessionFromClerkUser({ id: 'user_2', username: 'dad' })).toEqual({ accountId: 'user_2', displayName: 'dad' });
    expect(sessionFromClerkUser({ id: '' })).toBeNull();
    expect(sessionFromClerkUser(null)).toBeNull();
    expect(sessionFromClerkUser(undefined)).toBeNull();
  });
});
