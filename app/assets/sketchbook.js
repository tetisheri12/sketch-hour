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
