import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS sections 3.5, 3.6 and 3.8, row DP-1d: the grown-up's way out of a damaged profile
 * list. The screen's ghost button (`learner.progressReadFailed.grownUpHelp`) and the RecoverRecord sheet behind the
 * grown-up gate. The spec's `grownUp.recoverRecord.*` keys live in `caregiver.recoverRecord` (owner item O1, confirmed
 * 2026-11-23); the sheet's second line (`comeBack`) says how learners come back after Start fresh (owner item O2,
 * 2026-11-23). Calm, adult wording: nothing is erased at that moment, so no "delete", no "lost", no warning words.
 * es and ko follow the F-I18N-001 section 3.10 glossary (rescue code: código de rescate / 복구 코드; Not now in Korean:
 * 지금은 안 함, the declining form the transfer consent uses, so the safe choice never reads as "later, then yes").
 */
const LOCALES = ['en', 'es', 'ko'] as const;
const SHEET_KEYS = ['title', 'body', 'comeBack', 'fresh', 'notNow'] as const;

describe('the grown-up way out of a damaged list (DP-1d)', () => {
  it('English is the spec text (section 3.8), with the O2 line', () => {
    const m = getMessages('en');
    expect(m.learner.progressReadFailed.grownUpHelp).toBe('A grown-up can help');
    expect(m.caregiver.recoverRecord).toEqual({
      title: 'This record is damaged.',
      body: 'We kept a copy of it on this device.',
      comeBack: 'After this, learners come back only with their Rescue Code or a saved file.',
      fresh: 'Start fresh on this device',
      notNow: 'Not now',
    });
  });

  it('Spanish and Korean carry their own reviewed values', () => {
    const es = getMessages('es');
    expect(es.learner.progressReadFailed.grownUpHelp).toBe('Un adulto puede ayudar');
    expect(es.caregiver.recoverRecord).toEqual({
      title: 'Este registro está dañado.',
      body: 'Guardamos una copia en este dispositivo.',
      comeBack: 'Después de esto, los estudiantes solo podrán volver con su código de rescate o un archivo guardado.',
      fresh: 'Empezar de cero en este dispositivo',
      notNow: 'Ahora no',
    });
    const ko = getMessages('ko');
    expect(ko.learner.progressReadFailed.grownUpHelp).toBe('어른이 도와줄 수 있어요');
    expect(ko.caregiver.recoverRecord).toEqual({
      title: '이 기록이 손상됐어요.',
      body: '이 기기에 사본을 보관해 두었어요.',
      comeBack: '이후에는 학습자가 복구 코드나 저장한 파일로만 다시 돌아올 수 있어요.',
      fresh: '이 기기에서 처음부터 시작하기',
      notNow: '지금은 안 함',
    });
  });

  it('the same Not now as the transfer consent sheet, in every locale', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).caregiver;
      expect(m.recoverRecord.notNow, locale).toBe(m.transfer.actions.notNow.cta);
    }
  });

  it('the O2 line names the Rescue Code with the glossary word', () => {
    expect(getMessages('en').caregiver.recoverRecord.comeBack).toContain('Rescue Code');
    expect(getMessages('es').caregiver.recoverRecord.comeBack).toContain('código de rescate');
    expect(getMessages('ko').caregiver.recoverRecord.comeBack).toContain('복구 코드');
  });

  it('no banned word, no kids-only framing, and no word that something was lost or erased', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale);
      expect(findBannedWord(m.learner.progressReadFailed.grownUpHelp, locale, 'learner'), locale).toBeNull();
      for (const key of SHEET_KEYS) {
        const text = m.caregiver.recoverRecord[key];
        expect(text.trim(), `${locale}.${key}`).not.toBe('');
        expect(findBannedWord(text, locale, 'caregiver'), `${locale}.${key}`).toBeNull();
        for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(text), `${locale}.${key}: ${name}`).toBe(false);
        expect(text, `${locale}.${key}`).not.toMatch(/delet|eras|lost|borr|perd|삭제|지워|잃/i);
      }
    }
  });
});
