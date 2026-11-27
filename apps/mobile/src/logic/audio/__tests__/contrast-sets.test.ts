import type { ListenPickRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { CONTRAST_SETS, type ContrastSetEntry } from '../../../content/__generated__/contrast-sets';
import {
  CONTRAST_STEP_ROUNDS,
  contrastApproved,
  contrastClipRef,
  contrastMemberSpec,
  contrastRoundPlayable,
  contrastSetById,
  contrastStepPlayable,
  drawContrastRounds,
  pairRound,
  optionMember,
  playableContrastRounds,
  withTarget,
  type ContrastEnv,
} from '../contrast-sets';
import { memberGloss } from '../../listen-pick-contrast';
import { getMessages } from '@hangul-route/i18n';
import { isContrastRound, isContrastScope } from '../../listen-pick';
import { listenPickSpeech } from '../listen-pick-speech';

/**
 * The runtime of the contrast sets (AMENDMENTS-MINIMAL-PAIRS sections 3.4 to 3.6, 3.10, row MP-2a), over fixture sets: the
 * shipped catalogue has no approval until MP-3, so every rule is read against sets this file approves.
 */

type Kind = 'plain' | 'aspirated' | 'tense';

/** A fixture pair: two members of kinds `kinds`, each with its own clip. */
function fixtureSet(id: string, series: ContrastSetEntry['series'], kinds: readonly Kind[], approved = true): ContrastSetEntry {
  return {
    id,
    series,
    unit: 'minigame:s1-life-q3-pairs',
    members: kinds.map((kind, i) => ({
      text: `${id}-${i}`,
      romanization: `${id}${i}`,
      en: `the syllable ${id}${i}`,
      ref: `audio/fixture/${id}-${i}.mp3`,
      kind,
    })),
    approved,
  };
}

const PAIRS = [
  fixtureSet('s-ga', 'k', ['plain', 'aspirated']),
  fixtureSet('s-da', 't', ['plain', 'aspirated']),
  fixtureSet('s-ja', 'c', ['plain', 'aspirated']),
  fixtureSet('s-go', 'k', ['plain', 'aspirated']),
  fixtureSet('s-do', 't', ['plain', 'aspirated']),
  fixtureSet('s-jo', 'c', ['plain', 'aspirated']),
  fixtureSet('s-gu', 'k', ['plain', 'aspirated']),
  fixtureSet('s-du', 't', ['plain', 'aspirated']),
];

const roundOf = (set: ContrastSetEntry): ListenPickRound => {
  const [first] = set.members;
  return {
    id: `lp:pair:${set.id}`,
    contrastSet: set.id,
    prompt: { ko: first!.text, romanization: first!.romanization, en: first!.en, audioRef: first!.ref },
    options: set.members.map((m) => ({ id: m.romanization, text: { ko: m.text, romanization: m.romanization, en: m.en } })),
    answerId: first!.romanization,
  };
};

const allClips = (sets: readonly ContrastSetEntry[]): Set<string> => new Set(sets.flatMap((s) => s.members.map((m) => m.ref)));
const envOf = (sets: readonly ContrastSetEntry[], over: Partial<ContrastEnv> = {}): ContrastEnv => {
  const clips = allClips(sets);
  return { hasClip: (ref) => clips.has(ref), soundOn: true, alwaysShowLetters: false, host: 'quest', sets, ...over };
};

describe('pairRound (the real round of a set; AMENDMENTS-MINIMAL-PAIRS section 3.5)', () => {
  it('is a valid round named by its set, with the set\'s members as ASCII options and the first member as the placeholder target', () => {
    const r = pairRound('ga-ka', CONTRAST_SETS);
    expect(r.id).toBe('lp:pair:ga-ka');
    expect(r.contrastSet).toBe('ga-ka');
    expect(r.options).toEqual([
      { id: 'ga', text: { ko: '가', romanization: 'ga', en: 'the syllable ga' } },
      { id: 'ka', text: { ko: '카', romanization: 'ka', en: 'the syllable ka' } },
    ]);
    expect(r.answerId).toBe('ga');
    expect(r.prompt).toEqual({ ko: '가', romanization: 'ga', en: 'the syllable ga', audioRef: 'audio/jamo/giyeok.mp3' });
  });

  it('a three-way set has three options; every shipped set builds with ASCII option ids', () => {
    expect(pairRound('dal-tal-ttal').options.map((o) => o.id)).toEqual(['dal', 'tal', 'ttal']);
    for (const set of CONTRAST_SETS) {
      const r = pairRound(set.id);
      expect(r.options).toHaveLength(set.members.length);
      expect(r.options.every((o) => /^[a-z]+$/.test(o.id))).toBe(true);
    }
  });

  it('throws on an unknown set', () => {
    expect(() => pairRound('nope')).toThrow(/Unknown contrast set nope/);
  });

  it('the draw swaps the start bundle\'s stub round (lp.pair) for the set\'s own round', () => {
    const sets = [fixtureSet('s-ga', 'k', ['plain', 'aspirated']), fixtureSet('s-da', 't', ['plain', 'aspirated'])];
    const stubs = sets.map((s) => ({ id: `lp:pair:${s.id}`, contrastSet: s.id, prompt: { ko: '', romanization: s.id, en: '' }, options: [], answerId: 'a' }) as ListenPickRound);
    const drawn = drawContrastRounds(stubs, envOf(sets), 3);
    expect(drawn).toHaveLength(2);
    for (const r of drawn) {
      const set = sets.find((s) => s.id === r.contrastSet)!;
      expect(r.options.map((o) => o.text?.ko)).toEqual(set.members.map((m) => m.text));
      expect(set.members.some((m) => m.text === r.prompt.ko && m.romanization === r.answerId)).toBe(true);
    }
  });
});

describe('the catalogue helpers', () => {
  it('a round is a contrast round by its set; a scope is one when every round is', () => {
    const [set] = PAIRS;
    expect(isContrastRound(roundOf(set!))).toBe(true);
    expect(isContrastRound({})).toBe(false);
    expect(isContrastScope([roundOf(set!)])).toBe(true);
    expect(isContrastScope([roundOf(set!), {}])).toBe(false);
    expect(isContrastScope([])).toBe(false);
  });

  it('contrastClipRef is the catalogue ref of a member, by set and text, never a say clip', () => {
    expect(contrastClipRef('s-ga', 's-ga-1', PAIRS)).toBe('audio/fixture/s-ga-1.mp3');
    expect(contrastClipRef('s-ga', 'nope', PAIRS)).toBeUndefined();
    expect(contrastClipRef('nope', 's-ga-0', PAIRS)).toBeUndefined();
    // The shipped catalogue: 가 of ga-ka is the jamo sound clip, 코 of go-ko a say clip.
    expect(contrastClipRef('ga-ka', '가')).toBe('audio/jamo/giyeok.mp3');
    expect(contrastClipRef('go-ko', '코')).toMatch(/^audio\/say\//);
  });

  it('contrastSetById finds a set in the shipped catalogue and says nothing for an unknown id', () => {
    expect(contrastSetById('ga-ka')?.members.map((m) => m.text)).toEqual(['가', '카']);
    expect(contrastSetById('nope')).toBeUndefined();
  });

  it('contrastMemberSpec is a clip-only spec of the member: its text, its own clip, the sound rate, Listen & Pick as source', () => {
    expect(contrastMemberSpec('s-ga', 's-ga-0', PAIRS)).toEqual({
      text: 's-ga-0',
      audioRef: 'audio/fixture/s-ga-0.mp3',
      kind: 'sound',
      source: 'listen-pick',
      clipOnly: true,
    });
    expect(contrastMemberSpec('s-ga', 'nope', PAIRS)).toBeUndefined();
  });

  it('optionMember maps an option to the member of its set by its Korean text', () => {
    expect(optionMember(roundOf(PAIRS[0]!), 's-ga-1', PAIRS)?.kind).toBe('aspirated');
    expect(optionMember(roundOf(PAIRS[0]!), 'x', PAIRS)).toBeUndefined();
    expect(optionMember({}, 'x', PAIRS)).toBeUndefined();
    expect(optionMember({ contrastSet: 'nope' }, 'x', PAIRS)).toBeUndefined();
  });

  it('the shipped catalogue: nothing is approved until MP-3, so contrastApproved is false for every pair', () => {
    expect(CONTRAST_SETS.some((s) => s.approved)).toBe(false);
    expect(contrastApproved('가', '카')).toBe(false);
  });

  it('contrastApproved: true when one approved set holds both texts, in any order, and not for a mixed or unapproved pair', () => {
    const sets = [fixtureSet('s-ga', 'k', ['plain', 'aspirated']), fixtureSet('s-da', 't', ['plain', 'aspirated'], false)];
    expect(contrastApproved('s-ga-0', 's-ga-1', sets)).toBe(true);
    expect(contrastApproved('s-ga-1', 's-ga-0', sets)).toBe(true);
    expect(contrastApproved('s-ga-0', 's-da-1', sets)).toBe(false);
    expect(contrastApproved('s-da-0', 's-da-1', sets)).toBe(false);
    expect(contrastApproved('s-ga-0', 'unknown', sets)).toBe(false);
  });
});

describe('contrastRoundPlayable: each rule of section 3.6', () => {
  const set = PAIRS[0]!;
  const round = roundOf(set);

  it('plays when the set is approved, every clip can play, sound is on, the letters are not always shown, and the host is a practice host', () => {
    expect(contrastRoundPlayable(round, envOf(PAIRS))).toBe(true);
    expect(contrastRoundPlayable(round, envOf(PAIRS, { host: 'preview' }))).toBe(true);
  });

  it('a round that is not a contrast round is not decided here', () => {
    expect(contrastRoundPlayable({}, envOf(PAIRS, { soundOn: false }))).toBe(true);
  });

  it('an unapproved set does not play', () => {
    const sets = [{ ...set, approved: false }];
    expect(contrastRoundPlayable(round, envOf(sets))).toBe(false);
  });

  it('an unknown set does not play', () => {
    expect(contrastRoundPlayable({ contrastSet: 'nope' }, envOf(PAIRS))).toBe(false);
  });

  it('one member without a playable clip drops the round', () => {
    const missing = set.members[1]!.ref;
    expect(contrastRoundPlayable(round, envOf(PAIRS, { hasClip: (ref) => ref !== missing }))).toBe(false);
  });

  it('a pack switched off reads as a missing clip (hasClip is the platform check)', () => {
    expect(contrastRoundPlayable(round, envOf(PAIRS, { hasClip: () => false }))).toBe(false);
  });

  it('sound off does not play', () => {
    expect(contrastRoundPlayable(round, envOf(PAIRS, { soundOn: false }))).toBe(false);
  });

  it('Always show the letters does not play: it would print the answer', () => {
    expect(contrastRoundPlayable(round, envOf(PAIRS, { alwaysShowLetters: true }))).toBe(false);
  });

  it.each(['check', 'review', 'vocab'] as const)('the %s host does not play a contrast round', (host) => {
    expect(contrastRoundPlayable(round, envOf(PAIRS, { host }))).toBe(false);
  });
});

describe('the step: at least two sets and both kinds', () => {
  const rounds = PAIRS.map(roundOf);

  it('plays with two sets of plain and aspirated members', () => {
    expect(contrastStepPlayable(rounds.slice(0, 2), envOf(PAIRS))).toBe(true);
    expect(playableContrastRounds(rounds.slice(0, 2), envOf(PAIRS))).toHaveLength(2);
  });

  it('one playable set is no step, whatever else is unplayable', () => {
    const only = (id: string) => (ref: string) => ref.includes(id);
    expect(contrastStepPlayable(rounds.slice(0, 2), envOf(PAIRS, { hasClip: only('s-ga') }))).toBe(false);
    expect(contrastStepPlayable(rounds.slice(0, 1), envOf(PAIRS))).toBe(false);
    expect(contrastStepPlayable([], envOf(PAIRS))).toBe(false);
  });

  it('sets that all hold one kind only are no step: a learner is never trained on one series alone', () => {
    const one = [fixtureSet('o-a', 'k', ['plain', 'plain']), fixtureSet('o-b', 't', ['plain', 'plain'])];
    expect(contrastStepPlayable(one.map(roundOf), envOf(one))).toBe(false);
  });

  it('the playable rounds exclude the ones that cannot play now', () => {
    const missing = PAIRS[1]!.members[0]!.ref;
    const got = playableContrastRounds(rounds.slice(0, 3), envOf(PAIRS, { hasClip: (ref) => ref !== missing }));
    expect(got.map((r) => r.contrastSet)).toEqual(['s-ga', 's-ja']);
  });
});

describe('drawContrastRounds: six of the playable sets, targets balanced, seeded (section 3.5)', () => {
  const rounds = PAIRS.map(roundOf);
  const env = envOf(PAIRS);

  it('draws six rounds of distinct sets from a pool of eight', () => {
    const drawn = drawContrastRounds(rounds, env, 7);
    expect(drawn).toHaveLength(CONTRAST_STEP_ROUNDS);
    expect(new Set(drawn.map((r) => r.contrastSet)).size).toBe(6);
  });

  it('is the same for a seed and differs across seeds', () => {
    const ids = (seed: number) => drawContrastRounds(rounds, env, seed).map((r) => `${r.contrastSet}:${r.answerId}`);
    expect(ids(1)).toEqual(ids(1));
    const variants = new Set(Array.from({ length: 12 }, (_, i) => ids(i).join(',')));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('balances the targets: three plain and three aspirated in six rounds, for every seed', () => {
    for (let seed = 0; seed < 25; seed++) {
      const drawn = drawContrastRounds(rounds, env, seed);
      const kinds = drawn.map((r) => optionMember(r, r.prompt.ko, PAIRS)!.kind);
      expect(kinds.filter((k) => k === 'plain')).toHaveLength(3);
      expect(kinds.filter((k) => k === 'aspirated')).toHaveLength(3);
    }
  });

  it('the target is the prompt and the answer, with the target\'s own clip', () => {
    for (const r of drawContrastRounds(rounds, env, 3)) {
      const member = optionMember(r, r.prompt.ko, PAIRS)!;
      expect(r.answerId).toBe(member.romanization);
      expect(r.options.some((o) => o.id === r.answerId)).toBe(true);
      expect(r.prompt).toEqual({ ko: member.text, romanization: member.romanization, en: member.en, audioRef: member.ref });
      expect(listenPickSpeech(r)).toEqual({ text: member.text, audioRef: member.ref, kind: 'sound', source: 'listen-pick', clipOnly: true });
    }
  });

  it('no two rounds in a row are from the same consonant series where the pool allows', () => {
    for (let seed = 0; seed < 25; seed++) {
      const series = drawContrastRounds(rounds, env, seed).map((r) => contrastSetById(r.contrastSet!, PAIRS)!.series);
      series.slice(1).forEach((s, i) => expect(s, `seed ${seed} at ${i + 1}`).not.toBe(series[i]));
    }
  });

  it('when the pool has only one series left it still plays them, back to back', () => {
    const same = PAIRS.filter((s) => s.series === 'k').map(roundOf);
    const drawn = drawContrastRounds(same, envOf(PAIRS), 1);
    expect(drawn).toHaveLength(3);
  });

  it('plays fewer than six when fewer sets can play, and none when the step is not playable', () => {
    const missing = new Set(PAIRS.slice(0, 5).flatMap((s) => s.members.map((m) => m.ref)));
    expect(drawContrastRounds(rounds, envOf(PAIRS, { hasClip: (ref) => !missing.has(ref) }), 1)).toHaveLength(3);
    expect(drawContrastRounds(rounds, envOf(PAIRS, { soundOn: false }), 1)).toEqual([]);
    expect(drawContrastRounds(rounds.slice(0, 1), env, 1)).toEqual([]);
  });

  it('a three-way set draws each series as evenly as six rounds allow (Stage 2)', () => {
    const triples = [
      fixtureSet('t-a', 't', ['plain', 'aspirated', 'tense']),
      fixtureSet('t-b', 'p', ['plain', 'aspirated', 'tense']),
      fixtureSet('t-c', 'c', ['plain', 'aspirated', 'tense']),
      fixtureSet('t-d', 'p', ['plain', 'tense']),
      fixtureSet('t-e', 's', ['plain', 'tense']),
      fixtureSet('t-f', 'k', ['plain', 'tense']),
    ];
    for (let seed = 0; seed < 25; seed++) {
      const drawn = drawContrastRounds(triples.map(roundOf), envOf(triples), seed);
      expect(drawn).toHaveLength(6);
      const counts = (['plain', 'aspirated', 'tense'] as const).map((k) => drawn.filter((r) => optionMember(r, r.prompt.ko, triples)!.kind === k).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
      expect(counts.every((n) => n >= 1)).toBe(true);
    }
  });
});

describe('withTarget: the scope keeps the meanings it holds (AMENDMENTS-MINIMAL-PAIRS section 3.7)', () => {
  const set = PAIRS[0]!;
  const full = (en: (i: number) => string): ListenPickRound => ({
    id: `lp:pair:${set.id}`,
    contrastSet: set.id,
    prompt: { ko: set.members[0]!.text, romanization: set.members[0]!.romanization, en: en(0) },
    options: set.members.map((m, i) => ({ id: m.romanization, text: { ko: m.text, romanization: m.romanization, en: en(i) } })),
    answerId: set.members[0]!.romanization,
  });

  it('keeps a localized option meaning (and the prompt\'s) from a round written out in full', () => {
    const round = withTarget(full((i) => `es ${i}`), PAIRS, () => 0);
    expect(round.options.map((o) => o.text?.en)).toEqual(['es 0', 'es 1']);
    expect(round.prompt.en).toBe(round.options.find((o) => o.text?.ko === round.prompt.ko)!.text!.en);
    expect(round.prompt.audioRef).toBe(set.members.find((m) => m.text === round.prompt.ko)!.ref);
  });

  it('takes the catalogue meaning for a stub (placeholder options) and for an empty meaning', () => {
    const stub: ListenPickRound = { ...roundOf(set), options: [{ id: 'a', text: { ko: '', romanization: 'a', en: '' } }, { id: 'b', text: { ko: '', romanization: 'b', en: '' } }] };
    expect(withTarget(stub, PAIRS, () => 0).options.map((o) => o.text?.en)).toEqual(set.members.map((m) => m.en));
    expect(withTarget(full(() => ''), PAIRS, () => 0).options.map((o) => o.text?.en)).toEqual(set.members.map((m) => m.en));
  });

  it('draws balanced targets over a run through `seen`', () => {
    const seen = new Map<'plain' | 'aspirated' | 'tense', number>();
    const kinds = [0, 1].map(() => withTarget(roundOf(set), PAIRS, () => 0, seen).answerId);
    expect(new Set(kinds).size).toBe(2);
  });
});

describe('memberGloss: the catalogue syllable meaning follows the UI language', () => {
  const text = { romanization: 'ga', en: 'the syllable ga' };
  it.each([
    ['en', 'the syllable ga'],
    ['es', 'la sílaba ga'],
    ['ko', 'ga 음절'],
  ] as const)('%s', (locale, expected) => {
    expect(memberGloss(getMessages(locale).learner.minigame.contrast, text)).toBe(expected);
  });

  it('leaves a meaning the scope localized, and a word, as held', () => {
    const copy = getMessages('es').learner.minigame.contrast;
    expect(memberGloss(copy, { romanization: 'ga', en: 'la sílaba ga (scope)' })).toBe('la sílaba ga (scope)');
    expect(memberGloss(copy, { romanization: 'gae', en: 'dog' })).toBe('dog');
  });
});
