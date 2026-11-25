import { a11yRomanization } from '@hangul-route/content-schema';
import { Heading } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useMessages } from '../i18n/use-messages';

/**
 * A Check's asked text (AMENDMENTS-AUDIO-CANT-HEAR section 3.12, OD-CH6 (c)): the prompt's romanization alone, no Hangul,
 * so the round stays a decoding item (read the sound, find its spelling). The screen reader says the romanization as a
 * sound value ("g or k"), like the answer lines do; it is Latin text, so it carries no Korean language tag.
 */
export function AskedRomanization({ romanization, testID }: { romanization: string; testID?: string }): ReactElement {
  const m = useMessages();
  const spoken = a11yRomanization(romanization, m.a11y.romanizationOr);
  // A name only where it differs from what is drawn ("g/k" is said "g or k"); otherwise the text is its own name.
  return (
    <View accessible accessibilityLabel={spoken === romanization ? undefined : spoken} testID={testID}>
      <Heading level="title" align="center">
        {romanization}
      </Heading>
    </View>
  );
}
