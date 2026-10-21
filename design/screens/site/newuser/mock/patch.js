/*
 * AMENDMENTS-SITE-NEWUSER design mock: turns the real static export of a site page (apps/web/out, origin/main) into
 * the new-visitor design, in place, so every unchanged part of the page stays exactly as it ships. Run by
 * tools/build-mocks.mjs with window.SN_STRINGS (strings.js), window.SN_VALUES and window.SN_PAGE = { page, locale,
 * captures } set first. Every colour, size, radius and gap below is a site custom property (`--hr-site-*`, set from
 * the tokens by `siteCssVars()` in apps/web/src/lib/site-style.ts) or one of the token aliases declared at the top of
 * MOCK_CSS, each named after its token. Breakpoints are em, as in globals.css: 30em = 480 px, 45em = 720 px,
 * 60em = 960 px at default text.
 */
(function () {
  const { page, locale, captures } = window.SN_PAGE;
  const S = window.SN_STRINGS[locale];
  const V = window.SN_VALUES;
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const path = (p) => (p === '/' ? prefix || '/' : `${prefix}${p}`);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v);
    }
    for (const kid of kids) if (kid) n.append(kid);
    return n;
  };

  const MOCK_CSS = `
  .hr-site {
    /* token aliases (packages/design-system/src/tokens.ts) */
    --radii-pill: 999px;          /* radii.pill */
    --radii-lg: 16px;             /* radii.lg */
    --radii-xl: 24px;             /* radii.xl */
    --radii-xxl: 32px;            /* radii.xxl */
    --surface-paper: #FFFFFF;     /* colors.surface.paper */
    --surface-canvas: #FCF8F1;    /* colors.surface.canvas */
    --frame-ink: #2A1F14;         /* colors.text.primary, the device frame */
    --shadow-card: 0 4px 16px rgba(42, 31, 20, 0.10); /* shadows.md as CSS (cardShadow()) */
    --touch-child: 80px;          /* touchTarget.child */
    --radii-md: 12px;             /* radii.md */
    --feedback-info-light: #D9E5FB; /* colors.feedback.infoLight (LocaleBanner) */
  }
  .sn-vh { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

  /* ---------- header: brand name, Start pill, Language control ---------- */
  .hr-site .hr-site-brand-mark { display: flex !important; width: 3rem !important; height: 3rem !important; white-space: nowrap; } /* spacing.xxxl as rem (48 / 16) */
  .hr-site .hr-site-header .hr-site-wrap { column-gap: 0 !important; }
  @media (min-width: 45em) { .hr-site .hr-site-header .hr-site-wrap { column-gap: var(--hr-site-xs) !important; } }
  .hr-site .hr-site-brand-name { display: none !important; }
  @media (min-width: 30em) { .hr-site .hr-site-brand-name { display: inline !important; } }
  @media (min-width: 45em) { .hr-site .hr-site-brand-name { display: none !important; } }
  @media (min-width: 60em) { .hr-site .hr-site-brand-name { display: inline !important; } }
  .hr-site .hr-site-header-start.sn-start { display: inline-flex !important; margin-left: auto; min-width: var(--hr-site-touch-min);
    padding: 0 var(--hr-site-sm) !important; font-size: var(--hr-site-size-body-sm); }
  .hr-site .hr-site-signin { padding: 0 var(--hr-site-sm) !important; min-width: var(--hr-site-touch-min); justify-content: center; font-size: var(--hr-site-size-body-sm); }
  @media (min-width: 45em) {
    .hr-site .hr-site-header-start.sn-start { margin-left: 0; padding: 0 var(--hr-site-xl) !important; font-size: var(--hr-site-size-body); }
    .hr-site .hr-site-signin { padding: 0 var(--hr-site-lg) !important; font-size: var(--hr-site-size-body); }
    .hr-site .hr-site-nav { margin-left: auto; }
  }
  .sn-lang { position: static; }
  .hr-site .hr-site-header .hr-site-wrap { position: relative; }
  .sn-lang > summary { list-style: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-width: var(--hr-site-touch-min); min-height: var(--hr-site-touch-min); padding: 0 var(--hr-site-xs); gap: var(--hr-site-xxs);
    color: var(--hr-site-text); font-size: var(--hr-site-size-caption); font-weight: 600; border-radius: var(--hr-site-sm); }
  .sn-lang > summary::-webkit-details-marker { display: none; }
  .sn-lang > summary:focus-visible { outline: var(--hr-site-border-thick) solid var(--hr-site-focus); outline-offset: var(--hr-site-xxs); }
  .sn-lang .sn-top { display: inline-flex; align-items: center; gap: var(--hr-site-xxs); }
  .sn-lang .sn-chev { display: inline-block; }
  @media (min-width: 45em) {
    .sn-lang .sn-top { display: contents; }
    .sn-lang .sn-chev { order: 3; }
    .sn-lang-menu { right: var(--hr-site-gutter-regular); }
    .sn-lang > summary { flex-direction: row; gap: var(--hr-site-xs); padding: 0 var(--hr-site-sm); font-size: var(--hr-site-size-body-sm); }
  }
  @media (min-width: 70em) { .sn-lang-menu { right: var(--hr-site-gutter-wide); } }
  .sn-lang[open] .sn-chev { transform: rotate(180deg); }
  .sn-lang-menu { position: absolute; right: var(--hr-site-gutter-compact); top: 100%; max-width: calc(100vw - 2 * var(--hr-site-gutter-compact)); box-sizing: border-box; z-index: var(--hr-site-z-sticky); margin: var(--hr-site-xs) 0 0; padding: var(--hr-site-xs) 0;
    list-style: none; min-width: min(12rem, 100vw - 2 * var(--hr-site-gutter-compact)); background: var(--surface-paper); border: var(--hr-site-border-thin) solid var(--hr-site-border-subtle);
    border-radius: var(--radii-lg); box-shadow: var(--shadow-card); }
  .sn-lang-menu a { display: flex; align-items: center; justify-content: space-between; gap: var(--hr-site-md); min-height: var(--hr-site-touch-min);
    padding: 0 var(--hr-site-lg); color: var(--hr-site-text-secondary); text-decoration: none; font-size: var(--hr-site-size-body); }
  .sn-lang-menu a[aria-current="page"] { color: var(--hr-site-text); font-weight: 700; }
  .sn-lang-menu a:hover { background: var(--hr-site-sunken); }

  /* ---------- home hero ---------- */
  .sn-facts { margin: var(--hr-site-sm) 0 0; font-size: var(--hr-site-size-caption); color: var(--hr-site-text-muted); }
  .sn-who-links { display: flex; flex-wrap: wrap; column-gap: var(--hr-site-lg); margin-top: var(--hr-site-xs); }
  .sn-text-link { display: inline-flex; align-items: center; min-height: var(--hr-site-touch-min); color: var(--hr-site-brand-dark);
    font-weight: 600; text-decoration-line: underline; text-decoration-thickness: var(--hr-site-border-thin); text-underline-offset: var(--hr-site-xs); }
  .sn-art { position: relative; justify-self: center; width: 100%; max-width: 22rem; display: flex; justify-content: center; align-items: flex-end;
    padding: var(--hr-site-lg) var(--hr-site-lg) 0; background: var(--hr-site-brand-light); border-radius: var(--radii-xxl); overflow: hidden; }
  .sn-phone { width: 52%; margin-left: 30%; background: var(--frame-ink); padding: var(--hr-site-xs); border-radius: var(--radii-xl) var(--radii-xl) 0 0; padding-bottom: 0; }
  .sn-phone img { display: block; width: 100%; height: auto; aspect-ratio: 390 / 650; object-fit: cover; object-position: top; border-radius: 20px 20px 0 0; }
  .sn-art-hoya { position: absolute; left: var(--hr-site-md); bottom: var(--hr-site-md); width: 34%; aspect-ratio: 1 / 1; display: flex; }
  .sn-art-bubble { position: absolute; left: var(--hr-site-sm); bottom: 42%; max-width: 44%; padding: var(--hr-site-sm) var(--hr-site-md);
    background: var(--surface-paper); border-radius: var(--radii-lg); box-shadow: var(--shadow-card); font-weight: 600; font-size: var(--hr-site-size-caption); line-height: 1.35; }
  @media (min-width: 45em) {
    .sn-art { max-width: var(--hr-site-hero-art-max-wide); padding-top: var(--hr-site-xl); }
    .sn-art-bubble { font-size: var(--hr-site-size-body-sm); }
  }

  /* ---------- closing band and the quiet launch-news section ---------- */
  .sn-band { margin-top: var(--hr-site-lg); padding: var(--hr-site-xl) var(--hr-site-lg); background: var(--hr-site-brand); color: var(--hr-site-on-primary);
    border-radius: var(--radii-xxl); text-align: center; display: grid; justify-items: center; gap: var(--hr-site-md); }
  .sn-band h2 { margin: 0; font-size: var(--hr-site-size-title); line-height: 1.15; color: var(--hr-site-on-primary); }
  .sn-band p { margin: 0; max-width: 34em; line-height: 1.55; }
  .sn-band a.sn-band-action { display: inline-flex; align-items: center; justify-content: center; min-height: var(--touch-child); padding: 0 var(--hr-site-xxl);
    background: var(--surface-paper); color: var(--hr-site-brand-dark); border-radius: var(--radii-pill); font-weight: 700; font-size: var(--hr-site-size-body-lg);
    text-decoration: none; width: 100%; max-width: 22rem; }
  .sn-band a.sn-band-action:focus-visible { outline: var(--hr-site-border-thick) solid var(--hr-site-on-primary); outline-offset: var(--hr-site-xs); }
  @media (min-width: 45em) { .sn-band { padding: var(--hr-site-xxl); } .sn-band a.sn-band-action { width: auto; } }
  .sn-news { text-align: left; margin-top: var(--hr-site-xl); }
  .sn-news .sn-news-form { display: flex; flex-wrap: wrap; gap: var(--hr-site-sm); max-width: 30rem; margin-top: var(--hr-site-md); }
  .sn-news input { flex: 1 1 15rem; min-width: 0; max-width: 100%; min-height: var(--hr-site-touch-min); padding: 0 var(--hr-site-lg); font: inherit; border: var(--hr-site-border-base) solid var(--hr-site-border-strong);
    border-radius: var(--radii-pill); background: var(--surface-paper); color: var(--hr-site-text); }
  .sn-news button { min-height: var(--hr-site-touch-min); padding: 0 var(--hr-site-xl); font: inherit; font-weight: 700; border: 0; border-radius: var(--radii-pill);
    background: var(--frame-ink); color: var(--hr-site-on-primary); }
  .sn-news .sn-consent { margin: var(--hr-site-md) 0 0; max-width: 34em; font-size: var(--hr-site-size-body-sm); color: var(--hr-site-text-secondary); line-height: 1.55; }
  .sn-news .sn-consent a { color: var(--hr-site-brand-dark) !important; font-weight: 600; } /* the form's tone="plain" (spec 3.3) */

  /* ---------- persona pages ---------- */
  .sn-have-account { display: flex; width: fit-content; margin-top: var(--hr-site-xs); }
  .hr-site-closing .sn-closing-actions { display: grid; justify-items: start; gap: var(--hr-site-xs); }
  .sn-figure { margin: var(--hr-site-lg) 0 0; }
  .sn-phone-sm { width: min(12rem, 100%); background: var(--frame-ink); padding: var(--hr-site-xs); border-radius: var(--radii-xl); }
  .sn-phone-sm img { display: block; width: 100%; height: auto; border-radius: 20px; aspect-ratio: 390 / 700; object-fit: cover; object-position: top; }
  .sn-screen { background: var(--surface-paper); border: var(--hr-site-border-thin) solid var(--hr-site-border-subtle); border-radius: var(--radii-lg);
    box-shadow: var(--shadow-card); overflow: hidden; }
  .sn-screen img { display: block; width: 100%; height: auto; }
  .sn-media { display: grid; gap: var(--hr-site-lg); }
  @media (min-width: 45em) { .sn-media { grid-template-columns: 1fr 1fr; align-items: start; } }
  .sn-screen-slide { background: var(--frame-ink); padding: var(--hr-site-sm); border-radius: var(--radii-lg); }
  .sn-screen-slide img { display: block; width: 100%; height: auto; border-radius: var(--hr-site-sm); }
  .sn-trio { list-style: none; margin: var(--hr-site-lg) 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--hr-site-sm); max-width: 34rem; }
  .sn-trio .sn-phone-sm { width: 100%; padding: 3px; border-radius: var(--radii-lg); }
  .sn-trio .sn-phone-sm img { border-radius: 13px; aspect-ratio: 390 / 760; }
  .sn-trio-fig { margin: 0; }
  .sn-trio-fig figcaption { margin-top: var(--hr-site-xs); font-size: var(--hr-site-size-caption); color: var(--hr-site-text-secondary); text-align: center; }
  .sn-trio { margin-bottom: var(--hr-site-md); }
  .sn-lines { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--hr-site-sm); line-height: 1.55; color: var(--hr-site-text-secondary); max-width: 40em; }

  /* ---------- 404 ---------- */
  .sn-404 { display: grid; justify-items: center; text-align: center; gap: var(--hr-site-md); padding: var(--hr-site-xxl) 0; }
  .sn-404 h1 { margin: var(--hr-site-md) 0 0; font-size: var(--hr-site-size-display); line-height: 1.15; }
  .sn-404 p { margin: 0; color: var(--hr-site-text-secondary); max-width: 26em; line-height: 1.55; }
  .sn-404-hoya { width: 7rem; aspect-ratio: 1 / 1; display: flex; }
  `;

  const style = el('style', { id: 'sn-mock' });
  style.textContent = MOCK_CSS;
  document.head.append(style);

  const root = document.querySelector('.hr-site');
  const main = document.querySelector('main');
  const hoyaSvg = () => {
    const svg = document.querySelector('.hr-site-hero-art svg') || window.SN_HOYA_SVG;
    return svg ? (typeof svg === 'string' ? svg : svg.outerHTML) : '';
  };
  const globe = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/><path d="M2 10h16M10 2c2.4 2.2 3.6 4.9 3.6 8s-1.2 5.8-3.6 8c-2.4-2.2-3.6-4.9-3.6-8S7.6 4.2 10 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  const chev = '<svg class="sn-chev" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const check = '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"><path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const sitePage = (() => {
    const p = page === '404' ? '/' : page;
    return p;
  })();

  /* ---------- header, every page ---------- */
  function header(open) {
    const wrap = document.querySelector('.hr-site-header .hr-site-wrap');
    if (!wrap) return;
    const start = wrap.querySelector('.hr-site-header-start');
    if (start) {
      start.classList.add('sn-start');
      start.setAttribute('aria-label', start.textContent);
      start.textContent = S.nav.startShort;
    }
    const languageWord = document.querySelector('.hr-site-locale-label')?.textContent || 'Language';
    const details = el('details', { class: 'sn-lang' });
    if (open) details.setAttribute('open', '');
    const summary = el('summary', {});
    summary.innerHTML = `<span class="sn-top">${globe}${chev}</span><span class="sn-vh">${languageWord}</span> <span lang="${V.htmlLang[locale]}">${V.endonyms[locale]}</span>`;
    const list = el('ul', { class: 'sn-lang-menu', role: 'list' });
    for (const target of ['en', 'es', 'ko']) {
      const a = el('a', { href: (target === 'en' ? '' : `/${target}`) + (sitePage === '/' ? (target === 'en' ? '/' : '') : sitePage), hreflang: V.htmlLang[target], lang: V.htmlLang[target] });
      a.innerHTML = `<span>${V.endonyms[target]}</span>${target === locale ? check : ''}`;
      if (target === locale) a.setAttribute('aria-current', 'page');
      list.append(el('li', {}, a));
    }
    details.append(summary, list);
    const signin = wrap.querySelector('.hr-site-signin');
    if (signin) wrap.insertBefore(details, signin);
    else wrap.append(details);
  }

  /* ---------- the locale banner (state shot) ---------- */
  function banner() {
    const offer = window.SN_PAGE.bannerOffer;
    const aside = el('aside', { lang: 'es', style: 'display:flex;align-items:center;justify-content:space-between;gap:var(--hr-site-sm);margin:var(--hr-site-md) 0 0;padding-left:var(--hr-site-md);background:var(--feedback-info-light);border-radius:var(--radii-md);color:var(--hr-site-text)' });
    aside.setAttribute('aria-label', offer.label);
    aside.innerHTML = `<a href="/es${sitePage === '/' ? '' : sitePage}" hreflang="es" style="display:inline-flex;align-items:center;min-height:var(--hr-site-touch-min);color:var(--hr-site-text);font-weight:700">${offer.text}</a><button type="button" aria-label="${offer.dismiss}" style="min-width:var(--hr-site-touch-min);min-height:var(--hr-site-touch-min);border:0;background:none;font-size:var(--hr-site-size-body-lg);color:var(--hr-site-text-secondary)">${offer.close}</button>`;
    main.prepend(aside);
  }

  /* ---------- home ---------- */
  function home() {
    const hero = document.querySelector('.hr-site-hero');
    const textCol = hero.firstElementChild;
    const grown = textCol.querySelector('a[href="#who"]');
    const facts = grown.nextElementSibling;
    const factsText = facts.textContent;
    facts.remove();
    const factsP = el('p', { class: 'sn-facts', text: factsText });
    const links = el('div', { class: 'sn-who-links' },
      el('a', { class: 'sn-text-link', href: path('/parents'), text: S.hero.forParents }),
      el('a', { class: 'sn-text-link', href: path('/teachers'), text: S.hero.forTeachers }));
    grown.replaceWith(factsP);
    factsP.after(links);

    const oldArt = hero.querySelector('.hr-site-hero-art');
    const bubbleText = oldArt.querySelector('.hr-site-bubble').textContent;
    const art = el('div', { class: 'sn-art hr-site-hero-art-new' });
    const hoya = el('span', { class: 'sn-art-hoya', 'aria-hidden': 'true', html: hoyaSvg() });
    const bubble = el('span', { class: 'sn-art-bubble', 'aria-hidden': 'true', text: bubbleText });
    const phone = el('div', { class: 'sn-phone' },
      el('img', { src: `${captures}/discover.webp`, width: '520', height: '1125', alt: S.captures.discover(V.firstLetter, V.firstLetterRoman), fetchpriority: 'high' }));
    art.append(phone, hoya, bubble);
    oldArt.replaceWith(art);

    // The cost section folds into the closing band (OD-SN-3 default a).
    document.getElementById('home-cost')?.closest('section')?.remove();

    const news = document.getElementById('news');
    const title = news.querySelector('h2').textContent;
    const body = news.querySelector('p').textContent;
    const form = news.querySelector('form');
    const input = form.querySelector('input[type="email"]');
    const submit = form.querySelector('button[type="submit"]');
    const consentP = [...news.querySelectorAll('p')].find((p) => p.querySelector('a[href^="mailto:"]'));
    const band = el('section', { class: 'sn-band', 'aria-labelledby': 'home-closing' },
      el('h2', { id: 'home-closing', text: S.closing.title }),
      el('p', { text: S.closing.body }),
      el('a', { class: 'sn-band-action', href: document.querySelector('.hr-site-hero .hr-site-primary').getAttribute('href'), text: document.querySelector('.hr-site-hero .hr-site-primary').textContent }));
    const quiet = el('section', { id: 'news', class: 'hr-site-section sn-news', 'aria-labelledby': 'home-news' },
      el('h2', { id: 'home-news', class: 'hr-site-h2', style: 'margin:0 0 var(--hr-site-sm);line-height:1.15', text: title }),
      el('p', { style: 'margin:0;line-height:1.55;color:var(--hr-site-text-secondary)', text: body }));
    const f = el('form', { class: 'sn-news-form', novalidate: '' });
    f.append(el('label', { class: 'sn-vh', for: 'sn-email', text: input.getAttribute('aria-label') || input.getAttribute('placeholder') }),
      el('input', { id: 'sn-email', type: 'email', placeholder: input.getAttribute('placeholder'), autocomplete: 'email' }),
      el('button', { type: 'submit', text: submit.textContent }));
    quiet.append(f);
    if (consentP) quiet.append(el('p', { class: 'sn-consent', html: consentP.innerHTML }));
    news.replaceWith(band);
    band.after(quiet);
  }

  /* ---------- persona pages ---------- */
  function convert(persona) {
    const create = persona === 'parents' ? S.persona.parentsCreate : S.persona.teachersCreate;
    const createHref = `/signin?mode=create&persona=${persona === 'parents' ? 'parent' : 'teacher'}${locale === 'en' ? '' : `&lang=${locale}`}`;
    const signHref = `/signin?persona=${persona === 'parents' ? 'parent' : 'teacher'}${locale === 'en' ? '' : `&lang=${locale}`}`;
    const head = document.querySelector('section[aria-labelledby="page-title"]');
    const headPrimary = head.querySelector('.hr-site-primary');
    headPrimary.textContent = create;
    headPrimary.setAttribute('href', createHref);
    const actions = headPrimary.parentElement;
    actions.after(el('a', { class: 'sn-text-link sn-have-account', href: signHref, text: S.persona.haveAccount }));
    const closing = document.querySelector(`section[aria-labelledby="${persona}-closing"]`);
    const cPrimary = closing.querySelector('.hr-site-primary');
    cPrimary.textContent = create;
    cPrimary.setAttribute('href', createHref);
    const box = el('div', { class: 'sn-closing-actions' });
    cPrimary.replaceWith(box);
    box.append(cPrimary, el('a', { class: 'sn-text-link', href: signHref, text: S.persona.haveAccount }));
  }

  function parents() {
    convert('parents');
    const follow = document.querySelector('section[aria-labelledby="parents-follow"]');
    follow.append(el('figure', { class: 'sn-figure' },
      el('div', { class: 'sn-phone-sm' }, el('img', { src: `${captures}/report.webp`, width: '600', height: '1298', alt: S.captures.report, loading: 'lazy' }))));
  }

  function teachers() {
    convert('teachers');
    const cls = document.querySelector('section[aria-labelledby="teachers-class"]');
    const twoCol = cls.parentElement.parentElement.matches('main') ? cls.parentElement : cls.parentElement.parentElement;
    const media = el('div', { class: 'sn-media', style: 'padding-bottom:var(--hr-site-lg)' },
      el('figure', { style: 'margin:0' }, el('div', { class: 'sn-screen' }, el('img', { src: `${captures}/class-list.webp`, width: '720', height: '456', alt: S.captures.classList, loading: 'lazy' }))),
      el('figure', { style: 'margin:0' }, el('div', { class: 'sn-screen-slide' }, el('img', { src: `${captures}/lecture-slide.webp`, width: '1080', height: '608', alt: S.captures.lectureSlide, loading: 'lazy' }))));
    twoCol.after(media);
    const schools = el('section', { class: 'hr-site-section', 'aria-labelledby': 'teachers-schools' },
      el('h2', { id: 'teachers-schools', class: 'hr-site-h2', style: 'margin:0 0 var(--hr-site-md);line-height:1.15', text: S.schools.title }));
    const ul = el('ul', { class: 'sn-lines', role: 'list' });
    for (const line of [S.schools.space, S.schools.admins(V.SCHOOL_ADMIN_CAP), S.schools.moves, S.schools.size(V.SCHOOL_LEARNER_CAP, V.email)]) ul.append(el('li', { text: line }));
    schools.append(ul);
    media.after(schools);
  }

  function learners() {
    const quest = document.querySelector('section[aria-labelledby="learners-quest"]');
    const list = quest.querySelector('ol, ul');
    const trio = el('ul', { class: 'sn-trio', role: 'list' });
    for (const [file, alt] of [['home', S.captures.home], ['game', S.captures.game], ['card', S.captures.card(V.card.word, V.card.roman, S.cardMeaning)]]) {
      trio.append(el('li', {}, el('figure', { class: 'sn-trio-fig' },
        el('div', { class: 'sn-phone-sm' }, el('img', { src: `${captures}/${file}.webp`, width: '400', height: '866', alt, loading: 'lazy' })),
        el('figcaption', { text: S.captures.caption[file] }))));
    }
    // After the steps and Hoya's line, before the mini-games fold: a sampler of real screens, not step pictures.
    const fold = quest.querySelector('details');
    if (fold) fold.before(trio);
    else list.after(trio);
  }

  function about() {
    const promises = [...main.querySelectorAll('section')].find((s) => s.querySelector('ul'));
    const start = document.querySelector('.hr-site-header-start');
    const a = el('a', { class: 'hr-site-primary', href: start.getAttribute('href'), text: start.getAttribute('aria-label'),
      style: 'display:inline-flex;align-items:center;justify-content:center;min-height:var(--touch-child);padding:0 var(--hr-site-xl);border-radius:var(--radii-pill);font-weight:700;font-size:var(--hr-site-size-body-lg);margin-top:var(--hr-site-md)' });
    promises.append(a);
  }

  function notFound() {
    const start = document.querySelector('.hr-site-header-start');
    const wrap = el('section', { class: 'sn-404', 'aria-labelledby': 'nf-title' },
      el('span', { class: 'sn-404-hoya', 'aria-hidden': 'true', html: hoyaSvg() }),
      el('h1', { id: 'nf-title', text: S.notFound.title }),
      el('p', { text: S.notFound.body }),
      el('a', { class: 'sn-text-link', href: path('/'), text: window.SN_404_HOME }),
      el('a', { class: 'hr-site-primary', href: start.getAttribute('href'), text: start.getAttribute('aria-label'),
        style: 'display:inline-flex;align-items:center;justify-content:center;min-height:var(--touch-child);padding:0 var(--hr-site-xl);border-radius:var(--radii-pill);font-weight:700;font-size:var(--hr-site-size-body-lg)' }));
    main.replaceChildren(wrap);
    document.title = `${S.notFound.title} - Hangul Route`;
  }

  header(window.SN_PAGE.langOpen === true);
  if (window.SN_PAGE.banner) banner();
  if (page === '/') home();
  if (page === '/parents') parents();
  if (page === '/teachers') teachers();
  if (page === '/learners') learners();
  if (page === '/about') about();
  if (page === '404') notFound();
  root?.setAttribute('data-sn-mock', page);
})();
