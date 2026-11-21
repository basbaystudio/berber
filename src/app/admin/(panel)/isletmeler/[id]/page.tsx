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
import {
  resetPasswordAction,
  setFeaturedAction,
  setPublishedAction,
  setStatusAction,
  updateBusinessAction,
  updateOwnerAction,
} from "../actions";

export const metadata = { title: "İşletme Detayı" };

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const b = await getBusinessDetail(db, id);
  if (!b) notFound();
  const [checklist, locations] = await Promise.all([getPublishChecklist(db, id), getLocations()]);
  const canPublish = checklist.every((c) => c.ok);

  return (
    <>
      <Link href="/admin/isletmeler" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> İşletmeler
      </Link>
      <PageHeader
        title={b.name}
        description={
          <>
            {b.districtName}, {b.provinceName} · {formatTrPhone(b.phone)} · Profil adresi: /berber/{b.slug}
          </>
        }
        actions={<StatusBadge status={b.status} published={b.isPublished} />}
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Durum" description="Askıya alınan işletme panele giremez ve yayından kalkar." />
            <div className="space-y-3 p-5">
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
                      <Circle className="size-4 text-slate-300" aria-label="Eksik" />
                    )}
                    <span className={c.ok ? "text-slate-700" : "text-slate-500"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              {!canPublish && !b.isPublished && (
                <p className="text-xs text-slate-500">Çalışan, hizmet ve çalışma saatlerini işletme kendi panelinden tanımlar.</p>
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

          <Card className="p-5 text-sm text-slate-600">
            <p>Oluşturulma: {formatDateTime(b.createdAt)}</p>
            <p>Son güncelleme: {formatDateTime(b.updatedAt)}</p>
            {b.publishedAt && <p>İlk yayın: {formatDateTime(b.publishedAt)}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
