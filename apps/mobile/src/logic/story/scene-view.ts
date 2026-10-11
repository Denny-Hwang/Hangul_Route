import {
  narrationTokenIds,
  parseNarration,
  sceneKorean,
  type CultureNote,
  type KoText,
  type SceneArt,
  type SpeechLang,
  type Story,
  type StoryCheck,
  type StoryKeyword,
  type StoryLevel,
  type StoryScene,
} from '@hangul-route/content-schema';
import { STORY_READER_COPY } from './story-reader-copy';

/**
 * The pure view model of one reader scene (F-STORY-002 §3.2). The component
 * only draws it: every rule (what is a word vs a line, what order a level
 * shows things in, what a broken token falls back to) lives here. Locale
 * overlays (`localize*`, F-I18N-001 §3.6) are applied by the caller before
 * this function, so a missing overlay field is already the English text.
 */

export type NarrationPartView = { text: string } | { kw: StoryKeyword };

export interface SceneKorean {
  /** A single word / phrase keyword, or a full line. */
  kind: 'word' | 'line';
  text: KoText;
  /** Authored word-by-word breakdown of a line; never invented. */
  words?: KoText[];
}

/** The blocks of the text card, in display order for the level. */
export type SceneBlock = 'art' | 'narration' | 'korean' | 'caption';

export interface SceneLabels {
  /** The page number "3 / 8" (a position, not a meter). */
  position: string;
  /** "Scene 3 of 8". */
  scene: string;
  /** What the screen reader announces when the scene opens: position, then the picture. */
  announcement: string;
  /** "Next", and "Finish" on the last scene. */
  next: string;
}

export interface SceneView {
  sceneId: string;
  level: StoryLevel;
  /** 1-based. */
  position: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  /** Null when the scene has no art or it is pending: the tinted fallback panel shows. */
  art: SceneArt | null;
  /** Screen-reader description of the picture ('' when there is nothing to say). */
  altEn: string;
  narrationParts: NarrationPartView[];
  /** The language of the narration actually shown (an overlay's, else English). */
  narrationLang: SpeechLang;
  narrationAudioRef: string | null;
  korean: SceneKorean | null;
  /** The authored caption, else the first six words of the narration. */
  captionEn: string;
  cultureNote: CultureNote | null;
  checkpoint: StoryCheck | null;
  blocks: SceneBlock[];
  /** Traditional / adapted tale: the "Traditional tale" pill sits under the art on every scene. */
  traditional: boolean;
  labels: SceneLabels;
}

export interface SceneViewContext {
  /** Language of the narration text as shown. Default `en-US`; see `narrationSpeechLang` (scene-audio.ts). */
  narrationLang?: SpeechLang;
}

const CAPTION_WORDS = 6;

const BLOCKS_BY_LEVEL: Record<StoryLevel, readonly SceneBlock[]> = {
  listen: ['art', 'narration', 'korean'],
  'read-along': ['art', 'korean', 'narration'],
  read: ['art', 'korean', 'caption'],
};

export function isTraditionalTale(story: Pick<Story, 'origin'>): boolean {
  return story.origin.type === 'traditional' || story.origin.type === 'adapted';
}

function koTextOf(source: KoText): KoText {
  const text: KoText = { ko: source.ko, romanization: source.romanization, en: source.en };
  if (source.spokenKo !== undefined) text.spokenKo = source.spokenKo;
  if (source.audioRef !== undefined) text.audioRef = source.audioRef;
  if (source.syllables !== undefined) text.syllables = source.syllables;
  return text;
}

function mergeText(parts: NarrationPartView[]): NarrationPartView[] {
  const merged: NarrationPartView[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if ('text' in part && last !== undefined && 'text' in last) last.text += part.text;
    else merged.push('text' in part ? { text: part.text } : part);
  }
  return merged;
}

/**
 * Splits a scene's narration around its `{kw:id}` tokens. It never throws: a
 * token whose keyword is not in the bundle shows the keyword the scene itself
 * carries when ids match (a chip with the bare Korean), else the bare id as
 * plain text; a malformed brace drops the broken span. `{kw:...}` never reaches
 * the screen.
 */
function narrationPartsOf(story: Story, scene: StoryScene): NarrationPartView[] {
  const known: StoryKeyword[] =
    scene.keyword && !story.keywords.some((k) => k.id === scene.keyword?.id)
      ? [...story.keywords, scene.keyword]
      : story.keywords;
  const placeholders = new Map<string, StoryKeyword>();
  for (const id of narrationTokenIds(scene.narrationEn)) {
    if (!known.some((k) => k.id === id) && !placeholders.has(id)) {
      placeholders.set(id, { id, ko: '', romanization: id, en: '', kind: 'word' });
    }
  }
  try {
    const parts = parseNarration(scene.narrationEn, [...known, ...placeholders.values()]);
    return mergeText(
      parts.map((p) => {
        if (!('kw' in p)) return p;
        return placeholders.get(p.kw.id) === p.kw ? { text: p.kw.id } : p;
      }),
    );
  } catch {
    const plain = scene.narrationEn
      .replace(/\{[^}]*\}?/g, '')
      .replace(/\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return plain === '' ? [] : [{ text: plain }];
  }
}

function plainNarration(parts: readonly NarrationPartView[]): string {
  return parts.map((p) => ('text' in p ? p.text : p.kw.romanization)).join('');
}

/** The scene's caption: authored, else the first six words of the narration (§3.8 section headers). */
export function sceneCaption(story: Story, scene: StoryScene): string {
  if (scene.captionEn !== undefined) return scene.captionEn;
  return plainNarration(narrationPartsOf(story, scene))
    .split(/\s+/)
    .filter((w) => w !== '')
    .slice(0, CAPTION_WORDS)
    .join(' ');
}

function koreanOf(scene: StoryScene): SceneKorean | null {
  const source = sceneKorean(scene);
  if (!source) return null;
  const korean: SceneKorean = { kind: scene.line ? 'line' : 'word', text: koTextOf(source) };
  if (scene.line?.words) korean.words = scene.line.words.map(koTextOf);
  return korean;
}

/**
 * @returns null when the story has no tier for `level` or no scene at `index`
 *   (the screen then shows its one-line fallback).
 */
export function buildSceneView(
  story: Story,
  level: StoryLevel,
  index: number,
  ctx: SceneViewContext = {},
): SceneView | null {
  const tier = story.tiers.find((t) => t.level === level);
  const scene = Number.isInteger(index) && index >= 0 ? tier?.scenes[index] : undefined;
  if (!tier || !scene) return null;

  const copy = STORY_READER_COPY.reader;
  const total = tier.scenes.length;
  const position = index + 1;
  const art = scene.artPending === true ? null : (scene.art ?? null);
  const altEn = scene.art?.altEn ?? scene.captionEn ?? '';
  const korean = koreanOf(scene);
  const isLast = position === total;

  return {
    sceneId: scene.id,
    level,
    position,
    total,
    isFirst: index === 0,
    isLast,
    art,
    altEn,
    narrationParts: narrationPartsOf(story, scene),
    narrationLang: ctx.narrationLang ?? 'en-US',
    narrationAudioRef: scene.narrationAudioRef ?? null,
    korean,
    captionEn: sceneCaption(story, scene),
    cultureNote: story.cultureNotes.find((n) => n.id === scene.cultureNoteId) ?? null,
    checkpoint: tier.checkpoints.find((c) => c.id === scene.checkpointId) ?? null,
    blocks: BLOCKS_BY_LEVEL[level].filter((b) => b !== 'korean' || korean !== null),
    traditional: isTraditionalTale(story),
    labels: {
      position: copy.position(position, total),
      scene: copy.sceneOf(position, total),
      announcement: altEn === '' ? copy.sceneOf(position, total) : copy.announce(position, total, altEn),
      next: isLast ? copy.finish : copy.next,
    },
  };
}
