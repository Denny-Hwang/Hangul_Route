import { describe, expect, it } from 'vitest';
import { batchStatus, encodeNoteCursor, parseNoteCursor, sentNoteReaction, sentNoteStatus, type SentNoteFacts } from '../note-views';

/** The sent-list mapping of F-FEEDBACK-001 section 7.2 (PR FB-3b): statuses, reactions and the page cursor. */
const facts = (over: Partial<SentNoteFacts> = {}): SentNoteFacts => ({ spaceKind: 'class', mode: 'all', blocked: false, senderMaySend: true, learnerInSpace: true, ...over });
const live = { status: 'live' as const, readAt: null, withdrawnAt: null };
const read = { status: 'live' as const, readAt: '2026-10-12T00:00:00.000Z', withdrawnAt: null };
const TAKEN_BACK = '2026-10-12T01:00:00.000Z';

describe('sentNoteStatus', () => {
  it('a class sender reads sent, never opened; off, a block, a lost right, hidden and reported read not_shown', () => {
    expect(sentNoteStatus(read, facts())).toBe('sent');
    expect(sentNoteStatus(live, facts({ mode: 'presets' }))).toBe('sent');
    expect(sentNoteStatus(live, facts({ mode: 'off' }))).toBe('not_shown');
    expect(sentNoteStatus(live, facts({ blocked: true }))).toBe('not_shown');
    expect(sentNoteStatus(live, facts({ senderMaySend: false }))).toBe('not_shown');
    expect(sentNoteStatus({ status: 'hidden', readAt: null, withdrawnAt: null }, facts())).toBe('not_shown');
    expect(sentNoteStatus({ status: 'reported', readAt: null, withdrawnAt: null }, facts())).toBe('not_shown');
  });

  it('a learner no longer in the space reads not_shown, in a class and in a family', () => {
    expect(sentNoteStatus(read, facts({ learnerInSpace: false }))).toBe('not_shown');
    expect(sentNoteStatus(read, facts({ spaceKind: 'family', learnerInSpace: false }))).toBe('not_shown');
  });

  it('a note taken back and then reported still reads withdrawn, so a report is never revealed (rule 8.2-c)', () => {
    expect(sentNoteStatus({ status: 'reported', readAt: null, withdrawnAt: TAKEN_BACK }, facts())).toBe('withdrawn');
    expect(sentNoteStatus({ status: 'reported', readAt: read.readAt, withdrawnAt: TAKEN_BACK }, facts({ spaceKind: 'family' }))).toBe('withdrawn');
  });

  it('taken back reads withdrawn whatever else holds; a family space reads opened once read and ignores the class mode', () => {
    expect(sentNoteStatus({ status: 'withdrawn', readAt: null, withdrawnAt: TAKEN_BACK }, facts({ blocked: true, mode: 'off', learnerInSpace: false }))).toBe('withdrawn');
    expect(sentNoteStatus(read, facts({ spaceKind: 'family', mode: 'off' }))).toBe('opened');
    expect(sentNoteStatus(live, facts({ spaceKind: 'family', mode: 'off' }))).toBe('sent');
    expect(sentNoteStatus(read, facts({ spaceKind: 'family', blocked: true }))).toBe('not_shown');
  });
});

describe('sentNoteReaction', () => {
  it('only while shown, and for a class note only in mode all', () => {
    const n = { reaction: 'thanks' };
    expect(sentNoteReaction(n, 'sent', facts())).toBe('thanks');
    expect(sentNoteReaction(n, 'sent', facts({ mode: 'presets' }))).toBeNull();
    expect(sentNoteReaction(n, 'not_shown', facts())).toBeNull();
    expect(sentNoteReaction(n, 'withdrawn', facts())).toBeNull();
    expect(sentNoteReaction(n, 'opened', facts({ spaceKind: 'family', mode: 'off' }))).toBe('thanks');
  });
});

describe('batchStatus', () => {
  it('withdrawn only once nothing is live and a note of it was taken back, a later report changing nothing', () => {
    expect(batchStatus({ live: 3, withdrawn: 1 })).toBe('sent');
    expect(batchStatus({ live: 0, withdrawn: 2 })).toBe('withdrawn');
    expect(batchStatus({ live: 0, withdrawn: 0 })).toBe('sent');
  });
});

describe('the page cursor', () => {
  it('round-trips a row and reads a plain ISO time as strictly older', () => {
    const row = { createdAt: '2026-10-12T01:02:03.004Z', id: 'note:abcdefgh-1' };
    expect(parseNoteCursor(encodeNoteCursor(row))).toEqual(row);
    expect(parseNoteCursor('2026-10-12T01:02:03Z')).toEqual({ createdAt: '2026-10-12T01:02:03.000Z', id: '' });
    expect(parseNoteCursor('2026-10-12T01:02Z')).toEqual({ createdAt: '2026-10-12T01:02:00.000Z', id: '' });
  });

  it('refuses anything else', () => {
    for (const raw of ['', 'yesterday', '2026-10-12', '2026-10-12T01:02:03+09:00', '2026-13-45T01:02:03Z', '2026-10-12T01:02:03Z~bad', '2026-10-12T01:02:03Z~note:abcdefgh~x']) expect(parseNoteCursor(raw), raw).toBeNull();
  });
});
