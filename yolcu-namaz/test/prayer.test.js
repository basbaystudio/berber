// Diyanet yöntemi hesabının bilinen değerlere yakınlığını kontrol eder: node test/prayer.test.js
process.env.TZ = "Europe/Istanbul";
const assert = require("node:assert");
const V = require("../www/prayer.js");
const hm = (d) => d.toTimeString().slice(0, 5);
const dk = (a, b) => { const [h1, m1] = a.split(":").map(Number), [h2, m2] = b.split(":").map(Number); return Math.abs(h1 * 60 + m1 - h2 * 60 - m2); };
// İstanbul, 24.11.2026 — Diyanet takvimi
const beklenen = { imsak: "06:24", gunes: "07:54", ogle: "12:56", ikindi: "15:24", aksam: "17:46", yatsi: "19:10" };
const t = V.times(41.0082, 28.9784, 2026, 11, 24);
for (const [k, v] of Object.entries(beklenen)) {
  assert.ok(dk(hm(t[k]), v) <= 2, `${k}: ${hm(t[k])} beklenen ~${v}`);
}
// Sıra doğru mu? (Van ve Edirne, yaz ve kış)
for (const [lat, lng] of [[38.5, 43.37], [41.67, 26.56]]) for (const ay of [1, 6, 11]) {
  const x = V.times(lat, lng, 2026, ay, 15);
  const s = V.NAMES.map((n) => x[n].getTime());
  assert.deepStrictEqual([...s].sort((a, b) => a - b), s, `sıra bozuk ${lat},${lng} ay ${ay}`);
}
console.log("prayer.js testleri geçti");
