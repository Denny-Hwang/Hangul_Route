import type { RolePlayReply, RolePlayScene } from '@hangul-route/content-schema';
import { rolePlayTurnCount } from '@hangul-route/content-schema';
import { koTokenParts, type KoTokenPart } from '../ko-tokens';
import { shuffle } from '../shuffle';
import { lookHereOf, turnOf, type RpState } from './reducer';

/**
 * What the Role Play screen draws (row CM-35; design/wireframes/minigame/role-play.md): the chat log, the replies of
 * the turn in their seeded order, the progress, Hoya's line and the accessible names. Pure; the renderer only lays
 * these out. Meanings of the replies stay hidden until Show meanings (design D3); the partner line keeps its meaning,
 * because it is what the turn reads from.
 */

export interface BubbleView {
  /** Stable per bubble: its place in the log. */
  key: string;
  who: 'partner' | 'me';
  node: string;
  ko: string;
  romanization: string;
  /** The partner line's meaning (a reply the learner sent shows none). */
  meaning?: string;
  /** The bubble's accessible name. */
  label: string;
  /** The line it says when its Hear it is pressed. */
  speech: { ko: string; spokenKo?: string; audioRef?: string };
}

export interface RolePlayLabels {
  partner: (role: string, line: string, romanization: string, meaning: string) => string;
  me: (line: string, romanization: string) => string;
}

/** The chat log, oldest first. */
export function logView(scene: RolePlayScene, state: Pick<RpState, 'log'>, labels: RolePlayLabels): BubbleView[] {
  const out: BubbleView[] = [];
  state.log.forEach((entry, i) => {
    const node = turnOf(scene, { node: entry.node });
    if (node === undefined) return;
    if (entry.who === 'partner') {
      const { line } = node;
      out.push({
        key: `${i}`,
        who: 'partner',
        node: node.id,
        ko: line.ko,
        romanization: line.romanization,
        meaning: line.en,
        label: labels.partner(scene.partner.en, line.ko, line.romanization, line.en),
        speech: line,
      });
      return;
    }
    const reply = node.replies.find((r) => r.id === entry.reply);
    if (reply === undefined) return;
    out.push({ key: `${i}`, who: 'me', node: node.id, ko: reply.text.ko, romanization: reply.text.romanization, label: labels.me(reply.text.ko, reply.text.romanization), speech: reply.text });
  });
  return out;
}

/** FNV-1a over the seed text: one order per turn, the same each time the turn opens. */
function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 233280;
}

/** The replies of the turn on screen in their seeded order (wireframe: "the order is seeded per turn"); [] at the end. */
export function repliesOf(scene: RolePlayScene, state: Pick<RpState, 'node'>): RolePlayReply[] {
  const turn = turnOf(scene, state);
  return turn === undefined ? [] : shuffle(turn.replies, seedOf(`${scene.title.ko}|${scene.start}|${turn.id}`));
}

export type ReplyLook = 'open' | 'locked' | 'sending' | 'lookHere';

export interface ReplyView {
  id: string;
  ko: string;
  romanization: string;
  /** Shown once Show meanings is pressed. */
  meaning?: string;
  look: ReplyLook;
  /** Locked or being sent: a tap does nothing. */
  disabled: boolean;
}

export function replyViews(scene: RolePlayScene, state: RpState): ReplyView[] {
  const ring = lookHereOf(scene, state);
  return repliesOf(scene, state).map((r) => {
    const look: ReplyLook = state.locked.includes(r.id) ? 'locked' : state.sending === r.id ? 'sending' : ring === r.id ? 'lookHere' : 'open';
    return {
      id: r.id,
      ko: r.text.ko,
      romanization: r.text.romanization,
      ...(state.meanings ? { meaning: r.text.en } : {}),
      look,
      disabled: look === 'locked' || state.sending !== null,
    };
  });
}

/** Hoya's amber line after a less natural reply: its why line, split around `{ko:}` tokens (drawn with romanization). */
export function whyParts(scene: RolePlayScene, state: Pick<RpState, 'node' | 'why'>): KoTokenPart[] | null {
  const turn = turnOf(scene, state);
  const why = turn?.replies.find((r) => r.id === state.why)?.whyEn;
  return why === undefined ? null : koTokenParts(why);
}

/** The plain text of a why line, for its live announcement: each token's Korean and romanization in place. */
export function partsText(parts: readonly KoTokenPart[]): string {
  return parts.map((p) => ('text' in p ? p.text : p.romanization === '' ? p.ko : `${p.ko} ${p.romanization}`)).join('');
}

/** The progress bar and pill: the learner turn on screen of the scene's turns (every way has as many). */
export function progressOf(scene: RolePlayScene, state: Pick<RpState, 'turn' | 'done'>): { value: number; max: number } {
  const max = rolePlayTurnCount(scene);
  return { value: state.done ? max : Math.min(state.turn + 1, max), max };
}

/** The closing line of the end node, once the chat is over. */
export function closingOf(scene: RolePlayScene, state: Pick<RpState, 'node' | 'done'>): string | null {
  if (!state.done) return null;
  const node = scene.nodes.find((n) => n.id === state.node);
  return node !== undefined && 'end' in node ? node.closingEn : null;
}

export interface PinnedSizes {
  windowHeight: number;
  /** The room under the header for the log and the pinned area together (0 until measured). */
  bodyHeight: number;
  /** The newest partner bubble, Hear it included (0 until measured). */
  newestHeight: number;
  /** The instruction row and the first reply (0 until measured). */
  keepHeight: number;
}

/**
 * Layout B's pinned area cap (design README "Constants"; wireframe States): up to half the window, less when the
 * newest partner bubble needs the room, never less than the instruction row and one reply. Past it the area scrolls.
 */
export function pinnedCap({ windowHeight, bodyHeight, newestHeight, keepHeight }: PinnedSizes): number {
  const half = windowHeight / 2;
  const room = bodyHeight > 0 ? bodyHeight - newestHeight : half;
  return Math.max(keepHeight, Math.min(half, room));
}
