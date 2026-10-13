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
import { findBannedWord } from '../banned';
import { LOCALES, type UiLocale } from '../locales';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import type { NoteTextProblem } from '../note-text';
import { getMessages } from '../resolve';
import { isPlainObject, leafPaths, lookup } from '../tree';
import { esCoverageRequired, esReviewedNamespaces } from './es-coverage';
import { SAMPLES } from './samples';

/**
 * F-FEEDBACK-001 FB-5 (section 6.3 wording rules, section 6.11, section 9, section 13 row
 * `notes-messages.test.ts`): the notes strings in English. ko / es add nothing yet (OD-15):
 * they fall back to English until a native review passes, so every rule below also runs on
 * the resolved ko / es dictionaries.
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
const words = (sentence: string): string[] => sentence.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));

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
        for (const sentence of sentences(text)) expect(words(sentence).length, `${path}: ${sentence}`).toBeLessThanOrEqual(12);
      }
    });

    it(`${locale}: no commerce, no shaming status and no account words where a learner reads (OD-5, OD-7)`, () => {
      for (const { path, text } of outputs) {
        expect(COMMERCE.test(text), `${path}: ${text}`).toBe(false);
        expect(SHAME_STATUS.test(text), `${path}: ${text}`).toBe(false);
        expect(/\b(account|email|e-mail)\b/i.test(text), `${path}: ${text}`).toBe(false);
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
      }
    });

    it(`${locale}: neutral status words only, no prices, plans or upgrades (section 9, OD-7)`, () => {
      for (const { path, text } of outputs) {
        expect(SHAME_STATUS.test(text), `${path}: ${text}`).toBe(false);
        expect(COMMERCE.test(text), `${path}: ${text}`).toBe(false);
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

describe('ko / es follow the F-I18N-001 review process (OD-15)', () => {
  const ns = ['common.notes', 'learner.notes', 'caregiver.notes', 'console.notes', 'a11y.notes'];
  const isNotes = (path: string): boolean => ns.some((n) => path.startsWith(`${n}.`)) || path === 'console.shell.nav.notes';

  it('adds no ko notes entries yet (FB-5b), so every ko notes string falls back to English', () => {
    expect(leafPaths(ko).filter(isNotes)).toEqual([]);
    expect(getMessages('ko').common.notes.presets.effort_proud).toBe(en.common.notes.presets.effort_proud);
  });

  it('translates every es notes string (F-I18N-001 PR 15, the es half of FB-5b), so the rules above run on Spanish', () => {
    const esNotes = new Set(leafPaths(es).filter(isNotes));
    const enNotes = leafPaths(en).filter(isNotes);
    expect(enNotes.length).toBeGreaterThan(40);
    expect(esNotes.size).toBeGreaterThan(40);
    // The coverage ratchet (§3.10 step 4): a notes key English adds after the review may wait for the next draft
    // while es is hidden; inside a namespace the review signed, none may fall back.
    const reviewed = esReviewedNamespaces();
    expect(enNotes.filter((path) => !esNotes.has(path) && esCoverageRequired(path, reviewed))).toEqual([]);
    expect(getMessages('es').common.notes.presets.effort_proud).not.toBe(en.common.notes.presets.effort_proud);
  });
});
