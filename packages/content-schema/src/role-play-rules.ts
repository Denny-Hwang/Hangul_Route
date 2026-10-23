import { ROLE_PLAY_TURNS_MAX, ROLE_PLAY_TURNS_MIN, RolePlaySceneSchema, isRolePlayEnd, type RolePlayNode } from './schemas/role-play';

/**
 * The graph rules of a Role Play scene (F-CURR-002 section 7.1 F6 and 7.7, row CM-35; design/wireframes/minigame/
 * role-play.md, Round shape). Content-time only: the lesson lint runs them (`lesson-lint.ts`, the `./lint` subpath,
 * on every lesson cell, Volume 2 cell and pack level), so the start bundle, which carries the scene's shape with the
 * package barrel, does not carry them.
 *
 *   role-play-good-endings   from `start`, every way ends at an `end` node with a closing line: no dead end, no cycle,
 *                            no `next` that names no node, and every node is on a way (section 7.7: no bad ending)
 *   role-play-even-branches  every way has the same number of learner turns, 4 to 6, so the progress bar is honest
 *   role-play-turn-options   every turn has a natural and a less natural reply (something to nudge, and a wrong
 *                            option on every Tap to Respond fallback turn)
 *
 * and at most `ROLE_PLAY_PATHS_MAX` ways through a scene, so the multi-agent review reads every one (the wireframe's
 * cap of 4 leaves, counted as ways, so two branches that meet again count twice).
 */

export const ROLE_PLAY_PATHS_MAX = 4;
export const ROLE_PLAY_RULES = ['role-play-good-endings', 'role-play-even-branches', 'role-play-turn-options'] as const;
export type RolePlayRule = (typeof ROLE_PLAY_RULES)[number];

interface SceneShape {
  start: string;
  nodes: readonly RolePlayNode[];
}

export interface RolePlayIssue {
  /** The rule, or `lesson-schema` for the rest (repeated ids, too many ways, an unparsable scene). */
  rule: RolePlayRule | 'lesson-schema';
  path: (string | number)[];
  message: string;
}

/**
 * Every way through a scene from `start`: the node ids in order, the last one an `end`. A way that meets a cycle, a
 * missing node or a turn with no natural reply stops there (its last id is then not an end), so the rules can name it.
 * Stops after `limit` ways, so a wide graph is never walked in full.
 */
export function rolePlayPaths(scene: SceneShape, limit = 64): string[][] {
  const byId = new Map(scene.nodes.map((n) => [n.id, n]));
  const out: string[][] = [];
  const walk = (id: string, path: readonly string[]): void => {
    if (out.length >= limit) return;
    const node = byId.get(id);
    const here = [...path, id];
    if (node === undefined || isRolePlayEnd(node) || path.includes(id)) {
      out.push(here);
      return;
    }
    const nexts = node.replies.flatMap((r) => (r.kind === 'natural' && r.next !== undefined ? [r.next] : []));
    if (nexts.length === 0) out.push(here);
    for (const next of new Set(nexts)) walk(next, here);
  };
  walk(scene.start, []);
  return out;
}

/** The graph rules of one scene; empty when sound. */
export function rolePlayIssues(scene: SceneShape): RolePlayIssue[] {
  const out: RolePlayIssue[] = [];
  const add = (rule: RolePlayIssue['rule'], path: RolePlayIssue['path'], message: string): void => void out.push({ rule, path, message });
  const byId = new Map<string, RolePlayNode>();
  scene.nodes.forEach((n, i) => {
    if (byId.has(n.id)) add('lesson-schema', ['nodes', i, 'id'], `node id ${n.id} is used twice`);
    byId.set(n.id, n);
  });
  scene.nodes.forEach((n, i) => {
    if (isRolePlayEnd(n)) return;
    const replies = n.replies;
    if (new Set(replies.map((r) => r.id)).size < replies.length) add('lesson-schema', ['nodes', i, 'replies'], 'reply ids must be unique in a turn');
    if (new Set(replies.map((r) => r.text.ko.trim())).size < replies.length) add('lesson-schema', ['nodes', i, 'replies'], 'two replies of a turn share the same Korean');
    if (!replies.some((r) => r.kind === 'natural') || !replies.some((r) => r.kind === 'lessNatural')) {
      add('role-play-turn-options', ['nodes', i, 'replies'], 'a turn has at least one natural and one less natural reply');
    }
    replies.forEach((r, ri) => {
      if (r.next !== undefined && !byId.has(r.next)) add('role-play-good-endings', ['nodes', i, 'replies', ri, 'next'], `${r.next} is not a node of the scene`);
    });
  });
  const start = byId.get(scene.start);
  if (start === undefined || isRolePlayEnd(start)) {
    add('role-play-good-endings', ['start'], 'the scene starts on one of its turns');
    return out;
  }
  const paths = rolePlayPaths(scene, ROLE_PLAY_PATHS_MAX + 1);
  const dead = paths.filter((p) => !isRolePlayEnd(byId.get(p[p.length - 1] as string)));
  for (const p of dead) add('role-play-good-endings', ['nodes'], `the way ${p.join(' > ')} does not end at a closing line`);
  if (dead.length > 0) return out;
  if (paths.length > ROLE_PLAY_PATHS_MAX) {
    add('lesson-schema', ['nodes'], `a scene has at most ${ROLE_PLAY_PATHS_MAX} ways through it, so every way can be reviewed`);
    return out;
  }
  const turns = new Set(paths.map((p) => p.length - 1));
  if (turns.size > 1) add('role-play-even-branches', ['nodes'], 'every way through the scene has the same number of turns');
  for (const t of turns) {
    if (t < ROLE_PLAY_TURNS_MIN || t > ROLE_PLAY_TURNS_MAX) add('role-play-even-branches', ['nodes'], `a way through the scene has ${ROLE_PLAY_TURNS_MIN} to ${ROLE_PLAY_TURNS_MAX} turns (has ${t})`);
  }
  const reached = new Set(paths.flat());
  scene.nodes.forEach((n, i) => {
    if (!reached.has(n.id)) add('role-play-good-endings', ['nodes', i, 'id'], `node ${n.id} cannot be reached from the start`);
  });
  return out;
}

/** A scene the shape and every graph rule accept. */
export function isSoundRolePlayScene(scene: unknown): boolean {
  const parsed = RolePlaySceneSchema.safeParse(scene);
  return parsed.success && rolePlayIssues(parsed.data).length === 0;
}

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** The lint's path form: `quests[0].scopes[1].scene.nodes[2]`. */
const pathOf = (path: readonly (string | number)[]): string => path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${p}`)).join('').replace(/^\./, '');

/**
 * The graph rules over every `role-play` scope of a lesson file's quests (raw JSON). A scene that is not even the
 * shape is one `lesson-schema` finding at its first issue when `shapeErrors` is set (a Volume 2 or pack file, which
 * no strict schema reads yet); a Volume 1 cell's schema already reports it. `add` takes the rule, path and message.
 */
export function lintRolePlayScopes(quests: unknown, add: (rule: RolePlayIssue['rule'], path: string, message: string) => void, shapeErrors = true): void {
  (Array.isArray(quests) ? quests : []).forEach((quest, qi) => {
    const scopes = isRec(quest) && Array.isArray(quest.scopes) ? quest.scopes : [];
    scopes.forEach((scope, si) => {
      if (!isRec(scope) || scope.kind !== 'role-play') return;
      const at = ['quests', qi, 'scopes', si, 'scene'];
      const parsed = RolePlaySceneSchema.safeParse(scope.scene);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        if (shapeErrors) add('lesson-schema', pathOf([...at, ...(first?.path ?? [])]), `not a Role Play scene: ${first?.message ?? 'missing'}`);
        return;
      }
      for (const issue of rolePlayIssues(parsed.data)) add(issue.rule, pathOf([...at, ...issue.path]), issue.message);
    });
  });
}
