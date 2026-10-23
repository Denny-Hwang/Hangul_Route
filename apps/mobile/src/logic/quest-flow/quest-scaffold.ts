import type { KoText, ListenPickRound, RealiaReadRound } from '@hangul-route/content-schema';
import type { RoundAsked } from '../memory/asked';
import type { MinigameScope } from '../minigame-config';

/**
 * The scaffold round of a hard Practice (F-CURR-002 section 4.6, row CM-24): one Listen & Pick round, a shipped and
 * easier format (hear it, then pick it), over the Practice's own items, with the hint showing (the right card ringed
 * from the start). The prompt is the last item missed on the first try; the options are the missed items first,
 * then the Practice's other items, three at most. Nothing new is asked: every text is the Practice scope's own.
 * Trace a Word lists its traced words; Realia Read each round's key word (shown under its question) or, with none,
 * its answer when the answer is a word (a picture or a figure answer lists nothing).
 */

/** The Korean a scope's rounds ask, each once, in order. */
export function scopeItems(scope: MinigameScope): KoText[] {
  let all: KoText[] = [];
  switch (scope.kind) {
    case 'pic-word-match':
      all = (scope.picWord?.boards ?? []).flatMap((b) => b.pairs.map((p) => p.word));
      break;
    case 'order-it':
      all = (scope.orderIt?.rounds ?? []).map((r) => r.sentence);
      break;
    case 'type-hangul':
      all = (scope.typeHangul?.rounds ?? []).map((r) => r.target);
      break;
    case 'listen-pick':
      all = (scope.listenPick?.rounds ?? []).filter((r) => !r.id.startsWith('lp:sym:')).map((r) => r.prompt);
      break;
    case 'trace-word':
      all = (scope.traceWord?.rounds ?? []).map((r) => r.word);
      break;
    case 'realia-read':
      all = (scope.realiaRead?.rounds ?? []).flatMap((r) => {
        const word = realiaWord(r);
        return word ? [word] : [];
      });
      break;
    case 'tap-respond':
      all = (scope.dialogue ?? []).flatMap((t) =>
        t.npcRomanization
          ? [{ ko: t.npcKo, romanization: t.npcRomanization, en: t.npcEn, ...(t.npcSpokenKo ? { spokenKo: t.npcSpokenKo } : {}), ...(t.npcAudioRef ? { audioRef: t.npcAudioRef } : {}) }]
          : [],
      );
      break;
    default:
      break;
  }
  const seen = new Set<string>();
  return all.filter((t) => !seen.has(t.ko) && !!seen.add(t.ko));
}

/** The Korean one missed round asked: its texts, or the item its scope names by id. */
function askedKo(asked: RoundAsked): string | undefined {
  if (asked.texts?.[0] !== undefined) return asked.texts[0];
  const { scope, itemId } = asked;
  if (!scope || itemId === undefined) return undefined;
  const byId = <T extends { id: string }>(list: readonly T[] | undefined): T | undefined => list?.find((r) => r.id === itemId);
  return (
    scope.picWord?.boards.flatMap((b) => b.pairs).find((p) => p.id === itemId)?.word.ko ??
    byId(scope.orderIt?.rounds)?.sentence.ko ??
    byId(scope.typeHangul?.rounds)?.target.ko ??
    byId(scope.listenPick?.rounds)?.prompt.ko ??
    byId(scope.traceWord?.rounds)?.word.ko ??
    realiaWord(byId(scope.realiaRead?.rounds))?.ko
  );
}

/** A Realia Read round's word: its key word, else its answer when that is a word. */
function realiaWord(round: RealiaReadRound | undefined): KoText | undefined {
  return round ? (round.key ?? round.options.find((o) => o.id === round.answerId)?.text) : undefined;
}

export const SCAFFOLD_ROUND_ID = 'scaffold:1';

/** The scaffold round's scope, or null when the misses name no item of the Practice or its pick would have one option. */
export function scaffoldScope(practice: MinigameScope, missed: readonly RoundAsked[]): MinigameScope | null {
  const items = scopeItems(practice);
  const byKo = new Map(items.map((t) => [t.ko, t]));
  const wanted = [...missed].reverse().flatMap((a) => {
    const t = byKo.get(askedKo(a) ?? '');
    return t ? [t] : [];
  });
  const target = wanted[0];
  if (!target) return null;
  const options = [...new Set([...wanted, ...items])].slice(0, 3);
  if (options.length < 2) return null;
  const round: ListenPickRound = {
    id: SCAFFOLD_ROUND_ID,
    prompt: target,
    options: options.map((text, i) => ({ id: `o${i}`, text })),
    answerId: 'o0',
  };
  return { kind: 'listen-pick', rounds: 1, listenPick: { rounds: [round] } };
}
