#!/usr/bin/env node
// F-COV-002 — Coverage targets drift detector.
// Cross-checks the "Enforced W4 gate (machine-checked)" table in
// docs/tests/coverage-targets.md against `targets` in
// docs/tests/coverage-targets.json (the values scripts/coverage-gate.mjs
// actually enforces). Any key or value disagreement fails CI.
//
// The aspirational per-lane table at the top of the markdown is NOT parsed;
// lane-split enforcement is F-COV-003. Source of truth: docs/specs/
// F-COV-002-coverage-targets-drift.md.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.HANGUL_ROUTE_ROOT
  ? resolve(process.env.HANGUL_ROUTE_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const MD = join(ROOT, "docs", "tests", "coverage-targets.md");
const JSON_FILE = join(ROOT, "docs", "tests", "coverage-targets.json");
const SECTION = "## Enforced W4 gate (machine-checked)";

function fail(file, message) {
  console.log(`::error file=${relative(ROOT, file)}::${message}`);
  process.exitCode = 1;
}

if (!existsSync(MD)) fail(MD, "coverage-targets.md is missing");
if (!existsSync(JSON_FILE)) fail(JSON_FILE, "coverage-targets.json is missing");
if (process.exitCode) process.exit(process.exitCode);

// --- parse markdown section table -------------------------------------------
const mdSource = readFileSync(MD, "utf8");
const sectionStart = mdSource.indexOf(SECTION);
if (sectionStart === -1) {
  fail(MD, `section "${SECTION}" not found — F-COV-002 contract broken`);
  process.exit(1);
}
const nextHeading = mdSource.indexOf("\n## ", sectionStart + SECTION.length);
const section = mdSource.slice(
  sectionStart,
  nextHeading === -1 ? mdSource.length : nextHeading
);

const mdTargets = new Map();
for (const line of section.split("\n")) {
  const m = line.match(/^\|\s*([\w./-]+)\s*\|\s*(\d+)\s*\|\s*$/);
  if (!m) continue;
  const [, workspace, value] = m;
  if (workspace === "Workspace") continue;
  mdTargets.set(workspace, Number(value));
}

if (mdTargets.size === 0) {
  fail(MD, `no parsable "| workspace | value |" rows under "${SECTION}"`);
  process.exit(1);
}

// --- parse json --------------------------------------------------------------
let jsonTargets;
try {
  const parsed = JSON.parse(readFileSync(JSON_FILE, "utf8"));
  jsonTargets = parsed.targets;
} catch (err) {
  fail(JSON_FILE, `invalid JSON: ${err.message}`);
  process.exit(1);
}
if (typeof jsonTargets !== "object" || jsonTargets === null) {
  fail(JSON_FILE, "missing `targets` object");
  process.exit(1);
}

// --- compare -----------------------------------------------------------------
let drift = 0;
for (const [workspace, mdValue] of mdTargets) {
  if (!(workspace in jsonTargets)) {
    fail(
      JSON_FILE,
      `workspace "${workspace}" is in coverage-targets.md but missing from coverage-targets.json`
    );
    drift++;
  } else if (Number(jsonTargets[workspace]) !== mdValue) {
    fail(
      JSON_FILE,
      `drift on "${workspace}": md says ${mdValue}%, json says ${jsonTargets[workspace]}%`
    );
    drift++;
  }
}
for (const workspace of Object.keys(jsonTargets)) {
  if (!mdTargets.has(workspace)) {
    fail(
      MD,
      `workspace "${workspace}" is in coverage-targets.json but missing from the "${SECTION}" table`
    );
    drift++;
  }
}

if (drift === 0) {
  console.log(
    `coverage-targets drift check OK — ${mdTargets.size} workspaces mirrored (F-COV-002)`
  );
  process.exit(0);
}
process.exit(1);
