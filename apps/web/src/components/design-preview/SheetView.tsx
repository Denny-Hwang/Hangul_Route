'use client';

import type { SceneArtLike } from '@hangul-route/design-system/scene-art';
import { SceneSvg } from '@hangul-route/design-system/scene-art/dom';
import { borderWidth, colors, radii, spacing, typography, type ThemeKey } from '@hangul-route/design-system/tokens';
import { useState, type ReactNode } from 'react';

/**
 * The contact sheet's size toggle (F-STORY-002 §3.9.6): review rows (the
 * default, rendered on the server), a 4-up thumbnail grid at 160 x 120, or the
 * 96-wide size a scene has on a Story Order card. The two grids draw the thumb
 * variant here in the browser from the scene data, only when asked for, so
 * they add no markup to the static page. (The rows still reach the page twice,
 * as HTML and in the App Router's inline RSC payload, and `thumbs` carries each
 * scene's art data once more: about three times the art size in all.)
 *
 * On a narrow screen the grids wrap instead of widening the page; from 4 (or
 * 8) cells' width up they keep the 4-up (or 8-up) layout.
 */
export type SheetMode = 'rows' | 'thumbs' | 'sequence';

export interface ThumbStory {
  id: string;
  titleEn: string;
  theme: ThemeKey;
  scenes: Array<{ key: string; id: string; art?: SceneArtLike }>;
}

const MODES: ReadonlyArray<{ mode: SheetMode; label: string }> = [
  { mode: 'rows', label: 'Review rows' },
  { mode: 'thumbs', label: 'Thumbnails 160' },
  { mode: 'sequence', label: 'Sequence cards 96' },
];
/** Widths in CSS px, from the spec. */
export const CELL_WIDTH: Record<Exclude<SheetMode, 'rows'>, number> = { thumbs: 160, sequence: 96 };
/** The thumbnail grid is 4-up; sequence cards sit in one row of up to 8, as on a Story Order screen. */
const COLUMNS: Record<Exclude<SheetMode, 'rows'>, number> = { thumbs: 4, sequence: 8 };

function Grid({ stories, width, columns }: { stories: readonly ThumbStory[]; width: number; columns: number }): JSX.Element {
  const cell = width + 2 * borderWidth.thin; // the picture and its frame
  return (
    <>
      {stories.map((story) => (
        <section key={story.id} style={{ margin: `${spacing.xl}px 0` }}>
          <h2 style={{ fontSize: typography.size.bodyLg, color: colors.text.primary, margin: `0 0 ${spacing.sm}px` }}>{story.titleEn}</h2>
          <div
            data-testid="thumb-grid"
            style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${cell}px)`, maxWidth: columns * cell + (columns - 1) * spacing.md, gap: spacing.md }}
          >
            {story.scenes.map((scene) => (
              <figure key={scene.key} data-testid="scene-thumb" style={{ margin: 0 }}>
                <div style={{ display: 'flex', backgroundColor: colors.surface.paper, border: `${borderWidth.thin}px solid ${colors.border.subtle}`, borderRadius: radii.md, overflow: 'hidden' }}>
                  <SceneSvg art={scene.art} theme={story.theme} variant="thumb" width={width} decorative />
                </div>
                <figcaption style={{ fontFamily: typography.family.mono, fontSize: typography.size.caption, color: colors.text.muted }}>{scene.id}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function SheetView({ rows, thumbs }: { rows: ReactNode; thumbs: readonly ThumbStory[] }): JSX.Element {
  const [mode, setMode] = useState<SheetMode>('rows');
  return (
    <div data-sheet-mode={mode}>
      <div role="group" aria-label="Picture size" style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', margin: `${spacing.lg}px 0` }}>
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            aria-pressed={mode === m.mode}
            onClick={() => setMode(m.mode)}
            style={{
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: radii.pill,
              border: `${borderWidth.base}px solid ${colors.brand.secondary}`,
              backgroundColor: mode === m.mode ? colors.brand.secondary : colors.surface.paper,
              color: mode === m.mode ? colors.text.onSecondary : colors.brand.secondary,
              fontSize: typography.size.bodySm,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div hidden={mode !== 'rows'}>{rows}</div>
      {mode === 'rows' ? null : <Grid stories={thumbs} width={CELL_WIDTH[mode]} columns={COLUMNS[mode]} />}
    </div>
  );
}
