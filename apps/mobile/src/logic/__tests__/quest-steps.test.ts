import { QuestStepKindSchema } from '@hangul-route/content-schema';
import { getMessages, pseudoLocalize } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { questsAll } from '../../content';
import { questStepLabel as label } from '../quest-steps';

const step = getMessages('en').learner.quest.step;
const questStepLabel = (kind: Parameters<typeof label>[0]): string => label(kind, step);

describe('questStepLabel (audit UX-17: raw step kinds on the quest player)', () => {
  const kinds = QuestStepKindSchema.options;

  it('replaces the authoring jargon (intro, present, apply, reward) with plain words', () => {
    for (const kind of ['intro', 'present', 'apply', 'reward'] as const) {
      expect(questStepLabel(kind).toLowerCase()).not.toBe(kind);
    }
    expect(questStepLabel('intro')).toBe('Hello');
    expect(questStepLabel('present')).toBe('Look and listen');
    expect(questStepLabel('practice')).toBe('Practice');
    expect(questStepLabel('apply')).toBe('Try it');
    expect(questStepLabel('reward')).toBe('Finish');
  });

  it('labels the F-QUEST-002 step kinds in plain words', () => {
    expect(questStepLabel('discover')).toBe('Look and learn');
    expect(questStepLabel('check')).toBe('Quick check');
  });

  it('gives every kind its own short English label', () => {
    const labels = kinds.map(questStepLabel);
    expect(new Set(labels).size).toBe(kinds.length);
    for (const label of labels) {
      expect(label).toMatch(/^[A-Z][A-Za-z ]{1,20}$/);
    }
  });

  it('covers every step in the shipped quests', () => {
    for (const q of questsAll) {
      for (const step of q.steps) {
        expect(questStepLabel(step.kind), `${q.id}/${step.id}`).toBeTruthy();
      }
    }
  });
});

describe('questStepLabel reads the subtree it is given', () => {
  it('returns the pseudo-localised word for every kind', () => {
    const pseudo = pseudoLocalize(getMessages('en')).learner.quest.step;
    for (const kind of QuestStepKindSchema.options) {
      expect(label(kind, pseudo)).toBe(pseudo[kind].pill);
      expect(label(kind, pseudo)).not.toBe(questStepLabel(kind));
    }
  });
});
