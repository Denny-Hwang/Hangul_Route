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
});
