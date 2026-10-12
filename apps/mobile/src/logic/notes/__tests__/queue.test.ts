import { describe, expect, it } from 'vitest';
import { enqueueReport, enqueueState, flushOrder, outcomeOf, pendingReportIds, settleWrite } from '../queue';
import type { PendingWrite } from '../types';
import { data, note } from './fixtures';

/** F-FEEDBACK-001 section 6.9: the queue of pending writes (pure). */
describe('enqueueState', () => {
  it('holds at most one pending state write per note; the newest pick replaces an older one', () => {
    let q = enqueueState([], 'note:aaaaaaaa', { reaction: 'thanks' }, 't1');
    q = enqueueState(q, 'note:aaaaaaaa', { reaction: 'did_it' }, 't2');
    expect(q).toEqual([{ kind: 'state', noteId: 'note:aaaaaaaa', reaction: 'did_it', at: 't2' }]);
  });

  it('keeps a pending read when a reaction follows, and a pending reaction when a read follows', () => {
    let q = enqueueState([], 'note:aaaaaaaa', { read: true }, 't1');
    q = enqueueState(q, 'note:aaaaaaaa', { reaction: 'happy' }, 't2');
    expect(q).toEqual([{ kind: 'state', noteId: 'note:aaaaaaaa', read: true, reaction: 'happy', at: 't2' }]);
    q = enqueueState(q, 'note:aaaaaaaa', { read: true }, 't3');
    expect(q).toEqual([{ kind: 'state', noteId: 'note:aaaaaaaa', read: true, reaction: 'happy', at: 't3' }]);
  });

  it('keeps writes for other notes and moves the changed write to the end', () => {
    let q = enqueueState([], 'note:aaaaaaaa', { read: true }, 't1');
    q = enqueueState(q, 'note:bbbbbbbb', { read: true }, 't2');
    q = enqueueState(q, 'note:aaaaaaaa', { reaction: 'thanks' }, 't3');
    expect(q.map((w) => w.noteId)).toEqual(['note:bbbbbbbb', 'note:aaaaaaaa']);
  });

  it('ignores an empty change', () => {
    expect(enqueueState([], 'note:aaaaaaaa', {}, 't1')).toEqual([]);
  });
});

describe('enqueueReport', () => {
  it('holds at most one pending report per note (the newest reason wins) next to its state write', () => {
    let q: PendingWrite[] = enqueueState([], 'note:aaaaaaaa', { read: true }, 't1');
    q = enqueueReport(q, 'note:aaaaaaaa', 'unkind', 'grown_up_pin', 't2');
    q = enqueueReport(q, 'note:aaaaaaaa', 'unsafe', 'grown_up_pin', 't3');
    expect(q).toEqual([
      { kind: 'state', noteId: 'note:aaaaaaaa', read: true, at: 't1' },
      { kind: 'report', noteId: 'note:aaaaaaaa', reason: 'unsafe', attest: 'grown_up_pin', at: 't3' },
    ]);
    expect(enqueueReport([], 'note:bbbbbbbb', 'other', undefined, 't4')).toEqual([{ kind: 'report', noteId: 'note:bbbbbbbb', reason: 'other', at: 't4' }]);
  });

  it('names the notes with a pending report (hidden on this device at once)', () => {
    const q = enqueueReport(enqueueState([], 'note:aaaaaaaa', { read: true }, 't1'), 'note:bbbbbbbb', 'unkind', 'self', 't2');
    expect([...pendingReportIds(q)]).toEqual(['note:bbbbbbbb']);
  });
});

describe('flushOrder', () => {
  it('sends reports first, then state writes, each oldest first', () => {
    const q: PendingWrite[] = [
      { kind: 'state', noteId: 'note:aaaaaaaa', read: true, at: 't1' },
      { kind: 'report', noteId: 'note:bbbbbbbb', reason: 'unkind', at: 't2' },
      { kind: 'state', noteId: 'note:cccccccc', reaction: 'thanks', at: 't3' },
      { kind: 'report', noteId: 'note:dddddddd', reason: 'other', at: 't4' },
    ];
    expect(flushOrder(q).map((w) => `${w.kind}:${w.noteId}`)).toEqual([
      'report:note:bbbbbbbb',
      'report:note:dddddddd',
      'state:note:aaaaaaaa',
      'state:note:cccccccc',
    ]);
    expect(q[0]?.noteId).toBe('note:aaaaaaaa'); // not changed in place
  });
});

describe('outcomeOf', () => {
  it('maps the answer of a device route to what happens to the write', () => {
    expect(outcomeOf(200)).toBe('done');
    expect(outcomeOf(201)).toBe('done');
    expect(outcomeOf(404)).toBe('drop'); // the note is gone
    expect(outcomeOf(409)).toBe('drop'); // the note changed on the server
    expect(outcomeOf(422)).toBe('drop');
    expect(outcomeOf(403)).toBe('drop');
    expect(outcomeOf(400)).toBe('drop');
    expect(outcomeOf(429)).toBe('limited');
    expect(outcomeOf(500)).toBe('retry');
    expect(outcomeOf(503)).toBe('retry');
    expect(outcomeOf(-1)).toBe('retry'); // offline
    expect(outcomeOf(401)).toBe('retry'); // credentials refresh at the next sync
  });
});

describe('settleWrite', () => {
  const state: PendingWrite = { kind: 'state', noteId: 'note:aaaaaaaa', read: true, at: 't1' };
  const report: PendingWrite = { kind: 'report', noteId: 'note:aaaaaaaa', reason: 'unkind', at: 't2' };

  it('done and drop remove the write; retry keeps it', () => {
    const d = data({ notes: [note('aaaaaaaa')], queue: [state, report] });
    expect(settleWrite(d, state, 'done').queue).toEqual([report]);
    expect(settleWrite(d, report, 'drop').queue).toEqual([state]);
    expect(settleWrite(d, state, 'retry')).toBe(d);
  });

  it('a newer write for the same note made while the old one was in flight stays queued', () => {
    const newer: PendingWrite = { kind: 'state', noteId: 'note:aaaaaaaa', read: true, reaction: 'thanks', at: 't9' };
    const d = data({ queue: [newer] });
    expect(settleWrite(d, state, 'done').queue).toEqual([newer]);
  });

  it('a rate-limited report leaves the queue and keeps the note hidden on this device', () => {
    const d = data({ notes: [note('aaaaaaaa')], queue: [report] });
    const out = settleWrite(d, report, 'limited');
    expect(out.queue).toEqual([]);
    expect(out.putAway).toEqual(['note:aaaaaaaa']);
    // Twice does not list it twice.
    expect(settleWrite({ ...out, queue: [report] }, report, 'limited').putAway).toEqual(['note:aaaaaaaa']);
  });

  it('a rate-limited state write waits for the next sync', () => {
    const d = data({ queue: [state] });
    expect(settleWrite(d, state, 'limited')).toBe(d);
  });
});
