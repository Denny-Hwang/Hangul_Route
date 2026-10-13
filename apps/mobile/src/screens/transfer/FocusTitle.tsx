import { Heading } from '@hangul-route/design-system';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { focusForScreenReader } from '../../platform/screen-reader';

/**
 * The h1 of a move screen or sheet, which takes the focus when it opens (`design/screens/transfer/app-sheets.md`,
 * Accessibility): a screen-reader user starts at the title, not at the Back button or the top of the page.
 * `lang` marks the sheet's own language when it differs from the UI's.
 */
export function FocusTitle({ text, lang }: { text: string; lang?: string }): React.ReactElement {
  const ref = useRef<object | null>(null);
  useEffect(() => {
    focusForScreenReader(ref.current);
  }, []);
  return (
    <View
      ref={(node) => {
        ref.current = node;
      }}
      {...{ tabIndex: -1, ...(lang === undefined ? {} : { lang }) }}
    >
      <Heading level="title">{text}</Heading>
    </View>
  );
}
