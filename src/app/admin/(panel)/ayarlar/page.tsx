import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getSetting } from "@/server/modules/platform/settings";
import { Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { ContactForm } from "./form";
import { saveContactAction } from "./actions";

export const metadata = { title: "Platform Ayarları" };

export default async function SettingsPage() {
  await requireAdminPage();
  const contact = await getSetting(db, "platform.contact");
  return (
    <>
      <PageHeader title="Platform ayarları" description="Abonelik ve kampanya kuralları Abonelikler sayfasındadır." />
      <Card>
        <CardHeader title="İletişim ve bildirimler" />
        <div className="p-6">
          <ContactForm action={saveContactAction} defaults={contact} />
        </div>
      </Card>
    </>
  );
}
