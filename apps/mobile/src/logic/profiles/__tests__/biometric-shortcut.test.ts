import { describe, expect, it } from 'vitest';
import {
  BIOMETRIC_SHORTCUT_ITEM_KEY,
  biometricShortcutOf,
  classifyShortcutRead,
  pinEpochOf,
  shortcutOffered,
  shortcutRecord,
  shortcutStale,
  shortcutSwitch,
  shortcutValid,
  tokenOf,
  type ShortcutContext,
} from '../biometric-shortcut';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-9 (section 8.6, CS-13, CS-18): the opt-in is valid only for the PIN
 * epoch it was turned on for; a read succeeds only when it returns the token; an item the platform voided turns the
 * shortcut off, and a cancel never does.
 */

const TOKEN = 'a'.repeat(64);
const EPOCH = 1_760_000_000_000;

describe('[OA] the record (account:biometricShortcut)', () => {
  it('the SecureStore key is the one of section 13.1', () => {
    expect(BIOMETRIC_SHORTCUT_ITEM_KEY).toBe('hr.biometricShortcut');
  });

  it('reads a version 1 record and holds no token', () => {
    const record = shortcutRecord(EPOCH + 5, EPOCH);
    expect(record).toEqual({ v: 1, enabledAt: EPOCH + 5, epoch: EPOCH });
    expect(biometricShortcutOf(record)).toEqual(record);
    expect(Object.keys(record).sort()).toEqual(['enabledAt', 'epoch', 'v']);
  });

  it('anything else reads as off', () => {
    for (const junk of [null, undefined, 'on', 7, { v: 2, enabledAt: 1, epoch: 1 }, { v: 1, enabledAt: 1 }, { v: 1, enabledAt: -1, epoch: 0 }, { v: 1, enabledAt: 1, epoch: Number.NaN }, { v: 1, enabledAt: '1', epoch: 0 }]) {
      expect(biometricShortcutOf(junk), JSON.stringify(junk)).toBeNull();
    }
  });

  it('a PIN set before the epoch key is epoch 0', () => {
    expect(pinEpochOf(null)).toBe(0);
    expect(pinEpochOf(EPOCH)).toBe(EPOCH);
    expect(shortcutRecord(10, null).epoch).toBe(0);
  });
});

describe('[OA] opt-in validity by epoch (section 8.6)', () => {
  const record = shortcutRecord(EPOCH + 1, EPOCH);

  it('valid only while the epoch is the current PIN epoch', () => {
    expect(shortcutValid(record, EPOCH, true)).toBe(true);
    // Any new PIN (set, change, reset) moves the epoch.
    expect(shortcutValid(record, EPOCH + 60_000, true)).toBe(false);
    expect(shortcutValid(record, null, true)).toBe(false);
    expect(shortcutValid(shortcutRecord(1, null), null, true)).toBe(true);
  });

  it('never valid without a PIN or a record', () => {
    expect(shortcutValid(record, EPOCH, false)).toBe(false);
    expect(shortcutValid(null, EPOCH, true)).toBe(false);
  });

  it('a record for another PIN, or with no PIN, is stale (turned off and deleted); none is not', () => {
    expect(shortcutStale(record, EPOCH + 1, true)).toBe(true);
    expect(shortcutStale(record, EPOCH, false)).toBe(true);
    expect(shortcutStale(record, EPOCH, true)).toBe(false);
    expect(shortcutStale(null, EPOCH, true)).toBe(false);
  });
});

describe('[OA] where the shortcut shows', () => {
  const on: ShortcutContext = { flagOn: true, available: true, record: shortcutRecord(EPOCH + 1, EPOCH), pinSetAt: EPOCH, hasPin: true };

  it('the PIN screen offers it only with the flag, strong biometrics and a valid opt-in', () => {
    expect(shortcutOffered(on)).toBe(true);
    // Off hides it and ignores a stored opt-in.
    expect(shortcutOffered({ ...on, flagOn: false })).toBe(false);
    expect(shortcutOffered({ ...on, available: false })).toBe(false);
    expect(shortcutOffered({ ...on, record: null })).toBe(false);
    expect(shortcutOffered({ ...on, pinSetAt: EPOCH + 1 })).toBe(false);
    expect(shortcutOffered({ ...on, hasPin: false })).toBe(false);
  });

  it('the Grown-up area switch: hidden, needs a PIN first, off or on; every device starts off', () => {
    expect(shortcutSwitch(on)).toBe('on');
    expect(shortcutSwitch({ ...on, record: null })).toBe('off');
    expect(shortcutSwitch({ ...on, pinSetAt: EPOCH + 1 })).toBe('off');
    expect(shortcutSwitch({ ...on, hasPin: false })).toBe('needsPin');
    expect(shortcutSwitch({ ...on, hasPin: false, record: null })).toBe('needsPin');
    expect(shortcutSwitch({ ...on, flagOn: false })).toBe('hidden');
    expect(shortcutSwitch({ ...on, available: false, hasPin: false })).toBe('hidden');
  });
});

describe('[OA] what a read means (CS-13, CS-18)', () => {
  it('success only when the read returns the token', () => {
    expect(classifyShortcutRead({ value: TOKEN })).toBe('ok');
    expect(classifyShortcutRead({ value: tokenOf(new Uint8Array(32).fill(0xff)) })).toBe('ok');
  });

  it('an item the platform voided (null) or damaged is invalidated', () => {
    expect(classifyShortcutRead({ value: null })).toBe('invalidated');
    for (const bad of ['', 'true', TOKEN.slice(1), `${TOKEN}0`, TOKEN.toUpperCase(), `${'g'.repeat(64)}`]) {
      expect(classifyShortcutRead({ value: bad }), bad).toBe('invalidated');
    }
  });

  it('a cancel, a failed match or a locked-out sensor is cancelled, never invalidated', () => {
    for (const error of [new Error('User canceled the authentication'), new Error('Could not authenticate the user'), new Error('errSecUserCanceled'), 'cancel', null, 42]) {
      expect(classifyShortcutRead({ error }), String(error)).toBe('cancelled');
    }
  });

  it('a thrown error that names an invalidated key is invalidated', () => {
    expect(classifyShortcutRead({ error: new Error('KeyPermanentlyInvalidatedException: Key permanently invalidated') })).toBe('invalidated');
    const named = new Error('read failed');
    named.name = 'KeyInvalidated';
    expect(classifyShortcutRead({ error: named })).toBe('invalidated');
    expect(classifyShortcutRead({ error: 'key invalidated' })).toBe('invalidated');
  });

  it('the token is lower-case hex of every byte', () => {
    expect(tokenOf(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff');
  });
});
