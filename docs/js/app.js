(function () {
  'use strict';

  var PDF_URL = './siddur.pdf';
  var PDF_PAGES = 315;
  var STORAGE_PAGE = 'sidur-bav-last-page';
  var A2HS_KEY = 'sidur-bai-a2hs-used';
  var PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
  var FLIP_MS = 160;

  var HEB_VALUES = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
    'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50, 'ס': 60, 'ע': 70,
    'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
  };

  var GROUP_IDS = { daily: 'toc-daily', moadim: 'toc-moadim', other: 'toc-other' };

  var state = {
    toc: null,
    pdfDoc: null,
    pdfPage: 1,
    rendering: false,
    animating: false,
    pendingPage: null,
    pendingDir: null,
    loadingPdf: null,
  };

  var $ = function (sel) { return document.querySelector(sel); };

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

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
    var tens = [['צ', 90], ['פ', 80], ['ע', 70], ['ס', 60], ['נ', 50], ['מ', 40], ['ל', 30], ['כ', 20]];
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

  window.hebToPdf = hebToPdf;
  window.pdfToHeb = pdfToHeb;
  window.parseHebNumeral = parseHebNumeral;
  window.toHebNumeral = toHebNumeral;

  function loadLastPage() {
    try {
      var n = parseInt(localStorage.getItem(STORAGE_PAGE), 10);
      if (n >= 1 && n <= PDF_PAGES) return n;
    } catch (e) {}
    return 3; // default: השכמת הבוקר (heb ד)
  }

  function saveLastPage(p) {
    try { localStorage.setItem(STORAGE_PAGE, String(p)); } catch (e) {}
  }

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
    }
  }

  function updateLabel(pdfPage) {
    var el = $('#page-label');
    if (!el) return;
    var heb = pdfToHeb(pdfPage);
    var hebLabel = toHebNumeral(heb);
    el.innerHTML =
      '<span class="heb">עמוד ' + hebLabel + '</span>' +
      '<span class="pdf-pos">PDF ' + pdfPage + ' / ' + PDF_PAGES + '</span>';
    var prev = $('#btn-prev');
    var next = $('#btn-next');
    if (prev) prev.disabled = pdfPage <= 1;
    if (next) next.disabled = pdfPage >= PDF_PAGES;
  }

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
    var bar = $('#reader-bar');
    var w = stage ? stage.clientWidth : window.innerWidth;
    var h = stage ? stage.clientHeight : (window.innerHeight - (bar ? bar.offsetHeight : 56));
    return { w: Math.max(120, w - 12), h: Math.max(120, h - 12) };
  }

  function frontCanvas() { return $('#pdf-canvas'); }
  function backCanvas() { return $('#pdf-canvas-next'); }
  function pageLeaf() { return $('#page-leaf'); }


  /** Paint a PDF page onto a canvas; returns Promise resolving when done. */
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

      return page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;
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

  function resetLeafClasses() {
    var leaf = pageLeaf();
    if (leaf) {
      leaf.classList.remove(
        'turn-next', 'turn-prev', 'dragging', 'dragging-next', 'dragging-prev'
      );
    }
    var front = frontCanvas();
    var back = backCanvas();
    var shade = $('#page-shade');
    if (front) {
      front.style.transform = '';
      front.style.opacity = '';
      front.style.zIndex = '';
      front.style.visibility = '';
    }
    if (back) {
      back.style.transform = '';
      back.style.opacity = '0';
      back.style.visibility = 'hidden';
      back.style.zIndex = '';
    }
    if (shade) {
      shade.style.opacity = '0';
      shade.style.display = 'none';
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
   * WhatsApp Status–style page change:
   * paint the new page off-screen first, then swap instantly.
   * Never clears the visible page before the next one is ready (no black flash).
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

    // Only show loading on the very first page (nothing on screen yet)
    if (!hasContent && loading) loading.classList.remove('hidden');
    else if (loading) loading.classList.add('hidden');

    resetLeafClasses();

    // Always paint onto back while front stays visible
    var paintTarget = (hasContent && back) ? back : front;

    paintPage(paintTarget, pdfPage).then(function () {
      if (paintTarget === back && front) {
        // Match size then instant promote — front never goes blank
        back.style.width = front.style.width || back.style.width;
        back.style.height = front.style.height || back.style.height;
        copyCanvas(back, front);
      } else if (front && back) {
        copyCanvas(front, back);
      }
      resetLeafClasses();
      if (loading) loading.classList.add('hidden');
      finishPending();
    }).catch(function (err) {
      console.error(err);
      if (loading) {
        loading.textContent = 'שגיאה בטעינת הדף';
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

function openToc() {
    showView('home');
  }

  function renderToc() {
    var entries = (state.toc && state.toc.entries) || [];
    Object.keys(GROUP_IDS).forEach(function (g) {
      var ul = $('#' + GROUP_IDS[g]);
      if (!ul) return;
      ul.innerHTML = '';
    });
    entries.forEach(function (item) {
      var ul = $('#' + GROUP_IDS[item.group]);
      if (!ul) ul = $('#toc-other');
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      var title = document.createElement('span');
      title.className = 'toc-title';
      title.textContent = item.title;
      var page = document.createElement('span');
      page.className = 'toc-page';
      page.textContent = item.hebLabel || toHebNumeral(item.hebPage);
      btn.appendChild(title);
      btn.appendChild(page);
      btn.addEventListener('click', function () {
        var pdf = item.pdfPage || hebToPdf(item.hebPage);
        openReader(pdf);
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

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

  function bindUI() {
    var btnOpen = $('#btn-open');
    if (btnOpen) btnOpen.addEventListener('click', function () {
      openReader(loadLastPage());
    });
    var btnToc = $('#btn-toc');
    if (btnToc) btnToc.addEventListener('click', openToc);
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
    if (tapNext) tapNext.addEventListener('click', nextPage);

    document.addEventListener('keydown', function (e) {
      var reader = $('#view-reader');
      if (!reader || reader.classList.contains('hidden')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); nextPage(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevPage(); }
      if (e.key === 'Escape') openToc();
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      var reader = $('#view-reader');
      if (!reader || reader.classList.contains('hidden')) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { goTo(state.pdfPage); }, 150);
    });

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
        renderToc();
      })
      .catch(function () {
        var daily = $('#toc-daily');
        if (daily) {
          daily.innerHTML = '<li style="padding:1rem;color:#a11">לא ניתן לטעון את התוכן. פתחו דרך שרת מקומי.</li>';
        }
      });

    setTimeout(function () { ensurePdf().catch(function () {}); }, 800);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js?v=8').catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
