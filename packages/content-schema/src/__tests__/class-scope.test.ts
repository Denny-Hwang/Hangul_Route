import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CLASS_MOVE_LIST_MAX,
  CLASS_MOVE_NOTICE_MS,
  CLASS_MOVE_PURGE_AFTER_MS,
  CLASS_MOVE_WINDOW_MS,
  CLASS_SCOPE_LINE_IDS,
  CLASS_SCOPE_TEXT,
  CLASS_SCOPE_TEXT_VERSION,
  ClassMoveCreateBodySchema,
  ClassMoveEmptyBodySchema,
  ClassMoveIdSchema,
  ClassMovePreviewBodySchema,
  ClassScopeAckBodySchema,
  FULL_SCOPE_TEXT_VERSIONS,
  ProgressSummarySchema,
  SyncInboxSchema,
  TEACHER_FULL_SCOPE_EXTRA_KEYS,
  TEACHER_FULL_SCOPE_ITEMS,
  TEACHER_HIDDEN_SUMMARY_KEYS,
  TEACHER_VISIBLE_ITEM_IDS,
  TEACHER_VISIBLE_SETTING_FIELDS,
  TEACHER_VISIBLE_SUMMARY_KEYS,
  TRANSFER_CONSENT_LOCALES,
  TRANSFER_CONSENT_TEXT,
  isFullScopeVersion,
  type ClassScopeLineId,
  type TransferConsentLocale,
} from '../index';

/** Pinned hash of the class-scope text per version and locale: edit a word, bump CLASS_SCOPE_TEXT_VERSION. */
const PINNED: Record<string, Record<TransferConsentLocale, string>> = {
  'class-scope-2026-10': {
    en: 'a26462e0c5344ef1a0e8f60d7b2c65c5b35bdf931782a87e64d49a2850bb0d7b',
    ko: '8baa7825471599888b7e243d7f3fdd4208963ac62dc32abaad771b1e08bad4b4',
    es: 'c1af7c2d7ee46ce84fec8e83e514894db938f665e75b384b9c2592e93fd74166',
  },
};

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');
const canonical = (locale: TransferConsentLocale): string => JSON.stringify(CLASS_SCOPE_LINE_IDS.map((id) => [id, CLASS_SCOPE_TEXT[locale].lines[id]]));
const placeholders = (s: string): string[] => [...s.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1] as string).sort();
function sentenceWordCounts(text: string): number[] {
  return text
    .split(/[.!?:](?:\s|$)/)
    .map((s) => s.replace(/\{[a-z]+\}/g, 'X').trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(/\s+/).length);
}

describe('[TV] class-scope versions', () => {
  it('has one current version that opens the full scope', () => {
    expect(CLASS_SCOPE_TEXT_VERSION).toBe('class-scope-2026-10');
    expect(FULL_SCOPE_TEXT_VERSIONS).toEqual(['class-scope-2026-10']);
    expect(isFullScopeVersion(CLASS_SCOPE_TEXT_VERSION)).toBe(true);
    expect(isFullScopeVersion('class-scope-2025-01')).toBe(false);
    expect(isFullScopeVersion(null)).toBe(false);
    expect(isFullScopeVersion(undefined)).toBe(false);
  });

  it('pins a hash of every locale to the current version', () => {
    for (const locale of TRANSFER_CONSENT_LOCALES) expect(sha256(canonical(locale)), locale).toBe(PINNED[CLASS_SCOPE_TEXT_VERSION]?.[locale]);
  });
});

describe('[TV] what the full scope adds is classified and named', () => {
  const summaryKeys = Object.keys(ProgressSummarySchema.shape).sort();

  it('classifies every summary key: base, full-scope extra, or never (schemaVersion)', () => {
    const base: readonly string[] = TEACHER_VISIBLE_SUMMARY_KEYS;
    const extra: readonly string[] = TEACHER_FULL_SCOPE_EXTRA_KEYS;
    expect([...base, ...extra, 'schemaVersion'].sort()).toEqual(summaryKeys);
    expect(base.filter((k) => extra.includes(k))).toEqual([]);
  });

  it('keeps every full-scope key on the hidden list, which means hidden at base scope', () => {
    const hidden: readonly string[] = TEACHER_HIDDEN_SUMMARY_KEYS;
    for (const key of TEACHER_FULL_SCOPE_EXTRA_KEYS) expect(hidden).toContain(key);
    expect(hidden.filter((k) => !(TEACHER_FULL_SCOPE_EXTRA_KEYS as readonly string[]).includes(k))).toEqual(['schemaVersion']);
  });

  it('maps every full-scope key and the learner settings to a consent item', () => {
    expect(Object.keys(TEACHER_FULL_SCOPE_ITEMS).sort()).toEqual([...TEACHER_FULL_SCOPE_EXTRA_KEYS].sort());
    expect(TEACHER_FULL_SCOPE_ITEMS).toEqual({ vocab: 'words', stage1Anchor: 'letter_check', selfRoute: 'own_route', routeGoal: 'own_route' });
    expect(TEACHER_VISIBLE_SETTING_FIELDS).toEqual({ classNotes: 'learner_settings' });
    for (const item of [...Object.values(TEACHER_FULL_SCOPE_ITEMS), ...Object.values(TEACHER_VISIBLE_SETTING_FIELDS)]) {
      expect(TEACHER_VISIBLE_ITEM_IDS).toContain(item);
      for (const locale of TRANSFER_CONSENT_LOCALES) expect(TRANSFER_CONSENT_TEXT[locale].items[item].length).toBeGreaterThan(0);
    }
  });
});

describe('[TV] the class-scope text', () => {
  it('keeps the amendment wording in English', () => {
    expect(CLASS_SCOPE_TEXT.en.lines).toEqual({
      intro: 'There is an update about the classes {learner} is in.',
      sees_all: "The teacher of each class {learner} is in can see all of {learner}'s progress, including words.",
      list: 'What a teacher sees:',
      moves: 'A teacher may move {learner} to another class. We tell you when it happens.',
      keeps: 'Cards, stars and finished lessons always stay with {learner}.',
      leave: '{learner} can leave a class in Profile at any time.',
      until: 'Until you press OK, teachers see what they saw before.',
    });
  });

  it('has the same lines and placeholders in every locale', () => {
    for (const locale of TRANSFER_CONSENT_LOCALES) {
      const lines = CLASS_SCOPE_TEXT[locale].lines;
      expect(Object.keys(lines).sort()).toEqual([...CLASS_SCOPE_LINE_IDS].sort());
      for (const id of CLASS_SCOPE_LINE_IDS) {
        expect(lines[id].trim().length, `${locale}.${id}`).toBeGreaterThan(0);
        expect(placeholders(lines[id]), `${locale}.${id}`).toEqual(placeholders(CLASS_SCOPE_TEXT.en.lines[id]));
        for (const name of placeholders(lines[id])) expect(name).toBe('learner');
      }
    }
  });

  it('keeps English at 16 words a sentence and Spanish at 18', () => {
    for (const id of CLASS_SCOPE_LINE_IDS) {
      for (const n of sentenceWordCounts(CLASS_SCOPE_TEXT.en.lines[id])) expect(n, id).toBeLessThanOrEqual(16);
      for (const n of sentenceWordCounts(CLASS_SCOPE_TEXT.es.lines[id])) expect(n, id).toBeLessThanOrEqual(18);
    }
  });

  it('writes Korean in the formal polite style, never a particle on a placeholder', () => {
    for (const id of CLASS_SCOPE_LINE_IDS) {
      const line = CLASS_SCOPE_TEXT.ko.lines[id];
      expect(line, id).not.toMatch(/\}[가-힣]/);
      if (id === 'list') expect(line).toMatch(/:$/);
      else expect(line, id).toMatch(/니다\.$/);
    }
  });

  it('names the shared OK button in the until line of every locale', () => {
    const ok: Record<TransferConsentLocale, string> = { en: 'OK', es: 'OK', ko: '확인' };
    for (const locale of TRANSFER_CONSENT_LOCALES) expect(CLASS_SCOPE_TEXT[locale].lines.until).toContain(ok[locale]);
  });

  it('never says kid or a banned caregiver word', () => {
    for (const id of CLASS_SCOPE_LINE_IDS as readonly ClassScopeLineId[]) {
      expect(CLASS_SCOPE_TEXT.en.lines[id]).not.toMatch(/\b(kids?|missed|failed|behind|lazy)\b/i);
    }
  });
});

describe('[TV] bodies', () => {
  it('accepts a version and nothing else', () => {
    expect(ClassScopeAckBodySchema.safeParse({ version: CLASS_SCOPE_TEXT_VERSION }).success).toBe(true);
    expect(ClassScopeAckBodySchema.safeParse({ version: '' }).success).toBe(false);
    expect(ClassScopeAckBodySchema.safeParse({ version: 'x', extra: 1 }).success).toBe(false);
  });

  it('parses a move with an optional, normalised code and refuses unknown keys or malformed ids', () => {
    const ok = ClassMoveCreateBodySchema.safeParse({ learnerId: 'profile:mina', destinationSpaceId: 'space:b', code: 'abc234' });
    expect(ok.success && ok.data.code).toBe('ABC234');
    expect(ClassMoveCreateBodySchema.safeParse({ learnerId: 'profile:mina', destinationSpaceId: 'space:b' }).success).toBe(true);
    expect(ClassMoveCreateBodySchema.safeParse({ learnerId: 'Mina', destinationSpaceId: 'space:b' }).success).toBe(false);
    expect(ClassMoveCreateBodySchema.safeParse({ learnerId: 'profile:mina', destinationSpaceId: 'space:b', introduce: true }).success).toBe(false);
    expect(ClassMovePreviewBodySchema.safeParse({ learnerId: 'profile:mina', code: 'ABC234' }).success).toBe(true);
    expect(ClassMovePreviewBodySchema.safeParse({ learnerId: 'profile:mina' }).success).toBe(false);
    expect(ClassMoveEmptyBodySchema.safeParse({}).success).toBe(true);
    expect(ClassMoveEmptyBodySchema.safeParse({ reason: 'x' }).success).toBe(false);
  });

  it('addresses a move by an opaque id', () => {
    expect(ClassMoveIdSchema.safeParse('move:2f1c-9a').success).toBe(true);
    expect(ClassMoveIdSchema.safeParse('transfer:2f1c').success).toBe(false);
    expect(ClassMoveIdSchema.safeParse('move:Mina').success).toBe(false);
  });

  it('keeps the windows of the amendment', () => {
    const day = 24 * 60 * 60 * 1000;
    expect([CLASS_MOVE_WINDOW_MS, CLASS_MOVE_NOTICE_MS, CLASS_MOVE_PURGE_AFTER_MS, CLASS_MOVE_LIST_MAX]).toEqual([14 * day, 30 * day, 90 * day, 50]);
  });
});

describe('[TV] inbox fields are additive and lenient', () => {
  const base = { rev: 1, plans: [], memberships: [], tier: 'free', serverTime: '2026-10-14T00:00:00.000Z' };

  it('defaults to no update and no notice when an older Worker omits them', () => {
    const parsed = SyncInboxSchema.parse(base);
    expect(parsed.classScope).toBeNull();
    expect(parsed.classMoves).toEqual([]);
  });

  it('reads both fields', () => {
    const parsed = SyncInboxSchema.parse({
      ...base,
      classScope: { needed: true, current: CLASS_SCOPE_TEXT_VERSION },
      classMoves: [{ id: 'move:1', to: { spaceId: 'space:b', name: 'Saturday B' }, executedAt: '2026-10-13T00:00:00.000Z' }],
    });
    expect(parsed.classScope).toEqual({ needed: true, current: CLASS_SCOPE_TEXT_VERSION });
    expect(parsed.classMoves).toHaveLength(1);
  });

  it('never fails the inbox on a malformed value: plans, memberships and tier survive', () => {
    const parsed = SyncInboxSchema.parse({ ...base, tier: 'premium', classScope: { needed: 'yes' }, classMoves: [{ id: 3 }, 'x', { id: 'move:2', to: { spaceId: 'space:c', name: 'C' }, executedAt: 'now' }] });
    expect(parsed.tier).toBe('premium');
    expect(parsed.classScope).toBeNull();
    expect(parsed.classMoves.map((m) => m.id)).toEqual(['move:2']);
    expect(SyncInboxSchema.parse({ ...base, classMoves: 'nope' }).classMoves).toEqual([]);
  });
});
