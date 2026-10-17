import React, { useEffect, useId } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { KOREAN_LINE_BREAK } from '../../line-break';
import { borderWidth, colors, radii, shadows, spacing, touchTarget, typography } from '../../tokens';
import { Button } from '../Button';
import { Body, Heading } from '../Heading';
import { useLayoutClass } from '../Layout';
import { Spacer } from '../Spacer';
import { useTypeScale } from '../TextSize';
import { segmentGlyphSize, showLanguageRow, type DisplayOption } from './model';
import type { DisplaySheetProps } from './types';

/**
 * DisplaySheet — the Display (Aa) sheet (owner items 6 and 7): the device's UI language and text
 * size, the one record every surface reads. A bottom sheet on phones and a centred dialog from
 * the regular class. Two segmented controls (radio groups): Language (endonyms, each in its own
 * `lang`; hidden with one language) and Text size (four steps, each segment drawing the caller's
 * glyph, "Aa", at that step), then a live sample line at the chosen size. A choice applies at once; Done only
 * closes. After a language change the caller passes `undo`, a one-tap way back written in the new
 * language. No copy of its own: every label comes from the caller's dictionary. Not behind the
 * grown-up gate (display only, reversible). Spec: design/components/DisplaySheet/spec.md.
 */

/** The handle drawn on the phone sheet (32 x 4). */
const HANDLE_W = spacing.xxl;
const HANDLE_H = spacing.xs;
/** The dialog's width from the regular class: eight touch targets. */
const DIALOG_MAX = touchTarget.min * 8;

type Pressed = { pressed: boolean; focused?: boolean };

function segmentStyle(selected: boolean, state: Pressed): Record<string, unknown> {
  const focused = state.focused === true;
  return {
    minHeight: touchTarget.min,
    minWidth: touchTarget.min,
    flexGrow: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    backgroundColor: selected ? colors.brand.primary : colors.surface.paper,
    borderWidth: focused ? borderWidth.thick : borderWidth.base,
    borderColor: focused || state.pressed ? colors.border.focus : selected ? colors.brand.primary : colors.border.strong,
  };
}

function RadioRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
  testID,
  renderOption,
}: {
  label: string;
  options: readonly DisplayOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  testID: string;
  renderOption: (option: DisplayOption<T>, isSelected: boolean) => React.ReactNode;
}): React.ReactElement {
  return (
    <View role="radiogroup" aria-label={label} accessibilityLabel={label} testID={testID} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={isSelected}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={option.label}
            {...(option.lang ? { accessibilityLanguage: option.lang, lang: option.lang } : {})}
            testID={`${testID}-${option.value}`}
            onPress={() => onSelect(option.value)}
            style={(state: Pressed) => segmentStyle(isSelected, state)}
          >
            {renderOption(option, isSelected)}
          </Pressable>
        );
      })}
    </View>
  );
}

export function DisplaySheet({
  visible,
  title,
  language,
  textSize,
  note,
  children,
  doneLabel,
  closeLabel,
  onClose,
  testID = 'display-sheet',
}: DisplaySheetProps): React.ReactElement {
  const titleId = `${testID}-title-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const dialog = useLayoutClass().width !== 'compact';
  const scale = useTypeScale();
  const labelSize = scale.size.bodySm;
  const showLanguage = language !== null && showLanguageRow(language.options);

  // Escape closes the sheet on the web; react-native-web's Modal does not do it by itself.
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return undefined;
    const doc = (globalThis as { document?: { addEventListener: (t: string, f: (e: { key?: string }) => void) => void; removeEventListener: (t: string, f: (e: { key?: string }) => void) => void } }).document;
    if (!doc) return undefined;
    const onKey = (event: { key?: string }): void => {
      if (event.key === 'Escape') onClose();
    };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  const optionText = (text: string, isSelected: boolean, extra: Record<string, unknown> = {}): React.ReactElement => (
    <Text
      {...KOREAN_LINE_BREAK}
      {...extra}
      style={{
        fontSize: labelSize,
        lineHeight: scale.lineHeight(labelSize, 'tight'),
        fontWeight: typography.weight.semibold,
        color: isSelected ? colors.text.onPrimary : colors.text.primary,
        textAlign: 'center',
      }}
    >
      {text}
    </Text>
  );

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: dialog ? 'center' : 'flex-end', alignItems: dialog ? 'center' : 'stretch', backgroundColor: colors.surface.overlay }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          testID={`${testID}-scrim`}
        />
        <View
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
          testID={testID}
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
            <View nativeID={titleId} {...{ id: titleId }}>
              <Heading level="prompt">{title}</Heading>
            </View>
            {children ? (
              <>
                <Spacer size="md" />
                {children}
              </>
            ) : null}
            {showLanguage && language ? (
              <>
                <Spacer size="md" />
                <Body weight="bold">{language.label}</Body>
                <Spacer size="xs" />
                <RadioRow
                  label={language.label}
                  options={language.options}
                  selected={language.selected}
                  onSelect={language.onSelect}
                  testID={`${testID}-language`}
                  renderOption={(option, isSelected) => optionText(option.label, isSelected, option.lang ? { lang: option.lang } : {})}
                />
                {language.undo ? (
                  <>
                    <Spacer size="sm" />
                    <Button label={language.undo.label} tone="ghost" size="md" fullWidth onPress={language.undo.onPress} testID={`${testID}-language-undo`} />
                  </>
                ) : null}
              </>
            ) : null}
            <Spacer size="md" />
            <Body weight="bold">{textSize.label}</Body>
            <Spacer size="xs" />
            <RadioRow
              label={textSize.label}
              options={textSize.options}
              selected={textSize.selected}
              onSelect={textSize.onSelect}
              testID={`${testID}-text-size`}
              renderOption={(option, isSelected) => {
                const glyph = segmentGlyphSize(option.value);
                return (
                  <>
                    <Text
                      {...KOREAN_LINE_BREAK}
                      aria-hidden
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      style={{ fontSize: glyph, lineHeight: scale.lineHeight(glyph, 'tight'), fontWeight: typography.weight.bold, color: isSelected ? colors.text.onPrimary : colors.text.primary }}
                    >
                      {textSize.glyph}
                    </Text>
                    {optionText(option.label, isSelected)}
                  </>
                );
              }}
            />
            <Spacer size="sm" />
            <View
              testID={`${testID}-sample`}
              accessibilityLiveRegion="polite"
              style={{ padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.sunken }}
            >
              <Body size="lg">{textSize.sample}</Body>
            </View>
            {note ? (
              <>
                <Spacer size="md" />
                <Body tone="secondary">{note}</Body>
              </>
            ) : null}
            <Spacer size="lg" />
            <Button label={doneLabel} tone="primary" size="md" fullWidth onPress={onClose} testID={`${testID}-done`} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
