import { LOCALES, findBannedWord, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import * as audienceCopyModule from '../audience-copy';
import { audienceCopy as audienceCopyFor } from '../audience-copy';
import type { DeviceAudience } from '../profiles/learner-type';

const AUDIENCES: DeviceAudience[] = ['family', 'self'];
const enAudience = getMessages('en').caregiver.audience;
const audienceCopy = (a: DeviceAudience) => audienceCopyFor(a, enAudience);

/** Every string the module can produce for an audience, functions called with sample arguments. */
function allStrings(who: DeviceAudience, locale: (typeof LOCALES)[number] = 'en'): Array<[string, string]> {
  const c = audienceCopyFor(who, getMessages(locale).caregiver.audience);
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(c)) {
    if (typeof value === 'string') out.push([key, value]);
    else if (value === null) continue;
    else if (key === 'gatedA11y') {
      out.push([`${key}(pin)`, c.gatedA11y('Add a profile', true)]);
      out.push([`${key}(no pin)`, c.gatedA11y('Add a profile', false)]);
      out.push([`${key}(detail, pin)`, c.gatedA11y('Save my progress', true, 'rescue code')]);
      out.push([`${key}(detail, no pin)`, c.gatedA11y('Save my progress', false, 'rescue code')]);
    } else if (key === 'journeyLockedA11y') {
      out.push([key, c.journeyLockedA11y('Word')]);
    } else {
      throw new Error(`unhandled copy key ${key}`);
    }
  }
  return out;
}

describe('audienceCopy: neutral strings for both audiences (F-LEARN-001 §3.9)', () => {
  for (const audience of AUDIENCES) {
    describe(audience, () => {
      const c = audienceCopy(audience);

      it('install guide', () => {
        expect(c.installGuideLine).toBe('Add me to your home screen.');
      });
      it('journey lock', () => {
        expect(c.journeyLockedA11y('Word')).toBe('Word: locked. Opens the unlock page.');
      });
      it('home and homework', () => {
        expect(c.homeReviewsIdle).toBe('Reviews picked for you');
        expect(c.homeworkIntro).toBe('Picked by Hoya, your teacher or your family.');
      });
      it('restore', () => {
        expect(c.restorePrompt).toBe('Got a rescue code, an account, or a saved file?');
        expect(c.restoreSignInLabel).toBe('Sign in');
        expect(c.restoreCardsBack).toBe('Your cards come back with your rescue code.');
      });
      it('spaces and join codes', () => {
        expect(c.spacesNoClass).toBe('Not in a class yet. Got a code from a teacher or your family?');
        expect(c.joinCodeFull).toBe("You're already in three classes. Leave one in Settings first.");
        expect(c.joinCodeNotForLearners).toBe("That code isn't for joining as a learner. Ask for a class code.");
      });
      it('paywall', () => {
        expect(c.promoHint).toBe('Have a promo or referral code? Enter it on the web console.');
        expect(c.paywallBuyOnWeb.startsWith('Buy it once on the web console')).toBe(true);
        expect(c.paywallBuyLater.endsWith('you can buy it once on the web console.')).toBe(true);
      });
      it('profile switcher', () => {
        expect(c.profileSwitchHint).toBe('Tap a profile to switch.');
      });
    });
  }
});

describe('audienceCopy: the two audiences differ only where the spec says', () => {
  it('family adds "A grown-up can help." under the install line; self has no second line', () => {
    expect(audienceCopy('family').installGuideHelp).toBe('A grown-up can help.');
    expect(audienceCopy('self').installGuideHelp).toBeNull();
  });

  it('the grown-up zone is a family caregiver surface; the self-only device says "Account & backup"', () => {
    expect(audienceCopy('family').zoneLabel).toBe('Grown-up zone');
    expect(audienceCopy('self').zoneLabel).toBe('Account & backup');
  });

  it('gated controls: family always says (PIN required)', () => {
    const c = audienceCopy('family');
    expect(c.gatedA11y('Add a profile', true)).toBe('Add a profile (PIN required)');
    expect(c.gatedA11y('Add a profile', false)).toBe('Add a profile (PIN required)');
    expect(c.gatedA11y('Save my progress', true, 'rescue code')).toBe('Save my progress (rescue code, PIN required)');
    expect(c.gatedA11y('Save my progress', false, 'rescue code')).toBe('Save my progress (rescue code, PIN required)');
  });

  it('gated controls: a self-only device says (PIN required) only when it has set a PIN', () => {
    const c = audienceCopy('self');
    expect(c.gatedA11y('Add a profile', false)).toBe('Add a profile');
    expect(c.gatedA11y('Save my progress', false, 'rescue code')).toBe('Save my progress (rescue code)');
    expect(c.gatedA11y('Add a profile', true)).toBe('Add a profile (PIN required)');
    expect(c.gatedA11y('Save my progress', true, 'rescue code')).toBe('Save my progress (rescue code, PIN required)');
  });
});

describe('audienceCopy: PIN screen titles by audience (F-LEARN-001 §3.4)', () => {
  it('family keeps the grown-up wording', () => {
    const c = audienceCopy('family');
    expect(c.pinVerifyTitle).toBe('Grown-up zone');
    expect(c.pinCreateTitle).toBe('Create a grown-up PIN');
    expect(c.pinCreateSubtitle).toBe('Pick 4 digits only grown-ups will know. It protects settings and grown-up pages.');
  });

  it('a self-only device says "Settings PIN" and never "grown-up"', () => {
    const c = audienceCopy('self');
    expect(c.pinVerifyTitle).toBe('Settings PIN');
    expect(c.pinCreateTitle).toBe('Create a PIN');
    expect(c.pinCreateSubtitle).toBe('Pick 4 digits to protect settings.');
  });
});

describe('audienceCopy: tone rules', () => {
  it('no string in the self audience says "grown-up"', () => {
    for (const [key, text] of allStrings('self')) {
      expect(text, key).not.toMatch(/grown-?ups?/i);
    }
  });

  it('in the family audience "grown-up" appears only on the caregiver surfaces and the install second line', () => {
    const allowed = new Set(['installGuideHelp', 'zoneLabel', 'pinVerifyTitle', 'pinCreateTitle', 'pinCreateSubtitle']);
    for (const [key, text] of allStrings('family')) {
      if (allowed.has(key)) continue;
      expect(text, key).not.toMatch(/grown-?ups?/i);
    }
  });

  it('banned words never appear', () => {
    for (const audience of AUDIENCES) {
      for (const [key, text] of allStrings(audience)) {
        expect(text, `${audience}.${key}`).not.toMatch(/\b(failed|missed|overdue|incomplete)\b/i);
      }
    }
  });

  it('no string names an age range or says "for kids"', () => {
    for (const audience of AUDIENCES) {
      for (const [key, text] of allStrings(audience)) {
        expect(text, `${audience}.${key}`).not.toMatch(/\bages?\b|for kids|\d+\s*[–-]\s*\d+/i);
      }
    }
  });
});

describe('audienceCopy: words come from the message subtree it is given (F-I18N-001 §3.4 rule 3)', () => {
  it('uses the subtree, not English literals', () => {
    const other = {
      ...enAudience,
      shared: { ...enAudience.shared, homeworkIntro: 'Elegida por Hoya.' },
      self: { ...enAudience.self, zoneLabel: 'Cuenta y copia' },
      gated: (base: string, pinRequired: boolean) => (pinRequired ? `${base} [PIN]` : base),
    };
    expect(audienceCopyFor('self', other).homeworkIntro).toBe('Elegida por Hoya.');
    expect(audienceCopyFor('family', other).homeworkIntro).toBe('Elegida por Hoya.');
    expect(audienceCopyFor('self', other).zoneLabel).toBe('Cuenta y copia');
    expect(audienceCopyFor('family', other).zoneLabel).toBe('Grown-up zone');
    expect(audienceCopyFor('family', other).gatedA11y('Add a profile', false)).toBe('Add a profile [PIN]');
    expect(audienceCopyFor('self', other).gatedA11y('Add a profile', false)).toBe('Add a profile');
    expect(audienceCopyFor('self', other).gatedA11y('Add a profile', true)).toBe('Add a profile [PIN]');
  });

  for (const locale of LOCALES) {
    it(`${locale}: no banned word reaches either audience`, () => {
      for (const who of AUDIENCES) {
        for (const [key, text] of allStrings(who, locale)) {
          expect(findBannedWord(text, locale, 'caregiver'), `${locale}.${who}.${key}`).toBeNull();
        }
      }
    });
  }
});

describe('the audience-free lines logic modules use come from the message subtree (F-I18N-001 PR 8b)', () => {
  it('the English-only NEUTRAL_COPY alias is gone: join-code and restore take caregiver.audience.shared as a parameter', () => {
    expect('NEUTRAL_COPY' in audienceCopyModule).toBe(false);
  });

  it('both audiences share those lines', () => {
    for (const audience of AUDIENCES) {
      const c = audienceCopy(audience);
      expect(c.joinCodeFull).toBe(enAudience.shared.joinCodeFull);
      expect(c.joinCodeNotForLearners).toBe(enAudience.shared.joinCodeNotForLearners);
      expect(c.promoHint).toBe(enAudience.shared.promoHint);
      expect(c.restoreCardsBack).toBe(enAudience.shared.restoreCardsBack);
    }
  });
});
