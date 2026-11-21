import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getProfile } from "@/server/modules/business/profile";
import { Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { ImageUploadForm, ProfileForm } from "./forms";
import { removeBusinessImageAction, updateProfileAction, uploadBusinessImageAction } from "./actions";

export const metadata = { title: "İşletme Profili" };

export default async function ProfilePage() {
  const ctx = await requireBusinessPage();
  const p = await getProfile(db, ctx);
  return (
    <>
      <PageHeader title="İşletme profili" description="Müşterilerin profilinizde göreceği bilgiler." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="İletişim ve tanıtım" />
            <div className="p-6">
              <ProfileForm action={updateProfileAction} defaults={{ phone: p.phone, description: p.description }} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Platform tarafından yönetilen bilgiler" description="Değişiklik için platform yönetimiyle iletişime geçin." />
            <dl className="grid gap-x-6 gap-y-3 p-6 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-stone-500">İşletme adı</dt>
              <dd className="text-stone-900">{p.name}</dd>
              <dt className="text-stone-500">Profil adresi</dt>
              <dd className="text-stone-900">/berber/{p.slug}</dd>
              <dt className="text-stone-500">Adres</dt>
              <dd className="text-stone-900">
                {p.addressLine}, {p.districtName}/{p.provinceName}
              </dd>
            </dl>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Logo" description="Kare görsel önerilir." />
            <div className="space-y-3 p-6">
              <div className="max-w-48">
                <ImageUploadForm action={uploadBusinessImageAction.bind(null, "logo")} currentUrl={p.logoUrl} aspect="aspect-square" label="Logo seç" />
              </div>
              {p.logoUrl && (
                <ActionButton action={removeBusinessImageAction.bind(null, "logo")} variant="ghost" confirm="Logo kaldırılsın mı?">
                  Logoyu kaldır
                </ActionButton>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Kapak görseli" description="Profilinizin üst kısmında görünür." />
            <div className="space-y-3 p-6">
              <ImageUploadForm action={uploadBusinessImageAction.bind(null, "cover")} currentUrl={p.coverUrl} aspect="aspect-[20/9]" label="Kapak görseli seç" />
              {p.coverUrl && (
                <ActionButton action={removeBusinessImageAction.bind(null, "cover")} variant="ghost" confirm="Kapak görseli kaldırılsın mı?">
                  Kapak görselini kaldır
                </ActionButton>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
