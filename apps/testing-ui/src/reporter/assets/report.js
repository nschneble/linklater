// Minimal tab controller for the screenshot views. Keeps the report a single
// flat HTML file with no build step. Activates the default tab declared by
// each action card and supports left/right arrow navigation per WAI-ARIA tabs
// pattern.
(function () {
  function setupTabs(container) {
    var buttons = Array.prototype.slice.call(
      container.querySelectorAll('[role="tab"]'),
    );
    var panels = Array.prototype.slice.call(
      container.querySelectorAll('[role="tabpanel"]'),
    );
    var defaultTab =
      container.getAttribute('data-default-tab') ||
      (buttons.find(function (button) {
        return button.getAttribute('aria-disabled') !== 'true';
      }) || buttons[0]).getAttribute('data-tab');

    function activate(target) {
      buttons.forEach(function (button) {
        var isActive = button.getAttribute('data-tab') === target;
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        button.tabIndex = isActive ? 0 : -1;
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-tab') !== target;
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.getAttribute('aria-disabled') === 'true') return;
        activate(button.getAttribute('data-tab'));
        button.focus();
      });
      button.addEventListener('keydown', function (event) {
        var index = buttons.indexOf(button);
        var next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        else if (event.key === 'ArrowLeft')
          next = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault();
        var target = buttons[next];
        if (target.getAttribute('aria-disabled') === 'true') {
          target = buttons[index];
        }
        activate(target.getAttribute('data-tab'));
        target.focus();
      });
    });

    activate(defaultTab);
  }

  document
    .querySelectorAll('.screenshots')
    .forEach(function (container) {
      setupTabs(container);
    });
})();
