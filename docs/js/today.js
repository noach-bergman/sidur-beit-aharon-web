/**
 * Today's plan for סידור בית אהרן וישראל — a WEEKDAY siddur (לימות החול).
 *
 * Turns a moment in time + a location into "what do I need right now".
 * Calendar and zmanim come from @hebcal/core (vendored, GPL-2.0).
 *
 * Page numbers are PDF page indexes, taken verbatim from data/toc.json —
 * nothing here invents a page. Anything the siddur has no section for is
 * surfaced as a text reminder instead of a link.
 *
 * ── HALACHIC CONTENT ──────────────────────────────────────────────────
 * The REMINDERS below (תחנון / יעלה ויבוא / טל ומטר …) follow the common
 * published practice. Minhagim vary, and Karlin-Stolin has its own; the
 * siddur's own מנהגים section is linked from the UI. Treat them as
 * reminders, not as a ruling.
 * ──────────────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var H = global.hebcal;
  if (!H) return;

  var HDate = H.HDate, HebrewCalendar = H.HebrewCalendar, Zmanim = H.Zmanim, flags = H.flags;

  /* Sections are looked up BY TITLE in data/toc.json, which carries the
     verified printed→PDF mapping. Nothing here hardcodes a page number, so a
     correction to the TOC flows through automatically. */
  var TITLES = {
    hashkama:              'סדר השכמת הבוקר',
    birchotHashachar:      'ברכות השחר',
    talis:                 'סדר לבישת טלית גדול',
    tefillin:              'סדר הנחת תפילין',
    shacharit:             'תפלת שחרית',
    selichotBehab:         'סליחות לבה״ב ושובבי״ם',
    birchatHamazon:        'ברכת המזון',
    birchatHailanot:       'ברכת האילנות',
    tefillatHaderech:      'תפלת הדרך',
    mincha:                'תפלת מנחה לחול',
    maariv:                'תפלת ערבית לחול',
    omer:                  'ספירת העומר',
    shemaBed:              'קריאת שמע שעל המטה',
    kiddushLevana:         'סדר קידוש לבנה',
    yomKippurKatan:        'סדר תפלת יום כיפור קטן',
    lulav:                 'סדר נטילת לולב',
    hallel:                'סדר הלל',
    musafRC:               'תפלת מוסף לראש חודש',
    nerChanukah:           'סדר הדלקת נר חנוכה',
    mizmorimChanukah:      'סדר מזמורים לחנוכה',
    maozTzur:              'מעוז צור',
    megillah:              'סדר ברכות המגילה',
    hataratNedarim:        'סדר התרת נדרים',
    tashlich:              'סדר תשליך',
    kaparot:               'סדר כפרות',
    selichot10Tevet:       'סליחות לעשרה בטבת',
    selichotTaanitEsther:  'סליחות לתענית אסתר',
    selichot17Tammuz:      'סליחות לשבעה עשר בתמוז',
    kriahMonThu:           'סדר הפרשיות לשני וחמישי',
    kriahRC:               'קריאה לראש חודש',
    kriahChanukah:         'קריאה לחנוכה',
    kriahPurim:            'קריאה לפורים',
    kriahTaanit:           'קריאה לתענית ציבור',
    haftaraTaanit:         'הפטרה לתענית ציבור',
    birchatHachama:        'סדר ברכת החמה',
    tehillim:              'ספר תהלים',
    minhagim:              'מנהגים מרבותינו הקדושים מסטולין קרלין'
  };

  var P = {};   // key -> pdf page, filled by setPages()

  /** Called once the TOC is loaded. Unknown or unscanned sections stay absent,
      and anything that links to them is simply not offered. */
  function setPages(toc) {
    var byTitle = {};
    (toc.entries || []).forEach(function (e) {
      if (e.pdfPage && !(e.title in byTitle)) byTitle[e.title] = e.pdfPage;
    });
    Object.keys(TITLES).forEach(function (k) {
      var pg = byTitle[TITLES[k]];
      if (pg) P[k] = pg; else delete P[k];
    });
    return P;
  }

  var MONTH = {
    TISHREI: 7, CHESHVAN: 8, KISLEV: 9, TEVET: 10, SHVAT: 11,
    ADAR_I: 12, ADAR_II: 13, NISAN: 1, IYYAR: 2, SIVAN: 3,
    TAMUZ: 4, AV: 5, ELUL: 6
  };

  function has(evs, flag) {
    return evs.some(function (e) { return (e.getFlags() & flag) !== 0; });
  }
  function find(evs, flag) {
    for (var i = 0; i < evs.length; i++) if (evs[i].getFlags() & flag) return evs[i];
    return null;
  }
  function descMatches(evs, re) {
    return evs.some(function (e) { return re.test(e.getDesc()); });
  }

  /* ── seasonal insertions ─────────────────────────────────────────── */

  /** משיב הרוח: Musaf of Shmini Atzeret (22 Tishrei) → Musaf of 1st day Pesach (15 Nisan). */
  function saysGeshem(hd) {
    var m = hd.getMonth(), d = hd.getDate();
    if (m === MONTH.TISHREI) return d >= 22;
    if (m === MONTH.NISAN) return d < 15;
    // Cheshvan..Adar II all fall inside the rainy season
    return m === MONTH.CHESHVAN || m === MONTH.KISLEV || m === MONTH.TEVET ||
           m === MONTH.SHVAT || m === MONTH.ADAR_I || m === MONTH.ADAR_II;
  }

  /**
   * ותן טל ומטר. In ארץ ישראל from 7 Cheshvan. In חוץ לארץ from the civil
   * 4 December — 5 December when the *following* civil year is a leap year.
   * Both run until Pesach.
   */
  function saysTalUmatar(hd, greg, il) {
    var m = hd.getMonth();
    if (m === MONTH.NISAN && hd.getDate() >= 15) return false;
    if (m >= MONTH.NISAN && m <= MONTH.ELUL) return false; // Nisan..Elul: summer
    if (il) {
      if (m === MONTH.TISHREI) return false;
      if (m === MONTH.CHESHVAN) return hd.getDate() >= 7;
      return true;
    }
    var y = greg.getFullYear();
    var isLeapNext = function (yy) { return (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0; };
    var startDay = isLeapNext(y + 1) ? 5 : 4;
    var start = new Date(y, 11, startDay);
    if (m === MONTH.TISHREI || m === MONTH.CHESHVAN || m === MONTH.KISLEV) {
      return greg >= start;
    }
    return true; // Tevet..Adar
  }

  function isLeap(y) { return HDate.isLeapYear(y); }
  /** The Adar that holds Purim: Adar II in a leap year. */
  function purimAdar(y) { return isLeap(y) ? MONTH.ADAR_II : MONTH.ADAR_I; }

  function isChanukah(hd) {
    var m = hd.getMonth(), d = hd.getDate();
    if (m === MONTH.KISLEV) return d >= 25;
    if (m === MONTH.TEVET) return d <= (HDate.daysInMonth(MONTH.KISLEV, hd.getFullYear()) === 30 ? 2 : 3);
    return false;
  }

  /**
   * Days with no תחנון, from the siddur's own list (עמ׳ נב and קד), including
   * the Karlin customs printed there. Returns the reason, or null.
   * Not covered: הילולא days (the app has no list of them) and a בית האבל / חתן.
   */
  function noTachanun(hd) {
    var m = hd.getMonth(), d = hd.getDate(), y = hd.getFullYear();
    var adar = purimAdar(y);
    var evs = HebrewCalendar.calendar({ start: hd, end: hd, il: false, noHolidays: false });
    if (has(evs, flags.ROSH_CHODESH)) return 'ראש חודש';
    if (isChanukah(hd)) return 'חנוכה';
    if ((m === MONTH.ADAR_I || m === MONTH.ADAR_II) && (d === 14 || d === 15)) {
      return m === adar ? 'פורים' : 'פורים קטן';
    }
    if (m === adar && d >= 11 && d <= 18) return 'מי״א אדר עד י״ח אדר';
    if (m === adar && d >= 23) return 'שבעת ימי המילואים';
    if (m === MONTH.NISAN) return 'חודש ניסן';
    if (m === MONTH.IYYAR && (d === 14 || d === 15)) return 'פסח שני';
    if (m === MONTH.IYYAR && d === 18) return 'ל״ג בעומר';
    if (m === MONTH.IYYAR && d >= 28) return 'מכ״ח אייר';
    if (m === MONTH.SIVAN && d <= 15) return 'סיון — עד אחר ט״ו בו';
    if (m === MONTH.AV && d === 9) return 'תשעה באב';
    if (m === MONTH.AV && d === 15) return 'ט״ו באב';
    if (m === MONTH.SHVAT && d === 15) return 'ט״ו בשבט';
    if (m === MONTH.ELUL && d === 29) return 'ערב ראש השנה';
    if (m === MONTH.TISHREI && d >= 9) return 'מערב יום כיפור עד אחר ר״ח חשון';
    if (m === MONTH.CHESHVAN && d === 1) return 'ראש חודש';
    return null;
  }

  /** The molad of the coming month as a Date (Jerusalem mean time, UTC+2:21). */
  function moladDate(yy, mm) {
    var mol = new H.Molad(yy, mm);
    var rc = new HDate(1, mm, yy);
    for (var k = -4; k <= 2; k++) {
      var day = rc.add(k);
      if (day.getDay() !== mol.getDow()) continue;
      var g = day.greg();
      var ms = Date.UTC(g.getFullYear(), g.getMonth(), g.getDate(), mol.getHour(), mol.getMinutes()) +
               mol.getChalakim() * 10000 / 3 - (2 * 60 + 21) * 60000;
      return new Date(ms);
    }
    return null;
  }

  /* ── what to mark in the siddur today ─────────────────────────────── */

  /**
   * The set of rule keys that hold right now. data/highlights.json refers to
   * these keys; a key that is absent simply means "not today".
   * `hd` is the Hebrew date in effect (it turns at sunset), `now` the moment.
   */
  function activeRules(hd, now, il, afterSunset, alot) {
    var R = {};
    var set = function (k, v) { if (v) R[k] = true; };
    var evs = HebrewCalendar.calendar({ start: hd, end: hd, il: !!il, sedrot: false, omer: true, noHolidays: false });
    var m = hd.getMonth(), d = hd.getDate(), y = hd.getFullYear(), dow = hd.getDay();
    var adar = purimAdar(y);

    var chag = function (es) {
      return es.some(function (e) {
        return (e.getFlags() & flags.CHAG) && !(e.getFlags() & flags.EREV) &&
               !/Chanukah|Purim|Rosh Chodesh/.test(e.getDesc());
      });
    };
    var yomTov = chag(evs);
    var shabbat = dow === 6;
    var rc = has(evs, flags.ROSH_CHODESH);
    var chm = has(evs, flags.CHOL_HAMOED);
    var chanukah = isChanukah(hd);
    var purim = m === adar && (d === 14 || d === (il ? 15 : 14));
    var purimAny = (m === MONTH.ADAR_I || m === MONTH.ADAR_II) && (d === 14 || d === 15);
    var tishaBav = descMatches(evs, /Tish'a B'Av/) && !descMatches(evs, /Erev/);
    var fast = evs.some(function (e) {
      return (e.getFlags() & (flags.MINOR_FAST | flags.MAJOR_FAST)) &&
             !/Bechorot|BeHaB|Katan|^Erev |^Yom Kippur$/.test(e.getDesc());
    });
    var aseret = m === MONTH.TISHREI && d <= 10;
    var erevPesach = m === MONTH.NISAN && d === 14;
    var erevYK = m === MONTH.TISHREI && d === 9;
    var tomorrow = hd.next();
    var erevYomTov = chag(HebrewCalendar.calendar({ start: tomorrow, end: tomorrow, il: !!il }));
    var monThu = dow === 1 || dow === 4;

    set('dow' + dow, dow <= 5);
    set('shabbat', shabbat);
    set('yomTov', yomTov);
    set('shabbatOrYomTov', shabbat || yomTov);
    set('roshChodesh', rc);
    set('cholHamoed', chm);
    set('cholHamoedPesach', chm && m === MONTH.NISAN);
    set('cholHamoedSukkot', chm && m === MONTH.TISHREI);
    set('rcOrCholHamoed', rc || chm);
    set('yomTovOrCholHamoed', yomTov || chm);
    set('yaaleh', rc || chm || yomTov);
    set('yaalehBentching', rc || chm || yomTov);
    set('pesach', m === MONTH.NISAN && d >= 15 && d <= (il ? 21 : 22));
    set('shavuot', m === MONTH.SIVAN && (d === 6 || (!il && d === 7)));
    set('sukkot', m === MONTH.TISHREI && d >= 15 && d <= 21);
    set('shminiAtzeret', m === MONTH.TISHREI && (d === 22 || (!il && d === 23)));
    set('roshHashana', m === MONTH.TISHREI && d <= 2);
    set('chanukah', chanukah);
    set('purim', purim);
    set('alHanisim', chanukah || purim);
    set('chanukahOrPurim', chanukah || purim);
    set('fast', fast);
    set('tishaBav', tishaBav);
    set('aseret', aseret);
    set('nisan', m === MONTH.NISAN);

    /* seasons */
    var winter = saysGeshem(hd);
    set('winter', winter);
    set('summer', !winter);
    var tal = saysTalUmatar(hd, afterSunset ? new Date(now.getTime() + 86400000) : now, il);
    set('talUmatar', tal);
    set('noTalUmatar', !tal);
    set('leDavid', (m === MONTH.AV && d === 30) || m === MONTH.ELUL ||
                   (m === MONTH.TISHREI && d <= (il ? 22 : 23)));

    /* תחנון, from the siddur's list; plus ערב ר״ח once the molad has passed */
    var nt = !!noTachanun(hd);
    if (!nt && tomorrow.getDate() === 1 && tomorrow.getMonth() !== MONTH.TISHREI) {
      try { var md = moladDate(tomorrow.getFullYear(), tomorrow.getMonth()); nt = !!(md && now >= md); } catch (e) {}
    }
    if (shabbat || yomTov || chm) nt = true;
    set('noTachanun', nt);
    set('noTachanunMincha', nt || dow === 5 || erevYomTov || !!noTachanun(tomorrow));

    /* אל ארך אפים: Mon/Thu, except the days printed on עמ׳ סג */
    var noEEA = rc || chm || chanukah || purimAny || erevPesach || tishaBav;
    set('elErechApayim', monThu && !noEEA && !shabbat && !yomTov);
    set('noElErechApayim', !(monThu && !noEEA));
    set('noElErechApayimDay', nt && noEEA);

    set('longTachanun', monThu && !nt);
    set('monThuTachanun', monThu && !nt);
    set('noLamnatzeach', rc || chanukah || purimAny || erevPesach || tishaBav || erevYK || chm);
    set('torahReading', !shabbat && !yomTov && (monThu || rc || chanukah || purim || fast || chm));
    set('noMizmorLetoda', erevPesach || (chm && m === MONTH.NISAN) || erevYK);

    /* אבינו מלכנו */
    var avinu = (aseret || fast) && !tishaBav && !shabbat && !yomTov;
    set('avinuMalkeinu', avinu);
    set('avinuMalkeinuFast', avinu && !aseret);
    set('avinuMalkeinuMincha', avinu && dow !== 5 && !erevYK);

    /* סליחות לבה״ב ושובבי״ם */
    // בה״ב: Mon, Thu, Mon after the first Shabbat of חשון and of אייר
    var behab = false;
    if (m === MONTH.CHESHVAN || m === MONTH.IYYAR) {
      var firstSat = new HDate(1, m, y).onOrAfter(6);
      var off = hd.deltaDays(firstSat);
      behab = off === 2 || off === 5 || off === 9;
    }
    var shovavim = false;
    try {
      var sat = hd.onOrAfter(6);
      var sed = H.getSedra(sat.getFullYear(), !!il).lookup(sat);
      // lookup().num is 1-based: Shemot 13, Mishpatim 18, Tetzaveh 20 (the leap-year end)
      var num = sed && !sed.chag ? [].concat(sed.num)[0] : -1;
      shovavim = num >= 13 && num <= (isLeap(y) ? 20 : 18);
    } catch (e) {}
    set('shovavim', shovavim && monThu && !nt);
    set('selichot', behab || (shovavim && monThu && !nt));

    /* Friday and ערב יום טוב מנחה */
    set('erevShabbatOrYT', dow === 5 || erevYomTov);
    set('noAtaSeterMincha', dow === 5 || erevYomTov || chm);

    /* מוצאי שבת / יום טוב — from nightfall until dawn */
    var night = afterSunset || (alot && now < alot);
    var yesterday = hd.prev();
    var motzaeiYT = chag(HebrewCalendar.calendar({ start: yesterday, end: yesterday, il: !!il }));
    set('motzaeiShabbat', night && dow === 0);
    set('motzaeiShabbatOrYT', night && (dow === 0 || motzaeiYT) && !shabbat && !yomTov);
    var quietWeek = true;
    for (var k = 0; k < 6; k++) {
      var dd = hd.add(k);
      if ((dd.getMonth() === MONTH.NISAN && dd.getDate() === 14) ||
          (dd.getMonth() === MONTH.TISHREI && dd.getDate() === 9) ||
          chag(HebrewCalendar.calendar({ start: dd, end: dd, il: !!il }))) { quietWeek = false; break; }
    }
    set('vihiNoam', night && dow === 0 && quietWeek);

    /* מגדיל / מגדול */
    var magdol = shabbat || yomTov || chm || rc || (night && dow === 0);
    set('magdol', magdol);
    set('magdil', !magdol);

    /* ספירת העומר: before dawn and after sunset it is this night's count,
       during the day it is the count coming tonight */
    var omerDate = (afterSunset || (alot && now < alot)) ? hd : tomorrow;
    var oe = HebrewCalendar.calendar({ start: omerDate, end: omerDate, il: !!il, omer: true })
      .filter(function (e) { return e.getFlags() & flags.OMER_COUNT; })[0];
    if (oe) { R.omer = true; R['omerDay' + oe.omer] = true; }

    return R;
  }

  /* ── the plan ────────────────────────────────────────────────────── */

  /**
   * @param {Date}   now
   * @param {object} location  hebcal Location
   * @param {boolean} il       Israel (one day of Yom Tov)
   */
  function plan(now, location, il) {
    var z = new Zmanim(location, now, false);
    var sunset = z.sunset(), tzeit = z.tzeit(), alot = z.alotHaShachar();
    var chatzot = z.chatzot(), minchaGedola = z.minchaGedola();

    // chatzotNight() is the midpoint of the night that BEGAN the previous
    // evening, so before sunset it already lies in the past. After sunset we
    // want tonight's midpoint, which belongs to tomorrow's Zmanim.
    var chatzotNight = z.chatzotNight();
    if (chatzotNight < sunset) {
      chatzotNight = new Zmanim(location, new Date(now.getTime() + 86400000), false).chatzotNight();
    }

    // The Hebrew day turns over at sunset.
    var afterSunset = now >= sunset;
    var refDate = afterSunset ? new Date(now.getTime() + 86400000) : now;
    var hd = new HDate(afterSunset ? new HDate(now).next().abs() : new HDate(now).abs());

    var evs = HebrewCalendar.calendar({
      start: hd, end: hd, il: !!il, sedrot: false, omer: true, noHolidays: false
    });
    var dow = hd.getDay(); // 0=Sunday .. 6=Shabbat

    var isShabbat = dow === 6;
    var isYomTov = evs.some(function (e) {
      return (e.getFlags() & flags.CHAG) && !(e.getFlags() & flags.EREV) &&
             !/Chanukah|Purim|Rosh Chodesh/.test(e.getDesc());
    });
    var restricted = isShabbat || isYomTov;

    var labels = evs.filter(function (e) {
      return !(e.getFlags() & flags.OMER_COUNT);
    }).map(function (e) { return e.render('he-x-NoNikud'); });

    /* weekly parsha — read from the coming Shabbat */
    var parsha = null;
    try {
      var sat = hd.onOrAfter(6);
      var pe = HebrewCalendar.calendar({ start: sat, end: sat, il: !!il, sedrot: true, noHolidays: true });
      if (pe.length) parsha = pe[0].render('he-x-NoNikud').replace(/^פרשת\s*/, '');
    } catch (e) {}

    /* ── which tefillah is it now ── */
    var current;
    if (now < alot)                 current = 'shemaBed';
    else if (now < chatzot)         current = 'shacharit';
    else if (now < sunset)          current = 'mincha';
    else if (now < chatzotNight)    current = 'maariv';
    else                            current = 'shemaBed';

    var tefillot = [
      { key: 'shacharit', title: 'שחרית',            page: P.shacharit },
      { key: 'mincha',    title: 'מנחה',             page: P.mincha },
      { key: 'maariv',    title: 'ערבית',            page: P.maariv },
      { key: 'shemaBed',  title: 'ק״ש שעל המטה',       page: P.shemaBed }
    ];
    tefillot.forEach(function (t) { t.current = (t.key === current); });

    /* ── today's specials, each linked only where the siddur has a section ── */
    var special = [];
    var add = function (title, page, note) {
      // page may be undefined when that section is not in the scan
      special.push({ title: title, page: page || null, note: note || null });
    };

    var omerEv = find(evs, flags.OMER_COUNT);
    if (omerEv) {
      // The count belongs to the night; hebcal's event is for the Hebrew day.
      add('ספירת העומר', P.omer, omerEv.render('he-x-NoNikud'));
    }

    if (has(evs, flags.ROSH_CHODESH)) {
      add('הלל', P.hallel, 'חצי הלל');
      add('מוסף לראש חודש', P.musafRC);
      if (!restricted) add('קריאה לראש חודש', P.kriahRC);
    }

    var chanukahEv = evs.filter(function (e) { return /Chanukah/.test(e.getDesc()); })[0];
    if (chanukahEv) {
      add('הדלקת נר חנוכה', P.nerChanukah, chanukahEv.render('he-x-NoNikud'));
      add('הלל', P.hallel, 'הלל שלם');
      add('מזמורים לחנוכה', P.mizmorimChanukah);
      add('מעוז צור', P.maozTzur);
      if (!restricted) add('קריאה לחנוכה', P.kriahChanukah);
    }

    if (descMatches(evs, /^Purim$/)) {
      add('ברכות המגילה', P.megillah);
      add('קריאה לפורים', P.kriahPurim);
    }

    if (has(evs, flags.MINOR_FAST) || has(evs, flags.MAJOR_FAST)) {
      var fast = find(evs, flags.MINOR_FAST) || find(evs, flags.MAJOR_FAST);
      var fd = fast.getDesc();
      if (/Tevet/.test(fd))            add('סליחות לעשרה בטבת', P.selichot10Tevet);
      else if (/Esther/.test(fd))      add('סליחות לתענית אסתר', P.selichotTaanitEsther);
      else if (/Tammuz/.test(fd))      add('סליחות לשבעה עשר בתמוז', P.selichot17Tammuz);
      add('קריאה לתענית ציבור', P.kriahTaanit);
      add('הפטרה לתענית ציבור', P.haftaraTaanit);
    }

    if (has(evs, flags.BEHAB)) add('סליחות לבה״ב', P.selichotBehab);
    if (has(evs, flags.YOM_KIPPUR_KATAN)) add('תפלת יום כיפור קטן', P.yomKippurKatan);

    // Torah reading on Monday and Thursday, when it isn't displaced
    if ((dow === 1 || dow === 4) && !restricted &&
        !has(evs, flags.ROSH_CHODESH) && !chanukahEv &&
        !has(evs, flags.MINOR_FAST) && !descMatches(evs, /Purim/)) {
      add('סדר הפרשיות לשני וחמישי', P.kriahMonThu);
    }

    if (descMatches(evs, /Erev Rosh Hashana/)) add('סדר התרת נדרים', P.hataratNedarim);
    if (descMatches(evs, /Rosh Hashana/) && !descMatches(evs, /Erev/)) add('סדר תשליך', P.tashlich);
    if (descMatches(evs, /Erev Yom Kippur/)) add('סדר כפרות', P.kaparot);
    if (descMatches(evs, /Sukkot/) && !restricted) add('סדר נטילת לולב', P.lulav);
    if (hd.getMonth() === MONTH.NISAN) add('ברכת האילנות', P.birchatHailanot, 'בימי ניסן, באילנות מלבלבים');

    /* קידוש לבנה — inside its window, and only at night */
    try {
      var kStart = z.getTchilasZmanKidushLevana3Days();
      var kEnd = z.getSofZmanKidushLevana15Days();
      if (kStart && kEnd && now >= kStart && now <= kEnd && (now >= tzeit || now < alot)) {
        add('סדר קידוש לבנה', P.kiddushLevana);
      }
    } catch (e) {}

    /* ── reminders inside the tefillah ── */
    var reminders = [];
    if (has(evs, flags.ROSH_CHODESH) || has(evs, flags.CHOL_HAMOED) || isYomTov) reminders.push('יעלה ויבוא');
    if (chanukahEv || descMatches(evs, /Purim/)) reminders.push('על הניסים');
    if (has(evs, flags.MINOR_FAST) || has(evs, flags.MAJOR_FAST)) reminders.push('עננו');
    reminders.push(saysGeshem(hd) ? 'משיב הרוח ומוריד הגשם' : 'מוריד הטל');
    reminders.push(saysTalUmatar(hd, refDate, il) ? 'ותן טל ומטר לברכה' : 'ותן ברכה');
    var nt = restricted ? null : noTachanun(hd);
    if (nt) reminders.push('אין תחנון · ' + nt);
    else if (dow === 5 && now >= minchaGedola) reminders.push('אין תחנון במנחה בערב שבת');
    if (hd.getMonth() === MONTH.ELUL || (hd.getMonth() === MONTH.TISHREI && hd.getDate() <= 21)) {
      reminders.push('לדוד ה׳ אורי');
    }

    return {
      hdate: hd,
      hebrew: hd.renderGematriya(true),
      dayName: ['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי','שבת קודש'][dow],
      greg: refDate,
      afterSunset: afterSunset,
      parsha: parsha,
      labels: labels,
      isShabbat: isShabbat,
      isYomTov: isYomTov,
      restricted: restricted,
      erevShabbat: dow === 5,
      motzaeiShabbat: dow === 0 && afterSunset,
      current: current,
      tefillot: tefillot,
      special: special,
      reminders: reminders,
      zmanim: {
        alot: alot, sunrise: z.sunrise(), sofZmanShma: z.sofZmanShma(),
        sofZmanTfilla: z.sofZmanTfilla(), chatzot: chatzot,
        minchaGedola: minchaGedola, minchaKetana: z.minchaKetana(),
        plag: z.plagHaMincha(), sunset: sunset, tzeit: tzeit,
        chatzotNight: chatzotNight
      },
      activeRules: activeRules(hd, now, il, afterSunset, alot),
      hasMusaf: has(evs, flags.ROSH_CHODESH) || isYomTov,
      hasYomKippurKatan: has(evs, flags.YOM_KIPPUR_KATAN)
    };
  }

  global.SiddurToday = {
    plan: plan, setPages: setPages, activeRules: activeRules, noTachanun: noTachanun,
    PAGES: P, TITLES: TITLES
  };
})(window);
