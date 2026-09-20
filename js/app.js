(function () {
  'use strict';

  var PDF_URL = './siddur.pdf';
  var PDF_PAGES = 315;
  var STORAGE_PAGE = 'sidur-bav-last-page';
  var STORAGE_LOC = 'sidur-bav-location';
  var A2HS_KEY = 'sidur-bai-a2hs-used';
  var GEO_ASKED = 'sidur-bav-geo-asked';
  var PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';

  var HEB_VALUES = {
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9, 'י': 10,
    'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50, 'ס': 60, 'ע': 70,
    'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90, 'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
  };

  var CITIES = [
    { name: 'ירושלים',  lookup: 'Jerusalem',   il: true },
    { name: 'בני ברק',  lookup: 'Bnei Brak',   il: true },
    { name: 'תל אביב',  lookup: 'Tel Aviv',    il: true },
    { name: 'ניו יורק', lookup: 'New York',    il: false },
    { name: 'לונדון',   lookup: 'London',      il: false },
    { name: 'אנטוורפן', lookup: 'Antwerp',     il: false }
  ];

  var state = {
    toc: null, entries: [], filter: 'all', query: '',
    pdfDoc: null, pdfPage: 1, rendering: false,
    pendingPage: null, loadingPdf: null,
    location: null, plan: null, tickTimer: null
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* ── Hebrew numerals ─────────────────────────────── */

  function hebToPdf(h) { return clamp(Number(h) - 1, 1, PDF_PAGES); }
  function pdfToHeb(p) { return clamp(Number(p) + 1, 1, PDF_PAGES); }

  function parseHebNumeral(str) {
    if (str == null) return null;
    var s = String(str).replace(/[״"׳']/g, '').trim();
    if (!s) return null;
    if (s === 'טו') return 15;
    if (s === 'טז') return 16;
    var total = 0, i = 0;
    while (i < s.length) {
      if (s.slice(i, i + 2) === 'טו') { total += 15; i += 2; continue; }
      if (s.slice(i, i + 2) === 'טז') { total += 16; i += 2; continue; }
      var v = HEB_VALUES[s[i]];
      if (v == null) { i += 1; continue; }
      total += v; i += 1;
    }
    return total || null;
  }

  function toHebNumeral(n) {
    n = Math.floor(Number(n));
    if (!n || n < 1) return '';
    var out = '';
    var hundreds = [['ת', 400], ['ש', 300], ['ר', 200], ['ק', 100]];
    for (var hi = 0; hi < hundreds.length; hi++) {
      while (n >= hundreds[hi][1]) { out += hundreds[hi][0]; n -= hundreds[hi][1]; }
    }
    if (n === 15) return out + 'טו';
    if (n === 16) return out + 'טז';
    var tens = [['צ', 90], ['פ', 80], ['ע', 70], ['ס', 60], ['נ', 50], ['מ', 40], ['ל', 30], ['כ', 20], ['י', 10]];
    for (var ti = 0; ti < tens.length; ti++) {
      if (n >= tens[ti][1]) { out += tens[ti][0]; n -= tens[ti][1]; }
    }
    var ones = ' אבגדהוזחט';
    if (n > 0) out += ones[n];
    return out;
  }

  function gersh(label) {
    var s = String(label || '').replace(/[״"׳']/g, '');
    if (!s) return '';
    return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
  }
  function pageLabel(pdfPage) { return gersh(toHebNumeral(pdfToHeb(pdfPage))); }

  /* ── location ────────────────────────────────────── */

  function loadLocation() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_LOC));
      if (raw && typeof raw.lat === 'number') return raw;
    } catch (e) {}
    return null;
  }
  function saveLocation(loc) {
    try { localStorage.setItem(STORAGE_LOC, JSON.stringify(loc)); } catch (e) {}
  }

  function deviceTz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem'; }
    catch (e) { return 'Asia/Jerusalem'; }
  }

  /** Turn a stored record into a hebcal Location. */
  function toHebcalLocation(rec) {
    return new hebcal.Location(rec.lat, rec.lon, !!rec.il, rec.tzid, rec.name);
  }

  function cityRecord(city) {
    var l = hebcal.Location.lookup(city.lookup);
    return {
      name: city.name, lat: l.getLatitude(), lon: l.getLongitude(),
      tzid: l.getTzid(), il: city.il, source: 'city'
    };
  }

  function defaultLocation() {
    var tz = deviceTz();
    var match = { 'Asia/Jerusalem': 0, 'America/New_York': 3, 'Europe/London': 4, 'Europe/Brussels': 5 }[tz];
    return cityRecord(CITIES[match == null ? 0 : match]);
  }

  function askGeolocation() {
    if (!navigator.geolocation) return;
    try { localStorage.setItem(GEO_ASKED, '1'); } catch (e) {}
    navigator.geolocation.getCurrentPosition(function (pos) {
      var tz = deviceTz();
      state.location = {
        name: 'המיקום שלי',
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        tzid: tz,
        il: tz === 'Asia/Jerusalem',
        source: 'gps'
      };
      saveLocation(state.location);
      renderToday();
    }, function () { /* declined — the fallback already stands */ }, { timeout: 10000, maximumAge: 3600000 });
  }

  /* ── today ───────────────────────────────────────── */

  function renderToday() {
    if (!window.SiddurToday || !window.hebcal) return;
    var loc;
    try { loc = toHebcalLocation(state.location); }
    catch (e) { state.location = defaultLocation(); loc = toHebcalLocation(state.location); }

    var p;
    try { p = window.SiddurToday.plan(new Date(), loc, state.location.il); }
    catch (e) { console.error(e); return; }
    state.plan = p;

    $('#t-dow').textContent = p.dayName;
    $('#t-hdate').textContent = p.hebrew;
    $('#t-greg').textContent = p.greg.toLocaleDateString('en-GB');
    $('#t-loc').textContent = state.location.name;

    var badges = $('#t-badges');
    badges.innerHTML = '';
    var labels = p.labels.slice();
    if (p.parsha && !p.restricted) labels.push('פרשת ' + p.parsha);
    labels.forEach(function (l) {
      var s = document.createElement('span');
      s.className = 'badge';
      s.textContent = l;
      badges.appendChild(s);
    });

    /* Shabbat / Yom Tov: this siddur has no davening for them. */
    var notice = $('#t-notice');
    var prayers = $('#t-prayers');
    if (p.restricted) {
      prayers.classList.add('hidden');
      notice.classList.remove('hidden');
      $('#t-notice-text').textContent = p.isShabbat
        ? 'שבת קודש. הסידור הזה הוא לימות החול — אין בו תפילות שבת.'
        : 'יום טוב. הסידור הזה הוא לימות החול — אין בו תפילות החג.';
    } else {
      notice.classList.add('hidden');
      prayers.classList.remove('hidden');
      var now = p.tefillot.filter(function (t) { return t.current; })[0];
      $('#t-now-title').textContent = now.title;
      $('#t-now-page').textContent = 'עמוד ' + pageLabel(now.page);
      $('#t-now').onclick = function () { openReader(now.page); };

      var others = $('#t-others');
      others.innerHTML = '';
      p.tefillot.filter(function (t) { return !t.current; }).forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = t.title;
        b.onclick = function () { openReader(t.page); };
        others.appendChild(b);
      });
    }

    /* today's specials */
    var sBlock = $('#t-special-block'), sList = $('#t-special');
    sList.innerHTML = '';
    var specials = p.restricted
      ? p.special.filter(function (s) { return s.page === window.SiddurToday.PAGES.omer; })
      : p.special;
    if (specials.length) {
      sBlock.classList.remove('hidden');
      specials.forEach(function (s) {
        var li = document.createElement('li');
        var el = document.createElement(s.page ? 'button' : 'div');
        el.className = 'row' + (s.page ? '' : ' static');
        if (s.page) el.type = 'button';
        var main = document.createElement('span');
        main.className = 'row-main';
        var t = document.createElement('span');
        t.className = 'row-title';
        t.textContent = s.title;
        main.appendChild(t);
        if (s.note) {
          var n = document.createElement('span');
          n.className = 'row-note';
          n.textContent = s.note;
          main.appendChild(n);
        }
        el.appendChild(main);
        if (s.page) {
          var pg = document.createElement('span');
          pg.className = 'row-page';
          pg.textContent = pageLabel(s.page);
          el.appendChild(pg);
          el.onclick = function () { openReader(s.page); };
        }
        li.appendChild(el);
        sList.appendChild(li);
      });
    } else {
      sBlock.classList.add('hidden');
    }

    /* reminders */
    var rBlock = $('#t-reminders-block'), rList = $('#t-reminders');
    rList.innerHTML = '';
    if (!p.restricted && p.reminders.length) {
      rBlock.classList.remove('hidden');
      p.reminders.forEach(function (r) {
        var s = document.createElement('span');
        s.className = 'chip';
        s.textContent = r;
        rList.appendChild(s);
      });
    } else {
      rBlock.classList.add('hidden');
    }
  }

  /** Re-render when the current tefillah could have changed. */
  function scheduleTick() {
    clearTimeout(state.tickTimer);
    state.tickTimer = setTimeout(function () {
      if (!$('#view-today').classList.contains('hidden')) renderToday();
      scheduleTick();
    }, 60000);
  }

  /* ── index sheet ─────────────────────────────────── */

  function normalize(s) { return String(s || '').replace(/[״"׳'֑-ׇ]/g, '').trim(); }

  function buildIndex() {
    var list = $('#idx-list');
    list.innerHTML = '';
    var groups = { daily: 'יום־יום', moadim: 'מועדים', other: 'אחר' };
    ['daily', 'moadim', 'other'].forEach(function (g) {
      var items = (state.toc.entries || []).filter(function (e) { return (groups[e.group] ? e.group : 'other') === g; });
      if (!items.length) return;
      var h = document.createElement('li');
      h.className = 'idx-head';
      h.dataset.group = g;
      h.textContent = (state.toc.groups && state.toc.groups[g]) || groups[g];
      list.appendChild(h);
      items.forEach(function (item) {
        var li = document.createElement('li');
        li.dataset.group = g;
        li.dataset.search = normalize(item.title);
        li.className = 'idx-row';
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'row';
        var main = document.createElement('span');
        main.className = 'row-main';
        main.textContent = item.title;
        var pg = document.createElement('span');
        pg.className = 'row-page';
        pg.textContent = gersh(item.hebLabel || toHebNumeral(item.hebPage));
        b.appendChild(main); b.appendChild(pg);
        b.onclick = function () { closeIndex(); openReader(item.pdfPage || hebToPdf(item.hebPage)); };
        li.appendChild(b);
        list.appendChild(li);
      });
    });
    filterIndex();
  }

  function filterIndex() {
    var q = normalize(state.query).toLowerCase();
    var seen = {}, visible = 0;
    $$('#idx-list .idx-row').forEach(function (row) {
      var okG = state.filter === 'all' || state.filter === row.dataset.group;
      var okQ = !q || row.dataset.search.toLowerCase().indexOf(q) !== -1;
      var show = okG && okQ;
      row.classList.toggle('hidden', !show);
      if (show) { visible++; seen[row.dataset.group] = true; }
    });
    $$('#idx-list .idx-head').forEach(function (h) {
      h.classList.toggle('hidden', !(state.filter === 'all' && seen[h.dataset.group]));
    });
    $('#idx-empty').classList.toggle('hidden', visible > 0);
  }

  function openIndex() { $('#sheet-index').classList.remove('hidden'); }
  function closeIndex() { $('#sheet-index').classList.add('hidden'); }

  /* ── PDF reader (paint off-screen, then swap — do not reorder) ── */

  function ensurePdf() {
    if (state.pdfDoc) return Promise.resolve(state.pdfDoc);
    if (state.loadingPdf) return state.loadingPdf;
    if (typeof pdfjsLib === 'undefined') return Promise.reject(new Error('PDF.js לא נטען'));
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + 'pdf.worker.min.js';
    state.loadingPdf = pdfjsLib.getDocument({ url: PDF_URL, disableAutoFetch: false, disableStream: false })
      .promise.then(function (doc) { state.pdfDoc = doc; state.loadingPdf = null; return doc; })
      .catch(function (err) { state.loadingPdf = null; throw err; });
    return state.loadingPdf;
  }

  function stageSize() {
    var st = $('#page-stage');
    return {
      w: Math.max(120, (st ? st.clientWidth : window.innerWidth) - 8),
      h: Math.max(120, (st ? st.clientHeight : window.innerHeight) - 8)
    };
  }

  function paintPage(canvas, n) {
    return ensurePdf().then(function (doc) { return doc.getPage(n); }).then(function (page) {
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

  function copyCanvas(src, dst) {
    if (!src || !dst || !src.width) return;
    dst.width = src.width; dst.height = src.height;
    dst.style.width = src.style.width; dst.style.height = src.style.height;
    dst.getContext('2d', { alpha: false }).drawImage(src, 0, 0);
  }

  function sectionFor(pdfPage) {
    var found = null;
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].pdfPage <= pdfPage) found = state.entries[i]; else break;
    }
    return found;
  }

  function updateLabel(pdfPage) {
    var el = $('#page-label');
    if (el) el.innerHTML = '<span class="heb">עמוד ' + pageLabel(pdfPage) + '</span>' +
      '<span class="pos">' + pdfPage + '/' + PDF_PAGES + '</span>';
    var head = $('#running-head');
    if (head) { var s = sectionFor(pdfPage); head.textContent = s ? s.title : ''; }
    var fill = $('#progress-fill');
    if (fill) fill.style.width = ((pdfPage / PDF_PAGES) * 100).toFixed(2) + '%';
    var pv = $('#btn-prev'), nx = $('#btn-next');
    if (pv) pv.disabled = pdfPage <= 1;
    if (nx) nx.disabled = pdfPage >= PDF_PAGES;
  }

  function renderPage(pdfPage) {
    pdfPage = clamp(pdfPage, 1, PDF_PAGES);
    if (state.rendering) { state.pendingPage = pdfPage; return; }
    state.rendering = true;
    state.pdfPage = pdfPage;
    try { localStorage.setItem(STORAGE_PAGE, String(pdfPage)); } catch (e) {}
    updateLabel(pdfPage);

    var front = $('#pdf-canvas'), back = $('#pdf-canvas-next'), loading = $('#reader-loading');
    var hasContent = front && front.width > 0;
    if (loading) loading.classList.toggle('hidden', !!hasContent);
    var target = (hasContent && back) ? back : front;

    paintPage(target, pdfPage).then(function () {
      if (target === back && front) {
        back.style.width = front.style.width || back.style.width;
        back.style.height = front.style.height || back.style.height;
        copyCanvas(back, front);
      } else if (front && back) {
        copyCanvas(front, back);
      }
      if (loading) loading.classList.add('hidden');
      state.rendering = false;
      if (state.pendingPage != null && state.pendingPage !== state.pdfPage) {
        var nxt = state.pendingPage; state.pendingPage = null; renderPage(nxt);
      } else { state.pendingPage = null; }
    }).catch(function (err) {
      console.error(err);
      if (loading) { loading.innerHTML = '<span style="color:#fff">שגיאה בטעינת הדף</span>'; loading.classList.remove('hidden'); }
      state.rendering = false;
    });
  }

  function goTo(p) { renderPage(clamp(p, 1, PDF_PAGES)); }
  function nextPage() { if (state.pdfPage < PDF_PAGES) goTo(state.pdfPage + 1); }
  function prevPage() { if (state.pdfPage > 1) goTo(state.pdfPage - 1); }

  function openReader(pdfPage) {
    $('#view-reader').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { goTo(pdfPage || 14); });
    });
  }
  function closeReader() {
    $('#view-reader').classList.add('hidden');
    document.body.style.overflow = '';
    renderToday();
  }

  /* ── goto ────────────────────────────────────────── */

  function gotoPreview(p) {
    p = clamp(p, 1, PDF_PAGES);
    $('#goto-heb').textContent = 'עמוד ' + pageLabel(p);
    var s = sectionFor(p);
    $('#goto-sub').textContent = s ? s.title : (p + ' / ' + PDF_PAGES);
  }
  function openGoto() {
    $('#goto-range').value = String(state.pdfPage);
    $('#goto-input').value = '';
    gotoPreview(state.pdfPage);
    $('#sheet-goto').classList.remove('hidden');
  }
  function closeGoto() { $('#sheet-goto').classList.add('hidden'); }

  /* ── location sheet ──────────────────────────────── */

  function openLoc() {
    var ul = $('#loc-list');
    ul.innerHTML = '';
    CITIES.forEach(function (c) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'row';
      var m = document.createElement('span');
      m.className = 'row-main';
      m.textContent = c.name;
      b.appendChild(m);
      b.onclick = function () {
        state.location = cityRecord(c);
        saveLocation(state.location);
        $('#sheet-loc').classList.add('hidden');
        renderToday();
      };
      li.appendChild(b);
      ul.appendChild(li);
    });
    $('#sheet-loc').classList.remove('hidden');
  }

  /* ── wiring ──────────────────────────────────────── */

  function bind() {
    $('#btn-index').onclick = openIndex;
    $('#idx-close').onclick = closeIndex;
    $('#btn-back').onclick = closeReader;
    $('#btn-goto').onclick = openGoto;
    $('#btn-prev').onclick = prevPage;
    $('#btn-next').onclick = nextPage;
    $('#tap-prev').onclick = function (e) { e.preventDefault(); prevPage(); };
    $('#tap-next').onclick = function (e) { e.preventDefault(); nextPage(); };

    $$('[data-page]').forEach(function (el) {
      el.onclick = function () { openReader(parseInt(el.dataset.page, 10)); };
    });

    $('#idx-search').oninput = function () { state.query = this.value; filterIndex(); };
    $$('#idx-tabs .seg').forEach(function (seg) {
      seg.onclick = function () {
        state.filter = seg.dataset.filter;
        $$('#idx-tabs .seg').forEach(function (s) { s.classList.toggle('is-on', s === seg); });
        filterIndex();
      };
    });

    $('#goto-range').oninput = function () { gotoPreview(parseInt(this.value, 10)); };
    $('#goto-range').onchange = function () { closeGoto(); goTo(parseInt(this.value, 10) || 1); };
    $('#goto-form').onsubmit = function (e) {
      e.preventDefault();
      var raw = $('#goto-input').value.trim();
      if (!raw) return;
      var heb = /^[0-9]+$/.test(raw) ? parseInt(raw, 10) : parseHebNumeral(raw);
      if (!heb) return;
      closeGoto(); goTo(hebToPdf(heb));
    };
    $('#goto-input').oninput = function () {
      var raw = this.value.trim();
      var heb = /^[0-9]+$/.test(raw) ? parseInt(raw, 10) : parseHebNumeral(raw);
      if (heb) { $('#goto-range').value = String(hebToPdf(heb)); gotoPreview(hebToPdf(heb)); }
    };
    $('#goto-cancel').onclick = closeGoto;
    $('#sheet-goto').onclick = function (e) { if (e.target === this) closeGoto(); };

    $('#btn-location').onclick = openLoc;
    $('#loc-cancel').onclick = function () { $('#sheet-loc').classList.add('hidden'); };
    $('#loc-gps').onclick = function () { $('#sheet-loc').classList.add('hidden'); askGeolocation(); };
    $('#sheet-loc').onclick = function (e) { if (e.target === this) this.classList.add('hidden'); };

    document.addEventListener('keydown', function (e) {
      if (!$('#sheet-goto').classList.contains('hidden')) { if (e.key === 'Escape') closeGoto(); return; }
      if (!$('#sheet-index').classList.contains('hidden')) { if (e.key === 'Escape') closeIndex(); return; }
      if ($('#view-reader').classList.contains('hidden')) return;
      // RTL book: left goes forward, right goes back.
      if (e.key === 'ArrowLeft' || e.key === ' ') { e.preventDefault(); nextPage(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); prevPage(); }
      if (e.key === 'Escape') closeReader();
    });

    var stage = $('#page-stage'), x0 = 0, y0 = 0, on = false;
    stage.addEventListener('touchstart', function (e) {
      if (!e.touches || !e.touches.length || state.rendering) return;
      on = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (!on) return; on = false;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      // Sweeping the page rightward turns it forward, as in a bound sefer.
      if (dx > 0) nextPage(); else prevPage();
    }, { passive: true });

    var rt;
    window.addEventListener('resize', function () {
      if ($('#view-reader').classList.contains('hidden')) return;
      clearTimeout(rt);
      rt = setTimeout(function () { goTo(state.pdfPage); }, 150);
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && $('#view-reader').classList.contains('hidden')) renderToday();
    });

    setupA2HS();
  }

  function setupA2HS() {
    var btn = $('#btn-a2hs'), modal = $('#a2hs-modal'), done = $('#a2hs-done');
    function standalone() {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        window.navigator.standalone === true;
    }
    var used;
    try { used = localStorage.getItem(A2HS_KEY) === '1'; } catch (e) { used = false; }
    if (standalone() || used) return;
    btn.classList.remove('hidden');
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
    btn.onclick = function () {
      if (deferred) { deferred.prompt(); deferred = null; finish(); return; }
      modal.classList.remove('hidden');
    };
    function finish() {
      try { localStorage.setItem(A2HS_KEY, '1'); } catch (e) {}
      btn.classList.add('hidden');
      modal.classList.add('hidden');
    }
    done.onclick = finish;
    modal.onclick = function (e) { if (e.target === modal) finish(); };
  }

  function init() {
    bind();

    state.location = loadLocation() || defaultLocation();
    renderToday();
    scheduleTick();

    var asked;
    try { asked = localStorage.getItem(GEO_ASKED) === '1'; } catch (e) { asked = true; }
    if (!asked && state.location.source !== 'gps') {
      setTimeout(askGeolocation, 600);
    }

    fetch('./data/toc.json')
      .then(function (r) { if (!r.ok) throw new Error('toc'); return r.json(); })
      .then(function (toc) {
        state.toc = toc;
        state.entries = (toc.entries || []).slice().sort(function (a, b) {
          return (a.pdfPage || hebToPdf(a.hebPage)) - (b.pdfPage || hebToPdf(b.hebPage));
        });
        buildIndex();
      })
      .catch(function () {
        $('#idx-list').innerHTML = '<li class="empty">לא ניתן לטעון את התוכן.</li>';
      });

    setTimeout(function () { ensurePdf().catch(function () {}); }, 1000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=10').catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', init);
})();
