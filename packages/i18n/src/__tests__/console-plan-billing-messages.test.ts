import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

// F-I18N-001 PR 10b: the plan page (teach/space/plan), the billing page (teach/billing) and
// the helpers they render (plans.ts readoutLine, billing.ts, data/catalog catalogLabel) read
// the dictionary. English is the source and must render exactly what they hard-coded before
// (§3.4 rule 1), so every value below is the former literal, byte for byte, except that counts
// go through plural() (F-I18N-001 §10, console counts, closed): "for 1 learner", "1 seat".
const c = getMessages('en').console;

describe('plan page (teach/space/plan/page.tsx)', () => {
  const p = c.plan;

  it('keeps the title, the back link and the errors', () => {
    expect(p.title).toBe('Plan');
    expect(p.titleFor('Class A')).toBe('Class A · plan');
    expect(p.back('Class A')).toBe('← Back to Class A');
    expect(p.back(null)).toBe('← Back to the space');
    expect(p.saveInvalid).toBe("Some learners are no longer in this space — check who it's for.");
    expect(p.saveFailed).toBe("Didn't save. Try again.");
    expect(p.archiveFailed).toBe("Couldn't archive it right now.");
  });

  it('keeps the readout: summary, buttons, progress list', () => {
    expect(p.readoutLabel).toBe('Plan readout');
    // One whole sentence per audience (§3.1): no noun phrase is glued after "for".
    expect(p.summary.everyone.class(1)).toBe('1 item · for everyone in this class');
    expect(p.summary.everyone.family(2)).toBe('2 items · for everyone in this family');
    expect(p.summary.everyone.school(3)).toBe('3 items · for everyone in this school');
    expect(p.summary.everyone.space(4)).toBe('4 items · for everyone in this space');
    expect(p.summary.some.class(4, 3)).toBe('4 items · for 3 students');
    expect(p.summary.some.family(1, 2)).toBe('1 item · for 2 learners');
    // Target counts go through plural() like console.planCounts.targets (F-I18N-001 §10, console counts).
    expect(p.summary.some.school(2, 1)).toBe('2 items · for 1 member');
    expect(p.summary.some.family(1, 1)).toBe('1 item · for 1 learner');
    expect(p.summary.some.class(3, 1)).toBe('3 items · for 1 student');
    expect(p.edit.cta).toBe('Edit');
    expect(p.archive.cta).toBe('Archive');
    expect(p.newPlan.cta).toBe('New plan');
    expect(p.progressTitle).toBe('Progress');
    expect(p.noMembers).toEqual({ family: 'No learners yet.', class: 'No students yet.', school: 'No members yet.' });
  });

  it('keeps the readout line (plans.ts readoutLine)', () => {
    expect(p.readout.waiting).toBe('waiting for the next sync');
    expect(p.readout.progress(2, 3)).toBe('2 / 3');
    expect(p.readout.withNotReady(0, 2, 1)).toBe('0 / 2 · 1 not ready yet');
  });

  it('keeps the builder: title field, catalog, plan list', () => {
    expect(p.builderLabel).toBe('Plan builder');
    expect(p.editTitle).toBe('Edit plan');
    expect(p.newTitle).toBe('New plan');
    expect(p.titleField).toEqual({ label: 'Plan title', placeholder: 'Week 3' });
    expect(p.catalog.label).toBe('Catalog');
    expect(p.catalog.title).toBe('Catalog (Stage 1)');
    expect(p.catalog.addEpisode.cta).toBe('+ episode');
    expect(p.catalog.questLine('Meet the Vowels', 5)).toBe('Meet the Vowels · 5 min');
    expect(p.catalog.questLine('quest:x', null)).toBe('quest:x · ? min');
    expect(p.catalog.add.cta).toBe('+ add');
    expect(p.catalog.added.cta).toBe('added');
    expect(p.catalog.episodeLabel('Meet the Letters', 3)).toBe('Meet the Letters (3 quests)');
    expect(p.catalog.episodeLabel('New Year & Festivals', 1)).toBe('New Year & Festivals (1 quest)');
    expect(p.yours.label).toBe('Your plan');
    expect(p.yours.title(0)).toBe('Your plan (0)');
    expect(p.yours.empty).toBe('Add quests or whole episodes from the catalog.');
    expect([p.yours.moveUp.cta, p.yours.moveDown.cta, p.yours.remove.cta]).toEqual(['↑', '↓', '×']);
    expect(p.yours.dateFor(2)).toBe('Target date for item 2');
    expect(p.yours.noteFor(2)).toBe('Note for item 2');
    expect(p.yours.notePlaceholder).toBe('note (optional)');
  });

  it('keeps the pace row, the audience choice and the save row', () => {
    expect(p.pace.title).toBe('Pace');
    expect(p.pace.start).toBe('Start date');
    expect(p.pace.perWeekLabel).toBe('Items per week');
    expect(p.pace.perWeek(2)).toBe('2 / week');
    expect(p.who.title).toBe('Who is this for');
    expect(p.who.everyone).toEqual({ family: 'everyone in this family', class: 'everyone in this class', school: 'everyone in this school', space: 'everyone in this space' });
    expect(p.who.only).toBe('only:');
    expect(p.noneJoined).toEqual({ family: 'No learners have joined yet.', class: 'No students have joined yet.', school: 'No members have joined yet.' });
    expect(p.saving.cta).toBe('Saving…');
    expect(p.cancel.cta).toBe('Cancel');
  });
});

describe('billing page (teach/billing/page.tsx, billing.ts)', () => {
  const b = c.billing;

  it('keeps the title and the notes', () => {
    expect(b.title).toBe('Billing');
    expect(b.cantCheck).toBe("Can't check your plan right now.");
    expect(b.checkoutFailed).toBe("Couldn't start checkout. Try again.");
    expect(b.portalFailed).toBe("Couldn't open the billing portal.");
  });

  it('keeps the current-plan section', () => {
    expect(b.current.title).toBe('Current plan');
    // The free-class cap arrives as a number (content-schema FREE_CLASS_STUDENT_CAP).
    expect(b.current.freeLine(20)).toBe('Stage 1, local progress, Rescue Code, file backup. Classes hold up to 20 students.');
    expect(b.current.freeLine(25)).toBe('Stage 1, local progress, Rescue Code, file backup. Classes hold up to 25 students.');
    expect(b.yourAccount).toBe('your account');
    // One whole sentence per provider (§3.1): the provider name is not glued after "via".
    expect(b.source('stripe', null)).toBe('via web (Stripe)');
    expect(b.source('stripe', 'KPCCW2026')).toBe('via web (Stripe) · code KPCCW2026');
    expect(b.source('apple', null)).toBe('via App Store');
    expect(b.source('google', null)).toBe('via Google Play');
    expect(b.source('manual', null)).toBe('via contract');
    expect(b.seats(300)).toBe('300 seats');
    expect(b.seats(1)).toBe('1 seat');
    expect(b.manage.cta).toBe('Manage subscription');
  });

  it('keeps the plan names, what each includes and the contract price', () => {
    expect(b.planTitle).toEqual({ free: 'Free', family_lifetime: 'Family Lifetime', group_license: 'Group License', school_seat: 'School Contract' });
    expect(b.includes.free(20)).toBe('Stage 1, local progress, Rescue Code, file backup; classes up to 20 students');
    expect(b.includes.free(25)).toBe('Stage 1, local progress, Rescue Code, file backup; classes up to 25 students');
    expect(b.includes.family_lifetime(5)).toBe('Every Stage, now and later, for one family: up to 5 learners, cloud sync, grown-up dashboard and plans');
    expect(b.includes.group_license(10, 300, 20)).toBe('A class or school: every student premium while enrolled, no 20-student cap; a school holds up to 10 teachers / 300 students');
    expect(b.includes.group_license(10, 300, 25)).toContain('no 25-student cap');
    expect(b.includes.school_seat(300, 10)).toBe('Beyond 300 students or 10 teachers — seats by contract');
    expect(b.contactPrice).toBe('Contact us');
  });

  it('keeps the plans section and the promo form', () => {
    expect(b.plans.title).toBe('Plans');
    expect(b.promo.formLabel).toBe('Promo code');
    expect(b.promo.placeholder).toBe('HOYA20');
    expect(b.promo.apply.cta).toBe('Apply code');
    expect(b.promo.change.cta).toBe('Change code');
    expect(b.promo.applied('HOYA20', null)).toBe('HOYA20 applied.');
    expect(b.promo.applied('HOYA20', 'Spring')).toBe('HOYA20 applied · Spring.');
    expect(b.choose.cta).toBe('Choose');
    expect(b.contact.cta).toBe('Contact us');
    expect(b.isCurrent.pill).toBe('current');
  });
});
