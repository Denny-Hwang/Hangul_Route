// F-CURR-002 §9.1 (row CM-6): the generators run before every dev, build, typecheck and test task,
// so each writes a module only when its bytes change. An unchanged run then touches no file: a
// running Metro or Next dev server does not reload, and editor watchers stay quiet.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Writes `source` to `file` (creating its folder) unless the file already holds it; true when written. */
export function writeIfChanged(file, source) {
  if (existsSync(file) && readFileSync(file, "utf8") === source) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
  return true;
}
