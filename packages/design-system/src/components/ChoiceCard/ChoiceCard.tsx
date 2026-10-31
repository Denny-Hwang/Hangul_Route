import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { radii, spacing, touchTarget, typography } from '../../tokens';
import { pressInset, pressTransform } from '../../press-look';
import type { PressLook } from '../../press-look';
import { Icon } from '../Icon';
import { KoreanText } from '../KoreanText';
import { TapTarget, usePressLook } from '../TapBoard';
import { useTypeScale } from '../TextSize';
import { choiceCardStyle } from './style';
import type { ChoiceCardProps } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

/**
 * ChoiceCard — the one option card for "pick one" questions (F-STORY-003 §3.4):
 * a text option, a Korean option (drawn with `KoreanText`) or a picture option.
 * Left-aligned wrapped text, 80 dp minimum height, tokens only. A wrong card is
 * an amber nudge with a "try another" mark (or, with `wrongMark="dash"`, the
 * short dash of a locked miss), never red and never an X. `layout="tile"`
 * centres a picture and puts the mark on the top corner. No copy and no
 * motion: the caller passes `accessibilityLabel` (naming the outcome).
 * It takes a touch through `TapTarget` (AMENDMENTS-TOUCH section 4.4): inside a
 * `TapBoard` the board decides the tap (commit on release, reach, gap fill, the
 * lock); outside one it is a plain button with the press guard. While pressed it
 * shows the press look (section 4.3), never a state look.
 * Spec: design/components/ChoiceCard/spec.md.
 */
export function ChoiceCard({
  label,
  ko,
  romanization = '',
  gloss,
  art,
  state,
  wrongMark = 'replay',
  layout = 'row',
  onPress,
  accessibilityLabel,
  testID,
  pressableRef,
}: ChoiceCardProps): ReactElement {
  const look = choiceCardStyle(state, { wrongMark });
  const bodySize = useTypeScale().size.body;
  const press = usePressLook();
  const tile = layout === 'tile';
  const hasArt = art !== undefined && art !== null && art !== false;
  const hasKorean = ko !== undefined && ko.trim().length > 0;
  const hasLabel = label !== undefined && label.length > 0;

  // The press look goes on the drawn box, so the shrink never changes the hit area the board measures.
  const content = (pressed: PressLook | null): ReactElement => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: look.minHeight,
        // A thicker press outline grows inward (off the padding), so the card keeps its size and nothing below moves.
        paddingVertical: spacing.md - pressInset(pressed, look.borderWidth),
        paddingHorizontal: spacing.lg - pressInset(pressed, look.borderWidth),
        backgroundColor: look.backgroundColor,
        borderColor: pressed?.borderColor ?? look.borderColor,
        borderWidth: pressed?.borderWidth ?? look.borderWidth,
        borderRadius: look.borderRadius,
        transform: pressTransform(pressed),
      }}
    >
      <View style={{ flex: 1, gap: spacing.sm }}>
        {hasArt ? (
          <View style={{ alignSelf: 'center', minHeight: touchTarget.hero, justifyContent: 'center' }}>{art}</View>
        ) : null}
        {hasKorean ? (
          <View style={{ alignSelf: tile ? 'center' : 'flex-start' }}>
            <KoreanText ko={ko} romanization={romanization} gloss={gloss} size="sm" />
          </View>
        ) : null}
        {hasLabel ? (
          <Text {...KOREAN_LINE_BREAK}
            style={{
              fontSize: bodySize,
              fontWeight: typography.weight.semibold,
              lineHeight: bodySize * typography.leading.normal,
              color: look.textColor,
              textAlign: 'left',
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
      {look.mark && !tile ? <Icon name={look.mark.icon} size={spacing.xl} color={look.mark.color} /> : null}
      {look.mark && tile ? (
        // On the corner, on a disc of the state's fill, so it reads over the art (same contrast pairs as the row mark).
        <View
          style={{
            position: 'absolute',
            top: spacing.xs,
            right: spacing.xs,
            padding: spacing.xxs,
            borderRadius: radii.pill,
            backgroundColor: look.backgroundColor,
          }}
        >
          <Icon name={look.mark.icon} size={spacing.xl} color={look.mark.color} />
        </View>
      ) : null}
    </View>
  );

  return (
    <TapTarget
      pressableRef={pressableRef}
      testID={testID}
      onCommit={() => onPress?.()}
      // An answered (or disabled) card takes no tap but stays a focusable button with today's accessible state.
      inactive={!look.interactive}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: look.disabled, selected: look.selected }}
      style={{ alignSelf: 'stretch' }}
    >
      {({ pressed }) => content(pressed && look.interactive ? press : null)}
    </TapTarget>
  );
}
