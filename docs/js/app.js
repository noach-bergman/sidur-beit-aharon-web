(function () {
  'use strict';

  var PDF_URL = './siddur.pdf';
  var PDF_PAGES = 315;
  var STORAGE_PAGE = 'sidur-bav-last-page';
  var A2HS_KEY = 'sidur-bai-a2hs-used';
  var PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  var DEFAULT_PAGE = 3; // השכמת הבוקר (heb ד)

  var HEB_VALUES = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
    'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50, 'ס': 60, 'ע': 70,
    'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
  };

  var GROUP_LABELS = { daily: 'יום־יום', moadim: 'מועדים', other: 'אחר' };
  var GROUP_ORDER = ['daily', 'moadim', 'other'];

  var state = {
    toc: null,
    entries: [],        // flat, sorted by pdfPage — used for the running head
    filter: 'all',
    query: '',
    pdfDoc: null,
    pdfPage: 1,
    rendering: false,
    animating: false,
    pendingPage: null,
    pendingDir: null,
    loadingPdf: null,
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  /* ── Hebrew page numbers ─────────────────────────────── */

  /** Printed Hebrew page H → PDF page index (1-based). Verified: ד→3, ו→5, כא→20. */
  function hebToPdf(h) {
    return clamp(Number(h) - 1, 1, PDF_PAGES);
  }

  /** PDF page index → approximate printed Hebrew page. */
  function pdfToHeb(p) {
    return clamp(Number(p) + 1, 1, PDF_PAGES);
  }

  function parseHebNumeral(str) {
    if (str == null) return null;
    var s = String(str).replace(/[״"׳']/g, '').trim();
    if (!s) return null;
    if (s === 'טו') return 15;
    if (s === 'טז') return 16;
    var total = 0;
    var i = 0;
    while (i < s.length) {
      if (s.slice(i, i + 2) === 'טו') { total += 15; i += 2; continue; }
      if (s.slice(i, i + 2) === 'טז') { total += 16; i += 2; continue; }
      var v = HEB_VALUES[s[i]];
      if (v == null) { i += 1; continue; }
      total += v;
      i += 1;
    }
    return total || null;
  }

  function toHebNumeral(n) {
    n = Math.floor(Number(n));
    if (!n || n < 1) return '';
    var out = '';
    var hundreds = [['ת', 400], ['ש', 300], ['ר', 200], ['ק', 100]];
    for (var hi = 0; hi < hundreds.length; hi++) {
      while (n >= hundreds[hi][1]) {
        out += hundreds[hi][0];
        n -= hundreds[hi][1];
      }
    }
    if (n === 15) return out + 'טו';
    if (n === 16) return out + 'טז';
    var tens = [['צ', 90], ['פ', 80], ['ע', 70], ['ס', 60], ['נ', 50], ['מ', 40], ['ל', 30], ['כ', 20], ['י', 10]];
    for (var ti = 0; ti < tens.length; ti++) {
      if (n >= tens[ti][1]) {
        out += tens[ti][0];
        n -= tens[ti][1];
      }
    }
    var ones = ' אבגדהוזחט';
    if (n > 0) out += ones[n];
    return out;
  }

  /** Set a Hebrew numeral the way a printed sefer does: ג׳ · ק״ג */
  function withGershayim(label) {
    var s = String(label || '').replace(/[״"׳']/g, '');
    if (!s) return '';
    if (s.length === 1) return s + '׳';
    return s.slice(0, -1) + '״' + s.slice(-1);
  }

  function hebLabelOf(entry) {
    return withGershayim(entry.hebLabel || toHebNumeral(entry.hebPage));
  }

  window.hebToPdf = hebToPdf;
  window.pdfToHeb = pdfToHeb;
  window.parseHebNumeral = parseHebNumeral;
  window.toHebNumeral = toHebNumeral;

  /* ── Persistence ─────────────────────────────────────── */

  function loadLastPage() {
    try {
      var n = parseInt(localStorage.getItem(STORAGE_PAGE), 10);
      if (n >= 1 && n <= PDF_PAGES) return n;
    } catch (e) {}
    return DEFAULT_PAGE;
  }

  function hasSavedPage() {
    try { return localStorage.getItem(STORAGE_PAGE) != null; } catch (e) { return false; }
  }

  function saveLastPage(p) {
    try { localStorage.setItem(STORAGE_PAGE, String(p)); } catch (e) {}
  }

  /* ── Views ───────────────────────────────────────────── */

  function showView(name) {
    var home = $('#view-home');
    var reader = $('#view-reader');
    if (name === 'reader') {
      home.classList.add('hidden');
      reader.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    } else {
      reader.classList.add('hidden');
      home.classList.remove('hidden');
      document.body.style.overflow = '';
      updateResume();
    }
  }

  /** The TOC entry a given PDF page falls under — the book's running head. */
  function sectionFor(pdfPage) {
    var found = null;
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].pdfPage <= pdfPage) found = state.entries[i];
      else break;
    }
    return found;
  }

  function updateLabel(pdfPage) {
    var heb = pdfToHeb(pdfPage);
    var hebLabel = withGershayim(toHebNumeral(heb));

    var el = $('#page-label');
    if (el) {
      el.innerHTML =
        '<span class="heb">עמוד ' + hebLabel + '</span>' +
        '<span class="pos">' + pdfPage + ' / ' + PDF_PAGES + '</span>';
    }

    var head = $('#running-head');
    if (head) {
      var sec = sectionFor(pdfPage);
      head.textContent = sec ? sec.title : 'סידור בית אהרן וישראל';
    }

    var fill = $('#progress-fill');
    if (fill) fill.style.width = ((pdfPage / PDF_PAGES) * 100).toFixed(2) + '%';

    var prev = $('#btn-prev');
    var next = $('#btn-next');
    if (prev) prev.disabled = pdfPage <= 1;
    if (next) next.disabled = pdfPage >= PDF_PAGES;
  }

  function updateResume() {
    var btn = $('#btn-resume');
    if (!btn) return;
    if (!hasSavedPage()) { btn.classList.add('hidden'); return; }
    var page = loadLastPage();
    var sec = sectionFor(page);
    var title = $('#resume-title');
    var label = $('#resume-page');
    if (title) title.textContent = sec ? sec.title : 'סידור בית אהרן וישראל';
    if (label) label.textContent = withGershayim(toHebNumeral(pdfToHeb(page)));
    btn.classList.remove('hidden');
  }

  /* ── PDF rendering (unchanged behaviour: paint off-screen, swap instantly) ── */

  function ensurePdf() {
    if (state.pdfDoc) return Promise.resolve(state.pdfDoc);
    if (state.loadingPdf) return state.loadingPdf;
    if (typeof pdfjsLib === 'undefined') {
      return Promise.reject(new Error('PDF.js לא נטען'));
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + 'pdf.worker.min.js';
    state.loadingPdf = pdfjsLib.getDocument({
      url: PDF_URL,
      disableAutoFetch: false,
      disableStream: false,
    }).promise.then(function (doc) {
      state.pdfDoc = doc;
      state.loadingPdf = null;
      return doc;
    }).catch(function (err) {
      state.loadingPdf = null;
      throw err;
    });
    return state.loadingPdf;
  }

  function stageSize() {
    var stage = $('#page-stage');
    var w = stage ? stage.clientWidth : window.innerWidth;
    var h = stage ? stage.clientHeight : window.innerHeight;
    return { w: Math.max(120, w - 12), h: Math.max(120, h - 12) };
  }

  function frontCanvas() { return $('#pdf-canvas'); }
  function backCanvas() { return $('#pdf-canvas-next'); }

  /** Paint a PDF page onto a canvas; resolves when done. */
  function paintPage(canvas, pdfPageNum) {
    return ensurePdf().then(function (doc) {
      return doc.getPage(pdfPageNum);
    }).then(function (page) {
      var ctx = canvas.getContext('2d', { alpha: false });
      var size = stageSize();
      var base = page.getViewport({ scale: 1 });
      var scale = Math.min(size.w / base.width, size.h / base.height);
      var outputScale = Math.min(window.devicePixelRatio || 1, 2);
      var viewport = page.getViewport({ scale: scale * outputScale });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = Math.floor(viewport.width / outputScale) + 'px';
      canvas.style.height = Math.floor(viewport.height / outputScale) + 'px';

      return page.render({ canvasContext: ctx, viewport: viewport }).promise;
    });
  }

  /** Copy bitmap from src canvas onto dst (same CSS size). */
  function copyCanvas(src, dst) {
    if (!src || !dst || !src.width) return;
    dst.width = src.width;
    dst.height = src.height;
    dst.style.width = src.style.width;
    dst.style.height = src.style.height;
    var ctx = dst.getContext('2d', { alpha: false });
    ctx.drawImage(src, 0, 0);
  }

  function resetLayers() {
    var back = backCanvas();
    if (back) {
      back.style.opacity = '0';
      back.style.visibility = 'hidden';
    }
    var loading = $('#reader-loading');
    if (loading) loading.classList.add('hidden');
  }

  function finishPending() {
    state.rendering = false;
    state.animating = false;
    var loadingEl = $('#reader-loading');
    if (loadingEl && state.pdfDoc) loadingEl.classList.add('hidden');
    if (state.pendingPage != null && state.pendingPage !== state.pdfPage) {
      var next = state.pendingPage;
      var dir = state.pendingDir;
      state.pendingPage = null;
      state.pendingDir = null;
      renderPage(next, dir);
    } else {
      state.pendingPage = null;
      state.pendingDir = null;
    }
  }

  /**
   * Page change: paint the new page off-screen first, then swap instantly.
   * The visible page is never cleared before the next one is ready — that is
   * what keeps the black flash away, so leave the ordering alone.
   */
  function renderPage(pdfPage, flipDir) {
    pdfPage = clamp(pdfPage, 1, PDF_PAGES);
    if (state.rendering || state.animating) {
      state.pendingPage = pdfPage;
      state.pendingDir = flipDir || null;
      return;
    }
    state.rendering = true;
    state.pdfPage = pdfPage;
    saveLastPage(pdfPage);
    updateLabel(pdfPage);

    var front = frontCanvas();
    var back = backCanvas();
    var loading = $('#reader-loading');
    var hasContent = front && front.width > 0;

    // Only show the loader on the very first page (nothing on screen yet)
    if (!hasContent && loading) loading.classList.remove('hidden');
    else if (loading) loading.classList.add('hidden');

    resetLayers();

    // Always paint onto back while front stays visible
    var paintTarget = (hasContent && back) ? back : front;

    paintPage(paintTarget, pdfPage).then(function () {
      if (paintTarget === back && front) {
        back.style.width = front.style.width || back.style.width;
        back.style.height = front.style.height || back.style.height;
        copyCanvas(back, front);
      } else if (front && back) {
        copyCanvas(front, back);
      }
      resetLayers();
      if (loading) loading.classList.add('hidden');
      finishPending();
    }).catch(function (err) {
      console.error(err);
      if (loading) {
        loading.innerHTML = '<span>שגיאה בטעינת הדף</span>';
        loading.classList.remove('hidden');
      }
      state.rendering = false;
      state.animating = false;
    });
  }

  function goTo(pdfPage, flipDir) {
    renderPage(clamp(pdfPage, 1, PDF_PAGES), flipDir);
  }

  function nextPage() {
    if (state.pdfPage < PDF_PAGES) goTo(state.pdfPage + 1);
  }

  function prevPage() {
    if (state.pdfPage > 1) goTo(state.pdfPage - 1);
  }

  function openReader(pdfPage) {
    showView('reader');
    var target = pdfPage || loadLastPage();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        goTo(target, null);
      });
    });
  }

  function openIndex() {
    showView('home');
  }

  /* ── Index (מפתח) ────────────────────────────────────── */

  function normalize(s) {
    return String(s || '').replace(/[״"׳'׳֑-ׇ]/g, '').trim();
  }

  function buildToc() {
    var list = $('#toc-list');
    if (!list) return;
    list.innerHTML = '';

    var byGroup = {};
    GROUP_ORDER.forEach(function (g) { byGroup[g] = []; });
    (state.toc && state.toc.entries || []).forEach(function (item) {
      var g = byGroup[item.group] ? item.group : 'other';
      byGroup[g].push(item);
    });

    GROUP_ORDER.forEach(function (g) {
      if (!byGroup[g].length) return;

      var head = document.createElement('li');
      head.className = 'toc-section';
      head.dataset.group = g;
      head.textContent = (state.toc.groups && state.toc.groups[g]) || GROUP_LABELS[g];
      list.appendChild(head);

      byGroup[g].forEach(function (item) {
        var li = document.createElement('li');
        li.className = 'toc-row';
        li.dataset.group = g;
        li.dataset.search = normalize(item.title);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toc-link';

        var title = document.createElement('span');
        title.className = 'toc-title';
        title.textContent = item.title;

        var leader = document.createElement('span');
        leader.className = 'toc-leader';
        leader.setAttribute('aria-hidden', 'true');

        var page = document.createElement('span');
        page.className = 'toc-page';
        page.textContent = hebLabelOf(item);

        btn.appendChild(title);
        btn.appendChild(leader);
        btn.appendChild(page);
        btn.addEventListener('click', function () {
          openReader(item.pdfPage || hebToPdf(item.hebPage));
        });

        li.appendChild(btn);
        list.appendChild(li);
      });
    });

    applyFilter();
  }

  function applyFilter() {
    var q = normalize(state.query).toLowerCase();
    var visible = 0;
    var perGroup = {};

    $$('#toc-list .toc-row').forEach(function (row) {
      var g = row.dataset.group;
      var matchGroup = state.filter === 'all' || state.filter === g;
      var matchQuery = !q || row.dataset.search.toLowerCase().indexOf(q) !== -1;
      var show = matchGroup && matchQuery;
      row.classList.toggle('hidden', !show);
      if (show) { visible++; perGroup[g] = (perGroup[g] || 0) + 1; }
    });

    // A section heading only earns its place when something sits under it,
    // and a single-group filter makes it redundant.
    $$('#toc-list .toc-section').forEach(function (head) {
      var g = head.dataset.group;
      var show = state.filter === 'all' && (perGroup[g] || 0) > 0;
      head.classList.toggle('hidden', !show);
    });

    var empty = $('#toc-empty');
    if (empty) empty.classList.toggle('hidden', visible > 0);

    var clear = $('#search-clear');
    if (clear) clear.classList.toggle('hidden', !state.query);
  }

  function setupIndexControls() {
    var search = $('#toc-search');
    if (search) {
      search.addEventListener('input', function () {
        state.query = search.value;
        applyFilter();
      });
    }
    var clear = $('#search-clear');
    if (clear) {
      clear.addEventListener('click', function () {
        state.query = '';
        if (search) { search.value = ''; search.focus(); }
        applyFilter();
      });
    }
    $$('.seg').forEach(function (seg) {
      seg.addEventListener('click', function () {
        state.filter = seg.dataset.filter;
        $$('.seg').forEach(function (s) {
          var on = s === seg;
          s.classList.toggle('is-active', on);
          s.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        applyFilter();
      });
    });
  }

  /* ── Go to page ──────────────────────────────────────── */

  function gotoPreview(pdfPage) {
    pdfPage = clamp(pdfPage, 1, PDF_PAGES);
    var heb = $('#goto-heb');
    var sub = $('#goto-sub');
    if (heb) heb.textContent = 'עמוד ' + withGershayim(toHebNumeral(pdfToHeb(pdfPage)));
    if (sub) {
      var sec = sectionFor(pdfPage);
      sub.textContent = sec ? sec.title : (pdfPage + ' / ' + PDF_PAGES);
    }
  }

  function openGoto() {
    var modal = $('#goto-sheet');
    var range = $('#goto-range');
    var input = $('#goto-input');
    if (!modal) return;
    if (range) range.value = String(state.pdfPage);
    if (input) input.value = '';
    gotoPreview(state.pdfPage);
    modal.classList.remove('hidden');
  }

  function closeGoto() {
    var modal = $('#goto-sheet');
    if (modal) modal.classList.add('hidden');
  }

  function setupGoto() {
    var modal = $('#goto-sheet');
    var range = $('#goto-range');
    var form = $('#goto-form');
    var input = $('#goto-input');
    if (!modal) return;

    if (range) {
      range.max = String(PDF_PAGES);
      range.addEventListener('input', function () {
        gotoPreview(parseInt(range.value, 10));
      });
      range.addEventListener('change', function () {
        var p = clamp(parseInt(range.value, 10) || 1, 1, PDF_PAGES);
        closeGoto();
        goTo(p);
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var raw = (input && input.value || '').trim();
        if (!raw) return;
        var heb = /^[0-9]+$/.test(raw) ? parseInt(raw, 10) : parseHebNumeral(raw);
        if (!heb) return;
        closeGoto();
        goTo(hebToPdf(heb));
      });
    }

    if (input) {
      input.addEventListener('input', function () {
        var raw = input.value.trim();
        var heb = /^[0-9]+$/.test(raw) ? parseInt(raw, 10) : parseHebNumeral(raw);
        if (heb) {
          var p = hebToPdf(heb);
          if (range) range.value = String(p);
          gotoPreview(p);
        }
      });
    }

    var cancel = $('#goto-cancel');
    if (cancel) cancel.addEventListener('click', closeGoto);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeGoto();
    });
  }

  /* ── Gestures & install prompt ────────────────────────── */

  function setupSwipe() {
    var stage = $('#page-stage');
    if (!stage) return;
    var x0 = 0, y0 = 0, on = false;
    stage.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches.length) return;
      if (state.rendering || state.animating) return;
      on = true;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (!on) return;
      on = false;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) nextPage();
      else prevPage();
    }, { passive: true });
  }

  function setupA2HS() {
    var btn = $('#btn-a2hs');
    var modal = $('#a2hs-modal');
    var done = $('#a2hs-done');
    if (!btn || !modal) return;

    function isStandalone() {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator.standalone === true;
    }
    function markUsed() {
      try { localStorage.setItem(A2HS_KEY, '1'); } catch (e) {}
    }
    function alreadyUsed() {
      try { return localStorage.getItem(A2HS_KEY) === '1'; } catch (e) { return false; }
    }

    if (isStandalone() || alreadyUsed()) {
      btn.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden');

    var deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
    });

    btn.addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          markUsed();
          btn.classList.add('hidden');
          modal.classList.add('hidden');
        });
        return;
      }
      modal.classList.remove('hidden');
    });

    function finish() {
      markUsed();
      btn.classList.add('hidden');
      modal.classList.add('hidden');
    }
    if (done) done.addEventListener('click', finish);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) finish();
    });
  }

  function flashTap(el) {
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 200);
  }

  /* ── Wiring ──────────────────────────────────────────── */

  function bindUI() {
    var btnOpen = $('#btn-open');
    if (btnOpen) btnOpen.addEventListener('click', function () { openReader(loadLastPage()); });

    var btnResume = $('#btn-resume');
    if (btnResume) btnResume.addEventListener('click', function () { openReader(loadLastPage()); });

    var btnBack = $('#btn-back');
    if (btnBack) btnBack.addEventListener('click', openIndex);

    var btnGoto = $('#btn-goto');
    if (btnGoto) btnGoto.addEventListener('click', openGoto);

    var btnPrev = $('#btn-prev');
    if (btnPrev) btnPrev.addEventListener('click', prevPage);

    var btnNext = $('#btn-next');
    if (btnNext) btnNext.addEventListener('click', nextPage);

    var tapPrev = $('#tap-prev');
    if (tapPrev) tapPrev.addEventListener('click', function (e) {
      e.preventDefault();
      flashTap(tapPrev);
      prevPage();
    });

    var tapNext = $('#tap-next');
    if (tapNext) tapNext.addEventListener('click', function (e) {
      e.preventDefault();
      flashTap(tapNext);
      nextPage();
    });

    document.addEventListener('keydown', function (e) {
      var goto = $('#goto-sheet');
      if (goto && !goto.classList.contains('hidden')) {
        if (e.key === 'Escape') closeGoto();
        return;
      }
      var reader = $('#view-reader');
      if (!reader || reader.classList.contains('hidden')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); nextPage(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevPage(); }
      if (e.key === 'Escape') openIndex();
      if (e.key === 'g' || e.key === 'ג') openGoto();
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      var reader = $('#view-reader');
      if (!reader || reader.classList.contains('hidden')) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { goTo(state.pdfPage); }, 150);
    });

    setupIndexControls();
    setupGoto();
    setupSwipe();
    setupA2HS();
  }

  function init() {
    bindUI();

    fetch('./data/toc.json')
      .then(function (r) {
        if (!r.ok) throw new Error('toc');
        return r.json();
      })
      .then(function (toc) {
        state.toc = toc;
        state.entries = (toc.entries || []).slice().sort(function (a, b) {
          return (a.pdfPage || hebToPdf(a.hebPage)) - (b.pdfPage || hebToPdf(b.hebPage));
        });
        buildToc();
        updateResume();
      })
      .catch(function () {
        var list = $('#toc-list');
        if (list) {
          list.innerHTML = '<li class="toc-empty">לא ניתן לטעון את התוכן. פתחו דרך שרת מקומי.</li>';
        }
      });

    setTimeout(function () { ensurePdf().catch(function () {}); }, 800);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js?v=9').catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
