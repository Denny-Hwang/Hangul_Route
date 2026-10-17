import type { RomanizationMode } from '@hangul-route/content-schema';
import { Body, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, View } from 'react-native';
import { DeviceDisplaySheet } from '../../components/DeviceDisplaySheet';
import { useMessages } from '../../i18n/use-messages';
import { useBrowseSettings } from './BrowseSettings';
import { focusRing, type FocusState } from './browse-ui';

/**
 * The Lesson display sheet (F-BROWSE-001 section 4.9; wireframe
 * `browse/show-as.md`; mock `design/screens/browse/lesson-display.md`): how
 * lessons show romanization in this preview, then the device's language and
 * text size (owner items 6 and 7: the Display sheet's rows, the device's one
 * record, shared with the learner app and the grown-up pages). A bottom sheet
 * on phones and a centred dialog from the regular class. A choice applies at
 * once; Done only closes. Romanization changes only this preview and no
 * learner's settings; the note says which choice reaches what.
 */

/** The radio ring and its dot (mock: a 24 ring with a 12 dot). */
const RING = spacing.xl;
const DOT = spacing.md;

const MODES: readonly RomanizationMode[] = ['always', 'tap'];

export function LessonDisplaySheet({ visible, onClose }: { visible: boolean; onClose: () => void }): React.ReactElement {
  const m = useMessages().caregiver.browse.display;
  const { romanization, setRomanization } = useBrowseSettings();
  const label = { always: m.always, tap: m.tap } as const;

  return (
    <DeviceDisplaySheet visible={visible} onClose={onClose} title={m.title} note={m.note} testID="browse-display-sheet">
      <Body weight="bold">{m.romanization}</Body>
      <View role="radiogroup" aria-label={m.romanization}>
        {MODES.map((mode) => {
          const selected = romanization === mode;
          return (
            <Pressable
              key={mode}
              role="radio"
              aria-checked={selected}
              accessibilityState={{ checked: selected }}
              onPress={() => setRomanization(mode)}
              testID={`browse-display-romanization-${mode}`}
              style={({ focused }: FocusState) => ({
                minHeight: touchTarget.min,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.xs,
                borderRadius: radii.md,
                ...focusRing(focused),
              })}
            >
              <View
                style={{
                  width: RING,
                  height: RING,
                  borderRadius: radii.circle,
                  borderWidth: borderWidth.base,
                  borderColor: colors.text.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected ? <View style={{ width: DOT, height: DOT, borderRadius: radii.circle, backgroundColor: colors.text.primary }} /> : null}
              </View>
              <Body>{label[mode]}</Body>
            </Pressable>
          );
        })}
      </View>
    </DeviceDisplaySheet>
  );
}
