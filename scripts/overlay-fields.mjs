// F-I18N-001 §3.6 — the overlay allow-list and path rules for plain-Node scripts.
//
// Mirror of packages/content-schema/src/schemas/locale-overlay.ts (OVERLAY_FIELDS,
// isOverlayFieldAllowed) and packages/content-schema/src/localize.ts (overlayElementKey,
// overlayTargets, translatableFields). The scripts cannot import TypeScript, so the
// table lives here twice; packages/content-schema/src/__tests__/locale-overlay-mirror.test.ts
// compares the table and runs both implementations over the same entities, so the two
// cannot drift. Used by scripts/build-overlays.mjs and scripts/overlay-rules.mjs.

/** Locales that have overlays; English is the source. */
export const OVERLAY_LOCALES = Object.freeze(["es", "ko"]);

/** `<prefix>:<rest>` */
export const OVERLAY_ENTITY_ID = /^[a-z0-9-]+:[a-z0-9-:.]+$/;

/**
 * id prefix -> translatable fields (`En` stripped) or dotted paths, `<name>` = an array
 * element's key. Rows story: (F-STORY-001 §3.12), vocab: / vocab-topic: (F-VOC-001 §3.7)
 * and pitem: (F-PLC-001 §3.4) are those specs' additions.
 */
export const OVERLAY_FIELDS = Object.freeze({
  jamo: ["gloss", "soundHint", "exampleWord.gloss", "nameHint"],
  card: ["title", "blurb", "fact"],
  episode: ["title", "subtitle", "hoyaIntro"],
  quest: [
    "title",
    "blurb",
    "teaser",
    "steps.<stepId>.title",
    "steps.<stepId>.body",
    "steps.<stepId>.hoyaLine",
    "steps.<stepId>.discover.pages.<page>.caption",
    "steps.<stepId>.discover.pages.<page>.items.<item>.example.gloss",
    "steps.<stepId>.discover.pages.<page>.items.<item>.word.gloss",
    "steps.<stepId>.discover.pages.<page>.items.<item>.note",
    // F-CURR-001 §3.10: the upper-stage Discover items (sentence, pattern, exchange, realia).
    "steps.<stepId>.discover.pages.<page>.items.<item>.sentence.gloss",
    "steps.<stepId>.discover.pages.<page>.items.<item>.frame.gloss",
    "steps.<stepId>.discover.pages.<page>.items.<item>.examples.<example>.gloss",
    "steps.<stepId>.discover.pages.<page>.items.<item>.lines.<line>.speaker",
    "steps.<stepId>.discover.pages.<page>.items.<item>.lines.<line>.line.gloss",
    "steps.<stepId>.discover.pages.<page>.items.<item>.keyWords.<word>.gloss",
    "steps.<stepId>.discover.pages.<page>.items.<item>.caption",
  ],
  minigame: [
    "cardPairs.<pair>.gloss",
    "storySteps.<stepId>.label",
    "dialogue.<turn>.npc",
    "dialogue.<turn>.options.<option>.gloss",
    "listenPick.rounds.<roundId>.prompt",
    // F-CURR-001 §3.10: the lesson scopes of the upper-stage games (build-lessons.mjs runtime shape).
    // F-CURR-001 §3.10: a lesson's Pic-Word Match pair, whose gloss the word tile and the picture's
    // text fallback show; a board has no id, so `<board>` is its index.
    "picWord.boards.<board>.pairs.<pair>.word.gloss",
    "orderIt.rounds.<roundId>.sentence.gloss",
    "orderIt.rounds.<roundId>.distractors.<tile>.gloss",
    "orderIt.rounds.<roundId>.particle.choices.<choice>.gloss",
    "realiaRead.realia.alt",
    "realiaRead.realia.title.gloss",
    "realiaRead.realia.entries.<entry>.text.gloss",
    "realiaRead.realia.entries.<entry>.value.gloss",
    "realiaRead.rounds.<roundId>.question",
    "realiaRead.rounds.<roundId>.options.<option>.text.gloss",
    "realiaRead.rounds.<roundId>.options.<option>.label",
    "typeHangul.rounds.<roundId>.prompt",
    "typeHangul.rounds.<roundId>.target.gloss",
    "traceWord.rounds.<roundId>.word.gloss",
    "writeFrame.rounds.<roundId>.frame.gloss",
    "writeFrame.rounds.<roundId>.slots.<slot>.bank.<word>.gloss",
  ],
  stage: ["title", "oneLiner", "anchorSkill"],
  theme: ["title", "oneLiner", "anchorSkill"],
  story: [
    "title",
    "summary",
    "hoyaIntro",
    "hoyaOutro",
    "scenes.<sceneId>.narration",
    "scenes.<sceneId>.caption",
    "scenes.<sceneId>.alt",
    // Tier-qualified scenes: `<level>` is the tier's level (listen, read); wins over the untiered
    // form, which reaches the primary tier only.
    "tiers.<level>.scenes.<sceneId>.narration",
    "tiers.<level>.scenes.<sceneId>.caption",
    "tiers.<level>.scenes.<sceneId>.alt",
    "keywords.<keywordId>.gloss",
    "checks.<checkId>.prompt",
    "checks.<checkId>.explain",
    "checks.<checkId>.hint",
    "checks.<checkId>.options.<optionId>",
    "cultureNotes.<noteId>.title",
    "cultureNotes.<noteId>.body",
    "facts.<factId>.claim",
    "errata.<erratumId>.summary",
  ],
  vocab: ["gloss", "senseNote"],
  "vocab-topic": ["title", "blurb", "hoyaIntro"],
  pitem: ["gloss", "options.<optionId>.gloss"],
});

/** Never overridable, whatever the prefix. */
export const NEVER_OVERRIDABLE_FIELDS = Object.freeze([
  "ko",
  "char",
  "romanization",
  "target",
  "answer_ko",
  "lang_ko",
  "audioRef",
  "id",
  "order",
  "sound",
  "pictureRef",
  "visual",
]);

/**
 * Prefixes whose shipped base content is still TypeScript in apps/mobile/src/content
 * (§3.6 interim): an id of these prefixes that is in no content/**\/*.json entity is
 * checked by apps/mobile/src/content/__tests__/overlays.test.ts, not by the validator.
 */
export const TS_RESIDENT_PREFIXES = Object.freeze(["jamo", "card", "episode", "quest", "minigame", "stage", "theme"]);

export function overlayPrefix(entityId) {
  const at = entityId.indexOf(":");
  return at <= 0 ? "" : entityId.slice(0, at);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERNS = Object.fromEntries(
  Object.entries(OVERLAY_FIELDS).map(([prefix, fields]) => [
    prefix,
    fields.map(
      (field) =>
        new RegExp(`^${field.split(".").map((seg) => (seg.startsWith("<") ? "[a-z0-9-]+" : escape(seg))).join("\\.")}$`),
    ),
  ]),
);

export function isOverlayFieldAllowed(entityId, field) {
  if (!OVERLAY_ENTITY_ID.test(entityId)) return false;
  const patterns = PATTERNS[overlayPrefix(entityId)];
  return patterns !== undefined && patterns.some((re) => re.test(field));
}

// ---- path rules (mirror of localize.ts) ---------------------------------------------

const isRec = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const COLLECTION_ALIASES = { checks: ["checks", "checkpoints"] };
/** Story tiers, keyed by their `level`; collections whose ids repeat per tier (untiered = primary tier only). */
const TIERS = "tiers";
const TIER_SCOPED = ["scenes"];
/** Top-level hints an overlay may add although the English base has none (§3.5.6). */
const ADDITIVE_FIELDS = ["soundHint", "nameHint"];

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** An id / key as a path segment: slugged when plain ASCII, none when it carries Korean. */
function segmentOf(value) {
  if (typeof value !== "string" || !/^[\x20-\x7e]+$/.test(value)) return undefined;
  if (/^[a-z0-9-]+$/.test(value)) return value;
  const key = slug(value);
  return key === "" ? undefined : key;
}

export function overlayElementKey(element, index) {
  if (isRec(element)) {
    const key = segmentOf(element.id) ?? segmentOf(element.key);
    if (key !== undefined) return key;
    if (typeof element.romanization === "string") {
      const romanized = slug(element.romanization);
      if (romanized !== "") return romanized;
    }
  }
  return String(index);
}

/** The index of the primary tier: the `listen` tier, else the first. */
function primaryTier(tiers) {
  const listen = tiers.findIndex((tier) => isRec(tier) && tier.level === "listen");
  return listen < 0 ? 0 : listen;
}

/** The key of an element of the array named `collection`: a story tier by its `level`, else `overlayElementKey`. */
function elementKey(collection, element, index) {
  if (collection === TIERS && isRec(element)) {
    const level = segmentOf(element.level);
    if (level !== undefined) return level;
  }
  return overlayElementKey(element, index);
}

function leafTargets(node, name, at) {
  if (typeof node[`${name}En`] === "string") return [[...at, `${name}En`]];
  const own = node[name];
  if (typeof own === "string") return [[...at, name]];
  if (isRec(own) && typeof own.en === "string") return [[...at, name, "en"]];
  if (name === "gloss") {
    if (typeof node.en === "string") return [[...at, "en"]];
    if (typeof node.gloss_en === "string") return [[...at, "gloss_en"]];
  }
  return [];
}

function collections(node, name, at) {
  const names = COLLECTION_ALIASES[name] ?? [name];
  const out = [];
  const walk = (value, path) => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, [...path, i]));
      return;
    }
    if (!isRec(value)) return;
    for (const [k, v] of Object.entries(value)) {
      if (names.includes(k) && Array.isArray(v)) out.push([v, [...path, k]]);
      else if (k === TIERS && Array.isArray(v) && TIER_SCOPED.includes(name) && v.length > 0) {
        const primary = primaryTier(v);
        walk(v[primary], [...path, k, primary]);
      } else walk(v, [...path, k]);
    }
  };
  walk(node, at);
  return out;
}

function arraysAt(node, head, at) {
  const child = node[head];
  if (Array.isArray(child)) return [[child, [...at, head]]];
  return child === undefined ? collections(node, head, at) : [];
}

function resolve(node, segs, at) {
  if (!isRec(node)) return [];
  const [head, ...rest] = segs;
  if (head === undefined) return typeof node.en === "string" ? [[...at, "en"]] : [];
  if (rest.length === 0) {
    const targets = leafTargets(node, head, at);
    return targets.length === 0 && at.length === 0 && ADDITIVE_FIELDS.includes(head) && node[head] === undefined ? [[head]] : targets;
  }
  const child = node[head];
  if (isRec(child)) return resolve(child, rest, [...at, head]);
  if (child === undefined && rest.length === 1 && rest[0] === "gloss" && typeof node[`${head}En`] === "string") {
    return [[...at, `${head}En`]];
  }
  const [selector, ...after] = rest;
  return arraysAt(node, head, at).flatMap(([items, path]) =>
    items.flatMap((item, i) => (elementKey(head, item, i) === selector ? resolve(item, after, [...path, i]) : [])),
  );
}

/** Concrete source paths inside `entity` that `field` lands on. */
export function overlayTargets(entity, field) {
  return resolve(entity, field.split("."), []);
}

/**
 * The first array-element selector of a concrete `field` that matches nothing in
 * `entity` (`{ collection, key }`, e.g. a scene id the story does not have), or null.
 * A leaf that is merely absent is not a selector problem.
 */
export function missingSelector(entity, field) {
  const walk = (node, segs) => {
    if (!isRec(node)) return null;
    const [head, ...rest] = segs;
    if (head === undefined || rest.length === 0) return null;
    const child = node[head];
    if (isRec(child)) return walk(child, rest);
    if (child === undefined && rest.length === 1 && rest[0] === "gloss") return null;
    const [selector, ...after] = rest;
    const hits = arraysAt(node, head, []).flatMap(([items]) =>
      items.filter((item, i) => elementKey(head, item, i) === selector),
    );
    if (hits.length === 0) return { collection: head, key: selector };
    const misses = hits.map((hit) => walk(hit, after));
    return misses.includes(null) ? null : misses[0];
  };
  return walk(entity, field.split("."));
}

function getIn(root, path) {
  let node = root;
  for (const key of path) node = node[key];
  return node;
}

function expand(node, segs, at, field) {
  if (!isRec(node)) return [];
  const [head, ...rest] = segs;
  if (head === undefined) return typeof node.en === "string" ? [[field.join("."), [...at, "en"]]] : [];
  if (rest.length === 0) return leafTargets(node, head, at).map((p) => [[...field, head].join("."), p]);
  if (rest[0].startsWith("<")) {
    return arraysAt(node, head, at).flatMap(([items, path]) =>
      items.flatMap((item, i) => expand(item, rest.slice(1), [...path, i], [...field, head, elementKey(head, item, i)])),
    );
  }
  const child = node[head];
  if (isRec(child)) return expand(child, rest, [...at, head], [...field, head]);
  if (child === undefined && rest.length === 1 && rest[0] === "gloss" && typeof node[`${head}En`] === "string") {
    return [[[...field, head, "gloss"].join("."), [...at, `${head}En`]]];
  }
  return [];
}

/**
 * Every translatable field the entity carries an English source for: `{ field, path, source,
 * alternates? }`, each source once; a later pattern landing on the same source (the
 * tier-qualified form of a primary-tier scene) is one of its `alternates`.
 */
export function translatableFields(entityId, entity) {
  const patterns = OVERLAY_FIELDS[overlayPrefix(entityId)] ?? [];
  const out = [];
  const bySource = new Map();
  for (const pattern of patterns) {
    for (const [field, path] of expand(entity, pattern.split("."), [], [])) {
      const at = path.join("\u0000");
      const first = bySource.get(at);
      if (first !== undefined) {
        first.alternates = [...(first.alternates ?? []), field];
        continue;
      }
      const row = { field, path, source: getIn(entity, path) };
      bySource.set(at, row);
      out.push(row);
    }
  }
  return out;
}
