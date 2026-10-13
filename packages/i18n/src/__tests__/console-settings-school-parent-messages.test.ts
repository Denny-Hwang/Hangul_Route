import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

// F-I18N-001 PR 10c: the space settings page (teach/space/settings) and the school admin view
// (SchoolAdmin, school.ts) read the dictionary. English is the source and must render exactly
// what they hard-coded before (§3.4 rule 1), so every value below is the former literal, byte for
// byte. (The /parent demo's words left with the demo, F-APP-001 A-5b, OD-4.)
const c = getMessages('en').console;

describe('space settings (teach/space/settings/page.tsx)', () => {
  const s = c.settings;

  it('keeps the title, the back link, the error and the archived notice', () => {
    expect(s.title).toBe('Settings');
    expect(s.titleFor('Class A')).toBe('Class A · settings');
    expect(s.back('Class A')).toBe('← Back to Class A');
    expect(s.back(null)).toBe('← Back to the space');
    expect(s.forbidden).toBe("This space isn't yours to manage.");
    // One whole sentence per kind (§3.1): the kind is not glued into "This … is archived".
    expect(s.archived).toEqual({
      family: 'This family is archived — read-only until you unarchive it.',
      class: 'This class is archived — read-only until you unarchive it.',
      school: 'This school is archived — read-only until you unarchive it.',
    });
    expect(s.backToConsole.cta).toBe('Back to console');
  });

  it('keeps the notes after an action', () => {
    expect(s.notes).toEqual({
      codeReady: 'New code ready.',
      codeFailed: "Couldn't make a new code right now.",
      saved: 'Saved.',
      saveFailed: "Didn't save.",
      removed: 'Removed.',
      removeFailed: "Didn't remove.",
      archived: 'Archived.',
      unarchived: 'Unarchived.',
      deleted: 'Deleted everywhere.',
      deleteFailed: "Couldn't delete.",
    });
  });

  it('keeps the join code, consent and privacy sections', () => {
    expect(s.joinCode.title).toBe('Join code');
    expect(s.joinCode.regenerateAsk).toBe('Make a new code?');
    expect(s.joinCode.regenerate.cta).toBe('Regenerate');
    expect(s.joinCode.create.cta).toBe('Create a code');
    expect(s.consent.title).toBe('Consent mode');
    expect(s.consent.parent).toBe('A parent consents (email at join — coming later)');
    expect(s.consent.school).toBe('The school attests for its students');
    expect(s.consent.notYet).toBe('not yet');
    expect(s.privacy.title).toBe('Privacy');
    expect(s.privacy.anonymize).toBe('Anonymize roster');
  });

  it('keeps the grown-ups section; roles are server codes worded here', () => {
    const g = s.grownUps;
    expect(g.label).toBe('Members');
    expect(g.title).toBe('Grown-ups');
    expect(g.role).toEqual({ owner: 'owner', caregiver: 'caregiver', teacher: 'teacher', admin: 'admin', student: 'student' });
    expect(g.roleLine('owner', true)).toBe('owner (you)');
    expect(g.roleLine('teacher', false)).toBe('teacher');
    expect(g.removeAsk('Ms Park', 'Class A')).toBe('Remove Ms Park from Class A?');
    expect(g.remove.cta).toBe('Remove');
    expect(g.invite).toEqual({
      family: 'Invite a co-parent: they sign in and enter the code above.',
      class: 'Co-teachers arrive later.',
      school: 'Invite a teacher: they sign in and enter the code above.',
    });
  });

  it('keeps the learners section', () => {
    const l = s.learners;
    expect(l.label).toBe('Learners');
    expect(l.title).toEqual({ family: 'Family learners', class: 'Class students', school: 'School members' });
    expect(l.none).toBe('No one has joined yet — share the code.');
    expect(l.removeAsk('Mina', 'Class A')).toBe('Remove Mina from Class A? Their progress stays with them.');
    expect(l.remove.family.cta).toBe('Remove from family');
    expect(l.remove.class.cta).toBe('Remove from class');
    expect(l.remove.school.cta).toBe('Remove from school');
  });

  it('keeps the danger zone', () => {
    const d = s.danger;
    expect(d.title).toBe('Danger zone');
    expect(d.archiveAsk('Class A')).toBe('Archive Class A?');
    expect(d.archive.family.cta).toBe('Archive this family');
    expect(d.archive.class.cta).toBe('Archive this class');
    expect(d.archive.school.cta).toBe('Archive this school');
    expect(d.unarchive.cta).toBe('Unarchive');
    expect(d.deleteTitle).toBe("Delete a learner's data");
    expect(d.deleteLabel).toBe('Learner to delete');
    expect(d.chooseLearner).toBe('Choose a learner…');
    expect(d.typeToConfirm('Mina')).toBe('Type "Mina" to confirm');
    // Holds a learner's name, so it is not a budgeted `cta`; the button wraps.
    expect(d.deleteData('Mina')).toBe("Delete Mina's data");
  });
});

describe('school admin (SchoolAdmin.tsx, school.ts)', () => {
  const s = c.school;

  it('keeps the title, the error, the billing link and the notes', () => {
    expect(s.title).toBe('School');
    expect(s.titleFor('Seoul school')).toBe('Seoul school · school');
    expect(s.forbidden).toBe("This school isn't yours to manage.");
    expect(s.billingLink).toBe('Billing');
    expect(s.notes).toEqual({
      codeReady: 'New invite code ready.',
      codeFailed: "Couldn't make a new code.",
      assigned: 'Teacher assigned.',
      assignFailed: "Couldn't assign — have they joined the school?",
      classCreated: 'Class created — assign a teacher when they have joined.',
      createFailed: "Couldn't create the class.",
    });
  });

  it('keeps the licence and seats section (school.ts usageLine)', () => {
    const l = s.licence;
    expect(l.label).toBe('Licence and seats');
    expect(l.title).toBe('Licence');
    expect(l.line('Group License', 'active')).toBe('Group License · active');
    expect(l.none).toBe('none');
    expect(l.seats).toBe('Seats');
    expect(l.usage(38, 300, 4, 10)).toBe('students 38 / 300 · teachers 4 / 10');
    expect(l.usage(38, null, 4, null)).toBe('students 38 · teachers 4');
    expect(l.usage(38, 300, 4, null)).toBe('students 38 / 300 · teachers 4');
    expect(l.usage(38, null, 4, 10)).toBe('students 38 · teachers 4 / 10');
    expect(l.manage.cta).toBe('Manage billing');
  });

  it('keeps the invite section', () => {
    const i = s.invite;
    expect(i.title).toBe('Invite a teacher');
    expect(i.role('expires in 3 days')).toBe('role: teacher · expires in 3 days');
    expect(i.regenerateAsk).toBe('Make a new invite code?');
    expect(i.regenerate.cta).toBe('Regenerate');
    expect(i.create.cta).toBe('Create a code');
  });

  it('keeps the week line (school.ts weekLine)', () => {
    expect(s.week.label).toBe('This week');
    expect(s.week.title).toBe('This week (whole school)');
    expect(s.week.line(31, 38, 3, 4)).toBe('31 of 38 students practiced · 3 of 4 classes have a published plan');
  });

  it('keeps the class list and the new-class form', () => {
    const k = s.classes;
    expect(k.title).toBe('Classes');
    expect(k.line('Ms Park', 12, 'today', true)).toBe('Ms Park · 12 students · active today · plan published');
    expect(k.line(null, 1, 'never', false)).toBe('no teacher yet · 1 student · active never');
    expect(k.teacherFor('Class A')).toBe('Teacher for Class A');
    expect(k.chooseTeacher).toBe('Choose a teacher…');
    expect(k.cancel.cta).toBe('Cancel');
    expect(k.change.cta).toBe('Change teacher');
    expect(k.assign.cta).toBe('Assign teacher');
    expect(k.open.cta).toBe('Open roster →');
    expect(k.newField).toEqual({ label: 'New class', placeholder: 'Sunday Class C' });
    expect(k.add.cta).toBe('+ New class');
  });

  it('keeps the footer around its settings link', () => {
    expect(s.settingsLink).toBe('School settings');
    expect(s.footer('School settings')).toBe('School settings · rosters opened from here show initials by default.');
  });
});

