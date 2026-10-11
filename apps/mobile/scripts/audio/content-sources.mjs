// Reads the content records the audio scripts need, with plain node (no
// TypeScript loader, F-CNT-002 C1): the jamo records from the factory calls in
// src/content/jamo.ts (parseJamoSource, checked against the real jamoAll by a
// unit test) and the vocabulary topics from content/vocab/*.json.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJamoSource } from './lib.mjs';

export const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const repoRoot = join(appRoot, '..', '..');

export function readJamo() {
  return parseJamoSource(readFileSync(join(appRoot, 'src/content/jamo.ts'), 'utf8'));
}

/** Topic files only: `_senses.json` and other `_`-prefixed files are not topics. */
export function readVocabTopics() {
  const dir = join(repoRoot, 'content/vocab');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

/** Every file under `dir`, as paths relative to it. */
export function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (current, prefix) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(current, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  walk(dir, '');
  return out.sort();
}
