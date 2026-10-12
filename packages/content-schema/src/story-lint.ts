import { narrationTokenIds, narrationWordCount } from './narration';
import { pillarTagProblems } from './pillars';
import {
  MIN_VERIFICATION_PASSES,
  NARRATION_MAX_WORDS,
  TALE_KINDS,
  type Story,
  type StoryScene,
  type StoryTier,
} from './schemas/story';
import { HANGUL, type StoryCheck } from './schemas/story-check';
import { STORY_CARD_FACT_MAX_CHARS, STORY_CARD_MIN_SOURCES, storyCardId } from './story-card';
import { isAllowlistedHost, isAuthoritativeHost } from './story-sources';

/**
 * Story lint (F-STORY-001 §3.8): the coverage, source, number, tale and review
 * rules that a zod schema cannot express. Pure: no file access. A `draft` may
 * be incomplete, never wrong, so every rule marked "S" in the spec runs for
 * both states; the rules that only make sense once a story is finished
 * (captions, art, explanations, culture notes, unused keywords) run for
 * `ready` stories only. Romanization correctness is F-CNT-002's scan, not here.
 */
export type FindingLevel = 'error' | 'warning';
export interface Finding {
  rule: string;
  level: FindingLevel;
  /** JSON path into the story file, e.g. `tiers[0].scenes[2].factIds`. */
  path: string;
  message: string;
}
export interface LintContext {
  /** ISO date the lint treats as today; default `HANGUL_ROUTE_TODAY`, else the current UTC date. */
  today?: string;
}

type Add = (rule: string, level: FindingLevel, path: string, message: string) => void;
type Segment = string | number;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const EARLIEST_ACCESS = '2026-01-01';
const STALE_AFTER_DAYS = 365;
const MAX_FRAMING_SCENES = 2;
const OPTION_WARN_LENGTH = 70;
const MAX_NARRATION_CHARS = 320;
const CORPUS_FIRST_OPTION_MAX_SHARE = 0.5;

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  million: 1_000_000,
};
const WORD_ALTERNATIVES = Object.keys(NUMBER_WORDS).join('|');
const NUMBER_WORD = new RegExp(`\\b(${WORD_ALTERNATIVES})\\b`, 'gi');
const APPROXIMATION_PHRASE = new RegExp(
  `\\b(?:almost|nearly|about|around|over|more than)\\s+(\\d[\\d,.]*|${WORD_ALTERNATIVES})\\s+years\\b`,
  'gi',
);
const TALE_WORD = /\b(?:tales?|stor(?:y|ies)|legends?|myths?|fables?|folk|songs?)\b/i;
const SCRIPT_NAME = /\bHangeul\b/;
const TOKEN = /\{kw:[a-z0-9-]+\}/g;

// ---- helpers --------------------------------------------------------------------

const at = (...segments: Segment[]): string =>
  segments.reduce<string>((path, s) => {
    if (typeof s === 'number') return `${path}[${s}]`;
    return path === '' ? s : `${path}.${s}`;
  }, '');

const stripTokens = (text: string): string => text.replace(TOKEN, ' ');

/** Numerals of `text` as comparable strings: commas and trailing punctuation removed. */
function numerals(text: string): string[] {
  return Array.from(text.matchAll(/\d[\d,.]*/g), (m) => m[0].replace(/[,.]+$/, '').replace(/,/g, ''));
}

/** The number words of `text`, lower-cased, in order (repeats included). */
function numberWords(text: string): string[] {
  return Array.from(text.matchAll(NUMBER_WORD), (m) => m[1]!.toLowerCase());
}

const hasWord = (text: string, word: string): boolean => new RegExp(`\\b${word}\\b`, 'i').test(text);

function lintToday(ctx: LintContext): string {
  if (ctx.today) return ctx.today;
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.HANGUL_ROUTE_TODAY;
  if (env && ISO_DATE.test(env)) return env;
  return new Date().toISOString().slice(0, 10);
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function parseUrl(url: string): { scheme: string; host: string } | undefined {
  const m = /^([a-z][a-z0-9+.-]*):\/\/(?:[^/?#@]*@)?(\[[^\]]*\]|[^/?#:]+)(?::\d*)?(?:[/?#]|$)/i.exec(url);
  return m ? { scheme: (m[1] as string).toLowerCase(), host: (m[2] as string).toLowerCase() } : undefined;
}

const correctIndex = (check: StoryCheck): number => check.options.findIndex((o) => o.isCorrect);

// ---- facts and sources (C2 unused, C3, C4) ------------------------------------------

function lintFacts(story: Story, today: string, add: Add): void {
  story.facts.forEach((fact, fi) => {
    const hosts: string[] = [];
    fact.sources.forEach((source, si) => {
      const base = at('facts', fi, 'sources', si);
      const parsed = parseUrl(source.url);
      if (parsed) hosts.push(parsed.host);

      const urlProblem = /\s/.test(source.url)
        ? 'the URL must not contain whitespace'
        : !parsed
          ? `the URL does not parse: ${source.url}`
          : parsed.scheme !== 'https'
            ? `the URL must be https, not ${parsed.scheme}`
            : parsed.host === 'localhost'
              ? 'the URL must not point at localhost'
              : undefined;
      if (urlProblem) add('source-url-not-https', 'error', at(base, 'url'), urlProblem);
      else if (parsed && !isAllowlistedHost(parsed.host)) {
        add(
          'source-host-unlisted',
          'warning',
          at(base, 'url'),
          `${parsed.host} is not in SOURCE_HOST_ALLOWLIST (story-sources.ts); adding a host is a reviewed one-line PR`,
        );
      }

      const accessed = source.accessed;
      if (!isRealDate(accessed)) {
        add('source-accessed-invalid', 'error', at(base, 'accessed'), `${accessed} is not a real date`);
      } else if (accessed > today) {
        add('source-accessed-invalid', 'error', at(base, 'accessed'), `${accessed} is in the future (today ${today})`);
      } else if (accessed < EARLIEST_ACCESS) {
        add('source-accessed-invalid', 'error', at(base, 'accessed'), `${accessed} is before ${EARLIEST_ACCESS}`);
      } else if ((Date.parse(today) - Date.parse(accessed)) / DAY_MS > STALE_AFTER_DAYS) {
        add('source-stale', 'warning', at(base, 'accessed'), `accessed ${accessed}, more than ${STALE_AFTER_DAYS} days before ${today}`);
      }
    });

    if (!hosts.some(isAuthoritativeHost)) {
      add(
        'fact-no-authoritative-source',
        'error',
        at('facts', fi, 'sources'),
        `${fact.id} needs a source on an authoritative host (.go.kr, unesco.org, encykorea.aks.ac.kr, itkc.or.kr, snu.ac.kr)`,
      );
    }
    if (/\d/.test(fact.claimEn) && fact.sources.length < 2) {
      add(
        'fact-numeric-single-source',
        'error',
        at('facts', fi, 'sources'),
        `${fact.id} states a number or date and needs at least two sources`,
      );
    }
  });
}

// ---- scenes (C1, C2, C5, tokens) -------------------------------------------------------

function lintNumbers(story: Story, scene: StoryScene, base: string, add: Add): void {
  const text = stripTokens(scene.narrationEn);
  const path = at(base, 'narrationEn');
  const cited = scene.factIds.flatMap((id) => story.facts.filter((f) => f.id === id));
  const claimText = cited.map((f) => f.claimEn).join(' ');
  const claimNumbers = new Set(numerals(claimText));

  scene.approximations.forEach((a, ai) => {
    if (!scene.narrationEn.includes(a.text)) {
      add(
        'approximation-text-missing',
        'error',
        at(base, 'approximations', ai, 'text'),
        `"${a.text}" is not a substring of the narration`,
      );
    }
    if (a.timeRelative) {
      add(
        'approximation-time-relative',
        'warning',
        at(base, 'approximations', ai),
        `"${a.text}" depends on today's date; re-check it every year`,
      );
    }
  });
  // An entry only counts when its text is in the narration; it covers a number only
  // when the scene cites every fact it is derived from.
  const present = scene.approximations.filter((a) => scene.narrationEn.includes(a.text));
  const covering = present.filter((a) => a.factIds.every((id) => scene.factIds.includes(id)));
  const coveringText = covering.map((a) => a.text).join(' ');
  const coveringNumbers = new Set(numerals(coveringText));

  for (const n of new Set(numerals(text))) {
    if (!claimNumbers.has(n) && !coveringNumbers.has(n)) {
      add(
        'narration-number-unsupported',
        'error',
        path,
        `${n} is in no cited fact and no approximation entry covers it`,
      );
    }
  }

  for (const phrase of text.matchAll(APPROXIMATION_PHRASE)) {
    const token = phrase[1] as string;
    const marked = present.some((a) =>
      /\d/.test(token) ? numerals(a.text).includes(numerals(token)[0] as string) : hasWord(a.text, token),
    );
    if (!marked) {
      add(
        'narration-approximation-unmarked',
        'error',
        path,
        `"${phrase[0]}" is an approximation and needs an approximations entry`,
      );
    }
  }

  for (const word of new Set(numberWords(text))) {
    const value = String(NUMBER_WORDS[word]);
    const echoed =
      hasWord(claimText, word) ||
      claimNumbers.has(value) ||
      hasWord(coveringText, word) ||
      coveringNumbers.has(value);
    if (!echoed) {
      add('narration-number-word-unmatched', 'warning', path, `"${word}" is in no cited fact`);
    }
  }
}

function lintScenes(story: Story, add: Add): void {
  const keywordById = new Map(story.keywords.map((k) => [k.id, k]));
  const factIds = new Set(story.facts.map((f) => f.id));
  story.tiers.forEach((tier, ti) => {
    const framing = tier.scenes.filter((s) => s.framing).length;
    if (framing > MAX_FRAMING_SCENES || framing * 4 > tier.scenes.length) {
      add(
        'framing-scene-limit',
        'error',
        at('tiers', ti, 'scenes'),
        `${framing} framing scenes in a tier of ${tier.scenes.length}; at most ${MAX_FRAMING_SCENES} and 25 %`,
      );
    }

    tier.scenes.forEach((scene, si) => {
      const base = at('tiers', ti, 'scenes', si);
      const narration = at(base, 'narrationEn');

      if (narrationWordCount(scene.narrationEn) > NARRATION_MAX_WORDS || scene.narrationEn.length > MAX_NARRATION_CHARS) {
        add(
          'narration-too-long',
          'error',
          narration,
          `more than ${NARRATION_MAX_WORDS} words (a {kw:} token is one word) or ${MAX_NARRATION_CHARS} characters`,
        );
      }
      for (const id of new Set(narrationTokenIds(scene.narrationEn))) {
        if (!keywordById.has(id)) add('narration-token-unknown', 'error', narration, `{kw:${id}} names no keyword`);
      }
      if (/[{}]/.test(stripTokens(scene.narrationEn))) {
        add('narration-brace', 'error', narration, 'a brace outside a {kw:id} token');
      }

      if (!scene.framing && scene.factIds.length === 0) {
        add('scene-without-fact', 'error', at(base, 'factIds'), 'a non-framing scene cites at least one fact');
      }
      scene.factIds.forEach((id, i) => {
        if (!factIds.has(id)) add('fact-unknown', 'error', at(base, 'factIds', i), `${id} is not in facts[]`);
      });
      scene.approximations.forEach((a, ai) =>
        a.factIds.forEach((id, i) => {
          if (!factIds.has(id)) {
            add('fact-unknown', 'error', at(base, 'approximations', ai, 'factIds', i), `${id} is not in facts[]`);
          }
        }),
      );

      if (scene.framing) {
        const text = stripTokens(scene.narrationEn);
        const termToken = narrationTokenIds(scene.narrationEn).some((id) => keywordById.get(id)?.kind === 'term');
        if (/\d/.test(text) || numberWords(text).length > 0 || termToken) {
          add(
            'framing-scene-with-claim',
            'error',
            narration,
            'a framing scene has no digit, no number word and no term token',
          );
        }
      }
      lintNumbers(story, scene, base, add);
    });
  });
}

// ---- checks ----------------------------------------------------------------------------------

function lintChecks(story: Story, add: Add): void {
  const factIds = new Set(story.facts.map((f) => f.id));
  const ready = story.state === 'ready';
  story.tiers.forEach((tier, ti) => {
    const groups = [
      ['checks', tier.checks],
      ['checkpoints', tier.checkpoints],
    ] as const;
    for (const [group, list] of groups) {
      list.forEach((check, ci) => {
        const base = at('tiers', ti, group, ci);
        if (check.factIds.length === 0) {
          add('check-without-fact', 'error', at(base, 'factIds'), 'a check cites at least one fact');
        }
        check.factIds.forEach((id, i) => {
          if (!factIds.has(id)) add('fact-unknown', 'error', at(base, 'factIds', i), `${id} is not in facts[]`);
        });
        check.options.forEach((option, oi) => {
          if (option.en && option.en.length > OPTION_WARN_LENGTH) {
            add(
              'check-option-long',
              'warning',
              at(base, 'options', oi, 'en'),
              `${option.en.length} characters; keep options at ${OPTION_WARN_LENGTH} or fewer`,
            );
          }
        });
        if (ready && !check.explainEn) {
          add('check-explain-missing', 'error', at(base, 'explainEn'), 'a ready story explains every check');
        }
      });
    }
    lintAnswerPositions(tier, ti, add);
  });
}

function lintAnswerPositions(tier: StoryTier, ti: number, add: Add): void {
  if (tier.checks.length < 3) return;
  const positions = tier.checks.map(correctIndex);
  const first = positions[0] as number;
  if (positions.every((p) => p === first)) {
    add(
      'check-answer-position-skew',
      'error',
      at('tiers', ti, 'checks'),
      `the correct option is at index ${first} in every check of this tier`,
    );
  }
}

/** The cards outside the stories that a story card's Korean word must not repeat (F-STORY-006 §3.8). */
export interface CorpusContext {
  cards?: ReadonlyArray<{ id: string; subtitleKo?: string }>;
}

/**
 * The corpus rules over all `ready` stories: at most half the checks have the
 * correct option first, and no two cards (story cards and `ctx.cards`) share
 * a Korean word (`card-korean-duplicate`, F-STORY-006 §3.8).
 */
export function lintStoryCorpus(stories: readonly Story[], ctx: CorpusContext = {}): Finding[] {
  const ready = stories.filter((s) => s.state === 'ready');
  return [...lintAnswerShare(ready), ...lintCardKorean(ready, ctx.cards ?? [])];
}

function lintAnswerShare(ready: readonly Story[]): Finding[] {
  const checks = ready.flatMap((s) => s.tiers.flatMap((t) => t.checks));
  const first = checks.filter((c) => correctIndex(c) === 0).length;
  if (checks.length === 0 || first / checks.length <= CORPUS_FIRST_OPTION_MAX_SHARE) return [];
  return [
    {
      rule: 'corpus-answer-index-0-share',
      level: 'error',
      path: '',
      message: `${first} of ${checks.length} checks have the correct option first (more than 50 %)`,
    },
  ];
}

function lintCardKorean(ready: readonly Story[], cards: NonNullable<CorpusContext['cards']>): Finding[] {
  const owner = new Map<string, string>();
  for (const card of cards) {
    if (card.subtitleKo !== undefined && !owner.has(card.subtitleKo)) owner.set(card.subtitleKo, card.id);
  }
  const findings: Finding[] = [];
  for (const story of ready) {
    const keywordId = story.card?.keywordId;
    const ko = story.keywords.find((k) => k.id === keywordId)?.ko;
    if (ko === undefined) continue; // card-keyword-unknown reports it
    const id = storyCardId(story.id);
    const first = owner.get(ko);
    if (first === undefined) {
      owner.set(ko, id);
      continue;
    }
    if (first === id) continue; // the same story twice is story-id-duplicate, not a second card
    findings.push({
      rule: 'card-korean-duplicate',
      level: 'error',
      path: '',
      message: `${id} repeats ${ko}, the Korean word of ${first}; choose another keyword for its card`,
    });
  }
  return findings;
}

// ---- keywords --------------------------------------------------------------------------------

function lintKeywords(story: Story, add: Add): void {
  const first = new Map<string, number>();
  const phrases = new Map<string, number>();
  story.keywords.forEach((k, i) => {
    if (first.has(k.id)) add('keyword-id-collision', 'error', at('keywords', i, 'id'), `${k.id} is used twice`);
    else first.set(k.id, i);
    if (k.kind === 'phrase' && !phrases.has(k.ko)) phrases.set(k.ko, i);
  });
  const used = new Set<string>();

  story.tiers.forEach((tier, ti) => {
    tier.newKeywordIds.forEach((id) => used.add(id));
    tier.scenes.forEach((scene, si) => {
      const base = at('tiers', ti, 'scenes', si);
      narrationTokenIds(scene.narrationEn).forEach((id) => used.add(id));
      if (scene.keyword) {
        const index = first.get(scene.keyword.id);
        const entry = index === undefined ? undefined : story.keywords[index];
        if (!entry) {
          add('keyword-inconsistent', 'error', at(base, 'keyword', 'id'), `${scene.keyword.id} is not in keywords[]`);
        } else {
          used.add(entry.id);
          if (entry.ko !== scene.keyword.ko) {
            add('keyword-inconsistent', 'error', at(base, 'keyword', 'ko'), `ko differs from keyword ${entry.id}`);
          }
          if (entry.romanization.toLowerCase() !== scene.keyword.romanization.toLowerCase()) {
            add(
              'keyword-inconsistent',
              'error',
              at(base, 'keyword', 'romanization'),
              `romanization differs from keyword ${entry.id} (case is ignored)`,
            );
          }
        }
      }
      if (scene.line) {
        const index = phrases.get(scene.line.ko);
        const phrase = index === undefined ? undefined : story.keywords[index];
        if (phrase) {
          used.add(phrase.id);
          if (phrase.romanization.toLowerCase() !== scene.line.romanization.toLowerCase()) {
            add(
              'keyword-inconsistent',
              'error',
              at(base, 'line', 'romanization'),
              `romanization differs from phrase keyword ${phrase.id} (case is ignored)`,
            );
          }
        }
      }
    });
  });
  if (story.card) used.add(story.card.keywordId);

  if (story.state === 'ready') {
    story.keywords.forEach((k, i) => {
      if (!used.has(k.id)) add('keyword-unused', 'warning', at('keywords', i), `${k.id} is not used by any scene, token or card`);
    });
  }
}

// ---- tale rules (§3.5), facts ---------------------------------------------------------------------

function lintTale(story: Story, add: Add): void {
  const taleKind = (TALE_KINDS as readonly string[]).includes(story.kind);
  const traditional = story.origin.type === 'traditional' || story.origin.type === 'adapted';
  if (taleKind !== traditional) {
    add(
      'tale-kind-origin-mismatch',
      'error',
      'origin.type',
      `kind ${story.kind} and origin ${story.origin.type} disagree: a tale kind is traditional or adapted, and only those are`,
    );
  }
  if (traditional) {
    story.tiers.forEach((tier, ti) => {
      const opening = tier.scenes[0];
      if (opening && !TALE_WORD.test(opening.narrationEn)) {
        add(
          'tale-first-scene-unframed',
          'error',
          at('tiers', ti, 'scenes', 0, 'narrationEn'),
          'the first scene of a traditional story says it is a tale (tale, story, legend, myth, fable, folk, song)',
        );
      }
    });
    if (!story.origin.retellingNoteEn) {
      add(
        'tale-without-retelling-note',
        'error',
        'origin.retellingNoteEn',
        'a traditional story says how it was retold ("shortened and made gentler; versions differ")',
      );
    }
  }
  story.facts.forEach((fact, fi) => {
    if (fact.scope === 'in-the-tale' && /\b\d{4}\b/.test(fact.claimEn)) {
      add(
        'tale-fact-with-date',
        'error',
        at('facts', fi, 'claimEn'),
        'an in-the-tale fact must not carry a year; what a tale says is not history',
      );
    }
  });
  if (taleKind && story.facts.every((f) => f.scope === 'documented')) {
    add(
      'tale-facts-all-documented',
      'warning',
      'facts',
      'a tale story with only documented facts probably states legend as history',
    );
  }
}

// ---- style and glosses ---------------------------------------------------------------------------

/** Learner-facing English prose and the claims shown on the Sources screen. */
function proseFields(story: Story): Array<[string, string | undefined]> {
  const fields: Array<[string, string | undefined]> = [
    ['title.en', story.title.en],
    ['summaryEn', story.summaryEn],
    ['hoyaIntroEn', story.hoyaIntroEn],
    ['hoyaOutroEn', story.hoyaOutroEn],
  ];
  story.tiers.forEach((tier, ti) => {
    tier.scenes.forEach((scene, si) => {
      fields.push([at('tiers', ti, 'scenes', si, 'narrationEn'), scene.narrationEn]);
      fields.push([at('tiers', ti, 'scenes', si, 'captionEn'), scene.captionEn]);
    });
    for (const [group, list] of [
      ['checks', tier.checks],
      ['checkpoints', tier.checkpoints],
    ] as const) {
      list.forEach((check, ci) => {
        const base = at('tiers', ti, group, ci);
        fields.push([at(base, 'promptEn'), check.promptEn]);
        fields.push([at(base, 'explainEn'), check.explainEn]);
        fields.push([at(base, 'hintEn'), check.hintEn]);
        check.options.forEach((o, oi) => fields.push([at(base, 'options', oi, 'en'), o.en]));
      });
    }
  });
  story.cultureNotes.forEach((note, ni) => {
    fields.push([at('cultureNotes', ni, 'titleEn'), note.titleEn]);
    fields.push([at('cultureNotes', ni, 'bodyEn'), note.bodyEn]);
  });
  story.facts.forEach((fact, fi) => fields.push([at('facts', fi, 'claimEn'), fact.claimEn]));
  return fields;
}

/** Every English gloss of a Korean text: Hangul belongs in `ko`, or in a `{kw:}` token. */
function glossFields(story: Story): Array<[string, string]> {
  const fields: Array<[string, string]> = [['title.en', story.title.en]];
  story.keywords.forEach((k, i) => fields.push([at('keywords', i, 'en'), k.en]));
  story.tiers.forEach((tier, ti) => {
    tier.scenes.forEach((scene, si) => {
      const base = at('tiers', ti, 'scenes', si);
      if (scene.keyword) fields.push([at(base, 'keyword', 'en'), scene.keyword.en]);
      if (scene.line) {
        fields.push([at(base, 'line', 'en'), scene.line.en]);
        scene.line.words?.forEach((w, wi) => fields.push([at(base, 'line', 'words', wi, 'en'), w.en]));
      }
    });
    if (tier.connective) fields.push([at('tiers', ti, 'connective', 'en'), tier.connective.en]);
    tier.checks.forEach((c, ci) => {
      if (c.target) fields.push([at('tiers', ti, 'checks', ci, 'target', 'en'), c.target.en]);
    });
    tier.checkpoints.forEach((c, ci) => {
      if (c.target) fields.push([at('tiers', ti, 'checkpoints', ci, 'target', 'en'), c.target.en]);
    });
  });
  story.cultureNotes.forEach((note, ni) => fields.push([at('cultureNotes', ni, 'term', 'en'), note.term.en]));
  return fields;
}

function lintText(story: Story, add: Add): void {
  for (const [path, text] of proseFields(story)) {
    if (text && SCRIPT_NAME.test(text)) {
      add('style-script-name', 'warning', path, 'the product spells the script "Hangul", not "Hangeul"');
    }
  }
  for (const [path, text] of glossFields(story)) {
    if (HANGUL.test(text)) {
      add('gloss-contains-hangul', 'error', path, 'an English gloss has no Hangul; rewrite it or use a {kw:} token');
    }
  }
}

// ---- review, verification, shelf ---------------------------------------------------------------------

function lintGates(story: Story, add: Add): void {
  const { review } = story;
  const reviewed = review.language === 'native-reviewed' || review.culture === 'culture-reviewed';
  if (reviewed && !(review.reviewedBy && review.reviewedAt)) {
    add('review-unsigned', 'error', 'review', 'a reviewed state needs reviewedBy (initials) and reviewedAt');
  }
  if (story.shelf && story.verification.passes < MIN_VERIFICATION_PASSES) {
    add(
      'story-unverified',
      'error',
      'verification.passes',
      `a story with a shelf block needs ${MIN_VERIFICATION_PASSES} verification passes, has ${story.verification.passes}`,
    );
  }
  if (story.shelf && story.shelf.minutes !== story.minutes) {
    add(
      'shelf-minutes-mismatch',
      'error',
      'shelf.minutes',
      `shelf.minutes ${story.shelf.minutes} differs from minutes ${story.minutes}`,
    );
  }
  if (story.state === 'ready') {
    if (story.cultureNotes.length === 0) {
      add('culture-note-missing', 'warning', 'cultureNotes', 'a ready story has at least one culture note');
    }
    story.tiers.forEach((tier, ti) =>
      tier.scenes.forEach((scene, si) => {
        const base = at('tiers', ti, 'scenes', si);
        if (!scene.captionEn) add('caption-missing', 'error', at(base, 'captionEn'), 'a ready scene has a caption');
        if (!scene.art && scene.artPending !== true) {
          add('art-missing', 'error', base, 'a ready scene has art or artPending: true');
        }
      }),
    );
  }
}

// ---- catalogue fields (F-STORY-005 §3.2) ----------------------------------------------------------

function lintPillarTags(story: Story, add: Add): void {
  for (const p of pillarTagProblems(story.pillarTags)) {
    add(
      p.rule,
      'error',
      at('pillarTags', p.index),
      p.rule === 'pillar-tag-unknown' ? `${p.tag} is not in PILLAR_TAGS (pillars.ts)` : `${p.tag} is listed twice`,
    );
  }
}

// ---- copying, designation numbers, shelf reviewers (F-STORY-005 §3.9) ------------------------------

/** A run of this many consecutive words shared with a source excerpt counts as copied. */
export const COPIED_RUN_WORDS = 8;
/**
 * Names and fixed date forms a writer cannot restate: UNESCO register and
 * programme names, the country names in them, and lunar dates ("the fifteenth
 * day of the eighth lunar month"). Matched on the normalized text (lower case,
 * no apostrophes, single spaces). An exempt phrase is dropped from the word
 * stream: its words never count toward a run, but the words on either side of
 * it join up, so a long copy that contains a name still fails.
 */
const COPY_EXEMPT =
  /\b(?:representative list of the intangible cultural heritage of humanity|masterpieces? of the oral and intangible heritage of humanity|(?:the )?government of the republic of korea|democratic peoples republic of korea|republic of korea|memory of the world|lunar new year|(?:the )?[a-z0-9]+ day of the [a-z0-9]+ lunar month)\b/g;
/**
 * Word characters after lower-casing: ASCII letters and digits, Latin-1 and
 * Latin Extended letters, Hangul syllables. Explicit ranges, not `\p{L}`
 * (F-I18N-001 §3.1 keeps Unicode property escapes out of shared code).
 */
const NON_WORD = /[^a-z0-9\u00c0-\u024f\uac00-\ud7a3]+/;
/**
 * Designation numbers left official names in 2021: "National Treasure No. 70",
 * "National Treasure (No. 70)", "National Treasures Nos. 32 and 151",
 * "National Treasure 70" (any case), and the capitalized designations
 * "Treasure No. 1", "Historic Site No. 3", "Natural Monument #53" (case-sensitive,
 * so a folk tale's "treasure number 2" passes).
 */
const DESIGNATION_NUMBER: readonly RegExp[] = [
  /\bnational\s+treasures?(?:\s*[,(]?\s*(?:nos?\.?|numbers?|#)\s*|\s+)\d+/i,
  /\b(?:Treasures?|Historic\s+Sites?|Scenic\s+Sites?|Natural\s+Monuments?|(?:National\s+)?Intangible\s+Cultural\s+Heritage)\s*[,(]?\s*(?:Nos?\.?|Numbers?|#)\s*\d+/,
];

/**
 * Lower-cased word runs of `text`, case- and punctuation-insensitive. A `{kw:}`
 * token ends a run (the learner hears a Korean word there, not the source's
 * words); a name or date of `COPY_EXEMPT` is skipped without ending it.
 */
function wordRuns(text: string): string[][] {
  return text.split(TOKEN).map((part) =>
    part
      .toLowerCase()
      .replace(/['\u2019]/g, '')
      .split(NON_WORD)
      .filter((w) => w !== '')
      .join(' ')
      .replace(COPY_EXEMPT, ' ')
      .split(' ')
      .filter((w) => w !== ''),
  );
}

function wordWindows(text: string): string[] {
  return wordRuns(text).flatMap((words) =>
    words.slice(0, Math.max(0, words.length - COPIED_RUN_WORDS + 1)).map((_, i) =>
      words.slice(i, i + COPIED_RUN_WORDS).join(' '),
    ),
  );
}

/** The learner-facing English prose checked for copying (every prose field, claims included). */
function lintCopying(story: Story, add: Add): void {
  const excerpts = new Map<string, string>();
  story.facts.forEach((fact, fi) =>
    fact.sources.forEach((source, si) => {
      for (const window of wordWindows(source.quoteOrLocator)) {
        if (!excerpts.has(window)) excerpts.set(window, at('facts', fi, 'sources', si, 'quoteOrLocator'));
      }
    }),
  );
  if (excerpts.size === 0) return;
  for (const [path, text] of proseFields(story)) {
    const copied = text === undefined ? undefined : wordWindows(text).find((window) => excerpts.has(window));
    if (copied) {
      add(
        'narration-copies-source',
        'error',
        path,
        `"${copied}" is copied from ${excerpts.get(copied)}; restate the fact in your own words (${COPIED_RUN_WORDS} or more words in a row match)`,
      );
    }
  }
}

/** Every prose field except `claimEn`, which may name a designation as its source does. */
function lintDesignationNumbers(story: Story, add: Add): void {
  for (const [path, text] of proseFields(story)) {
    if (text === undefined || /^facts\[\d+\]\.claimEn$/.test(path)) continue;
    const plain = stripTokens(text);
    const match = DESIGNATION_NUMBER.map((re) => re.exec(plain)).find((m) => m !== null);
    if (match) {
      add(
        'narration-national-treasure-number',
        'error',
        path,
        `text carries a designation number ("${match[0]}"); write the name without the number, e.g. "National Treasure" (numbers stay in source titles)`,
      );
    }
  }
}

function lintShelfReviewers(story: Story, add: Add): void {
  const { review } = story;
  if (story.shelf && !(review.language === 'native-reviewed' && review.culture === 'culture-reviewed')) {
    add(
      'story-shelf-needs-reviewers',
      'error',
      'review',
      `a story with a shelf block needs review.language native-reviewed and review.culture culture-reviewed (has ${review.language} and ${review.culture})`,
    );
  }
}

// ---- entry points -----------------------------------------------------------------------------------------------

function unusedFacts(story: Story, add: Add): void {
  const used = new Set<string>();
  story.tiers.forEach((tier) => {
    tier.scenes.forEach((s) => {
      s.factIds.forEach((id) => used.add(id));
      s.approximations.forEach((a) => a.factIds.forEach((id) => used.add(id)));
    });
    [...tier.checks, ...tier.checkpoints].forEach((c) => c.factIds.forEach((id) => used.add(id)));
  });
  story.cultureNotes.forEach((n) => n.factIds.forEach((id) => used.add(id)));
  if (story.card) used.add(story.card.factId);
  story.facts.forEach((fact, fi) => {
    if (!used.has(fact.id)) add('fact-unused', 'warning', at('facts', fi), `${fact.id} is cited by nothing`);
  });
}

/** The `card` block (F-STORY-006 §3.8): its headword and fact resolve, the fact fits the back face, the listen reward is the card. */
function lintCard(story: Story, add: Add): void {
  const { card } = story;
  if (!card) return;
  if (!story.keywords.some((k) => k.id === card.keywordId)) {
    add('card-keyword-unknown', 'error', 'card.keywordId', `${card.keywordId} is not in keywords[]`);
  }
  const fi = story.facts.findIndex((f) => f.id === card.factId);
  const fact = story.facts[fi];
  if (!fact) {
    add('card-fact-unknown', 'error', 'card.factId', `${card.factId} is not in facts[]`);
  } else {
    if (fact.claimEn.length > STORY_CARD_FACT_MAX_CHARS) {
      add(
        'card-fact-too-long',
        'error',
        at('facts', fi, 'claimEn'),
        `${fact.id} is the card fact and has ${fact.claimEn.length} characters (at most ${STORY_CARD_FACT_MAX_CHARS}); choose a shorter fact`,
      );
    }
    if (fact.sources.length < STORY_CARD_MIN_SOURCES) {
      add(
        'card-fact-single-source',
        'error',
        at('facts', fi, 'sources'),
        `${fact.id} is the card fact and needs at least ${STORY_CARD_MIN_SOURCES} sources (has ${fact.sources.length})`,
      );
    }
  }
  const expected = storyCardId(story.id);
  const listen = story.rewardCardIds?.listen;
  if (listen !== expected) {
    add(
      'card-reward-mismatch',
      'error',
      'rewardCardIds.listen',
      `a story with a card block rewards its own card: rewardCardIds.listen must be ${expected} (has ${listen ?? 'none'})`,
    );
  }
}

function lintCultureNotes(story: Story, add: Add): void {
  const factIds = new Set(story.facts.map((f) => f.id));
  story.cultureNotes.forEach((note, ni) =>
    note.factIds.forEach((id, i) => {
      if (!factIds.has(id)) add('fact-unknown', 'error', at('cultureNotes', ni, 'factIds', i), `${id} is not in facts[]`);
    }),
  );
}

/** All findings for one story; `error` findings fail CI, `warning` findings are printed. */
export function lintStory(story: Story, ctx: LintContext = {}): Finding[] {
  const findings: Finding[] = [];
  const add: Add = (rule, level, path, message) => findings.push({ rule, level, path, message });
  lintFacts(story, lintToday(ctx), add);
  lintScenes(story, add);
  lintChecks(story, add);
  lintCultureNotes(story, add);
  unusedFacts(story, add);
  lintKeywords(story, add);
  lintTale(story, add);
  lintText(story, add);
  lintGates(story, add);
  lintPillarTags(story, add);
  lintCopying(story, add);
  lintDesignationNumbers(story, add);
  lintShelfReviewers(story, add);
  lintCard(story, add);
  return findings;
}
