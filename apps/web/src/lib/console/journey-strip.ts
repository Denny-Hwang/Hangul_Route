import { StageKeySchema, type StageKey } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, getMessages, type UiLocale } from '@hangul-route/i18n';

/**
 * The journey strip on a roster card (F-ROUTE-001 section 3.12, R-9a; wireframe
 * `design/wireframes/console/roster.md` "Journey strip"). Built from the learner's own
 * `summary.journey` only: seven drawn segments with a word each, "On Stage N", and one line
 * per stage ("4 known from the level check, 2 quests done").
 *
 * The wire field is tolerant (`.optional().catch(undefined)`), and `stage` / `state` are plain
 * strings there, so they are checked here: an entry with an unknown stage key, an unknown state
 * or unreadable counts (a newer build) is ignored (section 3.17). An absent journey draws
 * nothing; it never reads as "no progress" (an old build, or a device that has not uploaded yet).
 *
 * Hard rules: class and family spaces only (a school space renders its admin view); a stage's
 * `total` is never shown; no average, distribution, sort or filter by stage is offered.
 */

export const JOURNEY_STATES = ['complete', 'known', 'explored', 'open', 'later'] as const;
export type JourneyState = (typeof JOURNEY_STATES)[number];

export interface JourneySegment {
  stage: StageKey;
  /** 1 to 7. */
  order: number;
  state: JourneyState;
  here: boolean;
  /** The segment's words for the screen-reader list: "Stage 1: Complete". */
  text: string;
}

export interface JourneyStrip {
  title: string;
  segments: JourneySegment[];
  /** "On Stage 2"; null when the summary names no readable stage. */
  onStage: string | null;
  /** The `<details>` summary. */
  details: string;
  /** One line per stage, consecutive empty coming-later stages merged. */
  lines: string[];
}

interface Entry {
  stage: StageKey;
  order: number;
  state: JourneyState;
  done: number;
  known: number;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isState = (value: unknown): value is JourneyState => typeof value === 'string' && (JOURNEY_STATES as readonly string[]).includes(value);
const stageOf = (value: unknown): StageKey | null => {
  const parsed = StageKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

function readEntries(stages: readonly unknown[]): Entry[] {
  const byStage = new Map<StageKey, Entry>();
  for (const raw of stages) {
    if (typeof raw !== 'object' || raw === null) continue;
    const { stage: rawStage, state, done, known } = raw as Record<string, unknown>;
    const stage = stageOf(rawStage);
    if (stage === null || byStage.has(stage) || !isState(state) || !isCount(done) || !isCount(known)) continue;
    byStage.set(stage, { stage, order: StageKeySchema.options.indexOf(stage) + 1, state, done, known });
  }
  return [...byStage.values()].sort((a, b) => a.order - b.order);
}

const isEmptyLater = (e: Entry): boolean => e.state === 'later' && e.done === 0 && e.known === 0;

export function journeyStrip(kind: string, journey: unknown, locale: UiLocale = DEFAULT_LOCALE): JourneyStrip | null {
  if (kind !== 'class' && kind !== 'family') return null;
  if (typeof journey !== 'object' || journey === null) return null;
  const { v, here: rawHere, stages } = journey as Record<string, unknown>;
  if (v !== 1 || !Array.isArray(stages)) return null;
  const entries = readEntries(stages);
  if (entries.length === 0) return null;

  const m = getMessages(locale).console.journey;
  const here = entries.find((e) => e.stage === stageOf(rawHere)) ?? null;

  const lines: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i] as Entry;
    if (!isEmptyLater(entry)) {
      lines.push(m.stage(entry.order, m.stageLine(entry.known, entry.done)));
      continue;
    }
    let last = entry;
    while (i + 1 < entries.length) {
      const next = entries[i + 1] as Entry;
      if (!isEmptyLater(next) || next.order !== last.order + 1) break;
      last = next;
      i += 1;
    }
    lines.push(last === entry ? m.stage(entry.order, m.state.later) : m.stages(entry.order, last.order, m.state.later));
  }

  return {
    title: m.title,
    segments: entries.map((e) => ({ stage: e.stage, order: e.order, state: e.state, here: e === here, text: m.stage(e.order, m.state[e.state]) })),
    onStage: here === null ? null : m.onStage(here.order),
    details: m.details,
    lines,
  };
}
