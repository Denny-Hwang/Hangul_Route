import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canDeleteLearnerData, canReissueRescueCode, decideFailureNote, expiresLabel, minutesLeft, nextMinuteTick, platformLabel, relinkNoteText, requestedLabel } from '../relink';

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

describe('the re-link page polish (AMENDMENTS-GROWNUP-UX GX-12, T12 and P8)', () => {
  it('rolls the request time up: minutes under an hour, then hours, then days', () => {
    expect(requestedLabel('2026-09-21T11:01:00.000Z', now)).toBe('asked 59 min ago');
    expect(requestedLabel('2026-09-21T11:00:00.000Z', now)).toBe('asked 1 hour ago');
    expect(requestedLabel('2026-09-21T08:00:00.000Z', now)).toBe('asked 4 hours ago');
    expect(requestedLabel('2026-09-20T12:30:00.000Z', now)).toBe('asked 23 hours ago');
    expect(requestedLabel('2026-09-20T12:00:00.000Z', now)).toBe('asked 1 day ago');
    expect(requestedLabel('2026-09-18T11:00:00.000Z', now)).toBe('asked 3 days ago');
    // A request stamped a little ahead of this clock is "just now", never a negative time.
    expect(requestedLabel('2026-09-21T12:00:20.000Z', now)).toBe('asked just now');
    for (const locale of ['en', 'es', 'ko'] as const) {
      const r = getMessages(locale).console.relink;
      expect(requestedLabel('2026-09-21T08:00:00.000Z', now, locale)).toBe(r.askedHoursAgo(4));
      expect(requestedLabel('2026-09-18T11:00:00.000Z', now, locale)).toBe(r.askedDaysAgo(3));
    }
  });

  it('names the platform the learner app sends, and says "device" for anything else', () => {
    expect(platformLabel('ios')).toBe('iPhone or iPad');
    expect(platformLabel('android')).toBe('Android');
    expect(platformLabel('web')).toBe('Web');
    expect(platformLabel(' iOS ')).toBe('iPhone or iPad');
    expect(platformLabel('windows')).toBe('device');
    expect(platformLabel(null)).toBe('device');
    expect(platformLabel(undefined)).toBe('device');
    expect(platformLabel('')).toBe('device');
    // Never a key of the object's prototype.
    expect(platformLabel('constructor')).toBe('device');
    expect(platformLabel('toString')).toBe('device');
    for (const locale of ['en', 'es', 'ko'] as const) {
      const r = getMessages(locale).console.relink;
      expect(platformLabel('ios', locale)).toBe(r.platform.ios);
      expect(platformLabel('web', locale)).toBe(r.platform.web);
      expect(platformLabel('tv', locale)).toBe(r.device);
    }
  });

  it('wakes the countdown on the next minute any label changes, once a minute, not every few seconds', () => {
    // Expires 12:08:30: "expires in 9 min" turns to 8 at 12:00:30, 30 s from now.
    expect(nextMinuteTick([{ requestedAt: '2026-09-21T11:58:30.000Z', expiresAt: '2026-09-21T12:08:30.000Z' }], now)).toBe(30_000 + 250);
    // Asked at 11:59:40 (just now): "asked 1 min ago" at 12:00:40, 40 s from now; it expires 12:09:40 (also 40 s).
    expect(nextMinuteTick([{ requestedAt: '2026-09-21T11:59:40.000Z', expiresAt: '2026-09-21T12:09:40.000Z' }], now)).toBe(40_000 + 250);
    // On a minute boundary the next change is a whole minute away.
    expect(nextMinuteTick([{ requestedAt: '2026-09-21T11:58:00.000Z', expiresAt: '2026-09-21T12:08:00.000Z' }], now)).toBe(60_000 + 250);
    // The soonest of two requests wins.
    expect(
      nextMinuteTick(
        [
          { requestedAt: '2026-09-21T11:58:30.000Z', expiresAt: '2026-09-21T12:08:30.000Z' },
          { requestedAt: '2026-09-21T11:59:50.000Z', expiresAt: '2026-09-21T12:09:50.000Z' },
        ],
        now,
      ),
    ).toBe(30_000 + 250);
    // Nothing to count (no request, an expired one, unreadable times): one minute.
    expect(nextMinuteTick([], now)).toBe(60_000);
    expect(nextMinuteTick([{ requestedAt: 'garbage', expiresAt: 'garbage' }], now)).toBe(60_000);
    // An expired request's "asked" label still ticks: asked 11:49:10, "asked 11 min ago" at 12:00:10.
    expect(nextMinuteTick([{ requestedAt: '2026-09-21T11:49:10.000Z', expiresAt: '2026-09-21T11:59:10.000Z' }], now)).toBe(10_000 + 250);
    // Past an hour the "asked" label changes on the hour, not every minute; the countdown is gone.
    expect(nextMinuteTick([{ requestedAt: '2026-09-21T10:30:00.000Z', expiresAt: '2026-09-21T10:40:00.000Z' }], now)).toBe(60_000);
  });

  it("words a family's denial for a grown-up, a class's for a teacher (P8)", () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const r = getMessages(locale).console.relink;
      expect(relinkNoteText({ kind: 'denied', name: 'Mina', spaceKind: 'family' }, locale)).toBe(r.deniedFamily('Mina'));
      expect(relinkNoteText({ kind: 'denied', name: 'Mina', spaceKind: 'class' }, locale)).toBe(r.denied('Mina'));
      expect(relinkNoteText({ kind: 'denied', name: 'Mina', spaceKind: 'school' }, locale)).toBe(r.denied('Mina'));
      expect(relinkNoteText({ kind: 'approved', name: 'Mina', spaceKind: 'family' }, locale)).toBe(r.approved('Mina'));
    }
    expect(relinkNoteText({ kind: 'denied', name: 'Mina', spaceKind: 'family' })).toBe('Closed. Mina\'s device will say "ask your grown-up".');
  });
});
