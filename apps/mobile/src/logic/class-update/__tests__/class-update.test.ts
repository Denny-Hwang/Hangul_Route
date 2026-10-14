import { CLASS_SCOPE_LINE_IDS, CLASS_SCOPE_TEXT, classScopeItems } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { SEEN_MOVES_MAX, classMovesSeenKey, classScopeLines, classUpdateLines, readSeen, withSeen } from '../class-update';

/** [TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D5, TV-D10: the Home lines and the class update screen's lines. */

const move = (id: string) => ({ id, to: { spaceId: 'space:b', name: 'Saturday Class B' }, executedAt: '2026-10-14T00:00:00.000Z' });
const needed = { needed: true, current: 'class-scope-2026-10' };

describe('classUpdateLines', () => {
  it('shows each move once: the ones this device has not shown', () => {
    expect(classUpdateLines({ scope: null, moves: [move('move:1'), move('move:2')], seen: ['move:1'], profile: {} }).moves.map((m) => m.id)).toEqual(['move:2']);
  });

  it('a child profile (or no type) gets the gated line; a self profile the direct one; none once read', () => {
    expect(classUpdateLines({ scope: needed, moves: [], seen: [], profile: {} }).scope).toBe('child');
    expect(classUpdateLines({ scope: needed, moves: [], seen: [], profile: { learnerType: 'child' } }).scope).toBe('child');
    expect(classUpdateLines({ scope: needed, moves: [], seen: [], profile: { learnerType: 'self' } }).scope).toBe('self');
    expect(classUpdateLines({ scope: { ...needed, needed: false }, moves: [], seen: [], profile: {} }).scope).toBeNull();
    expect(classUpdateLines({ scope: null, moves: [], seen: [], profile: {} })).toEqual({ moves: [], scope: null });
  });
});

describe('the seen list', () => {
  it('adds a move once, newest last, and keeps at most the bound', () => {
    expect(withSeen(['a', 'b'], 'a')).toEqual(['b', 'a']);
    const many = Array.from({ length: SEEN_MOVES_MAX }, (_, i) => `move:${i}`);
    const next = withSeen(many, 'move:new');
    expect(next).toHaveLength(SEEN_MOVES_MAX);
    expect(next.at(-1)).toBe('move:new');
    expect(next[0]).toBe('move:1');
  });

  it('reads a stored list leniently and keys it by profile', () => {
    expect(readSeen(['a', 3, null, 'b'])).toEqual(['a', 'b']);
    expect(readSeen('a')).toEqual([]);
    expect(readSeen(null)).toEqual([]);
    expect(classMovesSeenKey('profile:a')).toBe('class-moves-seen:profile:a');
  });
});

describe('classScopeLines', () => {
  it('draws every line in the canonical order, the list with every item, the name filled in', () => {
    const sheet = classScopeLines('en', 'Mina');
    expect(sheet.locale).toBe('en');
    expect(sheet.lines.map((l) => l.id)).toEqual([...CLASS_SCOPE_LINE_IDS]);
    expect(sheet.lines[0]?.text).toBe(CLASS_SCOPE_TEXT.en.lines.intro.replace('{learner}', 'Mina'));
    const list = sheet.lines.find((l) => l.id === 'list');
    expect(list?.items).toEqual(classScopeItems('en').map((i) => i.text.split('{learner}').join('Mina')));
    expect(sheet.lines.filter((l) => l.id !== 'list').every((l) => l.items === null)).toBe(true);
    expect(JSON.stringify(sheet)).not.toContain('{learner}');
  });

  it('follows the UI language, and reads English for a language with no text', () => {
    expect(classScopeLines('ko', 'Mina').lines[0]?.text).toBe(CLASS_SCOPE_TEXT.ko.lines.intro.replace('{learner}', 'Mina'));
    expect(classScopeLines('es', 'Mina').locale).toBe('es');
    expect(classScopeLines('fr', 'Mina').locale).toBe('en');
  });
});
