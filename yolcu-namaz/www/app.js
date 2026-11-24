/* Yolcu Namaz — yol üstü cami, mescit, dinlenme tesisi; sesli yol tarifi ve namaz vakti uyarıları.
   Ücretsiz servisler: OpenStreetMap (harita), OSRM (rota), Overpass (yerler), Nominatim (adres arama),
   OSM Notes (yeni yer bildirimi). Namaz vakitleri prayer.js ile cihazda hesaplanır. */
"use strict";

// ---------- Yardımcılar ----------
const $ = (id) => document.getElementById(id);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* özel pencere vb. */ } },
};
const uyku = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rad = (d) => (d * Math.PI) / 180;
const RD = 6371000;
function mesafe(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RD * Math.asin(Math.sqrt(x));
}
function yonHesap(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
const saat = (d) => new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
function km(m) {
  if (m < 1000) return Math.max(10, Math.round(m / 10) * 10) + " m";
  if (m < 10000) return (m / 1000).toFixed(1).replace(".", ",") + " km";
  return Math.round(m / 1000) + " km";
}
function sure(sn) {
  const dk = Math.max(0, Math.round(sn / 60));
  if (dk < 60) return dk + " dk";
  return Math.floor(dk / 60) + " sa " + (dk % 60 ? (dk % 60) + " dk" : "");
}
// Android uygulaması (Capacitor) içinde miyiz?
const NATIVE = !!window.Capacitor?.isNativePlatform?.();
const EKLENTI = window.Capacitor?.Plugins || {};
const gunKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`; };

// ---------- Ayarlar ve durum ----------
const ayar = Object.assign({ once: "30", ses: true, ekran: true, hiz: "1.1", kaynak: "site", hitap: "Baba", mola: "120", tema: "oto" }, LS.get("yn_ayar", {}));
const hitap = () => (ayar.hitap || "").trim();
// "Baba, ..." — hitap boşsa sadece cümlenin kendisi
const seslen = (cumle) => (hitap() ? `${hitap()}, ${cumle.charAt(0).toLocaleLowerCase("tr")}${cumle.slice(1)}` : cumle);
const TUR = {
  cami: { ad: "Cami", emoji: "🕌", renk: "#198754", sinif: "r-cami" },
  mescit: { ad: "Mescit", emoji: "🤲", renk: "#0d6efd", sinif: "r-mescit" },
  tesis: { ad: "Dinlenme tesisi", emoji: "☕", renk: "#e0a800", sinif: "r-tesis" },
  yakit: { ad: "Akaryakıt istasyonu", emoji: "⛽", renk: "#6c757d", sinif: "r-yakit" },
};
const NAMAZLAR = ["imsak", "ogle", "ikindi", "aksam", "yatsi"];
const NAMAZ_AD = { imsak: "Sabah namazı", ogle: "Öğle namazı", ikindi: "İkindi namazı", aksam: "Akşam namazı", yatsi: "Yatsı namazı" };
const BITIS = { imsak: "gunes", ogle: "ikindi", ikindi: "aksam", aksam: "yatsi", yatsi: "imsak" };

const durum = {
  konum: null, yonNoktasi: null,
  baslangic: null, hedef: null, ara: null,
  rota: null, cizelge: null, sonIdx: 0,
  poiler: [], yakinPoiler: [],
  nav: false, takipte: true, rotaDisi: 0, sonYonlendirme: 0, rotaHesaplaniyor: false,
  soylenen: new Set(), wakeLock: null, ekleNokta: null,
  bildirilen: new Set(LS.get("yn_bildirilen", []).filter((k) => k.startsWith(gunKey(Date.now())) || k.startsWith(gunKey(Date.now() - 86400000)))),
};
const benimYerler = () => LS.get("yn_yerler", []);

// ---------- Harita ----------
const harita = L.map("harita", { zoomControl: false }).setView([39.0, 35.0], 6);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(harita);
L.control.zoom({ position: "bottomleft" }).addTo(harita);
const poiKatman = L.layerGroup().addTo(harita);
const benimKatman = L.layerGroup().addTo(harita);
const rotaKatman = L.layerGroup().addTo(harita);
let rotaCizgi = null, gecilenCizgi = null, hedefIsaret = null, baslangicIsaret = null, araIsaret = null, benIsaret = null, dogrulukDaire = null;

harita.on("dragstart", () => { durum.takipte = false; });

function pinIkon(tip) { return L.divIcon({ className: "", html: `<div class="pin pin-${tip}"></div>`, iconSize: [28, 28], iconAnchor: [11, 30] }); }
function poiIkon(tur, benim) {
  return L.divIcon({ className: "", html: `<div class="poi" style="background:var(--${benim ? "benim" : TUR[tur] ? tur : "cami"})"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
}

function benimIsaretGuncelle() {
  const k = durum.konum; if (!k) return;
  const ll = [k.lat, k.lng];
  const yon = k.heading != null ? `<div class="yon" style="transform:rotate(${k.heading}deg)"></div>` : "";
  const ikon = L.divIcon({ className: "", html: `<div class="ben">${yon}<div class="nokta"></div></div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
  if (!benIsaret) {
    dogrulukDaire = L.circle(ll, { radius: k.acc, color: "#0d6efd", weight: 1, fillOpacity: 0.1, interactive: false }).addTo(harita);
    benIsaret = L.marker(ll, { icon: ikon, zIndexOffset: 1000, interactive: false }).addTo(harita);
  } else {
    benIsaret.setLatLng(ll).setIcon(ikon);
    dogrulukDaire.setLatLng(ll).setRadius(Math.min(k.acc, 500));
  }
}

// ---------- Konum ----------
function konumBaslat() {
  if (!("geolocation" in navigator)) { $("vakitSonraki").textContent = "Bu cihaz konum vermiyor."; return; }
  navigator.geolocation.watchPosition(konumGeldi, (e) => {
    if (!durum.konum) $("vakitSonraki").textContent = e.code === 1
      ? "Konum izni verilmedi. Tarayıcı ayarlarından bu siteye konum izni verin."
      : "Konum alınamadı, bekleniyor…";
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
}
function konumGeldi(p) {
  const { latitude: lat, longitude: lng, accuracy, heading, speed } = p.coords;
  const ilk = !durum.konum;
  let yon = durum.konum?.heading ?? null;
  if (heading != null && !Number.isNaN(heading) && speed > 1) yon = heading;
  else if (durum.yonNoktasi && mesafe(durum.yonNoktasi, { lat, lng }) > 15) yon = yonHesap(durum.yonNoktasi, { lat, lng });
  if (!durum.yonNoktasi || mesafe(durum.yonNoktasi, { lat, lng }) > 15) durum.yonNoktasi = { lat, lng };
  durum.konum = { lat, lng, acc: accuracy, heading: yon, zaman: Date.now(), hiz: speed };
  benimIsaretGuncelle();
  surusGuncelle(durum.konum);
  if (ilk) {
    harita.setView([lat, lng], 13);
    vakitBarGuncelle();
    yakindakileriGetir(true);
  } else if (durum.takipte) {
    harita.panTo([lat, lng], { animate: true });
  }
  if (durum.nav) navGuncelle();
}

// ---------- Namaz vakitleri ----------
/* namazvakti.com bir konum için bugünün vakitlerini verir (Türkiye Takvimi). Her alınan örnekte
   site ile cihaz hesabı arasındaki farkı (dakika) saklarız; başka yer ve günler için cihaz hesabına
   en yakın örneğin farkını ekleriz. İnternet yoksa ya da site açılmazsa Diyanet hesabı kullanılır. */
let siteOrnekler = LS.get("yn_site", []);
const SITE_AD = { imsak: "imsak", gunes: "gunes", ogle: "ogle", ikindi: "ikindi", aksam: "aksam", yatsi: "yatsi" };
const sadelestir = (s) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u");
function siteOrnegiBul(p, gun) {
  const gk = gunKey(gun);
  let en = null, enSkor = Infinity;
  for (const o of siteOrnekler) {
    const skor = mesafe(p, o) / 1000 + (o.gun === gk ? 0 : 150 + Math.abs(new Date(o.zaman) - gun) / 86400000 * 20);
    if (skor < enSkor) { enSkor = skor; en = o; }
  }
  return en;
}
function vakitler(p, gun) {
  if (ayar.kaynak === "site") { const st = sehirTablosu(p, gun); if (st) return st; }
  const t = Vakit.timesFor(p.lat, p.lng, gun);
  if (ayar.kaynak !== "site") return t;
  const o = siteOrnegiBul(p, gun);
  if (!o) return t;
  const out = {};
  for (const n of Vakit.NAMES) out[n] = new Date(t[n].getTime() + (o.fark[n] || 0) * 60000);
  return out;
}
let siteSon = 0, siteHata = null;
async function siteVakitGetir(p) {
  if (ayar.kaynak !== "site") return false;
  const gk = gunKey(new Date());
  if (siteOrnekler.some((o) => o.gun === gk && mesafe(o, p) < 15000)) return false;
  if (siteHata && Date.now() - siteSon < 10 * 60000) return false;
  const bekle = Math.max(0, siteSon + 1500 - Date.now());
  siteSon = Date.now() + bekle;
  if (bekle) await uyku(bekle);
  try {
    const u = `https://namazvakti.com/Main.php?arz=${p.lat.toFixed(4)}&tul=${p.lng.toFixed(4)}&tz_offset=${new Date().getTimezoneOffset()}`;
    const r = await fetch(u);
    if (!r.ok) throw new Error("site yanıtı " + r.status);
    const html = await r.text();
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!m) throw new Error("vakit bilgisi bulunamadı");
    // Sayfadaki blok bazen bölünmez boşluk (U+00A0) içeriyor; temizleyip okuyoruz.
    const ham = m[1].replace(/\u00a0/g, " ");
    let olaylar;
    try { olaylar = JSON.parse(ham).subEvent; } catch {
      olaylar = [...ham.matchAll(/"name"\s*:\s*"([^"]+)"\s*,\s*"startDate"\s*:\s*"([^"]+)"/g)].map((x) => ({ name: x[1], startDate: x[2] }));
    }
    const site = {};
    for (const e of olaylar || []) {
      const ad = SITE_AD[sadelestir(e.name || "")];
      if (ad) site[ad] = new Date(e.startDate);
    }
    if (Object.keys(site).length < 6) throw new Error("vakitler eksik");
    const gun = site.ogle;
    const hesap = Vakit.timesFor(p.lat, p.lng, gun);
    const fark = {};
    for (const n of Vakit.NAMES) fark[n] = Math.round((site[n] - hesap[n]) / 60000);
    if (Object.values(fark).some((f) => Math.abs(f) > 90)) throw new Error("beklenmeyen vakit");
    siteOrnekler = [...siteOrnekler.filter((o) => Date.now() - new Date(o.zaman) < 20 * 86400000), {
      lat: p.lat, lng: p.lng, gun: gunKey(gun), zaman: gun.toISOString(), fark,
    }].slice(-60);
    LS.set("yn_site", siteOrnekler);
    siteHata = null;
    return true;
  } catch (e) {
    siteHata = e.message === "Failed to fetch" || e.name === "TypeError" ? "siteye ulaşılamadı" : e.message;
    return false;
  } finally { kaynakDurumYaz(); }
}
/* ŞEHRE GÖRE VAKİT: namazvakti.com'da ilçe aranır (CitySearch.php), bulunan şehrin bütün yıllık
   vakit tablosu indirilir (XML.php) ve telefonda saklanır. Yolculukta her nokta için o ilçenin tablosu kullanılır. */
let nvSehirler = LS.get("yn_nvsehir", []);        // [{id, ad, il, lat, lng, yil, g: {"11-24": [imsak, güneş, öğle, ikindi, akşam, yatsı] (dakika)}}]
const noktaSehir = LS.get("yn_noktasehir", {});    // "lat,lng" (0,05° ızgara) -> şehir id
const ADRES_SEHIR = LS.get("yn_adressehir", {});   // "ilçe|il" -> şehir id (ya da 0 = bulunamadı)
const izgara = (p) => (Math.round(p.lat * 20) / 20).toFixed(2) + "," + (Math.round(p.lng * 20) / 20).toFixed(2);
const htmlCoz = (t) => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').trim();

function sehirTablosu(p, gun) {
  let sehir = null;
  const id = noktaSehir[izgara(p)];
  if (id) sehir = nvSehirler.find((c) => c.id === id);
  if (!sehir) { // aynı ızgarada kayıt yoksa 25 km içindeki en yakın şehir
    let en = 25000;
    for (const c of nvSehirler) { const d = mesafe(p, c); if (d < en) { en = d; sehir = c; } }
  }
  if (!sehir || +sehir.yil !== gun.getFullYear()) return null;
  const satir = sehir.g[`${gun.getMonth() + 1}-${gun.getDate()}`];
  if (!satir) return null;
  // Tablo Türkiye saatidir (UTC+3)
  const taban = Date.UTC(gun.getFullYear(), gun.getMonth(), gun.getDate()) - 3 * 3600000;
  const out = { _sehir: sehir };
  Vakit.NAMES.forEach((n, i) => { out[n] = new Date(taban + satir[i] * 60000); });
  return out;
}
async function nvMetin(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("namazvakti.com yanıtı " + r.status);
  return r.text();
}
async function nvSehirAra(ad, il) {
  const html = await nvMetin("https://namazvakti.com/CitySearch.php?SearchText=" + encodeURIComponent(ad));
  const sonuc = [...html.matchAll(/href="Main\.php\?cityID=(\d+)"><span class="blueArrow">[^<]*<\/span>([^<]*)<\/a>/g)]
    .map((m) => { const [isim, eyalet] = htmlCoz(m[2]).split(" / "); return { id: +m[1], isim: isim || "", eyalet: eyalet || "" }; });
  const a = sadelestir(ad), i = sadelestir(il || "");
  return sonuc.find((x) => sadelestir(x.isim) === a && (!i || sadelestir(x.eyalet) === i))
    || (!il ? sonuc.find((x) => sadelestir(x.isim) === a) : null);
}
async function nvTabloIndir(id) {
  const xml = await nvMetin("https://namazvakti.com/XML.php?cityID=" + id);
  const bilgi = xml.match(/<cityinfo([^>]*)>/);
  if (!bilgi) throw new Error("şehir tablosu okunamadı");
  const attr = (k) => (bilgi[1].match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1] || "";
  if (attr("countryID") !== "200") return null; // Türkiye dışı: saat dilimi farklı, koordinat yöntemine bırak
  const yil = (xml.match(/<!--(\d{4})-->/) || [])[1] || String(new Date().getFullYear());
  const derece = (d, m, y) => (+d + +m / 60) * (y === "S" || y === "W" ? -1 : 1);
  const dk = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const g = {};
  for (const m of xml.matchAll(/<prayertimes[^>]*day="(\d+)" month="(\d+)">([^<]*)<\/prayertimes>/g)) {
    const v = m[3].trim().split(/\s+/);
    if (v.length < 12) continue;
    // Sütunlar: İmsak, Sabah, Güneş, İşrak, Kerahet, Öğle, İkindi, Asr-ı sani, İsfirar, Akşam, İştibak, Yatsı, ...
    g[`${+m[2]}-${+m[1]}`] = [v[0], v[2], v[5], v[6], v[9], v[11]].map(dk);
  }
  if (Object.keys(g).length < 300) throw new Error("şehir tablosu eksik");
  return {
    id, ad: attr("cityNameTR"), il: attr("cityStateTR"), yil,
    lat: derece(attr("arzDer"), attr("arzDak"), attr("arzYon")), lng: derece(attr("tulDer"), attr("tulDak"), attr("tulYon")), g,
  };
}
let sehirKuyruk = Promise.resolve();
// Bir nokta için şehri bul ve tablosunu indir. Yeni tablo geldiyse true döner.
function sehirVakitHazirla(p) {
  const is = sehirKuyruk.then(async () => {
    if (ayar.kaynak !== "site") return false;
    const iz = izgara(p);
    if (noktaSehir[iz] && nvSehirler.some((c) => c.id === noktaSehir[iz] && +c.yil === new Date().getFullYear())) return false;
    try {
      const adr = await adresBul(p);
      if (adr.ulke && adr.ulke !== "tr") return false;
      const key = adr.ilce + "|" + adr.il;
      let id = ADRES_SEHIR[key];
      if (id === undefined) {
        id = 0;
        for (const ad of [...adr.adaylar.slice(0, 2), adr.il].filter(Boolean)) {
          const bulunan = await nvSehirAra(ad, adr.il);
          if (bulunan) { id = bulunan.id; break; }
        }
        ADRES_SEHIR[key] = id; LS.set("yn_adressehir", ADRES_SEHIR);
      }
      if (!id) return false;
      noktaSehir[iz] = id; LS.set("yn_noktasehir", noktaSehir);
      if (nvSehirler.some((c) => c.id === id && +c.yil === new Date().getFullYear())) return true;
      const tablo = await nvTabloIndir(id);
      if (!tablo) return false;
      nvSehirler = [...nvSehirler.filter((c) => c.id !== id), tablo].slice(-40);
      try { localStorage.setItem("yn_nvsehir", JSON.stringify(nvSehirler)); }
      catch { nvSehirler = nvSehirler.slice(-10); LS.set("yn_nvsehir", nvSehirler); }
      siteHata = null;
      return true;
    } catch (e) {
      siteHata = e.name === "TypeError" ? "siteye ulaşılamadı" : e.message;
      return false;
    } finally { kaynakDurumYaz(); }
  });
  sehirKuyruk = is.catch(() => false);
  return is;
}

function kaynakDurumYaz() {
  const el = $("kaynakDurum"); if (!el) return;
  if (ayar.kaynak !== "site") { el.textContent = "Vakitler Diyanet yöntemiyle (İmsak 18°, Yatsı 17°, Diyanet temkinleri) telefonda hesaplanıyor."; return; }
  el.textContent = nvSehirler.length || siteOrnekler.length
    ? `Vakitler şehre göre namazvakti.com'dan alınıyor. Telefonda ${nvSehirler.length} şehrin yıllık takvimi kayıtlı` +
      (nvSehirler.length ? ` (${nvSehirler.slice(-5).map((c) => c.ad).join(", ")})` : "") + ". Yeni şehre girince o şehrin takvimi otomatik indirilir." + (siteHata ? ` Son deneme: ${siteHata}.` : "")
    : `Henüz namazvakti.com'dan vakit alınamadı${siteHata ? " (" + siteHata + ")" : ""}; o zamana kadar Diyanet hesabı gösteriliyor.` +
      (NATIVE ? "" : " Not: tarayıcıdan açıldığında site erişime izin vermeyebilir; Android uygulamasında çalışır.");
}
function vakitBilgisi(p, simdi = new Date()) {
  const bugun = vakitler(p, simdi);
  const yarin = vakitler(p, new Date(simdi.getTime() + 86400000));
  let simdiki = null;
  for (const n of Vakit.NAMES) if (bugun[n] <= simdi) simdiki = n;
  let sonraki = Vakit.NAMES.find((n) => bugun[n] > simdi);
  const sonrakiZaman = sonraki ? bugun[sonraki] : yarin.imsak;
  if (!sonraki) sonraki = "imsak";
  return { bugun, simdiki: simdiki || "yatsi", sonraki, sonrakiZaman };
}
// Akşamdan güneş doğana kadar koyu tema (ayardan sabitlenebilir)
function temaUygula(v, p) {
  let koyu = ayar.tema === "koyu";
  if (ayar.tema === "oto") {
    const simdi = new Date();
    koyu = simdi >= v.bugun.aksam || simdi < v.bugun.gunes;
  }
  document.documentElement.dataset.theme = koyu ? "dark" : "light";
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = koyu ? "#0d1312" : "#22403a";
}
function vakitBarGuncelle() {
  const p = durum.konum || (() => { const c = harita.getCenter(); return { lat: c.lat, lng: c.lng }; })();
  const v = vakitBilgisi(p);
  const kalan = (v.sonrakiZaman - Date.now()) / 1000;
  const kaynak = v.bugun._sehir ? `namazvakti.com · ${v.bugun._sehir.ad}${v.bugun._sehir.il && v.bugun._sehir.il !== v.bugun._sehir.ad ? " / " + v.bugun._sehir.il : ""}`
    : ayar.kaynak === "site" && siteOrnekler.length ? "namazvakti.com (konuma göre)" : "Diyanet hesabı";
  $("vakitSatir").innerHTML = Vakit.NAMES.map((n) =>
    `<span class="${n === v.simdiki ? "simdi" : ""}">${Vakit.SHORT[n]} <b>${saat(v.bugun[n])}</b></span>`).join("") +
    `<span class="kaynak">Kaynak: ${kaynak}${durum.konum ? "" : " · konum bekleniyor"}</span>`;
  $("vakitSonraki").innerHTML = `<span class="vb-ad">${Vakit.SHORT[v.sonraki]}</span><span class="vb-saat">${saat(v.sonrakiZaman)}</span><span class="vb-kalan">${sure(kalan)} sonra</span>`;
  temaUygula(v, p);
  if (durum.konum && ayar.kaynak === "site" && !v.bugun._sehir) {
    sehirVakitHazirla(durum.konum).then(async (yeni) => {
      if (!yeni) yeni = await siteVakitGetir(durum.konum); // şehir bulunamazsa konuma göre sayfa
      if (yeni) { vakitBarGuncelle(); if (durum.rota) namazPlaniCiz(); }
    });
  }
}

// ---------- Nominatim (adres) ----------
let nomSon = 0;
async function nomFetch(url) {
  const bekle = Math.max(0, nomSon + 1100 - Date.now());
  nomSon = Date.now() + bekle;
  if (bekle) await uyku(bekle);
  const r = await fetch(url, { headers: { "Accept-Language": "tr" } });
  if (!r.ok) throw new Error("Adres servisi yanıt vermedi");
  return r.json();
}
async function yerAra(q) {
  const u = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=tr&q=" + encodeURIComponent(q);
  return nomFetch(u);
}
const sehirCache = LS.get("yn_sehir", {});
const adresCache = LS.get("yn_adres", {});
// Konumun ilçe/il bilgisi (OpenStreetMap Nominatim). Sonuçlar telefonda saklanır.
async function adresBul(p) {
  const key = p.lat.toFixed(2) + "," + p.lng.toFixed(2);
  if (adresCache[key]) return adresCache[key];
  const j = await nomFetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=tr&lat=${p.lat}&lon=${p.lng}`);
  const a = j.address || {};
  const il = a.province || a.state || a.city || "";
  const adaylar = [...new Set([a.town, a.county, a.city_district, a.municipality, a.city, a.village].filter(Boolean))];
  const ilce = adaylar[0] || "";
  const adr = { ilce, il, ulke: (a.country_code || "").toLowerCase(), adaylar, etiket: [...new Set([ilce, il].filter(Boolean))].join(", ") || j.name || "" };
  adresCache[key] = adr;
  const anahtarlar = Object.keys(adresCache);
  if (anahtarlar.length > 400) delete adresCache[anahtarlar[0]];
  LS.set("yn_adres", adresCache);
  return adr;
}
async function sehirAdi(p) {
  const key = p.lat.toFixed(2) + "," + p.lng.toFixed(2);
  if (sehirCache[key]) return sehirCache[key];
  try {
    const ad = (await adresBul(p)).etiket;
    sehirCache[key] = ad; LS.set("yn_sehir", sehirCache);
    return ad;
  } catch { return ""; }
}

// ---------- Rota (OSRM) ----------
const YON = { left: "sola", right: "sağa", "slight left": "hafif sola", "slight right": "hafif sağa", "sharp left": "keskin sola", "sharp right": "keskin sağa", straight: "düz", uturn: "geri" };
const OK = { left: "⬅", right: "➡", "slight left": "↖", "slight right": "↗", "sharp left": "↙", "sharp right": "↘", straight: "⬆", uturn: "↩" };
const buyuk = (s) => s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);

function talimat(s, sonAyak) {
  const m = s.maneuver, y = YON[m.modifier] || "";
  const yol = [s.name, s.ref].filter(Boolean).join(" ");
  let t, ok = OK[m.modifier] || "⬆";
  switch (m.type) {
    case "depart": t = "Yola çıkın"; ok = "⬆"; break;
    case "arrive": t = sonAyak ? "Varış noktasına ulaştınız" : "Uğrayacağınız yere ulaştınız"; ok = "🏁"; break;
    case "turn": case "end of road":
      t = m.modifier === "uturn" ? "Geri dönün" : m.modifier === "straight" ? "Düz devam edin" : `${buyuk(y)} dönün`;
      if (m.type === "end of road") t = "Yolun sonunda " + t.charAt(0).toLocaleLowerCase("tr") + t.slice(1);
      break;
    case "merge": t = "Yola katılın"; break;
    case "on ramp": t = y && y !== "düz" ? `${buyuk(y)} bağlantı yoluna girin` : "Bağlantı yoluna girin"; break;
    case "off ramp": t = y && y !== "düz" ? `${buyuk(y.replace("hafif ", ""))} taraftaki çıkışı alın` : "Çıkışı alın"; break;
    case "fork": t = `Yol ayrımında ${y ? y.replace("hafif ", "").replace("keskin ", "") : "düz"} taraftan devam edin`; break;
    case "roundabout": case "rotary": case "roundabout turn":
      t = m.exit ? `Döner kavşaktan ${m.exit}. çıkıştan çıkın` : "Döner kavşağa girin"; ok = "⟳"; break;
    case "exit roundabout": case "exit rotary": t = "Döner kavşaktan çıkın"; break;
    default: t = y && y !== "düz" ? `${buyuk(y)} doğru devam edin` : "Düz devam edin";
  }
  const onemli = !((m.type === "new name" || m.type === "continue" || m.type === "notification") && (!m.modifier || m.modifier === "straight"));
  return { metin: t, yol: m.type === "arrive" ? "" : yol, ok, onemli };
}

async function osrm(noktalar) {
  const koord = noktalar.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const u = `https://router.project-osrm.org/route/v1/driving/${koord}?overview=false&steps=true&geometries=geojson`;
  const r = await fetch(u);
  if (!r.ok) throw new Error("Rota servisi yanıt vermedi (" + r.status + ")");
  const j = await r.json();
  if (j.code !== "Ok" || !j.routes?.length) throw new Error("Bu iki nokta arasında yol bulunamadı");
  const route = j.routes[0];
  const coords = [], cumD = [], cumT = [], adimlar = [];
  route.legs.forEach((leg, li) => {
    leg.steps.forEach((s) => {
      const g = s.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      if (!g.length) return;
      // adımın ilk noktası
      if (!coords.length) { coords.push(g[0]); cumD.push(0); cumT.push(0); }
      else if (mesafe(coords[coords.length - 1], g[0]) > 0.5) {
        const d = mesafe(coords[coords.length - 1], g[0]);
        coords.push(g[0]); cumD.push(cumD[cumD.length - 1] + d); cumT.push(cumT[cumT.length - 1]);
      }
      const t = talimat(s, li === route.legs.length - 1);
      adimlar.push({ idx: coords.length - 1, ...t, tip: s.maneuver.type });
      for (let i = 1; i < g.length; i++) {
        const d = mesafe(g[i - 1], g[i]);
        if (d < 0.01) continue;
        coords.push(g[i]);
        cumD.push(cumD[cumD.length - 1] + d);
        cumT.push(cumT[cumT.length - 1] + (s.distance > 0 ? (s.duration * d) / s.distance : 0));
      }
    });
  });
  return { coords, cumD, cumT, adimlar, toplamD: cumD[cumD.length - 1], toplamT: cumT[cumT.length - 1] };
}

// Rotaya en yakın nokta (indeks ve uzaklık). İpucu verilirse önce çevresine bakar.
function enYakin(r, p, ipucu) {
  const kx = Math.cos(rad(p.lat)) * 111320, ky = 110540;
  const tara = (a, b) => {
    let best = Infinity, bi = a;
    for (let i = Math.max(0, a); i < Math.min(r.coords.length - 1, b); i++) {
      const A = r.coords[i], B = r.coords[i + 1];
      const ax = (A.lng - p.lng) * kx, ay = (A.lat - p.lat) * ky, bx = (B.lng - p.lng) * kx, by = (B.lat - p.lat) * ky;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let t = L2 ? -(ax * dx + ay * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const x = ax + t * dx, y = ay + t * dy, d = x * x + y * y;
      if (d < best) { best = d; bi = t > 0.5 ? i + 1 : i; }
    }
    if (r.coords.length === 1) return { idx: 0, uzak: mesafe(r.coords[0], p) };
    return { idx: bi, uzak: Math.sqrt(best) };
  };
  if (ipucu != null) {
    const s = tara(ipucu - 20, ipucu + 2000);
    if (s.uzak < 150) return s;
  }
  return tara(0, r.coords.length);
}

const faktor = () => parseFloat(ayar.hiz) || 1;
function zamanAt(idx) {
  const z = durum.cizelge, r = durum.rota;
  return new Date(z.zaman + (r.cumT[idx] - r.cumT[z.idx]) * faktor() * 1000);
}
function idxAtZaman(t) {
  const r = durum.rota, z = durum.cizelge;
  let lo = z.idx, hi = r.coords.length - 1;
  if (t <= z.zaman) return lo;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (zamanAt(mid) < t) lo = mid + 1; else hi = mid; }
  return lo;
}

function rotaCiz() {
  rotaKatman.clearLayers();
  const r = durum.rota;
  gecilenCizgi = L.polyline([], { className: "rota-gecilen", weight: 7, opacity: 0.9, interactive: false }).addTo(rotaKatman);
  rotaCizgi = L.polyline(r.coords, { className: "rota-cizgi", weight: 7, opacity: 0.9, interactive: false }).addTo(rotaKatman);
}
function isaretleriCiz() {
  if (baslangicIsaret) harita.removeLayer(baslangicIsaret);
  if (hedefIsaret) harita.removeLayer(hedefIsaret);
  if (araIsaret) harita.removeLayer(araIsaret);
  baslangicIsaret = hedefIsaret = araIsaret = null;
  if (durum.baslangic && !durum.baslangic.konumum) baslangicIsaret = L.marker([durum.baslangic.lat, durum.baslangic.lng], { icon: pinIkon("bas"), title: "Başlangıç" }).addTo(harita);
  if (durum.hedef) hedefIsaret = L.marker([durum.hedef.lat, durum.hedef.lng], { icon: pinIkon("hedef"), title: "Varış: " + (durum.hedef.ad || ""), zIndexOffset: 900 })
    .bindPopup(`<b>Varış</b><br>${esc(durum.hedef.ad || "")}`).addTo(harita);
  if (durum.ara) araIsaret = L.marker([durum.ara.lat, durum.ara.lng], { icon: pinIkon("ara"), title: "Uğranacak: " + durum.ara.ad }).addTo(harita);
}

async function rotaHesapla({ sessiz = false } = {}) {
  if (durum.rotaHesaplaniyor) return;
  const bas = durum.nav || !durum.baslangic || durum.baslangic.konumum ? durum.konum : durum.baslangic;
  if (!bas) { mesaj("Konumun henüz bulunamadı. Biraz bekle ya da seçeneklerden “Nereden” kutusuna bir yer yaz."); return; }
  if (!durum.hedef) { mesaj("Önce “Nereye” kutusundan gidilecek yeri seç."); return; }
  durum.rotaHesaplaniyor = true;
  if (!sessiz) { $("btnRota").disabled = true; $("rotaOzet").textContent = "Rota hesaplanıyor…"; }
  try {
    const noktalar = [bas];
    if (durum.ara) noktalar.push(durum.ara);
    noktalar.push(durum.hedef);
    durum.rota = await osrm(noktalar);
    namazPlaniCiz.siteDenendi = false;
    durum.sonIdx = 0;
    durum.soylenen = new Set();
    const cikis = !durum.nav && $("cikis").value ? new Date($("cikis").value).getTime() : Date.now();
    durum.cizelge = { idx: 0, zaman: durum.nav ? Date.now() : cikis };
    rotaCiz();
    isaretleriCiz();
    if (!durum.nav) harita.fitBounds(rotaCizgi.getBounds(), { padding: [30, 30] });
    rotaOzetYaz();
    $("btnBasla").hidden = durum.nav;
    poileriRotaylaEslestir();
    namazPlaniCiz();
    // Yerleri sadece ilk hesaplamada ya da uzun yeniden yönlendirmede çek
    if (!sessiz) await rotaYerleriGetir();
  } catch (e) {
    if (!sessiz) $("rotaOzet").textContent = "⚠ " + e.message;
  } finally {
    durum.rotaHesaplaniyor = false;
    $("btnRota").disabled = false;
  }
}
function rotaOzetYaz() {
  const r = durum.rota; if (!r) return;
  const varis = zamanAt(r.coords.length - 1);
  const sayi = (t) => durum.poiler.filter((p) => p.tur === t).length;
  $("rotaOzet").innerHTML = `<div class="kart"><div class="baslik">${km(r.toplamD)} · ${sure(r.toplamT * faktor())}</div>
    <div class="alt">Tahmini varış: ${varis.toLocaleString("tr-TR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}</div>
    ${durum.ara ? `<div class="alt">Uğranacak: ${esc(durum.ara.ad)}</div>` : ""}
    ${durum.poiler.length ? `<div class="alt">Yol üstünde ${sayi("cami")} cami, ${sayi("mescit")} mescit, ${sayi("tesis")} tesis${sayi("yakit") ? ", " + sayi("yakit") + " istasyon" : ""}</div>` : ""}</div>`;
}

// ---------- Yerler (Overpass) ----------
/* Overpass (OpenStreetMap yer verisi). Kurallarına uygun olarak uygulama kendini açıkça tanıtır;
   sunucular tanımsız istemcileri 429 ile reddediyor. Android'de bu başlık yerel istemciyle gönderilir. */
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const OVERPASS_UA = "YolcuNamaz/1.0 (Android; mosques and rest areas along a driving route)";
class YerHatasi extends Error {}
async function overpass(q) {
  const hatalar = [];
  for (let tur = 0; tur < 2; tur++) {
    for (const u of [...OVERPASS]) {
      const kontrol = new AbortController();
      const zaman = setTimeout(() => kontrol.abort(), 45000);
      try {
        const r = await fetch(u, {
          method: "POST", body: "data=" + encodeURIComponent(q), signal: kontrol.signal,
          headers: { "Content-Type": "application/x-www-form-urlencoded", ...(NATIVE ? { "User-Agent": OVERPASS_UA } : {}) },
        });
        if (r.ok) {
          const j = await r.json();
          // Çalışan sunucuyu öne al, sonraki parçalarda önce o denensin
          OVERPASS.splice(OVERPASS.indexOf(u), 1); OVERPASS.unshift(u);
          if (j.remark && /timed out|out of memory/i.test(j.remark) && !(j.elements || []).length) { hatalar.push(new URL(u).host + ": zaman aşımı"); continue; }
          return j.elements || [];
        }
        hatalar.push(new URL(u).host + ": " + r.status);
      } catch (e) {
        hatalar.push(new URL(u).host + ": " + (e.name === "AbortError" ? "yanıt gelmedi" : "bağlanılamadı"));
      } finally { clearTimeout(zaman); }
    }
    if (tur === 0) await uyku(4000); // hepsi meşgulse biraz bekleyip bir kez daha dene
  }
  const e = new YerHatasi("Cami ve tesis bilgisi sunucularına şu an ulaşılamadı");
  e.ayrinti = hatalar.join(", ");
  throw e;
}
// Aynı yol tekrar sorulursa internet olmadan da göstermek için sonuçları 14 gün sakla
const yerOnbellek = LS.get("yn_yeronbellek", {});
function onbellekYaz(key, poiler) {
  yerOnbellek[key] = { t: Date.now(), p: poiler.map((x) => [x.id, x.lat, x.lng, x.tur, x.ad]) };
  const keys = Object.keys(yerOnbellek).sort((a, b) => yerOnbellek[a].t - yerOnbellek[b].t);
  while (keys.length > 60) delete yerOnbellek[keys.shift()];
  try { localStorage.setItem("yn_yeronbellek", JSON.stringify(yerOnbellek)); } catch { /* dolu */ }
}
function onbellekOku(key) {
  const o = yerOnbellek[key];
  if (!o || Date.now() - o.t > 14 * 86400000) return null;
  return o.p.map(([id, lat, lng, tur, ad]) => ({ id, lat, lng, tur, ad, tags: {} }));
}
function kategoriler() { return { cami: $("kCami").checked, tesis: $("kTesis").checked, yakit: $("kYakit").checked }; }
function sorguParca(alan, r, k) {
  let s = "";
  if (k.cami) s += `nwr["amenity"="place_of_worship"]["religion"="muslim"](around:${r},${alan});`;
  if (k.tesis) s += `nwr["highway"~"^(services|rest_area)$"](around:${Math.min(r, 1000)},${alan});`;
  if (k.yakit) s += `nwr["amenity"="fuel"](around:${Math.min(r, 300)},${alan});`;
  return s;
}
function poiDonustur(e) {
  const t = e.tags || {};
  const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
  if (lat == null) return null;
  let tur;
  if (t.amenity === "place_of_worship") {
    const ad = (t.name || "").toLocaleLowerCase("tr");
    if (/mescid|mescit|namazgah|musalla/.test(ad) || t.place_of_worship === "musalla") tur = "mescit";
    else if (t.building === "mosque" || /cami/.test(ad)) tur = "cami";
    else tur = e.type === "node" ? "mescit" : "cami";
  } else if (t.highway) tur = "tesis";
  else tur = "yakit";
  const ad = t["name:tr"] || t.name || t.brand || TUR[tur].ad;
  return { id: e.type + "/" + e.id, lat, lng, tur, ad, tags: t };
}
function benimPoiler() {
  return benimYerler().map((y) => ({ id: y.id, lat: y.lat, lng: y.lng, tur: y.tur, ad: y.ad || TUR[y.tur].ad, not: y.not, benim: true }));
}

async function rotaYerleriGetir() {
  const r = durum.rota; if (!r) return;
  const k = kategoriler();
  if (!k.cami && !k.tesis && !k.yakit) { poileriRotaylaEslestir(); return; }
  const yaricap = +$("sapma").value;
  // Rotadan her ~1,5 km'de bir nokta al, parça parça sorgula
  const ornek = [r.coords[0]];
  let son = 0;
  for (let i = 1; i < r.coords.length; i++) if (r.cumD[i] - r.cumD[son] >= 1500) { ornek.push(r.coords[i]); son = i; }
  ornek.push(r.coords[r.coords.length - 1]);
  // ~60 km'lik küçük parçalar: sunucuyu yormaz, biri alınamazsa diğerleri yine gelir
  const parcalar = [];
  for (let i = 0; i < ornek.length - 1; i += 40) parcalar.push(ornek.slice(i, i + 41));
  const hepsi = new Map();
  const no = ++yerSorguNo;
  let basarisiz = 0, sonHata = null;
  for (let i = 0; i < parcalar.length; i++) {
    if (no !== yerSorguNo) return; // yeni rota istendi
    durumYaz(`Yol üstündeki camiler aranıyor… (${i + 1}/${parcalar.length})`);
    const alan = parcalar[i].map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(",");
    const key = [alan.length, parcalar[i][0].lat.toFixed(3), parcalar[i][0].lng.toFixed(3), parcalar[i].at(-1).lat.toFixed(3), parcalar[i].at(-1).lng.toFixed(3), yaricap, +k.cami, +k.tesis, +k.yakit].join("|");
    let liste = onbellekOku(key);
    if (!liste) {
      try {
        const els = await overpass(`[out:json][timeout:60];(${sorguParca(alan, yaricap, k)});out center tags qt;`);
        liste = els.map(poiDonustur).filter(Boolean);
        onbellekYaz(key, liste);
      } catch (e) { basarisiz++; sonHata = e; continue; }
    }
    for (const p of liste) hepsi.set(p.id, p);
    // Buldukça göster
    durum.hamPoiler = [...hepsi.values()];
    poileriRotaylaEslestir();
    rotaOzetYaz();
  }
  durum.hamPoiler = [...hepsi.values()];
  poileriRotaylaEslestir();
  namazPlaniCiz();
  rotaOzetYaz();
  if (!basarisiz) durumYaz("");
  else {
    durumYaz(basarisiz === parcalar.length
      ? `Cami ve tesis bilgisi şu an alınamadı (sunucular meşgul ya da internet zayıf). Eklediğin yerler yine görünür.`
      : `Yolun bir kısmındaki yerler alınamadı (${basarisiz}/${parcalar.length} bölüm).`, true, sonHata?.ayrinti);
  }
}
let yerSorguNo = 0;
function durumYaz(t, tekrar, ayrinti) {
  let el = $("durumSatir");
  if (!el) { el = document.createElement("div"); el.id = "durumSatir"; el.className = "ipucu"; $("rotaOzet").after(el); }
  el.innerHTML = esc(t) + (ayrinti ? `<details><summary>Ayrıntı</summary>${esc(ayrinti)}</details>` : "") +
    (tekrar ? ` <button class="btn" id="btnYerTekrar">Tekrar dene</button>` : "");
  if (tekrar) $("btnYerTekrar").onclick = () => rotaYerleriGetir();
}

function poileriRotaylaEslestir() {
  const r = durum.rota;
  const yaricap = +$("sapma").value;
  const liste = [...(durum.hamPoiler || []), ...benimPoiler()];
  const k = kategoriler();
  const sonuc = [];
  if (r) {
    for (const p of liste) {
      if (!p.benim && !k[p.tur === "mescit" ? "cami" : p.tur]) continue;
      const { idx, uzak } = enYakin(r, p);
      if (uzak > yaricap + 250) continue;
      sonuc.push({ ...p, idx, uzak });
    }
    sonuc.sort((a, b) => a.idx - b.idx);
  }
  durum.poiler = sonuc;
  poileriCiz();
  yerListesiCiz();
}

function poileriCiz() {
  poiKatman.clearLayers();
  const gorulen = new Set();
  const ekle = (p) => {
    if (gorulen.has(p.id)) return; gorulen.add(p.id);
    L.marker([p.lat, p.lng], { icon: poiIkon(p.tur, p.benim), title: p.ad }).bindPopup(() => poiPopup(p), popupAyar()).addTo(poiKatman);
  };
  durum.poiler.forEach(ekle);
  durum.yakinPoiler.forEach(ekle);
  benimPoiler().forEach(ekle);
}
function poiBilgi(p) {
  const parcalar = [TUR[p.tur].ad + (p.benim ? " (senin eklediğin)" : "")];
  if (durum.rota && p.idx != null && p.idx >= durum.sonIdx) {
    parcalar.push(`${km(durum.rota.cumD[p.idx] - durum.rota.cumD[durum.sonIdx])} ileride · ~${saat(zamanAt(p.idx))}`);
    if (p.uzak > 150) parcalar.push(`yoldan ${km(p.uzak)} içeride`);
  } else if (durum.konum) parcalar.push(`${km(mesafe(durum.konum, p))} uzakta (kuş uçuşu)`);
  if (p.not) parcalar.push(p.not);
  return parcalar.join(" · ");
}
function poiPopup(p) {
  return `<b>${esc(p.ad)}</b><br><span class="tur">${esc(poiBilgi(p))}</span><br>
    <button class="btn btn-ana" data-ugra="${esc(p.id)}">${durum.rota ? "Buraya uğra" : "Buraya git"}</button>
    <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}">Google Haritalar</a>`;
}
function poiBul(id) {
  return durum.poiler.find((p) => p.id === id) || durum.yakinPoiler.find((p) => p.id === id) || benimPoiler().find((p) => p.id === id);
}
async function poiyeUgra(p) {
  harita.closePopup();
  if (durum.rota && durum.hedef) {
    durum.ara = { lat: p.lat, lng: p.lng, ad: p.ad, id: p.id };
    mesaj(`${p.ad} rotaya eklendi. Önce oraya, sonra varış noktasına gideceksiniz.`);
  } else {
    durum.hedef = { lat: p.lat, lng: p.lng, ad: p.ad };
    $("nereye").value = p.ad;
  }
  await rotaHesapla({ sessiz: durum.nav });
}

async function yakindakileriGetir(otomatik) {
  const k = durum.konum;
  if (!k) { if (!otomatik) mesaj("Konumunuz henüz bulunamadı."); return; }
  const kat = kategoriler();
  if (!otomatik) $("btnYakin").disabled = true;
  try {
    const els = await overpass(`[out:json][timeout:60];(${sorguParca(`${k.lat},${k.lng}`, 5000, { ...kat, cami: true })});out center tags;`);
    durum.yakinPoiler = els.map(poiDonustur).filter(Boolean)
      .map((p) => ({ ...p, uzak: mesafe(k, p) })).sort((a, b) => a.uzak - b.uzak);
    poileriCiz();
    yerListesiCiz();
  } catch (e) {
    if (!otomatik) mesaj("Yakındaki yerler alınamadı: " + e.message);
  } finally { $("btnYakin").disabled = false; }
}

function yerSatiri(p, alt) {
  return `<div class="yer"><div class="rozet ${p.benim ? "r-benim" : TUR[p.tur].sinif}"></div>
    <div class="bilgi"><div class="ad">${esc(p.ad)}</div><div class="ipucu">${esc(alt)}</div></div>
    <button class="btn" data-goster="${esc(p.id)}">Harita</button></div>`;
}
function yerListesiCiz() {
  const el = $("yerListe");
  let html = "";
  if (durum.rota && durum.poiler.length) {
    const ileride = durum.poiler.filter((p) => p.idx >= durum.sonIdx);
    html += `<h3>Yol üzerinde (${ileride.length})</h3>` + ileride.map((p) => yerSatiri(p, poiBilgi(p))).join("");
  }
  if (durum.yakinPoiler.length) {
    const k = durum.konum;
    html += `<h3>Yakınımda</h3>` + durum.yakinPoiler.slice(0, 30).map((p) => yerSatiri(p, `${TUR[p.tur].ad} · ${k ? km(mesafe(k, p)) + " uzakta" : ""}`)).join("");
  }
  el.innerHTML = html || `<p class="ipucu">Henüz yer yok. Rota oluşturun ya da yukarıdaki düğmeye basın.</p>`;
}

// ---------- Namaz planı ----------
function namazPlani() {
  const r = durum.rota, z = durum.cizelge;
  if (!r || !z) return [];
  const basZ = new Date(z.zaman);
  const sonIdx = r.coords.length - 1;
  const bitZ = zamanAt(sonIdx);
  const konumAt = (t) => r.coords[idxAtZaman(t)];
  const sonuc = [];
  const g = new Date(basZ); g.setHours(12, 0, 0, 0); g.setDate(g.getDate() - 1);
  for (; g.getTime() <= bitZ.getTime() + 86400000; g.setDate(g.getDate() + 1)) {
    for (const n of NAMAZLAR) {
      let t = vakitler(r.coords[z.idx], g)[n];
      for (let i = 0; i < 3; i++) t = vakitler(konumAt(t), g)[n];
      const bg = new Date(g); if (n === "yatsi") bg.setDate(bg.getDate() + 1);
      let son = vakitler(konumAt(t), bg)[BITIS[n]];
      son = vakitler(konumAt(son), bg)[BITIS[n]];
      if (son <= basZ || t > bitZ) continue;
      const pencereBas = new Date(Math.max(t, basZ));
      const idx = idxAtZaman(pencereBas);
      const sonUygun = son.getTime() - 10 * 60000;
      const uygun = durum.poiler.filter((p) => p.idx >= z.idx && zamanAt(p.idx) >= pencereBas && zamanAt(p.idx) <= sonUygun);
      let oneriler = uygun.filter((p) => p.tur !== "yakit");
      if (!oneriler.length) oneriler = uygun;
      sonuc.push({
        ad: n, vakit: t, bitis: son, girdi: t <= basZ, idx, nokta: r.coords[idx],
        varistaDevam: son > bitZ, varis: bitZ, oneriler: oneriler.slice(0, 4),
      });
    }
  }
  return sonuc.sort((a, b) => a.vakit - b.vakit);
}

let planSayac = 0;
async function namazPlaniCiz() {
  const el = $("namazPlan");
  if (!durum.rota) return;
  const plan = namazPlani();
  const no = ++planSayac;
  if (!plan.length) { el.innerHTML = `<p class="ipucu">Bu yolculuk sırasında yeni bir namaz vakti girmiyor.</p>`; return; }
  el.innerHTML = plan.map((p, i) => {
    const oneri = p.oneriler.length
      ? p.oneriler.map((o) => yerSatiri(o, `${km(durum.rota.cumD[o.idx] - durum.rota.cumD[durum.cizelge.idx])} sonra · ~${saat(zamanAt(o.idx))} · ${TUR[o.tur].ad}`)).join("")
      : `<p class="ipucu">Bu vakit içinde yol üstünde kayıtlı yer yok. “Yol” sekmesindeki seçeneklerden akaryakıt istasyonlarını açabilir ya da yoldan uzaklığı artırabilirsin.</p>`;
    return `<div class="kart"><div class="baslik">${Vakit.SHORT[p.ad]} <span class="saat">${saat(p.vakit)}</span> <span class="alt">· ${saat(p.bitis)}'e kadar</span></div>
      <div class="alt">${p.girdi ? "Vakit girmiş durumda. " : ""}${p.vakit.toLocaleDateString("tr-TR", { weekday: "long" })} — ${esc(seslen("bu vakitte"))} <b id="sehir${no}_${i}">…</b> civarında olacaksın.</div>
      ${p.varistaDevam ? `<div class="alt">Varınca (${saat(p.varis)}) vakit hâlâ devam ediyor, orada da kılabilirsin.</div>` : ""}
      ${oneri}</div>`;
  }).join("");
  if (ayar.kaynak === "site" && !namazPlaniCiz.siteDenendi) {
    namazPlaniCiz.siteDenendi = true;
    (async () => {
      let yeni = false;
      for (const p of plan.slice(0, 8)) {
        if (await sehirVakitHazirla(p.nokta)) yeni = true;
        else if (!sehirTablosu(p.nokta, p.vakit) && await siteVakitGetir(p.nokta)) yeni = true;
      }
      if (yeni) { namazPlaniCiz(); vakitBarGuncelle(); }
    })();
  }
  bildirimleriPlanla(plan);
  for (let i = 0; i < plan.length; i++) {
    const ad = await sehirAdi(plan[i].nokta);
    if (no !== planSayac) return;
    const s = document.getElementById(`sehir${no}_${i}`);
    if (s) s.textContent = ad || "yolda";
    plan[i].sehir = ad;
  }
}

// ---------- Bildirimler ----------
function bildirildi(k) { return durum.bildirilen.has(k); }
function bildirimKaydet(k) { durum.bildirilen.add(k); LS.set("yn_bildirilen", [...durum.bildirilen]); }
let uyariPoi = null, uyariVakit = null;
const kilindi = (key) => bildirildi(key + "|kildi");
function bildir(baslik, metin, poi, vakitKey) {
  $("uyariMetin").innerHTML = `<b>${esc(baslik)}</b><br>${esc(metin)}`;
  uyariPoi = poi || null;
  uyariVakit = vakitKey || null;
  $("uyariGit").hidden = !poi;
  $("uyariKildim").hidden = !vakitKey;
  $("uyari").hidden = false;
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  soyle(baslik + ". " + metin);
  if (NATIVE && EKLENTI.LocalNotifications) {
    EKLENTI.LocalNotifications.schedule({ notifications: [{ id: Math.floor(Date.now() / 1000) % 2000000000, title: baslik, body: metin }] }).catch(() => {});
  } else if ("Notification" in window && Notification.permission === "granted" && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(baslik, { body: metin, icon: "icon.svg", tag: "vakit", renotify: true })).catch(() => {});
  }
}
function mesaj(t) {
  $("uyariMetin").textContent = t; uyariPoi = null; uyariVakit = null; $("uyariGit").hidden = true; $("uyariKildim").hidden = true; $("uyari").hidden = false;
}
function soyle(t) {
  if (!ayar.ses) return;
  if (NATIVE && EKLENTI.TextToSpeech) {
    EKLENTI.TextToSpeech.speak({ text: t, lang: "tr-TR", rate: 1.0, category: "playback", queueStrategy: 1 }).catch(() => {});
    return;
  }
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(t);
  u.lang = "tr-TR";
  const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith("tr"));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

/* Android'de vakit uyarılarını önceden sisteme kurarız: uygulama kapalı ya da ekran kilitliyken de çalar. */
const PLAN_ID_BAS = 700000;
async function bildirimleriPlanla(plan) {
  if (!NATIVE || !EKLENTI.LocalNotifications) return;
  const LN = EKLENTI.LocalNotifications;
  try {
    const bekleyen = await LN.getPending();
    const eski = (bekleyen.notifications || []).filter((n) => n.id >= PLAN_ID_BAS && n.id < PLAN_ID_BAS + 1000).map((n) => ({ id: n.id }));
    if (eski.length) await LN.cancel({ notifications: eski });
    if (!durum.rota || !(durum.nav || durum.cizelge.zaman > Date.now() - 3600000)) return;
    const once = +ayar.once * 60000;
    const liste = [];
    plan.forEach((p, i) => {
      const zaman = new Date(p.vakit.getTime() - once);
      if (p.girdi || zaman <= new Date(Date.now() + 60000)) return;
      const sehir = sehirCache[p.nokta.lat.toFixed(2) + "," + p.nokta.lng.toFixed(2)];
      liste.push({
        id: PLAN_ID_BAS + i, schedule: { at: zaman, allowWhileIdle: true },
        title: seslen(`${NAMAZ_AD[p.ad]} vakti ${ayar.once} dk sonra (${saat(p.vakit)})`),
        body: `${sehir ? "O sırada " + sehir + " civarında olacaksın. " : ""}${oneriMetni(p)}`,
      });
    });
    if (liste.length) await LN.schedule({ notifications: liste });
  } catch { /* izin yoksa sessizce geç */ }
}
function oneriMetni(p) {
  if (!p.oneriler.length) return "Yol üstünde kayıtlı cami veya tesis görünmüyor" + (p.varistaDevam ? ", varınca da kılabilirsin." : ".");
  return "Şuralarda kılabilirsin: " + p.oneriler.slice(0, 3).map((o) =>
    `${o.ad} (${km(durum.rota.cumD[o.idx] - durum.rota.cumD[durum.sonIdx])} sonra, ~${saat(zamanAt(o.idx))})`).join("; ") + ".";
}
function vakitKontrol() {
  const simdi = Date.now();
  const once = +ayar.once * 60000;
  if (durum.nav && durum.rota) {
    for (const p of namazPlani()) {
      const key = gunKey(p.vakit) + "|" + p.ad;
      const sehir = p.sehir || sehirCache[p.nokta.lat.toFixed(2) + "," + p.nokta.lng.toFixed(2)];
      if (!p.girdi && p.vakit - simdi > 0 && p.vakit - simdi <= once && !bildirildi(key + "|once")) {
        bildirimKaydet(key + "|once");
        bildir(seslen(`${NAMAZ_AD[p.ad]} vakti yaklaşıyor, ${sure((p.vakit - simdi) / 1000)} sonra (${saat(p.vakit)})`),
          `${sehir ? "O sırada " + sehir + " civarında olacaksın. " : ""}${oneriMetni(p)}`, p.oneriler[0], key);
        if (!sehir) sehirAdi(p.nokta);
      } else if (p.vakit <= simdi && simdi < p.bitis && !bildirildi(key + "|girdi")) {
        bildirimKaydet(key + "|girdi");
        bildir(seslen(`${NAMAZ_AD[p.ad]} vakti girdi (${saat(p.bitis)}'e kadar)`), oneriMetni(p), p.oneriler[0], key);
      }
    }
  } else if (durum.konum) {
    const v = vakitBilgisi(durum.konum);
    const n = v.sonraki;
    if (n === "gunes") return;
    const key = gunKey(v.sonrakiZaman) + "|" + n;
    const kalan = v.sonrakiZaman - simdi;
    const yakin = durum.yakinPoiler.filter((p) => p.tur !== "yakit").slice(0, 2);
    const yakinMetin = yakin.length ? "Yakınındaki yerler: " + yakin.map((p) => `${p.ad} (${km(mesafe(durum.konum, p))})`).join(", ") + "." : "";
    if (kalan > 0 && kalan <= once && !bildirildi(key + "|once")) {
      bildirimKaydet(key + "|once");
      bildir(seslen(`${NAMAZ_AD[n]} vakti yaklaşıyor, ${sure(kalan / 1000)} sonra (${saat(v.sonrakiZaman)})`), yakinMetin, yakin[0], key);
    }
    // Vakit girince (yol tarifi açık değilken de)
    const av = aktifVakit();
    if (av && !bildirildi(av.key + "|girdi") && !kilindi(av.key) && simdi - av.vakit < 60 * 60000) {
      bildirimKaydet(av.key + "|girdi");
      bildir(seslen(`${NAMAZ_AD[av.ad]} vakti girdi (${saat(av.bitis)}'e kadar)`), yakinMetin, yakin[0], av.key);
    }
  }
}

// ---------- Mola hatırlatması ----------
/* Konum takibiyle aralıksız sürüş süresini ölçer. 10 dakika durunca sayaç sıfırlanır.
   Ayarlanan süre (varsayılan 2 saat) dolunca "dinlenme vakti gelmedi mi?" diye sorar. */
// Şu an içinde bulunulan namaz vakti (yolda: bulunulan yerin vakti)
function aktifVakit() {
  const simdi = Date.now();
  if (durum.nav && durum.rota) {
    const p = namazPlani().find((x) => x.vakit <= simdi && simdi < x.bitis);
    return p ? { ad: p.ad, vakit: p.vakit, bitis: p.bitis, key: gunKey(p.vakit) + "|" + p.ad } : null;
  }
  if (!durum.konum) return null;
  const v = vakitBilgisi(durum.konum);
  if (v.simdiki === "gunes") return null;
  let vakit = v.bugun[v.simdiki];
  if (vakit > simdi) vakit = vakitler(durum.konum, new Date(simdi - 86400000)).yatsi; // gece yarısından sonra: dünün yatsısı
  return { ad: v.simdiki, vakit, bitis: v.sonrakiZaman, key: gunKey(vakit) + "|" + v.simdiki };
}
function ilerdekiYer(turler, enFazla) {
  if (durum.rota) {
    const r = durum.rota;
    const p = durum.poiler.find((x) => x.idx > durum.sonIdx && turler.includes(x.tur) && r.cumD[x.idx] - r.cumD[durum.sonIdx] < enFazla);
    return p ? { p, metin: `${p.ad} (${km(r.cumD[p.idx] - r.cumD[durum.sonIdx])} sonra, ~${saat(zamanAt(p.idx))})` } : null;
  }
  if (!durum.konum) return null;
  const p = [...durum.yakinPoiler, ...benimPoiler()].filter((x) => turler.includes(x.tur) && mesafe(durum.konum, x) < enFazla)
    .sort((a, b) => mesafe(durum.konum, a) - mesafe(durum.konum, b))[0];
  return p ? { p, metin: `${p.ad} (${km(mesafe(durum.konum, p))} uzakta)` } : null;
}
const surus = Object.assign({ basla: null, durmaBas: null, sonHatirlatma: null }, LS.get("yn_surus", {}));
if (surus.basla && Date.now() - (surus.son || 0) > 15 * 60000) { surus.basla = null; surus.sonHatirlatma = null; }
let sonFix = null;
function surusGuncelle(k) {
  const simdi = Date.now();
  let hiz = null;
  if (sonFix && simdi - sonFix.zaman >= 3000) hiz = mesafe(sonFix, k) / ((simdi - sonFix.zaman) / 1000);
  if (k.hiz != null && k.hiz >= 0) hiz = k.hiz;
  if (!sonFix || simdi - sonFix.zaman >= 3000) sonFix = { lat: k.lat, lng: k.lng, zaman: simdi };
  if (hiz == null) return;
  if (hiz > 2.5) { // ~9 km/sa üstü: yolda
    if (!surus.basla) surus.basla = simdi;
    surus.durmaBas = null;
    durum.durakSoruldu = false;
  } else {
    if (!surus.durmaBas) surus.durmaBas = simdi;
    // Cami/mescit/tesis yanında 3 dk durduysak ve vakit kılınmadıysa: namaz için mi durduk?
    if (!durum.durakSoruldu && simdi - surus.durmaBas >= 3 * 60000) {
      durum.durakSoruldu = true;
      const av = aktifVakit();
      const yer = av && !kilindi(av.key) && [...durum.poiler, ...durum.yakinPoiler, ...benimPoiler()]
        .find((x) => x.tur !== "yakit" && mesafe(k, x) < 250);
      if (yer) bildir(seslen(`${yer.ad} yanında durduk.`), `${NAMAZ_AD[av.ad]} vakti, ${saat(av.bitis)}'e kadar. Kıldıysan “Kıldım”a bas, bu vakit için bir daha hatırlatmayayım.`, null, av.key);
    }
    if (simdi - surus.durmaBas >= 10 * 60000) { surus.basla = null; surus.sonHatirlatma = null; }
  }
  surus.son = simdi;
  LS.set("yn_surus", surus);
  molaKontrol();
}
function molaKontrol() {
  const aralik = +ayar.mola * 60000;
  if (!aralik || !surus.basla || surus.durmaBas) return;
  const simdi = Date.now();
  if (simdi - (surus.sonHatirlatma || surus.basla) < aralik) return;
  surus.sonHatirlatma = simdi;
  LS.set("yn_surus", surus);
  const dkS = Math.round((simdi - surus.basla) / 60000);
  const sa = Math.floor(dkS / 60), yarim = dkS % 60 >= 25 && dkS % 60 < 50, artir = dkS % 60 >= 50;
  const sure_ = sa + (artir ? 1 : 0) === 0 ? `${dkS} dakikadır` : `${sa + (artir ? 1 : 0)}${yarim ? " buçuk" : ""} saattir`;
  const av = aktifVakit();
  if (av && !kilindi(av.key) && av.bitis - simdi > 15 * 60000) {
    // Vakit içindeyiz ve kılınmadı: molayı namazla birleştir — Kıldım düğmesi var
    const yer = ilerdekiYer(["cami", "mescit", "tesis"], 40000);
    bildir(seslen(`${sure_} aralıksız yoldasın. ${NAMAZ_AD[av.ad]} vakti de girdi.`),
      (yer ? `İleride ${yer.metin} var, ` : "Uygun bir yerde ") + `hem dinlenir hem namazını kılarsın. Vakit ${saat(av.bitis)}'e kadar.`, yer?.p, av.key);
    return;
  }
  // Kılındı ya da vakit yok: sadece dinlenme — Kıldım düğmesi yok
  const yer = ilerdekiYer(["tesis"], 60000) || ilerdekiYer(["cami", "mescit"], 30000);
  bildir(seslen(`${sure_} aralıksız yoldasın. Dinlenme vakti gelmedi mi?`),
    yer ? `İleride ${yer.metin} var. Bir çay molası iyi gelir.` : "Uygun bir yerde biraz mola ver, olur mu?", yer?.p);
}

// ---------- Navigasyon ----------
async function navBaslat() {
  if (!durum.rota) return;
  if (!durum.konum) { mesaj("Yolculuğu başlatmak için konumunuzun bulunması gerekiyor."); return; }
  await bildirimIzniIste();
  durum.nav = true;
  durum.takipte = true;
  document.body.classList.add("nav");
  document.body.classList.remove("panelAcik");
  $("navOzet").hidden = false;
  $("navKutu").hidden = false;
  $("btnBasla").hidden = true;
  // Başlangıç “konumum” değilse, rotayı şu anki konumdan yeniden hesapla
  const { uzak } = enYakin(durum.rota, durum.konum);
  if (uzak > 200) await rotaHesapla({ sessiz: true });
  durum.cizelge = { idx: enYakin(durum.rota, durum.konum).idx, zaman: Date.now() };
  harita.setView([durum.konum.lat, durum.konum.lng], 16);
  ekranAcikTut();
  soyle(seslen("Hayırlı yolculuklar. Namaz vakitlerinde ve molalarda sana haber vereceğim."));
  navGuncelle();
  setTimeout(() => harita.invalidateSize(), 300);
}
function navBitir() {
  durum.nav = false;
  document.body.classList.remove("nav", "panelAcik");
  $("navOzet").hidden = true;
  $("navKutu").hidden = true;
  $("btnBasla").hidden = !durum.rota;
  if (durum.wakeLock) { durum.wakeLock.release().catch(() => {}); durum.wakeLock = null; }
  if (NATIVE && EKLENTI.KeepAwake) EKLENTI.KeepAwake.allowSleep().catch(() => {});
  speechSynthesis?.cancel?.();
  setTimeout(() => harita.invalidateSize(), 300);
}
async function ekranAcikTut() {
  if (!ayar.ekran || !durum.nav) return;
  if (NATIVE && EKLENTI.KeepAwake) { EKLENTI.KeepAwake.keepAwake().catch(() => {}); return; }
  if (!("wakeLock" in navigator)) return;
  try { durum.wakeLock = await navigator.wakeLock.request("screen"); } catch { /* */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && durum.nav) ekranAcikTut(); });

let sonCizim = 0;
function navGuncelle() {
  const r = durum.rota, k = durum.konum;
  if (!r || !k) return;
  const { idx, uzak } = enYakin(r, k, durum.sonIdx);
  // Rotadan çıkıldıysa yeniden hesapla
  if (uzak > Math.max(60, Math.min(k.acc * 1.5, 150))) {
    durum.rotaDisi++;
    if (durum.rotaDisi >= 3 && Date.now() - durum.sonYonlendirme > 20000 && !durum.rotaHesaplaniyor) {
      durum.sonYonlendirme = Date.now(); durum.rotaDisi = 0;
      soyle("Rota yeniden hesaplanıyor");
      rotaHesapla({ sessiz: true }).then(() => { durum.cizelge = { idx: 0, zaman: Date.now() }; navGuncelle(); });
      return;
    }
  } else durum.rotaDisi = 0;
  durum.sonIdx = idx;
  durum.cizelge = { idx, zaman: Date.now() };

  // Uğranacak yer geçildiyse unut
  if (durum.ara && mesafe(k, durum.ara) < 60) { durum.ara = null; isaretleriCiz(); }

  if (Date.now() - sonCizim > 3000) {
    sonCizim = Date.now();
    gecilenCizgi.setLatLngs(r.coords.slice(0, idx + 1));
    rotaCizgi.setLatLngs(r.coords.slice(idx));
  }

  // Sıradaki manevra
  const adim = r.adimlar.find((a) => a.idx > idx && a.onemli) || r.adimlar[r.adimlar.length - 1];
  const kalan = Math.max(0, r.cumD[adim.idx] - r.cumD[idx]);
  $("navOk").textContent = adim.ok;
  $("navMesafe").textContent = km(kalan);
  $("navMetin").textContent = adim.metin + (adim.yol ? " — " + adim.yol : "");
  const sesli = adim.metin + (adim.yol ? ", " + adim.yol : "");
  const anons = (esik, onEk) => {
    const key = adim.idx + "|" + esik;
    if (!durum.soylenen.has(key)) { durum.soylenen.add(key); soyle(onEk + sesli); }
  };
  if (adim.tip === "arrive" && kalan < 40 && !durum.ara) {
    if (!durum.soylenen.has("vardik")) { durum.soylenen.add("vardik"); soyle(seslen("Vardık. Hayırlı olsun.")); }
    $("navMetin").textContent = "Varış noktasına ulaştınız";
    setTimeout(navBitir, 4000);
    return;
  }
  if (kalan <= 60) anons(60, "Şimdi ");
  else if (kalan <= 400 && kalan > 150) anons(400, `${Math.round(kalan / 50) * 50} metre sonra `);
  else if (kalan <= 1500 && kalan > 800) anons(1500, `${(kalan / 1000).toFixed(1).replace(".", ",")} kilometre sonra `);

  // Alt özet
  const kalanD = r.toplamD - r.cumD[idx];
  const varis = zamanAt(r.coords.length - 1);
  const plan = namazPlani();
  const siradaki = plan.find((p) => p.bitis > Date.now());
  let namazMetin = "";
  if (siradaki) {
    const o = siradaki.oneriler[0];
    namazMetin = `<span class="namaz">${Vakit.SHORT[siradaki.ad]} ${siradaki.girdi || siradaki.vakit <= Date.now() ? "vakti içindeyiz" : saat(siradaki.vakit)}` +
      (o ? ` · <b>${esc(o.ad)}</b>, ${km(r.cumD[o.idx] - r.cumD[idx])} sonra` : "") + `</span>`;
  }
  $("navOzetMetin").innerHTML = `<span class="buyuk">${km(kalanD)}</span> kaldı · varış <span class="buyuk">${saat(varis)}</span>${namazMetin}`;
  document.documentElement.style.setProperty("--ozetYukseklik", $("panel").offsetHeight + "px");
  vakitKontrol();
  // Vakit içindeyken ve henüz kılınmadıysa: önümüzdeki 2,5 km'de cami/mescit varsa haber ver
  const icinde = plan.find((p) => p.vakit <= Date.now() && Date.now() < p.bitis - 10 * 60000);
  if (icinde) {
    const vk = gunKey(icinde.vakit) + "|" + icinde.ad;
    const yakin = durum.poiler.find((p) => p.idx > idx && p.tur !== "yakit" && r.cumD[p.idx] - r.cumD[idx] <= 2500);
    if (yakin && !kilindi(vk) && !bildirildi(vk + "|yakin|" + yakin.id) && Date.now() - (durum.sonYakinAnons || 0) > 15 * 60000) {
      bildirimKaydet(vk + "|yakin|" + yakin.id);
      durum.sonYakinAnons = Date.now();
      const ne = yakin.tur === "tesis" ? "dinlenme tesisi" : TUR[yakin.tur].ad.toLocaleLowerCase("tr");
      bildir(seslen(`${km(r.cumD[yakin.idx] - r.cumD[idx])} sonra ${ne} var: ${yakin.ad}`),
        `${NAMAZ_AD[icinde.ad]} vakti, ${saat(icinde.bitis)}'e kadar. Kılmadıysan orada kılabilirsin.`, yakin, vk);
    }
  }
}

// ---------- Yer ekleme ----------
function ekleNoktasiniAyarla(p, kaynak) {
  durum.ekleNokta = p;
  $("ekleKonum").textContent = p
    ? `${kaynak} (${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`
    : "Bulunduğunuz konum kullanılacak.";
}
async function osmNotuGonder(y) {
  const tur = TUR[y.tur].ad.toLocaleLowerCase("tr");
  const etiket = y.tur === "tesis" ? "highway=services" : "amenity=place_of_worship + religion=muslim";
  const text = `Burada bir ${tur} var${y.ad ? ": " + y.ad : ""}.${y.not ? " Not: " + y.not : ""}\n` +
    `Yerinde görülerek bildirildi (Yolcu Namaz uygulaması). Önerilen etiket: ${etiket}`;
  const r = await fetch("https://api.openstreetmap.org/api/0.6/notes.json", {
    method: "POST", body: new URLSearchParams({ lat: y.lat.toFixed(6), lon: y.lng.toFixed(6), text }),
  });
  if (!r.ok) throw new Error("OpenStreetMap yanıtı: " + r.status);
  const j = await r.json();
  return j?.properties?.id;
}
async function yerKaydet(ev) {
  ev.preventDefault();
  const p = durum.ekleNokta || durum.konum;
  if (!p) { mesaj("Konum bulunamadı. Haritada yere dokunup “Burada cami/mescit var” seçeneğini kullanabilirsiniz."); return; }
  const y = {
    id: "b" + Date.now(), lat: p.lat, lng: p.lng,
    tur: document.querySelector('input[name="tur"]:checked').value,
    ad: $("ekleAd").value.trim(), not: $("ekleNot").value.trim(), tarih: new Date().toISOString(), osmNot: null,
  };
  const liste = benimYerler(); liste.push(y); LS.set("yn_yerler", liste);
  let ek = "";
  if ($("ekleOsm").checked) {
    try { y.osmNot = await osmNotuGonder(y); LS.set("yn_yerler", benimYerler().map((x) => (x.id === y.id ? y : x))); ek = " OpenStreetMap'e de bildirildi, gönüllüler haritaya işleyecek."; }
    catch (e) { ek = " (OpenStreetMap'e gönderilemedi: " + e.message + ". İnternet gelince “Eklediklerim” listesinden tekrar gönderebilirsiniz.)"; }
  }
  $("ekleForm").reset();
  ekleNoktasiniAyarla(null);
  mesaj(`Eline sağlık${hitap() ? " " + hitap().toLocaleLowerCase("tr") : ""}! Kaydedildi: ${y.ad || TUR[y.tur].ad}.${ek}`);
  benimListeCiz();
  poileriRotaylaEslestir();
  if (durum.rota) namazPlaniCiz();
}
function benimListeCiz() {
  const liste = benimYerler();
  $("benimListe").innerHTML = liste.length ? liste.slice().reverse().map((y) => `<div class="yer">
    <div class="rozet r-benim"></div>
    <div class="bilgi"><div class="ad">${esc(y.ad || TUR[y.tur].ad)}</div>
    <div class="ipucu">${new Date(y.tarih).toLocaleDateString("tr-TR")}${y.not ? " · " + esc(y.not) : ""} ·
    ${y.osmNot ? `<a target="_blank" rel="noopener" href="https://www.openstreetmap.org/note/${encodeURIComponent(y.osmNot)}">OSM'ye bildirildi</a>` : `<a href="#" data-osm="${esc(y.id)}">OSM'ye gönder</a>`}</div></div>
    <button class="btn" data-goster="${esc(y.id)}">Harita</button>
    <button class="btn" data-sil="${esc(y.id)}" aria-label="Sil">🗑</button></div>`).join("")
    : `<p class="ipucu">Henüz bir yer eklemediniz.</p>`;
}
function disaAktar() {
  const veri = JSON.stringify({ uygulama: "yolcu-namaz", surum: 1, yerler: benimYerler() }, null, 2);
  const dosya = new File([veri], "yolcu-namaz-yerlerim.json", { type: "application/json" });
  if (navigator.canShare?.({ files: [dosya] })) { navigator.share({ files: [dosya], title: "Eklediğim camiler ve mescitler" }).catch(() => {}); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(dosya); a.download = dosya.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function iceAktar(ev) {
  const f = ev.target.files?.[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    const gelen = (j.yerler || []).filter((y) => typeof y.lat === "number" && typeof y.lng === "number" && TUR[y.tur]);
    const mevcut = benimYerler(); const idler = new Set(mevcut.map((y) => y.id));
    const yeni = gelen.filter((y) => !idler.has(y.id));
    LS.set("yn_yerler", [...mevcut, ...yeni]);
    mesaj(`${yeni.length} yer içe aktarıldı.`);
    benimListeCiz(); poileriRotaylaEslestir();
  } catch { mesaj("Dosya okunamadı."); }
  ev.target.value = "";
}

// ---------- Arayüz ----------
function sekmeAc(ad) {
  document.querySelectorAll("#sekmeler button").forEach((b) => b.classList.toggle("aktif", b.dataset.sekme === ad));
  document.querySelectorAll(".sekme").forEach((s) => { s.hidden = s.id !== "s-" + ad; });
  if (durum.nav) document.body.classList.add("panelAcik");
  $("panel").scrollTop = 0;
}
document.querySelectorAll("#sekmeler button").forEach((b) => b.addEventListener("click", () => sekmeAc(b.dataset.sekme)));

async function aramaYap(alan) {
  const q = $(alan).value.trim();
  const kutu = $(alan + "Sonuc");
  if (!q) { if (alan === "nereden") { durum.baslangic = null; isaretleriCiz(); } return; }
  kutu.innerHTML = `<p class="ipucu">Aranıyor…</p>`;
  try {
    const sonuc = await yerAra(q);
    if (!sonuc.length) { kutu.innerHTML = `<p class="ipucu">Bulunamadı. Başka şekilde yazmayı deneyin (örn. “Konya Selçuklu”).</p>`; return; }
    kutu.innerHTML = sonuc.map((s, i) => `<button data-i="${i}">${esc(s.display_name)}</button>`).join("");
    kutu.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const s = sonuc[+b.dataset.i];
      const p = { lat: +s.lat, lng: +s.lon, ad: s.display_name.split(",").slice(0, 2).join(",") };
      $(alan).value = p.ad;
      kutu.innerHTML = "";
      if (alan === "nereden") durum.baslangic = p; else durum.hedef = p;
      isaretleriCiz();
      harita.setView([p.lat, p.lng], 11);
    }));
  } catch (e) { kutu.innerHTML = `<p class="ipucu">⚠ ${esc(e.message)}</p>`; }
}
$("btnNeredenAra").addEventListener("click", () => aramaYap("nereden"));
$("btnNereyeAra").addEventListener("click", () => aramaYap("nereye"));
$("nereden").addEventListener("keydown", (e) => { if (e.key === "Enter") aramaYap("nereden"); });
$("nereye").addEventListener("keydown", (e) => { if (e.key === "Enter") aramaYap("nereye"); });
$("nereden").addEventListener("input", () => { if (!$("nereden").value.trim()) { durum.baslangic = null; isaretleriCiz(); } });

$("btnRota").addEventListener("click", async () => {
  if (!durum.hedef && $("nereye").value.trim()) { await aramaYap("nereye"); return; }
  durum.ara = null;
  await rotaHesapla();
});
$("btnBasla").addEventListener("click", navBaslat);
$("btnBitir").addEventListener("click", navBitir);
$("btnPanelAc").addEventListener("click", () => { sekmeAc("namaz"); document.body.classList.add("panelAcik"); });
$("btnPanelKapat").addEventListener("click", () => document.body.classList.remove("panelAcik"));
$("btnOrtala").addEventListener("click", () => {
  durum.takipte = true;
  if (durum.konum) harita.setView([durum.konum.lat, durum.konum.lng], Math.max(harita.getZoom(), durum.nav ? 16 : 14));
});
$("btnEkleFab").addEventListener("click", () => {
  ekleNoktasiniAyarla(durum.konum ? { lat: durum.konum.lat, lng: durum.konum.lng } : null, "Bulunduğunuz konum");
  sekmeAc("ekle");
  if (durum.nav) document.body.classList.add("panelAcik");
});
$("btnYakin").addEventListener("click", () => yakindakileriGetir(false));
$("btnEklediklerim").addEventListener("click", () => sekmeAc("ekle"));
$("vakitSonraki").addEventListener("click", () => {
  const acik = $("vakitSatir").hidden;
  $("vakitSatir").hidden = !acik;
  $("vakitSonraki").setAttribute("aria-expanded", String(acik));
  setTimeout(() => harita.invalidateSize(), 50);
});
$("uyariKapat").addEventListener("click", () => { $("uyari").hidden = true; });
$("uyariKildim").addEventListener("click", () => {
  $("uyari").hidden = true;
  if (uyariVakit) { bildirimKaydet(uyariVakit + "|kildi"); soyle("Allah kabul etsin."); }
});
$("uyariGit").addEventListener("click", () => { $("uyari").hidden = true; if (uyariPoi) poiyeUgra(uyariPoi); });
$("ekleForm").addEventListener("submit", yerKaydet);
$("btnDisa").addEventListener("click", disaAktar);
$("iceAktar").addEventListener("change", iceAktar);
["kCami", "kTesis", "kYakit", "sapma"].forEach((id) => $(id).addEventListener("change", () => { if (durum.rota) rotaYerleriGetir(); }));

// Ayarlar
$("ayarOnce").value = ayar.once; $("ayarSes").checked = ayar.ses; $("ayarEkran").checked = ayar.ekran; $("ayarHiz").value = ayar.hiz; $("ayarKaynak").value = ayar.kaynak; $("ayarTema").value = ayar.tema; $("ayarHitap").value = ayar.hitap; $("ayarMola").value = ayar.mola;
const ayarKaydet = () => {
  ayar.once = $("ayarOnce").value; ayar.ses = $("ayarSes").checked; ayar.ekran = $("ayarEkran").checked; ayar.hiz = $("ayarHiz").value; ayar.kaynak = $("ayarKaynak").value; ayar.tema = $("ayarTema").value; ayar.hitap = $("ayarHitap").value; ayar.mola = $("ayarMola").value;
  LS.set("yn_ayar", ayar);
  kaynakDurumYaz();
  vakitBarGuncelle();
  if (durum.rota) { rotaOzetYaz(); namazPlaniCiz.siteDenendi = false; namazPlaniCiz(); }
};
["ayarOnce", "ayarSes", "ayarEkran", "ayarHiz", "ayarKaynak", "ayarHitap", "ayarMola", "ayarTema"].forEach((id) => $(id).addEventListener("change", ayarKaydet));
async function bildirimIzniIste() {
  try {
    if (NATIVE && EKLENTI.LocalNotifications) return (await EKLENTI.LocalNotifications.requestPermissions()).display === "granted";
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    return "Notification" in window && Notification.permission === "granted";
  } catch { return false; }
}
$("btnBildirimIzin").addEventListener("click", async () => {
  if (NATIVE) {
    if (await bildirimIzniIste()) bildir("Deneme bildirimi", "Namaz vakti yaklaşınca böyle haber vereceğim.");
    else mesaj("Bildirim izni verilmedi. Telefon Ayarlar > Uygulamalar > Yolcu Namaz > Bildirimler'den açabilirsiniz.");
    return;
  }
  if (!("Notification" in window)) { mesaj("Bu tarayıcı bildirim desteklemiyor; uyarılar ekranda ve sesli gösterilecek."); return; }
  const izin = await Notification.requestPermission();
  if (izin === "granted") bildir("Deneme bildirimi", "Namaz vakti yaklaşınca böyle haber vereceğim.");
  else mesaj("Bildirim izni verilmedi. Uyarılar yine de uygulama açıkken ekranda ve sesli gösterilir.");
});

// Liste ve açılır pencerelerdeki düğmeler
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-goster],[data-ugra],[data-sil],[data-osm],[data-harita]");
  if (!t) return;
  if (t.dataset.goster) {
    const p = poiBul(t.dataset.goster); if (!p) return;
    durum.takipte = false;
    harita.setView([p.lat, p.lng], 16);
    L.popup(popupAyar()).setLatLng([p.lat, p.lng]).setContent(poiPopup(p)).openOn(harita);
    if (durum.nav) document.body.classList.remove("panelAcik");
  } else if (t.dataset.ugra) {
    const p = poiBul(t.dataset.ugra); if (p) poiyeUgra(p);
  } else if (t.dataset.sil) {
    if (!confirm("Bu yeri listenizden silmek istiyor musunuz?")) return;
    LS.set("yn_yerler", benimYerler().filter((y) => y.id !== t.dataset.sil));
    benimListeCiz(); poileriRotaylaEslestir();
  } else if (t.dataset.osm) {
    e.preventDefault();
    const y = benimYerler().find((x) => x.id === t.dataset.osm); if (!y) return;
    osmNotuGonder(y).then((id) => {
      y.osmNot = id; LS.set("yn_yerler", benimYerler().map((x) => (x.id === y.id ? y : x)));
      benimListeCiz(); mesaj("OpenStreetMap'e bildirildi.");
    }).catch((err) => mesaj("Gönderilemedi: " + err.message));
  } else if (t.dataset.harita) {
    const [lat, lng] = t.dataset.koord.split(",").map(Number);
    harita.closePopup();
    const p = { lat, lng, ad: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    if (t.dataset.harita === "git") { durum.hedef = p; $("nereye").value = "Haritadan seçilen yer"; durum.ara = null; isaretleriCiz(); if (!durum.nav) sekmeAc("rota"); rotaHesapla({ sessiz: durum.nav }); }
    else if (t.dataset.harita === "bas") { durum.baslangic = p; $("nereden").value = "Haritadan seçilen yer"; isaretleriCiz(); sekmeAc("rota"); }
    else if (t.dataset.harita === "ekle") { ekleNoktasiniAyarla(p, "Haritada seçtiğin yer"); sekmeAc("ekle"); }
  }
});
const popupAyar = () => ({ autoPanPaddingTopLeft: L.point(10, durum.nav ? 190 : 20), autoPanPaddingBottomRight: L.point(80, 30), maxWidth: 260 });
harita.on("click", (e) => {
  const k = `${e.latlng.lat},${e.latlng.lng}`;
  L.popup(popupAyar()).setLatLng(e.latlng).setContent(
    `<button class="btn btn-ana" data-harita="git" data-koord="${k}">🏁 Buraya git</button>` +
    (durum.nav ? "" : `<button class="btn" data-harita="bas" data-koord="${k}">🟢 Buradan başla</button>`) +
    `<button class="btn" data-harita="ekle" data-koord="${k}">＋ Burada cami/mescit var</button>`).openOn(harita);
});

// Başlangıç
(function baslat() {
  const simdi = new Date(); simdi.setSeconds(0, 0);
  $("cikis").value = new Date(simdi.getTime() - simdi.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  vakitBarGuncelle();
  benimListeCiz();
  poileriCiz();
  konumBaslat();
  setInterval(() => { vakitBarGuncelle(); vakitKontrol(); molaKontrol(); if (durum.nav) navGuncelle(); }, 30000);
  kaynakDurumYaz();
  if (!NATIVE && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  if ("speechSynthesis" in window) speechSynthesis.getVoices();
})();
