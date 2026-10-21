import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-9, section 17.3: face or fingerprint for grown-ups (native only) and
// the no-PIN hint of the lock and face or fingerprint switches (section 8.2). es and ko follow the F-I18N-001 section
// 3.10 style guide and glossary (grown-up: adultos / 어른; Escribe el PIN / PIN을 입력해요, as the pad's own lines).

const LOCALES = ['en', 'es', 'ko'] as const;

describe('caregiver.pin OA-9 keys', () => {
  it('English is the spec text', () => {
    const m = getMessages('en').caregiver.pin;
    expect(m.biometric.cta).toBe('Use face or fingerprint');
    expect(m.biometric.toggle).toBe('Face or fingerprint for grown-ups');
    expect(m.biometric.warning).toBe('Anyone whose face or fingerprint is saved on this device can use it.');
    expect(m.biometric.changed).toBe('Face or fingerprint changed on this device. Enter the PIN.');
    expect(m.needsPinFirst).toBe('Set a grown-up PIN first.');
  });

  it('Spanish and Korean are the section 17.3 values', () => {
    const es = getMessages('es').caregiver.pin;
    const ko = getMessages('ko').caregiver.pin;
    expect(es.biometric).toEqual({
      cta: 'Usar rostro o huella',
      toggle: 'Rostro o huella para adultos',
      warning: 'Cualquier persona con su rostro o huella guardados en este dispositivo podrá usarlo.',
      changed: 'El rostro o la huella cambió en este dispositivo. Escribe el PIN.',
    });
    expect(es.needsPinFirst).toBe('Primero crea un PIN de adultos.');
    expect(ko.biometric).toEqual({
      cta: '얼굴이나 지문 쓰기',
      toggle: '어른용 얼굴·지문 열기',
      warning: '이 기기에 얼굴이나 지문이 저장된 사람은 누구나 쓸 수 있어요.',
      changed: '이 기기의 얼굴이나 지문이 바뀌었어요. PIN을 입력해요.',
    });
    expect(ko.needsPinFirst).toBe('먼저 어른용 PIN을 만들어요.');
  });

  it('the changed line asks for the PIN in the words the pad already uses', () => {
    expect(getMessages('es').caregiver.pin.entry.verifySubtitle).toContain('Escribe');
    expect(getMessages('es').caregiver.pin.biometric.changed).toContain('Escribe el PIN');
    expect(getMessages('ko').caregiver.pin.biometric.changed).toContain('PIN을 입력');
  });

  it('passes the caregiver ban list, never says failed or blames, names no age and no child', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).caregiver.pin;
      for (const s of [m.biometric.cta, m.biometric.toggle, m.biometric.warning, m.biometric.changed, m.needsPinFirst]) {
        expect(findBannedWord(s, locale, 'caregiver'), `${locale}: ${s}`).toBeNull();
        expect(s).not.toMatch(/fail|fall[oó]|error|wrong|실패|오류|틀렸|\bkids?\b|\bchild(ren)?\b|niñ|아이|\bage\b|edad|나이/i);
        if (locale === 'en') for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), name).toBe(false);
      }
    }
  });
});
