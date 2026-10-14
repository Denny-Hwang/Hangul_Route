import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';

/**
 * The Edit screen repeats the create form's consent and "Who is learning?"
 * wording (F-LEARN-001 §3.11 reuses the §3.3 cards, §3.15.6 the step split).
 * Both live in the dictionary under separate keys; this keeps them equal in
 * every locale.
 */
describe.each(['en', 'es', 'ko'] as const)('edit-profile copy matches the create form (%s)', (locale) => {
  const m = getMessages(locale).learner;
  const e = m.editProfile;
  const c = m.createProfile;

  it('"Who is learning?" reads the same', () => {
    expect(e.who.heading).toBe(c.title);
    expect(e.who.self).toEqual(c.who.self);
    expect(e.who.child).toEqual(c.who.child);
  });

  it('the consent lines, the Privacy block and the grown-up card read the same', () => {
    expect(e.self.agree).toBe(c.self.agree);
    expect(e.guardian).toEqual(c.guardian);
    expect(e.privacyLink).toBe(c.privacyLink);
    expect(e.privacyFallback).toBe(c.privacyFallback);
    expect(e.avatarHeading).toBe(c.avatarHeading);
    expect(e.privacy.heading).toBe(c.privacy.title);
    expect(e.privacy.lessons).toBe(c.privacy.lessons);
    expect(e.privacy.under13).toBe(c.privacy.under13);
  });
});

describe('edit-profile copy (§3.15.6)', () => {
  it('says the who row does not change the lessons, and what "I\'m under 13" keeps', () => {
    const e = getMessages('en').learner.editProfile;
    expect(e.who.lessons).toBe("This doesn't change the lessons.");
    expect(e.privacy.kept).toBe('This profile stays with a grown-up.');
  });
});
