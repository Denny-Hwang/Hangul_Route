import type { Episode, ProgressSnapshot, Quest, VocabProgress } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { utcDayKey } from '../../day-clock';
import { homeVocabNudge, topicRefIndex } from '../../vocab/home-card';
import { localDay } from '../../vocab/progress';
import { progress, state, topic, word } from '../../vocab/__tests__/fixtures';
import { buildTodaysMission, vocabCardShownEvent, vocabCardShownKey, type BuildMissionInput, type MissionCard, type MissionPlan } from '../mission-builder';

/**
 * One day basis for the Home vocabulary card (F-VOC-005 P-3b). The plan stays pinned to its UTC
 * day (F-HW-001 section 3.2), while slot (3)'s vocabulary card follows the device's local day
 * (P5): it appears and leaves at local midnight, never at the UTC rollover. Run far from UTC on
 * both sides (Kiritimati UTC+14, Pago Pago UTC-11) and at UTC.
 */

const PROFILE = 'profile:kid1';

function quest(id: string): Quest {
  return { id, titleEn: id, estimatedMinutes: 4, steps: [{ id: 's1', kind: 'intro', titleEn: 'Hi' }] };
}

function episode(id: string, questIds: string[], order: number): Episode {
  return { id, stage: 'stage1', theme: 'letters', order, titleEn: id, hoyaIntroEn: 'Hello!', questIds, rewardCardIds: [], estimatedMinutes: 10, status: 'shipped' };
}

const QUESTS = [quest('quest:a'), quest('quest:b'), quest('quest:c')];
const EPISODES = [episode('episode:one', ['quest:a', 'quest:b'], 1), episode('episode:two', ['quest:c'], 2)];

const food = topic('food', { order: 1 });
const WORDS = [word('sagwa-apple'), word('bap-rice'), word('mul-water')];
const topicOf = topicRefIndex([food], () => WORDS);

/** Three food words due on `day` (the schedule's local day). */
const dueOn = (day: string): VocabProgress => progress(WORDS.map((w) => state(w.id.slice('vocab:'.length), { due: day })));

function snapshot(vocab: VocabProgress): ProgressSnapshot {
  return { profileId: PROFILE, updatedAt: '2026-10-13T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 1, vocab };
}

/**
 * One Home render at `now`, as `HomeScreen` builds it: the UTC day pin, the local-day nudge,
 * rounds done and `vocabDay`, and the latest pin as `vocabCarry`. `pin` stands in for the
 * session store (one pin per profile).
 */
function home() {
  let pin: MissionPlan | null = null;
  const rounds = new Map<string, Set<string>>();
  return {
    render(now: Date, snap: ProgressSnapshot): MissionPlan {
      const today = utcDayKey(now);
      const vocabDay = localDay(now);
      const plan = buildTodaysMission({
        profileId: PROFILE,
        snapshot: snap,
        quests: QUESTS,
        episodes: EPISODES,
        today,
        pinned: pin && pin.date === today ? pin : null,
        vocab: homeVocabNudge({ enabled: true, snapshot: snap, topicOf, now }),
        vocabRoundsDone: rounds.get(vocabDay) ?? new Set(),
        vocabDay,
        vocabCarry: pin,
      });
      pin = plan;
      return plan;
    },
    roundDone(now: Date, topicKey: string): void {
      const day = localDay(now);
      rounds.set(day, new Set([...(rounds.get(day) ?? []), topicKey]));
    },
  };
}

const slot = (plan: MissionPlan, n: 1 | 2 | 3): MissionCard | undefined => plan.cards.find((c) => c.slot === n);

/**
 * Per zone: `before` is local 23:59 on 2026-10-13, `after` local 00:01 on 2026-10-14 (both on one
 * UTC day away from UTC), `rollover` the next UTC midnight on local 2026-10-14, and `nextLocal`
 * local 00:01 on 2026-10-15.
 */
const CASES = [
  { zone: 'Pacific/Kiritimati', before: '2026-10-13T09:59:00.000Z', after: '2026-10-13T10:01:00.000Z', rollover: '2026-10-14T00:01:00.000Z', nextLocal: '2026-10-14T10:01:00.000Z' },
  { zone: 'Pacific/Pago_Pago', before: '2026-10-14T10:59:00.000Z', after: '2026-10-14T11:01:00.000Z', rollover: '2026-10-15T00:01:00.000Z', nextLocal: '2026-10-15T11:01:00.000Z' },
  { zone: 'UTC', before: '2026-10-13T23:59:00.000Z', after: '2026-10-14T00:01:00.000Z', rollover: '2026-10-14T12:00:00.000Z', nextLocal: '2026-10-15T00:01:00.000Z' },
] as const;

describe.each(CASES)('the vocabulary card at local midnight under TZ=$zone', ({ zone, before, after, rollover, nextLocal }) => {
  let savedTz: string | undefined;
  beforeEach(() => {
    savedTz = process.env.TZ;
    process.env.TZ = zone;
  });
  afterEach(() => {
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('appears at local midnight, stays over the UTC rollover, and leaves at the next local midnight', () => {
    const h = home();
    const dueTomorrow = snapshot(dueOn('2026-10-14'));

    // Local 23:59: the words are due tomorrow, so slot 3 is the chain's next card.
    const first = h.render(new Date(before), dueTomorrow);
    expect(localDay(new Date(before))).toBe('2026-10-13');
    expect(slot(first, 3)?.kind).not.toBe('vocab');

    // Local 00:01: the card appears in slot 3; cards 1 and 2 stay where they were.
    const appeared = h.render(new Date(after), dueTomorrow);
    expect(slot(appeared, 3)).toMatchObject({ kind: 'vocab', topicKey: 'food', vocabDue: 3, collected: false });
    if (zone !== 'UTC') {
      expect(appeared.date).toBe(first.date);
      expect([slot(appeared, 1), slot(appeared, 2)]).toEqual([slot(first, 1), slot(first, 2)]);
    }
    expect(vocabCardShownKey(appeared)).not.toBe(vocabCardShownKey(first));

    // A round done: collected; the reviewed words are due later, so the nudge is gone.
    h.roundDone(new Date(after), 'food');
    const reviewed = snapshot(dueOn('2026-10-17'));
    expect(slot(h.render(new Date(after), reviewed), 3)).toMatchObject({ kind: 'vocab', collected: true });

    // The UTC rollover on the same local day: the card stays, collected, and is not counted as shown again.
    const carried = h.render(new Date(rollover), reviewed);
    expect(slot(carried, 3)).toMatchObject({ kind: 'vocab', topicKey: 'food', vocabDue: 3, collected: true });
    expect(vocabCardShownKey(carried)).toBe(vocabCardShownKey(appeared));

    // The next local midnight: fewer than three words due, so the card leaves.
    const left = h.render(new Date(nextLocal), reviewed);
    expect(slot(left, 3)).toBeDefined();
    expect(slot(left, 3)?.kind).not.toBe('vocab');
  });

  it('no card appears at the UTC rollover when none was there on that local day', () => {
    const h = home();
    // Due on local 2026-10-15: not yet at `after` nor at `rollover`.
    const later = snapshot(dueOn('2026-10-15'));
    expect(slot(h.render(new Date(after), later), 3)?.kind).not.toBe('vocab');
    expect(slot(h.render(new Date(rollover), later), 3)?.kind).not.toBe('vocab');
    // It appears at the local midnight it is due.
    expect(slot(h.render(new Date(nextLocal), later), 3)?.kind).toBe('vocab');
  });

  it('a card still due at the next local midnight is derived again, not collected', () => {
    const h = home();
    const due = snapshot(dueOn('2026-10-14'));
    h.render(new Date(after), due);
    h.roundDone(new Date(after), 'food');
    expect(slot(h.render(new Date(after), due), 3)?.collected).toBe(true);
    const nextDay = h.render(new Date(nextLocal), due);
    expect(slot(nextDay, 3)).toMatchObject({ kind: 'vocab', topicKey: 'food', vocabDue: 3, collected: false });
  });
});

describe('repinVocabDay and vocabCarry, unit rules (F-VOC-005 P-3b)', () => {
  const NUDGE = { topicKey: 'food', due: 4 } as const;
  const build = (overrides: Partial<BuildMissionInput> = {}): MissionPlan =>
    buildTodaysMission({ profileId: PROFILE, snapshot: snapshot(dueOn('2026-10-20')), quests: QUESTS, episodes: EPISODES, today: '2026-10-13', ...overrides });

  it('stamps the local day on a fresh plan only when it is given', () => {
    expect(build({ vocabDay: '2026-10-13' }).vocabDay).toBe('2026-10-13');
    expect('vocabDay' in build()).toBe(false);
  });

  it('a pin from before vocabDay existed is kept as built and gains the day', () => {
    const pinned = build({ vocab: NUDGE });
    const after = build({ pinned, vocab: null, vocabDay: '2026-10-14' });
    expect(after.cards).toEqual(pinned.cards);
    expect(after.vocabDay).toBe('2026-10-14');
  });

  it('the same local day keeps the pinned card whatever the nudge says', () => {
    const pinned = build({ vocab: NUDGE, vocabDay: '2026-10-13' });
    expect(build({ pinned, vocab: null, vocabDay: '2026-10-13' }).cards).toEqual(pinned.cards);
    expect(build({ pinned, vocab: { topicKey: 'food', due: 9 }, vocabDay: '2026-10-13' }).cards).toEqual(pinned.cards);
  });

  it('a new local day refreshes the card with the new count', () => {
    const pinned = build({ vocab: NUDGE, vocabDay: '2026-10-13' });
    expect(slot(build({ pinned, vocab: { topicKey: 'food', due: 7 }, vocabDay: '2026-10-14' }), 3)).toMatchObject({ kind: 'vocab', vocabDue: 7 });
  });

  it('the derived card never repeats what cards 1 and 2 hold', () => {
    const pinned = build({ vocab: NUDGE, vocabDay: '2026-10-13' });
    const after = build({ pinned, vocab: null, vocabDay: '2026-10-14' });
    const third = slot(after, 3);
    expect(third?.kind).not.toBe('vocab');
    for (const other of [slot(after, 1), slot(after, 2)]) {
      if (other?.questId) expect(third?.questId).not.toBe(other.questId);
      if (other?.kind === 'explore') expect(third?.episodeId).not.toBe(other.episodeId);
    }
  });

  it('a collected slot 3 card stays when words become due', () => {
    const pinned: MissionPlan = { ...build({ vocabDay: '2026-10-13' }) };
    const third = slot(pinned, 3) as MissionCard;
    const collected: MissionPlan = { ...pinned, cards: pinned.cards.map((c) => (c === third ? { ...c, collected: true } : c)) };
    expect(slot(build({ pinned: collected, vocab: NUDGE, vocabDay: '2026-10-14' }), 3)?.kind).toBe(third.kind);
  });

  it('a vocabulary card with nothing left to follow it is dropped, never kept with the old count', () => {
    const empty = { quests: [], episodes: [] };
    const pinned = build({ ...empty, vocab: NUDGE, vocabDay: '2026-10-13' });
    expect(slot(pinned, 3)).toMatchObject({ kind: 'vocab', vocabDue: 4 });
    const after = build({ ...empty, pinned, vocab: null, vocabDay: '2026-10-14' });
    expect(slot(after, 3)).toBeUndefined();
    expect(vocabCardShownEvent(after)).toBeNull();
    // The same local day keeps it as pinned.
    expect(slot(build({ ...empty, pinned, vocab: null, vocabDay: '2026-10-13' }), 3)).toMatchObject({ kind: 'vocab', vocabDue: 4 });
  });

  it('a story the learner has started stays in slot 3 when words become due; one not started gives way', () => {
    const pinned = build({ vocabDay: '2026-10-13' });
    const story = (storyReason: 'continue' | 'next'): MissionPlan => ({
      ...pinned,
      cards: [
        ...pinned.cards.filter((c) => c.slot !== 3),
        { slot: 3, kind: 'story', titleEn: 'A tale', subtitle: 'story', questId: 'quest:tale', storyId: 'story:tale', storyReason, storyMode: 'play', collected: false },
      ],
    });
    expect(slot(build({ pinned: story('continue'), vocab: NUDGE, vocabDay: '2026-10-14' }), 3)).toMatchObject({ kind: 'story', storyId: 'story:tale', storyReason: 'continue' });
    expect(slot(build({ pinned: story('next'), vocab: NUDGE, vocabDay: '2026-10-14' }), 3)).toMatchObject({ kind: 'vocab', vocabDue: 4 });
  });

  it('the Daily Test stays in slot 3 on any day', () => {
    const capabilities = { dailyTestAvailable: true };
    const pinned = build({ capabilities, vocabDay: '2026-10-13' });
    expect(slot(build({ capabilities, pinned, vocab: NUDGE, vocabDay: '2026-10-14' }), 3)?.kind).toBe('daily-test');
  });

  it('a carry is read only for the same profile, an earlier UTC day and the same local day', () => {
    const carry = build({ vocab: NUDGE, vocabDay: '2026-10-13' });
    const fresh = (overrides: Partial<BuildMissionInput>) => slot(build({ today: '2026-10-14', vocab: null, vocabDay: '2026-10-13', vocabCarry: carry, ...overrides }), 3);
    expect(fresh({})).toMatchObject({ kind: 'vocab', topicKey: 'food', vocabDue: 4 });
    expect(fresh({ vocabCarry: { ...carry, profileId: 'profile:other' } })?.kind).not.toBe('vocab');
    expect(fresh({ vocabDay: '2026-10-14' })?.kind).not.toBe('vocab');
    expect(fresh({ vocabCarry: null })?.kind).not.toBe('vocab');
    expect(fresh({ vocabCarry: { ...carry, vocabDay: undefined } })?.kind).not.toBe('vocab');
    // Without vocabDay the input nudge alone decides, as before P-3b.
    expect(slot(build({ today: '2026-10-14', vocab: null, vocabCarry: carry }), 3)?.kind).not.toBe('vocab');
  });

  it('the shown key is the local day when the plan has one, else the plan day', () => {
    expect(vocabCardShownKey(build({ vocabDay: '2026-10-14' }))).toBe(`${PROFILE}|2026-10-14`);
    expect(vocabCardShownKey(build())).toBe(`${PROFILE}|2026-10-13`);
  });
});
