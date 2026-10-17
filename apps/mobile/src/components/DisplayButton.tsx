import { DisplayControl } from '@hangul-route/design-system';
import React from 'react';
import { useMessages } from '../i18n/use-messages';

/**
 * The Aa button (AMENDMENTS-DISPLAY-NAV section 3.6) on a root's own header (Home, All lessons,
 * the presenter home and the start screen): the design-system `DisplayControl` with the
 * dictionary's sign (`common.display.button`: "Aa" in English, its own sign in each locale) and its
 * accessible name, which begins with that sign and says what it opens ("Aa, Display: language and
 * text size"). Every other screen gets the same control from its `ScreenHeader`.
 */
export function DisplayButton({ onPress, testID = 'display-button' }: { onPress: () => void; testID?: string }): React.ReactElement {
  const d = useMessages().common.display;
  return <DisplayControl label={d.button} a11y={d.a11y} onPress={onPress} testID={testID} />;
}
