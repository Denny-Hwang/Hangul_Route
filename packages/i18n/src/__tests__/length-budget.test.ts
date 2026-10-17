import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/** Strings allowed to exceed 1.5x the English length, each with a reason. */
const ES_LENGTH_ALLOW_LIST: Readonly<Record<string, string>> = {
  // F-I18N-001 PR 15: Spanish strings a few letters over 1.5x the English, each still inside its drawn budget or never drawn.
  'common.buttons.next': 'the standard Spanish button word "Siguiente" (9) against "Next" (4); buttons wrap (Button sizes by minHeight)',
  'report.step.next': 'the standard Spanish button word "Siguiente", inside the 16-character stepper budget',
  'report.when.prevWeek': '"la semana pasada" needs its article inside the sentence; inside the 32-character words-in-a-sentence budget',
  'report.previous.week': '"la semana pasada" needs its article inside the sentence; inside the 32-character words-in-a-sentence budget',
  'report.figure.cards': '"Tarjetas nuevas", one letter over, inside the 20-character report label budget',
  'report.figure.words': '"Palabras nuevas", one letter over, inside the 20-character report label budget',
  'a11y.minigame.strokeOrder.loop': 'read aloud by a screen reader, never drawn ("un círculo")',
  'a11y.minigame.strokeOrder.direction.right': 'read aloud, never drawn; a Spanish direction needs "a la" ("a la derecha")',
  'a11y.minigame.strokeOrder.direction.left': 'read aloud, never drawn; a Spanish direction needs "a la" ("a la izquierda")',
  'a11y.minigame.strokeOrder.direction.upLeft': 'read aloud, never drawn ("arriba a la izquierda")',
  'a11y.minigame.strokeOrder.direction.upRight': 'read aloud, never drawn ("arriba a la derecha")',
  'caregiver.pin.entry.unlock.cta': 'the standard Spanish button word "Desbloquear", inside the 28-character cta budget',
  'caregiver.saveProgress.share.cta': 'the standard Spanish button word "Compartir", inside the 28-character cta budget',
  'learner.cardDetail.share.cta': 'the standard Spanish button word "Compartir", inside the 28-character cta budget',
  'learner.quest.discover.heard.pill': '"Escuchado", one letter over, inside the 24-character pill budget',
  'learner.story.check.next.cta': 'the standard Spanish button word "Siguiente" (9) against "Next" (4), inside the 28-character cta budget; it wraps',
  'learner.story.sequence.replay.next.cta': 'the standard Spanish button word "Siguiente" (9) against "Next" (4), inside the 28-character cta budget; it wraps',
  'learner.story.reader.next.cta': 'the standard Spanish button word "Siguiente" (9) against "Next" (4), inside the 28-character cta budget; it wraps',
  'learner.placement.options.next.cta': 'the standard Spanish button word "Siguiente" (9) against "Next" (4), inside the 28-character cta budget; it wraps',
  'learner.placement.result.next': 'the standard Spanish button word "Siguiente" (9) against "Next" (4), inside the 28-character cta budget; it wraps',
  'learner.myRoute.legend.cursor': 'the legend word "Siguiente" (9) against "Next" (4); the legend wraps',
  'learner.routeNext.tag.next': 'the tag word "Siguiente" (9) against "Next" (4); the tag wraps',
  'learner.weeklyPlan.setup.next.cta': 'the standard Spanish button word "Siguiente" (9) against "Next" (4), inside the 28-character cta budget; it wraps',
  'learner.weeklyPlan.setup.likes.themeNames.nature': 'the plain Spanish word "Naturaleza" (10) against "Nature" (6); a theme chip that wraps',
  'a11y.access.next': 'read aloud in a Journey cell label, never drawn; the same word as learner.routeNext.tag.next ("Siguiente")',
  'learner.story.sequence.replay.play.cta': 'the standard Spanish player word "Reproducir", inside the 28-character cta budget',
  'learner.myRoute.gains.stars': '"Estrellas" (9) against "Stars" (5), a one-word label',
  'landing.waitlist.privacyLink': 'the document name "Política de privacidad", one letter over, a link inside the consent line',
  'console.saveDraft': '"Guardar borrador", one letter over; the button wraps',
  'console.relink.device': 'the one word "dispositivo" (11) against "device" (6)',
  'console.planCounts.items': '"1 elemento" against "1 item": the Spanish noun is longer; the count line wraps',
  'console.billing.promo.formLabel': 'the field label "Código promocional", a form label above its field',
  'console.curriculum.next.cta': 'the standard Spanish button word "Siguiente" (9) against "Next" (4), inside the 28-character cta budget; it wraps',
  'console.curriculum.goals.themeNames.nature': 'the one word "Naturaleza" (10) against "Nature" (6)',
  'console.curriculum.preview.table.items': 'the table header "Elementos" (9) against "Items" (5); the table scrolls',
  'console.lecture.outline.block.cards': '"tarjetas del patrimonio", one letter over, an outline row that wraps',
  'console.notes.composer.preview.title': '"Vista previa", one letter over, a heading',
  'console.notes.family.report.why': 'Spanish questions open with "¿": "¿Por qué?" is one letter over',
  'caregiver.notes.report.why': 'Spanish questions open with "¿": "¿Por qué?" is one letter over',
  'console.browse.preview.cta': 'the Spanish word "Vista previa" (12) against "Preview" (7), the same word as console.notes.composer.preview.title; inside the 28-character cta budget, a link that wraps',
  // F-TCH-004 PR 6 (design/screens/presenter/README.md "Length budget"): the presenter's start facts and its control bar.
  'learner.presenter.start.slides': '"diapositivas" is the only Spanish word for slides; a facts line that wraps',
  'learner.presenter.bar.blank.cta': 'one letter over; the Spanish for a blanked screen needs the preposition; a bar label that wraps inside 96',
  'learner.presenter.bar.grid.cta': 'the one Spanish word for slides; a bar label that wraps inside 96',
  'learner.presenter.bar.timer.cta': 'the standard Spanish word for a timer; a bar label that wraps inside 96',
  // F-TCH-004 PR 7 (design/screens/presenter/README.md "Length budget"): the activity slide's stage button.
  'learner.presenter.slide.activity.startTimer.cta': '"temporizador" again; inside the 28-character cta budget, a stage button that wraps',
  // F-TCH-004 PR 9 (design/screens/presenter/README.md "Length budget"): the class timer's buttons.
  'learner.presenter.timer.reset.cta': 'the standard Spanish button word "Reiniciar", one letter over; inside the 28-character cta budget',
  // F-CURR-001 G-1: the Sentence Builder meaning card's label.
  'learner.minigame.sentenceBuilder.meaning': 'the one word "Significado" (11) against "Meaning" (7), the same word as a11y.minigame.meaning; a card label that wraps',
  // F-LEARN-001 §3.15: the Privacy step's text button and the policy link's accessible name.
  'learner.createProfile.privacy.under13': '"Tengo menos de 13 años" is the natural statement; a full-width text button that wraps',
  'learner.editProfile.privacy.under13': '"Tengo menos de 13 años" is the natural statement; a full-width text button that wraps',
  'learner.createProfile.privacyLinkName': 'the policy\'s own name "Política de privacidad", one letter over; read aloud as the link name, never drawn',
};

const BUDGETS: Readonly<Record<string, number>> = { tab: 12, pill: 24, cta: 28 };

/**
 * Screen-reader labels whose key name happens to match a budget word: they are read aloud, never
 * drawn, so no visible budget applies. Each with a reason.
 */
const NOT_DRAWN: Readonly<Record<string, string>> = {
  'a11y.myRoute.tab':
    'the Route tab read aloud as the full page name "Learning Route" (AMENDMENTS-ROUTE-LEARNING-ROUTE LR-OD-1); the drawn label a11y.tabs.route keeps the tab budget',
};

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
      const budget = NOT_DRAWN[path] !== undefined ? undefined : (BUDGETS[last] ?? (path.startsWith('a11y.tabs.') ? BUDGETS.tab : undefined));
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
    for (const [path, reason] of Object.entries({ ...ES_LENGTH_ALLOW_LIST, ...NOT_DRAWN })) {
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
      'learner.library.new.pill',
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
      'caregiver.plan.backToJourney.cta',
      'caregiver.plan.backToLibrary.cta',
      'caregiver.plan.backHome.cta',
      'caregiver.plan.openBilling.cta',
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

  it('covers the landing buttons (PR 11a; the old landing buttons left in F-SITE-002 S-6)', () => {
    const paths = leafPaths(getMessages('en')).filter((p) => BUDGETS[p.split('.').pop() ?? ''] !== undefined);
    expect(paths).toContain('landing.localeBanner.close.cta');
  });

  // F-SITE-002 §5 (PR S-3): the site header's text links, the persona cards and the pill actions. "Start learning"
  // renders as a pill in the header, so it is budgeted with the pill actions, which leave room for es / ko growth
  // ("Sign in as a parent" must fit one line at 320 px). Until es / ko have landing overlays these cases check the
  // English fallback.
  describe('site budgets (F-SITE-002 S-3)', () => {
    const SITE_BUDGETS: ReadonlyArray<[label: string, max: number, paths: readonly string[]]> = [
      ['nav label', 14, ['landing.nav.learners', 'landing.nav.parents', 'landing.nav.teachers', 'landing.nav.signIn']],
      ['persona card body', 90, ['landing.home.who.items.learners.body', 'landing.home.who.items.parents.body', 'landing.home.who.items.teachers.body']],
      [
        'pill action',
        24,
        ['landing.nav.start', 'landing.home.hero.start', 'landing.persona.parents.signIn', 'landing.persona.teachers.signIn', 'landing.persona.teachers.tryIt'],
      ],
      // Text links that are not `cta` leaves, so the general CTA budget skips them (S-3 review 3).
      ['text link', 36, ['landing.home.hero.grownUps', 'landing.persona.parents.learn.link']],
      ['skip link and 404 action', 24, ['landing.nav.skip', 'landing.notFound.home', 'landing.notFound.start']],
    ];
    for (const locale of LOCALES) {
      for (const [label, max, paths] of SITE_BUDGETS) {
        it.each(paths)(`${locale}: %s fits the ${label} budget (${max})`, (path) => {
          const value = lookup(getMessages(locale), path);
          expect(typeof value, path).toBe('string');
          expect(String(value).length, String(value)).toBeLessThanOrEqual(max);
        });
      }
    }
  });

  // F-REPORT-001 RP-6 (section 3.11): a budget for every `report.*` and `a11y.report.*` key. The most specific row
  // wins (a row names a key or a subtree); a key with no row fails, so a new report key needs a budget. Function
  // messages render their SAMPLES rows, which run to the 20-character display name and the 40-character space
  // name. Until es / ko have report overlays these cases check the English fallback.
  describe('report budgets (F-REPORT-001 RP-6)', () => {
    const REPORT_BUDGETS: ReadonlyArray<[label: string, max: number, paths: readonly string[]]> = [
      ['document title', 32, ['report.documentTitle']],
      ['page title', 64, ['report.title', 'report.you.title']],
      ['tab', 12, ['report.period']],
      ['stepper button', 16, ['report.step']],
      ['stepper dates', 28, ['report.step.range']],
      ['navigation item', 16, ['report.nav']],
      [
        'button',
        28,
        ['report.action', 'report.print.button', 'report.glance.openRoute', 'report.class.planLesson', 'report.class.link', 'report.growth.showTable', 'report.growth.hideTable', 'report.back.home'],
      ],
      ['back link with a space name', 56, ['report.back.space']],
      [
        'heading',
        40,
        [
          'report.chooser',
          'report.section',
          'report.class.section',
          'report.detail.lettersPractising',
          'report.detail.lettersNew',
          'report.detail.milestones',
          'report.detail.levelCheck',
          'report.detail.plan',
          'report.class.lettersNew',
          'report.class.revisit',
          'report.you.detail',
        ],
      ],
      ['heading with a name', 48, ['report.detail.lettersStrong']],
      ['label', 20, ['report.figure', 'report.growth.quests', 'report.growth.cards', 'report.growth.month', 'report.strand.status', 'report.class.band']],
      ['up marker', 36, ['report.figure.up']],
      ['words inside a sentence', 32, ['report.when', 'report.previous']],
      ['at-a-glance line', 48, ['report.glance.nowOn', 'report.glance.lastPractice']],
      [
        'line',
        100,
        [
          'report.headline',
          'report.horizon',
          'report.insight',
          'report.you.headline',
          'report.you.insight',
          'report.you.state',
          'report.you.tip',
          'report.state',
          'report.tip',
          'report.detail',
          'report.growth.since',
          'report.class',
          'report.print',
        ],
      ],
      ['letter in a sentence', 16, ['report.letter']],
      ['list in a sentence', 60, ['report.list']],
      ['screen-reader label', 120, ['a11y.report']],
    ];
    const covers = (row: string, path: string): boolean => path === row || path.startsWith(`${row}.`);
    /** The most specific row naming `path` (the longest matching key or subtree). */
    function budgetOf(path: string): { label: string; max: number } | null {
      let best: { label: string; max: number; depth: number } | null = null;
      for (const [label, max, rows] of REPORT_BUDGETS) {
        for (const row of rows) if (covers(row, path) && (best === null || row.length > best.depth)) best = { label, max, depth: row.length };
      }
      return best;
    }
    const reportPaths = (locale: (typeof LOCALES)[number]): string[] =>
      leafPaths(getMessages(locale)).filter((path) => covers('report', path) || covers('a11y.report', path));

    it('every report and a11y.report key has a budget', () => {
      const paths = reportPaths('en');
      expect(paths.length).toBeGreaterThan(150);
      expect(paths.filter((path) => budgetOf(path) === null)).toEqual([]);
    });

    it('every budget row names a key or subtree that exists', () => {
      const en = getMessages('en');
      for (const [, , rows] of REPORT_BUDGETS) for (const row of rows) expect(lookup(en, row), row).toBeDefined();
    });

    for (const locale of LOCALES) {
      it(`${locale}: every report and a11y.report rendering fits its budget`, () => {
        const messages = getMessages(locale);
        for (const path of reportPaths(locale)) {
          const budget = budgetOf(path);
          const outputs = renderings(lookup(messages, path), path);
          expect(outputs, path).not.toBeNull();
          for (const out of outputs ?? []) expect(out.length, `${path} (${budget?.label}): ${out}`).toBeLessThanOrEqual(budget?.max ?? 0);
        }
      });
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
      'console.home.newClass.cta',
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

  it('covers the plan and billing page buttons (PR 10b)', () => {
    const paths = leafPaths(getMessages('en')).filter((p) => BUDGETS[p.split('.').pop() ?? ''] !== undefined);
    for (const expected of [
      'console.plan.edit.cta',
      'console.plan.archive.cta',
      'console.plan.newPlan.cta',
      'console.plan.yours.moveUp.cta',
      'console.plan.yours.moveDown.cta',
      'console.plan.yours.remove.cta',
      'console.plan.saving.cta',
      'console.plan.cancel.cta',
      'console.billing.manage.cta',
      'console.billing.promo.apply.cta',
      'console.billing.promo.change.cta',
      'console.billing.contact.cta',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('covers the settings, school and /parent buttons (PR 10c)', () => {
    const paths = leafPaths(getMessages('en')).filter((p) => BUDGETS[p.split('.').pop() ?? ''] !== undefined);
    for (const expected of [
      'console.settings.backToConsole.cta',
      'console.settings.joinCode.regenerate.cta',
      'console.settings.joinCode.create.cta',
      'console.settings.grownUps.remove.cta',
      'console.settings.learners.remove.family.cta',
      'console.settings.learners.remove.class.cta',
      'console.settings.learners.remove.school.cta',
      'console.settings.danger.archive.family.cta',
      'console.settings.danger.archive.class.cta',
      'console.settings.danger.archive.school.cta',
      'console.settings.danger.unarchive.cta',
      'console.school.licence.manage.cta',
      'console.school.invite.regenerate.cta',
      'console.school.invite.create.cta',
      'console.school.classes.cancel.cta',
      'console.school.classes.change.cta',
      'console.school.classes.assign.cta',
      'console.school.classes.open.cta',
      'console.school.classes.add.cta',
    ]) {
      expect(paths).toContain(expected);
    }
  });
});
