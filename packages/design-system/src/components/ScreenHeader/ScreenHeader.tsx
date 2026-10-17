import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../tokens';
import { KOREAN_LINE_BREAK } from '../../line-break';
import { Icon } from '../Icon';
import { useLayoutClass } from '../Layout';
import { useTypeScale } from '../TextSize';
import {
  LEADING_GLYPH,
  displayControlStyle,
  displayTextStyle,
  fillStyle,
  headerStyle,
  leadingIcon,
  leadingStyle,
  leadingTestId,
  leadingTextStyle,
  rowStyle,
  titleInline,
  titleTextStyle,
  trailingStyle,
} from './style';
import type { ScreenHeaderProps } from './types';

type PressState = { pressed: boolean; focused?: boolean };

/**
 * The Display (Aa) control (AMENDMENTS-DISPLAY-NAV section 3.6): a pill that draws the caller's
 * sign ("Aa"), hidden from assistive tech, and is named by `a11y`, which begins with that sign
 * (WCAG 2.5.3 Label in Name). ScreenHeader draws it at the top right; a root's own header (Home,
 * All lessons, the presenter) draws it beside its other controls.
 */
export function DisplayControl({ label, a11y, onPress, testID = 'display-button' }: { label: string; a11y: string; onPress: () => void; testID?: string }): React.ReactElement {
  const scale = useTypeScale();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      aria-haspopup="dialog"
      style={(state: PressState) => displayControlStyle(state)}
    >
      <Text {...KOREAN_LINE_BREAK} aria-hidden importantForAccessibility="no" style={displayTextStyle(scale)}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * ScreenHeader — the one top row of every learner-app and All lessons screen
 * (design/components/ScreenHeader/spec.md; AMENDMENTS-DISPLAY-NAV section 7.1): the way back at the
 * top left, the same place on every screen and width (`back`: the left arrow and "Back"; `close`:
 * the close glyph and "Close"; `none` on a root), the screen's title (h1), a flow's middle part, and
 * at the top right the Display (Aa) control and at most one more control. The leading control is
 * the first focus stop and is named by its visible word. On a phone the title takes its own line
 * under the controls, so it wraps at words at any text size. No copy of its own: the caller passes
 * every label.
 */
export function ScreenHeader({
  leading,
  leadingLabel,
  onLeading,
  title,
  titleSize = 'title',
  titleLang,
  titleInline: titleInRow = false,
  middle,
  displayLabel,
  displayA11y,
  onDisplay,
  displayHidden = false,
  trailing,
  onHeight,
  testID = 'screen-header',
}: ScreenHeaderProps): React.ReactElement {
  const scale = useTypeScale();
  const { width } = useLayoutClass();
  const glyph = leadingIcon(leading);
  const inline = title !== undefined && titleInline(width, middle !== undefined && middle !== null, titleInRow);
  const showDisplay = onDisplay !== undefined && displayLabel !== undefined && displayA11y !== undefined && !displayHidden;

  const titleNode =
    title === undefined ? null : (
      <Text
        {...KOREAN_LINE_BREAK}
        {...(titleLang ? { lang: titleLang } : {})}
        accessibilityRole="header"
        {...{ role: 'heading', 'aria-level': 1 }}
        testID={`${testID}-title`}
        style={titleTextStyle(scale, titleSize, inline)}
      >
        {title}
      </Text>
    );

  return (
    <View testID={testID} style={headerStyle(inline)} onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}>
      <View style={rowStyle}>
        {glyph !== null && leading !== 'none' ? (
          <Pressable
            testID={leadingTestId(leading)}
            onPress={onLeading}
            accessibilityRole="button"
            accessibilityLabel={leadingLabel}
            style={(state: PressState) => leadingStyle(state)}
          >
            <Icon name={glyph} size={LEADING_GLYPH} color={colors.text.primary} />
            <Text {...KOREAN_LINE_BREAK} aria-hidden importantForAccessibility="no" style={leadingTextStyle(scale)}>
              {leadingLabel}
            </Text>
          </Pressable>
        ) : null}
        {middle !== undefined && middle !== null ? <View style={fillStyle}>{middle}</View> : inline ? titleNode : <View style={fillStyle} />}
        {showDisplay || trailing ? (
          <View style={trailingStyle}>
            {showDisplay ? <DisplayControl label={displayLabel} a11y={displayA11y} onPress={onDisplay} testID={`${testID}-display`} /> : null}
            {trailing ?? null}
          </View>
        ) : null}
      </View>
      {inline ? null : titleNode}
    </View>
  );
}
