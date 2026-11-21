import { currentFee } from "@/server/modules/billing/status";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { z } from "zod";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getBusinessDetail, getPublishChecklist } from "@/server/modules/admin/businesses";
import { getLocations } from "@/server/modules/reference/locations";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { formatDateTime } from "@/lib/time";
import { formatTrPhone } from "@/lib/phone";
import { StatusBadge } from "../status-badge";
import { EditBusinessForm } from "../business-form";
import { OwnerPanel } from "./owner-panel";
import { ImageUploadForm } from "@/components/panel/image-upload-form";
import { getTrust } from "@/server/modules/trust/score";
import { TrustCard } from "@/components/panel/trust-card";
import { listDocuments } from "@/server/modules/admin/documents";
import { ReviewForm } from "../../belgeler/forms";
import { reviewDocumentAction } from "../../belgeler/actions";
import { getBusinessSubscription, listBusinessPayments, listPlans } from "@/server/modules/billing/subscriptions";
import { InvoiceUploadForm, PaymentForm, SubscriptionForm } from "../../abonelikler/forms";
import { SubscriptionBadge } from "../../abonelikler/status-badge";
import { recordPaymentAction, updateSubscriptionAction, uploadInvoiceAction } from "../../abonelikler/actions";
import { formatTL } from "@/lib/money";
import { formatDateStr, todayTR } from "@/lib/dates";
import {
  removeBusinessImageAction,
  resetPasswordAction,
  uploadBusinessImageAction,
  setFeaturedAction,
  setPublishedAction,
  adminUploadShopPhotoAction,
  adminDeleteShopPhotoAction,
  adminSetShopPhotoKindAction,
  adminMoveShopPhotoAction,
  setStatusAction,
  updateBusinessAction,
  updateOwnerAction,
} from "../actions";

import { MAX_SHOP_PHOTOS } from "@/server/db/schema";
import { listShopPhotos } from "@/server/modules/shop-photos";
import { ShopPhotosManager } from "@/components/panel/shop-photos-manager";

export const metadata = { title: "İşletme Detayı" };

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const b = await getBusinessDetail(db, id);
  if (!b) notFound();
  const [checklist, locations] = await Promise.all([getPublishChecklist(db, id), getLocations()]);
  const subscription = await getBusinessSubscription(db, id);
  const [plans, payments] = [await listPlans(db), await listBusinessPayments(db, id)];
  const docs = await listDocuments(db, { businessId: id });
  const trust = await getTrust(db, id);
  const shopPhotos = await listShopPhotos(db, id);
  const METHOD = { BANK_TRANSFER: "Havale/EFT", CARD: "Kart", CASH: "Nakit", OTHER: "Diğer" } as const;
  const canPublish = checklist.every((c) => c.ok || !c.required);

  return (
    <>
      <Link href="/admin/isletmeler" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="size-4" aria-hidden /> İşletmeler
      </Link>
      <PageHeader
        title={b.name}
        description={
          <>
            {b.districtName}, {b.provinceName} · {formatTrPhone(b.phone)} · Profil adresi: /berber/{b.slug}
          </>
        }
        actions={<StatusBadge status={b.status} published={b.isPublished} reason={b.suspendedReason} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="İşletme bilgileri" />
            <EditBusinessForm
              action={updateBusinessAction.bind(null, b.id)}
              locations={locations}
              defaults={{
                name: b.name,
                slug: b.slug,
                phone: b.phone,
                email: b.email,
                description: b.description,
                addressLine: b.addressLine,
                provinceId: b.provinceId,
                districtId: b.districtId,
                latitude: b.latitude,
                longitude: b.longitude,
              }}
            />
          </Card>
          <Card>
            <CardHeader title="Belgeler" description="İşletmenin yüklediği yasal belgeler" />
            {docs.length === 0 ? (
              <p className="px-6 py-5 text-sm text-stone-500">Henüz belge yüklenmedi.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {docs.map(({ d, typeName }) => (
                  <li key={d.id} className="grid gap-3 px-6 py-4 text-sm sm:grid-cols-[1fr_minmax(0,20rem)]">
                    <div>
                      <p className="font-medium text-stone-900">{typeName}</p>
                      <a href={`/admin/dosya/belge/${d.id}`} target="_blank" rel="noopener" className="text-stone-700 underline underline-offset-4">
                        {d.fileName}
                      </a>
                      <p className="text-xs text-stone-500">
                        {d.status === "APPROVED" ? "Onaylandı" : d.status === "REJECTED" ? `Reddedildi: ${d.reviewNote ?? ""}` : "İnceleme bekliyor"} · {formatDateTime(d.uploadedAt)}
                      </p>
                    </div>
                    {d.status === "PENDING" && <ReviewForm action={reviewDocumentAction.bind(null, d.id)} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHeader title="Görseller" description="Logo ve kapak görselini yalnızca platform yönetimi değiştirir." />
            <div className="grid gap-6 p-6 sm:grid-cols-[12rem_1fr]">
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-700">Logo</p>
                <ImageUploadForm action={uploadBusinessImageAction.bind(null, b.id, "logo")} currentUrl={b.logoUrl} aspect="aspect-square" label="Logo seç" />
                {b.logoUrl && (
                  <ActionButton action={removeBusinessImageAction.bind(null, b.id, "logo")} variant="ghost" confirm="Logo kaldırılsın mı?">
                    Logoyu kaldır
                  </ActionButton>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-700">Kapak görseli</p>
                <ImageUploadForm action={uploadBusinessImageAction.bind(null, b.id, "cover")} currentUrl={b.coverUrl} aspect="aspect-[20/9]" label="Kapak görseli seç" />
                {b.coverUrl && (
                  <ActionButton action={removeBusinessImageAction.bind(null, b.id, "cover")} variant="ghost" confirm="Kapak görseli kaldırılsın mı?">
                    Kapak görselini kaldır
                  </ActionButton>
                )}
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Dükkan fotoğrafları"
              description="Dış cephe ve iç mekân fotoğrafları profilde ayrı bir bölümde gösterilir. İşletme de kendi panelinden ekleyip silebilir."
            />
            <div className="p-6">
              <ShopPhotosManager
                photos={shopPhotos}
                limit={MAX_SHOP_PHOTOS}
                upload={adminUploadShopPhotoAction.bind(null, b.id)}
                remove={adminDeleteShopPhotoAction.bind(null, b.id)}
                setKind={adminSetShopPhotoKindAction.bind(null, b.id)}
                move={adminMoveShopPhotoAction.bind(null, b.id)}
              />
            </div>
          </Card>
          <Card>
            <CardHeader
              title="İşletme hesabı"
              description={
                b.owner
                  ? `Son giriş: ${b.owner.lastLoginAt ? formatDateTime(b.owner.lastLoginAt) : "hiç giriş yapmadı"}${b.owner.mustChangePassword ? " · İlk girişte şifre değiştirmesi bekleniyor" : ""}`
                  : undefined
              }
            />
            {b.owner ? (
              <OwnerPanel
                owner={b.owner}
                slug={b.slug}
                updateAction={updateOwnerAction.bind(null, b.id)}
                resetAction={resetPasswordAction.bind(null, b.id)}
              />
            ) : (
              <div className="p-5">
                <Alert tone="warning">Bu işletmeye bağlı hesap bulunamadı.</Alert>
              </div>
            )}
          </Card>
          {subscription && (
            <Card>
              <CardHeader title="Abonelik ayarları" description="Paket, özel ücret ve ücretsiz deneme süresi" />
              <div className="p-6">
                <SubscriptionForm
                  action={updateSubscriptionAction.bind(null, b.id)}
                  plans={plans}
                  defaults={{
                    planId: subscription.sub.planId,
                    monthlyFeeKurus: subscription.sub.monthlyFeeKurus,
                    yearlyFeeKurus: subscription.sub.yearlyFeeKurus,
                    trialMonths: subscription.sub.trialMonths,
                    note: subscription.sub.note,
                  }}
                />
              </div>
            </Card>
          )}
          {subscription && (
            <Card>
              <CardHeader
                title="Ödemeler"
                description={
                  subscription.billingEnabled
                    ? "Havale veya elden alınan ödemeleri kaydedin. Kapsanan dönem otomatik hesaplanır."
                    : "Ücretlendirme kapalıyken ödeme kaydedilmez."
                }
              />
              {subscription.billingEnabled && (
                <div className="border-b border-stone-100 p-6">
                  <PaymentForm action={recordPaymentAction.bind(null, b.id)} feeKurus={currentFee(subscription.sub).kurus} months={currentFee(subscription.sub).months} today={todayTR()} />
                </div>
              )}
              {payments.length === 0 ? (
                <p className="px-6 py-5 text-sm text-stone-500">Henüz ödeme kaydı yok.</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {payments.map(({ p, planName }) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
                      <div>
                        <p className="font-medium text-stone-900">
                          {formatTL(p.amountKurus)} · {p.months} ay {planName ? `· ${planName}` : ""}
                        </p>
                        <p className="text-stone-500">
                          {formatDateStr(p.coversFrom)} – {formatDateStr(p.coversTo)} · {METHOD[p.method]}
                          {p.note ? ` · ${p.note}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-stone-500">{formatDateTime(p.paidAt)}</span>
                        {p.invoiceKey && (
                          <a href={`/admin/dosya/fatura/${p.id}`} target="_blank" rel="noopener" className="text-xs text-stone-700 underline underline-offset-4">
                            Faturayı görüntüle (PDF)
                          </a>
                        )}
                        <InvoiceUploadForm action={uploadInvoiceAction.bind(null, p.id)} hasInvoice={!!p.invoiceKey} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {subscription && (
            <Card>
              <CardHeader
                title="Abonelik"
                description={`${subscription.plan.name} · ${formatTL(currentFee(subscription.sub).kurus)} / ${currentFee(subscription.sub).unit}${subscription.sub.isEarlyAdopter ? " · Kampanyalı" : ""}`}
                actions={<SubscriptionBadge status={subscription.status} />}
              />
              <div className="space-y-1 px-6 py-4 text-sm text-stone-600">
                {subscription.billingEnabled ? (
                  <>
                    <p>Deneme: {formatDateStr(subscription.sub.trialStartsOn)} – {formatDateStr(subscription.sub.trialEndsOn)}</p>
                    <p>Ödenen son gün: {formatDateStr(subscription.sub.paidThrough)}</p>
                  </>
                ) : (
                  <p>Ücretlendirme kapalı. {subscription.sub.trialMonths} aylık deneme, ücretlendirme başladığında işlemeye başlar.</p>
                )}
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Durum" description="Askıya alınan işletme panele giremez ve yayından kalkar." />
            <div className="space-y-3 p-5">
              {b.status === "SUSPENDED" && b.suspendedReason === "BILLING" && (
                <Alert tone="warning">Ödeme gecikmesi nedeniyle otomatik askıya alındı. Ödemeyi kaydettiğinizde otomatik olarak açılır.</Alert>
              )}
              {b.status === "ACTIVE" ? (
                <ActionButton
                  action={setStatusAction.bind(null, b.id, "SUSPENDED")}
                  variant="dangerOutline"
                  confirm="İşletme askıya alınacak, yayından kaldırılacak ve oturumları kapatılacak. Emin misiniz?"
                >
                  Askıya al
                </ActionButton>
              ) : (
                <ActionButton action={setStatusAction.bind(null, b.id, "ACTIVE")} variant="primary">
                  {b.status === "DRAFT" ? "Aktifleştir" : "Askıdan çıkar"}
                </ActionButton>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Yayın" description="Yayındaki işletme pazaryerinde görünür ve randevu alabilir." />
            <div className="space-y-4 p-5">
              <ul className="space-y-2 text-sm">
                {checklist.map((c) => (
                  <li key={c.key} className="flex items-center gap-2">
                    {c.ok ? (
                      <CheckCircle2 className="size-4 text-emerald-600" aria-label="Tamam" />
                    ) : (
                      <Circle className="size-4 text-stone-300" aria-label="Eksik" />
                    )}
                    <span className={c.ok ? "text-stone-700" : "text-stone-500"}>
                      {c.label}
                      {!c.ok && !c.required && <span className="ml-1 text-xs text-amber-700">(eksik — yine de yayına alabilirsiniz)</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {!canPublish && !b.isPublished && (
                <p className="text-xs text-stone-500">Çalışan, hizmet ve çalışma saatlerini işletme kendi panelinden tanımlar.</p>
              )}
              {b.isPublished ? (
                <ActionButton action={setPublishedAction.bind(null, b.id, false)} variant="dangerOutline" confirm="İşletme pazaryerinden kaldırılacak. Emin misiniz?">
                  Yayından kaldır
                </ActionButton>
              ) : (
                <ActionButton action={setPublishedAction.bind(null, b.id, true)} variant="primary" disabled={!canPublish}>
                  Yayına al
                </ActionButton>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Öne çıkarma" description="Ana sayfadaki öne çıkan berberler bölümünde gösterilir." />
            <div className="p-5">
              {b.isFeatured ? (
                <ActionButton action={setFeaturedAction.bind(null, b.id, false)}>Öne çıkanlardan çıkar</ActionButton>
              ) : (
                <ActionButton action={setFeaturedAction.bind(null, b.id, true)}>Öne çıkar</ActionButton>
              )}
            </div>
          </Card>

          <TrustCard {...trust} forAdmin />
          <Card className="p-5 text-sm text-stone-600">
            <p>Oluşturulma: {formatDateTime(b.createdAt)}</p>
            <p>Son güncelleme: {formatDateTime(b.updatedAt)}</p>
            {b.publishedAt && <p>İlk yayın: {formatDateTime(b.publishedAt)}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
