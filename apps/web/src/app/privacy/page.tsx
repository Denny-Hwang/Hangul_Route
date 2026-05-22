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
    heading: 'The short version',
    paragraphs: [
      'Hangul Route is built for children ages 5–11. We collect as little as possible, never show ads, and never sell data. Most learning data stays on the device until a parent chooses to sign in. A parent is always in control.',
    ],
  },
  {
    heading: 'Who creates the account',
    paragraphs: [
      'Accounts are created and managed by a parent or legal guardian. A child uses the app, but a grown-up sets it up, enters any billing details, and confirms consent behind a parent-gate. We do not knowingly let a child under 13 create an account without verifiable parental consent.',
    ],
  },
  {
    heading: 'What we collect',
    bullets: [
      'Child profile: a display nickname and an age band (5–7 / 8–11). A real name is optional and only stored if a parent enters it.',
      'Learning progress: quests completed, stars earned, cards unlocked, streaks, and which jamo a child recognizes — so the journey can resume and a parent can see progress.',
      'Account contact: a parent email, used for sign-in, receipts, and account recovery.',
      'Basic device and diagnostic data: app version, device type, and crash logs, to keep the app stable.',
    ],
  },
  {
    heading: 'What we never collect',
    bullets: [
      'No advertising identifiers and no third-party ad tracking — ever.',
      'No precise location.',
      'No contacts, photos, or microphone audio leaves the device. Voice mini-games process speech on-device and discard it.',
      'No behavioral profiles sold or shared for marketing.',
    ],
  },
  {
    heading: "Children's privacy (COPPA / GDPR-K)",
    paragraphs: [
      'Hangul Route is designed to comply with the U.S. Children’s Online Privacy Protection Act (COPPA) and similar rules for minors. We practice data minimization, require verifiable parental consent before any personal data is linked to an account, and give parents the right to review or delete their child’s data at any time.',
    ],
  },
  {
    heading: 'Where your data lives',
    paragraphs: [
      'By default, learning data is stored locally on the device. If a parent signs in, progress syncs to our servers (Cloudflare) so it can be restored on a new device. Data in transit is encrypted (HTTPS), and at rest it is access-controlled.',
    ],
  },
  {
    heading: 'Payments and subscriptions',
    paragraphs: [
      'Subscriptions are billed through the Apple App Store or Google Play. We never see or store full card numbers — the store handles payment and gives us only the minimum needed to unlock the subscription on the account.',
    ],
  },
  {
    heading: 'Third-party services',
    bullets: [
      'Apple App Store / Google Play — payments and subscription management.',
      'Cloudflare — hosting, storage, and content delivery.',
      'We do not use third-party advertising or social-media tracking SDKs.',
    ],
  },
  {
    heading: 'Parental rights and choices',
    paragraphs: [
      'A parent can review, export, correct, or delete their child’s data, withdraw consent, and close the account. To make a request, email us from the address on the account and we will respond within 30 days.',
    ],
  },
  {
    heading: 'Data retention and security',
    paragraphs: [
      'We keep account data while the account is active and delete it within 90 days of an account being closed, unless we are legally required to keep it longer. We use industry-standard safeguards, but no system is perfectly secure.',
    ],
  },
  {
    heading: 'Changes to this policy',
    paragraphs: [
      'If we make a material change, we will notify parents in the app or by email before it takes effect. The date below shows the current version.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: [
      'Questions about privacy? Email privacy@hangulroute.example. We read everything.',
    ],
  },
];

export default function PrivacyPage(): JSX.Element {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: `${spacing.xxl}px ${spacing.lg}px` }}>
      <Link href="/" style={{ color: colors.brand.primary, fontWeight: 600 }}>
        ← Back home
      </Link>
      <h1 style={{ fontSize: typography.size.display, marginTop: spacing.lg }}>Privacy Policy</h1>
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
        <Link href="/terms" style={{ color: colors.text.secondary, fontWeight: 600 }}>
          Terms of Service
        </Link>{' '}
        · © {new Date().getFullYear()} Hangul Route
      </footer>
    </main>
  );
}
