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
//   banned-on-learner-surface  a learner-banned word of the locale (banned-words.json)
//   overlay-missing          warning (error for HANGUL_ROUTE_STRICT_LOCALES): a translatable
//                            English field of a base entity that the locale lacks

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
  if (HANGUL.test(value) && (locale === "es" || !allowed)) add("korean-in-ui-field");
  const banned = bannedWordIn(value, locale);
  if (banned !== null) add(`banned-on-learner-surface: "${banned}"`);
  if (!allowed || base === undefined) return;

  const missing = missingSelector(base, field);
  if (missing !== null) return add(`overlay-unknown-id: ${id} has no ${missing.collection} element ${missing.key}`);

  for (const path of overlayTargets(base, field)) {
    const key = path[path.length - 1];
    const holder = getIn(base, path.slice(0, -1));
    if (locale === "ko" && (key === "en" || key === "gloss_en") && typeof holder?.ko === "string") {
      if (value.trim() === holder.ko.trim()) add(`overlay-circular-gloss: the Korean gloss repeats the taught ${holder.ko}`);
      else if (bare(value) === bare(holder.ko)) {
        ctx.warnings.push({ file: ctx.current, path: `entries.${id}.${field}`, rule: `overlay-circular-gloss: the Korean gloss only wraps ${holder.ko}; describe it instead` });
      }
    }
    if (overlayPrefix(id) === "story" && /^scenes\.[^.]+\.narration$/.test(field)) {
      const want = tokenList(String(getIn(base, path)));
      const got = tokenList(value);
      if (want.join(",") !== got.join(",")) {
        add(`overlay-token-mismatch: the narration needs exactly the tokens ${want.join(", ") || "(none)"}; found ${got.join(", ") || "(none)"}`);
      }
    }
  }
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
      for (const { field } of translatableFields(id, entity)) {
        if (typeof entry[field] === "string" && entry[field].trim() !== "") continue;
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
