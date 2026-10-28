import { fillClozeGap } from '@hangul-route/content-schema';
import type { ReviewItem, ReviewItemKind } from '@hangul-route/content-schema/review-items';
import type { MinigameScope } from '../minigame-config';
import { buildCheckView, type CheckView } from '../story/check-view';
import type { RoundAsked } from './asked';
import type { Rung } from './spacing';

/**
 * From what a round asked to the review items it asked (F-CURR-002 section 4.3, row CM-12). The
 * build froze every taught unit as an item with its Korean (row CM-10); a round names its Korean, so
 * the item is the one with that Korean, preferring an item the round's own cell teaches (a recycle
 * round asks an earlier cell's item, and still finds it). Pure over the loaded item index.
 */

/** A piece of asked Korean, and the item kind the context prefers. */
export interface AskedText {
  ko: string;
  kind?: ReviewItemKind;
}

export interface ResolvedRound {
  texts: AskedText[];
  jamoIds: string[];
  rung: Rung;
}

/** The comparison form of taught Korean, as the build keys items (`normalizeKo`): NFC, single spaces, no edge punctuation. */
export function normalizeAskedKo(ko: string): string {
  return ko
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["'“”‘’(]+|[.!?~…,"'“”‘’)]+$/g, '')
    .trim();
}

/** The teaching cell of a quest's episode: a story's listen quest plays on its shelf episode, the story's items name the story. */
export function cellOfEpisode(episodeId: string): string {
  return episodeId.startsWith('episode:shelf-') ? `story:${episodeId.slice('episode:shelf-'.length)}` : episodeId;
}

/** The shard of an item (section 4.8): its pack for a pack item, else its first stage. */
export function shardOf(item: Pick<ReviewItem, 'home' | 'stage'>): string {
  return item.home.startsWith('pack:') ? item.home : `stage${item.stage}`;
}

export interface ItemLookup {
  byId: ReadonlyMap<string, ReviewItem>;
  byKo: ReadonlyMap<string, readonly ReviewItem[]>;
  retired: ReadonlySet<string>;
}

export function buildLookup(items: readonly ReviewItem[], retired: ReadonlySet<string>): ItemLookup {
  const byKo = new Map<string, ReviewItem[]>();
  for (const item of items) {
    const key = normalizeAskedKo(item.ko);
    const list = byKo.get(key);
    if (list) list.push(item);
    else byKo.set(key, [item]);
  }
  return { byId: new Map(items.map((i) => [i.id, i])), byKo, retired };
}

/** The best of several items with the same Korean: one the round's own cell teaches or asks again, the kind it asks, an initial symbol before a final, then the id. */
function pick(candidates: readonly ReviewItem[], cell: string, kind: ReviewItemKind | undefined): ReviewItem | undefined {
  const score = (i: ReviewItem): number => (i.cells.includes(cell) || i.asked.includes(cell) ? 4 : 0) + (kind !== undefined && i.kind === kind ? 2 : 0) + (i.id.endsWith('-batchim') ? 0 : 1);
  let best: ReviewItem | undefined;
  for (const item of candidates) {
    if (best === undefined || score(item) > score(best) || (score(item) === score(best) && item.id < best.id)) best = item;
  }
  return best;
}

/** The items a round asked, each once; retired and unknown ones are left out. */
export function resolveItems(lookup: ItemLookup, cell: string, round: Pick<ResolvedRound, 'texts' | 'jamoIds'>): ReviewItem[] {
  const out: ReviewItem[] = [];
  const add = (item: ReviewItem | undefined): void => {
    if (item !== undefined && !lookup.retired.has(item.id) && !out.includes(item)) out.push(item);
  };
  for (const jamoId of round.jamoIds) add(lookup.byId.get(`sym:${jamoId.replace(/^jamo:/, '')}`));
  for (const text of round.texts) {
    const candidates = (lookup.byKo.get(normalizeAskedKo(text.ko)) ?? []).filter((i) => !lookup.retired.has(i.id));
    add(pick(candidates, cell, text.kind));
  }
  return out;
}

const ko = (value: { ko?: unknown } | undefined): string | undefined => (typeof value?.ko === 'string' && value.ko.trim() !== '' ? value.ko : undefined);
const texts = (...values: Array<AskedText | undefined>): AskedText[] => values.filter((v): v is AskedText => v !== undefined);
const text = (value: { ko?: unknown } | undefined, kind?: ReviewItemKind): AskedText | undefined => {
  const k = ko(value);
  return k === undefined ? undefined : kind === undefined ? { ko: k } : { ko: k, kind };
};

/**
 * What a host game's round asked, read from its scope by the answered round's id (Listen & Pick,
 * Pic-Word Match, Sentence Builder, Realia Read, Type Hangul, Write a Frame, Story Order). Trace a Word copies a
 * word shown on screen, so it asks no item; an unknown kind or id asks nothing.
 */
export function askedOfScope(scope: MinigameScope, itemId: string): ResolvedRound | undefined {
  switch (scope.kind) {
    case 'listen-pick': {
      const round = scope.listenPick?.rounds.find((r) => r.id === itemId);
      if (!round) return undefined;
      if (round.id.startsWith('lp:sym:')) return { texts: [], jamoIds: [round.id.slice('lp:sym:'.length)], rung: 'recognize' };
      return { texts: texts(text(round.prompt, round.id.startsWith('lp:syl:') ? 'syl' : undefined)), jamoIds: [], rung: 'recognize' };
    }
    case 'pic-word-match': {
      const pair = scope.picWord?.boards.flatMap((b) => b.pairs).find((p) => p.id === itemId);
      return pair ? { texts: texts(text(pair.word)), jamoIds: [], rung: 'read' } : undefined;
    }
    case 'order-it': {
      const round = scope.orderIt?.rounds.find((r) => r.id === itemId);
      return round ? { texts: texts(text(round.sentence, 'pat')), jamoIds: [], rung: 'produce' } : undefined;
    }
    case 'realia-read': {
      // The round asks the card (one `rea` item, read rung, section 4.3), not its key word or options.
      const realia = scope.realiaRead;
      const round = realia?.rounds.find((r) => r.id === itemId);
      if (!realia || !round) return undefined;
      const shown = realia.realia.title ?? realia.realia.entries[0]?.text;
      return { texts: texts(text(shown, 'rea')), jamoIds: [], rung: 'read' };
    }
    case 'type-hangul': {
      const round = scope.typeHangul?.rounds.find((r) => r.id === itemId);
      return round ? { texts: texts(text(round.target)), jamoIds: [], rung: 'produce' } : undefined;
    }
    case 'write-frame': {
      const round = scope.writeFrame?.rounds.find((r) => r.id === itemId);
      return round ? { texts: texts(text(round.frame, 'pat')), jamoIds: [], rung: 'produce' } : undefined;
    }
    case 'cloze-pick': {
      // Row CM-30, the produce rung (section 4.3): a word or particle gap asks the completed sentence (and a word gap
      // its answer word, so what the review index holds and what the memory credits agree); a value gap
      // asks the card it is read from (the `rea` item). Its Listen & Pick fallback answers with the same round ids.
      const round = scope.clozePick?.rounds.find((r) => r.id === itemId);
      if (!round) return undefined;
      if (round.gapKind === 'value') {
        const realia = scope.clozePick?.realia;
        const shown = realia ? (realia.title ?? realia.entries[0]?.text) : undefined;
        return shown ? { texts: texts(text(shown, 'rea')), jamoIds: [], rung: 'produce' } : undefined;
      }
      const answer = round.tiles[round.answerIndex];
      if (!answer) return undefined;
      // A word gap also asks its answer word (the build's item of it, as extract.ts emits); a particle is no item.
      const word = round.gapKind === 'particle' ? undefined : text(answer);
      return { texts: texts({ ko: fillClozeGap(round.sentence.ko, answer.ko), kind: 'pat' }, word), jamoIds: [], rung: 'produce' };
    }
    case 'story-order': {
      // F-CURR-002 row CM-34: a slot asks the line that comes next (`<round>/<panel>`), read in order: the read rung. No
      // kind, as Listen & Pick: a sentence is the pattern item and a one-word caption the word item (the catalogue's kind).
      const at = itemId.indexOf('/');
      const round = scope.storyOrder?.rounds.find((r) => r.id === itemId.slice(0, at));
      const panel = at < 0 ? undefined : round?.panels.find((p) => p.id === itemId.slice(at + 1));
      return panel ? { texts: texts(text(panel.caption)), jamoIds: [], rung: 'read' } : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * What a story check asked, as reading: its Korean target, one item; a check with no Korean target
 * asks its Korean right answer instead; nothing for a check with no Korean. One answer grades one
 * item, so a miss never lowers a word the learner was not asked to recall.
 */
export function askedOfCheck(view: CheckView | undefined): ResolvedRound | undefined {
  if (!view) return undefined;
  const asked = text(view.target) ?? text(view.options.find((o) => o.id === view.correctOptionId));
  return asked !== undefined ? { texts: [asked], jamoIds: [], rung: 'read' } : undefined;
}

/** What a reader checkpoint (`cp:<id>`) asked, read from its story tier like a check. */
export function askedOfCheckpoint(checkpoint: NonNullable<RoundAsked['checkpoint']>): ResolvedRound | undefined {
  const { story, level, roundKey } = checkpoint;
  if (!story || !roundKey.startsWith('cp:')) return undefined;
  const id = roundKey.slice('cp:'.length);
  const check = story.tiers.find((t) => t.level === level)?.checkpoints?.find((c) => c.id === id);
  return check ? askedOfCheck(buildCheckView(check, story.id)) : undefined;
}

/** A game's own report of what it asked, or the scope's, in one shape; undefined when it asked no item. */
export function resolveRound(asked: RoundAsked): ResolvedRound | undefined {
  if (asked.scope !== undefined && asked.itemId !== undefined) return askedOfScope(asked.scope, asked.itemId);
  if (asked.check !== undefined) return askedOfCheck(asked.check);
  if (asked.checkpoint !== undefined) return askedOfCheckpoint(asked.checkpoint);
  const round: ResolvedRound = { texts: (asked.texts ?? []).map((k) => ({ ko: k })), jamoIds: [...(asked.jamoIds ?? [])], rung: asked.rung ?? 'read' };
  return round.texts.length + round.jamoIds.length > 0 ? round : undefined;
}
