(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Page loader / welcome animation ---------------- */
  var loader = document.querySelector('[data-page-loader]');
  var loaderCount = document.querySelector('[data-pl-count]');

  function runLoader() {
    if (!loader) {
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-loaded');
      return;
    }

    if (reducedMotion) {
      loader.classList.add('is-hidden');
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-loaded');
      window.setTimeout(function () { loader.remove(); }, 400);
      return;
    }

    // Animate a counter 0 → 100 over ~1.6s
    var start = performance.now();
    var duration = 1600;
    function tick(now) {
      var t = Math.min(1, (now - start) / duration);
      var v = Math.floor(t * 100);
      if (loaderCount) loaderCount.textContent = String(v).padStart(3, '0');
      if (t < 1) requestAnimationFrame(tick); else finish();
    }
    function finish() {
      loader.classList.add('is-hidden');
      document.body.classList.remove('is-loading');
      document.body.classList.add('is-loaded');
      window.setTimeout(function () { if (loader && loader.parentNode) loader.parentNode.removeChild(loader); }, 900);
    }
    requestAnimationFrame(tick);
  }

  // Kick off loader on load event so images/fonts are (mostly) ready
  if (document.readyState === 'complete') {
    runLoader();
  } else {
    window.addEventListener('load', runLoader);
    // Safety: never keep the loader forever
    window.setTimeout(runLoader, 3500);
  }

  /* ---------------- Scroll reveal ---------------- */
  var revealTargets = document.querySelectorAll(
    '.highlight-item, .card, .gallery-item, .journal-item, .gear-item, .section-head, .hero-heading, .hero-sub, .hero-count, .detail-title, .detail-cover, .about-copy, .about-facts, .fact'
  );
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  if (!reducedMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------------- Parallax on hero/cover images ---------------- */
  var parallaxTargets = document.querySelectorAll('.detail-cover .pic, .highlight-item .pic');
  if (!reducedMotion && parallaxTargets.length && 'IntersectionObserver' in window) {
    var visible = new Set();
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target);
      });
    }, { threshold: 0 });
    parallaxTargets.forEach(function (el) {
      pio.observe(el);
      el.style.willChange = 'transform';
      var img = el.querySelector('img');
      if (img) { img.style.willChange = 'transform'; img.style.transform = 'translate3d(0,0,0) scale(1.08)'; }
    });
    var ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var vh = window.innerHeight;
        visible.forEach(function (el) {
          var img = el.querySelector('img'); if (!img) return;
          var rect = el.getBoundingClientRect();
          var progress = (rect.top + rect.height / 2) / vh; // ~0 at top, 1 at bottom
          var shift = (0.5 - progress) * 30; // ±15px
          img.style.transform = 'translate3d(0,' + shift.toFixed(2) + 'px,0) scale(1.08)';
        });
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- Mobile / overlay nav ---------------- */
  var toggle = document.querySelector('[data-nav-toggle]');
  var overlay = document.querySelector('[data-nav-overlay]');

  function setNavOpen(open) {
    if (!toggle || !overlay) return;
    toggle.setAttribute('aria-expanded', String(open));
    overlay.classList.toggle('is-open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (toggle && overlay) {
    toggle.addEventListener('click', function () {
      var isOpen = toggle.getAttribute('aria-expanded') === 'true';
      setNavOpen(!isOpen);
    });
    overlay.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setNavOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setNavOpen(false);
    });
  }

  /* ---------------- Lightbox ---------------- */
  var lightbox = document.querySelector('[data-lightbox]');
  if (!lightbox) return;

  var lightboxImg = lightbox.querySelector('[data-lightbox-img]');
  var lightboxCaption = lightbox.querySelector('[data-lightbox-caption]');
  var lightboxInfo = lightbox.querySelector('[data-lightbox-info]');
  var closeBtn = lightbox.querySelector('[data-lightbox-close]');
  var prevBtn = lightbox.querySelector('[data-lightbox-prev]');
  var nextBtn = lightbox.querySelector('[data-lightbox-next]');

  var groups = {};
  document.querySelectorAll('[data-lightbox-trigger]').forEach(function (el) {
    var group = el.getAttribute('data-lightbox-group') || 'default';
    groups[group] = groups[group] || [];
    groups[group].push(el);
  });

  var activeGroup = null;
  var activeIndex = 0;

  function renderSlide() {
    if (!activeGroup) return;
    var el = groups[activeGroup][activeIndex];
    var full = el.getAttribute('data-full') || el.getAttribute('data-lightbox-trigger');
    lightboxImg.src = full;
    lightboxImg.alt = el.getAttribute('data-alt') || '';
    lightboxCaption.textContent = el.getAttribute('data-caption') || '';
    lightboxCaption.style.display = lightboxCaption.textContent ? '' : 'none';

    var infoBits = [
      el.getAttribute('data-camera'),
      el.getAttribute('data-lens'),
      el.getAttribute('data-aperture'),
      el.getAttribute('data-shutter'),
      el.getAttribute('data-iso') ? 'ISO ' + el.getAttribute('data-iso') : '',
      el.getAttribute('data-focal-length'),
      el.getAttribute('data-taken-at'),
    ].filter(Boolean);
    lightboxInfo.innerHTML = '';
    infoBits.forEach(function (bit) {
      var span = document.createElement('span');
      span.textContent = bit;
      lightboxInfo.appendChild(span);
    });

    var multi = groups[activeGroup].length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
  }

  function openLightbox(group, index) {
    activeGroup = group;
    activeIndex = index;
    renderSlide();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lightboxImg.src = '';
  }

  function step(delta) {
    if (!activeGroup) return;
    var list = groups[activeGroup];
    activeIndex = (activeIndex + delta + list.length) % list.length;
    renderSlide();
  }

  Object.keys(groups).forEach(function (group) {
    groups[group].forEach(function (el, index) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openLightbox(group, index);
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(group, index);
        }
      });
    });
  });

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', function () { step(-1); });
  nextBtn.addEventListener('click', function () { step(1); });
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  // Touch swipe on mobile
  var touchStartX = null;
  lightbox.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) touchStartX = e.touches[0].clientX;
  }, { passive: true });
  lightbox.addEventListener('touchend', function (e) {
    if (touchStartX == null) return;
    var dx = (e.changedTouches[0].clientX - touchStartX);
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchStartX = null;
  });
  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
})();
