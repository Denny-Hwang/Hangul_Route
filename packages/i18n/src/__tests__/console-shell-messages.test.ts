import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { getMessages } from '../resolve';

/**
 * F-APP-001 A-5a (sections 3.8 and 3.15; design/screens/app-shell/adult-frame.md, teacher-home.md):
 * the adult frame and the teacher home words, English authored (Appendix A drafts, word for word).
 */
const c = en.console;

describe('console.shell (the adult frame)', () => {
  it('names the way to the learner app, the site links and the personas', () => {
    // AMENDMENTS-DISPLAY-NAV section 7.3: one "Learner app" exit at the right; "Open the learner app" is retired.
    expect(c.shell.backToLearning).toBe('Learner app');
    expect((c.shell as Record<string, unknown>).openLearnerApp).toBeUndefined();
    expect(c.shell.aboutSite).toBe('About Hangul Route');
    expect(c.shell.privacy).toBe('Privacy');
    expect(c.shell.terms).toBe('Terms');
    expect(c.shell.persona).toEqual({ parent: 'Family', teacher: 'Teacher' });
  });

  it('labels every item of the navigation registry', () => {
    expect(c.shell.nav).toEqual({ home: 'Home', reports: 'Reports', notes: 'Notes', classes: 'Classes', lessons: 'Lessons', billing: 'Billing', classReports: 'Class reports' });
  });

  it('labels Class reports in every shipped locale (F-REPORT-001 RP-7c)', () => {
    expect(getMessages('es').console.shell.nav.classReports).toBe('Informes de clase');
    expect(getMessages('ko').console.shell.nav.classReports).toBe('반 리포트');
  });

  it('drops the words of the old console header: Back to site, the disabled Account button and the Billing button', () => {
    const shell = c.shell as Record<string, unknown>;
    expect(shell.backToSite).toBeUndefined();
    expect(shell.account).toBeUndefined();
    expect(shell.billing).toBeUndefined();
    expect(c.shell.signOut.cta).toBe('Sign out');
  });

  it('labels the persona switch group (a11y.shell.personaSwitch)', () => {
    expect(en.a11y.shell.personaSwitch).toBe('Switch between Family and Teacher');
  });
});

describe('console.home (the teacher home)', () => {
  it('has the class row links, New class, the no-class state and the cross-links', () => {
    const h = c.home;
    expect(h.classReport).toBe('Class report');
    expect(h.notes).toBe('Notes');
    expect(h.lessons).toBe('Lessons');
    expect(h.newClass.cta).toBe('+ New class');
    expect(h.noClass).toEqual({ title: "You don't have a class yet.", setUp: 'Set up a class', goFamily: 'Go to Family' });
    expect(h.cross).toEqual({ addFamily: 'Learning at home too? Set up a family space', toFamily: 'Your family is under Family' });
  });

  it('drops "Hi, {name}" and "+ New space" (design pass D8)', () => {
    const home = c.home as Record<string, unknown>;
    expect(home.title).toBeUndefined();
    expect(home.newSpace).toBeUndefined();
  });
});
