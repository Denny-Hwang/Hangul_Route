// F-PLC-001 §3.4 — validator rules for content/placement/** and the `pitem:` overlay
// fields (PR P-4). Pure functions over already-parsed JSON, called by
// scripts/validate-content.mjs (plain Node, no zod). The tables below mirror
// packages/content-schema/src/schemas/placement.ts (PLACEMENT_FORMATS and friends);
// a content-schema test compares them, so the two cannot drift.
//
// The semantic rules that need the converter or the picture art (romanization against
// the Revised Romanization converter, per-strand counts, symbol coverage, `card:` art)
// live in packages/content-schema/src/__tests__/placement-bank.test.ts.

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
const OVERLAY_FILE = /^content\/i18n\/([^/]+)\/placement\.json$/;
const TEMPLATE_ID = /^pitem:[a-z0-9-]+$/;
const OPTION_GLOSS = /^options\.([a-z0-9-]+)\.gloss$/;

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

  if (t.status === "ready" && t.strand === "sentences") {
    add("placement-sentence-ready", "a sentence cannot be ready until the reviewedBy ledger exists (F-CNT-002); keep it draft");
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
  for (const rel2 of strandFiles) {
    if (!index.files.includes(rel2.slice(PLACEMENT_DIR.length))) return add(`${rel2.slice(PLACEMENT_DIR.length)} is not listed in files`);
  }
}

function checkOverlay(rel, body, locale, templates, out) {
  const add = (rule, path, message) => out.push({ file: rel, path, rule: `${rule}: ${message}` });
  if (!isObject(body) || body.locale !== locale || (locale !== "es" && locale !== "ko") || body.domain !== "placement" || !isObject(body.entries)) {
    add("overlay-bad-shape", "(root)", "an overlay is { locale (= its folder: es or ko), domain: placement, entries }");
    return;
  }
  for (const [id, entry] of Object.entries(body.entries)) {
    const at = `entries.${id}`;
    if (!isObject(entry)) {
      add("overlay-bad-shape", at, "an entry must be an object of translatable fields");
      continue;
    }
    const template = templates.get(id);
    if (template === undefined) {
      add("overlay-unknown-id", at, `${id} is not a template of content/placement`);
      continue;
    }
    const optionIds = new Set((template.question?.options ?? []).map((o) => o.id));
    for (const [field, value] of Object.entries(entry)) {
      const option = OPTION_GLOSS.exec(field);
      if (field !== "gloss" && option === null) {
        add("overlay-forbidden-field", `${at}.${field}`, `only gloss and options.<id>.gloss may be translated (got ${field})`);
      } else if (typeof value !== "string") {
        add("overlay-bad-shape", `${at}.${field}`, "a translated field must be a string");
      } else if (option !== null && !optionIds.has(option[1])) {
        add("overlay-unknown-option", `${at}.${field}`, `${id} has no option ${option[1]}`);
      }
    }
  }
}

/**
 * tree: Map<relative path with "/", parsed JSON> of every content file.
 * Returns [{ file, path, rule }] with rule "<name>: <message>".
 */
export function checkPlacementTree(tree) {
  const out = [];
  const strandFiles = [...tree.keys()].filter(isStrandFile).sort();
  const overlays = [...tree.keys()].filter((rel) => OVERLAY_FILE.test(rel)).sort();
  if (strandFiles.length === 0 && !tree.has(`${PLACEMENT_DIR}index.json`) && overlays.length === 0) return out;

  const seen = new Set();
  for (const rel of strandFiles) checkStrandFile(rel, tree.get(rel), out, seen);
  checkIndex(tree, strandFiles, seen, out);

  const templates = new Map();
  for (const rel of strandFiles) {
    const body = tree.get(rel);
    for (const t of isObject(body) && Array.isArray(body.templates) ? body.templates : []) {
      if (isObject(t) && typeof t.id === "string") templates.set(t.id, t);
    }
  }
  for (const rel of overlays) checkOverlay(rel, tree.get(rel), OVERLAY_FILE.exec(rel)[1], templates, out);
  return out;
}
