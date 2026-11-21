import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/server/db/client";
import { businessDocuments, businessSubscriptions, documentTypes, notifications, subscriptionPayments } from "@/server/db/schema";
import { AppError } from "@/server/lib/errors";
import type { Biz } from "@/server/modules/business/context";
import { setSetting } from "@/server/modules/platform/settings";
import { enableBilling, recordPayment } from "@/server/modules/billing/subscriptions";
import { getInvoiceFile, listPendingInvoices, uploadInvoice } from "@/server/modules/billing/invoices";
import { handleGatewayEvent, setPaymentGatewayForTests, type PaymentGateway } from "@/server/modules/billing/gateway";
import { getMyBilling, setBillingCycle, setPaymentMethod, startCardSetup } from "@/server/modules/business/billing";
import { getDocumentFile, getMyDocuments, uploadDocument } from "@/server/modules/business/documents";
import { reviewDocument } from "@/server/modules/admin/documents";
import { createContract, publishVersion, versionAcceptance } from "@/server/modules/admin/contracts";
import { acceptContract, pendingContractVersions } from "@/server/modules/business/contracts";
import { listInbox, markRead, unreadCount } from "@/server/modules/business/inbox";
import { getPublishChecklist } from "@/server/modules/business/publish";
import { todayTR } from "@/lib/dates";
import { makeAdmin, makeBusiness, uid } from "../helpers/factory";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
let adminId = "";
const bizOf = (b: { businessId: string; userId: string }): Biz => ({ businessId: b.businessId, userId: b.userId });
async function code(p: Promise<unknown>) {
  return p.then(() => "OK", (e) => (e instanceof AppError ? e.code : String(e)));
}

beforeAll(async () => {
  adminId = (await makeAdmin()).id;
  await setSetting(db, "platform.contact", { email: "destek@test.local", phone: "", alertEmail: "ops@test.local" });
  await enableBilling(db, { adminId });
});
afterEach(() => setPaymentGatewayForTests(undefined));

describe("faturalar", () => {
  it("otomatik kart ödemesinde yöneticiye e-posta; admin PDF yükler; yalnızca ilgili işletme indirir", async () => {
    const a = await makeBusiness(adminId);
    const other = await makeBusiness(adminId);
    await handleGatewayEvent(db, "tp", { type: "SUBSCRIPTION_ACTIVATED", businessId: a.businessId, customerRef: "c", subscriptionRef: `s_${a.businessId}` });
    await handleGatewayEvent(db, "tp", { type: "CHARGE_SUCCEEDED", subscriptionRef: `s_${a.businessId}`, chargeRef: `ch_${a.businessId}`, amountKurus: 90000, months: 1, paidAt: new Date() });
    const [pay] = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.businessId, a.businessId));
    const mails = await db.select().from(notifications).where(and(eq(notifications.businessId, a.businessId), like(notifications.template, "billing.payment_received%")));
    expect(mails.map((m) => m.to)).toEqual(["ops@test.local"]);
    expect((await listPendingInvoices(db)).some((r) => r.p.id === pay!.id)).toBe(true);


    await uploadInvoice(db, { adminId }, pay!.id, { buffer: PDF, fileName: "fatura-ocak.pdf" });
    const f = await getInvoiceFile(db, pay!.id, { businessId: a.businessId });
    expect(f.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(f.fileName).toBe("fatura-ocak.pdf");
    expect(await code(getInvoiceFile(db, pay!.id, { businessId: other.businessId }))).toBe("NOT_FOUND");
    expect((await listPendingInvoices(db)).some((r) => r.p.id === pay!.id)).toBe(false);
    // İşletmenin bildirim kutusuna düşer; depolama anahtarı istemciye gitmez
    expect((await listInbox(db, a.businessId)).some((n) => n.kind === "INVOICE")).toBe(true);
    const mine = await getMyBilling(db, a.businessId);
    expect(mine.payments[0]).toMatchObject({ hasInvoice: true });
    expect(JSON.stringify(mine.payments)).not.toContain("invoices/");
  });

  it("admin'in elle kaydettiği ödeme için e-posta gönderilmez ama fatura bekleyenlere düşer", async () => {
    const a = await makeBusiness(adminId);
    const p = await recordPayment(db, { adminId }, a.businessId, { months: 1, amount: "900", method: "BANK_TRANSFER", paidOn: todayTR() });
    const mails = await db.select().from(notifications).where(and(eq(notifications.businessId, a.businessId), like(notifications.template, "billing.payment_received%")));
    expect(mails).toHaveLength(0);
    expect((await listPendingInvoices(db)).some((r) => r.p.id === p.id)).toBe(true);
  });
});

describe("ödeme yöntemi ve kart", () => {
  it("sağlayıcı bağlı değilken kart tanımlama açık bir hatayla reddedilir", async () => {
    const a = await makeBusiness(adminId);
    setPaymentGatewayForTests(null);
    expect(await code(startCardSetup(db, bizOf(a), "/geri"))).toBe("VALIDATION");
    expect((await getMyBilling(db, a.businessId)).cardPaymentsAvailable).toBe(false);
  });

  it("kart tanımlama sağlayıcı sayfasına yönlendirir; havaleye geçince otomatik çekim iptal edilir", async () => {
    const a = await makeBusiness(adminId);
    const calls: string[] = [];
    const gw: PaymentGateway = {
      name: "tp",
      startCardSetup: async (i) => (calls.push(`setup:${i.businessId}:${i.billingCycle}:${i.feeKurus}`), { redirectUrl: "https://odeme.example/kart" }),
      cancelSubscription: async (ref) => void calls.push(`cancel:${ref}`),
      updateSubscription: async (ref, i) => void calls.push(`update:${ref}:${i.billingCycle}:${i.feeKurus}`),
      parseWebhook: async () => {
        throw new Error("yok");
      },
    };
    setPaymentGatewayForTests(gw);
    expect(await startCardSetup(db, bizOf(a), "/geri")).toBe("https://odeme.example/kart");
    expect(calls).toContain(`setup:${a.businessId}:MONTHLY:69990`);
    await handleGatewayEvent(db, "tp", { type: "SUBSCRIPTION_ACTIVATED", businessId: a.businessId, customerRef: "c", subscriptionRef: `s2_${a.businessId}`, cardLast4: "1111" });
    // Yıllığa geçiş sağlayıcıdaki aboneliği günceller
    await setBillingCycle(db, bizOf(a), "YEARLY");
    expect(calls).toContain(`update:s2_${a.businessId}:YEARLY:699000`);
    await setPaymentMethod(db, bizOf(a), "BANK_TRANSFER");
    expect(calls).toContain(`cancel:s2_${a.businessId}`);
    const [sub] = await db.select().from(businessSubscriptions).where(eq(businessSubscriptions.businessId, a.businessId));
    expect(sub).toMatchObject({ preferredMethod: "BANK_TRANSFER", autoRenew: false });
  });
});

describe("belgeler", () => {
  it("yükleme → inceleme → ret/onay; bildirim; yayın kontrol listesi; izolasyon", async () => {
    const a = await makeBusiness(adminId);
    const b = await makeBusiness(adminId);
    const required = await db.select().from(documentTypes).where(eq(documentTypes.isRequired, true));
    expect(required.length).toBeGreaterThanOrEqual(2);
    const check = async () => (await getPublishChecklist(db, a.businessId)).find((c) => c.key === "documents")!.ok;
    expect(await check()).toBe(false);

    expect(await code(uploadDocument(db, bizOf(a), required[0]!.id, { buffer: Buffer.from("<html>"), fileName: "x.html" }))).toBe("VALIDATION");
    const img = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#ddd" } }).jpeg().withMetadata().toBuffer();
    const d1 = await uploadDocument(db, bizOf(a), required[0]!.id, { buffer: img, fileName: "levha.jpg" });
    const d2 = await uploadDocument(db, bizOf(a), required[1]!.id, { buffer: PDF, fileName: "ruhsat.pdf" });
    expect(d1.status).toBe("PENDING");
    // Yöneticiye e-posta
    expect((await db.select().from(notifications).where(eq(notifications.template, "document.uploaded.admin"))).some((n) => n.businessId === a.businessId)).toBe(true);

    await reviewDocument(db, { adminId }, d1.id, { decision: "REJECTED", note: "Okunmuyor" });
    expect((await getMyDocuments(db, a.businessId)).find((x) => x.type.id === required[0]!.id)!.doc).toMatchObject({ status: "REJECTED", reviewNote: "Okunmuyor" });
    expect((await listInbox(db, a.businessId)).some((n) => n.kind === "DOCUMENT" && n.title.includes("reddedildi"))).toBe(true);

    // Yeniden yükleme tekrar incelemeye düşer
    const d1b = await uploadDocument(db, bizOf(a), required[0]!.id, { buffer: img, fileName: "levha2.jpg" });
    expect(d1b.id).toBe(d1.id);
    expect(d1b.status).toBe("PENDING");
    for (const r of required) {
      const doc = (await db.select().from(businessDocuments).where(and(eq(businessDocuments.businessId, a.businessId), eq(businessDocuments.typeId, r.id))))[0];
      if (doc) await reviewDocument(db, { adminId }, doc.id, { decision: "APPROVED", note: undefined });
    }
    expect(await check()).toBe(required.length === 2);

    // Başka işletme belgeyi indiremez
    expect(await code(getDocumentFile(db, d2.id, { businessId: b.businessId }))).toBe("NOT_FOUND");
    const f = await getDocumentFile(db, d2.id, { businessId: a.businessId });
    expect(f.mime).toBe("application/pdf");
    // Görseller yeniden kodlanır (EXIF yok)
    const imgFile = await getDocumentFile(db, d1.id, { businessId: a.businessId });
    expect((await sharp(imgFile.buffer).metadata()).exif).toBeUndefined();
  });
});

describe("sözleşmeler ve bildirim kutusu", () => {
  it("yayın → bildirim + e-posta → onay; yeni sürüm yeniden onay ister; eski sürüm onaylanamaz", async () => {
    const a = await makeBusiness(adminId);
    const c = await createContract(db, { adminId }, { title: `Hizmet Sözleşmesi ${uid()}`, code: `hizmet-${uid()}` });
    const text = "Madde 1 — Taraflar. ".repeat(5);
    const v1 = await publishVersion(db, { adminId }, c!.id, { content: text, changeNote: undefined });
    expect(v1.version).toBe(1);
    expect((await pendingContractVersions(db, a.businessId)).some((p) => p.id === v1.id)).toBe(true);
    const inbox = await listInbox(db, a.businessId);
    expect(inbox.some((n) => n.kind === "CONTRACT")).toBe(true);
    expect(await unreadCount(db, a.businessId)).toBeGreaterThan(0);
    expect((await db.select().from(notifications).where(eq(notifications.dedupeKey, `contract:published:${v1.id}:${a.businessId}`)))).toHaveLength(1);
    expect((await getPublishChecklist(db, a.businessId)).find((x) => x.key === "contracts")!.ok).toBe(false);

    await acceptContract(db, bizOf(a), v1.id, { ip: "1.2.3.4", userAgent: "vitest" });
    await acceptContract(db, bizOf(a), v1.id, { ip: "1.2.3.4", userAgent: "vitest" }); // tekrar etkisiz
    expect((await pendingContractVersions(db, a.businessId)).some((p) => p.contract_id === c!.id)).toBe(false);
    const acc = (await versionAcceptance(db, v1.id)).find((r) => r.id === a.businessId)!;
    expect(acc.ip).toBe("1.2.3.4");

    const v2 = await publishVersion(db, { adminId }, c!.id, { content: text + " Ek madde.", changeNote: "İptal koşulları" });
    expect(v2.version).toBe(2);
    expect((await pendingContractVersions(db, a.businessId)).some((p) => p.id === v2.id)).toBe(true);
    expect(await code(acceptContract(db, bizOf(a), v1.id, {}))).toBe("CONFLICT");

    await markRead(db, a.businessId);
    expect(await unreadCount(db, a.businessId)).toBe(0);
  });

  it("işletme başka işletmenin bildirimini okundu yapamaz", async () => {
    const a = await makeBusiness(adminId);
    const b = await makeBusiness(adminId);
    const c = await createContract(db, { adminId }, { title: `KVKK ${uid()}`, code: `kvkk-${uid()}` });
    await publishVersion(db, { adminId }, c!.id, { content: "Aydınlatma metni. ".repeat(5), changeNote: undefined });
    const bItem = (await listInbox(db, b.businessId))[0]!;
    await markRead(db, a.businessId, bItem.id);
    expect((await listInbox(db, b.businessId)).find((n) => n.id === bItem.id)!.readAt).toBeNull();
  });
});
