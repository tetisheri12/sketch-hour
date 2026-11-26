// Preview helper for the sketchbook home page: "Show drawing names" outlines every hand-drawn
// mark and labels it with its file name in assets/img/drawings/. Opening the page with #names
// in the address turns the labels on straight away.
(function () {
  var button = document.getElementById('names-toggle');
  if (!button) return;
  function show(on) {
    document.body.classList.toggle('show-names', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.textContent = on ? 'Hide drawing names' : 'Show drawing names';
  }
  button.addEventListener('click', function () {
    show(!document.body.classList.contains('show-names'));
  });
  if (location.hash === '#names') show(true);
})();

// Polaroids that react to the mouse. Moving across the picture sets --x (0-100%): the photo wipes to its
// values, perspective guides draw over the road, the timer turns into the practice log. An invisible range input on top
// does the same for touch (drag) and keyboard (arrow keys). Each one gives a small nudge the first time
// it scrolls into view, so it is clear it can be played with.
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  [].forEach.call(document.querySelectorAll('.scrub'), function (fig) {
    var box = fig.querySelector('.cmp'), range = fig.querySelector('.cmp-range');
    if (!box || !range) return;
    function set(v) {
      v = Math.max(0, Math.min(100, v));
      range.value = Math.round(v);
      fig.style.setProperty('--x', v + '%');
      if (fig.querySelector('.vp')) fig.classList.toggle('vp-on', v < 48.1);
    }
    range.addEventListener('input', function () { set(+range.value); });
    box.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = box.getBoundingClientRect();
      set((e.clientX - r.left) / r.width * 100);
    });
    var start = +range.value;
    set(start);
    // when the mouse leaves, ease back to where it started
    box.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (!reduce) { fig.classList.add('nudging'); setTimeout(function () { fig.classList.remove('nudging'); }, 750); }
      set(start);
    });
    if (reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      fig.classList.add('nudging');
      setTimeout(function () { set(start + 30); }, 250);
      setTimeout(function () { set(start); }, 1050);
      setTimeout(function () { fig.classList.remove('nudging'); }, 1800);
    }, { threshold: 0.6 });
    io.observe(fig);
  });
})();
