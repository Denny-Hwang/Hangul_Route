'use client';

import { colors, radii, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import type { UiLocale } from '@hangul-route/i18n';
import { useEffect, useState } from 'react';
import { browserLanguages, cameFromLocalePage, dismissLocaleBanner, localeBannerDismissed, localeBannerTarget, type LocaleBannerOffer } from '../../lib/locale-banner';

/**
 * "View in <language>" on every English site page (F-I18N-001 §3.3, PR 11c; wireframe profile/language-picker C;
 * [SN] AMENDMENTS-SITE-NEWUSER §3.2, SN-D3, mock shot `parents-en-375-banner.png`). After mount, when the browser
 * prefers a shown locale over English and the visitor has not closed the banner this session, it suggests the same
 * page in that locale. It never redirects. The static HTML holds none of it, so the page is the same
 * without JavaScript. The words arrive from the page, already in the suggested locale.
 */
export function LocaleBanner({ offers }: { offers: Partial<Record<UiLocale, LocaleBannerOffer>> }): JSX.Element | null {
  const [offer, setOffer] = useState<LocaleBannerOffer | null>(null);

  useEffect(() => {
    const offered = Object.keys(offers);
    // Arriving from /es or /ko (the footer switcher's English link) is a choice of English: remember it as a dismissal.
    if (cameFromLocalePage(document.referrer, window.location.origin, offered)) {
      dismissLocaleBanner();
      return;
    }
    const target = localeBannerTarget(browserLanguages(navigator), offered, localeBannerDismissed()) as UiLocale | null;
    setOffer(target ? (offers[target] ?? null) : null);
  }, [offers]);

  if (!offer) return null;
  return (
    <LocaleBannerView
      offer={offer}
      onDismiss={() => {
        dismissLocaleBanner();
        setOffer(null);
      }}
    />
  );
}

/** The banner itself: a link to the suggested locale, written in it, and a close button. */
export function LocaleBannerView({ offer, onDismiss }: { offer: LocaleBannerOffer; onDismiss: () => void }): JSX.Element {
  return (
    <aside
      aria-label={offer.label}
      lang={offer.lang}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginTop: spacing.md,
        paddingLeft: spacing.md,
        backgroundColor: colors.feedback.infoLight,
        borderRadius: radii.md,
        color: colors.text.primary,
      }}
    >
      <a
        href={offer.href}
        hrefLang={offer.lang}
        style={{ display: 'inline-flex', alignItems: 'center', minHeight: touchTarget.min, color: colors.text.primary, fontWeight: typography.weight.bold, padding: `${spacing.sm}px 0` }}
      >
        {offer.text}
      </a>
      <button
        type="button"
        aria-label={offer.dismiss}
        onClick={onDismiss}
        style={{
          minWidth: touchTarget.min,
          minHeight: touchTarget.min,
          border: 'none',
          background: 'none',
          color: colors.text.secondary,
          fontSize: typography.size.bodyLg,
          cursor: 'pointer',
        }}
      >
        {offer.close}
      </button>
    </aside>
  );
}
