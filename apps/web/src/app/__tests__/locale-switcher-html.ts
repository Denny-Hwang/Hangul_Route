/**
 * The footer's locale switcher (`LocaleSwitcher`) shows on every site page since es and ko shipped (F-I18N-001
 * rows 15b / 16b): endonym links with `hrefLang` and `lang`, the current locale's marked `aria-current="page"`.
 * [SN] Since AMENDMENTS-SITE-NEWUSER §3.2 the header's language control (`LanguageMenu`, a `<details>`) holds the same
 * links. Tests about the rest of a page (its own `lang` marks, its current persona page, its links) read the page
 * without either; `site-chrome.test.tsx` pins both controls.
 */
export function withoutSwitcher(html: string): string {
  return withoutLanguageMenu(html).replace(/<nav aria-label="[^"]*"><div[^>]*>[^<]*<\/div>(?:<div><a [^>]*hrefLang=[^>]*>[^<]*<\/a><\/div>)+<\/nav>/g, '');
}

/** The page without the header's language control (`<details class="hr-site-lang…">`, which nests no `<details>`). */
export function withoutLanguageMenu(html: string): string {
  return html.replace(/<details class="hr-site-lang[^"]*">[\s\S]*?<\/details>/g, '');
}
