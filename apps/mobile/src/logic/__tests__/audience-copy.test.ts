import { describe, expect, it } from 'vitest';
import { NEUTRAL_COPY, audienceCopy } from '../audience-copy';
import type { DeviceAudience } from '../profiles/learner-type';

const AUDIENCES: DeviceAudience[] = ['family', 'self'];

/** Every string the module can produce for an audience, functions called with sample arguments. */
function allStrings(audience: DeviceAudience): Array<[string, string]> {
  const c = audienceCopy(audience);
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

describe('audienceCopy: tone rules', () => {
  it('no string in the self audience says "grown-up"', () => {
    for (const [key, text] of allStrings('self')) {
      expect(text, key).not.toMatch(/grown-?ups?/i);
    }
  });

  it('in the family audience "grown-up" appears only on the caregiver surfaces and the install second line', () => {
    const allowed = new Set(['installGuideHelp', 'zoneLabel']);
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

describe('NEUTRAL_COPY: the audience-free strings used by logic modules', () => {
  it('is what both audiences share', () => {
    for (const audience of AUDIENCES) {
      const c = audienceCopy(audience);
      expect(c.joinCodeFull).toBe(NEUTRAL_COPY.joinCodeFull);
      expect(c.joinCodeNotForLearners).toBe(NEUTRAL_COPY.joinCodeNotForLearners);
      expect(c.promoHint).toBe(NEUTRAL_COPY.promoHint);
      expect(c.restoreCardsBack).toBe(NEUTRAL_COPY.restoreCardsBack);
    }
  });
});
