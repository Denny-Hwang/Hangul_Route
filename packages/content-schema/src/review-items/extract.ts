import { overlayElementKey } from '../localize';
import { normalizeKo } from '../lesson-lint-items';
import type { ThemeKey } from '../schemas/heritage-card';
import type { ReviewItemKind } from './review-item';

/**
 * Review-item extraction (F-CURR-002 §4.2, row CM-10), build time only. Each source gives its
 * occurrences: a piece of taught Korean, where it is taught or asked, and how it is glossed.
 * `./stable-ids.ts` merges the occurrences of all three sources into items with frozen ids.
 *
 *   1. lesson cells (Stages 2-4, 6, 7) and pack levels: every Discover item and every scored
 *      round's answer (`lessonOccurrences`, run by scripts/build-lessons.mjs);
 *   2. Stage 1, hand-written TypeScript: its symbol, syllable and word tables
 *      (`stage1Occurrences`), frozen in `stage1-items.json` with a parity test against the
 *      Stage 1 data (apps/mobile/src/content/__tests__/review-items-stage1.test.ts);
 *   3. stories: the taught words of each story's check rounds (`storyOccurrences`, run by
 *      scripts/build-stories.mjs).
 *
 * Every function is pure over parsed JSON (or the Stage 1 data), lax about shape like the
 * lesson lint: the zod schemas and the lesson rules gate the content, this module only reads it.
 */

export interface KoLine {
  ko: string;
  romanization: string;
  en?: string;
  glossKey?: string;
}

export interface ItemOccurrence {
  kind: ReviewItemKind;
  /**
   * A word asked by a round, outside any sentence context: it becomes a pattern when a Discover
   * page teaches the same Korean as a sentence or a pattern (`stable-ids.ts`), else stays a word.
   */
  loose?: true;
  ko: string;
  romanization: string;
  en?: string;
  glossKey?: string;
  picture?: string;
  reply?: KoLine;
  /** A symbol's jamo id, a realia card's ref: their identity, as no Korean string names them alone. */
  ref?: string;
  /** The content marks a sound change the converter cannot see (`soundChange: true` on a round or its target). */
  soundChange?: true;
  cell: string;
  home: ThemeKey | `pack:${string}`;
  stage: number;
  volume: number;
  source: 'discover' | 'round';
  /** `<file> <path>`: where it was read, for coverage reports and error messages. */
  at: string;
}

/** A symbol of the app (`jamoKnown` of apps/mobile/src/content/jamo.ts): Stage 1's 30 and Word Builder's. */
export interface ReviewSymbol {
  id: string;
  char: string;
  kind: 'consonant' | 'vowel' | 'batchim';
  romanization: string;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);
const HANGUL = /[ᄀ-ᇿㄱ-ㆎ가-힣]/;
const COMPAT_JAMO = /^[ㄱ-ㆎ]$/;
const SENTENCE_END = /[.?!]["'”’)]*$/;

/** The symbols by character, for a bare letter asked in a round: the initial (or vowel) form first, never a final. */
export function symbolsByChar(symbols: readonly ReviewSymbol[]): Map<string, ReviewSymbol> {
  const out = new Map<string, ReviewSymbol>();
  for (const s of symbols) if (s.kind !== 'batchim' && !out.has(s.char)) out.set(s.char, s);
  return out;
}

interface Where {
  cell: string;
  home: ItemOccurrence['home'];
  stage: number;
  volume: number;
}

/** Shared state of one source's walk. */
class Collector {
  readonly out: ItemOccurrence[] = [];
  constructor(
    private readonly where: Where,
    private readonly bySymbol: ReadonlyMap<string, ReviewSymbol>,
    private readonly symbolsById: ReadonlyMap<string, ReviewSymbol>,
  ) {}

  /** A symbol by its jamo id; unknown ids are skipped (the catalogue's `teaches` check names them). */
  symbol(jamoId: string, source: ItemOccurrence['source'], at: string): void {
    const s = this.symbolsById.get(jamoId);
    if (s === undefined) return;
    this.out.push({ kind: 'sym', ko: s.char, romanization: s.romanization, ref: s.id, ...this.where, source, at });
  }

  /**
   * A piece of taught Korean (`{ ko, romanization, en }`). `kind` is what the context says it is;
   * a bare letter becomes its symbol, text with no Hangul (a price figure) is no item.
   */
  text(
    value: unknown,
    kind: ReviewItemKind | 'loose',
    source: ItemOccurrence['source'],
    at: string,
    extra: { glossKey?: string; picture?: string; reply?: KoLine; soundChange?: boolean } = {},
  ): void {
    if (!isRec(value)) return;
    const ko = str(value.ko);
    if (ko === undefined || !HANGUL.test(ko)) return;
    const bare = normalizeKo(ko);
    if (COMPAT_JAMO.test(bare)) {
      const s = this.bySymbol.get(bare);
      if (s !== undefined) this.symbol(s.id, source, at);
      return;
    }
    const resolved: ReviewItemKind = kind !== 'loose' ? kind : SENTENCE_END.test(ko.trim()) ? 'pat' : 'lex';
    const occ: ItemOccurrence = {
      kind: resolved,
      ...(kind === 'loose' && resolved === 'lex' ? { loose: true as const } : {}),
      ko: ko.trim(),
      romanization: str(value.romanization) ?? '',
      ...this.where,
      source,
      at,
    };
    const en = str(value.en);
    if (en !== undefined) occ.en = en;
    if (extra.glossKey !== undefined && en !== undefined) occ.glossKey = extra.glossKey;
    if (extra.picture !== undefined) occ.picture = extra.picture;
    if (extra.reply !== undefined) occ.reply = extra.reply;
    if (extra.soundChange === true || value.soundChange === true) occ.soundChange = true;
    this.out.push(occ);
  }

  /** A realia card's reading skill (kind `rea`), shown by its title or first key word. */
  realia(ref: string, shown: unknown, gloss: { en?: string; glossKey?: string }, source: ItemOccurrence['source'], at: string): void {
    const ko = isRec(shown) ? str(shown.ko) : undefined;
    if (ko === undefined) return;
    const occ: ItemOccurrence = {
      kind: 'rea',
      ko: ko.trim(),
      romanization: (isRec(shown) ? str(shown.romanization) : undefined) ?? '',
      ref,
      ...this.where,
      source,
      at,
    };
    if (gloss.en !== undefined) {
      occ.en = gloss.en;
      if (gloss.glossKey !== undefined) occ.glossKey = gloss.glossKey;
    }
    this.out.push(occ);
  }
}

const lineOf = (value: unknown, glossKey?: string): KoLine | undefined => {
  if (!isRec(value)) return undefined;
  const ko = str(value.ko);
  if (ko === undefined) return undefined;
  const line: KoLine = { ko: ko.trim(), romanization: str(value.romanization) ?? '' };
  const en = str(value.en);
  if (en !== undefined) {
    line.en = en;
    if (glossKey !== undefined) line.glossKey = glossKey;
  }
  return line;
};

const key = (element: unknown, index: number): string => overlayElementKey(element, index);
const pictureOf = (value: unknown): string | undefined => (isRec(value) ? str(value.pictureRef) ?? str(value.picture) : undefined);

// ---- 1. lesson cells and pack levels ------------------------------------------------------------------

export interface LessonSource {
  /** `content/...` path, for messages. */
  file: string;
  /** The parsed cell or pack level file. */
  body: unknown;
  /** The cell's episode id (`episode:stage2-life`, `episode:pack-<key>-s<n>`). */
  cellId: string;
  stage: number;
  home: ItemOccurrence['home'];
  volume: number;
}

/** The game steps whose rounds are scored (F-QUEST-002 §3.1): their scopes' answers are taught items. */
const SCORED_STEPS = new Set(['practice', 'apply', 'check']);

/** The glosses of the Discover items, at their F-I18N-001 overlay fields of the quest entity. */
function discoverItem(c: Collector, item: Rec, questId: string, path: string, at: string): void {
  const k = (field: string): string => `${questId}#${path}.${field}`;
  switch (item.type) {
    case 'jamo':
      if (typeof item.jamoId === 'string') c.symbol(item.jamoId, 'discover', at);
      return;
    case 'word':
      c.text(item.word, 'lex', 'discover', at, { glossKey: k('word.gloss'), picture: str(item.picture) });
      return;
    case 'sentence':
      c.text(item.sentence, 'pat', 'discover', at, { glossKey: k('sentence.gloss'), picture: str(item.picture) });
      return;
    case 'pattern':
      c.text(item.frame, 'pat', 'discover', at, { glossKey: k('frame.gloss') });
      return;
    case 'exchange': {
      const lines = arr(item.lines).filter(isRec);
      const [a, b] = lines;
      const reply = lineOf(b?.line, k(`lines.${key(b, 1)}.line.gloss`));
      if (a !== undefined && reply !== undefined) c.text(a.line, 'exc', 'discover', at, { glossKey: k(`lines.${key(a, 0)}.line.gloss`), reply });
      return;
    }
    case 'realia': {
      const words = arr(item.keyWords);
      words.forEach((w, wi) => c.text(w, 'lex', 'discover', `${at}.keyWords[${wi}]`, { glossKey: k(`keyWords.${key(w, wi)}.gloss`) }));
      if (typeof item.realiaRef === 'string') c.realia(item.realiaRef, words[0], { en: str(item.captionEn), glossKey: k('caption') }, 'discover', at);
      return;
    }
    default:
      // An item kind a later row adds: each of its Korean texts is a word.
      for (const [field, value] of Object.entries(item)) c.text(value, 'lex', 'discover', `${at}.${field}`);
  }
}

/** One authored lesson scope's answers (the shape of `LessonScopeSchema`), glossed at the runtime overlay fields. */
function scopeAnswers(c: Collector, scope: Rec, at: string): void {
  const ref = typeof scope.ref === 'string' ? scope.ref : '';
  const k = (field: string): string => `${ref}#${field}`;
  const rounds = arr(scope.rounds).filter(isRec);
  switch (scope.kind) {
    case 'listen-pick':
      rounds.forEach((round, ri) => {
        const rid = key(round, ri);
        const answer = arr(round.options).filter(isRec).find((o) => o.id === round.answerId);
        const picture = pictureOf(round) ?? pictureOf(answer);
        const where = `${at}.rounds[${ri}]`;
        c.text(round.prompt, 'loose', 'round', where, { glossKey: k(`listenPick.rounds.${rid}.prompt`), picture });
        if (answer !== undefined && isRec(answer.text) && normalizeKo(String(answer.text.ko ?? '')) !== normalizeKo(String(isRec(round.prompt) ? round.prompt.ko ?? '' : ''))) {
          c.text(answer.text, 'loose', 'round', `${where}.answer`, { picture });
        }
      });
      return;
    case 'pic-word-match':
      arr(scope.boards).filter(isRec).forEach((board, bi) => {
        arr(board.pairs).filter(isRec).forEach((pair, pi) => {
          c.text(pair.word, 'loose', 'round', `${at}.boards[${bi}].pairs[${pi}]`, {
            glossKey: k(`picWord.boards.${bi}.pairs.${key(pair, pi)}.word.gloss`),
            picture: pictureOf(pair),
          });
        });
      });
      return;
    case 'build-letter':
      arr(scope.words).forEach((w, wi) => c.text(w, 'loose', 'round', `${at}.words[${wi}]`));
      return;
    case 'card-match':
      arr(scope.pairs).forEach((p, pi) => c.text(p, 'loose', 'round', `${at}.pairs[${pi}]`, { glossKey: k(`cardPairs.${key(p, pi)}.gloss`) }));
      return;
    case 'tap-respond':
      arr(scope.turns).filter(isRec).forEach((turn, ti) => {
        const replies = arr(turn.replies).filter(isRec);
        const ri = replies.findIndex((r) => r.correct === true);
        // The runtime option (`{ ko, romanization, en, isCorrect }`) is keyed by its romanization, else its index.
        const reply = ri < 0 ? undefined : lineOf(replies[ri]?.text, k(`dialogue.${ti}.options.${key(replies[ri]?.text, ri)}.gloss`));
        if (reply !== undefined) c.text(turn.line, 'exc', 'round', `${at}.turns[${ti}]`, { glossKey: k(`dialogue.${ti}.npc`), reply });
      });
      return;
    case 'story-sequence':
      arr(scope.lines).filter(isRec).forEach((line, li) => {
        c.text(line.line, 'pat', 'round', `${at}.lines[${li}]`, { glossKey: k(`storySteps.${key(line, li)}.label`) });
      });
      return;
    case 'order-it':
      rounds.forEach((round, ri) => {
        c.text(round.sentence, 'pat', 'round', `${at}.rounds[${ri}]`, { glossKey: k(`orderIt.rounds.${key(round, ri)}.sentence.gloss`), picture: pictureOf(round) });
      });
      return;
    case 'realia-read': {
      const realia = isRec(scope.realia) ? scope.realia : {};
      const shown = realia.title ?? arr(realia.entries).filter(isRec)[0]?.text;
      if (typeof realia.ref === 'string') {
        c.realia(realia.ref, shown, { en: str(realia.altEn), glossKey: k('realiaRead.realia.alt') }, 'round', `${at}.realia`);
      }
      rounds.forEach((round, ri) => {
        const rid = key(round, ri);
        const where = `${at}.rounds[${ri}]`;
        c.text(round.key, 'loose', 'round', `${where}.key`);
        const answer = arr(round.options).filter(isRec).find((o) => o.id === round.answerId);
        if (answer !== undefined) {
          c.text(answer.text, 'loose', 'round', `${where}.answer`, { glossKey: k(`realiaRead.rounds.${rid}.options.${key(answer, 0)}.text.gloss`) });
        }
      });
      return;
    }
    case 'type-hangul':
      rounds.forEach((round, ri) => {
        c.text(round.target, 'loose', 'round', `${at}.rounds[${ri}]`, {
          glossKey: k(`typeHangul.rounds.${key(round, ri)}.target.gloss`),
          picture: pictureOf(round),
          soundChange: round.soundChange === true,
        });
      });
      return;
    case 'trace-word':
      rounds.forEach((round, ri) => c.text(round.word, 'loose', 'round', `${at}.rounds[${ri}]`, { glossKey: k(`traceWord.rounds.${key(round, ri)}.word.gloss`) }));
      return;
    case 'write-frame':
      rounds.forEach((round, ri) => {
        const rid = key(round, ri);
        const where = `${at}.rounds[${ri}]`;
        c.text(round.frame, 'pat', 'round', where, { glossKey: k(`writeFrame.rounds.${rid}.frame.gloss`) });
        arr(round.slots).filter(isRec).forEach((slot, si) => {
          arr(slot.bank).forEach((w, wi) => {
            c.text(w, 'loose', 'round', `${where}.slots[${si}].bank[${wi}]`, { glossKey: k(`writeFrame.rounds.${rid}.slots.${key(slot, si)}.bank.${key(w, wi)}.gloss`) });
          });
        });
      });
      return;
    default:
      // A scope kind a later row adds: every Korean answer it holds is a word.
      for (const [field, value] of Object.entries(scope)) if (field !== 'ref' && field !== 'kind') walkTexts(c, value, `${at}.${field}`);
  }
}

function walkTexts(c: Collector, value: unknown, at: string): void {
  if (Array.isArray(value)) value.forEach((v, i) => walkTexts(c, v, `${at}[${i}]`));
  else if (isRec(value)) {
    if (typeof value.ko === 'string') c.text(value, 'loose', 'round', at);
    else for (const [field, child] of Object.entries(value)) walkTexts(c, child, `${at}.${field}`);
  }
}

/** Every Discover item and every scored round's answer of one lesson cell or pack level, in file order. */
export function lessonOccurrences(source: LessonSource, symbols: readonly ReviewSymbol[]): ItemOccurrence[] {
  const c = new Collector(
    { cell: source.cellId, home: source.home, stage: source.stage, volume: source.volume },
    symbolsByChar(symbols),
    new Map(symbols.map((s) => [s.id, s])),
  );
  const body = isRec(source.body) ? source.body : {};
  arr(body.quests).filter(isRec).forEach((quest, qi) => {
    const questId = typeof quest.id === 'string' ? quest.id : '';
    const steps = arr(quest.steps).filter(isRec);
    const scopes = arr(quest.scopes).filter(isRec);
    steps.forEach((step, si) => {
      const stepKey = `steps.${key(step, si)}`;
      arr(isRec(step.discover) ? step.discover.pages : []).filter(isRec).forEach((page, pi) => {
        arr(page.items).filter(isRec).forEach((item, ii) => {
          const path = `${stepKey}.discover.pages.${pi}.items.${ii}`;
          discoverItem(c, item, questId, path, `${source.file} quests[${qi}].steps[${si}].discover.pages[${pi}].items[${ii}]`);
        });
      });
      if (!SCORED_STEPS.has(String(step.kind)) || typeof step.minigameRef !== 'string') return;
      const at = scopes.findIndex((s) => s.ref === step.minigameRef);
      if (at >= 0) scopeAnswers(c, scopes[at] as Rec, `${source.file} quests[${qi}].scopes[${at}]`);
    });
  });
  return c.out;
}

// ---- 2. Stage 1 (hand-written TypeScript) ---------------------------------------------------------------

/** The Stage 1 data the extractor reads: the symbol table, the quests, and the game scopes (runtime shape). */
export interface Stage1Data {
  symbols: readonly ReviewSymbol[];
  /** The 15 Stage 1 quests (`quest:stage1-<theme>-q<n>`), with their steps. */
  quests: readonly { id: string; steps: readonly unknown[] }[];
  /** The app's `minigameScopes` (MinigameScope by ref): only the refs of the quests' scored steps are read. */
  scopes: Readonly<Record<string, unknown>>;
}

const STAGE1_QUEST_RE = /^quest:stage1-(letters|life|rites|nature|crafts)-q[0-9]+$/;

/** One Stage 1 game scope (runtime `MinigameScope`): its symbols, its blocks and its words. */
function stage1Scope(c: Collector, ref: string, scope: Rec, at: string): void {
  const k = (field: string): string => `${ref}#${field}`;
  for (const id of arr(scope.jamoIds)) if (typeof id === 'string') c.symbol(id, 'round', `${at}.jamoIds`);
  arr(scope.syllables).filter(isRec).forEach((s, si) => c.text(s, 'syl', 'round', `${at}.syllables[${si}]`));
  arr(scope.cardPairs).forEach((p, pi) => c.text(p, 'lex', 'round', `${at}.cardPairs[${pi}]`, { glossKey: k(`cardPairs.${key(p, pi)}.gloss`) }));
  // Story Sequence cards: set phrases (한복 입기), each with its English label.
  arr(scope.storySteps).filter(isRec).forEach((s, si) => {
    c.text({ ko: s.labelKo, romanization: s.romanization, en: s.labelEn }, 'lex', 'round', `${at}.storySteps[${si}]`, { glossKey: k(`storySteps.${key(s, si)}.label`) });
  });
  arr(isRec(scope.picWord) ? scope.picWord.boards : []).filter(isRec).forEach((board, bi) => {
    arr(board.pairs).filter(isRec).forEach((pair, pi) => {
      c.text(pair.word, 'lex', 'round', `${at}.picWord.boards[${bi}].pairs[${pi}]`, {
        glossKey: k(`picWord.boards.${bi}.pairs.${key(pair, pi)}.word.gloss`),
        picture: pictureOf(pair),
      });
    });
  });
  arr(isRec(scope.listenPick) ? scope.listenPick.rounds : []).filter(isRec).forEach((round, ri) => {
    const id = String(round.id ?? '');
    const where = `${at}.listenPick.rounds[${ri}]`;
    const glossKey = k(`listenPick.rounds.${key(round, ri)}.prompt`);
    const answer = arr(round.options).filter(isRec).find((o) => o.id === round.answerId);
    // The builders name each round by what it asks (scope-builders.ts `lp`): a symbol, a block, a word, a picture.
    if (id.startsWith('lp:sym:')) c.symbol(id.slice('lp:sym:'.length), 'round', where);
    else if (id.startsWith('lp:syl:')) c.text(round.prompt, 'syl', 'round', where, { glossKey });
    else c.text(round.prompt, 'lex', 'round', where, { glossKey, picture: pictureOf(answer) });
  });
}

/**
 * The Stage 1 occurrences: each symbol where a Discover page teaches it, and the symbols,
 * syllable blocks and words of every scored round. Cells are the Stage 1 grid cells
 * (`episode:stage1-<theme>`). Read by the parity test from the live TypeScript; the build reads
 * the frozen copy (`stage1-items.json`).
 */
export function stage1Occurrences(data: Stage1Data): ItemOccurrence[] {
  const out: ItemOccurrence[] = [];
  const bySymbol = symbolsByChar(data.symbols);
  const byId = new Map(data.symbols.map((s) => [s.id, s]));
  for (const quest of data.quests) {
    const theme = STAGE1_QUEST_RE.exec(quest.id)?.[1] as ThemeKey | undefined;
    if (theme === undefined) continue;
    const c = new Collector({ cell: `episode:stage1-${theme}`, home: theme, stage: 1, volume: 1 }, bySymbol, byId);
    quest.steps.filter(isRec).forEach((step, si) => {
      const at = `${quest.id} steps[${si}]`;
      arr(isRec(step.discover) ? step.discover.pages : []).filter(isRec).forEach((page, pi) => {
        arr(page.items).filter(isRec).forEach((item, ii) => {
          if (item.type === 'jamo' && typeof item.jamoId === 'string') c.symbol(item.jamoId, 'discover', `${at}.discover.pages[${pi}].items[${ii}]`);
        });
      });
      if (!SCORED_STEPS.has(String(step.kind)) || typeof step.minigameRef !== 'string') return;
      const scope = data.scopes[step.minigameRef];
      if (isRec(scope)) stage1Scope(c, step.minigameRef, scope, `${at} ${step.minigameRef}`);
    });
    out.push(...c.out);
  }
  return out;
}

// ---- 3. stories --------------------------------------------------------------------------------------

/**
 * The taught words of a story's check rounds: each check's (and checkpoint's) Korean target,
 * and a Korean correct option. A target that is also one of the story's key words is glossed at
 * the key word's overlay field; a correct option at the option's own. The story is its own cell.
 */
export function storyOccurrences(story: unknown, file: string, symbols: readonly ReviewSymbol[]): ItemOccurrence[] {
  if (!isRec(story) || typeof story.id !== 'string') return [];
  const id = story.id;
  const theme = str(story.theme) as ThemeKey | undefined;
  const stage = typeof story.recommendedStage === 'number' ? story.recommendedStage : undefined;
  if (theme === undefined || stage === undefined) return [];
  const c = new Collector({ cell: id, home: theme, stage, volume: 1 }, symbolsByChar(symbols), new Map(symbols.map((s) => [s.id, s])));
  const keywords = new Map(
    arr(story.keywords)
      .filter(isRec)
      .filter((kw) => typeof kw.ko === 'string')
      .map((kw) => [normalizeKo(String(kw.ko)), `${id}#keywords.${key(kw, 0)}.gloss`] as const),
  );
  arr(story.tiers).filter(isRec).forEach((tier, ti) => {
    for (const list of ['checks', 'checkpoints'] as const) {
      arr(tier[list]).filter(isRec).forEach((check, ci) => {
        const at = `${file} tiers[${ti}].${list}[${ci}]`;
        const checkKey = key(check, ci);
        if (isRec(check.target)) {
          c.text(check.target, 'loose', 'round', `${at}.target`, { glossKey: keywords.get(normalizeKo(String(check.target.ko ?? ''))) });
        }
        const correct = arr(check.options).filter(isRec).find((o) => o.isCorrect === true);
        if (correct !== undefined && typeof correct.ko === 'string') {
          c.text(correct, 'loose', 'round', `${at}.answer`, { glossKey: `${id}#checks.${checkKey}.options.${key(correct, 0)}` });
        }
      });
    }
  });
  return c.out;
}
