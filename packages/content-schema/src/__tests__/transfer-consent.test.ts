import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_CONSENT_TEXT_VERSIONS,
  InboxNoteSchema,
  ProgressSummarySchema,
  TEACHER_HIDDEN_SUMMARY_KEYS,
  TEACHER_ROSTER_ADDRESS_FIELDS,
  TEACHER_VISIBLE_ITEM_IDS,
  TEACHER_VISIBLE_NOTE_FIELDS,
  TEACHER_VISIBLE_ROSTER_FIELDS,
  TEACHER_VISIBLE_SUMMARY_ITEMS,
  TEACHER_VISIBLE_SUMMARY_KEYS,
  TRANSFER_CONSENT_LINES,
  TRANSFER_CONSENT_LINE_IDS,
  TRANSFER_CONSENT_LOCALES,
  TRANSFER_CONSENT_TEXT,
  TRANSFER_CONSENT_TEXT_VERSION,
  UI_LOCALES,
  isTransferConsentLocale,
  transferConsentLineIds,
  type TeacherVisibleItemId,
  type TransferConsentContext,
  type TransferConsentLocale,
} from '../index';

/**
 * Pinned hash of the consent text per version and locale (F-SPACE-002 §4.11).
 * Editing any wording changes the hash: bump TRANSFER_CONSENT_TEXT_VERSION,
 * keep the old version in ACCEPTED_CONSENT_TEXT_VERSIONS until legal retires
 * it, and pin the new hash here.
 */
const PINNED_HASHES: Record<string, Partial<Record<TransferConsentLocale, string>>> = {
  'transfer-2026-10': {
    en: '3a44196159fde9f7056b2e774b915d2f8be42d626965a05a556300cac031bd3b',
  },
  // F-REPORT-001 RP-W2: the `activity` item names day-by-day practice.
  'transfer-2026-10b': {
    en: '191a3fcf5bb65dcff7ac96c7df77100374d620e1ff990571613833f06e01d0af',
  },
  // F-FEEDBACK-001 section 7.7: the note_replies item, added to the 10b text.
  'transfer-2026-10c': {
    en: 'dd15f08a9f2ada18e81d2ea1b4e81db3fa4cfc8d3456251f0918cf6896de521b',
  },
};

/**
 * The canonical text the hash is taken over. `earlier` rebuilds an earlier
 * version from the current text: items it drops and item wordings it restores,
 * so a test can prove what a bump changed and nothing else.
 */
function canonical(
  locale: TransferConsentLocale,
  earlier: { drop?: readonly TeacherVisibleItemId[]; items?: Partial<Record<TeacherVisibleItemId, string>> } = {},
): string {
  const text = TRANSFER_CONSENT_TEXT[locale];
  const dropped = new Set(earlier.drop ?? []);
  return JSON.stringify({
    lines: TRANSFER_CONSENT_LINES.map((line) => [line.id, line.when, line.kind, text.lines[line.id]]),
    items: TEACHER_VISIBLE_ITEM_IDS.filter((id) => !dropped.has(id)).map((id) => [id, earlier.items?.[id] ?? text.items[id]]),
  });
}

/** The `activity` item before F-REPORT-001 RP-W2 (`transfer-2026-10`). */
const ACTIVITY_BEFORE_RP_W2 = 'When {learner} was last active, minutes this week and days in a row';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const placeholders = (s: string): string[] => [...s.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1] as string).sort();

/** Sentences end at . ! ? or : (a list heading); a placeholder counts as one word. */
function sentenceWordCounts(text: string): number[] {
  return text
    .split(/[.!?:](?:\s|$)/)
    .map((s) => s.replace(/\{[a-z]+\}/g, 'X').trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(/\s+/).length);
}

const allTexts = (locale: TransferConsentLocale): string[] => [
  ...Object.values(TRANSFER_CONSENT_TEXT[locale].lines),
  ...Object.values(TRANSFER_CONSENT_TEXT[locale].items),
];

describe('consent lines (F-SPACE-002 §4.11)', () => {
  it('lists the spec ids once each, in the canonical order', () => {
    expect(TRANSFER_CONSENT_LINES.map((l) => l.id)).toEqual([...TRANSFER_CONSENT_LINE_IDS]);
    expect(TRANSFER_CONSENT_LINE_IDS).toEqual([
      'moving',
      'new_teacher',
      'old_teacher',
      'keeps',
      'cooling_off',
      'visible_list',
      'nothing_else',
      'visible_today',
      'typed_names',
      'from_teacher',
      'premium_may_change',
      'school_delete',
      'device_relink',
      'homework_drops',
      'cannot_undo',
      'introduce',
    ]);
    expect(new Set(TRANSFER_CONSENT_LINE_IDS).size).toBe(TRANSFER_CONSENT_LINE_IDS.length);
  });

  it('marks the conditional lines, the two lists and the one option', () => {
    const when = Object.fromEntries(TRANSFER_CONSENT_LINES.map((l) => [l.id, l.when]));
    expect(when).toMatchObject({
      from_teacher: 'initiator_source',
      premium_may_change: 'premium_may_change',
      school_delete: 'school_consent_mode',
      device_relink: 'relink_affected',
      homework_drops: 'source_plans_affected',
      cannot_undo: 'always',
      old_teacher: 'always',
    });
    const kinds = Object.fromEntries(TRANSFER_CONSENT_LINES.map((l) => [l.id, l.kind]));
    expect(TRANSFER_CONSENT_LINES.filter((l) => l.kind === 'list').map((l) => l.id)).toEqual(['visible_list', 'visible_today']);
    expect(kinds.introduce).toBe('option');
    expect(TRANSFER_CONSENT_LINES.filter((l) => l.when !== 'always')).toHaveLength(5);
  });

  it('keeps the English wording of the spec table', () => {
    const en = TRANSFER_CONSENT_TEXT.en.lines;
    expect(en.moving).toBe('{learner} would move from {source} to {destination}.');
    expect(en.old_teacher).toBe('The teacher of {source} stops seeing {learner} in that class when the move happens, not before.');
    expect(en.cooling_off).toBe('The move happens after 2 days. Anyone in the family can cancel before then.');
    expect(en.nothing_else).toBe('Nothing else from the app is shared with the teacher.');
    expect(en.cannot_undo).toBe("A move can't be undone. {learner} can still leave a class in Profile at any time.");
  });
});

describe('which lines a sheet shows', () => {
  const base: TransferConsentContext = {
    initiator: 'learner_side',
    premiumChange: 'none',
    destinationConsentMode: 'parent',
    relinkAffected: false,
    sourcePlansAffected: false,
  };

  it('shows only the always lines for a plain guardian-started move', () => {
    expect(transferConsentLineIds(base)).toEqual(TRANSFER_CONSENT_LINES.filter((l) => l.when === 'always').map((l) => l.id));
  });

  it('adds each conditional line when its flag is set, keeping the canonical order', () => {
    expect(transferConsentLineIds({ ...base, initiator: 'source' })).toContain('from_teacher');
    expect(transferConsentLineIds({ ...base, premiumChange: 'may_change' })).toContain('premium_may_change');
    expect(transferConsentLineIds({ ...base, destinationConsentMode: 'school' })).toContain('school_delete');
    expect(transferConsentLineIds({ ...base, relinkAffected: true })).toContain('device_relink');
    expect(transferConsentLineIds({ ...base, sourcePlansAffected: true })).toContain('homework_drops');
    const all = transferConsentLineIds({
      initiator: 'source',
      premiumChange: 'may_change',
      destinationConsentMode: 'school',
      relinkAffected: true,
      sourcePlansAffected: true,
    });
    expect(all).toEqual([...TRANSFER_CONSENT_LINE_IDS]);
  });
});

describe('consent text per locale', () => {
  it('exists for English now; ko and es are added (and counsel-reviewed) before the flip', () => {
    expect(TRANSFER_CONSENT_LOCALES).toEqual(['en']);
    for (const locale of TRANSFER_CONSENT_LOCALES) expect(UI_LOCALES).toContain(locale);
  });

  it('narrows a locale to one that has a text', () => {
    expect(isTransferConsentLocale('en')).toBe(true);
    expect(isTransferConsentLocale('ko')).toBe(false);
    expect(isTransferConsentLocale(undefined)).toBe(false);
  });

  it('has every line and item, the same ids and the same placeholders in every locale', () => {
    const reference = TRANSFER_CONSENT_TEXT.en;
    for (const locale of TRANSFER_CONSENT_LOCALES) {
      const text = TRANSFER_CONSENT_TEXT[locale];
      expect(Object.keys(text.lines).sort()).toEqual([...TRANSFER_CONSENT_LINE_IDS].sort());
      expect(Object.keys(text.items).sort()).toEqual([...TEACHER_VISIBLE_ITEM_IDS].sort());
      for (const id of TRANSFER_CONSENT_LINE_IDS) {
        expect(text.lines[id].trim().length, `${locale}.${id}`).toBeGreaterThan(0);
        expect(placeholders(text.lines[id]), `${locale}.${id}`).toEqual(placeholders(reference.lines[id]));
      }
      for (const id of TEACHER_VISIBLE_ITEM_IDS) {
        expect(placeholders(text.items[id]), `${locale}.${id}`).toEqual(placeholders(reference.items[id]));
      }
    }
  });

  it('uses only the three placeholders', () => {
    for (const locale of TRANSFER_CONSENT_LOCALES) {
      for (const text of allTexts(locale)) {
        for (const name of placeholders(text)) expect(['destination', 'learner', 'source']).toContain(name);
      }
    }
  });

  it('keeps English sentences at 16 words or fewer (a placeholder is one word)', () => {
    expect(sentenceWordCounts('{learner} would move. One two: three')).toEqual([3, 2, 1]);
    for (const text of allTexts('en')) {
      for (const count of sentenceWordCounts(text)) expect(count, text).toBeLessThanOrEqual(16);
    }
  });

  it('never says kid or uses a banned caregiver word', () => {
    for (const text of allTexts('en')) {
      expect(text, text).not.toMatch(/\b(kids?|missed|incomplete|failed|overdue|behind|lazy)\b/i);
    }
  });

  it('pins a hash of every locale to the current text version (edit the text, bump the version)', () => {
    const pinned = PINNED_HASHES[TRANSFER_CONSENT_TEXT_VERSION];
    expect(pinned, `no hashes pinned for ${TRANSFER_CONSENT_TEXT_VERSION}`).toBeDefined();
    for (const locale of TRANSFER_CONSENT_LOCALES) {
      expect(sha256(canonical(locale)), `${TRANSFER_CONSENT_TEXT_VERSION}.${locale}`).toBe(pinned?.[locale]);
    }
  });
});

describe('what the new teacher sees is generated from data (TEACHER_VISIBLE_SUMMARY_KEYS)', () => {
  const summaryKeys = Object.keys(ProgressSummarySchema.shape).sort();

  it('allow-lists exactly the spec keys and hides schemaVersion, stage1Anchor, selfRoute, vocab and routeGoal', () => {
    expect([...TEACHER_VISIBLE_SUMMARY_KEYS]).toEqual([
      'lastActiveAt',
      'streakDays',
      'stage1',
      'cardsUnlocked',
      'minutesLast7d',
      'jamoRecognized',
      'needsPractice',
      'placement',
      'planProgress',
      'journey',
      'activity',
    ]);
    // selfRoute: the family space reads it, a class or school never does (F-PLAN-002 section 3.10).
    // vocab: hidden until F-VOC-005 P-4 adds the console line and its consent item.
    // routeGoal: the family space reads it, a class or school never does (Learning Route section 9, LR-W1).
    expect([...TEACHER_HIDDEN_SUMMARY_KEYS]).toEqual(['schemaVersion', 'stage1Anchor', 'selfRoute', 'vocab', 'routeGoal']);
  });

  it('allow-lists summary.activity under the activity item, whose sentence names day-by-day practice (F-REPORT-001 RP-W2)', () => {
    const hidden: readonly string[] = TEACHER_HIDDEN_SUMMARY_KEYS;
    expect(hidden).not.toContain('activity');
    expect(TEACHER_VISIBLE_SUMMARY_ITEMS.activity).toBe('activity');
    expect(TEACHER_VISIBLE_SUMMARY_ITEMS.activity).toBe(TEACHER_VISIBLE_SUMMARY_ITEMS.minutesLast7d);
    expect(TRANSFER_CONSENT_TEXT.en.items.activity).toBe('When {learner} practiced, minutes each day and days in a row');
    expect(sentenceWordCounts(TRANSFER_CONSENT_TEXT.en.items.activity)).toEqual([11]);
    // Per-day quests, cards and letters are named by the items the teacher already sees.
    expect(TRANSFER_CONSENT_TEXT.en.items.quests).toBe('Quests done and how many answers were right');
    expect(TRANSFER_CONSENT_TEXT.en.items.cards_letters).toBe('Cards earned, letters learned and letters that need practice');
  });

  it('bumped the text version for the new sentence and keeps it and the old version accepted (F-REPORT-001 section 3.10)', () => {
    // transfer-2026-10b carried the new sentence; F-FEEDBACK-001 FB-1 then moved the current version on to transfer-2026-10c.
    expect(ACCEPTED_CONSENT_TEXT_VERSIONS).toContain('transfer-2026-10b');
    expect(ACCEPTED_CONSENT_TEXT_VERSIONS).toContain('transfer-2026-10');
    // transfer-2026-10 is transfer-2026-10b with the earlier activity sentence and without note_replies, and nothing else.
    expect(sha256(canonical('en', { drop: ['note_replies'], items: { activity: ACTIVITY_BEFORE_RP_W2 } }))).toBe(PINNED_HASHES['transfer-2026-10']?.en);
  });

  it('classifies every ProgressSummarySchema key exactly once (a new key fails here until classified)', () => {
    const visible: readonly string[] = TEACHER_VISIBLE_SUMMARY_KEYS;
    const hidden: readonly string[] = TEACHER_HIDDEN_SUMMARY_KEYS;
    expect([...visible, ...hidden].sort()).toEqual(summaryKeys);
    expect(visible.filter((k) => hidden.includes(k))).toEqual([]);
  });

  it('maps summary.journey to the quests item, like stage1 (F-ROUTE-001 OD-11)', () => {
    expect(TEACHER_VISIBLE_SUMMARY_ITEMS.journey).toBe('quests');
    expect(TEACHER_VISIBLE_SUMMARY_ITEMS.journey).toBe(TEACHER_VISIBLE_SUMMARY_ITEMS.stage1);
  });

  it('discloses the level check behind journey known counts through the placement item (F-ROUTE-001 R-7a)', () => {
    expect(TEACHER_VISIBLE_SUMMARY_KEYS).toContain('placement');
    expect(TEACHER_VISIBLE_SUMMARY_ITEMS.placement).toBe('level_check');
    expect(TEACHER_VISIBLE_ITEM_IDS).toContain('level_check');
    expect(TRANSFER_CONSENT_TEXT.en.items.level_check).toBe('Level check results');
  });

  it('gives every allow-listed key a consent item, and nothing else', () => {
    expect(Object.keys(TEACHER_VISIBLE_SUMMARY_ITEMS).sort()).toEqual([...TEACHER_VISIBLE_SUMMARY_KEYS].sort());
    for (const item of Object.values(TEACHER_VISIBLE_SUMMARY_ITEMS)) expect(TEACHER_VISIBLE_ITEM_IDS).toContain(item);
  });

  it('maps the non-summary roster fields to consent items', () => {
    expect(TEACHER_VISIBLE_ROSTER_FIELDS).toEqual({
      displayName: 'name_picture_level',
      avatar: 'name_picture_level',
      ageGroup: 'name_picture_level',
      joinedAt: 'sync_time',
      lastActiveAt: 'activity',
      lastSyncedAt: 'sync_time',
    });
  });

  it('classifies the roster row id as an address field: never shown, no consent item (T-1a)', () => {
    expect([...TEACHER_ROSTER_ADDRESS_FIELDS]).toEqual(['id']);
    const shown = new Set(Object.keys(TEACHER_VISIBLE_ROSTER_FIELDS));
    for (const field of TEACHER_ROSTER_ADDRESS_FIELDS) {
      expect(shown.has(field)).toBe(false);
      expect(field).not.toBe('summary');
    }
  });

  it('uses every consent item for at least one field, so the list never shows an empty promise', () => {
    const used = new Set([
      ...Object.values(TEACHER_VISIBLE_SUMMARY_ITEMS),
      ...Object.values(TEACHER_VISIBLE_ROSTER_FIELDS),
      ...Object.values(TEACHER_VISIBLE_NOTE_FIELDS),
    ]);
    expect([...used].sort()).toEqual([...TEACHER_VISIBLE_ITEM_IDS].sort());
    expect(TEACHER_VISIBLE_ITEM_IDS).toEqual([
      'name_picture_level',
      'activity',
      'quests',
      'cards_letters',
      'level_check',
      'plan_progress',
      'sync_time',
      'note_replies',
    ]);
  });
});

describe('what a class sender sees of a note (F-FEEDBACK-001 section 7.7, OD-8)', () => {
  it('adds the note_replies item with the spec text', () => {
    expect(TEACHER_VISIBLE_ITEM_IDS).toContain('note_replies');
    expect(TRANSFER_CONSENT_TEXT.en.items.note_replies).toBe('The answer {learner} picks on a note from the teacher');
  });

  it('maps the reaction only: no readAt, no text, nothing else of the note', () => {
    expect(TEACHER_VISIBLE_NOTE_FIELDS).toEqual({ reaction: 'note_replies' });
    expect(Object.keys(TEACHER_VISIBLE_NOTE_FIELDS)).not.toContain('readAt');
    for (const field of Object.keys(TEACHER_VISIBLE_NOTE_FIELDS)) expect(Object.keys(InboxNoteSchema.shape)).toContain(field);
  });

  it('bumped the consent text version over the RP-W2 text and still accepts a sheet signed before the change', () => {
    expect(TRANSFER_CONSENT_TEXT_VERSION).toBe('transfer-2026-10c');
    expect(ACCEPTED_CONSENT_TEXT_VERSIONS).toContain(TRANSFER_CONSENT_TEXT_VERSION);
    expect(ACCEPTED_CONSENT_TEXT_VERSIONS).toContain('transfer-2026-10b');
    expect(ACCEPTED_CONSENT_TEXT_VERSIONS).toContain('transfer-2026-10');
    // transfer-2026-10c is exactly transfer-2026-10b plus the note_replies item: the RP-W2 sentence is kept.
    expect(sha256(canonical('en', { drop: ['note_replies'] }))).toBe(PINNED_HASHES['transfer-2026-10b']?.en);
    expect(sha256(canonical('en'))).toBe(PINNED_HASHES['transfer-2026-10c']?.en);
  });

  it('pins a hash for the current text that no earlier version shares', () => {
    const current = sha256(canonical('en'));
    for (const [version, hashes] of Object.entries(PINNED_HASHES)) {
      if (version !== TRANSFER_CONSENT_TEXT_VERSION) expect(hashes.en, version).not.toBe(current);
    }
  });

  it('keeps every pinned version accepted, so the accepted list only grows when a later PR bumps the text', () => {
    for (const version of Object.keys(PINNED_HASHES)) expect(ACCEPTED_CONSENT_TEXT_VERSIONS, version).toContain(version);
  });
});
