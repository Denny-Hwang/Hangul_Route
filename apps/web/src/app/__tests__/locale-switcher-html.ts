/**
 * The footer's locale switcher (`LocaleSwitcher`) shows on every site page since es and ko shipped (F-I18N-001
 * rows 15b / 16b): endonym links with `hrefLang` and `lang`, the current locale's marked `aria-current="page"`.
 * Tests about the rest of a page (its own `lang` marks, its current persona page) read the page without it.
 */
export function withoutSwitcher(html: string): string {
  return html.replace(/<nav aria-label="[^"]*"><div[^>]*>[^<]*<\/div>(?:<div><a [^>]*hrefLang=[^>]*>[^<]*<\/a><\/div>)+<\/nav>/g, '');
}
