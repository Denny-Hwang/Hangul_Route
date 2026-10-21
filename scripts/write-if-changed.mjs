// F-CURR-002 §9.1 (row CM-6): the generators run before every dev, build, typecheck and test task,
// so each writes a module only when its bytes change. An unchanged run then touches no file: a
// running Metro or Next dev server does not reload, and editor watchers stay quiet. A changed module
// is written to a temporary file beside it and renamed into place, so a reader (a dev server, a lint
// or typecheck task running beside `generate`) sees the old bytes or the new ones, never half a file.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Writes `source` to `file` (creating its folder) unless the file already holds it; true when written. */
export function writeIfChanged(file, source) {
  if (existsSync(file) && readFileSync(file, "utf8") === source) return false;
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, source);
    renameSync(tmp, file);
  } finally {
    rmSync(tmp, { force: true });
  }
  return true;
}
