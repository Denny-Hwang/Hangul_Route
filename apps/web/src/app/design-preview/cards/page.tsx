import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';

/**
 * /design-preview/cards — visual regression surface for all 30 Heritage
 * Card illustrations. Mirrors apps/mobile shapes via inline web SVG.
 *
 * F-VR-001 spec. Used for manual visual diff between PR Cloudflare Pages
 * preview vs production.
 */

interface CardDef {
  cardId: string;
  ko: string;
  romanization: string;
  titleEn: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

const ALL_CARDS: Record<string, CardDef[]> = {
  'Letters & Books': [
    { cardId: 'card:book', ko: '책', romanization: 'chaek', titleEn: 'Book', rarity: 'common' },
    { cardId: 'card:hanji', ko: '한지', romanization: 'hanji', titleEn: 'Hanji Paper', rarity: 'uncommon' },
    { cardId: 'card:brush', ko: '붓', romanization: 'but', titleEn: 'Calligraphy Brush', rarity: 'uncommon' },
    { cardId: 'card:ink', ko: '먹', romanization: 'meok', titleEn: 'Ink Stick', rarity: 'common' },
    { cardId: 'card:origami', ko: '종이접기', romanization: 'jong-i-jeop-gi', titleEn: 'Paper Folding', rarity: 'rare' },
    { cardId: 'card:hangul-day', ko: '한글날', romanization: 'hangeul-nal', titleEn: 'Hangul Day', rarity: 'legendary' },
  ],
  'Food & Daily Life': [
    { cardId: 'card:kimchi', ko: '김치', romanization: 'gimchi', titleEn: 'Kimchi', rarity: 'common' },
    { cardId: 'card:rice', ko: '밥', romanization: 'bap', titleEn: 'Rice', rarity: 'common' },
    { cardId: 'card:chopsticks', ko: '젓가락', romanization: 'jeotgarak', titleEn: 'Chopsticks', rarity: 'common' },
    { cardId: 'card:hanbok', ko: '한복', romanization: 'hanbok', titleEn: 'Hanbok', rarity: 'rare' },
    { cardId: 'card:kimbap', ko: '김밥', romanization: 'gimbap', titleEn: 'Kimbap', rarity: 'uncommon' },
    { cardId: 'card:family-table', ko: '가족식탁', romanization: 'gajok-siktak', titleEn: 'Family Table', rarity: 'uncommon' },
  ],
  'Holidays & Traditions': [
    { cardId: 'card:seollal', ko: '설날', romanization: 'seollal', titleEn: 'Lunar New Year', rarity: 'rare' },
    { cardId: 'card:chuseok', ko: '추석', romanization: 'chuseok', titleEn: 'Harvest Festival', rarity: 'rare' },
    { cardId: 'card:tteokguk', ko: '떡국', romanization: 'tteokguk', titleEn: 'Rice Cake Soup', rarity: 'uncommon' },
    { cardId: 'card:songpyeon', ko: '송편', romanization: 'songpyeon', titleEn: 'Songpyeon', rarity: 'uncommon' },
    { cardId: 'card:sebae', ko: '세배', romanization: 'sebae', titleEn: 'New Year Bow', rarity: 'common' },
    { cardId: 'card:lantern', ko: '연등', romanization: 'yeondeung', titleEn: 'Paper Lantern', rarity: 'legendary' },
  ],
  'Nature & Animals': [
    { cardId: 'card:tiger', ko: '호랑이', romanization: 'horangi', titleEn: 'Tiger', rarity: 'legendary' },
    { cardId: 'card:magpie', ko: '까치', romanization: 'kkachi', titleEn: 'Magpie', rarity: 'uncommon' },
    { cardId: 'card:mugunghwa', ko: '무궁화', romanization: 'mugunghwa', titleEn: 'Rose of Sharon', rarity: 'rare' },
    { cardId: 'card:mountain', ko: '산', romanization: 'san', titleEn: 'Mountain', rarity: 'common' },
    { cardId: 'card:sea', ko: '바다', romanization: 'bada', titleEn: 'Sea', rarity: 'common' },
    { cardId: 'card:moon', ko: '달', romanization: 'dal', titleEn: 'Moon', rarity: 'uncommon' },
  ],
  'Play & Crafts': [
    { cardId: 'card:yutnori', ko: '윷놀이', romanization: 'yutnori', titleEn: 'Yut Game', rarity: 'rare' },
    { cardId: 'card:jegi', ko: '제기', romanization: 'jegi', titleEn: 'Foot Shuttlecock', rarity: 'uncommon' },
    { cardId: 'card:kite', ko: '연', romanization: 'yeon', titleEn: 'Kite', rarity: 'uncommon' },
    { cardId: 'card:top', ko: '팽이', romanization: 'paengi', titleEn: 'Spinning Top', rarity: 'common' },
    { cardId: 'card:pottery', ko: '청자', romanization: 'cheongja', titleEn: 'Celadon Pottery', rarity: 'rare' },
    { cardId: 'card:gayageum', ko: '가야금', romanization: 'gayageum', titleEn: 'Gayageum Zither', rarity: 'legendary' },
  ],
};

export default function CardsPreviewPage(): JSX.Element {
  return (
    <main
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: `${spacing.xxl}px ${spacing.lg}px`,
        backgroundColor: colors.surface.canvas,
        minHeight: '100vh',
      }}
    >
      <header style={{ marginBottom: spacing.xxl }}>
        <Link href="/design-preview" style={{ color: colors.brand.primary, fontWeight: 600 }}>
          ← back to design preview
        </Link>
        <h1
          style={{
            fontSize: typography.size.hero,
            fontWeight: 700,
            color: colors.text.primary,
            marginTop: spacing.xs,
            marginBottom: spacing.sm,
          }}
        >
          Heritage Cards — All 30
        </h1>
        <p
          style={{
            fontSize: typography.size.body,
            color: colors.text.secondary,
            maxWidth: 720,
          }}
        >
          Visual regression surface (F-VR-001). Every Heritage card art in one place, grouped by
          theme. Cloudflare Pages preview deploys this on every PR — diff against production by
          opening both URLs in tabs.
        </p>
      </header>

      {Object.entries(ALL_CARDS).map(([theme, cards]) => (
        <section key={theme} style={{ marginBottom: spacing.jumbo }}>
          <h2
            style={{
              fontSize: typography.size.title,
              fontWeight: 700,
              color: colors.text.primary,
              marginBottom: spacing.lg,
              borderBottom: `2px solid ${colors.border.subtle}`,
              paddingBottom: spacing.sm,
            }}
          >
            {theme}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: spacing.lg,
            }}
          >
            {cards.map((c) => (
              <CardCell key={c.cardId} card={c} />
            ))}
          </div>
        </section>
      ))}

      <footer
        style={{
          marginTop: spacing.jumbo,
          paddingTop: spacing.lg,
          borderTop: `1px solid ${colors.border.subtle}`,
          color: colors.text.muted,
          fontSize: typography.size.caption,
        }}
      >
        <p>
          Real illustrator output replaces each card placeholder in{' '}
          <code style={{ fontFamily: typography.family.mono }}>
            design/illustrations/heritage-cards/{`{theme}/{card-id}__YYYY-MM-DD.png`}
          </code>{' '}
          in a later sprint.
        </p>
      </footer>
    </main>
  );
}

function CardCell({ card }: { card: CardDef }): JSX.Element {
  const rarityColor = colors.rarity[card.rarity];
  const rarityBg = {
    common: { bg: colors.surface.sunken, fg: colors.text.secondary },
    uncommon: { bg: colors.feedback.successLight, fg: '#2F6A47' },
    rare: { bg: colors.feedback.infoLight, fg: '#2E5BC7' },
    legendary: { bg: colors.feedback.nudgeLight, fg: '#B5862A' },
  }[card.rarity];
  return (
    <div
      style={{
        backgroundColor: colors.surface.paper,
        border: `4px solid ${rarityColor}`,
        borderRadius: radii.xl,
        padding: spacing.md,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          alignSelf: 'flex-end',
          padding: `${spacing.xxs}px ${spacing.sm}px`,
          backgroundColor: rarityBg.bg,
          color: rarityBg.fg,
          borderRadius: radii.pill,
          fontSize: typography.size.caption,
          fontWeight: 600,
          marginBottom: spacing.sm,
        }}
      >
        {card.rarity}
      </div>
      <CardArtSvg cardId={card.cardId} size={160} />
      <div
        style={{
          marginTop: spacing.sm,
          fontSize: typography.size.title,
          fontWeight: 700,
          color: colors.text.primary,
        }}
      >
        {card.ko}
      </div>
      <div
        style={{
          fontSize: typography.size.caption,
          color: colors.text.muted,
          fontStyle: 'italic',
        }}
      >
        {card.romanization}
      </div>
      <div style={{ fontSize: typography.size.bodySm, color: colors.text.secondary }}>
        {card.titleEn}
      </div>
    </div>
  );
}

/**
 * Inline SVG mirror — simplified placeholder for each of the 30 cards.
 * Each card renders a recognizable but minimal motif:
 *   - Theme tinted background wash
 *   - A few characteristic shapes (no full mirror of the RN component
 *     since this is a quick-look surface, not the production asset)
 * Real cards are visible in apps/mobile/src/components/HeritageCardArt.
 */
function CardArtSvg({ cardId, size }: { cardId: string; size: number }): JSX.Element {
  const themeColor = themeForCard(cardId);
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-label={cardId}>
      <rect x={0} y={0} width={200} height={200} fill={themeColor} opacity={0.08} rx={8} />
      <CardMotif cardId={cardId} />
    </svg>
  );
}

function themeForCard(cardId: string): string {
  if (
    [
      'card:book',
      'card:hanji',
      'card:brush',
      'card:ink',
      'card:origami',
      'card:hangul-day',
    ].includes(cardId)
  )
    return colors.theme.letters;
  if (
    [
      'card:kimchi',
      'card:rice',
      'card:chopsticks',
      'card:hanbok',
      'card:kimbap',
      'card:family-table',
    ].includes(cardId)
  )
    return colors.theme.life;
  if (
    [
      'card:seollal',
      'card:chuseok',
      'card:tteokguk',
      'card:songpyeon',
      'card:sebae',
      'card:lantern',
    ].includes(cardId)
  )
    return colors.theme.rites;
  if (
    ['card:tiger', 'card:magpie', 'card:mugunghwa', 'card:mountain', 'card:sea', 'card:moon'].includes(
      cardId,
    )
  )
    return colors.theme.nature;
  return colors.theme.crafts;
}

function CardMotif({ cardId }: { cardId: string }): JSX.Element {
  // Compact recognizable motifs per card (lighter than the full RN renderer).
  switch (cardId) {
    case 'card:tiger':
      return (
        <g>
          <circle cx={100} cy={110} r={50} fill={colors.hoya.fur} />
          <circle cx={100} cy={110} r={28} fill={colors.hoya.belly} />
          <circle cx={85} cy={105} r={3} fill={colors.hoya.stripes} />
          <circle cx={115} cy={105} r={3} fill={colors.hoya.stripes} />
          <path d="M95 115 L105 115 L100 120 Z" fill={colors.hoya.nose} />
          <path d="M85 122 Q100 135 115 122" stroke={colors.hoya.stripes} strokeWidth={2} fill="none" />
          <g fill={colors.feedback.nudge} opacity={0.9}>
            <path d="M40 60 L44 70 L40 80 L36 70 Z" />
            <path d="M160 60 L164 70 L160 80 L156 70 Z" />
          </g>
        </g>
      );
    case 'card:book':
      return (
        <g>
          <path d="M40 70 Q100 60 160 70 L160 150 Q100 140 40 150 Z" fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2} />
          <path d="M100 65 V145" stroke={colors.text.secondary} strokeWidth={2} />
          <path d="M55 95 H85" stroke={colors.text.primary} strokeWidth={3} />
          <path d="M55 115 H85" stroke={colors.text.primary} strokeWidth={3} />
          <path d="M115 95 H145" stroke={colors.text.primary} strokeWidth={3} />
          <path d="M115 115 H145" stroke={colors.text.primary} strokeWidth={3} />
        </g>
      );
    case 'card:hanji':
      return (
        <g>
          <rect x={40} y={40} width={120} height={120} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={4} />
          <g stroke={colors.border.subtle} strokeWidth={1}>
            <line x1={50} y1={60} x2={80} y2={70} />
            <line x1={90} y1={55} x2={140} y2={65} />
            <line x1={60} y1={100} x2={110} y2={95} />
            <line x1={130} y1={120} x2={155} y2={130} />
          </g>
          <path d="M150 40 L150 50 L160 60 L155 70 Z" fill={colors.surface.sunken} stroke={colors.text.secondary} strokeWidth={1} />
        </g>
      );
    case 'card:brush':
      return (
        <g>
          <rect x={95} y={50} width={10} height={60} fill={colors.feedback.nudge} stroke={colors.hoya.furDark} strokeWidth={1.5} rx={2} />
          <rect x={92} y={108} width={16} height={6} fill={colors.text.muted} />
          <path d="M92 114 Q100 122 108 114 L106 140 Q100 144 94 140 Z" fill={colors.text.primary} />
          <ellipse cx={100} cy={155} rx={3} ry={4} fill={colors.text.primary} />
        </g>
      );
    case 'card:ink':
      return (
        <g>
          <ellipse cx={100} cy={130} rx={50} ry={22} fill={colors.surface.sunken} stroke={colors.text.secondary} strokeWidth={2} />
          <rect x={75} y={70} width={50} height={24} fill={colors.text.primary} rx={2} />
        </g>
      );
    case 'card:origami':
      return (
        <g>
          <path d="M60 110 L100 60 L140 110 L100 130 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <path d="M140 110 L165 95 L155 115 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <path d="M60 110 L40 100 L52 115 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} />
        </g>
      );
    case 'card:hangul-day':
      return (
        <g>
          <rect x={50} y={70} width={42} height={42} fill={colors.brand.primary} rx={4} />
          <rect x={108} y={70} width={42} height={42} fill={colors.brand.primary} rx={4} />
          <g fill={colors.feedback.nudge}>
            <path d="M30 40 L34 50 L30 60 L26 50 Z" />
            <path d="M170 40 L174 50 L170 60 L166 50 Z" />
            <path d="M100 30 L104 38 L100 46 L96 38 Z" />
          </g>
        </g>
      );
    case 'card:kimchi':
      return (
        <g>
          <path d="M50 95 Q100 65 150 95 Q150 115 100 115 Q50 115 50 95 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <path d="M40 110 Q40 155 100 162 Q160 155 160 110 Z" fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2} />
        </g>
      );
    case 'card:rice':
      return (
        <g>
          <g stroke={colors.text.muted} strokeWidth={2} fill="none" opacity={0.6}>
            <path d="M80 50 Q85 60 80 70" />
            <path d="M120 50 Q125 60 120 70" />
          </g>
          <path d="M50 110 Q100 80 150 110 Z" fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2} />
          <path d="M40 110 Q40 155 100 162 Q160 155 160 110 Z" fill={colors.feedback.nudge} opacity={0.5} stroke={colors.text.secondary} strokeWidth={2} />
        </g>
      );
    case 'card:chopsticks':
      return (
        <g>
          <path d="M70 145 Q100 138 130 145 Q130 155 100 158 Q70 155 70 145 Z" fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2} />
          <path d="M70 50 L85 145" stroke={colors.text.muted} strokeWidth={5} strokeLinecap="round" />
          <path d="M130 50 L115 145" stroke={colors.text.muted} strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    case 'card:hanbok':
      return (
        <g>
          <path d="M100 30 Q100 38 95 40" stroke={colors.text.secondary} strokeWidth={2} fill="none" />
          <path d="M60 55 Q100 45 140 55" stroke={colors.text.secondary} strokeWidth={2} fill="none" />
          <path d="M55 65 Q100 55 145 65 L135 90 L120 80 L120 105 Q100 110 80 105 L80 80 L65 90 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={1.5} />
          <path d="M75 105 Q100 110 125 105 L140 165 Q100 170 60 165 Z" fill={colors.brand.secondary} stroke={colors.brand.secondaryDark} strokeWidth={2} />
        </g>
      );
    case 'card:kimbap':
      return (
        <g>
          {(
            [
              [70, 130],
              [100, 100],
              [130, 70],
            ] as Array<[number, number]>
          ).map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={25} fill={colors.text.primary} opacity={0.85} />
              <circle cx={cx} cy={cy} r={19} fill={colors.surface.canvas} />
              <circle cx={cx - 5} cy={cy + 3} r={4} fill={colors.brand.primary} />
              <circle cx={cx + 5} cy={cy - 3} r={4} fill={colors.theme.nature} />
            </g>
          ))}
        </g>
      );
    case 'card:family-table':
      return (
        <g>
          <circle cx={100} cy={100} r={65} fill={colors.feedback.nudge} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <circle cx={100} cy={100} r={16} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={1.5} />
          {(
            [
              [100, 55, colors.brand.primary],
              [145, 100, colors.theme.nature],
              [100, 145, colors.surface.canvas],
              [55, 100, colors.brand.primaryLight],
            ] as Array<[number, number, string]>
          ).map(([cx, cy, c], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={13} fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={1.5} />
              <circle cx={cx} cy={cy} r={9} fill={c} opacity={0.85} />
            </g>
          ))}
        </g>
      );
    case 'card:seollal':
      return (
        <g>
          <rect x={30} y={30} width={140} height={50} fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2} rx={4} />
          <g>
            <path d="M65 130 Q60 145 55 158 H92 Q87 145 82 130 Z" fill={colors.theme.rites} />
            <circle cx={73} cy={108} r={11} fill={colors.hoya.belly} stroke={colors.text.secondary} strokeWidth={1.5} />
          </g>
          <g>
            <path d="M125 140 Q121 150 117 160 H143 Q139 150 135 140 Z" fill={colors.brand.secondary} />
            <circle cx={130} cy={125} r={9} fill={colors.hoya.belly} stroke={colors.text.secondary} strokeWidth={1.5} />
          </g>
        </g>
      );
    case 'card:chuseok':
      return (
        <g>
          <circle cx={100} cy={85} r={48} fill={colors.feedback.nudge} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <g fill={colors.text.primary} opacity={0.7}>
            <ellipse cx={100} cy={92} rx={13} ry={8} />
            <circle cx={88} cy={88} r={6} />
            <ellipse cx={84} cy={76} rx={2} ry={6} />
            <ellipse cx={91} cy={76} rx={2} ry={6} />
          </g>
          <g stroke={colors.theme.nature} strokeWidth={2} fill="none" strokeLinecap="round">
            <path d="M50 170 Q52 158 58 145" />
            <path d="M100 175 Q100 158 102 145" />
            <path d="M148 170 Q146 158 142 145" />
          </g>
        </g>
      );
    case 'card:tteokguk':
      return (
        <g>
          <path d="M30 95 Q30 145 100 152 Q170 145 170 95 Z" fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2} />
          <path d="M40 100 Q100 110 160 100" fill={colors.feedback.nudge} opacity={0.4} />
          <g fill={colors.surface.canvas} stroke={colors.text.muted} strokeWidth={1.5}>
            <ellipse cx={75} cy={115} rx={11} ry={5} />
            <ellipse cx={100} cy={110} rx={11} ry={5} />
            <ellipse cx={125} cy={115} rx={11} ry={5} />
          </g>
          <circle cx={115} cy={120} r={3} fill={colors.theme.nature} />
        </g>
      );
    case 'card:songpyeon':
      return (
        <g>
          <g stroke={colors.theme.nature} strokeWidth={2} strokeLinecap="round">
            <line x1={40} y1={140} x2={70} y2={135} />
            <line x1={80} y1={140} x2={120} y2={135} />
            <line x1={120} y1={140} x2={160} y2={135} />
          </g>
          <path d="M45 125 Q60 90 95 105 Q85 125 70 130 Z" fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} />
          <path d="M85 100 Q100 70 130 90 Q120 110 105 115 Z" fill={colors.hoya.cheek} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <path d="M115 120 Q130 90 165 105 Q155 125 140 130 Z" fill={colors.theme.nature} opacity={0.85} stroke={colors.brand.primaryDark} strokeWidth={2} />
        </g>
      );
    case 'card:sebae':
      return (
        <g>
          <path d="M55 85 Q100 65 145 85 Q150 105 130 120 L70 120 Q50 105 55 85 Z" fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} />
          <path d="M70 122 Q70 150 100 158 Q130 150 130 122 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <circle cx={100} cy={170} r={3} fill={colors.feedback.nudge} />
        </g>
      );
    case 'card:lantern':
      return (
        <g>
          <circle cx={100} cy={100} r={48} fill={colors.feedback.nudge} opacity={0.25} />
          <ellipse cx={100} cy={100} rx={34} ry={40} fill={colors.feedback.nudge} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <rect x={88} y={56} width={24} height={6} fill={colors.text.secondary} />
          <rect x={88} y={140} width={24} height={6} fill={colors.text.secondary} />
          <line x1={100} y1={146} x2={100} y2={170} stroke={colors.text.secondary} strokeWidth={2} />
          <circle cx={100} cy={174} r={4} fill={colors.brand.primary} />
        </g>
      );
    case 'card:magpie':
      return (
        <g>
          <path d="M30 140 Q100 138 170 138" stroke={colors.theme.life} strokeWidth={5} fill="none" strokeLinecap="round" />
          <ellipse cx={100} cy={100} rx={24} ry={26} fill={colors.text.primary} />
          <ellipse cx={100} cy={110} rx={13} ry={14} fill={colors.surface.canvas} />
          <circle cx={100} cy={78} r={13} fill={colors.text.primary} />
          <circle cx={107} cy={75} r={2} fill={colors.surface.canvas} />
          <path d="M113 73 L120 72 L113 78 Z" fill={colors.feedback.nudge} />
          <path d="M115 125 Q140 138 155 148 L148 152 Q130 138 115 130 Z" fill={colors.text.primary} />
        </g>
      );
    case 'card:mugunghwa':
      return (
        <g>
          <path d="M100 165 Q100 145 100 125" stroke={colors.theme.nature} strokeWidth={4} fill="none" />
          <g fill={colors.hoya.cheek} stroke={colors.brand.primaryDark} strokeWidth={1.5}>
            <ellipse cx={100} cy={60} rx={14} ry={22} />
            <ellipse cx={130} cy={75} rx={14} ry={22} transform="rotate(72 130 75)" />
            <ellipse cx={120} cy={108} rx={14} ry={22} transform="rotate(144 120 108)" />
            <ellipse cx={80} cy={108} rx={14} ry={22} transform="rotate(216 80 108)" />
            <ellipse cx={70} cy={75} rx={14} ry={22} transform="rotate(288 70 75)" />
          </g>
          <circle cx={100} cy={82} r={11} fill={colors.theme.rites} />
        </g>
      );
    case 'card:mountain':
      return (
        <g>
          <circle cx={120} cy={70} r={22} fill={colors.feedback.nudge} opacity={0.7} />
          <polygon points="60,160 110,80 165,160" fill={colors.theme.nature} opacity={0.7} />
          <polygon points="20,170 75,100 130,170" fill={colors.theme.nature} stroke={colors.brand.primaryDark} strokeWidth={2} />
        </g>
      );
    case 'card:sea':
      return (
        <g>
          <circle cx={160} cy={45} r={14} fill={colors.feedback.nudge} opacity={0.7} />
          <path d="M75 130 L125 130 L115 145 L85 145 Z" fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} />
          <line x1={100} y1={75} x2={100} y2={130} stroke={colors.text.secondary} strokeWidth={2} />
          <path d="M100 75 L125 125 L100 125 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <g stroke={colors.brand.secondary} strokeWidth={3} fill="none" strokeLinecap="round">
            <path d="M10 155 Q40 150 70 155 T130 155 T190 155" />
            <path d="M10 175 Q40 170 70 175 T130 175 T190 175" />
          </g>
        </g>
      );
    case 'card:moon':
      return (
        <g>
          <rect x={0} y={0} width={200} height={200} fill={colors.theme.rites} opacity={0.15} />
          <g fill={colors.feedback.nudge}>
            <circle cx={40} cy={40} r={2} />
            <circle cx={170} cy={50} r={2} />
            <circle cx={30} cy={140} r={1.5} />
          </g>
          <circle cx={100} cy={100} r={45} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} />
          <g fill={colors.text.muted} opacity={0.5}>
            <circle cx={85} cy={88} r={7} />
            <circle cx={115} cy={108} r={5} />
          </g>
        </g>
      );
    case 'card:yutnori':
      return (
        <g>
          <ellipse cx={100} cy={170} rx={60} ry={5} fill={colors.hoya.furDark} opacity={0.15} />
          <g transform="rotate(-15 60 80)">
            <rect x={28} y={73} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={6} />
          </g>
          <g transform="rotate(20 140 80)">
            <rect x={108} y={73} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={3} />
            <circle cx={140} cy={80} r={4} fill={colors.brand.primary} />
          </g>
          <g transform="rotate(10 70 130)">
            <rect x={38} y={123} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={6} />
          </g>
        </g>
      );
    case 'card:jegi':
      return (
        <g>
          <ellipse cx={100} cy={150} rx={24} ry={9} fill={colors.text.muted} stroke={colors.text.secondary} strokeWidth={2} />
          <path d="M85 144 Q100 134 115 144 L113 150 Q100 142 87 150 Z" fill={colors.theme.rites} />
          <g fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={1.5}>
            <path d="M86 144 Q78 110 80 75 Q90 110 96 144 Z" />
            <path d="M100 144 Q98 90 100 50 Q104 90 102 144 Z" />
            <path d="M104 144 Q108 105 120 75 Q108 110 113 144 Z" />
          </g>
        </g>
      );
    case 'card:kite':
      return (
        <g>
          <polygon points="100,30 150,90 100,150 50,90" fill={colors.surface.canvas} stroke={colors.brand.secondary} strokeWidth={2} />
          <line x1={50} y1={90} x2={150} y2={90} stroke={colors.brand.secondary} strokeWidth={2} />
          <line x1={100} y1={30} x2={100} y2={150} stroke={colors.brand.secondary} strokeWidth={2} />
          <circle cx={100} cy={90} r={11} fill={colors.brand.secondaryLight} stroke={colors.brand.secondary} strokeWidth={2} />
          <circle cx={100} cy={90} r={8} fill={colors.hoya.fur} />
        </g>
      );
    case 'card:top':
      return (
        <g>
          <ellipse cx={100} cy={170} rx={22} ry={3} fill={colors.hoya.furDark} opacity={0.3} />
          <path d="M70 60 Q100 50 130 60 L130 100 Q130 130 100 160 Q70 130 70 100 Z" fill={colors.feedback.nudge} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <path d="M70 90 Q100 95 130 90 L130 100 Q100 105 70 100 Z" fill={colors.brand.primary} />
          <rect x={94} y={55} width={12} height={10} fill={colors.text.secondary} />
        </g>
      );
    case 'card:pottery':
      return (
        <g>
          <path d="M85 50 Q95 48 115 50 L113 65 Q138 90 130 145 Q115 165 100 168 Q85 165 70 145 Q62 90 87 65 Z" fill={colors.theme.nature} opacity={0.7} stroke={colors.brand.primaryDark} strokeWidth={2} />
          <ellipse cx={100} cy={50} rx={14} ry={4} fill={colors.text.secondary} opacity={0.4} stroke={colors.brand.primaryDark} strokeWidth={2} />
        </g>
      );
    case 'card:gayageum':
      return (
        <g>
          <ellipse cx={100} cy={150} rx={70} ry={4} fill={colors.hoya.furDark} opacity={0.2} />
          <ellipse cx={100} cy={100} rx={75} ry={12} fill={colors.feedback.nudge} opacity={0.2} />
          <path d="M20 80 Q15 100 25 120 L175 120 Q185 100 180 80 Z" fill={colors.brand.secondary} opacity={0.4} stroke={colors.brand.primaryDark} strokeWidth={2} />
          {Array.from({ length: 12 }).map((_, i) => {
            const y = 84 + i * 3;
            return <line key={i} x1={28} y1={y} x2={172} y2={y} stroke={colors.surface.canvas} strokeWidth={1.2} />;
          })}
        </g>
      );
    default:
      return (
        <g>
          <circle cx={100} cy={100} r={50} fill={colors.brand.primaryLight} />
        </g>
      );
  }
}
