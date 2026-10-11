import { Body, Button, Caption, Card, KoreanText, Spacer, spacing } from '@hangul-route/design-system';
import React from 'react';
import { View } from 'react-native';
import type { FallbackAction } from '../logic/audio/prompt-state';
import type { PromptPanelView } from '../logic/audio/prompt-view';

/**
 * The visible text fallback for a sound prompt (F-AUDIO-004 §3.8, wireframe
 * design/wireframes/minigame/audio-fallback.md W2-W4, spec
 * design/components/PromptPanel/spec.md): the spoken syllable in Hangul with
 * its romanization, "No sound? Read it here.", why, and one action. Neutral
 * card tone, never red; a polite live region that does not take focus.
 * The wrapper stays mounted so the arrival of the text is announced.
 */
interface Props {
  view: PromptPanelView;
  /** What the voice says for this prompt (`spokenFor(...)`), shown as taught content. */
  ko: string;
  romanization: string;
  onAction: (action: FallbackAction) => void;
  /** Opens the "Add a Korean voice" sheet; shown as a link only when there is no Korean voice (W3). */
  onHelp?: () => void;
  testID?: string;
}

export function PromptPanel({ view, ko, romanization, onAction, onHelp, testID = 'prompt-panel' }: Props): React.ReactElement {
  return (
    <View accessibilityLiveRegion="polite" testID={testID}>
      {view.textShown ? (
        <Card tone="paper" padding="lg" elevation="flat">
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <KoreanText ko={ko} romanization={romanization} size="md" testID={`${testID}-text`} />
            <Body tone="muted" align="center">{view.readLine}</Body>
            {view.detail !== null ? <Caption tone="muted">{view.detail}</Caption> : null}
            {view.actionLabel !== null ? (
              <>
                <Spacer size="sm" />
                <Button
                  label={view.actionLabel}
                  tone="secondary"
                  size="md"
                  onPress={() => onAction(view.action)}
                  testID={`${testID}-action`}
                />
              </>
            ) : null}
            {view.helpLabel !== null && onHelp ? (
              <Button label={view.helpLabel} tone="ghost" size="md" onPress={onHelp} testID={`${testID}-help`} />
            ) : null}
          </View>
        </Card>
      ) : null}
    </View>
  );
}
