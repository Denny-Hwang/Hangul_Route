import type { ThemeKey } from '@hangul-route/content-schema';
import { Icon, borderWidth, colors, radii, spacing, useMediaSize } from '@hangul-route/design-system';
import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GLOW_OPACITY, ringLayers, segmentDash, type RingLayers } from '../../logic/mastery-ring';

/**
 * The mastery ring round one Journey cell (F-CURR-002 section 4.4, row CM-20; wireframe
 * `design/wireframes/journey/mastery-ring.md` A to D, mock `design/screens/mastery-ring/`). Part of the mastery chunk:
 * `JourneyGrid` draws it only while `mastery` is on, through `store/mastery-entry.ts`.
 *
 * - Drawn over the cell's own 3 dp border box (the cell keeps its size and its border width; its border colour goes
 *   transparent), so it adds no width. Level 1 to 3 fill the segments clockwise from the top gap; level 3 closes them.
 * - Ready to refresh: a 2 dp halo just outside the cell at `GLOW_OPACITY`, and a sparkle sticker centred on the top
 *   edge (not on the Next cell, where the triangle owns the spot). The ring itself never changes for it: no thinning,
 *   fading or cracking, and nothing pulses.
 * - New volume: a plus marker centred on the bottom edge.
 * - Two panes: the selected cell's focus outline takes the halo's place, outside the track.
 * - Decorative: hidden from screen readers; the cell's label reads the words.
 */

export interface MasteryRingProps {
  level: 1 | 2 | 3;
  theme: ThemeKey;
  /** The cell's border width: the track fills it. */
  edge: number;
  refresh: boolean;
  newVolume: boolean;
  /** Selected in two panes. */
  selected: boolean;
  /** The Next triangle sits on this cell's top edge. */
  next: boolean;
  testID?: string;
}

const TOKENS = { radius: radii.md, gap: spacing.xs, track: borderWidth.thick, keyline: borderWidth.thin, outside: borderWidth.base };

function Segments({ layer, count, color, closed }: { layer: RingLayers['band']; count: number; color: string; closed: boolean }): React.ReactElement {
  if (closed) return <Path d={layer.d} stroke={color} strokeWidth={layer.width} fill="none" />;
  return (
    <>
      {layer.segments.slice(0, count).map((segment, i) => (
        <Path key={i} d={layer.d} stroke={color} strokeWidth={layer.width} fill="none" {...segmentDash(segment, layer.length)} />
      ))}
    </>
  );
}

export function MasteryRing({ level, theme, edge, refresh, newVolume, selected, next, testID }: MasteryRingProps): React.ReactElement {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const sticker = useMediaSize(spacing.lg);
  const marker = useMediaSize(spacing.md);
  const tone = colors.theme[theme];
  const layers = size === null ? null : ringLayers(size.width, size.height, TOKENS);
  const closed = level === 3;
  return (
    <View
      pointerEvents="none"
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={testID}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev !== null && prev.width === width && prev.height === height ? prev : { width, height }));
      }}
      style={{ position: 'absolute', top: -edge, left: -edge, right: -edge, bottom: -edge }}
    >
      {layers !== null && size !== null ? (
        <Svg
          width={size.width + 2 * layers.margin}
          height={size.height + 2 * layers.margin}
          style={{ position: 'absolute', top: -layers.margin, left: -layers.margin }}
          testID={testID ? `${testID}-track` : undefined}
        >
          {selected ? (
            <Path d={layers.outside.d} stroke={colors.border.focus} strokeWidth={layers.outside.width} fill="none" />
          ) : refresh ? (
            <Path d={layers.outside.d} stroke={tone} strokeWidth={layers.outside.width} strokeOpacity={GLOW_OPACITY} fill="none" testID={testID ? `${testID}-halo` : undefined} />
          ) : null}
          <Segments layer={layers.keyline} count={3} color={colors.border.shape} closed={closed} />
          <Segments layer={layers.band} count={level} color={tone} closed={closed} />
        </Svg>
      ) : null}
      {refresh && !next ? (
        <View
          testID={testID ? `${testID}-refresh` : undefined}
          style={{
            position: 'absolute',
            top: -sticker / 2,
            left: '50%',
            marginLeft: -sticker / 2,
            width: sticker,
            height: sticker,
            borderRadius: radii.circle,
            backgroundColor: colors.surface.paper,
            borderWidth: borderWidth.thin,
            borderColor: colors.border.shape,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="sparkle" size={sticker - 2 * spacing.xxs} color={colors.brand.primary} />
        </View>
      ) : null}
      {newVolume ? (
        <View
          testID={testID ? `${testID}-new-volume` : undefined}
          style={{
            position: 'absolute',
            bottom: -marker / 2,
            left: '50%',
            marginLeft: -marker / 2,
            width: marker,
            height: marker,
            borderRadius: radii.circle,
            backgroundColor: colors.brand.secondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="plus" size={marker - spacing.xxs} color={colors.text.onSecondary} />
        </View>
      ) : null}
    </View>
  );
}
