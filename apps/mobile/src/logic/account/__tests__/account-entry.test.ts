import { describe, expect, it } from 'vitest';
import { accountEntryFor, accountRouteFor, accountTitleUse } from '../account-entry';

/** F-AUTH-004 sections 7.1 and 7.2, ND-5, ND-7, ND-9 (row NS-4): where a native account entry goes first. */
describe('accountRouteFor', () => {
  it('Sign in as a grown-up opens the sign-in; a use (or Grown-up account) its home', () => {
    expect(accountRouteFor('signin')).toEqual({ screen: 'SignIn', params: {} });
    for (const use of ['family', 'teacher', 'school', 'account'] as const) expect(accountRouteFor(use)).toEqual({ screen: 'AccountHome', params: { use } });
  });
});

describe('accountEntryFor', () => {
  it('pin: the typed PIN only (no face or fingerprint, CS-N11)', () => {
    expect(accountEntryFor('teacher', 'pin')).toEqual({ kind: 'pin', params: { next: 'GrownUpUse', use: 'teacher', typedOnly: true } });
  });

  it('nopin: PIN setup, never an account screen (ND-7)', () => {
    expect(accountEntryFor('family', 'nopin')).toEqual({ kind: 'setup' });
    expect(accountEntryFor('signin', 'nopin')).toEqual({ kind: 'setup' });
  });

  it('none (no PIN): the account route at once; its AccountGate decides (ND-9)', () => {
    expect(accountEntryFor('signin', 'none')).toEqual({ kind: 'open', route: { screen: 'SignIn', params: {} } });
  });
});

describe('accountTitleUse (D6)', () => {
  it('a use is its own title; none, Sign in or Grown-up account is Grown-up account', () => {
    expect(accountTitleUse('school')).toBe('school');
    expect(accountTitleUse(undefined)).toBe('account');
    expect(accountTitleUse('signin')).toBe('account');
    expect(accountTitleUse('account')).toBe('account');
  });
});
