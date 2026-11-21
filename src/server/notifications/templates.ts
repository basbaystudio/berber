import { formatTL } from "@/lib/money";
import { formatDateStr } from "@/lib/dates";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Sade, her e-posta istemcisinde düzgün görünen tek sütunlu şablon. */
function layout(title: string, paragraphs: string[]) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6">${esc(p)}</p>`).join("");
  return `<!doctype html><html lang="tr"><body style="margin:0;background:#fafaf9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#292524">
<div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:28px">
<h1 style="font-size:18px;margin:0 0 18px">${esc(title)}</h1>${body}</div>
<p style="font-size:12px;color:#a8a29e;text-align:center;margin-top:16px">Dijital Berber</p></div></body></html>`;
}

type Ctx = { businessName: string; coveredUntil: string; feeKurus: number; feeUnit?: string; graceDays: number; contactLine: string };

export function pastDueForBusiness(c: Ctx) {
  const lines = [
    `Merhaba, ${c.businessName} işletmesinin abonelik ödemesi ${formatDateStr(c.coveredUntil)} itibarıyla gecikti.`,
    `${c.feeUnit === "yıl" ? "Yıllık" : "Aylık"} ücret: ${formatTL(c.feeKurus)}. Ödeme ${c.graceDays} gün içinde yapılmazsa işletmeniz otomatik olarak askıya alınacak ve profiliniz yayından kalkacaktır.`,
    c.contactLine,
  ];
  return { subject: "Abonelik ödemeniz gecikti", text: lines.join("\n\n"), html: layout("Abonelik ödemeniz gecikti", lines) };
}

export function pastDueForAdmin(c: Ctx) {
  const lines = [
    `${c.businessName} işletmesinin abonelik ödemesi gecikti (son ödenen gün: ${formatDateStr(c.coveredUntil)}).`,
    `${c.feeUnit === "yıl" ? "Yıllık" : "Aylık"} ücret: ${formatTL(c.feeKurus)}. Ödeme kaydedilmezse ${c.graceDays}. günde otomatik askıya alınacak.`,
  ];
  return { subject: `Ödeme gecikti: ${c.businessName}`, text: lines.join("\n\n"), html: layout("Abonelik ödemesi gecikti", lines) };
}

export function suspendedForBusiness(c: Ctx) {
  const lines = [
    `${c.businessName} işletmesi, abonelik ödemesi ${c.graceDays} gündür yapılmadığı için askıya alındı ve profiliniz yayından kaldırıldı.`,
    "Ödemeniz kaydedildiğinde hesabınız otomatik olarak yeniden açılır.",
    c.contactLine,
  ];
  return { subject: "İşletmeniz askıya alındı", text: lines.join("\n\n"), html: layout("İşletmeniz askıya alındı", lines) };
}

export function suspendedForAdmin(c: Ctx) {
  const lines = [`${c.businessName} işletmesi ödeme gecikmesi (${c.graceDays} gün) nedeniyle otomatik olarak askıya alındı.`, "Ödemeyi kaydettiğinizde işletme otomatik olarak yeniden açılır."];
  return { subject: `Askıya alındı: ${c.businessName}`, text: lines.join("\n\n"), html: layout("İşletme askıya alındı", lines) };
}
