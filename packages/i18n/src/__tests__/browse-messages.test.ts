import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-BROWSE-001 BR-6 (sections 4.1, 4.3, 4.5, 4.7 and 6; OD-8; mocks
 * design/screens/browse/access.md and preview-frame.md): the All lessons root's
 * first strings. One name everywhere, "Browse" in no UI string, no price, no
 * "Premium", no age, and no Hangul in English (rule 5). BR-7 adds home, the
 * episode outline, the item page, Lesson display and the keep switch; BR-8 and
 * BR-9 add the rest of `caregiver.browse`.
 */
const browse = getMessages('en').caregiver.browse;

/** What a leaf renders: the string, or one output per SAMPLES row. */
function rendered(path: string): string[] {
  const value = lookup(browse, path);
  if (typeof value === 'string') return [value];
  const rows = SAMPLES[`caregiver.browse.${path}`];
  expect(rows, `function message ${path} needs a row in SAMPLES`).toBeDefined();
  return (rows ?? []).map((args) => (value as (...a: unknown[]) => string)(...args));
}

/** BR-7: home, the episode outline, the item page, Lesson display and the keep switch. */
const BR7_KEYS = [
  'home.lessonDisplay.cta',
  'home.offline',
  'home.scope.sampler',
  'home.scope.fallback',
  'home.pointer',
  'home.note.letterAcrossStage1',
  'home.note.notInVersion',
  'home.note.dismiss',
  'home.section.label',
  'home.section.route',
  'home.section.journey',
  'home.section.library',
  'home.stages.line',
  'home.stages.item',
  'home.routeRowA11y',
  'home.themes',
  'home.cardSlotA11y',
  'home.wordCount',
  'home.wordsRowA11y',
  'home.wordsRowClosedA11y',
  'home.storyTileA11y',
  'keep.label',
  'keep.failed',
  'display.title',
  'display.romanization',
  'display.always',
  'display.tap',
  'display.language',
  'display.note',
  'display.done.cta',
  'episode.back',
  'episode.stagePill',
  'episode.lessons',
  'episode.stories',
  'episode.cards',
  'episode.comingLater',
  'episode.open.cta',
  'episode.openA11y',
  'episode.storyMeta',
  'cardRowA11y',
  'minutes',
  'item.back',
  'item.kind.quest',
  'item.kind.story',
  'item.kind.vocabTopic',
  'item.teaches',
  'item.where.title',
  'item.where.stage',
  'item.where.lesson',
  'item.where.see.cta',
  'item.card',
  'item.focus',
  'item.focusChipA11y',
  'item.preview.cta',
  'item.previewStory.cta',
  'item.previewQuestions.cta',
  'item.closed',
  'item.openBilling.cta',
  'item.wordCount',
  'facts.letters',
  'facts.words',
  'facts.syllables',
  'facts.skills',
  'facts.steps',
  'facts.levels',
  'facts.levelGroup',
  'facts.level.listen',
  'facts.level.readAlong',
  'facts.level.read',
  'facts.scenes',
  'facts.keywords',
  'facts.sources',
  'facts.seeSources.cta',
];

/** BR-8: the leave confirm and the preview end screen. */
const BR8_KEYS = [
  'preview.leaveConfirm.title',
  'preview.leaveConfirm.keep.cta',
  'preview.leaveConfirm.leave.cta',
  'end.lesson.title',
  'end.lesson.line',
  'end.lesson.lineNoCard',
  'end.story.title',
  'end.story.line',
  'end.next.cta',
  'end.again.cta',
  'end.back.cta',
  'end.nextStory.cta',
  'end.readAgain.cta',
  'end.backToStory.cta',
];

/** BR-9: the word topic page's Hear button. */
const BR9_KEYS = ['topic.hearA11y'];

/** BR-13: [ Present this ] on the item page and its accessible description (presenter README, Strings). */
const BR13_KEYS = ['item.present.cta', 'item.presentNote', 'item.presentBlocked'];

describe('caregiver.browse (BR-6)', () => {
  it('names the tab, the page and the preview strip as OD-8 says', () => {
    expect(browse.documentTitle).toBe('Hangul Route lessons');
    expect(browse.home.title).toBe('All lessons');
    expect(browse.home.close.cta).toBe('Close');
    expect(browse.home.howTo).toBe('Tap a lesson to see what it teaches, then play it. Nothing is saved.');
    expect(browse.preview.strip).toBe('Preview. Nothing is saved.');
    expect(browse.preview.leave.cta).toBe('Leave preview');
  });

  it('has the Access screen of section 4.3: title, a line per source, the pre-BR-12b gate line and every action', () => {
    expect(browse.access.title).toBe('This page is for parents and teachers.');
    expect(browse.access.line).toEqual({
      gate: 'Your time in the grown-up area ended.',
      gateUntilIntent: 'Your time in the grown-up area ended. Go back to the app, then open the grown-up area again.',
      account: 'Open lessons again from your account.',
      unknown: 'On a family device, open them from the grown-up area. Parents and teachers can also open them from their account.',
    });
    expect(browse.access.backToGrownUp.cta).toBe('Back to the grown-up area');
    expect(browse.access.backToApp.cta).toBe('Back to the app');
    expect(browse.access.openFromAccount.cta).toBe('Open lessons from my account');
    expect(browse.access.signIn.cta).toBe('Sign in');
    expect(browse.access.offline).toBe('Grown-up pages need the internet.');
  });

  it('holds exactly these keys', () => {
    expect(leafPaths(browse).sort()).toEqual(
      [
        'access.backToApp.cta',
        'access.backToGrownUp.cta',
        'access.line.account',
        'access.line.gate',
        'access.line.gateUntilIntent',
        'access.line.unknown',
        'access.offline',
        'access.openFromAccount.cta',
        'access.signIn.cta',
        'access.title',
        'documentTitle',
        'home.close.cta',
        'home.howTo',
        'home.title',
        'preview.leave.cta',
        'preview.strip',
        ...BR7_KEYS,
        ...BR8_KEYS,
        ...BR9_KEYS,
        ...BR13_KEYS,
      ].sort(),
    );
  });

  it('passes the caregiver ban list and the spec list; no "Browse", no age, no price, no Hangul', () => {
    for (const path of leafPaths(browse)) for (const s of rendered(path)) {
      expect(findBannedWord(s, 'en', 'caregiver'), `${path}: ${s}`).toBeNull();
      for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), `${path} matches ${name}`).toBe(false);
      expect(s, path).not.toMatch(/browse|\bkids?\b|premium|upgrade|unlock|\bfail|wrong|behind|\$|\d+\s*[-–]\s*\d+/i);
      expect(s, path).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
    }
  });
});

describe('caregiver.browse (BR-7)', () => {
  it('uses the section 6 drafts and the mock words for home', () => {
    expect(browse.home.scope).toEqual({
      sampler: "Your learner's free lessons are open. The others show what they teach.",
      fallback: 'Showing free lessons. We could not check your plan.',
    });
    expect(browse.home.pointer).toBe('To see how your learner is doing, open your home page.');
    expect(browse.home.section).toEqual({ label: 'Show lessons by', route: 'Route', journey: 'Journey', library: 'Library' });
    expect(browse.home.stages.line(7)).toBe('7 stages, from letters to your own words');
    expect(browse.home.note.letterAcrossStage1).toBe('This letter is practiced across Stage 1.');
    expect(browse.home.note.notInVersion).toBe('This lesson is not in this version of the app yet.');
    expect(browse.keep.label).toBe('Keep lessons on this device for 7 days, also offline');
    expect(browse.home.wordCount(12)).toBe('· 12 words');
    expect(browse.home.wordsRowA11y('Food', 12)).toBe('Food, 12 words. Opens the topic.');
    // A closed Words row (switch on, sampler pass) says so, with the learner's own words (section 4.2).
    expect(browse.home.wordsRowClosedA11y('Food', 12)).toBe('Food, 12 words. Not open yet. Opens the topic.');
    expect(browse.home.wordsRowClosedA11y('Food', 1)).toBe('Food, 1 word. Not open yet. Opens the topic.');
    expect(browse.home.storyTileA11y('The Moon Rabbit', 4)).toBe('The Moon Rabbit. About 4 minutes.');
    expect(browse.home.storyTileA11y('The Moon Rabbit', 1)).toBe('The Moon Rabbit. About 1 minute.');
    expect(browse.keep.failed).toBe('Lessons could not be kept on this device.');
    expect(browse.item.wordCount(12)).toBe('12 words');
    expect(browse.item.wordCount(1)).toBe('1 word');
  });

  it('names the item page parts, the grown-up closed line and the billing button (F-ENT-003 section 3.11, F-BILL-002)', () => {
    expect(browse.item.closed).toBe('Opens with the Family Plan or a Group License');
    expect(browse.item.openBilling.cta).toBe('Open billing');
    expect(browse.item.preview.cta).toBe('Preview this lesson');
    expect(browse.item.where.title).toBe('Where it sits');
    expect(`${browse.item.where.stage(1)} · Letters · ${browse.item.where.lesson(1, 3)}`).toBe('Stage 1 · Letters · lesson 1 of 3');
    expect(browse.minutes(5)).toBe('About 5 minutes');
    expect(browse.minutes(1)).toBe('About 1 minute');
    expect(browse.display.note).toBe("These choices change only this preview. No learner's settings change.");
  });
});

describe('caregiver.browse (BR-13)', () => {
  it('names [ Present this ] and says only what is true: no one\'s progress changes (Recent keeps the deck)', () => {
    expect(browse.item.present.cta).toBe('Present this');
    expect(browse.item.presentNote).toBe('Opens this as slides for a classroom screen or a TV. No one\'s progress changes.');
    expect(getMessages('es').caregiver.browse.item.present.cta).toBe('Proyectar');
    expect(getMessages('es').caregiver.browse.item.presentNote).toBe(
      'Abre esto como diapositivas para una pantalla de clase o un televisor. No cambia el progreso de nadie.',
    );
    expect(getMessages('ko').caregiver.browse.item.present.cta).toBe('큰 화면에 띄우기');
    expect(getMessages('ko').caregiver.browse.item.presentNote).toBe('교실 화면이나 TV에 슬라이드로 띄워요. 누구의 진도도 바뀌지 않아요.');
  });

  it('never claims nothing is saved, and keeps the cta inside its 28-character budget in every locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const item = getMessages(locale).caregiver.browse.item;
      expect(item.present.cta.length, locale).toBeLessThanOrEqual(28);
      expect(item.presentNote, locale).not.toMatch(/nothing is saved|no se guarda|저장되지 않/i);
      // One note for every item kind: lessons now, stories and word topics once their slides land (F-TCH-004 PR 11, 12).
      expect(item.presentNote, locale).not.toMatch(/lesson|story|topic|lecci|historia|tema|레슨|이야기|주제/i);
    }
  });

  it('says what to do when the browser gave no new tab, without blame (review of #590)', () => {
    expect(browse.item.presentBlocked).toBe('The new tab did not open. Allow pop-ups for this site, then try again.');
    expect(getMessages('es').caregiver.browse.item.presentBlocked).toBe(
      'La pestaña nueva no se abrió. Permite las ventanas emergentes de este sitio y vuelve a intentarlo.',
    );
    expect(getMessages('ko').caregiver.browse.item.presentBlocked).toBe('새 탭이 열리지 않았어요. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.');
  });
});

/**
 * F-BROWSE-001 BR-10 (sections 4.3, 4.11, 6): the console strings beside an entry and the deep-link buttons, in
 * English, Spanish and Korean; the navigation label is `console.shell.nav.lessons`.
 */
describe('console.browse (BR-10)', () => {
  const consoleBrowse = getMessages('en').console.browse;

  it('says what section 4.3 says: the failed check, its two actions and the blocked storage line', () => {
    expect(consoleBrowse.checkFailed).toBe('Could not check your plan.');
    expect(consoleBrowse.tryAgain.cta).toBe('Try again');
    expect(consoleBrowse.openFree.cta).toBe('Open free lessons');
    expect(consoleBrowse.storageBlocked).toBe("Your browser blocked this page's storage, so lessons cannot open here.");
    expect(consoleBrowse.preview.cta).toBe('Preview');
    expect(consoleBrowse.previewLessons.cta).toBe('Preview lessons');
    expect(getMessages('en').console.shell.nav.lessons).toBe('Lessons');
  });

  it('holds exactly these keys, each with its Spanish and Korean value', () => {
    const paths = leafPaths(consoleBrowse).sort();
    expect(paths).toEqual(['checkFailed', 'openFree.cta', 'preview.cta', 'previewLessons.cta', 'storageBlocked', 'tryAgain.cta']);
    for (const locale of ['es', 'ko'] as const) {
      const local = getMessages(locale).console.browse;
      for (const path of paths) expect(String(lookup(local, path)), `${locale} ${path}`).not.toBe(String(lookup(consoleBrowse, path)));
      expect(getMessages(locale).console.shell.nav.lessons, locale).not.toBe('Lessons');
    }
  });

  it('passes the caregiver ban list in every locale; no "Browse", no age, no price, no lock word, no Hangul in English', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const local = getMessages(locale).console.browse;
      for (const path of leafPaths(local)) {
        const s = String(lookup(local, path));
        expect(findBannedWord(s, locale, 'caregiver'), `${locale} ${path}: ${s}`).toBeNull();
        expect(s, `${locale} ${path}`).not.toMatch(/\bbrowse\b|\bkids?\b|premium|upgrade|unlock|\$|\d/i);
        if (locale === 'en') {
          for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), `${path} matches ${name}`).toBe(false);
          expect(s, path).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
        }
      }
    }
  });
});

describe('caregiver.browse (BR-8)', () => {
  it('the preview end screen says what a learner gets, with no stars, score or card shown as earned (OD-6, BD9)', () => {
    expect(browse.end.lesson).toEqual({
      title: 'That is the whole lesson.',
      line: 'At this point a learner sees 1 to 3 stars and collects:',
      lineNoCard: 'At this point a learner sees 1 to 3 stars.',
    });
    expect(browse.end.story).toEqual({ title: 'That is the whole story.', line: 'A learner can read it again any time.' });
    expect([browse.end.next.cta, browse.end.again.cta, browse.end.back.cta]).toEqual(['Next lesson', 'Preview again', 'Back to the lesson page']);
    expect([browse.end.nextStory.cta, browse.end.readAgain.cta, browse.end.backToStory.cta]).toEqual(['Next story', 'Read again', 'Back to the story page']);
  });

  it('the leave confirm of the preview strip (mock preview-player.md C): no warning, nothing is lost', () => {
    expect(browse.preview.leaveConfirm).toEqual({ title: 'Leave this preview?', keep: { cta: 'Keep going' }, leave: { cta: 'Leave' } });
  });
});

describe('caregiver.dashboard.browse (BR-12a)', () => {
  const gate = (locale: 'en' | 'es' | 'ko') => getMessages(locale).caregiver.dashboard.browse;

  it('uses the "One name everywhere" words of section 6: Open all lessons, Preview lessons', () => {
    expect(gate('en')).toEqual({
      open: { cta: 'Open all lessons' },
      preview: { cta: 'Preview lessons' },
      storageBlocked: "Your browser blocked this page's storage, so lessons cannot open here.",
    });
  });

  it('Spanish and Korean carry every key, in the words the console uses for Preview lessons and the storage line', () => {
    expect(gate('es')).toEqual({
      open: { cta: 'Abrir las lecciones' },
      preview: { cta: 'Ver las lecciones' },
      storageBlocked: 'Tu navegador bloqueó el almacenamiento de esta página. Aquí no se pueden abrir las lecciones.',
    });
    expect(gate('ko')).toEqual({
      open: { cta: '모든 레슨 열기' },
      preview: { cta: '레슨 미리 보기' },
      storageBlocked: '브라우저가 이 페이지의 저장 공간을 막았어요. 여기서는 레슨을 열 수 없어요.',
    });
  });

  it('passes the caregiver ban list; no "Browse", no age, no price, no Hangul in English', () => {
    for (const path of leafPaths(gate('en'))) {
      const s = lookup(gate('en'), path) as string;
      expect(findBannedWord(s, 'en', 'caregiver'), `${path}: ${s}`).toBeNull();
      for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(s), `${path} matches ${name}`).toBe(false);
      expect(s, path).not.toMatch(/\bbrowse\b|\bkids?\b|premium|upgrade|unlock|\bfail|wrong|behind|\$|\d+\s*[-–]\s*\d+/i);
      expect(s, path).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
    }
  });
});

describe('caregiver.browse (BR-9)', () => {
  it('names the Hear button of a word row by its romanization, as the mock and the learner topic do', () => {
    expect(browse.topic.hearA11y('sagwa')).toBe('Hear sagwa');
  });
});
