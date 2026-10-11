import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCALES } from '../locales';
import { en } from '../messages/en';
import { PSEUDO_LOCALE, pseudoText } from '../pseudo';
import { getMessages, type MessageLocale } from '../resolve';
import type { Messages } from '../types';

// F-I18N-001 PR 10a: the console pages (sign-in, start, home, space, relink) and the shell read
// the dictionary. English is the source and must render exactly what the pages hard-coded
// before (§3.4 rule 1), so every value below is the former literal, byte for byte, except the
// counts F-I18N-001 §10 moved to plural() ("1 learner", "1 card", "1 hasn't synced"; see the
// block at the end).
const c = getMessages('en').console;

describe('console shell (ui.tsx)', () => {
  it('keeps the header words', () => {
    expect(c.shell.backToSite).toBe('← Hangul Route');
    expect(c.shell.home).toBe('Console');
    expect(c.shell.account.cta).toBe('Account');
    expect(c.shell.billing.cta).toBe('Billing');
    expect(c.shell.signOut.cta).toBe('Sign out');
    expect(c.shell.noApi).toBe('The console needs an API address (NEXT_PUBLIC_API_BASE_URL) on this build.');
  });
});

describe('space kinds (routing.ts KIND_LABEL, KIND_GROUP)', () => {
  it('names each kind and its home-page group', () => {
    expect(c.kind.label).toEqual({ family: 'Family', class: 'Class', school: 'School' });
    expect(c.kind.group).toEqual({ family: 'Family', class: 'Classes', school: 'School' });
  });
});

describe('sign-in page (teach/page.tsx)', () => {
  it('keeps the title, the dev form and the links', () => {
    const s = c.signIn;
    expect(s.title).toBe('Grown-ups sign in');
    expect(s.panelLabel).toBe('Sign in');
    expect(s.accountId).toEqual({ label: 'Account id', placeholder: 'teacher-kim' });
    expect(s.displayName).toEqual({ label: 'Your name', placeholder: 'Ms Kim' });
    expect(s.email).toEqual({ label: 'Email (optional)', placeholder: 'kim@example.com' });
    expect(s.submit.cta).toBe('Continue');
    expect(s.submitting.cta).toBe('Signing in…');
    expect(s.backToSite).toBe('Back to Hangul Route');
  });
});

describe('start page (teach/start/page.tsx, routing.ts ROLE_CARDS and prefillName)', () => {
  it('keeps the role step', () => {
    const s = c.start;
    expect(s.title).toBe('New space');
    expect(s.roleTitle).toBe('Who are you?');
    expect(s.roleLabel).toBe('Role');
    expect(s.roles.family).toEqual({ title: 'Parent / caregiver', line: 'Home — my kids' });
    expect(s.roles.class).toEqual({ title: 'Teacher', line: 'My class' });
    expect(s.roles.school).toEqual({ title: 'School admin', line: 'Teachers and classes' });
    expect(s.continue.cta).toBe('Continue');
    expect(s.back.cta).toBe('Back');
  });

  it('keeps the name step, one title per kind', () => {
    const s = c.start;
    expect(s.nameTitle).toEqual({ family: 'Name your family', class: 'Name your class', school: 'Name your school' });
    expect(s.nameLabel).toBe('Space name');
    expect(s.classJoinHint).toBe('Students join with a code — no accounts for kids.');
    expect(s.create.cta).toBe('Create');
    expect(s.creating.cta).toBe('Creating…');
    expect(s.signInAgain).toBe('Please sign in again.');
    expect(s.createFailed).toBe("Couldn't create it yet.");
  });

  it('keeps the code step', () => {
    expect(c.start.codeTitle).toBe('Your class code');
    expect(c.start.goToClass.cta).toBe('Go to my class');
    expect(c.joinCode.copy.cta).toBe('Copy');
    expect(c.joinCode.copied.cta).toBe('Copied');
  });

  it('prefills a space name from the grown-up name, or a default', () => {
    const p = c.start.prefill;
    expect(p.family('Kim')).toBe('Kim family');
    expect(p.familyDefault).toBe('Our family');
    expect(p.class).toBe('Class A');
    expect(p.school('Seoul Hangul')).toBe('Seoul Hangul school');
    expect(p.schoolDefault).toBe('Our school');
  });
});

describe('home page (teach/home/page.tsx)', () => {
  it('keeps the greeting, the list words and the buttons', () => {
    const h = c.home;
    expect(h.title('Ms Kim')).toBe('Hi, Ms Kim');
    expect(h.lastList).toBe('Showing the last list we loaded.');
    expect(h.archived).toBe('(archived)');
    expect(h.open.cta).toBe('Open →');
    expect(h.newSpace.cta).toBe('+ New space');
  });
});

describe('space page (teach/space/page.tsx)', () => {
  const s = c.space;

  it('titles the roster with the member count, worded per kind, through plural()', () => {
    expect(s.loading).toBe('Loading…');
    expect(s.title.family('Kim family', 1)).toBe('Kim family · 1 learner');
    expect(s.title.family('Kim family', 2)).toBe('Kim family · 2 learners');
    expect(s.title.class('Class A', 1)).toBe('Class A · 1 student');
    expect(s.title.class('Class A', 2)).toBe('Class A · 2 students');
    expect(s.title.class('Class A', 0)).toBe('Class A · 0 students');
    expect(s.title.school('Seoul school', 1)).toBe('Seoul school · 1 member');
    expect(s.title.school('Seoul school', 2)).toBe('Seoul school · 2 members');
    expect(s.title.school('Seoul school', 40)).toBe('Seoul school · 40 members');
  });

  it('keeps the errors and the code panel', () => {
    expect(s.forbidden).toBe("This space isn't yours to view.");
    expect(s.gone).toBe('This space is gone.');
    expect(s.regenerateAsk('Class A')).toBe('Make a new code for Class A?');
    expect(s.regenerateFailed).toBe("Couldn't make a new code right now.");
    expect(s.joinCodeLabel).toBe('Join code');
    expect(s.codeLabel).toEqual({ family: 'Family code', class: 'Class code', school: 'School code' });
    expect(s.regenerate.cta).toBe('Regenerate');
    expect(s.createCode.cta).toBe('Create a code');
    expect(s.upgrade).toBe('Upgrade');
  });

  it('words the weekly roll-up as whole sentences', () => {
    expect(s.week.title).toBe('This week');
    expect(s.week.practiced(1, 3)).toBe('1 of 3 practiced this week');
    expect(s.week.anchor('82%')).toBe('Stage 1 anchor: 82%');
    expect(s.week.revisit('a · b')).toBe('Jamo to revisit together: a · b');
    expect(s.week.notSynced(1)).toBe("1 hasn't synced in a week");
    expect(s.week.notSynced(2)).toBe("2 haven't synced in a week");
  });

  it('keeps the action row, with a plural for pending re-link requests', () => {
    expect(s.openPlan.label('Week 1')).toBe('Plan: Week 1');
    expect(s.relinkRequests.cta).toBe('Re-link requests');
    expect(s.relinkPending.cta(1)).toBe('1 re-link request');
    expect(s.relinkPending.cta(2)).toBe('2 re-link requests');
    expect(s.settings.cta).toBe('Settings');
  });

  it('keeps the student cards', () => {
    expect(s.studentsLabel).toBe('Students');
    expect(s.recentFirst).toBe('Most recent activity first');
    expect(s.learner.lastActive('yesterday')).toBe('Last active yesterday');
    expect(s.learner.questsCards(3, 24, 1)).toBe('Quests 3 / 24 · 1 card');
    expect(s.learner.questsCards(3, 24, 2)).toBe('Quests 3 / 24 · 2 cards');
    expect(s.learner.questsCards(0, 24, 0)).toBe('Quests 0 / 24 · 0 cards');
    expect(s.learner.minutesThisWeek(14)).toBe('14 min this week');
    expect(s.learner.revisit('a · b')).toBe('Revisit: a · b');
    expect(s.learner.planReadout('Week 1', '1 / 3')).toBe('Week 1: 1 / 3');
    expect(s.learner.joined('today')).toBe('joined today');
  });
});

describe('relink page (teach/space/relink/page.tsx, relink.ts)', () => {
  const r = c.relink;

  it('keeps the title, the back link and the notes', () => {
    expect(r.title).toBe('Re-link requests');
    expect(r.titleFor('Kim family')).toBe('Kim family · re-link requests');
    expect(r.back('Kim family')).toBe('← Back to Kim family');
    expect(r.back(null)).toBe('← Back to the space');
    expect(r.approved('Mina')).toBe('Mina can open their new device now.');
    expect(r.denied('Mina')).toBe('Closed. Mina\'s device will say "ask your teacher".');
    expect(r.issueAsk('Mina')).toBe('Issue a new rescue code for Mina?');
    expect(r.issueFailed).toBe("Couldn't issue a code right now.");
  });

  it('keeps the request card', () => {
    expect(r.askingToBe('Mina')).toBe('Someone is asking to be Mina');
    expect(r.device).toBe('device');
    expect(r.approve.cta).toBe('Approve');
    expect(r.deny.cta).toBe('Deny');
  });

  it('keeps the rescue-code panel', () => {
    expect(r.anotherWay).toBe('Another way');
    expect(r.done.cta).toBe('Done');
    expect(r.learnerLabel).toBe('Learner');
    expect(r.chooseLearner).toBe('Choose a learner…');
    expect(r.issue.cta).toBe('Issue a new rescue code');
    expect(r.cardsLabel).toBe('Cards and progress');
  });

  it('keeps the timing labels and the failure notes', () => {
    expect(r.expired).toBe('expired');
    expect(r.expiresIn(9)).toBe('expires in 9 min');
    expect(r.askedJustNow).toBe('asked just now');
    expect(r.askedAgo(2)).toBe('asked 2 min ago');
    expect(r.closed).toBe('This request already closed — the learner can ask again.');
    expect(r.failed).toBe("Didn't go through. Try again.");
  });
});

describe('fragments retired by whole-sentence messages', () => {
  it('drops the COPY fragments the space page used to glue around a number', () => {
    for (const key of ['practicedThisWeek', 'anchor', 'revisitTogether', 'notSyncedWeek']) {
      expect(Object.keys(en.console)).not.toContain(key);
    }
  });
});

// The pages split these messages around their argument (`aroundSlot`, apps/web/src/lib/i18n/slot.ts)
// to style it: a bold name, or taught jamo marked lang="ko". The split needs the argument exactly
// once, unchanged, in every locale, including the pseudo-locale wrapper.
const SLOTTED: readonly [string, (m: Messages) => (value: string) => string][] = [
  ['console.relink.askingToBe', (m) => m.console.relink.askingToBe],
  ['console.space.week.revisit', (m) => m.console.space.week.revisit],
  ['console.space.learner.revisit', (m) => m.console.space.learner.revisit],
  ['console.lecture.source.revisitWith', (m) => m.console.lecture.source.revisitWith],
  ['console.school.footer', (m) => m.console.school.footer],
];

describe('messages split around their argument (aroundSlot)', () => {
  const SENTINEL = '\u0000';
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('use the argument exactly once in every locale and in en-XA', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const locales: readonly MessageLocale[] = [...LOCALES, PSEUDO_LOCALE];
    for (const locale of locales) {
      const messages = getMessages(locale);
      if (locale === PSEUDO_LOCALE) expect(messages.console.shell.home).toMatch(/^\[/);
      for (const [path, pick] of SLOTTED) {
        const out = pick(messages)(SENTINEL);
        expect(out.split(SENTINEL).length - 1, `${locale}:${path}`).toBe(1);
      }
    }
  });
});

// F-I18N-001 §10 (console counts): the counts PR 10a kept byte-identical ("1 learners", "1 cards",
// "1 haven't synced") go through plural() now. In every locale, the n = 1 and n = 2 rows show their
// number exactly once; en, es and en-XA word them differently (ko has no grammatical plural, so its
// two rows may match).
const COUNTED: readonly [string, (m: Messages, n: number) => string][] = [
  ['console.space.title.family', (m, n) => m.console.space.title.family('Kim family', n)],
  ['console.space.title.class', (m, n) => m.console.space.title.class('Class A', n)],
  ['console.space.title.school', (m, n) => m.console.space.title.school('Seoul school', n)],
  ['console.space.week.notSynced', (m, n) => m.console.space.week.notSynced(n)],
  ['console.space.learner.questsCards', (m, n) => m.console.space.learner.questsCards(7, 24, n)],
  ['console.planCounts.items', (m, n) => m.console.planCounts.items(n)],
  ['console.planCounts.targets (family)', (m, n) => m.console.planCounts.targets('family', n)],
  ['console.planCounts.targets (class)', (m, n) => m.console.planCounts.targets('class', n)],
  ['console.planCounts.targets (school)', (m, n) => m.console.planCounts.targets('school', n)],
  ['console.spaceCounts.students', (m, n) => m.console.spaceCounts.students(n)],
  ['console.plan.summary.some.family', (m, n) => m.console.plan.summary.some.family(7, n)],
  ['console.plan.summary.some.class', (m, n) => m.console.plan.summary.some.class(7, n)],
  ['console.plan.summary.some.school', (m, n) => m.console.plan.summary.some.school(7, n)],
  ['console.billing.seats', (m, n) => m.console.billing.seats(n)],
  ['console.school.classes.line', (m, n) => m.console.school.classes.line('Ms Park', n, 'today', true)],
  ['console.parent.child.quests', (m, n) => m.console.parent.child.quests(n)],
  ['console.parent.child.cards', (m, n) => m.console.parent.child.cards(n)],
];

describe('console counts use plural() in every locale (en, es, ko, en-XA)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('n = 1 and n = 2 rows', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const locales: readonly MessageLocale[] = [...LOCALES, PSEUDO_LOCALE];
    for (const locale of locales) {
      const messages = getMessages(locale);
      if (locale === PSEUDO_LOCALE) expect(messages.console.shell.home).toMatch(/^\[/);
      for (const [path, count] of COUNTED) {
        const one = count(messages, 1);
        const two = count(messages, 2);
        // The count is the only "1" / "2" in the row (questsCards' other numbers are 7 and 24).
        expect(one.match(/\b1\b/g), `${locale}:${path}(1) = ${one}`).toHaveLength(1);
        expect(two.match(/\b2\b/g), `${locale}:${path}(2) = ${two}`).toHaveLength(1);
        if (locale !== 'ko') expect(one.replace(/\b1\b/, '2'), `${locale}:${path} has a singular`).not.toBe(two);
      }
    }
  });

  it('en-XA wraps the plural-selected English', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const pseudo = getMessages(PSEUDO_LOCALE);
    for (const [path, count] of COUNTED) {
      expect(count(pseudo, 1), path).toBe(pseudoText(count(getMessages('en'), 1)));
      expect(count(pseudo, 2), path).toBe(pseudoText(count(getMessages('en'), 2)));
    }
  });
});
