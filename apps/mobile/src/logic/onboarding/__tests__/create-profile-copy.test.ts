import { describe, expect, it } from 'vitest';
import { LEARNER_LEVELS } from '@hangul-route/content-schema';
import { en, retiredDataPromises } from '@hangul-route/i18n';
import { CREATE_PROFILE_COPY, readyLine, whoCopy } from '../create-profile-copy';

const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : value && typeof value === 'object'
      ? Object.values(value).flatMap(strings)
      : [];

describe('create-profile copy (F-LEARN-001 §3.2, §3.3)', () => {
  it('asks the two questions the spec names, with no preselected answer text', () => {
    expect(CREATE_PROFILE_COPY.title).toBe('Who is learning?');
    expect(CREATE_PROFILE_COPY.who.self).toEqual({ label: 'Me', sub: "I'm 13 or older" });
    expect(CREATE_PROFILE_COPY.who.child).toEqual({ label: 'My child or a student', sub: 'A grown-up sets it up' });
  });

  it('switches the wording of the name and level questions by who is learning', () => {
    expect(whoCopy('self')).toMatchObject({ nameLabel: 'Your name', levelHeading: 'How do you like to learn?' });
    expect(whoCopy('child')).toMatchObject({ nameLabel: 'Their name', levelHeading: 'How do they like to learn?' });
  });

  it('is plain: never an age, never "kids", never shame words', () => {
    const all = strings(CREATE_PROFILE_COPY).concat(strings(whoCopy('self')), strings(whoCopy('child')));
    for (const s of all) {
      expect(s).not.toMatch(/\bage[ds]?\b|\bkids?\b|how old|5.7|8.9|10.11|failed|missed|overdue|incomplete/i);
      expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it('keeps the ready line honest about sync: the app backs up every learner, with no sign-in (F-SYNC-002)', () => {
    // It used to say nothing leaves the device, then that sync was optional. With no sign-in, the app sends the
    // name, level and cub the first time it saves the learner, then backs up the progress on start and after each change.
    expect(CREATE_PROFILE_COPY.ready.line).toBe('Your name and choices are saved on this device and backed up to our servers. No sign-in needed.');
    // The same words as the site's backup sentence (packages/i18n privacy-statements.test.ts).
    expect(en.landing.persona.parents.safe.bullets.backup).toContain('backed up to our servers');
  });

  it('says the backup only on a build that backs up: the device-only line when cloud saving is off', () => {
    expect(readyLine(true)).toBe(CREATE_PROFILE_COPY.ready.line);
    expect(readyLine(false)).toBe('Your name and choices are saved on this device.');
    expect(readyLine(false)).not.toMatch(/backed up|servers|Rescue Code/);
  });

  it('says what the email is for: it stays on the device, and learning and backup work without it', () => {
    // The email is saved on the device only (account-store) and the backup never uses it (#395 review).
    expect(CREATE_PROFILE_COPY.email.caption).toBe('Kept on this device. Learning and backup work without it.');
    const all = strings(CREATE_PROFILE_COPY).concat(strings(whoCopy('self')), strings(whoCopy('child')));
    for (const s of all) expect(s, s).not.toMatch(/\bfor\s+(progress\s+)?backup\b|\breceipts?\b/i);
  });

  it('makes no retired data promise anywhere on the form (stays on the device, sync optional, until you sign in)', () => {
    // The one exception shows only on a build with cloud saving off, where it is true (`readyLine(false)`).
    const deviceOnly = CREATE_PROFILE_COPY.ready.lineDeviceOnly;
    expect(retiredDataPromises(deviceOnly)).toEqual(['progress "saved on the device" with no word of the backup']);
    const all = strings(CREATE_PROFILE_COPY)
      .filter((s) => s !== deviceOnly)
      .concat(strings(whoCopy('self')), strings(whoCopy('child')));
    for (const s of all) expect(retiredDataPromises(s), s).toEqual([]);
    expect(retiredDataPromises('Your name and choices are saved on this device. Sign-in and sync are optional.')).not.toEqual([]);
  });

  it('words the two consent boxes as the spec does, each naming the Privacy Policy', () => {
    expect(CREATE_PROFILE_COPY.guardian.agree).toBe(
      "I'm a parent or guardian of this learner (or I set it up for them) and I agree to the Privacy Policy.",
    );
    expect(CREATE_PROFILE_COPY.self.agree).toBe("I'm 13 or older and I agree to the Privacy Policy.");
    expect(CREATE_PROFILE_COPY.guardian.heading).toBe('For a grown-up');
    expect(CREATE_PROFILE_COPY.self.heading).toBe('Before you start');
  });

  it('uses the level table for the level cards, so labels live in one place', () => {
    expect(LEARNER_LEVELS.map((l) => l.label)).toEqual(['Pictures first', 'Some reading', 'Reads easily']);
    expect(CREATE_PROFILE_COPY.levelHelper).toBe('You can change this any time in Profile.');
  });
});
