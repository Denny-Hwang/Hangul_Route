import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';

export function MeetHoya(): JSX.Element {
  return (
    <section
      aria-labelledby="hoya-heading"
      style={{
        marginTop: spacing.jumbo,
        backgroundColor: colors.surface.sunken,
        borderRadius: radii.xxl,
        padding: spacing.xxl,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
        gap: spacing.xxl,
        alignItems: 'center',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          aspectRatio: '1 / 1',
          backgroundColor: colors.hoya.belly,
          borderRadius: radii.xxl,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `3px solid ${colors.hoya.fur}`,
        }}
      >
        <div
          style={{
            width: '78%',
            aspectRatio: '1 / 1',
            backgroundColor: colors.hoya.fur,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <span
            style={{
              fontSize: 120,
              lineHeight: 1,
            }}
          >
            🐯
          </span>
          <span
            style={{
              position: 'absolute',
              bottom: -spacing.md,
              right: -spacing.md,
              backgroundColor: colors.surface.paper,
              color: colors.text.primary,
              padding: `${spacing.xs}px ${spacing.md}px`,
              borderRadius: radii.pill,
              fontSize: typography.size.bodySm,
              fontWeight: typography.weight.semibold,
              boxShadow: '0 2px 8px rgba(42, 31, 20, 0.08)',
              border: `1px solid ${colors.border.subtle}`,
            }}
          >
            거의! · geo-eui · almost!
          </span>
        </div>
      </div>

      <div>
        <span
          style={{
            display: 'inline-block',
            padding: `${spacing.xs}px ${spacing.md}px`,
            backgroundColor: colors.brand.primary,
            color: colors.text.onPrimary,
            borderRadius: radii.pill,
            fontWeight: typography.weight.bold,
            fontSize: typography.size.caption,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          Meet Hoya
        </span>
        <h2
          id="hoya-heading"
          style={{
            fontSize: typography.size.display,
            margin: `${spacing.sm}px 0 ${spacing.md}px`,
            lineHeight: typography.leading.tight,
          }}
        >
          A tiger who never says &ldquo;wrong.&rdquo;
        </h2>
        <p
          style={{
            color: colors.text.secondary,
            fontSize: typography.size.bodyLg,
            margin: 0,
            lineHeight: typography.leading.relaxed,
          }}
        >
          Hoya is a young tiger and the only voice in the app. Korean folklore
          opens with &ldquo;Long ago, when tigers smoked tobacco…&rdquo; so the tiger is
          Korea&rsquo;s grandparent character. Hoya is a young one — so kids meet a
          peer, not an authority.
        </p>
        <ul
          style={{
            marginTop: spacing.lg,
            marginBottom: 0,
            paddingLeft: spacing.lg,
            color: colors.text.secondary,
            fontSize: typography.size.body,
            lineHeight: typography.leading.relaxed,
          }}
        >
          <li>
            <strong style={{ color: colors.text.primary }}>Wrong answer?</strong>{' '}
            Hoya says &ldquo;거의!&rdquo; (almost) on amber — never red.
          </li>
          <li>
            <strong style={{ color: colors.text.primary }}>Right answer?</strong>{' '}
            One star, one card, one quiet cheer. No coin sounds.
          </li>
          <li>
            <strong style={{ color: colors.text.primary }}>No streak shame.</strong>{' '}
            Skip a day. Hoya is happy to see you when you come back.
          </li>
        </ul>
      </div>
    </section>
  );
}
