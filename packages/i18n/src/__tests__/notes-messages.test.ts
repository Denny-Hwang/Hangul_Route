import {
  FAMILY_LABEL_IDS,
  NOTE_PRESET_AUDIENCE,
  NOTE_PRESET_IDS,
  NOTE_REACTION_IDS,
  NOTE_REPORT_REASONS,
  NOTES_MODES,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord, findWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import type { NoteTextProblem } from '../note-text';
import { getMessages } from '../resolve';
import { isPlainObject, leafPaths, lookup } from '../tree';
import { esCoverageRequired, esReviewedNamespaces } from './es-coverage';
import { KO_NOTES_FB5B } from './ko-notes-fb5b';
import { SAMPLES } from './samples';

/**
 * F-FEEDBACK-001 FB-5 (section 6.3 wording rules, section 6.11, section 9, section 13 row
 * `notes-messages.test.ts`): the notes strings in English, and FB-5b: the Korean and Spanish
 * notes strings (OD-15). Every rule runs on the resolved dictionary of every locale; the English
 * patterns read English, and `LOCALE_WORDS` carries the same rules in Korean and Spanish words, so
 * a real ko / es leaf is held to section 6.3 in its own language, not only by the English regexes.
 */
const en = getMessages('en');

type Rendered = { path: string; text: string; fn: boolean };

/** Every output under `path`: strings as they are, functions with their SAMPLES rows. */
function render(node: unknown, path: string, out: Rendered[] = []): Rendered[] {
  if (typeof node === 'string') out.push({ path, text: node, fn: false });
  else if (Array.isArray(node)) for (const item of node) render(item, path, out);
  else if (typeof node === 'function') {
    const samples = SAMPLES[path];
    expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
    for (const args of samples ?? []) out.push({ path, text: (node as (...a: unknown[]) => string)(...args), fn: true });
  } else if (isPlainObject(node)) for (const [key, value] of Object.entries(node)) render(value, `${path}.${key}`, out);
  return out;
}

const outputsOf = (locale: UiLocale, ns: string): Rendered[] => {
  const node = lookup(getMessages(locale), ns);
  expect(node, `${locale}:${ns} exists`).toBeDefined();
  return render(node, ns);
};

/** The learner-facing namespaces (section 6.3: "every learner-facing string of this spec"). */
const LEARNER_NS = ['common.notes', 'learner.notes', 'a11y.notes'] as const;
/** The grown-up namespaces: caregiver list, third person, no age framing. */
/** `console.shell.nav.notes` only: the other nav labels belong to F-APP-001 and follow its own review. */
const ADULT_NS = ['caregiver.notes', 'console.notes', 'console.shell.nav.notes'] as const;

const sentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
/** A word: a Latin token (accents included for Spanish) or, in Korean, one space-separated eojeol with Hangul. */
const WORD_CHAR: Record<UiLocale, RegExp> = { en: /[A-Za-z]/, es: /[A-Za-zÀ-ɏ]/, ko: /[A-Za-z가-힯]/ };
const words = (sentence: string, locale: UiLocale = 'en'): string[] =>
  sentence.split(/\s+/).filter((w) => WORD_CHAR[locale].test(w));

/** Section 6.3 rule 3: reading, listening and writing words only. */
const SPEAKING = /\b(say|says|said|saying|speak|speaks|speaking|spoke|pronounce\w*|talk|talks|talking|talked)\b|\bout loud\b/i;
/** Section 6.3 rule 1: never speed, talent or comparison. */
const COMPARISON = /\b(faster|fastest|quick(er|est)?|best|better than|than|finally|talent\w*|smart\w*|genius|natural)\b/i;
/** Section 6.3 rule 4: no age words, no baby talk. */
const AGE_WORDS = /\b(kid|kids|kiddo|child|children|baby|babies|little one|years? old|toddler)\b/i;
/** Section 6.3 rule 6: never conditional love or pressure. */
const PRESSURE = /\b(if you|don't let|do not let|let me down|must|have to|deadline|or else|disappoint\w*)\b/i;
/** Section 6.11 / 9: no "unread" warnings, no shaming status words. */
const SHAME_STATUS = /\b(unread|ignored|no reply|not read|late|overdue)\b/i;
/** OD-7, section 6.2, section 8.6: no commerce anywhere a learner reads. */
const COMMERCE = /\b(price|prices|plan|plans|buy|pay|paid|upgrade|subscribe|subscription|premium|billing|paywall)\b|\$/i;
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u;

/**
 * FB-5b: the rules above in Korean and Spanish words, matched with `findWord` (Spanish whole tokens,
 * Korean substrings because particles attach to the stem). English keeps its regexes. Each list is
 * what a translation of the English draft could slip into; a list grows with a test.
 */
type RuleName = 'speaking' | 'comparison' | 'pressure' | 'age' | 'shame' | 'commerce' | 'account';
const LOCALE_WORDS: Record<'es' | 'ko', Record<RuleName, readonly string[]>> = {
  es: {
    speaking: [
      'di', 'dime', 'decir', 'dices', 'dijiste', 'habla', 'hablas', 'hablar', 'hablaste', 'hablamos', 'hablemos',
      'pronuncia', 'pronuncias', 'pronunciar', 'pronunciación', 'voz alta', 'conversar',
    ],
    comparison: [
      'más rápido', 'más rápida', 'el mejor', 'la mejor', 'los mejores', 'mejor que', 'más que nadie', 'por fin',
      'finalmente', 'talento', 'inteligente', 'genio', 'que los demás',
    ],
    pressure: ['si practicas', 'si estudias', 'si lo haces', 'tienes que', 'debes', 'decepciones', 'decepción', 'fecha límite', 'plazo', 'o si no'],
    age: ['niño', 'niña', 'niños', 'niñas', 'infantil', 'bebé', 'bebés', 'peque', 'pequeñín', 'pequeñines'],
    shame: ['no leído', 'no leída', 'sin leer', 'ignorado', 'ignorada', 'sin respuesta', 'vencido', 'vencida'],
    commerce: ['precio', 'precios', 'plan', 'planes', 'comprar', 'pagar', 'pago', 'pagado', 'suscribirte', 'suscripción', 'premium', 'facturación', 'mejora tu plan'],
    account: ['correo', 'email', 'e-mail'],
  },
  ko: {
    speaking: ['말하', '말해', '말할', '말씀', '발음', '소리 내', '소리내', '큰 소리', '따라 말', '대화하'],
    comparison: ['더 빨리', '빠르게', '최고', '일등', '1등', '드디어', '재능', '천재', '똑똑', '타고난', '누구보다', '남보다', '다른 친구보다'],
    pressure: ['해야 해', '해야 돼', '해야 한', '하면 기쁠', '실망', '꼭 해', '안 하면', '않으면', '마감', '기한'],
    age: ['어린이', '아이들', '꼬마', '아기', '유아', '애기', '살짜리'],
    shame: ['안 읽음', '읽지 않음', '안 읽었', '무시', '답장 없음', '답이 없', '늦었', '늦음'],
    commerce: ['가격', '요금', '플랜', '구매', '결제', '업그레이드', '구독', '프리미엄', '유료'],
    account: ['계정', '이메일'],
  },
};

/** The first word of `rule` in `text` for `locale` (English: none here, its regexes cover it). */
const localeWord = (text: string, locale: UiLocale, rule: RuleName): string | null =>
  locale === 'en' ? null : findWord(text, LOCALE_WORDS[locale][rule], locale);

describe('common.notes ids (section 6.3, 6.6, 6.11)', () => {
  it('has English text for every preset id, in the catalogue order', () => {
    expect(Object.keys(en.common.notes.presets)).toEqual([...NOTE_PRESET_IDS]);
    for (const id of NOTE_PRESET_IDS) expect(en.common.notes.presets[id].length).toBeGreaterThan(0);
  });

  it('has English text for every reaction id and family label id', () => {
    expect(Object.keys(en.common.notes.reactions)).toEqual([...NOTE_REACTION_IDS]);
    expect(Object.keys(en.common.notes.familyLabels)).toEqual([...FAMILY_LABEL_IDS]);
  });

  it('has a label for every preset group the composer draws', () => {
    const groups = new Set(NOTE_PRESET_IDS.map((id) => id.split('_')[0]));
    expect(Object.keys(en.console.notes.composer.groups).sort()).toEqual([...groups].sort());
  });

  it('pins the Appendix A drafts and the fallback line', () => {
    expect(en.common.notes.presets.effort_keep_trying).toBe('You keep trying. That is how we learn.');
    expect(en.common.notes.presets.next_try_this).toBe('Try this quest next. I think you will like it.');
    expect(en.common.notes.presets.next_look_again).toBe("Let's look at your letters again together.");
    expect(en.common.notes.presets.warm_see_you_in_class).toBe('See you in class soon.');
    expect(en.common.notes.presetFallback).toBe('A note for you.');
    expect(en.common.notes.reactions).toEqual({
      thanks: 'Thank you',
      will_try: 'I will try it',
      did_it: 'I did it',
      happy: 'This made me happy',
    });
    expect(en.common.notes.familyLabels.family).toBe('Your family');
    expect(en.common.notes.familyLabels.guardian).toBe('Your guardian');
    expect(en.common.notes.familyLabels.partner).toBe('Your partner');
    expect(en.common.notes.teacherLabel('Sunday Class A')).toBe('Your teacher · Sunday Class A');
    expect(en.common.notes.teacherOnly).toBe('Your teacher');
  });

  it('section 6.3 rule 7: a next-step preset never points at something the note may not carry', () => {
    expect(en.common.notes.presets.next_look_again).not.toMatch(/\bthese\b/i);
    for (const id of NOTE_PRESET_IDS.filter((p) => p.startsWith('next_'))) {
      expect(en.common.notes.presets[id], id).not.toMatch(/\b(by|before|today|tomorrow|now)\b/i);
    }
  });

  it('a teacher-only or family-only preset speaks from that side', () => {
    expect(NOTE_PRESET_AUDIENCE.warm_see_you_in_class).toBe('teacher');
    expect(en.common.notes.presets.warm_see_you_in_class).toMatch(/\bclass\b/);
    expect(NOTE_PRESET_AUDIENCE.warm_learning_together).toBe('family');
    expect(en.common.notes.presets.warm_learning_together).not.toMatch(/\bclass\b/);
  });
});

describe('every report reason and notes mode has words for the grown-up surfaces', () => {
  it('caregiver and console report sheets name every reason', () => {
    for (const ns of ['caregiver.notes.report.reasons', 'console.notes.family.report.reasons'] as const) {
      const node = lookup(en, ns);
      expect(isPlainObject(node) ? Object.keys(node) : [], ns).toEqual([...NOTE_REPORT_REASONS]);
      for (const { text } of render(node, ns)) expect(text.length).toBeGreaterThan(0);
    }
    expect(en.caregiver.notes.report.reasons.not_for_me('Sam')).toBe('Not meant for Sam');
  });

  it('the class-notes setting names every mode, in the app and in the console', () => {
    expect(Object.keys(en.caregiver.notes.mode.options)).toEqual([...NOTES_MODES]);
    expect(Object.keys(en.console.notes.family.settings.options)).toEqual([...NOTES_MODES]);
    expect(en.caregiver.notes.mode.options).toEqual({ all: 'All notes', presets: 'Encouragements only', off: 'Off' });
  });

  it('the composer has a friendly line for every text-guard problem, quoting the token for link and tone', () => {
    const problems: readonly NoteTextProblem[] = ['empty', 'too_long', 'line_break', 'link', 'contact', 'emoji', 'tone', 'invalid'];
    expect(Object.keys(en.console.notes.composer.problems).sort()).toEqual([...problems].sort());
    expect(en.console.notes.composer.problems.link('kim.com')).toBe('Links can\'t be sent in a note ("kim.com").');
    expect(en.console.notes.composer.problems.tone('xyz')).toBe('Please choose a kinder word than "xyz".');
    expect(en.console.notes.composer.problems.too_long(120)).toBe('Please keep it to 120 characters.');
    expect(en.console.notes.composer.problems.contact).toBe('Email addresses, handles and phone numbers can\'t be sent in a note.');
  });
});

describe('section 6.3 wording rules on every learner-facing notes string, every locale', () => {
  for (const locale of LOCALES as readonly UiLocale[]) {
    const outputs = LEARNER_NS.flatMap((ns) => outputsOf(locale, ns));

    it(`${locale}: no banned word of any locale's learner or caregiver list (rule 2)`, () => {
      for (const { path, text } of outputs) {
        for (const list of LOCALES) expect(findBannedWord(text, list, 'caregiver'), `${path}: ${text} (${list})`).toBeNull();
      }
    });

    it(`${locale}: no speaking words, no comparison, no pressure, no age words (rules 1, 3, 4, 6)`, () => {
      for (const { path, text } of outputs) {
        expect(SPEAKING.test(text), `${path}: ${text}`).toBe(false);
        expect(COMPARISON.test(text), `${path}: ${text}`).toBe(false);
        expect(PRESSURE.test(text), `${path}: ${text}`).toBe(false);
        expect(AGE_WORDS.test(text), `${path}: ${text}`).toBe(false);
        for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(text), `${path}: ${name}`).toBe(false);
        for (const rule of ['speaking', 'comparison', 'pressure', 'age'] as const) {
          expect(localeWord(text, locale, rule), `${path}: ${text} (${rule})`).toBeNull();
        }
      }
    });

    it(`${locale}: no emoji, and no digits outside a count (rule 5)`, () => {
      for (const { path, text, fn } of outputs) {
        expect(EMOJI.test(text), `${path}: ${text}`).toBe(false);
        if (!fn) expect(/\d/.test(text), `${path}: ${text}`).toBe(false);
      }
    });

    it(`${locale}: at most 12 words per sentence (rule 5)`, () => {
      for (const { path, text } of outputs) {
        for (const sentence of sentences(text)) expect(words(sentence, locale).length, `${path}: ${sentence}`).toBeLessThanOrEqual(12);
      }
    });

    it(`${locale}: no commerce, no shaming status and no account words where a learner reads (OD-5, OD-7)`, () => {
      for (const { path, text } of outputs) {
        expect(COMMERCE.test(text), `${path}: ${text}`).toBe(false);
        expect(SHAME_STATUS.test(text), `${path}: ${text}`).toBe(false);
        expect(/\b(account|email|e-mail)\b/i.test(text), `${path}: ${text}`).toBe(false);
        for (const rule of ['commerce', 'shame', 'account'] as const) {
          expect(localeWord(text, locale, rule), `${path}: ${text} (${rule})`).toBeNull();
        }
      }
    });
  }

  it('presets: at most one exclamation mark, no digits, a length budget of 48 characters', () => {
    for (const id of NOTE_PRESET_IDS) {
      const text = en.common.notes.presets[id];
      expect((text.match(/!/g) ?? []).length, id).toBeLessThanOrEqual(1);
      expect(/\d/.test(text), id).toBe(false);
      expect(text.length, id).toBeLessThanOrEqual(48);
      expect(text, id).toMatch(/[.!]$/);
    }
    expect(en.common.notes.presetFallback.length).toBeLessThanOrEqual(48);
  });

  it('reactions and family labels fit a chip (24 and 16 characters), with no digits and no exclamation', () => {
    for (const id of NOTE_REACTION_IDS) {
      expect(en.common.notes.reactions[id].length, id).toBeLessThanOrEqual(24);
      expect(en.common.notes.reactions[id], id).not.toMatch(/[\d!]/);
    }
    for (const id of FAMILY_LABEL_IDS) expect(en.common.notes.familyLabels[id].length, id).toBeLessThanOrEqual(16);
  });

  it('presets are second person or about the shared effort, never about the sender alone', () => {
    for (const id of NOTE_PRESET_IDS) expect(en.common.notes.presets[id], id).toMatch(/\b(you|your|we|let's)\b/i);
  });
});

describe('learner.notes lines (section 6.5, 6.6, 6.10)', () => {
  it('has the reaction seen-by lines the spec names by key', () => {
    expect(en.learner.notes.reactionSeenBy.teacher).toBe('Your teacher will see your answer.');
    expect(en.learner.notes.reactionSeenBy.family).toBe('Your family will see your answer.');
  });

  it('says "Tell a grown-up" on a child-managed profile and "Report this note" on a self-managed one', () => {
    expect(en.learner.notes.detail.tellGrownUp.cta).toBe('Tell a grown-up');
    expect(en.learner.notes.detail.reportSelf.cta).toBe('Report this note');
    // No "report" word on a child's page except the self-managed link (wireframe notes/detail.md).
    const reportWords = render(lookup(en, 'learner.notes'), 'learner.notes').filter(({ text }) => /\breport/i.test(text));
    expect(reportWords.map(({ path }) => path)).toEqual(['learner.notes.detail.reportSelf.cta']);
  });

  it('counts go through the plural helper', () => {
    expect(en.learner.notes.home.newCount(1)).toBe('1 new note');
    expect(en.learner.notes.home.newCount(2)).toBe('2 new notes');
    expect(en.console.notes.composer.result.sent.class(1)).toBe('Sent to 1 student.');
    expect(en.console.notes.composer.result.sent.class(17)).toBe('Sent to 17 students.');
    expect(en.console.notes.composer.result.sent.family(2)).toBe('Sent to 2 learners.');
    expect(en.console.notes.composer.limit(3)).toBe('3 notes today. You can send more tomorrow.');
    expect(en.console.notes.composer.limit(1)).toBe('1 note today. You can send more tomorrow.');
  });

  it('pins the Home card, list and page lines', () => {
    expect(en.learner.notes.home.title('Grandma')).toBe('A note from Grandma');
    expect(en.learner.notes.home.read.cta).toBe('Read');
    expect(en.learner.notes.list.title).toBe('My notes');
    expect(en.learner.notes.list.empty).toBe('No notes yet. Notes from your teacher or family will show here.');
    expect(en.learner.notes.detail.reactions.heading).toBe('Answer with one tap');
    expect(en.learner.notes.detail.putAway.cta).toBe('Put this note away');
    expect(en.learner.notes.detail.putAwayDone).toBe('Put away. A grown-up can still see it.');
    // A self-managed profile may have no family: its line never names a grown-up (section 6.3 rule 4).
    expect(en.learner.notes.detail.putAwayDoneSelf).toBe('Put away. It is hidden on this device.');
    expect(/grown[- ]?up|adult|parent|family/i.test(en.learner.notes.detail.putAwayDoneSelf)).toBe(false);
    expect(en.learner.notes.detail.gone).toBe('This note was put away.');
  });

  it('a11y lines: the Home card group and the announced pick', () => {
    expect(en.a11y.notes.card('Grandma', 'You keep trying. That is how we learn.')).toBe(
      'New note from Grandma: You keep trying. That is how we learn. Read.',
    );
    expect(en.a11y.notes.reactionPicked('Thank you')).toBe('You picked: Thank you');
  });
});

describe('grown-up notes strings (section 6.10, 6.13, 7.7, 8.2, 9)', () => {
  for (const locale of LOCALES as readonly UiLocale[]) {
    const outputs = ADULT_NS.flatMap((ns) => outputsOf(locale, ns));

    it(`${locale}: pass the caregiver banned list of every locale, no emoji, no age framing`, () => {
      for (const { path, text } of outputs) {
        for (const list of LOCALES) expect(findBannedWord(text, list, 'caregiver'), `${path}: ${text} (${list})`).toBeNull();
        expect(EMOJI.test(text), `${path}: ${text}`).toBe(false);
        expect(AGE_WORDS.test(text), `${path}: ${text}`).toBe(false);
        for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(text), `${path}: ${name}`).toBe(false);
        expect(localeWord(text, locale, 'age'), `${path}: ${text}`).toBeNull();
      }
    });

    it(`${locale}: neutral status words only, no prices, plans or upgrades (section 9, OD-7)`, () => {
      for (const { path, text } of outputs) {
        expect(SHAME_STATUS.test(text), `${path}: ${text}`).toBe(false);
        expect(COMMERCE.test(text), `${path}: ${text}`).toBe(false);
        for (const rule of ['shame', 'commerce'] as const) expect(localeWord(text, locale, rule), `${path}: ${text} (${rule})`).toBeNull();
      }
    });
  }

  it('speaks of the learner in the third person, by the name it is given ("viewer" third person)', () => {
    const outputs = [...render(lookup(en, 'caregiver.notes'), 'caregiver.notes'), ...render(lookup(en, 'console.notes'), 'console.notes')];
    for (const { path, text } of outputs) expect(/\byour (child|son|daughter|student|learner)\b/i.test(text), `${path}: ${text}`).toBe(false);
    expect(en.caregiver.notes.title('Sam')).toBe('Notes for Sam');
    expect(en.caregiver.notes.hide.cta('Sam')).toBe('Hide from Sam');
    expect(en.caregiver.notes.disclosure('Sam')).toBe('Teachers see the answer Sam picks on their notes.');
    expect(en.console.notes.family.disclosure('Sam')).toBe(
      'Teachers see the answer Sam picks on their notes. They do not see when a note was read.',
    );
  });

  it('uses the neutral status words of section 9', () => {
    expect(en.console.notes.status).toEqual({ sent: 'Sent', opened: 'Opened', not_shown: 'Not shown', withdrawn: 'Taken back' });
    expect(en.console.notes.family.withdrawn).toBe('Taken back by the sender');
  });

  it('names a class note by its class, never by the teacher account (section 8.2-a)', () => {
    expect(en.console.notes.family.from.class('Sunday Class A')).toBe('From Sunday Class A (teacher)');
    expect(en.console.notes.family.from.class.length).toBe(1);
  });

  it('words a family note as one whole line, never with the account name (OD-5)', () => {
    expect(en.console.notes.family.from.home).toBe('From home');
    expect(en.console.notes.family.from.homeSigned('Grandma')).toBe('From home, signed Grandma');
    expect(en.console.notes.family.from.homeSigned.length).toBe(1);
  });

  it('pairs the class and family words of the sent list and the recipient lines', () => {
    expect(en.console.notes.sent.back).toEqual({ class: 'Back to class', family: 'Back to family' });
    expect(en.console.notes.composer.recipientsProblem).toEqual({ class: 'Choose up to 300 students.', family: 'Choose up to 300 learners.' });
    expect(en.console.notes.composer.recipientsInvalid).toBe('This list cannot be sent as it is. Refresh and try again.');
  });

  it('gives the closed suggestion its caption, with no price, plan or link (section 6.5, F-ENT-003)', () => {
    expect(en.learner.notes.detail.suggest.closed).toBe('Opens with the full route');
  });

  it('labels the adult nav item "Notes" (console.shell.nav.notes)', () => {
    expect(en.console.shell.nav.notes).toBe('Notes');
  });

  it('pins the server-problem lines of the composer (wireframe console/note-composer.md)', () => {
    expect(en.console.notes.composer.errors.sendingOff).toBe('Sending notes is not open yet.');
    expect(en.console.notes.composer.errors.paused).toBe('Sending notes is paused for this account. Write to hello@hangulroute.com.');
    expect(en.console.notes.composer.errors.notAllowed).toBe('The family owner can let you send notes.');
    expect(en.console.notes.composer.errors.wait).toBe('Please wait a minute and try again.');
    expect(en.console.notes.composer.errors.notInSpace).toBe('Someone on this list is no longer in this space. Refresh and try again.');
    expect(en.console.notes.family.wait).toBe('Please wait a minute and try again.');
    expect(en.console.notes.composer.closedMark).toBe('Some learners can open this lesson only with the full route.');
  });
});

describe('ko / es notes strings (FB-5b, OD-15)', () => {
  const NOTES_NS = ['common.notes', 'learner.notes', 'caregiver.notes', 'console.notes', 'a11y.notes'];
  const isNotes = (path: string): boolean => NOTES_NS.some((n) => path.startsWith(`${n}.`)) || path === 'console.shell.nav.notes';
  const enNotes = leafPaths(en).filter(isNotes);
  const ownNotes = (overlay: object): Set<string> => new Set(leafPaths(overlay).filter(isNotes));
  const ko$ = getMessages('ko');

  it('translates every notes string the FB-5b ko review signed; a later English notes key may wait for the next ko draft', () => {
    // The coverage ratchet (F-I18N-001 section 3.10 step 4) for hidden ko: the frozen FB-5b key set must stay
    // translated, while an English notes key added after this review falls back until the next draft and review.
    expect(enNotes.length).toBeGreaterThan(40);
    expect(KO_NOTES_FB5B.length).toBeGreaterThan(40);
    const own = ownNotes(ko);
    const enSet = new Set(enNotes);
    expect(KO_NOTES_FB5B.filter((path) => enSet.has(path) && !own.has(path))).toEqual([]);
    expect(ko$.common.notes.presets.effort_proud).not.toBe(en.common.notes.presets.effort_proud);
  });

  it('translates every es notes string (F-I18N-001 PR 15, the es half of FB-5b), so the rules above run on Spanish', () => {
    const esNotes = ownNotes(es);
    expect(esNotes.size).toBeGreaterThan(40);
    // The coverage ratchet (section 3.10 step 4): a notes key English adds after the review may wait for the next
    // draft while es is hidden; inside a namespace the review signed, none may fall back.
    const reviewed = esReviewedNamespaces();
    expect(enNotes.filter((path) => !esNotes.has(path) && esCoverageRequired(path, reviewed))).toEqual([]);
    expect(getMessages('es').common.notes.presets.effort_proud).not.toBe(en.common.notes.presets.effort_proud);
  });

  it('ko: no particle that changes with the final consonant is attached to an argument (F-I18N-001 section 3.10)', () => {
    // A string argument is replaced by a marker; the character after it must not be such a particle.
    const MARK = '\uE000';
    const PARTICLE = /\uE000(은|는|이|가|을|를|과|와|으로|로|아|야|이나|나|이랑|랑|이에요|예요|이라|라)/;
    for (const path of enNotes) {
      const value = lookup(ko$, path);
      if (typeof value !== 'function') continue;
      for (const args of SAMPLES[path] ?? []) {
        const marked = args.map((a) => (typeof a === 'string' ? MARK : a));
        const out = (value as (...a: unknown[]) => string)(...marked);
        expect(PARTICLE.test(out), `${path}: ${out.replace(/\uE000/g, '{x}')}`).toBe(false);
      }
    }
  });

  it('ko presets, reactions and family labels keep the English budgets (section 6.3 rule 5)', () => {
    for (const id of NOTE_PRESET_IDS) {
      const text = ko$.common.notes.presets[id];
      expect((text.match(/!/g) ?? []).length, id).toBeLessThanOrEqual(1);
      expect(/\d/.test(text), id).toBe(false);
      expect(text.length, id).toBeLessThanOrEqual(48);
      expect(text, id).toMatch(/[.!]$/);
    }
    expect(ko$.common.notes.presetFallback.length).toBeLessThanOrEqual(48);
    for (const id of NOTE_REACTION_IDS) {
      expect(ko$.common.notes.reactions[id].length, id).toBeLessThanOrEqual(24);
      expect(ko$.common.notes.reactions[id], id).not.toMatch(/[\d!]/);
    }
    for (const id of FAMILY_LABEL_IDS) expect(ko$.common.notes.familyLabels[id].length, id).toBeLessThanOrEqual(16);
  });

  it('ko: the teacher-only preset names the class, the family-only one does not; next steps carry no deadline', () => {
    expect(ko$.common.notes.presets.warm_see_you_in_class).toMatch(/수업|반/);
    expect(ko$.common.notes.presets.warm_learning_together).not.toMatch(/수업|반에서|선생님/);
    for (const id of NOTE_PRESET_IDS.filter((p) => p.startsWith('next_'))) {
      expect(findWord(ko$.common.notes.presets[id], ['까지', '오늘', '내일', '지금', '당장', '이 글자', '이것들'], 'ko'), id).toBeNull();
    }
  });

  it('ko: the class sender line keeps the class name, and a family label is a name, never an account', () => {
    expect(ko$.common.notes.teacherLabel('Sunday Class A')).toContain('Sunday Class A');
    expect(ko$.common.notes.teacherLabel('Sunday Class A')).toContain(ko$.common.notes.teacherOnly);
    expect(ko$.console.notes.family.from.class('Sunday Class A')).toContain('Sunday Class A');
    expect(ko$.console.notes.family.from.homeSigned('Grandma')).toContain('Grandma');
  });

  it('ko: "report" is the self-managed link only on the learner page; the self line names no grown-up', () => {
    const reportWords = render(lookup(ko$, 'learner.notes'), 'learner.notes').filter(({ text }) => /신고/.test(text));
    expect(reportWords.map(({ path }) => path)).toEqual(['learner.notes.detail.reportSelf.cta']);
    expect(/어른|가족|보호자|부모|선생님/.test(ko$.learner.notes.detail.putAwayDoneSelf)).toBe(false);
    expect(ko$.learner.notes.detail.tellGrownUp.cta).toMatch(/어른/);
  });

  it('ko: counts carry the number, one wording for every count (Korean has no plural)', () => {
    expect(ko$.learner.notes.home.newCount(1)).toContain('1');
    expect(ko$.learner.notes.home.newCount(12)).toContain('12');
    expect(ko$.console.notes.composer.result.sent.class(17)).toContain('17');
    expect(ko$.console.notes.composer.limit(3)).toContain('3');
    expect(ko$.console.notes.composer.problems.too_long(120)).toContain('120');
  });

  it('ko: the class-notes mode words are the same in the app and the console, and the composer quotes the token', () => {
    expect(ko$.console.notes.family.settings.options).toEqual(ko$.caregiver.notes.mode.options);
    expect(ko$.console.notes.composer.problems.link('kim.com')).toContain('"kim.com"');
    expect(ko$.console.notes.composer.problems.tone('xyz')).toContain('"xyz"');
    expect(ko$.console.notes.composer.errors.paused).toContain('hello@hangulroute.com');
    expect(ko$.console.notes.family.report.tooMany).toContain('hello@hangulroute.com');
  });

  it('ko: pins the lines the multi-agent review changed (names never before a consonant-dependent particle)', () => {
    expect(ko$.common.notes.familyLabels.aunt).toBe('이모');
    expect(ko$.caregiver.notes.disclosure('Mina')).toBe('선생님은 자기가 보낸 쪽지에서 Mina의 답을 볼 수 있어요.');
    expect(ko$.console.notes.family.disclosure('Mina')).toBe(
      '선생님은 자기가 보낸 쪽지에서 Mina의 답을 볼 수 있어요. 쪽지를 언제 읽었는지는 볼 수 없어요.',
    );
    expect(ko$.caregiver.notes.report.reasons.not_for_me('Mina')).toBe('Mina에게 보낸 쪽지가 아니에요');
    expect(ko$.console.notes.family.report.reasons.not_for_me('Mina')).toBe('Mina에게 보낸 쪽지가 아니에요');
    expect(ko$.caregiver.notes.empty('Mina')).toBe('아직 Mina에게 온 쪽지가 없어요.');
    expect(ko$.console.notes.family.blockConfirm.body('Mina')).toBe('이제 Mina에게는 이 사람의 쪽지가 오지 않아요. 보낸 사람에게는 알리지 않아요.');
  });

  it('ko: the grown-up side names a teacher by the class, never "your child" (section 8.2-a, section 9)', () => {
    const outputs = [...render(lookup(ko$, 'caregiver.notes'), 'caregiver.notes'), ...render(lookup(ko$, 'console.notes'), 'console.notes')];
    for (const { path, text } of outputs) expect(/자녀분|아이가|우리 아이|당신의 (학생|자녀)/.test(text), `${path}: ${text}`).toBe(false);
  });
});
