import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  blockRowLabel,
  classModeChoices,
  oneTimeCardLine,
  prefsChangedLine,
  receivedLearner,
  receivedLines,
  reportReasonChoices,
  senderRows,
  showOneTimeCard,
  viewerSendGrant,
} from '../family-notes';
import type { FamilyNotePrefs, NoteBlock, NoteSender, OversightNote } from '../notes';

/**
 * F-FEEDBACK-001 FB-12 (sections 6.10 item 5, 7.2, 7.7, 8.2 to 8.5; wireframe console/family-notes.md; screen spec
 * design/screens/notes/family-notes.md): the family Received tab's view logic and panel D's rows.
 */

const en = getMessages('en');
const f = en.console.notes.family;
const ko = getMessages('ko');

const note = (over: Partial<OversightNote> = {}): OversightNote => ({
  id: 'note:aaaaaaaa',
  spaceId: 'space:c1',
  spaceKind: 'class',
  spaceName: 'Saturday Class B',
  from: { role: 'teacher', label: null },
  senderName: null,
  mine: false,
  presetId: 'progress_reading',
  text: null,
  suggest: null,
  createdAt: '2026-10-13T09:00:00.000Z',
  status: 'live',
  reaction: null,
  hiddenBy: null,
  reportedBy: null,
  ...over,
});
const prefs = (over: Partial<FamilyNotePrefs> = {}): FamilyNotePrefs => ({ classes: 'all', acknowledged: false, updatedBy: null, ...over });

describe('receivedLearner (one learner at a time)', () => {
  const learners = [
    { id: 'profile:mina', displayName: 'Mina' },
    { id: 'profile:jun', displayName: 'Jun' },
  ];
  it('the &learner one when the family has it', () => {
    expect(receivedLearner(learners, 'profile:jun')).toEqual(learners[1]);
  });
  it('otherwise the first learner of the roster (never a learner of another space)', () => {
    expect(receivedLearner(learners, null)).toEqual(learners[0]);
    expect(receivedLearner(learners, 'profile:stranger')).toEqual(learners[0]);
  });
  it('nobody in a family with no learners', () => {
    expect(receivedLearner([], 'profile:mina')).toBeNull();
  });
});

describe('receivedLines (newest first, never sorted by sender or status)', () => {
  it('keeps the API order and puts the day word in front of each row', () => {
    const now = new Date(2026, 9, 13, 12);
    const rows = [
      note({ id: 'note:today001', createdAt: new Date(2026, 9, 13, 9).toISOString(), status: 'reported', reportedBy: 'Ji-woo Kim' }),
      note({ id: 'note:today002', createdAt: new Date(2026, 9, 13, 8).toISOString(), status: 'live' }),
      note({ id: 'note:yday0001', createdAt: new Date(2026, 9, 12, 8).toISOString(), status: 'withdrawn' }),
    ];
    const lines = receivedLines(rows, now, 'en');
    expect(lines.map((l) => l.raw.id)).toEqual(['note:today001', 'note:today002', 'note:yday0001']);
    expect(lines.map((l) => l.day)).toEqual([en.common.notes.date.today, en.common.notes.date.today, en.common.notes.date.yesterday]);
    expect(lines[0]?.view.status).toBe(f.reportedBy('Ji-woo Kim'));
    expect(lines[2]?.view.status).toBe(f.withdrawn);
    expect(lines[2]?.view.text).toBeNull();
  });
});

describe('showOneTimeCard (section 6.10 item 5)', () => {
  it('once a class note reached the learner and the family has not answered the card', () => {
    expect(showOneTimeCard(prefs(), [note()])).toBe(true);
  });
  it('never after the family answered it on any device or here', () => {
    expect(showOneTimeCard(prefs({ acknowledged: true }), [note()])).toBe(false);
  });
  it('not before a class note arrived: family notes alone never show it', () => {
    expect(showOneTimeCard(prefs(), [])).toBe(false);
    expect(showOneTimeCard(prefs(), [note({ spaceKind: 'family', from: { role: 'family', label: 'mom' } })])).toBe(false);
  });
  it('a row whose sender reads as a teacher counts even when the space kind is odd', () => {
    expect(showOneTimeCard(prefs(), [note({ spaceKind: 'school' })])).toBe(true);
  });
  it('a row without a readable sender takes its side from the space kind', () => {
    const unread = (kind: OversightNote['spaceKind']): OversightNote => ({ ...note({ spaceKind: kind }), from: undefined as unknown as OversightNote['from'] });
    expect(showOneTimeCard(prefs(), [unread('family')])).toBe(false);
    expect(showOneTimeCard(prefs(), [unread('class')])).toBe(true);
  });
  it('not while the setting could not be read', () => {
    expect(showOneTimeCard(null, [note()])).toBe(false);
  });
});

describe('class-notes setting words', () => {
  it('the three modes in their fixed order', () => {
    expect(classModeChoices('en')).toEqual([
      { id: 'all', label: f.settings.options.all },
      { id: 'presets', label: f.settings.options.presets },
      { id: 'off', label: f.settings.options.off },
    ]);
  });
  it('the one-time card names the current mode', () => {
    expect(oneTimeCardLine('all', 'en')).toBe('Notes from classes: All notes.');
    expect(oneTimeCardLine('presets', 'en')).toBe(f.oneTimeCard.line(f.settings.options.presets));
  });
  it('who changed it last: an account, a device, or nothing when never changed', () => {
    expect(prefsChangedLine('Ji-woo Kim', 'en')).toBe(f.settings.lastChangedBy('Ji-woo Kim'));
    expect(prefsChangedLine('device', 'en')).toBe(f.settings.lastChangedOnDevice);
    expect(prefsChangedLine(null, 'en')).toBeNull();
    expect(prefsChangedLine('', 'en')).toBeNull();
  });
});

describe('blockRowLabel (stopped senders, section 8.5)', () => {
  const block = (over: Partial<NoteBlock>): NoteBlock => ({ senderRef: 'ref1', label: 'Your teacher · Sunday Class A', createdAt: '2026-10-01T00:00:00.000Z', ...over });
  it('a teacher by the class, in the viewer language', () => {
    expect(blockRowLabel(block({ role: 'teacher', name: 'Sunday Class A' }), 'en')).toBe('Your teacher · Sunday Class A');
    expect(blockRowLabel(block({ role: 'teacher', name: 'Sunday Class A' }), 'ko')).toBe(ko.common.notes.teacherLabel('Sunday Class A'));
  });
  it('a family adult by the account name, or another family by its space name', () => {
    expect(blockRowLabel(block({ role: 'family', name: 'grandma.park@example.com' }), 'en')).toBe('grandma.park@example.com');
  });
  it('a sender who shares no space with the learner any more', () => {
    expect(blockRowLabel(block({ role: 'former', name: null }), 'en')).toBe(f.settings.stopped.former);
    expect(blockRowLabel(block({ role: 'former', name: null }), 'ko')).toBe(ko.console.notes.family.settings.stopped.former);
  });
  it('an older Worker without role or name: its own line', () => {
    expect(blockRowLabel(block({}), 'en')).toBe('Your teacher · Sunday Class A');
    expect(blockRowLabel(block({ role: 'teacher', name: null }), 'en')).toBe('Your teacher · Sunday Class A');
    expect(blockRowLabel(block({ role: 'family', name: '' }), 'en')).toBe('Your teacher · Sunday Class A');
    expect(blockRowLabel(block({ name: 'Sunday Class A' }), 'en')).toBe('Your teacher · Sunday Class A');
  });
});

describe('reportReasonChoices (the app sheet reasons)', () => {
  it('the four reasons in order, named for the learner', () => {
    expect(reportReasonChoices('Mina', 'en')).toEqual([
      { id: 'unkind', label: 'Unkind' },
      { id: 'unsafe', label: 'Unsafe' },
      { id: 'not_for_me', label: 'Not meant for Mina' },
      { id: 'other', label: 'Something else' },
    ]);
  });
});

describe('panel D: who can send notes (OD-17, rule 8.2-b)', () => {
  const senders: NoteSender[] = [
    { accountId: 'acct:owner', name: 'Ji-woo Kim', isOwner: true, canSend: true },
    { accountId: 'acct:grandma', name: 'grandma.park@example.com', isOwner: false, canSend: true },
    { accountId: 'acct:minho', name: 'Min-ho Kim', isOwner: false, canSend: false },
  ];
  it('the owner sees a switch on every caregiver row and "always" on their own, marked as them', () => {
    const view = senderRows(senders, 'acct:owner', 'en');
    expect(view.viewerIsOwner).toBe(true);
    expect(view.rows).toEqual([
      { accountId: 'acct:owner', name: f.senders.you('Ji-woo Kim'), always: true, canSend: true, switchable: false },
      { accountId: 'acct:grandma', name: 'grandma.park@example.com', always: false, canSend: true, switchable: true },
      { accountId: 'acct:minho', name: 'Min-ho Kim', always: false, canSend: false, switchable: true },
    ]);
  });
  it('another caregiver sees the same list read-only, with their own row marked', () => {
    const view = senderRows(senders, 'acct:minho', 'en');
    expect(view.viewerIsOwner).toBe(false);
    expect(view.rows.map((r) => [r.name, r.switchable])).toEqual([
      ['Ji-woo Kim', false],
      ['grandma.park@example.com', false],
      [f.senders.you('Min-ho Kim'), false],
    ]);
  });
  it('the send grant of the viewer: known, refused, or unknown', () => {
    expect(viewerSendGrant(senders, 'acct:grandma')).toBe(true);
    expect(viewerSendGrant(senders, 'acct:minho')).toBe(false);
    expect(viewerSendGrant(senders, 'acct:other')).toBeNull();
    expect(viewerSendGrant(null, 'acct:minho')).toBeNull();
  });
});
