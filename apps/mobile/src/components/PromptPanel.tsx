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
  /**
   * What the voice says for this prompt (`spokenFor(...)`), shown as taught content. Omit both when
   * the screen already shows that Korean right above the panel (the story reader's Korean block,
   * F-STORY-002): the panel then carries the read line, why and the action, so the Korean is not drawn
   * twice, and still shows as soon as the text does (unlike `status`, which waits for a play).
   */
  ko?: string;
  romanization?: string;
}

/**
 * Status only (F-AUDIO-004 A-5b): the screen already prints the Korean and its romanization next to
 * the speaker (Build Letter, Card Match, Tap & Respond, Culture Quiz, Voice Echo, card detail), so
 * that line is the text fallback and the panel only says why there is no sound, with the one action.
 */
interface StatusProps extends CommonProps {
  variant: 'status';
  /**
   * One wrapping row with no card (the detail as a caption, the action and the help link as small
   * buttons), for a screen that must keep its own controls on screen and must not shrink its drawing
   * surface by a whole card: Trace Stroke and Trace a Word (design/components/PromptPanel/spec.md).
   */
  compact?: boolean;
}

type Props = TextProps | StatusProps;

export function PromptPanel(props: Props): React.ReactElement {
  const { view, onAction, onHelp, testID = 'prompt-panel' } = props;
  const status = props.variant === 'status';
  const shown = status ? view.statusShown : view.textShown;
  if (props.variant === 'status' && props.compact === true) {
    return (
      <View accessibilityLiveRegion="polite" testID={testID}>
        {shown ? (
          // The row brings its own top space, so an empty panel takes none in a screen that counts its height.
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            {view.detail !== null ? (
              <Caption tone="muted" testID={`${testID}-detail`}>
                {view.detail}
              </Caption>
            ) : null}
            {view.actionLabel !== null ? (
              <Button label={view.actionLabel} tone="secondary" size="sm" onPress={() => onAction(view.action)} testID={`${testID}-action`} />
            ) : null}
            {view.helpLabel !== null && onHelp ? (
              <Button label={view.helpLabel} tone="ghost" size="sm" onPress={onHelp} testID={`${testID}-help`} />
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View accessibilityLiveRegion="polite" testID={testID}>
      {shown ? (
        <Card tone="paper" padding="lg" elevation="flat">
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            {props.variant !== 'status' ? (
              <>
                {props.ko !== undefined ? (
                  <KoreanText ko={props.ko} romanization={props.romanization ?? ''} size="md" testID={`${testID}-text`} />
                ) : null}
                <Body tone="muted" align="center">{view.readLine}</Body>
              </>
            ) : null}
            {view.detail !== null ? (
              status ? (
                <Body tone="muted" align="center" testID={`${testID}-detail`}>{view.detail}</Body>
              ) : (
                <Caption tone="muted" testID={`${testID}-detail`}>
                  {view.detail}
                </Caption>
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
