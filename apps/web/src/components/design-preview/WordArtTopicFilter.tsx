'use client';

import type { WordArtFamily } from '@hangul-route/design-system/word-art';
import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import { useEffect, useState } from 'react';
import { parseTopic, topicHref } from '../../lib/word-art-sheet/topic';

/**
 * The contact sheet's family filter (F-VOC-002 §3.10, `?topic=food`). The page
 * is a static export, so the server cannot read the query: the sheet renders
 * every card, and this reads `?topic=` in the browser and hides the cards of
 * the other families with one style rule. Without script every card shows.
 * It imports WordArt types only, so the glyph registry stays on the server.
 */
export function WordArtTopicFilter({ families, total }: { families: ReadonlyArray<{ family: WordArtFamily; count: number }>; total: number }): JSX.Element {
  const [topic, setTopic] = useState<WordArtFamily | null>(null);
  useEffect(() => setTopic(parseTopic(window.location.search, families.map((f) => f.family))), [families]);

  const link = (value: WordArtFamily | null, label: string, n: number): JSX.Element => {
    const active = value === topic;
    return (
      <a
        key={value ?? 'all'}
        href={topicHref(value)}
        aria-current={active ? 'page' : undefined}
        style={{
          padding: `${spacing.xs}px ${spacing.md}px`,
          borderRadius: radii.pill,
          backgroundColor: active ? colors.brand.primary : colors.surface.paper,
          color: active ? colors.text.inverse : colors.text.primary,
          fontSize: typography.size.bodySm,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        {`${label} (${n})`}
      </a>
    );
  };

  return (
    <nav aria-label="Filter by family" style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm, margin: `${spacing.md}px 0` }}>
      {link(null, 'All', total)}
      {families.map((f) => link(f.family, f.family, f.count))}
      {topic === null ? null : <style>{`[data-testid="word-art-card"]:not([data-family="${topic}"]){display:none !important}`}</style>}
    </nav>
  );
}
