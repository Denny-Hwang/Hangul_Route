import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 17.5 (row OA-3): the console strings of the lock's Use a passkey, the
 * persona-home PIN-owner card and the set-a-PIN card, in English, Spanish and Korean in the same PR. They are what a
 * child might read on a shared computer, so they name nobody, show no number, carry no age and no price.
 */
const en = getMessages('en').console;
const es = getMessages('es').console;
const ko = getMessages('ko').console;

describe('console OA-3 strings (section 17.5)', () => {
  it('English, word for word', () => {
    expect(en.lock.passkey.cta).toBe('Use a passkey');
    expect(en.pinOwner.cta).toBe('Let this account reset the PIN here');
    expect(en.pinOwner.hint).toBe('If the grown-up PIN is forgotten, signing in to this account can set a new one on this device.');
    expect(en.pinOwner.done).toBe('Done. This account can reset the PIN here.');
    expect(en.pinOwner.notNow).toBe('Not now');
    expect(en.pinPrompt.body).toBe('Set a grown-up PIN in the app so only grown-ups open these pages.');
    expect(en.pinPrompt.cta).toBe('Open the app');
  });

  it('Spanish and Korean as section 17.5 gives them (OA-0b length budgets: the shorter es passkey button)', () => {
    expect(es.lock.passkey.cta).toBe('Usar llave de acceso');
    expect(ko.lock.passkey.cta).toBe('패스키 쓰기');
    expect(es.pinOwner.cta).toBe('Permitir que esta cuenta restablezca el PIN aquí');
    expect(ko.pinOwner.cta).toBe('이 계정으로 여기서 PIN을 다시 만들 수 있게 하기');
  });

  it('Not now uses the words of transfer.consent.notNow.cta in every language', () => {
    for (const messages of [en, es, ko]) expect(messages.pinOwner.notNow).toBe(messages.transfer.consent.notNow.cta);
  });

  it('Spanish and Korean have their own value for every key (no English fallback)', () => {
    for (const messages of [es, ko]) {
      const values = [messages.lock.passkey.cta, messages.pinOwner.cta, messages.pinOwner.hint, messages.pinOwner.done, messages.pinOwner.notNow, messages.pinPrompt.body, messages.pinPrompt.cta];
      const english = [en.lock.passkey.cta, en.pinOwner.cta, en.pinOwner.hint, en.pinOwner.done, en.pinOwner.notNow, en.pinPrompt.body, en.pinPrompt.cta];
      values.forEach((value, i) => expect(value).not.toBe(english[i]));
    }
  });

  it('use the glossary: the grown-up PIN is "PIN de adultos" and "어른용 PIN"', () => {
    for (const text of [es.pinOwner.hint, es.pinPrompt.body]) expect(text).toContain('PIN de adultos');
    for (const text of [ko.pinOwner.hint, ko.pinPrompt.body]) expect(text).toContain('어른용 PIN');
  });

  it('Korean is 해요체 and Spanish uses tú (no usted)', () => {
    for (const text of [ko.pinOwner.hint, ko.pinOwner.done, ko.pinPrompt.body]) expect(text).toMatch(/요\.$/);
    for (const text of [es.pinOwner.cta, es.pinOwner.hint, es.pinOwner.done, es.pinPrompt.body]) expect(text).not.toMatch(/\busted\b/i);
  });

  it('pass the caregiver ban list, name no age, no price and nobody', () => {
    const all = [
      ['en', en],
      ['es', es],
      ['ko', ko],
    ] as const;
    for (const [locale, messages] of all) {
      for (const text of [messages.lock.passkey.cta, messages.pinOwner.cta, messages.pinOwner.hint, messages.pinOwner.done, messages.pinOwner.notNow, messages.pinPrompt.body, messages.pinPrompt.cta]) {
        expect(findBannedWord(text, locale, 'caregiver'), text).toBeNull();
        if (locale === 'en') for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(text), `${text} matches ${name}`).toBe(false);
        expect(text).not.toMatch(/\d|\$|@|premium/i);
      }
    }
  });
});
