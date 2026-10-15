import { Icon, borderWidth, colors, radii, typography, useMediaSize, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import type { StageKey } from '@hangul-route/content-schema';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { BadgeLook } from '../../logic/my-route/view';

/**
 * The stage badge on the trail (F-ROUTE-001 section 3.3; wireframe
 * `design/wireframes/journey/my-route-overview.md` A, C3, C4; drawn shapes as
 * in `design/components/PipRow/spec.md`). Every state has its own shape, so the
 * stage colour only decorates: a numbered ring (open), a filled disc with a
 * check-in-circle (complete), a ring with a check (explored), a ring with a
 * disc (known, never the complete glyph), a dotted ring (coming later).
 */
export const BADGE_SIZE = 40;

export function StageBadge({ look, stage, order }: { look: BadgeLook; stage: StageKey; order: number | null }): React.ReactElement {
  const size = useMediaSize(BADGE_SIZE);
  const accent = colors.stage[stage];
  const circle = { width: size, height: size, borderRadius: radii.circle, alignItems: 'center', justifyContent: 'center' } as const;

  if (look === 'later') {
    const stroke = borderWidth.base;
    const r = (size - stroke) / 2;
    const dash = (2 * Math.PI * r) / 16;
    return (
      <View style={{ ...circle, backgroundColor: colors.surface.sunken }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border.shape} strokeWidth={stroke} strokeDasharray={`${dash * 0.55} ${dash * 0.45}`} fill="none" />
        </Svg>
        {order === null ? null : <Text {...KOREAN_LINE_BREAK} style={{ color: colors.text.muted, fontWeight: typography.weight.bold, fontSize: typography.size.body }}>{order}</Text>}
      </View>
    );
  }

  if (look === 'complete') {
    return (
      <View style={{ ...circle, backgroundColor: accent, borderWidth: borderWidth.base, borderColor: colors.border.shape }}>
        <Icon name="check-circle" size={Math.round(size * 0.6)} color={colors.text.primary} />
      </View>
    );
  }

  if (look === 'known') {
    return (
      <View style={{ ...circle, backgroundColor: colors.surface.paper, borderWidth: borderWidth.thick, borderColor: colors.border.shape }}>
        <View style={{ width: size / 2, height: size / 2, borderRadius: radii.circle, backgroundColor: colors.border.shape }} />
      </View>
    );
  }

  return (
    <View style={{ ...circle, backgroundColor: colors.surface.paper, borderWidth: borderWidth.thick, borderColor: accent }}>
      {look === 'explored' ? (
        <Icon name="check" size={Math.round(size * 0.55)} color={colors.text.primary} />
      ) : (
        <Text {...KOREAN_LINE_BREAK} style={{ color: colors.text.primary, fontWeight: typography.weight.bold, fontSize: typography.size.body }}>{order}</Text>
      )}
    </View>
  );
}
