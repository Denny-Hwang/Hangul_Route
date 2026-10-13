import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../../i18n/safe-storage';
import { COMPOSER_DRAFT_MAX_MS, clearComposerDraft, composerDraftKey, readComposerDraft, saveComposerDraft, type ComposerDraft } from '../composer-draft';

/**
 * F-FEEDBACK-001 FB-15: [ Preview ] opens All lessons in the same tab, so the composer keeps the note being written
 * in this tab's `sessionStorage` (guarded, lib/i18n/safe-storage) and puts it back when the adult returns with
 * `&compose=1`. Per space; dropped on close and on send; older than an hour, ignored.
 */
function fakeStorage(initial: Record<string, string> = {}): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const DRAFT: ComposerDraft = {
  mode: 'learners',
  picked: ['profile:mina', 'profile:joon'],
  presetId: 'next_try_this',
  text: 'Loved your reading today',
  questId: 'quest:meet-o-u-m',
  label: 'grandma',
};

const T0 = 1_000_000;

describe('composer draft (FB-15)', () => {
  it('round-trips a draft for one space', () => {
    const s = fakeStorage();
    expect(saveComposerDraft(s, 'space:c1', DRAFT, T0)).toBe(true);
    expect(readComposerDraft(s, 'space:c1', T0 + 1000)).toEqual(DRAFT);
  });

  it('keys the draft per space', () => {
    const s = fakeStorage();
    saveComposerDraft(s, 'space:c1', DRAFT, T0);
    expect(composerDraftKey('space:c1')).not.toBe(composerDraftKey('space:c2'));
    expect(readComposerDraft(s, 'space:c2', T0)).toBeNull();
  });

  it('clear drops it', () => {
    const s = fakeStorage();
    saveComposerDraft(s, 'space:c1', DRAFT, T0);
    clearComposerDraft(s, 'space:c1');
    expect(readComposerDraft(s, 'space:c1', T0)).toBeNull();
    expect(s.map.size).toBe(0);
  });

  it('ignores and drops a draft older than the limit', () => {
    const s = fakeStorage();
    saveComposerDraft(s, 'space:c1', DRAFT, T0);
    expect(readComposerDraft(s, 'space:c1', T0 + COMPOSER_DRAFT_MAX_MS + 1)).toBeNull();
    expect(s.map.size).toBe(0);
  });

  it('ignores a draft from the future (clock moved back)', () => {
    const s = fakeStorage();
    saveComposerDraft(s, 'space:c1', DRAFT, T0);
    expect(readComposerDraft(s, 'space:c1', T0 - 60_000)).toBeNull();
  });

  it('rejects malformed or unknown values and drops them', () => {
    const key = composerDraftKey('space:c1');
    const bad = [
      'not json',
      JSON.stringify({ v: 2, savedAt: T0, ...DRAFT }),
      JSON.stringify({ v: 1, savedAt: T0, ...DRAFT, mode: 'some' }),
      JSON.stringify({ v: 1, savedAt: T0, ...DRAFT, presetId: 'shout' }),
      JSON.stringify({ v: 1, savedAt: T0, ...DRAFT, label: 'boss' }),
      JSON.stringify({ v: 1, savedAt: T0, ...DRAFT, questId: 'card:x' }),
      JSON.stringify({ v: 1, savedAt: T0, ...DRAFT, picked: ['nobody'] }),
      JSON.stringify({ v: 1, savedAt: T0, ...DRAFT, text: 'x'.repeat(2001) }),
      JSON.stringify({ v: 1, savedAt: T0, ...DRAFT, extra: true }),
    ];
    for (const raw of bad) {
      const s = fakeStorage({ [key]: raw });
      expect(readComposerDraft(s, 'space:c1', T0)).toBeNull();
      expect(s.map.size).toBe(0);
    }
  });

  it('accepts an empty draft (everyone, no preset, no quest)', () => {
    const s = fakeStorage();
    const empty: ComposerDraft = { mode: 'everyone', picked: [], presetId: null, text: '', questId: null, label: 'family' };
    saveComposerDraft(s, 'space:c1', empty, T0);
    expect(readComposerDraft(s, 'space:c1', T0)).toEqual(empty);
  });

  it('never throws when storage is missing or blocked', () => {
    expect(saveComposerDraft(null, 'space:c1', DRAFT, T0)).toBe(false);
    expect(saveComposerDraft(throwing, 'space:c1', DRAFT, T0)).toBe(false);
    expect(readComposerDraft(null, 'space:c1', T0)).toBeNull();
    expect(readComposerDraft(throwing, 'space:c1', T0)).toBeNull();
    expect(() => clearComposerDraft(throwing, 'space:c1')).not.toThrow();
  });
});
