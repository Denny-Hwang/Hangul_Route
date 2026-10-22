import { LESSON_FILE_RE, PACK_FILE_RE, PACK_LEVEL_NAME_RE, STORY_FILE_RE } from '../lesson-lint-items';
import type { ThemeKey } from '../schemas/heritage-card';
import type { LessonSource } from './extract';
import type { SenseGroup, TopicWord } from './stable-ids';
import type { StorySource } from './build';

/**
 * Which content files are review-item sources (F-CURR-002 §4.2, row CM-10), over a content tree
 * (`content/...` path -> parsed JSON): the generator (scripts/build-review-items.mjs, through
 * build-lessons.mjs and build-stories.mjs) and the `items-stable-id` rule both read the tree through
 * these, so they always agree on what is taught. Only what ships counts: a ready lesson cell of any
 * volume (`<theme>.json`, or `<theme>.v<k>.json` from row CM-40), a ready pack level (row CM-50a)
 * and a ready story. Build time only.
 */

/** The committed frozen-id snapshot and the frozen Stage 1 table, by their repository paths. */
export const REVIEW_SNAPSHOT_FILE = 'packages/content-schema/src/review-items/items-stable-id.json';
export const REVIEW_STAGE1_FILE = 'packages/content-schema/src/review-items/stage1-items.json';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const byPath = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The ready lesson cells and pack levels of the tree, in path order. */
export function lessonSourcesOfTree(tree: ReadonlyMap<string, unknown>): LessonSource[] {
  const out: LessonSource[] = [];
  for (const file of [...tree.keys()].sort(byPath)) {
    const body = tree.get(file);
    if (!isRec(body) || body.status !== 'ready') continue;
    const cell = LESSON_FILE_RE.exec(file);
    if (cell !== null) {
      const [, stage, theme, v] = cell as unknown as [string, string, ThemeKey, string | undefined];
      const volume = v !== undefined ? Number(v) : typeof body.volume === 'number' ? body.volume : 1;
      out.push({ file, body, cellId: `episode:stage${stage}-${theme}${volume >= 2 ? `-v${volume}` : ''}`, stage: Number(stage), home: theme, volume });
      continue;
    }
    const pack = PACK_FILE_RE.exec(file);
    const level = pack === null ? null : PACK_LEVEL_NAME_RE.exec(pack[2] as string);
    if (pack !== null && level !== null) {
      const key = pack[1] as string;
      const stage = Number(level[1]);
      out.push({ file, body, cellId: `episode:pack-${key}-s${stage}`, stage, home: `pack:${key}`, volume: 1 });
    }
  }
  return out;
}

/** The ready stories of the tree, in path order. */
export function storySourcesOfTree(tree: ReadonlyMap<string, unknown>): StorySource[] {
  return [...tree.keys()]
    .sort(byPath)
    .filter((file) => STORY_FILE_RE.test(file))
    .map((file) => ({ file, story: tree.get(file) }))
    .filter(({ story }) => isRec(story) && story.state === 'ready');
}

const VOCAB_TOPIC_RE = /^content\/vocab\/[a-z0-9-]+\.json$/;
const SENSES_FILE = 'content/vocab/_senses.json';

/** The topic words of content/vocab/<topic>.json and the sense groups of content/vocab/_senses.json. */
export function vocabOfTree(tree: ReadonlyMap<string, unknown>): { topicWords: TopicWord[]; senseGroups: SenseGroup[] } {
  const topicWords: TopicWord[] = [];
  for (const file of [...tree.keys()].sort(byPath)) {
    const json = tree.get(file);
    if (!VOCAB_TOPIC_RE.test(file) || !isRec(json) || !Array.isArray(json.items)) continue;
    for (const item of json.items) {
      if (!isRec(item) || typeof item.id !== 'string' || typeof item.ko !== 'string' || typeof item.en !== 'string') continue;
      topicWords.push({
        id: item.id,
        ko: item.ko,
        en: item.en,
        ...(typeof item.senseGroup === 'string' ? { senseGroup: item.senseGroup } : {}),
        ...(typeof item.visual === 'string' ? { visual: item.visual } : {}),
      });
    }
  }
  const senses = tree.get(SENSES_FILE);
  const groups = isRec(senses) && Array.isArray(senses.groups) ? senses.groups : [];
  const senseGroups = groups.filter(
    (g): g is SenseGroup => isRec(g) && typeof g.group === 'string' && Array.isArray(g.members) && g.members.every((m) => isRec(m) && typeof m.id === 'string' && typeof m.en === 'string'),
  );
  return { topicWords, senseGroups };
}
