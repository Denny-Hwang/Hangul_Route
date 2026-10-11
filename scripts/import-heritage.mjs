#!/usr/bin/env node
// F-STORY-001 §3.10 — one-time heritage importer (PR 1.6).
//
// Turns the verified research files (content/stories/research/<cluster>.final.json)
// into story drafts, content/stories/<slug>.json with `state: 'draft'`, field for
// field (§3.10 mapping table). It never edits a research file, never rewrites a
// source, never guesses a romanization or a gloss: what it cannot create (captions,
// explanations, art, title romanizations, the terms the research never defined)
// is reported as the author's to-do list and exits 0.
//
// The known lint classes of §3.14 are resolved here, the way the spec says, and
// each resolution is listed in the report so the owner can review it:
//   - derived numbers ("almost 600 years ago") get an `approximations` entry that
//     names the fact they are computed from (§3.3 C5); the narration is untouched;
//   - the one http:// source becomes the same page over https (§3.3 C4);
//   - a scene gloss that holds Hangul takes the vocab gloss of the word, else the
//     parenthetical that holds the Hangul is dropped (§3.10 to-do);
//   - the one hyphenated romanization loses its hyphen (F-CNT-002 R2).
//
// Usage:
//   node scripts/import-heritage.mjs --src <dir> [--dry-run] [--write]
//                                    [--force-draft] [--allow-unfinal]
//
//   --dry-run        report only (also the default: nothing is written without --write)
//   --write          write content/stories/<slug>.json
//   --force-draft    overwrite an existing story that is still a draft at contentVer 1
//   --allow-unfinal  also import <cluster>.revised.json / .draft.json (verification.passes 0)
//
// Dependency-free Node (same family as build-stories.mjs). Exit 0 on success (gaps
// included), 1 on a content error or a refused overwrite, 2 on a usage error.
// HANGUL_ROUTE_ROOT overrides the repo root (tests).

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const USAGE =
  "usage: node scripts/import-heritage.mjs --src <dir> [--dry-run] [--write] [--force-draft] [--allow-unfinal]";

const HANGUL_CHAR = /[ㄱ-㆏가-힣]/;
const HANGUL_SPAN = /[ㄱ-㆏가-힣]+(?: [ㄱ-㆏가-힣]+)*/g;
const STORY_RESEARCH_ID = /^story-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HERITAGE_KINDS = new Set(["documentary", "site", "intangible", "object", "science", "art", "folk-tale"]);
const NO_VERIFICATION_NOTE = "Imported from a file with no recorded verification pass.";

// Hangul terms the research never defined (§1: 7 of them). The importer only needs an id;
// romanization and gloss stay empty for the author. An unknown future term gets `term-<n>`.
const TERM_IDS = Object.freeze({
  사초: "sacho",
  승정원일기: "seungjeongwon-ilgi",
  원행을묘정리의궤: "wonhaeng-eulmyo-jeongni-uigwe",
  수원화성문화제: "suwon-hwaseong-munhwaje",
  허준: "heo-jun",
  이순신: "yi-sun-sin",
  김홍도: "kim-hong-do",
});

// The one http:// source of the research set (hangul-printing, Tripitaka Koreana f6). The same
// page answers over https (checked 2026-10-10: HTTP 200 and the quoted "2/3 ... 산벚나무"
// sentence is on it), so the URL is upgraded and no source is dropped (§3.3 C4).
const HTTPS_UPGRADES = new Map([
  [
    "http://treestory.forest.or.kr/v1/bbs/bbs.php?cmd=view&board_name=b44&bid=672&curpage=1&count=y",
    "https://treestory.forest.or.kr/v1/bbs/bbs.php?cmd=view&board_name=b44&bid=672&curpage=1&count=y",
  ],
]);

// The four narration numbers that no cited fact states but that are computed from one (§1).
// Each becomes an `approximations` entry (§3.3 C5); `from` are the numbers a cited fact must
// contain, and the entry names those facts. The narration itself is never edited.
const DERIVED_NUMBERS = Object.freeze([
  {
    episode: "story-sejong-new-letters",
    scene: 1,
    text: "almost 600 years",
    from: ["1443"],
    rationaleEn: "King Sejong made the letters in 1443; 1443 to 2026 is 583 years, so narration rounds it to almost 600.",
    timeRelative: true,
  },
  {
    episode: "story-sillok-mountain-archives",
    scene: 4,
    text: "1590s",
    from: ["1592"],
    rationaleEn: "The Imjin War began in 1592, which is in the 1590s.",
    timeRelative: false,
  },
  {
    episode: "story-joseon-records-today",
    scene: 5,
    text: "nearly 300 years",
    from: ["288"],
    rationaleEn: "The diary covers 288 years (1623-1910); narration rounds that up to nearly 300.",
    timeRelative: false,
  },
  {
    episode: "story-tripitaka-koreana",
    scene: 8,
    text: "Almost 800 years",
    from: ["1248"],
    rationaleEn: "The blocks were finished in 1248; 1248 to 2026 is 778 years, so narration rounds it to almost 800.",
    timeRelative: true,
  },
]);

const TALE_ADVISORY = Object.freeze({
  advisory: ["mild-peril", "trickery"],
  noteEn: "A trickster and a moment of danger, told gently; the scariest parts are left out.",
});
const ADVISORY_NOTES = Object.freeze({
  war: "Briefly mentions a war from Korea's history.",
  loss: "Briefly mentions a death or a fire, told gently.",
});
const ADVISORY_PATTERNS = Object.freeze({
  war: /\b(?:war|invasion|invaded|Mongol)\b/i,
  loss: /\b(?:died|fire)\b/i,
});

const ORIGIN_NOTES = Object.freeze({
  documented: "Heritage history, researched from the sources listed on the Sources screen.",
  traditional: "One version of a traditional tale; the Sources screen lists the versions this retelling follows.",
});
const RETELLING_NOTE = "Shortened and made gentler; versions differ.";

// ---- small helpers ------------------------------------------------------------------

const hasHangul = (text) => HANGUL_CHAR.test(text);
const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v) => (typeof v === "string" ? v.trim() : "");

/** Lower-case, non-alphanumerics to '-', no leading or trailing '-' (keyword ids, §3.2.2). */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** §3.10: a scene Korean string that ends . ? ! or has 3+ words is a line, the rest are keywords. */
const isLine = (ko) => /[.?!]$/.test(ko) || ko.trim().split(/\s+/).length >= 3;

function fail(message) {
  throw new Error(message);
}

function jamoIndex(jamo) {
  const index = new Map();
  for (const j of jamo) {
    if (!isObject(j) || typeof j.ko !== "string" || typeof j.romanization !== "string") continue;
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(j.romanization);
    const sound = (m ? m[1] : j.romanization).trim();
    const name = (m ? m[2] : sound).trim();
    index.set(j.ko, {
      ko: j.ko,
      sound,
      name,
      en: `the ${j.kind === "vowel" ? "vowel" : "consonant"} letter ${name}`,
    });
  }
  return index;
}

// ---- the advisory scan (§3.6) -------------------------------------------------------------

/** Proposes `review.advisory` values from a keyword scan of the narration; a human accepts or clears them. */
export function scanAdvisories(scenes) {
  const advisory = [];
  const hit = new Set();
  for (const kind of ["war", "loss"]) {
    for (const scene of scenes) {
      if (ADVISORY_PATTERNS[kind].test(scene.narration_en)) {
        if (!advisory.includes(kind)) advisory.push(kind);
        hit.add(scene.n);
      }
    }
  }
  return {
    advisory,
    scenes: [...hit].sort((a, b) => a - b),
    noteEn: advisory.length ? advisory.map((k) => ADVISORY_NOTES[k]).join(" ") : undefined,
  };
}

// ---- keyword registry --------------------------------------------------------------------

function createRegistry(jamoMap) {
  const list = [];
  const byKo = new Map();
  const byBare = new Map(); // a line quoted in narration without its end punctuation
  const ids = new Set();
  let fallbackTerms = 0;

  const uniqueId = (base) => {
    let id = base;
    for (let n = 2; ids.has(id); n += 1) id = `${base}-${n}`;
    ids.add(id);
    return id;
  };
  const kindOf = (ko) => (jamoMap.has(ko) ? "jamo" : isLine(ko) ? "phrase" : "word");

  return {
    list,
    byKo,
    find: (ko) => byKo.get(ko) ?? byBare.get(ko),
    add({ ko, romanization, en, kind, fromVocab = false }) {
      const jamoEntry = jamoMap.get(ko);
      let base;
      if (jamoEntry) base = `jamo-${slugify(jamoEntry.sound)}`;
      else base = slugify(romanization) || TERM_IDS[ko] || `term-${(fallbackTerms += 1)}`;
      const keyword = { id: uniqueId(base), ko, romanization, en, kind: kind ?? kindOf(ko) };
      list.push(keyword);
      byKo.set(ko, keyword);
      const bare = ko.replace(/[.?!]+$/, "");
      if (bare !== ko && !byBare.has(bare)) byBare.set(bare, keyword);
      if (fromVocab) keyword.fromVocab = true;
      return keyword;
    },
  };
}

// ---- mapping -------------------------------------------------------------------------------

function requireShape(raw) {
  if (!isObject(raw)) fail("episode is not an object");
  if (typeof raw.id !== "string" || !STORY_RESEARCH_ID.test(raw.id)) {
    fail(`id must look like story-<slug> (got ${JSON.stringify(raw.id)})`);
  }
  for (const key of ["scenes", "facts", "vocab", "checks", "learning_goals"]) {
    if (!Array.isArray(raw[key])) fail(`${key} must be an array`);
  }
  for (const key of ["title_en", "title_ko", "theme", "summary_en", "reference_display"]) {
    if (typeof raw[key] !== "string") fail(`${key} must be a string`);
  }
  if (!HERITAGE_KINDS.has(raw.heritage_type)) {
    fail(`unknown heritage_type ${JSON.stringify(raw.heritage_type)} (expected ${[...HERITAGE_KINDS].join(" | ")})`);
  }
  for (const scene of raw.scenes) {
    if (!isObject(scene) || !Number.isInteger(scene.n) || scene.n < 1) fail("every scene needs an integer n >= 1");
    if (typeof scene.narration_en !== "string" || typeof scene.korean !== "string") {
      fail(`scene ${scene.n} needs narration_en and korean`);
    }
  }
}

/**
 * Maps one research episode to a draft story and a report.
 * `cluster` = { cluster, verification?, fileDate, unfinal? }; `jamo` = content/episodes/stage-1/jamo.json.
 * `options.resolve` (default true) applies the §3.14 resolutions; false gives the raw mapping.
 */
export function mapEpisode(raw, cluster, jamo, options = {}) {
  requireShape(raw);
  const resolveKnown = options.resolve !== false;
  const slug = raw.id.slice("story-".length);
  const jamoMap = jamoIndex(jamo);
  const registry = createRegistry(jamoMap);
  const resolved = [];
  const flags = [];
  const unresolvedTerms = [];
  const added = { jamo: 0, terms: 0 };
  const note = (kind, where, detail) => resolved.push({ kind, where, detail });
  const flag = (rule, where, detail) => flags.push({ rule, where, detail });

  // -- romanization and gloss clean-up (§3.10 to-do; F-CNT-002 R2) --
  const cleanRomanization = (value, where) => {
    const cleaned = text(value);
    if (!resolveKnown) return cleaned;
    const fixed = cleaned.replace(/(?<=[A-Za-z])-(?=[A-Za-z])/g, "");
    if (fixed !== cleaned) note("romanization-hyphen", where, `${cleaned} -> ${fixed}`);
    return fixed;
  };
  const cleanGloss = (value, where, vocabGloss) => {
    const gloss = text(value);
    if (!resolveKnown || !hasHangul(gloss)) return gloss;
    const own = text(vocabGloss);
    const stripped = gloss.replace(/\s*\([^)]*\)/g, (m) => (hasHangul(m) ? "" : m)).trim();
    const fixed = own && !hasHangul(own) ? own : stripped && !hasHangul(stripped) ? stripped : undefined;
    if (fixed === undefined) {
      flag("gloss-contains-hangul", where, `"${gloss}" holds Hangul; rewrite it`);
      return gloss;
    }
    note("gloss-hangul", where, `"${gloss}" -> "${fixed}"`);
    return fixed;
  };

  // -- keywords: the vocab, then the scene Korean that is not in it --
  raw.vocab.forEach((v) => {
    const ko = text(v.ko);
    if (!ko || registry.byKo.has(ko)) return;
    const where = `keywords[${registry.list.length}]`;
    registry.add({
      ko,
      romanization: cleanRomanization(v.rr, `${where}.romanization`),
      en: cleanGloss(v.en, `${where}.en`),
      fromVocab: true,
    });
  });

  const scenes = raw.scenes.map((s, si) => {
    const ko = text(s.korean);
    const where = `tiers[0].scenes[${si}]`;
    const form = isLine(ko) ? "line" : "keyword";
    const romanization = cleanRomanization(s.romanization, `${where}.${form}.romanization`);
    const en = cleanGloss(s.gloss_en, `${where}.${form}.en`, registry.byKo.get(ko)?.en);
    if (!registry.byKo.has(ko)) registry.add({ ko, romanization, en });
    return { raw: s, ko, romanization, en, form };
  });

  // -- narration: Hangul spans become {kw:id} tokens (§3.4) --
  const wordKeyword = (word, sceneN) => {
    const known = registry.find(word);
    if (known) return known;
    const jamoEntry = jamoMap.get(word);
    if (jamoEntry) {
      added.jamo += 1;
      return registry.add({ ko: word, romanization: jamoEntry.sound, en: jamoEntry.en });
    }
    added.terms += 1;
    const term = registry.add({ ko: word, romanization: "", en: "", kind: "term" });
    unresolvedTerms.push({ ko: word, id: term.id, scene: sceneN });
    return term;
  };
  const tokenize = (narration, sceneN) => {
    let out = "";
    let last = 0;
    for (const match of narration.matchAll(HANGUL_SPAN)) {
      const span = match[0];
      const end = match.index + span.length;
      out += narration.slice(last, match.index);
      const tail = /^[.?!]+/.exec(narration.slice(end))?.[0] ?? "";
      let whole;
      let consumed = 0;
      for (let k = tail.length; k >= 0 && !whole; k -= 1) {
        const candidate = registry.byKo.get(span + tail.slice(0, k));
        if (candidate) {
          whole = candidate;
          consumed = k;
        }
      }
      whole ??= registry.find(span);
      out += whole
        ? `{kw:${whole.id}}`
        : span
            .split(" ")
            .map((word) => `{kw:${wordKeyword(word, sceneN).id}}`)
            .join(" ");
      last = end + consumed;
    }
    return out + narration.slice(last);
  };

  // -- facts --
  const folkTale = raw.heritage_type === "folk-tale";
  const taleScope = [];
  const facts = raw.facts.map((f, fi) => {
    const claimEn = text(f.claim_en);
    const scope = folkTale && !/\b\d{4}\b|UNESCO|designated|National/.test(claimEn) ? "in-the-tale" : "documented";
    if (scope === "in-the-tale") taleScope.push({ factId: f.id, scope });
    const sources = (Array.isArray(f.sources) ? f.sources : []).map((s, si) => {
      let url = text(s.url);
      if (url.startsWith("http:")) {
        const upgrade = resolveKnown ? HTTPS_UPGRADES.get(url) : undefined;
        if (upgrade) {
          note("source-url-https", `facts[${fi}].sources[${si}].url`, `${url} -> ${upgrade}`);
          url = upgrade;
        } else {
          flag("source-url-not-https", `facts[${fi}].sources[${si}].url`, `${url} is not https`);
        }
      }
      return {
        title: text(s.title),
        publisher: text(s.publisher),
        url,
        accessed: text(s.accessed),
        quoteOrLocator: text(s.quote_or_locator),
      };
    });
    return { id: f.id, rev: 1, scope, claimEn, claimKo: text(f.claim_ko), sources };
  });

  // -- scenes --
  const mappedScenes = scenes.map(({ raw: s, ko, romanization, en, form }, si) => {
    const where = `tiers[0].scenes[${si}]`;
    const keyword = registry.byKo.get(ko);
    const narrationEn = tokenize(text(s.narration_en), s.n);
    const factIds = Array.isArray(s.fact_ids) ? [...s.fact_ids] : [];
    const scene = { id: `s${s.n}`, narrationEn };
    if (form === "line") scene.line = { ko, romanization, en, speaker: "narrator" };
    else scene.keyword = { id: keyword.id, ko, romanization, en, kind: keyword.kind };
    scene.factIds = factIds;
    scene.framing = factIds.length === 0;
    scene.approximations = [];
    const brief = text(s.illustration);
    if (brief) scene.artBrief = brief;

    const derived = resolveKnown && DERIVED_NUMBERS.find((d) => d.episode === raw.id && d.scene === s.n);
    if (derived) {
      if (!narrationEn.includes(derived.text)) {
        flag("approximation-text-missing", where, `"${derived.text}" is not in the narration any more`);
      } else {
        const cited = facts.filter((f) => factIds.includes(f.id));
        const sourceIds = derived.from.map((n) => cited.find((f) => new RegExp(`\\b${n}\\b`).test(f.claimEn))?.id);
        if (sourceIds.some((id) => id === undefined)) {
          flag("approximation-source-missing", where, `no cited fact states ${derived.from.join(", ")} for "${derived.text}"`);
        } else {
          scene.approximations.push({
            text: derived.text,
            factIds: [...new Set(sourceIds)],
            rationaleEn: derived.rationaleEn,
            timeRelative: derived.timeRelative,
          });
          note("approximation", `${where}.approximations[0]`, `"${derived.text}" from ${[...new Set(sourceIds)].join(", ")}`);
        }
      }
    }
    return scene;
  });

  // -- checks --
  const checks = raw.checks.map((c, ci) => mapCheck(c, ci, { registry, jamoMap, note }));

  // -- tier derivations (§3.10, marked as defaults) --
  const count = mappedScenes.length;
  const sequenceSceneIds = [0, 1, 2, 3].map((i) => mappedScenes[Math.round((i * (count - 1)) / 3)].id);
  const newKeywordIds = [];
  for (const s of mappedScenes) {
    const id = s.keyword?.id;
    if (id && registry.list.find((k) => k.id === id)?.fromVocab && !newKeywordIds.includes(id)) newKeywordIds.push(id);
    if (newKeywordIds.length === 4) break;
  }

  // -- review and origin --
  const scan = scanAdvisories(raw.scenes);
  const advisory = folkTale ? [...TALE_ADVISORY.advisory] : [];
  const notes = folkTale ? [TALE_ADVISORY.noteEn] : [];
  for (const kind of scan.advisory) {
    if (!advisory.includes(kind)) advisory.push(kind);
    notes.push(ADVISORY_NOTES[kind]);
  }
  let advisoryNoteEn = notes.join(" ");
  if (advisoryNoteEn.length > 140) {
    advisoryNoteEn = notes[0];
    flag("advisory-note-truncated", "review.advisoryNoteEn", "the proposed notes were longer than 140 characters; only the first is kept");
  }
  const review = { language: "draft", culture: "draft", advisory };
  if (advisory.length) review.advisoryNoteEn = advisoryNoteEn;

  const origin = folkTale
    ? { type: "traditional", noteEn: ORIGIN_NOTES.traditional, retellingNoteEn: RETELLING_NOTE }
    : { type: "documented", noteEn: ORIGIN_NOTES.documented };

  // -- verification (§3.6) --
  const record = isObject(cluster.verification) ? cluster.verification : undefined;
  const verification = {
    passes: record && !cluster.unfinal ? record.passes : 0,
    checkedAt: record?.checked_at ?? cluster.fileDate,
    scope: "cluster",
    notes: text(record?.notes) || NO_VERIFICATION_NOTE,
  };

  const story = {
    v: 1,
    id: `story:${slug}`,
    state: "draft",
    contentVer: 1,
    title: { ko: text(raw.title_ko), romanization: "", en: text(raw.title_en) },
    summaryEn: text(raw.summary_en),
    theme: raw.theme,
    kind: raw.heritage_type,
    recommendedStage: raw.recommended_stage,
    minutes: raw.minutes,
    learningGoalsEn: raw.learning_goals.map(text),
    origin,
    review,
    keywords: registry.list.map(({ id, ko, romanization, en, kind }) => ({ id, ko, romanization, en, kind })),
    cultureNotes: [],
    tiers: [
      {
        level: "listen",
        scenes: mappedScenes,
        checks,
        checkpoints: [],
        sequenceSceneIds,
        newKeywordIds,
      },
    ],
    coverSceneId: mappedScenes[0].id,
    pillarTags: [],
    companionId: "hoya",
    facts,
    referenceDisplay: text(raw.reference_display),
    verification,
    errata: [],
  };
  const authorNotes = text(raw.notes);
  if (authorNotes) story.authorNotes = authorNotes;
  // authorNotes sits before errata in the schema's key order
  const ordered = {};
  for (const key of Object.keys(story)) {
    if (key === "errata" && story.authorNotes !== undefined) ordered.authorNotes = story.authorNotes;
    if (key !== "authorNotes") ordered[key] = story[key];
  }

  const report = {
    id: ordered.id,
    counts: {
      scenes: mappedScenes.length,
      facts: facts.length,
      sources: facts.reduce((n, f) => n + f.sources.length, 0),
      keywords: ordered.keywords.length,
      checks: checks.length,
    },
    unresolvedTerms,
    addedFromNarration: added,
    resolved,
    flags,
    defaulted: ["sequenceSceneIds", "newKeywordIds", "coverSceneId"],
    taleScope,
    advisoryScenes: scan.scenes,
    todo: {
      captionEn: mappedScenes.length,
      explainEn: checks.length,
      art: mappedScenes.length,
      titleRomanization: ordered.title.romanization === "" ? 1 : 0,
      termGlosses: unresolvedTerms.length,
    },
  };
  return { story: ordered, report };
}

/** One research check: Hangul in the prompt is lifted to `target` + {target}; Hangul-only options become ko options. */
function mapCheck(check, index, { registry, jamoMap, note }) {
  const label = `check ${index + 1}`;
  if (!isObject(check) || !Array.isArray(check.options)) fail(`${label}: options must be an array`);
  if (!Number.isInteger(check.answer_index) || check.answer_index < 0 || check.answer_index >= check.options.length) {
    fail(`${label}: answer_index ${JSON.stringify(check.answer_index)} is outside the ${check.options.length} options`);
  }
  const mapped = { id: `c${index + 1}`, kind: "detail" };
  let promptEn = text(check.q_en);
  const spans = [...promptEn.matchAll(HANGUL_SPAN)];
  let target;
  // At most one {target} per prompt (F-STORY-003): the first Korean term is the target; any further
  // isolated jamo is written as its letter name ("from the letter nieun"), anything else stops the import.
  const extras = spans.slice(1);
  if (extras.some((span) => !jamoMap.has(span[0]))) {
    fail(
      `${label}: a prompt can name only one Korean term besides isolated jamo (found ${spans.map((s) => s[0]).join(", ")})`
    );
  }
  if (spans.length > 0) {
    const [span] = spans;
    const ko = span[0];
    const after = promptEn.slice(span.index + ko.length);
    const latin = /^\s*\(([A-Za-z][A-Za-z '.-]*)\)/.exec(after);
    const jamoEntry = jamoMap.get(ko);
    if (jamoEntry) target = { ko, romanization: jamoEntry.sound, en: jamoEntry.en };
    else {
      const keyword = registry.byKo.get(ko);
      if (!keyword) fail(`${label}: Korean term "${ko}" in the prompt has no vocab or scene entry`);
      const romanization = keyword.romanization || (latin ? latin[1].trim() : "");
      if (!romanization || !keyword.en) fail(`${label}: Korean term "${ko}" needs a romanization and a gloss to be a target`);
      target = { ko, romanization, en: keyword.en };
    }
    let rebuilt = promptEn.slice(0, span.index) + "{target}" + (latin ? after.slice(latin[0].length) : after);
    for (const extra of extras) {
      rebuilt = rebuilt.replace(extra[0], `the letter ${jamoMap.get(extra[0]).name}`);
    }
    promptEn = rebuilt;
    note("check-target", `tiers[0].checks[${index}].target`, `"${ko}" lifted out of the prompt${extras.length ? `; ${extras.map((e) => e[0]).join(", ")} written as letter names` : ""}`);
  }
  mapped.kind = target && promptEn === "What is {target}?" ? "pick-meaning" : "detail";
  mapped.promptEn = promptEn;
  if (target) mapped.target = target;
  mapped.options = check.options.map((option, oi) => {
    const id = String.fromCharCode(97 + oi);
    const label_ = text(option);
    if (!hasHangul(label_)) return { id, en: label_, isCorrect: oi === check.answer_index };
    const jamoEntry = jamoMap.get(label_);
    if (!jamoEntry) fail(`${label}: option "${label_}" holds Hangul the importer cannot place (only a single jamo)`);
    return { id, ko: label_, romanization: jamoEntry.sound, en: jamoEntry.en, isCorrect: oi === check.answer_index };
  });
  mapped.factIds = [check.fact_id];
  return mapped;
}

// ---- CLI ------------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { src: undefined, dryRun: false, write: false, forceDraft: false, allowUnfinal: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--src") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) return { error: "--src needs a directory" };
      opts.src = value;
      i += 1;
    } else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--write") opts.write = true;
    else if (arg === "--force-draft") opts.forceDraft = true;
    else if (arg === "--allow-unfinal") opts.allowUnfinal = true;
    else return { error: `unknown argument ${arg}` };
  }
  if (!opts.src) return { error: "--src <dir> is required" };
  if (opts.dryRun && opts.write) return { error: "--dry-run and --write cannot be combined" };
  return { opts };
}

/** `<cluster>.final.json` files first; a cluster with only a revised/draft file is refused unless allowed. */
function discover(src, allowUnfinal) {
  const groups = new Map();
  for (const name of readdirSync(src).sort()) {
    const m = /^(.+)\.(final|revised|draft)\.json$/.exec(name);
    if (!m) continue;
    const group = groups.get(m[1]) ?? {};
    group[m[2]] = name;
    groups.set(m[1], group);
  }
  const files = [];
  const refused = [];
  for (const [stem, group] of groups) {
    if (group.final) files.push({ name: group.final, stem, unfinal: false });
    else if (allowUnfinal) files.push({ name: group.revised ?? group.draft, stem, unfinal: true });
    else {
      for (const name of [group.revised, group.draft].filter(Boolean)) {
        refused.push(
          `refused: ${name} is not a .final.json (an unfinished verification must not be imported by accident); pass --allow-unfinal to import it with verification.passes 0`
        );
      }
    }
  }
  return { files, refused };
}

function formatReport(used, results, written) {
  const lines = ["import-report"];
  for (const f of used) lines.push(`used: ${f.name} (${f.episodes} episodes${f.unfinal ? ", unfinal: passes 0" : ""})`);
  const sum = (key) => results.reduce((n, r) => n + r.report.counts[key], 0);
  lines.push(`${results.length} stories, ${sum("scenes")} scenes, ${sum("facts")} facts, ${sum("sources")} sources`);
  for (const { report } of results) {
    const c = report.counts;
    lines.push(`  ${report.id}  ${c.scenes} scenes, ${c.facts} facts, ${c.sources} sources, ${c.keywords} keywords, ${c.checks} checks`);
  }
  const todo = (key) => results.reduce((n, r) => n + r.report.todo[key], 0);
  lines.push(
    "author to-do (every draft finding the lint prints):",
    `  captionEn ${todo("captionEn")} | explainEn ${todo("explainEn")} | art ${todo("art")} | title romanizations ${todo("titleRomanization")} | term glosses ${todo("termGlosses")}`
  );
  const terms = results.flatMap((r) => r.report.unresolvedTerms.map((t) => ({ story: r.report.id, ...t })));
  if (terms.length) {
    lines.push(`undefined terms (author: romanization + gloss), ${terms.length}:`);
    for (const t of terms) lines.push(`  ${t.story} s${t.scene}  ${t.ko}  (keyword ${t.id})`);
  }
  const resolved = results.flatMap((r) => r.report.resolved.map((x) => ({ id: r.report.id, ...x })));
  const important = resolved.filter((x) => x.kind !== "check-target");
  lines.push(`resolved by the importer (owner review), ${important.length}:`);
  for (const x of important) lines.push(`  ${x.id}  ${x.kind}  ${x.where}  ${x.detail}`);
  const flags = results.flatMap((r) => r.report.flags.map((x) => ({ id: r.report.id, ...x })));
  lines.push(`unresolved flags, ${flags.length}:`);
  for (const x of flags) lines.push(`  ${x.id}  ${x.rule}  ${x.where}  ${x.detail}`);
  const advisories = results.filter((r) => r.report.advisoryScenes.length);
  lines.push(`advisories proposed from the keyword scan (accept or clear), ${advisories.length} stories:`);
  for (const r of advisories) {
    lines.push(`  ${r.report.id}  ${r.story.review.advisory.join(", ")}  scenes ${r.report.advisoryScenes.join(", ")}`);
  }
  const tales = results.filter((r) => r.report.taleScope.length);
  for (const r of tales) {
    lines.push(`in-the-tale facts to confirm: ${r.report.id}  ${r.report.taleScope.map((t) => t.factId).join(", ")}`);
  }
  lines.push("defaults to review (marked, not authored): sequenceSceneIds, newKeywordIds, coverSceneId");
  lines.push(written ? `wrote ${results.length} stories to content/stories/` : "dry run: nothing written (pass --write)");
  return lines.join("\n") + "\n";
}

export function main(argv, root) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n${USAGE}\n`);
    return 2;
  }
  const { opts } = parsed;
  const src = resolve(opts.src);
  if (!existsSync(src) || !statSync(src).isDirectory()) {
    process.stderr.write(`--src ${opts.src} is not a directory\n${USAGE}\n`);
    return 2;
  }
  const { files, refused } = discover(src, opts.allowUnfinal);
  if (refused.length) {
    process.stderr.write(refused.join("\n") + "\n");
    return 2;
  }
  if (files.length === 0) {
    process.stderr.write(`no <cluster>.final.json in ${opts.src}\n${USAGE}\n`);
    return 2;
  }
  const jamoFile = join(root, "content", "episodes", "stage-1", "jamo.json");
  let jamo;
  try {
    jamo = JSON.parse(readFileSync(jamoFile, "utf8"));
  } catch (error) {
    process.stderr.write(`cannot read ${jamoFile}: ${error.message}\n`);
    return 1;
  }

  const results = [];
  const used = [];
  const owner = new Map();
  for (const file of files) {
    const path = join(src, file.name);
    let doc;
    try {
      doc = JSON.parse(readFileSync(path, "utf8"));
      if (!isObject(doc) || !Array.isArray(doc.episodes)) fail("no episodes[] array");
    } catch (error) {
      process.stderr.write(`${file.name}: ${error.message}\n`);
      return 1;
    }
    const cluster = {
      cluster: typeof doc.cluster === "string" ? doc.cluster : file.stem,
      verification: doc.verification,
      fileDate: statSync(path).mtime.toISOString().slice(0, 10),
      unfinal: file.unfinal,
    };
    used.push({ name: file.name, episodes: doc.episodes.length, unfinal: file.unfinal });
    for (const episode of doc.episodes) {
      let mapped;
      try {
        mapped = mapEpisode(episode, cluster, jamo);
      } catch (error) {
        process.stderr.write(`${file.name}: ${isObject(episode) ? episode.id : "?"}: ${error.message}\n`);
        return 1;
      }
      const id = mapped.story.id;
      if (owner.has(id)) {
        process.stderr.write(`${id} is in both ${owner.get(id)} and ${file.name}\n`);
        return 1;
      }
      owner.set(id, file.name);
      results.push(mapped);
    }
  }

  const dir = join(root, "content", "stories");
  const target = (story) => join(dir, `${story.id.slice("story:".length)}.json`);
  let written = false;
  if (opts.write) {
    const blocked = [];
    for (const { story } of results) {
      const path = target(story);
      if (!existsSync(path)) continue;
      let replaceable = false;
      if (opts.forceDraft) {
        try {
          const existing = JSON.parse(readFileSync(path, "utf8"));
          replaceable = isObject(existing) && existing.state === "draft" && existing.contentVer === 1;
        } catch {
          replaceable = false;
        }
      }
      if (!replaceable) blocked.push(path);
    }
    if (blocked.length) {
      for (const path of blocked) {
        process.stderr.write(
          `refusing to overwrite content/stories/${path.split(/[\\/]/).pop()}: it exists (authors edit these files; --force-draft only replaces a draft at contentVer 1)\n`
        );
      }
      return 1;
    }
    mkdirSync(dir, { recursive: true });
    for (const { story } of results) writeFileSync(target(story), JSON.stringify(story, null, 2) + "\n");
    written = true;
  }
  process.stdout.write(formatReport(used, results, written));
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = process.env.HANGUL_ROUTE_ROOT
    ? resolve(process.env.HANGUL_ROUTE_ROOT)
    : join(dirname(fileURLToPath(import.meta.url)), "..");
  process.exitCode = main(process.argv.slice(2), root);
}
