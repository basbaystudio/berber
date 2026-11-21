/**
 * İşletme bulma aracının saf yardımcıları (ağ ve dosya erişimi yok; testlerde kullanılır).
 */

export type Isletme = {
  id: string;
  ad: string;
  adres: string;
  telefon: string | null; // ham telefon (Google'ın verdiği biçim)
  whatsappNo: string | null; // 90XXXXXXXXXX biçimi
  cep: boolean; // Türkiye cep numarası mı (5xx)
  puan: number | null;
  yorumSayisi: number | null;
  haritaLinki: string | null;
  web: string | null;
  durum: string | null; // OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY
  sorgu: string;
};

/** Google Places API (New) yanıtındaki bir yer. Yalnızca istediğimiz alanlar. */
export type GoogleYer = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  businessStatus?: string;
};

/**
 * Telefonu WhatsApp'ın beklediği uluslararası biçime çevirir (yalnızca rakamlar, ülke kodu dahil, başında + yok).
 * Türkiye numaraları için 0 / 90 / +90 öneklerini tanır. Tanınamazsa null.
 */
export function whatsappNumarasi(telefon: string | null | undefined): string | null {
  if (!telefon) return null;
  const yabanci = telefon.trim().startsWith("+") && !telefon.trim().startsWith("+90");
  let r = telefon.replace(/\D/g, "");
  if (!r) return null;
  if (yabanci) return r.length >= 8 && r.length <= 15 ? r : null;
  if (r.startsWith("0090")) r = r.slice(4);
  else if (r.startsWith("90") && r.length === 12) r = r.slice(2);
  else if (r.startsWith("0")) r = r.slice(1);
  if (r.length !== 10) return null;
  return "90" + r;
}

/** 90 5XX ... biçimindeki numara Türkiye cep telefonu mu? (Sabit hatların çoğunda WhatsApp yoktur.) */
export function cepMi(waNo: string | null): boolean {
  return !!waNo && /^905\d{9}$/.test(waNo);
}

/** Mesaj şablonundaki {isletme}, {adres}, {puan} yer tutucularını doldurur. */
export function mesajOlustur(sablon: string, i: Pick<Isletme, "ad" | "adres" | "puan">): string {
  return sablon
    .replaceAll("{isletme}", i.ad)
    .replaceAll("{adres}", i.adres)
    .replaceAll("{puan}", i.puan != null ? String(i.puan) : "")
    .trim();
}

/** Mesajı hazır yazılmış WhatsApp sohbet bağlantısı (tıklayınca WhatsApp açılır, gönder tuşuna kullanıcı basar). */
export function whatsappLinki(waNo: string, mesaj: string): string {
  return `https://wa.me/${waNo}?text=${encodeURIComponent(mesaj)}`;
}

export function yeriDonustur(y: GoogleYer, sorgu: string): Isletme {
  const telefon = y.internationalPhoneNumber ?? y.nationalPhoneNumber ?? null;
  const whatsappNo = whatsappNumarasi(telefon);
  return {
    id: y.id,
    ad: y.displayName?.text?.trim() || "(isimsiz)",
    adres: y.formattedAddress ?? "",
    telefon: y.nationalPhoneNumber ?? telefon,
    whatsappNo,
    cep: cepMi(whatsappNo),
    puan: y.rating ?? null,
    yorumSayisi: y.userRatingCount ?? null,
    haritaLinki: y.googleMapsUri ?? null,
    web: y.websiteUri ?? null,
    durum: y.businessStatus ?? null,
    sorgu,
  };
}

/**
 * Listeyi temizler: aynı yeri (Google id) ve aynı telefonu bir kez tutar,
 * kalıcı kapanmış işletmeleri ve hariç tutulan numaraları çıkarır.
 */
export function temizle(liste: Isletme[], haricNumaralar: Set<string> = new Set()): Isletme[] {
  const gorulenId = new Set<string>();
  const gorulenNo = new Set<string>();
  const sonuc: Isletme[] = [];
  for (const i of liste) {
    if (gorulenId.has(i.id)) continue;
    gorulenId.add(i.id);
    if (i.durum === "CLOSED_PERMANENTLY") continue;
    if (i.whatsappNo) {
      if (haricNumaralar.has(i.whatsappNo) || gorulenNo.has(i.whatsappNo)) continue;
      gorulenNo.add(i.whatsappNo);
    }
    sonuc.push(i);
  }
  return sonuc;
}

/** Hariç tutma dosyasının içeriğinden numara kümesi (her satırda bir numara; # ile başlayan satırlar yorum). */
export function haricListesiOku(icerik: string): Set<string> {
  const s = new Set<string>();
  for (const satir of icerik.split(/\r?\n/)) {
    const t = satir.split("#")[0]!.trim();
    const no = whatsappNumarasi(t);
    if (no) s.add(no);
  }
  return s;
}

function csvAlan(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Excel'in Türkçe ayarlarıyla düzgün açılması için ; ayraçlı ve UTF-8 BOM'lu CSV. */
export function csvOlustur(liste: Isletme[], sablon: string): string {
  const baslik = ["İşletme", "Telefon", "Cep", "Puan", "Yorum sayısı", "Adres", "Harita", "Web", "WhatsApp linki", "Sorgu"];
  const satirlar = liste.map((i) =>
    [
      i.ad,
      i.telefon,
      i.cep ? "Evet" : "Hayır",
      i.puan,
      i.yorumSayisi,
      i.adres,
      i.haritaLinki,
      i.web,
      i.whatsappNo ? whatsappLinki(i.whatsappNo, mesajOlustur(sablon, i)) : "",
      i.sorgu,
    ]
      .map(csvAlan)
      .join(";"),
  );
  return "﻿" + [baslik.join(";"), ...satirlar].join("\r\n") + "\r\n";
}

function html(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/**
 * Tek dosyalık, internet gerektirmeyen bir HTML listesi: her işletme için WhatsApp butonu
 * ve "gönderildi" işareti (işaretler tarayıcıda saklanır).
 */
export function htmlOlustur(liste: Isletme[], sablon: string, baslik: string): string {
  const kartlar = liste
    .map((i) => {
      const mesaj = mesajOlustur(sablon, i);
      const wa = i.whatsappNo
        ? `<a class="btn" href="${html(whatsappLinki(i.whatsappNo, mesaj))}" target="_blank" rel="noopener" data-id="${html(i.id)}">WhatsApp'ta aç</a>`
        : `<span class="yok">Telefon yok</span>`;
      const uyari = i.whatsappNo && !i.cep ? `<span class="etiket">Sabit hat — WhatsApp olmayabilir</span>` : "";
      const puan = i.puan != null ? `★ ${i.puan} (${i.yorumSayisi ?? 0})` : "";
      return `<li data-id="${html(i.id)}">
  <div class="ust"><strong>${html(i.ad)}</strong><span class="puan">${html(puan)}</span></div>
  <div class="adres">${html(i.adres)}</div>
  <div class="tel">${html(i.telefon ?? "")} ${uyari}</div>
  <div class="eylem">${wa}
    ${i.haritaLinki ? `<a href="${html(i.haritaLinki)}" target="_blank" rel="noopener">Harita</a>` : ""}
    <label><input type="checkbox" class="gonderildi"> Gönderildi</label></div>
</li>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${html(baslik)}</title>
<style>
:root{--bg:#f6f6f4;--kart:#fff;--yazi:#1d1d1b;--soluk:#6b6b66;--cizgi:#e3e3df;--yesil:#1f8f4e;--uyari:#a35c00}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--kart:#20201f;--yazi:#ededea;--soluk:#a3a39d;--cizgi:#34342f;--yesil:#3fbf74;--uyari:#f0a650}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--yazi);font:15px/1.45 system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:20px 16px 60px}h1{font-size:20px;margin:0 0 4px}
.ozet{color:var(--soluk);margin:0 0 16px}
details{background:var(--kart);border:1px solid var(--cizgi);border-radius:10px;padding:10px 14px;margin-bottom:16px}
pre{white-space:pre-wrap;margin:8px 0 0;font:inherit}
ul{list-style:none;padding:0;margin:0;display:grid;gap:10px}
li{background:var(--kart);border:1px solid var(--cizgi);border-radius:10px;padding:12px 14px}
li.tamam{opacity:.5}.ust{display:flex;justify-content:space-between;gap:8px}
.puan,.adres,.tel{color:var(--soluk);font-size:14px}.etiket{color:var(--uyari);font-size:13px;margin-left:6px}
.eylem{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:8px}
.btn{background:var(--yesil);color:#fff;text-decoration:none;padding:7px 12px;border-radius:8px;font-weight:600}
a{color:inherit}.yok{color:var(--soluk)}label{cursor:pointer;user-select:none}
</style></head><body><main>
<h1>${html(baslik)}</h1>
<p class="ozet">${liste.length} işletme · <span id="sayac">0</span> gönderildi. Butona basınca WhatsApp mesaj yazılmış olarak açılır; göndermek için WhatsApp'ta gönder tuşuna sen basarsın.</p>
<details><summary>Mesaj şablonu</summary><pre>${html(sablon)}</pre></details>
<ul>
${kartlar}
</ul></main>
<script>
(function(){
  var KEY="isletme-bul:gonderildi";var set={};
  try{set=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
  function kaydet(){try{localStorage.setItem(KEY,JSON.stringify(set))}catch(e){}}
  function guncelle(){var n=0;document.querySelectorAll("li[data-id]").forEach(function(li){var on=!!set[li.dataset.id];li.classList.toggle("tamam",on);li.querySelector(".gonderildi").checked=on;if(on)n++});document.getElementById("sayac").textContent=n}
  document.addEventListener("change",function(e){if(!e.target.classList.contains("gonderildi"))return;var id=e.target.closest("li").dataset.id;if(e.target.checked)set[id]=1;else delete set[id];kaydet();guncelle()});
  document.addEventListener("click",function(e){var a=e.target.closest("a.btn");if(!a)return;set[a.dataset.id]=1;kaydet();setTimeout(guncelle,300)});
  guncelle();
})();
</script></body></html>
`;
}
