import type { BackupFile, Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { LOCALES, findBannedWord, getMessages, type Messages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../listen-pick';
import { planRestore, relinkNotice, restoreNotice } from '../restore';
import { notifyProgressPersisted, setProgressPersistListener } from '../persist-hook';
import { vi } from 'vitest';

const NOW = new Date('2026-09-21T12:00:00Z');
const profile: Profile = { id: 'profile:a', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' };
const snap = (cards: string[], quests: string[]): ProgressSnapshot => ({
  profileId: 'profile:a',
  updatedAt: 't',
  episodes: [],
  quests: quests.map((questId) => ({ questId, episodeId: 'e', startedAt: 't', completedAt: 't', stars: 2 as const, attempts: 1, accuracy: 0.8 })),
  cards: cards.map((cardId) => ({ cardId, unlockedAt: 't', newSinceLastView: false })),
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
});
const file: BackupFile = { format: 'hangul-route-backup', version: 1, exportedAt: 't', profile, snapshot: snap(['c1', 'c2'], ['q1']) };
const m = getMessages('en').caregiver;

describe('planRestore (F-SYNC-002 §3.3)', () => {
  it('creates the profile when it does not exist on this device', () => {
    const plan = planRestore(file, null, NOW);
    expect(plan.action).toBe('create');
    expect(plan.added).toEqual({ cards: 2, quests: 1 });
    expect(restoreNotice(plan, m)).toBe('Welcome back, Suni! Your journey is here.');
  });
  it('merges into an existing profile and counts only what was new', () => {
    const plan = planRestore(file, { profile, snapshot: snap(['c1'], ['q1', 'q9']) }, NOW);
    expect(plan.action).toBe('merge');
    expect(plan.snapshot.cards.map((c) => c.cardId)).toEqual(['c1', 'c2']);
    expect(plan.snapshot.quests.map((q) => q.questId)).toEqual(['q1', 'q9']);
    expect(plan.added).toEqual({ cards: 1, quests: 0 });
    expect(restoreNotice(plan, m)).toBe("We found Suni's progress! Added 1 card.");
  });
  it('keeps the stage latch a backup file carries when merging into a copy without it (F-ROUTE-001 section 3.15)', () => {
    const latch = { stage1: '2026-09-20T10:00:00.000Z' };
    const plan = planRestore({ ...file, snapshot: { ...file.snapshot, stageDoneAt: latch } }, { profile, snapshot: snap(['c1'], ['q1']) }, NOW);
    expect(plan.action).toBe('merge');
    expect(plan.snapshot.stageDoneAt).toEqual(latch);
  });
  it('says so when the file adds nothing, and pluralizes', () => {
    const same = planRestore(file, { profile, snapshot: file.snapshot }, NOW);
    expect(restoreNotice(same, m)).toBe('Suni already has everything from this file.');
    const both = planRestore(file, { profile, snapshot: snap([], []) }, NOW);
    expect(restoreNotice(both, m)).toBe("We found Suni's progress! Added 2 cards and 1 quest.");
  });
});

describe('relinkNotice (F-TCH-001 §10.1, SEC-4)', () => {
  it('a class re-link brings the learner back into the class, and says the cards need the rescue code', () => {
    const fresh = { action: 'create' as const, profile, snapshot: snap([], []), added: { cards: 0, quests: 0 } };
    expect(relinkNotice(fresh, m)).toBe("Welcome back, Suni! You're in the class again. Your cards come back with your rescue code.");
    const known = { ...fresh, action: 'merge' as const };
    expect(relinkNotice(known, m)).toBe("Welcome back, Suni! You're in the class again.");
  });
});

describe('the restore notices take their words from the message subtree (F-I18N-001 §3.4 rule 3)', () => {
  const plan = (action: 'create' | 'merge', cards: number, quests: number) => ({ action, profile, snapshot: snap([], []), added: { cards, quests } });

  it('counts with plural(): one card, many quests', () => {
    expect(restoreNotice(plan('merge', 0, 3), m)).toBe("We found Suni's progress! Added 3 quests.");
    expect(restoreNotice(plan('merge', 1, 1), m)).toBe("We found Suni's progress! Added 1 card and 1 quest.");
  });

  it('renders from the subtree it is given', () => {
    const other: Pick<Messages['caregiver'], 'restore' | 'audience'> = {
      ...m,
      restore: {
        ...m.restore,
        notice: {
          created: (name: string) => `Hola, ${name}.`,
          nothingNew: (name: string) => `Nada nuevo, ${name}.`,
          added: (name: string, cards: number, quests: number) => `${name}: +${cards} / +${quests}`,
          relinked: (name: string) => `De vuelta, ${name}.`,
        },
      },
      audience: { ...m.audience, shared: { ...m.audience.shared, restoreCardsBack: 'Con tu codigo.' } },
    };
    expect(restoreNotice(plan('create', 2, 1), other)).toBe('Hola, Suni.');
    expect(restoreNotice(plan('merge', 0, 0), other)).toBe('Nada nuevo, Suni.');
    expect(restoreNotice(plan('merge', 2, 1), other)).toBe('Suni: +2 / +1');
    expect(relinkNotice(plan('merge', 0, 0), other)).toBe('De vuelta, Suni.');
    expect(relinkNotice(plan('create', 0, 0), other)).toBe('De vuelta, Suni. Con tu codigo.');
  });

  for (const locale of LOCALES) {
    it(`${locale}: every notice is free of shaming words`, () => {
      const caregiver = getMessages(locale).caregiver;
      const lines = [
        restoreNotice(plan('create', 2, 1), caregiver),
        restoreNotice(plan('merge', 0, 0), caregiver),
        restoreNotice(plan('merge', 1, 0), caregiver),
        restoreNotice(plan('merge', 2, 3), caregiver),
        relinkNotice(plan('create', 0, 0), caregiver),
        relinkNotice(plan('merge', 0, 0), caregiver),
      ];
      for (const line of lines) expect(findBannedWord(line, locale, 'learner'), `${locale}: ${line}`).toBeNull();
    });
  }
});

describe('persist hook', () => {
  it('forwards to the listener when set and is silent otherwise', () => {
    const l = vi.fn();
    setProgressPersistListener(l);
    notifyProgressPersisted('profile:a');
    expect(l).toHaveBeenCalledWith('profile:a');
    setProgressPersistListener(null);
    expect(() => notifyProgressPersisted('profile:a')).not.toThrow();
  });
});

describe('restore never reduces cards (F-STORY-006 §3.6 M6)', () => {
  const T = ['2026-09-18T00:00:00.000Z', '2026-09-19T00:00:00.000Z', '2026-09-20T00:00:00.000Z'];
  const IDS = ['card:a', 'card:b', 'card:c', 'card:d'];
  const cards = (rand: () => number) =>
    IDS.filter(() => rand() < 0.5).map((cardId) => ({ cardId, unlockedAt: T[Math.floor(rand() * T.length)] as string, newSinceLastView: rand() < 0.5 }));

  it('an older backup merged into the device keeps every card the device holds, at the same or an earlier time', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const rand = seededRandom(seed);
      const existing = { ...snap([], []), cards: cards(rand) };
      const backup: BackupFile = { ...file, exportedAt: '2026-09-01T00:00:00.000Z', snapshot: { ...snap([], []), cards: cards(rand) } };
      const plan = planRestore(backup, { profile, snapshot: existing }, NOW);
      const after = new Map(plan.snapshot.cards.map((c) => [c.cardId, c]));
      for (const c of existing.cards) {
        expect(after.has(c.cardId), `seed ${seed}`).toBe(true);
        expect((after.get(c.cardId)?.unlockedAt ?? '') <= c.unlockedAt, `seed ${seed}`).toBe(true);
      }
      expect(plan.snapshot.cards.length, `seed ${seed}`).toBeGreaterThanOrEqual(existing.cards.length);
    }
  });

  it('an empty backup changes no card', () => {
    const existing = snap(['c1', 'c2'], ['q1']);
    const plan = planRestore({ ...file, snapshot: snap([], []) }, { profile, snapshot: existing }, NOW);
    expect(plan.snapshot.cards).toEqual(existing.cards);
    expect(plan.added.cards).toBe(0);
  });
});
