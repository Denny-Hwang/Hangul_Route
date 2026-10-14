import { describe, expect, it } from 'vitest';
import { LEARNER_LEVELS } from '@hangul-route/content-schema';
import { en, getMessages, retiredDataPromises } from '@hangul-route/i18n';
import { lessonsLine, readyLine, whoCopy } from '../create-profile-copy';

/** The form's words now live in the dictionary (F-LEARN-001 §3.15.7); these guards read them there. */
const c = getMessages('en').learner.createProfile;

const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : value && typeof value === 'object'
      ? Object.values(value).flatMap(strings)
      : [];

/** Every plain string of the form; `step` is the one function besides the name hints. */
const all = (): string[] => strings(c).concat(c.step(1, 3), c.step(2, 2));

describe('create-profile copy (F-LEARN-001 §3.2, §3.3, §3.15)', () => {
  it('asks who is learning by who sets the profile up, with no age (§3.15.2)', () => {
    expect(c.title).toBe('Who is learning?');
    expect(c.who.self).toEqual({ label: 'Me', sub: "I'm setting this up for myself." });
    expect(c.who.child).toEqual({
      label: 'Someone I look after (a child or a student)',
      sub: "I'm a parent, guardian or teacher, setting it up for them.",
    });
    for (const s of strings(c.who).concat(strings(c.lessons), c.title)) expect(s, s).not.toMatch(/\d|\bolder\b|\bunder\b|\bages?\b/i);
  });

  it('says the answer does not change the lessons, naming the level check only when it is on', () => {
    expect(lessonsLine(c, true)).toBe("This doesn't change the lessons. The level check comes next and sets them.");
    expect(lessonsLine(c, false)).toBe("This doesn't change the lessons.");
    expect(c.privacy.lessons).toBe("Agreeing doesn't change the lessons.");
  });

  it('numbers the steps', () => {
    expect(c.step(1, 3)).toBe('Step 1 of 3');
    expect(c.step(2, 2)).toBe('Step 2 of 2');
  });

  it('switches the wording of the profile step by who is learning', () => {
    expect(whoCopy(c, 'self')).toEqual({ title: 'Your profile', nameLabel: 'Your name', levelHeading: 'How do you like to learn?' });
    expect(whoCopy(c, 'child')).toEqual({ title: 'Their profile', nameLabel: 'Their name', levelHeading: 'How do they like to learn?' });
  });

  it('keeps the "13 or older" statement on the Privacy step only, with the under-13 hand-over', () => {
    expect(c.self.agree).toBe("I'm 13 or older and I agree to the Privacy Policy.");
    expect(c.privacy.under13).toBe("I'm under 13");
    expect(c.privacy.switchedNote).toBe('A grown-up finishes this step: they agree and create a PIN. The name and Hoya stay the same.');
    const outside = strings({ ...c, self: { ...c.self, agree: '' }, privacy: { ...c.privacy, under13: '' } });
    for (const s of outside) expect(s, s).not.toMatch(/\b13\b/);
  });

  it('is plain: never "kids", never an age range, never shame words, no emoji', () => {
    for (const s of all()) {
      expect(s, s).not.toMatch(/\bkids?\b|how old|5.7|8.9|10.11|failed|missed|overdue|incomplete/i);
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('keeps the ready line honest about sync: the app backs up every learner, with no sign-in (F-SYNC-002)', () => {
    expect(c.ready.line).toBe('Your name and choices are saved on this device and backed up to our servers. No sign-in needed.');
    // The same words as the site's backup sentence (packages/i18n privacy-statements.test.ts).
    expect(en.landing.persona.parents.safe.bullets.backup).toContain('backed up to our servers');
  });

  it('says the backup only on a build that backs up: the device-only line when cloud saving is off', () => {
    expect(readyLine(c, true)).toBe(c.ready.line);
    expect(readyLine(c, false)).toBe('Your name and choices are saved on this device.');
    expect(readyLine(c, false)).not.toMatch(/backed up|servers|Rescue Code/);
  });

  it('says what the email is for: it stays on the device, and learning and backup work without it', () => {
    expect(c.email.caption).toBe('Kept on this device. Learning and backup work without it.');
    for (const s of all()) expect(s, s).not.toMatch(/\bfor\s+(progress\s+)?backup\b|\breceipts?\b/i);
  });

  it('makes no retired data promise anywhere on the form (stays on the device, sync optional, until you sign in)', () => {
    // The one exception shows only on a build with cloud saving off, where it is true (`readyLine(c, false)`).
    const deviceOnly = c.ready.lineDeviceOnly;
    expect(retiredDataPromises(deviceOnly)).toEqual(['progress "saved on the device" with no word of the backup']);
    for (const s of all().filter((x) => x !== deviceOnly)) expect(retiredDataPromises(s), s).toEqual([]);
  });

  it('words the two consent boxes as the spec does, each naming the Privacy Policy', () => {
    expect(c.guardian.agree).toBe("I'm a parent or guardian of this learner (or I set it up for them) and I agree to the Privacy Policy.");
    expect(c.guardian.heading).toBe('For a grown-up');
    expect(c.self.heading).toBe('Before you start');
    expect(c.privacy.title).toBe('Privacy');
    expect(c.privacyLinkName).toBe('Privacy Policy');
  });

  it('uses the level table for the level cards, so labels live in one place', () => {
    expect(LEARNER_LEVELS.map((l) => l.label)).toEqual(['Pictures first', 'Some reading', 'Reads easily']);
    expect(c.levelHelper).toBe('You can change this any time in Profile.');
  });

  it('has Spanish and Korean for every line of the form, none of them the English', () => {
    for (const locale of ['es', 'ko'] as const) {
      const t = getMessages(locale).learner.createProfile;
      expect(t.who.child.label).not.toBe(c.who.child.label);
      expect(t.privacy.under13).not.toBe(c.privacy.under13);
      expect(t.lessons.withCheck).not.toBe(c.lessons.withCheck);
      expect(t.step(1, 3)).not.toBe(c.step(1, 3));
    }
  });
});
