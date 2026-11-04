import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from '../Card';

/**
 * Card's optional `accessibilityHint` (F-STORY-004 PR 4.8f: a Home card that is no longer open
 * gives the ask as its hint, as a closed Library tile does), checked on the element tree built by
 * calling the component directly with react-native's hosts replaced by plain tags.
 */
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable' }));
vi.mock('../../TapBoard/GuardedPressable', () => ({ GuardedPressable: 'GuardedPressable' }));

type El = ReactElement<Record<string, unknown>>;

describe('Card accessibilityHint', () => {
  it('a pressable card passes the hint next to its label', () => {
    const el = Card({ children: null, onPress: () => undefined, accessibilityLabel: 'A card', accessibilityHint: 'Ask a grown-up' }) as El;
    expect(el.type).toBe('GuardedPressable');
    expect(el.props.accessibilityLabel).toBe('A card');
    expect(el.props.accessibilityHint).toBe('Ask a grown-up');
  });

  it('a card with no hint renders none', () => {
    const el = Card({ children: null, onPress: () => undefined, accessibilityLabel: 'A card' }) as El;
    expect(el.props.accessibilityHint).toBeUndefined();
  });

  it('a static card passes the hint as well', () => {
    const el = Card({ children: null, accessibilityHint: 'Ask a grown-up' }) as El;
    expect(el.type).toBe('View');
    expect(el.props.accessibilityHint).toBe('Ask a grown-up');
  });
});

describe('Card press guard (AMENDMENTS-TOUCH 6.9, row KT-9)', () => {
  it('a pressable card is a GuardedPressable (the guard of 4.4, no press delay) that sets the lock when it opens', () => {
    const onPress = vi.fn();
    const el = Card({ children: null, onPress }) as El;
    expect(el.type).toBe('GuardedPressable');
    expect(el.props.onPress).toBe(onPress);
    expect(el.props.setsLock).toBeUndefined();
  });

  it('a static card is a plain View with no press props', () => {
    const el = Card({ children: null }) as El;
    expect(el.type).toBe('View');
    expect(el.props.onPress).toBeUndefined();
  });
});
