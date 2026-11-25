import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getSetting } from "@/server/modules/platform/settings";
import { Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { BankForm, ContactForm, LaunchForm, LegalForm } from "./form";
import { saveBankAction, saveContactAction, saveLaunchAction, saveLegalAction } from "./actions";
import { launchState } from "@/server/modules/marketplace/launch";

export const metadata = { title: "Platform Ayarları" };

export default async function SettingsPage() {
  await requireAdminPage();
  const contact = await getSetting(db, "platform.contact");
  const bank = await getSetting(db, "billing.bankTransfer");
  const launch = await launchState();
  const legal = { customerPrivacy: await getSetting(db, "legal.customerPrivacy"), terms: await getSetting(db, "legal.terms") };
  return (
    <>
      <PageHeader title="Platform ayarları" description="Abonelik ve kampanya kuralları Abonelikler sayfasındadır." />
      <Card>
        <CardHeader title="Lansman modu" description="Platform boş görünmesin: yeterli berber olana kadar müşterilere liste gösterilmez." />
        <div className="p-6">
          <LaunchForm action={saveLaunchAction} defaults={{ enabled: launch.enabled, autoOpenAt: launch.autoOpenAt }} published={launch.published} />
        </div>
      </Card>
      <Card className="mt-6">
        <CardHeader title="İletişim ve bildirimler" />
        <div className="p-6">
          <ContactForm action={saveContactAction} defaults={contact} />
        </div>
      </Card>
      <Card className="mt-6">
        <CardHeader title="Havale / EFT bilgileri" description="Ödeme yöntemi olarak havaleyi seçen işletmelere gösterilir." />
        <div className="p-6">
          <BankForm action={saveBankAction} defaults={bank} />
        </div>
      </Card>
      <Card className="mt-6">
        <CardHeader title="Müşteri yasal metinleri" />
        <div className="p-6">
          <LegalForm action={saveLegalAction} defaults={legal} />
        </div>
      </Card>
    </>
  );
}
