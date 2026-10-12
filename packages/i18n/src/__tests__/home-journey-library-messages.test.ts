import { RaritySchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-I18N-001 PR 6a: Home, Journey, Library and CardDetail move into the dictionary
// with their English wording unchanged (§3.4 rule 1: no visible change).
const m = getMessages('en');

describe('learner.home (English wording as shipped)', () => {
  const h = m.learner.home;

  it('greets by name, with a neutral fallback', () => {
    expect(h.greeting('Mina')).toBe('Hi, Mina!');
    expect(h.greeting(null)).toBe('Hi, friend!');
    expect(h.subtitle).toBe("Ready for today's quest?");
    expect(h.profileLabel).toBe('Profile');
  });

  it('streak pill uses plural(), not a suffix ternary', () => {
    expect(h.streak.pill(0)).toBe('Streak 0 days');
    expect(h.streak.pill(1)).toBe('Streak 1 day');
    expect(h.streak.pill(5)).toBe('Streak 5 days');
  });

  it('keeps the card and star pills exactly as they were', () => {
    expect(h.cards.pill(1)).toBe('1 cards');
    expect(h.cards.pill(12)).toBe('12 cards');
    expect(h.stars.pill(3)).toBe('3★ quests');
  });

  it('keeps the section headings, progress, homework and tip lines', () => {
    expect(h.mission.heading).toBe('Today with Hoya');
    expect(h.progress.heading).toBe('Stage 1 progress');
    expect(h.progress.label(1, 24)).toBe('1 of 24 quests');
    expect(h.homework.title).toBe('Homework');
    expect(h.homework.due(2)).toBe('2 to do today');
    expect(h.tip).toBe("Tip — finish today's quest to keep your streak alive!");
    expect(h.recentStars).toBe('Recent stars');
  });
});

describe('learner.home.catchUp (F-STORY-006 §3.5, PR 6.5c)', () => {
  const c = m.learner.home.catchUp;

  it('says how many cards Hoya found, as a whole sentence with plural()', () => {
    expect(c.line(1)).toBe('Hoya found 1 card you already earned!');
    expect(c.line(22)).toBe('Hoya found 22 cards you already earned!');
  });

  it('names the one action', () => {
    expect(c.cta).toBe('See my cards');
  });

  it('never states a fraction, a percentage or what is still missing (D3)', () => {
    for (const out of [c.line(1), c.line(22), c.cta]) {
      expect(out).not.toMatch(/\d+\s*(\/|of)\s*\d+/);
      expect(out).not.toMatch(/%/);
      expect(out.toLowerCase()).not.toMatch(/\b(missed|missing|left|remaining|behind|incomplete|failed)\b/);
    }
  });
});

describe('learner.journey', () => {
  it('keeps the heading, intro and notes', () => {
    const j = m.learner.journey;
    expect(j.title).toBe('Heritage Journey');
    expect(j.intro).toBe('7 stages × 5 themes. Draw your own route.');
    expect(j.tasteNote).toBe('A taste of this stage is open now. More episodes are coming.');
    expect(j.how.title).toBe('How the journey works');
    expect(j.how.body).toBe(
      'Each cell is one episode. Finish every quest in a cell to complete it and earn its Heritage cards. More stages open as the journey grows.',
    );
    // F-PLC-001 section 3.7: one sentence about the pin and the outline, once a level check is stored.
    expect(j.how.placement).toBe(
      'The pin shows where you started. A cell with a light outline and a check is one you can skip ahead of. You can still play it any time.',
    );
  });
});

describe('learner.journey has no commerce word (F-ROUTE-001 R-J, OD-8)', () => {
  it('drops the Premium pill: a stage row shows its availability word instead', () => {
    expect(Object.keys(m.learner.journey)).not.toContain('premium');
    for (const locale of ['en', 'es', 'ko'] as const) {
      const journey = getMessages(locale).learner.journey;
      expect(JSON.stringify(journey)).not.toMatch(/premium|price|upgrade/i);
    }
  });
});

describe('learner.journey.panes (F-LAYOUT-001 §3.13)', () => {
  it('names the two panes as landmarks', () => {
    expect(m.learner.journey.panes.master).toBe('Journey map');
    expect(m.learner.journey.panes.detail).toBe('Episode details');
  });
});

describe('learner.library', () => {
  const l = m.learner.library;

  it('keeps the heading, counts, filter, locked and how-to lines', () => {
    expect(l.title).toBe('Heritage Library');
    expect(l.collected.line(1, 24)).toBe('1 of 24 collected');
    expect(l.collected.pill(1, 24)).toBe('1/24');
    expect(l.filterAll).toBe('All');
    expect(l.locked).toBe('Locked');
    expect(l.how.title).toBe('How to collect more');
    expect(l.how.body).toBe('Finish quests to unlock cards.');
  });

  it('says how to earn a locked card, one sentence per award rule, never how far along (F-STORY-006 §3.7)', () => {
    expect(l.earnHint.episode('Meet the Letters')).toBe('Finish the episode: Meet the Letters');
    expect(l.earnHint.story('The Sun and the Moon')).toBe('Finish the story: The Sun and the Moon');
    expect(l.earnHint.stage(1)).toBe('Finish every quest in Stage 1');
    expect(l.earnHint.welcome).toBe('A welcome gift from Hoya');
    expect(l.earnHint.set('Seasons and Tales')).toBe('Collect every card from the Seasons and Tales stories');
  });

  it('names every rarity as the app showed it, keyed by the schema enum', () => {
    expect(Object.keys(l.rarity).sort()).toEqual([...RaritySchema.options].sort());
    expect(RaritySchema.options.map((r) => l.rarity[r])).toEqual(['common', 'uncommon', 'rare', 'legendary']);
  });
});

describe('learner.cardDetail', () => {
  it('keeps the flip hints, buttons and messages', () => {
    const c = m.learner.cardDetail;
    expect(c.notFound).toBe('Card not found.');
    expect(c.flip.front).toBe('tap to flip');
    expect(c.flip.back).toBe('tap to flip back');
    expect(c.hear.cta).toBe('Hear it');
    expect(c.share.cta).toBe('Share');
    expect(c.share.error).toBe("Couldn't make the picture this time. Try again?");
  });
});

describe('learner.library.panes and learner.cardDetail.earn (F-LAYOUT-001 §3.6, §3.13)', () => {
  it('names the two Library panes as landmarks', () => {
    expect(m.learner.library.panes.master).toBe('Card gallery');
    expect(m.learner.library.panes.detail).toBe('Card details');
  });

  it('says how a locked card is earned: the quest and its stars, or later', () => {
    const e = m.learner.cardDetail.earn;
    expect(e.title).toBe('How to earn it');
    expect(e.quest('Meet g, n, d, l', 2)).toBe('Get 2 or more stars in Meet g, n, d, l to earn this card.');
    expect(e.quest('Meet g, n, d, l', 1)).toBe('Get 1 star or more in Meet g, n, d, l to earn this card.');
    expect(e.later).toBe('This card comes in a later quest.');
  });
});

describe('accessibility labels of these screens', () => {
  it('are the English labels as shipped', () => {
    expect(m.a11y.profileEntry).toBe('Profile and settings');
    expect(m.a11y.openHomework).toBe('Open homework');
    expect(m.a11y.missionCard('Meet Hoya', 'Say hello', false)).toBe('Meet Hoya. Say hello.');
    expect(m.a11y.missionCard('Meet Hoya', 'Say hello', true)).toBe('Meet Hoya. Say hello. Collected.');
    expect(m.a11y.gridCell('Letters', 'hangul', false)).toBe('Letters episode for hangul');
    expect(m.a11y.gridCell('Letters', 'hangul', true)).toBe('Letters episode for hangul, coming soon');
    expect(m.a11y.gridCellMarked('Letters', 'hangul', true, false)).toBe('Letters episode for hangul. You started here.');
    expect(m.a11y.gridCellMarked('Letters', 'hangul', false, true)).toBe(
      'Letters episode for hangul. You can skip ahead here, and it is still open to play.',
    );
    expect(m.a11y.gridCellMarked('Letters', 'hangul', true, true)).toBe(
      'Letters episode for hangul. You started here. You can skip ahead here, and it is still open to play.',
    );
    expect(m.a11y.lockedCard).toBe('Locked card');
    expect(m.a11y.flipToBack).toBe('Tap to flip card to back');
    expect(m.a11y.flipToFront).toBe('Tap to flip card to front');
    expect(m.a11y.shareCard).toBe('Share this card');
  });
});

// en-XA (F-I18N-001 §3.11): every new key, function messages included, survives pseudo-localisation.
describe('en-XA covers the new keys', () => {
  const NEW_PREFIXES = ['learner.home', 'learner.journey', 'learner.library', 'learner.cardDetail'];
  const NEW_A11Y = [
    'a11y.profileEntry', 'a11y.openHomework', 'a11y.missionCard', 'a11y.gridCell', 'a11y.gridCellMarked', 'a11y.lockedCard',
    'a11y.flipToBack', 'a11y.flipToFront', 'a11y.shareCard',
  ];
  const paths = leafPaths(m).filter((p) => NEW_PREFIXES.some((x) => p.startsWith(`${x}.`)) || NEW_A11Y.includes(p));
  const pseudo = pseudoLocalize(m);

  it('finds the new leaves', () => {
    expect(paths.length).toBeGreaterThan(30);
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
