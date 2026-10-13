import type { RomanizationMode } from '@hangul-route/content-schema';
import { Body, Button, Heading, Spacer, borderWidth, colors, radii, shadows, spacing, touchTarget, typography, useLayoutClass } from '@hangul-route/design-system';
import { LOCALE_META } from '@hangul-route/i18n';
import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useBrowseSettings } from './BrowseSettings';
import { focusRing, type FocusState } from './browse-ui';

/**
 * The Lesson display sheet (F-BROWSE-001 section 4.9; wireframe
 * `browse/show-as.md`; mock `design/screens/browse/lesson-display.md`): how
 * lessons show romanization in this preview and, once more than English
 * ships, the UI language. A bottom sheet on phones and a centred dialog from
 * the regular class. A choice applies at once; Done only closes. It changes
 * no learner's settings and never the device locale.
 */

/** The radio ring and its dot (mock: a 24 ring with a 12 dot). */
const RING = spacing.xl;
const DOT = spacing.md;
/** The handle drawn on the phone sheet (32 x 4). */
const HANDLE_W = spacing.xxl;
const HANDLE_H = spacing.xs;
/** The dialog width from the regular class (32rem). */
const DIALOG_MAX = 512;

const MODES: readonly RomanizationMode[] = ['always', 'tap'];

export function LessonDisplaySheet({ visible, onClose }: { visible: boolean; onClose: () => void }): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.browse.display;
  const locale = useLocale();
  const { romanization, setRomanization, languages, setLanguage } = useBrowseSettings();
  const dialog = useLayoutClass().width !== 'compact';
  const label = { always: m.always, tap: m.tap } as const;

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: dialog ? 'center' : 'flex-end', alignItems: dialog ? 'center' : 'stretch', backgroundColor: colors.surface.overlay }}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={m.done.cta} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} testID="browse-display-scrim" />
        <View
          role="dialog"
          aria-modal
          aria-labelledby="browse-display-title"
          testID="browse-display-sheet"
          style={{
            width: '100%',
            maxWidth: dialog ? DIALOG_MAX : undefined,
            maxHeight: '90%',
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderBottomLeftRadius: dialog ? radii.xl : 0,
            borderBottomRightRadius: dialog ? radii.xl : 0,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.lg,
            ...shadows.modal,
          }}
        >
          {dialog ? null : (
            <View
              aria-hidden
              style={{ alignSelf: 'center', width: HANDLE_W, height: HANDLE_H, borderRadius: radii.pill, backgroundColor: colors.border.strong, marginBottom: spacing.md }}
            />
          )}
          <ScrollView style={{ flexShrink: 1 }}>
            <View nativeID="browse-display-title">
              <Heading level="prompt">{m.title}</Heading>
            </View>
            <Spacer size="md" />
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
            {languages.length > 1 ? (
              <>
                <Spacer size="md" />
                <Body weight="bold">{m.language}</Body>
                <Spacer size="xs" />
                <View role="radiogroup" aria-label={m.language} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {languages.map((l) => {
                    const selected = l === locale;
                    return (
                      <Pressable
                        key={l}
                        role="radio"
                        aria-checked={selected}
                        accessibilityState={{ checked: selected }}
                        onPress={() => setLanguage(l)}
                        testID={`browse-display-language-${l}`}
                        style={({ focused }: FocusState) => ({
                          minHeight: touchTarget.min,
                          minWidth: touchTarget.min,
                          justifyContent: 'center',
                          paddingHorizontal: spacing.lg,
                          borderRadius: radii.pill,
                          backgroundColor: selected ? colors.brand.primary : colors.surface.paper,
                          ...focusRing(focused, selected ? colors.brand.primary : colors.border.strong),
                          borderWidth: focused ? borderWidth.thick : borderWidth.base,
                        })}
                      >
                        <Text
                          {...{ lang: LOCALE_META[l].htmlLang }}
                          style={{ fontSize: typography.size.body, fontWeight: typography.weight.semibold, color: selected ? colors.text.onPrimary : colors.text.primary }}
                        >
                          {LOCALE_META[l].endonym}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
            <Spacer size="md" />
            <Body tone="secondary">{m.note}</Body>
            <Spacer size="lg" />
            <Button label={m.done.cta} tone="primary" size="md" fullWidth onPress={onClose} testID="browse-display-done" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
