import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-SPACE-002 section 4.8 `console.transfer` (PR T-6a): the console words of class moves. English values
// are the wireframe's and the T-0b mockups' drafts (`design/screens/transfer/README.md`, "New strings"),
// word for word. Every locale passes the caregiver banned words; no string names an age, says "kid",
// blames, ranks, or shouts a countdown; every sentence keeps the Pre-A1 cap of 16 words.
const t = getMessages('en').console.transfer;

const EMOJI = /\p{Extended_Pictographic}/u;
const BLAME = ['failed', 'refused', 'rejected', 'denied', 'blocked', 'behind', 'late', 'overdue', 'deadline', 'hurry'];

function outputsOf(tree: unknown, prefix: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const path of leafPaths(tree as Record<string, unknown>)) {
    const value = lookup(tree as Record<string, unknown>, path);
    if (typeof value === 'function') {
      const samples = SAMPLES[`${prefix}.${path}`];
      expect(samples, `${prefix}.${path} needs a row in SAMPLES`).toBeDefined();
      for (const args of samples ?? []) out.push({ path, text: (value as (...a: unknown[]) => string)(...args) });
    } else out.push({ path, text: String(value) });
  }
  return out;
}

/** Words per sentence; a placeholder value counts as the words it renders to, so samples are short names. */
function longestSentence(text: string): number {
  return Math.max(
    ...text
      .split(/(?<=[.?!])\s+/)
      .map((sentence) => sentence.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length),
  );
}

describe('console.transfer (English, F-SPACE-002 section 4.8)', () => {
  it('names the page, its entry and the counts with plural()', () => {
    expect(t.title).toBe('Class moves');
    expect(t.entry.cta).toBe('Class moves');
    expect(t.waiting(1)).toBe('1 class move waiting');
    expect(t.waiting(2)).toBe('2 class moves waiting');
    expect(t.schoolRow('Saturday Class B', 2)).toBe('Saturday Class B: 2 class moves waiting');
    expect(t.empty).toBe('Nothing waiting.');
  });

  it('keeps the singular member noun per kind (memberNounSingular)', () => {
    expect(t.memberNoun).toEqual({ family: 'learner', class: 'student', school: 'member' });
    expect(t.history.movedOut(t.memberNoun.class)).toBe('A student moved to another class');
    expect(t.history.joined(t.memberNoun.class)).toBe('A student joined this class');
  });

  it('words the steps with a state word, never colour alone', () => {
    expect(t.steps).toEqual({ family: 'Family', thisClass: 'This class', newClass: 'New class', saidYes: 'said yes', youSaidYes: 'you said yes', waiting: 'waiting' });
    expect(t.a11y.steps).toBe('Who has said yes');
  });

  it('pins the card lines of the requests page and the family page', () => {
    expect(t.lines.familyAsked('Jun')).toBe("Jun's family asked to move to another class.");
    expect(t.lines.familyAskedTo('Jun', 'Saturday Class B')).toBe("Jun's family asked to move to Saturday Class B.");
    expect(t.lines.waitingAll).toBe('Nothing changes until all three say yes.');
    expect(t.lines.scheduled('Oct 14')).toBe('Everyone agreed. The move happens on Oct 14.');
    expect(t.lines.youSaidYes).toBe('You said yes. Nothing changes until everyone says yes.');
    expect(t.lines.fullClass).toBe('Everyone has said yes. This class is full right now.');
    expect(t.lines.waitingRoom).toBe('Waiting for room in the new class.');
    expect(t.lines.waitingBoth('Oct 14')).toBe('Waiting for the other classes. The move happens after Oct 14 if both say yes. You can cancel any time.');
    expect(t.lines.moved('Mina', 'Saturday Class B')).toBe('Moved. Mina is now in Saturday Class B. Cards and stars stayed with Mina.');
    expect(t.lines.manageOwn('Grace')).toBe('Grace manages their own classes. Ask them to start a move on their device.');
    expect(t.history.ended).toBe('This request ended.');
  });

  it('words the meta with plural() and a today form', () => {
    expect(t.meta.asked(0)).toBe('asked today');
    expect(t.meta.asked(1)).toBe('asked 1 day ago');
    expect(t.meta.asked(2)).toBe('asked 2 days ago');
    expect(t.meta.askedByFamily(1)).toBe('asked by the family · 1 day ago');
    expect(t.meta.askedByClass('Sunday Class A', 1)).toBe('Asked by the teacher of Sunday Class A · 1 day ago');
    expect(t.meta.daysLeft(1)).toBe('1 day left');
    expect(t.meta.daysLeft(12)).toBe('12 days left');
  });

  it('pins every start answer of start-sheet.md and family-page.md', () => {
    expect(t.errors.codeNotFound).toBe("That code didn't work.");
    expect(t.errors.codeExpired).toBe('That code is too old. Ask for a new one.');
    expect(t.errors.full).toBe('That class is full right now.');
    expect(t.errors.alreadyMember('Mina')).toBe('Mina is already in that class.');
    expect(t.errors.tooManyAttempts).toBe('Too many tries. Try again later.');
    expect(t.errors.cannotSend).toBe("This request can't be sent right now.");
    expect(t.errors.familyNeeded).toBe('A family account is needed to answer this. Ask the family to start the move from their app.');
    expect(t.errors.sameSpace('Mina')).toBe('That code is for the class Mina is in now.');
    expect(t.errors.alreadyOpen('Mina')).toBe('Mina already has a move waiting.');
    expect(t.errors.destinationBusy).toBe('That class has many moves waiting. Try again in a few days.');
    expect(t.errors.tooManyRequests).toBe('Too many moves were started today. Try again tomorrow.');
    expect(t.errors.notTransferable).toBe("That code can't be used for a move.");
    expect(t.errors.cooldown).toBe('You can ask again in about a week.');
    expect(t.start.sent).toBe('Request sent. Nothing changes until everyone says yes.');
  });

  it('words the consent frame: identity block by age bucket, visible-today items, the reading hint', () => {
    expect(t.consent.title('Mina', 'Saturday Class B')).toBe('Move Mina to Saturday Class B?');
    expect(t.consent.age).toEqual({ days: 'Less than a week old', weeks: 'A few weeks old', months: 'A few months old', years: 'More than a year old' });
    expect(t.consent.learners(8)).toBe('8 learners');
    expect(t.consent.visibleClass('Sunday Class A', 'Mr Han')).toBe('Sunday Class A (teacher Mr Han)');
    expect(t.consent.visibleYou('Kim family')).toBe('Kim family (you)');
    expect(t.consent.readToEnd).toBe('Read to the end to continue.');
    expect(t.consent.yes('Mina')).toBe('Yes, move Mina');
  });
});

describe('console.transfer in every locale', () => {
  for (const locale of LOCALES) {
    const outputs = outputsOf(getMessages(locale).console.transfer, 'console.transfer');

    it(`${locale}: caregiver-safe, no emoji, no kids-only framing, no blame word`, () => {
      for (const { path, text } of outputs) {
        expect(findBannedWord(text, locale, 'caregiver'), `${path}: ${text}`).toBeNull();
        expect(EMOJI.test(text), `${path}: ${text}`).toBe(false);
        for (const framing of KIDS_ONLY_FRAMING) expect(framing.re.test(text), `${path}: ${framing.name}`).toBe(false);
        if (locale === 'en') for (const word of BLAME) expect(new RegExp(`\\b${word}\\b`, 'i').test(text), `${path}: ${text}`).toBe(false);
      }
    });

    it(`${locale}: no sentence over 16 words (Pre-A1)`, () => {
      for (const { path, text } of outputs) expect(longestSentence(text), `${path}: ${text}`).toBeLessThanOrEqual(16);
    });
  }

  it('never says "kid" and never names an age range', () => {
    for (const { text } of outputsOf(t, 'console.transfer')) {
      expect(/\bkids?\b/i.test(text)).toBe(false);
      expect(/\bages?\s+\d/i.test(text)).toBe(false);
    }
  });
});

describe('console.transfer.consent in Korean and Spanish (F-SPACE-002 T-6d: the sheet reads in one language)', () => {
  const samples: Record<string, unknown[]> = {
    title: ['Mina', 'Saturday Class B'],
    teacher: ['Ms Park'],
    learners: [3],
    visibleClass: ['Sunday Class A', 'Mr Han'],
    visibleYou: ['Kim family'],
    visibleFamily: ['Lee family', 'Bo'],
    yes: ['Mina'],
  };
  for (const locale of ['en', 'ko', 'es'] as const) {
    it(`${locale}: the Not now line names the sheet's own Not now button, so it never reads as its opposite`, () => {
      const t = getMessages(locale).console.transfer;
      expect(t.lines.notNowEnds).toContain(t.consent.notNow.cta);
    });
  }
  it('ko: never puts the counter word 반 after a class name ("햇살반 반")', () => {
    expect(getMessages('ko').console.transfer.consent.title('{a}', '{b}')).not.toMatch(/\{b\}\s*반/);
  });
  for (const locale of ['ko', 'es'] as const) {
    it(`${locale}: every frame string is its own, caregiver-safe, and no Korean particle follows an argument`, () => {
      const c = getMessages(locale).console.transfer.consent;
      const english = getMessages('en').console.transfer.consent;
      const texts: string[] = [];
      for (const [key, value] of Object.entries(c)) {
        if (typeof value === 'function') {
          const args = samples[key] ?? [];
          texts.push((value as (...a: unknown[]) => string)(...args));
          expect((value as (...a: unknown[]) => string)(...args), key).not.toBe((english[key as keyof typeof english] as (...a: unknown[]) => string)(...args));
        } else if (typeof value === 'string') {
          texts.push(value);
          expect(value, key).not.toBe(english[key as keyof typeof english]);
        } else texts.push(...Object.values(value as Record<string, string>));
      }
      texts.push(getMessages(locale).console.transfer.lines.notNowEnds);
      for (const text of texts) {
        expect(findBannedWord(text, locale, 'caregiver'), text).toBeNull();
        expect(EMOJI.test(text), text).toBe(false);
      }
      if (locale === 'ko') {
        const raw = [c.title('{a}', '{b}'), c.teacher('{a}'), c.yes('{a}'), c.visibleYou('{a}')];
        for (const text of raw) expect(text, text).not.toMatch(/\}[가-힣]/);
      }
    });
  }
});
