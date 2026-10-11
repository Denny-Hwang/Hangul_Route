import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-I18N-001 PR 6b: Episode, Results and Homework (and the prose their logic modules used
// to return) move into the dictionary with their English wording unchanged (§3.4 rule 1).
const m = getMessages('en');

describe('learner.episode (English wording as shipped)', () => {
  const e = m.learner.episode;

  it('keeps the not-found line, coming-soon card and section headings', () => {
    expect(e.notFound).toBe('Episode not found.');
    expect(e.comingSoon.pill).toBe('Coming soon');
    expect(e.comingSoon.title).toBe('Coming soon');
    expect(e.comingSoon.note).toBe('Finish Stage 1 to help Hoya unlock this episode.');
    expect(e.quests.heading).toBe('Quests');
    expect(e.cards.heading).toBe('Cards in this episode');
    expect(e.cards.waiting).toBe('Waiting for you');
  });

  it('keeps the quest buttons and the soft-prerequisite lines', () => {
    expect(e.quests.start.cta).toBe('Start');
    expect(e.quests.playAgain.cta).toBe('Play again');
    expect(e.buildsOn('Meet g, n, d')).toBe('Builds on: Meet g, n, d');
    expect(e.prereq.message('Meet g, n, d')).toBe('This one uses letters from Meet g, n, d. Start there?');
    expect(e.prereq.startThere.cta).toBe('Start there');
    expect(e.prereq.playAnyway.cta).toBe('Play anyway');
  });
});

describe('learner.results (English wording as shipped)', () => {
  const r = m.learner.results;

  it('keeps one headline and one cheer line per tier', () => {
    expect(r.headline).toEqual({
      allDone: 'All done!',
      wonderful: 'Wonderful!',
      great: 'Great!',
      tried: 'You tried!',
    });
    expect(r.cheer).toEqual({
      noGames: 'Play the games next time to earn stars and a card!',
      perfect: 'Perfect! You got every one!',
      nice: 'Nice work! Try one more for three stars.',
      goodStart: 'Good start. Want to play it again?',
      brave: "Brave try! Let's do it together.",
    });
  });

  it('keeps the buttons, the teaser and the new-card lines', () => {
    expect(r.backHome.cta).toBe('Back home');
    expect(r.episodePage.cta).toBe('Episode page');
    expect(r.nextUp.title).toBe('Next up');
    expect(r.nextUp.next.cta).toBe('Play next quest');
    expect(r.nextUp.again.cta).toBe('Try this one again');
    expect(r.nextUp.newLetters).toBe('New letters:');
    expect(r.newCard.title).toBe('New card for your library!');
    expect(r.newCard.announce('Hanbok')).toBe('New card for your library! Hanbok');
    expect(r.newCard.see.cta).toBe('See my card');
    expect(r.newCard.seeA11y('Hanbok')).toBe('See my card: Hanbok');
  });

  it('never shows a number, ratio or percent in a cheer line (F-RVW-001 §3.1)', () => {
    for (const line of Object.values(r.cheer)) expect(line).not.toMatch(/\d|%/);
  });
});

describe('learner.homework (English wording as shipped)', () => {
  const h = m.learner.homework;

  it('keeps the heading, sections and empty states', () => {
    expect(h.title).toBe('Homework');
    expect(h.section).toEqual({ today: 'Today', comingUp: 'Coming up', recentlyDone: 'Recently done' });
    expect(h.allClear.title).toBe('All clear!');
    expect(h.allClear.played).toBe('Hoya suggests a quick review from Today.');
    expect(h.allClear.fresh).toBe('Try your first quest from Today.');
    expect(h.doneEmpty).toBe('Finished homework shows up here.');
    expect(h.questFallback).toBe('Quest');
  });

  it('counts the things to do with plural(), not a suffix ternary', () => {
    expect(h.bubble.none).toBe('Nothing waiting today! Want to play a quest anyway?');
    expect(h.bubble.some(1)).toBe('You have 1 thing to do today.');
    expect(h.bubble.some(3)).toBe('You have 3 things to do today.');
  });

  it('words the due date and the source', () => {
    expect(h.due.today).toBe('Today');
    expect(h.due.tomorrow).toBe('Tomorrow');
    expect(h.due.inDays(1)).toBe('In 1 day');
    expect(h.due.inDays(3)).toBe('In 3 days');
    expect(h.from).toEqual({ parent: 'From home', teacher: 'From class', system: 'From Hoya' });
  });
});

describe('learner.home.mission and learner.journey.availability (left by PR 6a)', () => {
  it('keeps the mission-card words the builder used to return', () => {
    const mission = m.learner.home.mission;
    expect(mission.dailyTest.title).toBe('Quick review');
    expect(mission.subtitle).toEqual({
      replay: 'One more go with Hoya',
      story: 'Story time',
      new: 'Something new today',
      assigned: 'Picked just for you',
      dailyTest: 'About a minute with Hoya',
    });
  });

  it('keeps the stage availability pills', () => {
    const a = m.learner.journey.availability;
    expect([a.open.pill, a.taste.pill, a.soon.pill]).toEqual(['Open', 'Taste', 'Soon']);
  });
});

describe('accessibility labels of these screens', () => {
  it('are the English labels as shipped', () => {
    expect(m.a11y.episodeCard('Hanbok')).toBe('Hanbok card');
    expect(m.a11y.cardWaiting).toBe('A card still waiting to be earned');
    expect(m.a11y.playAgainQuest('Meet Hoya')).toBe('Play again: Meet Hoya');
    expect(m.a11y.homeworkRow('Meet Hoya', 'Today')).toBe('Meet Hoya, Today');
  });
});

// en-XA (F-I18N-001 §3.11): every new key, function messages included, survives pseudo-localisation.
describe('en-XA covers the new keys', () => {
  const NEW_PREFIXES = [
    'learner.episode', 'learner.results', 'learner.homework', 'learner.home.mission', 'learner.journey.availability',
  ];
  const NEW_A11Y = ['a11y.episodeCard', 'a11y.cardWaiting', 'a11y.playAgainQuest', 'a11y.homeworkRow'];
  const paths = leafPaths(m).filter((p) => NEW_PREFIXES.some((x) => p.startsWith(`${x}.`)) || NEW_A11Y.includes(p));
  const pseudo = pseudoLocalize(m);

  it('finds the new leaves', () => {
    expect(paths.length).toBeGreaterThan(50);
  });

  for (const path of paths) {
    it(`${path} is bracketed and at least 40% longer`, () => {
      const value = lookup(pseudo, path);
      const source = lookup(m, path);
      const outputs: Array<[string, string]> = [];
      if (typeof value === 'string' && typeof source === 'string') outputs.push([value, source]);
      else if (typeof value === 'function' && typeof source === 'function') {
        const samples = SAMPLES[path];
        expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
        for (const args of samples ?? []) {
          outputs.push([(value as (...a: unknown[]) => string)(...args), (source as (...a: unknown[]) => string)(...args)]);
        }
      } else throw new Error(`${path} is neither a string nor a function`);
      for (const [out, src] of outputs) {
        expect(out).toBe(pseudoText(src));
        expect(out.startsWith('[') && out.endsWith(']')).toBe(true);
        expect(out.length - 2).toBeGreaterThanOrEqual(Math.ceil(src.length * 1.4));
      }
    });
  }
});
