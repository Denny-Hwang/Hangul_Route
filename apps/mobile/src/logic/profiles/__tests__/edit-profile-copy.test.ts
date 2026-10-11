import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { CREATE_PROFILE_COPY } from '../../onboarding/create-profile-copy';

/**
 * The Edit screen repeats the create form's consent and "Who is learning?"
 * wording (F-LEARN-001 §3.11 reuses the §3.3 cards). Until F-I18N-001 moves
 * the create copy into the catalog the two live apart, so this keeps them equal.
 */
describe('edit-profile copy matches the create form (§3.3, §3.11)', () => {
  const e = getMessages('en').learner.editProfile;

  it('"Who is learning?" reads the same', () => {
    expect(e.who.heading).toBe(CREATE_PROFILE_COPY.title);
    expect(e.who.self).toEqual(CREATE_PROFILE_COPY.who.self);
    expect(e.who.child).toEqual(CREATE_PROFILE_COPY.who.child);
  });

  it('the consent lines and the grown-up card read the same', () => {
    expect(e.self.agree).toBe(CREATE_PROFILE_COPY.self.agree);
    expect(e.guardian).toEqual({
      heading: CREATE_PROFILE_COPY.guardian.heading,
      body: CREATE_PROFILE_COPY.guardian.body,
      pinHeading: CREATE_PROFILE_COPY.guardian.pinHeading,
      agree: CREATE_PROFILE_COPY.guardian.agree,
    });
    expect(e.privacyLink).toBe(CREATE_PROFILE_COPY.privacyLink);
    expect(e.avatarHeading).toBe(CREATE_PROFILE_COPY.avatarHeading);
  });
});
