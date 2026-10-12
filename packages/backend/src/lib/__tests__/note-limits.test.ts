import { NOTE_SEND_MAX_LEARNERS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { noteRateKey } from '../../db';
import {
  accountOverLimit,
  learnersOverLimit,
  NOTE_LIMIT_ACCOUNT_PER_DAY,
  NOTE_LIMIT_LEARNER_PER_DAY,
  NOTE_LIMIT_LEARNERS_PER_SEND,
  NOTE_LIMIT_PAIR_PER_DAY,
  NOTE_LIMIT_SENDS_PER_MINUTE,
  NOTE_LIMIT_WINDOW_MS,
  sendCounterHits,
  sendCounterKeys,
} from '../note-limits';
import { notesSendEnabled } from '../notes-switch';

/** F-FEEDBACK-001 section 7.3 (OD-14) and section 7.8. */
describe('note limits', () => {
  it('pins the OD-14 values', () => {
    expect([NOTE_LIMIT_PAIR_PER_DAY, NOTE_LIMIT_LEARNER_PER_DAY, NOTE_LIMIT_ACCOUNT_PER_DAY, NOTE_LIMIT_LEARNERS_PER_SEND, NOTE_LIMIT_SENDS_PER_MINUTE]).toEqual([3, 10, 400, 300, 10]);
    expect(NOTE_LIMIT_LEARNERS_PER_SEND).toBe(NOTE_SEND_MAX_LEARNERS);
    expect(NOTE_LIMIT_WINDOW_MS).toBe(86_400_000);
  });

  it('reads the account key and, per learner, the pair and learner keys', () => {
    expect(sendCounterKeys('acct', ['profile:a', 'profile:b'])).toEqual(['note:acct:acct', 'note:pair:profile:a:acct', 'note:learner:profile:a', 'note:pair:profile:b:acct', 'note:learner:profile:b']);
  });

  it('skips a learner at 3 from this account or 10 from everyone, not before', () => {
    const counts = new Map([
      [noteRateKey.pair('profile:a', 'acct'), 2],
      [noteRateKey.pair('profile:b', 'acct'), 3],
      [noteRateKey.learner('profile:c'), 9],
      [noteRateKey.learner('profile:d'), 10],
    ]);
    expect([...learnersOverLimit('acct', ['profile:a', 'profile:b', 'profile:c', 'profile:d', 'profile:e'], counts)]).toEqual(['profile:b', 'profile:d']);
  });

  it('refuses a send that would take the account past 400 a day', () => {
    expect(accountOverLimit('acct', 400, new Map())).toBe(false);
    expect(accountOverLimit('acct', 401, new Map())).toBe(true);
    expect(accountOverLimit('acct', 1, new Map([[noteRateKey.account('acct'), 399]]))).toBe(false);
    expect(accountOverLimit('acct', 2, new Map([[noteRateKey.account('acct'), 399]]))).toBe(true);
  });

  it('writes one hit per note on the account, the pair and the learner', () => {
    expect(sendCounterHits('acct', ['profile:a'], 't')).toEqual([
      { key: 'note:acct:acct', at: 't' },
      { key: 'note:pair:profile:a:acct', at: 't' },
      { key: 'note:learner:profile:a', at: 't' },
    ]);
    expect(sendCounterHits('acct', [], 't')).toEqual([]);
  });
});

describe('NOTES_SEND (section 7.8)', () => {
  it('is on only for the exact value `enabled`', () => {
    expect(notesSendEnabled(undefined)).toBe(false);
    expect(notesSendEnabled({})).toBe(false);
    for (const value of ['', 'true', '1', 'Enabled', 'enabled ', 'on']) expect(notesSendEnabled({ NOTES_SEND: value }), value).toBe(false);
    expect(notesSendEnabled({ NOTES_SEND: 'enabled' })).toBe(true);
  });
});
