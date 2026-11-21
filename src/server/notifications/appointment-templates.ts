import { formatTL } from "@/lib/money";
import { formatDateTime } from "@/lib/time";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render(title: string, lines: string[]) {
  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#fafaf9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#292524">
<div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:28px">
<h1 style="font-size:18px;margin:0 0 18px">${esc(title)}</h1>${lines.map((l) => `<p style="margin:0 0 12px;line-height:1.6">${esc(l)}</p>`).join("")}</div>
<p style="font-size:12px;color:#a8a29e;text-align:center;margin-top:16px">Dijital Berber</p></div></body></html>`;
  return { subject: title, text: lines.join("\n\n"), html };
}

export type ApptCtx = {
  businessName: string;
  staffName: string;
  services: string;
  startsAt: Date;
  totalKurus: number;
  customerName: string;
  note?: string | null;
  deadline?: Date | null;
};

const summary = (c: ApptCtx) => `${formatDateTime(c.startsAt)} · ${c.services} · ${c.staffName} · ${formatTL(c.totalKurus)}`;

export const apptTemplates = {
  requestReceived: (c: ApptCtx) =>
    render("Randevu talebiniz alındı", [
      `Merhaba ${c.customerName}, ${c.businessName} için randevu talebiniz alındı.`,
      summary(c),
      `İşletme talebinizi onayladığında size haber vereceğiz${c.deadline ? ` (en geç ${formatDateTime(c.deadline)})` : ""}. Ödeme işletmede yapılır.`,
    ]),
  newRequestForBusiness: (c: ApptCtx) =>
    render(`Yeni randevu talebi: ${c.customerName}`, [
      `${c.customerName} online randevu talebinde bulundu.`,
      summary(c),
      c.deadline ? `Lütfen ${formatDateTime(c.deadline)} tarihine kadar işletme panelinizden onaylayın ya da reddedin; aksi halde talep otomatik iptal olur ve güven puanınız etkilenir.` : "Lütfen işletme panelinizden onaylayın.",
    ]),
  confirmed: (c: ApptCtx) => render("Randevunuz onaylandı", [`Merhaba ${c.customerName}, ${c.businessName} randevunuzu onayladı.`, summary(c), "Görüşmek üzere!"]),
  rejected: (c: ApptCtx) =>
    render("Randevu talebiniz onaylanmadı", [`Merhaba ${c.customerName}, ${c.businessName} randevu talebinizi onaylayamadı.`, summary(c), ...(c.note ? [`Not: ${c.note}`] : []), "Dilerseniz başka bir saat seçebilirsiniz."]),
  cancelledByBusiness: (c: ApptCtx) =>
    render("Randevunuz iptal edildi", [`Merhaba ${c.customerName}, ${c.businessName} randevunuzu iptal etti.`, summary(c), ...(c.note ? [`Not: ${c.note}`] : [])]),
  expired: (c: ApptCtx) =>
    render("Randevu talebiniz zaman aşımına uğradı", [
      `Merhaba ${c.customerName}, ${c.businessName} talebinizi süresi içinde onaylamadığı için talep iptal edildi.`,
      summary(c),
      "Dilerseniz başka bir saat ya da işletme seçebilirsiniz.",
    ]),
  rescheduled: (c: ApptCtx) => render("Randevunuz güncellendi", [`Merhaba ${c.customerName}, ${c.businessName} randevunuzun yeni bilgileri:`, summary(c)]),
  cancelledByCustomerForBusiness: (c: ApptCtx) => render(`Randevu iptal edildi: ${c.customerName}`, [`${c.customerName} randevusunu iptal etti; saat yeniden müsait.`, summary(c)]),
  rescheduledByCustomerForBusiness: (c: ApptCtx) =>
    render(`Randevu değişikliği talebi: ${c.customerName}`, [`${c.customerName} randevusunu değiştirdi. Yeni talep onayınızı bekliyor.`, summary(c)]),
  reminder: (c: ApptCtx) => render("Yarınki randevunuzu hatırlatırız", [`Merhaba ${c.customerName}, yarın ${c.businessName} randevunuz var.`, summary(c)]),
};
