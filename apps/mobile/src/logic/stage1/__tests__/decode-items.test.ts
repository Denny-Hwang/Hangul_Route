import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blockParts, romanizeReviewed, sayRef, type AudioPack, type BlockParts } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { CONTRAST_SETS } from '../../../content/__generated__/contrast-sets';
import { jamoAll } from '../../../content/jamo';
import { stage1Quests } from '../../../content/quests';
import { jamoVoice } from '../../audio/jamo-voice';
import { packsUpTo } from '../../audio/clip-pack-loader';
import { minigameScopes } from '../../minigame-config';
import { DRILL_BLOCKS, PROBE_BLOCKS, soundKeyOf } from '../../syllable-build/pool';
import { buildDiscover } from '../discover-flow';
import { HANGUL_CHECK_WORDS } from '../hangul-check';
import pool from '../decode-items.json';

/**
 * The Hangul Check's decode item pool (AMENDMENTS-STAGE1-DECODING-CHECK section 3.4, row DC-2b): see a syllable no
 * Stage 1 quest practised, pick its sound among four recorded clips that form a balanced set, every contrast one an ear
 * can tell apart. `items` play on today's shipped clips; `awaitingClips` wait for the clips DC-2c's owner run makes
 * (their manifest rows are committed, so `audio:tts:generate --only` can make them). The pool is read by the manifest
 * builder (`content-sources.mjs`, `decodeOccurrencesOf`), not yet by the app (DC-2d builds the version 2 check).
 */

const REPO = join(__dirname, '../../../../../..');
const MANIFEST = JSON.parse(readFileSync(join(REPO, 'content/audio/tts-manifest.json'), 'utf8')) as {
  rows: Array<{ ref: string; key: string; kind: string; text: string; say: string; pack: AudioPack; sources: string[] }>;
};
const LOCK = JSON.parse(readFileSync(join(REPO, 'content/audio/tts-lock.json'), 'utf8')) as { rows: Array<{ ref: string; mp3Sha256: string | null }> };
const POOL_SOURCE = 'apps/mobile/src/logic/stage1/decode-items.json';

interface DecodeOption {
  ko: string;
  romanization: string;
}
interface DecodeItem {
  id: string;
  target: string;
  options: DecodeOption[];
}
const ITEMS: readonly DecodeItem[] = pool.items;
const AWAITING: readonly DecodeItem[] = pool.awaitingClips;
const ALL: readonly DecodeItem[] = [...ITEMS, ...AWAITING];

// ---- the Stage 1 letters ------------------------------------------------------------------------------------------
const CONSONANTS = [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'];
const VOWELS = [...'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ'];
const FINALS = [...'ㄱㄴㄹㅁㅂㅇ'];
const Y_VOWELS = new Set([...'ㅑㅕㅛㅠ']);
const partsOf = (ko: string): BlockParts => {
  const p = blockParts(ko);
  if (p === null) throw new Error(`${ko} is not one block`);
  return p;
};
const isOpen = (ko: string): boolean => partsOf(ko).final === null;

// ---- what Stage 1 practises, computed from the content (section 3.4 "Not practised") --------------------------------
const blocksOf = (s: string): string[] => s.match(/[가-힣]/gu) ?? [];
function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsOf(v, out);
  else if (value !== null && typeof value === 'object') for (const v of Object.values(value)) stringsOf(v, out);
  return out;
}
const messages = getMessages('en');
/** Every block a Stage 1 quest shows in any role: its steps (Discover pages included), the game scopes its steps name, the Discover views built from them. */
const QUEST_BLOCKS = new Set<string>();
for (const quest of stage1Quests) {
  for (const s of stringsOf(quest.steps)) blocksOf(s).forEach((b) => QUEST_BLOCKS.add(b));
  for (const step of quest.steps) {
    if (step.minigameRef !== undefined) for (const s of stringsOf(minigameScopes[step.minigameRef])) blocksOf(s).forEach((b) => QUEST_BLOCKS.add(b));
    if (step.kind === 'discover' && step.discover !== undefined) {
      const model = buildDiscover(step.discover.pages, messages.learner.quest.discover, messages.a11y);
      for (const s of stringsOf(model)) blocksOf(s).forEach((b) => QUEST_BLOCKS.add(b));
    }
  }
}
// The letter records (examples, spoken forms) and Stage 1's contrast sets (quest 6 plays them, AMENDMENTS-MINIMAL-PAIRS).
for (const j of jamoAll) for (const s of stringsOf(j)) blocksOf(s).forEach((b) => QUEST_BLOCKS.add(b));
for (const set of CONTRAST_SETS) if (set.unit.startsWith('minigame:s1-')) for (const m of set.members) blocksOf(m.text).forEach((b) => QUEST_BLOCKS.add(b));
/** The letters' voices (`jamoVoice`): the carrier syllables (ga, a, ak) and the names (giyeok). */
const CARRIERS = new Set<string>();
for (const j of jamoAll) {
  for (const question of j.kind === 'batchim' ? (['sound'] as const) : (['sound', 'letter'] as const)) {
    const voice = jamoVoice(j, question);
    for (const b of [...blocksOf(voice.text), ...blocksOf(voice.shown)]) CARRIERS.add(b);
  }
}
const CHECK_WORD_BLOCKS = new Set(HANGUL_CHECK_WORDS.flatMap((w) => blocksOf(w.text.ko)));
const PROBE = new Set(PROBE_BLOCKS);
const DRILL = new Set(DRILL_BLOCKS);

// ---- the contrasts (section 3.4, OD-DC6) ------------------------------------------------------------------------------
type Pair = readonly [string, string];
const has = (pairs: readonly Pair[], a: string, b: string): boolean => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
/** Plain against aspirated: WO-16's (AMENDMENTS-MINIMAL-PAIRS); only an approved contrast set may admit one (`contrastApproved`). */
const PLAIN_ASPIRATED: readonly Pair[] = [['ㄱ', 'ㅋ'], ['ㄷ', 'ㅌ'], ['ㅂ', 'ㅍ'], ['ㅈ', 'ㅊ']];
/** A weak [h] in a lone clip. */
const NEVER_INITIAL: readonly Pair[] = [['ㅇ', 'ㅎ']];
/**
 * Used only once the owner's listening pass of DC-2c clears them for these clips: ㄴ-ㄷ and ㅁ-ㅂ (section 3.4: a
 * word-initial nasal can lose its nasal sound) and, added by DC-2b, ㄴ-ㄹ and ㄷ-ㄹ (a lone initial ㄹ is a flap: the
 * AC-5 pilot heard the letter clip 라 as 나, and an English ear hears a flap as a quick d).
 */
const PENDING_LISTEN: readonly Pair[] = [['ㄴ', 'ㄷ'], ['ㅁ', 'ㅂ'], ['ㄴ', 'ㄹ'], ['ㄷ', 'ㄹ']];
const CLOSE_VOWELS: readonly Pair[] = [['ㅓ', 'ㅗ'], ['ㅡ', 'ㅜ'], ['ㅕ', 'ㅛ']];
/** A y-vowel against its plain vowel is heard only in the glide; after ㅎ the glide is the [ç] of the h (DC-2b). */
const Y_AND_PLAIN: readonly Pair[] = [['ㅑ', 'ㅏ'], ['ㅕ', 'ㅓ'], ['ㅛ', 'ㅗ'], ['ㅠ', 'ㅜ']];
const finalClass = (f: string): string => ('ㄱㅂ'.includes(f) ? 'stop' : 'ㄴㅁㅇ'.includes(f) ? 'nasal' : 'liquid');

/** MP-1a's gate (AMENDMENTS-MINIMAL-PAIRS section 3.4): one approved set holds both blocks. */
const contrastApproved = (a: string, b: string): boolean => CONTRAST_SETS.some((s) => s.approved && s.members.some((m) => m.text === a) && s.members.some((m) => m.text === b));

/** Why two options of one item may not stand side by side, or null when the ear tells them apart. */
function contrastProblem(a: string, b: string): string | null {
  const p = partsOf(a);
  const q = partsOf(b);
  const vowels = [p.vowel, q.vowel];
  if (p.first !== q.first) {
    const onlyInitial = p.vowel === q.vowel && p.final === q.final;
    if (has(PLAIN_ASPIRATED, p.first, q.first) && !(onlyInitial && contrastApproved(a, b))) return `${p.first}-${q.first} is plain against aspirated`;
    if (has(NEVER_INITIAL, p.first, q.first)) return `${p.first}-${q.first}: a weak h`;
    if (has(PENDING_LISTEN, p.first, q.first)) return `${p.first}-${q.first} waits for the owner's listening pass`;
    if (has([['ㅅ', 'ㅈ'], ['ㅅ', 'ㅊ']], p.first, q.first) && vowels.some((v) => v === 'ㅣ' || Y_VOWELS.has(v))) return `${p.first}-${q.first} before i or a y-vowel`;
  }
  if (p.vowel !== q.vowel) {
    if (has(CLOSE_VOWELS, p.vowel, q.vowel)) return `${p.vowel}-${q.vowel} sound close`;
    if ((p.first === 'ㅎ' || q.first === 'ㅎ') && has(Y_AND_PLAIN, p.vowel, q.vowel)) return `${p.vowel}-${q.vowel} after h`;
  }
  if (p.final !== q.final && p.final !== null && q.final !== null && finalClass(p.final) === finalClass(q.final)) return `finals ${p.final}-${q.final} are one class`;
  return null;
}

/** The positions in which two blocks differ (initial, vowel, final). */
const differences = (a: string, b: string): number => {
  const p = partsOf(a);
  const q = partsOf(b);
  return Number(p.first !== q.first) + Number(p.vowel !== q.vowel) + Number(p.final !== q.final);
};
/** Each position takes exactly two values, each in two of the four options. */
const twoByTwo = (values: readonly (string | null)[]): boolean => {
  const counts = new Map<string | null, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts.size === 2 && [...counts.values()].every((n) => n === 2);
};

// ---- the clips ----------------------------------------------------------------------------------------------------
const rowByText = new Map(MANIFEST.rows.filter((r) => r.kind === 'syllable').map((r) => [r.text, r]));
const lockByRef = new Map(LOCK.rows.map((r) => [r.ref, r]));
/** Shipped: the lock holds the MP3 that passed the clip QA (or the owner's listen) and the file is in the build. */
const shipped = (ko: string): boolean => {
  const row = rowByText.get(ko);
  if (row === undefined) return false;
  const lock = lockByRef.get(row.ref);
  return typeof lock?.mp3Sha256 === 'string' && existsSync(join(REPO, 'apps/mobile/assets', row.ref));
};

describe('the decode item pool (AMENDMENTS-STAGE1-DECODING-CHECK section 3.4, DC-2b)', () => {
  it('names its pack and lists each item once, its id the target\'s romanization', () => {
    expect(pool.schemaVersion).toBe(1);
    expect(pool.pack).toBe('review');
    const ids = ALL.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of ALL) {
      expect(item.id).toBe(`decode:${romanizeReviewed(item.target).text}`);
      expect(item.options, item.id).toHaveLength(4);
      expect(item.options.filter((o) => o.ko === item.target), item.id).toHaveLength(1);
    }
    expect(new Set(ALL.map((i) => i.target)).size).toBe(ALL.length);
  });

  it('every option\'s romanization is the reviewed converter\'s (romanizeReviewed)', () => {
    for (const item of ALL) for (const o of item.options) expect(o.romanization, `${item.id} ${o.ko}`).toBe(romanizeReviewed(o.ko).text);
  });

  it('every block is made only of Stage 1 symbols: a basic consonant, a basic vowel and no final or one of ㄱ ㄴ ㄹ ㅁ ㅂ ㅇ', () => {
    for (const item of ALL) {
      for (const o of item.options) {
        const p = partsOf(o.ko);
        expect(CONSONANTS, `${item.id} ${o.ko}`).toContain(p.first);
        expect(VOWELS, `${item.id} ${o.ko}`).toContain(p.vowel);
        if (p.final !== null) expect(FINALS, `${item.id} ${o.ko}`).toContain(p.final);
      }
    }
  });

  it('the practised set is computed from the content, not a hand list (a few blocks every learner has met)', () => {
    for (const ko of ['가', '나', '곰', '바다', '아기'].flatMap(blocksOf)) expect(QUEST_BLOCKS.has(ko) || CARRIERS.has(ko), ko).toBe(true);
    expect(QUEST_BLOCKS.size).toBeGreaterThan(100);
    expect([...CHECK_WORD_BLOCKS].sort()).toEqual([...'글밥복산연한'].sort());
  });

  it('no target is practised: no block a Stage 1 quest shows, no carrier or letter name, no Hangul Check word block, no probe block', () => {
    for (const item of ALL) {
      const t = item.target;
      expect(QUEST_BLOCKS.has(t), `${item.id}: a Stage 1 quest shows ${t}`).toBe(false);
      expect(CARRIERS.has(t), `${item.id}: ${t} is a letter's voice`).toBe(false);
      expect(CHECK_WORD_BLOCKS.has(t), `${item.id}: ${t} is in a Hangul Check word`).toBe(false);
      expect(PROBE.has(t), `${item.id}: ${t} is a Decoding Sprint probe block`).toBe(false);
      // Every consonant + ㅏ and ㅇ + vowel is a carrier, so an open target never has ㅏ or the initial ㅇ.
      if (isOpen(t)) expect(partsOf(t).vowel === 'ㅏ' || partsOf(t).first === 'ㅇ', item.id).toBe(false);
    }
  });

  it('no option is a probe block (the Hangul Check never shows one) or a carrier (a familiar voice would point at the new target)', () => {
    for (const item of ALL) {
      for (const o of item.options) {
        expect(PROBE.has(o.ko), `${item.id}: ${o.ko} is a probe block`).toBe(false);
        expect(CARRIERS.has(o.ko), `${item.id}: ${o.ko} is a letter's voice`).toBe(false);
      }
    }
  });

  it('the phonology exclusions: no ㅈ, ㅊ or ㅅ with ㅑ ㅕ ㅛ ㅠ (져 sounds as 저; 셔 is heard as 서 with a softer s), as target or option', () => {
    for (const item of ALL) {
      for (const o of item.options) {
        const p = partsOf(o.ko);
        expect('ㅈㅊㅅ'.includes(p.first) && Y_VOWELS.has(p.vowel), `${item.id}: ${o.ko}`).toBe(false);
      }
    }
  });

  it('every item is a balanced set (OD-DC5 (a)): open 2 x 2, closed with every pair two letters apart, so no option stands out by its pattern', () => {
    for (const item of ALL) {
      const kos = item.options.map((o) => o.ko);
      const parts = kos.map(partsOf);
      expect(new Set(kos).size, item.id).toBe(4);
      expect(twoByTwo(parts.map((p) => p.first)), `${item.id}: initials`).toBe(true);
      expect(twoByTwo(parts.map((p) => p.vowel)), `${item.id}: vowels`).toBe(true);
      if (isOpen(item.target)) {
        // {CV, C'V, CV', C'V'}: every option open, and the four are the four corners.
        expect(kos.every(isOpen), item.id).toBe(true);
      } else {
        // {CVF, C'V'F, C'VF', CV'F'}: every option closed (never "no final"), every pair differs in exactly two places.
        expect(kos.some(isOpen), item.id).toBe(false);
        expect(twoByTwo(parts.map((p) => p.final)), `${item.id}: finals`).toBe(true);
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(differences(kos[i]!, kos[j]!), `${item.id}: ${kos[i]} ${kos[j]}`).toBe(2);
      }
    }
  });

  it('every contrast is one the ear tells apart (OD-DC6), with no ㄴ-ㄷ, ㅁ-ㅂ, ㄴ-ㄹ or ㄷ-ㄹ initial before the owner\'s listening pass', () => {
    const problems: string[] = [];
    for (const item of ALL) {
      const kos = item.options.map((o) => o.ko);
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        const why = contrastProblem(kos[i]!, kos[j]!);
        if (why !== null) problems.push(`${item.id} ${kos[i]} ${kos[j]}: ${why}`);
      }
    }
    expect(problems).toEqual([]);
    // The rule itself (a guard against a check that never fails).
    expect(contrastProblem('고', '코')).toMatch(/aspirated/);
    expect(contrastProblem('어', '허')).toMatch(/weak h/);
    expect(contrastProblem('나', '다')).toMatch(/listening/);
    expect(contrastProblem('너', '러')).toMatch(/listening/);
    expect(contrastProblem('시', '지')).toMatch(/before i/);
    expect(contrastProblem('서', '저')).toBeNull();
    expect(contrastProblem('거', '고')).toMatch(/close/);
    expect(contrastProblem('혀', '허')).toMatch(/after h/);
    expect(contrastProblem('간', '강')).toMatch(/one class/);
    expect(contrastProblem('간', '갈')).toBeNull();
  });

  it('no two options sound the same: different texts, clips, sound keys and romanizations', () => {
    for (const item of ALL) {
      const rows = item.options.map((o) => rowByText.get(o.ko));
      expect(new Set(rows.map((r) => r?.ref)).size, item.id).toBe(4);
      expect(new Set(item.options.map((o) => soundKeyOf(o.ko))).size, item.id).toBe(4);
      expect(new Set(item.options.map((o) => o.romanization)).size, item.id).toBe(4);
    }
  });

  it('no two items offer the same four options', () => {
    const keys = ALL.map((i) => i.options.map((o) => o.ko).sort().join(''));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every option has a manifest row of kind syllable, said with a full stop, played by its text (the say ref), in a pack the Hangul Check opens', () => {
    const scope = packsUpTo(pool.pack as AudioPack);
    for (const item of ALL) {
      for (const o of item.options) {
        const row = rowByText.get(o.ko);
        expect(row, `${item.id}: no syllable row for ${o.ko}`).toBeDefined();
        expect(row!.say, `${item.id} ${o.ko}`).toBe(`${o.ko}.`);
        // A text-keyed clip: a vocabulary record's own clip (audio/vocab/...) would not be found by the text.
        expect(row!.ref, `${item.id} ${o.ko}`).toBe(sayRef(o.ko));
        expect(row!.sources, `${item.id} ${o.ko}`).toContain(POOL_SOURCE);
        expect(scope, `${item.id} ${o.ko} is in ${row!.pack}`).toContain(row!.pack);
        // A block only the pool says is the pool's pack's.
        if (row!.sources.every((s) => s === POOL_SOURCE)) expect(row!.pack, `${item.id} ${o.ko}`).toBe(pool.pack);
      }
    }
  });

  it('items play on shipped clips today (QA passed, in the lock and the build); each awaiting item needs at least one DC-2c clip', () => {
    for (const item of ITEMS) for (const o of item.options) expect(shipped(o.ko), `${item.id}: ${o.ko} has no shipped clip`).toBe(true);
    for (const item of AWAITING) expect(item.options.some((o) => !shipped(o.ko)), `${item.id} could move to items`).toBe(true);
  });

  it('the clips DC-2c generates: 25 manifest rows only the pool says, none generated yet', () => {
    const toMake = [...new Set(AWAITING.flatMap((i) => i.options.map((o) => o.ko)).filter((ko) => !shipped(ko)))].sort();
    expect(toMake.join(' ')).toBe('갸 교 규 냐 냥 녀 뇨 뉴 닉 듑 랴 려 료 류 먀 며 벼 약 율 콜 쿄 톤 햐 혀 휴');
    for (const ko of toMake) {
      const row = rowByText.get(ko)!;
      expect(row.sources, ko).toEqual([POOL_SOURCE]);
      expect(lockByRef.get(row.ref)?.mp3Sha256 ?? null, ko).toBeNull();
    }
  });

  it('once DC-2c lands: at least 30 open and 30 closed targets, every consonant and every vowel in at least two', () => {
    const open = ALL.filter((i) => isOpen(i.target));
    const closed = ALL.filter((i) => !isOpen(i.target));
    expect(open.length).toBeGreaterThanOrEqual(30);
    expect(closed.length).toBeGreaterThanOrEqual(30);
    for (const c of CONSONANTS) expect(ALL.filter((i) => partsOf(i.target).first === c).length, c).toBeGreaterThanOrEqual(2);
    for (const v of VOWELS) expect(ALL.filter((i) => partsOf(i.target).vowel === v).length, v).toBeGreaterThanOrEqual(2);
    // ㅏ in closed targets only (section 3.4).
    expect(ALL.filter((i) => partsOf(i.target).vowel === 'ㅏ').every((i) => !isOpen(i.target))).toBe(true);
  });

  it('admits DC-2d\'s draw: 6 open and 6 closed targets with 12 different initials, no drawn target an option of another drawn item', () => {
    // A seeded search, as the builder will draw (section 3.4 step 1). "No drawn target is another drawn item's option"
    // keeps elimination (the bot's strategy 3, section 3.9) from ruling out a sound already given as an answer.
    const draws = (list: readonly DecodeItem[]): number => {
      let found = 0;
      let state = 7;
      const rnd = (): number => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
      };
      for (let attempt = 0; attempt < 200; attempt++) {
        const order = [...list].sort(() => rnd() - 0.5);
        const picked: DecodeItem[] = [];
        for (const want of [true, false]) {
          for (const item of order) {
            if (picked.filter((p) => isOpen(p.target) === want).length === 6) break;
            if (isOpen(item.target) !== want) continue;
            if (picked.some((p) => partsOf(p.target).first === partsOf(item.target).first)) continue;
            const clash = picked.some((p) => p.options.some((o) => o.ko === item.target) || item.options.some((o) => o.ko === p.target));
            if (!clash) picked.push(item);
          }
        }
        if (picked.length === 12) found += 1;
      }
      return found;
    };
    expect(draws(ALL)).toBeGreaterThan(0);
    expect(draws(ITEMS)).toBeGreaterThan(0);
  });

  it('reports the overlap with the Decoding Sprint\'s drill pool (targets outside it are preferred, section 3.4)', () => {
    const overlap = ALL.filter((i) => DRILL.has(i.target)).map((i) => i.target);
    // Every open chart syllable with ㅓ ㅗ ㅜ ㅡ is a drill block, so today's open targets all overlap; the y-vowel
    // targets of DC-2c and most closed targets do not.
    expect(overlap.join('')).toBe('누느더러루르모므브서스저처츠커크터트퍼프허후흐눈굴길돌말발불실몸섬굽성');
    expect(ALL.filter((i) => !isOpen(i.target) && DRILL.has(i.target))).toHaveLength(12);
    expect(AWAITING.filter((i) => DRILL.has(i.target))).toHaveLength(0);
  });
});
