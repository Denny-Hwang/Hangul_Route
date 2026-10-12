import { HeritageCardArt } from '@hangul-route/design-system/components/HeritageCardArt';
import { WORD_ART, WORD_ART_MONO_TONE, glyphToSvgString, type WordArtStatus } from '@hangul-route/design-system/word-art';
import { borderWidth, colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { WordArtTopicFilter } from '../../../../components/design-preview/WordArtTopicFilter';
import { PreviewShell, StatRow, Tag, frame, mono, muted } from '../../../../components/design-preview/sheet-ui';
import { VOCAB_CATALOG } from '../../../../data/vocab-catalog';
import { BUDGET_GZIP, BUDGET_RAW, measureWordArtSource } from '../../../../lib/word-art-sheet/budget';
import { STATUS_LABEL, buildWordArtSheet, cardArtReuses, svgBody, symbolId, type CardArtReuse, type SheetWord, type WordArtCard } from '../../../../lib/word-art-sheet/sheet';
import { VISION_FILTERS, visionFilterId, type SimulatedVision } from '../../../../lib/word-art-sheet/vision';

/**
 * /design-preview/word-art — the WordArt contact sheet (F-VOC-002 §3.10). One
 * card per registry key: the glyph at 160 px on the canvas, at 96, 64, 48 and
 * 32 px on the paper, sunken and canvas surfaces, its silhouette at 64 px and
 * three colour-vision simulations, with its key, shape count, byte size,
 * review state and the vocabulary word it pictures (from the generated web
 * catalog). Each glyph is drawn once with `glyphToSvgString` into a sprite
 * symbol and placed at every size with `<use>`, so the page does not grow 17
 * times with the art. Below the glyphs, every word that reuses a heritage
 * card picture (`card:` visual, §3.11) shows the real HeritageCardArt at 96
 * and 64 px on the same three backgrounds, so the reuse review can happen
 * here too; react-native-svg maps to DOM SVG on the web (src/shims). Server
 * component; the family filter is a small client island because a static
 * export cannot read `?topic=` on the server. Not linked from the landing
 * page; noindex. Design: the page is the art's review surface, CLAUDE.md §5.
 */
export const metadata: Metadata = {
  title: 'WordArt · design preview',
  robots: { index: false, follow: false },
};

const BACKGROUNDS = [
  { bg: 'paper', label: 'paper', color: colors.surface.paper },
  { bg: 'sunken', label: 'sunken', color: colors.surface.sunken },
  { bg: 'canvas', label: 'canvas', color: colors.surface.canvas },
] as const;
const ROW_SIZES = [96, 64, 48, 32] as const;
/** §3.11 (b): a reused card art must read at these sizes. */
const REUSE_SIZES = [96, 64] as const;
const VISION_LABEL: Record<SimulatedVision, string> = { protanopia: 'protan', deuteranopia: 'deutan', tritanopia: 'tritan' };
const STATUS_TONE: Record<WordArtStatus, 'draft' | 'tale' | 'ready'> = { draft: 'draft', review: 'tale', approved: 'ready' };

/** The review checklist of F-VOC-002 §3.12, recorded in every batch PR. */
const REVIEW_CHECKLIST = [
  'Recognisable at 48 px',
  'Recognisable in silhouette',
  'Faces smile',
  'Colours from tokens, no more than 4',
  'Matches the brief',
  'Culturally accurate (K-Culture keys especially)',
  'No text or emoji',
  'Neutral people',
  'Tone fits the neighbouring words of the topic',
] as const;

const caption: CSSProperties = { ...muted, margin: 0, textAlign: 'center' };

/** One background row of drawings; it wraps so the sizes fit a 320 px screen. */
const sizeRow = (backgroundColor: string): CSSProperties => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
  gap: spacing.sm,
  padding: spacing.xs,
  borderRadius: radii.sm,
  backgroundColor,
});

function Use({ id, size, filter }: { id: string; size: number; filter?: string }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <use href={`#${id}`} filter={filter} />
    </svg>
  );
}

/** Every glyph once in colour and once in silhouette, plus the three filters; drawn at 0 x 0 and out of the flow. */
function Sprite({ cards }: { cards: readonly WordArtCard[] }): JSX.Element {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', overflow: 'hidden' }}>
      <defs>
        {VISION_FILTERS.map((v) => (
          <filter key={v.vision} id={visionFilterId(v.vision)}>
            <feColorMatrix type="matrix" values={v.values} />
          </filter>
        ))}
        {cards.flatMap((card) => [
          <symbol key={card.key} id={symbolId(card.key, false)} viewBox="0 0 100 100" dangerouslySetInnerHTML={{ __html: svgBody(glyphToSvgString(card.glyph, { size: 100 })) }} />,
          <symbol
            key={`${card.key}-mono`}
            id={symbolId(card.key, true)}
            viewBox="0 0 100 100"
            dangerouslySetInnerHTML={{ __html: svgBody(glyphToSvgString(card.glyph, { size: 100, mono: WORD_ART_MONO_TONE })) }}
          />,
        ])}
      </defs>
    </svg>
  );
}

function WordLines({ words }: { words: readonly SheetWord[] }): JSX.Element {
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

function Words({ card }: { card: WordArtCard }): JSX.Element {
  if (card.words.length > 0) return <WordLines words={card.words} />;
  return <p style={{ ...muted, margin: 0 }}>{card.family === 'prop' ? 'prop: drawn inside a colour swatch, not a vocabulary picture' : 'no vocabulary item yet'}</p>;
}

function Cell({ children, label }: { children: JSX.Element; label: string }): JSX.Element {
  return (
    <figure style={{ margin: 0, display: 'grid', justifyItems: 'center', gap: spacing.xxs }}>
      {children}
      <figcaption style={caption}>{label}</figcaption>
    </figure>
  );
}

function Card({ card }: { card: WordArtCard }): JSX.Element {
  const id = symbolId(card.key, false);
  return (
    <article
      data-testid="word-art-card"
      data-key={card.key}
      data-family={card.family}
      data-status={card.status}
      style={{ ...frame, padding: spacing.md, display: 'grid', gap: spacing.md, minWidth: 0 }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md, alignItems: 'flex-start' }}>
        <div role="img" aria-label={card.key} style={{ backgroundColor: colors.surface.canvas, borderRadius: radii.md, border: `${borderWidth.thin}px solid ${colors.border.subtle}` }}>
          <Use id={id} size={160} />
        </div>
        <div style={{ display: 'grid', gap: spacing.xs, minWidth: 0 }}>
          {BACKGROUNDS.map((b) => (
            <div key={b.bg} data-bg={b.bg} style={sizeRow(b.color)}>
              {ROW_SIZES.map((size) => (
                <Use key={size} id={id} size={size} />
              ))}
              <span style={muted}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
        <Cell label="silhouette">
          <Use id={symbolId(card.key, true)} size={64} />
        </Cell>
        {VISION_FILTERS.map((v) => (
          <Cell key={v.vision} label={VISION_LABEL[v.vision]}>
            <Use id={id} size={64} filter={`url(#${visionFilterId(v.vision)})`} />
          </Cell>
        ))}
      </div>
      <div style={{ display: 'grid', gap: spacing.xs }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
          <strong style={{ ...mono, fontSize: typography.size.bodySm, color: colors.text.primary }}>{card.key}</strong>
          <Tag tone={STATUS_TONE[card.status]}>{STATUS_LABEL[card.status]}</Tag>
        </div>
        <p data-shapes={card.shapes} data-bytes={card.bytes} style={{ ...muted, margin: 0 }}>
          {`${card.shapes} shapes · ${card.bytes} B`}
        </p>
        <Words card={card} />
      </div>
    </article>
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

function CardReuses({ reuses }: { reuses: readonly CardArtReuse[] }): JSX.Element {
  return (
    <section aria-labelledby="card-reuses" style={{ marginTop: spacing.xl }}>
      <h2 id="card-reuses" style={{ fontSize: typography.size.title, color: colors.text.primary, margin: `0 0 ${spacing.xs}px` }}>
        Card-art reuses
      </h2>
      <p style={{ ...muted, margin: `0 0 ${spacing.md}px` }}>
        These words use a heritage card picture instead of their own drawing. Each must read at 96 and 64 px; if one does not, the word gets its own drawing.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: spacing.lg }}>
        {reuses.map((reuse) => (
          <ReuseCard key={reuse.cardId} reuse={reuse} />
        ))}
      </div>
    </section>
  );
}

function ReviewChecklist(): JSX.Element {
  return (
    <details style={{ ...frame, padding: spacing.md, margin: `${spacing.lg}px 0` }}>
      <summary style={{ fontWeight: 600, color: colors.text.primary, cursor: 'pointer' }}>Review checklist</summary>
      <ol style={{ margin: `${spacing.sm}px 0 0`, paddingLeft: spacing.xl, color: colors.text.secondary, fontSize: typography.size.bodySm }}>
        {REVIEW_CHECKLIST.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
    </details>
  );
}

export default function WordArtPreviewPage(): JSX.Element {
  const sheet = buildWordArtSheet(WORD_ART, VOCAB_CATALOG);
  const size = measureWordArtSource();
  return (
    <PreviewShell
      title="WordArt: contact sheet"
      intro={
        <p style={{ margin: 0 }}>
          Every word picture in the registry, drawn from the same data the app paints. Check each one at 48 px, in silhouette and under the three colour-vision
          simulations, then mark it approved in the registry meta.
        </p>
      }
      links={[
        { href: '/design-preview', label: 'Design preview' },
        { href: '/design-preview/cards', label: 'Heritage cards' },
      ]}
    >
      <Sprite cards={sheet.cards} />
      <StatRow
        items={[
          { label: 'Glyphs', value: sheet.totals.glyphs, testId: 'count-glyphs' },
          { label: STATUS_LABEL.draft, value: sheet.totals.byStatus.draft, testId: 'count-draft' },
          { label: STATUS_LABEL.review, value: sheet.totals.byStatus.review, testId: 'count-review' },
          { label: STATUS_LABEL.approved, value: sheet.totals.byStatus.approved, testId: 'count-approved' },
          { label: 'Source, raw', value: `${size.raw} / ${BUDGET_RAW} B`, testId: 'budget-raw' },
          { label: 'Source, gzip', value: `${size.gzip} / ${BUDGET_GZIP} B`, testId: 'budget-gzip' },
        ]}
      />
      <WordArtTopicFilter families={sheet.families} total={sheet.totals.glyphs} />
      <ReviewChecklist />
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 560px), 1fr))', gap: spacing.lg }}>
        {sheet.cards.map((card) => (
          <Card key={card.key} card={card} />
        ))}
      </section>
      <CardReuses reuses={cardArtReuses(VOCAB_CATALOG)} />
    </PreviewShell>
  );
}
