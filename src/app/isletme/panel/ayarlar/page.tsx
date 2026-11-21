import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getBookingSettings } from "@/server/modules/business/settings";
import { getSetting } from "@/server/modules/platform/settings";
import { Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { BookingSettingsForm } from "./form";
import { saveBookingSettingsAction } from "./actions";

export const metadata = { title: "Randevu Ayarları" };

export default async function SettingsPage() {
  const ctx = await requireBusinessPage();
  const [s, confirmH, cutoff] = [await getBookingSettings(db, ctx.businessId), await getSetting(db, "booking.confirmWindowHours"), await getSetting(db, "booking.customerCancelCutoffMinutes")];
  return (
    <>
      <PageHeader title="Randevu ayarları" />
      <Card className="mb-6">
        <CardHeader title="Online randevu kuralları" />
        <div className="p-6">
          <BookingSettingsForm action={saveBookingSettingsAction} defaults={s} />
        </div>
      </Card>
      <Card className="p-6 text-sm text-stone-600">
        <p className="font-medium text-stone-900">Platform kuralları</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Online talepler {confirmH} saat içinde (randevu saati daha yakınsa o saate kadar) onaylanmazsa otomatik iptal olur.</li>
          <li>Müşteriler randevuya {Math.round(cutoff / 60)} saat kalana kadar iptal ya da değişiklik yapabilir.</li>
          <li>Ödeme işletmede yapılır; online ödeme alınmaz.</li>
        </ul>
      </Card>
    </>
  );
}
