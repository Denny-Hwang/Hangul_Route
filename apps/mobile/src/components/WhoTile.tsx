import { Body, Icon, borderWidth, colors, radii, shadows, spacing, touchTarget } from '@hangul-route/design-system';
import type { ThemeKey } from '@hangul-route/content-schema';
import React, { forwardRef } from 'react';
import { Pressable, View, type View as ViewType } from 'react-native';
import { ProfileAvatar } from './ProfileAvatar';

/** The cub on a tile: `ProfileAvatar`'s "Profile switcher card" size (design/screens/profiles/README.md). */
export const WHO_TILE_AVATAR = 72;
/** The circle of the Add a learner tile. */
const ADD_CIRCLE = 48;

export interface WhoTileProps {
  variant: 'learner' | 'add';
  /** The learner's name (a learner tile), or the Add label; wraps, never truncates. */
  label: string;
  /** The cub of a learner tile. */
  avatar?: string;
  /** `tileTints(profiles)`: set only when two or more profiles share the cub. */
  tint?: ThemeKey | null;
  /** The tile's width in the grid (at least `touchTarget.hero`). */
  width: number;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Web: the one tile of the grid that is a tab stop (roving `tabindex`, section 14). */
  tabStop?: boolean;
  onPress: () => void;
  onFocus?: () => void;
  testID?: string;
}

/**
 * [OA] One learner on "Who is using this?" (component spec `design/components/WhoTile/spec.md`, AMENDMENTS-ONE-
 * ACCOUNT-MANY-USERS sections 6.1 and 14, row OA-4a): the cub on its plate and the name, nothing else. Never a
 * progress, star, card, level, streak, space or time prop (CS-6). The tint fills the plate only; no text sits on it,
 * so the name stays the tell. The whole tile is the touch target, at least `touchTarget.hero` both ways. The `add`
 * variant is the dashed Add a learner tile. Reduced motion is the default: the cub keeps its idle pose.
 */
export const WhoTile = forwardRef<ViewType, WhoTileProps>(function WhoTile(
  { variant, label, avatar, tint = null, width, accessibilityLabel, accessibilityHint, tabStop = true, onPress, onFocus, testID },
  ref,
): React.ReactElement {
  const add = variant === 'add';
  return (
    <Pressable
      ref={ref}
      testID={testID}
      onPress={onPress}
      onFocus={onFocus}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      focusable={tabStop}
      style={{
        width,
        minWidth: touchTarget.hero,
        minHeight: touchTarget.hero,
        borderRadius: radii.lg,
        borderWidth: add ? borderWidth.base : borderWidth.thin,
        borderStyle: add ? 'dashed' : 'solid',
        borderColor: add ? colors.border.shape : colors.border.subtle,
        backgroundColor: add ? colors.surface.canvas : colors.surface.paper,
        overflow: 'hidden',
        ...(add ? {} : shadows.card),
      }}
    >
      {({ pressed }) => (
        <>
          {add ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, gap: spacing.sm }}>
              <View
                style={{
                  width: ADD_CIRCLE,
                  height: ADD_CIRCLE,
                  borderRadius: radii.circle,
                  backgroundColor: colors.surface.paper,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="plus" size={24} color={colors.border.shape} />
              </View>
              <Body weight="semibold" align="center">
                {label}
              </Body>
            </View>
          ) : (
            <>
              <View
                testID={testID === undefined ? undefined : `${testID}-plate`}
                style={{ padding: spacing.md, alignItems: 'center', backgroundColor: tint === null ? colors.surface.sunken : colors.theme[tint] }}
              >
                <ProfileAvatar avatar={avatar ?? 'hoya-orange'} size={WHO_TILE_AVATAR} pose="idle" />
              </View>
              <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.surface.paper }}>
                <Body size="lg" weight="bold" align="center">
                  {label}
                </Body>
              </View>
            </>
          )}
          {pressed ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.surface.inkScrim }} />
          ) : null}
        </>
      )}
    </Pressable>
  );
});
