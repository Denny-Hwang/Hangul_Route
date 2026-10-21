import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import { getMessages } from '../resolve';
import { lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-BILL-002 B-6 (section 6, read with AMENDMENTS-BILLING-FAMILY-YEARLY BY-D9): the words of the
 * billing home on app.hangulroute.com (`console.billing.*` additions), the two past-due status
 * values, the learner Plan screen (`caregiver.plan.*`), the Profile plan card's new keys and
 * `a11y.planStatus`. English is the source; es / ko are typed drafts for native review (F-I18N-001
 * §3.10: no review-ledger entry, so `i18n-status` reports them "not reviewed", and both locales stay
 * hidden). Nothing reads these keys yet: B-7, B-8a-c and B-9 render them. The section 6.4 removals
 * are B-9's.
 */

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

/** Every leaf B-6 adds or changes, by namespace. */
const BILLING_ADDED = [
  'testMode',
  'notConfigured',
  'liveOff',
  'offline',
  'retry.cta',
  'sections.yours',
  'sections.add',
  'sections.help',
  'kind.family',
  'kind.class',
  'kind.school',
  'archived',
  'coverage.free',
  'coverage.family',
  'coverage.license',
  'coverage.contract',
  'coverage.school',
  'coverage.schoolUntil',
  'status.renewsOn',
  'status.endsOn',
  'readOnly.family',
  'readOnly.class',
  'readOnly.school',
  'usage.learners',
  'usage.students',
  'usage.teachers',
  'connectLearner.line',
  'connectLearner.cta',
  'buy.forSpace',
  'buy.family_lifetime.cta',
  'buy.group_license.cta',
  'includesLines.family.everyLesson',
  'includesLines.family.learners',
  'includesLines.family.cloudSave',
  'includesLines.family.browse',
  'includesLines.family.reports',
  'includesLines.family.notes',
  'includesLines.license.everyStudent',
  'includesLines.license.classLearners',
  'includesLines.license.school',
  'includesLines.license.browse',
  'includesLines.license.reports',
  'includesLines.license.notes',
  'promo.disclosure',
  'noSpaces.title',
  'noSpaces.family.cta',
  'noSpaces.class.cta',
  'alreadyActive',
  'checking',
  'done',
  'stillProcessing',
  'checkAgain.cta',
  'receipts.title',
  'receipts.all.cta',
  'receipts.empty',
  'receipts.older',
  'receipts.beyondLimit',
  'receipts.kind.purchase',
  'receipts.kind.renewal',
  'receipts.kind.refund',
  'receipts.kind.failed',
  'receipts.column.date',
  'receipts.column.what',
  'receipts.column.plan',
  'receipts.column.amount',
  'receipts.test.pill',
  'receipts.view.cta',
  'receipts.viewA11y',
  'receipts.linkFailed',
  'receipts.pageTitle',
  'receipts.notYours',
  'receipts.cantLoad',
  'receipts.back.cta',
  'stepUp.title',
  'stepUp.body',
  'stepUp.reason',
  'stepUp.cta',
  'stepUp.cancel.cta',
  'stepUp.cancelled',
  'stepUp.unavailable',
  'contact.mailSubject',
  'help.refund',
  'help.learners',
  'help.sharedDevice',
  'pastDue',
].map((p) => `console.billing.${p}`);

const STATUS_CHANGED = ['console.entitlementStatus.pastDueKept', 'console.entitlementStatus.pastDuePaused'];

const PLAN_SCREEN = [
  'title',
  'learnerFallback',
  'covered.title.family',
  'covered.title.self',
  'covered.note.family',
  'covered.note.self',
  'covered.sourceFallback',
  'full.title.family',
  'full.title.self',
  'full.fromFamily.family',
  'full.fromFamily.self',
  'full.noSource',
  'free.title.family',
  'free.title.self',
  'free.open',
  'openBilling.cta',
  'openBilling.caption.family',
  'openBilling.caption.self',
  'openBilling.a11yHint',
  'openFailed',
  'backToJourney.cta',
].map((p) => `caregiver.plan.${p}`);

const PROFILE_ADDED = ['learner.profile.plan.fullRoute', 'learner.profile.plan.open', 'learner.profile.plan.details.cta'];
const A11Y_ADDED = ['a11y.planStatus'];
/** Added by B-9's review: the web hand-off lines (one more tap after the PIN; offline needs a connection). */
const PLAN_SCREEN_B9 = ['caregiver.plan.gateDone', 'caregiver.plan.needsConnection'];

const B6_PATHS = [...BILLING_ADDED, ...STATUS_CHANGED, ...PLAN_SCREEN, ...PROFILE_ADDED, ...A11Y_ADDED];

/** Existing keys the new lines name (the page, its manage button, the plan titles): drafted with them so a page never names one thing two ways. */
const NAMED_BY_NEW_LINES = [
  'console.billing.title',
  'console.billing.manage.cta',
  'console.billing.planTitle.free',
  'console.billing.planTitle.family_lifetime',
  'console.billing.planTitle.group_license',
  'console.billing.planTitle.school_seat',
  // The status line beside the two changed past-due values: drafted whole, so one card never mixes languages.
  ...['trial', 'trialEnds', 'active', 'activeRenews', 'cancelled', 'cancelledEnds', 'ended', 'endedOn'].map((k) => `console.entitlementStatus.${k}`),
];

type Message = (...args: unknown[]) => string;

/** What a message renders in `locale`: the string, or one output per SAMPLES row (with the row's arguments). */
function renderings(locale: UiLocale, path: string): Array<{ out: string; args: readonly unknown[] }> {
  const value = lookup(getMessages(locale), path);
  if (typeof value === 'string') return [{ out: value, args: [] }];
  expect(typeof value, `${locale}:${path}`).toBe('function');
  const samples = SAMPLES[path];
  expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
  return (samples ?? []).map((args) => ({ out: (value as Message)(...args), args }));
}

const outputs = (locale: UiLocale, paths: readonly string[]): Array<[string, string]> =>
  paths.flatMap((path) => renderings(locale, path).map(({ out }): [string, string] => [path, out]));

const c = en.console;
const b = c.billing;
const p = en.caregiver.plan;

describe('console.billing additions (F-BILL-002 §6.1, BY-D9 values)', () => {
  it('words the mode banner, the offline panel and retry', () => {
    expect(b.testMode).toBe('Test mode: no real card is charged.');
    expect(b.notConfigured).toBe("Payments aren't set up yet. Nothing was charged.");
    expect(b.liveOff).toBe('Payments are not open yet. Nothing was charged.');
    expect(b.offline).toBe("You're offline. Plans and receipts need a connection.");
    expect(b.retry.cta).toBe('Try again');
  });

  it('names the sections, the space kinds and an archived space', () => {
    expect(b.sections).toEqual({ yours: 'Your plans', add: 'Add a plan', help: 'Help' });
    expect(b.kind).toEqual({ family: 'Family', class: 'Class', school: 'School' });
    expect(b.archived).toBe('(archived)');
  });

  it('words what covers a space; the school name and date arrive as arguments', () => {
    expect(b.coverage.free).toBe('Free plan');
    expect(b.coverage.family).toBe('Family Plan');
    expect(b.coverage.license).toBe('Group License');
    expect(b.coverage.contract).toBe('School Contract');
    expect(b.coverage.school('Maple School')).toBe("Covered by Maple School's license");
    expect(b.coverage.schoolUntil('Maple School', 'Jun 30, 2027')).toBe("Covered by Maple School's license until Jun 30, 2027");
    // A name that already ends in a possessive takes no second one; any other name does.
    expect(b.coverage.school("St. Mary's")).toBe("Covered by St. Mary's license");
    expect(b.coverage.schoolUntil('St. Mary\u2019s', 'Jun 30, 2027')).toBe('Covered by St. Mary\u2019s license until Jun 30, 2027');
    expect(b.coverage.school('St. James')).toBe("Covered by St. James's license");
    expect(b.status.renewsOn('Oct 21, 2027')).toBe('Renews on Oct 21, 2027');
    expect(b.status.endsOn('Oct 21, 2027')).toBe('Ends on Oct 21, 2027');
  });

  it('says who manages a plan on a read-only card', () => {
    expect(b.readOnly.family).toBe('The person who set up this family manages this plan.');
    expect(b.readOnly.class).toBe('The class owner manages this plan.');
    expect(b.readOnly.school).toBe('Your school manages this plan.');
  });

  it('counts usage through plural forms; a null cap means no cap', () => {
    expect(b.usage.learners(2, 5)).toBe('2 of 5 learners');
    expect(b.usage.learners(0, 5)).toBe('0 of 5 learners');
    expect(b.usage.learners(1, null)).toBe('1 learner');
    expect(b.usage.learners(3, null)).toBe('3 learners');
    expect(b.usage.students(14, 20)).toBe('14 of 20 students');
    expect(b.usage.students(23, null)).toBe('23 students');
    expect(b.usage.students(1, null)).toBe('1 student');
    expect(b.usage.teachers(7, 10)).toBe('7 of 10 teachers');
    expect(b.usage.teachers(1, null)).toBe('1 teacher');
    expect(b.usage.teachers(2, null)).toBe('2 teachers');
  });

  it('words the connect-a-learner step and the buy rows', () => {
    expect(b.connectLearner).toEqual({ line: 'Next: connect a learner to this family.', cta: 'Connect a learner' });
    expect(b.buy.forSpace('Group License', 'Maple Class')).toBe('Group License for Maple Class');
    expect(b.buy.family_lifetime.cta).toBe('Get Family Plan');
    expect(b.buy.group_license.cta).toBe('Get Group License');
  });

  it('lists what each plan includes; limits arrive as numbers', () => {
    const f = b.includesLines.family;
    expect(f.everyLesson).toBe('Every lesson of every Stage, new ones included');
    expect(f.learners(5)).toBe('Up to 5 learners in one family');
    expect(f.learners(1)).toBe('Up to 1 learner in one family');
    expect(f.cloudSave).toBe('Cloud save on every device');
    expect(f.browse).toBe('Browse every lesson as your learner sees it');
    expect(f.reports).toBe('Reports on what went well and what to practice next');
    expect(f.notes).toBe('Send notes to your learners');
    const l = b.includesLines.license;
    expect(l.everyStudent).toBe('Every lesson for every student while they are enrolled');
    expect(l.classLearners(50)).toBe('Up to 50 students in the class');
    expect(l.classLearners(1)).toBe('Up to 1 student in the class');
    expect(l.school(10, 300)).toBe('A school holds up to 10 teachers and 300 students');
    expect(l.school(1, 1)).toBe('A school holds up to 1 teacher and 1 student');
    expect(l.browse).toBe('Browse every lesson as your students see it');
    expect(l.reports).toBe('Student and class reports');
    expect(l.notes).toBe('Send notes to your students');
  });

  it('adds the promo disclosure and the contract mail subject next to the kept keys', () => {
    expect(b.promo.disclosure).toBe('Have a code?');
    expect(b.promo.apply.cta).toBe('Apply code');
    expect(b.contact.mailSubject).toBe('Hangul Route school contract');
    expect(b.contact.cta).toBe('Contact us');
  });

  it('words the empty state and the checkout return', () => {
    expect(b.noSpaces.title).toBe('Plans belong to a family or a class.');
    expect(b.noSpaces.family.cta).toBe('Set up for me or my family');
    expect(b.noSpaces.class.cta).toBe('Set up a class');
    expect(b.alreadyActive).toBe('This plan is already active. Nothing was charged.');
    expect(b.checking).toBe('Almost there: checking your plan.');
    expect(b.done).toBe('Thank you. The plan is active. Learners get it the next time they open Hangul Route.');
    expect(b.stillProcessing).toBe('Your payment went through. The plan shows here in a minute.');
    expect(b.checkAgain.cta).toBe('Check again');
  });

  it('words the receipts, inline and on their page', () => {
    const r = b.receipts;
    expect(r.title).toBe('Receipts');
    expect(r.all.cta).toBe('All receipts');
    expect(r.empty).toBe('No receipts yet.');
    expect(r.older).toBe('Older payments are in the receipt email from Stripe.');
    expect(r.beyondLimit).toBe("Older receipts: see Stripe's emails or write to us.");
    expect(r.kind).toEqual({ purchase: 'Payment', renewal: 'Renewal', refund: 'Refund', failed: "Payment didn't go through" });
    // The wide table's column headers (wireframe billing/receipts, §8); `title` is its caption.
    expect(r.column).toEqual({ date: 'Date', what: 'What', plan: 'Plan', amount: 'Amount' });
    expect(r.test.pill).toBe('test');
    expect(r.view.cta).toBe('View receipt');
    expect(r.viewA11y('Oct 21, 2026')).toBe('View receipt from Oct 21, 2026 (opens Stripe in a new tab)');
    expect(r.linkFailed).toBe("Can't open this receipt right now.");
    expect(r.pageTitle('Maple Class')).toBe('Maple Class · receipts');
    expect(r.notYours).toBe('This page is for the person who pays for this space.');
    expect(r.cantLoad).toBe("Can't load receipts right now.");
    expect(r.back.cta).toBe('Back to Billing');
  });

  it('words the step-up dialog', () => {
    const s = b.stepUp;
    expect(s.title).toBe("Confirm it's you");
    expect(s.body).toBe('Before a payment, a plan change or a receipt, sign in again.');
    expect(s.reason).toBe('This keeps payments safe on a shared device.');
    expect(s.cta).toBe('Continue');
    expect(s.cancel.cta).toBe('Not now');
    expect(s.cancelled).toBe('Nothing was changed.');
    expect(s.unavailable).toBe("Can't confirm right now. Try again in a moment.");
  });

  it('words the help block and the past-due note; the address arrives as an argument', () => {
    expect(b.help.refund('hello@hangulroute.com')).toBe('Questions or a refund? Write to hello@hangulroute.com.');
    expect(b.help.learners).toBe('Learners never see prices or receipts.');
    expect(b.help.sharedDevice).toBe('On a shared device? Sign out when you are done.');
    expect(b.pastDue).toBe("A payment didn't go through. Update your card in Manage subscription; learners keep the full route for a week.");
  });
});

describe('console.entitlementStatus past-due values (§6.1: "full route", never "premium")', () => {
  it('says the full route is kept, then paused', () => {
    expect(c.entitlementStatus.pastDueKept).toBe('payment needs attention · full route kept for a week');
    expect(c.entitlementStatus.pastDuePaused).toBe('payment needs attention · full route paused');
  });
});

describe('the yearly Family Plan words (AMENDMENTS-BILLING-FAMILY-YEARLY BY-D9, reconciled with BY-1 #371)', () => {
  it('the family coverage line and the buy button use the plan title BY-1 set', () => {
    expect(b.planTitle.family_lifetime).toBe('Family Plan');
    expect(b.coverage.family).toBe(b.planTitle.family_lifetime);
    expect(b.coverage.license).toBe(b.planTitle.group_license);
    expect(b.buy.family_lifetime.cta).toBe(`Get ${b.planTitle.family_lifetime}`);
    expect(b.buy.group_license.cta).toBe(`Get ${b.planTitle.group_license}`);
    expect(p.full.fromFamily.family).toContain(b.planTitle.family_lifetime);
    expect(p.full.fromFamily.self).toContain(b.planTitle.family_lifetime);
  });

  it('keeps no lifetime key: coverage.lifetime became coverage.family, receipts.oneTime is deleted', () => {
    expect(b.coverage).not.toHaveProperty('lifetime');
    expect(b.receipts).not.toHaveProperty('oneTime');
  });

  it('no new string calls a plan lifetime or one-time, in any locale', () => {
    const LIFETIME: Record<UiLocale, RegExp> = {
      en: /\blifetime\b|\bonce\b|\bone payment\b|\bpay once\b|\bfor good\b|\bforever\b|\bnothing to cancel\b|\bno renewal\b/i,
      es: /de por vida|vitalicio|vitalicia|pago único|una sola vez|para siempre|sin renovación|nada que cancelar/i,
      ko: /평생|영구|한 번 결제|일회|갱신 없|해지할 것이 없/,
    };
    for (const locale of LOCALES) for (const [path, out] of outputs(locale, [...B6_PATHS, ...NAMED_BY_NEW_LINES])) expect(out, `${locale}:${path}`).not.toMatch(LIFETIME[locale]);
    expect('Family Lifetime · yours for good').toMatch(LIFETIME.en); // self-checks
    expect('Plan Familiar de por vida · pago único').toMatch(LIFETIME.es);
    expect('평생 이용 · 한 번 결제').toMatch(LIFETIME.ko);
  });

  it('every locale names the plan, the page and the manage button one way (es / ko drafts too)', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).console;
      const bill = m.billing;
      const title = bill.planTitle;
      expect(bill.coverage.family, locale).toBe(title.family_lifetime);
      expect(bill.coverage.license, locale).toBe(title.group_license);
      expect(bill.coverage.contract, locale).toBe(title.school_seat);
      expect(bill.buy.family_lifetime.cta, locale).toContain(title.family_lifetime);
      expect(bill.buy.group_license.cta, locale).toContain(title.group_license);
      const plan = getMessages(locale).caregiver.plan;
      expect(plan.full.fromFamily.family, locale).toContain(title.family_lifetime);
      expect(plan.full.fromFamily.self, locale).toContain(title.family_lifetime);
      expect(bill.pastDue, locale).toContain(bill.manage.cta);
      expect(bill.receipts.back.cta, locale).toContain(bill.title);
    }
  });
});

describe('caregiver.plan: the learner Plan screen (F-BILL-002 §6.2, §4.7)', () => {
  it('names the screen and stands in for a missing name', () => {
    expect(p.title).toBe('Plan');
    expect(p.learnerFallback).toBe('Your learner');
    expect(p.backToJourney.cta).toBe('Back to journey');
  });

  it('names the way back from the Library and from the Home and Results asks (F-ENT-003 E3-6)', () => {
    expect(p.backToLibrary.cta).toBe('Back to library');
    expect(p.backHome.cta).toBe('Back home');
  });

  it('words the covered state per audience', () => {
    expect(p.covered.title.family('Mina', 'Sunday Class A')).toBe('Mina is covered by Sunday Class A.');
    expect(p.covered.title.self('Sunday Class A')).toBe("You're covered by Sunday Class A.");
    expect(p.covered.note).toEqual({ family: 'Everything is open while they are in it.', self: 'Everything is open while you are in it.' });
    expect(p.covered.sourceFallback).toBe('the class');
  });

  it('words the full-route state per audience, from a Family Plan or with no source', () => {
    expect(p.full.title.family('Mina')).toBe('Mina has the full route.');
    expect(p.full.title.self).toBe('You have the full route.');
    expect(p.full.fromFamily).toEqual({ family: "From your family's Family Plan.", self: 'From your Family Plan.' });
    expect(p.full.noSource).toBe('Everything is open.');
  });

  it('words the free state; the switch-off line keeps today\'s wording', () => {
    expect(p.free.title.family('Mina')).toBe('Mina is on the free plan.');
    expect(p.free.title.self).toBe("You're on the free plan.");
    expect(p.free.open).toBe('Stage 1 is always free.');
  });

  it('words the web-only Open billing block and its failure line', () => {
    expect(p.openBilling.cta).toBe('Open billing');
    expect(p.openBilling.caption).toEqual({
      family: 'Plans and receipts are on the billing page for grown-ups.',
      self: 'Your plan and receipts are on the billing page.',
    });
    expect(p.openBilling.a11yHint).toBe('Opens the billing page');
    expect(p.openFailed('https://app.hangulroute.com/account/billing')).toBe('Open https://app.hangulroute.com/account/billing in a browser.');
  });

  it('a11y.planStatus reads the summary heading', () => {
    expect(en.a11y.planStatus('Mina', 'Free plan')).toBe('Mina: Free plan.');
  });
});

describe('learner.profile.plan: the Profile plan card (F-BILL-002 §6.3)', () => {
  const card = en.learner.profile.plan;

  it('adds Full route, the open note and Plan details', () => {
    expect(card.fullRoute).toBe('Full route');
    expect(card.open(null)).toBe('Everything is open.');
    expect(card.open('Sunday Class A')).toBe('Everything is open, from Sunday Class A.');
    // A source with no name reads as no source, never "from ."
    expect(card.open('')).toBe('Everything is open.');
    expect(card.open('  ')).toBe('Everything is open.');
    expect(card.details.cta).toBe('Plan details');
  });

  it('keeps free, freeNote and the pills', () => {
    expect(card.free).toBe('Free plan');
    expect(card.freeNote).toBe('All of Stage 1 is free.');
    expect(card.allOpen).toBe('Everything is open right now.');
    expect(card.pillActive).toBe('Active');
    expect(card.pillFree).toBe('Free');
  });
});

/**
 * Every string the billing wireframes draw (design/wireframes/billing/*.md), with the key that holds
 * it, rendered with sample arguments. `drawn` is how the wireframe file itself writes it when that
 * differs: a placeholder (`<date>`), an upper-case primary button, the first line of a wrapped box
 * line, or the drawing's short form of a line (the renew line); the test finds it in the file, so a
 * row cannot point at a string the wireframes do not draw.
 */
const WIREFRAMES = new URL('../../../../design/wireframes/billing/', import.meta.url);
const wireframeText = (name: string): string => readFileSync(new URL(`${name}.md`, WIREFRAMES), 'utf8');
const WIREFRAME_STRINGS: ReadonlyArray<{ wireframe: string; text: string; drawn?: string; path: string; args?: readonly unknown[] }> = [
  { wireframe: 'billing-home', text: 'Billing', path: 'console.billing.title' },
  { wireframe: 'billing-home', text: 'Test mode: no real card is charged.', path: 'console.billing.testMode' },
  { wireframe: 'billing-home', text: 'Your plans', path: 'console.billing.sections.yours' },
  { wireframe: 'billing-home', text: 'Family', path: 'console.billing.kind.family' },
  { wireframe: 'billing-home', text: 'Class', path: 'console.billing.kind.class' },
  { wireframe: 'billing-home', text: 'School', path: 'console.billing.kind.school' },
  { wireframe: 'billing-home', text: 'Free plan', path: 'console.billing.coverage.free' },
  // [SA] AMENDMENTS-SEATS-ADMINS: the wireframe draws the new caps (4 learners, 50 students; SA-0).
  { wireframe: 'billing-home', text: '2 of 4 learners', path: 'console.billing.usage.learners', args: [2, 4] },
  { wireframe: 'billing-home', text: 'Family Plan', path: 'console.billing.coverage.family' },
  { wireframe: 'billing-home', text: 'Every lesson of every Stage, new ones included', drawn: 'Every lesson of every', path: 'console.billing.includesLines.family.everyLesson' },
  { wireframe: 'billing-home', text: 'Up to 4 learners in one family', drawn: 'Up to 4 learners in one', path: 'console.billing.includesLines.family.learners', args: [4] },
  { wireframe: 'billing-home', text: 'Cloud save on every device', path: 'console.billing.includesLines.family.cloudSave' },
  { wireframe: 'billing-home', text: 'Browse every lesson as your learner sees it', drawn: 'Browse every lesson as', path: 'console.billing.includesLines.family.browse' },
  { wireframe: 'billing-home', text: '$15.30 / year', path: 'console.price.year', args: ['$15.30'] },
  { wireframe: 'billing-home', text: 'Renews yearly. Cancel from Manage subscription any time.', drawn: 'Renews yearly. Cancel', path: 'console.familyLine' },
  { wireframe: 'billing-home', text: 'Have a code?', path: 'console.billing.promo.disclosure' },
  { wireframe: 'billing-home', text: 'Apply code', path: 'console.billing.promo.apply.cta' },
  { wireframe: 'billing-home', text: 'Get Family Plan', drawn: 'GET FAMILY PLAN', path: 'console.billing.buy.family_lifetime.cta' },
  { wireframe: 'billing-home', text: 'Receipts', path: 'console.billing.receipts.title' },
  { wireframe: 'billing-home', text: 'Help', path: 'console.billing.sections.help' },
  { wireframe: 'billing-home', text: 'Questions or a refund? Write to hello@hangulroute.com.', drawn: 'Questions or a refund? Write to', path: 'console.billing.help.refund', args: ['hello@hangulroute.com'] },
  { wireframe: 'billing-home', text: 'Learners never see prices or receipts.', drawn: 'Learners never see prices or', path: 'console.billing.help.learners' },
  { wireframe: 'billing-home', text: 'On a shared device? Sign out when you are done.', drawn: 'On a shared device? Sign out when', path: 'console.billing.help.sharedDevice' },
  { wireframe: 'billing-home', text: 'Group License', path: 'console.billing.coverage.license' },
  { wireframe: 'billing-home', text: 'Renews on Oct 21, 2027', drawn: 'Renews on <date>', path: 'console.billing.status.renewsOn', args: ['Oct 21, 2027'] },
  { wireframe: 'billing-home', text: 'Ends on Oct 21, 2027', drawn: 'Ends on <date>', path: 'console.billing.status.endsOn', args: ['Oct 21, 2027'] },
  { wireframe: 'billing-home', text: '23 students', path: 'console.billing.usage.students', args: [23, null] },
  { wireframe: 'billing-home', text: '14 of 20 students', path: 'console.billing.usage.students', args: [14, 20] },
  { wireframe: 'billing-home', text: '42 of 50 students', path: 'console.billing.usage.students', args: [42, 50] },
  { wireframe: 'billing-home', text: '7 of 10 teachers', path: 'console.billing.usage.teachers', args: [7, 10] },
  { wireframe: 'billing-home', text: '3 of 4 learners', path: 'console.billing.usage.learners', args: [3, 4] },
  { wireframe: 'billing-home', text: 'Manage subscription', path: 'console.billing.manage.cta' },
  { wireframe: 'billing-home', text: "Covered by Maple School's license until Jun 30, 2027", drawn: "Covered by <school>'s license until <date>", path: 'console.billing.coverage.schoolUntil', args: ['Maple School', 'Jun 30, 2027'] },
  { wireframe: 'billing-home', text: 'Your school manages this plan.', path: 'console.billing.readOnly.school' },
  { wireframe: 'billing-home', text: 'The person who set up this family manages this plan.', path: 'console.billing.readOnly.family' },
  { wireframe: 'billing-home', text: 'The class owner manages this plan.', path: 'console.billing.readOnly.class' },
  { wireframe: 'billing-home', text: 'Add a plan', path: 'console.billing.sections.add' },
  { wireframe: 'billing-home', text: 'Group License for Maple Class', drawn: 'Group License for <class name>', path: 'console.billing.buy.forSpace', args: ['Group License', 'Maple Class'] },
  { wireframe: 'billing-home', text: 'Every lesson for every student while they are enrolled', path: 'console.billing.includesLines.license.everyStudent' },
  // [SA] row SA-3: `classLearners` replaces `noCap`.
  { wireframe: 'billing-home', text: 'Up to 50 students in the class', path: 'console.billing.includesLines.license.classLearners', args: [50] },
  { wireframe: 'billing-home', text: 'Get Group License', drawn: 'GET GROUP LICENSE', path: 'console.billing.buy.group_license.cta' },
  { wireframe: 'billing-home', text: 'Next: connect a learner to this family.', path: 'console.billing.connectLearner.line' },
  { wireframe: 'billing-home', text: 'Connect a learner', path: 'console.billing.connectLearner.cta' },
  { wireframe: 'billing-home', text: 'Contact us', path: 'console.billing.contact.cta' },
  { wireframe: 'billing-home', text: 'Hangul Route school contract', path: 'console.billing.contact.mailSubject' },
  { wireframe: 'billing-home', text: 'payment needs attention · full route kept for a week', path: 'console.entitlementStatus.pastDueKept' },
  { wireframe: 'billing-home', text: '(archived)', path: 'console.billing.archived' },
  {
    wireframe: 'billing-home',
    text: "A payment didn't go through. Update your card in Manage subscription; learners keep the full route for a week.", drawn: "A payment didn't go through. Update your card in Manage subscription;",
    path: 'console.billing.pastDue',
  },
  { wireframe: 'billing-home', text: 'All receipts', path: 'console.billing.receipts.all.cta' },
  { wireframe: 'billing-home', text: 'Plans belong to a family or a class.', path: 'console.billing.noSpaces.title' },
  { wireframe: 'billing-home', text: 'Set up for me or my family', drawn: 'SET UP FOR ME OR MY FAMILY', path: 'console.billing.noSpaces.family.cta' },
  { wireframe: 'billing-home', text: 'Set up a class', path: 'console.billing.noSpaces.class.cta' },
  { wireframe: 'billing-home', text: "Payments aren't set up yet. Nothing was charged.", path: 'console.billing.notConfigured' },
  { wireframe: 'billing-home', text: 'Payments are not open yet. Nothing was charged.', path: 'console.billing.liveOff' },
  { wireframe: 'billing-home', text: 'This plan is already active. Nothing was charged.', path: 'console.billing.alreadyActive' },
  { wireframe: 'billing-home', text: "You're offline. Plans and receipts need a connection.", path: 'console.billing.offline' },
  { wireframe: 'billing-home', text: 'Try again', path: 'console.billing.retry.cta' },
  { wireframe: 'billing-home', text: "Can't check your plan right now.", path: 'console.billing.cantCheck' },
  { wireframe: 'checkout-return', text: 'Almost there: checking your plan.', drawn: 'Almost there:', path: 'console.billing.checking' },
  {
    wireframe: 'checkout-return',
    text: 'Thank you. The plan is active. Learners get it the next time they open Hangul Route.', drawn: 'Thank you. The plan is active.',
    path: 'console.billing.done',
  },
  { wireframe: 'checkout-return', text: 'Your payment went through. The plan shows here in a minute.', path: 'console.billing.stillProcessing' },
  { wireframe: 'checkout-return', text: 'Check again', path: 'console.billing.checkAgain.cta' },
  { wireframe: 'checkout-return', text: 'Nothing was charged.', path: 'console.billingCancelled' },
  { wireframe: 'receipts', text: 'Back to Billing', path: 'console.billing.receipts.back.cta' },
  { wireframe: 'receipts', text: 'Date', drawn: '| Date ', path: 'console.billing.receipts.column.date' },
  { wireframe: 'receipts', text: 'What', drawn: '| What ', path: 'console.billing.receipts.column.what' },
  { wireframe: 'receipts', text: 'Plan', drawn: '| Plan ', path: 'console.billing.receipts.column.plan' },
  { wireframe: 'receipts', text: 'Amount', drawn: '| Amount ', path: 'console.billing.receipts.column.amount' },
  { wireframe: 'receipts', text: 'Maple Class · receipts', drawn: '<space name> · receipts', path: 'console.billing.receipts.pageTitle', args: ['Maple Class'] },
  { wireframe: 'receipts', text: 'Renewal', path: 'console.billing.receipts.kind.renewal' },
  { wireframe: 'receipts', text: "Payment didn't go through", path: 'console.billing.receipts.kind.failed' },
  { wireframe: 'receipts', text: 'Payment', path: 'console.billing.receipts.kind.purchase' },
  { wireframe: 'receipts', text: 'Refund', path: 'console.billing.receipts.kind.refund' },
  { wireframe: 'receipts', text: 'test', path: 'console.billing.receipts.test.pill' },
  { wireframe: 'receipts', text: 'View receipt', path: 'console.billing.receipts.view.cta' },
  {
    wireframe: 'receipts',
    text: 'View receipt from Oct 21, 2026 (opens Stripe in a new tab)', drawn: 'View receipt from <date> (opens Stripe in a new tab)',
    path: 'console.billing.receipts.viewA11y',
    args: ['Oct 21, 2026'],
  },
  { wireframe: 'receipts', text: "Can't open this receipt right now.", path: 'console.billing.receipts.linkFailed' },
  { wireframe: 'receipts', text: "Older receipts: see Stripe's emails or write to us.", drawn: "Older receipts: see Stripe's", path: 'console.billing.receipts.beyondLimit' },
  { wireframe: 'receipts', text: 'No receipts yet.', path: 'console.billing.receipts.empty' },
  { wireframe: 'receipts', text: 'Older payments are in the receipt email from Stripe.', path: 'console.billing.receipts.older' },
  { wireframe: 'receipts', text: 'This page is for the person who pays for this space.', path: 'console.billing.receipts.notYours' },
  { wireframe: 'receipts', text: "Can't load receipts right now.", path: 'console.billing.receipts.cantLoad' },
  { wireframe: 'step-up', text: "Confirm it's you", path: 'console.billing.stepUp.title' },
  { wireframe: 'step-up', text: 'Before a payment, a plan change or a receipt, sign in again.', drawn: 'Before a payment, a plan', path: 'console.billing.stepUp.body' },
  { wireframe: 'step-up', text: 'This keeps payments safe on a shared device.', drawn: 'This keeps payments safe on', path: 'console.billing.stepUp.reason' },
  { wireframe: 'step-up', text: 'Continue', drawn: 'CONTINUE', path: 'console.billing.stepUp.cta' },
  { wireframe: 'step-up', text: 'Not now', path: 'console.billing.stepUp.cancel.cta' },
  { wireframe: 'step-up', text: 'Nothing was changed.', path: 'console.billing.stepUp.cancelled' },
  { wireframe: 'step-up', text: "Can't confirm right now. Try again in a moment.", path: 'console.billing.stepUp.unavailable' },
  { wireframe: 'plan-status', text: 'Plan', path: 'caregiver.plan.title' },
  { wireframe: 'plan-status', text: 'Mina is on the free plan.', drawn: '<Name> is on the free plan.', path: 'caregiver.plan.free.title.family', args: ['Mina'] },
  { wireframe: 'plan-status', text: 'Stage 1 is always free.', path: 'caregiver.plan.free.open' },
  { wireframe: 'plan-status', text: 'Plans and receipts are on the billing page for grown-ups.', drawn: 'Plans and receipts are on the', path: 'caregiver.plan.openBilling.caption.family' },
  { wireframe: 'plan-status', text: 'Your plan and receipts are on the billing page.', drawn: 'Your plan and receipts are', path: 'caregiver.plan.openBilling.caption.self' },
  { wireframe: 'plan-status', text: 'Open billing', path: 'caregiver.plan.openBilling.cta' },
  { wireframe: 'plan-status', text: 'Back to journey', drawn: 'BACK TO JOURNEY', path: 'caregiver.plan.backToJourney.cta' },
  { wireframe: 'plan-status', text: 'Mina has the full route.', drawn: '<Name> has the full route.', path: 'caregiver.plan.full.title.family', args: ['Mina'] },
  { wireframe: 'plan-status', text: "From your family's Family Plan.", path: 'caregiver.plan.full.fromFamily.family' },
  { wireframe: 'plan-status', text: 'Everything is open.', path: 'caregiver.plan.full.noSource' },
  { wireframe: 'plan-status', text: 'Mina is covered by Maple Class.', drawn: '<Name> is covered by <space>.', path: 'caregiver.plan.covered.title.family', args: ['Mina', 'Maple Class'] },
  { wireframe: 'plan-status', text: 'Everything is open while they are in it.', path: 'caregiver.plan.covered.note.family' },
  { wireframe: 'plan-status', text: "You're on the free plan.", path: 'caregiver.plan.free.title.self' },
  { wireframe: 'plan-status', text: 'You have the full route.', path: 'caregiver.plan.full.title.self' },
  { wireframe: 'plan-status', text: 'From your Family Plan.', path: 'caregiver.plan.full.fromFamily.self' },
  { wireframe: 'plan-status', text: "You're covered by Maple Class.", drawn: "You're covered by <space>.", path: 'caregiver.plan.covered.title.self', args: ['Maple Class'] },
  { wireframe: 'plan-status', text: 'Everything is open while you are in it.', path: 'caregiver.plan.covered.note.self' },
  { wireframe: 'plan-status', text: 'Your learner', path: 'caregiver.plan.learnerFallback' },
  { wireframe: 'plan-status', text: 'Open app.hangulroute.com in a browser.', drawn: 'Open <address> in a browser.', path: 'caregiver.plan.openFailed', args: ['app.hangulroute.com'] },
  { wireframe: 'plan-status', text: 'Opens the billing page', path: 'caregiver.plan.openBilling.a11yHint' },
  { wireframe: 'plan-status', text: 'Mina: Free plan.', drawn: '<Name>: <state>.', path: 'a11y.planStatus', args: ['Mina', 'Free plan'] },
  { wireframe: 'plan-status', text: 'Free plan', path: 'learner.profile.plan.free' },
  { wireframe: 'plan-status', text: 'All of Stage 1 is free.', path: 'learner.profile.plan.freeNote' },
  { wireframe: 'plan-status', text: 'Everything is open right now.', path: 'learner.profile.plan.allOpen' },
  { wireframe: 'plan-status', text: 'Full route', path: 'learner.profile.plan.fullRoute' },
  { wireframe: 'plan-status', text: 'Everything is open, from Maple Class.', drawn: 'Everything is open, from <space>.', path: 'learner.profile.plan.open', args: ['Maple Class'] },
  { wireframe: 'plan-status', text: 'Plan details', path: 'learner.profile.plan.details.cta' },
  { wireframe: 'plan-status', text: 'Active', path: 'learner.profile.plan.pillActive' },
  { wireframe: 'plan-status', text: 'Free', path: 'learner.profile.plan.pillFree' },
];

describe('every string a billing wireframe draws has a key (§11)', () => {
  it('covers each wireframe', () => {
    const drawn = new Set(WIREFRAME_STRINGS.map((row) => row.wireframe));
    expect([...drawn].sort()).toEqual(['billing-home', 'checkout-return', 'plan-status', 'receipts', 'step-up']);
  });

  it('each row is drawn by its wireframe file', () => {
    const files = new Map<string, string>();
    for (const row of WIREFRAME_STRINGS) {
      const text = files.get(row.wireframe) ?? wireframeText(row.wireframe);
      files.set(row.wireframe, text);
      expect(text, `${row.wireframe}.md draws "${row.drawn ?? row.text}"`).toContain(row.drawn ?? row.text);
    }
  });

  for (const row of WIREFRAME_STRINGS) {
    it(`${row.wireframe}: "${row.text}" is ${row.path}`, () => {
      const value = lookup(en, row.path);
      const out = typeof value === 'function' ? (value as Message)(...(row.args ?? [])) : value;
      expect(out).toBe(row.text);
    });
  }

  it('every new key is drawn by a wireframe or named in the spec section 6 tables', () => {
    const drawnPaths = new Set(WIREFRAME_STRINGS.map((row) => row.path));
    // Named in §6.1-6.3 but not drawn: the feature lines the wireframe stands for with its SITE_CLAIMS
    // note, the school line of a license row, the contract plan line, the school coverage line without a
    // date, the paused past-due status and the covered state's fallback name.
    const undrawn = B6_PATHS.filter((path) => !drawnPaths.has(path));
    expect(undrawn.sort()).toEqual(
      [
        'console.billing.coverage.contract',
        'console.billing.coverage.school',
        'console.billing.includesLines.family.notes',
        'console.billing.includesLines.family.reports',
        'console.billing.includesLines.license.browse',
        'console.billing.includesLines.license.notes',
        'console.billing.includesLines.license.reports',
        'console.billing.includesLines.license.school',
        'console.entitlementStatus.pastDuePaused',
        'caregiver.plan.covered.sourceFallback',
      ].sort(),
    );
  });
});

describe('es / ko overlay entries for native review (§6, F-I18N-001 §3.10)', () => {
  const overlays = { es, ko } as const;

  for (const [locale, overlay] of Object.entries(overlays)) {
    it(`${locale}: has every key B-6 adds or changes, and the existing names they use, with the English kind and arity`, () => {
      for (const path of [...B6_PATHS, ...NAMED_BY_NEW_LINES]) {
        const own = lookup(overlay, path);
        const source = lookup(en, path);
        expect(own, `${locale}:${path}`).toBeDefined();
        expect(typeof own, `${locale}:${path}`).toBe(typeof source);
        if (typeof own === 'function' && typeof source === 'function') expect(own.length, `${locale}:${path}`).toBe(source.length);
      }
    });
  }

  /** "{name}: {state}." is arguments and punctuation only: nothing in it to translate. */
  const ALL_ARGUMENTS = new Set(['a11y.planStatus']);

  it('es / ko: the whole status line is drafted, never half English beside the past-due values', () => {
    const STATUS = NAMED_BY_NEW_LINES.filter((x) => x.startsWith('console.entitlementStatus.'));
    expect(STATUS).toHaveLength(8);
    for (const [path, out] of outputs('ko', STATUS)) expect(HANGUL.test(out), `ko:${path}: ${out}`).toBe(true);
    for (const path of STATUS) expect(renderings('es', path).map((r) => r.out), `es:${path}`).not.toEqual(renderings('en', path).map((r) => r.out));
  });

  it('ko: the open note puts no particle after the source name', () => {
    const open = getMessages('ko').learner.profile.plan.open;
    expect(open('Sunday Class A')).toBe('Sunday Class A 덕분에 모두 열려 있어요.');
    expect(open(null)).toBe('모두 열려 있어요.');
    expect(open(' ')).toBe('모두 열려 있어요.');
  });

  it('ko: every new value is written in Korean', () => {
    for (const [path, out] of outputs('ko', B6_PATHS.filter((x) => !ALL_ARGUMENTS.has(x)))) expect(HANGUL.test(out), `ko:${path}: ${out}`).toBe(true);
  });

  it('es: no new value is left in English (a draft says something, not the source again)', () => {
    // Words that are the same in both languages are fine on their own ("Plan").
    const SAME_IN_BOTH = new Set(['caregiver.plan.title', 'console.billing.receipts.column.plan', ...ALL_ARGUMENTS]);
    for (const path of B6_PATHS.filter((x) => !SAME_IN_BOTH.has(x))) {
      const enOut = renderings('en', path).map((r) => r.out);
      const esOut = renderings('es', path).map((r) => r.out);
      expect(esOut, `es:${path}`).not.toEqual(enOut);
    }
  });

  it('every locale renders every new key with no empty output', () => {
    for (const locale of LOCALES) for (const [path, out] of outputs(locale, B6_PATHS)) expect(out.trim().length, `${locale}:${path}`).toBeGreaterThan(0);
  });
});

describe('copy checks (§6.5)', () => {
  /** Section 6.5 sets 24 for English buttons; this one keeps the spec's exact wording (F-APP-001 A4 echoes it) inside F-I18N-001's 28. */
  const EN_CTA_OVER_24: Readonly<Record<string, string>> = {
    'console.billing.noSpaces.family.cta': '"Set up for me or my family" is the spec\'s wording (§6.1, F-APP-001 amendment A4); 26 characters, within the F-I18N-001 §3.11 budget of 28',
  };
  const ctaPaths = B6_PATHS.filter((path) => path.endsWith('.cta'));

  it('finds the buttons', () => {
    expect(ctaPaths.length).toBe(15);
  });

  it('English buttons fit 24 characters (one listed exception, within 28)', () => {
    for (const path of ctaPaths) {
      for (const { out } of renderings('en', path)) expect(out.length, out).toBeLessThanOrEqual(EN_CTA_OVER_24[path] === undefined ? 24 : 28);
    }
  });

  it('es and ko buttons fit the F-I18N-001 budget of 28 (inside section 6.5\'s 32 for es)', () => {
    for (const locale of ['es', 'ko'] as const) for (const path of ctaPaths) for (const { out } of renderings(locale, path)) expect(out.length, `${locale}:${out}`).toBeLessThanOrEqual(28);
  });

  it('no message types a price, in any locale', () => {
    const PRICE = /[$€£₩]\s?\d|\d\s?(USD|dollars?|dólares)\b|\d\s?(달러|원)/i;
    for (const locale of LOCALES) for (const [path, out] of outputs(locale, B6_PATHS)) expect(out, `${locale}:${path}`).not.toMatch(PRICE);
    expect('$15.30 / year').toMatch(PRICE); // self-check
  });

  it('no message types a limit or a count: every digit comes from an argument', () => {
    // "Stage 1" names the free set (F-ENT-003 OD-1); it is a stage, not a limit.
    const STAGE_ONE = new Set(['caregiver.plan.free.open']);
    for (const locale of LOCALES) {
      for (const path of B6_PATHS) {
        for (const { out, args } of renderings(locale, path)) {
          let rest = out;
          for (const arg of args) if (arg !== null && arg !== undefined) rest = rest.split(String(arg)).join('');
          if (STAGE_ONE.has(path)) rest = rest.replace(/1/, '');
          expect(rest, `${locale}:${path}: ${out}`).not.toMatch(/\d/);
        }
      }
    }
  });

  it('console.billing has no kids wording and no age range, in any locale', () => {
    const KIDS: Record<UiLocale, RegExp> = { en: /\bkids?\b|\bchildren\b/i, es: /\bniñ[oa]s?\b/i, ko: /어린이|아이들/ };
    for (const locale of LOCALES) {
      for (const [path, out] of outputs(locale, [...BILLING_ADDED, ...STATUS_CHANGED])) {
        expect(out, `${locale}:${path}`).not.toMatch(KIDS[locale]);
        for (const pattern of KIDS_ONLY_FRAMING) expect(out, `${locale}:${path} (${pattern.name})`).not.toMatch(pattern.re);
      }
    }
  });

  it('console.billing passes the caregiver banned list in every locale', () => {
    for (const locale of LOCALES) {
      for (const [path, out] of outputs(locale, [...BILLING_ADDED, ...STATUS_CHANGED])) expect(findBannedWord(out, locale, 'caregiver'), `${locale}:${path}: ${out}`).toBeNull();
    }
  });

  it('the billing page never says Premium and never pushes, in any locale (§4.3 copy rules)', () => {
    const PUSH: Record<UiLocale, RegExp> = {
      en: /\bpremium\b|\bbest value\b|\bsave \d|\bsave up to\b|\bonly today\b|\blimited time\b|\bhurry\b|\bdon't miss\b|\byou will lose\b/i,
      es: /premium|mejor precio|ahorra|solo hoy|tiempo limitado|date prisa|no te lo pierdas|perderás/i,
      ko: /프리미엄|최저가|절약|오늘만|기간 한정|서두르|놓치지|잃게/,
    };
    for (const locale of LOCALES) for (const [path, out] of outputs(locale, [...BILLING_ADDED, ...STATUS_CHANGED, ...NAMED_BY_NEW_LINES])) expect(out, `${locale}:${path}`).not.toMatch(PUSH[locale]);
    expect('Premium · solo hoy').toMatch(PUSH.es); // self-checks
    expect('프리미엄 오늘만').toMatch(PUSH.ko);
  });
});

/**
 * F-ENT-003 section 3.7's learner banned fixture (its own `access-banned-fixture.ts` arrives with
 * E3-8), with es / ko equivalents. Two of its entries are left out here because F-BILL-002 section
 * 4.7 says them on purpose: the plan's name "Family Plan" (BY-D9: "From your family's Family Plan.")
 * and the digit of "Stage 1" (the free set). Every other entry applies, so the Plan screen and the
 * Profile card never say Premium, price, buy, pay, trial or unlock (§4.7, §6.5).
 */
const LEARNER_FIXTURE: Record<UiLocale, readonly string[]> = {
  en: [
    'premium', 'price', 'prices', 'buy', 'pay', 'trial', 'expired', 'ended', 'locked', 'unlock', 'unlocked', 'left', 'only', 'remaining', 'late',
    'skipped', 'wrong', 'not in your plan', 'family lifetime', 'group license', 'day', 'days',
  ],
  es: [
    'premium', 'precio', 'precios', 'comprar', 'compra', 'pagar', 'paga', 'prueba', 'vencido', 'vencida', 'terminado', 'terminada', 'bloqueado',
    'bloqueada', 'desbloquear', 'desbloquea', 'desbloqueado', 'quedan', 'restante', 'restantes', 'solo', 'sólo', 'tarde', 'saltado', 'incorrecto',
    'día', 'días',
  ],
  ko: ['프리미엄', '가격', '구매', '결제하', '결제해', '체험', '만료', '종료', '잠금 해제', '잠겨', '남은', '남았', '밖에', '늦은', '건너뛴', '틀린', '플랜에 없'],
};
/** The learner-reachable new keys: the Plan screen and the Profile card (kept keys too; B-9 deletes premium / unlocked / unlock). */
const LEARNER_PATHS = [
  ...PLAN_SCREEN,
  ...PLAN_SCREEN_B9,
  ...PROFILE_ADDED,
  ...A11Y_ADDED,
  'learner.profile.plan.free',
  'learner.profile.plan.freeNote',
  'learner.profile.plan.allOpen',
  'learner.profile.plan.pillActive',
  'learner.profile.plan.pillFree',
];

function fixtureHit(text: string, locale: UiLocale): string | null {
  const lower = text.toLowerCase();
  if (locale === 'ko') return LEARNER_FIXTURE.ko.find((word) => lower.includes(word)) ?? null;
  const haystack = ` ${lower.split(/[^a-zà-ɏ0-9]+/).filter((t) => t !== '').join(' ')} `;
  return LEARNER_FIXTURE[locale].find((word) => haystack.includes(` ${word} `)) ?? null;
}

describe('learner-reachable words (§4.7, §4.8, §6.5)', () => {
  it('the fixture catches what it bans (self-check)', () => {
    expect(fixtureHit("You're on Premium.", 'en')).toBe('premium');
    expect(fixtureHit('Unlock the journey', 'en')).toBe('unlock');
    expect(fixtureHit('Desbloquea el viaje', 'es')).toBe('desbloquea');
    expect(fixtureHit('잠금 해제하기', 'ko')).toBe('잠금 해제');
    expect(fixtureHit('Everything is open.', 'en')).toBeNull();
  });

  it('caregiver.plan and learner.profile.plan pass the learner fixture and the shared lists, in every locale', () => {
    for (const locale of LOCALES) {
      for (const [path, out] of outputs(locale, LEARNER_PATHS)) {
        expect(fixtureHit(out, locale), `${locale}:${path}: ${out}`).toBeNull();
        expect(findBannedWord(out, locale, 'learner'), `${locale}:${path}: ${out}`).toBeNull();
        expect(out, `${locale}:${path}`).not.toMatch(/%|\d+ ?\/ ?\d+/);
      }
    }
  });

  it('ko learner-reachable words never say 보호자 (guardian): the family audience is any age (owner decision)', () => {
    for (const [path, out] of outputs('ko', LEARNER_PATHS)) expect(out, `ko:${path}`).not.toMatch(/보호자/);
  });

  it('self-audience strings never say grown-up', () => {
    const GROWN_UP: Record<UiLocale, RegExp> = { en: /grown-?up/i, es: /\badult[oa]s?\b|persona adulta/i, ko: /보호자|어른/ };
    const selfPaths = LEARNER_PATHS.filter((path) => path.endsWith('.self'));
    expect(selfPaths.length).toBe(6);
    for (const locale of LOCALES) for (const [path, out] of outputs(locale, selfPaths)) expect(out, `${locale}:${path}`).not.toMatch(GROWN_UP[locale]);
  });

  it('what a native build renders names no web, website, browser, billing page or console (§4.8)', () => {
    const DENY: Record<UiLocale, readonly string[]> = {
      en: ['web', 'website', 'browser', 'hangulroute.com', 'billing page', 'console'],
      es: ['web', 'sitio', 'navegador', 'hangulroute.com', 'página de facturación', 'consola'],
      ko: ['웹', '사이트', '브라우저', 'hangulroute.com', '결제 페이지', '콘솔'],
    };
    // Web only: the Open billing block and its failure line (B-9 renders them under Platform.OS === 'web').
    const nativePaths = LEARNER_PATHS.filter((path) => !path.startsWith('caregiver.plan.openBilling.') && path !== 'caregiver.plan.openFailed');
    expect(nativePaths).toContain('caregiver.plan.free.open');
    for (const locale of LOCALES) {
      for (const [path, out] of outputs(locale, nativePaths)) {
        const lower = ` ${out.toLowerCase()} `;
        for (const word of DENY[locale]) {
          const hit = locale === 'ko' ? lower.includes(word) : new RegExp(`(^|[^a-zà-ɏ])${word.replace(/\./g, '\\.')}([^a-zà-ɏ]|$)`).test(lower);
          expect(hit, `${locale}:${path}: "${word}" in ${out}`).toBe(false);
        }
      }
    }
  });
});

describe('caregiver.plan hand-off lines (F-BILL-002 B-9, web only)', () => {
  it('words the line after the PIN and the offline line in English', () => {
    expect(p.gateDone).toBe('PIN accepted. Tap Open billing again.');
    expect(p.needsConnection).toBe('Opening billing needs a connection.');
  });

  it('every locale has both, in its own language, with no price and no grown-up wording', () => {
    for (const [path, out] of outputs('ko', PLAN_SCREEN_B9)) expect(HANGUL.test(out), `ko:${path}: ${out}`).toBe(true);
    for (const path of PLAN_SCREEN_B9) expect(renderings('es', path), `es:${path}`).not.toEqual(renderings('en', path));
    for (const locale of LOCALES) {
      for (const [path, out] of outputs(locale, PLAN_SCREEN_B9)) {
        expect(out.trim().length, `${locale}:${path}`).toBeGreaterThan(0);
        expect(out, `${locale}:${path}`).not.toMatch(/[$€£₩]\s?\d|grown-?up|adult[oa]s?|보호자|어른/i);
      }
    }
  });
});

/** F-BILL-002 B-9 (§6.4): the price-bearing paywall's keys are deleted with their es / ko entries; two move to `caregiver.plan`. */
const REMOVED_IN_B9 = [
  'caregiver.paywall',
  'caregiver.audience.shared.paywallBuyOnWeb',
  'caregiver.audience.shared.paywallBuyLater',
  'caregiver.audience.shared.promoHint',
  'a11y.familyOffer',
  'learner.profile.plan.premium',
  'learner.profile.plan.unlocked',
  'learner.profile.plan.unlock',
];

describe('keys removed in B-9 (§6.4)', () => {
  it('are gone from every locale', () => {
    for (const locale of LOCALES) {
      for (const path of REMOVED_IN_B9) expect(lookup(getMessages(locale), path), `${locale}:${path}`).toBeUndefined();
    }
    for (const [name, overlay] of Object.entries({ es, ko })) {
      for (const path of REMOVED_IN_B9) expect(lookup(overlay, path), `${name}:${path}`).toBeUndefined();
    }
  });

  it('the two kept lines live on under caregiver.plan with the same English', () => {
    expect(en.caregiver.plan.learnerFallback).toBe('Your learner');
    expect(en.caregiver.plan.free.open).toBe('Stage 1 is always free.');
  });

  it('nothing in the samples table still names a removed key', () => {
    for (const path of Object.keys(SAMPLES)) {
      for (const gone of REMOVED_IN_B9) expect(path === gone || path.startsWith(`${gone}.`), path).toBe(false);
    }
  });
});
