import { LOCALES, findBannedWord, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { isCodeError, joinErrorMessage } from '../join-code';
import { lookupMoveLine, otherClasses, rosterPickOnly, staysInLine } from '../join-moves';

/**
 * Owner report 2026-10-23: a learner moved from class A to class B showed in both. The Join screen now says why a
 * join is refused while a move stands or waits, and says plainly that a join keeps the classes the learner is in.
 */

const row = (spaceId: string, name: string, kind: 'class' | 'family' | 'school' = 'class') => ({ spaceId, kind, name, role: 'student' as const, joinedAt: 't' });

describe('join refusals for a learner move: the copy (en, es, ko)', () => {
  it('keeps the English wording', () => {
    const m = getMessages('en').caregiver;
    const facts = { learner: 'Suni', space: 'Class A' };
    expect(joinErrorMessage('moved_out', m, null, { ...facts, other: 'Class B' })).toBe('Suni moved to Class B. To be in Class A too, ask the teacher.');
    expect(joinErrorMessage('moved_out', m, null, facts)).toBe('Suni moved to another class. To be in Class A too, ask the teacher.');
    expect(joinErrorMessage('move_waiting', m, null, { learner: 'Suni', space: 'Class B' })).toBe('A move to Class B is waiting for the teacher. It finishes when they say yes.');
    expect(staysInLine('Suni', ['Class A'], m)).toBe('Suni stays in Class A too. To move instead, use Move or ask the teacher.');
    expect(staysInLine('Suni', ['Class A', 'Class C'], m)).toBe('Suni stays in Class A and Class C too. To move instead, use Move or ask the teacher.');
  });

  it.each(LOCALES)('%s: every line names the learner and the classes, is calm, and has no banned word', (locale) => {
    const m = getMessages(locale).caregiver;
    const out = joinErrorMessage('moved_out', m, null, { learner: 'Suni', space: 'Class A', other: 'Class B' });
    const elsewhere = joinErrorMessage('moved_out', m, null, { learner: 'Suni', space: 'Class A' });
    const waiting = joinErrorMessage('move_waiting', m, null, { learner: 'Suni', space: 'Class B' });
    const stays = staysInLine('Suni', ['Class A', 'Class C'], m);
    for (const line of [out, elsewhere, waiting, stays]) {
      expect(findBannedWord(line, locale, 'learner'), line).toBeNull();
      expect(line).not.toMatch(/wrong|failed|error|오류|실패|incorrect/i);
    }
    expect(out).toContain('Suni');
    expect(out).toContain('Class A');
    expect(out).toContain('Class B');
    expect(elsewhere).toContain('Suni');
    expect(elsewhere).toContain('Class A');
    expect(waiting).toContain('Class B');
    expect(stays).toContain('Suni');
    expect(stays).toContain('Class A');
    expect(stays).toContain('Class C');
    // The three-classes line is not what a moved learner reads.
    expect(out).not.toBe(m.audience.shared.joinCodeFull);
    expect(waiting).not.toBe(m.audience.shared.joinCodeFull);
  });

  it.each(LOCALES)('%s: es and ko are their own words, not the English', (locale) => {
    if (locale === 'en') return;
    const en = getMessages('en').caregiver;
    const m = getMessages(locale).caregiver;
    const facts = { learner: 'Suni', space: 'Class A', other: 'Class B' };
    expect(joinErrorMessage('moved_out', m, null, facts)).not.toBe(joinErrorMessage('moved_out', en, null, facts));
    expect(joinErrorMessage('move_waiting', m, null, facts)).not.toBe(joinErrorMessage('move_waiting', en, null, facts));
    expect(staysInLine('Suni', ['Class A'], m)).not.toBe(staysInLine('Suni', ['Class A'], en));
  });

  it('without the facts the screen passes, a calm generic line (never the three-classes line)', () => {
    const m = getMessages('en').caregiver;
    expect(joinErrorMessage('moved_out', m)).toBe(m.retry.unknown);
    expect(joinErrorMessage('move_waiting', m)).toBe(m.retry.unknown);
  });

  it('neither is a code error: the code is right, so the screen stays on the class', () => {
    expect(isCodeError('moved_out')).toBe(false);
    expect(isCodeError('move_waiting')).toBe(false);
  });
});

describe('lookupMoveLine', () => {
  const m = getMessages('en').caregiver;
  it('names the class a move stands in, else the waiting move, else nothing', () => {
    expect(lookupMoveLine({ space: { name: 'Class A' }, moved: { to: { spaceId: 'space:b', name: 'Class B' } } }, 'Suni', m)).toEqual({ code: 'moved_out', line: 'Suni moved to Class B. To be in Class A too, ask the teacher.' });
    expect(lookupMoveLine({ space: { name: 'Class B' }, moveWaiting: { from: { spaceId: 'space:a', name: 'Class A' } } }, 'Suni', m)).toEqual({
      code: 'move_waiting',
      line: 'A move to Class B is waiting for the teacher. It finishes when they say yes.',
    });
    // A destination with no name left (a class renamed to nothing) reads as another class.
    expect(lookupMoveLine({ space: { name: 'Class A' }, moved: { to: { spaceId: 'space:b', name: '  ' } } }, 'Suni', m)?.line).toBe('Suni moved to another class. To be in Class A too, ask the teacher.');
    expect(lookupMoveLine({ space: { name: 'Class A' } }, 'Suni', m)).toBeNull();
  });
});

describe('otherClasses', () => {
  it('lists the live classes other than the one being joined; a family or a school is not a class', () => {
    const rows = [row('space:a', 'Class A'), row('space:f', 'Kim family', 'family'), row('space:s', 'School', 'school'), row('space:c', 'Class C'), row('space:b', 'Class B')];
    expect(otherClasses(rows, { id: 'space:b', kind: 'class' }).map((r) => r.name)).toEqual(['Class A', 'Class C']);
    expect(otherClasses(rows, { id: 'space:f', kind: 'family' })).toEqual([]);
    expect(otherClasses([], { id: 'space:b', kind: 'class' })).toEqual([]);
  });
});

describe('rosterPickOnly', () => {
  const base = { classDevice: true, kind: 'class' as const, rosterSize: 2, rejoin: true, classRows: 0 };
  it('a class tablet a move left without its class picks from the roster only', () => {
    expect(rosterPickOnly(base)).toBe(true);
    // Also once the "Join your new class again." line was shown (the flag is then false, still known), or after a
    // restart (no flag) when the tablet holds no class at all.
    expect(rosterPickOnly({ ...base, rejoin: false })).toBe(true);
    expect(rosterPickOnly({ ...base, rejoin: undefined })).toBe(true);
  });

  it('every other case keeps "I\'m new"', () => {
    expect(rosterPickOnly({ ...base, classDevice: false })).toBe(false);
    expect(rosterPickOnly({ ...base, kind: 'family' })).toBe(false);
    expect(rosterPickOnly({ ...base, rosterSize: 0 })).toBe(false);
    // A class tablet that still holds a class and never lost one this session.
    expect(rosterPickOnly({ ...base, rejoin: undefined, classRows: 1 })).toBe(false);
  });
});
