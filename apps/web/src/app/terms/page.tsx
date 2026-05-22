import { colors, radii, spacing, typography } from '@hangul-route/design-system/tokens';
import Link from 'next/link';

const EFFECTIVE_DATE = 'May 22, 2026';

interface Section {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

const sections: Section[] = [
  {
    heading: 'Accepting these terms',
    paragraphs: [
      'By using Hangul Route, you agree to these Terms of Service. If you do not agree, please do not use the app. Because the app is for children, the parent or legal guardian who sets up the account accepts these terms on the family’s behalf.',
    ],
  },
  {
    heading: 'Accounts and parental responsibility',
    paragraphs: [
      'A parent or legal guardian creates and supervises the account, keeps sign-in details secure, and is responsible for activity under it. A child may use the app under that supervision. Account changes, purchases, and other sensitive actions sit behind a parent-gate.',
    ],
  },
  {
    heading: 'Subscriptions, billing, and cancellation',
    bullets: [
      'Premium content is offered as an auto-renewing subscription billed through the Apple App Store or Google Play.',
      'Your subscription renews automatically unless you cancel at least 24 hours before the end of the current period.',
      'Manage or cancel anytime in your App Store or Google Play account settings.',
      'Refunds are handled by the store under its policy. A free trial, if offered, converts to a paid subscription unless cancelled before it ends.',
    ],
  },
  {
    heading: 'Acceptable use',
    bullets: [
      'Use the app for personal, non-commercial learning.',
      'Do not copy, resell, reverse-engineer, or redistribute the content or software.',
      'Do not attempt to disrupt the service or access other families’ data.',
    ],
  },
  {
    heading: 'Our content and your data',
    paragraphs: [
      'Hangul Route, including Hoya, the curriculum, illustrations, audio, and heritage cards, is owned by us or our licensors and protected by intellectual-property law. Your child’s learning data belongs to your family; you may export or delete it as described in our Privacy Policy.',
    ],
  },
  {
    heading: 'Educational disclaimer',
    paragraphs: [
      'Hangul Route is a supplementary learning tool, not a certified curriculum or a guarantee of any specific learning outcome. It is provided “as is” without warranties of any kind, to the fullest extent permitted by law.',
    ],
  },
  {
    heading: 'Service availability',
    paragraphs: [
      'We work to keep the app available and improving, but we may update, suspend, or discontinue features. Core local learning is designed to work offline; cloud sync requires a connection.',
    ],
  },
  {
    heading: 'Limitation of liability',
    paragraphs: [
      'To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from use of the app. Nothing in these terms limits rights that cannot be limited by law, including consumer protections in your region.',
    ],
  },
  {
    heading: 'Ending your use',
    paragraphs: [
      'You may stop using the app and close your account at any time. We may suspend or end access if these terms are violated or if required by law.',
    ],
  },
  {
    heading: 'Governing law',
    paragraphs: [
      'These terms are governed by the laws of the jurisdiction stated at launch. The final governing-law and dispute-resolution clauses will be confirmed with legal counsel before public release.',
    ],
  },
  {
    heading: 'Changes to these terms',
    paragraphs: [
      'If we make material changes, we will notify parents in the app or by email before they take effect. The date below shows the current version.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: ['Questions about these terms? Email support@hangulroute.example.'],
  },
];

export default function TermsPage(): JSX.Element {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: `${spacing.xxl}px ${spacing.lg}px` }}>
      <Link href="/" style={{ color: colors.brand.primary, fontWeight: 600 }}>
        ← Back home
      </Link>
      <h1 style={{ fontSize: typography.size.display, marginTop: spacing.lg }}>Terms of Service</h1>
      <p style={{ color: colors.text.muted, fontSize: typography.size.caption }}>
        Effective {EFFECTIVE_DATE}
      </p>

      <div
        style={{
          marginTop: spacing.md,
          padding: spacing.md,
          backgroundColor: colors.feedback.infoLight,
          borderRadius: radii.md,
          color: colors.text.secondary,
          fontSize: typography.size.caption,
        }}
      >
        Draft for review. This document is a working draft pending review by qualified legal counsel
        before public launch.
      </div>

      {sections.map((section) => (
        <section key={section.heading} style={{ marginTop: spacing.xl }}>
          <h2 style={{ fontSize: typography.size.title }}>{section.heading}</h2>
          {section.paragraphs?.map((p, i) => (
            <p key={i} style={{ lineHeight: 1.7, color: colors.text.secondary }}>
              {p}
            </p>
          ))}
          {section.bullets ? (
            <ul style={{ lineHeight: 1.8, color: colors.text.secondary }}>
              {section.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <footer style={{ marginTop: spacing.jumbo, color: colors.text.muted, fontSize: typography.size.caption }}>
        <Link href="/privacy" style={{ color: colors.text.secondary, fontWeight: 600 }}>
          Privacy Policy
        </Link>{' '}
        · © {new Date().getFullYear()} Hangul Route
      </footer>
    </main>
  );
}
