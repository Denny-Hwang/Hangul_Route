import { Body, Button, Icon, colors, spacing } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { useMessages } from '../../i18n/use-messages';

/**
 * What an answered contrast round adds under each option (AMENDMENTS-MINIMAL-PAIRS section 3.7, moved here by
 * AMENDMENTS-START-BUNDLE-2026-11 row SB-4b): the member's kind line and a Hear it button that plays its own clip. A
 * fragment, not a wrapping view: the option's own column (`gap: spacing.sm`) spaces the card, the line and the button.
 */
interface Props {
  optionId: string;
  kindLine: string;
  /** The option's romanization as a screen reader says it (`OptionNaming.sound`). */
  sound: string;
  /** The board's `playMember` for this option. */
  onHear: () => void;
}

export function ContrastOptionExtras({ optionId, kindLine, sound, onHear }: Props): ReactElement {
  const m = useMessages();
  return (
    <>
      <Body tone="secondary" testID={`contrast-kind-${optionId}`}>
        {kindLine}
      </Body>
      <Button
        label={m.learner.audio.hearIt.cta}
        tone="ghost"
        size="sm"
        leading={<Icon name="speaker" size={spacing.xl} color={colors.brand.secondaryDark} />}
        accessibilityLabel={m.a11y.minigame.hear(sound)}
        onPress={onHear}
        testID={`contrast-hear-${optionId}`}
      />
    </>
  );
}
