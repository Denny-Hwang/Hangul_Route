import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { findBannedWord } from '../banned';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-I18N-001 PR 8b: Restore, Save my progress, Join a class, the cloud status line, the install
// sheet, the PWA banners and the crash screen move into the dictionary with their English wording
// unchanged (§3.4 rule 1).
const m = getMessages('en');
const c = m.caregiver;

describe('caregiver.retry (shared by Restore and Join a class)', () => {
  it('keeps the calm lines for a busy server, no network and anything else', () => {
    expect(c.retry).toEqual({
      tooManyAttempts: "Let's wait a few minutes before trying again.",
      offline: 'This needs internet. Try again when you are online.',
      unknown: 'Something went wrong. Try again in a moment.',
    });
  });
});

describe('caregiver.sync (the cloud status line and the "Save now" note)', () => {
  it('keeps every status line', () => {
    const s = c.sync.status;
    expect(s.deviceOnly).toBe('Saved on this device only.');
    expect(s.needsRescueCode).toBe('Saved on this device. A rescue code turns on cloud saving here.');
    expect(s.retrying).toBe("Couldn't reach the cloud — will retry.");
    expect(s.saving).toBe('Saving to the cloud…');
    expect(s.waiting).toBe('Waiting for the first cloud save.');
    expect(s.justNow).toBe('Saved to the cloud · just now');
  });

  it('counts the minutes with plural()', () => {
    expect(c.sync.status.minutesAgo(1)).toBe('Saved to the cloud · 1 min ago');
    expect(c.sync.status.minutesAgo(12)).toBe('Saved to the cloud · 12 min ago');
  });

  it('keeps the lines after "Save now"', () => {
    expect(c.sync.saveNow).toEqual({
      saved: 'Saved to the cloud.',
      off: 'Cloud saving is not set up on this build.',
      needsRescueCode: "This device can't save to the cloud yet. A rescue code turns it on.",
      unreachable: "Couldn't reach the cloud — try again later.",
    });
  });
});

describe('caregiver.restore (sync/restore)', () => {
  const r = c.restore;

  it('keeps the screen, the rescue-code path and the file path', () => {
    expect(r.title).toBe('Bring back progress');
    expect(r.code.cta).toBe('I have a rescue code');
    expect(r.code.placeholder).toBe('Words, then the number');
    expect(r.code.example).toBe('Like TIGER-MOON-RIVER-APPLE-482139. Older codes look like TIGER-MOON-4821.');
    expect(r.code.find.cta).toBe('Find my cards');
    expect(r.code.looking.cta).toBe('Looking…');
    expect(r.code.notFound).toBe('Check the code and try again.');
    expect(r.cloudOff).toBe('Cloud restore is not set up on this build.');
    expect(r.cloudOffUseFile).toBe('Cloud restore is not set up on this build. Use a saved file instead.');
    expect(r.signIn.comingSoon).toBe('Coming soon');
    expect(r.file).toEqual({
      cta: 'Open a saved file',
      openFailed: "Couldn't open that file.",
      newerVersion: 'This backup comes from a newer version. Update the app first.',
      unreadable: "This file can't be read. Choose a .hangulroute.json backup.",
    });
    expect(r.startFresh.cta).toBe('Start fresh instead');
    expect(r.great.cta).toBe('Great');
  });

  it('words the merge notice as whole sentences, counting with plural()', () => {
    const n = r.notice;
    expect(n.created('Suni')).toBe('Welcome back, Suni! Your journey is here.');
    expect(n.nothingNew('Suni')).toBe('Suni already has everything from this file.');
    expect(n.added('Suni', 1, 0)).toBe("We found Suni's progress! Added 1 card.");
    expect(n.added('Suni', 2, 0)).toBe("We found Suni's progress! Added 2 cards.");
    expect(n.added('Suni', 0, 1)).toBe("We found Suni's progress! Added 1 quest.");
    expect(n.added('Suni', 0, 3)).toBe("We found Suni's progress! Added 3 quests.");
    expect(n.added('Suni', 2, 1)).toBe("We found Suni's progress! Added 2 cards and 1 quest.");
    expect(n.relinked('Suni')).toBe("Welcome back, Suni! You're in the class again.");
  });
});

describe('caregiver.saveProgress (sync/save-progress)', () => {
  const s = c.saveProgress;

  it('keeps the screen and the code block', () => {
    expect(s.title).toBe('Save my progress');
    expect(s.bubble.code('Suni')).toBe("Write this down. It brings Suni's cards back on any device.");
    expect(s.bubble.code(null)).toBe('Write this down. It brings your cards back on any device.');
    expect(s.bubble.noCode).toBe('Once progress is saved to the cloud, a rescue code appears here.');
    expect(s.codeShape(4, 6)).toBe('four words + 6 digits');
    expect(s.codeShape(2, 4)).toBe('two words + 4 digits');
  });

  it('keeps copy, share, save now and the new-code flow', () => {
    expect(s.copy).toEqual({ cta: 'Copy', done: 'Copied.', unavailable: 'Copy is not available here — write it down.' });
    expect(s.share.cta).toBe('Share');
    expect(s.share.title).toBe('Rescue code');
    expect(s.share.text('Suni', 'TIGER-MOON-4821')).toBe('Hangul Route rescue code for Suni: TIGER-MOON-4821');
    expect(s.share.text(null, 'TIGER-MOON-4821')).toBe('Hangul Route rescue code for my learner: TIGER-MOON-4821');
    expect(s.share.unavailable).toBe('Sharing is not available here — copy it instead.');
    expect(s.saveNow.cta).toBe('Save now');
    expect(s.saveNow.saving.cta).toBe('Saving…');
    expect(s.rotate).toEqual({
      cta: 'Get a new code',
      caption: 'The old code stops working.',
      confirmTitle: 'Get a new code?',
      confirmMessage: 'The old code will stop working. Write the new one down.',
      keep: { cta: 'Keep my code' },
      ready: 'New code ready. The old one no longer works.',
      unavailable: "Couldn't get a new code right now.",
    });
  });
});

describe('caregiver.join (sync/join-space)', () => {
  const j = c.join;

  it('keeps the code step', () => {
    expect(j.title).toBe('Join a class');
    expect(j.bubble.idle).toBe('Type the code your teacher gave you.');
    expect(j.bubble.found('Sunday Class A')).toBe('Sunday Class A found!');
    expect(j.bubble.done('Sunday Class A')).toBe("You're in Sunday Class A!");
    expect(j.code.placeholder).toBe('ABC123');
    expect(j.code.rules).toBe('6 letters or numbers — no O, I, 0 or 1');
    expect(j.code.join.cta).toBe('Join');
    expect(j.code.looking.cta).toBe('Looking…');
  });

  it('keeps the confirm, pick and waiting steps', () => {
    expect(j.confirm.seeYouAs).toEqual({ family: 'Your family will see you as:', teacher: 'Your teacher will see you as:' });
    expect(j.confirm.me.cta).toBe("That's me");
    expect(j.confirm.joining.cta).toBe('Joining…');
    expect(j.confirm.alreadyIn.cta).toBe('I was already in this class');
    expect(j.confirm.notThis.cta).toBe('Not this one');
    expect(j.pick.prompt).toBe('Which one is you? Your teacher will check.');
    expect(j.pick.newHere.cta).toBe("I'm new here");
    expect(j.waiting.line('Suni')).toBe('Waiting for your teacher to say yes for Suni.');
    expect(j.waiting.caption).toBe('Ask them to open the class on their screen. This request lasts about 10 minutes.');
    expect(j.waiting.neverMind.cta).toBe('Never mind');
    expect(j.relink).toEqual({
      denied: 'Your teacher said not now. Ask them in class.',
      expired: 'That took too long. Ask your teacher and try again.',
    });
  });

  it('keeps the done card', () => {
    expect(j.done.joined('Sunday Class A')).toBe("You're in Sunday Class A. New missions may show up on Today.");
    expect(j.done.already('Sunday Class A')).toBe("You're already in Sunday Class A.");
    expect(j.done.backToToday.cta).toBe('Back to today');
  });

  it('keeps the calm error lines (the shared ones live in `retry` and `audience`)', () => {
    const { familyFull, ...lines } = j.errors;
    expect(lines).toEqual({
      codeNotFound: "That code didn't work. Check it with your teacher.",
      codeExpired: 'That code is too old. Ask for a new one.',
      classFull: 'This class is full. Ask your teacher.',
      // [SA] AMENDMENTS-SEATS-ADMINS section 9.1.
      schoolFull: 'This school is full right now. Ask your teacher.',
      learnerGone: 'That name is not in this class anymore. Ask your teacher.',
      alreadyOnDevice: 'This device already has that learner — switch profiles instead.',
      badFormat: 'A code has 6 letters or numbers.',
      off: 'Joining a class is not set up on this build.',
    });
    expect(familyFull(4)).toBe('This family already has 4 learners. Ask a grown-up in your family.');
  });

  it('[SA] the full-family and full-school lines in es and ko (AMENDMENTS-SEATS-ADMINS section 9.1): the cap as an argument, no number typed', () => {
    const es = getMessages('es').caregiver.join.errors;
    const ko = getMessages('ko').caregiver.join.errors;
    expect(es.familyFull(4)).toBe('Esta familia ya tiene 4 estudiantes. Pregúntale a un adulto de tu familia.');
    expect(es.schoolFull).toBe('Esta escuela está llena por ahora. Pregúntale a tu docente.');
    expect(ko.familyFull(4)).toBe('이 가족에는 이미 학습자가 4명 있어요. 가족 어른에게 물어봐요.');
    expect(ko.schoolFull).toBe('이 학교는 지금 자리가 다 찼어요. 선생님에게 물어봐요.');
    for (const errors of [j.errors, es, ko]) {
      expect(errors.familyFull(7)).toContain('7');
      expect(errors.familyFull(7)).not.toMatch(/\b4\b/);
      expect(errors.schoolFull).not.toMatch(/\d/);
    }
  });
});

describe('caregiver.install (the install sheet; its heading is `audience.installGuideLine`)', () => {
  it('keeps the steps and buttons', () => {
    const i = c.install;
    expect(i.offline).toBe('Then Hangul Route opens like an app and your cards stay safe, even without Wi-Fi.');
    expect(i.steps).toEqual({
      share: 'Tap Share',
      addToHome: 'Add to Home Screen',
      browserMenu: 'Browser menu',
      installApp: 'Install app / Add to Home screen',
      // Safari for Mac (app-first-run, 2026-10-21).
      fileMenu: 'File menu',
      addToDock: 'Add to Dock',
    });
    expect(getMessages('es').caregiver.install.steps).toMatchObject({ fileMenu: 'Menú Archivo', addToDock: 'Agregar al Dock' });
    expect(getMessages('ko').caregiver.install.steps).toMatchObject({ fileMenu: '파일 메뉴', addToDock: 'Dock에 추가' });
    expect(i.install.cta).toBe('Install');
    expect(i.inAppBrowser).toBe('Open this page in Safari or Chrome first.');
    expect(i.copyLink.cta).toBe('Copy link');
    expect(i.linkCopied.cta).toBe('Link copied');
    expect(i.notNow.cta).toBe('Not now');
  });
});

describe('learner.pwa and learner.oops (the system banners and the crash screen)', () => {
  it('keeps the banners', () => {
    expect(m.learner.pwa).toEqual({
      offline: 'Offline — everything still works',
      offlineReady: 'All set! You can play without Wi-Fi now.',
      update: { title: 'New lessons are ready.', hint: 'Tap when you finish what you are doing.', refresh: { cta: 'Refresh' } },
    });
  });

  it('keeps the crash screen, warm and blame-free; its button is the shared "Try again"', () => {
    expect(m.learner.oops).toEqual({
      title: 'Hoya tripped over a rock.',
      body: "Your cards and stars are safe. Let's hop back in.",
      bubble: 'Oops! That was not your fault. Tap the button and we go again.',
    });
    expect(m.common.buttons.tryAgain).toBe('Try again');
  });
});

describe('accessibility labels of these screens', () => {
  it('are the English labels as shipped', () => {
    expect(m.a11y.classCode).toBe('Class code');
    expect(m.a11y.joinName).toBe('Name your teacher will see');
    expect(m.a11y.rescueCode).toBe('Rescue code');
    expect(m.a11y.goBack).toBe('Go back');
    expect(m.common.buttons.close).toBe('Close');
  });
});

// Every new string, function messages called with their samples.
const NEW_PREFIXES = [
  'caregiver.retry.',
  'caregiver.sync.',
  'caregiver.restore.',
  'caregiver.saveProgress.',
  'caregiver.join.',
  'caregiver.install.',
  'learner.pwa.',
  'learner.oops.',
];
const NEW_A11Y = ['a11y.classCode', 'a11y.joinName'];
const isNew = (path: string): boolean => NEW_PREFIXES.some((p) => path.startsWith(p)) || NEW_A11Y.includes(path);

type Message = (...args: unknown[]) => string;

function renderings(value: unknown, path: string): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'function') throw new Error(`${path} is neither a string nor a function`);
  const samples = SAMPLES[path];
  expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
  return (samples ?? []).map((args) => (value as Message)(...args));
}

describe('no shaming word reaches these screens in any locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: caregiver list`, () => {
      const messages = getMessages(locale);
      for (const path of leafPaths(messages).filter(isNew)) {
        for (const text of renderings(lookup(messages, path), path)) {
          expect(findBannedWord(text, locale, 'caregiver'), `${locale}.${path}`).toBeNull();
        }
      }
    });
  }
});

describe('no price is written into these messages', () => {
  it('has no currency amount', () => {
    for (const path of leafPaths(m).filter(isNew)) {
      for (const text of renderings(lookup(m, path), path)) expect(text, path).not.toMatch(/[$€£]\s?\d|\d\s?(USD|dollars?)/i);
    }
  });
});

// en-XA (F-I18N-001 §3.11): every new key, function messages included, survives pseudo-localisation.
describe('en-XA covers the new keys', () => {
  const paths = leafPaths(m).filter(isNew);
  const pseudo = pseudoLocalize(m);

  it('finds the new leaves', () => {
    expect(paths.length).toBeGreaterThan(80);
  });

  for (const path of paths) {
    it(`${path} is bracketed and at least 40% longer`, () => {
      const value = lookup(pseudo, path);
      const source = lookup(m, path);
      const outs = renderings(value, path);
      const srcs = renderings(source, path);
      outs.forEach((out, i) => {
        const src = srcs[i] ?? '';
        expect(out).toBe(pseudoText(src));
        expect(out.startsWith('[') && out.endsWith(']')).toBe(true);
        expect(out.length - 2).toBeGreaterThanOrEqual(Math.ceil(src.length * 1.4));
      });
    });
  }
});
