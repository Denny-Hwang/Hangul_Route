import { Body, Caption, Heading, Icon, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, View } from 'react-native';
import type { GainTileView } from '../../logic/my-route/view';

/**
 * Gains (F-ROUTE-001 section 3.8; wireframe
 * `design/wireframes/journey/my-route-overview.md` A): an icon and an absolute
 * number per tile, shown only when greater than zero, never a total. Cards and
 * stories open the Library.
 */
export function GainsCard({ tiles, onOpenLibrary }: { tiles: GainTileView[]; onOpenLibrary: () => void }): React.ReactElement {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} testID="my-route-gains">
      {tiles.map((tile) => {
        const content = (
          <>
            <Icon name={tile.icon} size={28} color={colors.text.secondary} />
            <View>
              <Heading level="prompt">{String(tile.value)}</Heading>
              <Caption tone="secondary">{tile.label}</Caption>
            </View>
          </>
        );
        const box = {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: touchTarget.min,
          minWidth: touchTarget.hero + touchTarget.min,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.lg,
        } as const;
        return tile.opensLibrary ? (
          <Pressable
            key={tile.key}
            onPress={onOpenLibrary}
            accessibilityRole="button"
            accessibilityLabel={tile.a11yLabel}
            style={({ pressed }) => ({ ...box, backgroundColor: pressed ? colors.surface.sunken : colors.surface.paper })}
          >
            {content}
          </Pressable>
        ) : (
          <View key={tile.key} accessible accessibilityLabel={tile.a11yLabel} style={{ ...box, backgroundColor: colors.surface.paper }}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

/** The one muted stories line with its link (section 3.11). */
export function StoriesNote({ text, cta, onOpen }: { text: string; cta: string; onOpen: () => void }): React.ReactElement {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="link"
      accessibilityLabel={`${text} ${cta}`}
      style={{ minHeight: touchTarget.min, justifyContent: 'center' }}
    >
      <Body tone="secondary">
        {text} <Body tone="brand" weight="semibold">{cta}</Body>
      </Body>
    </Pressable>
  );
}
