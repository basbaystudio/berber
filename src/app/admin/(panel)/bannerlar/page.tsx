import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listBanners } from "@/server/modules/admin/banners";
import { getLocations } from "@/server/modules/reference/locations";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { formatDateTime } from "@/lib/time";
import { toLocalDateTimeInput } from "@/lib/dates";
import { BannerForm } from "./banner-form";
import { createBannerAction, deleteBannerAction, updateBannerAction } from "./actions";

export const metadata = { title: "Banner ve Reklam" };

function liveState(b: { isActive: boolean; startsAt: Date | null; endsAt: Date | null }, now: Date) {
  if (!b.isActive) return <Badge>Pasif</Badge>;
  if (b.startsAt && b.startsAt > now) return <Badge tone="amber">Planlandı</Badge>;
  if (b.endsAt && b.endsAt <= now) return <Badge>Süresi doldu</Badge>;
  return <Badge tone="green">Yayında</Badge>;
}

export default async function BannersPage() {
  await requireAdminPage();
  const list = await listBanners(db);
  const provinces = (await getLocations()).map((p) => ({ id: p.id, name: p.name }));
  const now = new Date();
  return (
    <>
      <PageHeader
        title="Bannerlar ve reklamlar"
        description="Üst banner ana sayfanın en üstünde, reklam alanı ise ana sayfadaki ve aramadaki işletme listelerinin arasında gösterilir. İl seçerseniz yalnızca o ildeki ziyaretçiler görür. Sıra numarası küçük olan önce gösterilir."
      />
      <Card className="mb-6">
        <CardHeader title="Yeni banner" />
        <div className="p-6">
          <BannerForm action={createBannerAction} provinces={provinces} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Mevcut bannerlar" />
        {list.length === 0 ? (
          <EmptyState title="Henüz banner yok" description="Eklediğiniz bannerlar ana sayfada gösterilir." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map(({ b, provinceName }) => (
              <li key={b.id} className="space-y-4 px-6 py-5">
                <div className="flex flex-wrap items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.imageUrl} alt="" className="h-16 w-36 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-stone-900">{b.title}</p>
                    <p className="text-sm text-stone-500">
                      {b.placement === "LISTING" ? "Reklam alanı" : "Üst banner"} · {provinceName ?? "Tüm iller"} · {b.clickCount} tıklama · Sıra {b.sortOrder}
                      {b.startsAt && ` · ${formatDateTime(b.startsAt)}`}
                      {b.endsAt && ` → ${formatDateTime(b.endsAt)}`}
                    </p>
                  </div>
                  {liveState(b, now)}
                  <ActionButton action={deleteBannerAction.bind(null, b.id)} variant="dangerOutline" confirm="Banner kalıcı olarak silinecek. Emin misiniz?">
                    Sil
                  </ActionButton>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm text-stone-500 hover:text-stone-900">Düzenle</summary>
                  <div className="mt-4">
                    <BannerForm
                      action={updateBannerAction.bind(null, b.id)}
                      provinces={provinces}
                      defaults={{
                        title: b.title,
                        subtitle: b.subtitle,
                        linkUrl: b.linkUrl,
                        buttonText: b.buttonText,
                        sortOrder: b.sortOrder,
                        placement: b.placement === "LISTING" ? "LISTING" : "HERO",
                        provinceId: b.provinceId,
                        isActive: b.isActive,
                        startsAt: toLocalDateTimeInput(b.startsAt),
                        endsAt: toLocalDateTimeInput(b.endsAt),
                        imageUrl: b.imageUrl,
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
