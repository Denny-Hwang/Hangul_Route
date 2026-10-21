#!/usr/bin/env node
// F-CURR-002 §9.1 (row CM-6) — write every module generated from content/.
//
// The generated modules are gitignored (.gitignore, "Generated from content/"): two content PRs
// that both regenerated the same committed line used to conflict. They are written instead by
//
//   - the turbo `generate` task (`//#generate`, turbo.json), which dev, build, typecheck, test and
//     test:coverage depend on, locally and in CI;
//   - the root `postinstall`, so every `pnpm install` leaves a usable tree: the CI jobs, the
//     content-validation steps that call a package script directly, and the three Cloudflare
//     Workers Builds deploys (whose build command is `pnpm install --frozen-lockfile`) all install first.
//
// The generators run in this order (none reads another's output):
//
//   build-vocab.mjs              content/vocab, content/i18n           -> vocab.ts, vocab-catalog.ts
//   build-placement-bank.mjs     content/placement                      -> placement.generated.ts
//   build-overlays.mjs           content/i18n                           -> i18n-overlays.generated.ts
//   build-stories.mjs            content/stories                        -> stories.generated.ts
//   build-lessons.mjs            content/episodes, stories, vocab, i18n -> lessons-index.ts, lesson-chunks/,
//                                                                          catalog.generated.ts
//   build-lecture-catalogue.mjs  content/stories, vocab, i18n           -> lecture-catalogue.generated.ts,
//                                                                          catalogue-titles.generated.ts
//
// The presenter font (apps/mobile/public/fonts/) stays committed: it is subset from a source font
// with pyftsubset, which CI does not have; build-presenter-font.mjs --check proves it covers all
// taught Korean.
//
// Usage:
//   node scripts/generate.mjs            write every generated module (pnpm generate)
//   node scripts/generate.mjs --check    determinism: each generator's --check compares a fresh run
//                                        with the files an earlier run wrote (CI runs them one by one)
//
// Exit 0 when written / deterministic, 1 when a generator fails, 2 on a usage error.
// HANGUL_ROUTE_ROOT overrides the repo root (passed on to each generator).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));

/** The generators in run order, each with the paths (files or folders, relative to the root) it writes. */
export const GENERATORS = Object.freeze([
  { script: "build-vocab.mjs", outputs: ["apps/mobile/src/content/__generated__/vocab.ts", "apps/web/src/data/vocab-catalog.ts"] },
  { script: "build-placement-bank.mjs", outputs: ["apps/mobile/src/content/placement.generated.ts"] },
  { script: "build-overlays.mjs", outputs: ["packages/content-schema/src/i18n-overlays.generated.ts"] },
  { script: "build-stories.mjs", outputs: ["apps/mobile/src/content/stories.generated.ts"] },
  {
    script: "build-lessons.mjs",
    outputs: [
      "apps/mobile/src/content/__generated__/lessons-index.ts",
      "apps/mobile/src/content/__generated__/lesson-chunks",
      "packages/content-schema/src/catalog/catalog.generated.ts",
    ],
  },
  { script: "build-lecture-catalogue.mjs", outputs: ["apps/web/src/data/lecture-catalogue.generated.ts", "apps/web/src/data/catalogue-titles.generated.ts"] },
]);

/** Every generated path, for .gitignore and the tests. */
export const GENERATED_PATHS = Object.freeze(GENERATORS.flatMap((g) => g.outputs));

const relOf = (root, file) => relative(root, file).split(sep).join("/");

/** The files under the generated paths, by path relative to the root (folders walked, sorted). */
export function generatedFiles(root) {
  const files = [];
  const walk = (full) => {
    if (!existsSync(full)) return;
    if (statSync(full).isDirectory()) {
      for (const name of readdirSync(full).sort()) walk(join(full, name));
    } else files.push(relOf(root, full));
  };
  for (const rel of GENERATED_PATHS) walk(join(root, ...rel.split("/")));
  return files.sort();
}

/** sha256 of each generated file: two runs of a deterministic pipeline give the same map. */
export function digest(root) {
  return Object.fromEntries(generatedFiles(root).map((rel) => [rel, createHash("sha256").update(readFileSync(join(root, ...rel.split("/")))).digest("hex")]));
}

/** Runs each generator (with `args`) in order; stops at the first failure. Returns the exit code. */
export function runGenerators(root, args = [], deps = {}) {
  const { stdout = (t) => process.stdout.write(t), stderr = (t) => process.stderr.write(t), env = process.env } = deps;
  for (const { script } of GENERATORS) {
    const run = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...env, HANGUL_ROUTE_ROOT: root },
    });
    stdout(run.stdout ?? "");
    stderr(run.stderr ?? "");
    if (run.status !== 0) {
      stderr(`::error::scripts/${script}${args.length > 0 ? ` ${args.join(" ")}` : ""} failed (exit ${run.status}); fix it and run pnpm generate\n`);
      return run.status ?? 1;
    }
  }
  return 0;
}

const USAGE = "Usage: node scripts/generate.mjs [--check]";

export function main(argv, root) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== "--check")) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  return runGenerators(root, argv);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const root = process.env.HANGUL_ROUTE_ROOT ? resolve(process.env.HANGUL_ROUTE_ROOT) : join(SCRIPTS, "..");
  process.exitCode = main(process.argv.slice(2), root);
}
