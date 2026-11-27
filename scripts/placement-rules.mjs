// F-PLC-001 §3.4 — validator rules for content/placement/** (PR P-4). Pure functions
// over already-parsed JSON, called by
// scripts/validate-content.mjs (plain Node, no zod). The tables below mirror
// packages/content-schema/src/schemas/placement.ts (PLACEMENT_FORMATS and friends);
// a content-schema test compares them, so the two cannot drift.
//
// The semantic rules that need the converter or the picture art (romanization against
// the Revised Romanization converter, per-strand counts, symbol coverage, `card:` art)
// live in packages/content-schema/src/__tests__/placement-bank.test.ts.
//
// AMENDMENTS-PLC-VALIDITY §3.4 (row PV-3) adds the item-validity lint below `checkPlacementTree`
// (`lintPlacementTree`, `checkPlacementLint`): it measures whether an item tests what its gate says
// (sentence pictures that make the predicate decide, replies that cannot be matched by echo, heard words that
// are everyday words, balanced and ear-safe decoding options). A finding is a { rule, templateId } pair; the pairs
// that fail today are listed in scripts/placement-lint-baseline.json, which only shrinks.
//
// The Spanish and Korean overlays (content/i18n/<locale>/placement.json) are checked by
// the shared overlay rules (scripts/overlay-rules.mjs, F-I18N-001 §3.7): the `pitem:`
// row of OVERLAY_FIELDS allows `gloss` and `options.<optionId>.gloss` only.

/** gate -> form -> formats the gate may use. */
const FORMATS = {
  recog: { decode: ["shape-odd-one-out"] },
  "sound-basic": { decode: ["hear-pick-written", "see-pick-sound"] },
  "sound-rest": { decode: ["hear-pick-written", "see-pick-sound"] },
  "syl-cv": { decode: ["hear-pick-written", "see-pick-sound", "build-syllable"] },
  "syl-cvc": { decode: ["hear-pick-written", "see-pick-sound", "build-syllable"] },
  vocab: { oral: ["hear-pick-picture"], read: ["read-pick-picture"] },
  sentence: { oral: ["hear-pick-picture"], read: ["read-pick-picture", "reply-pick"] },
};
const STRAND_OF_GATE = {
  recog: "hangul-recognition",
  "sound-basic": "sound-letter",
  "sound-rest": "sound-letter",
  "syl-cv": "syllable-reading",
  "syl-cvc": "syllable-reading",
  vocab: "vocabulary",
  sentence: "sentences",
};
const AUDIO_FORMATS = ["hear-pick-written", "build-syllable", "hear-pick-picture", "reply-pick"];
const NO_LEAK_FORMATS = ["shape-odd-one-out", "hear-pick-picture"];

export const PLACEMENT_RULES = Object.freeze({
  formats: FORMATS,
  strandOfGate: STRAND_OF_GATE,
  audioFormats: AUDIO_FORMATS,
  noLeakFormats: NO_LEAK_FORMATS,
});

const PLACEMENT_DIR = "content/placement/";
const TEMPLATE_ID = /^pitem:[a-z0-9-]+$/;
const REVIEW_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const isStrandFile = (rel) => rel.startsWith(PLACEMENT_DIR) && rel.endsWith(".json") && rel !== `${PLACEMENT_DIR}index.json`;

function checkTemplate(t, at, file, out, seen) {
  const add = (rule, message) => out.push({ file, path: at, rule: `${rule}: ${message}` });
  const q = t.question;
  if (!isObject(q) || !Array.isArray(q.options) || !isObject(q.requires) || !Array.isArray(q.tags)) {
    add("placement-bad-shape", "a template needs a question with options, tags and requires");
    return;
  }
  if (typeof t.id !== "string" || !TEMPLATE_ID.test(t.id)) {
    add("placement-id", `id must match pitem:[a-z0-9-]+ (got ${JSON.stringify(t.id)})`);
  } else if (seen.has(t.id)) {
    add("placement-id", `duplicate template id ${t.id}`);
  } else {
    seen.add(t.id);
  }

  if (t.status !== "draft" && t.status !== "ready") add("placement-status", "status must be draft or ready");

  const forms = FORMATS[t.gate];
  if (forms === undefined) {
    add("placement-gate", `unknown gate ${JSON.stringify(t.gate)}`);
  } else {
    if (t.strand !== STRAND_OF_GATE[t.gate]) add("placement-gate", `strand must be ${STRAND_OF_GATE[t.gate]} for gate ${t.gate}`);
    const formats = forms[t.form];
    if (formats === undefined) add("placement-gate", `form ${t.form} is not used by gate ${t.gate}`);
    else if (!formats.includes(q.format)) add("placement-gate", `format ${q.format} is not used by gate ${t.gate} (${t.form})`);
  }

  if (q.leaks !== !NO_LEAK_FORMATS.includes(q.format)) add("placement-leaks", `leaks must be ${!NO_LEAK_FORMATS.includes(q.format)} for ${q.format}`);
  if (q.requires.audio !== AUDIO_FORMATS.includes(q.format)) add("placement-audio", `requires.audio must be ${AUDIO_FORMATS.includes(q.format)} for ${q.format}`);

  const wanted = q.format === "reply-pick" ? [3, 4] : [4];
  if (!wanted.includes(q.options.length)) add("placement-options", `${q.format} needs ${wanted.join(" or ")} options, has ${q.options.length}`);
  if (q.options.filter((o) => isObject(o) && o.isCorrect === true).length !== 1) add("placement-options", "exactly one option must be correct");

  if (t.reviewedBy !== undefined && (typeof t.reviewedBy !== "string" || t.reviewedBy.trim() === "" || t.reviewedBy.length > 16)) {
    add("placement-review", "reviewedBy must be a non-empty string of at most 16 characters");
  }
  if (t.reviewedAt !== undefined && (typeof t.reviewedAt !== "string" || !REVIEW_DATE.test(t.reviewedAt))) {
    add("placement-review", "reviewedAt must be a YYYY-MM-DD date");
  }
  if (t.status === "ready" && t.strand === "sentences" && (t.reviewedBy === undefined || t.reviewedAt === undefined)) {
    add("placement-sentence-ready", "a ready sentence needs its language review record (reviewedBy and reviewedAt); keep it draft until then");
  }
}

function checkStrandFile(rel, body, out, seen) {
  if (!isObject(body) || typeof body.strand !== "string" || !Array.isArray(body.templates)) {
    out.push({ file: rel, path: "(root)", rule: "placement-bad-shape: a bank file is { strand, templates[] }" });
    return;
  }
  body.templates.forEach((t, i) => {
    if (!isObject(t)) {
      out.push({ file: rel, path: `templates.${i}`, rule: "placement-bad-shape: a template must be an object" });
      return;
    }
    checkTemplate(t, `templates.${i}`, rel, out, seen);
  });
}

/** The file `index.json` names in `families` (AMENDMENTS-PLC-VALIDITY S5), or undefined. It is data of the lint, not a strand file. */
function familiesRelOf(tree) {
  const index = tree.get(`${PLACEMENT_DIR}index.json`);
  return isObject(index) && typeof index.families === "string" ? PLACEMENT_DIR + index.families : undefined;
}

function checkIndex(tree, strandFiles, ids, out) {
  const rel = `${PLACEMENT_DIR}index.json`;
  const add = (message) => out.push({ file: rel, path: "(root)", rule: `placement-index: ${message}` });
  if (!tree.has(rel)) {
    add("content/placement/ needs an index.json ({ version, warmup, files })");
    return;
  }
  const index = tree.get(rel);
  if (!isObject(index)) return add("index.json must hold one JSON object");
  if (!Number.isInteger(index.version) || index.version < 1) return add("version must be a positive integer");
  if (!Array.isArray(index.files) || index.files.length === 0) return add("files must be a non-empty list");
  if (typeof index.warmup !== "string" || !ids.has(index.warmup)) return add(`warmup ${JSON.stringify(index.warmup)} is not a template of any bank file`);
  for (const name of index.files) {
    if (!tree.has(PLACEMENT_DIR + name)) return add(`${name} is listed in files but missing`);
  }
  if (index.families !== undefined) {
    if (typeof index.families !== "string" || !index.families.endsWith(".json") || index.families.includes("/")) {
      return add("families must be the name of a .json file in content/placement/");
    }
    if (!tree.has(PLACEMENT_DIR + index.families)) return add(`${index.families} is named in families but missing`);
    if (index.files.includes(index.families)) return add(`${index.families} is a families file, not a strand file: it does not belong in files`);
  }
  for (const rel2 of strandFiles) {
    if (!index.files.includes(rel2.slice(PLACEMENT_DIR.length))) return add(`${rel2.slice(PLACEMENT_DIR.length)} is not listed in files`);
  }
}

/**
 * tree: Map<relative path with "/", parsed JSON> of every content file.
 * Returns [{ file, path, rule }] with rule "<name>: <message>".
 */
export function checkPlacementTree(tree) {
  const out = [];
  const familiesRel = familiesRelOf(tree);
  const strandFiles = [...tree.keys()].filter((rel) => isStrandFile(rel) && rel !== familiesRel).sort();
  if (strandFiles.length === 0 && !tree.has(`${PLACEMENT_DIR}index.json`)) return out;

  const seen = new Set();
  for (const rel of strandFiles) checkStrandFile(rel, tree.get(rel), out, seen);
  checkIndex(tree, strandFiles, seen, out);

  return out;
}

// ---------------------------------------------------------------------------------------------------------
// The item-validity lint (AMENDMENTS-PLC-VALIDITY §3.4, row PV-3).
//
// `lintPlacementTree(tree, { nikl })` returns every finding as { rule, templateId, file, path, message }.
// `checkPlacementLint(tree, { nikl, baseline })` applies the shrinking baseline and returns violations in the
// shape of `checkPlacementTree`. Rules about the bank as a whole (family counts, pools, the read share) report
// under a `bank:`, `pool:` or `picture:` id instead of a template id; the baseline lists them the same way.
// ---------------------------------------------------------------------------------------------------------

/** Words a reply may repeat from its line without that counting as an echo (S6). */
export const ECHO_STOP = Object.freeze(["네", "아니요", "저", "저는", "저도", "이거"]);
/** The particles dropped from a one-syllable word before two words are compared (S6). */
export const ECHO_PARTICLES = Object.freeze(["이", "가", "을", "를", "은", "는", "도"]);
/** Picturable homonyms: a heard word on this list has two pictures (W3). Grows by review. */
export const HOMONYMS = Object.freeze(["눈", "배", "차", "다리", "밤"]);
/** Pictures of people that look alike at tile size: at most one per item (W3). */
export const PERSON_PICTURES = Object.freeze([
  "word:family-mom",
  "word:family-dad",
  "word:family-grandma",
  "word:family-grandpa",
  "word:family-baby",
  "word:family-dongsaeng",
  "word:school-teacher",
  "word:school-friend",
]);
/** Pictures that show letters: a read item never offers one (W4). */
export const TEXT_PICTURES = Object.freeze(["card:hangul-day", "word:culture-hangul"]);
/**
 * Pairs a learner cannot tell apart by ear in a lone clip (AMENDMENTS-STAGE1-DECODING-CHECK §3.4 with DC-2b's stricter
 * rules, AMENDMENTS-PLC-VALIDITY D2). The list is `EAR_RULED_OUT` of packages/content-schema/src/hangul/ear-contrasts.ts
 * (row PV-6), mirrored here for the plain-Node lint; a content-schema test compares the two.
 */
export const EAR_RULED_OUT = Object.freeze({
  /** Initials, plain against aspirated (WO-16): never by ear in the level check; they stay in its seen items. */
  plainAspirated: Object.freeze(["ㄱㅋ", "ㄷㅌ", "ㅂㅍ", "ㅈㅊ"]),
  /** Initials: a weak [h] in a lone clip. */
  weakH: Object.freeze(["ㅇㅎ"]),
  /** Initials held back until the owner's listening pass: ㄴ-ㄷ, ㅁ-ㅂ, and DC-2b's ㄴ-ㄹ and ㄷ-ㄹ (a lone ㄹ is a flap). */
  heldForListening: Object.freeze(["ㄴㄷ", "ㅁㅂ", "ㄴㄹ", "ㄷㄹ"]),
  /** ㅅ against ㅈ or ㅊ is ruled out when either syllable's vowel is in `sibilantVowels` (ㅅ is [ɕ] there). */
  sibilants: Object.freeze(["ㅅㅈ", "ㅅㅊ"]),
  sibilantVowels: "ㅣㅑㅕㅛㅠ",
  /** ㅅ, ㅈ and ㅊ never meet ㅑ ㅕ ㅛ ㅠ (져 sounds as 저, 셔 as 서), as target or option. */
  noYVowel: "ㅅㅈㅊ",
  yVowels: "ㅑㅕㅛㅠ",
  vowels: Object.freeze(["ㅓㅗ", "ㅡㅜ", "ㅕㅛ"]),
  /** A y-vowel against its plain vowel when either syllable starts with ㅎ (the glide is only the [ç] of the h). */
  glideAfterH: Object.freeze(["ㅏㅑ", "ㅓㅕ", "ㅗㅛ", "ㅜㅠ"]),
  /** Finals of one sound class are never offered together: stops, nasals, the liquid. */
  finalClasses: Object.freeze(["ㄱㅂ", "ㄴㅁㅇ", "ㄹ"]),
});

/** What the bank must hold: ready templates per pool, families, predicates and shares (S5, S7, W4, W5). */
export const PLACEMENT_LINT_MINIMA = Object.freeze({
  sentenceReadPicture: 24,
  sentenceReply: 6,
  sentenceOralPicture: 24,
  vocabOral: 24,
  vocabRead: 18,
  families: 10,
  predicates: 5,
  maxPredicateShare: 0.4,
  readShareNumerator: 2,
  readShareDenominator: 3,
});

const INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const MEDIALS = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const FINALS = [..." ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

/** A Hangul syllable as { initial, medial, final } (final "" for none), or null. */
function decompose(ch) {
  const n = typeof ch === "string" && ch.length === 1 ? ch.charCodeAt(0) - 0xac00 : -1;
  if (n < 0 || n >= 11172) return null;
  return { initial: INITIALS[Math.floor(n / 588)], medial: MEDIALS[Math.floor((n % 588) / 28)], final: FINALS[n % 28].trim() };
}

/** A lone jamo as the sound it stands for in a heard item: a consonant before ㅏ, a vowel after ㅇ. */
function letterParts(ch) {
  if (typeof ch !== "string" || ch.length !== 1) return null;
  if (INITIALS.includes(ch)) return { initial: ch, medial: "ㅏ", final: "" };
  if (MEDIALS.includes(ch)) return { initial: "ㅇ", medial: ch, final: "" };
  return null;
}

const partsOfKo = (ko) => decompose(ko) ?? letterParts(ko);

const ROMAN_PARTS = /^(kk|tt|pp|ss|jj|ch|g|n|d|r|m|b|s|j|k|t|p|h)?(wae|yae|yeo|wa|wo|we|wi|ya|ye|yo|yu|eo|eu|ui|oe|ae|a|e|o|u|i)(ng|k|n|t|l|m|p)?$/;

/** A Latin chip of one syllable (gak, deol, eo) as { initial, medial, final } in letters of the romanization, or null. */
export function chipParts(chip) {
  const m = typeof chip === "string" ? ROMAN_PARTS.exec(chip) : null;
  return m === null ? null : { initial: m[1] ?? "", medial: m[2], final: m[3] ?? "" };
}

const asObject = (v) => (isObject(v) ? v : {});
const tagsOf = (t) => (Array.isArray(asObject(t.question).tags) ? t.question.tags.filter((x) => typeof x === "string") : []);
const tagValue = (t, prefix) => tagsOf(t).find((x) => x.startsWith(prefix))?.slice(prefix.length);
const optionsOf = (t) => (Array.isArray(asObject(t.question).options) ? t.question.options.filter(isObject) : []);
const correctOption = (t) => optionsOf(t).find((o) => o.isCorrect === true);
const promptKoOf = (t) => {
  const q = asObject(t.question);
  const v = asObject(q.prompt).ko ?? asObject(q.spoken).ko;
  return typeof v === "string" ? v : undefined;
};
const pictureOf = (o) => (typeof o.pictureRef === "string" ? o.pictureRef : "");
const hangulOnly = (s) => s.replace(/[^가-힣]/g, "");

/** `scripts/nikl-vocab-2003.json` as lookups: the entry of a rank, and the grade-A words (for `freq-coverage`). */
export function niklIndex(json) {
  const byRank = new Map();
  const gradeA = new Set();
  const rows = isObject(json) && Array.isArray(json.entries) ? json.entries : [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const [rank, word, , , , grade] = row;
    if (typeof word !== "string" || typeof grade !== "string") continue;
    if (Number.isInteger(rank)) byRank.set(rank, { word, grade });
    const hangul = /[가-힣]+/.exec(word)?.[0];
    if (grade === "A" && hangul !== undefined) gradeA.add(hangul);
  }
  return { byRank, gradeA };
}

/** Every `ko` string of the Stage 2 lesson cells: the words Stage 2 teaches, matched as whole strings (W1). */
function stage2Words(tree) {
  const words = new Set();
  const visit = (v) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (isObject(v)) {
      for (const [k, x] of Object.entries(v)) {
        if (k === "ko" && typeof x === "string") words.add(x);
        else visit(x);
      }
    }
  };
  for (const [rel, body] of tree) if (/^content\/episodes\/stage-2\/[^/]+\.json$/.test(rel)) visit(body);
  return words;
}

// S1: the four pictures of a sentence item are `word:act-<predicate>-<noun>`.
const ACT_KEY = /^word:act-([a-z0-9]+)-([a-z0-9]+)$/;
const SENTENCE_PICTURE_FORMATS = ["read-pick-picture", "hear-pick-picture"];

function sentenceOptionsProblem(t) {
  const options = optionsOf(t);
  if (options.length !== 4) return `needs four options, has ${options.length}`;
  const keys = options.map((o) => ACT_KEY.exec(pictureOf(o)));
  const bad = options.filter((_, i) => keys[i] === null).map((o) => pictureOf(o) || "(no picture)");
  if (bad.length > 0) return `every option must be a word:act-<predicate>-<noun> picture of three hyphen-separated parts (not ${bad.join(", ")})`;
  const parsed = options.map((o, i) => ({ correct: o.isCorrect === true, predicate: keys[i][1], noun: keys[i][2] }));
  const right = parsed.find((p) => p.correct);
  if (right === undefined) return "no correct option";
  const same = parsed.filter((p) => !p.correct && p.noun === right.noun);
  const other = parsed.filter((p) => !p.correct && p.noun !== right.noun);
  if (same.length !== 2 || other.length !== 1) return `the right picture and exactly two others must share the noun ${right.noun}, and the fourth must have another noun`;
  const predicates = new Set([right.predicate, ...same.map((p) => p.predicate)]);
  if (predicates.size !== 3) return `the three ${right.noun} pictures must show three different predicates`;
  if (predicates.has(other[0].predicate)) return `the fourth picture's predicate ${other[0].predicate} must be none of the ${right.noun} predicates`;
  return undefined;
}

/**
 * S6: the right reply may not be the only reply that repeats a word of the line. Two words match when their first
 * two syllables are equal; a one-syllable word matches when it is equal after removing one particle.
 */
export function wordsOfSentence(text) {
  return String(text)
    .split(/\s+/)
    .map(hangulOnly)
    .filter((w) => w !== "" && !ECHO_STOP.includes(w));
}
const dropParticle = (w) => {
  const p = ECHO_PARTICLES.find((x) => [...w].length > 1 && w.endsWith(x));
  return p === undefined ? w : w.slice(0, -p.length);
};
export function wordsMatch(a, b) {
  if ([...a].length === 1 || [...b].length === 1) return dropParticle(a) === dropParticle(b);
  return [...a].slice(0, 2).join("") === [...b].slice(0, 2).join("");
}
export function repeatsLine(line, reply) {
  const lineWords = wordsOfSentence(line);
  return wordsOfSentence(reply).some((w) => lineWords.some((l) => wordsMatch(w, l)));
}

// D1 and D2: decoding options, compared by position. A `build-syllable` item is a heard item too: the level check
// draws it as four written blocks under the heard prompt ("Tap the block you hear"), so it follows both rules (PV-6).
const DECODE_BALANCED_FORMATS = ["hear-pick-written", "see-pick-sound", "build-syllable"];
const HEARD_WRITTEN_FORMATS = ["hear-pick-written", "build-syllable"];
const POSITIONS = ["initial", "medial", "final"];
const distance = (a, b) => POSITIONS.filter((p) => a[p] !== b[p]).length;

function decodeBalancedProblem(t) {
  const options = optionsOf(t);
  const parts = options.map((o) => (t.question.format === "see-pick-sound" ? chipParts(o.sound) : partsOfKo(o.ko)));
  if (options.length !== 4 || parts.some((p) => p === null)) return "needs four options that read as one syllable each";
  if (new Set(parts.map((p) => POSITIONS.map((k) => p[k]).join("|"))).size !== 4) return "the four options must be different syllables";
  if (t.gate === "syl-cv") {
    const initials = new Set(parts.map((p) => p.initial));
    const medials = new Set(parts.map((p) => p.medial));
    return initials.size === 2 && medials.size === 2 ? undefined : "an open item offers {CV, C'V, CV', C'V'}: two initials and two vowels, all four pairs";
  }
  if (parts.some((p) => p.final === "")) return "a closed item has no option without a final";
  for (let i = 0; i < 4; i += 1) {
    for (let j = i + 1; j < 4; j += 1) {
      if (distance(parts[i], parts[j]) !== 2) return "a closed item offers {CVF, C'V'F, C'VF', CV'F'}: every pair of options differs in exactly two positions";
    }
  }
  return undefined;
}

const inPairs = (pairs, a, b) => pairs.some((p) => p.includes(a) && p.includes(b));

function earProblem(target, option) {
  if (target.initial !== option.initial) {
    const initialPairs = [...EAR_RULED_OUT.plainAspirated, ...EAR_RULED_OUT.weakH, ...EAR_RULED_OUT.heldForListening];
    if (inPairs(initialPairs, target.initial, option.initial)) return `${target.initial} and ${option.initial} are not told apart by ear`;
    if (inPairs(EAR_RULED_OUT.sibilants, target.initial, option.initial) && [target.medial, option.medial].some((v) => EAR_RULED_OUT.sibilantVowels.includes(v))) {
      return `${target.initial} and ${option.initial} before ㅣ or a y-vowel sound alike`;
    }
  }
  if (target.medial !== option.medial) {
    if (inPairs(EAR_RULED_OUT.vowels, target.medial, option.medial)) return `${target.medial} and ${option.medial} are not told apart by ear`;
    if ((target.initial === "ㅎ" || option.initial === "ㅎ") && inPairs(EAR_RULED_OUT.glideAfterH, target.medial, option.medial)) {
      return `${target.medial} and ${option.medial} after ㅎ are told apart only by the h`;
    }
  }
  if (target.final !== "" && option.final !== "" && target.final !== option.final && EAR_RULED_OUT.finalClasses.some((c) => c.includes(target.final) && c.includes(option.final))) {
    return `the finals ${target.final} and ${option.final} are of one sound class`;
  }
  for (const p of [target, option]) {
    if (EAR_RULED_OUT.noYVowel.includes(p.initial) && EAR_RULED_OUT.yVowels.includes(p.medial)) return `${p.initial} with ${p.medial} sounds as without the y`;
  }
  return undefined;
}

function decodeEarProblem(t) {
  const target = partsOfKo(correctOption(t)?.ko);
  if (target === null) return undefined;
  for (const o of optionsOf(t)) {
    if (o.isCorrect === true) continue;
    const parts = partsOfKo(o.ko);
    const problem = parts === null ? undefined : earProblem(target, parts);
    if (problem !== undefined) return `option ${o.ko}: ${problem}`;
  }
  return undefined;
}

/** The families file as { rel, rows }, or null. A row is { noun: { ko, romanization, slug }, predicates: [{ ko, slug } x 3] } (S5). */
function readFamilies(tree) {
  const rel = familiesRelOf(tree);
  const body = rel === undefined ? undefined : tree.get(rel);
  if (!isObject(body) || !Array.isArray(body.families)) return null;
  return { rel, rows: body.families };
}
const SLUG = /^[a-z0-9]+$/;

function familyProblem(row) {
  if (!isObject(row) || !isObject(row.noun) || !Array.isArray(row.predicates)) return "a family row is { noun: { ko, romanization, slug }, predicates: [three] }";
  const { noun, predicates } = row;
  if (typeof noun.ko !== "string" || typeof noun.romanization !== "string" || !SLUG.test(noun.romanization) || typeof noun.slug !== "string" || !SLUG.test(noun.slug)) {
    return "a noun needs ko, a hyphen-free romanization (the templates' word: tag) and a hyphen-free slug";
  }
  if (predicates.length !== 3) return `${noun.slug} has ${predicates.length} predicates, not three`;
  if (predicates.some((p) => !isObject(p) || typeof p.ko !== "string" || typeof p.slug !== "string" || !SLUG.test(p.slug))) return `${noun.slug} has a predicate without ko and a hyphen-free slug`;
  if (new Set(predicates.map((p) => p.slug)).size !== 3) return `${noun.slug} repeats a predicate`;
  return undefined;
}

/** All templates of the bank with their place, in file order. */
function templatesOf(tree) {
  const familiesRel = familiesRelOf(tree);
  const out = [];
  for (const rel of [...tree.keys()].filter((r) => isStrandFile(r) && r !== familiesRel).sort()) {
    const body = tree.get(rel);
    if (!isObject(body) || !Array.isArray(body.templates)) continue;
    body.templates.forEach((t, i) => {
      if (isObject(t) && typeof t.id === "string" && isObject(t.question)) out.push({ t, file: rel, path: `templates.${i}` });
    });
  }
  return out;
}

function lintFamilies({ rel, rows }, sentencePictures, add, addT) {
  const m = PLACEMENT_LINT_MINIMA;
  const pictures = new Map(); // picture key -> { family, predicate }
  let valid = 0;
  rows.forEach((row, i) => {
    const problem = familyProblem(row);
    if (problem !== undefined) return add("placement-sentence-family", `family:${i}`, problem, rel, `families.${i}`);
    valid += 1;
    for (const p of row.predicates) pictures.set(`word:act-${p.slug}-${row.noun.slug}`, { family: row, predicate: p.slug });
  });
  if (valid < m.families) add("placement-sentence-family", "bank:families", `${valid} families, at least ${m.families} needed`, rel);
  const predicates = new Set([...pictures.values()].map((v) => v.predicate));
  if (predicates.size < m.predicates) add("placement-sentence-family", "bank:predicates", `${predicates.size} predicates, at least ${m.predicates} needed`, rel);

  const rightIn = new Map(); // form -> picture -> templates whose right option it is
  for (const item of sentencePictures) {
    const right = correctOption(item.t);
    const key = right === undefined ? "" : pictureOf(right);
    for (const o of optionsOf(item.t)) {
      if (ACT_KEY.test(pictureOf(o)) && !pictures.has(pictureOf(o))) addT("placement-sentence-family", item, `${pictureOf(o)} is not a picture of any family`);
    }
    const entry = pictures.get(key);
    if (entry === undefined) continue;
    if (tagValue(item.t, "word:") !== entry.family.noun.romanization) {
      addT("placement-sentence-family", item, `the word: tag must be the family's noun romanization ${entry.family.noun.romanization}`);
    }
    const byPicture = rightIn.get(item.t.form) ?? new Map();
    byPicture.set(key, [...(byPicture.get(key) ?? []), item]);
    rightIn.set(item.t.form, byPicture);
  }
  for (const form of ["read", "oral"]) {
    if (!sentencePictures.some(({ t }) => t.form === form)) continue;
    const byPicture = rightIn.get(form) ?? new Map();
    for (const key of pictures.keys()) {
      const items = byPicture.get(key) ?? [];
      if (items.length === 0) add("placement-sentence-family", `picture:${form}:${key}`, `${key} is the right option of no ${form} template; each picture is right exactly once per form`, rel);
      for (const item of items.slice(1)) addT("placement-sentence-family", item, `${key} is the right option of ${items.length} ${form} templates; each picture is right exactly once per form`);
    }
    const total = [...byPicture.values()].reduce((n, items) => n + items.length, 0);
    const perPredicate = new Map();
    for (const [key, items] of byPicture) {
      const predicate = pictures.get(key).predicate;
      perPredicate.set(predicate, (perPredicate.get(predicate) ?? 0) + items.length);
    }
    for (const [predicate, n] of [...perPredicate].sort()) {
      if (n > total * m.maxPredicateShare) add("placement-sentence-family", `bank:predicate-share:${form}:${predicate}`, `${predicate} is right in ${n} of ${total} ${form} templates (more than ${m.maxPredicateShare * 100} %)`, rel);
    }
  }
}

/**
 * Every finding of the §3.4 rules for a placement tree. `ctx.nikl` is `niklIndex(json)`, or null when the list is
 * absent. Only `ready` templates are linted (a draft is never drawn); the warm-up (index.json `warmup`) is not a
 * graded item and is exempt. The rules about the bank as a whole run only when the tree has `content/placement/index.json`.
 */
export function lintPlacementTree(tree, ctx = {}) {
  const findings = [];
  const index = tree.get(`${PLACEMENT_DIR}index.json`);
  const hasBank = isObject(index);
  const nikl = ctx.nikl ?? null;
  const taught = stage2Words(tree);
  const all = templatesOf(tree).filter(({ t }) => t.status === "ready" && t.id !== (hasBank ? index.warmup : undefined));
  const add = (rule, templateId, message, file = `${PLACEMENT_DIR}index.json`, path = "(root)") => findings.push({ rule, templateId, file, path, message });
  const addT = (rule, { t, file, path }, message) => add(rule, t.id, message, file, path);
  const sentencePictures = all.filter(({ t }) => t.gate === "sentence" && SENTENCE_PICTURE_FORMATS.includes(t.question.format));

  // placement-sentence-options (S1)
  for (const item of sentencePictures) {
    const problem = sentenceOptionsProblem(item.t);
    if (problem !== undefined) addT("placement-sentence-options", item, problem);
  }

  // placement-sentence-family (S5)
  const families = readFamilies(tree);
  if (families !== null) lintFamilies(families, sentencePictures, add, addT);
  else if (hasBank && sentencePictures.length > 0) {
    add("placement-sentence-family", "bank:families", "index.json names no families file (families: sentence-families.json) for the action pictures of the sentence items");
  }

  // placement-reply-echo (S6)
  for (const item of all.filter(({ t }) => t.gate === "sentence" && t.question.format === "reply-pick")) {
    const line = promptKoOf(item.t);
    const right = correctOption(item.t);
    if (line === undefined || typeof right?.ko !== "string") continue;
    const wrong = optionsOf(item.t).filter((o) => o.isCorrect !== true && typeof o.ko === "string");
    if (repeatsLine(line, right.ko) && !wrong.some((o) => repeatsLine(line, o.ko))) {
      addT("placement-reply-echo", item, `the right reply ${right.ko} is the only reply that repeats a word of the line ${line}`);
    }
  }

  // placement-vocab-frequency (W1) and placement-vocab-pictures (W2, W3), on the heard words
  for (const item of all.filter(({ t }) => t.gate === "vocab" && t.form === "oral")) {
    const { t } = item;
    const word = promptKoOf(t);
    const tags = tagsOf(t).filter((x) => x.startsWith("nikl:"));
    if (tags.length !== 1) {
      addT("placement-vocab-frequency", item, `a heard word carries exactly one nikl:<rank> tag (this one has ${tags.length})`);
    } else {
      const entry = nikl?.byRank.get(/^nikl:\d+$/.test(tags[0]) ? Number(tags[0].slice(5)) : NaN);
      const entryWord = entry === undefined ? undefined : /[가-힣]+/.exec(entry.word)?.[0];
      if (entry === undefined) addT("placement-vocab-frequency", item, `${tags[0]} is not a rank of scripts/nikl-vocab-2003.json`);
      else if (entryWord !== word) addT("placement-vocab-frequency", item, `${tags[0]} is ${entry.word}, not ${word}`);
      else if (entry.grade !== "A" && !(entry.grade === "B" && taught.has(word))) {
        addT("placement-vocab-frequency", item, `${word} is grade ${entry.grade}${entry.grade === "B" ? " and Stage 2 does not teach it" : ""}: a heard word is grade A, or grade B taught in Stage 2`);
      }
    }
    const problems = [];
    const refs = optionsOf(t).map(pictureOf);
    const notWord = refs.filter((r) => !r.startsWith("word:"));
    if (notWord.length > 0) problems.push(`every option is a word: picture (not ${notWord.join(", ")})`);
    if (word !== undefined && HOMONYMS.includes(word)) problems.push(`${word} is a picturable homonym`);
    if (refs.filter((r) => PERSON_PICTURES.includes(r)).length > 1) problems.push("at most one person picture per item");
    if (problems.length > 0) addT("placement-vocab-pictures", item, problems.join("; "));
  }

  // placement-text-picture (W4)
  for (const item of all.filter(({ t }) => t.form === "read")) {
    const shown = optionsOf(item.t).map(pictureOf).filter((r) => TEXT_PICTURES.includes(r));
    if (shown.length > 0) addT("placement-text-picture", item, `a read item never shows ${shown.join(", ")}: the picture carries letters`);
  }

  // placement-vocab-read-share (W4)
  const vocabRead = all.filter(({ t }) => t.gate === "vocab" && t.form === "read");
  if (hasBank && vocabRead.length > 0) {
    const common = vocabRead.filter(({ t }) => {
      const rank = /^\d+$/.test(tagValue(t, "nikl:") ?? "") ? Number(tagValue(t, "nikl:")) : NaN;
      const grade = nikl?.byRank.get(rank)?.grade;
      return grade === "A" || grade === "B";
    });
    const m = PLACEMENT_LINT_MINIMA;
    if (common.length * m.readShareDenominator < vocabRead.length * m.readShareNumerator) {
      add("placement-vocab-read-share", "bank:vocab-read-share", `${common.length} of ${vocabRead.length} read words carry a grade A or B nikl: tag; at least ${m.readShareNumerator} in ${m.readShareDenominator} must`);
    }
  }

  // placement-decode-balanced (D1) and placement-decode-ear (D2)
  for (const item of all) {
    const { t } = item;
    if ((t.gate === "syl-cv" || t.gate === "syl-cvc") && DECODE_BALANCED_FORMATS.includes(t.question.format)) {
      const problem = decodeBalancedProblem(t);
      if (problem !== undefined) addT("placement-decode-balanced", item, problem);
    }
    if (HEARD_WRITTEN_FORMATS.includes(t.question.format)) {
      const problem = decodeEarProblem(t);
      if (problem !== undefined) addT("placement-decode-ear", item, problem);
    }
  }

  // placement-pools (S7, W5): a strand's pools are measured when the bank has the strand at all
  if (hasBank) {
    const m = PLACEMENT_LINT_MINIMA;
    const count = (gate, form, format) => all.filter(({ t }) => t.gate === gate && t.form === form && t.question.format === format).length;
    const pools = [
      ["sentence", "sentence-read-read-pick-picture", count("sentence", "read", "read-pick-picture"), m.sentenceReadPicture],
      ["sentence", "sentence-read-reply-pick", count("sentence", "read", "reply-pick"), m.sentenceReply],
      ["sentence", "sentence-oral-hear-pick-picture", count("sentence", "oral", "hear-pick-picture"), m.sentenceOralPicture],
      ["vocab", "vocab-oral-hear-pick-picture", count("vocab", "oral", "hear-pick-picture"), m.vocabOral],
      ["vocab", "vocab-read-read-pick-picture", count("vocab", "read", "read-pick-picture"), m.vocabRead],
    ];
    for (const [gate, pool, n, min] of pools) {
      if (n < min && all.some(({ t }) => t.gate === gate)) add("placement-pools", `pool:${pool}`, `${n} ready templates, at least ${min} needed`);
    }
  }

  return findings.sort((a, b) => (a.rule === b.rule ? (a.templateId < b.templateId ? -1 : a.templateId > b.templateId ? 1 : 0) : a.rule < b.rule ? -1 : 1));
}

/**
 * The baseline is a list of { rule, templateId } pairs. A finding that is listed is reported, not failed; a finding that
 * is not listed fails; a listed pair that no longer fails must leave the file (it only shrinks).
 */
export function applyPlacementBaseline(findings, baseline) {
  const malformed = [];
  const listed = new Map();
  if (baseline !== undefined && !Array.isArray(baseline)) malformed.push("the baseline is a list of { rule, templateId } pairs");
  const rows = Array.isArray(baseline) ? baseline : [];
  rows.forEach((row, i) => {
    if (!isObject(row) || typeof row.rule !== "string" || typeof row.templateId !== "string") return malformed.push(`entry ${i} is not a { rule, templateId } pair`);
    const key = `${row.rule}\u0000${row.templateId}`;
    if (listed.has(key)) return malformed.push(`entry ${i} repeats ${row.rule} ${row.templateId}`);
    listed.set(key, i);
  });
  const failures = [];
  const reported = [];
  const hit = new Set();
  for (const f of findings) {
    const key = `${f.rule}\u0000${f.templateId}`;
    if (listed.has(key)) {
      hit.add(key);
      reported.push(f);
    } else failures.push(f);
  }
  const stale = [...listed].filter(([key]) => !hit.has(key)).map(([, i]) => ({ index: i, rule: rows[i].rule, templateId: rows[i].templateId }));
  return { failures, reported, stale, malformed };
}

export const PLACEMENT_BASELINE_FILE = "scripts/placement-lint-baseline.json";

/**
 * The lint with its baseline, as violations for validate-content.mjs: new failures, stale baseline entries and a
 * malformed baseline. `reported` counts the baselined findings per rule.
 */
export function checkPlacementLint(tree, { nikl = null, baseline } = {}) {
  const applied = applyPlacementBaseline(lintPlacementTree(tree, { nikl }), baseline);
  const violations = applied.failures.map((f) => ({ file: f.file, path: f.path, rule: `${f.rule}: ${f.templateId}: ${f.message}` }));
  for (const message of applied.malformed) violations.push({ file: PLACEMENT_BASELINE_FILE, path: "(root)", rule: `placement-lint-baseline: ${message}` });
  for (const s of applied.stale) {
    violations.push({
      file: PLACEMENT_BASELINE_FILE,
      path: `[${s.index}]`,
      rule: `placement-lint-baseline: ${s.rule} ${s.templateId} no longer fails, or its template is gone: remove it (the baseline only shrinks)`,
    });
  }
  const reported = {};
  for (const f of applied.reported) reported[f.rule] = (reported[f.rule] ?? 0) + 1;
  return { violations, reported };
}
