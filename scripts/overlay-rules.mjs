// F-I18N-001 §3.7 — validator rules for locale overlays (content/i18n/<locale>/<domain>.json).
// Pure functions over already-parsed JSON (plain Node, no zod), called by
// scripts/validate-content.mjs. Also the one implementation behind the overlay checks
// of the vocabulary gate (F-VOC-001 `vocab-overlay`), the story gate (F-STORY-001) and
// the placement bank (F-PLC-001 `pitem:` fields): those reuse these rules, never
// redefine them.
//
// Rules (violations unless noted):
//   overlay-bad-shape        not content/i18n/<es|ko>/<domain>.json holding exactly
//                            { locale (= folder), domain (= file name), entries }; an entry
//                            that is not an object of non-blank strings; a bad entity id;
//                            an entity in two files of one locale
//   overlay-unknown-id       an id in no base content/**/*.json entity (ids of
//                            TypeScript-resident prefixes are left to
//                            apps/mobile/src/content/__tests__/overlays.test.ts), or a path
//                            naming an element the entity does not have
//   overlay-forbidden-field  a field outside OVERLAY_FIELDS for the id prefix
//   korean-in-ui-field       es: Hangul in any value; ko: Hangul outside translatable fields
//   overlay-circular-gloss   a ko gloss equal to the Korean it glosses (warning when it only
//                            wraps it in spaces or punctuation)
//   overlay-token-mismatch   a story narration whose {kw:id} tokens are not the base multiset
//                            of the tier it lands on (scenes.<id>.narration: the primary
//                            tier; tiers.<level>.scenes.<id>.narration: that tier)
//   overlay-ko-copula        a ko lesson overlay (lessons-*.json) with '라는' / '라고' / '예요'
//                            straight after a syllable that ends in a final consonant ('물건라는'
//                            for '물건이라는'); a final ㄹ is left alone, where '라는' is a verb form
//                            ('달라는'), and so are place names in 라 ('신라는')
//   overlay-ko-particle      a ko lesson overlay with 를 / 와 after a final consonant, or 가 after
//                            a gloss head noun with one ('물건가' for '물건이')
//   gloss-repeats-romanization  an es gloss that opens with the romanization of the Korean it
//                            glosses, then ' (', ', ' or ' — ' ('gimbap (rollo de arroz con
//                            alga)'): the romanization is already on screen, so the gloss keeps
//                            only the meaning (F-CNT-001 §3; the romanization is F-CNT-002's).
//                            validate-content.mjs applies the same rule (glossRepeatsRomanization)
//                            to the English base content
//   banned-on-learner-surface  a learner-banned word of the locale (banned-words.json)
//   overlay-shadowed         warning: an entry gives both the untiered and the tier-qualified
//                            field for one primary-tier scene; the tier-qualified one wins
//   overlay-missing          warning (error for HANGUL_ROUTE_STRICT_LOCALES): a translatable
//                            English field of a base entity that the locale lacks, counted
//                            per story tier (a read-tier scene needs its tiers.read.* field;
//                            a primary-tier scene is covered by either form)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OVERLAY_ENTITY_ID,
  OVERLAY_FIELDS,
  OVERLAY_LOCALES,
  TS_RESIDENT_PREFIXES,
  isOverlayFieldAllowed,
  missingSelector,
  overlayPrefix,
  overlayTargets,
  translatableFields,
} from "./overlay-fields.mjs";

const HANGUL = /[ㄱ-㆏가-힣]/;
const TOKEN = /\{kw:([a-z0-9-]+)\}/g;
/** A story narration overlay field, untiered or tier-qualified. */
const STORY_NARRATION = /^(tiers\.[^.]+\.)?scenes\.[^.]+\.narration$/;
const I18N_DIR = "content/i18n/";
const SKIPPED_BASE = ["content/i18n/", "content/fixtures/", "content/stories/research/"];

// ---- banned words (packages/i18n/src/banned-words.json, the one list) --------------

const BANNED = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "i18n", "src", "banned-words.json"), "utf8"),
);
// Explicit letter ranges, as in packages/i18n/src/banned.ts (no \p{L}, no look-behind).
const TOKEN_SPLIT = /[^a-zà-ɏ0-9]+/;
const tokens = (text) => text.toLowerCase().split(TOKEN_SPLIT).filter((t) => t !== "");

/** The first learner-banned word of `locale` in `text`, or null (token match for en/es, substring for ko). */
export function bannedWordIn(text, locale) {
  const words = BANNED[locale]?.learner ?? [];
  if (locale === "ko") return words.find((w) => text.includes(w)) ?? null;
  const haystack = ` ${tokens(text).join(" ")} `;
  return words.find((w) => haystack.includes(` ${tokens(w).join(" ")} `)) ?? null;
}

// ---- helpers -------------------------------------------------------------------------

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function getIn(root, path) {
  let node = root;
  for (const key of path) node = node?.[key];
  return node;
}

/** Hangul and letters/digits only: what is left of a gloss once spaces and punctuation go. */
const bare = (s) => s.replace(/[^ㄱ-㆏가-힣a-z0-9]/gi, "");

const tokenList = (text) => Array.from(text.matchAll(TOKEN), (m) => m[1]).sort();

/**
 * A Discover pattern note of a lesson quest (F-CURR-001 §3.4, §3.10): its Korean sits in
 * `{ko:...}` tokens that render as taught Korean with their romanization, so a translation
 * keeps exactly the tokens of the English note, and the Hangul inside them is not UI text.
 */
const KO_TOKEN = /\{ko:([^}]*)\}/g;
const LESSON_NOTE_FIELD = /^steps\.[^.]+\.discover\.pages\.[^.]+\.items\.[^.]+\.note$/;
const isLessonNote = (id, field) => /^quest:stage[2-467]-/.test(id) && LESSON_NOTE_FIELD.test(field);
const koTokenList = (text) => Array.from(text.matchAll(KO_TOKEN), (m) => m[1]).sort();

/**
 * id -> { entity, file } for every object with an entity id in the base content (first
 * one wins). Test fixtures, research data and `_*.json` registries (the vocabulary sense
 * registry lists ids it does not define) are not translatable entities.
 */
function baseEntities(tree) {
  const out = new Map();
  for (const [file, json] of tree) {
    if (SKIPPED_BASE.some((p) => file.startsWith(p)) || file.split("/").pop().startsWith("_")) continue;
    const walk = (value) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (!isObject(value)) return;
      if (typeof value.id === "string" && OVERLAY_ENTITY_ID.test(value.id) && !out.has(value.id)) {
        out.set(value.id, { entity: value, file });
      }
      Object.values(value).forEach(walk);
    };
    walk(json);
  }
  return out;
}

/**
 * F-CURR-001 §3.8 pass 6: the copula is '이라는' / '이라고' / '이에요' after a final consonant and
 * '라는' / '라고' / '예요' after a vowel. Returns the first wrong word ("물건라는", "{ko:책}라는",
 * "책예요") of `text`, or null. The syllable before the ending is the one in the text, or the
 * last one of a `{ko:...}` token right before it. A final ㄹ (jongseong 8) is skipped: there
 * '라는' / '라고' is mostly a verb form ('달라는' from 달라 "give me", '놀라고'), which a text rule
 * cannot tell from a noun. Place names that end in 라 ('신라는' is 신라 + 는) are skipped too.
 */
const FINAL_RIEUL = 8;
const KO_NOUNS_ENDING_IN_RA = ["신라", "전라"];
const jongseong = (syllable) => (syllable.charCodeAt(0) - 0xac00) % 28;
export function koCopulaSlip(text) {
  for (const m of text.matchAll(/(\{ko:[^}]*\}|[가-힣]+)(라는|라고|예요)/g)) {
    const before = m[1].startsWith("{ko:") ? m[1].slice(4, -1) : m[1];
    const last = before.slice(-1);
    if (!/[가-힣]/.test(last)) continue;
    if (m[2] !== "예요" && KO_NOUNS_ENDING_IN_RA.some((noun) => `${before}라`.endsWith(noun))) continue;
    const jong = jongseong(last);
    if (jong !== 0 && jong !== FINAL_RIEUL) return `${m[1]}${m[2]}`;
  }
  return null;
}

/**
 * F-CURR-001 §3.8 pass 6 follow-up: after a final consonant the subject, object and "and"
 * particles are 이 / 을 / 과, not 가 / 를 / 와. Returns the first wrong word ("물건가", "책를") of
 * `text`, or null. 를 and 와 are flagged after any final consonant at the end of a word. 가 is
 * flagged only after the head nouns that ko glosses define with ("읽는 물건", "...하는 동물"),
 * because many real words end in a final consonant + 가 (작가, 국가, 누군가, 있는가).
 */
const KO_GLOSS_HEAD_NOUNS = ["물건", "동물", "음식", "사람", "과일", "운동"];
export function koParticleSlip(text) {
  for (const m of text.matchAll(/(\{ko:[^}]*\}|[가-힣]+)(를|와)(?![가-힣])/g)) {
    const before = m[1].startsWith("{ko:") ? m[1].slice(4, -1) : m[1];
    const last = before.slice(-1);
    if (/[가-힣]/.test(last) && jongseong(last) !== 0) return `${m[1]}${m[2]}`;
  }
  const head = new RegExp(`(?<![가-힣])(${KO_GLOSS_HEAD_NOUNS.join("|")})가(?![가-힣])`).exec(text);
  return head === null ? null : `${head[1]}가`;
}
const isKoLessonOverlay = (rel) => /^content\/i18n\/ko\/lessons-[^/]+\.json$/.test(rel);

// ---- gloss-repeats-romanization (F-CNT-001 §3) ------------------------------------------

/**
 * Proper names whose English is the name itself, then what it is ("Seoul (a city)", "Heo Jun,
 * a Joseon court doctor"): a name has no meaning to give instead, so the gloss may open with it.
 * Keyed by the taught Korean. A common noun is never listed: its gloss is the meaning alone
 * ("seaweed rice roll" for 김밥), and a loanword equal to its English ("banana") has no separator.
 */
export const GLOSS_NAME_ALLOWLIST = Object.freeze([
  "서울",
  "부산",
  "대전",
  "대구",
  "추석",
  "한가위",
  "단오",
  "아리랑",
  "동의보감",
  "허준",
  "장영실",
  "장경판전",
  "조선",
  "고려",
  "직지",
  "호야",
]);
const GLOSS_NAMES = new Set(GLOSS_NAME_ALLOWLIST);
const GLOSS_SEPARATORS = [" (", ", ", " — "];
/** One compatibility jamo: a letter's sound hint ("A — sounds like ...") names its own sound. */
const SINGLE_JAMO = /^[ㄱ-ㆎ]$/;
/** NFD, lower case, letters only: "Heo Jun" and "Heojun", "hanbók" and "hanbok" compare equal. */
const lettersOf = (text) => text.normalize("NFD").toLowerCase().replace(/[^a-z]/g, "");

/**
 * True when `gloss` opens with the romanization of `ko` followed by " (", ", " or " — ", outside
 * the name allowlist and the jamo sound hints. Pure; shared by the base and overlay checks.
 */
export function glossRepeatsRomanization({ ko, romanization, gloss }) {
  if (typeof ko !== "string" || typeof romanization !== "string" || typeof gloss !== "string") return false;
  const word = ko.trim();
  if (GLOSS_NAMES.has(word) || SINGLE_JAMO.test(word)) return false;
  const rom = lettersOf(romanization);
  if (rom === "") return false;
  return GLOSS_SEPARATORS.some((sep) => {
    const at = gloss.indexOf(sep);
    return at > 0 && lettersOf(gloss.slice(0, at)) === rom;
  });
}

/** The violation text of the rule (one wording for the base content and the overlays). */
export const glossRepeatsRule = (gloss, romanization) =>
  `gloss-repeats-romanization: "${gloss}" opens with its romanization ${romanization}, which is already shown; keep only the meaning`;

// ---- one overlay file ------------------------------------------------------------------

function checkFile(rel, body, ctx) {
  const add = (rule, path) => ctx.violations.push({ file: rel, path, rule });
  const parts = rel.slice(I18N_DIR.length).split("/");
  if (parts.length !== 2) return add("overlay-bad-shape: an overlay lives at content/i18n/<locale>/<domain>.json", "(root)");
  const [locale, name] = parts;
  if (!OVERLAY_LOCALES.includes(locale)) {
    const why = locale === "en" ? "English is the source language and has no overlay" : `${locale} is not an overlay locale (es, ko)`;
    return add(`overlay-bad-shape: ${why}`, "(root)");
  }
  const domain = name.replace(/\.json$/, "");
  if (!isObject(body)) return add("overlay-bad-shape: an overlay file is { locale, domain, entries }", "(root)");
  const extra = Object.keys(body).filter((k) => !["locale", "domain", "entries"].includes(k));
  if (extra.length > 0) add(`overlay-bad-shape: unexpected key(s) ${extra.join(", ")}`, "(root)");
  if (body.locale !== locale) add(`overlay-bad-shape: locale ${JSON.stringify(body.locale)} differs from its folder ${locale}`, "locale");
  if (body.domain !== domain) add(`overlay-bad-shape: domain ${JSON.stringify(body.domain)} differs from the file name ${domain}`, "domain");
  if (!isObject(body.entries)) return add("overlay-bad-shape: entries must be an object keyed by entity id", "entries");

  for (const [id, entry] of Object.entries(body.entries)) {
    const at = `entries.${id}`;
    if (!OVERLAY_ENTITY_ID.test(id)) {
      add(`overlay-bad-shape: ${JSON.stringify(id)} is not an entity id (<prefix>:<id>)`, at);
      continue;
    }
    if (!isObject(entry)) {
      add("overlay-bad-shape: an entry is an object of translated fields", at);
      continue;
    }
    const owner = ctx.owner.get(`${locale}:${id}`);
    if (owner !== undefined) {
      add(`overlay-bad-shape: ${id} is also in ${owner}; an entity belongs to one overlay file`, at);
      continue;
    }
    ctx.owner.set(`${locale}:${id}`, rel);
    ctx.entries[locale].set(id, entry);

    const base = ctx.base.get(id)?.entity;
    if (base === undefined && !TS_RESIDENT_PREFIXES.includes(overlayPrefix(id))) {
      add(`overlay-unknown-id: ${id} is in no content/**/*.json entity`, at);
      continue;
    }
    for (const [field, value] of Object.entries(entry)) checkField(locale, id, field, value, base, (rule) => add(rule, `${at}.${field}`), ctx);
  }
}

function checkField(locale, id, field, value, base, add, ctx) {
  if (typeof value !== "string" || value.trim() === "") return add("overlay-bad-shape: a translated field is a non-blank string");
  const allowed = isOverlayFieldAllowed(id, field);
  if (!allowed) add(`overlay-forbidden-field: ${field} cannot be translated on ${id}`);
  const shown = isLessonNote(id, field) ? value.replace(KO_TOKEN, " ") : value;
  if (HANGUL.test(shown) && (locale === "es" || !allowed)) add("korean-in-ui-field");
  const banned = bannedWordIn(value, locale);
  if (banned !== null) add(`banned-on-learner-surface: "${banned}"`);
  if (locale === "ko" && isKoLessonOverlay(ctx.current)) {
    const slip = koCopulaSlip(value);
    if (slip !== null) add(`overlay-ko-copula: "${slip}" needs 이 after a final consonant (${slip.slice(0, -2)}이${slip.endsWith("예요") ? "에요" : slip.slice(-2)})`);
    const particle = koParticleSlip(value);
    if (particle !== null) {
      const right = { 가: "이", 를: "을", 와: "과" }[particle.slice(-1)];
      add(`overlay-ko-particle: "${particle}" needs ${right} after a final consonant (${particle.slice(0, -1)}${right})`);
    }
  }
  if (!allowed || base === undefined) return;

  const missing = missingSelector(base, field);
  if (missing !== null) {
    const elsewhere = untieredSceneElsewhere(id, field, base);
    if (elsewhere !== null) {
      return add(
        `overlay-unknown-id: ${id} has no primary-tier scene ${elsewhere.scene}; untiered scenes.* reach only the primary tier (listen when the story has one), so write tiers.${elsewhere.level}.${field}`,
      );
    }
    return add(`overlay-unknown-id: ${id} has no ${missing.collection} element ${missing.key}`);
  }

  for (const path of overlayTargets(base, field)) {
    const key = path[path.length - 1];
    const holder = getIn(base, path.slice(0, -1));
    if (
      locale === "es" &&
      (key === "en" || key === "gloss_en") &&
      glossRepeatsRomanization({ ko: holder?.ko, romanization: holder?.romanization, gloss: value })
    ) {
      add(glossRepeatsRule(value, holder.romanization));
    }
    if (locale === "ko" && (key === "en" || key === "gloss_en") && typeof holder?.ko === "string") {
      if (value.trim() === holder.ko.trim()) add(`overlay-circular-gloss: the Korean gloss repeats the taught ${holder.ko}`);
      else if (bare(value) === bare(holder.ko)) {
        ctx.warnings.push({ file: ctx.current, path: `entries.${id}.${field}`, rule: `overlay-circular-gloss: the Korean gloss only wraps ${holder.ko}; describe it instead` });
      }
    }
    if (isLessonNote(id, field)) {
      const want = koTokenList(String(getIn(base, path)));
      const got = koTokenList(value);
      if (want.join(",") !== got.join(",")) {
        add(`overlay-token-mismatch: the note needs exactly the tokens ${want.join(", ") || "(none)"}; found ${got.join(", ") || "(none)"}`);
      }
    }
    if (overlayPrefix(id) === "story" && STORY_NARRATION.test(field)) {
      const want = tokenList(String(getIn(base, path)));
      const got = tokenList(value);
      if (want.join(",") !== got.join(",")) {
        add(`overlay-token-mismatch: the narration needs exactly the tokens ${want.join(", ") || "(none)"}; found ${got.join(", ") || "(none)"}`);
      }
    }
  }
}

/**
 * An untiered story `scenes.<id>.<field>` whose scene is not in the primary tier but is in
 * another one: `{ scene, level }` of the first such tier, so the error can name the
 * tier-qualified key to write instead. Null otherwise.
 */
function untieredSceneElsewhere(id, field, base) {
  if (overlayPrefix(id) !== "story" || !Array.isArray(base?.tiers)) return null;
  const match = /^scenes\.([^.]+)\./.exec(field);
  if (match === null) return null;
  const tier = base.tiers.find((t) => isObject(t) && Array.isArray(t.scenes) && t.scenes.some((sc) => isObject(sc) && sc.id === match[1]));
  return tier === undefined || typeof tier.level !== "string" ? null : { scene: match[1], level: tier.level };
}

// ---- the whole tree ------------------------------------------------------------------

/**
 * tree: Map<path relative to the repo root with "/", parsed JSON> of every content file.
 * Returns { violations, warnings, missing: { es, ko } } with { file, path, rule } items,
 * rule "<name>" or "<name>: <message>".
 */
export function checkOverlayTree(tree, { strictLocales = [] } = {}) {
  const ctx = {
    base: baseEntities(tree),
    violations: [],
    warnings: [],
    owner: new Map(),
    entries: Object.fromEntries(OVERLAY_LOCALES.map((l) => [l, new Map()])),
    current: "",
  };
  const overlays = [...tree.keys()].filter((rel) => rel.startsWith(I18N_DIR)).sort();
  for (const rel of overlays) {
    ctx.current = rel;
    checkFile(rel, tree.get(rel), ctx);
  }

  const missing = Object.fromEntries(OVERLAY_LOCALES.map((l) => [l, 0]));
  for (const locale of OVERLAY_LOCALES) {
    const strict = strictLocales.includes(locale);
    const byFile = new Map(); // base file -> { fields: [], entities: Set }
    for (const [id, { entity, file }] of ctx.base) {
      if (OVERLAY_FIELDS[overlayPrefix(id)] === undefined) continue;
      const entry = ctx.entries[locale].get(id) ?? {};
      for (const { field, alternates = [] } of translatableFields(id, entity)) {
        const given = [field, ...alternates].filter((key) => typeof entry[key] === "string" && entry[key].trim() !== "");
        if (given.length > 1) {
          ctx.warnings.push({
            file: ctx.owner.get(`${locale}:${id}`) ?? file,
            path: `entries.${id}.${given[0]}`,
            rule: `overlay-shadowed: ${given.join(" and ")} translate the same English; ${given[given.length - 1]} wins, so drop ${given.slice(0, -1).join(", ")}`,
          });
        }
        if (given.length > 0) continue;
        missing[locale] += 1;
        if (strict) {
          ctx.violations.push({
            file: ctx.owner.get(`${locale}:${id}`) ?? file,
            path: `${id}.${field}`,
            rule: `overlay-missing: no ${locale} translation of ${id}.${field}`,
          });
          continue;
        }
        const group = byFile.get(file) ?? { fields: [], entities: new Set() };
        group.fields.push(`${id}.${field}`);
        group.entities.add(id);
        byFile.set(file, group);
      }
    }
    for (const [file, { fields, entities }] of [...byFile].sort(([a], [b]) => (a < b ? -1 : 1))) {
      ctx.warnings.push({
        file,
        path: "(root)",
        rule: `overlay-missing: ${locale} lacks ${fields.length} translatable field(s) of ${entities.size} entit${entities.size === 1 ? "y" : "ies"}, e.g. ${fields.slice(0, 3).join(", ")}`,
      });
    }
  }
  return { violations: ctx.violations, warnings: ctx.warnings, missing };
}
