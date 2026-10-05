// Leo Tech: theme toggle, mobile menu, header state, scroll reveal and the WhatsApp enquiry form.
(function () {
  'use strict';

  var root = document.documentElement;
  var WHATSAPP_NUMBER = '917339009351';
  root.classList.add('js');

  // ---- theme ----
  var toggle = document.querySelector('.theme-toggle');
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('img[data-src-dark]').forEach(function (img) {
      img.src = theme === 'light' ? img.dataset.srcLight : img.dataset.srcDark;
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F6F8FC' : '#070B14');
    if (toggle) toggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
  }
  applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try { localStorage.setItem('leo-theme', next); } catch (e) { /* private mode: theme just won't persist */ }
    });
  }

  // ---- mobile menu ----
  var menuBtn = document.querySelector('.menu-toggle');
  var nav = document.getElementById('mainNav');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  // ---- header border once the page scrolls ----
  var header = document.querySelector('.site-header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- reveal on scroll ----
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // ---- enquiry form: builds a WhatsApp message ----
  var form = document.getElementById('enquiryForm');
  if (form) {
    var error = document.getElementById('formError');
    // look fields up by name explicitly: form.name would be the form's own name property
    var field = function (n) { return form.elements.namedItem(n); };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = field('name').value.trim();
      var phone = field('phone').value.trim();
      var missing = [];
      [[field('name'), name], [field('phone'), phone]].forEach(function (pair) {
        pair[0].setAttribute('aria-invalid', pair[1] ? 'false' : 'true');
        if (!pair[1]) missing.push(pair[0].name === 'name' ? 'name' : 'phone number');
      });
      if (missing.length) {
        error.textContent = 'Please enter your ' + missing.join(' and ') + '.';
        error.hidden = false;
        (name ? field('phone') : field('name')).focus();
        return;
      }
      error.hidden = true;
      var lines = [
        'Hi Leo Tech, I would like a quotation.',
        'Name: ' + name,
        'Phone: ' + phone,
        'Service: ' + field('service').value,
      ];
      var msg = field('message').value.trim();
      if (msg) lines.push('Details: ' + msg);
      window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
    });
  }

  // ---- spotlight: cards track the pointer for their border glow ----
  if (window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.card');
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
