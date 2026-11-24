/* Namaz vakti hesabı — Diyanet yöntemi (İmsak 18°, Yatsı 17°, İkindi: asr-ı evvel)
   ve Diyanet temkinleri (Güneş −7, Öğle +5, İkindi +4, Akşam +7 dk).
   İnternet gerekmez; konum ve tarihten hesaplanır. */
(function (root) {
  "use strict";
  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;
  const sin = (d) => Math.sin(rad(d));
  const cos = (d) => Math.cos(rad(d));
  const tan = (d) => Math.tan(rad(d));
  const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };

  const NAMES = ["imsak", "gunes", "ogle", "ikindi", "aksam", "yatsi"];
  const LABELS = { imsak: "İmsak (Sabah)", gunes: "Güneş", ogle: "Öğle", ikindi: "İkindi", aksam: "Akşam", yatsi: "Yatsı" };
  const SHORT = { imsak: "İmsak", gunes: "Güneş", ogle: "Öğle", ikindi: "İkindi", aksam: "Akşam", yatsi: "Yatsı" };
  const TEMKIN = { imsak: 0, gunes: -7, ogle: 5, ikindi: 4, aksam: 7, yatsi: 0 };

  function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fix(357.529 + 0.98560028 * D, 360);
    const q = fix(280.459 + 0.98564736 * D, 360);
    const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
    const e = 23.439 - 0.00000036 * D;
    const RA = fix(deg(Math.atan2(cos(e) * sin(L), cos(L))) / 15, 24);
    let eqt = q / 15 - RA;
    if (eqt > 12) eqt -= 24;
    if (eqt < -12) eqt += 24;
    return { decl: deg(Math.asin(sin(e) * sin(L))), eqt };
  }

  // y, m (1-12), d: yerel takvim günü. Dönen değerler Date nesneleri.
  function times(lat, lng, y, m, d) {
    const jd0 = Date.UTC(y, m - 1, d) / 86400000 + 2440587.5 - lng / 360;
    const noon = (t) => 12 - sunPosition(jd0 + t / 24).eqt;
    const angleTime = (angle, t, before) => {
      const { decl } = sunPosition(jd0 + t / 24);
      const n = noon(t);
      const c = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      const T = deg(Math.acos(Math.max(-1, Math.min(1, c)))) / 15;
      return n + (before ? -T : T);
    };
    const asrTime = (t) => {
      const { decl } = sunPosition(jd0 + t / 24);
      const a = -deg(Math.atan(1 / (1 + tan(Math.abs(lat - decl)))));
      return angleTime(a, t, false);
    };
    const h = { imsak: 5, gunes: 6, ogle: 12, ikindi: 15, aksam: 18, yatsi: 19 };
    for (let i = 0; i < 2; i++) {
      h.imsak = angleTime(18, h.imsak, true);
      h.gunes = angleTime(0.833, h.gunes, true);
      h.ogle = noon(h.ogle);
      h.ikindi = asrTime(h.ikindi);
      h.aksam = angleTime(0.833, h.aksam, false);
      h.yatsi = angleTime(17, h.yatsi, false);
    }
    const base = Date.UTC(y, m - 1, d);
    const out = {};
    for (const k of NAMES) {
      const utcH = h[k] - lng / 15;
      let ms = base + utcH * 3600000 + TEMKIN[k] * 60000;
      ms = Math.round(ms / 60000) * 60000; // dakikaya yuvarla
      out[k] = new Date(ms);
    }
    return out;
  }

  // Bir Date için cihazın yerel takvim gününe göre vakitler
  function timesFor(lat, lng, date) {
    return times(lat, lng, date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  const api = { times, timesFor, NAMES, LABELS, SHORT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Vakit = api;
})(typeof self !== "undefined" ? self : this);
