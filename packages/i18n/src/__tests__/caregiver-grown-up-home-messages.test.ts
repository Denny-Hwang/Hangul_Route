import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

// F-APP-001 A-6, sections 3.9 and 3.15, Appendix A; wireframe parent/grown-up-home-card.md
// Panel D: the PIN screen opened for the grown-up area on a device with no PIN stored. It
// never offers to create a PIN (a child could then open grown-up pages); it sends the grown-up
// to sign in instead. The button carries `cta` so the 28-character budget covers it. A-7 adds
// the dashboard card strings (`title`, `line`, `cta`) to the same object.
const grownUpHome = getMessages('en').caregiver.grownUpHome;

describe('caregiver.grownUpHome (F-APP-001 section 3.9, PIN screen without a PIN)', () => {
  it('has the no-PIN line and the Continue button of Appendix A', () => {
    expect(grownUpHome.noPin).toBe('This device has no grown-up PIN. Sign in on the grown-up page instead.');
    expect(grownUpHome.continue.cta).toBe('Continue');
  });

  it('holds exactly these keys', () => {
    expect(leafPaths(grownUpHome).sort()).toEqual(['continue.cta', 'cta', 'line', 'noPin', 'title']);
  });

  it('passes the caregiver ban list, names no age, no price and no way to make a PIN here', () => {
    for (const path of leafPaths(grownUpHome)) {
      const s = String(lookup(grownUpHome, path));
      expect(findBannedWord(s, 'en', 'caregiver'), `${path}: ${s}`).toBeNull();
      for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), `${path} matches ${name}`).toBe(false);
      expect(s).not.toMatch(/\bkids?\b|\bchild(ren)?\b|\$|premium|create|set (a|up)|new pin/i);
    }
  });
});
