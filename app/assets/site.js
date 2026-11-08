/* Website pages: the compact menu on narrow screens. Without this script the links simply wrap under the brand. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  function init() {
    var btn = document.querySelector('.menu-btn');
    var menu = document.getElementById('site-menu');
    if (!btn || !menu) return;

    function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }
    function setOpen(open, returnFocus) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open && returnFocus) btn.focus();
    }

    btn.addEventListener('click', function () { setOpen(!isOpen()); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) setOpen(false, true);
    });
    document.addEventListener('click', function (e) {
      if (isOpen() && !e.target.closest('.top')) setOpen(false);
    });
    menu.addEventListener('focusout', function (e) {
      if (isOpen() && e.relatedTarget && !e.relatedTarget.closest('.top')) setOpen(false);
    });
    var wide = window.matchMedia('(min-width: 900px)');
    var onWide = function () { if (wide.matches) setOpen(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else wide.addListener(onWide);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
