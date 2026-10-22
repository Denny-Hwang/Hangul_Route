import type { UiLocale } from '@hangul-route/i18n';
import type { CSSProperties } from 'react';
import { captureFile, type CaptureName } from '../../data/site-captures';

/**
 * One product capture (AMENDMENTS-SITE-NEWUSER §3.13 "Markup"): an `<img>` with its pixel `width` and `height`, alt
 * text from `landing.captures.*` and `decoding="async"`; lazy except the hero's (`priority`: not lazy,
 * `fetchPriority="high"`). With `wide`, a `<picture>` whose `(min-width: 45em)` source is the wide capture and whose
 * `<img>` is the phone crop (`discover-narrow`, `class-list-narrow`), so the words stay readable on a phone. Not a link.
 * Renders nothing when the locale has no file for it (a capture holds UI text, so another locale's never stands in).
 * The frame around it is the caller's.
 */
export function SiteCapture({
  locale,
  name,
  wide,
  alt,
  priority = false,
  className,
  style,
}: {
  locale: UiLocale;
  /** The capture the `<img>` shows (the phone crop when `wide` is set). */
  name: CaptureName;
  /** The capture for 45em and up, as a `<source>`. */
  wide?: CaptureName;
  alt: string;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}): JSX.Element | null {
  const file = captureFile(locale, name);
  const wideFile = wide ? captureFile(locale, wide) : null;
  if (!file || (wide && !wideFile)) return null;
  const img = (
    <img
      src={file.src}
      width={file.width}
      height={file.height}
      alt={alt}
      decoding="async"
      loading={priority ? undefined : 'lazy'}
      // React 18 spells the attribute `fetchpriority` (no camelCase prop yet).
      {...(priority ? { fetchpriority: 'high' } : {})}
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', ...style }}
    />
  );
  if (!wideFile) return img;
  return (
    <picture>
      <source media="(min-width: 45em)" srcSet={wideFile.src} width={wideFile.width} height={wideFile.height} />
      {img}
    </picture>
  );
}
