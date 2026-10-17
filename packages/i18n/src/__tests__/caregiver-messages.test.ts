import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-I18N-001 PR 8a: the grown-up surfaces (PIN, dashboard, paywall, Classes & family,
// Progress backup) and logic/audience-copy.ts move into the dictionary with their English
// wording unchanged (§3.4 rule 1).
const m = getMessages('en');
const c = m.caregiver;

describe('caregiver.audience (the audience-copy block)', () => {
  const a = c.audience;

  it('keeps the strings both audiences share', () => {
    const s = a.shared;
    expect(s.installGuideLine).toBe('Add me to your home screen.');
    expect(s.journeyLockedA11y('Word')).toBe('Word: locked. Opens the unlock page.');
    expect(s.homeReviewsIdle).toBe('Reviews picked for you');
    expect(s.homeworkIntro).toBe('Picked by Hoya, your teacher or your family.');
    expect(s.restorePrompt).toBe('Got a rescue code, an account, or a saved file?');
    expect(s.restoreSignInLabel).toBe('Sign in');
    expect(s.restoreCardsBack).toBe('Your cards come back with your rescue code.');
    expect(s.spacesNoClass).toBe('Not in a class yet. Got a code from a teacher or your family?');
    expect(s.joinCodeFull).toBe("You're already in three classes. Leave one under Classes & family in your Profile first.");
    expect(s.joinCodeNotForLearners).toBe("That code isn't for joining as a learner. Ask for a class code.");
    // F-BILL-002 B-9 (§6.4): the promo hint and the two "buy on the web console" lines are gone with the paywall.
    for (const gone of ['promoHint', 'paywallBuyOnWeb', 'paywallBuyLater']) expect(gone in s, gone).toBe(false);
    expect(s.profileSwitchHint).toBe('Tap a profile to switch.');
  });

  it('keeps the family and self variants', () => {
    expect(a.family).toEqual({
      installGuideHelp: 'A grown-up can help.',
      zoneLabel: 'Grown-up area',
      pinVerifyTitle: 'Grown-up area',
      pinCreateTitle: 'Create a grown-up PIN',
      pinCreateSubtitle: 'Pick 4 digits only grown-ups will know. It protects settings and grown-up pages.',
    });
    expect(a.self).toEqual({
      zoneLabel: 'Account & backup',
      pinVerifyTitle: 'Settings PIN',
      pinCreateTitle: 'Create a PIN',
      pinCreateSubtitle: 'Pick 4 digits to protect settings.',
    });
  });

  it('words a gated control: the base, an optional detail, and "PIN required" when gated', () => {
    expect(a.gated('Add a profile', true)).toBe('Add a profile (PIN required)');
    expect(a.gated('Add a profile', false)).toBe('Add a profile');
    expect(a.gated('Save my progress', true, 'rescue code')).toBe('Save my progress (rescue code, PIN required)');
    expect(a.gated('Save my progress', false, 'rescue code')).toBe('Save my progress (rescue code)');
  });
});

describe('caregiver.pin (entry, set-up field and reset)', () => {
  const p = c.pin;

  it('keeps the PIN screen lines and buttons', () => {
    expect(p.entry.createAgain).toBe('Enter it once more');
    expect(p.entry.verifySubtitle).toBe('Enter your 4-digit PIN to continue.');
    expect(p.entry.createAgainSubtitle).toBe('Type the same 4 digits again.');
    expect(p.mismatch).toBe("Those didn't match. Let's start again.");
    expect(p.entry.unlock.cta).toBe('Unlock');
    expect(p.entry.forgot.cta).toBe('Forgot PIN?');
  });

  it('counts the tries left with plural(), not a suffix ternary', () => {
    expect(p.entry.triesLeft(1)).toBe('Not quite. 1 more try.');
    expect(p.entry.triesLeft(4)).toBe('Not quite. 4 more tries.');
  });

  it('counts the cooldown in seconds', () => {
    expect(p.cooldown(12)).toBe("Let's take a short break. Try again in 12s.");
  });

  it('keeps the set-up field lines', () => {
    expect(p.setup).toEqual({ again: 'Type it again', set: 'PIN set', change: 'Change' });
  });

  it('keeps the Forgot PIN screen', () => {
    const r = p.reset;
    expect(r.title).toBe('Reset the PIN');
    expect(r.subtitle).toBe('Your learners, cards and progress are kept.');
    expect(r.code.heading).toBe('Use a Rescue Code');
    expect(r.code.placeholder).toBe('TIGER-MOON-RIVER-APPLE-482139');
    expect(r.code.formats).toBe('Four words and six digits. Older codes: two words and four digits.');
    expect(r.noCode.cta).toBe("I don't have the code");
    expect(r.wait.heading).toBe('Wait 24 hours');
    expect(r.wait.idle).toEqual({
      caption: 'Your PIN keeps working meanwhile. After 24 hours you can set a new one.',
      button: 'Start the wait',
    });
    expect(r.wait.waiting.caption('Oct 11, 2026, 4:30 PM')).toBe('You can set a new PIN after Oct 11, 2026, 4:30 PM.');
    expect(r.wait.waiting.button).toBe('Wait started');
    expect(r.wait.ready).toEqual({ caption: 'The 24 hours are up.', button: 'Set a new PIN' });
  });

  it('keeps the calm failure lines for a Rescue Code', () => {
    const f = p.reset.failure;
    expect(f.wrongCode).toBe("That isn't the code saved on this device. Check it and try again.");
    expect(f.noCode).toBe('No rescue code is saved on this device. Use the 24-hour wait instead.');
    expect(f.badFormat).toBe(
      'Type every word and the number, like TIGER-MOON-RIVER-APPLE-482139 (older codes: TIGER-MOON-4821).',
    );
  });
});

describe('caregiver dashboard, paywall, spaces and backup', () => {
  it('keeps the dashboard, titled with the one grown-up name (owner request 2026-10-16, item 8)', () => {
    const d = c.dashboard;
    expect('title' in d).toBe(false);
    expect(d.persona).toBe('Parent or caregiver');
    expect(d.aboutRows.cta).toBe('About these rows');
    expect(d.readOnly).toBe('Read-only — learners on this device.');
    expect(d.noProfiles).toBe('No profiles yet.');
    expect(d.stats).toEqual({ quests: 'Quests', cards: 'Cards', sessions: 'Sessions', minutes: 'Minutes' });
    expect(d.recent).toBe('Recent');
    expect(d.privacy.title).toBe('Privacy');
    // The app backs up every learner with no sign-in: the card leads with the backup sentence (privacy-statements.test.ts).
    expect(d.privacy.body).toBe(
      "Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code. When a learner joins a class or family with a code, that space sees the name they join with and their progress. A family's grown-ups can also restore their progress. We do not share with third parties.",
    );
  });

  it('the price-bearing paywall is gone; its two kept lines moved to caregiver.plan (F-BILL-002 B-9, §6.4)', () => {
    expect('paywall' in c).toBe(false);
    expect(c.plan.learnerFallback).toBe('Your learner');
    expect(c.plan.free.open).toBe('Stage 1 is always free.');
  });

  it('keeps Classes & family', () => {
    const s = c.spaces;
    expect(s.title).toBe('Classes & family');
    expect(s.kind).toEqual({ family: 'Family', class: 'Class', school: 'School' });
    expect(s.leave.cta).toBe('Leave');
    expect(s.leave.stay).toBe('Stay');
    expect(s.leave.confirmTitle('Sunday Class A')).toBe('Leave Sunday Class A?');
    expect(s.leave.confirmMessage).toBe('Your cards and stars stay with you. You can join again with the code.');
    expect(s.join.cta).toBe('Join a class');
  });

  it('keeps Progress backup', () => {
    const b = c.backup;
    expect(b.title).toBe('Progress backup');
    expect(b.save.cta).toBe('Save my progress');
    expect(b.save.detail).toBe('rescue code');
    expect(b.file.cta).toBe('Back up to a file');
    expect(b.restore.cta).toBe('Restore from a file');
    expect(b.note).toEqual({
      ready: 'Backup file ready.',
      unavailable: 'Saving files is not available here.',
      failed: "Couldn't make the file. Try again?",
    });
  });
});

describe('accessibility labels of these screens (e2e names are part of the contract)', () => {
  it('are the English labels as shipped', () => {
    expect(m.a11y.pinDigit(7)).toBe('Digit 7');
    expect(m.a11y.pinDelete).toBe('Delete last digit');
    expect(m.a11y.pinDots(2, 4)).toBe('2 of 4 digits entered');
    expect(m.a11y.rescueCode).toBe('Rescue code');
    expect(m.a11y.leaveSpace('Sunday Class A')).toBe('Leave Sunday Class A');
    expect('familyOffer' in m.a11y).toBe(false);
  });

  it('adds "Continue" to the shared buttons', () => {
    expect(m.common.buttons.continue).toBe('Continue');
  });
});

describe('no price is written into a message (F-I18N-001 §3.1: amounts come from PLAN_PRICING + formatUsd)', () => {
  it('has no currency amount in any caregiver string', () => {
    for (const path of leafPaths(c)) {
      const value = lookup(c, path);
      if (typeof value === 'string') expect(value, path).not.toMatch(/[$€£]\s?\d|\d\s?(USD|dollars?)/i);
    }
  });
});

describe('the dictionary is wired', () => {
  it('exposes caregiver next to common, a11y and learner', () => {
    expect(Object.keys(en).sort()).toEqual(['a11y', 'caregiver', 'common', 'console', 'landing', 'learner', 'report']);
  });
});

// en-XA (F-I18N-001 §3.11): every new key, function messages included, survives pseudo-localisation.
describe('en-XA covers the new keys', () => {
  const NEW_A11Y = ['a11y.pinDigit', 'a11y.pinDelete', 'a11y.pinDots', 'a11y.rescueCode', 'a11y.leaveSpace'];
  const paths = leafPaths(m).filter((p) => p.startsWith('caregiver.') || NEW_A11Y.includes(p));
  const pseudo = pseudoLocalize(m);

  it('finds the new leaves', () => {
    expect(paths.length).toBeGreaterThan(90);
  });

  for (const path of paths) {
    it(`${path} is bracketed and at least 40% longer`, () => {
      const value = lookup(pseudo, path);
      const source = lookup(m, path);
      const outputs: Array<[string, string]> = [];
      if (typeof value === 'string' && typeof source === 'string') outputs.push([value, source]);
      else if (typeof value === 'function' && typeof source === 'function') {
        const samples = SAMPLES[path];
        expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
        for (const args of samples ?? []) {
          outputs.push([(value as (...a: unknown[]) => string)(...args), (source as (...a: unknown[]) => string)(...args)]);
        }
      } else throw new Error(`${path} is neither a string nor a function`);
      for (const [out, src] of outputs) {
        expect(out).toBe(pseudoText(src));
        expect(out.startsWith('[') && out.endsWith(']')).toBe(true);
        expect(out.length - 2).toBeGreaterThanOrEqual(Math.ceil(src.length * 1.4));
      }
    });
  }
});

// F-PLC-001 P-8: the placement report, the Choose a different start sheet and the dashboard's
// Starting spot row (section 3.9, wireframe placement/report). Plain words, no price, no plan
// name, no purchase words, never a comparison with other learners.
describe('caregiver.placementReport (F-PLC-001 P-8)', () => {
  const r = c.placementReport;

  it('names the report, the route and the retakes', () => {
    expect(r.takenOn('Oct 9', 'English')).toBe('Checked Oct 9, in English');
    expect(r.whereStarts).toBe('Where the route starts');
    expect(r.changedByGrownUp).toBe('Changed by a grown-up');
    expect(r.takeAgain).toBe('Take the check again');
    expect(r.takeFirst).toBe('Take the level check');
    expect(r.noCheck).toBe('No check taken yet.');
    expect(r.retryHidden).toBe('Try it with the sound guide hidden');
    expect(r.needsStage('Sam', 2)).toBe('Sam is ready for Stage 2. Stage 2 lessons are not included with this account yet.');
    expect(r.noStart('Sam')).toBe('Sam knows everything that is open right now. More is coming.');
    expect(r.examples).toEqual({ known: 'Knows', fresh: 'New for now' });
  });

  it('has the Choose a different start sheet', () => {
    expect(r.chooseStart).toBe('Choose a different start');
    expect(r.sheet).toEqual({
      title: 'Choose a different start',
      help: 'Quests before the one you pick are skipped. It and every quest after it stay on the route.',
      state: { start: 'starts here', done: 'done', placedOut: 'skipped ahead' },
    });
    expect(r.saved).toBe('The start is changed.');
  });

  it('has the dashboard row', () => {
    expect(r.row).toEqual({ label: 'Starting spot', seeCheck: 'See the check' });
  });

  it('has the one skills note (F-ROUTE-001 section 3.12)', () => {
    expect(c.skillsNote).toBe(
      'The level check looks at reading and listening. Writing is practiced with tracing games and is not scored. The rows count finished quests that include these games; a game skipped inside a quest still counts.',
    );
  });

  it('never names a price, a plan, a purchase, Premium or a comparison', () => {
    const texts = [
      r.takenOn('Oct 9', 'English'),
      r.whereStarts,
      r.changedByGrownUp,
      r.takeAgain,
      r.takeFirst,
      r.noCheck,
      r.retryHidden,
      r.needsStage('Sam', 2),
      r.noStart('Sam'),
      r.examples.known,
      r.examples.fresh,
      r.chooseStart,
      r.sheet.title,
      r.sheet.help,
      ...Object.values(r.sheet.state),
      r.saved,
      r.row.label,
      r.row.seeCheck,
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/\$|price|premium|upgrade|buy|purchase|subscri|plan\b|behind|other learners|ahead of|score|test\b/i);
    }
  });
});
