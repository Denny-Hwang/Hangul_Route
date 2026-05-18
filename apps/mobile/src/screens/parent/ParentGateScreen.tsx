import {
  Body,
  Button,
  Card,
  Caption,
  Heading,
  Icon,
  Screen,
  Spacer,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
} from '@hangul-route/design-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ParentGate'>;

/**
 * Parent gate — Apple/Google children's category requires that destructive
 * or commerce actions be gated behind a parent-only check (e.g. simple math).
 */
export function ParentGateScreen({ route, navigation }: Props): React.ReactElement {
  const { a, b } = useMemo(() => ({ a: 7 + Math.floor(Math.random() * 5), b: 11 + Math.floor(Math.random() * 7) }), []);
  const answer = a * b;
  const [entry, setEntry] = useState('');
  const [tries, setTries] = useState(0);

  const submit = (): void => {
    if (parseInt(entry, 10) === answer) {
      navigation.replace(route.params.next);
    } else {
      setTries(tries + 1);
      setEntry('');
    }
  };

  return (
    <Screen tone="canvas">
      <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Close" style={{ alignSelf: 'flex-start' }}>
        <Icon name="close" size={28} />
      </Pressable>
      <Spacer size="lg" />

      <Heading level="title">Grown-up zone</Heading>
      <Spacer size="xs" />
      <Body tone="secondary">Quick check — please solve to continue.</Body>

      <Spacer size="xl" />
      <Card padding="lg" tone="brand">
        <Heading level="display" align="center">
          {a} × {b} = ?
        </Heading>
        <Spacer size="lg" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
            <Pressable
              key={n}
              onPress={() => setEntry((entry + String(n)).slice(0, 4))}
              accessibilityLabel={`Number ${n}`}
              style={{
                width: touchTarget.child,
                height: touchTarget.child,
                borderRadius: radii.lg,
                backgroundColor: colors.surface.paper,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border.subtle,
              }}
            >
              <Text style={{ fontSize: typography.size.title, fontWeight: '700' }}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Spacer size="md" />
        <Caption tone="muted" align="center">
          Entered: {entry || '—'}
        </Caption>
      </Card>

      <Spacer size="lg" />
      <Button label="Check" tone="primary" size="hero" fullWidth onPress={submit} disabled={entry.length === 0} />
      <Spacer size="sm" />
      <Button label="Cancel" tone="ghost" size="md" fullWidth onPress={() => navigation.goBack()} />

      {tries > 0 ? (
        <>
          <Spacer size="md" />
          <Caption tone="muted" align="center">
            Not quite. Try again — only grown-ups can pass this.
          </Caption>
        </>
      ) : null}
    </Screen>
  );
}
