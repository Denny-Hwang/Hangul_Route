import { HeritageCardArt } from '@hangul-route/design-system/components/HeritageCardArt';
import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { CSSProperties } from 'react';
import type { CardArtReuse, SheetWord } from '../../lib/word-art-sheet/sheet';
import { frame, mono, muted } from './sheet-ui';

/**
 * The card-art reuse section of the WordArt contact sheet (F-VOC-002 §3.11),
 * with the row pieces the sheet's glyph cards share. A word that borrows a
 * heritage card picture (`card:` visual) is drawn here with the real
 * HeritageCardArt at 96 and 64 px. Since AMENDMENTS-PICTURES-2026-11 rule R6
 * no word may, so the shipped sheet shows "none"; the drawing stays so that a
 * `card:` visual, should one come back, is seen at once. Server components.
 */

export const BACKGROUNDS = [
  { bg: 'paper', label: 'paper', color: colors.surface.paper },
  { bg: 'sunken', label: 'sunken', color: colors.surface.sunken },
  { bg: 'canvas', label: 'canvas', color: colors.surface.canvas },
] as const;

/** §3.11 (b): a reused card art must read at these sizes. */
const REUSE_SIZES = [96, 64] as const;
/** One background row of drawings; it wraps so the sizes fit a 320 px screen. */
export const sizeRow = (backgroundColor: string): CSSProperties => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: spacing.sm,
  padding: spacing.xs,
  borderRadius: radii.sm,
  backgroundColor,
});

export function WordLines({ words }: { words: readonly SheetWord[] }): JSX.Element {
  return (
    <>
      {words.map((w) => (
        <p key={w.id} data-word style={{ margin: 0, fontSize: typography.size.body, color: colors.text.primary }}>
          <span lang="ko">{w.ko}</span> <em>{w.romanization}</em> · {w.en}
        </p>
      ))}
    </>
  );
}

/** A heritage card picture that words reuse (§3.11): the real card art at 96 and 64 px on the three backgrounds, with the words. */
function ReuseCard({ reuse }: { reuse: CardArtReuse }): JSX.Element {
  return (
    <article data-testid="card-reuse" data-card={reuse.cardId} style={{ ...frame, padding: spacing.md, display: 'grid', gap: spacing.sm, minWidth: 0 }}>
      <div aria-hidden="true" style={{ display: 'grid', gap: spacing.xs }}>
        {BACKGROUNDS.map((b) => (
          <div key={b.bg} data-reuse-bg={b.bg} style={sizeRow(b.color)}>
            {REUSE_SIZES.map((size) => (
              <HeritageCardArt key={size} cardId={reuse.cardId} size={size} accessibilityLabel={reuse.cardId} />
            ))}
            <span style={muted}>{b.label}</span>
          </div>
        ))}
      </div>
      <strong style={{ ...mono, fontSize: typography.size.bodySm, color: colors.text.primary }}>{reuse.cardId}</strong>
      <WordLines words={reuse.words} />
    </article>
  );
}

export function CardReuses({ reuses }: { reuses: readonly CardArtReuse[] }): JSX.Element {
  return (
    <section aria-labelledby="card-reuses" style={{ marginTop: spacing.xl }}>
      <h2 id="card-reuses" style={{ fontSize: typography.size.title, color: colors.text.primary, margin: `0 0 ${spacing.xs}px` }}>
        Card-art reuses
      </h2>
      {reuses.length === 0 ? (
        <p data-testid="card-reuse-none" style={{ ...muted, margin: 0 }}>
          None. Every word has its own drawing: a word&apos;s picture is a glyph, never a borrowed heritage card. The cards are on the{' '}
          <a href="/design-preview/cards" style={{ color: colors.brand.primary, fontWeight: 600 }}>
            card-art sheet
          </a>
          .
        </p>
      ) : (
        <>
          <p style={{ ...muted, margin: `0 0 ${spacing.md}px` }}>
            These words use a heritage card picture instead of their own drawing. That is no longer allowed: give each word its own drawing.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: spacing.lg }}>
            {reuses.map((reuse) => (
              <ReuseCard key={reuse.cardId} reuse={reuse} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

