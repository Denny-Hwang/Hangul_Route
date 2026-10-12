import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

// F-APP-001 A-4b, sections 3.7, 3.15, 3.16, 3.19 and Appendix A; design mock
// design/screens/app-shell/signin.md (Panels A to D). `/signin` is a shared surface a
// child can reach, so no string names an age or says "kids"; buttons carry `cta` so the
// 28-character budget covers them.
const en = getMessages('en');
const s = en.console.signIn;

describe('console.signIn on /signin (F-APP-001 A-4b)', () => {
  it('words the persona intros and the neutral intro (persona hint, its alias as=)', () => {
    expect(s.title).toBe('Grown-ups sign in');
    expect(s.persona.parent.intro).toBe("Sign in to see your family's learning.");
    expect(s.persona.teacher.intro).toBe('Sign in to see your classes.');
    expect(s.neutralIntro).toBe('Sign in to your grown-up account.');
  });

  it('says learners need no account (any-age wording) and offers the way back to learning', () => {
    expect(s.learnersNoAccount).toBe("Learners don't need an account. They start learning right away, or join a class with a code.");
    expect(s.imLearning).toBe("I'm here to learn");
  });

  it('words the adult step of mode=create (OD-13)', () => {
    expect(s.create.link).toBe('New here? Create a grown-up account');
    expect(s.create.lead).toBe('Grown-up accounts are for parents, guardians and teachers.');
    expect(s.create.affirm).toBe('I am a parent, guardian or teacher');
    expect(s.create.continue.cta).toBe('Continue');
    expect(s.create.back.cta).toBe('Back to sign in');
  });

  it('words the router, the error lines and the reverification panel', () => {
    expect(s.router.goNow).toBe('Go now');
    expect(s.unreachable).toBe("Sign-in can't load right now.");
    expect(s.standaloneFinish).toBe('Finish signing in here with an email code');
    expect(s.reverify.title).toBe("Confirm it's you");
    // Names no factor: Clerk may ask for an email code, a password or a passkey.
    expect(s.reverify.line).toBe("This device has learner profiles. Confirm it's you to open grown-up pages.");
    expect(en.a11y.shell.redirecting).toBe('Taking you to your home…');
  });

  it('drops the old sign-in copy (design pass D14): whySignIn, clerkIntro, kidsNoAccount, signIn.backToSite', () => {
    const c = en.console as Record<string, unknown>;
    expect(c.whySignIn).toBeUndefined();
    expect(c.clerkIntro).toBeUndefined();
    expect(c.kidsNoAccount).toBeUndefined();
    expect((s as Record<string, unknown>).backToSite).toBeUndefined();
  });

  it('passes the caregiver ban list and names no age, no "kids", no price', () => {
    const texts = [...leafPaths(s).map((path) => [`console.signIn.${path}`, lookup(s, path)] as const), ['a11y.shell.redirecting', en.a11y.shell.redirecting] as const];
    for (const [path, text] of texts) {
      expect(typeof text, path).toBe('string');
      const line = String(text);
      expect(findBannedWord(line, 'en', 'caregiver'), `${path}: ${line}`).toBeNull();
      for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(line), `${path} matches ${name}`).toBe(false);
      expect(line).not.toMatch(/\bkids?\b|\bchild(ren)?\b|\bages?\s+\d|\$|premium/i);
    }
  });
});
