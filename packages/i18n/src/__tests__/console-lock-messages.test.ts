import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

// F-APP-001 A-4a, section 3.15 and Appendix A: the grown-up lock (`GrownUpLock`,
// wireframe shell/grown-up-lock.md). It is the screen a child would meet on a shared
// device, so it names nobody and shows no number; the three buttons carry `cta` so
// the 28-character budget covers them.
const lock = getMessages('en').console.lock;

describe('console.lock (F-APP-001 section 3.9 lock screen)', () => {
  it('has the title, the default line and the three buttons', () => {
    expect(lock.title).toBe('Grown-ups only');
    expect(lock.line).toBe("Enter this device's grown-up PIN, or sign in again.");
    expect(lock.usePin.cta).toBe('Use the grown-up PIN');
    expect(lock.signInAgain.cta).toBe('Sign in again');
    expect(lock.backToLearning.cta).toBe('Back to learning');
  });

  it('has one line per sign-in-only case of the decision table', () => {
    expect(lock.pinChanged).toBe('The grown-up PIN changed on this device. Sign in again to use it.');
    expect(lock.firstSignIn).toBe('Sign in once on this device to use the grown-up PIN here.');
    expect(lock.noPin).toBe('Set a grown-up PIN in the app, or sign in again.');
  });

  it('holds exactly these keys', () => {
    expect(leafPaths(lock).sort()).toEqual(
      ['title', 'line', 'usePin.cta', 'signInAgain.cta', 'backToLearning.cta', 'pinChanged', 'firstSignIn', 'noPin'].sort(),
    );
  });

  it('passes the caregiver ban list, names no age and no price, and has no countdown wording', () => {
    for (const path of leafPaths(lock)) {
      const text = lookup(lock, path);
      expect(typeof text).toBe('string');
      const s = String(text);
      expect(findBannedWord(s, 'en', 'caregiver'), `${path}: ${s}`).toBeNull();
      for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), `${path} matches ${name}`).toBe(false);
      expect(s).not.toMatch(/\bkids?\b|\bchild(ren)?\b|\$|premium|minute|second/i);
    }
  });
});
