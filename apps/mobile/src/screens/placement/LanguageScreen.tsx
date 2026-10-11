import { Body, Button, Heading, Screen, Spacer, spacing } from '@hangul-route/design-system';
import { LOCALE_META, getMessages } from '@hangul-route/i18n';
import React from 'react';
import { View } from 'react-native';
import { languageTiles, type LanguageTile } from '../../logic/placement/flow';
import { speechLangOf } from '../../logic/placement/options-view';
import { hasVoiceFor, playPrompt } from '../../platform/audio';
import { usePlacement } from './context';
import { BackArrow, Note, RadioTile } from './parts';

/**
 * Test language (F-PLC-001 section 3.1 step 2, wireframe placement B): shown
 * only when more than one UI language ships. Tiles show endonyms; tapping one
 * selects it and speaks one short instruction in that language. Korean is
 * disabled without a Korean voice (its reading instructions are audio-only);
 * English or Spanish without an instruction voice stays selectable, but Short
 * is then unavailable. The choice is for this check only.
 */
export function LanguageScreen(): React.ReactElement {
  const { m, flow, dispatch, capability, leave, screenReader } = usePlacement();
  const copy = m.learner.placement.language;
  const tiles = languageTiles(flow.locales, flow.testLocale, flow.koreanAudio, (l) => hasVoiceFor(speechLangOf(l)));

  const pick = (tile: LanguageTile): void => {
    if (tile.disabled) return;
    dispatch({ type: 'pickLocale', locale: tile.locale });
    if (!screenReader) {
      void playPrompt({
        text: getMessages(tile.locale).learner.placement.language.title,
        language: speechLangOf(tile.locale),
        kind: 'narration',
        source: 'placement',
      });
    }
  };

  return (
    <Screen tone="canvas" testID="placement-language">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <BackArrow onPress={leave} label={m.a11y.goBack} />
        <View style={{ flex: 1 }}>
          <Heading level="title">{copy.title}</Heading>
        </View>
      </View>
      <Spacer size="lg" />
      <View style={{ gap: spacing.md }}>
        {tiles.map((tile) => {
          const line = tile.line === null ? null : copy[tile.line];
          return (
            <RadioTile
              key={tile.locale}
              selected={tile.selected}
              disabled={tile.disabled}
              onPress={() => pick(tile)}
              accessibilityLabel={LOCALE_META[tile.locale].endonym}
              accessibilityHint={line ?? undefined}
              testID={`placement-locale-${tile.locale}`}
            >
              <Body weight="semibold" size="lg">
                {LOCALE_META[tile.locale].endonym}
              </Body>
              {line !== null ? <Note>{line}</Note> : null}
            </RadioTile>
          );
        })}
      </View>
      <Spacer size="xl" />
      <Button
        label={copy.continue.cta}
        tone="primary"
        size="hero"
        fullWidth
        onPress={() => dispatch({ type: 'confirmLanguage', capability: capability(flow.testLocale) })}
        testID="placement-language-continue"
      />
      <Spacer size="md" />
      <Note>{copy.note}</Note>
    </Screen>
  );
}
