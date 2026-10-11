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
interface CommonProps {
  view: PromptPanelView;
  onAction: (action: FallbackAction) => void;
  /** Opens the "Add a Korean voice" sheet; shown as a link only when there is no Korean voice (W3). */
  onHelp?: () => void;
  testID?: string;
}

/** The text fallback: the screen shows only a speaker, so the panel prints what the voice says. */
interface TextProps extends CommonProps {
  variant?: 'text';
  /** What the voice says for this prompt (`spokenFor(...)`), shown as taught content. */
  ko: string;
  romanization: string;
}

/**
 * Status only (F-AUDIO-004 A-5b): the screen already prints the Korean and its romanization next to
 * the speaker (Build Letter, Card Match, Tap & Respond, Culture Quiz, Voice Echo, card detail), so
 * that line is the text fallback and the panel only says why there is no sound, with the one action.
 */
interface StatusProps extends CommonProps {
  variant: 'status';
}

type Props = TextProps | StatusProps;

export function PromptPanel(props: Props): React.ReactElement {
  const { view, onAction, onHelp, testID = 'prompt-panel' } = props;
  const status = props.variant === 'status';
  const shown = status ? view.statusShown : view.textShown;
  return (
    <View accessibilityLiveRegion="polite" testID={testID}>
      {shown ? (
        <Card tone="paper" padding="lg" elevation="flat">
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            {props.variant !== 'status' ? (
              <>
                <KoreanText ko={props.ko} romanization={props.romanization} size="md" testID={`${testID}-text`} />
                <Body tone="muted" align="center">{view.readLine}</Body>
              </>
            ) : null}
            {view.detail !== null ? (
              status ? (
                <Body tone="muted" align="center" testID={`${testID}-detail`}>{view.detail}</Body>
              ) : (
                <Caption tone="muted">{view.detail}</Caption>
              )
            ) : null}
            {view.actionLabel !== null ? (
              <>
                {status ? null : <Spacer size="sm" />}
                <View style={{ alignSelf: 'center' }}>
                  <Button
                    label={view.actionLabel}
                    tone="secondary"
                    size="md"
                    onPress={() => onAction(view.action)}
                    testID={`${testID}-action`}
                  />
                </View>
              </>
            ) : null}
            {view.helpLabel !== null && onHelp ? (
              <View style={{ alignSelf: 'center' }}>
                <Button label={view.helpLabel} tone="ghost" size="md" onPress={onHelp} testID={`${testID}-help`} />
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}
    </View>
  );
}
