import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomer } from "@/server/auth/guards";
import { RegisterForm } from "@/components/auth/customer-forms";
import { AuthCard } from "@/components/site/auth-card";
import { Alert } from "@/components/ui/feedback";
import { safeNext } from "@/lib/safe-next";
import { registerAction } from "../auth-actions";

export const metadata: Metadata = { title: "Müşteri kayıt" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/hesabim?kayit=1");
  if (await getCustomer()) redirect(next);
  return (
    <AuthCard
      title="Müşteri hesabı oluştur"
      description={
        <>
          Zaten hesabınız var mı?{" "}
          <Link href={`/giris?next=${encodeURIComponent(next)}`} className="font-medium text-stone-900 underline underline-offset-4">
            Giriş yapın
          </Link>
        </>
      }
    >
      {next.includes("/randevu") && (
        <Alert tone="info" className="mb-4">
          Kayıt olduktan sonra seçtiğiniz randevuya geri döneceksiniz.
        </Alert>
      )}
      <RegisterForm action={registerAction} next={next} />
    </AuthCard>
  );
}
