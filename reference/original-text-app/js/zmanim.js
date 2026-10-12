/**
 * Approximate zmanim (halachic times).
 * Based on NOAA solar equations (same family as moladlib.SunRiseSet).
 * Approximations — not posek-grade. See README.
 */
(function (global) {
  'use strict';

  function toRad(d) { return (d * Math.PI) / 180; }
  function toDeg(r) { return (r * 180) / Math.PI; }

  function julianDay(date) {
    const y = date.getUTCFullYear();
    let m = date.getUTCMonth() + 1;
    const d = date.getUTCDate() +
      (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;
    let yy = y;
    if (m <= 2) { yy -= 1; m += 12; }
    const A = Math.floor(yy / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function calcTimeJulianCent(jd) { return (jd - 2451545.0) / 36525.0; }

  function geomMeanLongSun(t) {
    let L = 280.46646 + t * (36000.76983 + 0.0003032 * t);
    while (L > 360) L -= 360;
    while (L < 0) L += 360;
    return L;
  }
  function geomMeanAnomalySun(t) {
    return 357.52911 + t * (35999.05029 - 0.0001537 * t);
  }
  function eccentricityEarthOrbit(t) {
    return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  }
  function sunEqOfCenter(t) {
    const m = toRad(geomMeanAnomalySun(t));
    return Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
      Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
      Math.sin(3 * m) * 0.000289;
  }
  function sunApparentLong(t) {
    const trueLong = geomMeanLongSun(t) + sunEqOfCenter(t);
    const omega = 125.04 - 1934.136 * t;
    return trueLong - 0.00569 - 0.00478 * Math.sin(toRad(omega));
  }
  function meanObliquity(t) {
    const seconds = 21.448 - t * (46.8150 + t * (0.00059 - t * 0.001813));
    return 23.0 + (26.0 + seconds / 60.0) / 60.0;
  }
  function obliquityCorrection(t) {
    const e0 = meanObliquity(t);
    const omega = 125.04 - 1934.136 * t;
    return e0 + 0.00256 * Math.cos(toRad(omega));
  }
  function sunDeclination(t) {
    const e = toRad(obliquityCorrection(t));
    const lambda = toRad(sunApparentLong(t));
    return toDeg(Math.asin(Math.sin(e) * Math.sin(lambda)));
  }
  function equationOfTime(t) {
    const epsilon = toRad(obliquityCorrection(t));
    const l0 = toRad(geomMeanLongSun(t));
    const e = eccentricityEarthOrbit(t);
    const m = toRad(geomMeanAnomalySun(t));
    const y = Math.tan(epsilon / 2);
    const y2 = y * y;
    const Etime = y2 * Math.sin(2 * l0) - 2 * e * Math.sin(m) +
      4 * e * y2 * Math.sin(m) * Math.cos(2 * l0) -
      0.5 * y2 * y2 * Math.sin(4 * l0) - 1.25 * e * e * Math.sin(2 * m);
    return toDeg(Etime) * 4;
  }
  function hourAngle(lat, solarDec, zenith) {
    const latR = toRad(lat);
    const decR = toRad(solarDec);
    const zR = toRad(zenith);
    const cosH = (Math.cos(zR) / (Math.cos(latR) * Math.cos(decR))) -
      Math.tan(latR) * Math.tan(decR);
    if (cosH > 1 || cosH < -1) return null;
    return toDeg(Math.acos(cosH));
  }

  function sunTime(localDate, lat, lon, tzOffsetHours, zenith, rising) {
    const utcApprox = new Date(Date.UTC(
      localDate.getFullYear(), localDate.getMonth(), localDate.getDate(),
      12 - tzOffsetHours, 0, 0
    ));
    const jd = julianDay(utcApprox);
    const t = calcTimeJulianCent(jd);
    const eqTime = equationOfTime(t);
    const decl = sunDeclination(t);
    const ha = hourAngle(lat, decl, zenith);
    if (ha == null) return null;
    const haUse = rising ? ha : -ha;
    const solarNoonMin = 720 - 4 * lon - eqTime + tzOffsetHours * 60;
    let minutes = solarNoonMin - haUse * 4;
    let h = Math.floor(minutes / 60);
    let m = Math.round(minutes - h * 60);
    if (m === 60) { m = 0; h += 1; }
    h = ((h % 24) + 24) % 24;
    return { hours: h, minutes: m, totalMinutes: h * 60 + m };
  }

  function formatHM(t) {
    if (!t) return '—';
    var total = Math.round(t.totalMinutes != null ? t.totalMinutes : (t.hours * 60 + t.minutes));
    total = ((total % 1440) + 1440) % 1440;
    var h = Math.floor(total / 60);
    var min = total % 60;
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }

  function addMinutes(t, delta) {
    if (!t) return null;
    let total = t.totalMinutes + delta;
    total = ((total % 1440) + 1440) % 1440;
    return { hours: Math.floor(total / 60), minutes: total % 60, totalMinutes: total };
  }

  function computeZmanim(opts) {
    const date = opts.date || new Date();
    const latitude = opts.latitude;
    const longitude = opts.longitude;
    const gmtOffset = opts.gmtOffset != null ? opts.gmtOffset : 2;
    const summerTime = opts.summerTime !== false;
    const shabbatMinutes = opts.shabbatMinutes != null ? opts.shabbatMinutes : 40;
    const tz = gmtOffset + (summerTime ? 1 : 0);
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const sunrise = sunTime(day, latitude, longitude, tz, 90.833, true);
    const sunset = sunTime(day, latitude, longitude, tz, 90.833, false);
    const alot = sunTime(day, latitude, longitude, tz, 90 + 16.1, true);
    const tzais = sunTime(day, latitude, longitude, tz, 90 + 8.5, false);
    const misheyakir = sunTime(day, latitude, longitude, tz, 90 + 10.2, true);

    let shaah = null, chatzot = null, shemaGra = null, tefillaGra = null;
    let minchaGedola = null, minchaKetana = null, plag = null;
    if (sunrise && sunset) {
      let dayLen = sunset.totalMinutes - sunrise.totalMinutes;
      if (dayLen < 0) dayLen += 1440;
      shaah = dayLen / 12;
      chatzot = addMinutes(sunrise, dayLen / 2);
      shemaGra = addMinutes(sunrise, shaah * 3);
      tefillaGra = addMinutes(sunrise, shaah * 4);
      minchaGedola = addMinutes(sunrise, shaah * 6.5);
      minchaKetana = addMinutes(sunrise, shaah * 9.5);
      plag = addMinutes(sunrise, shaah * 10.75);
    }
    const candles = sunset ? addMinutes(sunset, -shabbatMinutes) : null;

    return {
      items: [
        { id: 'alot', name: 'עלות השחר (≈16.1°)', time: formatHM(alot) },
        { id: 'misheyakir', name: 'מישיכיר (≈10.2°)', time: formatHM(misheyakir) },
        { id: 'sunrise', name: 'הנץ החמה', time: formatHM(sunrise) },
        { id: 'shema', name: 'סו״ז ק״ש (גר״א)', time: formatHM(shemaGra) },
        { id: 'tefilla', name: 'סו״ז תפילה (גר״א)', time: formatHM(tefillaGra) },
        { id: 'chatzot', name: 'חצות', time: formatHM(chatzot) },
        { id: 'minchaG', name: 'מנחה גדולה (≈)', time: formatHM(minchaGedola) },
        { id: 'minchaK', name: 'מנחה קטנה (≈)', time: formatHM(minchaKetana) },
        { id: 'plag', name: 'פלג המנחה (≈)', time: formatHM(plag) },
        { id: 'candles', name: 'הדלקת נרות (−' + shabbatMinutes + ' דק׳)', time: formatHM(candles) },
        { id: 'sunset', name: 'שקיעה', time: formatHM(sunset) },
        { id: 'tzais', name: 'צאת הכוכבים (≈8.5°)', time: formatHM(tzais) },
      ],
      meta: {
        note: 'קירוב בלבד — לא להלכה למעשה',
        shaahNofitMinutes: shaah ? Math.round(shaah) : null,
        timezoneHours: tz,
      },
    };
  }

  function computeZmanimAdapter(opts) {
    opts = opts || {};
    return computeZmanim({
      date: opts.date,
      latitude: opts.latitude,
      longitude: opts.longitude,
      gmtOffset: opts.gmtOffset != null ? opts.gmtOffset : opts.tzOffset,
      summerTime: opts.summerTime,
      shabbatMinutes: opts.shabbatMinutes != null ? opts.shabbatMinutes : opts.shabbatTime,
      elevation: opts.elevation,
    });
  }
  global.Zmanim = { computeZmanim: computeZmanimAdapter, formatHM, sunTime };
})(typeof window !== 'undefined' ? window : globalThis);
