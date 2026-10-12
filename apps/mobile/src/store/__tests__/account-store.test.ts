import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(),
}));

import type { SubscriptionState } from '../../logic/entitlement';
import { INITIAL_ATTEMPT_STATE } from '../../logic/profiles/pin-hash';
import { NO_PIN_SEEN, PIN_HASH_UNREAD, pinHashFingerprint } from '../../logic/shell/device-gate';
import { readJson, readJsonExact, writeJson } from '../../platform/storage';
import { useAccountStore } from '../account-store';

describe('account-store', () => {
  beforeEach(() => {
    useAccountStore.setState({
      parentEmail: null,
      consentAcceptedAt: null,
      guardianConsentAcceptedAt: null,
      selfConsentAcceptedAt: null,
      pinResetRequestedAt: null,
      subscription: null,
      parentPinHash: null,
      pinSetAt: null,
      pinHashSeen: null,
      pinHashReadFailed: false,
      pinAttempts: INITIAL_ATTEMPT_STATE,
      hydrated: false,
    });
    vi.mocked(writeJson).mockClear();
  });

  afterEach(() => {
    vi.mocked(readJson).mockImplementation(async () => null);
    vi.mocked(readJsonExact).mockImplementation(async () => null);
  });

  it('setParentEmail trims and stores', () => {
    useAccountStore.getState().setParentEmail('  mom@example.com  ');
    expect(useAccountStore.getState().parentEmail).toBe('mom@example.com');
  });

  it('setParentEmail with only whitespace clears to null', () => {
    useAccountStore.getState().setParentEmail('   ');
    expect(useAccountStore.getState().parentEmail).toBeNull();
  });

  describe('consent keys (F-LEARN-001 §3.3)', () => {
    it('acceptGuardianConsent records the guardian stamp and the first-consent stamp', () => {
      useAccountStore.getState().acceptGuardianConsent();
      const s = useAccountStore.getState();
      expect(s.guardianConsentAcceptedAt).toBeTruthy();
      expect(s.consentAcceptedAt).toBe(s.guardianConsentAcceptedAt);
      expect(s.selfConsentAcceptedAt).toBeNull();
      expect(writeJson).toHaveBeenCalledWith('account:guardianConsentAcceptedAt', s.guardianConsentAcceptedAt);
      expect(writeJson).toHaveBeenCalledWith('account:consentAcceptedAt', s.consentAcceptedAt);
    });

    it('acceptSelfConsent records the self stamp and the first-consent stamp', () => {
      useAccountStore.getState().acceptSelfConsent();
      const s = useAccountStore.getState();
      expect(s.selfConsentAcceptedAt).toBeTruthy();
      expect(s.consentAcceptedAt).toBe(s.selfConsentAcceptedAt);
      expect(s.guardianConsentAcceptedAt).toBeNull();
      expect(writeJson).toHaveBeenCalledWith('account:selfConsentAcceptedAt', s.selfConsentAcceptedAt);
      expect(writeJson).toHaveBeenCalledWith('account:consentAcceptedAt', s.consentAcceptedAt);
    });

    it('the first-consent stamp is set once: a later consent of the other kind leaves it alone', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-10-10T08:00:00.000Z'));
        useAccountStore.getState().acceptSelfConsent();
        const first = useAccountStore.getState().consentAcceptedAt;
        expect(first).toBe('2026-10-10T08:00:00.000Z');

        vi.setSystemTime(new Date('2026-10-11T09:00:00.000Z'));
        vi.mocked(writeJson).mockClear();
        useAccountStore.getState().acceptGuardianConsent();
        const s = useAccountStore.getState();
        expect(s.consentAcceptedAt).toBe(first);
        expect(s.guardianConsentAcceptedAt).toBe('2026-10-11T09:00:00.000Z');
        expect(s.selfConsentAcceptedAt).toBe('2026-10-10T08:00:00.000Z');
        expect(writeJson).not.toHaveBeenCalledWith('account:consentAcceptedAt', expect.anything());
      } finally {
        vi.useRealTimers();
      }
    });

    it('hydrate restores the new keys', async () => {
      vi.mocked(readJson).mockImplementation(async (key: string) => {
        if (key === 'account:guardianConsentAcceptedAt') return '2026-10-01T00:00:00.000Z';
        if (key === 'account:selfConsentAcceptedAt') return '2026-10-02T00:00:00.000Z';
        if (key === 'account:consentAcceptedAt') return '2026-10-01T00:00:00.000Z';
        if (key === 'account:pinResetRequestedAt') return '2026-10-03T00:00:00.000Z';
        return null;
      });
      await useAccountStore.getState().hydrate();
      const s = useAccountStore.getState();
      expect(s.guardianConsentAcceptedAt).toBe('2026-10-01T00:00:00.000Z');
      expect(s.selfConsentAcceptedAt).toBe('2026-10-02T00:00:00.000Z');
      expect(s.pinResetRequestedAt).toBe('2026-10-03T00:00:00.000Z');
    });

    it('hydrate defaults the new keys to null on a fresh install', async () => {
      await useAccountStore.getState().hydrate();
      const s = useAccountStore.getState();
      expect(s.guardianConsentAcceptedAt).toBeNull();
      expect(s.selfConsentAcceptedAt).toBeNull();
      expect(s.pinResetRequestedAt).toBeNull();
    });
  });

  describe('migration of a device that consented before this spec (§3.10)', () => {
    it('a legacy consentAcceptedAt becomes the guardian stamp, in memory only', async () => {
      vi.mocked(readJson).mockImplementation(async (key: string) =>
        key === 'account:consentAcceptedAt' ? '2026-09-01T00:00:00.000Z' : null,
      );
      await useAccountStore.getState().hydrate();
      const s = useAccountStore.getState();
      expect(s.consentAcceptedAt).toBe('2026-09-01T00:00:00.000Z');
      expect(s.guardianConsentAcceptedAt).toBe('2026-09-01T00:00:00.000Z');
      expect(s.selfConsentAcceptedAt).toBeNull();
      // Additive and lazy: nothing is written until the next change.
      expect(writeJson).not.toHaveBeenCalled();
    });

    it('an existing guardian stamp is never overwritten by the legacy one', async () => {
      vi.mocked(readJson).mockImplementation(async (key: string) => {
        if (key === 'account:consentAcceptedAt') return '2026-09-01T00:00:00.000Z';
        if (key === 'account:guardianConsentAcceptedAt') return '2026-09-15T00:00:00.000Z';
        return null;
      });
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().guardianConsentAcceptedAt).toBe('2026-09-15T00:00:00.000Z');
    });

    it('a self-only device is not migrated into a guardian one', async () => {
      vi.mocked(readJson).mockImplementation(async (key: string) => {
        if (key === 'account:consentAcceptedAt') return '2026-10-02T00:00:00.000Z';
        if (key === 'account:selfConsentAcceptedAt') return '2026-10-02T00:00:00.000Z';
        return null;
      });
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().guardianConsentAcceptedAt).toBeNull();
    });

    it('a device that never consented stays unconsented', async () => {
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().consentAcceptedAt).toBeNull();
      expect(useAccountStore.getState().guardianConsentAcceptedAt).toBeNull();
    });
  });

  describe('PIN reset request (§3.5)', () => {
    it('requestPinReset stamps now and persists it', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-10-10T08:00:00.000Z'));
        useAccountStore.getState().requestPinReset();
        expect(useAccountStore.getState().pinResetRequestedAt).toBe('2026-10-10T08:00:00.000Z');
        expect(writeJson).toHaveBeenCalledWith('account:pinResetRequestedAt', '2026-10-10T08:00:00.000Z');
      } finally {
        vi.useRealTimers();
      }
    });

    it('requesting again keeps the original stamp, so the wait cannot be extended', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-10-10T08:00:00.000Z'));
        useAccountStore.getState().requestPinReset();
        vi.setSystemTime(new Date('2026-10-10T20:00:00.000Z'));
        useAccountStore.getState().requestPinReset();
        expect(useAccountStore.getState().pinResetRequestedAt).toBe('2026-10-10T08:00:00.000Z');
      } finally {
        vi.useRealTimers();
      }
    });

    it('clearPinResetRequest removes it from memory and storage', () => {
      useAccountStore.getState().requestPinReset();
      useAccountStore.getState().clearPinResetRequest();
      expect(useAccountStore.getState().pinResetRequestedAt).toBeNull();
      expect(writeJson).toHaveBeenLastCalledWith('account:pinResetRequestedAt', null);
    });

    it('storing a new PIN clears a pending request (cleared only once the new PIN is stored)', () => {
      useAccountStore.getState().requestPinReset();
      useAccountStore.getState().setParentPinHash('salt:digest');
      expect(useAccountStore.getState().pinResetRequestedAt).toBeNull();
      expect(writeJson).toHaveBeenCalledWith('account:pinResetRequestedAt', null);
    });

    it('storing a PIN with no request pending writes nothing extra', () => {
      useAccountStore.getState().setParentPinHash('salt:digest');
      expect(writeJson).not.toHaveBeenCalledWith('account:pinResetRequestedAt', expect.anything());
    });

    it('survives a restart (round trip)', async () => {
      vi.mocked(readJson).mockImplementation(async (key: string) =>
        key === 'account:pinResetRequestedAt' ? '2026-10-10T08:00:00.000Z' : null,
      );
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().pinResetRequestedAt).toBe('2026-10-10T08:00:00.000Z');
    });
  });

  it('setSubscription stores and then clears', () => {
    const sub: SubscriptionState = { status: 'active', plan: 'yearly', expiresAt: '2099-12-31' };
    useAccountStore.getState().setSubscription(sub);
    expect(useAccountStore.getState().subscription).toEqual(sub);
    useAccountStore.getState().setSubscription(null);
    expect(useAccountStore.getState().subscription).toBeNull();
  });

  it('setParentPinHash stores the hash and clears any cooldown', () => {
    useAccountStore.getState().setPinAttempts({ failures: [1, 2], lockedUntil: 99 });
    useAccountStore.getState().setParentPinHash('salt:digest');
    expect(useAccountStore.getState().parentPinHash).toBe('salt:digest');
    expect(useAccountStore.getState().pinAttempts).toEqual(INITIAL_ATTEMPT_STATE);
  });

  it('setPinAttempts persists the attempt window', () => {
    const state = { failures: [10, 20], lockedUntil: null };
    useAccountStore.getState().setPinAttempts(state);
    expect(useAccountStore.getState().pinAttempts).toEqual(state);
  });

  it('hydrate restores the PIN hash and a persisted cooldown', async () => {
    vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'account:parentPinHash' ? 'salt:digest' : null));
    vi.mocked(readJson).mockImplementation(async (key: string) => (key === 'account:pinAttempts' ? { failures: [], lockedUntil: 5000 } : null));
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState().parentPinHash).toBe('salt:digest');
    expect(useAccountStore.getState().pinAttempts.lockedUntil).toBe(5000);
    expect(useAccountStore.getState().hydrated).toBe(true);
    vi.mocked(readJson).mockImplementation(async () => null);
  });

  /**
   * F-APP-001 section 3.9 (A-6): every new PIN (first set, change, Forgot PIN reset) writes
   * `account:pinSetAt`, the epoch the device gate marker carries, and the fingerprint of the
   * hash it stored (`account:pinHashSeen`), so a later boot can tell a PIN changed elsewhere.
   */
  describe('PIN epoch (F-APP-001 section 3.9)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('a first PIN writes account:pinSetAt (epoch ms) and the fingerprint of its hash', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(1_760_000_000_000);
      useAccountStore.getState().setParentPinHash('salt:digest');
      const s = useAccountStore.getState();
      expect(s.pinSetAt).toBe(1_760_000_000_000);
      expect(s.pinHashSeen).toBe(pinHashFingerprint('salt:digest'));
      expect(writeJson).toHaveBeenCalledWith('account:pinSetAt', 1_760_000_000_000);
      expect(writeJson).toHaveBeenCalledWith('account:pinHashSeen', pinHashFingerprint('salt:digest'));
    });

    it('a changed PIN and a PIN set after Forgot PIN each move the epoch', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(1_000);
      useAccountStore.getState().setParentPinHash('a:1');
      vi.setSystemTime(2_000);
      useAccountStore.getState().setParentPinHash('b:2');
      expect(useAccountStore.getState().pinSetAt).toBe(2_000);
      useAccountStore.getState().requestPinReset();
      vi.setSystemTime(3_000);
      useAccountStore.getState().setParentPinHash('c:3');
      expect(useAccountStore.getState().pinSetAt).toBe(3_000);
      expect(useAccountStore.getState().pinHashSeen).toBe(pinHashFingerprint('c:3'));
      expect(vi.mocked(writeJson).mock.calls.filter(([key]) => key === 'account:pinSetAt').map(([, v]) => v)).toEqual([1_000, 2_000, 3_000]);
    });

    it('removing the PIN keeps the epoch and records that no PIN is stored', () => {
      useAccountStore.setState({ parentPinHash: 'a:1', pinSetAt: 5, pinHashSeen: pinHashFingerprint('a:1') });
      useAccountStore.getState().setParentPinHash(null);
      expect(useAccountStore.getState().pinSetAt).toBe(5);
      expect(useAccountStore.getState().pinHashSeen).toBe(NO_PIN_SEEN);
      expect(writeJson).not.toHaveBeenCalledWith('account:pinSetAt', expect.anything());
      expect(writeJson).toHaveBeenCalledWith('account:pinHashSeen', NO_PIN_SEEN);
    });

    it('hydrate restores both keys; a fresh install or a PIN set before A-6 has neither', async () => {
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().pinSetAt).toBeNull();
      expect(useAccountStore.getState().pinHashSeen).toBeNull();
      vi.mocked(readJson).mockImplementation(async (key: string) => (key === 'account:pinSetAt' ? 1_760_000_000_000 : null));
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'account:pinHashSeen' ? '0123456789abcdef' : null));
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().pinSetAt).toBe(1_760_000_000_000);
      expect(useAccountStore.getState().pinHashSeen).toBe('0123456789abcdef');
    });

    it('a fingerprint read that fails is not "nothing seen yet": the next reconcile moves the epoch', async () => {
      vi.mocked(readJson).mockImplementation(async (key: string) => (key === 'account:pinSetAt' ? 5 : null));
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => {
        if (key === 'account:parentPinHash') return 'new:hash';
        throw new Error('UnknownError');
      });
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().pinHashSeen).toBe(PIN_HASH_UNREAD);
      useAccountStore.getState().reconcilePinEpoch(9_000);
      expect(useAccountStore.getState().pinSetAt).toBe(9_000);
      expect(writeJson).toHaveBeenCalledWith('account:pinSetAt', 9_000);
    });

    it('a damaged fingerprint (present but not one) moves the epoch like a failed read; a corrupt epoch reads as absent', async () => {
      vi.mocked(readJson).mockImplementation(async (key: string) => (key === 'account:pinSetAt' ? 'yesterday' : null));
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'account:pinHashSeen' ? 42 : null));
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().pinSetAt).toBeNull();
      expect(useAccountStore.getState().pinHashSeen).toBe(PIN_HASH_UNREAD);
    });

    it('an unparsable fingerprint reads as unread too', async () => {
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => {
        if (key === 'account:pinHashSeen') throw new SyntaxError('Unexpected token');
        return null;
      });
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().pinHashSeen).toBe(PIN_HASH_UNREAD);
    });

    /**
     * A-6 review: the PIN hash is read exactly. A read that fails (or a stored value that is not
     * a hash) must never look like "no PIN" to the device gate marker or the epoch.
     */
    it('a PIN hash read that fails: the hash falls back to the lenient read and pinHashReadFailed is set', async () => {
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => {
        if (key === 'account:parentPinHash') throw new Error('UnknownError');
        return null;
      });
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().parentPinHash).toBeNull();
      expect(useAccountStore.getState().pinHashReadFailed).toBe(true);
    });

    it('a failed PIN hash read whose lenient retry finds the hash is not a failure', async () => {
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => {
        if (key === 'account:parentPinHash') throw new Error('UnknownError');
        return null;
      });
      vi.mocked(readJson).mockImplementation(async (key: string) => (key === 'account:parentPinHash' ? 'a:1' : null));
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().parentPinHash).toBe('a:1');
      expect(useAccountStore.getState().pinHashReadFailed).toBe(false);
    });

    it('a stored PIN hash that is not a string counts as a failed read', async () => {
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'account:parentPinHash' ? 7 : null));
      await useAccountStore.getState().hydrate();
      expect(useAccountStore.getState().parentPinHash).toBeNull();
      expect(useAccountStore.getState().pinHashReadFailed).toBe(true);
    });

    it('hydrate reads the PIN hash exactly and the stored hash is kept', async () => {
      vi.mocked(readJsonExact).mockImplementation(async (key: string) => (key === 'account:parentPinHash' ? 'a:1' : null));
      await useAccountStore.getState().hydrate();
      expect(readJsonExact).toHaveBeenCalledWith('account:parentPinHash');
      expect(useAccountStore.getState().parentPinHash).toBe('a:1');
      expect(useAccountStore.getState().pinHashReadFailed).toBe(false);
    });

    it('reconcilePinEpoch does nothing while the PIN hash could not be read (no spurious pinHashSeen)', () => {
      useAccountStore.setState({ parentPinHash: null, pinSetAt: 5, pinHashSeen: pinHashFingerprint('a:1'), pinHashReadFailed: true });
      useAccountStore.getState().reconcilePinEpoch(9_000);
      expect(writeJson).not.toHaveBeenCalled();
      expect(useAccountStore.getState().pinHashSeen).toBe(pinHashFingerprint('a:1'));
      expect(useAccountStore.getState().pinSetAt).toBe(5);
    });

    it('a PIN set after a failed read clears the flag', () => {
      useAccountStore.setState({ pinHashReadFailed: true });
      useAccountStore.getState().setParentPinHash('b:2');
      expect(useAccountStore.getState().pinHashReadFailed).toBe(false);
    });

    it('reconcilePinEpoch: a hash an older bundle changed moves the epoch to now and stores both keys', () => {
      useAccountStore.setState({ parentPinHash: 'new:hash', pinSetAt: 5, pinHashSeen: pinHashFingerprint('old:hash') });
      useAccountStore.getState().reconcilePinEpoch(9_000);
      const s = useAccountStore.getState();
      expect(s.pinSetAt).toBe(9_000);
      expect(s.pinHashSeen).toBe(pinHashFingerprint('new:hash'));
      expect(writeJson).toHaveBeenCalledWith('account:pinSetAt', 9_000);
      expect(writeJson).toHaveBeenCalledWith('account:pinHashSeen', pinHashFingerprint('new:hash'));
    });

    it('reconcilePinEpoch: the first look at a PIN set before A-6 stores only the fingerprint', () => {
      useAccountStore.setState({ parentPinHash: 'old:hash', pinSetAt: null, pinHashSeen: null });
      useAccountStore.getState().reconcilePinEpoch(9_000);
      expect(useAccountStore.getState().pinSetAt).toBeNull();
      expect(writeJson).toHaveBeenCalledWith('account:pinHashSeen', pinHashFingerprint('old:hash'));
      expect(writeJson).not.toHaveBeenCalledWith('account:pinSetAt', expect.anything());
    });

    it('reconcilePinEpoch: nothing written when the hash is the one last seen', () => {
      useAccountStore.setState({ parentPinHash: 'a:1', pinSetAt: 5, pinHashSeen: pinHashFingerprint('a:1') });
      useAccountStore.getState().reconcilePinEpoch(9_000);
      expect(writeJson).not.toHaveBeenCalled();
      expect(useAccountStore.getState().pinSetAt).toBe(5);
    });
  });
});
