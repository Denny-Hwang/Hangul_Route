import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-I18N-001 PR 7a: the Quest player (QuestPlayerScreen, the Check launcher card, the Discover
// step) and the caregiver gating reasons move into the dictionary with their English wording
// unchanged (§3.4 rule 1).
const m = getMessages('en');

describe('learner.quest (English wording as shipped)', () => {
  const q = m.learner.quest;

  it('keeps the not-found card, the leave confirm and the progress pill', () => {
    expect(q.notFound).toBe('Quest not found.');
    expect(q.goBack.cta).toBe('Go back');
    expect(q.leave.title).toBe('Leave this quest?');
    expect(q.leave.message).toBe('Stars from this try will not be saved.');
    expect(q.leave.confirm.cta).toBe('Leave');
    expect(q.leave.keep.cta).toBe('Keep playing');
    expect(q.progress(2, 5)).toBe('2 / 5');
  });

  it('keeps the plain-word label of every step kind', () => {
    expect(Object.fromEntries(Object.entries(q.step).map(([kind, v]) => [kind, v.pill]))).toEqual({
      intro: 'Hello',
      present: 'Look and listen',
      discover: 'Look and learn',
      practice: 'Practice',
      apply: 'Try it',
      check: 'Quick check',
      reward: 'Finish',
    });
  });

  it('keeps the narrative buttons and the default Hoya line', () => {
    expect(q.continue.cta).toBe('Continue');
    expect(q.seeResults.cta).toBe('See results');
    expect(q.keepGoing).toBe("Let's keep going!");
  });

  it('keeps the game launcher and the Check launcher', () => {
    expect(q.launcher.game).toEqual({
      heading: 'Ready for a quick game?',
      body: "Tap to play. When the game is done you'll come right back.",
      play: { cta: 'Play minigame' },
      skip: { cta: 'Skip for now' },
    });
    expect(q.launcher.check).toEqual({ heading: 'Two quick ones', go: { cta: 'Go' } });
  });

  it('keeps the Discover words', () => {
    const d = q.discover;
    expect(d.hearIt.cta).toBe('Hear it');
    expect(d.letterName.cta).toBe('Letter name');
    expect(d.showHowToSay.cta).toBe('Show how to say it');
    expect(d.continue.cta).toBe('Continue');
    expect(d.heard.pill).toBe('Heard');
    expect(d.sayLine('ga')).toBe('Say it out loud: ga');
    expect(d.wordsTitle).toBe('Words you can read now');
    expect(d.batchimLine).toBe('Sits at the bottom of the block');
    expect(d.empty).toBe('Nothing to look at here. Tap Continue.');
    expect(d.pageLabel(1, 3)).toBe('Page 1 of 3');
  });

  it('never uses age words, failure language or emoji', () => {
    const text = JSON.stringify(q);
    expect(text).not.toMatch(/\b(kids?|child(ren)?|ages?|fail\w*|wrong)\b|\p{Extended_Pictographic}/iu);
  });
});

describe('caregiver.gating (English wording as shipped)', () => {
  const g = m.caregiver.gating;

  it('words each rejection reason, naming the learner where it helps', () => {
    expect(g['unknown-quest']('Suni')).toBe('That quest is not available yet.');
    expect(g['episode-not-shipped']('Suni')).toBe('That episode is still being built.');
    expect(g['stage-locked']('Suni')).toBe("Suni hasn't reached this quest yet.");
  });

  it('words a closed lesson with the product names and no price (F-ENT-003 section 3.6)', () => {
    expect(g['quest-closed']('Suni')).toBe('Suni can play this lesson with the Family Plan or a Group License.');
  });
});

describe('accessibility labels of the Quest player', () => {
  it('are the English labels as shipped', () => {
    expect(m.a11y.leaveQuest).toBe('Leave quest');
    expect(m.a11y.hearItLabel('Korean letter g')).toBe('Hear it. Korean letter g');
    expect(m.a11y.hearExample('na, na, I')).toBe('Hear it: na, na, I');
    expect(m.a11y.discoverLetter('g/k')).toBe('Korean letter g/k');
    expect(m.a11y.discoverLetter('g/k', 'like g in go')).toBe('Korean letter g/k. like g in go');
    expect(m.a11y.discoverFinal('k')).toBe('Korean final consonant k');
  });
});

describe('every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: has the quest and gating keys`, () => {
      const messages = getMessages(locale);
      expect(typeof messages.learner.quest.notFound).toBe('string');
      expect(typeof messages.caregiver.gating['stage-locked']).toBe('function');
    });
  }
});

// en-XA (F-I18N-001 §3.11): every new key, function messages included, survives pseudo-localisation.
describe('en-XA covers the new keys', () => {
  const NEW_PREFIXES = ['learner.quest', 'caregiver.gating'];
  const NEW_A11Y = ['a11y.leaveQuest', 'a11y.hearItLabel', 'a11y.hearExample', 'a11y.discoverLetter', 'a11y.discoverFinal'];
  const paths = leafPaths(m).filter((p) => NEW_PREFIXES.some((x) => p.startsWith(`${x}.`)) || NEW_A11Y.includes(p));
  const pseudo = pseudoLocalize(m);

  it('finds the new leaves', () => {
    expect(paths.length).toBeGreaterThan(40);
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
