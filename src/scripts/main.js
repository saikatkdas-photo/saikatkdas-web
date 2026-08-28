(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Welcome intro (homepage reload) ---------------- */
  var intro = document.querySelector('[data-intro]');
  var introCount = document.querySelector('[data-intro-count]');
  var introStarted = false;
  var introFinished = false;
  var introConfig = { timings: {}, playOn: 'reload', honorReduced: true, photoFitLandscape: 'contain' };
  try {
    var cfgEl = document.querySelector('[data-intro-config]');
    if (cfgEl) introConfig = Object.assign(introConfig, JSON.parse(cfgEl.textContent));
  } catch (err) {}
  var T = Object.assign({
    letters_in: 80,
    canvas_open: 1200,
    photo_in: 2100,
    photo_zoom: 2800,
    shutter: 5600,
    name_expand: 6600,
    name_out: 8600,
    total: 10400
  }, introConfig.timings || {});
  var INTRO_TOTAL = T.total;

  function finishIntro() {
    if (!intro || introFinished) return;
    introFinished = true;
    document.body.classList.remove('has-intro');
    document.body.classList.add('intro-done');
    intro.classList.add('is-gone');
    window.setTimeout(function () { if (intro && intro.parentNode) intro.parentNode.removeChild(intro); }, 1100);
    window.dispatchEvent(new Event('resize'));
  }

  function skipIntro() {
    if (!intro) return;
    introStarted = true;
    introFinished = true;
    document.body.classList.remove('has-intro');
    document.body.classList.add('intro-done');
    intro.parentNode && intro.parentNode.removeChild(intro);
    window.dispatchEvent(new Event('resize'));
  }

  function bindIntroViewport(el) {
    function apply() {
      var vv = window.visualViewport;
      if (!vv) return;
      el.style.left = vv.offsetLeft + 'px';
      el.style.top = vv.offsetTop + 'px';
      el.style.width = vv.width + 'px';
      el.style.height = vv.height + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }
    apply();
    window.addEventListener('resize', apply);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', apply);
      window.visualViewport.addEventListener('scroll', apply);
    }
  }

  function runIntro() {
    if (!intro || introStarted) return;
    introStarted = true;
    if (introConfig.honorReduced !== false && reducedMotion) { skipIntro(); return; }
    if (introConfig.playOn === 'once') {
      try {
        if (window.sessionStorage.getItem('skd-intro-played')) { skipIntro(); return; }
        window.sessionStorage.setItem('skd-intro-played', '1');
      } catch (err) {}
    }

    bindIntroViewport(intro);
    if (introConfig.photoFitLandscape === 'cover') intro.classList.add('intro-fit-cover');

    var start = performance.now();
    function tick(now) {
      var t = Math.min(1, (now - start) / INTRO_TOTAL);
      if (introCount) introCount.textContent = String(Math.floor(t * 100)).padStart(3, '0');
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    window.setTimeout(function () { intro.classList.add('intro-p1'); }, T.letters_in);
    window.setTimeout(function () { intro.classList.add('intro-p2'); }, T.canvas_open);
    window.setTimeout(function () { intro.classList.add('intro-p3'); }, T.photo_in);
    window.setTimeout(function () { intro.classList.add('intro-p4'); }, T.photo_zoom);
    window.setTimeout(function () { intro.classList.add('intro-p5', 'is-light'); }, T.shutter);
    window.setTimeout(function () { intro.classList.add('intro-p6'); }, T.name_expand);
    window.setTimeout(function () { intro.classList.add('intro-p7'); finishIntro(); }, T.name_out);

    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { finishIntro(); document.removeEventListener('keydown', esc); }
    });
  }

  if (intro) {
    if (document.readyState === 'complete') runIntro();
    else window.addEventListener('load', runIntro);
    window.setTimeout(function () { if (!introStarted) runIntro(); }, 5000);
  } else {
    document.body.classList.add('intro-done');
  }

  /* ---------------- Selected: pin + convert vertical scroll to horizontal --- */
  var selectedSection = document.querySelector('[data-selected]');
  var selectedSticky = document.querySelector('[data-selected-sticky]');
  var highlightTrack = document.querySelector('[data-highlight-track]') || document.querySelector('.highlight-track');
  if (selectedSection && selectedSticky && highlightTrack) {
    var extraX = 0;

    function measureSelected() {
      extraX = Math.max(0, highlightTrack.scrollWidth - highlightTrack.clientWidth);
      selectedSection.style.height = extraX > 8
        ? (selectedSticky.offsetHeight + extraX) + 'px'
        : '';
      syncSelected();
    }

    function syncSelected() {
      if (extraX <= 0) return;
      var top = selectedSection.getBoundingClientRect().top;
      var scrolled = Math.min(extraX, Math.max(0, -top));
      if (Math.abs(highlightTrack.scrollLeft - scrolled) > 0.5) {
        highlightTrack.scrollLeft = scrolled;
      }
    }

    var selectedTick = false;
    function onSelectedScroll() {
      if (selectedTick) return;
      selectedTick = true;
      requestAnimationFrame(function () {
        syncSelected();
        selectedTick = false;
      });
    }

    window.addEventListener('scroll', onSelectedScroll, { passive: true });
    window.addEventListener('resize', measureSelected);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(measureSelected).observe(highlightTrack);
    }
    highlightTrack.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', measureSelected);
    });
    window.setTimeout(measureSelected, 60);
    window.setTimeout(measureSelected, 800);

    highlightTrack.addEventListener('wheel', function (e) {
      if (extraX <= 2) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) && e.deltaX !== 0) return;
      e.preventDefault();
      window.scrollBy(0, e.deltaY + e.deltaX);
    }, { passive: false });

    var drag = { active: false, moved: false, startX: 0, startY: 0, pointerId: null };
    highlightTrack.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      drag.active = true;
      drag.moved = false;
      drag.startX = e.clientX;
      drag.startY = window.scrollY;
      drag.pointerId = e.pointerId;
      highlightTrack.setPointerCapture(e.pointerId);
    });
    highlightTrack.addEventListener('pointermove', function (e) {
      if (!drag.active) return;
      var dx = e.clientX - drag.startX;
      if (Math.abs(dx) > 4) drag.moved = true;
      window.scrollTo(0, drag.startY - dx);
    });
    function endDrag(e) {
      if (!drag.active) return;
      drag.active = false;
      if (e && drag.pointerId != null) {
        try { highlightTrack.releasePointerCapture(drag.pointerId); } catch (err) {}
      }
    }
    highlightTrack.addEventListener('pointerup', endDrag);
    highlightTrack.addEventListener('pointercancel', endDrag);
    highlightTrack.addEventListener('click', function (e) {
      if (drag.moved) { e.preventDefault(); e.stopPropagation(); }
      drag.moved = false;
    }, true);
  }

  /* ---------------- Scroll reveal ---------------- */
  var revealTargets = document.querySelectorAll(
    '.card, .gallery-item, .journal-item, .gear-item, .section-head, .hero-heading, .hero-sub, .hero-count, .detail-title, .detail-cover, .about-copy, .about-facts, .fact, .selected-head'
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
