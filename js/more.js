/* ============================================================
   More dropdown — keyboard-accessible navigation (v10.1)
   Wires every .topnav__more menu: click/keyboard toggle,
   Escape to close, outside-click & focus-out close.
   Pure progressive enhancement: the menu still opens on
   :hover / :focus-within via CSS even if JS is unavailable.
   ============================================================ */
(function () {
  'use strict';

  function initMore(root) {
    var more = (root || document).querySelector('.topnav__more');
    if (!more) return;
    var btn = more.querySelector('#moreToggle');
    var menu = more.querySelector('.dropdown');
    if (!btn || !menu) return;

    function open() {
      more.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
    function close() {
      more.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function toggle() {
      if (more.classList.contains('open')) close();
      else open();
    }

    // click toggles (also keeps it open for touch / non-hover)
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      toggle();
    });

    // Escape closes and returns focus to the trigger
    more.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        close();
        btn.focus();
      }
    });

    // close when focus leaves the whole menu (e.g. Tab past last item)
    more.addEventListener('focusout', function (e) {
      if (!more.contains(e.relatedTarget)) close();
    });

    // close on any outside click
    document.addEventListener('click', function (e) {
      if (!more.contains(e.target)) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initMore(); });
  } else {
    initMore();
  }
})();
