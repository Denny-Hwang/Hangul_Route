import { Pill, TapTarget, touchTarget } from '@hangul-route/design-system';
import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';

/**
 * Home's blue Cards chip as a way into the Library (owner request OW-2: "without going to the Library, tapping the
 * Cards chip should go straight to the cards"). The pill keeps its look; around it sits one `TapTarget` button at least
 * `touchTarget.min` each way (AMENDMENTS-TOUCH), so the 32 px pill has a 64 px hit area. Its name is the count and
 * where it goes: the chip's own words plus "See my cards", both already in the dictionary in every language.
 *
 * The streak and three-star chips stay plain pills: no screen shows what they count, so a tap would have nowhere to go.
 */
export function CardsChip({ cards, onOpen }: { cards: number; onOpen: () => void }): ReactElement {
  const m = useMessages().learner.home;
  const label = m.cards.pill(cards);
  return (
    <TapTarget
      onCommit={onOpen}
      accessibilityLabel={`${label}. ${m.catchUp.cta}`}
      testID="home-cards-chip"
      style={({ pressed }) => ({
        minWidth: touchTarget.min,
        minHeight: touchTarget.min,
        maxWidth: '100%',
        justifyContent: 'center',
        transform: pressed ? [{ scale: 0.97 }] : [],
      })}
    >
      {() => <Pill tone="secondary" label={label} />}
    </TapTarget>
  );
}

/**
 * A chip that is not a control, centred on the row's line like the Cards chip beside it (a `Pill` aligns itself to the
 * top of its line, and the Cards chip's 64 px hit area makes that line taller than a pill).
 */
export function PlainChip({ children }: { children: ReactNode }): ReactElement {
  return <View style={{ alignSelf: 'center', maxWidth: '100%' }}>{children}</View>;
}
