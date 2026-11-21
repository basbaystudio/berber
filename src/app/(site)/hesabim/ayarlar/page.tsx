import { eq } from "drizzle-orm";
import { requireCustomer } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { customers } from "@/server/db/schema";
import { Card, CardHeader } from "@/components/ui/feedback";
import { DeleteForm, PasswordForm, ProfileForm } from "./forms";
import { changePasswordAction, deleteAccountAction, updateProfileAction } from "../actions";

export const metadata = { title: "Ayarlar" };

export default async function SettingsPage() {
  const ctx = await requireCustomer();
  const [c] = await db.select().from(customers).where(eq(customers.id, ctx.customer.id));
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Bilgilerim" description={`E-posta: ${c!.email}`} />
        <div className="p-6">
          <ProfileForm action={updateProfileAction} defaults={{ name: c!.name, phone: c!.phone, marketing: c!.marketingConsent }} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Şifre" />
        <div className="p-6">
          <PasswordForm action={changePasswordAction} />
        </div>
      </Card>
      <Card className="border-red-200/70">
        <CardHeader title="Hesabı sil" />
        <div className="p-6">
          <DeleteForm action={deleteAccountAction} />
        </div>
      </Card>
    </div>
  );
}
