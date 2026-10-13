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
 * What the app does, checked against the code: with no sign-in, it sends each learner's nickname, level
 * and avatar to our servers the first time it saves them (`ensureRegistered`, POST /api/sync/learners;
 * a later edit is not sent, F-LEARN-001 §3.11), and backs up their progress when it starts and after each
 * change (F-SYNC-002, `sync-store.ts`); it issues a Rescue Code after the first cloud save
 * (F-RESTORE-001); usage events such as `quest.complete` can carry the learner's id; a class or family a
 * learner joins sees the name they join with and their progress; a family's caregivers can recover the
 * full saved progress. All of it only on a build with cloud saving on (`syncApi()`); the app picks the
 * device-only lines below on a build without it.
 *
 * The one sentence is `landing.persona.parents.safe.bullets.backup` (F-SITE-002 §3.5, signed off in
 * S-3 review 3). Its first sentence is the backup itself; the other two say who else sees progress.
 */
const BACKUP = en.landing.persona.parents.safe.bullets.backup;
const [BACKUP_FIRST, ...BACKUP_REST] = BACKUP.split(/(?<=\.)\s+/);
const legal = en.landing.legal.privacy.sections;

/**
 * Lines that may make a retired promise, each with the patterns it may match and why it is still true.
 * Both show only on a build with cloud saving off: the cloud status reads "Saved on this device only."
 * while the status is `off` (`cloudStatusLine`), and the Family Dashboard's privacy card shows
 * `bodyDeviceOnly` when `syncApi()` is null (ParentDashboardScreen).
 */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  'caregiver.sync.status.deviceOnly': ['"on this device only"'],
  'caregiver.dashboard.privacy.bodyDeviceOnly': ['progress "saved on the device" with no word of the backup'],
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

  it('new home, how it works: progress is saved and backed up', () => {
    expect(en.landing.home.how.steps.collect.body).toBe('Earn Korean culture cards. Your progress is saved and backed up.');
  });

  it('Privacy Policy, short version: the backup sentence replaces "until the account holder chooses to sign in"', () => {
    expect(legal.short.paragraphs.p1).toBe(
      `Hangul Route is for anyone learning Hangul, at any age — and many of our learners are children. We collect as little as possible, never show ads, and never sell data. ${BACKUP_FIRST} When the learner is a child, a parent is always in control.`,
    );
  });

  it('Privacy Policy, where your data lives: what is sent once, what is backed up after each change, and the usage events', () => {
    expect(legal.where.paragraphs.p1).toBe(
      "Learning data is kept on the device and backed up to our servers (Cloudflare), with no sign-in needed. The first time the app saves a learner, it sends their nickname, level and avatar. It backs up their progress when it starts and after each change, so the learner can be restored on a new device with a Rescue Code. If you later change the nickname, level or avatar, the backup keeps the old ones for now; to change them, email us. The app also sends us usage events, such as a finished quest, which can include the learner's id. Data in transit is encrypted (HTTPS), and at rest it is access-controlled.",
    );
    // The same facts as the backup sentence, in the policy's fuller words.
    expect(legal.where.paragraphs.p1).toMatch(/backed up to our servers/);
    expect(legal.where.paragraphs.p1).toMatch(/Rescue Code/);
    // Only progress is backed up after each change: the profile goes up once (POST /api/sync/learners, no update route).
    expect(legal.where.paragraphs.p1).not.toMatch(/nickname, level, avatar and progress when it starts/);
  });

  it('app, Family Dashboard: shows the learners on this device, and its privacy card leads with the backup sentence', () => {
    expect(en.caregiver.dashboard.readOnly).toBe('Read-only — learners on this device.');
    expect(en.caregiver.dashboard.privacy.body).toBe(`${BACKUP} We do not share with third parties.`);
  });

  it('app, Family Dashboard on a build with cloud saving off: says so, and points at the file backup', () => {
    const body = en.caregiver.dashboard.privacy.bodyDeviceOnly;
    expect(body).toBe(
      `Each learner's nickname and progress are kept on this device. Cloud saving is not set up on this build, so use "${en.caregiver.backup.file.cta}" to keep a copy. We do not share with third parties.`,
    );
    // The same words as the "Save now" note on such a build, and no backup or Rescue Code promise.
    expect(body).toContain(en.caregiver.sync.saveNow.off.replace(/\.$/, ''));
    expect(body).not.toMatch(/backed up|Rescue Code|our servers/);
  });

  it('home promises: "Child safety first" (OD-4), with no compliance claim', () => {
    expect(en.landing.home.promises.items.safety).toBe('Child safety first');
  });
});

describe('no English message makes a retired data promise', () => {
  const messages = everyMessage();

  it('scans the whole dictionary', () => {
    expect(messages.length).toBeGreaterThan(2000);
  });

  it('allows only the lines it names, each still exists, and each still matches every pattern it is allowed', () => {
    const names = RETIRED_DATA_PROMISES.map(({ name }) => name);
    for (const [path, allowed] of Object.entries(ALLOWED)) {
      const text = lookup(en, path);
      expect(text, path).toBeTypeOf('string');
      for (const name of allowed) {
        expect(names, `${path}: ${name}`).toContain(name);
        expect(retiredDataPromises(String(text)), `${path}: ${name}`).toContain(name);
      }
    }
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
    'Saved on this device only.',
    // Rewordings the first list missed (the #395 review).
    'If you sign in, progress syncs.',
    'When a parent signs in, progress syncs.',
    'Progress is saved on this device and backed up when you sign in.',
    'Your data never leaves your device.',
    'Learning data remains on the device.',
    'Progress lives on this device.',
    'No third-party tracking. Parent email is the only PII.',
    'Yes. No third-party ad tracking, no PII on children, default mode keeps learning data on-device.',
    'Default mode keeps all learning data on-device.',
    'The app saves your progress on this device.',
    // The backup said in one sentence does not excuse a device-only promise in the next one.
    'Progress is backed up. Your progress is saved on your device.',
  ];
  for (const text of old) {
    it(text, () => expect(retiredDataPromises(text)).not.toEqual([]));
  }

  it('every pattern catches at least one old wording', () => {
    const hit = new Set(old.flatMap((text) => retiredDataPromises(text)));
    expect(RETIRED_DATA_PROMISES.map(({ name }) => name).filter((name) => !hit.has(name))).toEqual([]);
  });

  it('catches a device-only promise with the verb first, too', () => {
    for (const text of ['Default mode keeps learning data on-device.', 'The app saves your progress on this device.', 'It stores data locally.']) {
      expect(retiredDataPromises(text), text).toEqual(['progress "saved on the device" with no word of the backup']);
    }
  });

  it('checks each sentence, and each block of a page, on its own', () => {
    expect(retiredDataPromises('Progress is backed up.\nYour progress is saved on your device')).toEqual([
      'progress "saved on the device" with no word of the backup',
    ]);
    expect(retiredDataPromises('Progress is backed up! Your progress is saved on your device?')).toHaveLength(1);
  });

  it('passes the true sentences', () => {
    expect(retiredDataPromises(BACKUP)).toEqual([]);
    expect(retiredDataPromises(legal.where.paragraphs.p1)).toEqual([]);
    expect(retiredDataPromises('Your name and choices are saved on this device and backed up to our servers. No sign-in needed.')).toEqual([]);
    expect(retiredDataPromises("That isn't the code saved on this device. Check it and try again.")).toEqual([]);
    expect(retiredDataPromises(legal.never.bullets.media)).toEqual([]);
    expect(retiredDataPromises('When you sign in, you see your family space.')).toEqual([]);
  });
});
