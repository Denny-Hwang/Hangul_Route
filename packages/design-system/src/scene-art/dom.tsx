/**
 * Plain-DOM renderer for scene art (F-STORY-002 §3.9.4), for the Next.js
 * contact sheet. No react-native: the web app imports this through the
 * `@hangul-route/design-system/scene-art/dom` subpath and never the package
 * root. What to draw is decided in `draw.ts` and `story-scene-model.ts`; this
 * only maps each item onto an svg element.
 */
import React from 'react';
import { borderWidth, colors, radii } from '../tokens';
import { drawScene, type DrawItem } from './draw';
import { HOYA_BOX, HOYA_POSES, type HoyaPose } from './hoya';
import { SCENE_ART_REGISTRY } from './registry';
import type { Registry } from './resolve';
import { FALLBACK_TINT_OPACITY, storySceneModel, type StorySceneModelInput } from './story-scene-model';
import { SCENE_CANVAS } from './types';

export interface SceneSvgProps extends StorySceneModelInput {
  /** Defaults to the shipped registry. */
  registry?: Registry;
}

function Item({ item }: { item: DrawItem }): React.ReactElement {
  if (item.tag === 'card') {
    // Card pictures are JSX in the app; the sheet shows where one sits.
    const dash = `${borderWidth.thick} ${borderWidth.thick}`;
    return (
      <rect width={item.size} height={item.size} rx={radii.sm} fill="none" stroke={colors.border.strong} strokeWidth={borderWidth.base} strokeDasharray={dash} transform={item.transform} data-card={item.ref}>
        <title>{`${item.ref} - shown in the app`}</title>
      </rect>
    );
  }
  const Tag = item.tag;
  return <Tag {...item.geometry} {...item.paint} transform={item.transform} />;
}

export function SceneSvg({ registry = SCENE_ART_REGISTRY, ...input }: SceneSvgProps): React.ReactElement {
  const model = storySceneModel(input, registry);
  const { width, height } = model;
  const viewBox = model.scene?.viewBox ?? `0 0 ${SCENE_CANVAS.width} ${SCENE_CANVAS.height}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={viewBox}
      role={model.label ? 'img' : undefined}
      aria-label={model.label}
      aria-hidden={model.decorative ? true : undefined}
      data-state={model.scene ? 'scene' : 'fallback'}
    >
      {model.scene ? (
        model.scene.items.map((item) => <Item key={item.key} item={item} />)
      ) : (
        <rect width={SCENE_CANVAS.width} height={SCENE_CANVAS.height} rx={radii.lg} fill={colors.theme[model.theme]} opacity={FALLBACK_TINT_OPACITY} />
      )}
    </svg>
  );
}

export interface HoyaSvgProps {
  pose: HoyaPose;
  /** Side of the square: px, or a percentage of the parent's width so he scales with it. Defaults to Hoya's own 128-unit box. */
  size?: number | `${number}%`;
  /** Accessible name. Without one the drawing is decorative (hidden from assistive technology). */
  label?: string;
}

/**
 * Hoya on his own, for web pages that are not story scenes (the public site): the
 * same `hoya:<pose>` scene-art item, placed at its anchor so his 128-unit box is
 * the viewBox. Tokens only, through the shared drawing list.
 */
export function HoyaSvg({ pose: poseIn, size = HOYA_BOX.w, label }: HoyaSvgProps): React.ReactElement {
  const pose: HoyaPose = HOYA_POSES.includes(poseIn) ? poseIn : 'idle';
  const { items } = drawScene({ setting: '', layers: [{ ref: `hoya:${pose}`, x: HOYA_BOX.w / 2, y: HOYA_BOX.h }], altEn: '' }, SCENE_ART_REGISTRY);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${HOYA_BOX.w} ${HOYA_BOX.h}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-pose={pose}
    >
      {items.map((item) => (
        <Item key={item.key} item={item} />
      ))}
    </svg>
  );
}
