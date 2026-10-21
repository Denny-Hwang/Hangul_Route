// Module hooks that let a plain Node script import the workspace's TypeScript
// source (F-I18N-001 §3.10: scripts/i18n-status.mjs reads `fallbackPaths` and
// `LOCALE_STATUS` from packages/i18n). Registered with `module.register()`.
//
// - resolve: an extensionless relative import (`./messages/en`) tries `.ts`
//   and then `/index.ts`, the way the workspace's `moduleResolution: bundler`
//   does.
// - load: a `.ts` file outside node_modules is transpiled with the repo's
//   `typescript` (resolved through the workspace packages, as check-i18n.mjs
//   does); a JSON file imported from TypeScript without `with { type: "json" }`
//   becomes a default export.
//
// Tooling only; nothing in an app bundle imports this.

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

let ts;
function typescript() {
  if (ts) return ts;
  for (const pkg of ["packages/i18n", "apps/mobile", "packages/content-schema"]) {
    try {
      ts = createRequire(join(SCRIPT_DIR, "..", pkg, "package.json"))("typescript");
      return ts;
    } catch {
      // try the next workspace
    }
  }
  throw new Error(
    "typescript not found: the generators (scripts/generate.mjs, run by the postinstall) read TypeScript through scripts/ts-loader.mjs " +
      "and need the devDependencies; run `pnpm install` without --prod (and without NODE_ENV=production)",
  );
}

const NOT_FOUND = new Set(["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"]);

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (!relative || !NOT_FOUND.has(error?.code) || !context.parentURL?.endsWith(".ts")) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // try the next candidate
      }
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || url.includes("/node_modules/")) return nextLoad(url, context);
  if (url.endsWith(".ts")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    const t = typescript();
    const { outputText } = t.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: { module: t.ModuleKind.ESNext, target: t.ScriptTarget.ES2022, isolatedModules: true },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }
  if (url.endsWith(".json") && context.importAttributes?.type !== "json") {
    const text = await readFile(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${text};`, shortCircuit: true };
  }
  return nextLoad(url, context);
}
