import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

// F-APP-001 A-7, sections 3.6 and 3.15, Appendix A; design/screens/app-shell/learner-entry.md
// (D9, D10, D11): the learner app's entries to the grown-up area. The Welcome row and the Profile
// row sit on shared surfaces (any age, never "kids"); the dashboard card is behind the gate. The
// line names only what exists today (family, classes, billing), never reports or notes, and no
// string names a price or "Premium".
const en = getMessages('en');
const welcome = en.learner.welcome.grownUps;
const profileRow = en.learner.profile.grownUpHome;
const card = en.caregiver.grownUpHome;

function strings(tree: object): Array<{ path: string; text: string }> {
  return leafPaths(tree).map((path) => ({ path, text: String(lookup(tree, path)) }));
}

describe('learner.welcome.grownUps (Welcome persona row, Panels A to C)', () => {
  it('has the Appendix A wording; the Welcome button says "Parent or caregiver" (OD-14)', () => {
    expect(welcome).toEqual({
      lead: 'Here to support a learner?',
      parent: 'Parent or caregiver',
      teacher: 'Teacher',
      continueParent: 'Continue as family',
      continueTeacher: 'Continue as teacher',
      someoneElse: 'Someone else',
      needsInternet: 'Needs the internet',
    });
  });
});

describe('learner.profile.grownUpHome (Profile row, D9 and D11)', () => {
  it('has the row title, its line and the self-only title', () => {
    expect(profileRow).toEqual({
      title: 'Grown-up home',
      line: 'Your family, classes and billing',
      selfTitle: 'Account home',
    });
  });
});

describe('caregiver.grownUpHome (dashboard card and the PIN screen without a PIN)', () => {
  it('adds the sign-in row to the A-6 keys (owner request 2026-10-16, item 8: was a card with Open)', () => {
    expect(card.signIn).toEqual({ family: 'Sign in for family and class tools', self: 'Sign in to your account' });
    expect(leafPaths(card).sort()).toEqual(['continue.cta', 'noPin', 'signIn.family', 'signIn.self']);
  });
});

describe('every A-7 entry string', () => {
  const all = [
    ...strings(welcome).map((s) => ({ ...s, surface: 'learner' as const })),
    ...strings(profileRow).map((s) => ({ ...s, surface: 'learner' as const })),
    ...strings(card).map((s) => ({ ...s, surface: 'caregiver' as const })),
  ];

  it('passes the ban list of its surface and never frames the product as kids-only', () => {
    for (const { path, text, surface } of all) {
      expect(findBannedWord(text, 'en', surface), `${path}: ${text}`).toBeNull();
      for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(text), `${path} matches ${name}`).toBe(false);
      expect(text, path).not.toMatch(/\bkids?\b|\bchild(ren)?\b|\bage[sd]?\b|\byears? old\b/i);
    }
  });

  it('names no price, no plan tier and no feature the learner app cannot see (reports, notes)', () => {
    for (const { path, text } of all) expect(text, path).not.toMatch(/\$|premium|price|reports?\b|notes?\b|free\b/i);
  });

  it('keeps the persona buttons and Open within the 28-character button budget', () => {
    for (const s of [welcome.parent, welcome.teacher, welcome.continueParent, welcome.continueTeacher, welcome.someoneElse]) {
      expect(s.length, s).toBeLessThanOrEqual(28);
    }
  });
});
