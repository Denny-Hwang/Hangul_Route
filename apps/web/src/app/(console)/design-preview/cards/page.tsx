import { HeritageCardArt } from '@hangul-route/design-system/components/HeritageCardArt';
import { UpperCellCardArt } from '@hangul-route/design-system/src/components/HeritageCardArt/UpperCellArt';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { Metadata } from 'next';
import { PreviewShell, StatRow, frame, mono, muted } from '../../../../components/design-preview/sheet-ui';
import { CARD_ART_SHEET, CARD_ART_SIZES, type SheetCard, type SheetCardGroup } from '../../../../data/card-art-sheet';

/**
 * /design-preview/cards — the heritage card-art contact sheet
 * (AMENDMENTS-PICTURES-2026-11, row PX-0). Every card the design system draws,
 * 60 in all, painted by the real components (`HeritageCardArt` for Stage 1,
 * `UpperCellCardArt` for the album and legendary cards) at 200 px and at the
 * two sizes a question shows a picture (64 and 54 px), with its id and title.
 * It replaces the hand-copied stand-in drawings this page used to show, so a
 * review here is a review of what the app paints. react-native-svg maps to DOM
 * SVG on the web (src/shims). Server component; noindex (robots.txt disallows
 * `/design-preview` too, F-SITE-002 OD-10). Design: the page is the art's
 * review surface, CLAUDE.md §5.
 */
export const metadata: Metadata = {
  title: 'Heritage card art · design preview',
  robots: { index: false, follow: false },
};

/** The rules a card picture is read against (the amendment's section 3). */
const REVIEW_CHECKLIST = [
  'Named at a glance at 64 and 54 px',
  'Dark ink outline, nothing needed is drawn thinner (R1)',
  'One subject that fills the tile (R2)',
  'Told from the other cards of its row by shape, not only by colour (R3)',
  'Real colours for real things (R4)',
  'Right about the thing it shows',
] as const;

function Art({ card, art, size }: { card: SheetCard; art: SheetCardGroup['art']; size: number }): JSX.Element | null {
  return art === 'stage1' ? <HeritageCardArt cardId={card.id} size={size} accessibilityLabel={card.title} /> : <UpperCellCardArt cardId={card.id} size={size} accessibilityLabel={card.title} />;
}

function CardCell({ card, art }: { card: SheetCard; art: SheetCardGroup['art'] }): JSX.Element {
  const [full, ...small] = CARD_ART_SIZES;
  return (
    <article data-testid="card-art" data-card={card.id} data-art={art} style={{ ...frame, padding: spacing.md, display: 'grid', gap: spacing.sm, minWidth: 0, justifyItems: 'start' }}>
      <div data-size={full} style={{ borderRadius: radii.md, border: `${borderWidth.thin}px solid ${colors.border.subtle}`, backgroundColor: colors.surface.canvas, maxWidth: '100%', overflow: 'hidden' }}>
        <Art card={card} art={art} size={full} />
      </div>
      <div aria-hidden="true" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.sm }}>
        {small.map((size) => (
          <figure key={size} data-size={size} style={{ margin: 0, display: 'grid', justifyItems: 'center', gap: spacing.xxs }}>
            <div style={{ borderRadius: radii.sm, border: `${borderWidth.thin}px solid ${colors.border.subtle}`, backgroundColor: colors.surface.paper, display: 'flex' }}>
              <Art card={card} art={art} size={size} />
            </div>
            <figcaption style={muted}>{`${size} px`}</figcaption>
          </figure>
        ))}
      </div>
      <strong style={{ ...mono, fontSize: typography.size.bodySm, color: colors.text.primary }}>{card.id}</strong>
      <p data-title style={{ margin: 0, fontSize: typography.size.body, color: colors.text.primary }}>
        {card.title}
        {card.ko !== undefined && card.romanization !== undefined ? (
          <>
            {' · '}
            <span lang="ko">{card.ko}</span> <em>{card.romanization}</em>
          </>
        ) : null}
      </p>
    </article>
  );
}

export default function CardsPreviewPage(): JSX.Element {
  const total = CARD_ART_SHEET.reduce((n, g) => n + g.cards.length, 0);
  const stage1 = CARD_ART_SHEET.filter((g) => g.art === 'stage1').reduce((n, g) => n + g.cards.length, 0);
  return (
    <PreviewShell
      title="Heritage card art: contact sheet"
      intro={
        <p style={{ margin: 0 }}>
          Every heritage card picture, drawn by the same components the app paints, at 200 px and at the two sizes a question shows a picture. Read each one small first: if you
          cannot name it at 64 px, it goes back for a redraw.
        </p>
      }
      links={[
        { href: '/design-preview', label: 'Design preview' },
        { href: '/design-preview/word-art', label: 'Word pictures' },
      ]}
    >
      <StatRow
        items={[
          { label: 'Cards', value: total, testId: 'count-cards' },
          { label: 'Stage 1', value: stage1, testId: 'count-stage1' },
          { label: 'Album and legendary', value: total - stage1, testId: 'count-upper' },
          { label: 'Sizes', value: CARD_ART_SIZES.map((s) => `${s}`).join(' · '), testId: 'sizes' },
        ]}
      />
      <details style={{ ...frame, padding: spacing.md, margin: `${spacing.lg}px 0` }}>
        <summary style={{ fontWeight: 600, color: colors.text.primary, cursor: 'pointer' }}>Review checklist</summary>
        <ol style={{ margin: `${spacing.sm}px 0 0`, paddingLeft: spacing.xl, color: colors.text.secondary, fontSize: typography.size.bodySm }}>
          {REVIEW_CHECKLIST.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      </details>
      {CARD_ART_SHEET.map((g) => (
        <section key={g.group} data-group={g.group} style={{ marginBottom: spacing.xxl }}>
          <h2 style={{ fontSize: typography.size.title, fontWeight: 700, color: colors.text.primary, margin: `0 0 ${spacing.md}px` }}>{g.group}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 232px), 1fr))', gap: spacing.lg }}>
            {g.cards.map((card) => (
              <CardCell key={card.id} card={card} art={g.art} />
            ))}
          </div>
        </section>
      ))}
    </PreviewShell>
  );
}
