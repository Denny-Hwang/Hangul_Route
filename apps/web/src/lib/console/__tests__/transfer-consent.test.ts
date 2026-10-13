import { readFileSync } from 'node:fs';
import { TEACHER_VISIBLE_ITEM_IDS, TRANSFER_CONSENT_LINE_IDS, TRANSFER_CONSENT_TEXT, TRANSFER_CONSENT_TEXT_VERSION } from '@hangul-route/content-schema';
import { LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { consentLines, consentRecord, identityLines, visibleTodayItem, type ConsentSheetData } from '../transfer-consent';

const data = (over: Partial<ConsentSheetData> = {}): ConsentSheetData => ({
  learnerName: 'Mina',
  sourceName: 'Sunday Class A',
  destination: { name: 'Saturday Class B', ownerName: 'Ms Park', schoolName: 'Riverside school', ageBucket: 'months', learnerCount: 8 },
  initiator: 'learner_side',
  terms: {
    premiumChange: 'none',
    destinationConsentMode: 'parent',
    relinkAffected: false,
    sourcePlansAffected: false,
    visibleToday: [
      { kind: 'class', name: 'Sunday Class A', ownerName: 'Mr Han' },
      { kind: 'family', name: 'Kim family', ownerName: 'Ji' },
      { kind: 'family', name: 'Lee family', ownerName: 'Bo' },
    ],
  },
  familyName: 'Kim family',
  ...over,
});

describe('consentLines (F-SPACE-002 section 4.11, T-6d)', () => {
  it('draws the always lines word for word in the canonical order, names filled in', () => {
    const lines = consentLines(data(), 'en');
    expect(lines?.map((l) => l.id)).toEqual(['moving', 'new_teacher', 'old_teacher', 'keeps', 'cooling_off', 'visible_list', 'nothing_else', 'visible_today', 'typed_names', 'cannot_undo', 'introduce']);
    expect(lines?.[0]?.text).toBe('Mina would move from Sunday Class A to Saturday Class B.');
    expect(lines?.every((l) => !l.conditional)).toBe(true);
    expect(lines?.find((l) => l.id === 'introduce')?.kind).toBe('option');
  });

  it('every conditional line, each marked conditional, in canonical order', () => {
    const lines = consentLines(
      data({ initiator: 'source', terms: { ...data().terms, premiumChange: 'may_change', destinationConsentMode: 'school', relinkAffected: true, sourcePlansAffected: true } }),
      'en',
    );
    expect(lines?.map((l) => l.id)).toEqual([...TRANSFER_CONSENT_LINE_IDS]);
    expect(lines?.filter((l) => l.conditional).map((l) => l.id)).toEqual(['from_teacher', 'premium_may_change', 'school_delete', 'device_relink', 'homework_drops']);
  });

  it('the visible list is every allow-listed item, generated from the catalogue; visible_today is the server list', () => {
    const lines = consentLines(data(), 'en') ?? [];
    const visible = lines.find((l) => l.id === 'visible_list');
    expect(visible?.kind === 'list' ? visible.items : []).toHaveLength(TEACHER_VISIBLE_ITEM_IDS.length);
    expect(visible?.kind === 'list' ? visible.items[0] : '').toBe("Mina's name, picture and level");
    const today = lines.find((l) => l.id === 'visible_today');
    expect(today?.kind === 'list' ? today.items : []).toEqual(['Sunday Class A (teacher Mr Han)', 'Kim family (you)', 'Lee family (family, Bo)']);
  });

  it('visible_today marks "(you)" only when one family has that name: two families named "Our family" both keep their owner', () => {
    const base = data();
    const twin = { ...base, familyName: 'Our family', terms: { ...base.terms, visibleToday: [{ kind: 'family', name: 'Our family', ownerName: 'Ji' }, { kind: 'family', name: 'Our family', ownerName: 'Bo' }] } };
    const today = (consentLines(twin, 'en') ?? []).find((l) => l.id === 'visible_today');
    expect(today?.kind === 'list' ? today.items : []).toEqual(['Our family (family, Ji)', 'Our family (family, Bo)']);
  });

  it('renders in every UI locale with the same ids; never leaves a placeholder', () => {
    for (const locale of LOCALES) {
      const lines = consentLines(data(), locale);
      expect(lines?.map((l) => l.id)).toEqual(consentLines(data(), 'en')?.map((l) => l.id));
      for (const line of lines ?? []) expect(line.text, `${locale}.${line.id}`).not.toMatch(/\{[a-z]+\}/);
      expect(lines?.[0]?.text).toBe(TRANSFER_CONSENT_TEXT[locale].lines.moving.replace('{learner}', 'Mina').replace('{source}', 'Sunday Class A').replace('{destination}', 'Saturday Class B'));
    }
  });

  it('is null for a locale without a consent text', () => {
    expect(consentLines(data(), 'fr' as never)).toBeNull();
  });
});

describe('the frame around the lines', () => {
  it('visibleTodayItem: a class with or without a teacher name, the own family, another family', () => {
    expect(visibleTodayItem({ kind: 'school', name: 'Riverside', ownerName: null }, 'Kim family', 'en')).toBe('Riverside');
    expect(visibleTodayItem({ kind: 'family', name: 'Lee family', ownerName: null }, 'Kim family', 'en')).toBe('Lee family');
    expect(visibleTodayItem({ kind: 'family', name: 'Kim family', ownerName: 'Ji' }, 'Kim family', 'ko')).toBe('Kim family (회원님)');
  });

  it('identityLines: teacher and school, then the age bucket (never a number) and the count', () => {
    expect(identityLines(data().destination, 'en')).toEqual(['Teacher: Ms Park · Riverside school', 'A few months old · 8 learners']);
    expect(identityLines({ ownerName: null, schoolName: null, ageBucket: null, learnerCount: 1 }, 'en')).toEqual(['1 learner']);
    expect(identityLines({ ownerName: 'Ms Park', schoolName: null, ageBucket: 'decades', learnerCount: 2 }, 'es')).toEqual(['Docente: Ms Park', '2 estudiantes']);
  });

  it('consentRecord: the current text version, the sheet locale and the digest when there is one', () => {
    expect(consentRecord('ko', 'a'.repeat(64))).toEqual({ textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'ko', termsDigest: 'a'.repeat(64) });
    expect(consentRecord('en', null)).toEqual({ textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en' });
  });

  it('types no consent sentence and no colour literal', () => {
    const source = readFileSync(new URL('../transfer-consent.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(source).not.toMatch(/would move|stops seeing/);
  });
});
