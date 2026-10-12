(function () {
  'use strict';

  const STORAGE_KEY = 'sidur-bai-prefs-v1';
  const DEFAULTS = {
    fontScale: 1.25,
    night: false,
    cityId: 35,
    summerTime: true,
    censorNames: true,
    showNotes: true,
  };

  const state = {
    view: 'home',
    menus: null,
    cities: null,
    prefs: loadPrefs(),
    pageCache: {},
    currentPage: null,
    stack: [],
  };

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.prototype.slice.call((el || document).querySelectorAll(sel));

  function loadPrefs() {
    try {
      return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function savePrefs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prefs));
    applyPrefs();
  }

  function applyPrefs() {
    document.documentElement.style.setProperty('--font-size', state.prefs.fontScale + 'rem');
    document.body.classList.toggle('night', !!state.prefs.night);
  }

  function fetchJSON(path) {
    return fetch(path).then(function (res) {
      if (!res.ok) throw new Error('טעינה נכשלה: ' + path);
      return res.json();
    });
  }

  function loadPage(entry) {
    if (state.pageCache[entry]) return Promise.resolve(state.pageCache[entry]);
    return fetchJSON('./data/pages/' + entry + '.json').then(function (page) {
      state.pageCache[entry] = page;
      return page;
    });
  }

  function cityById(id) {
    var list = state.cities || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === Number(id)) return list[i];
    }
    return list[0];
  }

  function formatShemot(text) {
    if (!text) return '';
    var t = text;
    if (state.prefs.censorNames) {
      t = t.replace(/י~הוה/g, 'ה׳');
      t = t.replace(/אֱ~לֹהִים/g, 'אֱלֹקִים');
      t = t.replace(/אֱ~לֹהֵינוּ/g, 'אֱלֹקֵינוּ');
      t = t.replace(/אֱ~לֹה/g, 'אֱלֹק');
      t = t.replace(/אֵ~ל/g, 'אֵ-ל');
      t = t.replace(/~הוה/g, 'ה׳');
      t = t.replace(/~/g, '');
    } else {
      t = t.replace(/י~הוה/g, 'יְהֹוָה');
      t = t.replace(/אֱ~לֹה/g, 'אֱלֹה');
      t = t.replace(/אֵ~ל/g, 'אֵל');
      t = t.replace(/~/g, '');
    }
    return t;
  }

  function setHeader(title, showBack) {
    $('#header-title').textContent = title;
    $('#btn-back').classList.toggle('hidden', !showBack);
  }

  function showView(name) {
    $$('.view').forEach(function (v) { v.classList.add('hidden'); });
    var el = $('#view-' + name);
    if (el) el.classList.remove('hidden');
    $('#reader-toolbar').classList.toggle('hidden', name !== 'reader');
    state.view = name;
  }

  function navigate(view, opts) {
    opts = opts || {};
    if (opts.push !== false && state.view) {
      state.stack.push({
        view: state.view,
        page: state.currentPage,
        title: $('#header-title').textContent,
      });
    }
    if (view === 'home') renderHome();
    else if (view === 'main') renderMainMenu();
    else if (view === 'prefs') renderPrefs();
    else if (view === 'zmanim') renderZmanim();
    else if (view === 'about') renderAbout();
  }

  function goBack() {
    if (state.stack.length) {
      var prev = state.stack.pop();
      if (prev.view === 'reader' && prev.page) {
        openReader(prev.page.entry, prev.page.title, { push: false });
      } else {
        navigate(prev.view || 'home', { push: false });
      }
      return;
    }
    navigate('home', { push: false });
  }

  function renderHome() {
    setHeader((state.menus && (state.menus.appName || state.menus.appName)) || 'סידור', false);
    showView('home');
    var list = $('#home-menu');
    list.innerHTML = '';
    var items = (state.menus && state.menus.firstMenu) || [];
    items.forEach(function (item) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = item.title;
      btn.addEventListener('click', function () {
        if (item.action === 'main') navigate('main');
        else if (item.action === 'prefs') navigate('prefs');
        else if (item.action === 'zmanim') navigate('zmanim');
        else if (item.action === 'about') navigate('about');
        else if (item.action === 'page') openReader(item.entry, item.title);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function renderMainMenu() {
    setHeader('בחירת תפילה', true);
    showView('main');
    var list = $('#main-menu');
    list.innerHTML = '';
    var items = (state.menus && state.menus.mainMenu) || [];
    items.forEach(function (item) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = item.title;
      btn.addEventListener('click', function () {
        openReader(item.entry, item.title);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function openReader(entry, title, opts) {
    opts = opts || {};
    if (opts.push !== false) {
      state.stack.push({
        view: state.view,
        page: state.currentPage,
        title: $('#header-title').textContent,
      });
    }
    setHeader(title || entry, true);
    showView('reader');
    var root = $('#reader-content');
    root.innerHTML = '<div class="loading">טוען…</div>';
    loadPage(entry).then(function (page) {
      state.currentPage = page;
      root.innerHTML = '';
      var blocks = page.blocks || [];
      if (!blocks.length) {
        var pre = document.createElement('div');
        pre.className = 'block body';
        pre.textContent = formatShemot(page.plain || '');
        root.appendChild(pre);
      } else {
        blocks.forEach(function (b) {
          if (b.role === 'note' && !state.prefs.showNotes) return;
          var div = document.createElement('div');
          var role = b.role || 'body';
          div.className = 'block ' + (
            role === 'note' ? 'note' :
            role === 'special' ? 'special' :
            role === 'section' ? 'section' :
            role === 'dynamic' ? 'dynamic' : 'body'
          );
          if (role === 'dynamic' && (b.text === 'omer' || b.kind === 'omer')) {
            div.textContent = '【ספירת העומר — לפי היום】';
          } else {
            div.textContent = formatShemot(b.text);
          }
          root.appendChild(div);
        });
      }
      window.scrollTo(0, 0);
    }).catch(function (e) {
      root.innerHTML = '<div class="error">לא ניתן לטעון את הדף. ' + e.message + '</div>';
    });
  }

  function setToggle(sel, on) {
    var el = $(sel);
    if (!el) return;
    el.classList.toggle('on', !!on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function renderPrefs() {
    setHeader('הגדרות', true);
    showView('prefs');
    var citySel = $('#pref-city');
    if (citySel && citySel.options.length === 0 && state.cities) {
      state.cities.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        citySel.appendChild(opt);
      });
    }
    if (citySel) citySel.value = String(state.prefs.cityId);
    var font = $('#pref-font');
    if (font) font.value = String(state.prefs.fontScale);
    var fontVal = $('#pref-font-val');
    if (fontVal) fontVal.textContent = Math.round(state.prefs.fontScale * 100) + '%';
    setToggle('#pref-night', state.prefs.night);
    setToggle('#pref-dst', state.prefs.summerTime);
    setToggle('#pref-censor', state.prefs.censorNames);
    setToggle('#pref-notes', state.prefs.showNotes);
  }

  function renderZmanim() {
    setHeader('זמני היום', true);
    showView('zmanim');
    var city = cityById(state.prefs.cityId);
    var cityEl = $('#zmanim-city');
    if (cityEl) cityEl.textContent = city ? city.name : '';
    var now = new Date();
    var dateEl = $('#zmanim-date');
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('he-IL', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    }
    var tbody = $('#zmanim-body');
    if (!city || !window.Zmanim) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="2">אין נתוני עיר</td></tr>';
      return;
    }
    var z = Zmanim.computeZmanim({
      date: now,
      latitude: city.latitude,
      longitude: city.longitude,
      gmtOffset: city.gmtOffset,
      summerTime: state.prefs.summerTime,
      shabbatMinutes: city.shabbatTime,
      elevation: city.elevation,
    });
    tbody.innerHTML = '';
    z.items.forEach(function (item) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<th scope="row">' + item.name + '</th><td>' + item.time + '</td>';
      tbody.appendChild(tr);
    });
    var note = $('#zmanim-note');
    if (note) {
      note.textContent = z.meta.note +
        (z.meta.shaahNofitMinutes ? ' · שעה זמנית ≈ ' + z.meta.shaahNofitMinutes + ' דק׳' : '');
    }
  }

  function renderAbout() {
    setHeader('אודות', true);
    showView('about');
  }

  function bindUI() {
    $('#btn-back').addEventListener('click', goBack);
    $('#btn-home').addEventListener('click', function () {
      state.stack = [];
      navigate('home', { push: false });
    });

    var citySel = $('#pref-city');
    if (citySel) {
      citySel.addEventListener('change', function (e) {
        state.prefs.cityId = Number(e.target.value);
        savePrefs();
      });
    }
    var font = $('#pref-font');
    if (font) {
      font.addEventListener('input', function (e) {
        state.prefs.fontScale = Number(e.target.value);
        var fontVal = $('#pref-font-val');
        if (fontVal) fontVal.textContent = Math.round(state.prefs.fontScale * 100) + '%';
        savePrefs();
      });
    }
    var minus = $('#btn-font-minus');
    if (minus) {
      minus.addEventListener('click', function () {
        state.prefs.fontScale = Math.max(0.9, +(state.prefs.fontScale - 0.1).toFixed(2));
        savePrefs();
        if (font) font.value = state.prefs.fontScale;
        var fontVal = $('#pref-font-val');
        if (fontVal) fontVal.textContent = Math.round(state.prefs.fontScale * 100) + '%';
      });
    }
    var plus = $('#btn-font-plus');
    if (plus) {
      plus.addEventListener('click', function () {
        state.prefs.fontScale = Math.min(2.2, +(state.prefs.fontScale + 0.1).toFixed(2));
        savePrefs();
        if (font) font.value = state.prefs.fontScale;
        var fontVal = $('#pref-font-val');
        if (fontVal) fontVal.textContent = Math.round(state.prefs.fontScale * 100) + '%';
      });
    }
    var nightBtn = $('#btn-night');
    if (nightBtn) {
      nightBtn.addEventListener('click', function () {
        state.prefs.night = !state.prefs.night;
        savePrefs();
        setToggle('#pref-night', state.prefs.night);
      });
    }

    [
      ['#pref-night', 'night'],
      ['#pref-dst', 'summerTime'],
      ['#pref-censor', 'censorNames'],
      ['#pref-notes', 'showNotes'],
    ].forEach(function (pair) {
      var sel = pair[0];
      var key = pair[1];
      var el = $(sel);
      if (!el) return;
      el.addEventListener('click', function () {
        state.prefs[key] = !state.prefs[key];
        savePrefs();
        setToggle(sel, state.prefs[key]);
        if (key === 'censorNames' && state.view === 'reader' && state.currentPage) {
          openReader(state.currentPage.entry, state.currentPage.title || $('#header-title').textContent, { push: false });
        }
        if (key === 'showNotes' && state.view === 'reader' && state.currentPage) {
          openReader(state.currentPage.entry, state.currentPage.title || $('#header-title').textContent, { push: false });
        }
      });
    });
  }


  var A2HS_KEY = 'sidur-bai-a2hs-used';

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function markA2HSUsed() {
    try { localStorage.setItem(A2HS_KEY, '1'); } catch (e) {}
  }

  function a2hsAlreadyUsed() {
    try { return localStorage.getItem(A2HS_KEY) === '1'; } catch (e) { return false; }
  }

  function setupA2HS() {
    var btn = $('#btn-a2hs');
    var modal = $('#a2hs-modal');
    var done = $('#a2hs-done');
    if (!btn || !modal) return;

    // Hide forever if already installed as app, or user already used the button
    if (isStandalone() || a2hsAlreadyUsed()) {
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
      // Android/Chrome: native install if available
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          markA2HSUsed();
          btn.classList.add('hidden');
          modal.classList.add('hidden');
        });
        return;
      }
      // iPhone / Safari: show instructions once, then dismiss permanently
      modal.classList.remove('hidden');
    });

    function finishA2HS() {
      markA2HSUsed();
      btn.classList.add('hidden');
      modal.classList.add('hidden');
    }

    if (done) done.addEventListener('click', finishA2HS);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) finishA2HS();
    });
  }

  function init() {
    applyPrefs();
    bindUI();
    setupA2HS();
    Promise.all([
      fetchJSON('./data/menus.json'),
      fetchJSON('./data/cities.json'),
    ]).then(function (pair) {
      state.menus = pair[0];
      state.cities = pair[1];
      navigate('home', { push: false });
    }).catch(function (e) {
      var home = $('#view-home');
      if (home) {
        home.innerHTML = '<div class="error">שגיאה בטעינת הנתונים. פתחו דרך שרת מקומי (לא file://).<br>' +
          e.message + '</div>';
      }
      showView('home');
      setHeader('סידור', false);
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
