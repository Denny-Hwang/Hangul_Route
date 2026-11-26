import { Body, GuardedPressable, Icon, KoreanText, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import type { CompareItem } from '../../logic/listen-pick-contrast';

/**
 * The compare row of a contrast round's miss (AMENDMENTS-MINIMAL-PAIRS section 3.7, design/wireframes/minigame/listen-pick.md
 * "[MP] Contrast round"): the right member, then the one the learner tapped, each with its Hangul, its romanization and its kind
 * line ("Soft, starts lower."). Their clips play one after the other; the one playing has an outline and a speaker glyph, not
 * a colour alone, and each item is a button that plays its clip again. Tokens only; amber and Hoya's thinking pose are the
 * round's miss look, so there is no danger colour, no counter and no word for "wrong" here. The items wrap, so at the
 * largest text or on a 320-wide window they stack in one column.
 */
interface Props {
  items: readonly CompareItem[];
  /** The id of the item whose clip is playing now, or `null`. */
  soundingId: string | null;
  onPlay: (id: string) => void;
}

export function ContrastCompare({ items, soundingId, onPlay }: Props): ReactElement | null {
  if (items.length === 0) return null;
  return (
    <View testID="contrast-compare" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {items.map((item) => {
        const sounding = item.id === soundingId;
        return (
          <View key={item.id} style={{ flexGrow: 1, flexBasis: '45%', minWidth: touchTarget.hero }}>
            <GuardedPressable
              setsLock={false}
              testID={`contrast-compare-${item.id}`}
              onPress={() => onPlay(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: sounding }}
              style={{
                alignSelf: 'stretch',
                minHeight: touchTarget.child,
                padding: spacing.md,
                gap: spacing.sm,
                borderRadius: radii.lg,
                backgroundColor: colors.surface.paper,
                // The playing item is outlined and carries a speaker glyph: two cues, neither a colour alone.
                borderColor: sounding ? colors.border.focus : colors.border.shape,
                borderWidth: sounding ? borderWidth.thick : borderWidth.base,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <KoreanText ko={item.ko} romanization={item.romanization} size="md" />
                </View>
                {sounding ? (
                  <View testID={`contrast-sounding-${item.id}`}>
                    <Icon name="speaker" size={spacing.xl} color={colors.brand.secondaryDark} />
                  </View>
                ) : (
                  <View style={{ width: spacing.xl }} />
                )}
              </View>
              <Body tone="secondary" testID={`contrast-compare-line-${item.id}`}>
                {item.kindLine}
              </Body>
            </GuardedPressable>
          </View>
        );
      })}
    </View>
  );
}
