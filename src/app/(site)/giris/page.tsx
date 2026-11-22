import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomer } from "@/server/auth/guards";
import { CustomerLoginForm } from "@/components/auth/customer-forms";
import { AuthCard } from "@/components/site/auth-card";
import { Alert } from "@/components/ui/feedback";
import { safeNext } from "@/lib/safe-next";
import { customerLoginAction } from "../auth-actions";

export const metadata: Metadata = { title: "Müşteri girişi" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; sifre?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCustomer()) redirect(next);
  const fromBooking = next.includes("/randevu");
  return (
    <AuthCard
      title="Müşteri girişi"
      description={
        <>
          Hesabınız yok mu?{" "}
          <Link href={`/kayit?next=${encodeURIComponent(next)}`} className="font-medium text-stone-900 underline underline-offset-4">
            Kayıt olun
          </Link>
          <span className="mt-1 block">
            İşletme sahibi misiniz?{" "}
            <Link href="/isletme" className="font-medium text-stone-900 underline underline-offset-4">
              İşletme girişi
            </Link>
          </span>
        </>
      }
    >
      {fromBooking && (
        <Alert tone="info" className="mb-4">
          Randevunuzu tamamlamak için giriş yapın. Seçimleriniz korunuyor.
        </Alert>
      )}
      {sp.sifre === "yenilendi" && (
        <Alert tone="success" className="mb-4">
          Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.
        </Alert>
      )}
      <CustomerLoginForm action={customerLoginAction} next={next} />
    </AuthCard>
  );
}
