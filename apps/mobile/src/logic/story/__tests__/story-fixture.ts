import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseStory, type Story } from '@hangul-route/content-schema';

const FIXTURE = join(
  __dirname,
  '../../../../../../packages/content-schema/src/__fixtures__/story/valid.ready.json',
);

/** A fresh, deep-cloned, schema-valid ready story (tiers: listen, read-along). */
export function readyStory(): Story {
  return parseStory(JSON.parse(readFileSync(FIXTURE, 'utf8')) as unknown);
}
