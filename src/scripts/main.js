(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var motionConfig = { selectedScrollSpeed: 1, timelineScrollSpeed: 1 };
  try {
    var motionEl = document.querySelector('[data-motion-config]');
    if (motionEl) motionConfig = Object.assign(motionConfig, JSON.parse(motionEl.textContent));
  } catch (err) {}
  function clampScrollSpeed(value, fallback) {
    var n = Number(value);
    if (!isFinite(n) || n <= 0) return fallback;
    return Math.min(4, Math.max(0.25, n));
  }
  var selectedScrollSpeed = clampScrollSpeed(motionConfig.selectedScrollSpeed, 1);
  var timelineScrollSpeed = clampScrollSpeed(motionConfig.timelineScrollSpeed, 1);

  function pageScrollBy(dy) {
    window.scrollBy({ top: dy, left: 0, behavior: 'auto' });
  }
  function pageScrollToY(y) {
    window.scrollTo({ top: y, left: 0, behavior: 'auto' });
  }

  if (document.documentElement.classList.contains('from-sheet')) {
    window.setTimeout(function () {
      document.documentElement.classList.remove('from-sheet');
    }, 900);
  }

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

  /* ---------------- Selected: desktop pin-scroll / mobile timeline pan --- */
  var selectedSection = document.querySelector('[data-selected]');
  var selectedSticky = document.querySelector('[data-selected-sticky]');
  var highlightTrack = document.querySelector('[data-highlight-track]') || document.querySelector('.highlight-track');
  var highlightRail = document.querySelector('[data-highlight-rail]');
  if (selectedSection && selectedSticky && highlightTrack) {
    var selectedMobileMq = window.matchMedia('(max-width: 799px)');
    var extraX = 0;
    var extraY = 0;
    var hiStart = 0;
    var hiEnd = 0;
    var hiSyncLock = false;
    var HI_MOBILE_GAIN = 2.5;
    var hiCards = Array.prototype.slice.call(highlightTrack.querySelectorAll('[data-highlight-card]'));
    var hiItems = Array.prototype.slice.call(highlightTrack.querySelectorAll('.highlight-item'));
    var hiX = 0;
    var hiVel = 0;
    var hiQueued = 0;
    var hiCoasting = false;
    var hiTouched = false;
    var hiDrag = {
      active: false,
      moved: false,
      axis: null,
      captured: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      lastT: 0,
      pointerId: null
    };
    var deskDrag = { active: false, moved: false, startX: 0, startY: 0, pointerId: null };

    function isSelectedMobile() {
      return selectedMobileMq.matches || window.innerWidth <= 799;
    }

    function hiSmooth(x) {
      x = Math.min(1, Math.max(0, x));
      return x * x * (3 - 2 * x);
    }

    function highlightMax() {
      var view = highlightTrack.clientWidth;
      if (highlightRail) {
        var railW = Math.max(highlightRail.scrollWidth, highlightRail.offsetWidth);
        if (railW > view + 1) return railW - view;
      }
      var fromTrack = highlightTrack.scrollWidth - view;
      if (fromTrack > 8) return fromTrack;
      if (!hiItems.length) return 0;
      var first = hiItems[0].getBoundingClientRect();
      var last = hiItems[hiItems.length - 1].getBoundingClientRect();
      return Math.max(0, (last.right - first.left) - view);
    }

    function clampHiX(next) {
      var max = highlightMax();
      if (next < 0) return 0;
      if (next > max) return max;
      return next;
    }

    function updateHighlightFocus() {
      if (reducedMotion || !hiCards.length) return;
      var box = highlightTrack.getBoundingClientRect();
      var cx = box.left + box.width / 2;
      var range = Math.max(120, box.width * 0.52);
      for (var i = 0; i < hiCards.length; i += 1) {
        var card = hiCards[i];
        var slot = card.closest('.highlight-item') || card.parentElement;
        var rect = slot.getBoundingClientRect();
        var t = hiSmooth(1 - Math.abs(rect.left + rect.width / 2 - cx) / range);
        card.style.transform = 'scale(' + (0.92 + 0.08 * t).toFixed(4) + ')';
        card.style.opacity = (0.86 + 0.14 * t).toFixed(3);
      }
    }

    function clearHighlightFocus() {
      for (var i = 0; i < hiCards.length; i += 1) {
        hiCards[i].style.transform = '';
        hiCards[i].style.opacity = '';
      }
    }

    function paintHighlight() {
      hiQueued = 0;
      if (!highlightRail || !isSelectedMobile()) return;
      if (hiCoasting && !hiDrag.active) {
        hiX = clampHiX(hiX + hiVel);
        hiVel *= 0.962;
        var max = highlightMax();
        if (hiX <= 0.2 || hiX >= max - 0.2 || Math.abs(hiVel) < 0.06) {
          hiCoasting = false;
          hiVel = 0;
          hiX = clampHiX(hiX);
        }
      }
      highlightRail.style.transform = 'translate3d(' + (-hiX).toFixed(2) + 'px,0,0)';
      updateHighlightFocus();
      if (hiCoasting && !hiDrag.active) {
        syncPageToHiX();
        hiQueued = window.requestAnimationFrame(paintHighlight);
      }
    }

    function queueHighlightPaint() {
      if (!hiQueued) hiQueued = window.requestAnimationFrame(paintHighlight);
    }

    function stopHighlightCoast() {
      hiCoasting = false;
      hiVel = 0;
    }

    function setHighlightX(next) {
      hiX = clampHiX(next);
      queueHighlightPaint();
    }

    function centerHighlightItem(item) {
      if (!item) return;
      var box = highlightTrack.getBoundingClientRect();
      var cx = box.left + box.width / 2;
      var r = item.getBoundingClientRect();
      setHighlightX(hiX + (r.left + r.width / 2) - cx);
    }

    function highlightAtStart() { return hiX <= hiStart + 0.5; }
    function highlightAtEnd() { return hiX >= hiEnd - 0.5; }

    function mobileTravelY(maxX) {
      if (maxX <= 0) return 0;
      var base = Math.min(maxX / HI_MOBILE_GAIN, window.innerHeight * 2.1);
      return base / selectedScrollSpeed;
    }

    function readCenterOffset(item) {
      if (!item) return 0;
      var box = highlightTrack.getBoundingClientRect();
      var r = item.getBoundingClientRect();
      return Math.max(0, hiX + (r.left + r.width / 2) - (box.left + box.width / 2));
    }

    function scrollProgress() {
      if (extraY <= 0) return 0;
      var top = selectedSection.getBoundingClientRect().top;
      return Math.min(1, Math.max(0, -top / extraY));
    }

    function syncPageToHiX() {
      if (!isSelectedMobile() || extraY <= 0) return;
      var span = Math.max(0, hiEnd - hiStart);
      if (span <= 0) return;
      var progress = Math.min(1, Math.max(0, (hiX - hiStart) / span));
      var absTop = selectedSection.getBoundingClientRect().top + window.scrollY;
      hiSyncLock = true;
      pageScrollToY(absTop + progress * extraY);
      window.requestAnimationFrame(function () { hiSyncLock = false; });
    }

    function measureSelected() {
      if (isSelectedMobile()) {
        selectedSection.classList.add('is-pan');
        highlightTrack.scrollLeft = 0;
        extraX = highlightMax();
        hiStart = readCenterOffset(hiItems[0]);
        hiEnd = readCenterOffset(hiItems[hiItems.length - 1]);
        if (hiEnd < hiStart) hiEnd = extraX;
        extraY = mobileTravelY(Math.max(0, hiEnd - hiStart));
        selectedSection.style.height = extraY > 8
          ? (selectedSticky.offsetHeight + extraY) + 'px'
          : '';
        if (hiDrag.active) queueHighlightPaint();
        else syncSelected();
        return;
      }
      selectedSection.classList.remove('is-pan');
      hiTouched = false;
      extraY = 0;
      hiStart = 0;
      hiEnd = 0;
      stopHighlightCoast();
      clearHighlightFocus();
      extraX = highlightMax();
      var deskTravel = extraX / selectedScrollSpeed;
      selectedSection.style.height = extraX > 8
        ? (selectedSticky.offsetHeight + deskTravel) + 'px'
        : '';
      syncSelected();
    }

    function syncSelected() {
      if (isSelectedMobile()) {
        if (!highlightRail || extraY <= 0) {
          if (!hiTouched && hiItems[0]) centerHighlightItem(hiItems[0]);
          else queueHighlightPaint();
          return;
        }
        var span = Math.max(0, hiEnd - hiStart);
        hiX = clampHiX(hiStart + scrollProgress() * span);
        queueHighlightPaint();
        return;
      }
      if (extraX <= 0) return;
      var top = selectedSection.getBoundingClientRect().top;
      var scrolled = Math.min(extraX, Math.max(0, -top * selectedScrollSpeed));
      if (highlightRail) {
        highlightTrack.scrollLeft = 0;
        highlightRail.style.transform = 'translate3d(' + (-scrolled).toFixed(2) + 'px,0,0)';
      } else if (Math.abs(highlightTrack.scrollLeft - scrolled) > 0.5) {
        highlightTrack.scrollLeft = scrolled;
      }
    }

    var selectedTick = false;
    function onSelectedScroll() {
      if (hiSyncLock || hiDrag.active) return;
      if (selectedTick) return;
      selectedTick = true;
      requestAnimationFrame(function () {
        if (!hiSyncLock && !hiDrag.active) {
          if (isSelectedMobile()) stopHighlightCoast();
          syncSelected();
        }
        selectedTick = false;
      });
    }

    window.addEventListener('scroll', onSelectedScroll, { passive: true });
    window.addEventListener('resize', measureSelected);
    if (selectedMobileMq.addEventListener) {
      selectedMobileMq.addEventListener('change', measureSelected);
    } else if (selectedMobileMq.addListener) {
      selectedMobileMq.addListener(measureSelected);
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', measureSelected);
    }
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(measureSelected).observe(highlightTrack);
    }
    highlightTrack.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', measureSelected);
    });
    window.setTimeout(measureSelected, 60);
    window.setTimeout(measureSelected, 800);

    highlightTrack.addEventListener('wheel', function (e) {
      if (isSelectedMobile()) {
        if (extraY <= 2) return;
        var delta = e.deltaY + e.deltaX;
        if (e.deltaMode === 1) delta *= 12;
        if (e.deltaMode === 2) delta *= highlightTrack.clientHeight;
        if (!delta) return;
        if (delta < 0 && highlightAtStart()) return;
        if (delta > 0 && highlightAtEnd()) return;
        e.preventDefault();
        hiTouched = true;
        stopHighlightCoast();
        pageScrollBy(delta);
        return;
      }
      if (extraX <= 2) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) && e.deltaX !== 0) return;
      e.preventDefault();
      pageScrollBy(e.deltaY + e.deltaX);
    }, { passive: false });

    highlightTrack.addEventListener('pointerdown', function (e) {
      if (isSelectedMobile()) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        stopHighlightCoast();
        hiDrag.active = true;
        hiDrag.moved = false;
        hiDrag.axis = null;
        hiDrag.captured = false;
        hiDrag.startX = e.clientX;
        hiDrag.startY = e.clientY;
        hiDrag.lastX = e.clientX;
        hiDrag.lastY = e.clientY;
        hiDrag.lastT = performance.now();
        hiDrag.pointerId = e.pointerId;
        hiVel = 0;
        return;
      }
      if (e.pointerType === 'touch') return;
      deskDrag.active = true;
      deskDrag.moved = false;
      deskDrag.startX = e.clientX;
      deskDrag.startY = window.scrollY;
      deskDrag.pointerId = e.pointerId;
      highlightTrack.setPointerCapture(e.pointerId);
    });
    highlightTrack.addEventListener('pointermove', function (e) {
      if (isSelectedMobile()) {
        if (!hiDrag.active) return;
        var adx = Math.abs(e.clientX - hiDrag.startX);
        var ady = Math.abs(e.clientY - hiDrag.startY);
        if (!hiDrag.axis) {
          if (adx < 6 && ady < 6) return;
          hiDrag.axis = adx > ady * 1.15 ? 'x' : 'y';
          if (hiDrag.axis === 'x' && !hiDrag.captured) {
            try { highlightTrack.setPointerCapture(e.pointerId); } catch (err) {}
            hiDrag.captured = true;
          }
        }
        if (hiDrag.axis !== 'x') return;
        hiTouched = true;
        if (e.cancelable) e.preventDefault();
        var now = performance.now();
        var dt = Math.max(4, now - hiDrag.lastT);
        var d = (hiDrag.lastX - e.clientX) + (hiDrag.lastY - e.clientY);
        if (adx + ady > 1.5) hiDrag.moved = true;
        hiX = clampHiX(hiX + d);
        var inst = d * (16.67 / dt);
        hiVel = hiVel * 0.42 + inst * 0.58;
        hiDrag.lastX = e.clientX;
        hiDrag.lastY = e.clientY;
        hiDrag.lastT = now;
        queueHighlightPaint();
        syncPageToHiX();
        return;
      }
      if (!deskDrag.active) return;
      var dx = e.clientX - deskDrag.startX;
      if (Math.abs(dx) > 4) deskDrag.moved = true;
      pageScrollToY(deskDrag.startY - dx / selectedScrollSpeed);
    }, { passive: false });
    function endSelectedDrag(e) {
      if (hiDrag.active) {
        hiDrag.active = false;
        if (e && hiDrag.pointerId != null && hiDrag.captured) {
          try { highlightTrack.releasePointerCapture(hiDrag.pointerId); } catch (err) {}
        }
        hiDrag.captured = false;
        hiDrag.axis = null;
        if (performance.now() - hiDrag.lastT > 80) hiVel = 0;
        if (reducedMotion) {
          hiVel = 0;
          return;
        }
        if (Math.abs(hiVel) > 0.12) {
          hiCoasting = true;
          queueHighlightPaint();
        } else {
          hiVel = 0;
        }
        return;
      }
      if (!deskDrag.active) return;
      deskDrag.active = false;
      if (e && deskDrag.pointerId != null) {
        try { highlightTrack.releasePointerCapture(deskDrag.pointerId); } catch (err) {}
      }
    }
    highlightTrack.addEventListener('pointerup', endSelectedDrag);
    highlightTrack.addEventListener('pointercancel', endSelectedDrag);
    highlightTrack.addEventListener('click', function (e) {
      if (deskDrag.moved || hiDrag.moved) { e.preventDefault(); e.stopPropagation(); }
      deskDrag.moved = false;
      hiDrag.moved = false;
    }, true);

    highlightTrack.addEventListener('keydown', function (e) {
      if (!isSelectedMobile()) return;
      var step = Math.max(96, highlightTrack.clientWidth * 0.38);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        hiTouched = true;
        stopHighlightCoast();
        setHighlightX(hiX + step);
        syncPageToHiX();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        hiTouched = true;
        stopHighlightCoast();
        setHighlightX(hiX - step);
        syncPageToHiX();
      } else if (e.key === 'Home') {
        e.preventDefault();
        hiTouched = true;
        stopHighlightCoast();
        setHighlightX(hiStart);
        syncPageToHiX();
      } else if (e.key === 'End') {
        e.preventDefault();
        hiTouched = true;
        stopHighlightCoast();
        setHighlightX(highlightMax());
        syncPageToHiX();
      }
    });
  }

  /* Text ribbon under Selected: native swipe, mouse drag. Does not touch photo hijack. */
  var selectedStrip = document.querySelector('[data-selected-strip]');
  if (selectedStrip) {
    var stripDrag = { on: false, x: 0, left: 0, moved: false, id: null };
    selectedStrip.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (selectedStrip.scrollWidth <= selectedStrip.clientWidth + 2) return;
      stripDrag.on = true;
      stripDrag.moved = false;
      stripDrag.x = e.clientX;
      stripDrag.left = selectedStrip.scrollLeft;
      stripDrag.id = e.pointerId;
      selectedStrip.setPointerCapture(e.pointerId);
    });
    selectedStrip.addEventListener('pointermove', function (e) {
      if (!stripDrag.on) return;
      var dx = e.clientX - stripDrag.x;
      if (Math.abs(dx) > 3) stripDrag.moved = true;
      if (!stripDrag.moved) return;
      e.preventDefault();
      selectedStrip.scrollLeft = stripDrag.left - dx;
    });
    function endStripDrag(e) {
      if (stripDrag.id != null && e && e.pointerId === stripDrag.id) {
        try { selectedStrip.releasePointerCapture(stripDrag.id); } catch (err) {}
      }
      stripDrag.on = false;
      stripDrag.id = null;
    }
    selectedStrip.addEventListener('pointerup', endStripDrag);
    selectedStrip.addEventListener('pointercancel', endStripDrag);
    selectedStrip.addEventListener('click', function (e) {
      if (stripDrag.moved) {
        e.preventDefault();
        e.stopPropagation();
      }
      stripDrag.moved = false;
    }, true);
    selectedStrip.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (selectedStrip.scrollWidth <= selectedStrip.clientWidth + 2) return;
      e.preventDefault();
      selectedStrip.scrollLeft += e.deltaX;
    }, { passive: false });
  }

  /* ---------------- Timeline: transform pan, newest first ------------------- */
  var timelineStage = document.querySelector('[data-timeline-sticky]');
  var timelineTrack = document.querySelector('[data-timeline-track]');
  var timelineRail = document.querySelector('[data-timeline-rail]');
  if (timelineTrack && timelineRail) {
    var tlCards = Array.prototype.slice.call(timelineTrack.querySelectorAll('[data-timeline-card]'));
    var tlSlots = Array.prototype.slice.call(timelineTrack.querySelectorAll('[data-timeline-slot]'));
    var tlX = 0;
    var tlVel = 0;
    var tlQueued = 0;
    var tlCoasting = false;
    var tlDrag = {
      active: false,
      moved: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      lastT: 0,
      pointerId: null
    };

    function tlSmooth(x) {
      x = Math.min(1, Math.max(0, x));
      return x * x * (3 - 2 * x);
    }

    function timelineMax() {
      return Math.max(0, timelineRail.scrollWidth - timelineTrack.clientWidth);
    }

    function clampTimelineX(next) {
      var max = timelineMax();
      if (next < 0) return 0;
      if (next > max) return max;
      return next;
    }

    function updateTimelineFocus() {
      if (reducedMotion || !tlCards.length) return;
      var box = timelineTrack.getBoundingClientRect();
      var cx = box.left + box.width / 2;
      var range = Math.max(120, box.width * 0.52);
      for (var i = 0; i < tlCards.length; i += 1) {
        var card = tlCards[i];
        var slot = card.closest('[data-timeline-slot]') || card.parentElement;
        var rect = slot.getBoundingClientRect();
        var t = tlSmooth(1 - Math.abs(rect.left + rect.width / 2 - cx) / range);
        card.style.transform = 'scale(' + (0.92 + 0.08 * t).toFixed(4) + ')';
        card.style.opacity = (0.86 + 0.14 * t).toFixed(3);
      }
    }

    function paintTimeline() {
      tlQueued = 0;
      if (tlCoasting && !tlDrag.active) {
        tlX = clampTimelineX(tlX + tlVel);
        tlVel *= 0.962;
        var max = timelineMax();
        if (tlX <= 0.2 || tlX >= max - 0.2 || Math.abs(tlVel) < 0.06) {
          tlCoasting = false;
          tlVel = 0;
          tlX = clampTimelineX(tlX);
        }
      }
      timelineRail.style.transform = 'translate3d(' + (-tlX).toFixed(2) + 'px,0,0)';
      updateTimelineFocus();
      if (tlCoasting && !tlDrag.active) {
        tlQueued = window.requestAnimationFrame(paintTimeline);
      }
    }

    function queueTimelinePaint() {
      if (!tlQueued) tlQueued = window.requestAnimationFrame(paintTimeline);
    }

    function stopTimelineCoast() {
      tlCoasting = false;
      tlVel = 0;
    }

    function setTimelineX(next) {
      tlX = clampTimelineX(next);
      queueTimelinePaint();
    }

    function centerTimelineSlot(slot) {
      if (!slot) return;
      var box = timelineTrack.getBoundingClientRect();
      var cx = box.left + box.width / 2;
      var r = slot.getBoundingClientRect();
      setTimelineX(tlX + (r.left + r.width / 2) - cx);
    }

    function timelineAtStart() { return tlX <= 0.5; }
    function timelineAtEnd() { return tlX >= timelineMax() - 0.5; }

    var wheelTarget = timelineStage || timelineTrack;
    wheelTarget.addEventListener('wheel', function (e) {
      var delta = e.deltaY + e.deltaX;
      if (e.deltaMode === 1) delta *= 12;
      if (e.deltaMode === 2) delta *= timelineTrack.clientHeight;
      if (!delta) return;
      if (delta < 0 && timelineAtStart()) return;
      if (delta > 0 && timelineAtEnd()) return;
      e.preventDefault();
      stopTimelineCoast();
      setTimelineX(tlX + delta * timelineScrollSpeed);
    }, { passive: false });

    timelineTrack.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      stopTimelineCoast();
      tlDrag.active = true;
      tlDrag.moved = false;
      tlDrag.startX = e.clientX;
      tlDrag.startY = e.clientY;
      tlDrag.lastX = e.clientX;
      tlDrag.lastY = e.clientY;
      tlDrag.lastT = performance.now();
      tlDrag.pointerId = e.pointerId;
      tlVel = 0;
      try { timelineTrack.setPointerCapture(e.pointerId); } catch (err) {}
    });
    timelineTrack.addEventListener('pointermove', function (e) {
      if (!tlDrag.active) return;
      if (e.cancelable) e.preventDefault();
      var now = performance.now();
      var dt = Math.max(4, now - tlDrag.lastT);
      var d = (tlDrag.lastX - e.clientX) + (tlDrag.lastY - e.clientY);
      if (Math.abs(e.clientX - tlDrag.startX) + Math.abs(e.clientY - tlDrag.startY) > 1.5) {
        tlDrag.moved = true;
      }
      tlX = clampTimelineX(tlX + d);
      var inst = d * (16.67 / dt);
      tlVel = tlVel * 0.42 + inst * 0.58;
      tlDrag.lastX = e.clientX;
      tlDrag.lastY = e.clientY;
      tlDrag.lastT = now;
      queueTimelinePaint();
    }, { passive: false });
    function endTimelineDrag(e) {
      if (!tlDrag.active) return;
      tlDrag.active = false;
      if (e && tlDrag.pointerId != null) {
        try { timelineTrack.releasePointerCapture(tlDrag.pointerId); } catch (err) {}
      }
      if (performance.now() - tlDrag.lastT > 80) tlVel = 0;
      if (reducedMotion) {
        tlVel = 0;
        return;
      }
      if (Math.abs(tlVel) > 0.12) {
        tlCoasting = true;
        queueTimelinePaint();
      } else {
        tlVel = 0;
      }
    }
    timelineTrack.addEventListener('pointerup', endTimelineDrag);
    timelineTrack.addEventListener('pointercancel', endTimelineDrag);
    timelineTrack.addEventListener('click', function (e) {
      if (tlDrag.moved) { e.preventDefault(); e.stopPropagation(); }
      tlDrag.moved = false;
    }, true);

    timelineTrack.addEventListener('keydown', function (e) {
      var step = Math.max(96, timelineTrack.clientWidth * 0.38);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        stopTimelineCoast();
        setTimelineX(tlX + step);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        stopTimelineCoast();
        setTimelineX(tlX - step);
      } else if (e.key === 'Home') {
        e.preventDefault();
        stopTimelineCoast();
        setTimelineX(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        stopTimelineCoast();
        setTimelineX(timelineMax());
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () {
        tlX = clampTimelineX(tlX);
        queueTimelinePaint();
      }).observe(timelineTrack);
    }
    timelineTrack.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', function () { queueTimelinePaint(); });
    });
    window.requestAnimationFrame(function () {
      centerTimelineSlot(tlSlots[0]);
    });
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
  var parallaxTargets = Array.prototype.slice.call(
    document.querySelectorAll('.detail-cover .pic, .highlight-item .pic')
  );
  if (window.matchMedia('(max-width: 799px)').matches) {
    parallaxTargets = parallaxTargets.filter(function (el) {
      return !el.closest('.highlight-item');
    });
  }
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
  var lightboxImgPrev = lightbox.querySelector('[data-lightbox-img-prev]');
  var lightboxImgNext = lightbox.querySelector('[data-lightbox-img-next]');
  var track = lightbox.querySelector('[data-lightbox-track]');
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
  var sheetThumbs = lightbox.querySelector('[data-sheet-thumbs]');
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
  var sheetDrag = {
    active: false,
    fromStage: false,
    startY: 0,
    lastY: 0,
    lastT: 0,
    startSheetY: 0,
    y: 0,
    startT: 0
  };
  var SHEET_COMMIT = 72;
  var slideBusy = false;
  var expanding = false;
  var imageSwipe = {
    active: false,
    startX: 0,
    x: 0,
    lastX: 0,
    lastT: 0,
    startT: 0
  };

  function escText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slideSrc(el) {
    if (!el) return '';
    return el.getAttribute('data-full') || el.getAttribute('data-lightbox-trigger') || '';
  }

  function neighborIndex(delta) {
    var list = groups[activeGroup];
    if (!list || !list.length) return 0;
    return (activeIndex + delta + list.length) % list.length;
  }

  function stageWidth() {
    return stage ? stage.clientWidth : 0;
  }

  function setTrackX(dx, snapping) {
    if (!track) return;
    var w = stageWidth();
    track.classList.toggle('is-snapping', Boolean(snapping));
    track.style.transform = 'translate3d(' + (-w + dx) + 'px,0,0)';
  }

  function restTrack(snapping) {
    setTrackX(0, snapping);
  }

  function fillNeighbor(img, index) {
    if (!img || !activeGroup) return;
    var list = groups[activeGroup];
    if (!list || list.length < 2) {
      img.removeAttribute('src');
      img.alt = '';
      return;
    }
    var el = list[index];
    img.src = slideSrc(el);
    img.alt = el.getAttribute('data-alt') || '';
  }

  function fillNeighbors() {
    fillNeighbor(lightboxImgPrev, neighborIndex(-1));
    fillNeighbor(lightboxImgNext, neighborIndex(1));
  }

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

  function isDesktopSheet() {
    return window.matchMedia('(min-width: 800px)').matches;
  }

  function sheetClosedY() {
    if (!sheet) return 0;
    var peek = (sheetHandle && sheetHandle.offsetHeight) || 30;
    return Math.max(0, sheet.offsetHeight - peek);
  }

  function setSheetCommit(on) {
    if (!lightbox) return;
    lightbox.classList.toggle('is-sheet-commit', Boolean(on));
    if (sheet) sheet.classList.toggle('is-commit', Boolean(on));
    if (!sheetLink) return;
    if (on) {
      if (!sheetLink.dataset.label) sheetLink.dataset.label = sheetLink.textContent;
      sheetLink.textContent = 'Release to open';
    } else if (sheetLink.dataset.label) {
      sheetLink.textContent = sheetLink.dataset.label;
    }
  }

  function setSheetOpen(open) {
    sheetOpen = Boolean(open);
    if (!sheet) return;
    sheet.classList.toggle('is-open', sheetOpen);
    lightbox.classList.toggle('is-sheet-open', sheetOpen);
    sheet.classList.remove('is-dragging');
    sheet.style.transform = '';
    setSheetCommit(false);
    if (sheetHandle) sheetHandle.setAttribute('aria-expanded', String(sheetOpen));
  }

  function applySheetY(y, dragging) {
    if (!sheet) return;
    sheet.classList.toggle('is-dragging', Boolean(dragging));
    if (y == null) {
      sheet.style.transform = '';
      return;
    }
    sheet.style.transform = 'translate3d(0,' + y + 'px,0)';
  }

  function resist(over, range) {
    if (over <= 0) return 0;
    return (over * range) / (over + range);
  }

  function beginSheetDrag(clientY, fromStage) {
    if (!sheet || sheet.hidden || isDesktopSheet()) return false;
    sheetDrag.active = true;
    sheetDrag.fromStage = Boolean(fromStage);
    sheetDrag.startY = clientY;
    sheetDrag.lastY = clientY;
    sheetDrag.startT = performance.now();
    sheetDrag.lastT = sheetDrag.startT;
    sheetDrag.startSheetY = sheetOpen ? 0 : sheetClosedY();
    sheetDrag.y = sheetDrag.startSheetY;
    applySheetY(sheetDrag.y, true);
    return true;
  }

  function moveSheetDrag(clientY) {
    if (!sheetDrag.active) return;
    var now = performance.now();
    sheetDrag.lastY = clientY;
    sheetDrag.lastT = now;
    var dy = clientY - sheetDrag.startY;
    var closed = sheetClosedY();
    var next = sheetDrag.startSheetY + dy;
    if (next < 0) next = -resist(-next, SHEET_COMMIT * 1.6);
    if (next > closed) next = closed + resist(next - closed, 48);
    sheetDrag.y = next;
    applySheetY(next, true);
    setSheetCommit(next < -SHEET_COMMIT * 0.45);
  }

  function commitNavigate() {
    if (!sheetLink || expanding) return;
    var href = sheetLink.getAttribute('href');
    if (!href || href === '#') return;
    expanding = true;

    if (reducedMotion) {
      window.location.href = href;
      return;
    }

    try { sessionStorage.setItem('skd-from-sheet', '1'); } catch (err) {}

    var rect = sheet.getBoundingClientRect();
    var srcBox = sheetTitle ? sheetTitle.getBoundingClientRect() : rect;
    var title = (sheetTitle && sheetTitle.textContent) || '';
    var kind = (sheetKind && sheetKind.textContent) || 'Series';
    var radius = isDesktopSheet() ? '20px' : '22px 22px 0 0';
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var top = Math.max(0, rect.top);
    var right = Math.max(0, vw - rect.right);
    var bottom = Math.max(0, vh - rect.bottom);
    var left = Math.max(0, rect.left);
    var clip = 'inset(' + top + 'px ' + right + 'px ' + bottom + 'px ' + left + 'px round ' + radius + ')';

    var overlay = document.createElement('div');
    overlay.className = 'sheet-expand';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.visibility = 'hidden';
    overlay.style.clipPath = clip;
    overlay.style.webkitClipPath = clip;
    overlay.innerHTML = '<section class="sheet-expand-hero wrap">' +
      '<p class="label label-paren">' + escText(kind) + '</p>' +
      '<h1 class="detail-title sheet-expand-title">' + escText(title) + '</h1>' +
      '</section>';

    if (sheetThumbs && !sheetThumbs.hidden && sheetThumbs.childElementCount) {
      var thumbs = sheetThumbs.cloneNode(true);
      thumbs.className = 'sheet-expand-thumbs';
      thumbs.removeAttribute('data-sheet-thumbs');
      var tr = sheetThumbs.getBoundingClientRect();
      thumbs.style.left = tr.left + 'px';
      thumbs.style.top = tr.top + 'px';
      thumbs.style.width = tr.width + 'px';
      overlay.appendChild(thumbs);
    }

    document.body.appendChild(overlay);
    lightbox.classList.add('is-expanding');
    sheet.style.opacity = '0';

    var destTitle = overlay.querySelector('.sheet-expand-title');
    if (destTitle) {
      destTitle.style.transition = 'none';
      var destBox = destTitle.getBoundingClientRect();
      var sx = destBox.width ? srcBox.width / destBox.width : 1;
      var sy = destBox.height ? srcBox.height / destBox.height : 1;
      destTitle.style.transform = 'translate(' + (srcBox.left - destBox.left) + 'px,' + (srcBox.top - destBox.top) + 'px) scale(' + sx + ', ' + sy + ')';
      destTitle.offsetWidth;
      destTitle.style.transition = '';
    }

    overlay.style.visibility = '';
    overlay.style.transition = 'clip-path 780ms cubic-bezier(0.16, 1, 0.3, 1)';

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        overlay.classList.add('is-on');
        overlay.style.clipPath = 'inset(0 round 0px)';
        overlay.style.webkitClipPath = 'inset(0 round 0px)';
        if (destTitle) destTitle.style.transform = 'none';
      });
    });

    window.setTimeout(function () {
      window.location.href = href;
    }, 820);
  }

  function endSheetDrag() {
    if (!sheetDrag.active) return;
    var fromStage = sheetDrag.fromStage;
    var dy = sheetDrag.lastY - sheetDrag.startY;
    var y = sheetDrag.y;
    var closed = sheetClosedY();
    var elapsed = Math.max(16, performance.now() - sheetDrag.startT);
    var flick = dy / elapsed;
    sheetDrag.active = false;
    sheetDrag.fromStage = false;

    if (y < -SHEET_COMMIT * 0.5 || (sheetOpen && (dy < -SHEET_COMMIT || flick < -0.55))) {
      applySheetY(y, true);
      commitNavigate();
      return;
    }
    if (!sheetOpen && fromStage && dy > 80 && Math.abs(dy) > 40) {
      setSheetOpen(false);
      closeLightbox();
      return;
    }
    if (dy < -28 || flick < -0.4 || y < closed * 0.55) setSheetOpen(true);
    else setSheetOpen(false);
  }

  function renderSheetThumbs(raw) {
    if (!sheetThumbs) return;
    sheetThumbs.innerHTML = '';
    var thumbs = [];
    try { thumbs = JSON.parse(raw || '[]'); } catch (err) { thumbs = []; }
    if (!Array.isArray(thumbs) || !thumbs.length) {
      sheetThumbs.hidden = true;
      return;
    }
    thumbs.forEach(function (t) {
      if (!t || !(t.jpg || t.webp)) return;
      var fig = document.createElement('figure');
      fig.className = 'lightbox-sheet-thumb';
      var pic = document.createElement('picture');
      if (t.webp) {
        var source = document.createElement('source');
        source.type = 'image/webp';
        source.srcset = t.webp;
        pic.appendChild(source);
      }
      var img = document.createElement('img');
      img.src = t.jpg || t.webp;
      img.alt = t.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      pic.appendChild(img);
      fig.appendChild(pic);
      sheetThumbs.appendChild(fig);
    });
    sheetThumbs.hidden = sheetThumbs.childElementCount === 0;
  }

  function showSheet(el) {
    if (!sheet) return;
    var href = el.getAttribute('data-parent-href');
    var title = el.getAttribute('data-parent-title') || '';
    if (!href || !title) {
      sheet.hidden = true;
      lightbox.classList.remove('has-sheet', 'is-sheet-open', 'is-sheet-commit');
      if (sheetLink) delete sheetLink.dataset.label;
      setSheetOpen(false);
      return;
    }
    var kind = el.getAttribute('data-parent-kind') || 'Series';
    sheet.hidden = false;
    lightbox.classList.add('has-sheet');
    if (sheetTitle) sheetTitle.textContent = title;
    if (sheetKind) sheetKind.textContent = kind;
    sheetLink.href = href;
    sheetLink.textContent = 'Open ' + kind.toLowerCase();
    delete sheetLink.dataset.label;
    renderSheetThumbs(el.getAttribute('data-parent-thumbs'));
    if (sheetHandle) {
      sheetHandle.setAttribute('aria-label', 'Open ' + kind.toLowerCase() + ' ' + title);
    }
    setSheetOpen(false);
    if (href && sheet.dataset.prefetched !== href) {
      sheet.dataset.prefetched = href;
      try {
        var prefetch = document.createElement('link');
        prefetch.rel = 'prefetch';
        prefetch.href = href;
        document.head.appendChild(prefetch);
      } catch (err) {}
    }
  }

  function renderSlide() {
    if (!activeGroup) return;
    var el = groups[activeGroup][activeIndex];
    var full = slideSrc(el);
    resetZoom();
    lightboxImg.src = full;
    lightboxImg.alt = el.getAttribute('data-alt') || '';
    fillNeighbors();
    if (!imageSwipe.active && !slideBusy) restTrack(false);

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
    slideBusy = false;
    imageSwipe.active = false;
    renderSlide();
    lightbox.classList.add('is-open');
    lightbox.classList.remove('is-swiping', 'is-expanding');
    restTrack(false);
    window.requestAnimationFrame(function () { restTrack(false); });
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open', 'has-sheet', 'is-sheet-open', 'is-sheet-commit', 'is-swiping', 'is-expanding');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lightboxImg.src = '';
    if (lightboxImgPrev) lightboxImgPrev.removeAttribute('src');
    if (lightboxImgNext) lightboxImgNext.removeAttribute('src');
    resetZoom();
    restTrack(false);
    slideBusy = false;
    imageSwipe.active = false;
    expanding = false;
    sheetDrag.active = false;
    setSheetOpen(false);
    if (sheet) {
      sheet.hidden = true;
      sheet.style.opacity = '';
    }
  }

  function step(delta) {
    if (!activeGroup || slideBusy || expanding) return;
    var list = groups[activeGroup];
    if (!list || list.length < 2) return;

    var fromX = imageSwipe.active ? imageSwipe.x : 0;
    imageSwipe.active = false;

    if (reducedMotion) {
      activeIndex = neighborIndex(delta);
      lightbox.classList.remove('is-swiping');
      renderSlide();
      restTrack(false);
      return;
    }

    slideBusy = true;
    resetZoom();
    lightbox.classList.add('is-swiping');
    var w = stageWidth();
    var targetX = -delta * w;
    setTrackX(fromX, false);

    var settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      if (track) track.removeEventListener('transitionend', onEnd);
      activeIndex = neighborIndex(delta);
      if (track) track.classList.remove('is-snapping');
      lightboxImg.src = slideSrc(groups[activeGroup][activeIndex]);
      lightboxImg.alt = groups[activeGroup][activeIndex].getAttribute('data-alt') || '';
      restTrack(false);
      slideBusy = false;
      imageSwipe.x = 0;
      lightbox.classList.remove('is-swiping');
      renderSlide();
    }
    function onEnd(e) {
      if (e && e.target !== track) return;
      settle();
    }

    window.requestAnimationFrame(function () {
      setTrackX(targetX, true);
    });

    if (Math.abs(fromX - targetX) < 8) {
      window.setTimeout(settle, 24);
      return;
    }
    if (track) track.addEventListener('transitionend', onEnd);
    window.setTimeout(settle, 640);
  }

  function endImageSwipe() {
    if (!imageSwipe.active) return;
    var dx = imageSwipe.x;
    var elapsed = Math.max(16, performance.now() - imageSwipe.startT);
    var flick = dx / elapsed;
    var w = stageWidth();
    var threshold = Math.min(64, Math.max(40, w * 0.16));

    if (dx < -threshold || flick < -0.5) {
      step(1);
      return;
    }
    if (dx > threshold || flick > 0.5) {
      step(-1);
      return;
    }

    imageSwipe.active = false;
    imageSwipe.x = 0;
    lightbox.classList.remove('is-swiping');
    restTrack(true);
    window.setTimeout(function () {
      if (track) track.classList.remove('is-snapping');
    }, 540);
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
  if (sheetLink) {
    sheetLink.addEventListener('click', function (e) {
      e.preventDefault();
      commitNavigate();
    });
  }

  window.addEventListener('resize', function () {
    if (!lightbox.classList.contains('is-open') || slideBusy || imageSwipe.active) return;
    restTrack(false);
  });

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
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
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
        return;
      }
      if (pts.length === 1 && zoom.scale <= 1.02 && !didPinch) {
        var rec = pointers[e.pointerId];
        var dx = e.clientX - rec.startX;
        var dy = e.clientY - rec.startY;
        var multi = activeGroup && groups[activeGroup] && groups[activeGroup].length > 1;

        if (!sheetDrag.active && !imageSwipe.active && !slideBusy) {
          if (multi && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15) {
            imageSwipe.active = true;
            imageSwipe.startX = rec.startX;
            imageSwipe.x = dx;
            imageSwipe.lastX = e.clientX;
            imageSwipe.startT = performance.now();
            imageSwipe.lastT = imageSwipe.startT;
            lightbox.classList.add('is-swiping');
            resetZoom();
          } else if (sheet && !sheet.hidden && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.15) {
            beginSheetDrag(rec.startY, true);
          }
        }

        if (imageSwipe.active) {
          imageSwipe.x = e.clientX - imageSwipe.startX;
          imageSwipe.lastX = e.clientX;
          imageSwipe.lastT = performance.now();
          setTrackX(imageSwipe.x, false);
          return;
        }
        if (sheetDrag.active && sheetDrag.fromStage) moveSheetDrag(e.clientY);
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
      if (sheetDrag.active && sheetDrag.fromStage && remaining.length === 0) {
        endSheetDrag();
        if (remaining.length === 0) didPinch = false;
        return;
      }
      if (imageSwipe.active && remaining.length === 0) {
        endImageSwipe();
        didPinch = false;
        return;
      }
      if (remaining.length === 0 && rec && zoom.scale <= 1.02 && !didPinch) {
        var dx = e.clientX - rec.startX;
        var dy = e.clientY - rec.startY;
        if (e.pointerType !== 'mouse') {
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

    function eventY(e) {
      return e.clientY != null ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : null);
    }

    function onDown(e) {
      if (isDesktopSheet()) return;
      if (e.target.closest && e.target.closest('.lightbox-sheet-thumbs, .lightbox-sheet-link')) return;
      var y = eventY(e);
      if (y == null) return;
      beginSheetDrag(y, false);
      if (e.pointerId != null && sheet.setPointerCapture) {
        try { sheet.setPointerCapture(e.pointerId); } catch (err) {}
      }
    }
    function onMove(e) {
      if (!sheetDrag.active || sheetDrag.fromStage) return;
      var y = eventY(e);
      if (y == null) return;
      moveSheetDrag(y);
    }
    function onUp() {
      if (!sheetDrag.active || sheetDrag.fromStage) return;
      endSheetDrag();
    }

    sheet.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    function toggleOrIgnore(e) {
      if (isDesktopSheet()) return;
      if (Math.abs(sheetDrag.lastY - sheetDrag.startY) > 12) return;
      e.preventDefault();
      setSheetOpen(!sheetOpen);
    }
    sheetHandle.addEventListener('click', toggleOrIgnore);
  }
  bindSheetDrag();

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') {
      if (sheetOpen) setSheetOpen(false);
      else closeLightbox();
      return;
    }
    if (e.key === 'ArrowUp' && sheet && !sheet.hidden) {
      e.preventDefault();
      if (!sheetOpen) setSheetOpen(true);
      else commitNavigate();
      return;
    }
    if (e.key === 'ArrowDown' && sheetOpen) {
      e.preventDefault();
      setSheetOpen(false);
      return;
    }
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
    if (e.key === '+' || e.key === '=') zoomAt(window.innerWidth / 2, window.innerHeight / 2, zoom.scale * 1.2);
    if (e.key === '-' || e.key === '_') zoomAt(window.innerWidth / 2, window.innerHeight / 2, zoom.scale / 1.2);
    if (e.key === '0') resetZoom();
  });
})();
