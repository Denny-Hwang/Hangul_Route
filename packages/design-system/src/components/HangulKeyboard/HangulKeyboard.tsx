import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, View } from 'react-native';
import { pressTransform } from '../../press-look';
import { borderWidth, colors, radii, spacing, typography } from '../../tokens';
import { Icon } from '../Icon';
import { TapBoard, TapTarget, usePressLook } from '../TapBoard';
import { keyboardLayout, keyFace, keyLockMs, keyStep, type KeyboardKey } from './layout';
import type { HangulKeyboardProps } from './types';
import { KOREAN_LINE_BREAK } from '../../line-break';

/**
 * HangulKeyboard: the in-app two-set (dubeolsik, KS X 5002) Korean keyboard
 * (F-CURR-001 §3.7, OD-10; design/screens/minigame-writing/keyboard.md). It draws
 * the keys `keyboardLayout` places and reports presses; it holds no text and composes
 * nothing (`composeTyped` in content-schema does). Shift is one-shot and lives here.
 * No copy: the caller passes the localised names. No key sound, no haptic per key.
 *
 * Touch (docs/specs/AMENDMENTS-TOUCH.md section 6.7, KT-D7): the keys are one `TapBoard` with
 * `multiTouch="each"`, so every finger is its own tap. A key types when its finger lifts, the key
 * under the finger at that moment (the press look follows a finger that slides); a lift off the
 * keyboard types nothing, except within `GAP_REACH` (16 px) of an outer key, which still types that
 * key (gap fill). A key held for any length types on its lift, as on a system keyboard (there is no
 * palm hold on `each`). A rollover types both letters in the order the fingers lift. A letter,
 * Delete or Space drops a repeat within `KEY_BOUNCE_MS`; Shift has the 400 ms target lock. The
 * board neither sets nor reads the app-level tap lock. Hit cells stay edge to edge: the face is
 * inset by the padding inside each key's hit area.
 */
export function HangulKeyboard({
  onKey,
  onDelete,
  onSpace,
  width,
  layoutClass,
  soundOf,
  speakSound = (sound) => sound,
  labels,
  disabled = false,
  testID,
}: HangulKeyboardProps): ReactElement {
  const [shift, setShift] = useState(false);
  // Commits arrive one after another inside one touch event (a rollover): each reads the Shift the last one left.
  const shiftNow = useRef(shift);
  const press = usePressLook();
  const kb = keyboardLayout(width, layoutClass);
  const tablet = layoutClass.mediaScale > 1;
  const glyphSize = tablet ? typography.size.display : typography.size.title;
  const soundSize = tablet ? typography.size.bodySm : typography.size.caption;
  const edgeToEdge = layoutClass.width === 'compact' || layoutClass.short;

  const commit = (key: KeyboardKey): void => {
    if (disabled) return;
    const step = keyStep(shiftNow.current, key);
    shiftNow.current = step.shift;
    setShift(step.shift);
    if (step.output === null) return;
    if (step.output.kind === 'delete') onDelete();
    else if (step.output.kind === 'space') onSpace();
    else onKey(step.output.jamo);
  };

  const renderFace = (key: KeyboardKey): ReactElement => {
    if (key.kind === 'shift') {
      return <Icon name={shift ? 'shift-on' : 'shift'} size={spacing.xl} color={shift ? colors.brand.secondaryDark : colors.text.primary} />;
    }
    if (key.kind === 'delete') return <Icon name="backspace" size={spacing.xl} color={colors.text.primary} />;
    if (key.kind === 'space') {
      return (
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: typography.size.bodySm, fontWeight: typography.weight.semibold, color: colors.text.primary, textAlign: 'center' }}>
          {labels.space}
        </Text>
      );
    }
    const face = keyFace(key.base ?? '', shift);
    const shifted = face !== key.base;
    return (
      <>
        <Text {...KOREAN_LINE_BREAK}
          style={{
            fontSize: glyphSize,
            lineHeight: Math.round(glyphSize * 1.1),
            fontWeight: typography.weight.semibold,
            color: shifted ? colors.brand.secondaryDark : colors.text.primary,
          }}
        >
          {face}
        </Text>
        <Text {...KOREAN_LINE_BREAK}
          numberOfLines={1}
          style={{ fontSize: soundSize, color: colors.text.secondary, letterSpacing: typography.tracking.tight }}
        >
          {soundOf(face)}
        </Text>
      </>
    );
  };

  const nameOf = (key: KeyboardKey): string => {
    if (key.kind === 'shift') return labels.shift;
    if (key.kind === 'delete') return labels.delete;
    if (key.kind === 'space') return labels.space;
    const face = keyFace(key.base ?? '', shift);
    return labels.key(face, speakSound(soundOf(face)));
  };

  return (
    <TapBoard lock="target" multiTouch="each" scroll="none" disabled={disabled}>
      <View
        testID={testID}
        style={{
          width: kb.width,
          height: kb.height + (edgeToEdge ? borderWidth.thin : 0),
          backgroundColor: colors.surface.canvas,
          borderTopWidth: edgeToEdge ? borderWidth.thin : 0,
          borderTopColor: colors.border.subtle,
          alignSelf: 'center',
        }}
      >
        {kb.keys.map((key) => {
          const action = key.kind !== 'letter';
          const shiftOn = key.kind === 'shift' && shift;
          const fill = shiftOn
            ? colors.brand.secondaryLight
            : key.half === 'vowel'
              ? colors.surface.sunken
              : colors.surface.paper;
          const restBorder = shiftOn ? borderWidth.thick : action ? borderWidth.base : borderWidth.thin;
          return (
            <TapTarget
              key={key.id}
              testID={testID ? `${testID}-${key.id}` : undefined}
              onCommit={() => commit(key)}
              lockMs={keyLockMs(key.kind)}
              disabled={disabled}
              accessibilityLabel={nameOf(key)}
              accessibilityState={key.kind === 'shift' ? { selected: shift } : undefined}
              ariaPressed={key.kind === 'shift' ? shift : undefined}
              // The hit cell is the whole key; the padding insets the face inside it, so no dead line runs between keys.
              style={{ position: 'absolute', left: key.x, top: key.y, width: key.width, height: key.height, padding: spacing.xxs }}
            >
              {({ pressed }) => {
                const look = pressed && !disabled ? press : null;
                return (
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radii.sm,
                      backgroundColor: fill,
                      borderWidth: look === null ? restBorder : look.borderWidth,
                      borderColor: look === null ? (shiftOn ? colors.brand.secondaryDark : action ? colors.border.strong : colors.border.subtle) : look.borderColor,
                      transform: pressTransform(look),
                    }}
                  >
                    {renderFace(key)}
                  </View>
                );
              }}
            </TapTarget>
          );
        })}
      </View>
    </TapBoard>
  );
}
