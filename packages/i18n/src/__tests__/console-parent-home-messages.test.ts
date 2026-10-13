import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';

/**
 * F-APP-001 A-5b (sections 3.8 and 3.15, Appendix A; design/screens/app-shell/parent-home.md): the
 * family home words, English authored, word for word from the drafts. The join line names the
 * learner app's own labels, passed in from their keys so it follows any rename.
 */
const p = en.console.parentHome;

describe('console.parentHome (the family home)', () => {
  it('has the heading, the minutes line and the card actions', () => {
    expect(p.title).toBe('Family home');
    expect(p.minutes7d(42)).toBe('Minutes, last 7 days: 42');
    expect(p.minutes7d(0)).toBe('Minutes, last 7 days: 0');
    expect(p.child).toEqual({ open: 'Open', seeReport: 'See report', sendNote: 'Send a note', route: 'Learning Route' });
  });

  it('has the family actions', () => {
    expect(p.actions).toEqual({ lessons: 'Lessons', planWeek: 'Plan the week', planTerm: 'Plan the term', settings: 'Family settings', addLearner: 'Add a learner' });
  });

  it('words the empty family with the learner app labels of Profile, Classes & family and Join', () => {
    expect(p.empty.title).toBe('No learner has joined yet.');
    expect(p.empty.line(en.learner.home.profileLabel, en.caregiver.spaces.title, en.caregiver.spaces.join.cta)).toBe(
      'On the learner\'s own device, go to Profile, then Classes & family, then "Join a class", and enter this family code.',
    );
    expect(p.empty.openApp).toBe('Open the app on this device');
  });

  it('has the no-family state and the cross-links', () => {
    expect(p.noFamily).toEqual({ title: "You don't have a family space yet.", setUp: 'Set up my family', goTeacher: 'Go to Classes' });
    expect(p.cross).toEqual({ addClass: 'Also teach a class? Set up a class', toTeacher: 'Your classes are under Teacher' });
  });

  it('names the actions column, asks a caregiver to get the code from the owner, and words a failed copy (A-5b review)', () => {
    expect(p.actionsFor('Kim family')).toBe('Actions for Kim family');
    expect(p.askOwner).toBe('Ask the family owner for a family code.');
    expect(p.copyFailed).toBe("Couldn't copy. The code is on the screen.");
  });

  it('drops the /parent demo words with the demo (OD-4)', () => {
    expect((en.console as Record<string, unknown>).parent).toBeUndefined();
  });

  it('never ranks or compares learners', () => {
    const all = JSON.stringify(p).toLowerCase() + p.minutes7d(3).toLowerCase();
    for (const word of ['best', 'behind', 'rank', 'top', 'average', 'worst', 'kids']) expect(all).not.toContain(word);
  });
});
