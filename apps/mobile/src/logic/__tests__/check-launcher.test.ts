import type { QuestStepKind } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  checkCompletedPayload,
  discoverCompletedPayload,
  launcherView,
  watchCheck,
} from '../quest-flow/check-launcher';
import { questStepLabel } from '../quest-steps';

const { launcher, step } = getMessages('en').learner.quest;

describe('launcherView (F-QUEST-002 §3.3: the Check launcher variant)', () => {
  it('the Check says "Two quick ones", has a single Go and no Skip', () => {
    const view = launcherView('check', launcher);
    expect(view.heading).toBe('Two quick ones');
    expect(view.primaryLabel).toBe('Go');
    expect(view.showSkip).toBe(false);
    expect(view.body).toBeUndefined();
    expect(view.hoya).toBe(true);
  });

  it('the other game steps keep the generic card and their Skip for now', () => {
    const kinds: QuestStepKind[] = ['present', 'practice', 'apply'];
    for (const kind of kinds) {
      const view = launcherView(kind, launcher);
      expect(view.heading).toBe('Ready for a quick game?');
      expect(view.body).toBe("Tap to play. When the game is done you'll come right back.");
      expect(view.primaryLabel).toBe('Play minigame');
      expect(view.showSkip).toBe(true);
      expect(view.skipLabel).toBe('Skip for now');
      expect(view.hoya).toBe(false);
    }
  });

  it('only the Check drops the Skip, across every step kind', () => {
    const kinds: QuestStepKind[] = ['intro', 'present', 'discover', 'practice', 'apply', 'check', 'reward'];
    expect(kinds.filter((k) => !launcherView(k, launcher).showSkip)).toEqual(['check']);
  });

  it('the learner-facing step labels are plain English', () => {
    expect(questStepLabel('discover', step)).toBe('Look and learn');
    expect(questStepLabel('check', step)).toBe('Quick check');
  });

  it('keeps no age words, emoji or red-X language in the launcher copy', () => {
    const text = JSON.stringify(launcher);
    expect(text).not.toMatch(/\b(kids?|child(ren)?|ages?|fail\w*|wrong)\b|\p{Extended_Pictographic}/iu);
  });
});

describe('telemetry payloads', () => {
  it('quest.discover_completed carries { questId, pages, heard }', () => {
    expect(discoverCompletedPayload('quest:stage1-letters-q1', { pages: 2, heard: 3 })).toEqual({
      questId: 'quest:stage1-letters-q1',
      pages: 2,
      heard: 3,
    });
  });

  it('quest.check_completed carries the first-try count and retries of the Check alone', () => {
    expect(checkCompletedPayload('quest:q', { firstTryCorrect: 1, retries: 1 })).toEqual({
      questId: 'quest:q',
      firstTryCorrect: 1,
      retries: 1,
    });
  });
});

describe('watchCheck: when the player leaves the Check step', () => {
  const at = (stepIndex: number, kind: QuestStepKind | undefined, correct = 0, retries = 0) => ({
    stepIndex,
    kind,
    correct,
    retries,
  });

  it('does nothing outside a Check', () => {
    expect(watchCheck(null, at(2, 'practice', 3, 0))).toEqual({ watch: null, completed: null });
  });

  it('takes the baseline when the Check step opens', () => {
    expect(watchCheck(null, at(4, 'check', 5, 1))).toEqual({
      watch: { index: 4, correct: 5, retries: 1 },
      completed: null,
    });
  });

  it('keeps the baseline while the learner plays and comes back to the launcher', () => {
    const watch = { index: 4, correct: 5, retries: 1 };
    expect(watchCheck(watch, at(4, 'check', 6, 2))).toEqual({ watch, completed: null });
  });

  it('reports the Check once the step index moves past it, with the deltas', () => {
    const watch = { index: 4, correct: 5, retries: 1 };
    expect(watchCheck(watch, at(5, 'reward', 7, 2))).toEqual({
      watch: null,
      completed: { firstTryCorrect: 2, retries: 1 },
    });
  });

  it('a run that restarted from step 0 drops the old baseline without reporting', () => {
    const watch = { index: 4, correct: 5, retries: 1 };
    expect(watchCheck(watch, at(0, 'intro'))).toEqual({ watch: null, completed: null });
  });

  it('a Check straight after another Check step opens a fresh baseline', () => {
    const watch = { index: 3, correct: 2, retries: 0 };
    expect(watchCheck(watch, at(4, 'check', 3, 0))).toEqual({
      watch: { index: 4, correct: 3, retries: 0 },
      completed: { firstTryCorrect: 1, retries: 0 },
    });
  });
});
