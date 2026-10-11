import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/** Strings allowed to exceed 1.5x the English length, each with a reason. */
const ES_LENGTH_ALLOW_LIST: Readonly<Record<string, string>> = {};

const BUDGETS: Readonly<Record<string, number>> = { tab: 12, pill: 24, cta: 28 };

type Message = (...args: unknown[]) => string;

/** What a message renders: the string itself, or one output per sample argument list for a function message. */
function renderings(value: unknown, path: string): string[] | null {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'function') return null;
  const samples = SAMPLES[path];
  expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
  return (samples ?? []).map((args) => (value as Message)(...args));
}

describe('length budgets (F-I18N-001 §3.11)', () => {
  for (const locale of LOCALES) {
    const messages = getMessages(locale);
    const en = getMessages('en');
    for (const path of leafPaths(messages)) {
      const value = lookup(messages, path);
      const last = path.split('.').pop() ?? '';
      // Tab labels live under `a11y.tabs.*` (F-I18N-001 §3.4 rule 2) and share the `tab` budget.
      const budget = BUDGETS[last] ?? (path.startsWith('a11y.tabs.') ? BUDGETS.tab : undefined);
      if (budget !== undefined) {
        it(`${locale}:${path} fits ${budget} characters`, () => {
          const outputs = renderings(value, path);
          expect(outputs).not.toBeNull();
          for (const out of outputs ?? []) expect(out.length, out).toBeLessThanOrEqual(budget);
        });
      }
      if (locale === 'es' && ES_LENGTH_ALLOW_LIST[path] === undefined) {
        it(`es:${path} is at most 1.5x the English length`, () => {
          const own = renderings(value, path);
          const source = renderings(lookup(en, path), path);
          if (own === null || source === null) return; // arrays are not budgeted
          own.forEach((out, i) => {
            expect(out.length).toBeLessThanOrEqual(Math.max(8, Math.ceil((source[i] ?? '').length * 1.5)));
          });
        });
      }
    }
  }

  it('the allow-list names only real paths and gives a reason', () => {
    const en = getMessages('en');
    for (const [path, reason] of Object.entries(ES_LENGTH_ALLOW_LIST)) {
      expect(lookup(en, path)).toBeDefined();
      expect(reason.length).toBeGreaterThan(0);
    }
  });

  // The screens name their pills and CTAs `pill` / `cta` so these budgets cover them.
  it('covers the Home, Journey, Library and CardDetail pills and CTAs', () => {
    const paths = leafPaths(getMessages('en')).filter((p) => BUDGETS[p.split('.').pop() ?? ''] !== undefined);
    for (const expected of [
      'learner.home.streak.pill',
      'learner.home.cards.pill',
      'learner.home.stars.pill',
      'learner.journey.premium.pill',
      'learner.library.collected.pill',
      'learner.cardDetail.hear.cta',
      'learner.cardDetail.share.cta',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('covers the Episode, Results and Homework pills and CTAs (PR 6b)', () => {
    const paths = leafPaths(getMessages('en')).filter((p) => BUDGETS[p.split('.').pop() ?? ''] !== undefined);
    for (const expected of [
      'learner.episode.comingSoon.pill',
      'learner.episode.quests.start.cta',
      'learner.episode.quests.playAgain.cta',
      'learner.episode.prereq.startThere.cta',
      'learner.episode.prereq.playAnyway.cta',
      'learner.results.backHome.cta',
      'learner.results.episodePage.cta',
      'learner.results.nextUp.next.cta',
      'learner.results.nextUp.again.cta',
      'learner.results.newCard.see.cta',
      'learner.journey.availability.open.pill',
      'learner.journey.availability.taste.pill',
      'learner.journey.availability.soon.pill',
    ]) {
      expect(paths).toContain(expected);
    }
  });
  it('covers the Quest player pills and CTAs (PR 7a)', () => {
    const paths = leafPaths(getMessages('en')).filter((p) => BUDGETS[p.split('.').pop() ?? ''] !== undefined);
    for (const expected of [
      'learner.quest.step.intro.pill',
      'learner.quest.step.present.pill',
      'learner.quest.step.discover.pill',
      'learner.quest.step.practice.pill',
      'learner.quest.step.apply.pill',
      'learner.quest.step.check.pill',
      'learner.quest.step.reward.pill',
      'learner.quest.goBack.cta',
      'learner.quest.leave.confirm.cta',
      'learner.quest.leave.keep.cta',
      'learner.quest.continue.cta',
      'learner.quest.seeResults.cta',
      'learner.quest.launcher.game.play.cta',
      'learner.quest.launcher.game.skip.cta',
      'learner.quest.launcher.check.go.cta',
      'learner.quest.discover.hearIt.cta',
      'learner.quest.discover.letterName.cta',
      'learner.quest.discover.showHowToSay.cta',
      'learner.quest.discover.continue.cta',
      'learner.quest.discover.heard.pill',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('covers the grown-up buttons (PR 8a)', () => {
    const paths = leafPaths(getMessages('en')).filter((p) => BUDGETS[p.split('.').pop() ?? ''] !== undefined);
    for (const expected of [
      'caregiver.pin.entry.unlock.cta',
      'caregiver.pin.entry.forgot.cta',
      'caregiver.pin.reset.noCode.cta',
      'caregiver.paywall.backToJourney.cta',
      'caregiver.paywall.premium.manage.cta',
      'caregiver.paywall.free.openConsole.cta',
      'caregiver.spaces.leave.cta',
      'caregiver.spaces.join.cta',
      'caregiver.backup.save.cta',
      'caregiver.backup.file.cta',
      'caregiver.backup.restore.cta',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('covers the Restore, Save my progress, Join a class, install sheet and banner buttons (PR 8b)', () => {
    const paths = leafPaths(getMessages('en')).filter((p) => BUDGETS[p.split('.').pop() ?? ''] !== undefined);
    for (const expected of [
      'caregiver.restore.code.cta',
      'caregiver.restore.code.find.cta',
      'caregiver.restore.code.looking.cta',
      'caregiver.restore.file.cta',
      'caregiver.restore.startFresh.cta',
      'caregiver.restore.great.cta',
      'caregiver.saveProgress.copy.cta',
      'caregiver.saveProgress.share.cta',
      'caregiver.saveProgress.saveNow.cta',
      'caregiver.saveProgress.saveNow.saving.cta',
      'caregiver.saveProgress.rotate.cta',
      'caregiver.saveProgress.rotate.keep.cta',
      'caregiver.join.code.join.cta',
      'caregiver.join.code.looking.cta',
      'caregiver.join.confirm.me.cta',
      'caregiver.join.confirm.joining.cta',
      'caregiver.join.confirm.alreadyIn.cta',
      'caregiver.join.confirm.notThis.cta',
      'caregiver.join.pick.newHere.cta',
      'caregiver.join.waiting.neverMind.cta',
      'caregiver.join.done.backToToday.cta',
      'caregiver.install.install.cta',
      'caregiver.install.copyLink.cta',
      'caregiver.install.linkCopied.cta',
      'caregiver.install.notNow.cta',
      'learner.pwa.update.refresh.cta',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('covers the minigame, audio and story pills and CTAs (PR 7b)', () => {
    const paths = leafPaths(getMessages('en')).filter((p) => BUDGETS[p.split('.').pop() ?? ''] !== undefined);
    for (const expected of [
      'learner.minigame.backToQuest.cta',
      'learner.minigame.progress.pill',
      'learner.minigame.skip.cta',
      'learner.minigame.trace.showMe.cta',
      'learner.minigame.trace.clear.cta',
      'learner.minigame.trace.done.cta',
      'learner.minigame.voiceEcho.continue.cta',
      'learner.minigame.listenPick.checkTitle.pill',
      'learner.minigame.listenPick.hearAgain.cta',
      'learner.audio.hearIt.cta',
      'learner.audio.action.turn_on.cta',
      'learner.audio.action.try_again.cta',
      'learner.audio.action.tap_to_hear.cta',
      'learner.audio.letterName.cta',
      'learner.audio.howToAddVoice.cta',
      'learner.story.check.position.pill',
      'learner.story.check.next.cta',
      'learner.story.check.showRomanization.cta',
      'learner.story.check.continue.cta',
      'learner.story.recap.done.cta',
      'learner.story.sequence.skip.cta',
      'learner.story.sequence.continue.cta',
      'learner.story.sequence.replay.pause.cta',
      'learner.story.sequence.replay.play.cta',
      'learner.story.sequence.replay.back.cta',
      'learner.story.sequence.replay.next.cta',
      'learner.story.sequence.replay.skip.cta',
      'learner.story.sequence.replay.done.cta',
      'learner.story.results.nextStory.cta',
      'learner.story.results.backHome.cta',
      'learner.story.results.readAgain.cta',
      'learner.story.results.episodePage.cta',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('budgets the fixed words of the plan button, which also holds a user-entered title', () => {
    // `console.space.openPlan.label` is not a `cta` leaf because the plan title is user data;
    // its own words leave room for a short title inside the cta budget, and the button wraps.
    for (const locale of LOCALES) {
      const fixed = getMessages(locale).console.space.openPlan.label('');
      expect(fixed.length, `${locale}: ${fixed}`).toBeLessThanOrEqual((BUDGETS.cta ?? 28) - 10);
    }
  });

  it('covers the console page buttons (PR 10a)', () => {
    const paths = leafPaths(getMessages('en')).filter((p) => BUDGETS[p.split('.').pop() ?? ''] !== undefined);
    for (const expected of [
      'console.shell.account.cta',
      'console.shell.billing.cta',
      'console.shell.signOut.cta',
      'console.joinCode.copy.cta',
      'console.joinCode.copied.cta',
      'console.signIn.submit.cta',
      'console.signIn.submitting.cta',
      'console.start.continue.cta',
      'console.start.back.cta',
      'console.start.create.cta',
      'console.start.creating.cta',
      'console.start.goToClass.cta',
      'console.home.open.cta',
      'console.home.newSpace.cta',
      'console.space.regenerate.cta',
      'console.space.createCode.cta',
      'console.space.relinkRequests.cta',
      'console.space.relinkPending.cta',
      'console.space.settings.cta',
      'console.relink.approve.cta',
      'console.relink.deny.cta',
      'console.relink.done.cta',
      'console.relink.issue.cta',
    ]) {
      expect(paths).toContain(expected);
    }
  });
});
