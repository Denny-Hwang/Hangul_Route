import { describe, expect, it } from 'vitest';
import { RETIRED_DATA_PROMISES, retiredDataPromises } from '../data-promises';
import { en } from '../messages/en';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * Every statement about where learning data lives, tied to one sentence so the copies cannot drift
 * apart again (the #353 review found the Privacy Policy, About and the old home still saying data
 * stays on the device until someone signs in).
 *
 * What the app does, checked against the code: it backs up every learner's nickname, level, avatar and
 * progress to our servers when it starts and after each change, with no sign-in (F-SYNC-002,
 * `sync-store.ts`); it issues a Rescue Code after the first cloud save (F-RESTORE-001); usage events
 * such as `quest.complete` can carry the learner's id; a class or family a learner joins sees the name
 * they join with and their progress; a family's caregivers can recover the full saved progress.
 *
 * The one sentence is `landing.persona.parents.safe.bullets.backup` (F-SITE-002 §3.5, signed off in
 * S-3 review 3). Its first sentence is the backup itself; the other two say who else sees progress.
 */
const BACKUP = en.landing.persona.parents.safe.bullets.backup;
const [BACKUP_FIRST, ...BACKUP_REST] = BACKUP.split(/(?<=\.)\s+/);
const legal = en.landing.legal.privacy.sections;

/**
 * Lines that may say "on this device only", each with why it is still true. The cloud status reads
 * "Saved on this device only." only while cloud saving is off on this build (`cloudStatusLine`,
 * status `off`, or before the sync record has loaded).
 */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  'caregiver.sync.status.deviceOnly': ['"on this device only"'],
};

/** Every rendered output of every English message: strings, array items, and one output per SAMPLES row. */
function everyMessage(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const path of leafPaths(en)) {
    const value = lookup(en, path);
    if (typeof value === 'string') out.push([path, value]);
    else if (Array.isArray(value)) value.forEach((item, i) => out.push([`${path}.${i}`, String(item)]));
    else if (typeof value === 'function') {
      for (const args of SAMPLES[path] ?? []) out.push([path, String((value as (...a: unknown[]) => unknown)(...args))]);
    }
  }
  return out;
}

describe('the backup sentence (landing.persona.parents.safe.bullets.backup) is the source', () => {
  it('has three sentences: the backup, what a class or family sees, what a family can restore', () => {
    expect(BACKUP_FIRST).toBe(
      "Each learner's nickname and progress are kept on the device and backed up to our servers, so they can be restored with a Rescue Code.",
    );
    expect(BACKUP_REST).toEqual([
      'When a learner joins a class or family with a code, that space sees the name they join with and their progress.',
      "A family's grown-ups can also restore their progress.",
    ]);
  });

  it('agrees with the Privacy Policy on who sees progress (progressWho)', () => {
    expect(legal.collect.bullets.progressWho).toMatch(/family caregivers, who can also recover the full saved progress/);
    expect(legal.collect.bullets.progressWho).toMatch(/the teacher of a class the learner joined/);
  });
});

describe('every statement about where learning data lives says the same thing', () => {
  it('About promise: the backup itself, word for word', () => {
    expect(en.landing.about.promises.localFirst).toBe(BACKUP_FIRST);
  });

  it('old home, parents block: a plain title and the whole backup sentence', () => {
    expect(en.landing.parents.points.localFirst).toEqual({ title: 'Progress is backed up.', body: BACKUP });
  });

  it('new home, how it works: progress is saved and backed up', () => {
    expect(en.landing.home.how.steps.collect.body).toBe('Earn Korean culture cards. Your progress is saved and backed up.');
  });

  it('Privacy Policy, short version: the backup sentence replaces "until the account holder chooses to sign in"', () => {
    expect(legal.short.paragraphs.p1).toBe(
      `Hangul Route is for anyone learning Hangul, at any age — and many of our learners are children. We collect as little as possible, never show ads, and never sell data. ${BACKUP_FIRST} When the learner is a child, a parent is always in control.`,
    );
  });

  it('Privacy Policy, where your data lives: what is backed up, when, with no sign-in, and the usage events', () => {
    expect(legal.where.paragraphs.p1).toBe(
      "Learning data is kept on the device and backed up to our servers (Cloudflare). The app backs up each learner's nickname, level, avatar and progress when it starts and after each change, with no sign-in needed, so they can be restored on a new device with a Rescue Code. The app also sends us usage events, such as a finished quest, which can include the learner's id. Data in transit is encrypted (HTTPS), and at rest it is access-controlled.",
    );
    // The same facts as the backup sentence, in the policy's fuller words.
    expect(legal.where.paragraphs.p1).toMatch(/backed up to our servers/);
    expect(legal.where.paragraphs.p1).toMatch(/Rescue Code/);
  });

  it('app, Family Dashboard: shows the learners on this device, and its privacy card leads with the backup sentence', () => {
    expect(en.caregiver.dashboard.readOnly).toBe('Read-only — learners on this device.');
    expect(en.caregiver.dashboard.privacy.body).toBe(`${BACKUP} We do not share with third parties.`);
  });

  it('console /parent demo: its first two privacy points are the backup sentence', () => {
    const points = en.console.parent.privacy.points;
    expect(points).toHaveLength(4);
    expect(`${points[0]} ${points[1]}`).toBe(BACKUP);
  });
});

describe('no English message makes a retired data promise', () => {
  const messages = everyMessage();

  it('scans the whole dictionary', () => {
    expect(messages.length).toBeGreaterThan(2000);
  });

  it('allows only the lines it names, and each of those still exists', () => {
    for (const path of Object.keys(ALLOWED)) expect(lookup(en, path), path).toBeTypeOf('string');
  });

  for (const { name } of RETIRED_DATA_PROMISES) {
    it(`no message says ${name}`, () => {
      const offenders = messages
        .filter(([path, text]) => retiredDataPromises(text).includes(name) && !(ALLOWED[path] ?? []).includes(name))
        .map(([path, text]) => `${path}: ${text}`);
      expect(offenders).toEqual([]);
    });
  }
});

describe('retiredDataPromises catches the old wordings (self-check)', () => {
  const old = [
    'Local-first: data stays on the device until you sign in.',
    'All learning data stays on the device until you sign in.',
    'Most learning data stays on the device until the account holder chooses to sign in.',
    'By default, learning data is stored locally on the device. If a parent signs in, progress syncs to our servers.',
    'Read-only — data stays on this device.',
    'All learning data stays on this device unless you sign in. We do not share with third parties.',
    'By default, all learning data stays on your device.',
    'If you opt in to cloud sync, data is stored encrypted in our backend.',
    'Your name and choices are saved on this device. Sign-in and sync are optional.',
    'Your progress is saved on your device.',
    'Anonymous usage counts help us improve.',
    'No account needed. No ads. No data sold. Everything stays on the device.',
  ];
  for (const text of old) {
    it(text, () => expect(retiredDataPromises(text)).not.toEqual([]));
  }

  it('passes the true sentences', () => {
    expect(retiredDataPromises(BACKUP)).toEqual([]);
    expect(retiredDataPromises('Your name and choices are saved on this device and backed up to our servers. No sign-in needed.')).toEqual([]);
    expect(retiredDataPromises("That isn't the code saved on this device. Check it and try again.")).toEqual([]);
  });
});
