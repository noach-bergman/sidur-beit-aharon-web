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
    location: null, plan: null, tickTimer: null,
    menu: { categories: [] }, cat: null,
    tehillim: null, chromeTimer: null
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* ── Hebrew numerals ─────────────────────────────── */

  /* The scan does NOT map linearly onto the printed folios: four printed pages
     are missing, and תהלים and מנהגים each restart their own numbering. The
     real runs live in data/toc.json under "sequences" (printed = pdf + offset)
     and are verified against the folio printed on every scanned page. */
  function seqForPdf(pdfPage) {
    var seqs = (state.toc && state.toc.sequences) || [];
    for (var i = 0; i < seqs.length; i++) {
      if (pdfPage >= seqs[i].pdfFrom && pdfPage <= seqs[i].pdfTo) return seqs[i];
    }
    return null;
  }
  function seqForPrinted(section, printed) {
    var seqs = (state.toc && state.toc.sequences) || [];
    for (var i = 0; i < seqs.length; i++) {
      var q = seqs[i];
      if (q.section !== section) continue;
      if (printed >= q.pdfFrom + q.offset && printed <= q.pdfTo + q.offset) return q;
    }
    return null;
  }

  /** Printed folio in `section` -> PDF page, or null when it is not in the scan. */
  function printedToPdf(printed, section) {
    var q = seqForPrinted(section || 'main', printed);
    return q ? printed - q.offset : null;
  }

  /** PDF page -> {printed, section} or null for the unnumbered plates. */
  function pdfToPrinted(pdfPage) {
    var q = seqForPdf(pdfPage);
    return q ? { printed: pdfPage + q.offset, section: q.section } : null;
  }

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

  var SECTION_NAME = { tehillim: 'תהלים', minhagim: 'מנהגים' };

  /** What the page calls itself, e.g. "עמוד ק״ג" or "תהלים ב׳". */
  function pageLabel(pdfPage) {
    var pr = pdfToPrinted(pdfPage);
    if (!pr) return '';
    var num = gersh(toHebNumeral(pr.printed));
    return SECTION_NAME[pr.section] ? SECTION_NAME[pr.section] + ' ' + num : 'עמוד ' + num;
  }

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

  /* Two levels, after the menu of the original JAR app: a short list of
     what you actually daven, then the sections inside it. Searching flattens
     both levels. */

  function tocByTitle(title) {
    for (var i = 0; i < (state.toc.entries || []).length; i++) {
      if (state.toc.entries[i].title === title) return state.toc.entries[i];
    }
    return null;
  }

  /** The JAR appended context to a couple of entries; so do we. */
  function categoryLabel(cat) {
    var p = state.plan;
    if (!p) return cat.title;
    if (cat.key === 'shacharit' && p.hasMusaf) return cat.title + ' ומוסף';
    if (cat.key === 'mincha' && p.hasYomKippurKatan) return cat.title + ' ותפילת יום כיפור קטן';
    return cat.title;
  }

  function makeRow(title, note, pageLbl, onClick) {
    var el = document.createElement(onClick ? 'button' : 'div');
    el.className = 'row' + (onClick ? '' : ' static');
    if (onClick) el.type = 'button';
    var main = document.createElement('span');
    main.className = 'row-main';
    var t = document.createElement('span');
    t.className = 'row-title';
    t.textContent = title;
    main.appendChild(t);
    if (note) {
      var n = document.createElement('span');
      n.className = 'row-note';
      n.textContent = note;
      main.appendChild(n);
    }
    el.appendChild(main);
    if (pageLbl) {
      var pg = document.createElement('span');
      pg.className = 'row-page';
      pg.textContent = pageLbl;
      el.appendChild(pg);
    }
    if (onClick) el.onclick = onClick;
    var li = document.createElement('li');
    li.appendChild(el);
    return li;
  }

  /** The one header button is "back" when drilled in, "close" at the top. */
  function setHeaderMode(drilled) {
    $('#idx-ico-close').classList.toggle('hidden', drilled);
    $('#idx-ico-up').classList.toggle('hidden', !drilled);
    $('#idx-back').setAttribute('aria-label', drilled ? 'חזרה' : 'סגירה');
  }

  function renderMenu() {
    var list = $('#idx-list');
    var title = $('#idx-title');
    list.innerHTML = '';
    $('#idx-empty').classList.add('hidden');

    var q = normalize(state.query).toLowerCase();

    if (q) {                                   // flat search across everything
      title.textContent = 'חיפוש';
      setHeaderMode(false);
      var hits = 0;
      (state.menu.categories || []).forEach(function (cat) {
        cat.items.forEach(function (t) {
          if (normalize(t).toLowerCase().indexOf(q) === -1) return;
          var e = tocByTitle(t);
          if (!e) return;
          hits++;
          list.appendChild(rowForEntry(e, cat.title));
        });
      });
      $('#idx-empty').classList.toggle('hidden', hits > 0);
      return;
    }

    if (state.cat) {                           // level 2
      var cat = state.cat;
      title.textContent = categoryLabel(cat);
      setHeaderMode(true);
      cat.items.forEach(function (t) {
        var e = tocByTitle(t);
        if (e) list.appendChild(rowForEntry(e, null));
      });
      return;
    }

    title.textContent = 'לבחירת תפילה';        // level 1
    setHeaderMode(false);
    (state.menu.categories || []).forEach(function (cat) {
      var live = cat.items.filter(function (t) {
        var e = tocByTitle(t); return e && e.pdfPage;
      });
      if (!live.length) return;
      var note = cat.items.length > 1 ? cat.items.length + ' סדרים' : null;
      list.appendChild(makeRow(categoryLabel(cat), note, null, function () {
        if (cat.key === 'tehillim') { closeIndex(); openTehillim(); return; }
        if (live.length === 1 && cat.items.length === 1) {
          var e = tocByTitle(cat.items[0]);
          closeIndex(); openReader(e.pdfPage);
          return;
        }
        state.cat = cat;
        renderMenu();
        $('#idx-list').scrollTop = 0;
      }));
    });
  }

  function rowForEntry(e, catName) {
    var note = e.note || catName || null;
    var lbl = e.printedLabel ? gersh(e.printedLabel) : '';
    if (!e.pdfPage) return makeRow(e.title, e.note || 'חסר בסריקה', lbl, null);
    return makeRow(e.title, note, lbl, function () {
      closeIndex();
      if (e.section === 'tehillim') openTehillim(); else openReader(e.pdfPage);
    });
  }

  function openIndex() {
    state.cat = null;
    state.query = '';
    var srch = $('#idx-search');
    if (srch) srch.value = '';
    renderMenu();
    $('#sheet-index').classList.remove('hidden');
  }
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

  /** The page fills the whole screen; only the notch / home-bar insets are kept clear. */
  function stageSize() {
    var st = $('#page-stage');
    if (!st) return { w: window.innerWidth, h: window.innerHeight };
    var cs = getComputedStyle(st);
    return {
      w: Math.max(120, st.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
      h: Math.max(120, st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom))
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
    var lbl = pageLabel(pdfPage);
    if (el) el.innerHTML = '<span class="heb">' + (lbl || '—') + '</span>' +
      '<span class="pos">' + pdfPage + '/' + PDF_PAGES + '</span>';
    var head = $('#running-head');
    if (head) { var s = sectionFor(pdfPage); head.textContent = tehillimHead(pdfPage) || (s ? s.title : ''); }
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

  /* Controls stay hidden so the page has the screen; a tap in the middle of
     the page brings them up, and another tap (or turning the page) puts them
     away. The edges of the page turn it, as before. */
  function setChrome(on) {
    clearTimeout(state.chromeTimer);
    $('#view-reader').classList.toggle('chrome-on', on);
  }
  function toggleChrome() { setChrome(!$('#view-reader').classList.contains('chrome-on')); }

  function openReader(pdfPage) {
    var wasOpen = !$('#view-reader').classList.contains('hidden');
    $('#view-reader').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (!wasOpen) {
      // show where you are for a moment, then get out of the way
      setChrome(true);
      state.chromeTimer = setTimeout(function () { setChrome(false); }, 1800);
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { goTo(pdfPage || 14); });
    });
  }
  function closeReader() {
    setChrome(false);
    $('#view-reader').classList.add('hidden');
    document.body.style.overflow = '';
    renderToday();
  }

  /* ── tehillim: five books, 150 perakim ───────────── */

  /** Perakim on a scanned page, as its running head names them. */
  function perakimOn(pdfPage) {
    var t = state.tehillim;
    return (t && t.pages[String(pdfPage)]) || null;
  }

  /** PDF page on which a perek begins: the first page that names it. */
  function perekPage(n) {
    return state.tehillim ? state.tehillim.start[n] || null : null;
  }

  function bookOf(n) {
    var books = state.tehillim ? state.tehillim.books : [];
    for (var i = 0; i < books.length; i++) if (n >= books[i].from && n <= books[i].to) return books[i];
    return null;
  }

  function perakimRange(list) {
    var a = toHebNumeral(list[0]), b = toHebNumeral(list[list.length - 1]);
    return list.length > 1 ? a + '–' + b : a;
  }

  /** e.g. "תהלים · ספר ראשון · א–ד" */
  function tehillimHead(pdfPage) {
    var list = perakimOn(pdfPage);
    if (!list) return '';
    var bk = bookOf(list[list.length - 1]);
    return 'תהלים · ' + (bk ? bk.title + ' · ' : '') + perakimRange(list);
  }

  function prepTehillim(t) {
    t.start = {};
    Object.keys(t.pages).map(Number).sort(function (a, b) { return a - b; }).forEach(function (pg) {
      t.pages[pg].forEach(function (n) { if (!t.start[n]) t.start[n] = pg; });
    });
    return t;
  }

  function renderTehillim() {
    var t = state.tehillim;
    var seg = $('#th-books'), list = $('#th-list');
    seg.innerHTML = '';
    list.innerHTML = '';
    t.books.forEach(function (bk, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg';
      b.textContent = 'ספר ' + gersh(toHebNumeral(i + 1));
      b.onclick = function () { scrollToBook(i); };
      seg.appendChild(b);

      var sec = document.createElement('section');
      sec.className = 'th-book';
      sec.id = 'th-book-' + i;
      var h = document.createElement('h3');
      h.className = 'block-title';
      h.textContent = bk.title;
      var small = document.createElement('small');
      small.textContent = 'פרקים ' + toHebNumeral(bk.from) + '–' + toHebNumeral(bk.to);
      h.appendChild(small);
      sec.appendChild(h);
      var grid = document.createElement('div');
      grid.className = 'th-grid';
      for (var n = bk.from; n <= bk.to; n++) {
        var pb = document.createElement('button');
        pb.type = 'button';
        pb.className = 'th-perek';
        pb.dataset.perek = String(n);
        pb.textContent = toHebNumeral(n);
        pb.setAttribute('aria-label', 'פרק ' + toHebNumeral(n));
        pb.onclick = (function (pg) {
          return function () { closeTehillim(); openReader(pg); };
        })(perekPage(n));
        grid.appendChild(pb);
      }
      sec.appendChild(grid);
      list.appendChild(sec);
    });
  }

  function scrollToBook(i) {
    var sc = $('#th-scroll'), sec = $('#th-book-' + i);
    if (!sec) return;
    sc.scrollTop += sec.getBoundingClientRect().top - sc.getBoundingClientRect().top;
    markBook(i);
  }

  function markBook(i) {
    $$('#th-books .seg').forEach(function (b, k) { b.classList.toggle('is-on', k === i); });
  }

  function onTehillimScroll() {
    var sc = $('#th-scroll'), top = sc.getBoundingClientRect().top + 40, cur = 0;
    var secs = $$('.th-book');
    secs.forEach(function (sec, i) { if (sec.getBoundingClientRect().top <= top) cur = i; });
    // the last, short book can never reach the top: at the bottom, it is the one you see
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) cur = secs.length - 1;
    markBook(cur);
  }

  function lastPage() {
    var n;
    try { n = parseInt(localStorage.getItem(STORAGE_PAGE), 10); } catch (e) {}
    return n || null;
  }

  function openTehillim() {
    if (!state.tehillim) {                 // map not loaded: fall back to the start of the sefer
      var pg = window.SiddurToday && window.SiddurToday.PAGES.tehillim;
      if (pg) openReader(pg);
      return;
    }
    if (!$('#th-list').children.length) renderTehillim();

    // where you left off, if that was inside tehillim
    var here = state.pdfPage && !$('#view-reader').classList.contains('hidden') ? state.pdfPage : lastPage();
    var on = here ? perakimOn(here) : null;
    $$('.th-perek').forEach(function (b) {
      b.classList.toggle('is-here', !!on && on.indexOf(Number(b.dataset.perek)) !== -1);
    });
    var resume = $('#th-resume');
    resume.classList.toggle('hidden', !on);
    if (on) {
      resume.textContent = 'המשך מפרק ' + perakimRange(on);
      resume.onclick = function () { closeTehillim(); openReader(here); };
    }

    $('#sheet-tehillim').classList.remove('hidden');
    if (on) scrollToBook(Math.max(0, state.tehillim.books.indexOf(bookOf(on[0]))));
    else { $('#th-scroll').scrollTop = 0; markBook(0); }
  }
  function closeTehillim() { $('#sheet-tehillim').classList.add('hidden'); }

  /* ── goto ────────────────────────────────────────── */

  function gotoPreview(p) {
    p = clamp(p, 1, PDF_PAGES);
    $('#goto-heb').textContent = pageLabel(p) || ('עמוד ' + p);
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

  /* ── zmanim ──────────────────────────────────────── */

  var ZMANIM_ROWS = [
    ['alot',          'עלות השחר'],
    ['sunrise',       'הנץ החמה'],
    ['sofZmanShma',   'סוף זמן קריאת שמע'],
    ['sofZmanTfilla', 'סוף זמן תפילה'],
    ['chatzot',       'חצות היום'],
    ['minchaGedola',  'מנחה גדולה'],
    ['minchaKetana',  'מנחה קטנה'],
    ['plag',          'פלג המנחה'],
    ['sunset',        'שקיעה'],
    ['tzeit',         'צאת הכוכבים'],
    ['chatzotNight',  'חצות הלילה']
  ];

  function openZmanim() {
    var p = state.plan;
    if (!p) return;
    var fmt = function (d) {
      try {
        return d.toLocaleTimeString('he-IL', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: state.location.tzid
        });
      } catch (e) { return '—'; }
    };
    $('#zm-where').textContent = state.location.name + ' · ' + p.hebrew;
    var ul = $('#zm-list');
    ul.innerHTML = '';
    ZMANIM_ROWS.forEach(function (r) {
      var d = p.zmanim[r[0]];
      if (!d) return;
      ul.appendChild(makeRow(r[1], null, fmt(d), null));
    });
    $('#sheet-zmanim').classList.remove('hidden');
  }

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
    $('#idx-back').onclick = function () {
      if (state.cat) { state.cat = null; renderMenu(); } else closeIndex();
    };
    $('#btn-back').onclick = closeReader;
    // inside tehillim the list button picks a perek instead of a folio
    $('#btn-goto').onclick = function () { if (perakimOn(state.pdfPage)) openTehillim(); else openGoto(); };
    $('#btn-prev').onclick = prevPage;
    $('#btn-next').onclick = nextPage;
    $('#tap-prev').onclick = function (e) { e.preventDefault(); setChrome(false); prevPage(); };
    $('#tap-next').onclick = function (e) { e.preventDefault(); setChrome(false); nextPage(); };
    $('#tap-menu').onclick = function (e) { e.preventDefault(); toggleChrome(); };

    $('#th-close').onclick = closeTehillim;
    $('#th-scroll').addEventListener('scroll', onTehillimScroll, { passive: true });
    $('#th-before').onclick = function () { closeTehillim(); openReader(state.tehillim.before); };
    $('#th-after').onclick = function () { closeTehillim(); openReader(state.tehillim.after); };

    // resolved from the TOC, so these can never drift from the real pages
    $$('[data-key]').forEach(function (el) {
      el.onclick = function () {
        if (el.dataset.key === 'tehillim') { openTehillim(); return; }
        var pg = window.SiddurToday && window.SiddurToday.PAGES[el.dataset.key];
        if (pg) openReader(pg);
      };
    });

    $('#idx-search').oninput = function () { state.query = this.value; renderMenu(); };
    $('#btn-zmanim').onclick = openZmanim;
    $('#zm-close').onclick = function () { $('#sheet-zmanim').classList.add('hidden'); };

    $('#goto-range').oninput = function () { gotoPreview(parseInt(this.value, 10)); };
    $('#goto-range').onchange = function () { closeGoto(); goTo(parseInt(this.value, 10) || 1); };
    $('#goto-form').onsubmit = function (e) {
      e.preventDefault();
      var raw = $('#goto-input').value.trim();
      if (!raw) return;
      var heb = /^[0-9]+$/.test(raw) ? parseInt(raw, 10) : parseHebNumeral(raw);
      if (!heb) return;
      var target = printedToPdf(heb, 'main');
      if (!target) return;               // that folio is not in the scan
      closeGoto(); goTo(target);
    };
    $('#goto-input').oninput = function () {
      var raw = this.value.trim();
      var heb = /^[0-9]+$/.test(raw) ? parseInt(raw, 10) : parseHebNumeral(raw);
      var t = heb && printedToPdf(heb, 'main');
      if (t) { $('#goto-range').value = String(t); gotoPreview(t); }
    };
    $('#goto-cancel').onclick = closeGoto;
    $('#sheet-goto').onclick = function (e) { if (e.target === this) closeGoto(); };

    $('#btn-location').onclick = openLoc;
    $('#loc-cancel').onclick = function () { $('#sheet-loc').classList.add('hidden'); };
    $('#loc-gps').onclick = function () { $('#sheet-loc').classList.add('hidden'); askGeolocation(); };
    $('#sheet-loc').onclick = function (e) { if (e.target === this) this.classList.add('hidden'); };

    document.addEventListener('keydown', function (e) {
      if (!$('#sheet-goto').classList.contains('hidden')) { if (e.key === 'Escape') closeGoto(); return; }
      if (!$('#sheet-zmanim').classList.contains('hidden')) {
        if (e.key === 'Escape') $('#sheet-zmanim').classList.add('hidden');
        return;
      }
      if (!$('#sheet-tehillim').classList.contains('hidden')) {
        if (e.key === 'Escape') closeTehillim();
        return;
      }
      if (!$('#sheet-index').classList.contains('hidden')) {
        if (e.key === 'Escape') { if (state.cat) { state.cat = null; renderMenu(); } else closeIndex(); }
        return;
      }
      if ($('#view-reader').classList.contains('hidden')) return;
      // RTL book: left goes forward, right goes back.
      if (e.key === 'ArrowLeft' || e.key === ' ') { e.preventDefault(); nextPage(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); prevPage(); }
      if (e.key === 'Enter') { e.preventDefault(); toggleChrome(); }
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
      setChrome(false);
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

    fetch('./data/menu.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) { if (m) state.menu = m; })
      .catch(function () {});

    fetch('./data/tehillim.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (t) { if (t) state.tehillim = prepTehillim(t); })
      .catch(function () {});

    fetch('./data/toc.json')
      .then(function (r) { if (!r.ok) throw new Error('toc'); return r.json(); })
      .then(function (toc) {
        state.toc = toc;
        state.entries = (toc.entries || []).filter(function (e) { return e.pdfPage; })
          .sort(function (a, b) { return a.pdfPage - b.pdfPage; });
        if (window.SiddurToday && window.SiddurToday.setPages) {
          window.SiddurToday.setPages(toc);
        }
        renderToday();   // page links were unknown until now
      })
      .catch(function () {
        $('#idx-list').innerHTML = '<li class="empty">לא ניתן לטעון את התוכן.</li>';
      });

    setTimeout(function () { ensurePdf().catch(function () {}); }, 1000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=13').catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', init);
})();
