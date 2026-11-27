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

  it('[QB] a game step shown again has no Skip and offers Play again; the Check too (AMENDMENTS-QUEST-SOUND-BACK QB-2)', () => {
    const kinds: QuestStepKind[] = ['present', 'practice', 'apply', 'check'];
    for (const kind of kinds) {
      const first = launcherView(kind, launcher);
      expect(first.revisit).toBe(false);
      const again = launcherView(kind, launcher, true);
      expect(again.revisit).toBe(true);
      expect(again.showSkip).toBe(false);
      expect(again.againLabel).toBe('Play again');
      // The card's words stay as they were.
      expect(again.heading).toBe(first.heading);
      expect(again.body).toBe(first.body);
      expect(again.hoya).toBe(first.hoya);
    }
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
  it('quest.discover_completed carries { questId, pages, heard, written, writeSeconds } (TC-1b, OD-TC-8)', () => {
    expect(discoverCompletedPayload('quest:stage1-letters-q1', { pages: 3, heard: 3, written: 4, writeSeconds: 52 })).toEqual({
      questId: 'quest:stage1-letters-q1',
      pages: 3,
      heard: 3,
      written: 4,
      writeSeconds: 52,
    });
  });

  it('quest.discover_completed of a step with no trace page carries written 0 and writeSeconds 0', () => {
    expect(discoverCompletedPayload('quest:stage1-life-q4', { pages: 2, heard: 1, written: 0, writeSeconds: 0 })).toEqual({
      questId: 'quest:stage1-life-q4',
      pages: 2,
      heard: 1,
      written: 0,
      writeSeconds: 0,
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

describe('[QB] watchCheck when a step is taken back (AMENDMENTS-QUEST-SOUND-BACK QB-3)', () => {
  const at = (stepIndex: number, kind: QuestStepKind | undefined, correct: number, retries: number, furthestStep: number) => ({ stepIndex, kind, correct, retries, furthestStep });

  it('Previous from a Check in progress keeps what it counted; back on the Check the baseline is taken again', () => {
    // The Check opens at 5 right, 1 retry; one round is played (6, 2), then Previous.
    const open = watchCheck(null, at(4, 'check', 5, 1, 4));
    const away = watchCheck(open.watch, at(3, 'apply', 6, 2, 4));
    expect(away).toEqual({ watch: { index: 4, correct: 5, retries: 1, away: { correct: 1, retries: 1 } }, completed: null });
    // Further back changes nothing.
    const further = watchCheck(away.watch, at(2, 'practice', 6, 2, 4));
    expect(further.watch).toEqual(away.watch);
    expect(further.completed).toBeNull();
    // A skipped game played on the way adds 3 right answers and a retry to the run: none of them the Check's.
    const forward = watchCheck(further.watch, at(3, 'apply', 9, 3, 4));
    expect(forward.watch).toEqual(away.watch);
    const back = watchCheck(forward.watch, at(4, 'check', 9, 3, 4));
    expect(back).toEqual({ watch: { index: 4, correct: 8, retries: 2 }, completed: null });
    // The second round is played (10, 3) and the Check ends: 2 first-try right answers, 1 retry.
    expect(watchCheck(back.watch, at(5, 'reward', 10, 3, 5))).toEqual({ watch: null, completed: { firstTryCorrect: 2, retries: 1 } });
  });

  it('a Check that has ended is not watched again when it is shown after Previous, so it never reports twice', () => {
    const done = watchCheck({ index: 4, correct: 5, retries: 1 }, at(5, 'reward', 7, 1, 5));
    expect(done.completed).toEqual({ firstTryCorrect: 2, retries: 0 });
    const shownAgain = watchCheck(done.watch, at(4, 'check', 7, 1, 5));
    expect(shownAgain).toEqual({ watch: null, completed: null });
    expect(watchCheck(shownAgain.watch, at(5, 'reward', 7, 1, 5))).toEqual({ watch: null, completed: null });
  });

  it('a run that started again from an earlier step still drops the baseline', () => {
    const watch = { index: 4, correct: 5, retries: 1 };
    expect(watchCheck(watch, at(0, 'intro', 0, 0, 0))).toEqual({ watch: null, completed: null });
  });

  it('a run resumed on its Check (the furthest step) takes the baseline as before', () => {
    expect(watchCheck(null, at(4, 'check', 5, 1, 4))).toEqual({ watch: { index: 4, correct: 5, retries: 1 }, completed: null });
  });
});
