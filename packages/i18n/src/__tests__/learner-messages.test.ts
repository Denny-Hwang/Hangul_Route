import { AvatarKindSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { getMessages } from '../resolve';

// F-I18N-001 PR 5: the first-run and settings surfaces move into the dictionary
// with their English wording unchanged (§3.4 rule 1: no visible change).
const m = getMessages('en');

describe('learner.welcome (English wording as shipped)', () => {
  it('keeps the greeting, invitation, CTAs and trust line', () => {
    expect(m.learner.welcome).toEqual({
      title: "Hi! I'm Hoya.",
      invitation: 'Want to learn Korean letters with me? It only takes a few minutes a day.',
      cta: "Let's start",
      restore: 'I already have progress',
      trust: 'Start Korean from zero. Built with kids, parents, and grandparents in mind.',
    });
  });
});

describe('learner.language (shared by the Welcome row and the Profile card)', () => {
  it('names the group and builds the sheet sentences from an endonym', () => {
    expect(m.learner.language.groupLabel).toBe('Language');
    expect(m.learner.language.sameAsDevice('English')).toBe('Same as this device (English)');
    expect(m.learner.language.confirmProfile('Español')).toBe('Use Español for this profile?');
    expect(m.learner.language.confirmDevice('한국어')).toBe('Use 한국어 on this device?');
    expect(m.learner.language.confirmUse('English')).toBe('Use English');
    expect(m.learner.language.confirmBack('English')).toBe('Back to English');
  });
});

describe('learner.createProfile name hints', () => {
  it('moved verbatim from nameHint()', () => {
    expect(m.learner.createProfile.nameHint.tooLong(12)).toBe('Names can be up to 12 letters.');
    expect(m.learner.createProfile.nameHint.unsupportedCharacter).toBe("Please use letters, numbers, spaces, ' or -.");
  });
});

describe('learner.avatars (the cub labels, keyed by AvatarKind)', () => {
  it('has exactly one label per avatar kind, none repeated (colour is never the only cue)', () => {
    expect(Object.keys(m.learner.avatars).sort()).toEqual([...AvatarKindSchema.options].sort());
    const labels = Object.values(m.learner.avatars);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).toMatch(/^[A-Za-z ]+$/);
  });

  it('keeps the English labels in catalogue order', () => {
    expect(AvatarKindSchema.options.map((kind) => m.learner.avatars[kind])).toEqual([
      'Book Tiger',
      'Home Tiger',
      'Feast Tiger',
      'Mountain Tiger',
      'Craft Tiger',
    ]);
  });
});

describe('learner.firstQuest', () => {
  it('keeps the heading, bubbles and CTA', () => {
    expect(m.learner.firstQuest.title).toBe('Your first card is waiting.');
    expect(m.learner.firstQuest.bubble).toBe("In your first quest you'll meet Korean letters and earn a Heritage card.");
    expect(m.learner.firstQuest.bubbleNoQuest).toBe('Let me show you around first!');
    expect(m.learner.firstQuest.firstUp).toBe('First up');
    expect(m.learner.firstQuest.cta).toBe('Start my journey');
  });

  it('counts with plural(), never a suffix ternary', () => {
    expect(m.learner.firstQuest.summary(1, 5, 1)).toBe('1 quest · about 5 minutes · 1 card waiting');
    expect(m.learner.firstQuest.summary(3, 12, 2)).toBe('3 quests · about 12 minutes · 2 cards waiting');
    expect(m.learner.firstQuest.summary(0, 1, 0)).toBe('0 quests · about 1 minute · 0 cards waiting');
  });

  it('joins the quest title and blurb', () => {
    expect(m.learner.firstQuest.questLine('Meet Hoya', null)).toBe('Meet Hoya');
    expect(m.learner.firstQuest.questLine('Meet Hoya', '')).toBe('Meet Hoya');
    expect(m.learner.firstQuest.questLine('Meet Hoya', 'Say hello')).toBe('Meet Hoya — Say hello');
  });
});

describe('a11y tab labels', () => {
  it('are the three tabs as shipped', () => {
    expect(m.a11y.tabs).toEqual({ home: 'Today', journey: 'Journey', library: 'Library' });
    expect(m.a11y.goBack).toBe('Go back');
  });
});

describe('learner.profile (English wording as shipped)', () => {
  const p = m.learner.profile;

  it('keeps the heading and profile tiles', () => {
    expect(p.title).toBe('Profiles & settings');
    expect(p.switchTo('Suni')).toBe('Switch to Suni');
    expect(p.playingNow).toBe('Playing now');
    expect(p.addProfile).toBe('+ Add a profile');
    expect(p.addProfileName).toBe('Add a profile');
  });

  it('names whose stats these are, with a neutral fallback', () => {
    expect(p.statsTitle('Suni')).toBe('Suni stats');
    expect(p.statsTitle(null)).toBe('Your stats');
    expect([p.stats.quests, p.stats.cards, p.stats.threeStar]).toEqual(['Quests done', 'Cards', '3-star quests']);
  });

  it('keeps the sound and plan cards', () => {
    expect([p.sound.label, p.sound.on, p.sound.off]).toEqual(['Sound', 'On', 'Off']);
    expect(p.plan.premium).toBe('Premium');
    expect(p.plan.free).toBe('Free plan');
    expect(p.plan.unlocked(null)).toBe('The full journey is unlocked.');
    expect(p.plan.unlocked('Mrs. Kim')).toBe('The full journey is unlocked — covered by Mrs. Kim.');
    expect(p.plan.freeNote).toBe('Stage 1 is free. More stages are on the way.');
    expect([p.plan.pillActive, p.plan.pillFree, p.plan.unlock]).toEqual(['Active', 'Free', 'Unlock the journey']);
    expect([p.install.label, p.install.a11yLabel]).toEqual(['Install on this device', 'Install Hangul Route on this device']);
  });

  it('has the Language card and the reading-practice switch', () => {
    expect(p.language.title).toBe('Language');
    expect(p.language.thisProfile).toBe('This profile');
    expect(p.language.deviceDefault).toBe('New profiles and this device start in:');
    expect(p.reading.title).toBe('Reading practice');
    expect(p.reading.hideUntilTap).toBe('Hide romanization until I tap');
  });
});

describe('the dictionary is wired', () => {
  it('exposes learner and caregiver next to common and a11y', () => {
    expect(Object.keys(en).sort()).toEqual(['a11y', 'caregiver', 'common', 'learner']);
  });
});
