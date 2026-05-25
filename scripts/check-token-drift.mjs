#!/usr/bin/env node
// F-DES-001 — Design Token drift detector.
// Cross-checks design/tokens/<kind>.v<N>.md (design source of truth) against
// the exported objects in packages/design-system/src/tokens.ts.
//
// V1 contract: structural presence. For each `<kind>.v<N>.md` found in
// design/tokens/ (where kind ∈ colors|typography|spacing|radii|shadows|motion),
// tokens.ts MUST export `<kind>` as a non-empty `{ ... } as const`. Detail-
// level value drift (hex literal vs token value) is deferred to F-DES-002.
//
// Source of truth: CLAUDE.md §5 ("동기화는 CI").

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.HANGUL_ROUTE_ROOT
  ? resolve(process.env.HANGUL_ROUTE_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS_DIR = join(ROOT, "design", "tokens");
const TOKENS_TS = join(
  ROOT,
  "packages",
  "design-system",
  "src",
  "tokens.ts"
);

const KNOWN_KINDS = ["colors", "typography", "spacing", "radii", "shadows", "motion"];

if (!existsSync(TOKENS_DIR)) {
  console.log("::notice::design/tokens/ does not exist; nothing to check");
  process.exit(0);
}

if (!existsSync(TOKENS_TS)) {
  console.log(`::error file=${relative(ROOT, TOKENS_TS)}::tokens.ts missing`);
  process.exit(1);
}

const declaredKinds = new Set();
for (const f of readdirSync(TOKENS_DIR)) {
  if (extname(f) !== ".md") continue;
  if (f === "README.md") continue;
  const m = basename(f).match(/^(\w+)\.v\d+\.md$/);
  if (!m) continue;
  if (KNOWN_KINDS.includes(m[1])) declaredKinds.add(m[1]);
}

if (declaredKinds.size === 0) {
  console.log(
    "::notice::no <kind>.v<N>.md files in design/tokens/; drift check is a no-op until W1 tokens land"
  );
  process.exit(0);
}

const tsSource = readFileSync(TOKENS_TS, "utf8");

const violations = [];
for (const kind of declaredKinds) {
  const exportRe = new RegExp(
    `export\\s+const\\s+${kind}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as\\s*const`,
    "m"
  );
  const match = tsSource.match(exportRe);
  if (!match) {
    violations.push({
      kind,
      reason: `no \`export const ${kind} = { ... } as const\` block in tokens.ts`,
    });
    continue;
  }
  const body = match[1].trim();
  if (body === "" || body === ",") {
    violations.push({
      kind,
      reason: `\`export const ${kind}\` exists but body is empty`,
    });
  }
}

for (const v of violations) {
  console.log(
    `::error file=${relative(ROOT, TOKENS_TS)}::token drift — ${v.kind}: ${v.reason}`
  );
}
console.log("");
console.log(
  `Design token drift: ${declaredKinds.size} kind(s) declared in design/tokens, ${violations.length} drift violation(s)`
);

if (violations.length > 0) process.exit(1);
