import { Body, Button, Card, Heading, Hoya, Spacer, spacing, useMediaSize } from '@hangul-route/design-system';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type { HeroCopy } from '../../logic/my-route/copy';
import { focusForScreenReader } from '../../platform/screen-reader';

/**
 * The hero (F-ROUTE-001 section 3.5; wireframe
 * `design/wireframes/journey/my-route-overview.md` A, C1, C4, C7): Hoya, one
 * sentence (and the next quest or the goal line) and the single primary
 * action of the page. Read-only mode has no button. Focus lands on the
 * sentence when the page opens (section 3.14): on every focus, since the Route
 * tab stays mounted between visits (`focusToken` is the page's focus count).
 */
export function HeroCard({
  copy,
  pose,
  onAction,
  focusToken,
}: {
  copy: HeroCopy;
  pose: 'idle' | 'cheering';
  onAction: () => void;
  focusToken: number;
}): React.ReactElement {
  const a11y = useMessages().a11y;
  const hoya = useMediaSize(72);
  const sentenceRef = useRef<object | null>(null);
  useEffect(() => {
    if (focusToken === 0) return;
    focusForScreenReader(sentenceRef.current);
  }, [focusToken]);
  const [first, ...rest] = copy.lines;
  return (
    <Card padding="lg" elevation="card" testID="my-route-hero">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Hoya pose={pose} size={hoya} accessibilityLabel={a11y.hoya(pose)} />
        <View
          ref={(node) => {
            sentenceRef.current = node;
          }}
          accessible
          focusable
          accessibilityLabel={copy.lines.join(' ')}
          style={{ flex: 1, gap: spacing.xs }}
        >
          <Heading level="prompt">{first}</Heading>
          {rest.map((line) => (
            <Body key={line} tone="secondary">
              {line}
            </Body>
          ))}
        </View>
      </View>
      {copy.cta !== null ? (
        <>
          <Spacer size="lg" />
          <Button label={copy.cta.label} tone="primary" size="lg" fullWidth onPress={onAction} testID="my-route-hero-cta" />
        </>
      ) : null}
    </Card>
  );
}
