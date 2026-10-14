import { TEACHER_VISIBLE_ITEM_IDS, TRANSFER_CONSENT_TEXT, TRANSFER_CONSENT_TEXT_VERSION, type InboxTransfer } from '@hangul-route/content-schema';
import { LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  consentLines,
  deviceConsentRecord,
  identityLines,
  readToEndOpen,
  sheetDataFromPreview,
  sheetDataFromRequest,
  sheetLocaleOf,
  type ConsentSheetData,
} from '../consent-sheet';

/*
 * The app consent sheet's text — F-SPACE-002 section 4.11, T-7c (`design/screens/transfer/app-sheets.md`,
 * `consent-sheet.md` app column). The same keyed lines as the console, in the same order; only the frame
 * differs (the self audience reads "Move to {Destination}?" and "Yes, move me").
 */

const data = (over: Partial<ConsentSheetData> = {}): ConsentSheetData => ({
  learnerName: 'Mina',
  sourceName: 'Sunday Class A',
  destination: { name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: 'Riverside school', ageBucket: 'months', learnerCount: 8 },
  initiator: 'learner_side',
  terms: { premiumChange: 'none', destinationConsentMode: 'parent', relinkAffected: false, sourcePlansAffected: false, visibleToday: [] },
  termsDigest: null,
  ...over,
});

const row = (over: Partial<InboxTransfer> = {}): InboxTransfer => ({
  id: 'transfer:aaaa',
  status: 'requested',
  initiator: 'learner_side',
  from: { spaceId: 'space:a', name: 'Sunday Class A' },
  to: { spaceId: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'weeks', learnerCount: null },
  learnerState: 'pending',
  sourceState: 'waiting',
  destinationState: 'waiting',
  introduce: false,
  premiumChange: 'may_change',
  destinationConsentMode: 'school',
  relinkAffected: true,
  sourcePlansAffected: false,
  visibleToday: [{ kind: 'class', name: 'Sunday Class A', ownerName: 'Mr Han' }],
  blockReason: null,
  executeAfter: null,
  expiresAt: '2026-10-25T12:00:00.000Z',
  learnerRoute: 'device',
  canVeto: true,
  endedFrom: null,
  termsDigest: 'a'.repeat(64),
  ...over,
});

describe('consentLines', () => {
  it('draws the always lines word for word in canonical order, names filled in', () => {
    const lines = consentLines(data(), 'en');
    expect(lines?.map((l) => l.id)).toEqual(['moving', 'new_teacher', 'old_teacher', 'keeps', 'cooling_off', 'visible_list', 'nothing_else', 'visible_today', 'typed_names', 'teacher_moves', 'cannot_undo', 'introduce']);
    expect(lines?.[0]?.text).toBe('Mina would move from Sunday Class A to Saturday Class B.');
    expect(lines?.find((l) => l.id === 'introduce')?.kind).toBe('option');
  });

  it('adds the conditional lines the terms ask for, marked conditional', () => {
    const lines = consentLines(data({ initiator: 'source', terms: { ...data().terms, premiumChange: 'may_change', destinationConsentMode: 'school', relinkAffected: true, sourcePlansAffected: true } }), 'en') ?? [];
    expect(lines.filter((l) => l.conditional).map((l) => l.id)).toEqual(['from_teacher', 'premium_may_change', 'school_delete', 'device_relink', 'homework_drops']);
  });

  it('the visible list is generated from the catalogue; visible_today names each class with its teacher and never claims "(you)"', () => {
    const lines = consentLines(data({ terms: { ...data().terms, visibleToday: [{ kind: 'class', name: 'Sunday Class A', ownerName: 'Mr Han' }, { kind: 'family', name: 'Kim family', ownerName: 'Ji' }, { kind: 'school', name: 'Riverside', ownerName: null }] } }), 'en') ?? [];
    const visible = lines.find((l) => l.id === 'visible_list');
    expect(visible?.kind === 'list' ? visible.items : []).toHaveLength(TEACHER_VISIBLE_ITEM_IDS.length);
    const today = lines.find((l) => l.id === 'visible_today');
    expect(today?.kind === 'list' ? today.items : []).toEqual(['Sunday Class A (teacher Mr Han)', 'Kim family (family, Ji)', 'Riverside']);
  });

  it('renders in every UI locale with the same ids and no placeholder left', () => {
    for (const locale of LOCALES) {
      const lines = consentLines(data(), locale) ?? [];
      expect(lines.map((l) => l.id)).toEqual(consentLines(data(), 'en')?.map((l) => l.id));
      for (const line of lines) expect(line.text, `${locale}.${line.id}`).not.toMatch(/\{[a-z]+\}/);
      expect(lines[0]?.text).toBe(TRANSFER_CONSENT_TEXT[locale].lines.moving.replace('{learner}', 'Mina').replace('{source}', 'Sunday Class A').replace('{destination}', 'Saturday Class B'));
    }
  });

  it('is null for a locale without a consent text', () => {
    expect(consentLines(data(), 'fr' as never)).toBeNull();
  });
});

describe('identityLines', () => {
  it('teacher and school, then age and learner count', () => {
    expect(identityLines(data().destination, 'en')).toEqual(['Teacher: Ms Park · Riverside school', 'A few months old · 8 learners']);
  });

  it('without a count (an older Worker) the age stands alone; an unknown age is left out', () => {
    expect(identityLines({ ownerName: null, schoolName: null, ageBucket: 'weeks', learnerCount: null }, 'en')).toEqual(['A few weeks old']);
    expect(identityLines({ ownerName: 'Ms Park', schoolName: null, ageBucket: 'decades', learnerCount: null }, 'en')).toEqual(['Teacher: Ms Park']);
  });
});

describe('sheet data', () => {
  it('from the device preview: destination facts, narrowed terms and the digest', () => {
    const d = sheetDataFromPreview(
      {
        destination: { id: 'space:b', name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'days', learnerCount: 3 },
        premiumChange: 'may_change',
        destinationConsentMode: 'school',
        relinkAffected: false,
        sourcePlansAffected: true,
        visibleToday: [],
        termsDigest: 'b'.repeat(64),
        blockReason: null,
      },
      { learnerName: 'Mina', sourceName: 'Sunday Class A' },
    );
    expect(d.initiator).toBe('learner_side');
    expect(d.destination).toEqual({ name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: null, ageBucket: 'days', learnerCount: 3 });
    expect(d.terms).toMatchObject({ premiumChange: 'may_change', destinationConsentMode: 'school', sourcePlansAffected: true });
    expect(d.termsDigest).toBe('b'.repeat(64));
  });

  it('from an inbox row; unknown server values read as the quiet defaults', () => {
    const d = sheetDataFromRequest(row({ premiumChange: 'later', destinationConsentMode: 'other', initiator: 'grown_up' }), 'Mina');
    expect(d.initiator).toBe('learner_side');
    expect(d.terms.premiumChange).toBe('none');
    expect(d.terms.destinationConsentMode).toBe('parent');
    expect(d.destination.learnerCount).toBeNull();
    expect(sheetDataFromRequest(row(), 'Mina').terms).toMatchObject({ premiumChange: 'may_change', destinationConsentMode: 'school', relinkAffected: true });
  });
});

describe('deviceConsentRecord', () => {
  it('carries the text version, the sheet locale, the claim and the digest when there is one', () => {
    expect(deviceConsentRecord('ko', 'self', 'c'.repeat(64))).toEqual({ textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'ko', attest: 'self', termsDigest: 'c'.repeat(64) });
    expect(deviceConsentRecord('en', 'grown_up_pin', null)).toEqual({ textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en', attest: 'grown_up_pin' });
  });
});

describe('sheetLocaleOf', () => {
  it('starts in the UI locale when it has a consent text', () => {
    expect(sheetLocaleOf('es')).toBe('es');
    expect(sheetLocaleOf('fr' as never)).toBe('en');
  });
});

describe('readToEndOpen (D2: the primary waits until the end marker has been in view once)', () => {
  it('a sheet shorter than the window starts open', () => {
    expect(readToEndOpen({ markerY: 500, scrollY: 0, viewportHeight: 800 })).toBe(true);
  });

  it('a taller sheet opens only once the marker scrolls into view', () => {
    expect(readToEndOpen({ markerY: 1500, scrollY: 0, viewportHeight: 800 })).toBe(false);
    expect(readToEndOpen({ markerY: 1500, scrollY: 699, viewportHeight: 800 })).toBe(false);
    expect(readToEndOpen({ markerY: 1500, scrollY: 700, viewportHeight: 800 })).toBe(true);
  });

  it('an unmeasured marker or window keeps it closed', () => {
    expect(readToEndOpen({ markerY: null, scrollY: 0, viewportHeight: 800 })).toBe(false);
    expect(readToEndOpen({ markerY: 100, scrollY: 0, viewportHeight: 0 })).toBe(false);
  });
});
