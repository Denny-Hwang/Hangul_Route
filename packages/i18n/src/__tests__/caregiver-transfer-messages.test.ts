import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { fallbackPaths, getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-SPACE-002 section 4.12 `caregiver.transfer` (PR T-7d): the learner app's class-move words for the Classes card
// (T-7b, `design/screens/transfer/classes-card.md`) and the app sheets and Home line (T-7c, `app-sheets.md`). English
// values are the mocks' and the spec's drafts word for word (mocks #472). The consent lines stay in content-schema's
// keyed TRANSFER_CONSENT_TEXT; the shared sheet frame stays `console.transfer.consent`. Every new English key has its
// Korean and Spanish value in the same PR (F-I18N-001 section 3.10, multi-agent native review).
const t = getMessages('en').caregiver.transfer;

const EMOJI = /\p{Extended_Pictographic}/u;
const BLAME = ['failed', 'refused', 'rejected', 'denied', 'blocked', 'behind', 'late', 'overdue', 'deadline', 'hurry', 'wrong'];

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

describe('caregiver.transfer (English, F-SPACE-002 section 4.12)', () => {
  it('pins the Classes card buttons and the quiet lines of variants (a), (b), (d) and (d\')', () => {
    expect(t.actions.move.cta).toBe('Move');
    expect(t.actions.review.cta).toBe('Review');
    expect(t.actions.setUpPin.cta).toBe('Set up PIN');
    expect(t.card.classScope).toBe("Use your grown-up's rescue code first.");
    expect(t.card.askConsole).toBe('Ask the grown-up with the account to answer this in the console.');
    expect(t.card.needsPin).toBe('A grown-up needs to set up a PIN first. Open Profile, then Grown-ups.');
    expect(t.card.pinTooNew).toBe('Moves open one day after the PIN is set.');
  });

  it('pins the pending row: who asked, then one state line', () => {
    expect(t.card.sourceAsked('Sunday Class A')).toBe('Sunday Class A asked about a move.');
    expect(t.card.learnerAsked('Saturday Class B')).toBe('Asked: a move to Saturday Class B.');
    expect(t.lines.checkAgain).toBe('Please check this again.');
    expect(t.lines.waitingOther).toBe('Waiting for the other class to answer.');
    expect(t.lines.waitingClasses).toBe('Waiting for the classes to answer.');
    expect(t.lines.waitingRoom).toBe('Waiting for room in the new class.');
    expect(t.lines.cannotAnswer).toBe("This move can't be answered here.");
    expect(t.lines.planned('Oct 14')).toBe('A move is planned for Oct 14.');
    expect(t.lines.ended).toBe('This request ended.');
    expect(t.lines.joinAgain).toBe('Join your new class again.');
  });

  it('pins MoveClass: the screen, the sent line and every answer under the field', () => {
    expect(t.move.title).toBe('Move to another class');
    expect(t.move.step1).toBe('Ask the new teacher for their class code.');
    expect(t.move.codeLabel).toBe('Class code');
    expect(t.actions.find.cta).toBe('Find class');
    expect(t.actions.sending.cta).toBe('Sending…');
    expect(t.move.sent).toBe('Request sent. Nothing changes until everyone says yes.');
    const e = t.errors;
    expect(e.codeNotFound).toBe("That code didn't work.");
    expect(e.codeExpired).toBe('That code is too old. Ask for a new one.');
    expect(e.full).toBe('That class is full right now.');
    expect(e.alreadyMember('Mina')).toBe('Mina is already in that class.');
    expect(e.tooManyAttempts).toBe('Too many tries. Try again later.');
    expect(e.cooldown).toBe('You can ask again in about a week.');
    expect(e.caregiverRequired).toBe('Ask the grown-up with the account to start this move in the console.');
    expect(e.deviceConsentLocked).toBe("Moves can't be started on this device yet.");
    expect(e.alreadyOpenClass('Mina')).toBe('A class already asked about moving Mina. Look on the Classes card.');
    expect(e.alreadyOpenLearner('Mina')).toBe('A move for Mina is already waiting. Look on the Classes card.');
    expect(e.sameSpace('Mina')).toBe('That code is for the class Mina is in now.');
    expect(e.notTransferable).toBe("That code can't be used for a move.");
    expect(e.destinationBusy).toBe('That class has many moves waiting. Try again in a few days.');
    expect(e.tooManyRequests).toBe('Too many moves were started today. Try again tomorrow.');
    expect(e.localeUnavailable).toBe('Not available in your language yet.');
  });

  it('pins the sheets: self consent frame, read-only veto, planned and moved', () => {
    expect(t.consent.titleSelf('Saturday Class B')).toBe('Move to Saturday Class B?');
    expect(t.consent.yesSelf).toBe('Yes, move me');
    expect(t.readOnly.title).toBe('A move is waiting');
    expect(t.lines.askedMoving('Sunday Class A', 'Mina', 'Saturday Class B')).toBe('Sunday Class A asked about moving Mina to Saturday Class B.');
    expect(t.lines.consoleAnswers).toBe('A grown-up with an account answers this in the console.');
    expect(t.lines.notNowEnds).toBe('Not now ends this request.');
    expect(t.actions.notNow.cta).toBe('Not now');
    expect(t.actions.cancelRequest.cta).toBe('Cancel the request');
    expect(t.actions.cancelMove.cta).toBe('Cancel the move');
    expect(t.actions.cancel.cta).toBe('Cancel');
    expect(t.lines.moved('Mina', 'Saturday Class B')).toBe('Moved. Mina is now in Saturday Class B. Cards and stars stayed with Mina.');
  });

  it('pins the Home lines by initiator and audience (no number, no countdown)', () => {
    expect(t.home.learnerWaiting('Saturday Class B')).toBe('A move to Saturday Class B is waiting.');
    expect(t.home.selfWaiting).toBe('A move is waiting for you.');
  });

  it('names every Review and every Move for a screen reader; the gate adds "(PIN required)"', () => {
    const m = getMessages('en').caregiver.audience;
    expect(t.a11y.review).toBe('Review the move');
    expect(t.a11y.move('Sunday Class A')).toBe('Move from Sunday Class A');
    expect(m.gated(t.a11y.move('Sunday Class A'), true)).toBe('Move from Sunday Class A (PIN required)');
    expect(m.gated(t.a11y.review, true)).toBe('Review the move (PIN required)');
  });
});

describe('caregiver.transfer in every locale', () => {
  for (const locale of LOCALES) {
    const outputs = outputsOf(getMessages(locale).caregiver.transfer, 'caregiver.transfer');

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

    it(`${locale}: the Not now line names the sheet's own Not now button`, () => {
      const own = getMessages(locale).caregiver.transfer;
      expect(own.lines.notNowEnds).toContain(own.actions.notNow.cta);
    });
  }

  it('never says "kid", never names an age range, never shows a count or a timer', () => {
    for (const { text } of outputsOf(t, 'caregiver.transfer')) {
      expect(/\bkids?\b/i.test(text)).toBe(false);
      expect(/\bages?\s+\d/i.test(text)).toBe(false);
      expect(/\b(days? left|hours? left|countdown)\b/i.test(text)).toBe(false);
    }
  });
});

describe('caregiver.transfer in Korean and Spanish (same PR, F-I18N-001 section 3.10)', () => {
  for (const locale of ['ko', 'es'] as const) {
    it(`${locale}: every key has its own value (no English fallback)`, () => {
      expect(fallbackPaths(locale).filter((path) => path.startsWith('caregiver.transfer.'))).toEqual([]);
    });
  }

  it('ko: no particle that changes with the final consonant follows an argument', () => {
    const PARTICLE = /^(은|는|이|가|을|를|과|와|으로|로|아|야|이나|나|이랑|랑|이에요|예요|이라|라|였|이었)/;
    const ko = getMessages('ko').caregiver.transfer;
    for (const path of leafPaths(ko as unknown as Record<string, unknown>)) {
      const value = lookup(ko as unknown as Record<string, unknown>, path);
      if (typeof value !== 'function') continue;
      for (const args of SAMPLES[`caregiver.transfer.${path}`] ?? []) {
        const marked = args.map((a, i) => (typeof a === 'string' ? `{${i}}` : a));
        const out = (value as (...a: unknown[]) => string)(...marked);
        for (const piece of out.split(/\{\d\}/).slice(1)) expect(PARTICLE.test(piece), `${path}: ${out}`).toBe(false);
      }
    }
  });

  it('ko: never puts the counter word for class after a class name', () => {
    const ko = getMessages('ko').caregiver.transfer;
    expect(ko.consent.titleSelf('{b}')).not.toMatch(/\{b\}\s*반/);
    expect(ko.home.learnerWaiting('{b}')).not.toMatch(/\{b\}\s*반/);
  });
});
