import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-I18N-001 PR 7b: the minigames (MinigameScreen and every game it launches), the audio
// prompt panel and voice help they share, and the story copy behind Story Order move into the
// dictionary with their English wording unchanged (§3.4 rule 1). Content (pairs, glosses, step
// labels in minigame-config) stays content: PR 12.
const m = getMessages('en');
const NO_AGE_OR_FAILURE = /\b(kids?|child(ren)?|ages?|fail\w*|wrong)\b|\p{Extended_Pictographic}/iu;

describe('learner.minigame shell (English wording as shipped)', () => {
  const g = m.learner.minigame;

  it('keeps the fallback cards and their way out', () => {
    expect(g.notFound).toBe('Minigame not found.');
    expect(g.comingSoon).toBe('This minigame is coming soon.');
    expect(g.voiceSoon).toBe('Voice practice is opening in our next beta.');
    expect(g.backToQuest.cta).toBe('Back to quest');
    expect(g.noRounds).toBe('No rounds.');
  });

  it('keeps the round counter and the skip button', () => {
    expect(g.progress.pill(1, 4)).toBe('1 / 4');
    expect(g.skip.cta).toBe('Skip');
  });

  it('never uses age words, failure language or emoji', () => {
    expect(JSON.stringify(g)).not.toMatch(NO_AGE_OR_FAILURE);
  });
});

describe('Build a Letter (English wording as shipped)', () => {
  const b = m.learner.minigame.buildLetter;

  it('keeps the heading, the row captions and the miss bubble', () => {
    expect(b.heading).toBe('Build this letter');
    expect(b.slots).toBe('Slots:');
    expect(b.tiles).toBe('Tiles');
    expect(b.notQuite('The vowel goes beside the first letter.')).toBe(
      'Not quite. Try again. The vowel goes beside the first letter.',
    );
  });

  it('keeps one whole hint per block shape', () => {
    expect(b.shape).toEqual({
      beside: 'The vowel goes beside the first letter.',
      under: 'The vowel goes under the first letter.',
      besideFinal: 'The vowel goes beside the first letter. The last letter sits at the bottom.',
      underFinal: 'The vowel goes under the first letter. The last letter sits at the bottom.',
    });
  });

  it('keeps its screen-reader labels', () => {
    expect(m.a11y.minigame.hear('ga')).toBe('Hear ga');
    expect(m.a11y.minigame.finalTile('ng')).toBe('final ng');
    expect(m.a11y.minigame.blockShape('The vowel goes under the first letter.')).toBe(
      'Block shape. The vowel goes under the first letter.',
    );
  });
});

describe('Trace Stroke (English wording as shipped)', () => {
  const t = m.learner.minigame.trace;

  it('keeps the prompt, the buttons and the idle line', () => {
    expect(t.heading('g/k')).toBe('Trace the letter g/k');
    expect(t.instruction).toBe('Draw the letter with your finger.');
    expect(t.showMe.cta).toBe('Show me');
    expect(t.clear.cta).toBe('Clear');
    expect(t.done.cta).toBe('Done');
    expect(t.idle).toBe('Slowly draw the letter. Lift your finger to finish.');
  });

  it('keeps the pass praise, the next-time nudges and the retry lines', () => {
    expect(t.pass).toEqual({
      order: 'You got it! Next time, try drawing the top line first.',
      open: 'Nice! Try drawing left-to-right next time.',
      loop: 'Nice! Next time, try going around the other way.',
      clean: 'Beautiful! That looks like the letter.',
    });
    expect(t.retry).toEqual({
      order: 'Almost! Try drawing the strokes in the right order. Tap Show me to see.',
      start: 'Try again — start at the top!',
    });
  });

  it('keeps the screen-reader labels of the prompt, the canvas and the stroke-order diagram', () => {
    const a = m.a11y.minigame;
    expect(a.traceLetter('g or k')).toBe('Trace the letter g or k');
    expect(a.traceCanvas('g or k')).toBe('Draw the letter g or k with your finger');
    const s = a.strokeOrder;
    expect(s.guide).toBe('Stroke order guide');
    expect(s.summary(['down, then right'])).toBe('Stroke order. One stroke. 1: down, then right.');
    expect(s.summary(['right', 'down', 'right'])).toBe('Stroke order. 3 strokes. 1: right. 2: down. 3: right.');
    expect(s.dot).toBe('a dot');
    expect(s.loop).toBe('a loop');
    expect(s.curving('down and right')).toBe('curving down and right');
    expect(s.legs(['right', 'down'])).toBe('right, then down');
    expect(Object.values(s.direction)).toEqual([
      'right',
      'down and right',
      'down',
      'down and left',
      'left',
      'up and left',
      'up',
      'up and right',
    ]);
    expect(s.close('Stroke order guide')).toBe('Stroke order guide Tap to close.');
  });
});

describe('Card Match (English wording as shipped)', () => {
  it('keeps the heading, the instruction and the Hoya line', () => {
    expect(m.learner.minigame.cardMatch).toEqual({
      heading: 'Match the meaning',
      instruction: 'Tap a Korean word, then its English meaning.',
      nowMeaning: 'Now tap its meaning on the right.',
    });
    expect(m.a11y.minigame.koreanWord('gimchi')).toBe('Korean word gimchi');
    expect(m.a11y.minigame.meaning('Kimchi')).toBe('English meaning Kimchi');
  });
});

describe('Culture Quiz (English wording as shipped)', () => {
  it('keeps the heading and the miss line', () => {
    expect(m.learner.minigame.cultureQuiz).toEqual({
      heading: 'What does this mean?',
      tryAnother: 'Not quite — try another!',
    });
  });
});

describe('Odd One Out (English wording as shipped)', () => {
  it('keeps the heading, the instruction and the miss line', () => {
    expect(m.learner.minigame.oddOneOut).toEqual({
      heading: "Tap the one that doesn't belong",
      instruction: 'Three are the same kind. One is different.',
      lookAgain: 'Look again — which kind is different?',
    });
  });
});

describe('Tap & Respond (English wording as shipped)', () => {
  it('keeps the heading, the speaker caption and the miss line', () => {
    expect(m.learner.minigame.tapRespond).toEqual({
      noDialogue: 'No dialogue.',
      heading: 'Choose your reply',
      someoneSays: 'Someone says',
      tryAnother: "Hmm, that doesn't fit. Try another!",
    });
  });
});

describe('learner.audio (F-AUDIO-004 §3.7-3.8, English wording as shipped)', () => {
  const a = m.learner.audio;

  it('keeps the prompt panel lines and its actions', () => {
    expect(a.readHere).toBe('No sound? Read it here.');
    expect(a.heading.listen).toBe('Tap the letter you hear');
    expect(a.heading.text).toBe('Tap the letter for this sound');
    expect(a.listenAgain).toBe('Listen again. This one says');
    expect(a.hearIt.cta).toBe('Hear it');
    expect(a.tapToHear).toBe('Tap to hear');
    expect(a.tapToReplay).toBe('Tap to replay');
    expect(a.action.turn_on.cta).toBe('Turn sound on');
    expect(a.action.try_again.cta).toBe('Try again');
    expect(a.action.tap_to_hear.cta).toBe('Tap to hear');
    expect(a.letterName.cta).toBe('Letter name');
    expect(a.howToAddVoice.cta).toBe('How to add a voice');
  });

  it('keeps the reasons, the speaker labels and the voice lines', () => {
    expect(a.soundIsOff).toBe('Sound is off.');
    expect(a.noKoreanVoice).toBe('No Korean voice on this device');
    expect(a.noKoreanVoiceSentence).toBe('No Korean voice on this device.');
    expect(a.didNotPlay).toBe('The sound did not play.');
    expect(a.speaker).toEqual({ on: 'Play sound', off: 'Play sound, sound is off' });
    expect(a.voice).toEqual({
      ready: 'Korean voice: ready',
      needsInternet: 'Korean voice needs the internet',
      looking: 'Looking for a Korean voice',
    });
    expect(m.a11y.soundSwitch(false, 'Korean voice ready')).toBe('Sound, on. Korean voice ready.');
    expect(m.a11y.soundSwitch(true, 'Korean voice needs the internet')).toBe(
      'Sound, off. Korean voice needs the internet.',
    );
  });

  it('keeps the voice help sheet, its three OS families and their steps', () => {
    const h = a.voiceHelp;
    expect(h.title).toBe('Add a Korean voice');
    expect(h.note).toBe('Menu names can differ on your device.');
    expect(h.footer).toBe('You can still play: the sound is written on screen.');
    expect(Object.keys(h.sections)).toEqual(['apple', 'android', 'computer']);
    expect(h.sections.apple.title).toBe('iPhone or iPad');
    expect(h.sections.android.title).toBe('Android');
    expect(h.sections.computer.title).toBe('Computer');
    expect(h.sections.apple.steps).toEqual([
      'Open Settings, then Accessibility.',
      'Tap Spoken Content, then Voices, then Korean.',
      'Download a voice, such as Yuna. Enhanced or Premium sounds best.',
      'Come back and reopen Hangul Route.',
    ]);
    expect(h.sections.android.steps).toEqual([
      'Open Settings, then search for Text-to-speech output.',
      'Choose Speech Services by Google and tap the gear.',
      'Tap Install voice data, then Korean.',
      'Come back and reopen Hangul Route.',
    ]);
    expect(h.sections.computer.steps).toEqual([
      'Mac: System Settings, Accessibility, Spoken Content, System Voice, Manage Voices, then Korean.',
      'Windows: Settings, Time & language, Speech, Manage voices, then Add voices and Korean.',
      'Chrome and Edge: some Korean voices need the internet, so check you are online.',
      'Reload this page.',
    ]);
  });

  it('is plain: no age words, no failure language, no emoji', () => {
    expect(JSON.stringify(a)).not.toMatch(NO_AGE_OR_FAILURE);
    expect(JSON.stringify(a)).not.toMatch(/\b(baby|error|red)\b/i);
  });
});

describe('every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: has the minigame keys`, () => {
      const messages = getMessages(locale);
      expect(typeof messages.learner.minigame.notFound).toBe('string');
      expect(typeof messages.learner.minigame.progress.pill).toBe('function');
      expect(typeof messages.learner.audio.readHere).toBe('string');
      expect(messages.learner.audio.voiceHelp.sections.apple.steps.length).toBeGreaterThan(0);
    });
  }
});

/** The subtrees this PR adds; each game's commit extends the list. */
const NEW_PREFIXES = ['learner.minigame', 'learner.audio', 'a11y.soundSwitch', 'a11y.minigame'];

// en-XA (F-I18N-001 §3.11): every new key, function messages and step lists included, survives pseudo-localisation.
describe('en-XA covers the new keys', () => {
  const paths = leafPaths(m).filter((p) => NEW_PREFIXES.some((x) => p === x || p.startsWith(`${x}.`)));
  const pseudo = pseudoLocalize(m);

  it('finds the new leaves', () => {
    expect(paths.length).toBeGreaterThan(5);
  });

  for (const path of paths) {
    it(`${path} is bracketed and at least 40% longer`, () => {
      const value = lookup(pseudo, path);
      const source = lookup(m, path);
      const outputs: Array<[string, string]> = [];
      if (typeof value === 'string' && typeof source === 'string') outputs.push([value, source]);
      else if (Array.isArray(value) && Array.isArray(source)) {
        source.forEach((s, i) => outputs.push([String(value[i]), String(s)]));
      } else if (typeof value === 'function' && typeof source === 'function') {
        const samples = SAMPLES[path];
        expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
        for (const args of samples ?? []) {
          outputs.push([(value as (...a: unknown[]) => string)(...args), (source as (...a: unknown[]) => string)(...args)]);
        }
      } else throw new Error(`${path} is neither a string, a list nor a function`);
      expect(outputs.length).toBeGreaterThan(0);
      for (const [out, src] of outputs) {
        expect(out).toBe(pseudoText(src));
        expect(out.startsWith('[') && out.endsWith(']')).toBe(true);
        expect(out.length - 2).toBeGreaterThanOrEqual(Math.ceil(src.length * 1.4));
      }
    });
  }
});
