/**
 * Hidden Heritage scenes (F-CURR-002 §7.1 F7 and OD-10, row CM-36; design/wireframes/minigame/hidden-heritage.md,
 * "Scene style guide"). Pure data types: a scene is a scene-art description (a setting and layers of registry items,
 * every colour a token path) plus the items it adds to the registry, the layer each named thing is drawn by, a
 * reference round (the spots a lesson copies), its source note and its review record.
 *
 * Not exported from the package barrel: a scene and its items ride in the app's lazy scene chunk (§10), and the profile
 * checks (`./profile.ts`) run in tests and on the contact sheet only, so the start bundle carries none of them.
 */
import type { ColorToken, ItemDef, SceneArtLike } from '../types';

/** A thing's hit area on the 400 x 300 canvas. Structural twin of content-schema `HiddenHeritageSpot`. */
export interface HiddenHeritageSpotLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A named thing of a round: its Korean word (the meaning names its spot) and its spot. */
export interface HiddenHeritageThingLike {
  id: string;
  word: { ko: string; romanization: string; en: string };
  spot: HiddenHeritageSpotLike;
}

/** Structural twin of content-schema `HiddenHeritageRound` (the design system does not depend on content-schema). */
export interface HiddenHeritageRoundLike {
  id: string;
  sceneId: string;
  altEn: string;
  targets: ReadonlyArray<HiddenHeritageThingLike & { picture: string }>;
  others: readonly HiddenHeritageThingLike[];
}

/** One public source of a fact (§5.1, §6.6): an allowlisted institution, its page, the access date and the quoted words. */
export interface SceneSource {
  institution: string;
  title: string;
  url: string;
  accessed: string;
  quote: string;
}

/** The scene's subject note: what the scene shows, the facts its card back may carry, each with its sources (OD-10). */
export interface SceneNote {
  /** The everyday-life subject genre painting shows; the scene is composed fresh and copies no painting. */
  subjectEn: string;
  facts: ReadonlyArray<{ id: string; claimEn: string; sources: readonly SceneSource[] }>;
  /** What the drawing simplifies, for the culture reviewer. */
  accuracyNote: string;
}

/** The multi-agent review record (MAR is the language and culture review; no native-speaker or expert claim). */
export interface SceneReview {
  reviewedBy: 'MAR';
  reviewedAt: string;
  passes: number;
  notes: readonly string[];
}

export interface HiddenHeritageScene {
  /** `scene:<key>`, the round's `sceneId`. */
  id: string;
  art: SceneArtLike;
  /** The setting and props this scene adds to the registry (they live in its chunk only). */
  items: readonly ItemDef[];
  /** The layer (index into `art.layers`) that draws each named thing. */
  things: Readonly<Record<string, number>>;
  /** The reference round: the targets and other things with their spots, as a lesson writes them. */
  round: HiddenHeritageRoundLike;
  note: SceneNote;
  review: SceneReview;
}

/**
 * The rings the game draws over a spot (wireframe "States" and "Contrast"): found, miss and look-here, each at
 * `borderWidth.thick` with a `casing` of `borderWidth.thin` on both sides, so a ring reads on any fill. The scene itself
 * never uses these tokens, nor `border.focus` (the keyboard focus outline).
 */
export const HIDDEN_HERITAGE_RINGS = {
  found: 'feedback.success',
  miss: 'feedback.nudge',
  hint: 'feedback.info',
  casing: 'text.primary',
} as const satisfies Record<string, ColorToken>;
export type HiddenHeritageRings = { readonly [K in keyof typeof HIDDEN_HERITAGE_RINGS]?: ColorToken };
