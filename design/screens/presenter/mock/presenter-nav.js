// Design mock helper for the presenter navigation pass (PN-0b; docs/specs/AMENDMENTS-PRESENTER-NAV.md). Not shipped code.
// Runs after presenter.js. It picks the layout the way `navLayout` (section 4) and the rail gate (section 5.2) do, from
// the window, the pointer and the safe-area insets, and draws the states the shots need:
//   #input=touch|mouse  the pointer (default: the device's any-pointer: coarse or hover: none); touch = "touch seen"
//   #notch=47|59        landscape safe-area insets 47 / 47 / 21 (844 x 390) or 59 / 59 / 21 (932 x 430)
//   #rail=off           EXPO_PUBLIC_PRESENTER_RAIL off: every phone window uses the overlay layout (section 15)
//   #lang=en|es|ko      the chrome strings (the dictionary values; section 13 for the new keys)
//   #point=n            option n pointed at (O2, section 7.3)      #hint=1  the start hint (O7, section 9.3)
//   #nudge=1            the Next ring (section 7.2)                 #more=1  the More sheet open
//   #chip=1             the offline chip                            #dims=1  the clearance annotations (section 5.0)
//   #projector=1        a washed-out projector look (mock only)     #bar=hidden (presenter.js) the 3 s fade
// window.__nav reports what was drawn and measured, for the pass script.
(function () {
  var STR = /*STR*/{"en":{"bar.label":"Lesson controls","bar.prev.cta":"Previous","bar.reveal.cta":"Reveal","bar.sound.cta":"Sound","bar.timer.cta":"Timer","bar.blank.cta":"Blank","bar.grid.cta":"Slides","bar.more.cta":"More","bar.fullscreen.cta":"Full screen","bar.exit.cta":"Exit","bar.offline":"Offline. Everything still works.","quiz.sound":"Which letter makes this sound?","quiz.playPrompt":"Play the sound","quiz.answer":"Hoya's answer","quiz.listen":"Which one did you hear?","quiz.reply":"Which answer fits?","help.title":"Keys and controls","help.clicker":"A presentation clicker works with no setup.","help.keepVisible":"Keep controls visible","help.romanization":"Romanization","help.romanizationAlways":"always","help.romanizationTap":"hide until tapped","help.key.space":"Space","help.key.backspace":"Backspace","home.help.cta":"Keys and help","help.row.next":"Next","help.row.back":"Previous","help.row.first":"First and last slide","help.row.blank":"Blank the screen","help.row.sound":"Play the sound again","help.row.strokes":"Replay the stroke guide","help.row.romanization":"Romanization on or off","help.row.timer":"Class timer","help.row.grid":"All slides","help.row.fullscreen":"Full screen","help.row.help":"This help","help.row.close":"Close or exit","buttons.next":"Next","buttons.close":"Close","help.touch.title":"Touch and mouse","help.touch.swipe":"Swipe left to go on, right to go back.","help.touch.buttons":"Or tap Previous and Next.","help.touch.click":"With a mouse, click the slide to go on (not on question slides).","help.touch.point":"Tap an answer to point at it. It does not show the answer.","help.row.point":"Point at an answer","help.touch.keep":"Keep controls visible shows every button all the time.","help.phoneBar":"On this phone, swipe to move. Tap the slide to show the controls.","nav.hint":"Swipe, or tap Previous and Next.","nav.hintOverlay":"Swipe to move. Tap the slide to show the controls.","a11y.presenter.pointed":"Option {n} pointed at","a11y.presenter.unpointed":"No option pointed at","content.title":"Meet the Letters","content.subtitle":"Twelve letters, and your first real words.","content.hoya":"Hi! I am Hoya. Want to meet my favorite Korean letters?"},"es":{"bar.label":"Controles de la lección","bar.prev.cta":"Anterior","bar.reveal.cta":"Mostrar","bar.sound.cta":"Sonido","bar.timer.cta":"Temporizador","bar.blank.cta":"En blanco","bar.grid.cta":"Diapositivas","bar.more.cta":"Más","bar.fullscreen.cta":"Pantalla completa","bar.exit.cta":"Salir","bar.offline":"Sin internet. Todo sigue funcionando.","quiz.sound":"¿Qué letra hace este sonido?","quiz.playPrompt":"Escuchar el sonido","quiz.answer":"La respuesta de Hoya","quiz.listen":"¿Cuál escuchaste?","quiz.reply":"¿Qué respuesta va bien?","help.title":"Teclas y controles","help.clicker":"Un control de presentaciones funciona sin configurarlo.","help.keepVisible":"Dejar los controles a la vista","help.romanization":"Romanización","help.romanizationAlways":"siempre","help.romanizationTap":"oculta hasta tocar","help.key.space":"Espacio","help.key.backspace":"Retroceso","home.help.cta":"Teclas y ayuda","help.row.next":"Avanzar","help.row.back":"Anterior","help.row.first":"Primera y última","help.row.blank":"Pantalla en blanco","help.row.sound":"Repetir el sonido","help.row.strokes":"Repetir los trazos","help.row.romanization":"Mostrar u ocultar la romanización","help.row.timer":"Temporizador","help.row.grid":"Diapositivas","help.row.fullscreen":"Pantalla completa","help.row.help":"Esta ayuda","help.row.close":"Cerrar o salir","buttons.next":"Siguiente","buttons.close":"Cerrar","help.touch.title":"Pantalla táctil y mouse","help.touch.swipe":"Desliza a la izquierda para avanzar y a la derecha para volver.","help.touch.buttons":"O toca Anterior y Siguiente.","help.touch.click":"Con el mouse, haz clic en la diapositiva para avanzar (no en las preguntas).","help.touch.point":"Toca una opción para señalarla. No muestra la respuesta.","help.row.point":"Señalar una opción","help.touch.keep":"Con \"Dejar los controles a la vista\" activado, todos los botones se ven siempre.","help.phoneBar":"En este teléfono, desliza para avanzar o volver. Toca la diapositiva para ver los controles.","nav.hint":"Desliza o toca Anterior y Siguiente.","nav.hintOverlay":"Desliza para avanzar o volver. Toca la diapositiva para ver los controles.","a11y.presenter.pointed":"Opción {n} señalada","a11y.presenter.unpointed":"Ninguna opción señalada","content.title":"Conoce las letras","content.subtitle":"Doce letras y tus primeras palabras de verdad.","content.hoya":"¡Hola! Soy Hoya. ¿Quieres conocer mis letras coreanas favoritas?"},"ko":{"bar.label":"수업 조작","bar.prev.cta":"이전","bar.reveal.cta":"다음 보기","bar.sound.cta":"소리","bar.timer.cta":"타이머","bar.blank.cta":"화면 가리기","bar.grid.cta":"슬라이드","bar.more.cta":"더 보기","bar.fullscreen.cta":"전체 화면","bar.exit.cta":"나가기","bar.offline":"오프라인이에요. 모두 그대로 돼요.","quiz.sound":"어떤 글자의 소리일까요?","quiz.playPrompt":"소리 듣기","quiz.answer":"호야의 답","quiz.listen":"어떤 것을 들었나요?","quiz.reply":"어떤 대답이 어울릴까요?","help.title":"키와 조작","help.clicker":"프레젠테이션 리모컨은 따로 설정하지 않아도 돼요.","help.keepVisible":"조작 버튼 계속 보이기","help.romanization":"로마자","help.romanizationAlways":"항상","help.romanizationTap":"누를 때까지 숨기기","help.key.space":"스페이스 바","help.key.backspace":"백스페이스","home.help.cta":"키와 도움말","help.row.next":"다음","help.row.back":"이전","help.row.first":"처음과 마지막 슬라이드","help.row.blank":"화면 가리기","help.row.sound":"소리 다시 듣기","help.row.strokes":"획순 다시 보기","help.row.romanization":"로마자 보이기와 숨기기","help.row.timer":"수업 타이머","help.row.grid":"전체 슬라이드","help.row.fullscreen":"전체 화면","help.row.help":"이 도움말","help.row.close":"닫기와 나가기","buttons.next":"다음","buttons.close":"닫기","help.touch.title":"터치와 마우스","help.touch.swipe":"왼쪽으로 밀면 다음으로, 오른쪽으로 밀면 이전으로 가요.","help.touch.buttons":"이전, 다음 버튼을 눌러도 돼요.","help.touch.click":"마우스로 슬라이드를 클릭하면 다음으로 가요. 문제 슬라이드에서는 안 돼요.","help.touch.point":"선택지를 누르면 표시만 돼요. 정답은 보여 주지 않아요.","help.row.point":"선택지 표시하기","help.touch.keep":"'조작 버튼 계속 보이기'를 켜면 모든 버튼이 계속 보여요.","help.phoneBar":"이 휴대폰에서는 화면을 밀어서 넘겨요. 슬라이드를 누르면 조작 버튼이 보여요.","nav.hint":"화면을 밀거나 이전, 다음 버튼을 눌러요.","nav.hintOverlay":"화면을 밀어서 넘겨요. 슬라이드를 누르면 조작 버튼이 보여요.","a11y.presenter.pointed":"{n}번 선택지를 표시했어요","a11y.presenter.unpointed":"표시한 선택지가 없어요","content.title":"글자 만나기","content.subtitle":"글자 열두 개와 처음 읽는 진짜 낱말","content.hoya":"안녕하세요! 저는 호야예요. 제가 좋아하는 한글 글자를 만나 볼래요?"}};
  var h = new URLSearchParams(location.hash.slice(1));
  var lang = STR[h.get('lang')] ? h.get('lang') : 'en';
  function t(k) { var v = STR[lang][k]; return v != null ? v : STR.en[k]; }
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-k]').forEach(function (el) { el.textContent = t(el.getAttribute('data-k')); });
  document.querySelectorAll('[data-k-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-k-aria'))); });
  // Next reads Reveal while the slide has builds left (presenter.js's rule, for every Next on the page).
  var b = h.get('b'); var max = -1;
  document.querySelectorAll('.stage [data-b]').forEach(function (el) { max = Math.max(max, Number(el.getAttribute('data-b'))); });
  var reveal = max >= 0 && b !== null && Number(b) < max;
  document.querySelectorAll('.presenter .nav-next > span').forEach(function (el) { el.textContent = t(reveal ? 'bar.reveal.cta' : 'buttons.next'); });

  var report = (window.__nav = { lang: lang });
  var root = document.querySelector('.presenter.nav');
  function ready(fn) { (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }); }
  if (!root) { ready(function () { measureBoard(); report.ready = true; }); return; }

  // A CSS length (a token or a named constant) in px, measured on a probe inside the presenter.
  var probe = document.createElement('div'); probe.style.position = 'absolute'; probe.style.visibility = 'hidden'; root.appendChild(probe);
  function px(v) { probe.style.width = v; return probe.getBoundingClientRect().width; }

  var touch = h.get('input') ? h.get('input') === 'touch' : matchMedia('(any-pointer: coarse)').matches || matchMedia('(hover: none)').matches;
  root.classList.toggle('touch', touch);
  var w = innerWidth, wh = innerHeight;
  // isPhoneWindow: a coarse pointer, the short side under layout.phoneShortSide, the long side at most layout.phoneMaxLongSide.
  var phone = touch && Math.min(w, wh) < px('var(--layout-phoneShortSide)') && Math.max(w, wh) <= px('var(--layout-phoneMaxLongSide)');
  var layout = 'docked', compact = false;
  if (phone) {
    root.classList.add('phone');
    if (h.get('notch') === '47') root.classList.add('notch');
    if (h.get('notch') === '59') root.classList.add('notch-lg');
    var free = w - px('var(--inset-l)') - px('var(--inset-r)');
    var min = px('var(--phone-stage-min)');
    var railOn = h.get('rail') !== 'off';
    if (railOn && free - px('var(--rail)') >= min) layout = 'rail';
    else if (railOn && free - px('var(--rail-compact)') >= min) { layout = 'rail'; compact = true; }
    else layout = 'overlay';
  }
  root.classList.add('nav-' + layout);
  if (compact) {
    root.classList.add('compact');
    // The compact rail's icon buttons carry their label as the accessible name.
    root.querySelectorAll('.rail .ctl:not(.more)').forEach(function (el) { el.setAttribute('aria-label', el.querySelector('span').textContent); });
  }
  var bar = root.querySelector('.bar.nav');
  // O9: a wide touch window moves Previous to just before Next, in the DOM, so the focus order follows.
  var o9 = layout === 'docked' && touch && w >= px('var(--wide-touch-min)');
  if (o9 && bar) { bar.classList.add('o9'); bar.insertBefore(bar.querySelector('.nav-prev'), bar.querySelector('.nav-next')); }
  report.layout = layout; report.compact = compact; report.touch = touch; report.o9 = o9;

  if (h.get('chip') === '1') root.querySelectorAll('[data-chip]').forEach(function (el) { el.hidden = false; });
  if (h.get('more') === '1') root.querySelectorAll('.more-sheet').forEach(function (el) { el.hidden = false; });
  if (h.get('nudge') === '1') root.querySelectorAll('.nav-next').forEach(function (el) { el.classList.add('nudge'); });
  if (h.get('projector') === '1') document.documentElement.classList.add('projector');

  var live = root.querySelector('.stage [aria-live]');
  var p = Number(h.get('point'));
  var opts = root.querySelectorAll('.stage .opt');
  if (p >= 1 && p <= opts.length) {
    var o = opts[p - 1];
    o.classList.add('pointed'); o.setAttribute('data-pointed', 'true');
    var pin = document.createElement('span'); pin.className = 'pin'; pin.setAttribute('aria-hidden', 'true');
    pin.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 21.5 C9.5 18.5 5 14 5 9.5 A7 7 0 0 1 19 9.5 C19 14 14.5 18.5 12 21.5 Z" fill="none" stroke="var(--colors-text-primary)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.4 9.5 A2.6 2.6 0 1 0 14.6 9.5 A2.6 2.6 0 1 0 9.4 9.5 Z" fill="var(--colors-text-primary)"/></svg>';
    o.appendChild(pin);
    if (live) live.textContent = t('a11y.presenter.pointed').replace('{n}', String(p));
  }
  if (h.get('hint') === '1') {
    var hint = document.createElement('p'); hint.className = 'stage-hint'; hint.setAttribute('aria-hidden', 'true');
    hint.textContent = t(layout === 'overlay' ? 'nav.hintOverlay' : 'nav.hint');
    root.querySelector('.stage').appendChild(hint);
  }
  root.querySelectorAll('[data-layout-only]').forEach(function (el) { el.hidden = el.getAttribute('data-layout-only') !== layout; });

  ready(function () {
    if (bar && layout === 'docked') {
      // The wrap rule (section 5.1): one row holds everything, or the tools take a row above Previous and Next.
      if (bar.scrollWidth > bar.clientWidth + 0.5) bar.classList.add('wrapped');
      report.wrapped = bar.classList.contains('wrapped');
      report.band = Math.round(bar.getBoundingClientRect().height);
    }
    var stage = root.querySelector('.stage').getBoundingClientRect();
    report.stage = { x: round(stage.left), y: round(stage.top), w: round(stage.width), h: round(stage.height), unit: round(stage.width / 1280, 4) };
    var box = root.querySelector('.stage-box').getBoundingClientRect();
    report.box = { w: round(box.width), h: round(box.height) };
    report.controls = visibleControls().map(function (el) { var r = el.getBoundingClientRect(); return { label: (el.getAttribute('aria-label') || el.textContent).trim(), w: round(r.width), h: round(r.height), overflow: el.scrollWidth > el.clientWidth + 0.5 }; });
    report.clearance = clearance(h.get('dims') === '1');
    if (h.get('hint') === '1') report.hint = measureHint();
    report.sideScroll = document.documentElement.scrollWidth > innerWidth;
    report.ready = true;
  });

  function round(n, d) { var f = Math.pow(10, d || 1); return Math.round(n * f) / f; }
  function opacity(el) { var o = 1; for (var e = el; e && e !== document.documentElement; e = e.parentElement) { var cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= Number(cs.opacity); } return o; }
  function visibleControls() {
    var sel = layout === 'docked' ? '.bar.nav .ctl' : layout === 'rail' ? '.rail .ctl' : '.cbar .ctl';
    return Array.prototype.filter.call(root.querySelectorAll(sel), function (el) { return opacity(el) > 0 && el.getBoundingClientRect().width > 0; });
  }
  function dist(a, c) {
    var dx = Math.max(0, c.left - a.right, a.left - c.right), dy = Math.max(0, c.top - a.bottom, a.top - c.bottom);
    return { d: Math.sqrt(dx * dx + dy * dy), dx: dx, dy: dy };
  }
  // Section 5.0: the inert space between every content target box and every visible control hit box, in window px.
  function clearance(draw) {
    var targets = Array.prototype.map.call(root.querySelectorAll('.stage [data-stage-target]'), function (el) { return el.getBoundingClientRect(); });
    var ctrls = visibleControls().map(function (el) { return el.getBoundingClientRect(); });
    var best = null;
    targets.forEach(function (a) { ctrls.forEach(function (c) { var m = dist(a, c); if (!best || m.d < best.d) best = { d: m.d, dx: m.dx, dy: m.dy, a: a, c: c }; }); });
    var out = { min: best ? round(best.d) : null, met: best ? best.d >= px('var(--nav-clearance)') : null, targets: targets.length, controls: ctrls.length };
    if (!draw) return out;
    var layer = document.createElement('div'); layer.className = 'dims'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer);
    function rect(cls, l, tp, wd, ht) { var d = document.createElement('div'); d.className = cls; d.style.left = l + 'px'; d.style.top = tp + 'px'; d.style.width = Math.max(0, wd) + 'px'; d.style.height = Math.max(0, ht) + 'px'; layer.appendChild(d); return d; }
    targets.concat(ctrls).forEach(function (r) { rect('box', r.left, r.top, r.width, r.height); });
    if (!best) return out;
    var a = best.a, c = best.c, fail = !out.met, g;
    if (best.d === 0) {
      var l = Math.max(a.left, c.left), tp = Math.max(a.top, c.top);
      g = { l: l, t: tp, w: Math.min(a.right, c.right) - l, h: Math.min(a.bottom, c.bottom) - tp };
    } else if (best.dy === 0) {
      var top = Math.max(a.top, c.top), bot = Math.min(a.bottom, c.bottom);
      g = a.right <= c.left ? { l: a.right, t: top, w: c.left - a.right, h: bot - top } : { l: c.right, t: top, w: a.left - c.right, h: bot - top };
    } else if (best.dx === 0) {
      var lf = Math.max(a.left, c.left), rt = Math.min(a.right, c.right);
      g = a.bottom <= c.top ? { l: lf, t: a.bottom, w: rt - lf, h: c.top - a.bottom } : { l: lf, t: c.bottom, w: rt - lf, h: a.top - c.bottom };
    } else {
      var x0 = a.right <= c.left ? a.right : c.right, x1 = a.right <= c.left ? c.left : a.left;
      var y0 = a.bottom <= c.top ? a.bottom : c.bottom, y1 = a.bottom <= c.top ? c.top : a.top;
      g = { l: x0, t: y0, w: x1 - x0, h: y1 - y0 };
    }
    rect('gap' + (fail ? ' fail' : ''), g.l, g.t, g.w, g.h);
    // The label sits beside the gap, never over a control: left of a sideways gap (over the stage), right of an
    // upright one (over the band's padding or the letterbox).
    var lab = document.createElement('div'); lab.className = 'label' + (fail ? ' fail' : '');
    lab.textContent = round(best.d) + ' px';
    if (best.d > 0 && best.dy === 0) { lab.style.left = g.l + 'px'; lab.style.top = (g.t + g.h / 2) + 'px'; lab.style.transform = 'translate(calc(-100% - var(--spacing-xs)), -50%)'; }
    else if (best.d > 0 && best.dx === 0) { lab.style.left = (g.l + g.w) + 'px'; lab.style.top = (g.t + g.h / 2) + 'px'; lab.style.transform = 'translate(var(--spacing-xs), -50%)'; }
    else { lab.style.left = (g.l + g.w / 2) + 'px'; lab.style.top = (g.t + g.h / 2) + 'px'; }
    layer.appendChild(lab);
    return out;
  }
  // Section 9.3: the hint pill's size and what it covers on the first slide.
  function measureHint() {
    var el = root.querySelector('.stage-hint'); var r = el.getBoundingClientRect();
    var lh = parseFloat(getComputedStyle(el).lineHeight);
    var covers = [];
    root.querySelectorAll('.stage h1, .stage p:not(.stage-hint):not(.visually-hidden), .stage .bubble, .stage .opt, .stage .stage-btn, .stage svg.hoya-stage, .stage .counter').forEach(function (n) {
      var q = n.getBoundingClientRect(); var ox = Math.min(r.right, q.right) - Math.max(r.left, q.left), oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (ox > 0 && oy > 0) covers.push((n.className.baseVal != null ? n.className.baseVal : n.className) + ' ' + round(ox) + 'x' + round(oy));
    });
    return { w: round(r.width), h: round(r.height), lines: Math.round((r.height - parseFloat(getComputedStyle(el).paddingTop) * 2 - parseFloat(getComputedStyle(el).borderTopWidth) * 2) / lh), stagePad: round(parseFloat(getComputedStyle(root.querySelector('.stage')).paddingTop)), bottom: round(r.bottom - root.querySelector('.stage').getBoundingClientRect().top), covers: covers };
  }
  // nav-rail-labels.html: each rail label at 18 px inside its button; a word never breaks, so overflow means it does not fit.
  function measureBoard() {
    var rows = [];
    document.querySelectorAll('.label-board .ctl').forEach(function (el) {
      var s = el.querySelector('span'); var lh = parseFloat(getComputedStyle(s).lineHeight);
      var over = el.scrollWidth > el.clientWidth + 0.5 || s.scrollWidth > s.clientWidth + 0.5 || s.getBoundingClientRect().width > el.clientWidth + 0.5;
      var lines = Math.round(s.getBoundingClientRect().height / lh);
      // The longest word against the room inside the border and padding (a word never breaks).
      var cs = getComputedStyle(el), room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var m = document.createElement('span'); m.style.whiteSpace = 'nowrap'; m.style.position = 'absolute'; m.style.visibility = 'hidden'; el.appendChild(m);
      var word = 0; s.textContent.split(/\s+/).forEach(function (wd) { m.textContent = wd; word = Math.max(word, m.getBoundingClientRect().width); }); el.removeChild(m);
      over = over || word > room + 0.5;
      if (over || lines > 2) el.classList.add('over');
      var r = el.getBoundingClientRect();
      rows.push({ lang: el.closest('[lang]').getAttribute('lang'), key: el.getAttribute('data-key'), label: s.textContent, box: round(r.width) + ' x ' + round(r.height), word: round(word) + ' / ' + round(room), lines: lines, fits: !over && lines <= 2 });
    });
    var tb = document.querySelector('#board-results tbody');
    rows.forEach(function (r) { var tr = document.createElement('tr'); [r.lang, r.key, r.label, r.box, r.word, String(r.lines), r.fits ? 'fits' : 'does not fit'].forEach(function (v) { var td = document.createElement('td'); td.textContent = v; tr.appendChild(td); }); tb.appendChild(tr); });
    report.board = rows;
  }
})();
