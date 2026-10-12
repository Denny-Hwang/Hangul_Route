import { BROWSE_ACCOUNT_MAX_MS, BROWSE_FALLBACK_MAX_MS, BROWSE_GATE_IDLE_MS, BROWSE_GATE_MAX_MS, BROWSE_KEEP_MS, type BrowseKeptPass, type BrowsePass } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { PARENT_SESSION_MS } from '../../profiles/session';
import { BROWSE_SEEN_REFRESH_MS, PASS_FUTURE_SKEW_MS, accessSource, canKeep, keptPassActive, keptPassFor, passActive, refreshSeen, resolvePass } from '../pass';

/** F-BROWSE-001 §4.3 (BR-4): when a browse pass is active, kept, refreshed and where the Access screen sends its viewer. */
const T0 = Date.parse('2026-10-11T09:00:00.000Z');
const MIN = 60_000;
const gate = (over: Partial<BrowsePass> = {}): BrowsePass => ({ v: 1, scope: 'full', source: 'gate', issuedAt: T0, seen: T0, ...over });
const account = (over: Partial<BrowsePass> = {}): BrowsePass => ({ v: 1, scope: 'full', source: 'account', issuedAt: T0, seen: T0, ...over });
const kept = (over: Partial<BrowseKeptPass> = {}): BrowseKeptPass => ({ v: 1, scope: 'full', keptAt: T0, ...over });

describe('passActive', () => {
  it('gate: 15 idle minutes, the PIN session length', () => {
    expect(BROWSE_GATE_IDLE_MS).toBe(PARENT_SESSION_MS);
    expect(passActive(gate(), T0)).toBe(true);
    expect(passActive(gate(), T0 + 14 * MIN + 59_000)).toBe(true);
    expect(passActive(gate(), T0 + 15 * MIN)).toBe(false);
  });

  it('gate: a refreshed seen keeps it going, up to the 60-minute ceiling', () => {
    expect(passActive(gate({ seen: T0 + 50 * MIN }), T0 + 59 * MIN)).toBe(true);
    expect(passActive(gate({ seen: T0 + 59 * MIN }), T0 + BROWSE_GATE_MAX_MS - 1)).toBe(true);
    expect(passActive(gate({ seen: T0 + 59 * MIN }), T0 + BROWSE_GATE_MAX_MS)).toBe(false);
  });

  it('account: 12 hours, whatever seen says', () => {
    expect(passActive(account({ seen: T0 }), T0 + 11 * 60 * MIN)).toBe(true);
    expect(passActive(account(), T0 + BROWSE_ACCOUNT_MAX_MS - 1)).toBe(true);
    expect(passActive(account(), T0 + BROWSE_ACCOUNT_MAX_MS)).toBe(false);
  });

  it('fallback: 1 hour', () => {
    const fallback = account({ scope: 'sampler', fallback: true });
    expect(passActive(fallback, T0 + BROWSE_FALLBACK_MAX_MS - 1)).toBe(true);
    expect(passActive(fallback, T0 + BROWSE_FALLBACK_MAX_MS)).toBe(false);
  });

  it('an issuedAt more than 1 minute in the future is not a pass', () => {
    expect(PASS_FUTURE_SKEW_MS).toBe(MIN);
    expect(passActive(account({ issuedAt: T0 + MIN, seen: T0 + MIN }), T0)).toBe(true);
    expect(passActive(account({ issuedAt: T0 + MIN + 1, seen: T0 + MIN + 1 }), T0)).toBe(false);
    expect(passActive(gate({ issuedAt: T0 + 2 * MIN, seen: T0 + 2 * MIN }), T0)).toBe(false);
  });
});

describe('refreshSeen', () => {
  it('moves seen forward at most once a minute, and only for an active pass', () => {
    expect(BROWSE_SEEN_REFRESH_MS).toBe(MIN);
    expect(refreshSeen(gate(), T0 + 59_000)).toBeNull();
    expect(refreshSeen(gate(), T0 + MIN)).toEqual(gate({ seen: T0 + MIN }));
    expect(refreshSeen(gate({ seen: T0 + 5 * MIN }), T0 + 5 * MIN + 30_000)).toBeNull();
    expect(refreshSeen(gate(), T0 + 20 * MIN)).toBeNull(); // expired: Access, not a silent revival
    expect(refreshSeen(account(), T0 + 2 * MIN)).toEqual(account({ seen: T0 + 2 * MIN }));
  });
});

describe('keep on this device (OD-4)', () => {
  it('only an account pass that is not a fallback may be kept', () => {
    expect(canKeep(account())).toBe(true);
    expect(canKeep(account({ scope: 'sampler' }))).toBe(true);
    expect(canKeep(account({ scope: 'sampler', fallback: true }))).toBe(false);
    expect(canKeep(gate())).toBe(false);
    expect(keptPassFor(account({ scope: 'sampler' }), T0 + 5)).toEqual({ v: 1, scope: 'sampler', keptAt: T0 + 5 });
    expect(keptPassFor(gate(), T0)).toBeNull();
    expect(keptPassFor(account({ scope: 'sampler', fallback: true }), T0)).toBeNull();
  });

  it('only a pass that is still active may be kept: the switch never turns an expired pass into 7 new days', () => {
    // a tab left open past the account pass's 12 hours, then the switch turned on without a navigation
    expect(keptPassFor(account(), T0 + BROWSE_ACCOUNT_MAX_MS - 1)).toEqual({ v: 1, scope: 'full', keptAt: T0 + BROWSE_ACCOUNT_MAX_MS - 1 });
    expect(keptPassFor(account(), T0 + BROWSE_ACCOUNT_MAX_MS)).toBeNull();
    expect(keptPassFor(account({ scope: 'sampler' }), T0 + 13 * 60 * MIN)).toBeNull();
    // a pass issued too far ahead of this clock is no pass, so it cannot be kept either
    expect(keptPassFor(account({ issuedAt: T0 + 2 * MIN, seen: T0 + 2 * MIN }), T0)).toBeNull();
  });

  it('a kept pass lives 7 days and never from the future', () => {
    expect(keptPassActive(kept(), T0 + BROWSE_KEEP_MS - 1)).toBe(true);
    expect(keptPassActive(kept(), T0 + BROWSE_KEEP_MS)).toBe(false);
    expect(keptPassActive(kept({ keptAt: T0 + 2 * MIN }), T0)).toBe(false);
  });
});

describe('resolvePass', () => {
  it('no pass at all: none', () => {
    expect(resolvePass({ session: null, kept: null, now: T0 })).toEqual({ status: 'none', reason: 'none', expiredSource: null, removeSession: false, removeKept: false });
  });

  it('an active session pass wins and the kept pass is not read', () => {
    expect(resolvePass({ session: gate({ scope: 'sampler', uiLocale: 'ko' }), kept: kept(), now: T0 })).toEqual({
      status: 'active',
      scope: 'sampler',
      from: 'gate',
      fallback: false,
      uiLocale: 'ko',
      removeSession: false,
      removeKept: false,
    });
    expect(resolvePass({ session: account({ scope: 'sampler', fallback: true }), kept: null, now: T0 })).toMatchObject({ status: 'active', from: 'account', fallback: true });
    // even an expired kept pass is left alone while the tab's own pass decides
    expect(resolvePass({ session: account(), kept: kept({ keptAt: T0 - BROWSE_KEEP_MS }), now: T0 })).toMatchObject({ status: 'active', from: 'account', removeKept: false });
  });

  it('an expired session pass with no kept pass is expired, with its source, and stays for the Access screen', () => {
    expect(resolvePass({ session: gate(), kept: null, now: T0 + 16 * MIN })).toEqual({ status: 'none', reason: 'expired', expiredSource: 'gate', removeSession: false, removeKept: false });
    expect(resolvePass({ session: account(), kept: null, now: T0 + BROWSE_ACCOUNT_MAX_MS })).toMatchObject({ reason: 'expired', expiredSource: 'account' });
  });

  it('an expired session pass gives way to an active kept pass, and is removed (OD-4: kept 7 days, also offline)', () => {
    // a tab restored 13 hours later: a new tab would get in with the kept pass, so this one does too
    expect(resolvePass({ session: account(), kept: kept({ scope: 'sampler' }), now: T0 + 13 * 60 * MIN })).toEqual({
      status: 'active',
      scope: 'sampler',
      from: 'kept',
      fallback: false,
      removeSession: true,
      removeKept: false,
    });
    expect(resolvePass({ session: gate(), kept: kept(), now: T0 + 16 * MIN })).toMatchObject({ status: 'active', from: 'kept', removeSession: true });
  });

  it('an expired session pass and an expired kept pass: expired with the session source, and the kept pass is removed', () => {
    expect(resolvePass({ session: gate(), kept: kept(), now: T0 + BROWSE_KEEP_MS })).toEqual({ status: 'none', reason: 'expired', expiredSource: 'gate', removeSession: false, removeKept: true });
  });

  it('without a session pass, a kept pass counts as an account pass from kept', () => {
    expect(resolvePass({ session: null, kept: kept({ scope: 'sampler' }), now: T0 + 3 * 24 * 60 * MIN })).toEqual({
      status: 'active',
      scope: 'sampler',
      from: 'kept',
      fallback: false,
      removeSession: false,
      removeKept: false,
    });
  });

  it('an expired kept pass is removed and reads as an expired account pass', () => {
    expect(resolvePass({ session: null, kept: kept(), now: T0 + BROWSE_KEEP_MS })).toEqual({ status: 'none', reason: 'expired', expiredSource: 'account', removeSession: false, removeKept: true });
  });
});

describe('accessSource', () => {
  it('the expired pass first, then the last grown-up persona, else unknown', () => {
    expect(accessSource({ expiredSource: 'gate', lastPersona: 'parent' })).toBe('gate');
    expect(accessSource({ expiredSource: 'account', lastPersona: null })).toBe('account');
    expect(accessSource({ expiredSource: null, lastPersona: 'teacher' })).toBe('account');
    expect(accessSource({ expiredSource: null, lastPersona: null })).toBe('unknown');
  });
});
