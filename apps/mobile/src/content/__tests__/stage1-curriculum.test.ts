import {
  QuestSchema,
  ROMANIZATION_EXCEPTIONS,
  checkKindsFor,
  discoverItemTexts,
  checkRomanization,
  type DiscoverPage,
  type KoText,
  type Quest,
  type QuestStepKind,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { minigameScopes, scopeFor, type MinigameScope } from '../../logic/minigame-config';
import {
  buildBuildLetterRounds,
  buildMatchSoundRounds,
  buildOddOneOutRounds,
  buildTraceStrokeRounds,
} from '../../logic/round-builder';
import { STAGE1_QUESTS, questTeaches } from '../../logic/stage1/curriculum';
import { symbolsOf } from '../../logic/stage1/hangul';
import { cardById } from '../heritage-cards';
import { episodesAll } from '../episodes';
import { findJamo, jamoAll } from '../jamo';
import { questsAll } from '../quests';

/**
 * The Stage 1 curriculum invariants (F-QUEST-002 section 5, T1-T11): the heart of the
 * spec. They run over the 15 Stage 1 quests, each rebuilt with a Discover step (Q-6a:
 * quests 1-3; Q-6b: quests 4-6; Q-7b: quests 7-9; Q-8: quests 10-15), in the Stage 1
 * order, so "taught by this quest or earlier" means the real teaching order.
 */

const hasDiscover = (quest: Quest): boolean => quest.steps.some((s) => s.kind === 'discover');
const REBUILT: readonly Quest[] = STAGE1_QUESTS.filter(hasDiscover);
const ALL_REBUILT = STAGE1_QUESTS.length === 15 && REBUILT.length === 15;

const STEP_ORDER: readonly QuestStepKind[] = ['intro', 'discover', 'practice', 'apply', 'check', 'reward'];
const ROUNDS: Partial<Record<QuestStepKind, number>> = { practice: 6, apply: 4, check: 2 };

const HANGUL = /[가-힣ㄱ-ㅣ]/;

/** Jamo ids taught by `quest` and every rebuilt quest before it. */
function taughtThrough(quest: Quest): Set<string> {
  const at = REBUILT.indexOf(quest);
  return new Set(REBUILT.slice(0, at + 1).flatMap(questTeaches));
}

function scopesOf(quest: Quest): Array<{ stepId: string; kind: QuestStepKind; ref: string; scope: MinigameScope | undefined }> {
  return quest.steps.flatMap((s) => (s.minigameRef ? [{ stepId: s.id, kind: s.kind, ref: s.minigameRef, scope: scopeFor(s.minigameRef) }] : []));
}

/** Rounds a scope scores (one per pair for Pic-Word Match, capped by the pool for Trace). */
function scopeRounds(scope: MinigameScope): number {
  switch (scope.kind) {
    case 'listen-pick':
      return scope.listenPick?.rounds.length ?? 0;
    case 'pic-word-match':
      return (scope.picWord?.boards ?? []).reduce((n, b) => n + b.pairs.length, 0);
    case 'build-letter':
      return scope.syllables?.length ?? 0;
    case 'story-sequence':
      return scope.storySteps?.length ?? 0;
    case 'trace-stroke':
      return Math.min(scope.jamoIds?.length ?? 0, scope.rounds ?? 4);
    default:
      return scope.rounds ?? 4;
  }
}

/** A Korean word or syllable as the symbols it uses; `null` when it leaves the 30 symbols. */
const wordSymbols = (ko: string): string[] | null => symbolsOf(ko);

/**
 * Every symbol a scope asks a learner to read (R3). Theme-word games (Pic-Word Match,
 * Culture Quiz, Story Sequence, Card Match) are exposure and are left out.
 */
function scopeReading(scope: MinigameScope): { ids: string[]; words: string[] } {
  switch (scope.kind) {
    case 'match-sound':
    case 'trace-stroke':
    case 'odd-one-out':
      return { ids: scope.jamoIds ?? [], words: [] };
    case 'build-letter':
      return {
        ids: (scope.syllables ?? []).flatMap((s) => s.jamoIds ?? []),
        words: (scope.syllables ?? []).filter((s) => !s.jamoIds).map((s) => s.ko),
      };
    case 'listen-pick': {
      const ids: string[] = [];
      const words: string[] = [];
      for (const round of scope.listenPick?.rounds ?? []) {
        if (round.id.startsWith('lp:sym:')) {
          // A symbol round: the options are the written symbols; the prompt is only its sound.
          ids.push(...round.options.map((o) => o.id));
          continue;
        }
        words.push(round.prompt.ko);
        for (const option of round.options) if (option.text) words.push(option.text.ko);
      }
      return { ids, words };
    }
    default:
      return { ids: [], words: [] };
  }
}

/** The symbols a Listen & Pick round asks: the written symbol, or every symbol of the answer syllable or word. */
function roundTargets(round: { id: string; answerId: string }): string[] {
  if (round.id.startsWith('lp:sym:')) return [round.answerId];
  if (round.id.startsWith('lp:syl:') || round.id.startsWith('lp:word:')) return symbolsOf(round.answerId) ?? [];
  return [];
}

/**
 * Theme pages (culture words, R3) are exposure: a page of words only under its own caption, such as
 * "Words of Seollal". A page with no caption is titled "Words you can read now", and a caption that
 * says "read" makes the same promise, so those pages are reading pages and go through T7 like any other.
 */
const isThemePage = (page: DiscoverPage): boolean =>
  page.items.every((i) => i.type === 'word') && page.captionEn !== undefined && !/\bread\b/i.test(page.captionEn);

/**
 * The reading words of a quest's Discover step: every example and every word off a theme page.
 * Pictures do not decide it: quest 10's pictured 밥 and 김치 and the R5 words of quests 11-15 sit on
 * "Words you can read now" pages, so every one of them is a reading word.
 */
function discoverReading(quest: Quest): KoText[] {
  return quest.steps.flatMap((s) =>
    (s.discover?.pages ?? []).flatMap((page) =>
      page.items.flatMap((item) => {
        if (item.type === 'jamo') return [item.example];
        return isThemePage(page) ? [] : discoverItemTexts(item);
      }),
    ),
  );
}

/** Every KoText a quest and its scopes show (Discover items, Listen & Pick prompts and text options, Pic-Word words). */
function koTextsOf(quest: Quest): KoText[] {
  const fromDiscover = quest.steps.flatMap((s) =>
    (s.discover?.pages ?? []).flatMap((p) => p.items.flatMap(discoverItemTexts)),
  );
  const fromScopes = scopesOf(quest).flatMap(({ scope }) => [
    ...(scope?.listenPick?.rounds ?? []).flatMap((r) => [
      r.prompt,
      ...r.options.flatMap((o) => (o.text ? [o.text] : [])),
    ]),
    ...(scope?.picWord?.boards ?? []).flatMap((b) => b.pairs.map((p) => p.word)),
  ]);
  return [...fromDiscover, ...fromScopes];
}

/** Every English field of a quest (`*En`), its Discover captions and notes, and its glosses. */
function englishFieldsOf(quest: Quest): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = [];
  const add = (where: string, text: string | undefined): void => {
    if (text !== undefined) out.push({ where, text });
  };
  add('titleEn', quest.titleEn);
  add('blurbEn', quest.blurbEn);
  add('teaserEn', quest.teaserEn);
  for (const s of quest.steps) {
    add(`${s.id}.titleEn`, s.titleEn);
    add(`${s.id}.hoyaLineEn`, s.hoyaLineEn);
    add(`${s.id}.bodyEn`, s.bodyEn);
    (s.discover?.pages ?? []).forEach((p, pi) => {
      add(`${s.id}.pages[${pi}].captionEn`, p.captionEn);
      p.items.forEach((item, ii) => {
        if (item.type === 'word') add(`${s.id}.pages[${pi}].items[${ii}].noteEn`, item.noteEn);
      });
    });
  }
  for (const text of koTextsOf(quest)) add(`gloss of ${text.ko}`, text.en);
  return out;
}

const ctx = { exceptions: ROMANIZATION_EXCEPTIONS };

describe('the rebuilt Stage 1 quests', () => {
  it('rebuilds all 15 Stage 1 quests in the section 3.6 order: letters (Q-6a), life (Q-6b), rites (Q-7b), nature and crafts (Q-8)', () => {
    expect(REBUILT.map((q) => q.id)).toEqual([
      'quest:stage1-letters-q1',
      'quest:stage1-letters-q2',
      'quest:stage1-letters-q3',
      'quest:stage1-life-q1',
      'quest:stage1-life-q2',
      'quest:stage1-life-q3',
      'quest:stage1-rites-q1',
      'quest:stage1-rites-q2',
      'quest:stage1-rites-q3',
      'quest:stage1-nature-q1',
      'quest:stage1-nature-q2',
      'quest:stage1-nature-q3',
      'quest:stage1-crafts-q1',
      'quest:stage1-crafts-q2',
      'quest:stage1-crafts-q3',
    ]);
    expect(STAGE1_QUESTS).toEqual(REBUILT);
    expect(ALL_REBUILT).toBe(true);
  });

  it('teaches the symbols of the spec quest list, in page order', () => {
    const chars = (q: Quest): string[] => questTeaches(q).map((id) => findJamo(id)?.char ?? id);
    expect(chars(REBUILT[0]!)).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']);
    expect(chars(REBUILT[1]!)).toEqual(['ㅗ', 'ㅜ', 'ㅁ', 'ㅇ']);
    expect(chars(REBUILT[2]!)).toEqual(['ㅡ', 'ㅣ', 'ㄷ', 'ㄹ']);
    expect(chars(REBUILT[3]!)).toEqual(['ㅈ', 'ㅊ']);
    expect(chars(REBUILT[4]!)).toEqual(['ㅂ', 'ㅅ']);
    expect(chars(REBUILT[5]!)).toEqual(['ㅋ', 'ㅌ']);
    // The rites quests bring the first finals: a batchim has its own id (`jamo:*-batchim`), not the initial's.
    expect(questTeaches(REBUILT[6]!)).toEqual(['jamo:nieun-batchim', 'jamo:rieul-batchim']);
    expect(questTeaches(REBUILT[7]!)).toEqual(['jamo:ya', 'jamo:yeo', 'jamo:pieup', 'jamo:ieung-batchim']);
    expect(questTeaches(REBUILT[8]!)).toEqual(['jamo:yo', 'jamo:yu', 'jamo:hieut', 'jamo:giyeok-batchim']);
    // Quest 10 brings the last two finals; quests 11-15 teach nothing new (R5).
    expect(questTeaches(REBUILT[9]!)).toEqual(['jamo:mieum-batchim', 'jamo:bieup-batchim']);
    for (const quest of REBUILT.slice(10)) expect(questTeaches(quest), quest.id).toEqual([]);
  });

  it('keeps the rites titles and reward cards of section 3.6 (4, 5 and 5 minutes)', () => {
    const rites = REBUILT.slice(6, 9);
    expect(rites.map((q) => [q.titleEn, q.estimatedMinutes, q.rewardCardId])).toEqual([
      ['Bow & Eat Tteokguk', 4, 'card:seollal'],
      ['Rice Cakes of Chuseok', 5, 'card:chuseok'],
      ['Hanbok and the Bow', 5, 'card:sebae'],
    ]);
  });

  it('opens quest 7 with the Seollal greeting in hoyaLineKo (F-CNT-002 section 3.7 value), never in an English field', () => {
    const intro = REBUILT[6]!.steps.find((s) => s.kind === 'intro')!;
    expect(intro.hoyaLineKo).toEqual({ ko: '새해 복 많이 받으세요.', romanization: 'saehae bok mani badeuseyo', en: 'Happy New Year!' });
    expect(intro.hoyaLineEn).toBeDefined();
    expect(HANGUL.test(intro.hoyaLineEn ?? '')).toBe(false);
  });

  it('plays the section 3.6 Check rounds of quests 7-9: a final or a symbol, then a reading word', () => {
    const checkOf = (q: Quest) => scopesOf(q).find((s) => s.kind === 'check')!.scope!.listenPick!.rounds;
    const optionTexts = (round: { options: Array<{ text?: KoText }> }): string[] => round.options.map((o) => o.text?.ko ?? '').sort();
    const table: Array<[string, string[], string, string[]]> = [
      ['달', ['다', '달', '단'], '설날', ['설날', '설', '날', '달']],
      ['송', ['소', '송', '손'], '송편', ['송편', '포도', '야구', '여우']],
      ['ㅛ', ['ㅛ', 'ㅗ', 'ㅠ', 'ㅕ'], '한복', ['한복', '한국', '효도', '우유']],
    ];
    REBUILT.slice(6, 9).forEach((quest, i) => {
      const [first0, firstOptions, word, wordOptions] = table[i]!;
      const [first, second] = checkOf(quest);
      expect(findJamo(first!.answerId)?.char ?? first!.answerId, quest.id).toBe(first0);
      expect(optionTexts(first!), quest.id).toEqual([...firstOptions].sort());
      expect(second!.answerId, quest.id).toBe(word);
      expect(optionTexts(second!), quest.id).toEqual([...wordOptions].sort());
    });
  });

  it('drills the quest 7 finals by ear: six syllables, each among no final, final n and final l', () => {
    const practice = scopesOf(REBUILT[6]!).find((s) => s.kind === 'practice')!.scope!;
    expect(practice.kind).toBe('listen-pick');
    const rounds = practice.listenPick!.rounds;
    expect(rounds.map((r) => r.answerId)).toEqual(['달', '단', '물', '문', '산', '살']);
    for (const round of rounds) {
      const open = round.answerId.normalize('NFD').slice(0, 2).normalize('NFC');
      const finals = round.options.map((o) => (symbolsOf(o.id) ?? []).find((id) => id.endsWith('-batchim')) ?? 'none').sort();
      expect(finals, round.id).toEqual(['jamo:nieun-batchim', 'jamo:rieul-batchim', 'none']);
      expect(round.options.map((o) => o.id), round.id).toContain(open);
    }
  });

  it('mixes the quest 9 practice: the sounds of ㅎ ㅛ ㅠ, then the syllables 복 한 학', () => {
    const practice = scopesOf(REBUILT[8]!).find((s) => s.kind === 'practice')!.scope!;
    expect(practice.kind).toBe('listen-pick');
    const answers = practice.listenPick!.rounds.map((r) => findJamo(r.answerId)?.char ?? r.answerId);
    expect(answers).toEqual(['ㅎ', 'ㅛ', 'ㅠ', '복', '한', '학']);
  });

  it('builds the closed syllables of quests 7 and 8 from explicit ids, the final as its batchim tile', () => {
    const syllablesOf = (q: Quest) => scopesOf(q).find((s) => s.kind === 'apply')!.scope!.syllables!;
    expect(syllablesOf(REBUILT[6]!).map((s) => [s.ko, s.romanization, s.jamoIds])).toEqual([
      ['달', 'dal', ['jamo:digeut', 'jamo:a', 'jamo:rieul-batchim']],
      ['물', 'mul', ['jamo:mieum', 'jamo:u', 'jamo:rieul-batchim']],
      ['문', 'mun', ['jamo:mieum', 'jamo:u', 'jamo:nieun-batchim']],
      ['산', 'san', ['jamo:siot', 'jamo:a', 'jamo:nieun-batchim']],
    ]);
    expect(syllablesOf(REBUILT[7]!).map((s) => [s.ko, s.romanization, s.jamoIds])).toEqual([
      ['송', 'song', ['jamo:siot', 'jamo:o', 'jamo:ieung-batchim']],
      ['편', 'pyeon', ['jamo:pieup', 'jamo:yeo', 'jamo:nieun-batchim']],
      ['야', 'ya', ['jamo:ieung', 'jamo:ya']],
      ['여', 'yeo', ['jamo:ieung', 'jamo:yeo']],
    ]);
  });

  it('keeps "New Year Order" as the quest 9 apply step: the four Seollal steps with their romanization', () => {
    const apply = scopesOf(REBUILT[8]!).find((s) => s.kind === 'apply')!;
    expect(apply.ref).toBe('minigame:s1-rites-q3-apply');
    expect(apply.scope!.kind).toBe('story-sequence');
    expect(apply.scope!.storySteps!.map((p) => [p.labelEn, p.labelKo, p.romanization])).toEqual([
      ['Wear hanbok', '한복 입기', 'hanbok ipgi'],
      ['Bow to elders', '세배 드리기', 'sebae deurigi'],
      ['Eat tteokguk', '떡국 먹기', 'tteokguk meokgi'],
      ['Receive lucky money', '세뱃돈 받기', 'sebaetdon batgi'],
    ]);
  });

  it('titles the rites theme pages by their festival, since a theme word may hold letters not taught yet (R3)', () => {
    const themePages = REBUILT.slice(6, 9).flatMap((q) => q.steps.flatMap((s) => (s.discover?.pages ?? []).filter(isThemePage)));
    expect(themePages.map((p) => p.captionEn)).toEqual(['Words of Seollal', 'Words of Chuseok']);
  });

  it('shows the rites theme words on their festival cards', () => {
    const themeWords = (q: Quest) =>
      q.steps.flatMap((s) => (s.discover?.pages ?? []).filter(isThemePage).flatMap((p) => p.items.map((i) => (i.type === 'word' ? [i.word.ko, i.picture] : []))));
    expect(themeWords(REBUILT[6]!)).toEqual([
      ['설날', 'card:seollal'],
      ['떡국', 'card:tteokguk'],
    ]);
    expect(themeWords(REBUILT[7]!)).toEqual([
      ['추석', 'card:chuseok'],
      ['송편', 'card:songpyeon'],
    ]);
  });

  it('keeps the life titles and reward cards of section 3.6, 4 minutes each', () => {
    const life = REBUILT.slice(3, 6);
    expect(life.map((q) => [q.titleEn, q.estimatedMinutes, q.rewardCardId])).toEqual([
      ['Hello Kimchi & Rice', 4, 'card:kimchi'],
      ['Family at the Table', 4, 'card:family-table'],
      ['Picnic Snacks', 4, 'card:kimbap'],
    ]);
  });

  it('plays the section 3.6 Check rounds of quests 4-6: the focus symbol among the table options, then a reading word', () => {
    const checkOf = (q: Quest) => scopesOf(q).find((s) => s.kind === 'check')!.scope!.listenPick!.rounds;
    const optionTexts = (round: { options: Array<{ text?: KoText }> }): string[] => round.options.map((o) => o.text?.ko ?? '').sort();
    const table: Array<[string, string[], string, string[]]> = [
      ['ㅊ', ['ㅊ', 'ㅈ', 'ㄱ', 'ㄷ'], '치즈', ['치즈', '자두', '고추', '차']],
      ['ㅅ', ['ㅅ', 'ㅈ', 'ㅂ', 'ㅁ'], '아버지', ['아버지', '아기', '바나나', '두부']],
      ['ㅋ', ['ㅋ', 'ㄱ', 'ㅌ', 'ㄷ'], '토마토', ['토마토', '코코아', '쿠키', '토스트']],
    ];
    REBUILT.slice(3, 6).forEach((quest, i) => {
      const [symbol, symbolOptions, word, wordOptions] = table[i]!;
      const [first, second] = checkOf(quest);
      expect(findJamo(first!.answerId)?.char, quest.id).toBe(symbol);
      expect(optionTexts(first!), quest.id).toEqual([...symbolOptions].sort());
      expect(second!.answerId, quest.id).toBe(word);
      expect(optionTexts(second!), quest.id).toEqual([...wordOptions].sort());
    });
  });

  it('gives quest 4 the first Pic-Word board: four food words, each on its drawn card picture', () => {
    const apply = scopesOf(REBUILT[3]!).find((s) => s.kind === 'apply')!.scope!;
    expect(apply.kind).toBe('pic-word-match');
    const pairs = apply.picWord!.boards[0]!.pairs;
    expect(pairs.map((p) => [p.word.ko, p.word.romanization, p.pictureRef])).toEqual([
      ['김치', 'gimchi', 'card:kimchi'],
      ['밥', 'bap', 'card:rice'],
      ['김밥', 'gimbap', 'card:kimbap'],
      ['젓가락', 'jeotgarak', 'card:chopsticks'],
    ]);
    // Every picture is a Stage 1 card (HeritageCardArt draws all 30), and the gloss is the card's own title,
    // so the text fallback tile reads the same.
    for (const pair of pairs) {
      expect(cardById(pair.pictureRef!)?.stage, pair.pictureRef).toBe('stage1');
      expect(pair.word.en.toLowerCase(), pair.id).toBe(cardById(pair.pictureRef!)?.titleEn.toLowerCase());
    }
  });

  it('gives an episode whose quests are all rebuilt the sum of their minutes (section 3.6: letters 15)', () => {
    const rebuilt = new Set(REBUILT.map((q) => q.id));
    const done = episodesAll.filter((e) => e.stage === 'stage1' && e.questIds.length > 0 && e.questIds.every((id) => rebuilt.has(id)));
    expect(done.map((e) => e.id)).toEqual(expect.arrayContaining(['episode:stage1-letters', 'episode:stage1-life', 'episode:stage1-rites']));
    for (const episode of done) {
      const sum = episode.questIds.reduce((n, id) => n + (questsAll.find((q) => q.id === id)?.estimatedMinutes ?? 0), 0);
      expect(episode.estimatedMinutes, episode.id).toBe(sum);
    }
    const letters = episodesAll.find((e) => e.id === 'episode:stage1-letters');
    expect(letters?.estimatedMinutes).toBe(15);
    expect(letters?.subtitleEn).toBe('Twelve letters, and your first real words.');
    expect(episodesAll.find((e) => e.id === 'episode:stage1-life')?.estimatedMinutes).toBe(12);
    expect(episodesAll.find((e) => e.id === 'episode:stage1-rites')?.estimatedMinutes).toBe(14);
    expect(episodesAll.find((e) => e.id === 'episode:stage1-nature')?.estimatedMinutes).toBe(12);
    expect(episodesAll.find((e) => e.id === 'episode:stage1-crafts')?.estimatedMinutes).toBe(12);
  });

  it('takes Stage 1 to 15 quests and about 65 minutes (section 3.6 symbol accounting)', () => {
    const stage1 = episodesAll.filter((e) => e.stage === 'stage1' && (e.placement ?? 'grid') === 'grid');
    expect(stage1.map((e) => e.questIds.length)).toEqual([3, 3, 3, 3, 3]);
    expect(REBUILT.reduce((n, q) => n + q.estimatedMinutes, 0)).toBe(65);
  });
});

/**
 * F-QUEST-002 Q-8: the Nature and Crafts quests 10-15 of section 3.6. Quest 10 brings the
 * last two finals; quests 11-15 teach nothing new and read words built from all 30
 * symbols (R5), with a card picture where the section 3.6 Discover table names one.
 */
describe('the Nature and Crafts quests (Q-8)', () => {
  const NATURE_CRAFTS = (): Quest[] => REBUILT.slice(9, 15);
  const scopeOf = (quest: Quest, kind: QuestStepKind): MinigameScope => scopesOf(quest).find((s) => s.kind === kind)!.scope!;
  const discoverPages = (quest: Quest): DiscoverPage[] => quest.steps.flatMap((s) => s.discover?.pages ?? []);
  const pageView = (page: DiscoverPage) =>
    page.items.map((i) => (i.type === 'jamo' ? [i.jamoId, i.example.ko, i.picture ?? null] : i.type === 'word' ? [i.word.ko, i.word.romanization, i.picture ?? null] : [i.type]));

  it('keeps the section 3.6 titles, minutes and reward cards (4 minutes each)', () => {
    expect(NATURE_CRAFTS().map((q) => [q.id, q.titleEn, q.estimatedMinutes, q.rewardCardId])).toEqual([
      ['quest:stage1-nature-q1', 'Tiger, Magpie, Moon', 4, 'card:magpie'],
      ['quest:stage1-nature-q2', 'Mountain, River, Sea', 4, 'card:mountain'],
      ['quest:stage1-nature-q3', 'Moon, Stars and Night', 4, 'card:moon'],
      ['quest:stage1-crafts-q1', 'Yut, Kite, Top', 4, 'card:yutnori'],
      ['quest:stage1-crafts-q2', 'Paper and Pottery', 4, 'card:pottery'],
      ['quest:stage1-crafts-q3', 'Read Hangul!', 4, 'card:kite'],
    ]);
  });

  it('lists the quests in their episodes, whose extra cards are mugunghwa and sea, jegi and top (reward cards paragraph)', () => {
    const nature = episodesAll.find((e) => e.id === 'episode:stage1-nature')!;
    const crafts = episodesAll.find((e) => e.id === 'episode:stage1-crafts')!;
    expect(nature.questIds).toEqual(['quest:stage1-nature-q1', 'quest:stage1-nature-q2', 'quest:stage1-nature-q3']);
    expect(crafts.questIds).toEqual(['quest:stage1-crafts-q1', 'quest:stage1-crafts-q2', 'quest:stage1-crafts-q3']);
    const extras = (episode: typeof nature): string[] => {
      const questCards = new Set(episode.questIds.map((id) => questsAll.find((q) => q.id === id)?.rewardCardId));
      return episode.rewardCardIds.filter((id) => !questCards.has(id)).sort();
    };
    expect(extras(nature)).toEqual(['card:mugunghwa', 'card:sea']);
    expect(extras(crafts)).toEqual(['card:jegi', 'card:top']);
  });

  it('quest 10 Discover: final m (gom) and final p (jip) in their blocks, then bom and bap, then the payoff gimchi and eomma', () => {
    const pages = discoverPages(REBUILT[9]!);
    expect(pages.map(pageView)).toEqual([
      [
        ['jamo:mieum-batchim', '곰', null],
        ['jamo:bieup-batchim', '집', null],
      ],
      [
        ['봄', 'bom', null],
        ['밥', 'bap', 'card:rice'],
      ],
      [
        ['김치', 'gimchi', 'card:kimchi'],
        ['엄마', 'eomma', null],
      ],
    ]);
    expect(pages.map((p) => p.captionEn)).toEqual([undefined, undefined, 'You can read these now!']);
    // The payoff words (and every quest 10 word) read with the symbols taught so far, quest 10's finals included.
    const taught = taughtThrough(REBUILT[9]!);
    for (const page of pages.slice(1)) {
      for (const item of page.items) {
        if (item.type !== 'word') continue;
        const symbols = symbolsOf(item.word.ko);
        expect(symbols, item.word.ko).not.toBeNull();
        for (const id of symbols!) expect(taught.has(id), `${item.word.ko} uses ${id}`).toBe(true);
      }
    }
  });

  it('R5 quests 11-15 Discover "Words you can read now": word items only, no caption, card pictures from the section 3.6 table', () => {
    expect(NATURE_CRAFTS().slice(1).map((q) => discoverPages(q).map(pageView))).toEqual([
      [
        [['산', 'san', 'card:mountain'], ['강', 'gang', null]],
        [['바다', 'bada', 'card:sea'], ['하늘', 'haneul', null]],
      ],
      [
        [['달', 'dal', 'card:moon'], ['별', 'byeol', null]],
        [['밤', 'bam', null], ['보름달', 'boreumdal', null]],
      ],
      [
        [['연', 'yeon', 'card:kite'], ['공', 'gong', null]],
        [['줄', 'jul', null], ['놀이', 'nori', null]],
      ],
      [
        [['한지', 'hanji', 'card:hanji'], ['종이', 'jongi', null]],
        [['청자', 'cheongja', 'card:pottery'], ['도자기', 'dojagi', null]],
      ],
      [
        [['한글', 'hangeul', 'card:hangul-day'], ['호야', 'hoya', 'card:tiger']],
        [['안녕', 'annyeong', null], ['사랑', 'sarang', null]],
      ],
    ]);
    for (const quest of NATURE_CRAFTS().slice(1)) {
      for (const page of discoverPages(quest)) {
        expect(page.captionEn, quest.id).toBeUndefined();
        for (const item of page.items) expect(item.type, quest.id).toBe('word');
      }
      // Every word is a reading word: T7 reads them all (no theme pages in a quest that teaches nothing new).
      expect(discoverReading(quest)).toHaveLength(4);
    }
  });

  it('explains how the l of nol slides into the next block of nori', () => {
    const nori = discoverPages(REBUILT[12]!).flatMap((p) => p.items).find((i) => i.type === 'word' && i.word.ko === '놀이');
    expect(nori?.type === 'word' ? nori.noteEn : undefined).toMatch(/nol \+ i/);
  });

  it('drills the quest 10 finals by ear: six closed syllables, each among four that differ only in the final', () => {
    const practice = scopeOf(REBUILT[9]!, 'practice');
    expect(practice.kind).toBe('listen-pick');
    const rounds = practice.listenPick!.rounds;
    expect(rounds.map((r) => r.answerId)).toEqual(['곰', '봄', '밥', '집', '입', '감']);
    const finalOf = (syllable: string): string => (symbolsOf(syllable) ?? []).find((id) => id.endsWith('-batchim')) ?? 'none';
    for (const round of rounds) {
      expect(round.options, round.id).toHaveLength(4);
      // Each round sets final m against final p (the two quest 10 teaches).
      const finals = round.options.map((o) => finalOf(o.id));
      expect(finals, round.id).toEqual(expect.arrayContaining(['jamo:mieum-batchim', 'jamo:bieup-batchim']));
      const open = round.answerId.normalize('NFD').slice(0, 2).normalize('NFC');
      for (const option of round.options) expect(option.id.normalize('NFD').slice(0, 2).normalize('NFC'), round.id).toBe(open);
    }
  });

  it('reads six words by ear in the quest 11, 12, 14 and 15 practice', () => {
    const answers = (quest: Quest): string[] => scopeOf(quest, 'practice').listenPick!.rounds.map((r) => r.answerId);
    expect(answers(REBUILT[10]!)).toEqual(['산', '강', '바다', '하늘', '별', '곰']);
    expect(answers(REBUILT[11]!)).toEqual(['달', '별', '밤', '보름달', '하늘', '산']);
    expect(answers(REBUILT[13]!)).toEqual(['한지', '종이', '청자', '도자기', '연', '공']);
    expect(answers(REBUILT[14]!)).toEqual(['한글', '호야', '안녕', '사랑', '한국', '한복']);
    for (const quest of [REBUILT[10]!, REBUILT[11]!, REBUILT[13]!, REBUILT[14]!]) {
      for (const round of scopeOf(quest, 'practice').listenPick!.rounds) {
        expect(round.id, quest.id).toMatch(/^lp:word:/);
        expect(round.options, round.id).toHaveLength(4);
      }
    }
  });

  it('builds closed blocks from explicit ids: quest 11 and 15 apply, quest 13 practice (six blocks, every final but m)', () => {
    const syllables = (quest: Quest, kind: QuestStepKind) => scopeOf(quest, kind).syllables!.map((s) => [s.ko, s.romanization, s.jamoIds]);
    expect(syllables(REBUILT[10]!, 'apply')).toEqual([
      ['산', 'san', ['jamo:siot', 'jamo:a', 'jamo:nieun-batchim']],
      ['강', 'gang', ['jamo:giyeok', 'jamo:a', 'jamo:ieung-batchim']],
      ['별', 'byeol', ['jamo:bieup', 'jamo:yeo', 'jamo:rieul-batchim']],
      ['곰', 'gom', ['jamo:giyeok', 'jamo:o', 'jamo:mieum-batchim']],
    ]);
    expect(syllables(REBUILT[12]!, 'practice')).toEqual([
      ['연', 'yeon', ['jamo:ieung', 'jamo:yeo', 'jamo:nieun-batchim']],
      ['공', 'gong', ['jamo:giyeok', 'jamo:o', 'jamo:ieung-batchim']],
      ['줄', 'jul', ['jamo:jieut', 'jamo:u', 'jamo:rieul-batchim']],
      ['놀', 'nol', ['jamo:nieun', 'jamo:o', 'jamo:rieul-batchim']],
      ['북', 'buk', ['jamo:bieup', 'jamo:u', 'jamo:giyeok-batchim']],
      ['집', 'jip', ['jamo:jieut', 'jamo:i', 'jamo:bieup-batchim']],
    ]);
    expect(syllables(REBUILT[14]!, 'apply')).toEqual([
      ['한', 'han', ['jamo:hieut', 'jamo:a', 'jamo:nieun-batchim']],
      ['글', 'geul', ['jamo:giyeok', 'jamo:eu', 'jamo:rieul-batchim']],
      ['호', 'ho', ['jamo:hieut', 'jamo:o']],
      ['야', 'ya', ['jamo:ieung', 'jamo:ya']],
    ]);
  });

  it('never repeats a glyph inside one Build a Letter block (two identical tiles would be scored by id)', () => {
    const repeats = Object.entries(minigameScopes).flatMap(([ref, scope]) =>
      scope.kind !== 'build-letter'
        ? []
        : (scope.syllables ?? [])
            .filter((s) => new Set(s.jamoChars).size !== s.jamoChars.length)
            .map((s) => `${ref}: ${s.ko}`),
    );
    expect(repeats).toEqual([]);
  });

  it('traces the finals m, p, l and ng in quest 12', () => {
    const apply = scopeOf(REBUILT[11]!, 'apply');
    expect(apply.kind).toBe('trace-stroke');
    expect(apply.jamoIds).toEqual(['jamo:mieum-batchim', 'jamo:bieup-batchim', 'jamo:rieul-batchim', 'jamo:ieung-batchim']);
  });

  it('pairs pictures and words on the quest 10, 13 and 14 Pic-Word boards, every picture a drawn Stage 1 card', () => {
    const board = (quest: Quest) => scopeOf(quest, 'apply').picWord!.boards[0]!.pairs.map((p) => [p.word.ko, p.word.romanization, p.pictureRef]);
    expect(board(REBUILT[9]!)).toEqual([
      ['호랑이', 'horangi', 'card:tiger'],
      ['까치', 'kkachi', 'card:magpie'],
      ['달', 'dal', 'card:moon'],
      ['산', 'san', 'card:mountain'],
    ]);
    expect(board(REBUILT[12]!)).toEqual([
      ['윷', 'yut', 'card:yutnori'],
      ['연', 'yeon', 'card:kite'],
      ['팽이', 'paengi', 'card:top'],
      ['제기', 'jegi', 'card:jegi'],
    ]);
    expect(board(REBUILT[13]!)).toEqual([
      ['한지', 'hanji', 'card:hanji'],
      ['청자', 'cheongja', 'card:pottery'],
      ['붓', 'but', 'card:brush'],
      ['종이접기', 'jongijeopgi', 'card:origami'],
    ]);
    for (const quest of [REBUILT[9]!, REBUILT[12]!, REBUILT[13]!]) {
      for (const pair of scopeOf(quest, 'apply').picWord!.boards[0]!.pairs) expect(cardById(pair.pictureRef!)?.stage, pair.pictureRef).toBe('stage1');
    }
  });

  it('plays the section 3.6 Check rounds of quests 10-15: a final or a picture, then a reading word', () => {
    const optionKeys = (round: { options: Array<{ id: string }> }): string[] => round.options.map((o) => o.id).sort();
    const table: Array<[string, string[], string, string[]]> = [
      ['곰', ['고', '곰', '공', '골'], '집', ['집', '밥', '곰', '봄']],
      ['card:mountain', ['card:mountain', 'card:sea', 'card:moon', 'card:tiger'], '강', ['강', '산', '바다', '하늘']],
      ['card:moon', ['card:moon', 'card:mountain', 'card:sea', 'card:kite'], '보름달', ['달', '별', '밤', '보름달']],
      ['card:kite', ['card:kite', 'card:top', 'card:jegi', 'card:yutnori'], '놀이', ['놀이', '공', '줄', '연']],
      ['card:pottery', ['card:pottery', 'card:hanji', 'card:brush', 'card:origami'], '한지', ['한지', '종이', '청자', '도자기']],
      ['card:hangul-day', ['card:hangul-day', 'card:hanbok', 'card:tiger', 'card:book'], '안녕', ['안녕', '사랑', '호야', '한글']],
    ];
    const pictureWords = ['산', '달', '연', '청자', '한글'];
    NATURE_CRAFTS().forEach((quest, i) => {
      const [first0, firstOptions, word, wordOptions] = table[i]!;
      const [first, second] = scopeOf(quest, 'check').listenPick!.rounds;
      expect(first!.answerId, quest.id).toBe(first0);
      expect(optionKeys(first!), quest.id).toEqual([...firstOptions].sort());
      // Quests 11-15 teach nothing new: round 1 hears a word and picks its picture (section 3.3).
      if (i > 0) {
        expect(first!.id, quest.id).toMatch(/^lp:pic:/);
        expect(first!.prompt.ko, quest.id).toBe(pictureWords[i - 1]);
      }
      expect(second!.answerId, quest.id).toBe(word);
      expect(optionKeys(second!), quest.id).toEqual([...wordOptions].sort());
    });
  });

  it('opens each quest with a Hoya line about its theme and ends on its card, with no Hangul in English', () => {
    for (const quest of NATURE_CRAFTS()) {
      const intro = quest.steps.find((s) => s.kind === 'intro')!;
      const reward = quest.steps.find((s) => s.kind === 'reward')!;
      expect(intro.hoyaLineEn, quest.id).toBeTruthy();
      expect(reward.hoyaLineEn, quest.id).toMatch(/joins your library!$/);
      expect(HANGUL.test(`${quest.titleEn} ${quest.blurbEn}`), quest.id).toBe(false);
    }
  });
});

describe('T1 teach once', () => {
  it('teaches no symbol in two quests', () => {
    const taught = REBUILT.flatMap(questTeaches);
    expect(taught.filter((id, i) => taught.indexOf(id) !== i)).toEqual([]);
  });

  it('teaches exactly the 30 symbols, each once, across the 15 quests', () => {
    const taught = REBUILT.flatMap(questTeaches);
    expect([...taught].sort()).toEqual(jamoAll.map((j) => j.id).sort());
  });
});

describe.each(REBUILT.map((q) => [q.id, q] as const))('%s', (_id, quest) => {
  const taught = taughtThrough(quest);

  it('T2 teaches at most two consonant-type symbols and two vowels', () => {
    const kinds = questTeaches(quest).map((id) => findJamo(id)?.kind);
    expect(kinds.filter((k) => k === 'consonant' || k === 'batchim').length).toBeLessThanOrEqual(2);
    expect(kinds.filter((k) => k === 'vowel').length).toBeLessThanOrEqual(2);
    expect(kinds).not.toContain(undefined);
  });

  it('T3 asks only symbols taught by this quest or earlier, in every scope and Check option', () => {
    const problems: string[] = [];
    for (const { ref, scope } of scopesOf(quest)) {
      if (!scope) continue;
      const { ids, words } = scopeReading(scope);
      for (const id of ids) if (!taught.has(id)) problems.push(`${ref}: ${id} is not taught yet`);
      for (const word of words) {
        const symbols = wordSymbols(word);
        if (symbols === null) problems.push(`${ref}: ${word} is outside the 30 symbols`);
        else for (const id of symbols) if (!taught.has(id)) problems.push(`${ref}: ${word} uses ${id}, not taught yet`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('T4 has the six steps in order, a short Discover, and 6 + 4 + 2 rounds', () => {
    expect(quest.steps.map((s) => s.kind)).toEqual(STEP_ORDER);
    const discover = quest.steps.find((s) => s.kind === 'discover')?.discover;
    expect(discover?.pages.length).toBeLessThanOrEqual(3);
    for (const page of discover?.pages ?? []) expect(page.items.length).toBeLessThanOrEqual(2);
    for (const { kind, ref, scope } of scopesOf(quest)) {
      expect(scope, ref).toBeDefined();
      expect(scopeRounds(scope!), `${ref} (${kind})`).toBe(ROUNDS[kind]);
    }
    // The Check rule of F-QUEST-002 T4 as amended by F-CURR-001 §3.11: Listen & Pick (order-it only in stage7).
    expect(checkKindsFor('stage1')).toEqual(['listen-pick']);
    expect(checkKindsFor('stage1')).toContain(scopesOf(quest).find((s) => s.kind === 'check')?.scope?.kind);
  });

  it('T4 every practice and apply scope builds its rounds the way its game screen does, over several seeds', () => {
    const SEEDS = [1, 7, 42, 2026, 99991];
    for (const { kind, ref, scope } of scopesOf(quest)) {
      if (kind !== 'practice' && kind !== 'apply') continue;
      const s = scope!;
      const jamoIds = s.jamoIds ?? [];
      const rounds = s.rounds ?? 4;
      for (const seed of SEEDS) {
        const label = `${ref} seed ${seed}`;
        switch (s.kind) {
          case 'match-sound': {
            const built = buildMatchSoundRounds({ scopeJamoIds: jamoIds, rounds, ...(s.focusJamoIds ? { focusJamoIds: s.focusJamoIds } : {}), seed });
            expect(built, label).toHaveLength(ROUNDS[kind]!);
            const prompted = new Set(built.map((r) => r.promptJamo.id));
            for (const id of s.focusJamoIds ?? []) expect(prompted.has(id), `${label} asks ${id}`).toBe(true);
            break;
          }
          case 'trace-stroke':
            expect(buildTraceStrokeRounds({ scopeJamoIds: jamoIds, rounds, seed }), label).toHaveLength(ROUNDS[kind]!);
            break;
          case 'odd-one-out':
            expect(buildOddOneOutRounds({ scopeJamoIds: jamoIds, rounds, seed }), label).toHaveLength(ROUNDS[kind]!);
            break;
          case 'build-letter':
            expect(buildBuildLetterRounds({ syllables: s.syllables ?? [], seed }), label).toHaveLength(ROUNDS[kind]!);
            break;
          default:
            break;
        }
      }
    }
  });

  it('T4 the practice drills the new symbols: a Match Sound focuses the new letters, a Listen & Pick answers every new symbol', () => {
    const practice = scopesOf(quest).find((s) => s.kind === 'practice')?.scope;
    const taughtHere = questTeaches(quest);
    if (taughtHere.length === 0) {
      // R5: a quest that teaches nothing new practises reading, by ear (Listen & Pick) or by building blocks (quest 13).
      expect(['listen-pick', 'build-letter']).toContain(practice?.kind);
      return;
    }
    if (practice?.kind === 'match-sound') {
      // A final has no sound of its own to match, so Match Sound focuses the letters; finals are built and checked.
      expect(practice.focusJamoIds).toEqual(taughtHere.filter((id) => findJamo(id)?.kind !== 'batchim'));
    } else {
      expect(practice?.kind).toBe('listen-pick');
      const asked = new Set(practice!.listenPick!.rounds.flatMap(roundTargets));
      for (const id of taughtHere) expect(asked.has(id), `${quest.id} practice asks ${id}`).toBe(true);
    }
  });

  it('T4 asks every symbol the quest teaches in its practice, apply or Check', () => {
    const asked = new Set<string>();
    for (const { scope } of scopesOf(quest)) {
      for (const id of scope?.focusJamoIds ?? []) asked.add(id);
      for (const s of scope?.syllables ?? []) for (const id of s.jamoIds ?? symbolsOf(s.ko) ?? []) asked.add(id);
      for (const round of scope?.listenPick?.rounds ?? []) for (const id of roundTargets(round)) asked.add(id);
    }
    for (const id of questTeaches(quest)) expect(asked.has(id), `${quest.id} asks ${id}`).toBe(true);
  });

  it('T5 repeats no minigame and every ref resolves to a scope of the same kind', () => {
    const refs = scopesOf(quest).map((s) => s.ref);
    expect(new Set(refs).size).toBe(refs.length);
    for (const step of quest.steps) {
      if (!step.minigameRef) continue;
      expect(scopeFor(step.minigameRef)?.kind, `${step.id} -> ${step.minigameRef}`).toBe(step.minigameKind);
    }
  });

  it('T6 passes QuestSchema', () => {
    const result = QuestSchema.safeParse(quest);
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
  });

  it('T7 reads only taught symbols in Discover, and every example holds its symbol', () => {
    const problems: string[] = [];
    for (const word of discoverReading(quest)) {
      const symbols = wordSymbols(word.ko);
      if (symbols === null) problems.push(`${word.ko} is outside the 30 symbols`);
      else for (const id of symbols) if (!taught.has(id)) problems.push(`${word.ko} uses ${id}, not taught yet`);
      if (word.syllables && word.syllables.join('') !== word.romanization) problems.push(`${word.ko}: syllables do not join to ${word.romanization}`);
    }
    for (const step of quest.steps) {
      for (const page of step.discover?.pages ?? []) {
        for (const item of page.items) {
          if (item.type === 'jamo' && !(wordSymbols(item.example.ko) ?? []).includes(item.jamoId)) {
            problems.push(`${item.jamoId}: example ${item.example.ko} does not use it`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('T8 romanizes every Korean word in lower-case Revised Romanization without hyphens', () => {
    const problems: string[] = [];
    for (const text of koTextsOf(quest)) {
      if (!/^[a-z/ ]+$/.test(text.romanization)) problems.push(`${text.ko}: "${text.romanization}" is not lower-case Latin`);
      // A written-symbol option (ㅓ) carries its sound value (eo, g/k), checked with the jamo records.
      if (jamoAll.some((j) => j.char === text.ko)) continue;
      for (const issue of checkRomanization(text.ko, text.romanization, ctx)) problems.push(`${text.ko}: ${issue.message}`);
    }
    expect(problems).toEqual([]);
  });

  it('T9 rewards a card of its own episode, and that episode lists only its own cards', () => {
    const episode = episodesAll.find((e) => e.questIds.includes(quest.id));
    expect(episode).toBeDefined();
    expect(quest.rewardCardId).toBeDefined();
    expect(cardById(quest.rewardCardId!)).toBeDefined();
    expect(episode!.rewardCardIds).toContain(quest.rewardCardId);
    for (const cardId of episode!.rewardCardIds) expect(cardById(cardId)?.unlockedBy, cardId).toBe(episode!.id);
  });

  it('T10 estimates its minutes from its step durations (within one minute)', () => {
    const seconds = quest.steps.reduce((n, s) => n + (s.durationSeconds ?? 0), 0);
    expect(quest.steps.every((s) => s.durationSeconds !== undefined)).toBe(true);
    expect(Math.abs(quest.estimatedMinutes - Math.round(seconds / 60))).toBeLessThanOrEqual(1);
  });

  it('T11 has no Hangul in any English field', () => {
    const found = englishFieldsOf(quest).filter((f) => HANGUL.test(f.text));
    expect(found).toEqual([]);
  });
});

describe('T5 across the bundle', () => {
  it('leaves no entry in minigameScopes unreferenced', () => {
    const referenced = new Set(questsAll.flatMap((q) => q.steps.flatMap((s) => (s.minigameRef ? [s.minigameRef] : []))));
    expect(Object.keys(minigameScopes).filter((ref) => !referenced.has(ref))).toEqual([]);
  });
});

describe('T9 across Stage 1', () => {
  it('makes all 30 Stage 1 cards earnable: quest rewards, episode extras, stage1-complete and first-launch', () => {
    const stage1Episodes = episodesAll.filter((e) => e.stage === 'stage1' && e.placement !== 'shelf');
    const earnable = new Set([
      ...REBUILT.flatMap((q) => (q.rewardCardId ? [q.rewardCardId] : [])),
      ...stage1Episodes.flatMap((e) => e.rewardCardIds),
      'card:hangul-day',
      'card:lantern',
      'card:gayageum',
      'card:tiger',
    ]);
    expect(earnable.size).toBe(30);
  });
});

describe('the sound hints (Appendix A)', () => {
  it('every one of the 30 symbols carries a short English sound hint', () => {
    for (const jamo of jamoAll) {
      expect(jamo.soundHint, jamo.id).toBeTruthy();
      expect(jamo.soundHint!.length, jamo.id).toBeLessThanOrEqual(60);
      expect(HANGUL.test(jamo.soundHint!), jamo.id).toBe(false);
    }
  });

  it('describes the soft stops as soft and light, and the aspirated ones with a puff of air (audit F15)', () => {
    const hint = (char: string, kind = 'consonant'): string => jamoAll.find((j) => j.char === char && j.kind === kind)?.soundHint ?? '';
    for (const ch of ['ㄱ', 'ㄷ', 'ㅂ', 'ㅈ']) expect(hint(ch), ch).toContain('soft, light');
    for (const ch of ['ㅋ', 'ㅌ', 'ㅍ', 'ㅊ']) expect(hint(ch), ch).toContain('puff of air');
    expect(hint('ㅇ')).toContain('silent at the start of a block');
    expect(hint('ㅇ', 'batchim')).toContain('ng');
  });
});

describe('Hoya lines of the rebuilt quests', () => {
  it('every line opens with a capital letter, and every Discover line asks the learner to tap Hear it', () => {
    for (const quest of REBUILT) {
      for (const step of quest.steps) {
        if (step.hoyaLineEn === undefined) continue;
        expect(step.hoyaLineEn, `${quest.id} ${step.id}`).toMatch(/^[A-Z]/);
        if (step.kind === 'discover') expect(step.hoyaLineEn, `${quest.id} ${step.id}`).toContain('Tap Hear it');
      }
    }
  });

  it('the Family at the Table intro promises family words, not names (it teaches 아버지, 아기, 엄마, 가족)', () => {
    const intro = questsAll.find((q) => q.id === 'quest:stage1-life-q2')!.steps.find((s) => s.kind === 'intro')!;
    expect(intro.hoyaLineEn).toContain('family words');
    expect(intro.hoyaLineEn).not.toContain('names');
  });
});

describe('a word read in Discover and asked in a Check is the same KoText', () => {
  it('every Check word that a Discover step also shows has the same romanization, gloss and syllables', () => {
    const discovered = new Map<string, { quest: string; text: KoText }>();
    for (const quest of REBUILT) {
      for (const step of quest.steps) {
        for (const item of step.discover?.pages.flatMap((p) => p.items) ?? []) {
          const text = discoverItemTexts(item)[0];
          if (text !== undefined && !discovered.has(text.ko)) discovered.set(text.ko, { quest: quest.id, text });
        }
      }
    }
    let compared = 0;
    for (const quest of REBUILT) {
      for (const { ref, scope } of scopesOf(quest)) {
        for (const round of scope?.listenPick?.rounds ?? []) {
          if (!round.id.startsWith('lp:word:')) continue;
          for (const text of [round.prompt, ...round.options.flatMap((o) => (o.text ? [o.text] : []))]) {
            const seen = discovered.get(text.ko);
            if (seen === undefined) continue;
            compared += 1;
            const pick = (t: KoText) => ({ ko: t.ko, romanization: t.romanization, en: t.en, syllables: t.syllables });
            expect(pick(text), `${ref} ${text.ko} vs ${seen.quest}`).toEqual(pick(seen.text));
          }
        }
      }
    }
    // The Food & Life Checks ask Discover words (치즈, 자두, 고추, 차, 아버지, 아기, 바나나, ...).
    expect(compared).toBeGreaterThanOrEqual(8);
  });
});
