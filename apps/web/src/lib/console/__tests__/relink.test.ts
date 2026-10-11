import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canDeleteLearnerData, canReissueRescueCode, decideFailureNote, expiresLabel, minutesLeft, relinkNoteText, requestedLabel } from '../relink';

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

  it('words every label from the dictionary in each locale (F-I18N-001 PR 10a)', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const r = getMessages(locale).console.relink;
      expect(expiresLabel('2026-09-21T12:08:30.000Z', now, locale)).toBe(r.expiresIn(9));
      expect(expiresLabel('garbage', now, locale)).toBe(r.expired);
      expect(requestedLabel('2026-09-21T11:59:40.000Z', now, locale)).toBe(r.askedJustNow);
      expect(requestedLabel('2026-09-21T11:57:10.000Z', now, locale)).toBe(r.askedAgo(2));
      expect(decideFailureNote({ error: 'unknown', code: 'expired' }, locale)).toBe(r.closed);
      expect(decideFailureNote({ error: 'network' }, locale)).toBe(r.failed);
    }
  });
});

describe('relink notes and labels follow the locale they are given (F-I18N-001 PR 10a)', () => {
  // es and ko have no console keys yet; the pseudo-locale is the one whose words differ.
  const PSEUDO = 'en-XA' as UiLocale;
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('words each note kind', () => {
    expect(relinkNoteText({ kind: 'approved', name: 'Mina' })).toBe('Mina can open their new device now.');
    expect(relinkNoteText({ kind: 'denied', name: 'Mina' })).toBe('Closed. Mina\'s device will say "ask your teacher".');
    expect(relinkNoteText({ kind: 'decideFailed', result: { error: 'unknown', code: 'expired' } })).toBe('This request already closed — the learner can ask again.');
    expect(relinkNoteText({ kind: 'decideFailed', result: { error: 'unknown', code: 'not_a_member' } })).toBe("Didn't go through. Try again.");
    expect(relinkNoteText({ kind: 'issueFailed' })).toBe("Couldn't issue a code right now.");
  });

  it('reads the pseudo-locale when given it', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const bracketed = /^\[.*\]$/;
    expect(relinkNoteText({ kind: 'approved', name: 'Mina' }, PSEUDO)).toMatch(bracketed);
    expect(relinkNoteText({ kind: 'approved', name: 'Mina' }, PSEUDO)).toContain('Míñá');
    expect(relinkNoteText({ kind: 'denied', name: 'Mina' }, PSEUDO)).toMatch(bracketed);
    expect(relinkNoteText({ kind: 'decideFailed', result: { error: 'unknown', code: 'expired' } }, PSEUDO)).toMatch(bracketed);
    expect(relinkNoteText({ kind: 'decideFailed', result: { error: 'network' } }, PSEUDO)).toMatch(bracketed);
    expect(relinkNoteText({ kind: 'issueFailed' }, PSEUDO)).toMatch(bracketed);
    expect(expiresLabel('2026-09-21T12:08:30.000Z', now, PSEUDO)).toMatch(bracketed);
    expect(expiresLabel('garbage', now, PSEUDO)).toMatch(bracketed);
    expect(requestedLabel('2026-09-21T11:59:40.000Z', now, PSEUDO)).toMatch(bracketed);
    expect(requestedLabel('2026-09-21T11:57:10.000Z', now, PSEUDO)).toMatch(bracketed);
  });
});
