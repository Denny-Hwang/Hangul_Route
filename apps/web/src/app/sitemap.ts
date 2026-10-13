import type { MetadataRoute } from 'next';
import { siteSitemap } from '../lib/site-surface';

/** `out/sitemap.xml` (F-SITE-002 §3.10, S-9): the site's own pages in every shown locale. Static export. */
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return siteSitemap();
}
