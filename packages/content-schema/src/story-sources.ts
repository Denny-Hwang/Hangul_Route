/**
 * Source hosts for story facts (F-STORY-001 §3.3 C3 and C4).
 *
 * `AUTHORITATIVE_HOST_SUFFIXES` is the research brief's preferred list: every
 * fact needs at least one source on one of them. `SOURCE_HOST_ALLOWLIST` is
 * the 31 hosts of the research set; a host outside it is only a warning
 * (`source-host-unlisted`), and adding a host is a one-line, reviewed PR.
 */
export const AUTHORITATIVE_HOST_SUFFIXES = [
  '.go.kr',
  'unesco.org',
  'encykorea.aks.ac.kr',
  'itkc.or.kr',
  'snu.ac.kr',
] as const;

export const SOURCE_HOST_ALLOWLIST: readonly string[] = [
  'contents.history.go.kr',
  'encykorea.aks.ac.kr',
  'english.khs.go.kr',
  'folkency.nfm.go.kr',
  'ich.unesco.org',
  'korean.go.kr',
  'media.unesco.org',
  'news.sbs.co.kr',
  'science.kma.go.kr',
  'shfestival.com',
  'sillok.history.go.kr',
  'sjw.history.go.kr',
  'stdict.korean.go.kr',
  'theme.archives.go.kr',
  'treestory.forest.or.kr',
  'whc.unesco.org',
  'www.cheongju.go.kr',
  'www.gutenberg.org',
  'www.hangeul.go.kr',
  'www.heritage.go.kr',
  'www.khan.co.kr',
  'www.khs.go.kr',
  'www.korea.kr',
  'www.korean.go.kr',
  'www.koreascience.or.kr',
  'www.mcst.go.kr',
  'www.museum.go.kr',
  'www.nfm.go.kr',
  'www.seoul.co.kr',
  'www.suwon.go.kr',
  'www.unesco.org',
];

/** True when `host` is the suffix's own domain or a subdomain of it (never `evilunesco.org`). */
function hostUnder(host: string, suffix: string): boolean {
  const domain = suffix.replace(/^\./, '');
  return host === domain || host.endsWith(`.${domain}`);
}

export function isAuthoritativeHost(host: string): boolean {
  const lower = host.toLowerCase();
  return AUTHORITATIVE_HOST_SUFFIXES.some((suffix) => hostUnder(lower, suffix));
}

export function isAllowlistedHost(host: string): boolean {
  return SOURCE_HOST_ALLOWLIST.includes(host.toLowerCase());
}
