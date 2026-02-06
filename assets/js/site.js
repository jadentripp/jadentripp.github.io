(function () {
  var buttons = document.querySelectorAll('.filter-btn');
  var cards = document.querySelectorAll('#art-grid .card-art');
  var status = document.getElementById('art-filter-status');
  var tagParam = 'tag';

  if (!buttons.length || !cards.length) return;

  function setFilter(filter, shouldUpdateUrl) {
    var active = filter || 'all';

    buttons.forEach(function (btn) {
      var isActive = btn.getAttribute('data-filter') === active;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    var visibleCount = 0;
    cards.forEach(function (card) {
      var tags = (card.getAttribute('data-tags') || '').split(',');
      var show = active === 'all' || tags.indexOf(active) !== -1;
      card.classList.toggle('is-hidden', !show);
      card.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (show) visibleCount += 1;
    });

    if (status) {
      status.textContent =
        active === 'all'
          ? visibleCount + ' artworks shown'
          : visibleCount + ' artworks shown for tag ' + active;
    }

    if (shouldUpdateUrl) {
      var url = new URL(window.location.href);
      if (active === 'all') {
        url.searchParams.delete(tagParam);
      } else {
        url.searchParams.set(tagParam, active);
      }
      window.history.replaceState({}, '', url.toString());
    }
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      setFilter(button.getAttribute('data-filter') || 'all', true);
    });
  });

  var urlFilter = new URL(window.location.href).searchParams.get(tagParam) || 'all';
  var hasMatch = Array.prototype.some.call(buttons, function (button) {
    return button.getAttribute('data-filter') === urlFilter;
  });
  setFilter(hasMatch ? urlFilter : 'all', false);
})();
