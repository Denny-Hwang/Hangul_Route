import { colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';
import React from 'react';

/**
 * /design-preview/components — visual regression surface for every
 * design-system component × every variant. Used for manual visual diff
 * between PR Cloudflare Pages preview vs production.
 *
 * F-VR-001 spec. Token-only — no RN imports.
 */

export default function ComponentsPreviewPage(): JSX.Element {
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
          Components — every variant
        </h1>
        <p
          style={{
            fontSize: typography.size.body,
            color: colors.text.secondary,
            maxWidth: 720,
          }}
        >
          Visual regression surface (F-VR-001). Every design-system component × every variant on
          one page. Open this URL on the PR Cloudflare Pages preview, then again on production —
          scroll both side-by-side to catch visual changes.
        </p>
      </header>

      <ButtonSection />
      <CardSection />
      <TileSection />
      <PillSection />
      <ProgressSection />
      <StarRowSection />
      <TypographySection />

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
          HoyaBubble + Hoya 5-pose live on the main <Link href="/design-preview" style={{ color: colors.brand.primary }}>/design-preview</Link> page. Heritage Card art has its own
          page at <Link href="/design-preview/cards" style={{ color: colors.brand.primary }}>/design-preview/cards</Link>.
        </p>
      </footer>
    </main>
  );
}

function SectionWrapper({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section id={id} style={{ marginBottom: spacing.jumbo }}>
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
        {title}
      </h2>
      {children}
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        backgroundColor: colors.surface.paper,
        border: `1px solid ${colors.border.subtle}`,
        borderRadius: radii.md,
        padding: spacing.md,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
      <div
        style={{
          fontSize: typography.size.caption,
          color: colors.text.muted,
          fontFamily: typography.family.mono,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Grid({ children, cols = 6 }: { children: React.ReactNode; cols?: number }): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(140px, 1fr))`,
        gap: spacing.md,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button (5 tones × 4 sizes × 3 states)
// ---------------------------------------------------------------------------

function ButtonSection(): JSX.Element {
  const tones = ['primary', 'secondary', 'ghost', 'success', 'nudge'] as const;
  const sizes = ['sm', 'md', 'lg', 'hero'] as const;
  const states = ['default', 'pressed', 'disabled'] as const;
  return (
    <SectionWrapper id="button" title="Button — 5 tones × 4 sizes × 3 states (60 cells)">
      <Grid cols={6}>
        {tones.map((t) =>
          sizes.map((s) =>
            states.map((state) => (
              <Cell key={`${t}-${s}-${state}`} label={`${t} / ${s} / ${state}`}>
                <ButtonVariant tone={t} size={s} state={state} />
              </Cell>
            )),
          ),
        )}
      </Grid>
    </SectionWrapper>
  );
}

function ButtonVariant({
  tone,
  size,
  state,
}: {
  tone: 'primary' | 'secondary' | 'ghost' | 'success' | 'nudge';
  size: 'sm' | 'md' | 'lg' | 'hero';
  state: 'default' | 'pressed' | 'disabled';
}): JSX.Element {
  const bg: Record<string, string> = {
    primary: colors.brand.primary,
    secondary: colors.brand.secondary,
    ghost: 'transparent',
    success: colors.feedback.success,
    nudge: colors.feedback.nudge,
  };
  const pressedBg: Record<string, string> = {
    primary: colors.brand.primaryDark,
    secondary: colors.brand.secondaryDark,
    ghost: colors.brand.primaryLight,
    success: '#3F8A5C',
    nudge: '#D89B2B',
  };
  const fg: Record<string, string> = {
    primary: colors.text.onPrimary,
    secondary: colors.text.onSecondary,
    ghost: colors.brand.primary,
    success: colors.text.inverse,
    nudge: colors.text.primary,
  };
  const sizeH = { sm: touchTarget.min, md: touchTarget.min, lg: touchTarget.child, hero: touchTarget.hero };
  const sizeFs = { sm: typography.size.bodySm, md: typography.size.body, lg: typography.size.bodyLg, hero: typography.size.prompt };
  const sizePadX = { sm: spacing.lg, md: spacing.xl, lg: spacing.xl, hero: spacing.xxl };
  const fillColor = state === 'disabled' ? colors.surface.sunken : state === 'pressed' ? pressedBg[tone] : bg[tone];
  const labelColor = state === 'disabled' ? colors.text.muted : fg[tone];
  return (
    <button
      type="button"
      style={{
        minHeight: sizeH[size],
        paddingLeft: sizePadX[size],
        paddingRight: sizePadX[size],
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: fillColor,
        color: labelColor,
        border: tone === 'ghost' ? `2px solid ${colors.brand.primary}` : 'none',
        fontWeight: 600,
        fontSize: sizeFs[size],
        opacity: state === 'disabled' ? 0.6 : 1,
        transform: state === 'pressed' ? 'scale(0.98)' : 'none',
        cursor: state === 'disabled' ? 'not-allowed' : 'pointer',
      }}
    >
      Tap
    </button>
  );
}

// ---------------------------------------------------------------------------
// Card (5 tones × 3 elevations × 4 padding)
// ---------------------------------------------------------------------------

function CardSection(): JSX.Element {
  const tones: Array<{ key: string; fill: string }> = [
    { key: 'paper', fill: colors.surface.paper },
    { key: 'sunken', fill: colors.surface.sunken },
    { key: 'brand', fill: colors.brand.primaryLight },
    { key: 'success', fill: colors.feedback.successLight },
    { key: 'nudge', fill: colors.feedback.nudgeLight },
  ];
  const elevations: Array<[string, string]> = [
    ['flat', 'none'],
    ['card', '0 2px 8px rgba(42, 31, 20, 0.06)'],
    ['raised', '0 4px 16px rgba(42, 31, 20, 0.10)'],
  ];
  const paddings: Array<[string, number]> = [
    ['none', 0],
    ['sm', spacing.md],
    ['md', spacing.lg],
    ['lg', spacing.xl],
  ];
  return (
    <SectionWrapper id="card" title="Card — 5 tones × 3 elevations × 4 padding (60 cells)">
      <Grid cols={6}>
        {tones.map((t) =>
          elevations.map(([e, sh]) =>
            paddings.map(([p, px]) => (
              <Cell key={`${t.key}-${e}-${p}`} label={`${t.key} / ${e} / ${p}`}>
                <div
                  style={{
                    backgroundColor: t.fill,
                    borderRadius: radii.lg,
                    padding: px,
                    boxShadow: sh,
                    width: 100,
                    minHeight: 60,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.text.primary,
                    fontSize: typography.size.bodySm,
                  }}
                >
                  Card
                </div>
              </Cell>
            )),
          ),
        )}
      </Grid>
    </SectionWrapper>
  );
}

// ---------------------------------------------------------------------------
// Tile (4 states × 3 sizes × 4 jamo)
// ---------------------------------------------------------------------------

function TileSection(): JSX.Element {
  const states = ['idle', 'correct', 'wrong', 'disabled'] as const;
  const sizes = ['sm', 'md', 'lg'] as const;
  const jamo: Array<[string, string]> = [
    ['ㄱ', 'g/k'],
    ['ㄴ', 'n'],
    ['ㄷ', 'd/t'],
    ['ㄹ', 'r/l'],
  ];
  return (
    <SectionWrapper id="tile" title="Tile — 4 states × 3 sizes × 4 jamo (48 cells)">
      <Grid cols={6}>
        {states.map((st) =>
          sizes.map((sz) =>
            jamo.map(([char, rom]) => (
              <Cell key={`${st}-${sz}-${char}`} label={`${st} / ${sz} / ${char}`}>
                <TileVariant state={st} size={sz} char={char} rom={rom} />
              </Cell>
            )),
          ),
        )}
      </Grid>
    </SectionWrapper>
  );
}

function TileVariant({
  state,
  size,
  char,
  rom,
}: {
  state: 'idle' | 'correct' | 'wrong' | 'disabled';
  size: 'sm' | 'md' | 'lg';
  char: string;
  rom: string;
}): JSX.Element {
  const palette = {
    idle: { bg: colors.surface.paper, br: colors.border.subtle, fg: colors.text.primary },
    correct: { bg: colors.feedback.successLight, br: colors.feedback.success, fg: colors.feedback.success },
    wrong: { bg: colors.feedback.nudgeLight, br: colors.feedback.nudge, fg: '#B5862A' },
    disabled: { bg: colors.surface.sunken, br: colors.border.subtle, fg: colors.text.muted },
  }[state];
  const dim = { sm: touchTarget.min, md: touchTarget.child, lg: touchTarget.hero }[size];
  const fontSize = { sm: typography.size.title, md: typography.size.display, lg: typography.size.hero }[size];
  return (
    <div
      style={{
        width: dim,
        height: dim,
        backgroundColor: palette.bg,
        border: `2px solid ${palette.br}`,
        borderRadius: radii.lg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: state === 'idle' ? '0 2px 8px rgba(42, 31, 20, 0.06)' : 'none',
      }}
    >
      <div style={{ fontSize, fontWeight: 700, color: palette.fg, lineHeight: 1.05 }}>{char}</div>
      <div style={{ fontSize: typography.size.caption, color: colors.text.muted }}>{rom}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pill (6 tones × 2 sizes)
// ---------------------------------------------------------------------------

function PillSection(): JSX.Element {
  const tones: Array<{ key: string; bg: string; fg: string; label: string }> = [
    { key: 'neutral', bg: colors.surface.sunken, fg: colors.text.secondary, label: 'Age 5-7' },
    { key: 'primary', bg: colors.brand.primaryLight, fg: colors.brand.primaryDark, label: 'Hangul' },
    { key: 'secondary', bg: colors.brand.secondaryLight, fg: colors.brand.secondaryDark, label: 'Letters' },
    { key: 'success', bg: colors.feedback.successLight, fg: '#2F6A47', label: 'Open' },
    { key: 'nudge', bg: colors.feedback.nudgeLight, fg: '#B5862A', label: 'rare' },
    { key: 'info', bg: colors.feedback.infoLight, fg: '#2E5BC7', label: 'card' },
  ];
  const sizes: Array<['sm' | 'md', number, number, number]> = [
    ['sm', spacing.sm, spacing.xxs, typography.size.caption],
    ['md', spacing.md, spacing.xs, typography.size.bodySm],
  ];
  return (
    <SectionWrapper id="pill" title="Pill — 6 tones × 2 sizes (12 cells)">
      <Grid cols={6}>
        {tones.map((t) =>
          sizes.map(([s, px, py, fs]) => (
            <Cell key={`${t.key}-${s}`} label={`${t.key} / ${s}`}>
              <div
                style={{
                  paddingLeft: px,
                  paddingRight: px,
                  paddingTop: py,
                  paddingBottom: py,
                  backgroundColor: t.bg,
                  color: t.fg,
                  borderRadius: radii.pill,
                  fontSize: fs,
                  fontWeight: 600,
                }}
              >
                {t.label}
              </div>
            </Cell>
          )),
        )}
      </Grid>
    </SectionWrapper>
  );
}

// ---------------------------------------------------------------------------
// Progress (bar / dots × 3 tones × 4 levels)
// ---------------------------------------------------------------------------

function ProgressSection(): JSX.Element {
  const toneMap: Record<string, string> = {
    primary: colors.brand.primary,
    secondary: colors.brand.secondary,
    success: colors.feedback.success,
  };
  const tones: Array<'primary' | 'secondary' | 'success'> = ['primary', 'secondary', 'success'];
  const levels = [25, 50, 75, 100];
  return (
    <SectionWrapper id="progress" title="Progress — bar / dots × 3 tones × 4 levels">
      <Grid cols={4}>
        {tones.flatMap((t) =>
          levels.map((pct) => (
            <Cell key={`bar-${t}-${pct}`} label={`bar / ${t} / ${pct}%`}>
              <div style={{ width: '90%' }}>
                <div
                  style={{
                    height: 12,
                    borderRadius: radii.pill,
                    backgroundColor: colors.surface.sunken,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      backgroundColor: toneMap[t],
                      borderRadius: radii.pill,
                    }}
                  />
                </div>
              </div>
            </Cell>
          )),
        )}
      </Grid>
      <div style={{ marginTop: spacing.lg }}>
        <Grid cols={3}>
          {tones.map((t) =>
            [1, 3, 5].map((filled) => (
              <Cell key={`dots-${t}-${filled}`} label={`dots / ${t} / ${filled}/5`}>
                <div style={{ display: 'flex', gap: spacing.sm }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: radii.circle,
                        backgroundColor: i < filled ? toneMap[t] : colors.surface.sunken,
                      }}
                    />
                  ))}
                </div>
              </Cell>
            )),
          )}
        </Grid>
      </div>
    </SectionWrapper>
  );
}

// ---------------------------------------------------------------------------
// StarRow (4 tiers × 4 sizes)
// ---------------------------------------------------------------------------

function StarRowSection(): JSX.Element {
  const tiers = [0, 1, 2, 3] as const;
  const sizes = [18, 28, 32, 48];
  const starPath = 'M12 2 L14.94 8.26 L22 9.27 L17 14.14 L18.18 21 L12 17.77 L5.82 21 L7 14.14 L2 9.27 L9.06 8.26 Z';
  return (
    <SectionWrapper id="star-row" title="StarRow — 4 tiers × 4 sizes (16 cells)">
      <Grid cols={4}>
        {tiers.map((tier) =>
          sizes.map((sz) => (
            <Cell key={`${tier}-${sz}`} label={`${tier}★ / ${sz}px`}>
              <div style={{ display: 'flex', gap: spacing.sm }}>
                {[0, 1, 2].map((i) => {
                  const filled = i < tier;
                  return (
                    <svg key={i} width={sz} height={sz} viewBox="0 0 24 24">
                      <path
                        d={starPath}
                        fill={filled ? colors.feedback.nudge : colors.surface.sunken}
                        stroke={filled ? '#B5862A' : colors.border.strong}
                        strokeWidth={1.2}
                      />
                    </svg>
                  );
                })}
              </div>
            </Cell>
          )),
        )}
      </Grid>
    </SectionWrapper>
  );
}

// ---------------------------------------------------------------------------
// Typography (all sizes × English + Korean)
// ---------------------------------------------------------------------------

function TypographySection(): JSX.Element {
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
    <SectionWrapper id="typography" title="Typography — 8 sizes × English + Korean">
      <div
        style={{
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
              {name} · {size}sp
            </div>
            <div style={{ fontSize: size, color: colors.text.primary, fontWeight: 700 }}>
              Today&apos;s quest
            </div>
            <div style={{ fontSize: size, color: colors.brand.primary, fontWeight: 700 }}>
              오늘의 학습
            </div>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
