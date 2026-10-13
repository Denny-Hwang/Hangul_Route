import { readFileSync } from 'node:fs';
import { getMessages, LOCALES } from '@hangul-route/i18n';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApiResult, TransferDestinationView, TransferLearnerSideView, TransferSourceView, TransferView } from '../api';
import { isCaregiverSafe } from '../banned-text';
import { classTransferEnabled } from '../config';
import { ROUTES, memberNounSingular } from '../routing';
import {
  TRANSFER_REFRESH_MS,
  blockedCopy,
  canCancel,
  daysLeft,
  daysSince,
  isOpenTransfer,
  pendingCount,
  scheduledLine,
  slotLabel,
  startError,
  startErrorText,
  statusLine,
  stepWord,
} from '../transfer';
import { noteTransferResult, resetTransferLockForTests, subscribeTransferLock, transfersLockedThisSession, transfersShown } from '../transfer-lock';

const en = getMessages('en').console.transfer;
const NOW = new Date('2026-10-12T12:00:00.000Z');

const common = {
  agreedBySchoolAdmin: false,
  scheduledFor: null,
  blockReason: null,
  createdAt: '2026-10-10T12:00:00.000Z',
  expiresAt: '2026-10-24T12:00:00.000Z',
  executedAt: null,
  endedAt: null,
  endedByYou: false,
  endReason: null,
} as const;

function source(over: Partial<TransferSourceView> = {}): TransferSourceView {
  return {
    ...common,
    id: 'transfer:s1',
    role: 'source',
    status: 'requested',
    steps: { learner: 'yes', source: 'waiting', destination: 'waiting' },
    initiator: 'learner_side',
    learnerId: null,
    learner: { name: 'Jun', avatar: 'tiger' },
    destination: null,
    ...over,
  };
}

function destination(over: Partial<TransferDestinationView> = {}): TransferDestinationView {
  return {
    ...common,
    id: 'transfer:d1',
    role: 'destination',
    status: 'requested',
    steps: { learner: 'yes', source: 'waiting', destination: 'waiting' },
    learner: { name: 'M. K.', avatar: 'tiger', level: 'some-reading' },
    comingFrom: null,
    ...over,
  };
}

function family(over: Partial<TransferLearnerSideView> = {}): TransferLearnerSideView {
  return {
    id: 'transfer:f1',
    role: 'learner_side',
    status: 'requested',
    initiator: 'source',
    learner: { id: 'profile:mina', name: 'Mina' },
    from: { spaceId: 'space:a', name: 'Sunday Class A' },
    to: { spaceId: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 8 },
    learnerState: 'pending',
    sourceState: 'yes',
    destinationState: 'waiting',
    introduce: false,
    premiumChange: 'none',
    destinationConsentMode: 'parent',
    relinkAffected: false,
    sourcePlansAffected: false,
    visibleToday: [],
    blockReason: null,
    executeAfter: null,
    createdAt: '2026-10-11T12:00:00.000Z',
    expiresAt: '2026-10-25T12:00:00.000Z',
    executedAt: null,
    endedAt: null,
    learnerRoute: 'caregiver',
    endedFrom: null,
    termsDigest: 'a'.repeat(64),
    ...over,
  };
}

describe('class-move helpers (F-SPACE-002 section 4.8, T-6a)', () => {
  it('refreshes every 30 s', () => {
    expect(TRANSFER_REFRESH_MS).toBe(30_000);
  });

  it('open means requested or approved', () => {
    expect(isOpenTransfer(source())).toBe(true);
    expect(isOpenTransfer(source({ status: 'approved' }))).toBe(true);
    expect(isOpenTransfer(source({ status: 'executed' }))).toBe(false);
    expect(isOpenTransfer(source({ status: 'ended' }))).toBe(false);
  });

  describe('slotLabel and stepWord', () => {
    it('a class page says Family / This class / New class; its own yes reads "you said yes"', () => {
      const v = source({ steps: { learner: 'yes', source: 'yes', destination: 'waiting' } });
      expect(slotLabel('learner', v)).toBe('Family');
      expect(slotLabel('source', v)).toBe('This class');
      expect(slotLabel('destination', v)).toBe('New class');
      expect(stepWord('learner', v)).toBe('said yes');
      expect(stepWord('source', v)).toBe('you said yes');
      expect(stepWord('destination', v)).toBe('waiting');
    });

    it('the family page names the classes', () => {
      const v = family();
      expect(slotLabel('learner', v)).toBe('Family');
      expect(slotLabel('source', v)).toBe('Sunday Class A');
      expect(slotLabel('destination', v)).toBe('Saturday Class B');
      expect(stepWord('learner', v)).toBe('waiting');
      expect(stepWord('source', v)).toBe('said yes');
      expect(stepWord('learner', family({ learnerState: 'consented' }))).toBe('said yes');
    });

    it('an ended request has no steps to word', () => {
      expect(stepWord('source', source({ status: 'ended', steps: null }))).toBe('waiting');
    });
  });

  describe('statusLine', () => {
    it('source: the family asked this class (destination named only when shared)', () => {
      expect(statusLine(source(), NOW)).toBe("Jun's family asked to move to another class.");
      expect(statusLine(source({ destination: { spaceId: 'space:b', name: 'Saturday Class B' } }), NOW)).toBe("Jun's family asked to move to Saturday Class B.");
    });

    it('source: this class started it and waits for the family, or everyone waits', () => {
      const started = source({ initiator: 'source', steps: { learner: 'waiting', source: 'yes', destination: 'waiting' } });
      expect(statusLine(started, NOW)).toBe('Waiting for the family.');
      expect(statusLine(source({ steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }), NOW)).toBe('Nothing changes until all three say yes.');
    });

    it('source: scheduled, waiting for room, moved, ended', () => {
      expect(statusLine(source({ status: 'approved', scheduledFor: '2026-10-14T12:00:00.000Z' }), NOW)).toBe('Everyone agreed. The move happens on Oct 14.');
      expect(statusLine(source({ status: 'approved', blockReason: 'cap_class' }), NOW)).toBe('Waiting for room in the new class.');
      expect(statusLine(source({ status: 'executed', learner: null }), NOW)).toBe('A student moved to another class');
      expect(statusLine(source({ status: 'ended', steps: null }), NOW)).toBe('This request ended.');
    });

    it('destination: never says what the source answered', () => {
      expect(statusLine(destination(), NOW)).toBe('The family has said yes.');
      expect(statusLine(destination({ steps: { learner: 'yes', source: 'waiting', destination: 'yes' } }), NOW)).toBe('You said yes. Nothing changes until everyone says yes.');
      expect(statusLine(destination({ steps: { learner: 'waiting', source: 'yes', destination: 'yes' } }), NOW)).toBe('You said yes. Nothing changes until everyone says yes.');
      expect(statusLine(destination({ status: 'approved', blockReason: 'cap_class' }), NOW)).toBe('Everyone has said yes. This class is full right now.');
      expect(statusLine(destination({ status: 'approved', blockReason: 'cap_school' }), NOW)).toBe('Everyone has said yes. The school is full right now.');
      expect(statusLine(destination({ status: 'approved', blockReason: 'cap_learner' }), NOW)).toBe('Everyone has said yes. The move is waiting.');
      expect(statusLine(destination({ status: 'executed' }), NOW)).toBe('A student joined this class');
    });

    it('family: teacher-asked has no line; reset asks again; after yes it waits for one or both classes', () => {
      expect(statusLine(family(), NOW)).toBeNull();
      expect(statusLine(family({ initiator: 'learner_side' }), NOW)).toBe('Please check this again.');
      const after = family({ learnerState: 'consented', executeAfter: '2026-10-14T12:00:00.000Z' });
      expect(statusLine(after, NOW)).toBe('Waiting for the other class. The move happens after Oct 14 if it says yes. You can cancel any time.');
      expect(statusLine({ ...after, sourceState: 'waiting' }, NOW)).toBe(
        'Waiting for the other classes. The move happens after Oct 14 if both say yes. You can cancel any time.',
      );
    });

    it('family: planned, room, the learner cap, moved, ended', () => {
      expect(statusLine(family({ status: 'approved', learnerState: 'consented', executeAfter: '2026-10-14T12:00:00.000Z' }), NOW)).toBe('A move is planned for Oct 14.');
      expect(statusLine(family({ status: 'approved', blockReason: 'cap_class' }), NOW)).toBe('Waiting for room in the new class.');
      expect(statusLine(family({ status: 'approved', blockReason: 'cap_learner' }), NOW)).toBe('Mina is in the most classes allowed. Leave one, then the move can go ahead.');
      expect(statusLine(family({ status: 'executed' }), NOW)).toBe('Moved. Mina is now in Saturday Class B. Cards and stars stayed with Mina.');
      expect(statusLine(family({ status: 'ended' }), NOW)).toBe('This request ended.');
    });

    it('words every line in the asked locale', () => {
      for (const locale of LOCALES) expect(statusLine(source({ status: 'ended', steps: null }), NOW, locale)).toBe(getMessages(locale).console.transfer.history.ended);
    });
  });

  describe('blockedCopy', () => {
    it('is null unless an agreed move waits for room; only the destination reads "full"', () => {
      expect(blockedCopy(source())).toBeNull();
      expect(blockedCopy(source({ status: 'approved' }))).toBeNull();
      expect(blockedCopy(source({ status: 'approved', blockReason: 'cap_school' }))).toBe(en.lines.waitingRoom);
      expect(blockedCopy(family({ status: 'approved', blockReason: 'cap_school' }))).toBe(en.lines.waitingRoom);
      expect(blockedCopy(destination({ status: 'approved', blockReason: 'cap_class' }))).toBe(en.lines.fullClass);
    });
  });

  describe('canCancel (D22: a source card follows initiator)', () => {
    it('a source card cancels only a request this class started, while it is open', () => {
      expect(canCancel(source({ initiator: 'source' }))).toBe(true);
      expect(canCancel(source({ initiator: 'source', status: 'approved', blockReason: 'cap_class' }))).toBe(true);
      expect(canCancel(source({ initiator: 'learner_side' }))).toBe(false);
      expect(canCancel(source({ initiator: 'source', status: 'executed' }))).toBe(false);
      expect(canCancel(source({ initiator: 'source', status: 'ended' }))).toBe(false);
    });

    it('a guardian cancels any open request; the destination never cancels', () => {
      expect(canCancel(family({ learnerState: 'consented' }))).toBe(true);
      expect(canCancel(family({ status: 'approved' }))).toBe(true);
      expect(canCancel(family({ status: 'executed' }))).toBe(false);
      expect(canCancel(destination())).toBe(false);
      expect(canCancel(destination({ status: 'approved' }))).toBe(false);
    });
  });

  describe('pendingCount (every entry point counts its own step waiting)', () => {
    it('counts the views whose own step waits, open requests only', () => {
      const views: TransferView[] = [
        source(),
        source({ steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }),
        source({ status: 'ended', steps: null }),
        destination(),
        destination({ steps: { learner: 'yes', source: 'waiting', destination: 'yes' } }),
        destination({ status: 'approved', steps: { learner: 'yes', source: 'yes', destination: 'yes' } }),
      ];
      expect(pendingCount(views)).toBe(2);
      expect(pendingCount([family(), family({ learnerState: 'consented' }), family({ status: 'ended' })])).toBe(1);
      expect(pendingCount([])).toBe(0);
    });
  });

  describe('days', () => {
    it('daysLeft rounds up and never goes below 0; daysSince rounds down', () => {
      expect(daysLeft('2026-10-24T12:00:00.000Z', NOW)).toBe(12);
      expect(daysLeft('2026-10-12T13:00:00.000Z', NOW)).toBe(1);
      expect(daysLeft('2026-10-01T00:00:00.000Z', NOW)).toBe(0);
      expect(daysLeft('junk', NOW)).toBe(0);
      expect(daysSince('2026-10-11T00:00:00.000Z', NOW)).toBe(1);
      expect(daysSince('2026-10-12T11:00:00.000Z', NOW)).toBe(0);
      expect(daysSince('2026-10-13T00:00:00.000Z', NOW)).toBe(0);
      expect(daysSince('junk', NOW)).toBe(0);
    });
  });

  describe('scheduledLine', () => {
    it('a class reads "Everyone agreed", the family "A move is planned"; null without a date', () => {
      expect(scheduledLine(source({ status: 'approved', scheduledFor: '2026-10-14T12:00:00.000Z' }))).toBe('Everyone agreed. The move happens on Oct 14.');
      expect(scheduledLine(family({ status: 'approved', executeAfter: '2026-10-14T12:00:00.000Z' }))).toBe('A move is planned for Oct 14.');
      expect(scheduledLine(source({ status: 'approved' }))).toBeNull();
      expect(scheduledLine(source({ status: 'approved', scheduledFor: 'junk' }))).toBeNull();
    });
  });

  describe('startError and startErrorText (start-sheet.md, family-page.md)', () => {
    const fail = (code: string, status = 409, details?: Record<string, unknown>): ApiResult<never> => ({ ok: false, error: 'unknown', status, code, ...(details ? { details } : {}) });

    it('maps every answer of preview / create to one line', () => {
      const cases: Array<[ApiResult<never>, 'class' | 'family', string]> = [
        [fail('code_not_found', 404), 'class', en.errors.codeNotFound],
        [fail('invalid_code', 422), 'class', en.errors.codeNotFound],
        [fail('code_expired', 404), 'class', en.errors.codeExpired],
        [fail('cap_class'), 'class', en.errors.full],
        [fail('cap_school'), 'class', en.errors.full],
        [fail('already_member'), 'class', en.errors.alreadyMember('Mina')],
        [fail('too_many_attempts', 429), 'class', en.errors.tooManyAttempts],
        [fail('cannot_send', 422), 'class', en.errors.cannotSend],
        [fail('family_needed', 422), 'class', en.errors.familyNeeded],
        [fail('same_space'), 'class', en.errors.sameSpace('Mina')],
        [fail('already_open'), 'class', en.errors.alreadyOpen('Mina')],
        [fail('already_open', 409, { startedBy: 'class' }), 'family', en.errors.alreadyOpenClass('Mina')],
        [fail('already_open', 409, { startedBy: 'learner_side' }), 'family', en.errors.alreadyOpenFamily('Mina')],
        [fail('destination_busy'), 'class', en.errors.destinationBusy],
        [fail('too_many_requests', 429), 'class', en.errors.tooManyRequests],
        [fail('not_transferable', 422), 'class', en.errors.notTransferable],
        [fail('cooldown', 429), 'family', en.errors.cooldown],
        [fail('learner_manages_own'), 'family', en.lines.manageOwn('Mina')],
        [fail('consent_locale_unavailable', 422), 'family', en.errors.localeUnavailable],
        [fail('family_too_new', 422), 'family', en.states.familyTooNew],
        [fail('conflicted_guardian'), 'family', en.states.conflicted],
        [{ ok: false, error: 'network', status: -1 }, 'class', en.states.offline],
        [fail('something_new', 500), 'class', en.states.failed],
      ];
      for (const [result, side, text] of cases) {
        const err = startError(result, side);
        expect(err, JSON.stringify(result)).not.toBeNull();
        if (err && err.kind === 'line') expect(startErrorText(err, 'Mina'), JSON.stringify(result)).toBe(text);
        else throw new Error(`expected a line for ${JSON.stringify(result)}`);
      }
    });

    it('a changed code finds the class again; a lock, a sign-out and a lost role are page states', () => {
      expect(startError(fail('destination_changed'), 'class')).toEqual({ kind: 'refind' });
      expect(startError(fail('terms_changed'), 'family')).toEqual({ kind: 'refind' });
      expect(startError(fail('transfers_locked', 422), 'class')).toEqual({ kind: 'locked' });
      expect(startError({ ok: false, error: 'unauthorized', status: 401 }, 'class')).toEqual({ kind: 'signIn' });
      expect(startError(fail('not_found', 404), 'class')).toEqual({ kind: 'forbidden' });
      expect(startError({ ok: true, data: 1 as never }, 'class')).toBeNull();
    });
  });

  it('every helper string is caregiver-safe in every locale', () => {
    for (const locale of LOCALES) {
      const lines = [
        statusLine(source(), NOW, locale),
        statusLine(destination({ status: 'approved', blockReason: 'cap_class' }), NOW, locale),
        statusLine(family({ status: 'executed' }), NOW, locale),
        startErrorText({ kind: 'line', key: 'cannotSend' }, 'Mina', locale),
      ];
      for (const line of lines) expect(isCaregiverSafe(line ?? '', locale), line ?? '').toBe(true);
    }
  });
});

describe('memberNounSingular (F-SPACE-002 section 4.8 wording table)', () => {
  it('class student, family learner, school member, in each locale', () => {
    expect(memberNounSingular('class')).toBe('student');
    expect(memberNounSingular('family')).toBe('learner');
    expect(memberNounSingular('school')).toBe('member');
    for (const locale of LOCALES) expect(memberNounSingular('class', locale)).toBe(getMessages(locale).console.transfer.memberNoun.class);
  });
});

describe('ROUTES.spaceTransfers (T14: the space id only)', () => {
  it('addresses the page by the space id, encoded, never a name', () => {
    expect(ROUTES.spaceTransfers('space:abc')).toBe('/teach/space/transfers?id=space%3Aabc');
    expect(ROUTES.spaceTransfers('space:abc', 'class')).toBe('/teach/space/transfers?id=space%3Aabc');
    expect(ROUTES.spaceTransfers('a&b=c#d')).toBe('/teach/space/transfers?id=a%26b%3Dc%23d');
    expect(ROUTES.spaceTransfers('space:f', 'family')).toBe('/parent/space/transfers?id=space%3Af');
    expect(ROUTES.spaceTransfers('space:s', 'school')).toBe('/teach/space/transfers?id=space%3As');
  });

  it('property: for any id, the URL holds the id and nothing else', () => {
    const ids = ['space:1', 'space:Mina Park', 'space:김민아', 'space:?x=1', 'space:%2F', 'space:한 반 / Class A'];
    for (const id of ids) {
      const url = new URL(ROUTES.spaceTransfers(id), 'https://app.example.com');
      expect(url.pathname).toBe('/teach/space/transfers');
      expect([...url.searchParams.keys()]).toEqual(['id']);
      expect(url.searchParams.get('id')).toBe(id);
      expect(url.hash).toBe('');
    }
  });
});

describe('the flag and the session lock (section 4.8 flag handling)', () => {
  afterEach(() => resetTransferLockForTests());

  it('NEXT_PUBLIC_CLASS_TRANSFER=enabled turns the entry points on; anything else stays off', () => {
    expect(classTransferEnabled({})).toBe(false);
    expect(classTransferEnabled({ NEXT_PUBLIC_CLASS_TRANSFER: 'enabled' })).toBe(true);
    for (const off of ['true', '1', 'ENABLED', ' enabled', '']) expect(classTransferEnabled({ NEXT_PUBLIC_CLASS_TRANSFER: off }), off).toBe(false);
    expect(transfersShown({})).toBe(false);
    expect(transfersShown({ NEXT_PUBLIC_CLASS_TRANSFER: 'enabled' })).toBe(true);
  });

  it('the first 422 transfers_locked hides the entry points for the session and tells subscribers once', () => {
    const env = { NEXT_PUBLIC_CLASS_TRANSFER: 'enabled' };
    let calls = 0;
    const off = subscribeTransferLock(() => {
      calls += 1;
    });
    noteTransferResult({ ok: false, error: 'invalid', status: 422, code: 'bad_request' });
    noteTransferResult({ ok: false, error: 'not_found', status: 404, code: 'transfers_locked' });
    noteTransferResult({ ok: true, data: null });
    expect(transfersLockedThisSession()).toBe(false);
    expect(transfersShown(env)).toBe(true);
    noteTransferResult({ ok: false, error: 'invalid', status: 422, code: 'transfers_locked' });
    noteTransferResult({ ok: false, error: 'invalid', status: 422, code: 'transfers_locked' });
    expect(transfersLockedThisSession()).toBe(true);
    expect(transfersShown(env)).toBe(false);
    expect(calls).toBe(1);
    off();
  });
});

describe('the new console files hold no colour literal (CLAUDE.md section 4)', () => {
  it('transfer.ts and transfer-lock.ts', () => {
    for (const file of ['../transfer.ts', '../transfer-lock.ts']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    }
  });
});
