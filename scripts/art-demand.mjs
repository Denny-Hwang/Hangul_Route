#!/usr/bin/env node
// F-STORY-002 §3.9.8 step 1 — scene-art demand report (PR 2.10a).
//
// Reads every scene's `artBrief` in content/stories/*.json (not recursive:
// research/ is provenance), matches it against scripts/art-lexicon.json
// (keyword or phrase -> candidate scene:/prop: ids, `hoya:*` for Hoya) and
// prints, per scene, the setting and props it seems to want and whether it has
// art yet; then the candidate ids the registry does not have, by frequency;
// then the brief words no lexicon entry covered, for a human to read.
//
// A planning aid, not an authority: the person composing the scene decides.
// The registry is read by scanning packages/design-system/src/scene-art/**.ts
// for quoted `scene:` / `prop:` ids (and HOYA_POSES), so the script stays
// dependency-free Node like the other scripts here.
//
// Usage:
//   node scripts/art-demand.mjs [--src content/stories] [--lexicon scripts/art-lexicon.json] [--json]
//
// Exit 0 with a report, 2 on a usage error. HANGUL_ROUTE_ROOT overrides the
// repo root (tests).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const STOP = new Set(
  "a an and are as at be beside behind below between by each for from has have her his in into is it its of on one or out over the their them then they this to two up with without while who whose very small large big little long old new some its at there here near next".split(
    " "
  )
);
const MIN_WORD = 4;

/** `{ entries: [{ match: string[], ids: string[] }], clusters?: {...} }` */
export function loadLexicon(path) {
  const lexicon = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(lexicon.entries)) throw new Error(`${path}: "entries" must be an array`);
  return lexicon;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phrase = (w) => new RegExp(`\\b${escape(w).replace(/ /g, "\\s+")}\\b`, "i");

/** The ids a brief seems to want: settings, props, and whether Hoya is in it. */
export function matchBrief(brief, lexicon) {
  const settings = new Set();
  const props = new Set();
  const matched = [];
  let hoya = false;
  for (const entry of lexicon.entries) {
    const hit = entry.match.find((w) => phrase(w).test(brief));
    if (!hit) continue;
    matched.push(hit);
    for (const id of entry.ids) {
      if (id.startsWith("hoya:")) hoya = true;
      else if (id.startsWith("scene:")) settings.add(id);
      else props.add(id);
    }
  }
  return { settings: [...settings], props: [...props], hoya, matched };
}

/** Brief words worth a human look: not a stop word, not short, not covered by a match. */
export function wordsOf(brief, matched) {
  let rest = brief;
  for (const m of matched) rest = rest.replace(new RegExp(phrase(m).source, "gi"), " ");
  return (rest.toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g) ?? []).filter((w) => w.length >= MIN_WORD && !STOP.has(w));
}

function tsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : tsFiles(path);
    return name.endsWith(".ts") ? [path] : [];
  });
}

/** Every id the scene-art registry can resolve, read from its sources. */
export function registryIds(root) {
  const dir = join(root, "packages", "design-system", "src", "scene-art");
  const ids = new Set();
  for (const file of tsFiles(dir)) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/id:\s*'((?:scene|prop):[a-z0-9-]+)'/g)) ids.add(m[1]);
    const poses = /HOYA_POSES\s*=\s*\[([^\]]*)\]/.exec(text);
    if (poses) for (const p of poses[1].matchAll(/'([a-z]+)'/g)) ids.add(`hoya:${p[1]}`);
  }
  return ids;
}

/** One row per scene of every top-level story file, in file and scene order. */
export function readScenes(dir) {
  const rows = [];
  for (const file of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const story = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const tier of story.tiers ?? []) {
      for (const scene of tier.scenes ?? []) {
        rows.push({
          file,
          storyId: story.id,
          level: tier.level,
          sceneId: scene.id,
          brief: scene.artBrief ?? "",
          status: scene.art ? "art" : scene.artPending ? "pending" : "none",
        });
      }
    }
  }
  return rows;
}

const byCount = (a, b) => b.count - a.count || (a.id ?? a.word).localeCompare(b.id ?? b.word);

export function demandReport(scenes, lexicon, registry) {
  const missing = new Map();
  const unmatched = new Map();
  const rows = scenes.map((s) => {
    const m = matchBrief(s.brief, lexicon);
    for (const id of [...m.settings, ...m.props]) if (!registry.has(id)) missing.set(id, (missing.get(id) ?? 0) + 1);
    for (const w of new Set(wordsOf(s.brief, m.matched))) unmatched.set(w, (unmatched.get(w) ?? 0) + 1);
    return { ...s, wants: { settings: m.settings, props: m.props, hoya: m.hoya } };
  });
  return {
    scenes: rows,
    missing: [...missing].map(([id, count]) => ({ id, count })).sort(byCount),
    unmatched: [...unmatched].map(([word, count]) => ({ word, count })).sort(byCount),
    counts: {
      scenes: rows.length,
      withArt: rows.filter((r) => r.status === "art").length,
      pending: rows.filter((r) => r.status === "pending").length,
      noBrief: rows.filter((r) => r.brief === "").length,
      withHoya: rows.filter((r) => r.wants.hoya).length,
    },
  };
}

export function renderReport(report) {
  const lines = [];
  const c = report.counts;
  lines.push(`Scenes: ${c.scenes} (art ${c.withArt}, pending ${c.pending}, no brief ${c.noBrief}, Hoya in brief ${c.withHoya})`, "");
  for (const r of report.scenes) {
    const w = r.wants;
    const parts = [
      `setting: ${w.settings.join(", ") || "?"}`,
      `props: ${w.props.join(", ") || "-"}`,
      ...(w.hoya ? ["hoya"] : []),
    ];
    lines.push(`${r.file} ${r.sceneId} [${r.status}] ${parts.join(" | ")}`);
  }
  lines.push("", "Missing items by frequency (candidate ids the registry does not have):");
  if (report.missing.length === 0) lines.push("  none");
  for (const m of report.missing) lines.push(`  ${m.count}  ${m.id}`);
  lines.push("", "Brief words no lexicon entry covers (top 40):");
  lines.push(`  ${report.unmatched.slice(0, 40).map((u) => `${u.word} ${u.count}`).join(", ") || "none"}`);
  return `${lines.join("\n")}\n`;
}

const USAGE = "Usage: node scripts/art-demand.mjs [--src <dir>] [--lexicon <file>] [--json]";

function parseArgs(argv) {
  const opts = { src: "content/stories", lexicon: "scripts/art-lexicon.json", json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") opts.json = true;
    else if (arg === "--src" || arg === "--lexicon") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) return { error: `${arg} needs a path` };
      opts[arg.slice(2)] = value;
      i += 1;
    } else return { error: `unknown argument ${arg}` };
  }
  return { opts };
}

export function main(argv, root) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    process.stderr.write(`${parsed.error}\n${USAGE}\n`);
    return 2;
  }
  const at = (p) => (isAbsolute(p) ? p : resolve(root, p));
  const report = demandReport(readScenes(at(parsed.opts.src)), loadLexicon(at(parsed.opts.lexicon)), registryIds(root));
  process.stdout.write(parsed.opts.json ? `${JSON.stringify(report, null, 2)}\n` : renderReport(report));
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const root = process.env.HANGUL_ROUTE_ROOT ? resolve(process.env.HANGUL_ROUTE_ROOT) : join(dirname(fileURLToPath(import.meta.url)), "..");
  process.exit(main(process.argv.slice(2), root));
}
