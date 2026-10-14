import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * F-LEARN-001 §3.15.2: the question "Who is learning?" names no age, in any locale. The "13 or older"
 * statement lives only on the Privacy step; step 1 says who sets the profile up, and that the answer
 * does not change the lessons. The e2e checks the English screen; this pins the Spanish and Korean
 * values too, so a translation cannot bring an age back to step 1 or to the edit screen's who row.
 */
const AGE: Record<'en' | 'es' | 'ko', RegExp> = {
  en: /\d|\bages?\b|how old|\bolder\b|\byears?\b/i,
  es: /\d|\bedad(es)?\b|\baños?\b|mayor de|menor de/i,
  ko: /\d|나이|세\s*(이상|미만)|살\b|연령/,
};

describe('step 1 and the edit who row name no age', () => {
  for (const locale of ['en', 'es', 'ko'] as const) {
    it(locale, () => {
      const m = getMessages(locale).learner;
      const c = m.createProfile;
      const e = m.editProfile;
      const lines = [
        c.title,
        c.who.self.label,
        c.who.self.sub,
        c.who.child.label,
        c.who.child.sub,
        c.who.latched,
        c.lessons.withCheck,
        c.lessons.plain,
        e.who.heading,
        e.who.self.label,
        e.who.self.sub,
        e.who.child.label,
        e.who.child.sub,
        e.who.lessons,
      ];
      for (const line of lines) expect(line, `${locale}: "${line}"`).not.toMatch(AGE[locale]);
    });
  }

  it('the age statement is on the Privacy step, where it belongs', () => {
    expect(getMessages('en').learner.createProfile.self.agree).toMatch(/13 or older/);
    expect(getMessages('es').learner.createProfile.privacy.under13).toMatch(/13/);
    expect(getMessages('ko').learner.createProfile.privacy.under13).toMatch(/13세/);
  });
});
