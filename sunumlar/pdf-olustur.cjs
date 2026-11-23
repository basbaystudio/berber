// Kullanım: node sunumlar/pdf-olustur.cjs
// Marka, alan adı ve telefonu buradan değiştirin, sonra tekrar çalıştırın.
const AYAR = { MARKA: "Salon Asistan", DOMAIN: "markaniz.com", TELEFON: "0 5xx xxx xx xx" };

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const dir = __dirname;
const dosyalar = [
  ["salon-sunumu.html", "Salon-Sunumu.pdf"],
  ["isleyis-sunumu.html", "Isleyis-Rehberi.pdf"],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  for (const [kaynak, hedef] of dosyalar) {
    let html = fs.readFileSync(path.join(dir, kaynak), "utf8");
    for (const [k, v] of Object.entries(AYAR)) html = html.replaceAll(`{{${k}}}`, v);
    const tmp = path.join(dir, `.tmp-${kaynak}`);
    fs.writeFileSync(tmp, html);
    await page.goto("file://" + tmp, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // taşma kontrolü
    const tasan = await page.evaluate(() => [...document.querySelectorAll(".slide")]
      .map((s, i) => ({ i: i + 1, h: s.scrollHeight })).filter(x => x.h > 721));
    if (tasan.length) console.warn(kaynak, "taşan slaytlar:", tasan);
    await page.pdf({ path: path.join(dir, hedef), width: "1280px", height: "720px", printBackground: true });
    fs.unlinkSync(tmp);
    console.log("oluşturuldu:", hedef);
  }
  await browser.close();
})();
