import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from '../Card';

/**
 * Card's optional `accessibilityHint` (F-STORY-004 PR 4.8f: a Home card that is no longer open
 * gives the ask as its hint, as a closed Library tile does), checked on the element tree built by
 * calling the component directly with react-native's hosts replaced by plain tags.
 */
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable' }));

type El = React.ReactElement<Record<string, unknown>>;

describe('Card accessibilityHint', () => {
  it('a pressable card passes the hint next to its label', () => {
    const el = Card({ children: null, onPress: () => undefined, accessibilityLabel: 'A card', accessibilityHint: 'Ask a grown-up' }) as El;
    expect(el.type).toBe('Pressable');
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
