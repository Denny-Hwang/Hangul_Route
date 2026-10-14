#!/usr/bin/env node
// Third-party notices (owner decision 2026-10-14: Hangul Route is proprietary; LICENSE at the repository root).
//
// Walks the installed production dependency tree of the shipped apps and writes:
//   THIRD_PARTY_NOTICES.md                         the notices (package, version, license, copyright line,
//                                                  Apache NOTICE files, fonts and other non-npm assets, and the
//                                                  full text of every license named)
//   apps/web/src/data/third-party-notices.json     the same notices as data, for the site's /licenses page
//
// The shipped apps (ROOTS): the learner app (apps/mobile, web/PWA build), the site and grown-up console
// (apps/web) and the Worker (apps/api, which bundles packages/backend). From each, the walk follows
// `dependencies`, `optionalDependencies` and the required `peerDependencies` (an optional peer, such as Next's
// `@playwright/test`, is not part of the app), never `devDependencies`, resolving each name the way Node does from
// the real path of the package that asks for it (pnpm's layout puts every dependency beside its dependent). Workspace
// packages (`@hangul-route/*`) are walked but not listed: they are this project's own code, under LICENSE.
//
// Two lists add what the dependency fields do not name: EXTRA_SHIPPED (the Workbox runtime the PWA build copies into
// dist, from a devDependency) and NATIVE_COMPONENTS (the iOS app's CocoaPods libraries and the Hermes engine, which
// are not npm packages; versions read from the installed react-native).
//
// Platform-specific builds (a package.json with `os` or `cpu`, such as `@esbuild/linux-x64` or
// `lightningcss-darwin-arm64`) are checked against the license policy but not listed: which ones are installed
// depends on the machine, and each is published by its parent project under the parent's license. So the output is
// the same on macOS and on the Linux CI runner.
//
// License policy (`--check` fails on any of these):
//   - copyleft      a GPL, AGPL, LGPL, SSPL, EUPL, OSL, CDDL, EPL, MPL, CC-BY-SA, CC-BY-NC or CC-BY-ND license (or
//                   another in COPYLEFT). An `OR` expression passes when one of its choices is permissive (that
//                   choice is the one we take and the one printed); a package in REVIEWED_EXCEPTIONS passes with
//                   the reason printed beside it
//   - unknown       a license that is neither permissive (a text in scripts/third-party-notices/licenses/) nor
//                   copyleft, or no license at all: add the text and the id, or a LICENSE_OVERRIDES entry after
//                   reading the package
//   - stale         either output differs from what the walk produces (run this script without --check)
//
// Non-npm assets come from content/assets-license.csv; the SIL Open Font License text is the font's own
// apps/mobile/public/fonts/OFL.txt (it carries the font's copyright line).
//
// Usage: node scripts/third-party-notices.mjs [--check]
// Needs `pnpm install` first (the walk reads node_modules). Plain Node, no dependencies.

import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = process.env.HANGUL_ROUTE_ROOT ? resolve(process.env.HANGUL_ROUTE_ROOT) : resolve(SCRIPT_DIR, "..");

/** The shipped apps: the workspace directory and the short label printed in the "Used in" column. */
export const ROOTS = [
  { dir: "apps/mobile", label: "app" },
  { dir: "apps/web", label: "web" },
  { dir: "apps/api", label: "server" },
  { dir: "packages/backend", label: "server" },
];

/**
 * Code the apps ship that their `dependencies` do not name. The PWA's service worker: apps/mobile/scripts/
 * pwa-postbuild.mjs runs `generateSW` from workbox-build (a devDependency) without `inlineWorkboxRuntime`, so Workbox
 * copies its runtime (`workbox-<hash>.js`, built from these packages) into dist beside sw.js and precaches it. The
 * modules are the ones that runtime is built from for our config (precache, navigation fallback, runtime caching with
 * expiration and cacheable-response). Each is resolved from workbox-build's real path and walked like a dependency.
 */
export const EXTRA_SHIPPED = [
  {
    from: "apps/mobile",
    through: "workbox-build",
    label: "app",
    packages: ["workbox-core", "workbox-precaching", "workbox-routing", "workbox-strategies", "workbox-expiration", "workbox-cacheable-response"],
  },
];

/**
 * Native libraries the iOS app links that are not npm packages: React Native's CocoaPods pods
 * (react-native/third-party-podspecs and scripts/cocoapods/helpers.rb) and the Hermes engine. Expo's and React
 * Native's own native code ships inside their npm packages, which the walk already lists. The version is read from
 * the installed react-native, so an upgrade updates it (and `--check` reports the notices stale). License and
 * copyright lines were read from each project's upstream license file at that version. Before each App Store
 * submission the pod list in Podfile.lock is compared with this table (docs/launch/app-store-submission.md).
 */
export const NATIVE_COMPONENTS = [
  {
    name: "boost",
    license: "BSL-1.0",
    copyright: "Copyright the Boost authors (each source file names its own authors)",
    source: "https://www.boost.org",
    version: { file: "third-party-podspecs/boost.podspec", pattern: /spec\.version\s*=\s*['"]([^'"]+)['"]/ },
  },
  {
    name: "DoubleConversion",
    license: "BSD-3-Clause",
    copyright: "Copyright 2006-2011, the V8 project authors. All rights reserved.",
    source: "https://github.com/google/double-conversion",
    note: "the podspec says MIT; the upstream LICENSE file is BSD-3-Clause, which is applied",
    version: { file: "third-party-podspecs/DoubleConversion.podspec", pattern: /spec\.version\s*=\s*['"]([^'"]+)['"]/ },
  },
  {
    name: "fmt",
    license: "MIT",
    copyright: "Copyright (c) 2012 - present, Victor Zverovich and {fmt} contributors",
    source: "https://github.com/fmtlib/fmt",
    version: { file: "third-party-podspecs/fmt.podspec", pattern: /spec\.version\s*=\s*['"]([^'"]+)['"]/ },
  },
  {
    name: "glog",
    license: "BSD-3-Clause",
    copyright: "Copyright (c) 2008, Google Inc. All rights reserved.",
    source: "https://github.com/google/glog",
    version: { file: "third-party-podspecs/glog.podspec", pattern: /spec\.version\s*=\s*['"]([^'"]+)['"]/ },
  },
  {
    name: "hermes-engine",
    license: "MIT",
    copyright: "Copyright (c) Meta Platforms, Inc. and affiliates.",
    source: "https://github.com/facebook/hermes",
    version: { file: "package.json", pattern: /"version"\s*:\s*"([^"]+)"/ },
  },
  {
    name: "RCT-Folly",
    license: "Apache-2.0",
    copyright: "Copyright (c) Meta Platforms, Inc. and affiliates.",
    source: "https://github.com/facebook/folly",
    version: { file: "scripts/cocoapods/helpers.rb", pattern: /@@folly_config\s*=\s*\{\s*:version\s*=>\s*['"]([^'"]+)['"]/ },
  },
  {
    name: "SocketRocket",
    license: "BSD-3-Clause",
    copyright: "Copyright (c) 2016-present, Facebook, Inc. All rights reserved.",
    source: "https://github.com/facebook/SocketRocket",
    version: { file: "scripts/cocoapods/helpers.rb", pattern: /@@socket_rocket_config\s*=\s*\{\s*:version\s*=>\s*['"]([^'"]+)['"]/ },
  },
];

export const MARKDOWN_OUT = "THIRD_PARTY_NOTICES.md";
export const JSON_OUT = "apps/web/src/data/third-party-notices.json";
export const ASSETS_CSV = "content/assets-license.csv";
export const OFL_TEXT = "apps/mobile/public/fonts/OFL.txt";
const LICENSE_DIR = join(SCRIPT_DIR, "third-party-notices", "licenses");

/** Permissive licenses we can comply with by printing the notice and the text; each has a text in LICENSE_DIR. */
export const PERMISSIVE = {
  MIT: "MIT License",
  ISC: "ISC License",
  "Apache-2.0": "Apache License 2.0",
  "BSD-2-Clause": "BSD 2-Clause License",
  "BSD-3-Clause": "BSD 3-Clause License",
  "0BSD": "Zero-Clause BSD",
  "BlueOak-1.0.0": "Blue Oak Model License 1.0.0",
  Unlicense: "The Unlicense",
  "CC0-1.0": "Creative Commons Zero 1.0 Universal",
  "CC-BY-4.0": "Creative Commons Attribution 4.0 International",
  "Python-2.0": "Python License 2.0",
  "BSL-1.0": "Boost Software License 1.0",
};

/** The order in which a choice is taken from an `OR` expression. */
const PREFERENCE = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "BlueOak-1.0.0", "CC0-1.0", "Unlicense", "CC-BY-4.0", "Python-2.0", "BSL-1.0"];

/** Licenses that require sharing source or licensing derived work alike (strong or file-level copyleft). */
export const COPYLEFT = /^(AGPL|GPL|LGPL|SSPL|EUPL|OSL|CDDL|EPL|MPL|CPAL|RPL|MS-RL|QPL|Sleepycat|CC-BY-SA|CC-BY-NC|CC-BY-ND|CECILL|ODbL)/i;

/** Non-SPDX spellings seen in package.json files, mapped to their SPDX id. */
export const ALIASES = { "Apache 2.0": "Apache-2.0", "Apache License 2.0": "Apache-2.0", "Apache2": "Apache-2.0", BSD: null };

/**
 * Packages whose package.json does not name an SPDX license, read by hand. Keyed by name (every version) or
 * name@version.
 */
export const LICENSE_OVERRIDES = {
  "@segment/loosely-validate-event@2.0.0": {
    license: "MIT",
    reason: "package.json names no license; the LICENSE file it ships is the MIT License",
  },
  "readline@1.3.0": {
    license: "BSD-3-Clause",
    reason: "package.json says \"BSD\" with no variant and ships no license file (README: \"BSD © Craig Brookes\"); the 3-clause terms, the stricter reading, are applied",
  },
};

/** Copyleft packages allowed after review, with the reason printed in the notices. Keyed by name; `*` ends a prefix. */
export const REVIEWED_EXCEPTIONS = {
  lightningcss: {
    license: "MPL-2.0",
    reason: "build-time CSS tool of the Expo/Metro web build; it runs on the build machine and none of its code is in the shipped bundles. Used unmodified; source: https://github.com/parcel-bundler/lightningcss",
  },
  "lightningcss-*": {
    license: "MPL-2.0",
    reason: "the platform binary of lightningcss (see lightningcss)",
  },
};

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers (exported for the self-test)

/** The license string of a package.json (`license`, the old `{ type }` object, or the old `licenses` field). */
export function declaredLicense(pkg) {
  if (typeof pkg.license === "string" && pkg.license.trim()) return pkg.license.trim();
  if (pkg.license && typeof pkg.license === "object" && typeof pkg.license.type === "string") return pkg.license.type.trim();
  if (typeof pkg.licenses === "string" && pkg.licenses.trim()) return pkg.licenses.trim();
  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
    const types = pkg.licenses.map((l) => (typeof l === "string" ? l : l?.type)).filter(Boolean);
    if (types.length === 1) return types[0];
    if (types.length > 1) return `(${types.join(" OR ")})`;
  }
  return null;
}

/** The exception entry for a package name (exact, then a `prefix-*` entry), or null. */
export function exceptionFor(name, exceptions = REVIEWED_EXCEPTIONS) {
  if (exceptions[name]) return exceptions[name];
  for (const [key, value] of Object.entries(exceptions)) {
    if (key.endsWith("*") && name.startsWith(key.slice(0, -1))) return value;
  }
  return null;
}

/**
 * Classifies a declared license expression.
 * Returns { status: 'permissive' | 'copyleft' | 'exception' | 'unknown', license, expression, note? } where `license`
 * is the single id we comply with (the elected choice of an `OR`), and `expression` the declared text.
 */
export function classify(name, version, declared, { overrides = LICENSE_OVERRIDES, exceptions = REVIEWED_EXCEPTIONS } = {}) {
  const override = overrides[`${name}@${version}`] ?? overrides[name];
  if (override) {
    const inner = classify(name, version, override.license, { overrides: {}, exceptions });
    return { ...inner, expression: declared ?? "(none)", note: override.reason };
  }
  if (!declared) return { status: "unknown", license: null, expression: "(none)" };
  const expression = declared;
  const bare = declared.replace(/^\((.*)\)$/, "$1").trim();
  const choices = bare.split(/\s+OR\s+/i).map((c) => c.replace(/^\(|\)$/g, "").trim());
  const ids = choices.map((c) => (c in ALIASES ? ALIASES[c] : c));
  if (ids.some((id) => id === null || /\s(AND|WITH)\s/i.test(id ?? ""))) {
    // "BSD" with no variant, or an AND / WITH expression: needs a human reading (LICENSE_OVERRIDES).
    return { status: "unknown", license: null, expression };
  }
  const permissive = PREFERENCE.find((id) => ids.includes(id));
  if (permissive) {
    return { status: "permissive", license: permissive, expression, ...(ids.length > 1 ? { note: `${permissive} chosen from ${expression}` } : {}) };
  }
  const copyleft = ids.find((id) => COPYLEFT.test(id));
  if (copyleft) {
    const exception = exceptionFor(name, exceptions);
    if (exception && exception.license === copyleft) return { status: "exception", license: copyleft, expression, note: exception.reason };
    return { status: "copyleft", license: copyleft, expression };
  }
  return { status: "unknown", license: null, expression };
}

const COPYRIGHT_LINE = /^(?:copyright\b|\(c\)\s|©)/i;

/**
 * Up to three copyright lines of a license or notice text, as written: a line that starts with "Copyright", "(c)"
 * or "©" and names a year or a holder, never a template placeholder ("Copyright [yyyy] [name of copyright owner]").
 */
export function copyrightLines(text) {
  const out = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/^[\s#*/>-]+/, "").replace(/\s+/g, " ").trim();
    if (!COPYRIGHT_LINE.test(line)) continue;
    // "(c) You must retain ..." is clause (c) of a license, not a notice: a line opening with "(c)" needs a year.
    if (/^\(c\)/i.test(line) && !/\d{4}/.test(line)) continue;
    if (/[[{<](yyyy|year|name of copyright owner|copyright holders?)[\]}>]/i.test(line)) continue;
    // A year, "(c)" or "©", or "Copyright" followed by a name ("Copyright jQuery Foundation and other contributors"),
    // not by a word of license prose ("Copyright notice", "copyright and related rights").
    if (!/\d{4}|\(c\)|©/i.test(line) && !/^copyright (?!(notices?|licen[cs]es?|holders?|owners?|laws?|act|protection|statement|interest|and|the|of|to|in|is|are|or|for|by|under|on|status|rights?)\b)[A-Za-z@]/i.test(line)) continue;
    if (/^copyright (notice|license|and license|and related|and similar|holders? (?!of)|owner)/i.test(line)) continue;
    if (line.length > 200) continue;
    if (!out.includes(line)) out.push(line);
    if (out.length === 3) break;
  }
  return out;
}

/** Parses a CSV with a header row; quoted fields may hold commas and doubled quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/** The SPDX id of an asset's license column ("SIL OFL 1.1" and the like). */
export function assetLicenseId(text) {
  if (/\bOFL\b.*1\.1|Open Font License.*1\.1/i.test(text)) return "OFL-1.1";
  const id = text.trim();
  return id in PERMISSIVE ? id : null;
}

// ---------------------------------------------------------------------------------------------------------------
// The walk

const LICENSE_FILE = /^(licen[cs]e|copying|unlicense)([-._].*)?$/i;
const NOTICE_FILE = /^notice(\.(md|txt))?$/i;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Finds `name` from `fromDir` the way Node does: `<dir>/node_modules/<name>`, walking up. Returns the real path. */
function resolvePackage(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, "node_modules", name, "package.json");
    if (existsSync(candidate)) return realpathSync(dirname(candidate));
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function filesMatching(dir, pattern) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => pattern.test(n))
    .sort()
    .map((n) => join(dir, n))
    .filter((p) => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    });
}

function authorName(pkg) {
  const a = pkg.author;
  if (typeof a === "string") return a.replace(/\s*[<(].*$/, "").trim() || null;
  if (a && typeof a === "object" && typeof a.name === "string") return a.name.trim() || null;
  return null;
}

/**
 * Walks the production tree from each root. Returns { packages, platform, problems } where `packages` is the
 * sorted, de-duplicated list of listed packages and `platform` the platform builds (policy-checked, not listed).
 */
export function walk(root = DEFAULT_ROOT, roots = ROOTS, extras = roots === ROOTS ? EXTRA_SHIPPED : []) {
  const byKey = new Map();
  const platform = new Map();
  const problems = [];
  const seen = new Map(); // real dir -> Set(labels) already walked with

  const starts = roots.map(({ dir, label }) => ({ label, stack: [{ dir: realpathSync(join(root, dir)), workspace: true }] }));
  for (const { from, through, label, packages: names } of extras) {
    const via = resolvePackage(through, realpathSync(join(root, from)));
    if (!via) {
      problems.push({ code: "missing-dependency", message: `${from} needs ${through}, which is not installed (run pnpm install)` });
      continue;
    }
    const stack = [];
    for (const name of names) {
      const found = resolvePackage(name, via);
      if (found) stack.push({ dir: found, workspace: false });
      else problems.push({ code: "missing-dependency", message: `${through} needs ${name}, which is not installed (run pnpm install)` });
    }
    starts.push({ label, stack });
  }

  for (const { label, stack } of starts) {
    while (stack.length > 0) {
      const { dir: pkgDir, workspace } = stack.pop();
      const labels = seen.get(pkgDir) ?? new Set();
      if (labels.has(label)) continue;
      labels.add(label);
      seen.set(pkgDir, labels);
      const pkg = readJson(join(pkgDir, "package.json"));
      const isOwn = workspace || (typeof pkg.name === "string" && pkg.name.startsWith("@hangul-route/"));

      if (!isOwn) {
        const key = `${pkg.name}@${pkg.version}`;
        const isPlatform = Array.isArray(pkg.os) || Array.isArray(pkg.cpu);
        const target = isPlatform ? platform : byKey;
        const existing = target.get(key);
        if (existing) existing.usedIn.add(label);
        else target.set(key, { name: pkg.name, version: pkg.version, dir: pkgDir, pkg, usedIn: new Set([label]) });
      }

      const deps = { ...(pkg.dependencies ?? {}) };
      const optional = new Set(Object.keys(pkg.optionalDependencies ?? {}));
      for (const name of optional) deps[name] = pkg.optionalDependencies[name];
      const peerMeta = pkg.peerDependenciesMeta ?? {};
      const peers = isOwn ? [] : Object.keys(pkg.peerDependencies ?? {}).filter((name) => !peerMeta[name]?.optional);
      for (const name of peers) if (!(name in deps)) deps[name] = pkg.peerDependencies[name];

      for (const name of Object.keys(deps).sort()) {
        const found = resolvePackage(name, pkgDir);
        if (found) {
          stack.push({ dir: found, workspace: false });
          continue;
        }
        if (optional.has(name) || peers.includes(name)) continue;
        problems.push({ code: "missing-dependency", message: `${pkg.name} needs ${name}, which is not installed (run pnpm install)` });
      }
    }
  }
  return { packages: [...byKey.values()], platform: [...platform.values()], problems };
}

/**
 * The first 40 lines of a package's entry file (`main`, else index.js): many packages with no license file (Meta's
 * Metro and React Native tooling, for one) state the copyright in the source header instead.
 */
function entryHeader(entry) {
  const main = typeof entry.pkg.main === "string" ? entry.pkg.main : "index.js";
  for (const candidate of [main, `${main}.js`, join(main, "index.js")]) {
    const file = join(entry.dir, candidate);
    try {
      if (statSync(file).isFile()) return readFileSync(file, "utf8").split("\n", 40).join("\n");
    } catch {
      // try the next spelling
    }
  }
  return "";
}

/** Reads license, copyright and NOTICE details of one walked package. */
function describe(entry) {
  const declared = declaredLicense(entry.pkg);
  const verdict = classify(entry.name, entry.version, declared);
  const licenseFiles = filesMatching(entry.dir, LICENSE_FILE);
  let copyright = [];
  for (const file of licenseFiles) {
    copyright = copyrightLines(readFileSync(file, "utf8"));
    if (copyright.length > 0) break;
  }
  const noticeFiles = filesMatching(entry.dir, NOTICE_FILE);
  const notice = noticeFiles.length > 0 ? readFileSync(noticeFiles[0], "utf8").replace(/\r\n?/g, "\n").trim() : null;
  if (copyright.length === 0 && notice) copyright = copyrightLines(notice);
  if (copyright.length === 0) copyright = copyrightLines(entryHeader(entry));
  const author = authorName(entry.pkg);
  return {
    name: entry.name,
    version: entry.version,
    license: verdict.license,
    declared: verdict.expression,
    status: verdict.status,
    ...(verdict.note ? { note: verdict.note } : {}),
    copyright: copyright.length > 0 ? copyright.join("; ") : author ? `(no copyright line in the package; author: ${author})` : "(no copyright line in the package)",
    usedIn: [...entry.usedIn].sort(),
    notice: verdict.license === "Apache-2.0" ? notice : null,
  };
}

/**
 * The NATIVE_COMPONENTS rows, each with its version read from the react-native the learner app installs (labelled
 * `ios`: the iOS app is the native build that ships).
 */
export function nativeEntries(root, components = NATIVE_COMPONENTS, problems = []) {
  if (components.length === 0) return [];
  const rn = resolvePackage("react-native", realpathSync(join(root, "apps/mobile")));
  if (!rn) {
    problems.push({ code: "missing-dependency", message: "apps/mobile needs react-native, which is not installed (run pnpm install)" });
    return [];
  }
  return components.map((c) => {
    let version = null;
    try {
      version = readFileSync(join(rn, c.version.file), "utf8").match(c.version.pattern)?.[1] ?? null;
    } catch {
      version = null;
    }
    if (!version) problems.push({ code: "native-version", message: `no version for ${c.name} in react-native/${c.version.file}; update NATIVE_COMPONENTS` });
    const verdict = classify(c.name, version ?? "", c.license, { overrides: {} });
    const where = `iOS native library, not an npm package; source: ${c.source}`;
    return {
      name: c.name,
      version: version ?? "(unknown)",
      license: verdict.license,
      declared: c.license,
      status: verdict.status,
      note: c.note ? `${where}; ${c.note}` : where,
      copyright: c.copyright,
      usedIn: ["ios"],
      notice: null,
    };
  });
}

function compareEntries(a, b) {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.version < b.version ? -1 : a.version > b.version ? 1 : 0;
}

/** Builds the full notices model from the installed tree. */
export function buildModel(root = DEFAULT_ROOT, roots = ROOTS, { extras = roots === ROOTS ? EXTRA_SHIPPED : [], native = roots === ROOTS ? NATIVE_COMPONENTS : [] } = {}) {
  const { packages, platform, problems } = walk(root, roots, extras);
  const listed = [...packages.map(describe), ...nativeEntries(root, native, problems)].sort(compareEntries);
  const builds = platform.map(describe).sort(compareEntries);

  for (const p of [...listed, ...builds]) {
    if (p.status === "copyleft") problems.push({ code: "copyleft", message: `${p.name}@${p.version} is ${p.declared} (copyleft); remove it or review it into REVIEWED_EXCEPTIONS` });
    if (p.status === "unknown") problems.push({ code: "unknown-license", message: `${p.name}@${p.version} declares ${p.declared}; read the package and add the license text or a LICENSE_OVERRIDES entry` });
  }

  const csvPath = join(root, ASSETS_CSV);
  const assets = existsSync(csvPath)
    ? parseCsv(readFileSync(csvPath, "utf8")).map((row) => {
        const license = assetLicenseId(row.license ?? "");
        if (!license) problems.push({ code: "unknown-license", message: `${ASSETS_CSV}: ${row.asset_path} has license "${row.license}", which has no text here` });
        return { path: row.asset_path, category: row.category, source: row.source, license, declared: row.license, attribution: row.attribution, url: row.url };
      })
    : [];

  const used = new Set([...listed, ...builds].filter((p) => p.status === "permissive" || p.status === "exception").map((p) => p.license));
  for (const a of assets) if (a.license) used.add(a.license);
  const licenses = [...used].sort().map((id) => {
    if (id === "OFL-1.1") {
      return { id, name: "SIL Open Font License 1.1", text: readFileSync(join(root, OFL_TEXT), "utf8").replace(/\r\n?/g, "\n").trim() };
    }
    const file = join(LICENSE_DIR, `${id}.txt`);
    if (!existsSync(file)) {
      problems.push({ code: "missing-license-text", message: `no text for ${id}: add scripts/third-party-notices/licenses/${id}.txt` });
      return { id, name: PERMISSIVE[id] ?? id, text: "" };
    }
    return { id, name: PERMISSIVE[id] ?? (id === "MPL-2.0" ? "Mozilla Public License 2.0" : id), text: readFileSync(file, "utf8").replace(/\r\n?/g, "\n").trim() };
  });

  const unique = [...new Map(problems.map((p) => [`${p.code} ${p.message}`, p])).values()];
  return { packages: listed, platformCount: builds.length, assets, licenses, problems: unique };
}

// ---------------------------------------------------------------------------------------------------------------
// Output

const cell = (text) => String(text).replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The THIRD_PARTY_NOTICES.md text. */
export function renderMarkdown(model) {
  const counts = new Map();
  for (const p of model.packages) counts.set(p.license, (counts.get(p.license) ?? 0) + 1);
  const lines = [
    "# Third-party notices",
    "",
    "<!-- Generated by scripts/third-party-notices.mjs from the installed production dependency tree. Do not edit by hand: run `node scripts/third-party-notices.mjs`. -->",
    "",
    "Hangul Route is proprietary software: Copyright (c) 2026 Sungjoo Hwang. All rights reserved. See [LICENSE](./LICENSE).",
    "",
    "Hangul Route includes the third-party components below. Each remains under its own license, and nothing in the Hangul Route license or Terms of Service limits the rights those licenses give. This list covers the production dependencies of the shipped apps: the learner app (`app`, apps/mobile, web and PWA build, including the Workbox service-worker runtime), the website and grown-up console (`web`, apps/web) and the server (`server`, apps/api and packages/backend on Cloudflare Workers). The iOS app also links the native libraries marked `ios` (React Native's CocoaPods pods and the Hermes engine). The Android app is not released yet; its native libraries will be added here before it is. Development-only tools are not shipped and are not listed.",
    "",
    "Platform-specific binary builds (for example `@esbuild/linux-x64`) are published by the same project under the same license as the package that installs them, and are not listed separately.",
    "",
    "## Summary",
    "",
    "| License | Packages |",
    "|---|---|",
    ...[...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([id, n]) => `| ${id} | ${n} |`),
    `| **Total** | **${model.packages.length}** |`,
    "",
    "## Packages",
    "",
    "| Package | Version | License | Copyright | Used in |",
    "|---|---|---|---|---|",
    ...model.packages.map((p) => `| ${cell(p.name)} | ${cell(p.version)} | ${cell(p.license)}${p.note ? ` (${cell(p.note)})` : ""} | ${cell(p.copyright)} | ${p.usedIn.join(", ")} |`),
    "",
    "## Fonts and other assets",
    "",
    "| Asset | Source | License | Attribution |",
    "|---|---|---|---|",
    ...model.assets.map((a) => `| ${cell(a.path)} | ${cell(a.source)} (${cell(a.url)}) | ${cell(a.license ?? a.declared)} | ${cell(a.attribution)} |`),
    "",
    "## NOTICE files",
    "",
    "The NOTICE files of the Apache-2.0 packages above, as they ship them.",
    "",
  ];
  const notices = model.packages.filter((p) => p.notice);
  if (notices.length === 0) lines.push("None of the Apache-2.0 packages ships a NOTICE file.", "");
  for (const p of notices) lines.push(`### ${p.name} ${p.version}`, "", "```text", p.notice, "```", "");
  lines.push("## License texts", "", "For the MIT, ISC, BSD and 0BSD licenses, `<year>` and `<copyright holders>` are the copyright line given for each package above.", "");
  for (const l of model.licenses) lines.push(`### ${l.id}: ${l.name}`, "", "```text", l.text, "```", "");
  return `${lines.join("\n").trimEnd()}\n`;
}

/** The JSON data the site's /licenses page renders. */
export function renderJson(model) {
  const data = {
    packages: model.packages.map((p) => ({ name: p.name, version: p.version, license: p.license, ...(p.note ? { note: p.note } : {}), copyright: p.copyright, usedIn: p.usedIn })),
    assets: model.assets.map((a) => ({ path: a.path, source: a.source, url: a.url, license: a.license ?? a.declared, attribution: a.attribution })),
    notices: model.packages.filter((p) => p.notice).map((p) => ({ name: p.name, version: p.version, text: p.notice })),
    licenses: model.licenses,
  };
  return `${JSON.stringify(data, null, 1)}\n`;
}

function main(argv) {
  const check = argv.includes("--check");
  const root = DEFAULT_ROOT;
  const model = buildModel(root);
  const outputs = [
    [MARKDOWN_OUT, renderMarkdown(model)],
    [JSON_OUT, renderJson(model)],
  ];
  const problems = [...model.problems];
  if (check) {
    for (const [rel, text] of outputs) {
      const path = join(root, rel);
      const current = existsSync(path) ? readFileSync(path, "utf8") : null;
      if (current !== text) problems.push({ code: "stale", message: `${rel} is out of date: run node scripts/third-party-notices.mjs and commit the result` });
    }
  } else {
    for (const [rel, text] of outputs) writeFileSync(join(root, rel), text);
  }
  const exceptions = model.packages.filter((p) => p.status === "exception");
  for (const p of exceptions) console.log(`reviewed exception: ${p.name}@${p.version} ${p.license} (${p.note})`);
  console.log(`${model.packages.length} packages, ${model.platformCount} platform builds, ${model.assets.length} assets, ${model.licenses.length} license texts`);
  for (const p of problems) console.error(`::error::third-party-notices ${p.code}: ${p.message}`);
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
