/**
 * The contact sheet's view model (F-STORY-002 §3.9.6): one section per story,
 * one row per scene with its art, brief, narration chips, cited facts, layers
 * and findings. Pure: the page reads the files and renders what this returns.
 */
import { lintStory, parseNarration, parseStory, type SceneArt, type Story, type StoryFact, type StoryLevel } from '@hangul-route/content-schema';
import { checkScene, type Registry } from '@hangul-route/design-system/scene-art';
import type { StoryFile } from './read-stories';

export type Severity = 'error' | 'warning';

export interface SheetFinding {
  /** `art` = checkScene (F-STORY-002 §3.9.5), `lint` = lintStory (F-STORY-001 §3.8). */
  source: 'art' | 'lint';
  rule: string;
  severity: Severity;
  message: string;
  /** JSON path of a lint finding. */
  path?: string;
}

export type NarrationChip = { kind: 'text'; text: string } | { kind: 'kw'; ko: string; romanization: string; en: string };

export interface SheetLayer {
  ref: string;
  x: number;
  y: number;
  s: number;
  /** The layer's band: its own `z`, else the item's default, `mid` for a card, `?` for an unknown ref. */
  z: string;
}

export interface SheetFact {
  id: string;
  claimEn: string;
  /** Source titles, in file order. */
  sources: string[];
}

export interface SheetScene {
  /** Unique within the sheet, e.g. `story:sejong-new-letters/listen/s2`. */
  key: string;
  level: StoryLevel;
  id: string;
  art?: SceneArt;
  artPending: boolean;
  brief?: string;
  narration: NarrationChip[];
  facts: SheetFact[];
  layers: SheetLayer[];
  findings: SheetFinding[];
}

export interface SheetStory {
  file: string;
  id: string;
  titleEn: string;
  titleKo: string;
  state: Story['state'];
  kind: Story['kind'];
  origin: Story['origin']['type'];
  passes: number;
  theme: Story['theme'];
  scenes: SheetScene[];
  /** Lint findings that point at the story, not at one scene. */
  findings: SheetFinding[];
}

export interface SheetCounts {
  stories: number;
  scenes: number;
  withArt: number;
  artPending: number;
  draft: number;
  errors: number;
  warnings: number;
}

export interface SceneSheet {
  stories: SheetStory[];
  /** Files that are not JSON or not a story. */
  failed: Array<{ file: string; message: string }>;
  counts: SheetCounts;
}

const SCENE_PATH = /^tiers\[(\d+)\]\.scenes\[(\d+)\]/;

function chipsOf(text: string, story: Story, scene: Story['tiers'][number]['scenes'][number]): NarrationChip[] {
  const keywords = scene.keyword ? [scene.keyword, ...story.keywords] : story.keywords;
  try {
    return parseNarration(text, keywords).map((part) =>
      'kw' in part ? { kind: 'kw', ko: part.kw.ko, romanization: part.kw.romanization, en: part.kw.en } : { kind: 'text', text: part.text },
    );
  } catch {
    return [{ kind: 'text', text }]; // lint reports the bad token
  }
}

function layersOf(art: SceneArt | undefined, registry: Registry): SheetLayer[] {
  return (art?.layers ?? []).map((l) => {
    const known = Object.hasOwn(registry, l.ref) ? registry[l.ref] : undefined;
    const z = l.z ?? (l.ref.startsWith('card:') ? 'mid' : known?.z ?? '?');
    return { ref: l.ref, x: l.x, y: l.y, s: l.s, z };
  });
}

function buildStory(file: string, story: Story, registry: Registry, today: string | undefined): SheetStory {
  const lint = lintStory(story, today ? { today } : {});
  const facts = new Map(story.facts.map((f) => [f.id, f]));
  const sceneFindings = new Map<string, SheetFinding[]>();
  const storyFindings: SheetFinding[] = [];
  for (const f of lint) {
    const finding: SheetFinding = { source: 'lint', rule: f.rule, severity: f.level, message: f.message, path: f.path };
    const m = SCENE_PATH.exec(f.path);
    if (!m) {
      storyFindings.push(finding);
      continue;
    }
    const key = `${m[1]}/${m[2]}`;
    sceneFindings.set(key, [...(sceneFindings.get(key) ?? []), finding]);
  }

  const scenes = story.tiers.flatMap((tier, ti) =>
    tier.scenes.map((scene, si): SheetScene => {
      const art: SheetFinding[] = scene.art
        ? checkScene(scene.art, registry).map((f) => ({ source: 'art', rule: f.rule, severity: f.severity, message: f.message }))
        : [];
      return {
        key: `${story.id}/${tier.level}/${scene.id}`,
        level: tier.level,
        id: scene.id,
        ...(scene.art ? { art: scene.art } : {}),
        artPending: scene.artPending === true,
        ...(scene.artBrief ? { brief: scene.artBrief } : {}),
        narration: chipsOf(scene.narrationEn, story, scene),
        // parseStory has already rejected a factId that names no fact
        facts: scene.factIds
          .map((id) => facts.get(id))
          .filter((fact): fact is StoryFact => fact !== undefined)
          .map((fact) => ({ id: fact.id, claimEn: fact.claimEn, sources: fact.sources.map((s) => s.title) })),
        layers: layersOf(scene.art, registry),
        findings: [...art, ...(sceneFindings.get(`${ti}/${si}`) ?? [])],
      };
    }),
  );

  return {
    file,
    id: story.id,
    titleEn: story.title.en,
    titleKo: story.title.ko,
    state: story.state,
    kind: story.kind,
    origin: story.origin.type,
    passes: story.verification.passes,
    theme: story.theme,
    scenes,
    findings: storyFindings,
  };
}

export function buildSceneSheet(files: readonly StoryFile[], registry: Registry, ctx: { today?: string } = {}): SceneSheet {
  const stories: SheetStory[] = [];
  const failed: SceneSheet['failed'] = [];
  for (const { file, json, error } of files) {
    if (error !== undefined) {
      failed.push({ file, message: error });
      continue;
    }
    try {
      stories.push(buildStory(file, parseStory(json), registry, ctx.today));
    } catch (e) {
      failed.push({ file, message: (e as Error).message });
    }
  }
  const scenes = stories.flatMap((s) => s.scenes);
  const findings = [...stories.flatMap((s) => s.findings), ...scenes.flatMap((s) => s.findings)];
  return {
    stories,
    failed,
    counts: {
      stories: stories.length,
      scenes: scenes.length,
      withArt: scenes.filter((s) => s.art).length,
      artPending: scenes.filter((s) => s.artPending).length,
      draft: stories.filter((s) => s.state === 'draft').length,
      errors: findings.filter((f) => f.severity === 'error').length + failed.length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
    },
  };
}
