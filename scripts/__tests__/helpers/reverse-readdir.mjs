// Test support for scripts/__tests__/generate.test.mjs (F-CURR-002 §9.1, row CM-6): loaded with
// `node --import`, it makes every fs.readdirSync answer in reverse order, so a generator that
// depends on the order the file system lists a folder gives different bytes and fails the
// determinism test.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const readdirSync = fs.readdirSync;
fs.readdirSync = (...args) => {
  const listed = readdirSync(...args);
  return Array.isArray(listed) ? [...listed].reverse() : listed;
};
syncBuiltinESMExports();
