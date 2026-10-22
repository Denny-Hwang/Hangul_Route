import { AvatarKindSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { getMessages } from '../resolve';

// F-I18N-001 PR 5: the first-run and settings surfaces move into the dictionary
// with their English wording unchanged (§3.4 rule 1: no visible change).
const m = getMessages('en');

describe('learner.welcome (English wording as shipped)', () => {
  it('keeps the greeting, invitation, CTAs and trust line', () => {
    expect(m.learner.welcome).toEqual({
      title: "Hi! I'm Hoya.",
      invitation: 'Want to learn Korean letters with me? It only takes a few minutes a day.',
      cta: "Let's start",
      restore: 'I already have progress',
      trust: 'Start Korean from zero, at any age. No ads, ever.',
      // F-APP-001 A-7: the persona row (grown-up-entry-messages.test.ts owns its wording).
      grownUps: m.learner.welcome.grownUps,
      classLink: m.learner.welcome.classLink,
    });
  });

  it('names no age group anywhere on Welcome, in en, es and ko (any age learns here; app-first-run, 2026-10-21)', () => {
    // "At any age" is the point of the trust line; the words that name a group of people by age are not allowed.
    const AGE_GROUP: Record<'en' | 'es' | 'ko', RegExp> = {
      en: /\b(kids?|child(ren)?|grand(parents?|children|kids?)|toddlers?|teens?|teenagers?|seniors?|ages \d)\b/i,
      es: /niñ[oa]s?|nietos?|abuel[oa]s?|adolescentes?|mayores|peques/i,
      ko: /아이[,들 ]|어린이|조부모|할머니|할아버지|손주|청소년|어르신/,
    };
    const lines = (node: unknown): string[] =>
      typeof node === 'string' ? [node] : typeof node === 'function' ? [String((node as (a: string) => unknown)('ABC234'))] : node && typeof node === 'object' ? Object.values(node).flatMap(lines) : [];
    for (const locale of ['en', 'es', 'ko'] as const) {
      const welcome = getMessages(locale).learner.welcome;
      for (const line of lines(welcome)) expect(line, `${locale}: ${line}`).not.toMatch(AGE_GROUP[locale]);
    }
    expect(getMessages('es').learner.welcome.trust).toBe('Empieza el coreano desde cero, a cualquier edad. Sin anuncios, nunca.');
    expect(getMessages('ko').learner.welcome.trust).toBe('나이와 상관없이 한국어를 처음부터 시작해요. 광고는 절대 없어요.');
  });

  it('the class join link card on a device with no profile: the code, what Start does, where to type it in the app (review of #734)', () => {
    const c = m.learner.welcome.classLink;
    expect(c.code('ABC234')).toBe('Class code: ABC234');
    expect(c.next).toBe('Make your profile first. Then Join a class opens.');
    expect(c.inApp).toBe('Already learning in the Hangul Route app? Open it, go to Profile and tap Join a class.');
    // The button names it points at are the shipped ones, in every language.
    for (const locale of ['en', 'es', 'ko'] as const) {
      const words = getMessages(locale);
      expect(words.learner.welcome.classLink.inApp, locale).toContain(words.caregiver.spaces.join.cta);
      expect(words.learner.welcome.classLink.inApp, locale).toContain(words.learner.home.profileLabel);
    }
  });
});

describe('learner.language (the Welcome row) and common.display (the Display sheet, owner items 6 and 7)', () => {
  it('names the Welcome group; the per-profile sentences are gone', () => {
    expect(m.learner.language).toEqual({ groupLabel: 'Language' });
  });

  it('words the Display sheet once for every surface (AMENDMENTS-DISPLAY-NAV section 10)', () => {
    const d = m.common.display;
    expect([d.button, d.a11y, d.title, d.language, d.textSize]).toEqual(['Aa', 'Aa, Display: language and text size', 'Display', 'Language', 'Text size']);
    expect(d.size).toEqual({ standard: 'Standard', large: 'Large', larger: 'Larger', largest: 'Largest' });
    expect(d.preview).toBe('This is how text looks.');
    expect(d.note).toBe('For everyone on this device. Change it any time.');
    expect([d.confirm.question('Español'), d.confirm.use('Español'), d.confirm.back('English')]).toEqual(['Use Español on this device?', 'Use Español', 'Back to English']);
    expect(m.learner.profile.display.row).toBe('Display');
    expect(m.learner.profile.display.line('English', 'Largest')).toBe('English · Text: Largest');
  });

  it('the Aa name begins with the visible sign in every locale (WCAG 2.5.3 Label in Name)', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const d = getMessages(locale).common.display;
      expect(d.a11y.startsWith(`${d.button}, `)).toBe(true);
    }
  });

  it('the Profile display line keeps each size label as the control writes it (a label after its colon)', () => {
    expect(getMessages('es').learner.profile.display.line('Español', 'Máximo')).toBe('Español · Texto: Máximo');
    expect(getMessages('ko').learner.profile.display.line('한국어', '가장 크게')).toBe('한국어 · 글자 크기: 가장 크게');
  });

  it('Spanish and Korean word the sheet too, with no particle on the endonym', () => {
    expect(getMessages('es').common.display.confirm.back('English')).toBe('Volver a English');
    expect(getMessages('ko').common.display.confirm.back('English')).toBe('돌아가기: English');
    expect(getMessages('ko').common.display.confirm.question('Español')).toBe('이 기기의 언어를 바꿀까요? (Español)');
    expect(getMessages('ko').common.display.size).toEqual({ standard: '보통', large: '크게', larger: '더 크게', largest: '가장 크게' });
    // Ordered beyond doubt: "Más grande" then "Máximo" (MAR: "Muy grande" read as possibly smaller than "Más grande").
    expect(getMessages('es').common.display.size).toEqual({ standard: 'Normal', large: 'Grande', larger: 'Más grande', largest: 'Máximo' });
  });
});

describe('learner.createProfile name hints', () => {
  it('moved verbatim from nameHint()', () => {
    expect(m.learner.createProfile.nameHint.tooLong(12)).toBe('Names can be up to 12 letters.');
    expect(m.learner.createProfile.nameHint.unsupportedCharacter).toBe("Please use letters, numbers, spaces, ' or -.");
  });
});

describe('learner.avatars (the cub labels, keyed by AvatarKind)', () => {
  it('has exactly one label per avatar kind, none repeated (colour is never the only cue)', () => {
    expect(Object.keys(m.learner.avatars).sort()).toEqual([...AvatarKindSchema.options].sort());
    const labels = Object.values(m.learner.avatars);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).toMatch(/^[A-Za-z ]+$/);
  });

  it('keeps the English labels in catalogue order', () => {
    expect(AvatarKindSchema.options.map((kind) => m.learner.avatars[kind])).toEqual([
      'Book Tiger',
      'Home Tiger',
      'Feast Tiger',
      'Mountain Tiger',
      'Craft Tiger',
    ]);
  });
});

describe('learner.firstQuest', () => {
  it('keeps the heading, bubbles and CTA', () => {
    expect(m.learner.firstQuest.title).toBe('Your first card is waiting.');
    expect(m.learner.firstQuest.bubble).toBe("In your first quest you'll meet Korean letters and earn a Heritage card.");
    expect(m.learner.firstQuest.bubbleNoQuest).toBe('Let me show you around first!');
    expect(m.learner.firstQuest.firstUp).toBe('First up');
    expect(m.learner.firstQuest.cta).toBe('Start my journey');
  });

  it('counts with plural(), never a suffix ternary', () => {
    expect(m.learner.firstQuest.summary(1, 5, 1)).toBe('1 quest · about 5 minutes · 1 card waiting');
    expect(m.learner.firstQuest.summary(3, 12, 2)).toBe('3 quests · about 12 minutes · 2 cards waiting');
    expect(m.learner.firstQuest.summary(0, 1, 0)).toBe('0 quests · about 1 minute · 0 cards waiting');
  });

  it('joins the quest title and blurb', () => {
    expect(m.learner.firstQuest.questLine('Meet Hoya', null)).toBe('Meet Hoya');
    expect(m.learner.firstQuest.questLine('Meet Hoya', '')).toBe('Meet Hoya');
    expect(m.learner.firstQuest.questLine('Meet Hoya', 'Say hello')).toBe('Meet Hoya — Say hello');
  });
});

describe('a11y tab labels', () => {
  it('are the three tabs as shipped, plus the Route tab label (LR-1, LR-OD-1)', () => {
    expect(m.a11y.tabs).toEqual({ home: 'Today', journey: 'Journey', library: 'Library', route: 'Route' });
    expect(m.a11y.goBack).toBe('Go back');
  });
});

describe('learner.profile (English wording as shipped)', () => {
  const p = m.learner.profile;

  it('keeps the heading and profile tiles', () => {
    expect(p.title).toBe('Profiles & settings');
    expect(p.switchTo('Suni')).toBe('Switch to Suni');
    expect(p.playingNow).toBe('Playing now');
    expect(p.addProfile).toBe('+ Add a profile');
    expect(p.addProfileName).toBe('Add a profile');
  });

  it('names whose stats these are, with a neutral fallback', () => {
    expect(p.statsTitle('Suni')).toBe('Suni stats');
    expect(p.statsTitle(null)).toBe('Your stats');
    expect([p.stats.quests, p.stats.cards, p.stats.threeStar]).toEqual(['Quests done', 'Cards', '3-star quests']);
  });

  it('keeps the sound and plan cards', () => {
    expect([p.sound.label, p.sound.on, p.sound.off]).toEqual(['Sound', 'On', 'Off']);
    // F-BILL-002 B-9 (§6.3): Full route / Everything is open / Plan details replaced Premium, unlocked and Unlock the journey.
    expect(p.plan.free).toBe('Free plan');
    expect(p.plan.fullRoute).toBe('Full route');
    expect(p.plan.open(null)).toBe('Everything is open.');
    expect(p.plan.freeNote).toBe('All of Stage 1 is free.');
    expect(p.plan.allOpen).toBe('Everything is open right now.');
    expect([p.plan.pillActive, p.plan.pillFree, p.plan.details.cta]).toEqual(['Active', 'Free', 'Plan details']);
    for (const gone of ['premium', 'unlocked', 'unlock']) expect(gone in p.plan, gone).toBe(false);
    expect([p.install.label, p.install.a11yLabel]).toEqual(['Install on this device', 'Install Hangul Route on this device']);
  });

  it('has the reading-practice switch; the language lives on the Display sheet', () => {
    expect('language' in p).toBe(false);
    expect(p.reading.title).toBe('Reading practice');
    expect(p.reading.hideUntilTap).toBe('Hide romanization until I tap');
  });
});

describe('learner.editProfile (F-LEARN-001 §3.11)', () => {
  const e = en.learner.editProfile;
  const flat = (v: unknown): string[] =>
    typeof v === 'string' ? [v] : typeof v === 'function' ? [String((v as (x: string) => string)('Mina'))] : Object.values(v as object).flatMap(flat);

  it('names the screen, the rows and Save', () => {
    expect(e.title).toBe('Edit profile');
    expect(e.cta).toBe('Edit');
    expect(e.a11y('Mina')).toBe('Edit Mina');
    expect([e.nameLabel, e.levelHeading, e.avatarHeading, e.who.heading]).toEqual([
      'Name',
      'Reading level',
      'Pick a Hoya',
      'Who is learning?',
    ]);
    expect(e.save.cta).toBe('Save');
  });

  it('keeps the create form’s consent wording for a change of who is learning', () => {
    expect(e.self.agree).toBe("I'm 13 or older and I agree to the Privacy Policy.");
    expect(e.guardian.agree).toBe(
      "I'm a parent or guardian of this learner (or I set it up for them) and I agree to the Privacy Policy.",
    );
    expect(e.guardian.pinHeading).toBe('Create a grown-up PIN');
  });

  it('says when a class roster shows the change (edits sync with the next connection, section 3.11)', () => {
    expect(e.classNote).toBe("Your teacher's list updates the next time you're online.");
    // The old line sent the learner to join again; a join is no longer needed for the roster to change.
    for (const line of flat(e)) expect(line).not.toMatch(/join again/i);
  });

  it('says where the name, level and Hoya change on a class device, for a learner of any age', () => {
    expect(e.classDevice).toBe("The name, level and Hoya can be changed on the learner's own device.");
    // Any age learns here: the line names no grown-up, so it reads true for an adult learner too.
    expect(e.classDevice).not.toMatch(/grown-up|adult|parent/i);
  });

  it('names an age nowhere but the 13-or-older statement, and never scolds', () => {
    for (const line of flat(e)) {
      expect(line).not.toMatch(/\bAge\b|How old|ages? \d|for kids/i);
      expect(line).not.toMatch(/\b(failed|missed|overdue|incomplete|wrong)\b/i);
    }
  });
});

describe('one learner name everywhere (F-LEARN-001 section 3.11), en, ko and es', () => {
  const ko = getMessages('ko');
  const es = getMessages('es');

  it('the join name field says it is the same name everywhere', () => {
    expect(m.caregiver.join.confirm.sameEverywhere).toBe('This name is the same everywhere, not just here.');
    expect(ko.caregiver.join.confirm.sameEverywhere).toBe('이 이름은 여기뿐 아니라 어디서나 같아요.');
    expect(es.caregiver.join.confirm.sameEverywhere).toBe('Este nombre es el mismo en todas partes, no solo aquí.');
  });

  it('a locked join name field says where the name changes', () => {
    expect(m.caregiver.join.confirm.nameLocked).toBe('The name can be changed in Edit profile.');
    expect(ko.caregiver.join.confirm.nameLocked).toBe('이름은 프로필 편집에서 바꿀 수 있어요.');
    expect(es.caregiver.join.confirm.nameLocked).toBe('El nombre se puede cambiar en Editar perfil.');
    // It names the screen by its own title in each language.
    for (const locale of [m, ko, es]) expect(locale.caregiver.join.confirm.nameLocked).toContain(locale.learner.editProfile.title);
  });

  it('Edit profile tells when the class list updates and who changes a class device, in each language', () => {
    expect(ko.learner.editProfile.classNote).toBe('다음에 인터넷에 연결되면 선생님 명단도 바뀌어요.');
    expect(es.learner.editProfile.classNote).toBe('La lista de tu docente se actualiza la próxima vez que tengas conexión.');
    expect(ko.learner.editProfile.classDevice).toBe('이름, 읽기 수준, 호야는 학습자 본인의 기기에서 바꿀 수 있어요.');
    expect(es.learner.editProfile.classDevice).toBe('El nombre, el nivel y el Hoya se pueden cambiar en el dispositivo de quien aprende.');
  });

  it('every new line is translated, never the English fallback', () => {
    for (const locale of [ko, es]) {
      expect(locale.caregiver.join.confirm.sameEverywhere).not.toBe(m.caregiver.join.confirm.sameEverywhere);
      expect(locale.caregiver.join.confirm.nameLocked).not.toBe(m.caregiver.join.confirm.nameLocked);
      expect(locale.learner.editProfile.classNote).not.toBe(m.learner.editProfile.classNote);
      expect(locale.learner.editProfile.classDevice).not.toBe(m.learner.editProfile.classDevice);
    }
  });
});

describe('learner.portraitGuard (F-LAYOUT-001 §3.4)', () => {
  it('asks in one short line and offers a way out', () => {
    expect(en.learner.portraitGuard.title).toBe('Turn your phone upright');
    expect(en.learner.portraitGuard.keepSideways.cta).toBe('Keep sideways');
  });
});

describe('the dictionary is wired', () => {
  it('exposes learner and caregiver next to common and a11y', () => {
    expect(Object.keys(en).sort()).toEqual(['a11y', 'caregiver', 'common', 'console', 'landing', 'learner', 'report']);
  });
});
