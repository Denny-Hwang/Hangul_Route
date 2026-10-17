// Design mock helper (not shipped code). #b=<n> shows builds 0..n of the slide (default: every build);
// [data-until=n] is shown only up to build n; #v=<name> picks a variant section; #bar=hidden fades the bar as the 3 s auto-hide does; #gray=1 renders in greyscale.
(function () {
  var h = new URLSearchParams(location.hash.slice(1));
  var b = h.get('b');
  document.querySelectorAll('[data-b]').forEach(function (el) {
    if (b !== null && Number(el.getAttribute('data-b')) > Number(b)) el.classList.add('later');
  });
  document.querySelectorAll('[data-until]').forEach(function (el) {
    if (b === null || Number(b) > Number(el.getAttribute('data-until'))) el.classList.add('gone');
  });
  var stage = document.querySelector('.slide-quiz');
  if (stage && (b === null || Number(b) >= 1)) stage.classList.add('revealed');
  var max = -1; document.querySelectorAll('.stage [data-b]').forEach(function (el) { max = Math.max(max, Number(el.getAttribute('data-b'))); });
  var nb = document.querySelector('[data-reveal]');
  if (nb && max >= 0) nb.querySelector('span').textContent = (b !== null && Number(b) < max) ? nb.getAttribute('data-reveal') : nb.getAttribute('data-next');
  var v = h.get('v');
  if (v) document.querySelectorAll('[data-v]').forEach(function (el) { el.hidden = el.getAttribute('data-v') !== v; });
  else document.querySelectorAll('[data-v]').forEach(function (el, i) { el.hidden = el.hasAttribute('data-v-default') ? false : true; });
  if (h.get('bar') === 'hidden') document.querySelectorAll('.bar, .cbar').forEach(function (el) { el.classList.add('hidden'); }); // .cbar: the phone's compact bar (2026-10-16)
  if (h.get('gray') === '1') document.documentElement.style.filter = 'grayscale(1)';
})();
