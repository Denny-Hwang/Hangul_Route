import {
  colors,
  motion,
  radii,
  shadows,
  spacing,
  touchTarget,
  typography,
  z,
} from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import React from 'react';

/**
 * /design-preview — single-URL visual identity validation surface.
 * Imports ONLY tokens (no RN components — they don't run on web).
 * Renders equivalent HTML/CSS using the same token values so the design
 * system can be reviewed in a browser by designer / parent / dev.
 */

export default function DesignPreviewPage(): JSX.Element {
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
      <Header />
      <SectionBrand />
      <SectionSurface />
      <SectionText />
      <SectionFeedback />
      <SectionStageTheme />
      <SectionHoyaPalette />
      <SectionRarity />
      <SectionTypography />
      <SectionSpacing />
      <SectionRadii />
      <SectionShadows />
      <SectionTouchTargets />
      <SectionMotion />
      <SectionZ />
      <SectionButtons />
      <SectionCards />
      <SectionPills />
      <SectionTiles />
      <SectionHoyaPlaceholder />
      <Footer />
    </main>
  );
}

function Header(): JSX.Element {
  return (
    <header style={{ marginBottom: spacing.jumbo }}>
      <Link href="/" style={{ color: colors.text.muted, fontSize: typography.size.caption }}>
        ← Hangul Route
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
        Design Preview · v1
      </h1>
      <p
        style={{
          fontSize: typography.size.bodyLg,
          color: colors.text.secondary,
          maxWidth: 720,
          lineHeight: typography.leading.normal,
        }}
      >
        Every color, type size, spacing, radius, shadow, and component variant — rendered live from{' '}
        <code style={{ fontFamily: typography.family.mono, color: colors.brand.primary }}>
          @hangul-route/design-system/tokens
        </code>
        . If something here looks wrong, the token (or this preview) needs to change — never the
        component call site.
      </p>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Generic primitives
// ---------------------------------------------------------------------------

function SectionTitle({ id, title, subtitle }: { id: string; title: string; subtitle?: string }): JSX.Element {
  return (
    <div id={id} style={{ marginBottom: spacing.lg }}>
      <h2
        style={{
          fontSize: typography.size.title,
          fontWeight: 700,
          color: colors.text.primary,
          marginBottom: spacing.xs,
        }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p style={{ fontSize: typography.size.body, color: colors.text.muted, margin: 0 }}>{subtitle}</p>
      ) : null}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }): JSX.Element {
  return <section style={{ marginBottom: spacing.jumbo }}>{children}</section>;
}

function Swatch({ name, hex, dark }: { name: string; hex: string; dark?: boolean }): JSX.Element {
  return (
    <div
      style={{
        backgroundColor: colors.surface.paper,
        borderRadius: radii.lg,
        padding: spacing.md,
        border: `1px solid ${colors.border.subtle}`,
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '3 / 2',
          backgroundColor: hex,
          borderRadius: radii.md,
          border: `1px solid ${colors.border.subtle}`,
        }}
      />
      <div style={{ marginTop: spacing.sm }}>
        <div
          style={{
            fontSize: typography.size.bodySm,
            fontWeight: 600,
            color: dark ? colors.text.inverse : colors.text.primary,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: typography.size.caption,
            color: colors.text.muted,
            fontFamily: typography.family.mono,
            marginTop: 2,
          }}
        >
          {hex}
        </div>
      </div>
    </div>
  );
}

function SwatchGrid({ items }: { items: Array<[string, string]> }): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: spacing.md,
      }}
    >
      {items.map(([name, hex]) => (
        <Swatch key={name} name={name} hex={hex} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Brand
// ---------------------------------------------------------------------------

function SectionBrand(): JSX.Element {
  const items: Array<[string, string]> = [
    ['brand.primary', colors.brand.primary],
    ['brand.primaryDark', colors.brand.primaryDark],
    ['brand.primaryLight', colors.brand.primaryLight],
    ['brand.secondary', colors.brand.secondary],
    ['brand.secondaryDark', colors.brand.secondaryDark],
    ['brand.secondaryLight', colors.brand.secondaryLight],
  ];
  return (
    <Section>
      <SectionTitle
        id="brand"
        title="Brand palette"
        subtitle="Dancheong warm orange + Hoya sky blue."
      />
      <SwatchGrid items={items} />
    </Section>
  );
}

function SectionSurface(): JSX.Element {
  const items: Array<[string, string]> = [
    ['surface.canvas', colors.surface.canvas],
    ['surface.paper', colors.surface.paper],
    ['surface.sunken', colors.surface.sunken],
  ];
  return (
    <Section>
      <SectionTitle id="surface" title="Surface (hanji layering)" />
      <SwatchGrid items={items} />
    </Section>
  );
}

function SectionText(): JSX.Element {
  const items: Array<[string, string]> = [
    ['text.primary', colors.text.primary],
    ['text.secondary', colors.text.secondary],
    ['text.muted', colors.text.muted],
    ['text.inverse', colors.text.inverse],
  ];
  return (
    <Section>
      <SectionTitle id="text" title="Text (warm dark, never pure black)" />
      <SwatchGrid items={items} />
    </Section>
  );
}

function SectionFeedback(): JSX.Element {
  const items: Array<[string, string]> = [
    ['feedback.success', colors.feedback.success],
    ['feedback.successLight', colors.feedback.successLight],
    ['feedback.nudge', colors.feedback.nudge],
    ['feedback.nudgeLight', colors.feedback.nudgeLight],
    ['feedback.info', colors.feedback.info],
    ['feedback.infoLight', colors.feedback.infoLight],
    ['feedback.danger (reserved)', colors.feedback.danger],
    ['feedback.dangerLight (reserved)', colors.feedback.dangerLight],
  ];
  return (
    <Section>
      <SectionTitle
        id="feedback"
        title="Feedback (anti-shame)"
        subtitle="Child wrong-answer uses amber `nudge`. `danger` red is reserved for parent/admin destructive actions only."
      />
      <SwatchGrid items={items} />
    </Section>
  );
}

function SectionStageTheme(): JSX.Element {
  const stages: Array<[string, string]> = [
    ['stage1 — Hangul', colors.stage.stage1],
    ['stage2 — Words', colors.stage.stage2],
    ['stage3 — Sentences', colors.stage.stage3],
    ['stage4 — Dialogue', colors.stage.stage4],
    ['stage5 — Stories', colors.stage.stage5],
    ['stage6 — Real-use', colors.stage.stage6],
    ['stage7 — Self-expression', colors.stage.stage7],
  ];
  const themes: Array<[string, string]> = [
    ['theme.letters', colors.theme.letters],
    ['theme.life', colors.theme.life],
    ['theme.rites', colors.theme.rites],
    ['theme.nature', colors.theme.nature],
    ['theme.crafts', colors.theme.crafts],
  ];
  return (
    <Section>
      <SectionTitle id="stage-theme" title="Stage × Theme axes (Heritage Journey 7 × 5)" />
      <h3
        style={{
          fontSize: typography.size.body,
          fontWeight: 600,
          color: colors.text.secondary,
          marginBottom: spacing.sm,
        }}
      >
        Stages
      </h3>
      <SwatchGrid items={stages} />
      <h3
        style={{
          fontSize: typography.size.body,
          fontWeight: 600,
          color: colors.text.secondary,
          marginTop: spacing.lg,
          marginBottom: spacing.sm,
        }}
      >
        Themes
      </h3>
      <SwatchGrid items={themes} />
    </Section>
  );
}

function SectionHoyaPalette(): JSX.Element {
  const items: Array<[string, string]> = [
    ['hoya.fur', colors.hoya.fur],
    ['hoya.furDark', colors.hoya.furDark],
    ['hoya.stripes', colors.hoya.stripes],
    ['hoya.belly', colors.hoya.belly],
    ['hoya.cheek', colors.hoya.cheek],
    ['hoya.nose', colors.hoya.nose],
  ];
  return (
    <Section>
      <SectionTitle id="hoya-palette" title="Hoya character palette" />
      <SwatchGrid items={items} />
    </Section>
  );
}

function SectionRarity(): JSX.Element {
  const items: Array<[string, string]> = [
    ['rarity.common', colors.rarity.common],
    ['rarity.uncommon', colors.rarity.uncommon],
    ['rarity.rare', colors.rarity.rare],
    ['rarity.legendary', colors.rarity.legendary],
  ];
  return (
    <Section>
      <SectionTitle id="rarity" title="Rarity (Heritage card borders)" />
      <SwatchGrid items={items} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section: Typography
// ---------------------------------------------------------------------------

function SectionTypography(): JSX.Element {
  const rows: Array<[string, number]> = [
    ['hero', typography.size.hero],
    ['display', typography.size.display],
    ['title', typography.size.title],
    ['prompt', typography.size.prompt],
    ['bodyLg', typography.size.bodyLg],
    ['body', typography.size.body],
    ['bodySm', typography.size.bodySm],
    ['caption', typography.size.caption],
  ];
  return (
    <Section>
      <SectionTitle id="typography" title="Typography scale" subtitle="Body floor 18sp — never go smaller for reading text." />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.md,
          backgroundColor: colors.surface.paper,
          padding: spacing.lg,
          borderRadius: radii.lg,
          border: `1px solid ${colors.border.subtle}`,
        }}
      >
        {rows.map(([name, size]) => (
          <div
            key={name}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 1fr',
              alignItems: 'baseline',
              gap: spacing.md,
              paddingBottom: spacing.sm,
              borderBottom: `1px solid ${colors.border.subtle}`,
            }}
          >
            <div
              style={{
                fontFamily: typography.family.mono,
                fontSize: typography.size.caption,
                color: colors.text.muted,
              }}
            >
              {name} · {size}sp
            </div>
            <div style={{ fontSize: size, color: colors.text.primary, fontWeight: 700 }}>Today's quest</div>
            <div style={{ fontSize: size, color: colors.brand.primary, fontWeight: 700 }}>오늘의 학습</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section: Spacing
// ---------------------------------------------------------------------------

function SectionSpacing(): JSX.Element {
  const rows: Array<[string, number]> = [
    ['xxs', spacing.xxs],
    ['xs', spacing.xs],
    ['sm', spacing.sm],
    ['md', spacing.md],
    ['lg', spacing.lg],
    ['xl', spacing.xl],
    ['xxl', spacing.xxl],
    ['xxxl', spacing.xxxl],
    ['jumbo', spacing.jumbo],
  ];
  return (
    <Section>
      <SectionTitle id="spacing" title="Spacing scale" subtitle="4pt sub-grid for fine, 8pt grid for layout." />
      <div
        style={{
          backgroundColor: colors.surface.paper,
          padding: spacing.lg,
          borderRadius: radii.lg,
          border: `1px solid ${colors.border.subtle}`,
        }}
      >
        {rows.map(([name, value]) => (
          <div
            key={name}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 80px 1fr',
              alignItems: 'center',
              gap: spacing.md,
              paddingBottom: spacing.sm,
              borderBottom: `1px solid ${colors.border.subtle}`,
              marginBottom: spacing.sm,
            }}
          >
            <div
              style={{
                fontFamily: typography.family.mono,
                fontSize: typography.size.caption,
                color: colors.text.muted,
              }}
            >
              {name}
            </div>
            <div style={{ fontSize: typography.size.caption, color: colors.text.muted }}>{value}px</div>
            <div
              style={{
                width: value,
                height: 24,
                backgroundColor: colors.brand.primary,
                borderRadius: radii.sm,
              }}
            />
          </div>
        ))}
      </div>
    </Section>
  );
}

function SectionTouchTargets(): JSX.Element {
  const rows: Array<[string, number]> = [
    ['min (CLAUDE.md floor)', touchTarget.min],
    ['child (ages 5–7 primary)', touchTarget.child],
    ['hero (jamo tiles, big CTAs)', touchTarget.hero],
  ];
  return (
    <Section>
      <SectionTitle
        id="touch"
        title="Touch targets"
        subtitle="Larger than adult Material guidelines — kids' motor calibration."
      />
      <div style={{ display: 'flex', gap: spacing.lg, alignItems: 'flex-end' }}>
        {rows.map(([name, value]) => (
          <div key={name} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: value,
                height: value,
                backgroundColor: colors.brand.primaryLight,
                border: `2px solid ${colors.brand.primary}`,
                borderRadius: radii.lg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: typography.family.mono,
                fontSize: typography.size.bodySm,
                color: colors.brand.primaryDark,
                fontWeight: 600,
                marginBottom: spacing.sm,
              }}
            >
              {value}dp
            </div>
            <div style={{ fontSize: typography.size.caption, color: colors.text.muted }}>{name}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section: Radii
// ---------------------------------------------------------------------------

function SectionRadii(): JSX.Element {
  const rows: Array<[string, number]> = [
    ['xs', radii.xs],
    ['sm', radii.sm],
    ['md', radii.md],
    ['lg', radii.lg],
    ['xl', radii.xl],
    ['xxl', radii.xxl],
    ['pill', radii.pill],
    ['circle', radii.circle],
  ];
  return (
    <Section>
      <SectionTitle id="radii" title="Radii" subtitle="Generous, paper-card feel. No sharp corners on touchables." />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
        {rows.map(([name, value]) => (
          <div key={name} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 120,
                height: 120,
                backgroundColor: colors.surface.paper,
                border: `2px solid ${colors.brand.primary}`,
                borderRadius: value > 200 ? Math.min(value, 999) : value,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: typography.family.mono,
                fontSize: typography.size.caption,
                color: colors.text.muted,
              }}
            >
              {value === 9999 ? '∞' : value === 999 ? 'pill' : value}
            </div>
            <div style={{ marginTop: spacing.xs, fontSize: typography.size.caption, color: colors.text.muted }}>
              {name}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section: Shadows
// ---------------------------------------------------------------------------

function SectionShadows(): JSX.Element {
  const rows: Array<[string, string]> = [
    ['card', '0 2px 8px rgba(42, 31, 20, 0.06)'],
    ['raised', '0 4px 16px rgba(42, 31, 20, 0.10)'],
    ['modal', '0 12px 32px rgba(42, 31, 20, 0.18)'],
  ];
  return (
    <Section>
      <SectionTitle id="shadows" title="Shadows" subtitle="Warm-dark tinted, never pure black." />
      <div style={{ display: 'flex', gap: spacing.xl, flexWrap: 'wrap' }}>
        {rows.map(([name, boxShadow]) => (
          <div key={name} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 200,
                height: 120,
                backgroundColor: colors.surface.paper,
                borderRadius: radii.lg,
                boxShadow,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: typography.family.mono,
                fontSize: typography.size.bodySm,
                color: colors.text.secondary,
              }}
            >
              {name}
            </div>
            <div
              style={{
                marginTop: spacing.sm,
                fontSize: typography.size.caption,
                color: colors.text.muted,
                fontFamily: typography.family.mono,
              }}
            >
              {boxShadow}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SectionMotion(): JSX.Element {
  const rows: Array<[string, number]> = [
    ['instant', motion.duration.instant],
    ['fast', motion.duration.fast],
    ['base', motion.duration.base],
    ['slow', motion.duration.slow],
    ['crawl', motion.duration.crawl],
    ['celebration', motion.duration.celebration],
  ];
  return (
    <Section>
      <SectionTitle id="motion" title="Motion durations" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: spacing.md,
        }}
      >
        {rows.map(([name, value]) => (
          <div
            key={name}
            style={{
              padding: spacing.md,
              backgroundColor: colors.surface.paper,
              borderRadius: radii.md,
              border: `1px solid ${colors.border.subtle}`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: typography.size.bodyLg, fontWeight: 700, color: colors.text.primary }}>
              {value}ms
            </div>
            <div style={{ fontSize: typography.size.caption, color: colors.text.muted, marginTop: spacing.xs }}>
              {name}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SectionZ(): JSX.Element {
  return (
    <Section>
      <SectionTitle id="z" title="Z-index layers" />
      <pre
        style={{
          fontFamily: typography.family.mono,
          fontSize: typography.size.bodySm,
          color: colors.text.secondary,
          backgroundColor: colors.surface.paper,
          padding: spacing.lg,
          borderRadius: radii.lg,
          border: `1px solid ${colors.border.subtle}`,
          margin: 0,
        }}
      >
        {`base       ${z.base}
raised     ${z.raised}
sticky     ${z.sticky}
drawer     ${z.drawer}
modal      ${z.modal}
toast      ${z.toast}
hoyaBubble ${z.hoyaBubble}`}
      </pre>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section: Buttons
// ---------------------------------------------------------------------------

interface ButtonPreviewProps {
  tone: 'primary' | 'secondary' | 'ghost' | 'success' | 'nudge';
  size: 'sm' | 'md' | 'lg' | 'hero';
  label?: string;
}

function ButtonPreview({ tone, size, label = 'Continue' }: ButtonPreviewProps): JSX.Element {
  const bg = {
    primary: colors.brand.primary,
    secondary: colors.brand.secondary,
    ghost: 'transparent',
    success: colors.feedback.success,
    nudge: colors.feedback.nudge,
  }[tone];
  const fg = {
    primary: colors.text.inverse,
    secondary: colors.text.inverse,
    ghost: colors.brand.primary,
    success: colors.text.inverse,
    nudge: colors.text.primary,
  }[tone];
  const minH = { sm: touchTarget.min, md: touchTarget.min, lg: touchTarget.child, hero: touchTarget.hero }[size];
  const fontSize = {
    sm: typography.size.bodySm,
    md: typography.size.body,
    lg: typography.size.bodyLg,
    hero: typography.size.prompt,
  }[size];
  const padX = { sm: spacing.lg, md: spacing.xl, lg: spacing.xl, hero: spacing.xxl }[size];
  return (
    <button
      type="button"
      style={{
        minHeight: minH,
        paddingLeft: padX,
        paddingRight: padX,
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: bg,
        color: fg,
        border: tone === 'ghost' ? `2px solid ${colors.brand.primary}` : 'none',
        fontWeight: 600,
        fontSize,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function SectionButtons(): JSX.Element {
  const tones: Array<ButtonPreviewProps['tone']> = ['primary', 'secondary', 'ghost', 'success', 'nudge'];
  const sizes: Array<ButtonPreviewProps['size']> = ['sm', 'md', 'lg', 'hero'];
  return (
    <Section>
      <SectionTitle id="buttons" title="Buttons" subtitle="5 tones × 4 sizes." />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto repeat(4, 1fr)',
          gap: spacing.md,
          alignItems: 'center',
          backgroundColor: colors.surface.paper,
          padding: spacing.lg,
          borderRadius: radii.lg,
          border: `1px solid ${colors.border.subtle}`,
        }}
      >
        <div />
        {sizes.map((s) => (
          <div
            key={s}
            style={{
              fontFamily: typography.family.mono,
              fontSize: typography.size.caption,
              color: colors.text.muted,
              textAlign: 'center',
            }}
          >
            {s}
          </div>
        ))}
        {tones.map((t) => (
          <React.Fragment key={t}>
            <div
              style={{
                fontFamily: typography.family.mono,
                fontSize: typography.size.caption,
                color: colors.text.muted,
              }}
            >
              {t}
            </div>
            {sizes.map((s) => (
              <div key={`${t}-${s}`} style={{ display: 'flex', justifyContent: 'center' }}>
                <ButtonPreview tone={t} size={s} label={s === 'hero' ? "Let's start" : s === 'lg' ? 'Start quest' : 'Continue'} />
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section: Cards
// ---------------------------------------------------------------------------

function SectionCards(): JSX.Element {
  const tones: Array<{ key: 'paper' | 'sunken' | 'brand' | 'success' | 'nudge'; fill: string }> = [
    { key: 'paper', fill: colors.surface.paper },
    { key: 'sunken', fill: colors.surface.sunken },
    { key: 'brand', fill: colors.brand.primaryLight },
    { key: 'success', fill: colors.feedback.successLight },
    { key: 'nudge', fill: colors.feedback.nudgeLight },
  ];
  const elevations: Array<['flat' | 'card' | 'raised', string]> = [
    ['flat', 'none'],
    ['card', '0 2px 8px rgba(42, 31, 20, 0.06)'],
    ['raised', '0 4px 16px rgba(42, 31, 20, 0.10)'],
  ];
  return (
    <Section>
      <SectionTitle id="cards" title="Cards" subtitle="5 tones × 3 elevations." />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: spacing.md,
        }}
      >
        {tones.map((t) =>
          elevations.map(([e, boxShadow]) => (
            <div
              key={`${t.key}-${e}`}
              style={{
                backgroundColor: t.fill,
                borderRadius: radii.lg,
                padding: spacing.lg,
                boxShadow,
                minHeight: 140,
              }}
            >
              <div
                style={{
                  fontSize: typography.size.bodyLg,
                  fontWeight: 700,
                  color: colors.text.primary,
                  marginBottom: spacing.xs,
                }}
              >
                Hello
              </div>
              <div style={{ fontSize: typography.size.bodySm, color: colors.text.secondary }}>
                Hoya says hi
              </div>
              <div
                style={{
                  fontFamily: typography.family.mono,
                  fontSize: typography.size.caption,
                  color: colors.text.muted,
                  marginTop: spacing.sm,
                }}
              >
                tone={t.key} · elevation={e}
              </div>
            </div>
          )),
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section: Pills
// ---------------------------------------------------------------------------

function SectionPills(): JSX.Element {
  const pills: Array<{ tone: string; bg: string; fg: string; label: string }> = [
    { tone: 'neutral', bg: colors.surface.sunken, fg: colors.text.secondary, label: 'Age 5-7' },
    { tone: 'primary', bg: colors.brand.primaryLight, fg: colors.brand.primaryDark, label: 'Hangul' },
    { tone: 'secondary', bg: colors.brand.secondaryLight, fg: colors.brand.secondaryDark, label: 'Letters' },
    { tone: 'success', bg: colors.feedback.successLight, fg: '#2F6A47', label: 'Open' },
    { tone: 'nudge', bg: colors.feedback.nudgeLight, fg: '#B5862A', label: 'rare' },
    { tone: 'info', bg: colors.feedback.infoLight, fg: '#2E5BC7', label: 'card' },
  ];
  return (
    <Section>
      <SectionTitle id="pills" title="Pills" subtitle="6 tones × 2 sizes." />
      <div
        style={{
          display: 'flex',
          gap: spacing.sm,
          flexWrap: 'wrap',
          backgroundColor: colors.surface.paper,
          padding: spacing.lg,
          borderRadius: radii.lg,
          border: `1px solid ${colors.border.subtle}`,
        }}
      >
        {pills.map((p) => (
          <div
            key={p.tone}
            style={{
              padding: `${spacing.xs}px ${spacing.md}px`,
              backgroundColor: p.bg,
              color: p.fg,
              borderRadius: radii.pill,
              fontSize: typography.size.bodySm,
              fontWeight: 600,
            }}
          >
            {p.label}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section: Tiles (jamo)
// ---------------------------------------------------------------------------

function SectionTiles(): JSX.Element {
  const tiles: Array<{ state: string; bg: string; border: string; fg: string }> = [
    { state: 'idle', bg: colors.surface.paper, border: colors.border.subtle, fg: colors.text.primary },
    { state: 'correct', bg: colors.feedback.successLight, border: colors.feedback.success, fg: colors.feedback.success },
    { state: 'wrong', bg: colors.feedback.nudgeLight, border: colors.feedback.nudge, fg: '#B5862A' },
    { state: 'disabled', bg: colors.surface.sunken, border: colors.border.subtle, fg: colors.text.muted },
  ];
  const jamo: Array<[string, string]> = [
    ['ㄱ', 'g/k'],
    ['ㄴ', 'n'],
    ['ㄷ', 'd/t'],
    ['ㄹ', 'r/l'],
  ];
  return (
    <Section>
      <SectionTitle
        id="tiles"
        title="Tiles (minigame primitive)"
        subtitle="4 states. Wrong = amber `nudge`, never red — the anti-shame contract."
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
        {tiles.map((t) => (
          <div key={t.state} style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            <div
              style={{
                width: 120,
                fontFamily: typography.family.mono,
                fontSize: typography.size.caption,
                color: colors.text.muted,
              }}
            >
              {t.state}
            </div>
            <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
              {jamo.map(([char, rom]) => (
                <div
                  key={`${t.state}-${char}`}
                  style={{
                    width: touchTarget.child,
                    height: touchTarget.child,
                    backgroundColor: t.bg,
                    border: `2px solid ${t.border}`,
                    borderRadius: radii.lg,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: t.state === 'idle' ? '0 2px 8px rgba(42, 31, 20, 0.06)' : 'none',
                  }}
                >
                  <div style={{ fontSize: typography.size.display, fontWeight: 700, color: t.fg, lineHeight: 1.05 }}>
                    {char}
                  </div>
                  <div style={{ fontSize: typography.size.caption, color: colors.text.muted, fontWeight: 500 }}>
                    {rom}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section: Hoya (inline SVG mirroring packages/design-system Hoya.tsx)
// ---------------------------------------------------------------------------

function HoyaSvg({ pose, size = 96 }: { pose: 'idle' | 'cheering' | 'thinking' | 'reading' | 'waving'; size?: number }): JSX.Element {
  // Mirrors packages/design-system/src/components/Hoya/Hoya.tsx — geometric placeholder.
  // When real Hoya art ships from design/characters/hoya/v1/, this preview will be
  // updated alongside the RN component in one PR.
  const eye = pose === 'cheering' ? { y: 70, rx: 4, ry: 2 } : pose === 'thinking' ? { y: 70, rx: 3, ry: 5 } : { y: 72, rx: 3.5, ry: 4 };
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-label={`Hoya ${pose}`}>
      <ellipse cx={64} cy={104} rx={42} ry={20} fill={colors.hoya.furDark} opacity={0.18} />
      {pose === 'cheering' ? (
        <>
          <path d="M22 80 L8 50" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" />
          <path d="M98 80 L112 50" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" />
          <circle cx={8} cy={50} r={6} fill={colors.hoya.fur} />
          <circle cx={112} cy={50} r={6} fill={colors.hoya.fur} />
        </>
      ) : null}
      {pose === 'waving' ? (
        <>
          <path d="M98 78 L120 56" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" />
          <circle cx={120} cy={56} r={7} fill={colors.hoya.fur} />
        </>
      ) : null}
      <circle cx={64} cy={64} r={44} fill={colors.hoya.fur} />
      <circle cx={30} cy={32} r={12} fill={colors.hoya.fur} />
      <circle cx={98} cy={32} r={12} fill={colors.hoya.fur} />
      <circle cx={30} cy={32} r={6} fill={colors.hoya.cheek} />
      <circle cx={98} cy={32} r={6} fill={colors.hoya.cheek} />
      <ellipse cx={64} cy={84} rx={26} ry={16} fill={colors.hoya.belly} />
      <ellipse cx={50} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={colors.hoya.stripes} />
      <ellipse cx={78} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={colors.hoya.stripes} />
      <circle cx={42} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.7} />
      <circle cx={86} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.7} />
      <path d="M58 84 H70 L64 90 Z" fill={colors.hoya.nose} />
      {pose === 'cheering' ? (
        <path d="M44 92 Q60 108 76 92" stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none" />
      ) : (
        <path d="M50 92 Q60 100 70 92" stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}

function SectionHoyaPlaceholder(): JSX.Element {
  const poses: Array<'idle' | 'cheering' | 'thinking' | 'reading' | 'waving'> = [
    'idle',
    'cheering',
    'thinking',
    'reading',
    'waving',
  ];
  return (
    <Section>
      <SectionTitle
        id="hoya"
        title="Hoya (placeholder)"
        subtitle="Geometric SVG placeholder — replaced by design/characters/hoya/v1/ outputs per the character sheet brief."
      />
      <div style={{ display: 'flex', gap: spacing.xl, flexWrap: 'wrap' }}>
        {poses.map((p) => (
          <div key={p} style={{ textAlign: 'center' }}>
            <div
              style={{
                backgroundColor: colors.surface.paper,
                borderRadius: radii.lg,
                border: `1px solid ${colors.border.subtle}`,
                padding: spacing.md,
              }}
            >
              <HoyaSvg pose={p} size={120} />
            </div>
            <div
              style={{
                marginTop: spacing.sm,
                fontFamily: typography.family.mono,
                fontSize: typography.size.caption,
                color: colors.text.muted,
              }}
            >
              {p}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer(): JSX.Element {
  return (
    <footer
      style={{
        marginTop: spacing.jumbo,
        paddingTop: spacing.lg,
        borderTop: `1px solid ${colors.border.subtle}`,
        color: colors.text.muted,
        fontSize: typography.size.caption,
      }}
    >
      <p style={{ margin: 0 }}>
        Tokens authored in <code style={{ fontFamily: typography.family.mono }}>design/tokens/*.v1.md</code> ·
        promoted to <code style={{ fontFamily: typography.family.mono }}>packages/design-system/src/tokens.ts</code> ·
        consumed everywhere. Drift detected by{' '}
        <code style={{ fontFamily: typography.family.mono }}>.github/workflows/design-token-sync.yml</code>.
      </p>
      <p style={{ marginTop: spacing.sm }}>
        Briefs for visual identity, character, illustrations, components, and screens live in{' '}
        <code style={{ fontFamily: typography.family.mono }}>design/brief/</code>. Run
        them through Claude Design and save outputs to{' '}
        <code style={{ fontFamily: typography.family.mono }}>design/screens/</code>,{' '}
        <code style={{ fontFamily: typography.family.mono }}>design/characters/</code>, and{' '}
        <code style={{ fontFamily: typography.family.mono }}>design/illustrations/</code>.
      </p>
    </footer>
  );
}
