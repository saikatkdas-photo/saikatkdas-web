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
    letters_dock: 1300,
    canvas_open: 2300,
    photo_in: 3100,
    photo_zoom: 3800,
    shutter: 6400,
    name_expand: 7400,
    name_out: 9400,
    total: 11200
  }, introConfig.timings || {});
  var INTRO_TOTAL = T.total;
  applyIntroFont(introConfig);

  function applyIntroFont(cfg) {
    var key = cfg.introFont && cfg.introFont.key;
    try {
      var q = new URLSearchParams(window.location.search).get('introFont');
      if (q) key = q;
    } catch (err) {}
    var spec = (cfg.introFonts && cfg.introFonts[key]) || cfg.introFont;
    if (!spec || !spec.family) return;
    document.documentElement.style.setProperty('--font-intro', spec.family);
    if (spec.weight) document.documentElement.style.setProperty('--font-intro-weight', String(spec.weight));
  }

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
    if (introConfig.honorReduced !== false && reducedMotion) { applyIntroFont(introConfig); skipIntro(); return; }
    if (introConfig.playOn === 'once') {
      try {
        if (window.sessionStorage.getItem('skd-intro-played')) { skipIntro(); return; }
        window.sessionStorage.setItem('skd-intro-played', '1');
      } catch (err) {}
    }

    bindIntroViewport(intro);
    if (introConfig.photoFitLandscape === 'cover') intro.classList.add('intro-fit-cover');
    applyIntroFont(introConfig);

    var start = performance.now();
    function tick(now) {
      var t = Math.min(1, (now - start) / INTRO_TOTAL);
      if (introCount) introCount.textContent = String(Math.floor(t * 100)).padStart(3, '0');
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    window.setTimeout(function () { intro.classList.add('intro-p1'); }, T.letters_in);
    window.setTimeout(function () { intro.classList.add('intro-dock'); }, T.letters_dock);
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
    '.card, .gallery-item, .journal-item, .gear-item, .section-head, .hero-heading, .hero-sub, .hero-count, .detail-title, .detail-cover, .about-copy, .about-facts, .fact, .selected-head, .timeline-year, .timeline-hero'
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
  var lightboxStory = lightbox.querySelector('[data-lightbox-story]');
  var lightboxCounter = lightbox.querySelector('[data-lightbox-counter]');
  var lightboxBar = lightbox.querySelector('.lightbox-bar');
  var closeBtn = lightbox.querySelector('[data-lightbox-close]');
  var prevBtn = lightbox.querySelector('[data-lightbox-prev]');
  var nextBtn = lightbox.querySelector('[data-lightbox-next]');
  var stage = lightbox.querySelector('[data-lightbox-stage]');
  var sheet = lightbox.querySelector('[data-lightbox-sheet]');
  var sheetHandle = lightbox.querySelector('[data-sheet-handle]');
  var sheetTitle = lightbox.querySelector('[data-sheet-title]');
  var sheetKind = lightbox.querySelector('[data-sheet-kind]');
  var sheetSummary = lightbox.querySelector('[data-sheet-summary]');
  var sheetLink = lightbox.querySelector('[data-sheet-link]');

  var groups = {};
  document.querySelectorAll('[data-lightbox-trigger]').forEach(function (el) {
    var group = el.getAttribute('data-lightbox-group') || 'default';
    groups[group] = groups[group] || [];
    groups[group].push(el);
  });

  var activeGroup = null;
  var activeIndex = 0;
  var zoom = { scale: 1, x: 0, y: 0 };
  var pointers = {};
  var pinch = { dist: 0, scale: 1 };
  var pan = { x: 0, y: 0, zoomX: 0, zoomY: 0 };
  var lastTap = 0;
  var didPinch = false;
  var sheetOpen = false;
  var sheetDrag = { active: false, startY: 0, lastY: 0 };

  function applyZoom() {
    lightboxImg.style.transform = 'translate(' + zoom.x + 'px,' + zoom.y + 'px) scale(' + zoom.scale + ')';
    if (stage) stage.classList.toggle('is-zoomed', zoom.scale > 1.02);
  }

  function resetZoom() {
    zoom.scale = 1;
    zoom.x = 0;
    zoom.y = 0;
    applyZoom();
  }

  function zoomAt(clientX, clientY, nextScale) {
    if (!stage) return;
    nextScale = Math.min(4, Math.max(1, nextScale));
    var rect = stage.getBoundingClientRect();
    var px = clientX - rect.left - rect.width / 2;
    var py = clientY - rect.top - rect.height / 2;
    var ratio = nextScale / (zoom.scale || 1);
    zoom.x = px - (px - zoom.x) * ratio;
    zoom.y = py - (py - zoom.y) * ratio;
    zoom.scale = nextScale;
    if (zoom.scale <= 1.02) {
      zoom.scale = 1;
      zoom.x = 0;
      zoom.y = 0;
    }
    applyZoom();
  }

  function pointerList() {
    return Object.keys(pointers).map(function (id) { return pointers[id]; });
  }

  function distBetween(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function setSheetOpen(open) {
    sheetOpen = Boolean(open);
    if (!sheet) return;
    sheet.classList.toggle('is-open', sheetOpen);
    lightbox.classList.toggle('is-sheet-open', sheetOpen);
  }

  function showSheet(el) {
    if (!sheet) return;
    var href = el.getAttribute('data-parent-href');
    var title = el.getAttribute('data-parent-title') || '';
    if (!href || !title) {
      sheet.hidden = true;
      lightbox.classList.remove('has-sheet', 'is-sheet-open');
      setSheetOpen(false);
      return;
    }
    var kind = el.getAttribute('data-parent-kind') || 'Series';
    var summary = el.getAttribute('data-parent-summary') || '';
    sheet.hidden = false;
    lightbox.classList.add('has-sheet');
    sheetTitle.textContent = title;
    sheetKind.textContent = kind;
    sheetSummary.textContent = summary;
    sheetSummary.style.display = summary ? '' : 'none';
    sheetLink.href = href;
    sheetLink.textContent = 'Open ' + kind.toLowerCase();
    setSheetOpen(false);
  }

  function renderSlide() {
    if (!activeGroup) return;
    var el = groups[activeGroup][activeIndex];
    var full = el.getAttribute('data-full') || el.getAttribute('data-lightbox-trigger');
    resetZoom();
    lightboxImg.src = full;
    lightboxImg.alt = el.getAttribute('data-alt') || '';

    var caption = el.getAttribute('data-caption') || '';
    lightboxCaption.textContent = caption;
    lightboxCaption.hidden = !caption;

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
    lightboxInfo.hidden = infoBits.length === 0;

    var story = el.getAttribute('data-story') || '';
    lightboxStory.textContent = story;
    lightboxStory.hidden = !story;

    var list = groups[activeGroup];
    var multi = list.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
    if (lightboxBar) lightboxBar.hidden = !multi;
    if (lightboxCounter) {
      lightboxCounter.textContent = multi ? (activeIndex + 1) + ' / ' + list.length : '';
    }

    showSheet(el);
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
    lightbox.classList.remove('is-open', 'has-sheet', 'is-sheet-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lightboxImg.src = '';
    resetZoom();
    setSheetOpen(false);
    if (sheet) sheet.hidden = true;
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

  if (stage) {
    stage.addEventListener('wheel', function (e) {
      if (!lightbox.classList.contains('is-open')) return;
      e.preventDefault();
      var factor = e.deltaY > 0 ? 0.92 : 1.08;
      zoomAt(e.clientX, e.clientY, zoom.scale * factor);
    }, { passive: false });

    stage.addEventListener('dblclick', function (e) {
      e.preventDefault();
      if (zoom.scale > 1.05) resetZoom();
      else zoomAt(e.clientX, e.clientY, 2.4);
    });

    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      stage.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
      var pts = pointerList();
      if (pts.length === 2) {
        didPinch = true;
        pinch.dist = distBetween(pts[0], pts[1]);
        pinch.scale = zoom.scale;
      } else {
        didPinch = false;
        pan.x = e.clientX;
        pan.y = e.clientY;
        pan.zoomX = zoom.x;
        pan.zoomY = zoom.y;
      }
    });

    stage.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId].x = e.clientX;
      pointers[e.pointerId].y = e.clientY;
      var pts = pointerList();
      if (pts.length === 2 && pinch.dist) {
        var d = distBetween(pts[0], pts[1]);
        var midX = (pts[0].x + pts[1].x) / 2;
        var midY = (pts[0].y + pts[1].y) / 2;
        zoomAt(midX, midY, pinch.scale * (d / pinch.dist));
        return;
      }
      if (pts.length === 1 && zoom.scale > 1.05) {
        zoom.x = pan.zoomX + (e.clientX - pan.x);
        zoom.y = pan.zoomY + (e.clientY - pan.y);
        applyZoom();
      }
    });

    function endPointer(e) {
      var rec = pointers[e.pointerId];
      delete pointers[e.pointerId];
      var remaining = pointerList();
      if (remaining.length === 1) {
        pan.x = remaining[0].x;
        pan.y = remaining[0].y;
        pan.zoomX = zoom.x;
        pan.zoomY = zoom.y;
        pinch.dist = 0;
      }
      if (remaining.length === 0 && rec && zoom.scale <= 1.02 && !didPinch) {
        var dx = e.clientX - rec.startX;
        var dy = e.clientY - rec.startY;
        if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          step(dx < 0 ? 1 : -1);
        } else if (e.pointerType !== 'mouse') {
          var now = Date.now();
          if (now - lastTap < 280 && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
            zoomAt(e.clientX, e.clientY, 2.4);
            lastTap = 0;
          } else {
            lastTap = now;
          }
        }
      }
      if (remaining.length === 0) didPinch = false;
    }

    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
  }

  function bindSheetDrag() {
    if (!sheet || !sheetHandle) return;
    var peek = sheet.querySelector('.lightbox-sheet-peek');

    function onDown(e) {
      if (window.matchMedia('(min-width: 800px)').matches) return;
      sheetDrag.active = true;
      sheetDrag.startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      sheetDrag.lastY = sheetDrag.startY;
      sheet.classList.add('is-dragging');
    }
    function onMove(e) {
      if (!sheetDrag.active) return;
      var y = e.clientY || (e.touches && e.touches[0].clientY);
      if (y == null) return;
      sheetDrag.lastY = y;
      var dy = y - sheetDrag.startY;
      var collapsed = sheet.offsetHeight - 88;
      var base = sheetOpen ? 0 : collapsed;
      var next = Math.min(collapsed, Math.max(0, base + dy));
      sheet.style.transform = 'translateY(' + next + 'px)';
    }
    function onUp() {
      if (!sheetDrag.active) return;
      sheetDrag.active = false;
      sheet.classList.remove('is-dragging');
      sheet.style.transform = '';
      var dy = sheetDrag.lastY - sheetDrag.startY;
      if (dy < -48) setSheetOpen(true);
      else if (dy > 48) setSheetOpen(false);
    }

    sheetHandle.addEventListener('pointerdown', onDown);
    if (peek) peek.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    function toggleOrIgnore(e) {
      if (window.matchMedia('(min-width: 800px)').matches) return;
      if (Math.abs(sheetDrag.lastY - sheetDrag.startY) > 12) return;
      e.preventDefault();
      setSheetOpen(!sheetOpen);
    }
    sheetHandle.addEventListener('click', toggleOrIgnore);
    if (peek) peek.addEventListener('click', toggleOrIgnore);
  }
  bindSheetDrag();

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
    if (e.key === '+' || e.key === '=') zoomAt(window.innerWidth / 2, window.innerHeight / 2, zoom.scale * 1.2);
    if (e.key === '-' || e.key === '_') zoomAt(window.innerWidth / 2, window.innerHeight / 2, zoom.scale / 1.2);
    if (e.key === '0') resetZoom();
  });
})();
