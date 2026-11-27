import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { getMessages } from '../resolve';

// AMENDMENTS-PLC-VALIDITY section 3.8 (PV-4): the "Reading and listening" block of the level-check
// report and the per-form words of its Words and Sentences rows. Words of what happened in this
// check; never "behind", "only", "can't", "fail", a number, or a comparison with other learners.

/** Shame, comparison and ranking words, per locale (a grown-up reads these; the check never grades a child). */
const SHAME: Record<UiLocale, RegExp> = {
  en: /\b(behind|only|just|fail\w*|can't|cannot|unable|slow\w*|late|weak\w*|poor|worse|better|than other)\b/i,
  es: /\b(atrasad\w*|retrasad\w*|solo|sólo|solamente|apenas|fall\w*|no puede|no pudo|incapaz|lent\w*|tarde|débil|peor|mejor que)\b/i,
  ko: /(뒤처|못해|못 해|못했|실패|겨우|불과|단지|느린|느려|늦|부족|약해|다른 (아이|학습자))/,
};

describe.each(LOCALES)('caregiver.placementReport skills, listening, formStatus and olderSentences (%s)', (locale) => {
  const r = getMessages(locale).caregiver.placementReport;
  const lines = (): string[] => [
    r.skills.title,
    r.skills.reading,
    r.skills.listening,
    r.skills.notChecked,
    r.skills.ahead('Sam'),
    r.listening.stage1,
    r.listening.stage2,
    r.listening.stage3,
    r.formStatus(r.form.read, r.status.secure),
    r.formStatus(r.form.oral, r.status.gettingThere),
    r.olderSentences,
  ];

  it('has every string, none empty', () => {
    for (const text of lines()) expect(text.trim().length).toBeGreaterThan(0);
  });

  it('carries no banned word of the caregiver surface and no shame or comparison word', () => {
    for (const text of lines()) {
      expect(findBannedWord(text, locale, 'caregiver'), text).toBeNull();
      expect(text, text).not.toMatch(SHAME[locale]);
    }
  });

  it('carries no number and says nothing about the route in the block itself', () => {
    for (const text of [r.skills.ahead('Sam'), r.listening.stage1, r.listening.stage2, r.listening.stage3]) {
      expect(text, text).not.toMatch(/\d/);
    }
    // "In this check ... That is common": it speaks of this check, not of where the route starts.
    expect(r.skills.ahead('Sam')).not.toMatch(/route|ruta|루트/i);
  });

  it('names the learner and puts the form before its status word', () => {
    expect(r.skills.ahead('Sam')).toContain('Sam');
    expect(r.formStatus('A', 'B')).toBe('A: B');
  });
});

describe('caregiver.placementReport skills in English (the spec table, section 3.8 item 4)', () => {
  const r = getMessages('en').caregiver.placementReport;

  it('is the wording of the spec', () => {
    expect(r.skills).toMatchObject({ title: 'Reading and listening', reading: 'Reading', listening: 'Listening', notChecked: 'not checked' });
    expect(r.skills.ahead('Sam')).toBe('In this check, Sam understood more Korean than Sam could read. That is common.');
    expect(r.listening).toEqual({
      stage1: 'Everyday words: new for now',
      stage2: 'Knew most of the everyday words we said',
      stage3: 'Understood the short sentences we said',
    });
    expect(r.formStatus(r.form.oral, r.status.secure)).toBe('listening: secure');
    expect(r.olderSentences).toBe(
      'An earlier version of the check asked easier sentence questions. If Stage 3 feels hard, choose a different start.',
    );
  });
});
