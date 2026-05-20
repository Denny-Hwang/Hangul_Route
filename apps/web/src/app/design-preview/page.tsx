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
      <SectionHeritageCards />
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

type HoyaPose = 'idle' | 'cheering' | 'thinking' | 'reading' | 'waving';

function eyeFor(pose: HoyaPose): { leftCx: number; rightCx: number; y: number; rx: number; ry: number } {
  switch (pose) {
    case 'cheering':
      return { leftCx: 50, rightCx: 78, y: 70, rx: 4, ry: 1.6 };
    case 'thinking':
      return { leftCx: 51, rightCx: 79, y: 68, rx: 3, ry: 4.5 };
    case 'reading':
      return { leftCx: 50, rightCx: 78, y: 76, rx: 3, ry: 3.5 };
    default:
      return { leftCx: 50, rightCx: 78, y: 72, rx: 3.5, ry: 4 };
  }
}

function HoyaSvg({ pose, size = 96 }: { pose: HoyaPose; size?: number }): JSX.Element {
  // Mirrors packages/design-system/src/components/Hoya/Hoya.tsx exactly.
  // Refined per design/brief/character/hoya-character-sheet.md.
  // When real Hoya art ships from design/characters/hoya/v1/, this preview will
  // be updated alongside the RN component in one PR.
  const eye = eyeFor(pose);
  const showCheeks = pose === 'idle' || pose === 'cheering' || pose === 'waving';
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-label={`Hoya ${pose}`}>
      {/* Foot shadow */}
      <ellipse cx={64} cy={116} rx={38} ry={5} fill={colors.hoya.furDark} opacity={0.18} />

      {/* Arms / paws — pose-specific */}
      {pose === 'cheering' ? (
        <g>
          <path d="M22 78 Q14 60 8 46" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill="none" />
          <path d="M106 78 Q114 60 120 46" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill="none" />
          <circle cx={8} cy={46} r={7} fill={colors.hoya.fur} />
          <circle cx={120} cy={46} r={7} fill={colors.hoya.fur} />
        </g>
      ) : null}
      {pose === 'waving' ? (
        <g>
          <path d="M104 76 Q116 64 122 54" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill="none" />
          <circle cx={122} cy={54} r={7} fill={colors.hoya.fur} />
        </g>
      ) : null}
      {pose === 'reading' ? (
        <g>
          <circle cx={42} cy={102} r={6} fill={colors.hoya.fur} />
          <circle cx={86} cy={102} r={6} fill={colors.hoya.fur} />
        </g>
      ) : null}

      {/* Head */}
      <circle cx={64} cy={64} r={44} fill={colors.hoya.fur} />

      {/* Ears */}
      <circle cx={30} cy={32} r={12} fill={colors.hoya.fur} />
      <circle cx={98} cy={32} r={12} fill={colors.hoya.fur} />
      <circle cx={30} cy={32} r={6} fill={colors.hoya.cheek} opacity={0.85} />
      <circle cx={98} cy={32} r={6} fill={colors.hoya.cheek} opacity={0.85} />

      {/* Stripes — 3 per side + forehead */}
      <g stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none">
        <path d="M26 54 Q30 58 26 62" />
        <path d="M24 70 Q29 73 25 78" />
        <path d="M28 84 Q33 86 30 90" />
        <path d="M102 54 Q98 58 102 62" />
        <path d="M104 70 Q99 73 103 78" />
        <path d="M100 84 Q95 86 98 90" />
        <path d="M64 24 Q66 30 64 36" />
      </g>

      {/* Belly */}
      <ellipse cx={64} cy={84} rx={26} ry={16} fill={colors.hoya.belly} />

      {/* Eyes */}
      <ellipse cx={eye.leftCx} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={colors.hoya.stripes} />
      <ellipse cx={eye.rightCx} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={colors.hoya.stripes} />

      {/* Eye glints — open eyes only */}
      {pose !== 'cheering' ? (
        <g fill={colors.surface.paper}>
          <circle cx={eye.leftCx + 1.2} cy={eye.y - 1.3} r={0.9} />
          <circle cx={eye.rightCx + 1.2} cy={eye.y - 1.3} r={0.9} />
        </g>
      ) : null}

      {/* Cheek blush — pose-conditional */}
      {showCheeks ? (
        <g>
          <circle cx={42} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.6} />
          <circle cx={86} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.6} />
        </g>
      ) : null}

      {/* Nose */}
      <path d="M58 84 H70 L64 90 Z" fill={colors.hoya.nose} />

      {/* Mouth — pose-specific */}
      {pose === 'cheering' ? (
        <path
          d="M44 92 Q60 110 76 92 Q60 100 44 92 Z"
          fill={colors.hoya.cheek}
          stroke={colors.hoya.stripes}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : pose === 'thinking' ? (
        <path d="M53 96 Q60 92 67 96" stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none" />
      ) : pose === 'reading' ? (
        <line x1={56} y1={95} x2={64} y2={95} stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" />
      ) : pose === 'waving' ? (
        <path d="M48 92 Q60 104 72 92" stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none" />
      ) : (
        <path d="M50 92 Q60 100 70 92" stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none" />
      )}

      {/* Thinking — thought cloud + 2 bubble dots leading up-right */}
      {pose === 'thinking' ? (
        <g>
          <circle cx={100} cy={26} r={2.5} fill={colors.surface.paper} stroke={colors.brand.secondary} strokeWidth={1.2} />
          <circle cx={106} cy={18} r={3.5} fill={colors.surface.paper} stroke={colors.brand.secondary} strokeWidth={1.2} />
          <rect
            x={108}
            y={2}
            width={18}
            height={12}
            rx={6}
            ry={6}
            fill={colors.surface.paper}
            stroke={colors.brand.secondary}
            strokeWidth={1.5}
          />
        </g>
      ) : null}

      {/* Cheering — 4-point pinwheel sparkles at top corners */}
      {pose === 'cheering' ? (
        <g fill={colors.feedback.nudge} opacity={0.85}>
          {/* Left sparkle at (20, 22) */}
          <path d="M20 16 L22 22 L20 28 L18 22 Z" />
          <path d="M14 22 L20 20 L26 22 L20 24 Z" />
          {/* Right sparkle at (108, 22) */}
          <path d="M108 16 L110 22 L108 28 L106 22 Z" />
          <path d="M102 22 L108 20 L114 22 L108 24 Z" />
        </g>
      ) : null}

      {/* Reading — book held below */}
      {pose === 'reading' ? (
        <g>
          <rect x={36} y={98} width={56} height={20} rx={3} ry={3} fill={colors.hoya.furDark} opacity={0.2} />
          <rect
            x={36}
            y={94}
            width={56}
            height={22}
            rx={3}
            ry={3}
            fill={colors.surface.paper}
            stroke={colors.text.secondary}
            strokeWidth={1.5}
          />
          <line x1={64} y1={94} x2={64} y2={116} stroke={colors.text.secondary} strokeWidth={1} />
          <path d="M44 102 Q48 100 52 104" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" fill="none" />
          <path d="M46 110 H54" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
          <path d="M72 102 Q76 100 80 104" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" fill="none" />
          <path d="M74 110 H82" stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
        </g>
      ) : null}
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
// Section: Heritage Card Art (inline SVG mirror of 6 illustrated cards)
// ---------------------------------------------------------------------------

interface CardArtCellSpec {
  cardId: string;
  ko: string;
  romanization: string;
  titleEn: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

const CARD_ART_CELLS: CardArtCellSpec[] = [
  { cardId: 'card:tiger', ko: '호랑이', romanization: 'horangi', titleEn: 'Tiger', rarity: 'legendary' },
  { cardId: 'card:book', ko: '책', romanization: 'chaek', titleEn: 'Book', rarity: 'common' },
  { cardId: 'card:kimchi', ko: '김치', romanization: 'gimchi', titleEn: 'Kimchi', rarity: 'common' },
  { cardId: 'card:seollal', ko: '설날', romanization: 'seollal', titleEn: 'Lunar New Year', rarity: 'rare' },
  { cardId: 'card:mountain', ko: '산', romanization: 'san', titleEn: 'Mountain', rarity: 'common' },
  { cardId: 'card:yutnori', ko: '윷놀이', romanization: 'yutnori', titleEn: 'Yut Game', rarity: 'rare' },
];

function HeritageCardArtSvg({ cardId, size = 200 }: { cardId: string; size?: number }): JSX.Element {
  // Mirrors packages/design-system/src/components/HeritageCardArt/HeritageCardArt.tsx.
  // Both files share identical SVG shapes so /design-preview is an honest
  // representation of what apps/mobile renders.
  switch (cardId) {
    case 'card:tiger':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" aria-label="Tiger card art">
          <rect x={0} y={0} width={200} height={200} fill={colors.theme.nature} opacity={0.08} rx={8} />
          <g fill={colors.feedback.nudge} opacity={0.9}>
            <path d="M70 30 L74 40 L70 50 L66 40 Z" />
            <path d="M60 40 L70 36 L80 40 L70 44 Z" />
            <path d="M100 16 L104 28 L100 40 L96 28 Z" />
            <path d="M88 28 L100 24 L112 28 L100 32 Z" />
            <path d="M130 30 L134 40 L130 50 L126 40 Z" />
            <path d="M120 40 L130 36 L140 40 L130 44 Z" />
          </g>
          <g transform="translate(36 55)">
            <ellipse cx={64} cy={116} rx={38} ry={5} fill={colors.hoya.furDark} opacity={0.18} />
            <path d="M22 78 Q14 60 8 46" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill="none" />
            <path d="M106 78 Q114 60 120 46" stroke={colors.hoya.fur} strokeWidth={10} strokeLinecap="round" fill="none" />
            <circle cx={8} cy={46} r={7} fill={colors.hoya.fur} />
            <circle cx={120} cy={46} r={7} fill={colors.hoya.fur} />
            <circle cx={64} cy={64} r={44} fill={colors.hoya.fur} />
            <circle cx={30} cy={32} r={12} fill={colors.hoya.fur} />
            <circle cx={98} cy={32} r={12} fill={colors.hoya.fur} />
            <circle cx={30} cy={32} r={6} fill={colors.hoya.cheek} opacity={0.85} />
            <circle cx={98} cy={32} r={6} fill={colors.hoya.cheek} opacity={0.85} />
            <g stroke={colors.hoya.stripes} strokeWidth={3} strokeLinecap="round" fill="none">
              <path d="M26 54 Q30 58 26 62" />
              <path d="M24 70 Q29 73 25 78" />
              <path d="M102 54 Q98 58 102 62" />
              <path d="M104 70 Q99 73 103 78" />
              <path d="M64 24 Q66 30 64 36" />
            </g>
            <ellipse cx={64} cy={84} rx={26} ry={16} fill={colors.hoya.belly} />
            <ellipse cx={50} cy={70} rx={4} ry={1.6} fill={colors.hoya.stripes} />
            <ellipse cx={78} cy={70} rx={4} ry={1.6} fill={colors.hoya.stripes} />
            <circle cx={42} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.6} />
            <circle cx={86} cy={84} r={5} fill={colors.hoya.cheek} opacity={0.6} />
            <path d="M58 84 H70 L64 90 Z" fill={colors.hoya.nose} />
            <path
              d="M44 92 Q60 110 76 92 Q60 100 44 92 Z"
              fill={colors.hoya.cheek}
              stroke={colors.hoya.stripes}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      );
    case 'card:book':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" aria-label="Book card art">
          <rect x={0} y={0} width={200} height={200} fill={colors.theme.letters} opacity={0.08} rx={8} />
          <ellipse cx={100} cy={155} rx={75} ry={6} fill={colors.hoya.furDark} opacity={0.2} />
          <path
            d="M40 60 Q100 50 160 60 L160 150 Q100 140 40 150 Z"
            fill={colors.surface.paper}
            stroke={colors.text.secondary}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <path d="M100 55 V145" stroke={colors.text.secondary} strokeWidth={2} />
          <path d="M52 80 Q62 76 72 84" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <path d="M55 100 H82" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" />
          <path d="M55 120 Q65 116 78 122" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <path d="M118 80 Q128 76 142 84" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <path d="M120 100 H148" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" />
          <path d="M118 120 Q130 116 144 122" stroke={colors.text.primary} strokeWidth={3.5} strokeLinecap="round" fill="none" />
        </svg>
      );
    case 'card:kimchi':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" aria-label="Kimchi card art">
          <rect x={0} y={0} width={200} height={200} fill={colors.theme.life} opacity={0.08} rx={8} />
          <path
            d="M50 90 Q60 70 80 70 Q100 60 120 70 Q140 70 150 90 Q150 110 100 110 Q50 110 50 90 Z"
            fill={colors.brand.primary}
            stroke={colors.brand.primaryDark}
            strokeWidth={2.5}
          />
          <path
            d="M60 95 Q75 80 100 80 Q125 80 140 95 Q140 110 100 112 Q60 110 60 95 Z"
            fill={colors.feedback.nudge}
            opacity={0.95}
            stroke={colors.brand.primaryDark}
            strokeWidth={2}
          />
          <path
            d="M75 100 Q85 92 100 92 Q115 92 125 100 Q120 108 100 110 Q80 108 75 100 Z"
            fill={colors.brand.primaryLight}
            opacity={0.9}
            stroke={colors.brand.primaryDark}
            strokeWidth={1.5}
          />
          <path
            d="M40 110 Q40 150 100 158 Q160 150 160 110 Z"
            fill={colors.surface.paper}
            stroke={colors.text.secondary}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <path d="M40 110 Q100 120 160 110" fill="none" stroke={colors.text.secondary} strokeWidth={2} />
          <ellipse cx={100} cy={165} rx={50} ry={4} fill={colors.hoya.furDark} opacity={0.18} />
        </svg>
      );
    case 'card:seollal':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" aria-label="Seollal card art">
          <rect x={0} y={0} width={200} height={200} fill={colors.theme.rites} opacity={0.08} rx={8} />
          <rect x={20} y={20} width={160} height={60} fill={colors.surface.paper} stroke={colors.text.secondary} strokeWidth={2} rx={4} />
          <line x1={60} y1={20} x2={60} y2={80} stroke={colors.text.secondary} strokeWidth={2} />
          <line x1={100} y1={20} x2={100} y2={80} stroke={colors.text.secondary} strokeWidth={2} />
          <line x1={140} y1={20} x2={140} y2={80} stroke={colors.text.secondary} strokeWidth={2} />
          <rect x={20} y={150} width={160} height={6} fill={colors.theme.life} opacity={0.4} rx={2} />
          <g>
            <path d="M60 120 Q56 140 50 152 H92 Q86 140 82 120 Z" fill={colors.theme.rites} />
            <path d="M58 100 Q70 95 82 100 L82 122 Q70 118 60 122 Z" fill={colors.brand.primary} stroke={colors.brand.primaryDark} strokeWidth={1.5} />
            <circle cx={70} cy={92} r={12} fill={colors.hoya.belly} stroke={colors.text.secondary} strokeWidth={1.5} />
            <line x1={64} y1={92} x2={68} y2={92} stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
            <line x1={72} y1={92} x2={76} y2={92} stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
            <path d="M66 96 Q70 98 74 96" stroke={colors.text.primary} strokeWidth={1.5} strokeLinecap="round" fill="none" />
          </g>
          <g>
            <path d="M125 130 Q121 140 117 150 H143 Q139 140 135 130 Z" fill={colors.brand.secondary} />
            <path d="M123 115 Q130 112 137 115 L137 132 Q130 128 123 132 Z" fill={colors.feedback.nudge} stroke={colors.brand.primaryDark} strokeWidth={1.5} />
            <circle cx={130} cy={108} r={10} fill={colors.hoya.belly} stroke={colors.text.secondary} strokeWidth={1.5} />
            <line x1={126} y1={108} x2={128} y2={108} stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
            <line x1={132} y1={108} x2={134} y2={108} stroke={colors.text.primary} strokeWidth={2} strokeLinecap="round" />
            <path d="M127 112 Q130 114 133 112" stroke={colors.text.primary} strokeWidth={1.5} strokeLinecap="round" fill="none" />
          </g>
        </svg>
      );
    case 'card:mountain':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" aria-label="Mountain card art">
          <rect x={0} y={0} width={200} height={200} fill={colors.theme.nature} opacity={0.08} rx={8} />
          <circle cx={120} cy={70} r={26} fill={colors.feedback.nudge} opacity={0.7} />
          <polygon points="40,150 90,60 140,150" fill={colors.theme.nature} opacity={0.4} stroke={colors.theme.nature} strokeWidth={2} strokeLinejoin="round" />
          <polygon points="60,160 110,80 165,160" fill={colors.theme.nature} opacity={0.7} stroke={colors.theme.nature} strokeWidth={2} strokeLinejoin="round" />
          <polygon points="20,170 75,100 130,170" fill={colors.theme.nature} stroke={colors.brand.primaryDark} strokeWidth={2} strokeLinejoin="round" />
          <path d="M70 110 L75 100 L82 112 L78 108 Z" fill={colors.surface.paper} opacity={0.9} />
          <path d="M105 90 L110 80 L116 92 L112 88 Z" fill={colors.surface.paper} opacity={0.9} />
          <rect x={0} y={170} width={200} height={30} fill={colors.theme.life} opacity={0.3} />
        </svg>
      );
    case 'card:yutnori':
      return (
        <svg width={size} height={size} viewBox="0 0 200 200" aria-label="Yutnori card art">
          <rect x={0} y={0} width={200} height={200} fill={colors.theme.crafts} opacity={0.08} rx={8} />
          <ellipse cx={100} cy={170} rx={70} ry={6} fill={colors.hoya.furDark} opacity={0.15} />
          <g transform="rotate(-15 60 80)">
            <rect x={28} y={73} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={6} />
            <path d="M40 77 Q60 75 80 77" stroke={colors.text.muted} strokeWidth={1.5} fill="none" />
          </g>
          <g transform="rotate(20 140 80)">
            <rect x={108} y={73} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={3} />
            <circle cx={140} cy={80} r={4} fill={colors.brand.primary} />
          </g>
          <g transform="rotate(10 70 130)">
            <rect x={38} y={123} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={6} />
            <path d="M50 127 Q70 125 90 127" stroke={colors.text.muted} strokeWidth={1.5} fill="none" />
          </g>
          <g transform="rotate(-25 130 135)">
            <rect x={98} y={128} width={64} height={14} fill={colors.surface.canvas} stroke={colors.text.secondary} strokeWidth={2} rx={6} />
            <path d="M110 132 Q130 130 150 132" stroke={colors.text.muted} strokeWidth={1.5} fill="none" />
          </g>
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 200 200">
          <rect x={0} y={0} width={200} height={200} fill={colors.surface.sunken} rx={8} />
        </svg>
      );
  }
}

function SectionHeritageCards(): JSX.Element {
  const rarityBg: Record<string, { bg: string; fg: string }> = {
    common: { bg: colors.surface.sunken, fg: colors.text.secondary },
    uncommon: { bg: colors.feedback.successLight, fg: '#2F6A47' },
    rare: { bg: colors.feedback.infoLight, fg: '#2E5BC7' },
    legendary: { bg: colors.feedback.nudgeLight, fg: '#B5862A' },
  };
  return (
    <Section>
      <SectionTitle
        id="heritage-cards"
        title="Heritage Card art (6 sample of 30 implemented)"
        subtitle="All 30 Stage 1 cards ship with SVG illustrations in the mobile app's Library tab. The 6 below are the original samples kept inline for quick review here; the remaining 24 (hanji / brush / ink / origami / hangul-day · rice / chopsticks / hanbok / kimbap / family-table · chuseok / tteokguk / songpyeon / sebae / lantern · magpie / mugunghwa / sea / moon · jegi / kite / top / pottery / gayageum) are visible in the mobile app and in apps/mobile/src/screens/library/LibraryScreen.tsx via @hangul-route/design-system."
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: spacing.lg,
        }}
      >
        {CARD_ART_CELLS.map((c) => {
          const { bg, fg } = rarityBg[c.rarity] ?? rarityBg.common!;
          return (
            <div
              key={c.cardId}
              style={{
                backgroundColor: colors.surface.paper,
                border: `4px solid ${colors.rarity[c.rarity]}`,
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
                  backgroundColor: bg,
                  color: fg,
                  borderRadius: radii.pill,
                  fontSize: typography.size.caption,
                  fontWeight: 600,
                  marginBottom: spacing.sm,
                }}
              >
                {c.rarity}
              </div>
              <HeritageCardArtSvg cardId={c.cardId} size={160} />
              <div
                style={{
                  marginTop: spacing.sm,
                  fontSize: typography.size.title,
                  fontWeight: 700,
                  color: colors.text.primary,
                }}
              >
                {c.ko}
              </div>
              <div
                style={{
                  fontSize: typography.size.caption,
                  color: colors.text.muted,
                  fontStyle: 'italic',
                }}
              >
                {c.romanization}
              </div>
              <div style={{ fontSize: typography.size.bodySm, color: colors.text.secondary }}>
                {c.titleEn}
              </div>
            </div>
          );
        })}
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
